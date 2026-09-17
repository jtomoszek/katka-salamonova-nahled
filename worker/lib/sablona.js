/* E-mailové šablony podle designu v design_handoff_newsletter_email.
 *
 * Omezení e-mailových klientů (viz README designu): rozvržení jen tabulkami,
 * všechny styly inline, v <head> jen media query pro mobil, žádné webfonty
 * (Helvetica/Arial), obrázky jako JPG/PNG na https.
 *
 * Rozesílka se skládá z bloků. Pevné: hlavička, hero, filozofie, „Co u mě
 * nenajdete“, patička. Text napsaný v administraci jde do bloku „Osobní
 * slovo“ (portrét, text, podpis). Volitelné: pilíře a případová studie. */

import { HERO, FILOZOFIE, PILIRE, STUDIE, NENAJDETE, PATICKA, MESICE } from './obsah-newsletteru.js';

const B = {
  pozadi: '#efeae5',
  hneda: '#4d3625',
  med: '#b48563',
  medSvetla: '#c6a288',
  medTmava: '#9c6d4b',
  pisek: '#eaddd4',
  povrch: '#f5f3f8',
  bila: '#ffffff',
  cerna: '#000000',
  text: '#1f1f1f',
  linka: '#e3ddd7',
  linkaPaticky: '#6b5140',
};
const PISMO = 'Helvetica,Arial,sans-serif';

