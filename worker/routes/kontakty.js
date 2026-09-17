/* Kontakty: seznam s filtry, detail, ruční založení, úpravy, hromadné akce,
 * import z CSV a export.
 *
 * Pravidlo, které se tu drží všude: odhlášený kontakt nejde znovu přihlásit
 * importem ani hromadnou akcí. Jen ručně a jen s výslovně potvrzeným novým
 * souhlasem — jinak by se porušil GDPR i zákon o obchodních sděleních. */

import { Chyba, json, prectiJson, cislo } from '../lib/http.js';
import { nahodnyToken } from '../lib/krypto.js';
import {
  normalizujEmail, jePlatnyEmail, vyzadujEmail, text, seznamId, idZCesty,
} from '../lib/validace.js';
import { vyzadujUzivatele } from '../lib/prihlaseni.js';
import { stitkyPodleNazvu } from './stitky.js';

const STAVY = ['cekajici', 'prihlasen', 'odhlasen'];
const MAX_PARAMETRU = 90; // D1 bere nejvýš 100 parametrů na dotaz

function kusy(pole, velikost = MAX_PARAMETRU) {
  const vysledek = [];
  for (let i = 0; i < pole.length; i += velikost) vysledek.push(pole.slice(i, i + velikost));
  return vysledek;
}

function otazniky(n) {
  return Array(n).fill('?').join(',');
}

