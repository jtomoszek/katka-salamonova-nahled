/* Tokeny, hashe a hesla přes WebCrypto — v Workers není potřeba knihovna. */

const kodovac = new TextEncoder();

function naBase64Url(bajty) {
  let binarni = '';
  for (const b of bajty) binarni += String.fromCharCode(b);
  return btoa(binarni).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function naHex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function zHex(hex) {
  const vysledek = new Uint8Array(hex.length / 2);
  for (let i = 0; i < vysledek.length; i++) vysledek[i] = parseInt(hex.substr(i * 2, 2), 16);
  return vysledek;
}

export function nahodnyToken(bajtu = 32) {
  return naBase64Url(crypto.getRandomValues(new Uint8Array(bajtu)));
}

export async function sha256(text) {
  return naHex(await crypto.subtle.digest('SHA-256', kodovac.encode(text)));
}

/* Porovnání v konstantním čase — délka se prozradí, obsah ne. */
export function stejneRetezce(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const ba = kodovac.encode(a);
  const bb = kodovac.encode(b);
  if (ba.length !== bb.length) return false;
  let rozdil = 0;
  for (let i = 0; i < ba.length; i++) rozdil |= ba[i] ^ bb[i];
  return rozdil === 0;
}

/* PBKDF2-SHA256. Workers dovolí nejvýš 100 000 iterací, víc hodí chybu. */
const ITERACI = 100_000;

async function odvod(heslo, sul, iteraci) {
  const klic = await crypto.subtle.importKey('raw', kodovac.encode(heslo), 'PBKDF2', false, ['deriveBits']);
  const bity = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: sul, iterations: iteraci },
    klic,
    256,
  );
  return naHex(bity);
}

export async function zahashujHeslo(heslo) {
  const sul = crypto.getRandomValues(new Uint8Array(16));
  const hash = await odvod(heslo, sul, ITERACI);
  return `pbkdf2$${ITERACI}$${naHex(sul)}$${hash}`;
}

export async function overHeslo(heslo, ulozeno) {
  if (!ulozeno) return false;
  const [algoritmus, iteraci, sulHex, hash] = ulozeno.split('$');
  if (algoritmus !== 'pbkdf2' || !hash) return false;
  const spocitano = await odvod(heslo, zHex(sulHex), Number(iteraci));
  return stejneRetezce(spocitano, hash);
}

/* Když uživatel neexistuje, přesto se spočítá hash, aby délka odpovědi
   neprozradila, které e-maily v administraci jsou. */
const FALESNY_HASH = 'pbkdf2$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000';
export async function overHesloNaprazdno(heslo) {
  await overHeslo(heslo, FALESNY_HASH);
  return false;
}

export function arrayBufferNaBase64(buffer) {
  const bajty = new Uint8Array(buffer);
  let binarni = '';
  const KROK = 0x8000;
  for (let i = 0; i < bajty.length; i += KROK) {
    binarni += String.fromCharCode.apply(null, bajty.subarray(i, i + KROK));
  }
  return btoa(binarni);
}
