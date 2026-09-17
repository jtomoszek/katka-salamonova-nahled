/* End-to-end test API proti běžícímu lokálnímu serveru.
 *
 *   1. npm run dev -- > .wrangler/dev.log 2>&1     (POSTA=log v .dev.vars)
 *   2. LOG=.wrangler/dev.log npm test
 *
 * Test na začátku vyprázdní LOKÁLNÍ databázi. Odkazy z e-mailů (potvrzení,
 * odhlášení, pozvánka) čte z logu serveru, kam je v režimu POSTA=log vypisuje. */

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const URL_ = process.env.URL || 'http://127.0.0.1:8787';
const LOG = process.env.LOG;
const TOKEN = readFileSync('.dev.vars', 'utf8').match(/^ZAKLADACI_TOKEN=(.+)$/m)[1].trim();

function vycistiDatabazi() {
  const tabulky = ['prijemci', 'prilohy', 'kampane', 'kontakty_stitky', 'stitky', 'kontakty', 'relace', 'omezeni', 'uzivatele'];
  const sql = tabulky.map((t) => `DELETE FROM ${t};`).join(' ');
  execSync(`npx wrangler d1 execute katka-salamonova --local --command "${sql}"`, { stdio: 'pipe' });
}

/* Minimální klient s vlastní „sklenicí“ na cookie — fetch v Node je sám nedrží. */
function klient() {
  let cookie = '';
  return async function api(metoda, cesta, telo, { hlavicky = {}, surove = false } = {}) {
    const headers = { 'X-Pozadavek': 'administrace', Origin: URL_, ...hlavicky };
    if (cookie) headers.Cookie = cookie;
    let body;
    if (telo instanceof FormData) body = telo;
    else if (telo !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(telo);
    }
    const odpoved = await fetch(URL_ + cesta, { method: metoda, headers, body, redirect: 'manual' });
    const nastav = odpoved.headers.get('set-cookie');
    if (nastav) cookie = nastav.split(';')[0].endsWith('=') ? '' : nastav.split(';')[0];
    if (surove) return odpoved;
    const typ = odpoved.headers.get('content-type') || '';
    const data = typ.includes('json') ? await odpoved.json() : await odpoved.text();
    return { status: odpoved.status, data };
  };
}

/* Poslední e-mail pro danou adresu z logu serveru. */
async function posledniEmail(komu, obsahuje) {
  if (!LOG) throw new Error('Nastavte LOG=cesta/k/logu/serveru');
  for (let i = 0; i < 40; i++) {
    const log = readFileSync(LOG, 'utf8');
    const bloky = [...log.matchAll(/\[POSTA:log\] komu=(\S+) ([^\n]*)\n([\s\S]*?)\n\[\/POSTA:log\]/g)]
      .filter((m) => m[1] === komu && (!obsahuje || m[0].includes(obsahuje)));
    if (bloky.length) return { hlavicka: bloky.at(-1)[2], text: bloky.at(-1)[3] };
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`E-mail pro ${komu} v logu nedorazil.`);
}

function tokenZOdkazu(text, cesta) {
  const m = text.match(new RegExp(`${cesta.replace(/[/?]/g, '\\$&')}[?]t=([\\w%-]+)`));
  assert.ok(m, `Odkaz ${cesta} v e-mailu chybí`);
  return decodeURIComponent(m[1]);
}

async function formular(cesta, token) {
  return fetch(URL_ + cesta, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ t: token }),
  });
}

const admin = klient();
const ADMIN = { email: 'katka@example.test', heslo: 'SilneHeslo-2026', jmeno: 'Kateřina Šalamonová' };

before(() => vycistiDatabazi());

