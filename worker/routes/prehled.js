/* Úvodní přehled administrace. */

import { json } from '../lib/http.js';
import { vyzadujUzivatele } from '../lib/prihlaseni.js';
import { jePostaNastavena } from '../lib/posta.js';

const DEN = 24 * 60 * 60 * 1000;

export async function prehled(request, env) {
  await vyzadujUzivatele(request, env);
  const ted = Date.now();
  const pred30 = ted - 30 * DEN;

  const [kontakty, rozesilky, nedavne, fronta, prihlaseniPoDnech] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS celkem,
              COUNT(CASE WHEN stav = 'prihlasen' THEN 1 END) AS prihlaseno,
              COUNT(CASE WHEN stav = 'cekajici'  THEN 1 END) AS ceka,
              COUNT(CASE WHEN stav = 'odhlasen'  THEN 1 END) AS odhlaseno,
              COUNT(CASE WHEN stav = 'prihlasen' AND vytvoreno >= ?1 THEN 1 END) AS novych30,
              COUNT(CASE WHEN odhlaseno >= ?1 THEN 1 END) AS odhlaseno30
         FROM kontakty`,
    ).bind(pred30).first(),

    env.DB.prepare(
      `SELECT (SELECT COUNT(*) FROM kampane) AS kampani,
              (SELECT COUNT(*) FROM prijemci WHERE stav = 'odeslano') AS emailu,
              (SELECT COUNT(*) FROM prijemci WHERE stav = 'odeslano' AND odeslano >= ?1) AS emailu30,
              (SELECT COUNT(*) FROM prijemci WHERE stav = 'selhalo'  AND zabrano  >= ?1) AS selhalo30`,
    ).bind(pred30).first(),

    env.DB.prepare(
      `SELECT id, predmet, stav, prijemcu, odeslano, selhalo, vytvoreno
         FROM kampane ORDER BY vytvoreno DESC LIMIT 6`,
    ).all(),

    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM prijemci WHERE stav IN ('ve_fronte', 'odesila_se')",
    ).first(),

    // Noví potvrzení odběratelé za posledních 30 dní, po dnech (UTC).
    env.DB.prepare(
      `SELECT CAST((COALESCE(souhlas_cas, vytvoreno) / ?2) AS INTEGER) AS den, COUNT(*) AS n
         FROM kontakty
        WHERE stav = 'prihlasen' AND COALESCE(souhlas_cas, vytvoreno) >= ?1
        GROUP BY den ORDER BY den`,
    ).bind(pred30, DEN).all(),
  ]);

  const podleDne = new Map(prihlaseniPoDnech.results.map((r) => [r.den, r.n]));
  const dnes = Math.floor(ted / DEN);
  const graf = [];
  for (let d = dnes - 29; d <= dnes; d++) graf.push({ den: d * DEN, pocet: podleDne.get(d) || 0 });

  return json({
    kontakty,
    rozesilky,
    nedavne: nedavne.results,
    veFronte: fronta.n,
    prihlaseniPoDnech: graf,
    postaNastavena: jePostaNastavena(env),
    rezimPosty: env.POSTA || 'resend',
  });
}