/* Společný filtr pro seznam, export i hromadný výběr. */
function filtr(params) {
  const podminky = [];
  const hodnoty = [];

  const hledat = String(params.get('q') || '').trim().slice(0, 100);
  if (hledat) {
    const vzor = `%${hledat.replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    podminky.push("(k.email LIKE ? ESCAPE '\\' OR k.jmeno LIKE ? ESCAPE '\\' OR k.prijmeni LIKE ? ESCAPE '\\')");
    hodnoty.push(vzor, vzor, vzor);
  }

  const stav = params.get('stav');
  if (stav && STAVY.includes(stav)) {
    podminky.push('k.stav = ?');
    hodnoty.push(stav);
  }

  const stitek = cislo(params.get('stitek'), { min: 1 });
  if (stitek) {
    podminky.push('EXISTS (SELECT 1 FROM kontakty_stitky ks WHERE ks.kontakt_id = k.id AND ks.stitek_id = ?)');
    hodnoty.push(stitek);
  }

  return { kde: podminky.length ? `WHERE ${podminky.join(' AND ')}` : '', hodnoty };
}

async function stitkyKontaktu(env, ids) {
  const mapa = new Map(ids.map((id) => [id, []]));
  for (const kus of kusy(ids)) {
    const { results } = await env.DB.prepare(
      `SELECT ks.kontakt_id, s.id, s.nazev, s.barva
         FROM kontakty_stitky ks JOIN stitky s ON s.id = ks.stitek_id
        WHERE ks.kontakt_id IN (${otazniky(kus.length)})
        ORDER BY s.nazev COLLATE NOCASE`,
    ).bind(...kus).all();
    for (const r of results) mapa.get(r.kontakt_id).push({ id: r.id, nazev: r.nazev, barva: r.barva });
  }
  return mapa;
}

/* GET /api/kontakty */
export async function seznam(request, env) {
  await vyzadujUzivatele(request, env);
  const params = new URL(request.url).searchParams;
  const { kde, hodnoty } = filtr(params);
  const naStranku = cislo(params.get('naStranku'), { min: 10, max: 100, vychozi: 50 });
  const stranka = cislo(params.get('stranka'), { min: 1, vychozi: 1 });

  const [celkem, polozky] = await Promise.all([
    env.DB.prepare(`SELECT COUNT(*) AS n FROM kontakty k ${kde}`).bind(...hodnoty).first(),
    env.DB.prepare(
      `SELECT k.id, k.email, k.jmeno, k.prijmeni, k.stav, k.zdroj, k.vytvoreno
         FROM kontakty k ${kde}
        ORDER BY k.vytvoreno DESC, k.id DESC
        LIMIT ? OFFSET ?`,
    ).bind(...hodnoty, naStranku, (stranka - 1) * naStranku).all(),
  ]);

  const stitky = await stitkyKontaktu(env, polozky.results.map((k) => k.id));
  return json({
    polozky: polozky.results.map((k) => ({ ...k, stitky: stitky.get(k.id) })),
    celkem: celkem.n,
    stranka,
    naStranku,
  });
}

/* GET /api/kontakty/:id — detail včetně historie odeslaných e-mailů. */
export async function detail(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const kontaktId = idZCesty(id);
  const kontakt = await env.DB.prepare(
    `SELECT id, email, jmeno, prijmeni, stav, zdroj, souhlas_cas, souhlas_poznamka,
            odhlaseno, vytvoreno, upraveno
       FROM kontakty WHERE id = ?`,
  ).bind(kontaktId).first();
  if (!kontakt) throw new Chyba(404, 'Kontakt nenalezen.');

  const [stitky, historie] = await Promise.all([
    stitkyKontaktu(env, [kontaktId]),
    env.DB.prepare(
      `SELECT p.stav, p.odeslano, p.chyba, c.id AS kampan_id, c.predmet, c.vytvoreno
         FROM prijemci p JOIN kampane c ON c.id = p.kampan_id
        WHERE p.kontakt_id = ?
        ORDER BY c.vytvoreno DESC LIMIT 25`,
    ).bind(kontaktId).all(),
  ]);
  return json({ ...kontakt, stitky: stitky.get(kontaktId), historie: historie.results });
}

async function nastavStitky(env, kontaktId, stitkyIds) {
  const prikazy = [env.DB.prepare('DELETE FROM kontakty_stitky WHERE kontakt_id = ?').bind(kontaktId)];
  for (const stitekId of stitkyIds) {
    prikazy.push(env.DB.prepare(
      `INSERT INTO kontakty_stitky (kontakt_id, stitek_id)
       SELECT ?, id FROM stitky WHERE id = ? ON CONFLICT DO NOTHING`,
    ).bind(kontaktId, stitekId));
  }
  await env.DB.batch(prikazy);
}

/* POST /api/kontakty — ruční přidání. Vyžaduje potvrzení, že člověk
   se zasíláním souhlasil (a kde/kdy, do poznámky). */
export async function zalozit(request, env) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 20_000);
  const email = vyzadujEmail(data.email);
  const jmeno = text(data.jmeno, { max: 80, nazev: 'Jméno' });
  const prijmeni = text(data.prijmeni, { max: 80, nazev: 'Příjmení' });
  const stitkyIds = seznamId(data.stitky, { nazev: 'Štítky' });
  if (data.souhlasPotvrzen !== true) {
    throw new Chyba(400, 'Potvrďte prosím, že kontakt se zasíláním novinek souhlasil.');
  }
  const poznamka = text(data.souhlasPoznamka, { max: 300, nazev: 'Poznámka k souhlasu' })
    || `Přidáno ručně (${uzivatel.email})`;

  const ted = Date.now();
  let id;
  try {
    const vysledek = await env.DB.prepare(
      `INSERT INTO kontakty (email, jmeno, prijmeni, stav, zdroj, souhlas_cas, souhlas_poznamka,
                             odhlaseni_token, vytvoreno, upraveno)
       VALUES (?, ?, ?, 'prihlasen', 'rucne', ?, ?, ?, ?, ?)`,
    ).bind(email, jmeno, prijmeni, ted, poznamka, nahodnyToken(), ted, ted).run();
    id = vysledek.meta.last_row_id;
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) throw new Chyba(409, 'Kontakt s tímto e-mailem už existuje.');
    throw err;
  }
  if (stitkyIds.length) await nastavStitky(env, id, stitkyIds);
  return json({ id }, { status: 201 });
}

/* PATCH /api/kontakty/:id */
export async function upravit(request, env, { id }) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const kontaktId = idZCesty(id);
  const data = await prectiJson(request, 20_000);

  const kontakt = await env.DB.prepare('SELECT stav FROM kontakty WHERE id = ?').bind(kontaktId).first();
  if (!kontakt) throw new Chyba(404, 'Kontakt nenalezen.');

  const ted = Date.now();
  const sloupce = ['upraveno = ?'];
  const hodnoty = [ted];

  if (data.jmeno !== undefined) {
    sloupce.push('jmeno = ?');
    hodnoty.push(text(data.jmeno, { max: 80, nazev: 'Jméno' }));
  }
  if (data.prijmeni !== undefined) {
    sloupce.push('prijmeni = ?');
    hodnoty.push(text(data.prijmeni, { max: 80, nazev: 'Příjmení' }));
  }

  if (data.stav !== undefined && data.stav !== kontakt.stav) {
    if (data.stav === 'odhlasen') {
      sloupce.push("stav = 'odhlasen'", 'odhlaseno = ?');
      hodnoty.push(ted);
    } else if (data.stav === 'prihlasen') {
      if (data.souhlasPotvrzen !== true) {
        throw new Chyba(400, 'Znovu přihlásit lze jen s potvrzeným novým souhlasem kontaktu.');
      }
      const poznamka = text(data.souhlasPoznamka, { max: 300, nazev: 'Poznámka k souhlasu' });
      if (!poznamka) throw new Chyba(400, 'Doplňte prosím, kdy a jak kontakt nový souhlas dal.');
      sloupce.push("stav = 'prihlasen'", 'odhlaseno = NULL', 'souhlas_cas = ?', 'souhlas_poznamka = ?');
      hodnoty.push(ted, `${poznamka} (${uzivatel.email})`);
    } else {
      throw new Chyba(400, 'Neplatný stav.');
    }
  }

  await env.DB.prepare(`UPDATE kontakty SET ${sloupce.join(', ')} WHERE id = ?`).bind(...hodnoty, kontaktId).run();
  if (data.stitky !== undefined) await nastavStitky(env, kontaktId, seznamId(data.stitky, { nazev: 'Štítky' }));
  return json({ ok: true });
}

/* Smazání podle GDPR: kontakt zmizí a v historii rozesílek se adresa
   nahradí zástupným textem, aby po člověku nezůstala stopa. */
async function smazKontakty(env, ids) {
  for (const kus of kusy(ids)) {
    const znaky = otazniky(kus.length);
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE prijemci SET email = 'smazany-kontakt-' || id, kontakt_id = NULL
          WHERE kontakt_id IN (${znaky})`,
      ).bind(...kus),
      env.DB.prepare(`DELETE FROM kontakty WHERE id IN (${znaky})`).bind(...kus),
    ]);
  }
}

