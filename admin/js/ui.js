/* Stavební kameny rozhraní.
 *
 * h() skládá DOM bez innerHTML — texty jdou vždy přes textContent, takže
 * cokoli z databáze (jména, předměty e-mailů) se nikdy nevyhodnotí jako HTML. */

export function h(tag, vlastnosti, ...deti) {
  const prvek = document.createElement(tag);
  let hodnotaPole;
  if (vlastnosti) {
    for (const [klic, hodnota] of Object.entries(vlastnosti)) {
      if (hodnota === undefined || hodnota === null || hodnota === false) continue;
      // value až po vložení dětí: <textarea> atribut value ignoruje
      // a <select> bez vložených <option> hodnotu nepřijme.
      if (klic === 'value') hodnotaPole = hodnota;
      else if (klic === 'class') prvek.className = hodnota;
      else if (klic === 'text') prvek.textContent = hodnota;
      else if (klic === 'dataset') Object.assign(prvek.dataset, hodnota);
      else if (klic.startsWith('on') && typeof hodnota === 'function') prvek.addEventListener(klic.slice(2).toLowerCase(), hodnota);
      else if (klic in prvek && typeof hodnota !== 'string') prvek[klic] = hodnota;
      else if (hodnota === true) prvek.setAttribute(klic, '');
      else prvek.setAttribute(klic, String(hodnota));
    }
  }
  pripoj(prvek, deti);
  if (hodnotaPole !== undefined) prvek.value = hodnotaPole;
  return prvek;
}

function pripoj(rodic, deti) {
  for (const dite of deti.flat(Infinity)) {
    if (dite === undefined || dite === null || dite === false) continue;
    rodic.append(dite instanceof Node ? dite : document.createTextNode(String(dite)));
  }
}

export function vycisti(prvek, ...deti) {
  prvek.replaceChildren();
  pripoj(prvek, deti);
  return prvek;
}

/* ---------- formátování ---------- */

const CISLO = new Intl.NumberFormat('cs-CZ');
const DATUM = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric' });
const DATUM_CAS = new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const cislo = (n) => CISLO.format(n || 0);
export const datum = (ms) => (ms ? DATUM.format(new Date(ms)) : '—');
export const datumCas = (ms) => (ms ? DATUM_CAS.format(new Date(ms)) : '—');