test('první nastavení vyžaduje zakládací kód a hlavičku administrace', async () => {
  let r = await admin('GET', '/api/ucet/stav');
  assert.equal(r.data.potrebaNastaveni, true);

  r = await admin('POST', '/api/ucet/nastaveni', { token: 'spatne', ...ADMIN });
  assert.equal(r.status, 403);

  r = await admin('POST', '/api/ucet/nastaveni', { token: TOKEN, ...ADMIN }, { hlavicky: { 'X-Pozadavek': '' } });
  assert.equal(r.status, 403, 'bez hlavičky X-Pozadavek musí být požadavek odmítnut');

  r = await admin('POST', '/api/ucet/nastaveni', { token: TOKEN, ...ADMIN, heslo: 'kratke' });
  assert.equal(r.status, 400);

  r = await admin('POST', '/api/ucet/nastaveni', { token: TOKEN, ...ADMIN });
  assert.equal(r.status, 200);

  r = await admin('GET', '/api/ucet/stav');
  assert.equal(r.data.uzivatel.email, ADMIN.email);
  assert.equal(r.data.uzivatel.role, 'admin');

  r = await klient()('POST', '/api/ucet/nastaveni', { token: TOKEN, ...ADMIN, email: 'druhy@example.test' });
  assert.equal(r.status, 409, 'druhé nastavení už nesmí projít');
});

test('přihlášení, CSRF a odhlášení', async () => {
  const k = klient();
  let r = await k('POST', '/api/ucet/prihlasit', { email: ADMIN.email, heslo: 'spatne-heslo' });
  assert.equal(r.status, 401);
  r = await k('POST', '/api/ucet/prihlasit', { email: 'neexistuje@example.test', heslo: 'cokoli-dlouheho' });
  assert.equal(r.status, 401);
  assert.equal(r.data.chyba, 'E-mail nebo heslo nesouhlasí.', 'neznámý e-mail se nesmí prozradit jinou hláškou');

  r = await k('POST', '/api/ucet/prihlasit', { email: ADMIN.email.toUpperCase(), heslo: ADMIN.heslo });
  assert.equal(r.status, 200, 'e-mail nezáleží na velikosti písmen');

  r = await k('GET', '/api/prehled');
  assert.equal(r.status, 200);

  r = await k('POST', '/api/stitky', { nazev: 'X' }, { hlavicky: { Origin: 'https://zly-web.example' } });
  assert.equal(r.status, 403, 'cizí Origin musí být odmítnut');

  r = await k('POST', '/api/ucet/odhlasit', {});
  assert.equal(r.status, 200);
  r = await k('GET', '/api/prehled');
  assert.equal(r.status, 401);

  r = await klient()('GET', '/api/kontakty');
  assert.equal(r.status, 401, 'bez přihlášení žádná data');
});

let stitekKlienti;
let stitekVip;

test('štítky', async () => {
  let r = await admin('POST', '/api/stitky', { nazev: 'Klienti', barva: '#4d3625' });
  assert.equal(r.status, 201);
  stitekKlienti = r.data.id;
  r = await admin('POST', '/api/stitky', { nazev: 'VIP' });
  stitekVip = r.data.id;
  r = await admin('POST', '/api/stitky', { nazev: 'klienti' });
  assert.equal(r.status, 409, 'název štítku je bez ohledu na velikost písmen');
  r = await admin('PATCH', `/api/stitky/${stitekVip}`, { barva: 'neni-barva' });
  assert.equal(r.status, 200);
  r = await admin('GET', '/api/stitky');
  assert.equal(r.data.polozky.find((s) => s.id === stitekVip).barva, '#b48563', 'neplatná barva spadne na výchozí');
});

test('ruční kontakt vyžaduje souhlas', async () => {
  let r = await admin('POST', '/api/kontakty', { email: 'rucne@example.test' });
  assert.equal(r.status, 400);
  r = await admin('POST', '/api/kontakty', {
    email: 'Rucne@Example.test', jmeno: 'Petr', stitky: [stitekKlienti], souhlasPotvrzen: true, souhlasPoznamka: 'Osobní schůzka',
  });
  assert.equal(r.status, 201);
  r = await admin('POST', '/api/kontakty', { email: 'rucne@example.test', souhlasPotvrzen: true });
  assert.equal(r.status, 409);
});

