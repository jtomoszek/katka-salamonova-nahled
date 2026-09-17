/* Napsat e-mail: předmět, text, přílohy, výběr příjemců podle štítků,
 * náhled, zkušební e-mail a odeslání.
 *
 * Rozepsaný e-mail se průběžně ukládá do prohlížeče, takže ho nesmaže
 * obnovení stránky ani odhlášení. */

import { ziskej, posli, smaz } from '../api.js';
import {
  h, vycisti, cislo, velikost, stitek, oznam, oznamChybu, dialog, potvrdit, sPrubehem, zpozdene, sklonuj, zaskrtavatko,
} from '../ui.js';

const KLIC_KONCEPTU = 'katka-admin-koncept';

function nactiKoncept() {
  try {
    return JSON.parse(localStorage.getItem(KLIC_KONCEPTU)) || {};
  } catch {
    return {};
  }
}

function ulozKoncept(koncept) {
  try {
    localStorage.setItem(KLIC_KONCEPTU, JSON.stringify(koncept));
  } catch { /* soukromé okno apod. — koncept se prostě neuloží */ }
}

function smazKoncept() {
  try { localStorage.removeItem(KLIC_KONCEPTU); } catch { /* nic */ }
}

export async function stranka(obsah) {
  const { polozky: vsechnyStitky } = await ziskej('/api/stitky');
  const koncept = nactiKoncept();
  const stav = {
    predmet: koncept.predmet || '',
    text: koncept.text || '',
    vyber: koncept.vyber || 'vsem',
    stitky: new Set((koncept.stitky || []).filter((id) => vsechnyStitky.some((s) => s.id === id))),
    prilohy: koncept.prilohy || [],
    sekce: { pilire: koncept.sekce?.pilire !== false, studie: koncept.sekce?.studie !== false },
    pocet: null,
  };

  const uloz = zpozdene(() => ulozKoncept({
    predmet: stav.predmet, text: stav.text, vyber: stav.vyber, stitky: [...stav.stitky], prilohy: stav.prilohy, sekce: stav.sekce,
  }), 400);

  /* Volitelné bloky šablony. Hlavička, úvod, osobní slovo, citát,
     „Co u mě nenajdete“ a patička jsou v každém vydání. */
  const volbySekci = [
    ['pilire', 'Pilíře prosperity', 'Čtyři služby: domov, investice, ochrana, odkaz.'],
    ['studie', 'Případová studie', 'Transformace 10 produktů v jeden ekosystém.'],
  ].map(([klic, popisek, napoveda]) => {
    const { obal } = zaskrtavatko({
      popisek: h('span', null, h('strong', { text: popisek }), h('span', { class: 'pole__napoveda', text: napoveda })),
      checked: stav.sekce[klic],
      onchange: (e) => { stav.sekce[klic] = e.target.checked; uloz(); },
    });
    return obal;
  });

  /* ---------- obsah ---------- */

  const predmet = h('input', {
    class: 'vstup vstup--velke', id: 'predmet', value: stav.predmet, maxlength: 200, placeholder: 'Např. Co přinese rok 2027 vašim úsporám',
    oninput: (e) => { stav.predmet = e.target.value; uloz(); },
  });

  const text = h('textarea', {
    class: 'vstup editor', id: 'text', rows: 16, value: stav.text,
    placeholder: 'Dobrý den, {{jmeno}},\n\n…',
    oninput: (e) => { stav.text = e.target.value; uloz(); },
  });

  function vlozOsloveni() {
    const { selectionStart: od, selectionEnd: do_ } = text;
    text.setRangeText('{{jmeno}}', od, do_, 'end');
    text.dispatchEvent(new Event('input'));
    text.focus();
  }

  /* ---------- přílohy ---------- */

  const seznamPriloh = h('ul', { class: 'prilohy' });
  const vstupPrilohy = h('input', { type: 'file', multiple: true, class: 'vizualne-skryte', id: 'prilohy-vstup' });

  function vykresliPrilohy() {
    const celkem = stav.prilohy.reduce((s, p) => s + p.velikost, 0);
    vycisti(seznamPriloh,
      stav.prilohy.map((p) => h('li', { class: 'priloha' },
        h('span', { class: 'priloha__nazev', text: p.nazev }),
        h('span', { class: 'priloha__velikost', text: velikost(p.velikost) }),
        h('button', {
          type: 'button', class: 'priloha__odebrat', 'aria-label': `Odebrat ${p.nazev}`,
          onclick: async () => {
            stav.prilohy = stav.prilohy.filter((x) => x.id !== p.id);
            vykresliPrilohy();
            uloz();
            smaz(`/api/prilohy/${p.id}`).catch(() => { /* úklid zvládne i server */ });
          },
        }, '×'),
      )),
      stav.prilohy.length > 1 ? h('li', { class: 'prilohy__celkem', text: `Celkem ${velikost(celkem)} z 15 MB` }) : null,
    );
  }

  vstupPrilohy.addEventListener('change', async () => {
    const soubory = [...vstupPrilohy.files];
    vstupPrilohy.value = '';
    for (const soubor of soubory) {
      if (soubor.size > 10 * 1024 * 1024) {
        oznam(`${soubor.name} je větší než 10 MB.`, 'chyba');
        continue;
      }
      const polozka = h('li', { class: 'priloha priloha--nahrava' },
        h('span', { class: 'priloha__nazev', text: soubor.name }), h('span', { class: 'priloha__velikost', text: 'nahrávám…' }));
      seznamPriloh.append(polozka);
      try {
        const form = new FormData();
        form.append('soubor', soubor);
        const p = await posli('/api/prilohy', form);
        stav.prilohy.push({ id: p.id, nazev: p.nazev, velikost: p.velikost });
        uloz();
      } catch (err) {
        oznamChybu(err);
      }
      vykresliPrilohy();
    }
  });

  /* ---------- příjemci ---------- */

  const pocetPrijemcu = h('p', { class: 'prijemci__pocet', 'aria-live': 'polite' });
  const vyberStitkuObal = h('div', { class: 'vyber-stitku' });

  const zjistiPocet = zpozdene(async () => {
    if (stav.vyber !== 'vsem' && !stav.stitky.size) {
      stav.pocet = 0;
      pocetPrijemcu.textContent = 'Vyberte aspoň jeden štítek.';
      pocetPrijemcu.className = 'prijemci__pocet prijemci__pocet--nula';
      return;
    }
    pocetPrijemcu.textContent = 'Počítám…';
    try {
      const { pocet } = await posli('/api/kampane/pocet', { vyber: stav.vyber, stitky: [...stav.stitky] });
      stav.pocet = pocet;
      pocetPrijemcu.textContent = pocet
        ? `E-mail dostane ${cislo(pocet)} ${sklonuj(pocet, 'přihlášený kontakt', 'přihlášené kontakty', 'přihlášených kontaktů')}.`
        : 'Výběru neodpovídá žádný přihlášený kontakt.';
      pocetPrijemcu.className = `prijemci__pocet ${pocet ? '' : 'prijemci__pocet--nula'}`;
    } catch (err) {
      pocetPrijemcu.textContent = err.message;
    }
  }, 250);

  function vykresliVyberStitku() {
    vyberStitkuObal.hidden = stav.vyber === 'vsem';
    vycisti(vyberStitkuObal, vsechnyStitky.length
      ? vsechnyStitky.map((s) => h('label', { class: 'vyber-stitku__volba' },
        h('input', {
          type: 'checkbox', checked: stav.stitky.has(s.id),
          onchange: (e) => {
            if (e.target.checked) stav.stitky.add(s.id); else stav.stitky.delete(s.id);
            uloz();
            zjistiPocet();
          },
        }),
        stitek(s),
        h('span', { class: 'vyber-stitku__pocet', text: cislo(s.prihlasenych) }),
      ))
      : h('p', { class: 'pole__napoveda' }, 'Zatím nemáte žádné štítky. ', h('a', { href: '#/stitky' }, 'Založit štítek')));
  }

  const volbyVyberu = [
    ['vsem', 'Všem přihlášeným'],
    ['kterykoli', 'Kontaktům s aspoň jedním z vybraných štítků'],
    ['vsechny', 'Kontaktům, které mají všechny vybrané štítky'],
  ].map(([hodnota, popisek]) => h('label', { class: 'zaskrtavatko' },
    h('input', {
      type: 'radio', name: 'vyber', value: hodnota, checked: stav.vyber === hodnota,
      onchange: () => { stav.vyber = hodnota; uloz(); vykresliVyberStitku(); zjistiPocet(); },
    }),
    h('span', null, popisek)));

  /* ---------- akce ---------- */

  function zkontroluj() {
    if (!stav.predmet.trim()) { oznam('Doplňte předmět.', 'chyba'); predmet.focus(); return false; }
    if (!stav.text.trim()) { oznam('Napište text e-mailu.', 'chyba'); text.focus(); return false; }
    return true;
  }

  async function nahled(tlacitko) {
    await sPrubehem(tlacitko, async () => {
      try {
        const { html } = await posli('/api/kampane/nahled', { predmet: stav.predmet, text: stav.text, sekce: stav.sekce });
        // Sandbox bez allow-scripts: v náhledu se nic nespustí.
        const ramec = h('iframe', { class: 'nahled-ramec', sandbox: '', title: 'Náhled e-mailu', srcdoc: html });
        dialog({
          titulek: stav.predmet || 'Náhled e-mailu',
          obsah: h('div', null,
            h('p', { class: 'pole__napoveda', text: 'Oslovení je v náhledu vyplněné jménem „Jana“. Váš text je v bloku „Osobní slovo“.' }),
            ramec),
          siroky: true,
          akce: [{ text: 'Zavřít' }],
        });
      } catch (err) { oznamChybu(err); }
    });
  }

  async function zkusebni(tlacitko) {
    if (!zkontroluj()) return;
    await sPrubehem(tlacitko, async () => {
      try {
        const r = await posli('/api/kampane/test', { predmet: stav.predmet, text: stav.text, sekce: stav.sekce, prilohy: stav.prilohy.map((p) => p.id) });
        oznam(`Zkušební e-mail odešel na ${r.komu}.`);
      } catch (err) { oznamChybu(err); }
    });
  }

  async function odeslat(tlacitko) {
    if (!zkontroluj()) return;
    if (!stav.pocet) { oznam('Nemáte komu odeslat — zkontrolujte výběr příjemců.', 'chyba'); return; }

    const pocet = stav.pocet;
    const ok = await potvrdit({
      titulek: 'Odeslat e-mail?',
      text: `„${stav.predmet}“ odejde ${cislo(pocet)} ${sklonuj(pocet, 'příjemci', 'příjemcům', 'příjemcům')}${stav.prilohy.length ? ` s ${stav.prilohy.length} ${sklonuj(stav.prilohy.length, 'přílohou', 'přílohami', 'přílohami')}` : ''}. Odeslání nejde vzít zpět.`,
      tlacitko: `Odeslat ${cislo(pocet)} ${sklonuj(pocet, 'příjemci', 'příjemcům', 'příjemcům')}`,
    });
    if (!ok) return;

    await sPrubehem(tlacitko, async () => {
      try {
        const r = await posli('/api/kampane', {
          predmet: stav.predmet,
          text: stav.text,
          sekce: stav.sekce,
          vyber: stav.vyber,
          stitky: [...stav.stitky],
          prilohy: stav.prilohy.map((p) => p.id),
          ocekavanyPocet: pocet,
        });
        smazKoncept();
        oznam('E-mail se odesílá.');
        location.hash = `#/odeslane/${r.id}`;
      } catch (err) {
        if (err.status === 409) zjistiPocet();
        oznamChybu(err);
      }
    });
  }

  async function zahodit() {
    if (!(await potvrdit({ titulek: 'Zahodit rozepsaný e-mail?', text: 'Předmět, text i přílohy se smažou.', tlacitko: 'Zahodit', nebezpecne: true }))) return;
    for (const p of stav.prilohy) smaz(`/api/prilohy/${p.id}`).catch(() => {});
    smazKoncept();
    stranka(obsah);
  }

  const maKoncept = Boolean(koncept.predmet || koncept.text || (koncept.prilohy || []).length);

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Napsat e-mail' }),
        h('p', { class: 'hlavicka__text', text: maKoncept ? 'Pokračujete v rozepsaném e-mailu.' : 'Rozepsaný e-mail se průběžně ukládá.' }),
      ),
      maKoncept ? h('div', { class: 'hlavicka__akce' }, h('button', { type: 'button', class: 'tlacitko tlacitko--obrys', onclick: zahodit }, 'Zahodit koncept')) : null,
    ),

    h('div', { class: 'psani' },
      h('section', { class: 'karta psani__obsah' },
        h('div', { class: 'pole' }, h('label', { class: 'pole__popisek', for: 'predmet', text: 'Předmět' }), predmet),
        h('div', { class: 'pole' },
          h('div', { class: 'pole__radek' },
            h('label', { class: 'pole__popisek', for: 'text', text: 'Text' }),
            h('button', { type: 'button', class: 'tlacitko tlacitko--male', onclick: vlozOsloveni }, 'Vložit oslovení {{jmeno}}'),
          ),
          text,
          h('details', { class: 'napoveda-formatu' },
            h('summary', { text: 'Jak formátovat text' }),
            h('ul', null,
              h('li', null, h('code', { text: '{{jmeno}}' }), ' — křestní jméno příjemce. Když ho kontakt nemá, zmizí i s čárkou před ním.'),
              h('li', null, 'Prázdný řádek — nový odstavec.'),
              h('li', null, h('code', { text: '**tučně**' }), ' — tučné písmo.'),
              h('li', null, 'Odkaz stačí vložit celý, např. ', h('code', { text: 'https://…' }), '.'),
              h('li', null, 'Text se vloží do bloku „Osobní slovo“ vedle fotky a nad podpis. Úvod, citát a patička jsou v e-mailu vždy.'),
              h('li', null, 'Odkaz na odhlášení se přidá do patičky automaticky.'),
            ),
          ),
        ),
        h('div', { class: 'pole' },
          h('span', { class: 'pole__popisek', text: 'Přílohy' }),
          seznamPriloh,
          vstupPrilohy,
          h('label', { class: 'tlacitko tlacitko--male', for: 'prilohy-vstup' }, '+ Přiložit soubor'),
          h('p', { class: 'pole__napoveda', text: 'Nejvýš 10 MB na soubor, 15 MB celkem. Velké přílohy snižují šanci, že e-mail neskončí ve spamu.' }),
        ),
      ),

      h('aside', { class: 'psani__bok' },
        h('section', { class: 'karta' },
          h('h2', { class: 'karta__titulek', text: 'Komu' }),
          h('fieldset', { class: 'volby' }, h('legend', { class: 'vizualne-skryte', text: 'Výběr příjemců' }), volbyVyberu),
          vyberStitkuObal,
          pocetPrijemcu,
        ),
        h('section', { class: 'karta' },
          h('h2', { class: 'karta__titulek', text: 'Bloky v e-mailu' }),
          h('div', { class: 'volby' }, volbySekci),
        ),
        h('section', { class: 'karta psani__akce' },
          h('button', { type: 'button', class: 'tlacitko tlacitko--plne', onclick: (e) => nahled(e.currentTarget) }, 'Náhled'),
          h('button', { type: 'button', class: 'tlacitko tlacitko--plne', onclick: (e) => zkusebni(e.currentTarget) }, 'Poslat zkušební e-mail sobě'),
          h('button', { type: 'button', class: 'tlacitko tlacitko--hlavni tlacitko--plne', onclick: (e) => odeslat(e.currentTarget) }, 'Odeslat'),
        ),
      ),
    ),
  );

  vykresliPrilohy();
  vykresliVyberStitku();
  zjistiPocet();
}