export async function smazat(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const kontaktId = idZCesty(id);
  const existuje = await env.DB.prepare('SELECT 1 FROM kontakty WHERE id = ?').bind(kontaktId).first();
  if (!existuje) throw new Chyba(404, 'Kontakt nenalezen.');
  await smazKontakty(env, [kontaktId]);
  return json({ ok: true });
}

/* POST /api/kontakty/hromadne */
export async function hromadne(request, env) {
  await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 100_000);
  const ids = seznamId(data.ids, { max: 1000, nazev: 'Vybrané kontakty' });
  if (!ids.length) throw new Chyba(400, 'Nevybrali jste žádné kontakty.');
  const ted = Date.now();

  switch (data.akce) {
    case 'pridatStitek':
    case 'odebratStitek': {
      const stitekId = idZCesty(data.stitek);
      const stitek = await env.DB.prepare('SELECT 1 FROM stitky WHERE id = ?').bind(stitekId).first();
      if (!stitek) throw new Chyba(404, 'Štítek nenalezen.');
      for (const kus of kusy(ids, 80)) {
        const znaky = otazniky(kus.length);
        const sql = data.akce === 'pridatStitek'
          ? `INSERT INTO kontakty_stitky (kontakt_id, stitek_id)
             SELECT id, ? FROM kontakty WHERE id IN (${znaky}) ON CONFLICT DO NOTHING`
          : `DELETE FROM kontakty_stitky WHERE stitek_id = ? AND kontakt_id IN (${znaky})`;
        await env.DB.prepare(sql).bind(stitekId, ...kus).run();
      }
      break;
    }
    case 'odhlasit':
      for (const kus of kusy(ids, 80)) {
        await env.DB.prepare(
          `UPDATE kontakty SET stav = 'odhlasen', odhlaseno = COALESCE(odhlaseno, ?), upraveno = ?
            WHERE id IN (${otazniky(kus.length)})`,
        ).bind(ted, ted, ...kus).run();
      }
      break;
    case 'smazat':
      await smazKontakty(env, ids);
      break;
    default:
      throw new Chyba(400, 'Neznámá akce.');
  }
  return json({ ok: true, pocet: ids.length });
}

