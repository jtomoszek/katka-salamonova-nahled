/* Odeslání jednoho e-mailu.
 *
 * Cloudflare sám hromadnou poštu neposílá (Email Routing umí jen na předem
 * ověřené adresy), proto je tu externí poskytovatel. Výchozí je Resend —
 * má jednoduché HTTP API a funguje z Workeru bez knihovny. Kdyby se měnil,
 * stačí přepsat tenhle soubor; zbytek aplikace volá jen odesliEmail().
 *
 * Režimy (proměnná POSTA):
 *   resend — skutečné odeslání, potřebuje secret RESEND_API_KEY
 *   log    — nic se neodešle, e-mail se jen vypíše do logu (lokální vývoj)
 */

export class ChybaPosty extends Error {
  constructor(zprava, { docasna }) {
    super(zprava);
    this.docasna = docasna;
  }
}

export function jePostaNastavena(env) {
  const rezim = env.POSTA || 'resend';
  if (rezim === 'log') return true;
  return Boolean(env.RESEND_API_KEY && env.ODESILATEL);
}

export async function odesliEmail(env, { komu, predmet, html, text, hlavicky, prilohy, klicIdempotence }) {
  const rezim = env.POSTA || 'resend';

  if (rezim === 'log') {
    // Celý text se vypisuje schválně: při lokálním vývoji je to jediná cesta
    // k potvrzovacím a odhlašovacím odkazům. Na produkci se tenhle režim nepoužívá.
    console.log(
      `[POSTA:log] komu=${komu} predmet="${predmet}" priloh=${(prilohy || []).length}` +
      (hlavicky ? ` hlavicky=${JSON.stringify(hlavicky)}` : '') +
      `\n${text}\n[/POSTA:log]`,
    );
    return { id: `log-${crypto.randomUUID()}` };
  }

  if (!env.RESEND_API_KEY || !env.ODESILATEL) {
    throw new ChybaPosty('Odesílání není nastavené — chybí RESEND_API_KEY nebo ODESILATEL.', { docasna: false });
  }

  const telo = {
    from: env.ODESILATEL,
    to: [komu],
    subject: predmet,
    html,
    text,
  };
  if (env.ODPOVEDI_NA) telo.reply_to = env.ODPOVEDI_NA;
  if (hlavicky) telo.headers = hlavicky;
  if (prilohy && prilohy.length) {
    telo.attachments = prilohy.map((p) => ({ filename: p.nazev, content: p.obsahBase64 }));
  }

  const headers = {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
  };
  // Když se odeslání po výpadku zopakuje, Resend podle klíče pozná duplikát.
  if (klicIdempotence) headers['Idempotency-Key'] = klicIdempotence;

  let odpoved;
  try {
    odpoved = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers,
      body: JSON.stringify(telo),
    });
  } catch (err) {
    throw new ChybaPosty(`Poskytovatel není dostupný: ${err.message}`, { docasna: true });
  }

  if (odpoved.ok) {
    const data = await odpoved.json().catch(() => ({}));
    return { id: data.id || null };
  }

  const detail = await odpoved.text().catch(() => '');
  // 429 = překročený limit rychlosti, 5xx = výpadek — obojí má smysl zkusit znovu.
  const docasna = odpoved.status === 429 || odpoved.status >= 500;
  throw new ChybaPosty(`Poskytovatel odmítl e-mail (${odpoved.status}): ${detail.slice(0, 300)}`, { docasna });
}
