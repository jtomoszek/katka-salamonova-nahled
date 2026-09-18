# Kateřina Šalamonová — rekonstrukce podstránky `tomoszek.com/katka-2/`

Statický web bez závislostí (HTML + CSS + vanilla JS), věrná rekonstrukce
původní WordPress podstránky postavené v Divi 5.5.1.

## Náhled pro klientku

**https://jtomoszek.github.io/katka-salamonova-nahled/**

Repo: https://github.com/jtomoszek/katka-salamonova-nahled — větev `main`
má celý projekt, větev `gh-pages` jen obsah `site/`.

Aktualizace náhledu po změnách:

```bash
git add -A && git commit -m "update" && git push
git branch -D gh-pages; git subtree split --prefix site -b gh-pages && git push -f origin gh-pages
```

`robots.txt` má `Disallow: /`, takže se stránka nebude objevovat ve vyhledávání.
Odkaz je ale veřejný — kdokoli, kdo ho zná, si web otevře.

## Odkud obsah pochází

Původní web už není na hostingu (Seonet hlásí „Webhosting pozastaven“),
FTP záloha ve složce obsahovala jen jádro WordPressu a Divi CSS cache —
žádný obsah. Stránka byla obnovena z databázové zálohy:

```
~/Documents/Záloha webu na subdoméně/Databáze/tomoszek_com_wp/
   mysqld-tomoszek_com_wp-2026-07-20-06_58.gz
```

| | |
|---|---|
| databáze | `tomoszek_com_wp` (jediná z 25, kde stránka je) |
| ID stránky | 241938, slug `katka-2`, titulek „Katka“ |
| stav | `publish` |
| builder | Divi 5.5.1, blokový formát |
| rozsah | 89 670 znaků, 9 sekcí, 111 bloků |
| poslední úprava | 22. 5. 2026 |

Vytěžené podklady leží v `podklady/`:

- `obsah-puvodni-stranky.txt` — čitelný výpis stránky po sekcích
- `divi-bloky.json` — všech 111 bloků i s formátováním
- `divi-raw.txt` — surový Divi obsah z `wp_posts.post_content`
- `prezentace-katka.html` — obsahově plnější varianta nalezená v `~/Downloads`
- `obrazky/consulting-5-ryu-16.png` — podpis, jediný obrázek zachráněný ze zálohy uploads

## Struktura

```
site/
├─ index.html               # celá stránka, 9 sekcí okomentovaných podle originálu
├─ css/style.css            # design systém — barvy, typografie a odsazení z databáze
├─ js/main.js               # náhrada chybějících fotek, paralax hera
├─ js/graf.js               # interaktivní graf případové studie
├─ assets/img/
│  ├─ podpis.png            # 172×67, z původní zálohy
│  ├─ placeholder-hero.svg
│  ├─ placeholder-portret.svg
│  └─ placeholder-studie.svg
├─ robots.txt               # zatím Disallow — stránka není určená k indexaci
└─ sitemap.xml              # doplnit skutečnou doménu

server.py                    # statický server (posílá Cache-Control: no-store)
nahled.sh                    # server nad site/ pro prohlížeč
sync-nahled.sh               # kopie mimo iCloud pro vestavěný náhled
```

## Lokální náhled

```bash
./nahled.sh
```

Pak otevřít http://localhost:8794/ (jiný port: `./nahled.sh 9000`).

### Pozor na iCloud

Projekt leží v iCloud Drive a macOS tam **procesu vestavěného náhledu**
(Browser panel v aplikaci) zakazuje čtení souborů — server sice naběhne,
ale na všechno vrací 404. Terminál touhle restrikcí omezený není.

Proto jsou tu dvě cesty:

| | čím | živé? |
|---|---|---|
| prohlížeč | `./nahled.sh` | ano, servíruje `site/` napřímo |
| vestavěný náhled | `./sync-nahled.sh` + reload | ne, spustit po každé úpravě |

