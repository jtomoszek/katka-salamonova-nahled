/* Rozesílky: přílohy, výběr příjemců podle štítků, náhled, zkušební
 * e-mail, odeslání a historie. */

import { Chyba, json, prectiJson, cislo } from '../lib/http.js';
import { nahodnyToken, arrayBufferNaBase64 } from '../lib/krypto.js';
import { text, seznamId, idZCesty } from '../lib/validace.js';
import { vyzadujUzivatele } from '../lib/prihlaseni.js';
import { odesliEmail, jePostaNastavena } from '../lib/posta.js';
import { emailKampane, volbyZProstredi, normalizujSekce } from '../lib/sablona.js';
import { zpracujFrontu, prepocitejKampan } from '../odesilani.js';
import { adresaWebu } from './newsletter.js';

const MAX_PRILOHA = 10 * 1024 * 1024;
const MAX_PRILOHY_CELKEM = 15 * 1024 * 1024;

/* Spustitelné a skriptové soubory poštovní servery stejně zahazují
   a v newsletteru nemají co dělat. */
const ZAKAZANE_PRIPONY = /\.(exe|bat|cmd|com|msi|scr|pif|js|jse|vbs|vbe|wsf|ps1|sh|jar|app|dmg|iso|lnk|reg|html?|svg)$/i;

function bezpecnyNazev(nazev) {
  const cisty = String(nazev || 'priloha')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 120);
  return cisty || 'priloha';
}

/* POST /api/prilohy — multipart/form-data s polem „soubor“. */
export async function nahratPrilohu(request, env) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const delka = Number(request.headers.get('Content-Length') || 0);
  if (delka > MAX_PRILOHA + 64 * 1024) throw new Chyba(413, 'Příloha může mít nejvýš 10 MB.');

  let form;
  try {
    form = await request.formData();
  } catch {
    throw new Chyba(400, 'Soubor se nepodařilo přečíst.');
  }
  const soubor = form.get('soubor');
  if (!soubor || typeof soubor === 'string') throw new Chyba(400, 'Chybí soubor.');
  if (soubor.size > MAX_PRILOHA) throw new Chyba(413, 'Příloha může mít nejvýš 10 MB.');
  if (soubor.size === 0) throw new Chyba(400, 'Soubor je prázdný.');

  const nazev = bezpecnyNazev(soubor.name);
  if (ZAKAZANE_PRIPONY.test(nazev)) throw new Chyba(400, 'Tento typ souboru nelze přiložit.');

  const typ = soubor.type || 'application/octet-stream';
  const klic = `prilohy/${nahodnyToken(16)}/${nazev}`;
  await env.PRILOHY.put(klic, soubor.stream(), { httpMetadata: { contentType: typ } });

  const vysledek = await env.DB.prepare(
    'INSERT INTO prilohy (r2_klic, nazev, typ, velikost, nahral, vytvoreno) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(klic, nazev, typ, soubor.size, uzivatel.id, Date.now()).run();

  return json({ id: vysledek.meta.last_row_id, nazev, velikost: soubor.size, typ }, { status: 201 });
}

/* DELETE /api/prilohy/:id — jen z rozepsaného e-mailu. Přílohy odeslaných
   rozesílek zůstávají v historii. */
export async function smazatPrilohu(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const priloha = await env.DB.prepare('SELECT r2_klic, kampan_id FROM prilohy WHERE id = ?').bind(idZCesty(id)).first();
  if (!priloha) throw new Chyba(404, 'Příloha nenalezena.');
  if (priloha.kampan_id) throw new Chyba(400, 'Přílohu odeslaného e-mailu nelze smazat.');
  await env.PRILOHY.delete(priloha.r2_klic);
  await env.DB.prepare('DELETE FROM prilohy WHERE id = ?').bind(idZCesty(id)).run();
  return json({ ok: true });
}

async function overPrilohy(env, ids) {
  if (!ids.length) return [];
  const { results } = await env.DB.prepare(
    `SELECT id, r2_klic, nazev, velikost, kampan_id FROM prilohy WHERE id IN (${ids.map(() => '?').join(',')})`,
  ).bind(...ids).all();
  if (results.length !== ids.length) throw new Chyba(400, 'Některá příloha už neexistuje. Nahrajte ji prosím znovu.');
  if (results.some((p) => p.kampan_id)) throw new Chyba(400, 'Příloha už patří k jinému odeslanému e-mailu.');
  const celkem = results.reduce((s, p) => s + p.velikost, 0);
  if (celkem > MAX_PRILOHY_CELKEM) throw new Chyba(400, 'Přílohy dohromady mohou mít nejvýš 15 MB.');
  return results;
}

