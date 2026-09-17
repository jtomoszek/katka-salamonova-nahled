/* Malé veřejné stránky, na které vedou odkazy z e-mailů.
 *
 * Potvrzení i odhlášení jdou přes tlačítko (POST), ne rovnou při otevření
 * odkazu (GET). Bezpečnostní skenery pošty — Outlook Safe Links, firemní
 * filtry — odkazy v e-mailech samy otevírají, a kdyby akce proběhla na GET,
 * potvrzovaly by odběr nebo odhlašovaly lidi místo nich. */

import { escapuj } from './sablona.js';

export function stranka({ titulek, nadpis, text, formular, status = 200 }) {
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escapuj(titulek)} · Kateřina Šalamonová</title>
<style>
  :root { --med:#b48563; --med-tmava:#9c6d4b; --hneda:#4d3625; --povrch:#f5f3f8; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
    background: var(--povrch); color: #1d1a17;
    font: 300 16px/1.7 'Poppins', 'Helvetica Neue', Helvetica, Arial, sans-serif;
  }
  main {
    width: 100%; max-width: 480px; background: #fff; border-radius: 16px;
    border-top: 4px solid var(--med); padding: 40px 36px;
    box-shadow: 0 24px 60px -34px rgba(77, 54, 37, .45);
  }
  .znacka { font-weight: 700; color: var(--hneda); }
  .podtitul { font-size: 11px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: var(--med); margin-bottom: 26px; }
  h1 { font-size: 26px; line-height: 1.3; margin: 0 0 12px; font-weight: 700; }
  p { margin: 0 0 20px; }
  button, .odkaz {
    display: inline-block; border: 0; border-radius: 999px; padding: 13px 26px; cursor: pointer;
    background: var(--med-tmava); color: #fff; font: 600 15px 'Poppins', Helvetica, Arial, sans-serif;
    text-decoration: none;
  }
  button:hover, .odkaz:hover { background: var(--hneda); }
  button:focus-visible, .odkaz:focus-visible { outline: 2px solid var(--hneda); outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <div class="znacka">Kateřina Šalamonová</div>
  <div class="podtitul">Architektka rodinné prosperity</div>
  <h1>${escapuj(nadpis)}</h1>
  <p>${escapuj(text)}</p>
  ${formular || '<a class="odkaz" href="/">Zpět na web</a>'}
</main>
</body>
</html>`;

  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}

export function formularTlacitka({ akce, token, popisek }) {
  return `<form method="post" action="${escapuj(akce)}">
    <input type="hidden" name="t" value="${escapuj(token)}">
    <button type="submit">${escapuj(popisek)}</button>
  </form>`;
}
