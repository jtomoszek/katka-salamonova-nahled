/* Přihlášení, první nastavení, pozvánky a změna hesla. */

import { Chyba, json, prectiJson, ipKlienta } from '../lib/http.js';
import { sha256, zahashujHeslo, overHeslo, overHesloNaprazdno, stejneRetezce } from '../lib/krypto.js';
import { vyzadujEmail, vyzadujHeslo, text, povolPokus, vynulujPokusy } from '../lib/validace.js';
import {
  zalozRelaci, zrusCookie, prihlasenyUzivatel, ukonciRelaci, overPuvod, vyzadujUzivatele,
} from '../lib/prihlaseni.js';

async function pocetUzivatelu(env) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM uzivatele').first();
  return r.n;
}

/* GET /api/ucet/stav — co má administrace ukázat: první nastavení,
   přihlášení, nebo rovnou aplikaci. */
export async function stav(request, env) {
  const uzivatel = await prihlasenyUzivatel(request, env);
  const potrebaNastaveni = uzivatel ? false : (await pocetUzivatelu(env)) === 0;
  // Bez R2 (úložiště příloh) administrace tlačítko na přílohy nenabízí.
  return json({ uzivatel, potrebaNastaveni, prilohyZapnute: Boolean(env.PRILOHY) });
}

/* POST /api/ucet/nastaveni — založení prvního administrátora.
 * Funguje jen dokud neexistuje žádný uživatel a jen se ZAKLADACI_TOKEN,
 * který zná ten, kdo web nasazuje. Bez tokenu by si administraci mohl
 * zabrat kdokoli, kdo stránku otevře dřív. */
export async function nastaveni(request, env) {
  overPuvod(request);
  const data = await prectiJson(request, 10_000);

  if (!env.ZAKLADACI_TOKEN) throw new Chyba(503, 'Chybí ZAKLADACI_TOKEN v nastavení serveru.');
  if (!(await povolPokus(env, `nastaveni:${ipKlienta(request)}`, 10, 15 * 60 * 1000))) {
    throw new Chyba(429, 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.');
  }
  if (!stejneRetezce(String(data.token || ''), env.ZAKLADACI_TOKEN)) {
    throw new Chyba(403, 'Zakládací kód nesouhlasí.');
  }

  const email = vyzadujEmail(data.email);
  const jmeno = text(data.jmeno, { max: 80, nazev: 'Jméno' });
  const heslo = vyzadujHeslo(data.heslo);

  // Podmínka přímo v INSERT: dva souběžné požadavky nezaloží dva adminy.
  const vysledek = await env.DB.prepare(
    `INSERT INTO uzivatele (email, jmeno, role, heslo_hash, vytvoreno)
     SELECT ?, ?, 'admin', ?, ? WHERE NOT EXISTS (SELECT 1 FROM uzivatele)`,
  ).bind(email, jmeno, await zahashujHeslo(heslo), Date.now()).run();
  if (vysledek.meta.changes === 0) throw new Chyba(409, 'Administrace už je nastavená.');

  const cookie = await zalozRelaci(env, vysledek.meta.last_row_id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}

/* POST /api/ucet/prihlasit */
export async function prihlasit(request, env) {
  overPuvod(request);
  const data = await prectiJson(request, 10_000);
  const email = String(data.email || '').trim().toLowerCase();
  const heslo = String(data.heslo || '');

  const ip = ipKlienta(request);
  const klic = `prihlaseni:${email}`;
  const [ipOk, emailOk] = await Promise.all([
    povolPokus(env, `prihlaseni:ip:${ip}`, 30, 15 * 60 * 1000),
    povolPokus(env, klic, 8, 15 * 60 * 1000),
  ]);
  if (!ipOk || !emailOk) {
    throw new Chyba(429, 'Příliš mnoho neúspěšných pokusů. Zkuste to prosím za 15 minut.');
  }

  const uzivatel = email
    ? await env.DB.prepare('SELECT id, heslo_hash FROM uzivatele WHERE email = ?').bind(email).first()
    : null;

  const spravne = uzivatel && uzivatel.heslo_hash
    ? await overHeslo(heslo, uzivatel.heslo_hash)
    : await overHesloNaprazdno(heslo);

  if (!spravne) throw new Chyba(401, 'E-mail nebo heslo nesouhlasí.');

  await vynulujPokusy(env, klic);
  const cookie = await zalozRelaci(env, uzivatel.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}

/* POST /api/ucet/odhlasit */
export async function odhlasit(request, env) {
  overPuvod(request);
  await ukonciRelaci(request, env);
  return json({ ok: true }, { headers: { 'Set-Cookie': zrusCookie() } });
}

/* POST /api/ucet/heslo — změna vlastního hesla. Ostatní relace se ukončí,
   kdyby heslo měnil někdo kvůli podezření na únik. */
export async function zmenitHeslo(request, env) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 10_000);
  const nove = vyzadujHeslo(data.noveHeslo);

  const radek = await env.DB.prepare('SELECT heslo_hash FROM uzivatele WHERE id = ?').bind(uzivatel.id).first();
  if (!(await overHeslo(String(data.soucasneHeslo || ''), radek.heslo_hash))) {
    throw new Chyba(400, 'Současné heslo nesouhlasí.');
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE uzivatele SET heslo_hash = ? WHERE id = ?').bind(await zahashujHeslo(nove), uzivatel.id),
    env.DB.prepare('DELETE FROM relace WHERE uzivatel_id = ?').bind(uzivatel.id),
  ]);
  const cookie = await zalozRelaci(env, uzivatel.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}

async function pozvankaPodleTokenu(env, token) {
  if (!token || token.length > 64) return null;
  return env.DB.prepare(
    'SELECT id, email, jmeno FROM uzivatele WHERE pozvanka_hash = ? AND pozvanka_platnost > ?',
  ).bind(await sha256(token), Date.now()).first();
}

/* GET /api/ucet/pozvanka?t=… — ověří odkaz před zobrazením formuláře. */
export async function nactiPozvanku(request, env) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const pozvanka = await pozvankaPodleTokenu(env, token);
  if (!pozvanka) throw new Chyba(404, 'Pozvánka neplatí nebo už vypršela. Požádejte o novou.');
  return json({ email: pozvanka.email, jmeno: pozvanka.jmeno });
}

/* POST /api/ucet/pozvanka — nastavení hesla z pozvánky. Slouží i jako
   obnova zapomenutého hesla: administrátor pošle novou pozvánku. */
export async function prijmoutPozvanku(request, env) {
  overPuvod(request);
  const data = await prectiJson(request, 10_000);
  if (!(await povolPokus(env, `pozvanka:${ipKlienta(request)}`, 20, 15 * 60 * 1000))) {
    throw new Chyba(429, 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.');
  }
  const pozvanka = await pozvankaPodleTokenu(env, String(data.token || ''));
  if (!pozvanka) throw new Chyba(404, 'Pozvánka neplatí nebo už vypršela. Požádejte o novou.');

  const heslo = vyzadujHeslo(data.heslo);
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE uzivatele SET heslo_hash = ?, pozvanka_hash = NULL, pozvanka_platnost = NULL WHERE id = ?',
    ).bind(await zahashujHeslo(heslo), pozvanka.id),
    env.DB.prepare('DELETE FROM relace WHERE uzivatel_id = ?').bind(pozvanka.id),
  ]);
  const cookie = await zalozRelaci(env, pozvanka.id);
  return json({ ok: true }, { headers: { 'Set-Cookie': cookie } });
}