/* SQL podmínka pro výběr příjemců. Hodnoty jsou ověřená celá čísla,
   přesto jdou přes parametry. */
function vyberPrijemcu(vyber, stitkyIds) {
  if (vyber === 'vsem') return { kde: "k.stav = 'prihlasen'", hodnoty: [] };
  if (!stitkyIds.length) throw new Chyba(400, 'Vyberte aspoň jeden štítek.');
  const znaky = stitkyIds.map(() => '?').join(',');
  if (vyber === 'kterykoli') {
    return {
      kde: `k.stav = 'prihlasen' AND EXISTS (SELECT 1 FROM kontakty_stitky ks WHERE ks.kontakt_id = k.id AND ks.stitek_id IN (${znaky}))`,
      hodnoty: stitkyIds,
    };
  }
  if (vyber === 'vsechny') {
    return {
      kde: `k.stav = 'prihlasen' AND (SELECT COUNT(*) FROM kontakty_stitky ks WHERE ks.kontakt_id = k.id AND ks.stitek_id IN (${znaky})) = ?`,
      hodnoty: [...stitkyIds, stitkyIds.length],
    };
  }
  throw new Chyba(400, 'Neplatný výběr příjemců.');
}

function vstupVyberu(data) {
  const vyber = data.vyber || 'vsem';
  const stitkyIds = vyber === 'vsem' ? [] : seznamId(data.stitky, { max: 50, nazev: 'Štítky' });
  return { vyber, stitkyIds };
}

/* POST /api/kampane/pocet — kolik lidí e-mail dostane. */
export async function pocetPrijemcu(request, env) {
  await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 10_000);
  const { vyber, stitkyIds } = vstupVyberu(data);
  const { kde, hodnoty } = vyberPrijemcu(vyber, stitkyIds);
  const r = await env.DB.prepare(`SELECT COUNT(*) AS n FROM kontakty k WHERE ${kde}`).bind(...hodnoty).first();
  return json({ pocet: r.n });
}

function obsahZVstupu(data) {
  return {
    predmet: text(data.predmet, { max: 200, povinny: true, nazev: 'Předmět' }),
    text: text(data.text, { max: 50_000, povinny: true, nazev: 'Text e-mailu' }),
    sekce: normalizujSekce(data.sekce),
  };
}

/* POST /api/kampane/nahled — HTML pro náhled v administraci. */
export async function nahled(request, env) {
  await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 200_000);
  const predmet = String(data.predmet || '(bez předmětu)').slice(0, 200);
  const obsah = emailKampane({
    predmet,
    text: String(data.text || '').slice(0, 50_000) || ' ',
    jmeno: 'Jana',
    sekce: normalizujSekce(data.sekce),
    datum: Number.isFinite(data.datum) ? data.datum : Date.now(),
    ...volbyZProstredi(env, adresaWebu(env, request)),
    odkazOdhlaseni: `${adresaWebu(env, request)}/api/newsletter/odhlasit?t=nahled`,
    odkazVProhlizeci: `${adresaWebu(env, request)}/`,
  });
  return json({ html: obsah.html });
}