`sync-nahled.sh` jen zkopíruje `site/` do složky mimo iCloud, ze které
vestavěný náhled číst umí; `.claude/launch.json` ukazuje právě tam.

Trvalé řešení, pokud ti přepínání vadí: přidat aplikaci do
**Nastavení systému → Soukromí a zabezpečení → Přístup k celému disku**,
nebo mít projekt mimo iCloud Drive.

## Fotografie

Původní tři soubory z WordPressu se nedochovaly — jediná záloha s `uploads`
je WPvivid z 13. 5. 2026 a fotky byly nahrané až po tomto datu.
Nahrazené jsou fotkami z focení 29. 3. 2025 ze složky `salamonova/`:

Obě jsou z focení **2. 9. 2026** (`20260902_portrety_katka/`), takže mají
stejné šedé studiové pozadí i stejné olivové šaty:

| soubor v `site/assets/img/` | zdroj | rozměr | kde |
|---|---|---|---|
| `katka-hero.webp` | `_JZ_8400-Edit.jpg` | 2400 × 1600, 163 kB | pozadí hero sekce |
| `katka-hero-mobil.webp` | `_JZ_8400-Edit.jpg` | 1200 × 1600, 227 kB | totéž pod 767 px (svislý výřez) |
| `katka-portret.webp` | `_JZ_8436-Edit.jpg` | 1006 × 2000, 73 kB | sekce „Můj příběh“ |

Převedeno přes `cwebp` (hero 2400 px šířky / q82, portrét 2000 px výšky / q84).

Hero fotka je v titulce vidět **celá** (`background-size: contain`), ne
přiblížená na obličej — pod ní pokračuje barva studiového pozadí `#9d9e9e`,
kterou spodní přechod rozpustí do `--surface`. Na úzkém displeji by se
fotka na šířku smrskla do proužku, proto tam nastupuje svislý výřez
`katka-hero-mobil.webp`.

Jiný výběr? `20260902_portrety_katka/` má čtyři vybrané snímky a v `náhledy/`
další desítky; starší focení je v `salamonova/`. Stačí převést a přepsat soubor
stejného názvu — u portrétu pak srovnat `width`/`height` v `index.html`:

```bash
sips -Z 2400 20260902_portrety_katka/JMENO.jpg --out /tmp/x.jpg
cwebp -q 82 -m 6 /tmp/x.jpg -o site/assets/img/katka-hero.webp
```

## Co v originálu nebylo dodělané

Zachováno 1:1, protože takhle stránka v databázi opravdu vypadala:

1. **Reference** — v databázi měla sekce pod nadpisem omylem zkopírovanou
   případovou studii. Teď je přestavěná na tři citace a přesunutá pod
   „Co u mě nenajdete“. **Citace jsou zástupné** — skutečné reference
   v podkladech nejsou a vymyslet je nelze, jde o výroky konkrétních lidí.
   V HTML jsou označené atributem `data-zastupne` (kurzíva, ztlumená barva);
   po doplnění reálného textu atribut smažte.
2. **Sekce 9 (patička)** — v databázi jen hnědé pozadí `#4d3625` a prázdná
   mřížka. Barva i rozvržení zůstaly, obsah je **doplněný** z toho, co
   stránka sama uvádí (odbornost, spolupráce, právní doložka).
   **Kontaktní údaje chybí** — v podkladech nikde nejsou, takže nejsou
   vymyšlené: v `index.html` je připravený zakomentovaný blok „Kontakt“,
   stačí odkomentovat a doplnit e-mail, telefon a LinkedIn.
3. **Pravý sloupec u profesních milníků** — v originálu prázdný (počítalo se
   tu s fotkou) a certifikační karty visely pod ním přes celou šířku. Karty
   jsou teď v tom sloupci ve mřížce 2×2, sekce je tím výrazně kratší.
   Podobně první karta v sekci 8 („Unifikované produkty“) sedí vedle nadpisu
   místo pod ním.
