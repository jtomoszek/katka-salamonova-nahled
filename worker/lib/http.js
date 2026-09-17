/* Drobnosti kolem HTTP: odpovědi, chyby, čtení těla, cookies, hlavičky. */

export class Chyba extends Error {
  constructor(status, zprava, detail) {
    super(zprava);
    this.status = status;
    this.detail = detail;
  }
}

export function json(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function chybovaOdpoved(err) {
  if (err instanceof Chyba) {
    return json({ chyba: err.message, detail: err.detail }, { status: err.status });
  }
  console.error('Neošetřená chyba:', err && err.stack ? err.stack : err);
  return json({ chyba: 'Na serveru se něco pokazilo. Zkuste to prosím znovu.' }, { status: 500 });
}

/* Přečte JSON tělo s omezením velikosti — do D1 nic obřího posílat nechceme. */
export async function prectiJson(request, maxBajtu = 2_000_000) {
  const typ = request.headers.get('Content-Type') || '';
  if (!typ.includes('application/json')) {
    throw new Chyba(415, 'Očekávám data ve formátu JSON.');
  }
  const delka = Number(request.headers.get('Content-Length') || 0);
  if (delka > maxBajtu) throw new Chyba(413, 'Poslaná data jsou příliš velká.');

  const text = await request.text();
  if (text.length > maxBajtu) throw new Chyba(413, 'Poslaná data jsou příliš velká.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Chyba(400, 'Data nejsou platný JSON.');
  }
}

export function prectiCookies(hlavicka) {
  const vysledek = {};
  if (!hlavicka) return vysledek;
  for (const cast of hlavicka.split(';')) {
    const i = cast.indexOf('=');
    if (i < 0) continue;
    const klic = cast.slice(0, i).trim();
    const hodnota = cast.slice(i + 1).trim();
    if (klic) vysledek[klic] = decodeURIComponent(hodnota);
  }
  return vysledek;
}

export function ipKlienta(request) {
  return request.headers.get('CF-Connecting-IP') || 'neznama';
}

/* Hlavičky pro administraci. Styly smí být inline kvůli náhledu e-mailu
   v sandboxovaném iframe (srcdoc dědí CSP rodiče), skripty jen vlastní. */
export function hlavickyAdministrace(headers) {
  headers.set('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-src 'self'",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; '));
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Robots-Tag', 'noindex, nofollow');
  return headers;
}

export function cislo(hodnota, { min = -Infinity, max = Infinity, vychozi } = {}) {
  const n = Number.parseInt(hodnota, 10);
  if (!Number.isFinite(n)) return vychozi;
  return Math.min(Math.max(n, min), max);
}
