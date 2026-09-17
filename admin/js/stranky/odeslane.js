/* Odeslané rozesílky: seznam a detail s průběhem a stavem jednotlivých příjemců. */

import { ziskej, posli } from '../api.js';
import {
  h, vycisti, cislo, datumCas, velikost, stitek, stavKampane, stavPrijemce, oznam, oznamChybu,
  dialog, sPrubehem, prazdnyStav, strankovani, sklonuj,
} from '../ui.js';

export async function stranka(obsah, params) {
  const strana = Number(params.get('stranka')) || 1;
  const data = await ziskej(`/api/kampane?stranka=${strana}`);

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Odeslané e-maily' }),
        h('p', { class: 'hlavicka__text', text: `${cislo(data.celkem)} ${sklonuj(data.celkem, 'rozesílka', 'rozesílky', 'rozesílek')}` }),
      ),
      h('div', { class: 'hlavicka__akce' }, h('a', { href: '#/odeslat', class: 'tlacitko tlacitko--hlavni' }, 'Napsat e-mail')),
    ),
    data.polozky.length
      ? h('div', { class: 'tabulka-obal' }, h('table', { class: 'tabulka' },
        h('thead', null, h('tr', null,
          h('th', { text: 'Předmět' }),
          h('th', { text: 'Stav' }),
          h('th', { class: 'tabulka__cislo', text: 'Odesláno' }),
          h('th', { class: 'tabulka__cislo tabulka__skryt-mobil', text: 'Selhalo' }),
          h('th', { class: 'tabulka__skryt-mobil', text: 'Odeslal(a)' }),
        )),
        h('tbody', null, data.polozky.map((k) => h('tr', {
          class: 'tabulka__radek--klik',
          onclick: () => { location.hash = `#/odeslane/${k.id}`; },
        },
        h('td', null,
          h('a', { href: `#/odeslane/${k.id}`, text: k.predmet, onclick: (e) => e.stopPropagation() }),
          h('div', { class: 'tabulka__podtext', text: `${datumCas(k.vytvoreno)}${k.priloh ? ` · ${k.priloh} ${sklonuj(k.priloh, 'příloha', 'přílohy', 'příloh')}` : ''}` }),
        ),
        h('td', null, stavKampane(k.stav)),
        h('td', { class: 'tabulka__cislo', text: `${cislo(k.odeslano)} / ${cislo(k.prijemcu)}` }),
        h('td', { class: 'tabulka__cislo tabulka__skryt-mobil', text: k.selhalo ? cislo(k.selhalo) : '—' }),
        h('td', { class: 'tabulka__skryt-mobil', text: k.autor_jmeno || k.autor_email || '—' }),
        ))),
      ))
      : prazdnyStav('Zatím nic neodešlo', 'Odeslané e-maily se tu budou řadit od nejnovějšího.',
        h('a', { href: '#/odeslat', class: 'tlacitko tlacitko--hlavni' }, 'Napsat první e-mail')),
    strankovani({ ...data, zmen: (s) => { location.hash = `#/odeslane?stranka=${s}`; } }),
  );
}

const FILTRY = [
  ['', 'Všichni'],
  ['odeslano', 'Odesláno'],
  ['ve_fronte', 'Ve frontě'],
  ['selhalo', 'Selhalo'],
  ['preskoceno', 'Přeskočeno'],
];

