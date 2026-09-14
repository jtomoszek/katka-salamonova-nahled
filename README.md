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
├─ js/main.js               # náhrada chybějících fotografií placeholderem
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

| soubor v `site/assets/img/` | zdroj (`salamonova/press/`) | kde |
|---|---|---|
| `katka-hero.webp` | `…_JZ_4956-Edit.jpg` | pozadí hero sekce |
| `katka-portret.webp` | `…_JZ_5007-Edit.jpg` | sekce „Můj příběh“ |

Převedeno přes `cwebp` (hero 2400 px šířky / q82 → 67 kB,
portrét 2000 px výšky / q84 → 42 kB).

Jiný výběr z focení? Ve složce `salamonova/press/` jsou čtyři fotky
(`náhledy/` má dalších 51). Stačí převést a přepsat soubor stejného názvu:

```bash
sips -Z 2400 salamonova/press/JMENO.jpg --out /tmp/x.jpg
cwebp -q 82 -m 6 /tmp/x.jpg -o site/assets/img/katka-hero.webp
```

### Co ještě chybí

`pripadova-studie.webp` — graf do sekce 6 a 7. Zatím se zobrazuje
placeholder; jakmile soubor doplníš do `site/assets/img/`, nasadí se sám.
Do té doby hlásí konzole u tohoto obrázku 404, což je záměr, ne chyba.

## Co v originálu nebylo dodělané

Zachováno 1:1, protože takhle stránka v databázi opravdu vypadala:

1. **Sekce 7 „Co o mě říkají klienti“** — pod nadpisem je omylem zkopírovaný
   obsah sekce 6 (případová studie). Skutečné reference chybí.
2. **Sekce 9 (patička)** — jen hnědé pozadí `#4d3625` a prázdná mřížka
   šesti sloupců. Žádný obsah.
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
- **Spodní přechod hera** — v originálu nebyl, doplněno na přání (viz výš).
- **Poppins z Google Fonts** — na rozdíl od ostatních projektů zatím není lokální.
  Fonty nemáš na disku; kdykoli je můžu stáhnout jako woff2 do `assets/fonts/`.