/* POST /api/kampane/test — zkušební e-mail přihlášenému uživateli. */
export async function zkusebni(request, env) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 200_000);
  const { predmet, text: telo, sekce } = obsahZVstupu(data);
  const prilohyIds = seznamId(data.prilohy, { max: 10, nazev: 'Přílohy' });
  if (!jePostaNastavena(env)) throw new Chyba(503, 'Odesílání pošty není nastavené.');

  const prilohy = await overPrilohy(env, prilohyIds);
  const zaklad = adresaWebu(env, request);
  const obsah = emailKampane({
    predmet,
    text: telo,
    jmeno: uzivatel.jmeno.split(' ')[0] || '',
    sekce,
    ...volbyZProstredi(env, zaklad),
    odkazOdhlaseni: `${zaklad}/api/newsletter/odhlasit?t=zkusebni`,
  });

  const nactene = [];
  for (const p of prilohy) {
    const soubor = await env.PRILOHY.get(p.r2_klic);
    if (!soubor) throw new Chyba(400, `Příloha ${p.nazev} v úložišti chybí.`);
    nactene.push({ nazev: p.nazev, obsahBase64: arrayBufferNaBase64(await soubor.arrayBuffer()) });
  }

  try {
    await odesliEmail(env, {
      komu: uzivatel.email,
      predmet: `[ZKOUŠKA] ${predmet}`,
      html: obsah.html,
      text: obsah.text,
      prilohy: nactene,
    });
  } catch (err) {
    throw new Chyba(502, `Zkušební e-mail se nepodařilo odeslat: ${err.message}`);
  }
  return json({ ok: true, komu: uzivatel.email });
}

/* POST /api/kampane — odeslání. Příjemci se zapíšou do fronty jedním
   příkazem (snímek v tu chvíli přihlášených), první dávka odejde hned. */
export async function odeslat(request, env, _params, ctx) {
  const uzivatel = await vyzadujUzivatele(request, env);
  const data = await prectiJson(request, 200_000);
  const { predmet, text: telo, sekce } = obsahZVstupu(data);
  const { vyber, stitkyIds } = vstupVyberu(data);
  const prilohyIds = seznamId(data.prilohy, { max: 10, nazev: 'Přílohy' });

  if (!jePostaNastavena(env)) throw new Chyba(503, 'Odesílání pošty není nastavené.');
  if (!env.WEB_URL) throw new Chyba(503, 'Chybí WEB_URL — bez ní nejdou sestavit odkazy na odhlášení.');
  await overPrilohy(env, prilohyIds);

  const { kde, hodnoty } = vyberPrijemcu(vyber, stitkyIds);
  const pocet = await env.DB.prepare(`SELECT COUNT(*) AS n FROM kontakty k WHERE ${kde}`).bind(...hodnoty).first();
  if (!pocet.n) throw new Chyba(400, 'Výběru neodpovídá žádný přihlášený kontakt.');

  // Pojistka proti dvojímu kliknutí: klient posílá, kolik příjemců viděl.
  if (data.ocekavanyPocet !== undefined && Number(data.ocekavanyPocet) !== pocet.n) {
    throw new Chyba(409, `Počet příjemců se mezitím změnil na ${pocet.n}. Zkontrolujte ho prosím a odešlete znovu.`);
  }

  const ted = Date.now();
  const kampan = await env.DB.prepare(
    `INSERT INTO kampane (predmet, text, sekce, verejny_token, stitky, vyber_stitku, stav, vytvoril, vytvoreno)
     VALUES (?, ?, ?, ?, ?, ?, 'odesila_se', ?, ?)`,
  ).bind(predmet, telo, JSON.stringify(sekce), nahodnyToken(16), JSON.stringify(stitkyIds), vyber, uzivatel.id, ted).run();
  const kampanId = kampan.meta.last_row_id;

  const prikazy = [
    env.DB.prepare(
      `INSERT INTO prijemci (kampan_id, kontakt_id, email, stav)
       SELECT ?, k.id, k.email, 've_fronte' FROM kontakty k WHERE ${kde}
       ON CONFLICT DO NOTHING`,
    ).bind(kampanId, ...hodnoty),
    env.DB.prepare(
      "UPDATE kampane SET prijemcu = (SELECT COUNT(*) FROM prijemci WHERE kampan_id = ?1) WHERE id = ?1",
    ).bind(kampanId),
  ];
  if (prilohyIds.length) {
    prikazy.push(env.DB.prepare(
      `UPDATE prilohy SET kampan_id = ? WHERE kampan_id IS NULL AND id IN (${prilohyIds.map(() => '?').join(',')})`,
    ).bind(kampanId, ...prilohyIds));
  }
  await env.DB.batch(prikazy);

  if (ctx) ctx.waitUntil(zpracujFrontu(env).catch((err) => console.error('Fronta:', err)));

  const ulozena = await env.DB.prepare('SELECT prijemcu FROM kampane WHERE id = ?').bind(kampanId).first();
  return json({ id: kampanId, prijemcu: ulozena.prijemcu }, { status: 201 });
}