test('import CSV: neplatné, duplicity, štítky podle názvu, odhlášený zůstane odhlášený', async () => {
  let r = await admin('POST', '/api/kontakty/import', { radky: [{ email: 'a@example.test' }], souhlasPotvrzen: false });
  assert.equal(r.status, 400, 'import bez potvrzení souhlasu nesmí projít');

  r = await admin('POST', '/api/kontakty/import', {
    radky: [
      { email: 'jana@example.test', jmeno: 'Jana', prijmeni: 'Nová', stitky: ['VIP', 'Hypotéky'] },
      { email: 'JANA@example.test', jmeno: 'Duplicita' },
      { email: 'neni-email' },
      { email: '' },
      { email: 'rucne@example.test', prijmeni: 'Doplněný', stitky: ['Hypotéky'] },
      { email: 'karel@example.test', jmeno: 'Karel' },
    ],
    stitky: [stitekKlienti],
    existujici: 'doplnit',
    souhlasPotvrzen: true,
    souhlasPoznamka: 'Klienti z CRM, souhlas ve smlouvě',
    prvniRadek: 2,
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.zalozeno, 2);
  assert.equal(r.data.doplneno, 1);
  assert.equal(r.data.duplicityVSouboru, 1);
  assert.deepEqual(r.data.neplatne.map((n) => n.radek), [4, 5]);

  r = await admin('GET', `/api/kontakty?stitek=${stitekKlienti}`);
  assert.equal(r.data.celkem, 3, 'společný štítek dostanou nové i doplněné');

  r = await admin('GET', '/api/kontakty?q=rucne');
  const rucne = r.data.polozky[0];
  assert.equal(rucne.prijmeni, 'Doplněný');
  assert.ok(rucne.stitky.some((s) => s.nazev === 'Hypotéky'), 'štítek z CSV se založil a přiřadil');

  // Odhlásit Karla a zkusit ho znovu naimportovat.
  const karel = (await admin('GET', '/api/kontakty?q=karel')).data.polozky[0];
  r = await admin('PATCH', `/api/kontakty/${karel.id}`, { stav: 'odhlasen' });
  assert.equal(r.status, 200);
  r = await admin('POST', '/api/kontakty/import', {
    radky: [{ email: 'karel@example.test' }], existujici: 'doplnit', souhlasPotvrzen: true, souhlasPoznamka: 'znovu',
  });
  assert.equal(r.data.odhlaseniVSouboru, 1);
  r = await admin('GET', `/api/kontakty/${karel.id}`);
  assert.equal(r.data.stav, 'odhlasen', 'import nesmí odhlášeného přihlásit');

  r = await admin('PATCH', `/api/kontakty/${karel.id}`, { stav: 'prihlasen' });
  assert.equal(r.status, 400, 'znovu přihlásit jen s novým souhlasem');
});

test('přihlášení k odběru z webu: honeypot, souhlas, double opt-in', async () => {
  const verejny = (telo) => fetch(`${URL_}/api/newsletter/prihlasit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(telo),
  });

  let r = await verejny({ email: 'web@example.test' });
  assert.equal(r.status, 400, 'bez souhlasu neprojde');

  r = await verejny({ email: 'robot@example.test', souhlas: true, web: 'http://spam' });
  assert.equal(r.status, 200);
  let kontakty = await admin('GET', '/api/kontakty?q=robot');
  assert.equal(kontakty.data.celkem, 0, 'honeypot nesmí nic uložit');

  r = await verejny({ email: 'web@example.test', jmeno: 'Eva', souhlas: true });
  assert.equal(r.status, 200);
  kontakty = await admin('GET', '/api/kontakty?q=web@');
  assert.equal(kontakty.data.polozky[0].stav, 'cekajici');

  const email = await posledniEmail('web@example.test', 'Potvrďte');
  const token = tokenZOdkazu(email.text, '/api/newsletter/potvrdit');

  // GET je jen stránka s tlačítkem — skener pošty nesmí odběr potvrdit.
  const stranka = await fetch(`${URL_}/api/newsletter/potvrdit?t=${encodeURIComponent(token)}`);
  assert.equal(stranka.status, 200);
  kontakty = await admin('GET', '/api/kontakty?q=web@');
  assert.equal(kontakty.data.polozky[0].stav, 'cekajici', 'otevření odkazu samo nic nepotvrdí');

  const potvrzeni = await formular('/api/newsletter/potvrdit', token);
  assert.equal(potvrzeni.status, 200);
  assert.match(await potvrzeni.text(), /odběr je potvrzený/);

  kontakty = await admin('GET', '/api/kontakty?q=web@');
  assert.equal(kontakty.data.polozky[0].stav, 'prihlasen');
  assert.ok(kontakty.data.polozky[0].stitky.some((s) => s.nazev === 'Web'), 'potvrzený z webu dostane štítek Web');

  const podruhe = await formular('/api/newsletter/potvrdit', token);
  assert.equal(podruhe.status, 400, 'token je jednorázový');
});

test('přihlášení k odběru bez JavaScriptu: POST formuláře vrátí stránku', async () => {
  const odeslat = (pole) => fetch(`${URL_}/api/newsletter/prihlasit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(pole),
  });

  let r = await odeslat({ email: 'bezjs@example.test', jmeno: 'Bez JS' });
  assert.equal(r.status, 400);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(await r.text(), /souhlas/);

  r = await odeslat({ email: 'bezjs@example.test', jmeno: 'Bez JS', souhlas: 'on', web: '' });
  assert.equal(r.status, 200);
  assert.match(await r.text(), /Ještě potvrdit v e-mailu/);
  await posledniEmail('bezjs@example.test', 'Potvrďte');
});

