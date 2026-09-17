/* Kontakty: seznam, filtry, hromadné akce, detail a ruční přidání. */

import { ziskej, posli, uprav, smaz } from '../api.js';
import {
  h, vycisti, cislo, datum, datumCas, stitek, stavKontaktu, stavPrijemce, oznam, oznamChybu,
  dialog, potvrdit, sPrubehem, zpozdene, pole, zaskrtavatko, prazdnyStav, strankovani, sklonuj,
} from '../ui.js';

const ZDROJE = { web: 'Web', import: 'Import', rucne: 'Ručně' };

/* Výběr štítků zaškrtávátky — používá detail, přidání i import. */
export function vyberStitku(vsechny, vybrane = []) {
  const zvolene = new Set(vybrane);
  const prvek = h('div', { class: 'vyber-stitku' },
    vsechny.length
      ? vsechny.map((s) => {
        const box = h('input', {
          type: 'checkbox', checked: zvolene.has(s.id),
          onchange: (e) => (e.target.checked ? zvolene.add(s.id) : zvolene.delete(s.id)),
        });
        return h('label', { class: 'vyber-stitku__volba' }, box, stitek(s));
      })
      : h('p', { class: 'pole__napoveda' }, 'Zatím nemáte žádné štítky. ', h('a', { href: '#/stitky' }, 'Založit štítek')),
  );
  return { prvek, hodnota: () => [...zvolene] };
}

function adresa(params) {
  const q = new URLSearchParams();
  for (const klic of ['q', 'stav', 'stitek', 'stranka']) {
    const v = params.get(klic);
    if (v) q.set(klic, v);
  }
  return q;
}

function nastavFiltr(params, klic, hodnota) {
  const novy = adresa(params);
  if (hodnota) novy.set(klic, hodnota); else novy.delete(klic);
  if (klic !== 'stranka') novy.delete('stranka');
  const dotaz = novy.toString();
  location.hash = `#/kontakty${dotaz ? `?${dotaz}` : ''}`;
}

