/* Relace administrace.
 *
 * Token relace je náhodných 32 bajtů v HttpOnly cookie; v databázi leží jen
 * jeho SHA-256, takže únik databáze nedává použitelné přihlášení.
 *
 * Proti CSRF: cookie je SameSite=Strict a každý zapisující požadavek musí
 * nést hlavičku X-Pozadavek (prohlížeč ji cizí stránce nedovolí poslat bez
 * CORS preflightu, který nepovolujeme) a Origin shodný s webem. */

import { Chyba, prectiCookies } from './http.js';
import { nahodnyToken, sha256 } from './krypto.js';

const DELKA_RELACE = 14 * 24 * 60 * 60 * 1000;

/* __Host- prefix vynutí Secure, Path=/ a zákaz Domain. Prohlížeče ho
   přijmou i na http://localhost, takže funguje i při lokálním vývoji. */
export const COOKIE = '__Host-katka_relace';

export async function zalozRelaci(env, uzivatelId) {
  const token = nahodnyToken();
  const ted = Date.now();
  await env.DB.batch([
    env.DB.prepare('INSERT INTO relace (token_hash, uzivatel_id, vytvoreno, platnost) VALUES (?, ?, ?, ?)')
      .bind(await sha256(token), uzivatelId, ted, ted + DELKA_RELACE),
    env.DB.prepare('UPDATE uzivatele SET posledni_prihlaseni = ? WHERE id = ?').bind(ted, uzivatelId),
  ]);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DELKA_RELACE / 1000}`;
}

export function zrusCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

async function tokenZPozadavku(request) {
  const token = prectiCookies(request.headers.get('Cookie'))[COOKIE];
  return token && token.length <= 64 ? token : null;
}

export async function prihlasenyUzivatel(request, env) {
  const token = await tokenZPozadavku(request);
  if (!token) return null;
  const radek = await env.DB.prepare(
    `SELECT u.id, u.email, u.jmeno, u.role
       FROM relace r JOIN uzivatele u ON u.id = r.uzivatel_id
      WHERE r.token_hash = ? AND r.platnost > ? AND u.heslo_hash IS NOT NULL`,
  ).bind(await sha256(token), Date.now()).first();
  return radek || null;
}

export async function ukonciRelaci(request, env) {
  const token = await tokenZPozadavku(request);
  if (token) await env.DB.prepare('DELETE FROM relace WHERE token_hash = ?').bind(await sha256(token)).run();
}

/* Zkontroluje původ zapisujícího požadavku. GET/HEAD jsou bez vedlejších
   účinků, takže je nekontrolujeme. */
export function overPuvod(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return;
  if (request.headers.get('X-Pozadavek') !== 'administrace') {
    throw new Chyba(403, 'Požadavek nepochází z administrace.');
  }
  const origin = request.headers.get('Origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new Chyba(403, 'Požadavek nepochází z administrace.');
  }
}

export async function vyzadujUzivatele(request, env, { role } = {}) {
  overPuvod(request);
  const uzivatel = await prihlasenyUzivatel(request, env);
  if (!uzivatel) throw new Chyba(401, 'Přihlaste se prosím.');
  if (role === 'admin' && uzivatel.role !== 'admin') {
    throw new Chyba(403, 'Na tuhle akci potřebujete roli administrátora.');
  }
  return uzivatel;
}