export function velikost(bajty) {
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${Math.round(bajty / 1024)} kB`;
  return `${(bajty / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

export function sklonuj(n, jeden, dva, pet) {
  if (n === 1) return jeden;
  if (n >= 2 && n <= 4) return dva;
  return pet;
}

/* ---------- štítky a stavy ---------- */

export function stitek(s, { odebrat } = {}) {
  return h('span', { class: 'stitek', style: `--barva:${/^#[0-9a-f]{6}$/i.test(s.barva) ? s.barva : '#b48563'}` },
    h('span', { class: 'stitek__tecka', 'aria-hidden': 'true' }),
    s.nazev,
    odebrat && h('button', { type: 'button', class: 'stitek__odebrat', 'aria-label': `Odebrat štítek ${s.nazev}`, onclick: odebrat }, '×'),
  );
}

const STAVY_KONTAKTU = {
  prihlasen: ['Přihlášen', 'ok'],
  cekajici: ['Čeká na potvrzení', 'ceka'],
  odhlasen: ['Odhlášen', 'vypnuto'],
};
export function stavKontaktu(stav) {
  const [text, typ] = STAVY_KONTAKTU[stav] || [stav, ''];
  return h('span', { class: `odznak odznak--${typ}` }, text);
}

const STAVY_KAMPANE = {
  odesila_se: ['Odesílá se', 'ceka'],
  odeslano: ['Odesláno', 'ok'],
  selhalo: ['Selhalo', 'chyba'],
};
export function stavKampane(stav) {
  const [text, typ] = STAVY_KAMPANE[stav] || [stav, ''];
  return h('span', { class: `odznak odznak--${typ}` }, text);
}

const STAVY_PRIJEMCE = {
  ve_fronte: ['Ve frontě', 'ceka'],
  odesila_se: ['Odesílá se', 'ceka'],
  odeslano: ['Odesláno', 'ok'],
  selhalo: ['Selhalo', 'chyba'],
  preskoceno: ['Přeskočeno', 'vypnuto'],
};
export function stavPrijemce(stav) {
  const [text, typ] = STAVY_PRIJEMCE[stav] || [stav, ''];
  return h('span', { class: `odznak odznak--${typ}` }, text);
}

/* ---------- oznámení ---------- */

export function oznam(text, typ = 'ok') {
  const kontejner = document.getElementById('oznameni');
  const zprava = h('div', { class: `oznameni__zprava oznameni__zprava--${typ}` }, text);
  kontejner.append(zprava);
  setTimeout(() => {
    zprava.classList.add('oznameni__zprava--mizi');
    setTimeout(() => zprava.remove(), 300);
  }, typ === 'chyba' ? 7000 : 3500);
}

export function oznamChybu(err) {
  oznam(err?.message || 'Něco se pokazilo.', 'chyba');
}

/* ---------- dialogy ---------- */

export function dialog({ titulek, obsah, akce = [], siroky = false, poZavreni }) {
  const zavrit = () => okno.close();
  const tlacitka = akce.map((a) => h('button', {
    type: a.submit ? 'submit' : 'button',
    class: `tlacitko ${a.typ ? `tlacitko--${a.typ}` : ''}`,
    form: a.submit ? a.submit : undefined,
    onclick: a.submit ? undefined : () => (a.onClick ? a.onClick(zavrit) : zavrit()),
  }, a.text));

  const okno = h('dialog', { class: `dialog ${siroky ? 'dialog--siroky' : ''}` },
    h('div', { class: 'dialog__hlava' },
      h('h2', { class: 'dialog__titulek', text: titulek }),
      h('button', { type: 'button', class: 'dialog__zavrit', 'aria-label': 'Zavřít', onclick: zavrit }, '×'),
    ),
    h('div', { class: 'dialog__obsah' }, obsah),
    tlacitka.length ? h('div', { class: 'dialog__akce' }, tlacitka) : null,
  );
  okno.addEventListener('close', () => {
    okno.remove();
    poZavreni?.();
  });
  document.body.append(okno);
  okno.showModal();
  return { okno, zavrit };
}

export function potvrdit({ titulek, text, tlacitko = 'Potvrdit', nebezpecne = false }) {
  return new Promise((vyres) => {
    let vysledek = false;
    dialog({
      titulek,
      obsah: h('p', { class: 'dialog__text' }, text),
      akce: [
        { text: 'Zpět' },
        { text: tlacitko, typ: nebezpecne ? 'nebezpecne' : 'hlavni', onClick: (zavrit) => { vysledek = true; zavrit(); } },
      ],
      poZavreni: () => vyres(vysledek),
    });
  });
}

/* Tlačítko po dobu akce zablokuje a ukáže, že se pracuje. */
export async function sPrubehem(tlacitko, akce) {
  const puvodni = tlacitko.textContent;
  tlacitko.disabled = true;
  tlacitko.classList.add('tlacitko--pracuje');
  try {
    return await akce();
  } finally {
    tlacitko.disabled = false;
    tlacitko.classList.remove('tlacitko--pracuje');
    tlacitko.textContent = puvodni;
  }
}

export function zpozdene(funkce, ms = 300) {
  let casovac;
  return (...args) => {
    clearTimeout(casovac);
    casovac = setTimeout(() => funkce(...args), ms);
  };
}

/* ---------- formuláře ---------- */

export function pole({ popisek, napoveda, ...vstup }) {
  const id = vstup.id || `pole-${Math.random().toString(36).slice(2, 9)}`;
  const prvek = vstup.tag === 'textarea'
    ? h('textarea', { ...vstup, tag: undefined, id, class: 'vstup' })
    : vstup.tag === 'select'
      ? h('select', { ...vstup, tag: undefined, id, class: 'vstup', moznosti: undefined },
        (vstup.moznosti || []).map(([hodnota, text]) => h('option', { value: hodnota, text })))
      : h('input', { ...vstup, id, class: 'vstup' });
  return {
    prvek,
    obal: h('div', { class: 'pole' },
      h('label', { class: 'pole__popisek', for: id, text: popisek }),
      prvek,
      napoveda ? h('p', { class: 'pole__napoveda' }, napoveda) : null,
    ),
  };
}

export function zaskrtavatko({ popisek, ...vstup }) {
  const prvek = h('input', { type: 'checkbox', ...vstup });
  return { prvek, obal: h('label', { class: 'zaskrtavatko' }, prvek, h('span', null, popisek)) };
}

export function prazdnyStav(nadpis, text, ...akce) {
  return h('div', { class: 'prazdno' },
    h('p', { class: 'prazdno__nadpis', text: nadpis }),
    text ? h('p', { class: 'prazdno__text', text }) : null,
    akce.length ? h('div', { class: 'prazdno__akce' }, akce) : null,
  );
}

export function strankovani({ stranka, naStranku, celkem, zmen }) {
  const stran = Math.max(1, Math.ceil(celkem / naStranku));
  if (stran <= 1) return null;
  return h('nav', { class: 'strankovani', 'aria-label': 'Stránkování' },
    h('button', { type: 'button', class: 'tlacitko tlacitko--male', disabled: stranka <= 1, onclick: () => zmen(stranka - 1) }, '← Předchozí'),
    h('span', { class: 'strankovani__info' }, `Strana ${stranka} z ${stran}`),
    h('button', { type: 'button', class: 'tlacitko tlacitko--male', disabled: stranka >= stran, onclick: () => zmen(stranka + 1) }, 'Další →'),
  );
}

export function odkaz(href, text, trida = '') {
  return h('a', { href, class: trida }, text);
}
