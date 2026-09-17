/* Import kontaktů z CSV ve třech krocích: soubor → mapování a souhlas → výsledek. */

import { ziskej, posli } from '../api.js';
import { h, vycisti, cislo, oznamChybu, pole, zaskrtavatko, sklonuj } from '../ui.js';
import { dekoduj, odhadniOddelovac, parsuj, odhadniMapovani, naKontakty, POLE } from '../csv.js';
import { vyberStitku } from './kontakty.js';

const DAVKA = 500;
const MAX_RADKU = 50_000;

function hlavicka() {
  return h('div', { class: 'hlavicka' },
    h('div', null,
      h('a', { href: '#/kontakty', class: 'zpet', text: '← Kontakty' }),
      h('h1', { text: 'Import kontaktů z CSV' }),
      h('p', { class: 'hlavicka__text', text: 'Soubor z Excelu, Google Tabulek nebo jiného systému. Stačí sloupec s e-mailem.' }),
    ),
  );
}

export async function stranka(obsah) {
  const { polozky: vsechnyStitky } = await ziskej('/api/stitky');
  krokSoubor(obsah, vsechnyStitky);
}

function krokSoubor(obsah, vsechnyStitky) {
  const vstup = h('input', { type: 'file', accept: '.csv,text/csv,.txt', class: 'nahrani__vstup', id: 'csv-soubor' });
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });

  async function nacti(soubor) {
    chyba.hidden = true;
    if (!soubor) return;
    if (soubor.size > 20 * 1024 * 1024) {
      chyba.textContent = 'Soubor je větší než 20 MB. Rozdělte ho prosím na menší části.';
      chyba.hidden = false;
      return;
    }
    const text = dekoduj(await soubor.arrayBuffer());
    const radky = parsuj(text, odhadniOddelovac(text));
    if (!radky.length) {
      chyba.textContent = 'Soubor je prázdný nebo se nedá přečíst.';
      chyba.hidden = false;
      return;
    }
    if (radky.length > MAX_RADKU) {
      chyba.textContent = `Soubor má ${cislo(radky.length)} řádků. Najednou jde naimportovat nejvýš ${cislo(MAX_RADKU)}.`;
      chyba.hidden = false;
      return;
    }
    krokMapovani(obsah, vsechnyStitky, soubor.name, radky);
  }

  const zona = h('label', {
    class: 'nahrani', for: 'csv-soubor',
    ondragover: (e) => { e.preventDefault(); zona.classList.add('nahrani--nad'); },
    ondragleave: () => zona.classList.remove('nahrani--nad'),
    ondrop: (e) => {
      e.preventDefault();
      zona.classList.remove('nahrani--nad');
      nacti(e.dataTransfer.files[0]).catch(oznamChybu);
    },
  },
  vstup,
  h('span', { class: 'nahrani__titulek', text: 'Přetáhněte sem soubor CSV' }),
  h('span', { class: 'nahrani__text', text: 'nebo klikněte a vyberte ho' }));
  vstup.addEventListener('change', () => nacti(vstup.files[0]).catch(oznamChybu));

  vycisti(obsah,
    hlavicka(),
    h('section', { class: 'karta' },
      zona,
      chyba,
      h('div', { class: 'napoveda-blok' },
        h('h2', { class: 'napoveda-blok__titulek', text: 'Jak má soubor vypadat' }),
        h('ul', null,
          h('li', null, 'První řádek může obsahovat názvy sloupců (e-mail, jméno, příjmení, štítky) — rozpoznají se samy.'),
          h('li', null, 'Štítky v jedné buňce oddělte čárkou, např. „Klienti, Hypotéky“. Chybějící štítky se založí.'),
          h('li', null, 'Z Excelu uložte jako „CSV (oddělený středníkem)“. Diakritika se načte správně.'),
          h('li', null, 'Kontakty, které se dřív odhlásily, se importem znovu nepřihlásí.'),
        ),
      ),
    ),
  );
}

