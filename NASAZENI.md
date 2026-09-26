# Nasazení na salamonova.cz

Co je potřeba udělat, aby nový web a administrace newsletteru běžely na
ostré doméně místo náhledu na `katka-salamonova.jtomoszek.workers.dev`.

## Jak to dnes je (zjištěno 26. 9. 2026)

| | |
|---|---|
| Registrátor | Gransy (subreg.cz), doména platí do 16. 1. 2027 |
| Nameservery | Cloudflare (`elsa`/`eric.ns.cloudflare.com`), nastavené 16. 2. 2026 |
| Zóna v Cloudflare | **není** v účtu jtomoszek@gmail.com — je v cizím účtu (nejspíš partnerská integrace vas-hostingu nebo předchozí správce) |
| Web | proxy Cloudflare → vas-hosting `ion06.vas-server.cz` (88.86.119.65), původní WordPress |
| Pošta | MX `ion06.vas-server.cz`, SPF `v=spf1 a mx ?all` — **zůstává na vas-hostingu** |
| Přesměrování | `www.salamonova.cz` → `salamonova.cz` (301) |

Newsletter (D1, cron, administrace) běží jen jako Cloudflare Worker.
Aby byl na doméně klientky, musí být zóna `salamonova.cz` ve **stejném účtu
Cloudflare** jako Worker. Cloudflare neumí zónu přesunout mezi účty — musí
se založit znovu a u registrátora přepnout nameservery.

## Cesta A (doporučená): doména do vlastního účtu Cloudflare

1. **Cloudflare dashboard → Add a domain → `salamonova.cz`**, tarif Free.
   Cloudflare zkusí záznamy naskenovat; místo toho (nebo navíc) importujte
   soubor `dns/salamonova.cz.txt` (DNS → Import and Export). Zkontrolujte:
   - `@` a `www`: A 88.86.119.65, **proxované** (oranžový mrak),
   - `MX 10 ion06.vas-server.cz`, oba TXT,
   - `mail`, `smtp`, `imap`, `pop3`, `webmail`, `autoconfig`,
     `autodiscover`, `ftp`: A 88.86.119.65, **DNS only** (šedý mrak).
2. Cloudflare přidělí **dva nové nameservery** (např. `xxx.ns.cloudflare.com`).
3. **U registrátora** (subreg.cz, účet vede admin-c *Radovan Adamíček*,
   případně přes vas-hosting, pokud doménu spravují oni) změnit NSSET na
   tyto dva nameservery. Cloudflare pošle e-mail, až zónu aktivuje;
   trvá to od minut do pár hodin.
4. V repozitáři:
   - `wrangler.jsonc`: odkomentovat blok `routes`, `WEB_URL` přepnout na
     `https://salamonova.cz`,
   - `npm run deploy`.
   Od té chvíle obsluhuje Worker celou doménu, původní WordPress přestane
   být vidět (na vas-hostingu zůstává, nic se nemaže).
5. **Ověřit**: `https://salamonova.cz`, `https://www.salamonova.cz`,
   `https://salamonova.cz/admin`, a hlavně **poštu** — poslat testovací
   e-mail na adresu @salamonova.cz a jeden z ní odeslat.
6. Přesměrování `www → bez www`: Cloudflare → Rules → Redirect Rules,
   nebo to za chvíli doplním do Workeru (dnes obslouží obě adresy stejně).

**Riziko**: v době přepnutí nameserverů musí nová zóna obsahovat stejné
MX a SPF, jinak vypadne pošta. Proto import před změnou NSSETu.

## Cesta B (nouzová): web přes FTP na vas-hosting

Statický web (`site/`) lze nahrát přes FTP do kořene domény na vas-hostingu.
Newsletter by ale zůstal na `workers.dev`:
- formulář na webu by volal API na cizí doméně,
- potvrzovací odkazy a odhlášení v e-mailech by vedly na `workers.dev`,
- administrace na `katka-salamonova.jtomoszek.workers.dev/admin`.

Funguje to, ale není to reprezentativní. Použít jen jako dočasné řešení,
pokud by změna nameserverů nešla rychle.

## Před spuštěním (společné pro obě cesty)

- [ ] **Rozhodnout verzi**: dnes je v kořeni první verze a druhá pod `/v2/`.
      Pokud má jít ven druhá, přesune se do kořene (a první pod `/v1/`
      nebo pryč).
- [ ] **Lufga**: soubory `lufga-regular/medium/semibold.woff2` do
      `site/assets/fonts/` (komerční písmo, musí dodat klientka). Do té
      doby se tiše používá Poppins.
- [ ] **Resend**: účet, ověřená doména `salamonova.cz` (Resend dá DNS
      záznamy → přidat do zóny), pak
      `npx wrangler secret put RESEND_API_KEY` a ve `wrangler.jsonc`
      `ODESILATEL` (např. `novinky@salamonova.cz`), `ADRESA`,
      `ODKAZ_KONZULTACE`. Bez toho přihlášení k odběru vrací 503.
- [ ] **R2** pro přílohy: zapnout v účtu, `npx wrangler r2 bucket create
      katka-salamonova-prilohy`, odkomentovat `r2_buckets`.
- [ ] **Smazat ukázková data**: `skripty/smazat-ukazkova-data.sql`
      (`npx wrangler d1 execute katka-salamonova --remote --file=...`).
- [ ] **Účet do administrace** pro klientku (dnes je tam jen zakládací).
- [ ] **Kontaktní údaje** v patičce (v podkladech nebyly).
- [ ] **Zákonné konstanty** v kalkulačkách potvrdit s Katkou.
- [ ] `sitemap.xml` a `robots.txt` — po volbě domény zkontrolovat adresy.