export async function detail(obsah, params, id) {
  let casovac = null;
  let aktivni = true;

  async function vykresli() {
    const filtr = params.get('stav') || '';
    const strana = Number(params.get('stranka')) || 1;
    const q = new URLSearchParams();
    if (filtr) q.set('stav', filtr);
    if (strana > 1) q.set('stranka', strana);
    const k = await ziskej(`/api/kampane/${id}?${q}`);
    if (!aktivni) return;

    const p = k.pocty;
    const hotovo = (p.odeslano || 0) + (p.selhalo || 0) + (p.preskoceno || 0);
    const procent = k.prijemcu ? Math.round((hotovo / k.prijemcu) * 100) : 100;
    const odesilaSe = k.stav === 'odesila_se';

    const prehledPrijemcu = k.vyber_stitku === 'vsem'
      ? 'Všem přihlášeným'
      : h('span', { class: 'stitky' },
        k.vyber_stitku === 'vsechny' ? 'Se všemi štítky: ' : 'S kterýmkoli štítkem: ',
        k.stitky.length ? k.stitky.map((s) => stitek(s)) : '(štítky byly smazány)');

    const nastavFiltr = (hodnota) => {
      const n = new URLSearchParams();
      if (hodnota) n.set('stav', hodnota);
      location.hash = `#/odeslane/${id}${n.toString() ? `?${n}` : ''}`;
    };

    vycisti(obsah,
      h('div', { class: 'hlavicka' },
        h('div', null,
          h('a', { href: '#/odeslane', class: 'zpet', text: '← Odeslané' }),
          h('h1', { text: k.predmet }),
          h('p', { class: 'hlavicka__text' }, `${datumCas(k.vytvoreno)} · ${k.autor_jmeno || k.autor_email || 'neznámý autor'}`),
        ),
        h('div', { class: 'hlavicka__akce' },
          h('button', {
            type: 'button', class: 'tlacitko',
            onclick: (e) => sPrubehem(e.currentTarget, async () => {
              try {
                const { html } = await posli('/api/kampane/nahled', { predmet: k.predmet, text: k.text, sekce: k.sekce, datum: k.vytvoreno });
                dialog({
                  titulek: k.predmet, siroky: true, akce: [{ text: 'Zavřít' }],
                  obsah: h('iframe', { class: 'nahled-ramec', sandbox: '', title: 'Odeslaný e-mail', srcdoc: html }),
                });
              } catch (err) { oznamChybu(err); }
            }),
          }, 'Zobrazit e-mail'),
          k.verejny_token ? h('a', {
            class: 'tlacitko', target: '_blank', rel: 'noopener',
            href: `/api/newsletter/vydani?t=${encodeURIComponent(k.verejny_token)}`,
          }, 'Webová verze ↗') : null,
          p.selhalo ? h('button', {
            type: 'button', class: 'tlacitko tlacitko--hlavni',
            onclick: (e) => sPrubehem(e.currentTarget, async () => {
              try {
                const r = await posli(`/api/kampane/${id}/znovu`);
                oznam(`${cislo(r.vraceno)} ${sklonuj(r.vraceno, 'e-mail se zkusí', 'e-maily se zkusí', 'e-mailů se zkusí')} odeslat znovu.`);
                vykresli();
              } catch (err) { oznamChybu(err); }
            }),
          }, 'Zkusit neúspěšné znovu') : null,
        ),
      ),

      h('section', { class: 'karta' },
        h('div', { class: 'karta__hlava' },
          h('h2', { class: 'karta__titulek' }, stavKampane(k.stav)),
          h('span', { class: 'karta__meta', text: odesilaSe ? `${procent} % · odchází po dávkách každou minutu` : `dokončeno ${datumCas(k.dokonceno)}` }),
        ),
        h('div', { class: 'ukazatel', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(procent) },
          h('span', { class: 'ukazatel__odeslano', style: `width:${k.prijemcu ? ((p.odeslano || 0) / k.prijemcu) * 100 : 0}%` }),
          h('span', { class: 'ukazatel__selhalo', style: `width:${k.prijemcu ? ((p.selhalo || 0) / k.prijemcu) * 100 : 0}%` }),
        ),
        h('dl', { class: 'cisla' },
          [['Příjemců', k.prijemcu], ['Odesláno', p.odeslano], ['Ve frontě', (p.ve_fronte || 0) + (p.odesila_se || 0)], ['Selhalo', p.selhalo], ['Přeskočeno', p.preskoceno]]
            .map(([popisek, hodnota]) => h('div', { class: 'cisla__polozka' }, h('dt', { text: popisek }), h('dd', { text: cislo(hodnota) }))),
        ),
        h('dl', { class: 'udaje' },
          h('dt', { text: 'Příjemci' }), h('dd', null, prehledPrijemcu),
          k.prilohy.length ? [
            h('dt', { text: 'Přílohy' }),
            h('dd', null, k.prilohy.map((pr) => h('span', { class: 'priloha priloha--inline' }, `${pr.nazev} (${velikost(pr.velikost)})`))),
          ] : null,
        ),
        p.preskoceno ? h('p', { class: 'pole__napoveda', text: 'Přeskočení jsou kontakty, které se mezi odesláním a doručením odhlásily nebo byly smazány.' }) : null,
      ),

      h('section', { class: 'karta' },
        h('div', { class: 'karta__hlava' },
          h('h2', { class: 'karta__titulek', text: 'Příjemci' }),
          h('div', { class: 'prepinac', role: 'group', 'aria-label': 'Filtr podle stavu' },
            FILTRY.map(([hodnota, popisek]) => h('button', {
              type: 'button', class: `prepinac__volba ${filtr === hodnota ? 'prepinac__volba--aktivni' : ''}`,
              'aria-pressed': String(filtr === hodnota),
              onclick: () => nastavFiltr(hodnota),
            }, popisek))),
        ),
        k.prijemci.length
          ? h('div', { class: 'tabulka-obal' }, h('table', { class: 'tabulka tabulka--kompaktni' },
            h('thead', null, h('tr', null, h('th', { text: 'E-mail' }), h('th', { text: 'Stav' }), h('th', { class: 'tabulka__skryt-mobil', text: 'Odesláno' }))),
            h('tbody', null, k.prijemci.map((r) => h('tr', null,
              h('td', null,
                h('span', { text: r.email }),
                r.chyba ? h('div', { class: 'tabulka__podtext tabulka__podtext--chyba', text: r.chyba }) : null,
              ),
              h('td', null, stavPrijemce(r.stav)),
              h('td', { class: 'tabulka__skryt-mobil', text: datumCas(r.odeslano) }),
            ))),
          ))
          : h('p', { class: 'pole__napoveda', text: 'V tomto stavu nikdo není.' }),
        strankovani({
          stranka: k.stranka, naStranku: k.naStranku,
          celkem: filtr ? (p[filtr] || 0) : k.prijemcu,
          zmen: (s) => {
            const n = new URLSearchParams();
            if (filtr) n.set('stav', filtr);
            n.set('stranka', s);
            location.hash = `#/odeslane/${id}?${n}`;
          },
        }),
      ),
    );

    // Dokud se odesílá, průběh se obnovuje sám.
    clearTimeout(casovac);
    if (odesilaSe) casovac = setTimeout(() => vykresli().catch(() => {}), 4000);
  }

  await vykresli();
  return () => { aktivni = false; clearTimeout(casovac); };
}