function krokMapovani(obsah, vsechnyStitky, nazevSouboru, radky) {
  const odhad = odhadniMapovani(radky);
  let maHlavicku = odhad.maHlavicku;
  const mapovani = [...odhad.mapovani];
  const sloupcu = Math.max(...radky.slice(0, 50).map((r) => r.length));
  while (mapovani.length < sloupcu) mapovani.push('');

  const nahled = h('div', { class: 'tabulka-obal' });
  const souhrn = h('p', { class: 'hlavicka__text' });

  function data() {
    return maHlavicku ? radky.slice(1) : radky;
  }

  function vykresliNahled() {
    const hlavni = maHlavicku ? radky[0] : [];
    const vyberyPoli = Array.from({ length: sloupcu }, (_, i) => h('select', {
      class: 'vstup vstup--male', value: mapovani[i], 'aria-label': `Sloupec ${i + 1}`,
      onchange: (e) => {
        // Každé pole smí být přiřazené jen jednou.
        const nove = e.target.value;
        if (nove) mapovani.forEach((m, j) => { if (m === nove && j !== i) mapovani[j] = ''; });
        mapovani[i] = nove;
        vykresliNahled();
      },
    }, POLE.map(([hodnota, text]) => h('option', { value: hodnota, text }))));

    vycisti(nahled,
      h('table', { class: 'tabulka tabulka--nahled' },
        h('thead', null,
          h('tr', null, vyberyPoli.map((v) => h('th', null, v))),
          maHlavicku ? h('tr', { class: 'tabulka--nahled__hlavicka' }, Array.from({ length: sloupcu }, (_, i) => h('th', { text: hlavni[i] || '' }))) : null,
        ),
        h('tbody', null, data().slice(0, 8).map((r) => h('tr', null,
          Array.from({ length: sloupcu }, (_, i) => h('td', { class: mapovani[i] ? '' : 'tabulka__ztlumene', text: r[i] || '' }))))),
      ));
    const n = data().length;
    souhrn.textContent = `${nazevSouboru} · ${cislo(n)} ${sklonuj(n, 'řádek', 'řádky', 'řádků')}${n > 8 ? ' (náhled prvních 8)' : ''}`;
    tlacitko.disabled = !mapovani.includes('email');
    chybiEmail.hidden = mapovani.includes('email');
  }

  const prepinacHlavicky = zaskrtavatko({
    popisek: 'První řádek obsahuje názvy sloupců',
    checked: maHlavicku,
    onchange: (e) => { maHlavicku = e.target.checked; vykresliNahled(); },
  });

  const stitky = vyberStitku(vsechnyStitky);
  const existujici = h('fieldset', { class: 'volby' },
    h('legend', { class: 'pole__popisek', text: 'Když kontakt už existuje' }),
    h('label', { class: 'zaskrtavatko' }, h('input', { type: 'radio', name: 'existujici', value: 'doplnit', checked: true }), h('span', null, 'Doplnit chybějící jméno a přidat štítky')),
    h('label', { class: 'zaskrtavatko' }, h('input', { type: 'radio', name: 'existujici', value: 'preskocit' }), h('span', null, 'Nechat beze změny')),
  );

  const souhlas = zaskrtavatko({ popisek: 'Potvrzuji, že všechny kontakty v souboru souhlasily se zasíláním novinek e-mailem.' });
  const poznamka = pole({
    popisek: 'Odkud kontakty jsou a jak souhlas dali',
    placeholder: 'např. klienti ze smluv 2024–2026, souhlas v klientské smlouvě',
    maxlength: 300,
    napoveda: 'Uloží se ke každému kontaktu jako doklad souhlasu (GDPR).',
  });

  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });
  const chybiEmail = h('p', { class: 'upozorneni upozorneni--chyba', text: 'Označte sloupec, ve kterém je e-mail.' });
  const tlacitko = h('button', { type: 'submit', class: 'tlacitko tlacitko--hlavni' }, 'Importovat');

  const formular = h('form', {
    class: 'formular',
    onsubmit: (e) => {
      e.preventDefault();
      chyba.hidden = true;
      if (!souhlas.prvek.checked) {
        chyba.textContent = 'Import je možný jen pro kontakty se souhlasem. Potvrďte to prosím.';
        chyba.hidden = false;
        return;
      }
      if (!poznamka.prvek.value.trim()) {
        chyba.textContent = 'Doplňte prosím, odkud kontakty jsou a jak souhlas dali.';
        chyba.hidden = false;
        poznamka.prvek.focus();
        return;
      }
      krokImport(obsah, {
        kontakty: naKontakty(data(), mapovani),
        prvniRadek: maHlavicku ? 2 : 1,
        stitky: stitky.hodnota(),
        existujici: formular.querySelector('input[name="existujici"]:checked').value,
        souhlasPoznamka: poznamka.prvek.value,
      });
    },
  },
  h('section', { class: 'karta' },
    h('div', { class: 'karta__hlava' },
      h('h2', { class: 'karta__titulek', text: '1. Které sloupce jsou které' }),
      h('button', { type: 'button', class: 'tlacitko tlacitko--male', onclick: () => krokSoubor(obsah, vsechnyStitky) }, 'Jiný soubor'),
    ),
    souhrn,
    prepinacHlavicky.obal,
    chybiEmail,
    nahled,
  ),
  h('section', { class: 'karta' },
    h('h2', { class: 'karta__titulek', text: '2. Nastavení' }),
    h('div', { class: 'pole' }, h('span', { class: 'pole__popisek', text: 'Přidat všem importovaným štítky' }), stitky.prvek),
    existujici,
  ),
  h('section', { class: 'karta' },
    h('h2', { class: 'karta__titulek', text: '3. Souhlas' }),
    h('p', { class: 'pole__napoveda', text: 'Posílat newsletter smíte jen lidem, kteří s tím souhlasili. Kontakty bez souhlasu do souboru nedávejte.' }),
    souhlas.obal,
    poznamka.obal,
    chyba,
    h('div', { class: 'formular__akce' }, tlacitko),
  ));

  vycisti(obsah, hlavicka(), formular);
  vykresliNahled();
}