export async function stranka(obsah, params) {
  const [data, stitkyData] = await Promise.all([
    ziskej(`/api/kontakty?${adresa(params)}`),
    ziskej('/api/stitky'),
  ]);
  const vsechnyStitky = stitkyData.polozky;
  const vybrane = new Set();

  const hledat = h('input', {
    type: 'search', class: 'vstup', placeholder: 'Hledat e-mail nebo jméno…', value: params.get('q') || '',
    'aria-label': 'Hledat',
    oninput: zpozdene((e) => nastavFiltr(params, 'q', e.target.value.trim()), 400),
  });
  const filtrStavu = h('select', {
    class: 'vstup', 'aria-label': 'Stav', value: params.get('stav') || '',
    onchange: (e) => nastavFiltr(params, 'stav', e.target.value),
  },
  h('option', { value: '', text: 'Všechny stavy' }),
  h('option', { value: 'prihlasen', text: 'Přihlášení' }),
  h('option', { value: 'cekajici', text: 'Čekají na potvrzení' }),
  h('option', { value: 'odhlasen', text: 'Odhlášení' }));

  const filtrStitku = h('select', {
    class: 'vstup', 'aria-label': 'Štítek', value: params.get('stitek') || '',
    onchange: (e) => nastavFiltr(params, 'stitek', e.target.value),
  },
  h('option', { value: '', text: 'Všechny štítky' }),
  vsechnyStitky.map((s) => h('option', { value: String(s.id), text: s.nazev })));

  const exportAdresa = new URLSearchParams(adresa(params));
  exportAdresa.delete('stranka');

  /* Lišta hromadných akcí se ukáže, jakmile je něco vybrané. */
  const pocetVybranych = h('span', { class: 'hromadne__pocet' });
  const vyberStitkuHromadne = h('select', { class: 'vstup vstup--male', 'aria-label': 'Štítek pro hromadnou akci' },
    h('option', { value: '', text: 'Štítek…' }),
    vsechnyStitky.map((s) => h('option', { value: String(s.id), text: s.nazev })));

  async function hromadne(akce, tlacitko) {
    const ids = [...vybrane];
    const stitekId = vyberStitkuHromadne.value;
    if ((akce === 'pridatStitek' || akce === 'odebratStitek') && !stitekId) {
      oznam('Vyberte štítek.', 'chyba');
      vyberStitkuHromadne.focus();
      return;
    }
    if (akce === 'smazat' && !(await potvrdit({
      titulek: 'Smazat kontakty?',
      text: `Smaže se ${ids.length} ${sklonuj(ids.length, 'kontakt', 'kontakty', 'kontaktů')} i jejich stopa v historii rozesílek. Nejde to vrátit.`,
      tlacitko: 'Smazat', nebezpecne: true,
    }))) return;
    if (akce === 'odhlasit' && !(await potvrdit({
      titulek: 'Odhlásit kontakty?',
      text: `${ids.length} ${sklonuj(ids.length, 'kontakt přestane', 'kontakty přestanou', 'kontaktů přestane')} dostávat e-maily. Znovu je přihlásit půjde jen s jejich novým souhlasem.`,
      tlacitko: 'Odhlásit',
    }))) return;

    await sPrubehem(tlacitko, async () => {
      try {
        await posli('/api/kontakty/hromadne', { ids, akce, stitek: stitekId ? Number(stitekId) : undefined });
        oznam('Hotovo.');
        stranka(obsah, params);
      } catch (err) {
        oznamChybu(err);
      }
    });
  }

  const hromadnaLista = h('div', { class: 'hromadne', hidden: true },
    pocetVybranych,
    vyberStitkuHromadne,
    h('button', { type: 'button', class: 'tlacitko tlacitko--male', onclick: (e) => hromadne('pridatStitek', e.currentTarget) }, 'Přidat štítek'),
    h('button', { type: 'button', class: 'tlacitko tlacitko--male', onclick: (e) => hromadne('odebratStitek', e.currentTarget) }, 'Odebrat štítek'),
    h('span', { class: 'hromadne__oddelovac' }),
    h('button', { type: 'button', class: 'tlacitko tlacitko--male', onclick: (e) => hromadne('odhlasit', e.currentTarget) }, 'Odhlásit'),
    h('button', { type: 'button', class: 'tlacitko tlacitko--male tlacitko--nebezpecne', onclick: (e) => hromadne('smazat', e.currentTarget) }, 'Smazat'),
  );

  const zaskrtnoutVse = h('input', { type: 'checkbox', 'aria-label': 'Vybrat vše na stránce' });
  const boxy = [];

  function obnovVyber() {
    hromadnaLista.hidden = vybrane.size === 0;
    pocetVybranych.textContent = `Vybráno: ${vybrane.size}`;
    zaskrtnoutVse.checked = boxy.length > 0 && boxy.every((b) => b.checked);
    zaskrtnoutVse.indeterminate = vybrane.size > 0 && !zaskrtnoutVse.checked;
  }
  zaskrtnoutVse.addEventListener('change', () => {
    for (const b of boxy) {
      b.checked = zaskrtnoutVse.checked;
      b.dispatchEvent(new Event('change'));
    }
  });

  const radky = data.polozky.map((k) => {
    const box = h('input', {
      type: 'checkbox', 'aria-label': `Vybrat ${k.email}`,
      onchange: (e) => { if (e.target.checked) vybrane.add(k.id); else vybrane.delete(k.id); obnovVyber(); },
      onclick: (e) => e.stopPropagation(),
    });
    boxy.push(box);
    return h('tr', { class: 'tabulka__radek--klik', onclick: () => detailKontaktu(k.id, vsechnyStitky, () => stranka(obsah, params)) },
      h('td', { class: 'tabulka__vyber' }, box),
      h('td', null,
        h('button', { type: 'button', class: 'odkaz-tlacitko', text: k.email }),
        (k.jmeno || k.prijmeni) ? h('div', { class: 'tabulka__podtext', text: `${k.jmeno} ${k.prijmeni}`.trim() }) : null,
      ),
      h('td', null, h('div', { class: 'stitky' }, k.stitky.map((s) => stitek(s)))),
      h('td', null, stavKontaktu(k.stav)),
      h('td', { class: 'tabulka__skryt-mobil' }, ZDROJE[k.zdroj] || k.zdroj),
      h('td', { class: 'tabulka__skryt-mobil' }, datum(k.vytvoreno)),
    );
  });

  const maFiltr = params.get('q') || params.get('stav') || params.get('stitek');

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Kontakty' }),
        h('p', { class: 'hlavicka__text', text: `${cislo(data.celkem)} ${sklonuj(data.celkem, 'kontakt', 'kontakty', 'kontaktů')}${maFiltr ? ' odpovídá filtru' : ''}` }),
      ),
      h('div', { class: 'hlavicka__akce' },
        h('a', { href: `/api/kontakty/export?${exportAdresa}`, class: 'tlacitko', download: '' }, 'Export CSV'),
        h('a', { href: '#/kontakty/import', class: 'tlacitko' }, 'Import CSV'),
        h('button', { type: 'button', class: 'tlacitko tlacitko--hlavni', onclick: () => pridatKontakt(vsechnyStitky, () => stranka(obsah, params)) }, 'Přidat kontakt'),
      ),
    ),
    h('div', { class: 'filtry' }, hledat, filtrStavu, filtrStitku),
    hromadnaLista,
    data.polozky.length
      ? h('div', { class: 'tabulka-obal' },
        h('table', { class: 'tabulka' },
          h('thead', null, h('tr', null,
            h('th', { class: 'tabulka__vyber' }, zaskrtnoutVse),
            h('th', { text: 'Kontakt' }),
            h('th', { text: 'Štítky' }),
            h('th', { text: 'Stav' }),
            h('th', { class: 'tabulka__skryt-mobil', text: 'Zdroj' }),
            h('th', { class: 'tabulka__skryt-mobil', text: 'Přidáno' }),
          )),
          h('tbody', null, radky),
        ))
      : maFiltr
        ? prazdnyStav('Nic nenalezeno', 'Zkuste upravit hledání nebo filtry.',
          h('a', { href: '#/kontakty', class: 'tlacitko' }, 'Zrušit filtry'))
        : prazdnyStav('Zatím žádné kontakty', 'Naimportujte je z CSV nebo přidejte ručně. Z webu přibudou samy, jakmile se někdo přihlásí k odběru.',
          h('a', { href: '#/kontakty/import', class: 'tlacitko tlacitko--hlavni' }, 'Importovat z CSV')),
    strankovani({ ...data, zmen: (s) => nastavFiltr(params, 'stranka', String(s)) }),
  );

  // Hledání si po překreslení zachová fokus a kurzor.
  if (params.get('q') !== null && document.activeElement === document.body) {
    hledat.focus();
    hledat.setSelectionRange(hledat.value.length, hledat.value.length);
  }
}

