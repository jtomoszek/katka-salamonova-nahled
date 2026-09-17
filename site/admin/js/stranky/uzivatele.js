/* Uživatelé administrace (jen pro administrátory): pozvání, role, smazání. */

import { ziskej, posli, uprav, smaz } from '../api.js';
import { h, vycisti, datumCas, oznam, oznamChybu, dialog, potvrdit, pole, sPrubehem } from '../ui.js';

function ukazPozvanku({ email, odkaz, emailOdeslan }) {
  const vstup = h('input', { class: 'vstup', readonly: true, value: odkaz, 'aria-label': 'Odkaz pozvánky', onfocus: (e) => e.target.select() });
  dialog({
    titulek: 'Pozvánka je připravená',
    obsah: h('div', { class: 'formular' },
      h('p', { class: 'dialog__text' }, emailOdeslan
        ? `Pozvánka odešla e-mailem na ${email}. Pro jistotu můžete odkaz předat i jinak:`
        : `E-mail s pozvánkou se nepodařilo odeslat. Pošlete prosím ${email} tento odkaz sami:`),
      vstup,
      h('p', { class: 'pole__napoveda', text: 'Odkaz platí 7 dní a jde použít jen jednou. Heslo si pozvaný nastaví sám.' }),
    ),
    akce: [
      {
        text: 'Kopírovat odkaz', typ: 'hlavni',
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(odkaz);
            oznam('Odkaz zkopírován.');
          } catch {
            vstup.focus();
            oznam('Zkopírujte odkaz ručně (Cmd/Ctrl + C).', 'chyba');
          }
        },
      },
      { text: 'Hotovo' },
    ],
  });
}

function pozvat(poUlozeni) {
  const email = pole({ popisek: 'E-mail', type: 'email', required: true });
  const jmeno = pole({ popisek: 'Jméno' });
  const role = pole({
    popisek: 'Role', tag: 'select', value: 'editor',
    moznosti: [['editor', 'Editor — kontakty, štítky a rozesílky'], ['admin', 'Administrátor — navíc správa uživatelů']],
  });
  const chyba = h('p', { class: 'formular__chyba', role: 'alert', hidden: true });

  const formular = h('form', {
    id: 'formular-pozvanka', class: 'formular',
    onsubmit: async (e) => {
      e.preventDefault();
      chyba.hidden = true;
      try {
        const r = await posli('/api/uzivatele', { email: email.prvek.value, jmeno: jmeno.prvek.value, role: role.prvek.value });
        okno.zavrit();
        poUlozeni();
        ukazPozvanku({ email: email.prvek.value, ...r });
      } catch (err) {
        chyba.textContent = err.message;
        chyba.hidden = false;
      }
    },
  }, email.obal, jmeno.obal, role.obal, chyba);

  const okno = dialog({ titulek: 'Pozvat uživatele', obsah: formular, akce: [{ text: 'Zrušit' }, { text: 'Poslat pozvánku', typ: 'hlavni', submit: 'formular-pozvanka' }] });
  email.prvek.focus();
}

export async function stranka(obsah, _params, { prihlaseny }) {
  const { polozky } = await ziskej('/api/uzivatele');
  const obnov = () => stranka(obsah, _params, { prihlaseny });

  vycisti(obsah,
    h('div', { class: 'hlavicka' },
      h('div', null,
        h('h1', { text: 'Uživatelé' }),
        h('p', { class: 'hlavicka__text', text: 'Kdo má přístup do administrace. Nový uživatel si heslo nastaví sám přes pozvánku.' }),
      ),
      h('div', { class: 'hlavicka__akce' }, h('button', { type: 'button', class: 'tlacitko tlacitko--hlavni', onclick: () => pozvat(obnov) }, 'Pozvat uživatele')),
    ),
    h('div', { class: 'tabulka-obal' }, h('table', { class: 'tabulka' },
      h('thead', null, h('tr', null,
        h('th', { text: 'Uživatel' }), h('th', { text: 'Role' }), h('th', { class: 'tabulka__skryt-mobil', text: 'Poslední přihlášení' }),
        h('th', { class: 'tabulka__akce-sloupec' }, h('span', { class: 'vizualne-skryte', text: 'Akce' })),
      )),
      h('tbody', null, polozky.map((u) => {
        const jsemTo = u.id === prihlaseny.id;
        const vyberRole = h('select', {
          class: 'vstup vstup--male', value: u.role, disabled: jsemTo, 'aria-label': `Role uživatele ${u.email}`,
          onchange: async (e) => {
            try {
              await uprav(`/api/uzivatele/${u.id}`, { role: e.target.value });
              oznam('Role změněna.');
            } catch (err) {
              oznamChybu(err);
              e.target.value = u.role;
            }
          },
        }, h('option', { value: 'editor', text: 'Editor' }), h('option', { value: 'admin', text: 'Administrátor' }));

        let stav;
        if (u.aktivni) stav = null;
        else if (u.pozvanka_platnost) stav = h('span', { class: 'odznak odznak--ceka', text: 'Čeká na přijetí pozvánky' });
        else stav = h('span', { class: 'odznak odznak--chyba', text: 'Pozvánka vypršela' });

        return h('tr', null,
          h('td', null,
            h('span', { text: u.jmeno || u.email }),
            jsemTo ? h('span', { class: 'odznak', text: 'vy' }) : null,
            h('div', { class: 'tabulka__podtext', text: u.jmeno ? u.email : '' }),
            stav,
          ),
          h('td', null, vyberRole),
          h('td', { class: 'tabulka__skryt-mobil', text: datumCas(u.posledni_prihlaseni) }),
          h('td', { class: 'tabulka__akce-sloupec' },
            h('button', {
              type: 'button', class: 'tlacitko tlacitko--male',
              title: u.aktivni ? 'Pošle odkaz na nastavení nového hesla' : 'Pošle novou pozvánku',
              onclick: (e) => sPrubehem(e.currentTarget, async () => {
                try {
                  const r = await posli(`/api/uzivatele/${u.id}/pozvanka`);
                  obnov();
                  ukazPozvanku({ email: u.email, ...r });
                } catch (err) { oznamChybu(err); }
              }),
            }, u.aktivni ? 'Obnovit heslo' : 'Nová pozvánka'),
            jsemTo ? null : h('button', {
              type: 'button', class: 'tlacitko tlacitko--male tlacitko--nebezpecne-obrys',
              onclick: async () => {
                if (!(await potvrdit({ titulek: 'Odebrat přístup?', text: `${u.email} se už do administrace nepřihlásí. Odeslané e-maily zůstanou v historii.`, tlacitko: 'Odebrat', nebezpecne: true }))) return;
                try { await smaz(`/api/uzivatele/${u.id}`); oznam('Přístup odebrán.'); obnov(); } catch (err) { oznamChybu(err); }
              },
            }, 'Odebrat'),
          ),
        );
      })),
    )),
  );
}