let kampanId;

test('rozesílka: výběr podle štítků, příloha, fronta, odhlášení v e-mailu', async () => {
  let r = await admin('POST', '/api/kampane/pocet', { vyber: 'vsem' });
  const vsichni = r.data.pocet;
  assert.equal(vsichni, 3, 'Petr (ručně), Jana a Eva z webu — Karel je odhlášený');

  r = await admin('POST', '/api/kampane/pocet', { vyber: 'kterykoli', stitky: [stitekKlienti, stitekVip] });
  assert.equal(r.data.pocet, 2, 'Klienti nebo VIP (Karel je odhlášený)');

  r = await admin('POST', '/api/kampane/pocet', { vyber: 'vsechny', stitky: [stitekKlienti, stitekVip] });
  assert.equal(r.data.pocet, 1, 'Klienti i VIP zároveň má jen Jana');

  r = await admin('POST', '/api/kampane/pocet', { vyber: 'kterykoli', stitky: [] });
  assert.equal(r.status, 400);

  const form = new FormData();
  form.append('soubor', new Blob(['%PDF-1.4 zkouska'], { type: 'application/pdf' }), 'Přehled 2026.pdf');
  r = await admin('POST', '/api/prilohy', form);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const prilohaId = r.data.id;

  const zly = new FormData();
  zly.append('soubor', new Blob(['MZ'], { type: 'application/octet-stream' }), 'virus.exe');
  r = await admin('POST', '/api/prilohy', zly);
  assert.equal(r.status, 400, 'spustitelný soubor nelze přiložit');

  r = await admin('POST', '/api/kampane/nahled', { predmet: 'Ahoj', text: 'Dobrý den, {{jmeno}},\n\n**tučně** a <script>alert(1)</script> https://example.test.' });
  assert.match(r.data.html, /Dobrý den, Jana,/);
  assert.match(r.data.html, /<strong[^>]*>tučně<\/strong>/);
  assert.doesNotMatch(r.data.html, /<script>/, 'text z editoru musí být escapovaný');
  assert.match(r.data.html, /<a href="https:\/\/example\.test"[^>]*>https:\/\/example\.test<\/a>\./, 'tečka za odkazem do něj nepatří');
  assert.match(r.data.html, /Osobní slovo/);
  assert.match(r.data.html, /Pilíře prosperity/, 'volitelné bloky jsou ve výchozím stavu zapnuté');
  assert.match(r.data.html, /Transformace 10 produktů/);

  r = await admin('POST', '/api/kampane/nahled', { predmet: 'Ahoj', text: 'Text', sekce: { pilire: false, studie: false } });
  assert.doesNotMatch(r.data.html, /Pilíře prosperity/);
  assert.doesNotMatch(r.data.html, /Transformace 10 produktů/);
  assert.match(r.data.html, /Co u mě nenajdete/, 'pevné bloky zůstávají');

  r = await admin('POST', '/api/kampane/test', { predmet: 'Zkouška', text: 'Text', prilohy: [prilohaId] });
  assert.equal(r.status, 200);
  const zkusebni = await posledniEmail(ADMIN.email, '[ZKOUŠKA]');
  assert.match(zkusebni.hlavicka, /priloh=1/);

  const obsah = { predmet: 'Novinky z financí', text: 'Dobrý den, {{jmeno}},\n\nnovinky.', sekce: { pilire: false, studie: true }, vyber: 'kterykoli', stitky: [stitekKlienti], prilohy: [prilohaId] };
  r = await admin('POST', '/api/kampane', { ...obsah, ocekavanyPocet: 99 });
  assert.equal(r.status, 409, 'nesouhlasí-li očekávaný počet, neodesílat');

  r = await admin('POST', '/api/kampane', { ...obsah, ocekavanyPocet: 2 });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  kampanId = r.data.id;
  assert.equal(r.data.prijemcu, 2);

  // První dávka odchází přes waitUntil; pro jistotu ještě cron.
  await fetch(`${URL_}/__scheduled?cron=*+*+*+*+*`);
  for (let i = 0; i < 40; i++) {
    r = await admin('GET', `/api/kampane/${kampanId}`);
    if (r.data.stav !== 'odesila_se') break;
    await new Promise((ok) => setTimeout(ok, 250));
  }
  assert.equal(r.data.stav, 'odeslano', JSON.stringify(r.data.pocty));
  assert.equal(r.data.odeslano, 2);
  assert.equal(r.data.prilohy.length, 1);
  assert.deepEqual(r.data.sekce, { pilire: false, studie: true });
  const verejnyToken = r.data.verejny_token;
  assert.match(verejnyToken, /^[A-Za-z0-9_-]{16,}$/);

  r = await admin('POST', '/api/kampane', { ...obsah, prilohy: [prilohaId] });
  assert.equal(r.status, 400, 'přílohu odeslaného e-mailu nejde použít znovu');

  const doruceny = await posledniEmail('jana@example.test', 'Novinky z financí');
  assert.match(doruceny.text, /Dobrý den, Jana,/);
  assert.match(doruceny.hlavicka, /List-Unsubscribe-Post/);
  assert.match(doruceny.hlavicka, /priloh=1/);
  assert.doesNotMatch(doruceny.text, /PILÍŘE PROSPERITY/, 'vypnutý blok v e-mailu není');
  assert.match(doruceny.text, /TRANSFORMACE 10 PRODUKTŮ/);
  assert.match(doruceny.text, new RegExp(`Zobrazit v prohlížeči: \\S+/api/newsletter/vydani\\?t=${verejnyToken}`));

  // Webová verze: bez oslovení a bez osobního odkazu na odhlášení.
  let web = await fetch(`${URL_}/api/newsletter/vydani?t=${verejnyToken}`);
  assert.equal(web.status, 200);
  const webHtml = await web.text();
  assert.match(webHtml, /Dobrý den,\s*<\/p>|Dobrý den,<br>/);
  assert.doesNotMatch(webHtml, /Jana|odhlasit\?t=/);
  assert.doesNotMatch(webHtml, /Pilíře prosperity/);
  web = await fetch(`${URL_}/api/newsletter/vydani?t=neexistuje`);
  assert.equal(web.status, 404);

  const odhlasovaci = tokenZOdkazu(doruceny.text, '/api/newsletter/odhlasit');
  const odhlaseni = await formular('/api/newsletter/odhlasit', odhlasovaci);
  assert.equal(odhlaseni.status, 200);
  r = await admin('GET', '/api/kontakty?q=jana');
  assert.equal(r.data.polozky[0].stav, 'odhlasen');

  // Jedním klikem (RFC 8058) — idempotentní.
  const jednimKlikem = await fetch(`${URL_}/api/newsletter/odhlasit-jednim-klikem?t=${encodeURIComponent(odhlasovaci)}`, { method: 'POST' });
  assert.equal(jednimKlikem.status, 204);
});

