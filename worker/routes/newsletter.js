/* Veřejná část newsletteru: přihlášení z webu, potvrzení (double opt-in)
 * a odhlášení. */

import { Chyba, json, prectiJson, ipKlienta } from '../lib/http.js';
import { nahodnyToken, sha256 } from '../lib/krypto.js';
import { vyzadujEmail, text, povolPokus } from '../lib/validace.js';
import { odesliEmail, jePostaNastavena } from '../lib/posta.js';
import { emailPotvrzeniOdberu, emailKampane, volbyZProstredi } from '../lib/sablona.js';
import { stranka, formularTlacitka } from '../lib/stranky.js';

const PLATNOST_POTVRZENI = 7 * 24 * 60 * 60 * 1000;
const STITEK_WEB = 'Web';

export function adresaWebu(env, request) {
  return (env.WEB_URL || new URL(request.url).origin).replace(/\/+$/, '');
}

/* POST /api/newsletter/prihlasit
 * Odpověď je pro existující i novou adresu stejná, aby se formulářem nedalo
 * zjišťovat, kdo odběr má.
 *
 * Normálně posílá js/newsletter.js JSON. Kdyby se skript nenačetl, odešle
 * formulář prohlížeč sám (POST, form-urlencoded) — pak se místo JSON vrátí
 * rovnou stránka. Formulář má method="post", aby e-mail neskončil v adrese. */
export async function prihlasitOdber(request, env) {
  const typ = request.headers.get('Content-Type') || '';
  const zFormulare = typ.includes('application/x-www-form-urlencoded') || typ.includes('multipart/form-data');

  if (!zFormulare) {
    await zpracujPrihlaseni(request, env, await prectiJson(request, 10_000));
    return json({ ok: true });
  }

  try {
    const form = await request.formData();
    await zpracujPrihlaseni(request, env, {
      email: form.get('email'),
      jmeno: form.get('jmeno'),
      souhlas: form.get('souhlas') === 'on',
      web: form.get('web'),
    });
  } catch (err) {
    if (!(err instanceof Chyba)) throw err;
    return stranka({
      titulek: 'Přihlášení k odběru',
      nadpis: 'Přihlášení se nepovedlo',
      text: err.message,
      formular: '<a class="odkaz" href="/#novinky">Zpět na formulář</a>',
      status: err.status,
    });
  }
  return stranka({
    titulek: 'Zkontrolujte e-mail',
    nadpis: 'Ještě potvrdit v e-mailu',
    text: 'Do schránky vám právě odešel e-mail s odkazem — odběr potvrdíte jedním kliknutím. Kdyby nedorazil, mrkněte do spamu.',
  });
}

