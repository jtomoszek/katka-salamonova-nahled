/* Zpracování fronty rozesílek.
 *
 * Při odeslání se příjemci jen zapíšou do tabulky prijemci (stav ve_fronte).
 * Samotné odesílání běží tady — spouští ho cron každou minutu a hned po
 * založení rozesílky i požadavek sám (přes ctx.waitUntil), aby první dávka
 * odešla okamžitě.
 *
 * Proč po dávkách: jedno spuštění Workeru smí udělat omezený počet
 * odchozích požadavků (50 na tarifu Free, 1000 na Paid) a Resend ve
 * výchozím nastavení přijme 2 požadavky za sekundu. S výchozími hodnotami
 * DAVKA=40 a RYCHLOST=2 odejde asi 40 e-mailů za minutu (≈ 2 400 za hodinu).
 *
 * Každý příjemce se nejdřív atomicky „zabere“ (UPDATE … RETURNING), takže
 * cron a požadavek, které běží současně, stejnou adresu neodešlou dvakrát. */

import { odesliEmail, ChybaPosty } from './lib/posta.js';
import { emailKampane, volbyZProstredi } from './lib/sablona.js';
import { arrayBufferNaBase64 } from './lib/krypto.js';

const MAX_POKUSU = 3;
const UVIZLE_PO = 10 * 60 * 1000;

export function webUrl(env) {
  return (env.WEB_URL || '').replace(/\/+$/, '');
}

export function odkazOdhlaseni(zaklad, token) {
  return `${zaklad}/api/newsletter/odhlasit?t=${encodeURIComponent(token)}`;
}

export function odkazVProhlizeci(zaklad, token) {
  return `${zaklad}/api/newsletter/vydani?t=${encodeURIComponent(token)}`;
}

