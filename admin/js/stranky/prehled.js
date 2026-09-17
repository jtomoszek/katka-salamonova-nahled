/* Přehled: základní čísla, graf nových odběratelů a poslední rozesílky. */

import { ziskej } from '../api.js';
import { h, vycisti, cislo, datum, datumCas, stavKampane, prazdnyStav, sklonuj } from '../ui.js';

function dlazdice(popisek, hodnota, doplnek, odkaz) {
  const obsah = [
    h('span', { class: 'dlazdice__popisek', text: popisek }),
    h('span', { class: 'dlazdice__hodnota', text: cislo(hodnota) }),
    doplnek ? h('span', { class: 'dlazdice__doplnek', text: doplnek }) : null,
  ];
  return odkaz
    ? h('a', { class: 'dlazdice dlazdice--odkaz', href: odkaz }, obsah)
    : h('div', { class: 'dlazdice' }, obsah);
}

function graf(dny) {
  const max = Math.max(1, ...dny.map((d) => d.pocet));
  const celkem = dny.reduce((s, d) => s + d.pocet, 0);
  return h('section', { class: 'karta' },
    h('div', { class: 'karta__hlava' },
      h('h2', { class: 'karta__titulek', text: 'Noví odběratelé za 30 dní' }),
      h('span', { class: 'karta__meta', text: `${cislo(celkem)} ${sklonuj(celkem, 'nový', 'noví', 'nových')}` }),
    ),
    h('div', { class: 'sloupce', role: 'img', 'aria-label': `Noví odběratelé za posledních 30 dní: celkem ${celkem}` },
      dny.map((d) => h('div', {
        class: 'sloupce__sloupec',
        title: `${datum(d.den)}: ${d.pocet}`,
        style: `--vyska:${Math.round((d.pocet / max) * 100)}%`,
      }, h('span', { class: 'sloupce__hodnota' }))),
    ),
    h('div', { class: 'sloupce__osa' },
      h('span', { text: datum(dny[0]?.den) }),
      h('span', { text: 'dnes' }),
    ),
  );
}

function posledniRozesilky(polozky) {
  return h('section', { class: 'karta' },
    h('div', { class: 'karta__hlava' },
      h('h2', { class: 'karta__titulek', text: 'Poslední rozesílky' }),
      h('a', { href: '#/odeslane', class: 'karta__odkaz', text: 'Všechny →' }),
    ),
    polozky.length
      ? h('ul', { class: 'seznam' }, polozky.map((k) => h('li', null,
        h('a', { class: 'seznam__polozka', href: `#/odeslane/${k.id}` },
          h('span', { class: 'seznam__hlavni' },
            h('span', { class: 'seznam__titulek', text: k.predmet }),
            h('span', { class: 'seznam__meta', text: `${datumCas(k.vytvoreno)} · ${cislo(k.odeslano)} z ${cislo(k.prijemcu)} odesláno` }),
          ),
          stavKampane(k.stav),
        ))))
      : prazdnyStav('Zatím nic neodešlo', 'Až pošlete první e-mail, uvidíte ho tady.',
        h('a', { href: '#/odeslat', class: 'tlacitko tlacitko--hlavni' }, 'Napsat e-mail')),
  );
}

export async function stranka(obsah) {
  const data = await ziskej('/api/prehled');
  const k = data.kontakty;
  const r = data.rozesilky;

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Přehled' }),
        h('p', { class: 'hlavicka__text', text: 'Jak se daří newsletteru.' }),
      ),
      h('div', { class: 'hlavicka__akce' },
        h('a', { href: '#/kontakty/import', class: 'tlacitko' }, 'Importovat kontakty'),
        h('a', { href: '#/odeslat', class: 'tlacitko tlacitko--hlavni' }, 'Napsat e-mail'),
      ),
    ),

    !data.postaNastavena
      ? h('p', { class: 'upozorneni upozorneni--chyba' },
        'Odesílání pošty není nastavené — chybí RESEND_API_KEY nebo ODESILATEL. E-maily ani potvrzení odběru teď neodejdou.')
      : null,
    data.rezimPosty === 'log'
      ? h('p', { class: 'upozorneni' }, 'Zkušební režim: e-maily se neodesílají, jen vypisují do logu serveru.')
      : null,
    data.veFronte
      ? h('p', { class: 'upozorneni upozorneni--info' },
        `Právě se odesílá ${cislo(data.veFronte)} ${sklonuj(data.veFronte, 'e-mail', 'e-maily', 'e-mailů')}. Odchází po dávkách každou minutu.`)
      : null,

    h('div', { class: 'dlazdice-mrizka' },
      dlazdice('Přihlášení odběratelé', k.prihlaseno, `+${cislo(k.novych30)} za 30 dní`, '#/kontakty?stav=prihlasen'),
      dlazdice('Čeká na potvrzení', k.ceka, 'nepotvrdili odkaz z e-mailu', '#/kontakty?stav=cekajici'),
      dlazdice('Odhlášení', k.odhlaseno, `${cislo(k.odhlaseno30)} za 30 dní`, '#/kontakty?stav=odhlasen'),
      dlazdice('Odeslané e-maily', r.emailu, `${cislo(r.emailu30)} za 30 dní${r.selhalo30 ? ` · ${cislo(r.selhalo30)} selhalo` : ''}`, '#/odeslane'),
    ),

    h('div', { class: 'dve-karty' },
      graf(data.prihlaseniPoDnech),
      posledniRozesilky(data.nedavne),
    ),
  );
}
