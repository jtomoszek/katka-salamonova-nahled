/* Vstupní bod Workeru.
 *
 * Statický web ze složky site/ servíruje Cloudflare rovnou (assets). Worker
 * se spouští jen pro /api/* a /admin (viz run_worker_first ve wrangler.jsonc):
 * API obsluhuje sám, administraci vrátí ze statických souborů, ale přidá jí
 * přísné bezpečnostní hlavičky. */

import { Chyba, chybovaOdpoved, hlavickyAdministrace } from './lib/http.js';
import { zpracujFrontu, uklid } from './odesilani.js';

import * as newsletter from './routes/newsletter.js';
import * as ucet from './routes/ucet.js';
import * as uzivatele from './routes/uzivatele.js';
import * as stitky from './routes/stitky.js';
import * as kontakty from './routes/kontakty.js';
import * as kampane from './routes/kampane.js';
import { prehled } from './routes/prehled.js';

/* [metoda, vzor cesty, obsluha]. :id zachytí jeden úsek cesty. */
const TRASY = [
  ['POST',   '/api/newsletter/prihlasit',              newsletter.prihlasitOdber],
  ['GET',    '/api/newsletter/potvrdit',               newsletter.potvrditOdberStranka],
  ['POST',   '/api/newsletter/potvrdit',               newsletter.potvrditOdber],
  ['GET',    '/api/newsletter/odhlasit',               newsletter.odhlasitStranka],
  ['POST',   '/api/newsletter/odhlasit',               newsletter.odhlasit],
  ['POST',   '/api/newsletter/odhlasit-jednim-klikem', newsletter.odhlasitJednimKlikem],
  ['GET',    '/api/newsletter/vydani',                 newsletter.vydani],

  ['GET',    '/api/ucet/stav',       ucet.stav],
  ['POST',   '/api/ucet/nastaveni',  ucet.nastaveni],
  ['POST',   '/api/ucet/prihlasit',  ucet.prihlasit],
  ['POST',   '/api/ucet/odhlasit',   ucet.odhlasit],
  ['POST',   '/api/ucet/heslo',      ucet.zmenitHeslo],
  ['GET',    '/api/ucet/pozvanka',   ucet.nactiPozvanku],
  ['POST',   '/api/ucet/pozvanka',   ucet.prijmoutPozvanku],

  ['GET',    '/api/prehled', prehled],

  ['GET',    '/api/uzivatele',              uzivatele.seznam],
  ['POST',   '/api/uzivatele',              uzivatele.zalozit],
  ['PATCH',  '/api/uzivatele/:id',          uzivatele.upravit],
  ['DELETE', '/api/uzivatele/:id',          uzivatele.smazat],
  ['POST',   '/api/uzivatele/:id/pozvanka', uzivatele.novaPozvanka],

  ['GET',    '/api/stitky',     stitky.seznam],
  ['POST',   '/api/stitky',     stitky.zalozit],
  ['PATCH',  '/api/stitky/:id', stitky.upravit],
  ['DELETE', '/api/stitky/:id', stitky.smazat],

  ['GET',    '/api/kontakty',           kontakty.seznam],
  ['POST',   '/api/kontakty',           kontakty.zalozit],
  ['GET',    '/api/kontakty/export',    kontakty.exportovat],
  ['POST',   '/api/kontakty/import',    kontakty.importovat],
  ['POST',   '/api/kontakty/hromadne',  kontakty.hromadne],
  ['GET',    '/api/kontakty/:id',       kontakty.detail],
  ['PATCH',  '/api/kontakty/:id',       kontakty.upravit],
  ['DELETE', '/api/kontakty/:id',       kontakty.smazat],

  ['POST',   '/api/prilohy',     kampane.nahratPrilohu],
  ['DELETE', '/api/prilohy/:id', kampane.smazatPrilohu],

  ['GET',    '/api/kampane',           kampane.seznam],
  ['POST',   '/api/kampane',           kampane.odeslat],
  ['POST',   '/api/kampane/pocet',     kampane.pocetPrijemcu],
  ['POST',   '/api/kampane/nahled',    kampane.nahled],
  ['POST',   '/api/kampane/test',      kampane.zkusebni],
  ['GET',    '/api/kampane/:id',       kampane.detail],
  ['POST',   '/api/kampane/:id/znovu', kampane.zkusitZnovu],
].map(([metoda, vzor, obsluha]) => {
  const casti = vzor.split('/');
  return { metoda, casti, obsluha };
});

function najdiTrasu(metoda, cesta) {
  const casti = cesta.replace(/\/+$/, '').split('/');
  let cestaExistuje = false;
  for (const trasa of TRASY) {
    if (trasa.casti.length !== casti.length) continue;
    const params = {};
    const shoda = trasa.casti.every((cast, i) => {
      if (cast.startsWith(':')) {
        params[cast.slice(1)] = decodeURIComponent(casti[i]);
        return casti[i] !== '';
      }
      return cast === casti[i];
    });
    if (!shoda) continue;
    cestaExistuje = true;
    if (trasa.metoda === metoda) return { trasa, params };
  }
  return { cestaExistuje };
}

async function obsluzApi(request, env, ctx, cesta) {
  const nalez = najdiTrasu(request.method, cesta);
  if (!nalez.trasa) {
    throw new Chyba(nalez.cestaExistuje ? 405 : 404, nalez.cestaExistuje ? 'Metoda není povolená.' : 'Nenalezeno.');
  }
  return nalez.trasa.obsluha(request, env, nalez.params, ctx);
}

async function obsluzAdministraci(request, env, cesta) {
  // /admin i /admin/ vede na aplikaci; ostatní soubory (admin.js, admin.css) z assets.
  const url = new URL(request.url);
  if (cesta === '/admin') {
    url.pathname = '/admin/';
    return Response.redirect(url.toString(), 301);
  }
  const odpoved = await env.ASSETS.fetch(request);
  const headers = hlavickyAdministrace(new Headers(odpoved.headers));
  return new Response(odpoved.body, { status: odpoved.status, statusText: odpoved.statusText, headers });
}

export default {
  async fetch(request, env, ctx) {
    const cesta = new URL(request.url).pathname;
    try {
      if (cesta.startsWith('/api/')) return await obsluzApi(request, env, ctx, cesta);
      if (cesta === '/admin' || cesta.startsWith('/admin/')) return await obsluzAdministraci(request, env, cesta);
      return env.ASSETS.fetch(request);
    } catch (err) {
      return chybovaOdpoved(err);
    }
  },

  /* Cron (každou minutu): odešle další dávku z fronty. Jednou za hodinu
     k tomu uklidí prošlé relace a opuštěné přílohy. */
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        await zpracujFrontu(env);
        if (new Date(controller.scheduledTime).getUTCMinutes() === 0) await uklid(env);
      } catch (err) {
        console.error('Plánovaná úloha selhala:', err);
      }
    })());
  },
};