export function hlavickyOdhlaseni(zaklad, token) {
  // Gmail a Yahoo u hromadné pošty vyžadují odhlášení jedním klikem (RFC 8058).
  return {
    'List-Unsubscribe': `<${zaklad}/api/newsletter/odhlasit-jednim-klikem?t=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}

export async function nactiPrilohy(env, kampanId) {
  if (!env.PRILOHY) return [];
  const { results } = await env.DB.prepare(
    'SELECT r2_klic, nazev FROM prilohy WHERE kampan_id = ? ORDER BY id',
  ).bind(kampanId).all();
  const prilohy = [];
  for (const p of results) {
    const objekt = await env.PRILOHY.get(p.r2_klic);
    if (!objekt) throw new Error(`Příloha ${p.nazev} v úložišti chybí.`);
    prilohy.push({ nazev: p.nazev, obsahBase64: arrayBufferNaBase64(await objekt.arrayBuffer()) });
  }
  return prilohy;
}

const pockej = (ms) => new Promise((hotovo) => setTimeout(hotovo, ms));

export async function zpracujFrontu(env, { limit } = {}) {
  const davka = limit ?? Math.max(1, Number(env.DAVKA) || 40);
  const rychlost = Math.max(0.1, Number(env.RYCHLOST) || 2);
  const zaklad = webUrl(env);
  const ted = Date.now();

  if (!zaklad) {
    console.error('Fronta stojí: chybí WEB_URL, bez ní nejdou sestavit odkazy na odhlášení.');
    return { odeslano: 0 };
  }

  // Příjemci zabraní dřív, než spadlo předchozí spuštění, se vrátí do fronty.
  await env.DB.prepare(
    "UPDATE prijemci SET stav = 've_fronte' WHERE stav = 'odesila_se' AND zabrano < ?",
  ).bind(ted - UVIZLE_PO).run();

  const { results: zabrani } = await env.DB.prepare(
    `UPDATE prijemci SET stav = 'odesila_se', zabrano = ?1, pokusu = pokusu + 1
      WHERE id IN (SELECT id FROM prijemci WHERE stav = 've_fronte' ORDER BY id LIMIT ?2)
      RETURNING id, kampan_id, kontakt_id, email, pokusu`,
  ).bind(ted, davka).all();

  if (!zabrani.length) return { odeslano: 0 };

  const kampane = new Map();
  const dotceneKampane = new Set();
  let odeslano = 0;
  const prodleva = env.POSTA === 'log' ? 0 : Math.ceil(1000 / rychlost);

  for (const prijemce of zabrani) {
    dotceneKampane.add(prijemce.kampan_id);

    // Mezi zařazením do fronty a odesláním se mohl odhlásit nebo být smazán.
    const kontakt = prijemce.kontakt_id
      ? await env.DB.prepare('SELECT jmeno, stav, odhlaseni_token FROM kontakty WHERE id = ?')
        .bind(prijemce.kontakt_id).first()
      : null;
    if (!kontakt || kontakt.stav !== 'prihlasen') {
      await env.DB.prepare("UPDATE prijemci SET stav = 'preskoceno', chyba = ? WHERE id = ?")
        .bind(kontakt ? 'Kontakt se mezitím odhlásil.' : 'Kontakt byl mezitím smazán.', prijemce.id).run();
      continue;
    }

    let kampan = kampane.get(prijemce.kampan_id);
    try {
      if (!kampan) {
        const zaznam = await env.DB.prepare('SELECT id, predmet, text, sekce, verejny_token, vytvoreno FROM kampane WHERE id = ?')
          .bind(prijemce.kampan_id).first();
        kampan = { ...zaznam, prilohy: await nactiPrilohy(env, prijemce.kampan_id) };
        kampane.set(prijemce.kampan_id, kampan);
      }

      const obsah = emailKampane({
        predmet: kampan.predmet,
        text: kampan.text,
        jmeno: kontakt.jmeno,
        sekce: kampan.sekce,
        datum: kampan.vytvoreno,
        ...volbyZProstredi(env, zaklad),
        odkazOdhlaseni: odkazOdhlaseni(zaklad, kontakt.odhlaseni_token),
        odkazVProhlizeci: kampan.verejny_token ? odkazVProhlizeci(zaklad, kampan.verejny_token) : undefined,
      });

      const { id } = await odesliEmail(env, {
        komu: prijemce.email,
        predmet: kampan.predmet,
        html: obsah.html,
        text: obsah.text,
        hlavicky: hlavickyOdhlaseni(zaklad, kontakt.odhlaseni_token),
        prilohy: kampan.prilohy,
        klicIdempotence: `kampan-${prijemce.kampan_id}-prijemce-${prijemce.id}`,
      });

      await env.DB.prepare("UPDATE prijemci SET stav = 'odeslano', id_zpravy = ?, chyba = NULL, odeslano = ? WHERE id = ?")
        .bind(id, Date.now(), prijemce.id).run();
      odeslano++;
    } catch (err) {
      const docasna = err instanceof ChybaPosty ? err.docasna : true;
      const znovu = docasna && prijemce.pokusu < MAX_POKUSU;
      await env.DB.prepare('UPDATE prijemci SET stav = ?, chyba = ? WHERE id = ?')
        .bind(znovu ? 've_fronte' : 'selhalo', String(err.message).slice(0, 500), prijemce.id).run();
      console.error(`Odeslání na ${prijemce.email} selhalo${znovu ? ' (zkusí se znovu)' : ''}:`, err.message);
    }

    if (prodleva) await pockej(prodleva);
  }

  for (const kampanId of dotceneKampane) await prepocitejKampan(env, kampanId);
  return { odeslano };
}

export async function prepocitejKampan(env, kampanId) {
  const { results } = await env.DB.prepare(
    'SELECT stav, COUNT(*) AS n FROM prijemci WHERE kampan_id = ? GROUP BY stav',
  ).bind(kampanId).all();
  const pocty = Object.fromEntries(results.map((r) => [r.stav, r.n]));
  const zbyva = (pocty.ve_fronte || 0) + (pocty.odesila_se || 0);
  const odeslano = pocty.odeslano || 0;
  const selhalo = pocty.selhalo || 0;

  let stav = 'odesila_se';
  if (!zbyva) stav = odeslano === 0 && selhalo > 0 ? 'selhalo' : 'odeslano';

  await env.DB.prepare(
    `UPDATE kampane SET odeslano = ?, selhalo = ?, stav = ?,
            dokonceno = CASE WHEN ? = 'odesila_se' THEN NULL ELSE COALESCE(dokonceno, ?) END
      WHERE id = ?`,
  ).bind(odeslano, selhalo, stav, stav, Date.now(), kampanId).run();
}

/* Úklid: prošlé relace, stará počítadla pokusů a přílohy, které zůstaly
   viset v nikdy neodeslaném konceptu. */
export async function uklid(env) {
  const ted = Date.now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM relace WHERE platnost < ?').bind(ted),
    env.DB.prepare('DELETE FROM omezeni WHERE zacatek_okna < ?').bind(ted - 24 * 60 * 60 * 1000),
  ]);

  if (!env.PRILOHY) return;
  const { results } = await env.DB.prepare(
    'SELECT id, r2_klic FROM prilohy WHERE kampan_id IS NULL AND vytvoreno < ? LIMIT 50',
  ).bind(ted - 7 * 24 * 60 * 60 * 1000).all();
  for (const p of results) {
    await env.PRILOHY.delete(p.r2_klic);
    await env.DB.prepare('DELETE FROM prilohy WHERE id = ?').bind(p.id).run();
  }
}
