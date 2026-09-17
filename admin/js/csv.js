/* Čtení CSV pro import kontaktů.
 *
 * Český Excel ukládá CSV se středníky a často v kódování Windows-1250, jiné
 * programy s čárkami v UTF-8. Obojí se tu pozná samo. */

export function dekoduj(buffer) {
  try {
    // fatal: true vyhodí chybu na první bajt, který v UTF-8 nedává smysl
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1250').decode(buffer);
  }
}

/* Oddělovač podle prvního řádku — počítají se jen znaky mimo uvozovky. */
export function odhadniOddelovac(text) {
  const kandidati = { ';': 0, ',': 0, '\t': 0 };
  let vUvozovkach = false;
  for (const znak of text) {
    if (znak === '"') vUvozovkach = !vUvozovkach;
    else if (!vUvozovkach && (znak === '\n' || znak === '\r')) break;
    else if (!vUvozovkach && znak in kandidati) kandidati[znak]++;
  }
  const [nejcastejsi, pocet] = Object.entries(kandidati).sort((a, b) => b[1] - a[1])[0];
  return pocet > 0 ? nejcastejsi : ',';
}

/* RFC 4180: pole v uvozovkách smí obsahovat oddělovač i nový řádek,
   uvozovka uvnitř se zapisuje zdvojená. */
export function parsuj(text, oddelovac) {
  const radky = [];
  let radek = [];
  let bunka = '';
  let vUvozovkach = false;

  for (let i = 0; i < text.length; i++) {
    const znak = text[i];
    if (vUvozovkach) {
      if (znak === '"') {
        if (text[i + 1] === '"') { bunka += '"'; i++; } else vUvozovkach = false;
      } else bunka += znak;
      continue;
    }
    if (znak === '"' && bunka === '') vUvozovkach = true;
    else if (znak === oddelovac) { radek.push(bunka); bunka = ''; }
    else if (znak === '\n' || znak === '\r') {
      if (znak === '\r' && text[i + 1] === '\n') i++;
      radek.push(bunka);
      radky.push(radek);
      radek = [];
      bunka = '';
    } else bunka += znak;
  }
  if (bunka !== '' || radek.length) {
    radek.push(bunka);
    radky.push(radek);
  }
  return radky
    .map((r) => r.map((b) => b.trim()))
    .filter((r) => r.some((b) => b !== ''));
}

function normalizuj(t) {
  return String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export const POLE = [
  ['', '— nepoužít —'],
  ['email', 'E-mail'],
  ['jmeno', 'Jméno'],
  ['prijmeni', 'Příjmení'],
  ['celeJmeno', 'Celé jméno (rozdělí se)'],
  ['stitky', 'Štítky'],
];

const NAZVY = {
  email: ['email', 'e mail', 'mail', 'emailova adresa', 'e mailova adresa', 'email address'],
  jmeno: ['jmeno', 'krestni jmeno', 'first name', 'firstname', 'given name'],
  prijmeni: ['prijmeni', 'last name', 'lastname', 'surname', 'family name'],
  celeJmeno: ['cele jmeno', 'jmeno a prijmeni', 'name', 'full name', 'kontakt', 'klient'],
  stitky: ['stitky', 'stitek', 'tags', 'tag', 'skupina', 'skupiny', 'kategorie'],
};

const VYPADA_JAKO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Odhadne, který sloupec je který. Když první řádek obsahuje e-mailovou
   adresu, nejde o hlavičku a data začínají hned. */
export function odhadniMapovani(radky) {
  const prvni = radky[0] || [];
  const maHlavicku = !prvni.some((b) => VYPADA_JAKO_EMAIL.test(b));
  const mapovani = prvni.map(() => '');

  if (maHlavicku) {
    prvni.forEach((nazev, i) => {
      const n = normalizuj(nazev);
      for (const [pole, varianty] of Object.entries(NAZVY)) {
        if (varianty.includes(n) && !mapovani.includes(pole)) { mapovani[i] = pole; break; }
      }
    });
  }

  // Sloupec s e-maily najít podle obsahu, když ho neprozradila hlavička.
  if (!mapovani.includes('email')) {
    const vzorek = radky.slice(maHlavicku ? 1 : 0, 20);
    const i = prvni.findIndex((_, sloupec) => vzorek.some((r) => VYPADA_JAKO_EMAIL.test(r[sloupec] || '')));
    if (i >= 0) mapovani[i] = 'email';
  }

  return { maHlavicku, mapovani };
}

/* Z řádků a mapování sestaví objekty pro API. */
export function naKontakty(radky, mapovani) {
  return radky.map((radek) => {
    const kontakt = { email: '', jmeno: '', prijmeni: '', stitky: [] };
    mapovani.forEach((pole, i) => {
      const hodnota = radek[i] ?? '';
      if (!pole || !hodnota) return;
      if (pole === 'stitky') kontakt.stitky.push(...hodnota.split(/[,|]/).map((s) => s.trim()).filter(Boolean));
      else if (pole === 'celeJmeno') {
        const [jmeno, ...zbytek] = hodnota.split(/\s+/);
        if (!kontakt.jmeno) kontakt.jmeno = jmeno;
        if (!kontakt.prijmeni) kontakt.prijmeni = zbytek.join(' ');
      } else kontakt[pole] = hodnota;
    });
    return kontakt;
  });
}
