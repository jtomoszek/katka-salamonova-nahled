/* Administrace newsletteru — start, přihlášení a směrování.
 *
 * Adresy jsou v hashi (#/kontakty), takže celá administrace je jeden
 * statický soubor a server nemusí znát jednotlivé stránky. */

import { ziskej, posli } from './api.js';
import { prostredi } from './prostredi.js';
import { h, vycisti, oznam, oznamChybu, pole, sPrubehem } from './ui.js';

import { stranka as prehled } from './stranky/prehled.js';
import { stranka as kontakty } from './stranky/kontakty.js';
import { stranka as importKontaktu } from './stranky/import.js';
import { stranka as stitky } from './stranky/stitky.js';
import { stranka as odeslat } from './stranky/odeslat.js';
import { stranka as odeslane, detail as detailRozesilky } from './stranky/odeslane.js';
import { stranka as uzivatele } from './stranky/uzivatele.js';
import { stranka as ucet } from './stranky/ucet.js';

const koren = document.getElementById('aplikace');
let prihlaseny = null;

const NAVIGACE = [
  ['#/', 'Přehled', 'prehled'],
  ['#/odeslat', 'Napsat e-mail', 'odeslat'],
  ['#/odeslane', 'Odeslané', 'odeslane'],
  ['#/kontakty', 'Kontakty', 'kontakty'],
  ['#/stitky', 'Štítky', 'stitky'],
  ['#/uzivatele', 'Uživatelé', 'uzivatele', 'admin'],
  ['#/ucet', 'Můj účet', 'ucet'],
];