function souhlasPole(popisekZaskrtnuti) {
  const potvrzeni = zaskrtavatko({ popisek: popisekZaskrtnuti });
  const poznamka = pole({
    popisek: 'Kdy a jak souhlas dal',
    placeholder: 'např. podepsaný souhlas na schůzce 12. 9. 2026',
    maxlength: 300,
    napoveda: 'Uloží se ke kontaktu jako doklad souhlasu.',
  });
  return { potvrzeni, poznamka };
}

function pridatKontakt(vsechnyStitky, poUlozeni) {
  const email = pole({ popisek: 'E-mail', type: 'email', required: true });
  const jmeno = pole({ popisek: 'Jméno', napoveda: 'Použije se v oslovení {{jmeno}}.' });
  const prijmeni = pole({ popisek: 'Příjmení' });
  const stitky = vyberStitku(vsechnyStitky);
  const souhlas = souhlasPole('Kontakt souhlasil se zasíláním novinek e-mailem');
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });

  const formular = h('form', {
    id: 'formular-kontakt', class: 'formular',
    onsubmit: async (e) => {
      e.preventDefault();
      chyba.hidden = true;
      try {
        await posli('/api/kontakty', {
          email: email.prvek.value,
          jmeno: jmeno.prvek.value,
          prijmeni: prijmeni.prvek.value,
          stitky: stitky.hodnota(),
          souhlasPotvrzen: souhlas.potvrzeni.prvek.checked,
          souhlasPoznamka: souhlas.poznamka.prvek.value,
        });
        okno.zavrit();
        oznam('Kontakt přidán.');
        poUlozeni();
      } catch (err) {
        chyba.textContent = err.message;
        chyba.hidden = false;
      }
    },
  },
  email.obal,
  h('div', { class: 'formular__dvojice' }, jmeno.obal, prijmeni.obal),
  h('div', { class: 'pole' }, h('span', { class: 'pole__popisek', text: 'Štítky' }), stitky.prvek),
  h('fieldset', { class: 'souhlas' },
    h('legend', { text: 'Souhlas' }),
    souhlas.potvrzeni.obal,
    souhlas.poznamka.obal,
  ),
  chyba);

  const okno = dialog({
    titulek: 'Přidat kontakt',
    obsah: formular,
    akce: [{ text: 'Zrušit' }, { text: 'Přidat', typ: 'hlavni', submit: 'formular-kontakt' }],
  });
  email.prvek.focus();
}

