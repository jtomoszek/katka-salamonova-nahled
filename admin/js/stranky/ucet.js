/* Můj účet: přehled a změna hesla. */

import { posli } from '../api.js';
import { h, vycisti, oznam, pole, sPrubehem } from '../ui.js';

export async function stranka(obsah, _params, { prihlaseny }) {
  const soucasne = pole({ popisek: 'Současné heslo', type: 'password', autocomplete: 'current-password', required: true });
  const nove = pole({ popisek: 'Nové heslo', type: 'password', autocomplete: 'new-password', required: true, minlength: 10, napoveda: 'Aspoň 10 znaků. Po změně se odhlásíte na ostatních zařízeních.' });
  const znovu = pole({ popisek: 'Nové heslo znovu', type: 'password', autocomplete: 'new-password', required: true });
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });
  const tlacitko = h('button', { type: 'submit', class: 'tlacitko tlacitko--hlavni' }, 'Změnit heslo');

  const formular = h('form', {
    class: 'formular formular--uzky',
    onsubmit: (e) => {
      e.preventDefault();
      chyba.hidden = true;
      if (nove.prvek.value !== znovu.prvek.value) {
        chyba.textContent = 'Nová hesla se neshodují.';
        chyba.hidden = false;
        return;
      }
      sPrubehem(tlacitko, async () => {
        try {
          await posli('/api/ucet/heslo', { soucasneHeslo: soucasne.prvek.value, noveHeslo: nove.prvek.value });
          formular.reset();
          oznam('Heslo je změněné.');
        } catch (err) {
          chyba.textContent = err.message;
          chyba.hidden = false;
        }
      });
    },
  }, soucasne.obal, nove.obal, znovu.obal, chyba, h('div', { class: 'formular__akce' }, tlacitko));

  vycisti(obsah,
    h('div', { class: 'hlavicka' }, h('div', null, h('h1', { text: 'Můj účet' }))),
    h('section', { class: 'karta' },
      h('dl', { class: 'udaje' },
        h('dt', { text: 'Jméno' }), h('dd', { text: prihlaseny.jmeno || '—' }),
        h('dt', { text: 'E-mail' }), h('dd', { text: prihlaseny.email }),
        h('dt', { text: 'Role' }), h('dd', { text: prihlaseny.role === 'admin' ? 'Administrátor' : 'Editor' }),
      ),
    ),
    h('section', { class: 'karta' },
      h('h2', { class: 'karta__titulek', text: 'Změna hesla' }),
      formular,
    ),
  );
}