/* Rozebere hash na cestu a parametry: #/odeslane/12?stav=selhalo */
export function aktualniTrasa() {
  const hash = location.hash.replace(/^#/, '') || '/';
  const [cesta, dotaz = ''] = hash.split('?');
  return { cesta, params: new URLSearchParams(dotaz) };
}

function najdiStranku(cesta) {
  if (cesta === '/' || cesta === '') return ['prehled', prehled];
  if (cesta === '/kontakty') return ['kontakty', kontakty];
  if (cesta === '/kontakty/import') return ['kontakty', importKontaktu];
  if (cesta === '/stitky') return ['stitky', stitky];
  if (cesta === '/odeslat') return ['odeslat', odeslat];
  if (cesta === '/odeslane') return ['odeslane', odeslane];
  const detail = cesta.match(/^\/odeslane\/(\d+)$/);
  if (detail) return ['odeslane', (obsah, params) => detailRozesilky(obsah, params, Number(detail[1]))];
  if (cesta === '/uzivatele' && prihlaseny?.role === 'admin') return ['uzivatele', uzivatele];
  if (cesta === '/ucet') return ['ucet', ucet];
  return [null, null];
}

/* ---------- obrazovky mimo aplikaci ---------- */

function obrazovka(titulek, podtitulek, ...obsah) {
  document.title = `${titulek} · Administrace`;
  vycisti(koren,
    h('main', { class: 'vstup-obrazovka' },
      h('div', { class: 'vstup-karta' },
        h('div', { class: 'znacka' },
          h('span', { class: 'znacka__jmeno', text: 'Kateřina Šalamonová' }),
          h('span', { class: 'znacka__podtitul', text: 'Administrace newsletteru' }),
        ),
        h('h1', { class: 'vstup-karta__titulek', text: titulek }),
        podtitulek ? h('p', { class: 'vstup-karta__text', text: podtitulek }) : null,
        ...obsah,
      ),
    ),
  );
  koren.classList.remove('nacitani');
  koren.removeAttribute('aria-busy');
}

function chybaFormulare() {
  return h('p', { class: 'formular__chyba', role: 'alert', hidden: true });
}

function ukazChybu(prvek, err) {
  prvek.textContent = err.message;
  prvek.hidden = false;
}

function obrazovkaPrihlaseni() {
  const email = pole({ popisek: 'E-mail', type: 'email', name: 'email', autocomplete: 'username', required: true });
  const heslo = pole({ popisek: 'Heslo', type: 'password', name: 'heslo', autocomplete: 'current-password', required: true });
  const chyba = chybaFormulare();
  const tlacitko = h('button', { type: 'submit', class: 'tlacitko tlacitko--hlavni tlacitko--plne' }, 'Přihlásit se');

  obrazovka('Přihlášení', null,
    h('form', {
      class: 'formular',
      onsubmit: (e) => {
        e.preventDefault();
        chyba.hidden = true;
        sPrubehem(tlacitko, async () => {
          try {
            await posli('/api/ucet/prihlasit', { email: email.prvek.value, heslo: heslo.prvek.value }, { tise401: true });
            await start();
          } catch (err) {
            ukazChybu(chyba, err);
            heslo.prvek.value = '';
            heslo.prvek.focus();
          }
        });
      },
    }, email.obal, heslo.obal, chyba, tlacitko),
    h('p', { class: 'vstup-karta__poznamka', text: 'Zapomenuté heslo? Požádejte administrátora o novou pozvánku.' }),
  );
  email.prvek.focus();
}

function formularHesla({ tlacitkoText, odeslat }) {
  const heslo = pole({ popisek: 'Heslo', type: 'password', autocomplete: 'new-password', required: true, minlength: 10, napoveda: 'Aspoň 10 znaků.' });
  const znovu = pole({ popisek: 'Heslo znovu', type: 'password', autocomplete: 'new-password', required: true });
  const chyba = chybaFormulare();
  const tlacitko = h('button', { type: 'submit', class: 'tlacitko tlacitko--hlavni tlacitko--plne' }, tlacitkoText);
  return {
    pole: [heslo.obal, znovu.obal, chyba, tlacitko],
    onsubmit: (e) => {
      e.preventDefault();
      chyba.hidden = true;
      if (heslo.prvek.value !== znovu.prvek.value) {
        return ukazChybu(chyba, new Error('Hesla se neshodují.'));
      }
      sPrubehem(tlacitko, async () => {
        try {
          await odeslat({ heslo: heslo.prvek.value });
        } catch (err) {
          ukazChybu(chyba, err);
        }
      });
    },
  };
}

function obrazovkaNastaveni() {
  const token = pole({ popisek: 'Zakládací kód', type: 'password', autocomplete: 'off', required: true, napoveda: 'Hodnota ZAKLADACI_TOKEN z nastavení serveru.' });
  const jmeno = pole({ popisek: 'Vaše jméno', autocomplete: 'name' });
  const email = pole({ popisek: 'E-mail', type: 'email', autocomplete: 'username', required: true });
  const hesla = formularHesla({
    tlacitkoText: 'Založit administraci',
    odeslat: async ({ heslo }) => {
      await posli('/api/ucet/nastaveni', { token: token.prvek.value, jmeno: jmeno.prvek.value, email: email.prvek.value, heslo }, { tise401: true });
      history.replaceState(null, '', '#/');
      await start();
      oznam('Administrace je připravená.');
    },
  });

  obrazovka('První spuštění', 'Založte si účet administrátora. Další uživatele pak pozvete uvnitř.',
    h('form', { class: 'formular', onsubmit: (e) => hesla.onsubmit(e) }, token.obal, jmeno.obal, email.obal, ...hesla.pole),
  );
  token.prvek.focus();
}

async function obrazovkaPozvanky(token) {
  let pozvanka;
  try {
    pozvanka = await ziskej(`/api/ucet/pozvanka?t=${encodeURIComponent(token)}`, { tise401: true });
  } catch (err) {
    obrazovka('Pozvánka neplatí', err.message,
      h('a', { class: 'tlacitko tlacitko--plne', href: '#/' }, 'Přejít na přihlášení'));
    return;
  }

  const hesla = formularHesla({
    tlacitkoText: 'Nastavit heslo a vstoupit',
    odeslat: async ({ heslo }) => {
      await posli('/api/ucet/pozvanka', { token, heslo }, { tise401: true });
      history.replaceState(null, '', '#/');
      await start();
      oznam('Heslo je nastavené. Vítejte!');
    },
  });

  obrazovka(
    `Vítejte${pozvanka.jmeno ? `, ${pozvanka.jmeno}` : ''}`,
    `Nastavte si heslo k účtu ${pozvanka.email}.`,
    h('form', { class: 'formular', onsubmit: (e) => hesla.onsubmit(e) }, ...hesla.pole),
  );
}

/* ---------- rozvržení aplikace ---------- */

let obsah;
let navOdkazy = [];

function vykresliRozvrzeni() {
  navOdkazy = [];
  const polozky = NAVIGACE
    .filter(([, , , role]) => !role || prihlaseny.role === role)
    .map(([href, text, klic]) => {
      const a = h('a', { href, class: 'nav__odkaz', dataset: { klic } }, text);
      navOdkazy.push(a);
      return h('li', null, a);
    });

  const prepinac = h('button', {
    type: 'button', class: 'horni__menu', 'aria-expanded': 'false', 'aria-controls': 'postranni', 'aria-label': 'Menu',
    onclick: () => {
      const otevreno = prepinac.getAttribute('aria-expanded') === 'true';
      prepinac.setAttribute('aria-expanded', String(!otevreno));
      koren.classList.toggle('menu-otevrene', !otevreno);
    },
  }, h('span'), h('span'));

  obsah = h('main', { class: 'obsah', id: 'obsah', tabindex: '-1' });

  vycisti(koren,
    h('div', { class: 'rozvrzeni' },
      h('header', { class: 'horni' },
        h('a', { class: 'znacka znacka--mala', href: '#/' },
          h('span', { class: 'znacka__jmeno', text: 'Kateřina Šalamonová' }),
          h('span', { class: 'znacka__podtitul', text: 'Newsletter' }),
        ),
        prepinac,
      ),
      h('aside', { class: 'postranni', id: 'postranni' },
        h('a', { class: 'znacka', href: '#/' },
          h('span', { class: 'znacka__jmeno', text: 'Kateřina Šalamonová' }),
          h('span', { class: 'znacka__podtitul', text: 'Newsletter' }),
        ),
        h('nav', { class: 'nav', 'aria-label': 'Administrace' }, h('ul', null, polozky)),
        h('div', { class: 'postranni__uzivatel' },
          h('span', { class: 'postranni__jmeno', text: prihlaseny.jmeno || prihlaseny.email }),
          h('span', { class: 'postranni__role', text: prihlaseny.role === 'admin' ? 'Administrátor' : 'Editor' }),
          h('button', {
            type: 'button', class: 'tlacitko tlacitko--male tlacitko--obrys',
            onclick: async () => {
              try { await posli('/api/ucet/odhlasit'); } catch { /* odhlásit i tak */ }
              prihlaseny = null;
              obrazovkaPrihlaseni();
            },
          }, 'Odhlásit se'),
        ),
      ),
      obsah,
    ),
  );
  koren.classList.remove('nacitani');
  koren.removeAttribute('aria-busy');
}

let posledniCesta = null;
let uklidStranky = null;

async function zobraz() {
  const { cesta, params } = aktualniTrasa();

  if (cesta === '/pozvanka') return obrazovkaPozvanky(params.get('t') || '');
  if (!prihlaseny) return;
  if (!obsah || !koren.contains(obsah)) vykresliRozvrzeni();

  // Dialog patří ke stránce, ze které se otevřel — při odchodu jinam se zavře.
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());

  const [klic, vykresli] = najdiStranku(cesta);
  for (const a of navOdkazy) a.classList.toggle('nav__odkaz--aktivni', a.dataset.klic === klic);
  koren.classList.remove('menu-otevrene');
  koren.querySelector('.horni__menu')?.setAttribute('aria-expanded', 'false');

  uklidStranky?.();
  uklidStranky = null;

  if (!vykresli) {
    vycisti(obsah, h('div', { class: 'hlavicka' }, h('h1', { text: 'Stránka nenalezena' })),
      h('a', { href: '#/', class: 'tlacitko' }, 'Zpět na přehled'));
    return;
  }

  // Posun nahoru a fokus jen při přechodu na jinou stránku, ne při změně filtru.
  const jinaStranka = posledniCesta !== cesta;
  posledniCesta = cesta;
  if (jinaStranka) {
    vycisti(obsah, h('p', { class: 'nacitani__text' }, 'Načítám…'));
    window.scrollTo(0, 0);
  }

  try {
    uklidStranky = (await vykresli(obsah, params, { prihlaseny })) || null;
    if (jinaStranka) obsah.focus({ preventScroll: true });
  } catch (err) {
    if (err.status === 401) return;
    vycisti(obsah,
      h('div', { class: 'hlavicka' }, h('h1', { text: 'Stránku se nepodařilo načíst' })),
      h('p', { class: 'upozorneni upozorneni--chyba' }, err.message),
      h('button', { type: 'button', class: 'tlacitko', onclick: zobraz }, 'Zkusit znovu'),
    );
  }
}

async function start() {
  const { cesta, params } = aktualniTrasa();
  if (cesta === '/pozvanka') return obrazovkaPozvanky(params.get('t') || '');

  try {
    const stav = await ziskej('/api/ucet/stav', { tise401: true });
    prihlaseny = stav.uzivatel;
    prostredi.prilohyZapnute = stav.prilohyZapnute !== false;
    obsah = null;
    if (prihlaseny) return zobraz();
    if (stav.potrebaNastaveni) return obrazovkaNastaveni();
    return obrazovkaPrihlaseni();
  } catch (err) {
    obrazovka('Administrace je nedostupná', err.message,
      h('button', { type: 'button', class: 'tlacitko tlacitko--plne', onclick: start }, 'Zkusit znovu'));
  }
}

window.addEventListener('hashchange', zobraz);

window.addEventListener('odhlaseno', () => {
  if (!prihlaseny) return;
  prihlaseny = null;
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
  obrazovkaPrihlaseni();
  oznam('Přihlášení vypršelo. Přihlaste se prosím znovu.', 'chyba');
});

window.addEventListener('unhandledrejection', (e) => {
  if (e.reason?.status === 401) return;
  oznamChybu(e.reason);
});

start();