async function krokImport(obsah, { kontakty, prvniRadek, stitky, existujici, souhlasPoznamka }) {
  const prubeh = h('progress', { class: 'prubeh', max: kontakty.length, value: 0 });
  const popisPrubehu = h('p', { class: 'hlavicka__text', text: 'Připravuji…' });
  const titulek = h('h2', { class: 'karta__titulek', text: 'Importuji kontakty…' });
  const vysledek = h('div');

  vycisti(obsah, hlavicka(), h('section', { class: 'karta' }, titulek, prubeh, popisPrubehu, vysledek));

  const soucet = { zalozeno: 0, doplneno: 0, preskoceno: 0, odhlaseniVSouboru: 0, duplicityVSouboru: 0, neplatne: [] };

  try {
    for (let i = 0; i < kontakty.length; i += DAVKA) {
      const davka = kontakty.slice(i, i + DAVKA);
      const r = await posli('/api/kontakty/import', {
        radky: davka,
        prvniRadek: prvniRadek + i,
        stitky,
        existujici,
        souhlasPotvrzen: true,
        souhlasPoznamka,
      });
      for (const klic of ['zalozeno', 'doplneno', 'preskoceno', 'odhlaseniVSouboru', 'duplicityVSouboru']) soucet[klic] += r[klic];
      soucet.neplatne.push(...r.neplatne);
      prubeh.value = Math.min(kontakty.length, i + DAVKA);
      popisPrubehu.textContent = `${cislo(prubeh.value)} z ${cislo(kontakty.length)} řádků`;
    }
  } catch (err) {
    titulek.textContent = 'Import se zastavil';
    vycisti(vysledek,
      h('p', { class: 'upozorneni upozorneni--chyba' },
        `Import se zastavil po ${cislo(prubeh.value)} řádcích: ${err.message} Už naimportované kontakty zůstaly uložené — soubor můžete nahrát znovu, duplicity se nezaloží.`),
      h('a', { href: '#/kontakty', class: 'tlacitko' }, 'Na kontakty'));
    return;
  }

  titulek.textContent = 'Import dokončen';
  prubeh.hidden = true;
  popisPrubehu.textContent = `Zpracováno ${cislo(kontakty.length)} ${sklonuj(kontakty.length, 'řádek', 'řádky', 'řádků')}.`;
  vycisti(vysledek,
    h('div', { class: 'dlazdice-mrizka dlazdice-mrizka--male' },
      h('div', { class: 'dlazdice' }, h('span', { class: 'dlazdice__popisek', text: 'Nově přidáno' }), h('span', { class: 'dlazdice__hodnota', text: cislo(soucet.zalozeno) })),
      h('div', { class: 'dlazdice' }, h('span', { class: 'dlazdice__popisek', text: 'Doplněno' }), h('span', { class: 'dlazdice__hodnota', text: cislo(soucet.doplneno) })),
      h('div', { class: 'dlazdice' }, h('span', { class: 'dlazdice__popisek', text: 'Beze změny' }), h('span', { class: 'dlazdice__hodnota', text: cislo(soucet.preskoceno) })),
      h('div', { class: 'dlazdice' }, h('span', { class: 'dlazdice__popisek', text: 'Neplatné řádky' }), h('span', { class: 'dlazdice__hodnota', text: cislo(soucet.neplatne.length) })),
    ),
    soucet.odhlaseniVSouboru
      ? h('p', { class: 'upozorneni' }, `${cislo(soucet.odhlaseniVSouboru)} ${sklonuj(soucet.odhlaseniVSouboru, 'kontakt se', 'kontakty se', 'kontaktů se')} dřív odhlásilo — zůstávají odhlášené.`)
      : null,
    soucet.duplicityVSouboru
      ? h('p', { class: 'pole__napoveda' }, `V souboru ${sklonuj(soucet.duplicityVSouboru, 'byl', 'byly', 'bylo')} ${cislo(soucet.duplicityVSouboru)} ${sklonuj(soucet.duplicityVSouboru, 'duplicitní řádek', 'duplicitní řádky', 'duplicitních řádků')}, sloučily se.`)
      : null,
    soucet.neplatne.length
      ? h('details', { class: 'neplatne' },
        h('summary', { text: `Zobrazit neplatné řádky (${soucet.neplatne.length})` }),
        h('table', { class: 'tabulka' },
          h('thead', null, h('tr', null, h('th', { text: 'Řádek' }), h('th', { text: 'Hodnota' }), h('th', { text: 'Důvod' }))),
          h('tbody', null, soucet.neplatne.slice(0, 500).map((n) => h('tr', null,
            h('td', { text: String(n.radek) }), h('td', { text: n.email || '—' }), h('td', { text: n.duvod })))),
        ))
      : null,
    h('div', { class: 'formular__akce' },
      h('a', { href: '#/kontakty', class: 'tlacitko tlacitko--hlavni' }, 'Zobrazit kontakty'),
      h('a', { href: '#/odeslat', class: 'tlacitko' }, 'Napsat e-mail'),
    ),
  );
}