test('přehled', async () => {
  const r = await admin('GET', '/api/prehled');
  assert.equal(r.status, 200);
  assert.equal(r.data.rozesilky.kampani, 1);
  assert.equal(r.data.rozesilky.emailu, 2);
  assert.equal(r.data.prihlaseniPoDnech.length, 30);
  assert.ok(r.data.kontakty.prihlaseno >= 2);
});

test('uživatelé: pozvánka, role editor, pojistky', async () => {
  let r = await admin('POST', '/api/uzivatele', { email: 'asistentka@example.test', jmeno: 'Asistentka', role: 'editor' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  const editorId = r.data.id;
  const token = new URL(r.data.odkaz.replace('#/', '')).searchParams.get('t');
  assert.ok(token);

  r = await admin('POST', '/api/uzivatele', { email: 'asistentka@example.test' });
  assert.equal(r.status, 409);

  const editor = klient();
  r = await editor('GET', `/api/ucet/pozvanka?t=${encodeURIComponent(token)}`);
  assert.equal(r.data.email, 'asistentka@example.test');
  r = await editor('POST', '/api/ucet/pozvanka', { token, heslo: 'HesloAsistentky-1' });
  assert.equal(r.status, 200);

  r = await editor('GET', '/api/kontakty');
  assert.equal(r.status, 200, 'editor pracuje s kontakty');
  r = await editor('GET', '/api/uzivatele');
  assert.equal(r.status, 403, 'editor nespravuje uživatele');

  r = await editor('POST', '/api/ucet/pozvanka', { token, heslo: 'JineHeslo-12345' });
  assert.equal(r.status, 404, 'pozvánka je jednorázová');

  const ja = (await admin('GET', '/api/ucet/stav')).data.uzivatel;
  r = await admin('DELETE', `/api/uzivatele/${ja.id}`);
  assert.equal(r.status, 400, 'sám sebe smazat nejde');

  r = await admin('DELETE', `/api/uzivatele/${editorId}`);
  assert.equal(r.status, 200);
  r = await editor('GET', '/api/kontakty');
  assert.equal(r.status, 401, 'smazaný uživatel ztratí přístup okamžitě');
});

test('změna hesla ukončí ostatní relace', async () => {
  const druhe = klient();
  await druhe('POST', '/api/ucet/prihlasit', { email: ADMIN.email, heslo: ADMIN.heslo });
  let r = await admin('POST', '/api/ucet/heslo', { soucasneHeslo: 'spatne', noveHeslo: 'NoveHeslo-2026x' });
  assert.equal(r.status, 400);
  r = await admin('POST', '/api/ucet/heslo', { soucasneHeslo: ADMIN.heslo, noveHeslo: 'NoveHeslo-2026x' });
  assert.equal(r.status, 200);
  r = await druhe('GET', '/api/prehled');
  assert.equal(r.status, 401, 'jinde přihlášená relace musí skončit');
  r = await admin('GET', '/api/prehled');
  assert.equal(r.status, 200, 'relace, která heslo měnila, zůstane');
});

test('export CSV a smazání kontaktu podle GDPR', async () => {
  let r = await admin('GET', '/api/kontakty/export', undefined, { surove: true });
  // Response.text() úvodní BOM podle specifikace odřízne, proto surové bajty.
  const bajty = new Uint8Array(await r.arrayBuffer());
  assert.deepEqual([...bajty.slice(0, 3)], [0xef, 0xbb, 0xbf], 'CSV musí začínat BOM kvůli Excelu');
  const csv = new TextDecoder().decode(bajty);
  assert.match(csv, /e-mail;jméno;příjmení/);

  const rucne = (await admin('GET', '/api/kontakty?q=rucne')).data.polozky[0];
  r = await admin('DELETE', `/api/kontakty/${rucne.id}`);
  assert.equal(r.status, 200);
  r = await admin('GET', `/api/kampane/${kampanId}`);
  assert.ok(!r.data.prijemci.some((p) => p.email === 'rucne@example.test'), 'adresa nesmí zůstat v historii rozesílky');
  assert.ok(r.data.prijemci.some((p) => p.email.startsWith('smazany-kontakt-')));
});

test('administrace má bezpečnostní hlavičky', async () => {
  const r = await fetch(`${URL_}/admin/`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-security-policy') || '', /script-src 'self'/);
  assert.equal(r.headers.get('x-frame-options'), 'DENY');
  const presmerovani = await fetch(`${URL_}/admin`, { redirect: 'manual' });
  assert.equal(presmerovani.status, 301);
});
