/* Uživatelé administrace. Zakládat, měnit a mazat smí jen role admin.
 *
 * Nový uživatel nedostane heslo od nikoho jiného — dostane odkaz, přes
 * který si ho nastaví sám. Heslo tak nikdy necestuje e-mailem ani chatem. */

import { Chyba, json, prectiJson } from '../lib/http.js';
import { nahodnyToken, sha256 } from '../lib/krypto.js';
import { vyzadujEmail, text, idZCesty } from '../lib/validace.js';
import { vyzadujUzivatele } from '../lib/prihlaseni.js';
import { odesliEmail, jePostaNastavena } from '../lib/posta.js';
import { emailPozvanky } from '../lib/sablona.js';
import { adresaWebu } from './newsletter.js';

const PLATNOST_POZVANKY = 7 * 24 * 60 * 60 * 1000;

function roleZVstupu(hodnota) {
  if (hodnota === 'admin' || hodnota === 'editor') return hodnota;
  throw new Chyba(400, 'Neplatná role.');
}

export async function seznam(request, env) {
  await vyzadujUzivatele(request, env, { role: 'admin' });
  const { results } = await env.DB.prepare(
    `SELECT id, email, jmeno, role, vytvoreno, posledni_prihlaseni,
            heslo_hash IS NOT NULL AS aktivni,
            CASE WHEN pozvanka_platnost > ?1 THEN pozvanka_platnost END AS pozvanka_platnost
       FROM uzivatele ORDER BY vytvoreno`,
  ).bind(Date.now()).all();
  return json({ polozky: results.map((u) => ({ ...u, aktivni: Boolean(u.aktivni) })) });
}

/* Vytvoří pozvánku a pokusí se ji poslat e-mailem. Odkaz vrací i v odpovědi,
   aby ho šlo předat jinak, kdyby e-mail nedorazil nebo pošta nebyla nastavená. */
async function vystavPozvanku(request, env, { uzivatelId, email, jmeno, pozval }) {
  const token = nahodnyToken();
  await env.DB.prepare('UPDATE uzivatele SET pozvanka_hash = ?, pozvanka_platnost = ? WHERE id = ?')
    .bind(await sha256(token), Date.now() + PLATNOST_POZVANKY, uzivatelId).run();

  const odkaz = `${adresaWebu(env, request)}/admin/#/pozvanka?t=${encodeURIComponent(token)}`;
  let emailOdeslan = false;
  if (jePostaNastavena(env)) {
    const zprava = emailPozvanky({ odkaz, jmeno, pozval });
    try {
      await odesliEmail(env, { komu: email, predmet: zprava.predmet, html: zprava.html, text: zprava.text });
      emailOdeslan = true;
    } catch (err) {
      console.error('Pozvánku se nepodařilo odeslat:', err.message);
    }
  }
  return { odkaz, emailOdeslan };
}

export async function zalozit(request, env) {
  const ja = await vyzadujUzivatele(request, env, { role: 'admin' });
  const data = await prectiJson(request, 10_000);
  const email = vyzadujEmail(data.email);
  const jmeno = text(data.jmeno, { max: 80, nazev: 'Jméno' });
  const role = roleZVstupu(data.role || 'editor');

  let id;
  try {
    const vysledek = await env.DB.prepare(
      'INSERT INTO uzivatele (email, jmeno, role, vytvoreno) VALUES (?, ?, ?, ?)',
    ).bind(email, jmeno, role, Date.now()).run();
    id = vysledek.meta.last_row_id;
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new Chyba(409, 'Uživatel s tímto e-mailem už existuje.');
    throw err;
  }

  const pozvanka = await vystavPozvanku(request, env, {
    uzivatelId: id, email, jmeno, pozval: ja.jmeno || ja.email,
  });
  return json({ id, ...pozvanka }, { status: 201 });
}

/* Nová pozvánka — i pro existujícího uživatele, který zapomněl heslo.
   Staré heslo platí, dokud si přes odkaz nenastaví nové. */
export async function novaPozvanka(request, env, { id }) {
  const ja = await vyzadujUzivatele(request, env, { role: 'admin' });
  const uzivatelId = idZCesty(id);
  const u = await env.DB.prepare('SELECT id, email, jmeno FROM uzivatele WHERE id = ?').bind(uzivatelId).first();
  if (!u) throw new Chyba(404, 'Uživatel nenalezen.');
  const pozvanka = await vystavPozvanku(request, env, {
    uzivatelId: u.id, email: u.email, jmeno: u.jmeno, pozval: ja.jmeno || ja.email,
  });
  return json(pozvanka);
}

async function pocetAdminu(env) {
  const r = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM uzivatele WHERE role = 'admin' AND heslo_hash IS NOT NULL",
  ).first();
  return r.n;
}

export async function upravit(request, env, { id }) {
  const ja = await vyzadujUzivatele(request, env, { role: 'admin' });
  const uzivatelId = idZCesty(id);
  const data = await prectiJson(request, 10_000);
  const u = await env.DB.prepare('SELECT id, role, heslo_hash IS NOT NULL AS aktivni FROM uzivatele WHERE id = ?').bind(uzivatelId).first();
  if (!u) throw new Chyba(404, 'Uživatel nenalezen.');

  const jmeno = data.jmeno !== undefined ? text(data.jmeno, { max: 80, nazev: 'Jméno' }) : undefined;
  const role = data.role !== undefined ? roleZVstupu(data.role) : undefined;

  if (role === 'editor' && u.role === 'admin') {
    if (u.id === ja.id) throw new Chyba(400, 'Sami sobě roli administrátora odebrat nemůžete.');
    // Počítají se jen admini s nastaveným heslem; pozvaný, který se ještě
    // nepřihlásil, administraci neudrží.
    if (u.aktivni && (await pocetAdminu(env)) <= 1) throw new Chyba(400, 'Administrace musí mít aspoň jednoho administrátora.');
  }

  await env.DB.prepare(
    'UPDATE uzivatele SET jmeno = COALESCE(?, jmeno), role = COALESCE(?, role) WHERE id = ?',
  ).bind(jmeno ?? null, role ?? null, uzivatelId).run();
  return json({ ok: true });
}

export async function smazat(request, env, { id }) {
  const ja = await vyzadujUzivatele(request, env, { role: 'admin' });
  const uzivatelId = idZCesty(id);
  if (uzivatelId === ja.id) throw new Chyba(400, 'Sami sebe smazat nemůžete.');

  const u = await env.DB.prepare('SELECT role, heslo_hash IS NOT NULL AS aktivni FROM uzivatele WHERE id = ?').bind(uzivatelId).first();
  if (!u) throw new Chyba(404, 'Uživatel nenalezen.');
  if (u.role === 'admin' && u.aktivni && (await pocetAdminu(env)) <= 1) {
    throw new Chyba(400, 'Administrace musí mít aspoň jednoho administrátora.');
  }
  await env.DB.prepare('DELETE FROM uzivatele WHERE id = ?').bind(uzivatelId).run();
  return json({ ok: true });
}