async function zpracujPrihlaseni(request, env, data) {
  // Honeypot: skryté pole, které člověk nevyplní. Robotovi tvrdíme, že prošel.
  if (data.web) return;

  const email = vyzadujEmail(data.email);
  const jmeno = text(data.jmeno, { max: 80, nazev: 'Jméno' });
  if (data.souhlas !== true) {
    throw new Chyba(400, 'Pro přihlášení je potřeba souhlas se zasíláním novinek.');
  }

  const ip = ipKlienta(request);
  const [ipOk, emailOk] = await Promise.all([
    povolPokus(env, `odber:ip:${ip}`, 8, 15 * 60 * 1000),
    povolPokus(env, `odber:email:${email}`, 3, 60 * 60 * 1000),
  ]);
  if (!ipOk || !emailOk) {
    throw new Chyba(429, 'Příliš mnoho pokusů. Zkuste to prosím za chvíli.');
  }

  if (!jePostaNastavena(env)) {
    console.error('Přihlášení k odběru: odesílání pošty není nastavené.');
    throw new Chyba(503, 'Přihlášení teď nefunguje. Zkuste to prosím později.');
  }

  const stavajici = await env.DB.prepare('SELECT id, stav FROM kontakty WHERE email = ?').bind(email).first();
  if (stavajici && stavajici.stav === 'prihlasen') return;

  const token = nahodnyToken();
  const tokenHash = await sha256(token);
  const ted = Date.now();

  if (stavajici) {
    // Čekající nebo dřív odhlášený — pošleme nové potvrzení. Znovu přihlášen
    // bude až po kliknutí, takže odhlášeného nikdo nepřihlásí za něj.
    await env.DB.prepare(
      `UPDATE kontakty SET potvrzeni_hash = ?, potvrzeni_platnost = ?,
              jmeno = CASE WHEN jmeno = '' THEN ? ELSE jmeno END, upraveno = ?
        WHERE id = ?`,
    ).bind(tokenHash, ted + PLATNOST_POTVRZENI, jmeno, ted, stavajici.id).run();
  } else {
    await env.DB.prepare(
      `INSERT INTO kontakty (email, jmeno, stav, zdroj, potvrzeni_hash, potvrzeni_platnost,
                             odhlaseni_token, vytvoreno, upraveno)
       VALUES (?, ?, 'cekajici', 'web', ?, ?, ?, ?, ?)`,
    ).bind(email, jmeno, tokenHash, ted + PLATNOST_POTVRZENI, nahodnyToken(), ted, ted).run();
  }

  const odkaz = `${adresaWebu(env, request)}/api/newsletter/potvrdit?t=${encodeURIComponent(token)}`;
  const zprava = emailPotvrzeniOdberu({ odkaz });
  try {
    await odesliEmail(env, { komu: email, predmet: zprava.predmet, html: zprava.html, text: zprava.text });
  } catch (err) {
    console.error('Potvrzovací e-mail se nepodařilo odeslat:', err.message);
    throw new Chyba(502, 'Potvrzovací e-mail se nepodařilo odeslat. Zkuste to prosím později.');
  }
}

async function tokenZFormulare(request) {
  const typ = request.headers.get('Content-Type') || '';
  if (!typ.includes('application/x-www-form-urlencoded')) return '';
  const form = await request.formData();
  return String(form.get('t') || '');
}

/* GET — jen stránka s tlačítkem, nic se nemění (viz lib/stranky.js). */
export function potvrditOdberStranka(request) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!token) return neplatnyOdkaz();
  return stranka({
    titulek: 'Potvrzení odběru',
    nadpis: 'Ještě jedno kliknutí',
    text: 'Potvrďte prosím, že chcete dostávat novinky ze světa financí.',
    formular: formularTlacitka({ akce: '/api/newsletter/potvrdit', token, popisek: 'Potvrdit odběr' }),
  });
}