export function escapuj(hodnota) {
  return String(hodnota ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* Oslovení: {{jmeno}} se nahradí křestním jménem. Když jméno chybí,
   zmizí i s případnou čárkou a mezerou před ním („Dobrý den, {{jmeno}},“
   → „Dobrý den,“). */
function dosadJmeno(text, jmeno) {
  if (jmeno) return text.replace(/\{\{\s*jmeno\s*\}\}/gi, jmeno);
  return text.replace(/,?\s*\{\{\s*jmeno\s*\}\}/gi, '');
}

/* Text z administrace → HTML odstavce ve stylu bloku „Osobní slovo“.
 *   prázdný řádek → nový odstavec, Enter → nový řádek,
 *   **tučně** → tučné písmo, https://… → odkaz */
export function textNaHtml(text) {
  const odstavce = String(text).replace(/\r\n?/g, '\n').trim().split(/\n{2,}/);
  return odstavce.map((odstavec, i) => {
    let h = escapuj(odstavec);
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight:700">$1</strong>');
    h = h.replace(/\bhttps?:\/\/[^\s<]+/g, (url) => {
      // interpunkci na konci věty do odkazu nezahrnujeme
      const konec = url.match(/[.,;:!?)]+$/);
      const cisty = konec ? url.slice(0, -konec[0].length) : url;
      return `<a href="${cisty}" style="color:${B.medTmava};text-decoration:underline">${cisty}</a>${konec ? konec[0] : ''}`;
    });
    h = h.replace(/\n/g, '<br>');
    const posledni = i === odstavce.length - 1;
    return `<p style="margin:0 0 ${posledni ? 20 : 14}px">${h}</p>`;
  }).join('\n      ');
}

export function textNaProstyText(text) {
  return String(text).replace(/\r\n?/g, '\n').replace(/\*\*(.+?)\*\*/g, '$1').trim();
}

function nadtitulek(text, dole = 10) {
  return `<p style="margin:0 0 ${dole}px;font-size:12px;line-height:18px;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${B.med}">${escapuj(text)}</p>`;
}

function radek(pozadi, padding, obsah) {
  return `<tr><td class="p" width="600" bgcolor="${pozadi}" style="background:${pozadi};padding:${padding}">
  ${obsah}
</td></tr>`;
}

function tlacitko(odkaz, popisek) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tbody><tr>
    <td bgcolor="${B.medTmava}" style="background:${B.medTmava};border-radius:6px">
      <a href="${escapuj(odkaz)}" style="display:block;padding:15px 28px;font-size:14px;line-height:18px;font-weight:600;color:${B.bila};text-decoration:none;letter-spacing:0.02em">${escapuj(popisek)}</a>
    </td>
  </tr></tbody></table>`;
}

/* ---------- bloky ---------- */

function blokHlavicka(vydani) {
  return radek(B.hneda, '22px 40px', `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
    <td style="font-size:15px;line-height:20px;font-weight:700;color:${B.bila};letter-spacing:-0.01em">${escapuj(PATICKA.jmeno)}</td>
    <td align="right" style="font-size:11px;line-height:20px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${B.medSvetla}">${escapuj(vydani)}</td>
  </tr></tbody></table>`);
}

function blokHero(odkazKonzultace) {
  return radek(B.povrch, '56px 40px 48px', `${nadtitulek(HERO.nadtitulek, 18)}
  <h1 style="margin:0 0 20px;font-size:40px;line-height:50px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">${HERO.nadpis.map(escapuj).join('<br>')}</h1>
  <p style="margin:0 0 30px;font-size:17px;line-height:28px;font-weight:300;color:${B.text}">${escapuj(HERO.text)}</p>
  ${tlacitko(odkazKonzultace, HERO.tlacitko)}`);
}

function blokOsobniSlovo(textHtml, zaklad) {
  return radek(B.bila, '48px 40px 40px', `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
    <td width="150" valign="top" style="width:150px;padding-right:26px">
      <img src="${escapuj(zaklad)}/assets/email/katka-portret.jpg" width="150" height="200" alt="${escapuj(PATICKA.jmeno)}" style="display:block;width:150px;height:200px;object-fit:cover;object-position:center top;border-radius:10px;border:0">
    </td>
    <td valign="top" style="font-size:15px;line-height:26px;font-weight:300;color:${B.text}">
      ${nadtitulek('Osobní slovo')}
      ${textHtml}
      <img src="${escapuj(zaklad)}/assets/img/podpis.png" width="120" alt="Podpis ${escapuj(PATICKA.jmeno)}" style="display:block;width:120px;height:auto;border:0;opacity:0.85">
    </td>
  </tr></tbody></table>`);
}

function blokFilozofie() {
  return radek(B.med, '44px 40px', `<p style="margin:0;font-size:26px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:${B.bila}">${FILOZOFIE.citat.map(escapuj).join('<br>')}</p>
  <p style="margin:16px 0 0;font-size:15px;line-height:25px;font-weight:300;color:${B.bila}">${escapuj(FILOZOFIE.text)}</p>`);
}

function blokPilire() {
  const uvod = radek(B.bila, '52px 40px 20px', `${nadtitulek(PILIRE.nadtitulek)}
  <h2 style="margin:0 0 14px;font-size:28px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">${escapuj(PILIRE.nadpis)}</h2>
  <p style="margin:0;font-size:15px;line-height:26px;font-weight:300;color:${B.text}">${escapuj(PILIRE.text)}</p>`);

  const polozky = PILIRE.polozky.map((p) => radek(B.bila, '0 40px', `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid ${B.linka}"><tbody><tr>
    <td width="56" valign="top" style="width:56px;padding:22px 0;font-size:13px;line-height:22px;font-weight:700;color:${B.med};letter-spacing:0.1em">${escapuj(p.cislo)}</td>
    <td valign="top" style="padding:22px 0">
      <p style="margin:0 0 2px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${B.medTmava}">${escapuj(p.stitek)}</p>
      <p style="margin:0 0 6px;font-size:18px;line-height:26px;font-weight:700;color:${B.cerna}">${escapuj(p.nadpis)}</p>
      <p style="margin:0;font-size:14px;line-height:23px;font-weight:300;color:${B.text}">${escapuj(p.text)}</p>
    </td>
  </tr></tbody></table>`)).join('\n');

  const konec = `<tr><td class="p" width="600" bgcolor="${B.bila}" style="background:${B.bila};padding:0 40px 48px;border-top:0"><div style="border-top:1px solid ${B.linka};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
  return `${uvod}\n${polozky}\n${konec}`;
}

