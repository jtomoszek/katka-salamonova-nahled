/* Volání API administrace.
 *
 * Každý požadavek nese hlavičku X-Pozadavek — server bez ní zapisující
 * požadavky odmítne (ochrana proti CSRF). Při 401 se vyšle událost
 * „odhlaseno“ a aplikace ukáže přihlášení. */

export class ApiChyba extends Error {
  constructor(status, zprava, detail) {
    super(zprava);
    this.status = status;
    this.detail = detail;
  }
}

export async function api(metoda, cesta, telo, { tise401 = false } = {}) {
  const headers = { 'X-Pozadavek': 'administrace' };
  let body;
  if (telo instanceof FormData) {
    body = telo;
  } else if (telo !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(telo);
  }

  let odpoved;
  try {
    odpoved = await fetch(cesta, { method: metoda, headers, body, credentials: 'same-origin' });
  } catch {
    throw new ApiChyba(0, 'Nepodařilo se spojit se serverem. Zkontrolujte připojení.');
  }

  const typ = odpoved.headers.get('Content-Type') || '';
  const data = typ.includes('application/json') ? await odpoved.json().catch(() => ({})) : null;

  if (!odpoved.ok) {
    if (odpoved.status === 401 && !tise401) window.dispatchEvent(new CustomEvent('odhlaseno'));
    throw new ApiChyba(odpoved.status, data?.chyba || `Chyba serveru (${odpoved.status}).`, data?.detail);
  }
  return data;
}

export const ziskej = (cesta, volby) => api('GET', cesta, undefined, volby);
export const posli = (cesta, telo, volby) => api('POST', cesta, telo ?? {}, volby);
export const uprav = (cesta, telo) => api('PATCH', cesta, telo);
export const smaz = (cesta) => api('DELETE', cesta);