/* GET /api/kampane */
export async function seznam(request, env) {
  await vyzadujUzivatele(request, env);
  const params = new URL(request.url).searchParams;
  const naStranku = cislo(params.get('naStranku'), { min: 5, max: 100, vychozi: 25 });
  const stranka = cislo(params.get('stranka'), { min: 1, vychozi: 1 });
  const [celkem, polozky] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM kampane').first(),
    env.DB.prepare(
      `SELECT c.id, c.predmet, c.stav, c.prijemcu, c.odeslano, c.selhalo, c.vytvoreno, c.dokonceno,
              u.jmeno AS autor_jmeno, u.email AS autor_email,
              (SELECT COUNT(*) FROM prilohy p WHERE p.kampan_id = c.id) AS priloh
         FROM kampane c LEFT JOIN uzivatele u ON u.id = c.vytvoril
        ORDER BY c.vytvoreno DESC LIMIT ? OFFSET ?`,
    ).bind(naStranku, (stranka - 1) * naStranku).all(),
  ]);
  return json({ polozky: polozky.results, celkem: celkem.n, stranka, naStranku });
}

/* GET /api/kampane/:id */
export async function detail(request, env, { id }) {
  await vyzadujUzivatele(request, env);
  const kampanId = idZCesty(id);
  const params = new URL(request.url).searchParams;

  const kampan = await env.DB.prepare(
    `SELECT c.*, u.jmeno AS autor_jmeno, u.email AS autor_email
       FROM kampane c LEFT JOIN uzivatele u ON u.id = c.vytvoril WHERE c.id = ?`,
  ).bind(kampanId).first();
  if (!kampan) throw new Chyba(404, 'Rozesílka nenalezena.');

  const stav = params.get('stav');
  const filtrStavu = ['ve_fronte', 'odesila_se', 'odeslano', 'selhalo', 'preskoceno'].includes(stav);
  const naStranku = 50;
  const stranka = cislo(params.get('stranka'), { min: 1, vychozi: 1 });

  const stitkyIds = JSON.parse(kampan.stitky || '[]');
  const [pocty, prijemci, prilohy, stitky] = await Promise.all([
    env.DB.prepare('SELECT stav, COUNT(*) AS n FROM prijemci WHERE kampan_id = ? GROUP BY stav').bind(kampanId).all(),
    env.DB.prepare(
      `SELECT id, email, stav, chyba, odeslano, pokusu FROM prijemci
        WHERE kampan_id = ? ${filtrStavu ? 'AND stav = ?' : ''}
        ORDER BY CASE stav WHEN 'selhalo' THEN 0 ELSE 1 END, id LIMIT ? OFFSET ?`,
    ).bind(...(filtrStavu ? [kampanId, stav] : [kampanId]), naStranku, (stranka - 1) * naStranku).all(),
    env.DB.prepare('SELECT id, nazev, velikost FROM prilohy WHERE kampan_id = ? ORDER BY id').bind(kampanId).all(),
    stitkyIds.length
      ? env.DB.prepare(`SELECT id, nazev, barva FROM stitky WHERE id IN (${stitkyIds.map(() => '?').join(',')})`)
        .bind(...stitkyIds).all()
      : Promise.resolve({ results: [] }),
  ]);

  return json({
    ...kampan,
    sekce: normalizujSekce(kampan.sekce),
    stitky: stitky.results,
    pocty: Object.fromEntries(pocty.results.map((r) => [r.stav, r.n])),
    prilohy: prilohy.results,
    prijemci: prijemci.results,
    stranka,
    naStranku,
  });
}

/* POST /api/kampane/:id/znovu — neúspěšné pokusy vrátí do fronty. */
export async function zkusitZnovu(request, env, { id }, ctx) {
  await vyzadujUzivatele(request, env);
  const kampanId = idZCesty(id);
  const vysledek = await env.DB.prepare(
    "UPDATE prijemci SET stav = 've_fronte', pokusu = 0, chyba = NULL WHERE kampan_id = ? AND stav = 'selhalo'",
  ).bind(kampanId).run();
  await prepocitejKampan(env, kampanId);
  if (ctx && vysledek.meta.changes) ctx.waitUntil(zpracujFrontu(env).catch((err) => console.error('Fronta:', err)));
  return json({ vraceno: vysledek.meta.changes });
}