4. **Sekce 3, karta „Ochrana majetku“** — tři odrážky jsou zapsané jako
   jediná položka seznamu oddělená `<br>•`.

Plnější verzi obsahu (navigace, druhá případová studie „Bezpečný domov“,
kontaktní formulář, patička) má `podklady/prezentace-katka.html` — je odkud brát,
až budeš tyhle díry zaplňovat.

## Spodní přechod hera

Fotka v hero sekci se odspodu rozplývá do pozadí — kombinace dvou věcí:

- **postupné rozostření** 0 → 10 px. CSS neumí blur animovat podél gradientu,
  proto je to pět vrstev v `.hero-fade`, každá s vlastním `backdrop-filter`
  a maskou, která ji odkrývá o kus níž. Rozostření se skládá směrem dolů
  (0,625 / 1,25 / 2,5 / 5 / 10 px).
- **barevný gradient** přes ně, z průhledné do `--surface` (`#f5f3f8`).
  Tahle barva odpovídá studiovému pozadí fotky (naměřeno `#f8f7fc`),
  takže přechod nemá viditelnou hranu.

Ladí se dvěma tokeny v `:root`:

```css
--hero-fade-h: 46%;    /* jak vysoko přechod sahá */
--hero-blur:   10px;   /* rozostření u spodní hrany */
```

Vrstva je `pointer-events: none` a `aria-hidden`, text nad ní má `z-index: 1`.
Prohlížeče bez `backdrop-filter` dostanou samotný gradient.

## Paralax fotky v heru

Fotka je samostatná vrstva `.hero-bg` a při scrollu se posouvá pomaleji než
stránka, takže hero působí hlouběji. Posun řídí `js/main.js`, rozsah je token:

```css
--parallax-range: 90px;   /* o kolik se fotka celkem posune */
```

Vrstva je o rozsah + 2 px vyšší nahoře i dole, takže posun nikdy neodkryje
okraj (těsnost ověřena měřením: mezera nad fotkou nevyjde nad −2 px).
Sekce má `overflow: hidden`, aby přesah nic nerozbil.

Výška hera se drží v proměnné a přepočítává jen při `resize` — obsluha scrollu
tak nic neměří, jen zapíše `transform`. Proto tu není `requestAnimationFrame`:
v neaktivních panelech se pozastavuje a efekt by zamrznul.

Při zapnutém systémovém **omezení pohybu** (`prefers-reduced-motion: reduce`)
se posluchače odpojí a fotka zůstane stát.

## Interaktivní graf případové studie

Statický obrázek `pripadova-studie.webp` se ze zálohy nedochoval a nahradil
ho počítaný model v `js/graf.js` — SVG kreslené ručně, bez knihovny.

Osa Y je **dosažitelná měsíční renta**, osa X věk od 42 do 72. Dvě křivky
(architektura / původní nastavení), vodorovná cílová linka a body v místech,
kde ji každá cesta protne. Po najetí na graf naskočí vodicí čára a hodnoty
pro daný věk; funguje i tahem prstem.

Odečet pod grafem má pevnou mřížku — hlavička na jednom řádku (nezalamuje se)
a pod ní obě cesty, každá s názvem a hodnotou pod sebou. Bez toho se legenda
při najetí myší lámala jinak a celá karta poskakovala do jiné výšky; ověřeno
na devíti šířkách od 390 do 1440 px, že se výška nemění.

Dva posuvníky si nastaví návštěvník sám: měsíční investice a cílová renta.
Výchozí portfolio je konstanta (10 mil. Kč, v `M.pocatek`) — jako třetí
posuvník dělalo kartu zbytečně složitou a vysokou. Shrnutí pod grafem se
přepisuje živě.

Karta je záměrně držená nízko, aby v řádku nepřerostla textový sloupec.
Kdyby bylo potřeba ještě níž, jde zkrátit plocha grafu: `viewBox` v HTML
a `PLOCHA` v `js/graf.js` musí zůstat v souladu.