function blokStudie(zaklad) {
  return radek(B.povrch, '48px 40px', `${nadtitulek(STUDIE.nadtitulek)}
  <h2 style="margin:0 0 16px;font-size:24px;line-height:34px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">${escapuj(STUDIE.nadpis)}</h2>
  <p style="margin:0 0 22px;font-size:15px;line-height:26px;font-weight:300;color:${B.text}">${escapuj(STUDIE.text)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
    <td width="2" bgcolor="${B.med}" style="width:2px;background:${B.med}"></td>
    <td style="padding:2px 0 2px 18px">
      <p style="margin:0 0 4px;font-size:13px;line-height:20px;font-weight:700;color:${B.med}">${escapuj(STUDIE.vysledekNadpis)}</p>
      <p style="margin:0;font-size:15px;line-height:25px;font-weight:400;color:${B.text}">${escapuj(STUDIE.vysledekText)}</p>
    </td>
  </tr></tbody></table>
  <p style="margin:24px 0 0;font-size:14px;line-height:22px"><a href="${escapuj(zaklad)}/#studie" style="color:${B.medTmava};font-weight:600;text-decoration:underline">${escapuj(STUDIE.odkaz)}</a></p>`);
}

function blokNenajdete() {
  const karty = NENAJDETE.polozky.map((n) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px"><tbody><tr>
    <td bgcolor="${B.povrch}" style="background:${B.povrch};border:1px solid ${B.linka};border-radius:12px;padding:18px 22px">
      <p style="margin:0 0 4px;font-size:16px;line-height:24px;font-weight:700;color:${B.medTmava}">&#10008; ${escapuj(n.nadpis)}</p>
      <p style="margin:0;font-size:14px;line-height:23px;font-weight:300;color:${B.text}">${escapuj(n.text)}</p>
    </td>
  </tr></tbody></table>`).join('\n  ');
  return radek(B.bila, '48px 40px 44px', `<h2 style="margin:0 0 22px;font-size:24px;line-height:34px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">${escapuj(NENAJDETE.nadpis)}</h2>
  ${karty}`);
}

function odkazPaticky(href, text) {
  return `<a href="${escapuj(href)}" style="color:${B.pisek};text-decoration:underline">${escapuj(text)}</a>`;
}

function blokPaticka({ odkazOdhlaseni, odkazVProhlizeci, adresa }) {
  const sloupec = (nadpis, polozky, strana) => `<td width="50%" valign="top" style="padding-${strana}:14px;font-size:13px;line-height:22px;font-weight:300;color:${B.pisek}">
      <p style="margin:0 0 6px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${B.medSvetla}">${escapuj(nadpis)}</p>
      ${polozky.map(escapuj).join('<br>')}
    </td>`;

  const odkazy = [
    adresa ? escapuj(adresa) : null,
    odkazOdhlaseni ? odkazPaticky(odkazOdhlaseni, 'Odhlásit odběr') : null,
    odkazVProhlizeci ? odkazPaticky(odkazVProhlizeci, 'Zobrazit v prohlížeči') : null,
  ].filter(Boolean).join(' · ');

  return radek(B.hneda, '44px 40px 28px', `<p style="margin:0 0 2px;font-size:18px;line-height:26px;font-weight:700;color:${B.bila}">${escapuj(PATICKA.jmeno)}</p>
  <p style="margin:0 0 22px;font-size:12px;line-height:18px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${B.medSvetla}">${escapuj(PATICKA.tagline)}</p>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tbody><tr>
    ${sloupec('Odbornost', PATICKA.odbornost, 'right')}
    ${sloupec('Spolupráce', PATICKA.spoluprace, 'left')}
  </tr></tbody></table>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:32px;border-top:1px solid ${B.linkaPaticky}"><tbody><tr>
    <td style="padding-top:18px;font-size:11px;line-height:18px;font-weight:300;color:${B.medSvetla}">
      ${escapuj(PATICKA.pravni)}${odkazy ? `<br>\n      ${odkazy}` : ''}
    </td>
  </tr></tbody></table>`);
}

/* Malá patička systémových e-mailů (potvrzení odběru, pozvánka). */
function blokPatickaMala() {
  return radek(B.hneda, '28px 40px', `<p style="margin:0 0 2px;font-size:15px;line-height:22px;font-weight:700;color:${B.bila}">${escapuj(PATICKA.jmeno)}</p>
  <p style="margin:0;font-size:11px;line-height:16px;font-weight:600;letter-spacing:0.06em;text-transform:uppercase;color:${B.medSvetla}">${escapuj(PATICKA.tagline)}</p>`);
}

function dokument({ predmet, preheader, radky }) {
  return `<!DOCTYPE html>
<html lang="cs" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapuj(predmet)}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>
body{margin:0;padding:0;-webkit-text-size-adjust:100%;}
table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0;}
img{-ms-interpolation-mode:bicubic;}
@media only screen and (max-width:620px){
  .w{width:100%!important;max-width:100%!important;}
  .p{padding-left:24px!important;padding-right:24px!important;}
}
</style>
</head>
<body style="margin:0;padding:0;background:${B.pozadi};">
<span style="display:none;font-size:1px;color:${B.pozadi};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden">${escapuj(preheader)}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${B.pozadi};font-family:${PISMO}">
<tbody><tr><td align="center" style="padding:32px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="w" style="width:600px;max-width:600px">
<tbody>
${radky.filter(Boolean).join('\n\n')}
</tbody></table>
</td></tr></tbody></table>
</body>
</html>`;
}

export function nazevVydani(ms) {
  const d = new Date(ms);
  return `Newsletter · ${MESICE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/* Nastavení šablony z proměnných prostředí (wrangler.jsonc). */
export function volbyZProstredi(env, zaklad) {
  return {
    zaklad,
    adresa: env.ADRESA || '',
    odkazKonzultace: env.ODKAZ_KONZULTACE || `${zaklad}/`,
  };
}

export const VYCHOZI_SEKCE = { pilire: true, studie: true };

export function normalizujSekce(hodnota) {
  const s = typeof hodnota === 'string' ? (() => { try { return JSON.parse(hodnota); } catch { return {}; } })() : (hodnota || {});
  return { pilire: s.pilire !== false, studie: s.studie !== false };
}

/* Rozesílka z administrace.
 *   zaklad            — veřejná adresa webu (obrázky, odkazy)
 *   odkazOdhlaseni    — osobní odkaz; ve webové verzi chybí
 *   odkazVProhlizeci  — veřejná webová verze vydání; ve webové verzi chybí */
export function emailKampane({
  predmet, text, jmeno, zaklad, odkazOdhlaseni, odkazVProhlizeci, sekce, datum = Date.now(), adresa = '', odkazKonzultace,
}) {
  const s = normalizujSekce(sekce);
  const dosazeny = dosadJmeno(text, jmeno);
  const prostyDopis = textNaProstyText(dosazeny);

  const html = dokument({
    predmet,
    preheader: prostyDopis.replace(/\s+/g, ' ').slice(0, 140),
    radky: [
      blokHlavicka(nazevVydani(datum)),
      blokHero(odkazKonzultace || `${zaklad}/`),
      blokOsobniSlovo(textNaHtml(dosazeny), zaklad),
      blokFilozofie(),
      s.pilire ? blokPilire() : null,
      s.studie ? blokStudie(zaklad) : null,
      blokNenajdete(),
      blokPaticka({ odkazOdhlaseni, odkazVProhlizeci, adresa }),
    ],
  });

  const casti = [
    `${HERO.nadpis.join(' ')}\n${HERO.text}\n${HERO.tlacitko}: ${odkazKonzultace || `${zaklad}/`}`,
    `OSOBNÍ SLOVO\n\n${prostyDopis}`,
    `${FILOZOFIE.citat.join(' ')}\n${FILOZOFIE.text}`,
    s.pilire ? `${PILIRE.nadpis.toUpperCase()}\n${PILIRE.polozky.map((p) => `${p.cislo} ${p.nadpis} — ${p.text}`).join('\n')}` : null,
    s.studie ? `${STUDIE.nadpis.toUpperCase()}\n${STUDIE.text}\n${STUDIE.vysledekNadpis}: ${STUDIE.vysledekText}\n${STUDIE.odkaz} ${zaklad}/#studie` : null,
    `${NENAJDETE.nadpis.toUpperCase()}\n${NENAJDETE.polozky.map((n) => `✘ ${n.nadpis} — ${n.text}`).join('\n')}`,
    [
      `${PATICKA.jmeno} · ${PATICKA.tagline}`,
      PATICKA.pravni,
      adresa || null,
      odkazOdhlaseni ? `Odhlásit odběr: ${odkazOdhlaseni}` : null,
      odkazVProhlizeci ? `Zobrazit v prohlížeči: ${odkazVProhlizeci}` : null,
    ].filter(Boolean).join('\n'),
  ];

  return { html, text: `${casti.filter(Boolean).join('\n\n—\n\n')}\n` };
}

function odstavec(html) {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:26px;font-weight:300;color:${B.text}">${html}</p>`;
}

function systemovyEmail({ predmet, preheader, obsah }) {
  return dokument({
    predmet,
    preheader,
    radky: [
      blokHlavicka(PATICKA.tagline),
      radek(B.bila, '44px 40px 40px', obsah),
      blokPatickaMala(),
    ],
  });
}

/* Double opt-in: bez kliknutí na odkaz se adresa nestane odběratelem. */
export function emailPotvrzeniOdberu({ odkaz }) {
  const predmet = 'Potvrďte prosím odběr novinek';
  const html = systemovyEmail({
    predmet,
    preheader: 'Stačí jedno kliknutí a začnou vám chodit novinky ze světa financí.',
    obsah: `${nadtitulek('Novinky ze světa financí', 14)}
  <h1 style="margin:0 0 18px;font-size:28px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">Ještě jedno kliknutí</h1>
  ${odstavec('Dobrý den,')}
  ${odstavec('děkuji za zájem o novinky ze světa financí. Aby vám začaly chodit, potvrďte prosím, že adresa patří vám:')}
  ${tlacitko(odkaz, 'Potvrdit odběr')}
  <p style="margin:24px 0 0;font-size:13px;line-height:21px;font-weight:300;color:#6f6861">Odkaz platí 7 dní. Pokud jste se nepřihlašovali, e-mail ignorujte — bez potvrzení vám nic chodit nebude.</p>`,
  });
  const text =
    'Dobrý den,\n\nděkuji za zájem o novinky ze světa financí. Odběr potvrdíte tímto odkazem:\n' +
    `${odkaz}\n\nOdkaz platí 7 dní. Pokud jste se nepřihlašovali, e-mail ignorujte.\n`;
  return { predmet, html, text };
}

export function emailPozvanky({ odkaz, jmeno, pozval }) {
  const predmet = 'Pozvánka do administrace newsletteru';
  const html = systemovyEmail({
    predmet,
    preheader: 'Nastavte si heslo a můžete začít.',
    obsah: `${nadtitulek('Administrace newsletteru', 14)}
  <h1 style="margin:0 0 18px;font-size:28px;line-height:38px;mso-line-height-rule:exactly;font-weight:700;color:${B.cerna}">Pozvánka</h1>
  ${odstavec(`Dobrý den${jmeno ? `, ${escapuj(jmeno)}` : ''},`)}
  ${odstavec(`${escapuj(pozval)} vám založil(a) přístup do administrace newsletteru. Heslo si nastavíte sami:`)}
  ${tlacitko(odkaz, 'Nastavit heslo')}
  <p style="margin:24px 0 0;font-size:13px;line-height:21px;font-weight:300;color:#6f6861">Odkaz platí 7 dní a jde použít jen jednou.</p>`,
  });
  const text = `Dobrý den,\n\n${pozval} vám založil(a) přístup do administrace newsletteru.\nHeslo si nastavíte zde (odkaz platí 7 dní):\n${odkaz}\n`;
  return { predmet, html, text };
}
