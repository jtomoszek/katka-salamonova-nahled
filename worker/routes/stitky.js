/* Štítky kontaktů — podle nich se vybírá, komu e-mail odejde. */

import { Chyba, json, prectiJson } from '../lib/http.js';
import { text, barva, idZCesty } from '../lib/validace.js';
import { vyzadujUzivatele } from '../lib/prihlaseni.js';

export async function seznam(request, env) {
  await vyzadujUzivatele(request, env);
  const { results } = await env.DB.prepare(
    `SELECT s.id, s.nazev, s.barva,
            COUNT(k.id) AS kontaktu,
            COUNT(CASE WHEN k.stav = 'prihlasen' THEN 1 END) AS prihlasenych
       FROM stitky s
       LEFT JOIN kontakty_stitky ks ON ks.stitek_id = s.id
       LEFT JOIN kontakty k ON k.id = ks.kontakt_id
      GROUP BY s.id
      ORDER BY s.nazev COLLATE NOCASE`,
  ).all();
  return json({ polozky: results });
}

function jeKolizeNazvu(err) {
  return String(err.message).includes('UNIQUE');
}

export async function zalozit(request, env) {
  await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 10_000);
  const nazev = text(data.nazev, { max: 40, povinny: true, nazev: 'Název štítku' });
  try {
    const vysledek = await env.DB.prepare('INSERT INTO stitky (nazev, barva, vytvoreno) VALUES (?, ?, ?)')
      .bind(nazev, barva(data.barva), Date.now()).run();
    return json({ id: vysledek.meta.last_row_id, nazev, barva: barva(data.barva) }, { status: 201 });
  } catch (err) {
    if (jeKolizeNazvu(err)) throw new Chyba(409, 'Štítek s tímto názvem už existuje.');
    throw err;
  }
}

export async function upravit(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const stitekId = idZCesty(id);
  const data = await prectiJson(request, 10_000);
  const nazev = data.nazev !== undefined ? text(data.nazev, { max: 40, povinny: true, nazev: 'Název štítku' }) : null;
  const nova = data.barva !== undefined ? barva(data.barva) : null;
  try {
    const vysledek = await env.DB.prepare(
      'UPDATE stitky SET nazev = COALESCE(?, nazev), barva = COALESCE(?, barva) WHERE id = ?',
    ).bind(nazev, nova, stitekId).run();
    if (vysledek.meta.changes === 0) throw new Chyba(404, 'Štítek nenalezen.');
  } catch (err) {
    if (jeKolizeNazvu(err)) throw new Chyba(409, 'Štítek s tímto názvem už existuje.');
    throw err;
  }
  return json({ ok: true });
}

export async function smazat(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const vysledek = await env.DB.prepare('DELETE FROM stitky WHERE id = ?').bind(idZCesty(id)).run();
  if (vysledek.meta.changes === 0) throw new Chyba(404, 'Štítek nenalezen.');
  return json({ ok: true });
}

/* Založí chybějící štítky podle názvů a vrátí mapu název → id.
   Používá import CSV, kde štítky přicházejí jako text. */
export async function stitkyPodleNazvu(env, nazvy) {
  const unikatni = [...new Map(
    nazvy.map((n) => String(n).trim()).filter(Boolean).map((n) => [n.toLowerCase(), n.slice(0, 40)]),
  ).values()];
  if (!unikatni.length) return new Map();

  const ted = Date.now();
  await env.DB.batch(unikatni.map((nazev) =>
    env.DB.prepare('INSERT INTO stitky (nazev, vytvoreno) VALUES (?, ?) ON CONFLICT (nazev) DO NOTHING').bind(nazev, ted),
  ));

  const mapa = new Map();
  // D1 bere nejvýš 100 parametrů na dotaz
  for (let i = 0; i < unikatni.length; i += 90) {
    const kus = unikatni.slice(i, i + 90);
    const { results } = await env.DB.prepare(
      `SELECT id, nazev FROM stitky WHERE nazev IN (${kus.map(() => '?').join(',')})`,
    ).bind(...kus).all();
    for (const r of results) mapa.set(r.nazev.toLowerCase(), r.id);
  }
  return mapa;
}
