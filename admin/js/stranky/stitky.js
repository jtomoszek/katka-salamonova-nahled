/* Štítky: založení, přejmenování, barva, smazání. */

import { ziskej, posli, uprav, smaz } from '../api.js';
import { h, vycisti, cislo, stitek, oznam, oznamChybu, dialog, potvrdit, pole, prazdnyStav, sklonuj } from '../ui.js';

const BARVY = ['#b48563', '#9c6d4b', '#4d3625', '#6b8f71', '#5b7fa6', '#8a6fb0', '#c0645a', '#c9a227', '#6f6861'];

function vyberBarvy(vychozi) {
  let zvolena = vychozi;
  const volby = BARVY.map((b) => h('button', {
    type: 'button', class: `barva ${b === zvolena ? 'barva--zvolena' : ''}`, style: `--barva:${b}`,
    'aria-label': `Barva ${b}`, 'aria-pressed': String(b === zvolena),
    onclick: (e) => {
      zvolena = b;
      for (const v of prvek.querySelectorAll('.barva')) {
        v.classList.toggle('barva--zvolena', v === e.currentTarget);
        v.setAttribute('aria-pressed', String(v === e.currentTarget));
      }
    },
  }));
  const prvek = h('div', { class: 'barvy', role: 'group', 'aria-label': 'Barva štítku' }, volby);
  return { prvek, hodnota: () => zvolena };
}

function formularStitku({ titulek, nazev = '', barva = BARVY[0], ulozit }) {
  const pNazev = pole({ popisek: 'Název', value: nazev, maxlength: 40, required: true });
  const barvy = vyberBarvy(barva);
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });
  const formular = h('form', {
    id: 'formular-stitek', class: 'formular',
    onsubmit: async (e) => {
      e.preventDefault();
      chyba.hidden = true;
      try {
        await ulozit({ nazev: pNazev.prvek.value, barva: barvy.hodnota() });
        okno.zavrit();
      } catch (err) {
        chyba.textContent = err.message;
        chyba.hidden = false;
      }
    },
  }, pNazev.obal, h('div', { class: 'pole' }, h('span', { class: 'pole__popisek', text: 'Barva' }), barvy.prvek), chyba);

  const okno = dialog({ titulek, obsah: formular, akce: [{ text: 'Zrušit' }, { text: 'Uložit', typ: 'hlavni', submit: 'formular-stitek' }] });
  pNazev.prvek.focus();
}

export async function stranka(obsah) {
  const { polozky } = await ziskej('/api/stitky');
  const obnov = () => stranka(obsah);

  const novy = () => formularStitku({
    titulek: 'Nový štítek',
    ulozit: async (data) => { await posli('/api/stitky', data); oznam('Štítek založen.'); obnov(); },
  });

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Štítky' }),
        h('p', { class: 'hlavicka__text', text: 'Podle štítků vybíráte, komu e-mail odejde — třeba jen klientům s hypotékou.' }),
      ),
      h('div', { class: 'hlavicka__akce' }, h('button', { type: 'button', class: 'tlacitko tlacitko--hlavni', onclick: novy }, 'Nový štítek')),
    ),
    polozky.length
      ? h('div', { class: 'tabulka-obal' }, h('table', { class: 'tabulka' },
        h('thead', null, h('tr', null,
          h('th', { text: 'Štítek' }), h('th', { text: 'Přihlášených' }), h('th', { class: 'tabulka__skryt-mobil', text: 'Kontaktů celkem' }), h('th', { class: 'tabulka__akce-sloupec' }, h('span', { class: 'vizualne-skryte', text: 'Akce' })),
        )),
        h('tbody', null, polozky.map((s) => h('tr', null,
          h('td', null, stitek(s)),
          h('td', null, h('a', { href: `#/kontakty?stitek=${s.id}&stav=prihlasen`, text: cislo(s.prihlasenych) })),
          h('td', { class: 'tabulka__skryt-mobil' }, h('a', { href: `#/kontakty?stitek=${s.id}`, text: cislo(s.kontaktu) })),
          h('td', { class: 'tabulka__akce-sloupec' },
            h('button', {
              type: 'button', class: 'tlacitko tlacitko--male',
              onclick: () => formularStitku({
                titulek: 'Upravit štítek', nazev: s.nazev, barva: s.barva,
                ulozit: async (data) => { await uprav(`/api/stitky/${s.id}`, data); oznam('Uloženo.'); obnov(); },
              }),
            }, 'Upravit'),
            h('button', {
              type: 'button', class: 'tlacitko tlacitko--male tlacitko--nebezpecne-obrys',
              onclick: async () => {
                if (!(await potvrdit({
                  titulek: `Smazat štítek „${s.nazev}“?`,
                  text: s.kontaktu
                    ? `Štítek zmizí z ${cislo(s.kontaktu)} ${sklonuj(s.kontaktu, 'kontaktu', 'kontaktů', 'kontaktů')}. Samotné kontakty zůstanou.`
                    : 'Štítek nemá žádné kontakty.',
                  tlacitko: 'Smazat', nebezpecne: true,
                }))) return;
                try { await smaz(`/api/stitky/${s.id}`); oznam('Štítek smazán.'); obnov(); } catch (err) { oznamChybu(err); }
              },
            }, 'Smazat'),
          ),
        ))),
      ))
      : prazdnyStav('Zatím žádné štítky', 'Založte třeba „Klienti“, „Hypotéky“ nebo „Investice“. Štítky jdou přidat i při importu z CSV.',
        h('button', { type: 'button', class: 'tlacitko tlacitko--hlavni', onclick: novy }, 'Nový štítek')),
  );
}