/* POST /api/kontakty/import
 * Tělo: { radky: [{ email, jmeno, prijmeni, stitky: ['název', …] }],
 *         stitky: [id, …]            — přidat všem importovaným,
 *         existujici: 'preskocit' | 'doplnit',
 *         souhlasPotvrzen: true, souhlasPoznamka: '…' }
 * CSV parsuje prohlížeč (umí i Windows-1250 z českého Excelu) a posílá
 * řádky po dávkách, aby jeden požadavek nebyl obří. */
export async function importovat(request, env) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 1_000_000);

  if (data.souhlasPotvrzen !== true) {
    throw new Chyba(400, 'Import je možný jen pro kontakty, které se zasíláním souhlasily. Potvrďte to prosím.');
  }
  const poznamka = text(data.souhlasPoznamka, { max: 300, nazev: 'Poznámka k souhlasu' });
  if (!poznamka) throw new Chyba(400, 'Doplňte prosím, odkud kontakty jsou a jak souhlas dali.');

  if (!Array.isArray(data.radky)) throw new Chyba(400, 'Chybí řádky k importu.');
  if (data.radky.length > 500) throw new Chyba(400, 'Najednou lze poslat nejvýš 500 řádků.');
  const spolecneStitky = seznamId(data.stitky, { max: 50, nazev: 'Štítky' });
  const doplnit = data.existujici === 'doplnit';
  const prvniRadek = cislo(data.prvniRadek, { min: 1, vychozi: 1 });

  const neplatne = [];
  const platne = new Map(); // email → řádek (duplicitní v souboru se sloučí)
  data.radky.forEach((radek, i) => {
    const email = normalizujEmail(radek?.email);
    const cisloRadku = prvniRadek + i;
    if (!email) return neplatne.push({ radek: cisloRadku, email: '', duvod: 'Chybí e-mail' });
    if (!jePlatnyEmail(email)) return neplatne.push({ radek: cisloRadku, email, duvod: 'Neplatný e-mail' });
    if (platne.has(email)) return;
    platne.set(email, {
      email,
      jmeno: String(radek.jmeno ?? '').trim().slice(0, 80),
      prijmeni: String(radek.prijmeni ?? '').trim().slice(0, 80),
      stitky: Array.isArray(radek.stitky) ? radek.stitky.map(String).slice(0, 20) : [],
    });
  });

  const emaily = [...platne.keys()];
  const existujici = new Map();
  for (const kus of kusy(emaily)) {
    const { results } = await env.DB.prepare(
      `SELECT id, email, jmeno, prijmeni, stav FROM kontakty WHERE email IN (${otazniky(kus.length)})`,
    ).bind(...kus).all();
    for (const r of results) existujici.set(r.email.toLowerCase(), r);
  }

  const ted = Date.now();
  const souhlas = `${poznamka} (import: ${uzivatel.email})`;
  const nove = emaily.filter((e) => !existujici.has(e));
  const kDoplneni = doplnit ? emaily.filter((e) => existujici.has(e)) : [];

  // Nové kontakty
  for (const kus of kusy(nove, 50)) {
    await env.DB.batch(kus.map((email) => {
      const r = platne.get(email);
      return env.DB.prepare(
        `INSERT INTO kontakty (email, jmeno, prijmeni, stav, zdroj, souhlas_cas, souhlas_poznamka,
                               odhlaseni_token, vytvoreno, upraveno)
         VALUES (?, ?, ?, 'prihlasen', 'import', ?, ?, ?, ?, ?)
         ON CONFLICT (email) DO NOTHING`,
      ).bind(email, r.jmeno, r.prijmeni, ted, souhlas, nahodnyToken(), ted, ted);
    }));
  }

  // Existující: doplní se jen prázdné jméno a štítky. Stav se nemění —
  // odhlášený zůstane odhlášený.
  for (const kus of kusy(kDoplneni, 50)) {
    await env.DB.batch(kus.map((email) => {
      const r = platne.get(email);
      return env.DB.prepare(
        `UPDATE kontakty SET
            jmeno    = CASE WHEN jmeno = ''    THEN ? ELSE jmeno END,
            prijmeni = CASE WHEN prijmeni = '' THEN ? ELSE prijmeni END,
            upraveno = ?
          WHERE email = ?`,
      ).bind(r.jmeno, r.prijmeni, ted, email);
    }));
  }

  // Štítky: společné všem + individuální z CSV. Seskupí se podle štítku,
  // aby se každý přiřadil jedním dotazem na kus e-mailů.
  const dotcene = [...nove, ...kDoplneni];
  const podleStitku = new Map();
  for (const stitekId of spolecneStitky) podleStitku.set(stitekId, new Set(dotcene));

  const nazvy = dotcene.flatMap((e) => platne.get(e).stitky);
  if (nazvy.length) {
    const idPodleNazvu = await stitkyPodleNazvu(env, nazvy);
    for (const email of dotcene) {
      for (const nazev of platne.get(email).stitky) {
        const stitekId = idPodleNazvu.get(nazev.trim().toLowerCase());
        if (!stitekId) continue;
        if (!podleStitku.has(stitekId)) podleStitku.set(stitekId, new Set());
        podleStitku.get(stitekId).add(email);
      }
    }
  }

  for (const [stitekId, mnozina] of podleStitku) {
    for (const kus of kusy([...mnozina], 80)) {
      await env.DB.prepare(
        `INSERT INTO kontakty_stitky (kontakt_id, stitek_id)
         SELECT k.id, s.id FROM kontakty k, stitky s
          WHERE s.id = ? AND k.email IN (${otazniky(kus.length)})
         ON CONFLICT DO NOTHING`,
      ).bind(stitekId, ...kus).run();
    }
  }

  const odhlaseniVSouboru = emaily.filter((e) => existujici.get(e)?.stav === 'odhlasen').length;
  return json({
    zalozeno: nove.length,
    doplneno: kDoplneni.length,
    preskoceno: emaily.length - nove.length - kDoplneni.length,
    odhlaseniVSouboru,
    duplicityVSouboru: data.radky.length - neplatne.length - emaily.length,
    neplatne,
  });
}

