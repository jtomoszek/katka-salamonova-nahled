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
git subtree split --prefix site -b gh-pages -f && git push -f origin gh-pages
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
| `katka-portret.webp` | `_JZ_8436-Edit.jpg` | 1006 × 2000, 73 kB | sekce „Můj příběh“ |

Převedeno přes `cwebp` (hero 2400 px šířky / q82, portrét 2000 px výšky / q84).

Jiný výběr? `20260902_portrety_katka/` má čtyři vybrané snímky a v `náhledy/`
další desítky; starší focení je v `salamonova/`. Stačí převést a přepsat soubor
stejného názvu — u portrétu pak srovnat `width`/`height` v `index.html`:

```bash
sips -Z 2400 20260902_portrety_katka/JMENO.jpg --out /tmp/x.jpg
cwebp -q 82 -m 6 /tmp/x.jpg -o site/assets/img/katka-hero.webp
```

## Co v originálu nebylo dodělané

Zachováno 1:1, protože takhle stránka v databázi opravdu vypadala:

1. **Sekce 7 „Co o mě říkají klienti“** — pod nadpisem byl omylem zkopírovaný
   obsah sekce 6 a skutečné reference chybí. V náhledu pro klientku by to
   působilo jako chyba, proto je sekce **zakomentovaná** v `index.html`.
   Až budou reference k dispozici, stačí komentář odebrat a obsah vyměnit.
2. **Sekce 9 (patička)** — v databázi jen hnědé pozadí `#4d3625` a prázdná
   mřížka. Barva i rozvržení zůstaly, obsah je **doplněný** z toho, co
   stránka sama uvádí (odbornost, spolupráce, právní doložka).
   **Kontaktní údaje chybí** — v podkladech nikde nejsou, takže nejsou
   vymyšlené: v `index.html` je připravený zakomentovaný blok „Kontakt“,
   stačí odkomentovat a doplnit e-mail, telefon a LinkedIn.
3. **Pravý sloupec u profesních milníků** — prázdný, počítalo se tu s fotkou.
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
- **Poppins z Google Fonts** — na rozdíl od ostatních projektů zatím není lokální.
  Fonty nemáš na disku; kdykoli je můžu stáhnout jako woff2 do `assets/fonts/`.