export async function potvrditOdber(request, env) {
  const token = await tokenZFormulare(request);
  if (!token || token.length > 64) return neplatnyOdkaz();

  const ted = Date.now();
  const kontakt = await env.DB.prepare(
    'SELECT id FROM kontakty WHERE potvrzeni_hash = ? AND potvrzeni_platnost > ?',
  ).bind(await sha256(token), ted).first();
  if (!kontakt) return neplatnyOdkaz();

  await env.DB.prepare(
    'INSERT INTO stitky (nazev, barva, vytvoreno) VALUES (?, ?, ?) ON CONFLICT (nazev) DO NOTHING',
  ).bind(STITEK_WEB, '#9c6d4b', ted).run();

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE kontakty SET stav = 'prihlasen', souhlas_cas = ?, souhlas_poznamka = ?,
              potvrzeni_hash = NULL, potvrzeni_platnost = NULL, odhlaseno = NULL, upraveno = ?
        WHERE id = ?`,
    ).bind(ted, `Přihlášení na webu, potvrzeno e-mailem (IP ${ipKlienta(request)})`, ted, kontakt.id),
    env.DB.prepare(
      `INSERT INTO kontakty_stitky (kontakt_id, stitek_id)
       SELECT ?, id FROM stitky WHERE nazev = ? ON CONFLICT DO NOTHING`,
    ).bind(kontakt.id, STITEK_WEB),
  ]);

  return stranka({
    titulek: 'Odběr potvrzen',
    nadpis: 'Děkuji, odběr je potvrzený',
    text: 'Novinky ze světa financí vám budou chodit na tuhle adresu. Odhlásit se můžete kdykoli odkazem v každém e-mailu.',
  });
}

export function odhlasitStranka(request) {
  const token = new URL(request.url).searchParams.get('t') || '';
  if (!token) return neplatnyOdkaz();
  return stranka({
    titulek: 'Odhlášení odběru',
    nadpis: 'Odhlásit odběr novinek?',
    text: 'Po odhlášení vám už žádné další e-maily chodit nebudou.',
    formular: formularTlacitka({ akce: '/api/newsletter/odhlasit', token, popisek: 'Odhlásit odběr' }),
  });
}

async function odhlasTokenem(env, token) {
  if (!token || token.length > 64) return false;
  const ted = Date.now();
  const vysledek = await env.DB.prepare(
    `UPDATE kontakty SET stav = 'odhlasen', odhlaseno = COALESCE(odhlaseno, ?), upraveno = ?
      WHERE odhlaseni_token = ?`,
  ).bind(ted, ted, token).run();
  return vysledek.meta.changes > 0;
}

export async function odhlasit(request, env) {
  const ok = await odhlasTokenem(env, await tokenZFormulare(request));
  if (!ok) return neplatnyOdkaz();
  return stranka({
    titulek: 'Odběr odhlášen',
    nadpis: 'Odběr je odhlášený',
    text: 'Další e-maily už vám chodit nebudou. Kdybyste si to rozmysleli, přihlásit se můžete znovu na webu.',
  });
}

/* RFC 8058: poštovní klient pošle POST s List-Unsubscribe=One-Click
 * a odhlásí bez otevření stránky. Gmail a Yahoo to u hromadné pošty
 * vyžadují. Token je v URL, tělo požadavku nic důležitého nenese. */
export async function odhlasitJednimKlikem(request, env) {
  const token = new URL(request.url).searchParams.get('t') || '';
  await odhlasTokenem(env, token);
  return new Response(null, { status: 204 });
}

/* GET /api/newsletter/vydani?t=… — „Zobrazit v prohlížeči“.
 * Veřejná verze bez oslovení a bez osobního odkazu na odhlášení.
 * Vydání se hledá podle náhodného tokenu, ne podle čísla, aby nešlo
 * procházet ostatní rozesílky. */
export async function vydani(request, env) {
  const token = new URL(request.url).searchParams.get('t') || '';
  const kampan = token && token.length <= 64
    ? await env.DB.prepare('SELECT predmet, text, sekce, vytvoreno FROM kampane WHERE verejny_token = ?').bind(token).first()
    : null;
  if (!kampan) {
    return stranka({
      titulek: 'Vydání nenalezeno',
      nadpis: 'Toto vydání tu není',
      text: 'Odkaz je neplatný nebo bylo vydání odstraněno.',
      status: 404,
    });
  }
  const zaklad = adresaWebu(env, request);
  const { html } = emailKampane({
    predmet: kampan.predmet,
    text: kampan.text,
    jmeno: '',
    sekce: kampan.sekce,
    datum: kampan.vytvoreno,
    ...volbyZProstredi(env, zaklad),
  });
  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': "default-src 'none'; img-src https: http: data:; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'private, max-age=300',
    },
  });
}

function neplatnyOdkaz() {
  return stranka({
    titulek: 'Neplatný odkaz',
    nadpis: 'Odkaz už neplatí',
    text: 'Odkaz vypršel nebo už byl použitý. Pokud chcete odebírat novinky, přihlaste se prosím znovu na webu.',
    status: 400,
  });
}