function csvBunka(hodnota) {
  const t = String(hodnota ?? '');
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

function datum(ms) {
  return ms ? new Date(ms).toISOString().slice(0, 19).replace('T', ' ') : '';
}

/* GET /api/kontakty/export — CSV se středníky a BOM, aby ho český Excel
   otevřel rovnou se správnou diakritikou. */
export async function exportovat(request, env) {
  await vyzadujUzivatele(request, env);
  const { kde, hodnoty } = filtr(new URL(request.url).searchParams);
  const { results } = await env.DB.prepare(
    `SELECT k.id, k.email, k.jmeno, k.prijmeni, k.stav, k.zdroj, k.vytvoreno, k.souhlas_cas, k.souhlas_poznamka,
            (SELECT GROUP_CONCAT(s.nazev, ', ') FROM kontakty_stitky ks JOIN stitky s ON s.id = ks.stitek_id
              WHERE ks.kontakt_id = k.id) AS stitky
       FROM kontakty k ${kde}
      ORDER BY k.email`,
  ).bind(...hodnoty).all();

  const hlavicka = ['e-mail', 'jméno', 'příjmení', 'stav', 'zdroj', 'štítky', 'přidáno', 'souhlas', 'poznámka k souhlasu'];
  const radky = results.map((k) => [
    k.email, k.jmeno, k.prijmeni, k.stav, k.zdroj, k.stitky || '', datum(k.vytvoreno), datum(k.souhlas_cas), k.souhlas_poznamka || '',
  ].map(csvBunka).join(';'));

  const csv = `\uFEFF${hlavicka.join(';')}\r\n${radky.join('\r\n')}\r\n`;
  const nazev = `kontakty-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nazev}"`,
      'Cache-Control': 'no-store',
    },
  });
}