### Model

Konstanty jsou nahoře v `js/graf.js` v objektu `M`:

| veličina | hodnota | odkud |
|---|---|---|
| reálný výnos trhu | 5,5 % p.a. | po inflaci |
| poplatky — architektura | 0,6 % p.a. | jeden provázaný celek |
| poplatky — původní | 2,4 % p.a. | „deset produktů“ z textu |
| neefektivita původního | 2,9 % p.a. | „požírala inflace a vysoké poplatky“ |
| bezpečný výběr | 4 % p.a. | běžná konzervativní míra |

Při výchozích hodnotách vyjde protnutí cíle v **49,5** a **59,9** letech,
tedy rozdíl 10,4 roku — sedí to na „svobodu o dekádu dříve“ v textu.

Pod grafem je poznámka, že jde o ilustraci, ne příslib výnosu. Katka je
regulovaný subjekt ČNB, takže tuhle větu tam nechte.

### Osa Y se řídí cílem

Měřítko je `cíl × 2,2`, ne maximum křivky. Kdyby se řídilo koncem křivky,
cílová linka by se zmáčkla ke dnu a protnutí — kvůli kterému graf existuje —
by nebylo vidět. Co vyroste nad horní hranu, ořízne `clipPath`.

## Časová osa profesních milníků

Milníky v sekci 5 přijíždějí zprava, jak se k nim uživatel doscrolluje.
Pohyb dělá CSS transition, `js/main.js` jen ve správnou chvíli přidá třídu
`.je-videt`; prvek se odkryje, jakmile jeho horní hrana vystoupá nad 85 %
výšky okna. Stagger řídí `--poradi` na každém prvku (130 ms na kus).

Bez JS by prvky zůstaly neviditelné, proto se schovávají až tehdy, když
skript označí `<html>` třídou `.prijezdy-aktivni`. Při zapnutém omezení
pohybu (`prefers-reduced-motion`) se nic neschovává.

Svislou linku kreslí každý milník sám jako spojnici ke svému následníkovi
(`.milnik:not(:last-child)::before`). Jedna linka přes celý kontejner by
nahoře začínala až pod prvním uzlem a pod posledním by visela do prázdna —
uzly totiž nesedí na krajích kontejneru.

## Navigace

Plovoucí lišta se skleněným efektem — `backdrop-filter: blur(16px) saturate(1.6)`
nad poloprůhledným pozadím. Plně krycí barva by efekt zabila, není co rozostřit.
Po odscrollování o 12 px se krytí zvedne (`.je-odscrollovano`), ať text pod
lištou neruší.

Odkazy míří na kotvy sekcí; `scroll-padding-top` drží nadpis pod lištou.
Na displejích do 980 px se menu schová pod tlačítko — zavřené je `visibility:
hidden`, takže se nedá tabovat ani přečíst odečítačem. Zavírá se kliknutím na
odkaz i klávesou Escape.

## Skládané karty v „Co u mě nenajdete“

Stejný princip jako na kardea.cz: nadpis je `position: sticky` a karty se pod
ním skládají na sebe — každá se zastaví o 16 px níž (`--i` na prvku), takže je
vidět okraj té předchozí. Kontejner má dole `padding-bottom`, o který zůstane
hotový stoh přilepený déle, než ho konec vytlačí pryč; není vidět, leží za
nalepenými kartami.

Nutné podmínky: `align-items: start` na mřížce (roztažená položka by neměla
kam přilnout) a krycí pozadí karet. Pod 980 px se nic nelepí, karty jdou
prostě za sebou.

## Design systém

Barvy i typografie jsou převzaté přímo z Divi nastavení stránky:

| token | hodnota | použití |
|---|---|---|
| `--copper` | `#b48563` | akcent, nadpisy h4, pozadí sekce 2 |
| `--copper-light` | `#c6a288` | |
| `--copper-dark` | `#9c6d4b` | „✘“ nadpisy, zvýrazněné slovo |
| `--brown` | `#4d3625` | pozadí nedokončené patičky |
| `--sand` | `#eaddd4` | |
| `--surface` | `#f5f3f8` | karty a sekce „Můj příběh“ |

Písmo **Poppins** (300/400/500/600/700), velikosti 16 / 18 / 30 / 40 / 50 px.
Mřížka podle Divi: řádek šířka 80 %, max. 1080 px. Breakpointy 980 px a 767 px.

## Odchylky od originálu

Vědomé a jediné:

- **Ikony** — originál používal glyfy z Divi fontu ETmodules (`&#xe009;` a spol.).
  Nahrazeny inline SVG ve stejné měděné barvě, významově odpovídající.
- **Zlomy řádků na mobilu** — u čtyř odstavců, kde originál používal ruční `<br>`
  pro desktopové zalomení, jsou zlomy pod 767 px potlačené. Na mobilu jinak
  vznikal roztrhaný text.
- **Barva hvězdiček v hero** — originál je měl bílé, což počítalo s tmavším
  snímkem. Na současné fotce (světlé studiové pozadí) by zanikly, proto měděná.
- **Spodní přechod hera a paralax fotky** — v originálu ani jedno nebylo
  (Divi mělo `parallax: off`), obojí doplněno na přání (viz výš).
- **Časová osa a příjezd milníků** — v originálu to byly statické blurby.
- **Interaktivní graf** — v originálu statický obrázek, který se nedochoval.
- **Navigace** — v originálu na stránce žádná nebyla.
- **Skládané karty a přesun referencí pod ně** — doplněno na přání.
- **Poppins z Google Fonts** — na rozdíl od ostatních projektů zatím není lokální.
  Fonty nemáš na disku; kdykoli je můžu stáhnout jako woff2 do `assets/fonts/`.

## Newsletter a administrace (Cloudflare)

Web i administrace běží jako jeden **Cloudflare Worker**: statické soubory
ze `site/` servíruje Workers Assets, cesty `/api/*` a `/admin/*` obsluhuje
kód ve `worker/`. GitHub Pages náhled žádné API nemá — formulář „Novinky“
tam nefunguje.

| část | kde |
|---|---|
| databáze (kontakty, štítky, rozesílky, uživatelé) | D1, `migrations/` |
| přílohy e-mailů | R2 bucket `katka-salamonova-prilohy` |
| odesílání | Resend (HTTP API), fronta po dávkách, cron každou minutu |
| administrace | `site/admin/` (vanilla JS), adresa `/admin/` |
| přihlášení k odběru na webu | sekce `#novinky`, `site/js/newsletter.js` |
| šablona e-mailu | `worker/lib/sablona.js`, pevné texty v `worker/lib/obsah-newsletteru.js` |

### Co umí

- **Přehled** — počty kontaktů, odeslané rozesílky, přihlášení za 30 dní.
- **Kontakty** — hledání, filtr podle stavu a štítku, hromadné štítkování,
  import z CSV (i Windows-1250 z českého Excelu), export, smazání podle GDPR.
- **Štítky** — podle nich se vybírají příjemci (všem / aspoň jeden štítek /
  všechny štítky).
- **Napsat e-mail** — předmět, text do bloku „Osobní slovo“, přílohy (10 MB,
  celkem 15 MB), zapnutí bloků *Pilíře prosperity* a *Případová studie*,
  náhled, zkušební e-mail sobě, odeslání. Koncept se ukládá v prohlížeči.
- **Odeslané** — stav fronty, doručené/neúspěšné adresy, opakování, webová verze.
- **Uživatelé** — admin zakládá účty pozvánkou (odkaz platí 7 dní), role
  admin/editor. Editor nemůže spravovat uživatele.

