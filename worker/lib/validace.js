/* Kontrola vstupů a omezení počtu pokusů. */

import { Chyba } from './http.js';

/* Záměrně jednoduché: něco@něco.tld bez mezer. Přesnou platnost stejně
   ověří až doručení, cílem je odchytit překlepy a nesmysly. */
const EMAIL_VZOR = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:".]{2,}$/;

export function normalizujEmail(hodnota) {
  return String(hodnota ?? '').trim().toLowerCase();
}

export function jePlatnyEmail(email) {
  return email.length <= 254 && EMAIL_VZOR.test(email);
}

export function vyzadujEmail(hodnota) {
  const email = normalizujEmail(hodnota);
  if (!jePlatnyEmail(email)) throw new Chyba(400, 'Zadejte platnou e-mailovou adresu.');
  return email;
}

export function text(hodnota, { max = 200, povinny = false, nazev = 'Pole' } = {}) {
  const t = String(hodnota ?? '').trim();
  if (povinny && !t) throw new Chyba(400, `${nazev} je povinné.`);
  if (t.length > max) throw new Chyba(400, `${nazev} je příliš dlouhé (nejvýš ${max} znaků).`);
  return t;
}

export function seznamId(hodnota, { max = 100, nazev = 'Seznam' } = {}) {
  if (hodnota == null) return [];
  if (!Array.isArray(hodnota)) throw new Chyba(400, `${nazev} musí být seznam.`);
  const ids = [...new Set(hodnota.map((x) => Number(x)))];
  if (ids.some((x) => !Number.isInteger(x) || x <= 0)) throw new Chyba(400, `${nazev} obsahuje neplatnou hodnotu.`);
  if (ids.length > max) throw new Chyba(400, `${nazev} může mít nejvýš ${max} položek.`);
  return ids;
}

export function idZCesty(hodnota) {
  const id = Number(hodnota);
  if (!Number.isInteger(id) || id <= 0) throw new Chyba(404, 'Nenalezeno.');
  return id;
}

export function vyzadujHeslo(heslo) {
  const h = String(heslo ?? '');
  if (h.length < 10) throw new Chyba(400, 'Heslo musí mít aspoň 10 znaků.');
  if (h.length > 200) throw new Chyba(400, 'Heslo je příliš dlouhé.');
  return h;
}

const BARVA_VZOR = /^#[0-9a-f]{6}$/i;
export function barva(hodnota, vychozi = '#b48563') {
  const b = String(hodnota ?? '').trim();
  return BARVA_VZOR.test(b) ? b.toLowerCase() : vychozi;
}

/* Klouzavé okno v D1. Vrací true, pokud je pokus ještě povolený.
   Jeden atomický příkaz — souběžné požadavky se nepředběhnou. */
export async function povolPokus(env, klic, limit, oknoMs) {
  const ted = Date.now();
  const radek = await env.DB.prepare(
    `INSERT INTO omezeni (klic, pocet, zacatek_okna) VALUES (?1, 1, ?2)
     ON CONFLICT (klic) DO UPDATE SET
       pocet        = CASE WHEN omezeni.zacatek_okna < ?2 - ?3 THEN 1  ELSE omezeni.pocet + 1 END,
       zacatek_okna = CASE WHEN omezeni.zacatek_okna < ?2 - ?3 THEN ?2 ELSE omezeni.zacatek_okna END
     RETURNING pocet`,
  ).bind(klic, ted, oknoMs).first();
  return radek.pocet <= limit;
}

export async function vynulujPokusy(env, klic) {
  await env.DB.prepare('DELETE FROM omezeni WHERE klic = ?').bind(klic).run();
}