async function detailKontaktu(id, vsechnyStitky, poZmene) {
  let k;
  try {
    k = await ziskej(`/api/kontakty/${id}`);
  } catch (err) {
    return oznamChybu(err);
  }

  let zmeneno = false;
  const jmeno = pole({ popisek: 'Jméno', value: k.jmeno });
  const prijmeni = pole({ popisek: 'Příjmení', value: k.prijmeni });
  const stitky = vyberStitku(vsechnyStitky, k.stitky.map((s) => s.id));
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });

  /* Změna stavu: odhlásit jde vždy, znovu přihlásit jen s novým souhlasem. */
  let novyStav;
  const souhlas = souhlasPole('Kontakt znovu souhlasil se zasíláním novinek');
  const znovuPrihlasit = h('div', { class: 'souhlas-blok', hidden: true },
    h('fieldset', { class: 'souhlas' }, h('legend', { text: 'Nový souhlas' }), souhlas.potvrzeni.obal, souhlas.poznamka.obal));

  const stavAkce = k.stav === 'odhlasen'
    ? h('button', {
      type: 'button', class: 'tlacitko tlacitko--male',
      onclick: (e) => { novyStav = 'prihlasen'; znovuPrihlasit.hidden = false; e.currentTarget.hidden = true; },
    }, 'Znovu přihlásit…')
    : h('button', {
      type: 'button', class: 'tlacitko tlacitko--male',
      onclick: async () => {
        if (!(await potvrdit({ titulek: 'Odhlásit kontakt?', text: `${k.email} přestane dostávat e-maily.`, tlacitko: 'Odhlásit' }))) return;
        try {
          await uprav(`/api/kontakty/${id}`, { stav: 'odhlasen' });
          oznam('Kontakt odhlášen.');
          okno.zavrit();
          poZmene();
        } catch (err) { oznamChybu(err); }
      },
    }, 'Odhlásit');

  const historie = k.historie.length
    ? h('ul', { class: 'seznam seznam--kompaktni' }, k.historie.map((p) => h('li', null,
      h('a', { class: 'seznam__polozka', href: `#/odeslane/${p.kampan_id}`, onclick: () => okno.zavrit() },
        h('span', { class: 'seznam__hlavni' },
          h('span', { class: 'seznam__titulek', text: p.predmet }),
          h('span', { class: 'seznam__meta', text: datumCas(p.odeslano || p.vytvoreno) }),
        ),
        stavPrijemce(p.stav),
      ))))
    : h('p', { class: 'pole__napoveda' }, 'Zatím mu nic neodešlo.');

  const formular = h('form', {
    id: 'formular-detail', class: 'formular',
    onsubmit: async (e) => {
      e.preventDefault();
      chyba.hidden = true;
      const telo = { jmeno: jmeno.prvek.value, prijmeni: prijmeni.prvek.value, stitky: stitky.hodnota() };
      if (novyStav === 'prihlasen') {
        Object.assign(telo, {
          stav: 'prihlasen',
          souhlasPotvrzen: souhlas.potvrzeni.prvek.checked,
          souhlasPoznamka: souhlas.poznamka.prvek.value,
        });
      }
      try {
        await uprav(`/api/kontakty/${id}`, telo);
        zmeneno = true;
        okno.zavrit();
        oznam('Uloženo.');
      } catch (err) {
        chyba.textContent = err.message;
        chyba.hidden = false;
      }
    },
  },
  h('dl', { class: 'udaje' },
    h('dt', { text: 'E-mail' }), h('dd', { text: k.email }),
    h('dt', { text: 'Stav' }), h('dd', { class: 'udaje__stav' }, stavKontaktu(k.stav), stavAkce),
    h('dt', { text: 'Zdroj' }), h('dd', { text: `${ZDROJE[k.zdroj] || k.zdroj}, ${datumCas(k.vytvoreno)}` }),
    h('dt', { text: 'Souhlas' }), h('dd', { text: k.souhlas_cas ? `${datumCas(k.souhlas_cas)} — ${k.souhlas_poznamka || ''}` : 'neudělen' }),
    k.odhlaseno ? [h('dt', { text: 'Odhlášen' }), h('dd', { text: datumCas(k.odhlaseno) })] : null,
  ),
  znovuPrihlasit,
  h('div', { class: 'formular__dvojice' }, jmeno.obal, prijmeni.obal),
  h('div', { class: 'pole' }, h('span', { class: 'pole__popisek', text: 'Štítky' }), stitky.prvek),
  h('div', { class: 'pole' }, h('span', { class: 'pole__popisek', text: 'Odeslané e-maily' }), historie),
  chyba);

  const okno = dialog({
    titulek: k.jmeno || k.prijmeni ? `${k.jmeno} ${k.prijmeni}`.trim() : k.email,
    obsah: formular,
    siroky: true,
    akce: [
      {
        text: 'Smazat kontakt', typ: 'nebezpecne-obrys',
        onClick: async (zavrit) => {
          if (!(await potvrdit({
            titulek: 'Smazat kontakt?',
            text: `${k.email} zmizí z kontaktů i z historie rozesílek (podle GDPR). Nejde to vrátit.`,
            tlacitko: 'Smazat', nebezpecne: true,
          }))) return;
          try {
            await smaz(`/api/kontakty/${id}`);
            zmeneno = true;
            zavrit();
            oznam('Kontakt smazán.');
          } catch (err) { oznamChybu(err); }
        },
      },
      { text: 'Zavřít' },
      { text: 'Uložit', typ: 'hlavni', submit: 'formular-detail' },
    ],
    poZavreni: () => { if (zmeneno) poZmene(); },
  });
}