Přihlášení z webu je **double opt-in** (potvrzovací e-mail), každý e-mail má
odhlašovací odkaz i hlavičku pro odhlášení jedním klikem (Gmail/Yahoo to
vyžadují). Odhlášeného nejde znovu přihlásit importem.

### Design e-mailu

Podle `design_handoff_newsletter_email/`. Každé vydání obsahuje hlavičku
(„Newsletter · měsíc rok“), úvod s tlačítkem, **Osobní slovo** (portrét,
text z administrace, podpis), citát, „Co u mě nenajdete“ a patičku.
Pilíře a případová studie se zapínají u každého e-mailu zvlášť.
Obrázky se načítají z `WEB_URL` (`/assets/email/katka-portret.jpg`,
`/assets/img/podpis.png`), web proto musí běžet dřív, než odejde první e-mail.

### Kde to běží

**https://katka-salamonova.jtomoszek.workers.dev** — Worker
`katka-salamonova` v účtu jtomoszek@gmail.com, databáze D1 `katka-salamonova`.
Tohle je pořád jen náhled (`robots.txt` má `Disallow: /`); vlastní doména
se nastaví v Cloudflare → Workers → Settings → Domains a pak se musí přepsat
`WEB_URL`.

Co ještě nefunguje a proč:

| | důvod |
|---|---|
| odesílání e-mailů (i přihlášení k odběru vrací 503) | chybí `RESEND_API_KEY` a odesílací doména ověřená u Resendu |
| přílohy e-mailů | v účtu není zapnuté R2 (dashboard → R2 → Enable), binding je proto v `wrangler.jsonc` zakomentovaný a administrace tlačítko „Přiložit soubor“ nezobrazuje |
| adresa odesílatele v patičce | prázdná proměnná `ADRESA` |

### Ukázková data

V databázi je 14 smyšlených kontaktů (doména `example.com`, v poznámce
„UKÁZKA“), pět štítků a jedna „odeslaná“ rozesílka, aby administrace při
ukázce klientce nebyla prázdná. Před ostrým provozem je smaže:

```bash
npx wrangler d1 execute katka-salamonova --remote --file skripty/smazat-ukazkova-data.sql
```

### Nasazení

```bash
npm install
npx wrangler login
npx wrangler d1 create katka-salamonova          # vypsané database_id → wrangler.jsonc
npx wrangler r2 bucket create katka-salamonova-prilohy
npx wrangler d1 migrations apply katka-salamonova --remote
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ZAKLADACI_TOKEN          # libovolný dlouhý náhodný řetězec
npm run deploy
```

Před nasazením v `wrangler.jsonc` doplnit `WEB_URL`, `ODESILATEL`,
`ADRESA` (poštovní adresa do patičky) a případně `ODKAZ_KONZULTACE`.
Doménu je potřeba přidat do Resendu a nastavit DNS záznamy SPF, DKIM
a DMARC — jinak e-maily skončí ve spamu nebo neodejdou vůbec.
Vlastní doménu pro Worker nastavíte v Cloudflare → Workers → Settings → Domains.

První účet: otevřít `https://DOMENA/admin/`, zadat `ZAKLADACI_TOKEN`,
e-mail, jméno a heslo. Pak už zakládací formulář nejde použít znovu.

### Lokální vývoj

`.dev.vars` (není v gitu):

```
WEB_URL=http://localhost:8787
POSTA=log
ODESILATEL=Kateřina Šalamonová <novinky@example.test>
ZAKLADACI_TOKEN=nejaky-dlouhy-token
```

```bash
npm run db:migrate:local
npm run dev                   # http://localhost:8787, e-maily se jen vypisují do konzole
LOG=cesta/k/logu node --test test/*.test.js
```

`POSTA=log` nic neodesílá, text e-mailů vypisuje do výstupu `wrangler dev`.
E2E testy (`test/api.test.js`) běží proti spuštěnému dev serveru, **smažou
lokální databázi** a e-maily čtou z logu, jehož cestu dostanou v `LOG`.
