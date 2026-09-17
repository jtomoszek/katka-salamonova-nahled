# Handoff: Newsletter email — Kateřina Šalamonová

## Overview
Jednosloupcový HTML newsletter (600 px) pro web https://jtomoszek.github.io/katka-salamonova-nahled/ (repo `jtomoszek/katka-salamonova-nahled`, složka `site/`). Přebírá paletu, typografickou hierarchii a texty webu. Cíl e‑mailu: připomenout filozofii poradenství, představit 4 pilíře, ukázat případovou studii a vést na konzultaci.

## About the Design Files
Soubory v tomto balíčku jsou **designové reference vytvořené v HTML**. `newsletter-email.html` je zároveň odesílatelný e‑mail (tabulkový layout, inline styly, bez JS). Úkol: začlenit šablonu do cílového prostředí (např. Mailchimp/Ecomail/SendGrid template, MJML, React Email nebo statický soubor v repu webu) a doplnit reálné odkazy/adresy. Pokud prostředí neexistuje, doporučeno: uložit jako `site/email/newsletter-2026-09.html` v repu a odesílat přes nástroj, který podporuje vlastní HTML.

## Fidelity
**High‑fidelity.** Barvy, typografie, rozestupy i texty jsou finální. Recreate 1:1; jediné otevřené položky jsou označené hranatými závorkami v textu (adresa) a odkazy pro odhlášení.

## Constraints (e‑mailové klienty)
- Layout výhradně `<table role="presentation">`, žádný flex/grid/position.
- Vše inline; `<style>` v `<head>` jen media query pro mobil (`.w` → 100 % šířka, `.p` → padding 24 px).
- Žádné webfonty: `Helvetica, Arial, sans-serif` (web používá Poppins — v e‑mailu nedostupný).
- Obrázky musí být hostované na https (WebP portrét nezobrazí Outlook desktop → nahradit JPG).
- Držet pod 100 kB (aktuálně ~15 kB).
- `<meta name="color-scheme" content="light dark">` — barvy testovány na inverzi.

## Screens / Views
Jediný e‑mail, 600 px široký, na pozadí `#efeae5`, vnější odsazení 32 px 12 px. Sekce odshora:

### 1. Hlavička
- `bgcolor #4d3625`, padding 22 px 40 px. Vlevo „Kateřina Šalamonová" 15/20 px, 700, `#ffffff`, letter‑spacing −0.01em. Vpravo „NEWSLETTER · ZÁŘÍ 2026" 11/20 px, 600, uppercase, letter‑spacing 0.08em, `#c6a288`.

### 2. Hero
- `bgcolor #f5f3f8`, padding 56 px 40 px 48 px.
- Eyebrow „ARCHITEKTKA RODINNÉ PROSPERITY" 12/18 px, 700, uppercase, ls 0.16em, `#b48563`, margin‑bottom 18 px.
- H1 „Přestaňte odkládat.<br>Začněte budovat." 40/50 px, 700, `#000000`, mb 20 px.
- Lead 17/28 px, 300, `#1f1f1f`, mb 30 px.
- Tlačítko (bulletproof): `td bgcolor #9c6d4b`, radius 6 px; `a` display:block, padding 15 px 28 px, 14/18 px, 600, `#ffffff`, ls 0.02em. Text „Domluvit nezávaznou konzultaci". Href → web (nahradit kalendářem/kontaktem).

### 3. Osobní slovo (volitelná sekce)
- `bgcolor #ffffff`, padding 48 px 40 px 40 px. Dva sloupce: vlevo portrét 150×200 px, radius 10 px, `object-fit: cover; object-position: center top`, mezera 26 px; vpravo eyebrow „OSOBNÍ SLOVO" (styl jako hero eyebrow), 2 odstavce 15/26 px, 300, `#1f1f1f`, pak podpis PNG šířka 120 px, opacity .85.

### 4. Měděný pruh — filozofie
- `bgcolor #b48563`, padding 44 px 40 px. Citát „Jiní prodávají smlouvy.<br>Já řeším vaši svobodu." 26/38 px, 700, `#ffffff`. Pod ním odstavec 15/25 px, 300, `#ffffff`, margin‑top 16 px.

### 5. Pilíře prosperity (volitelná sekce)
- Úvod: `#ffffff`, padding 52 px 40 px 20 px. Eyebrow „SLUŽBY JAKO HODNOTA", H2 „Pilíře prosperity" 28/38 px 700, text 15/26 px 300.
- 4 řádky, každý oddělen `border-top: 1px solid #e3ddd7`, padding 22 px 0. Levý sloupec 56 px: číslo „01"–„04" 13/22 px, 700, ls 0.1em, `#b48563`. Pravý: label 11/16 px 700 uppercase ls 0.1em `#9c6d4b`; titul 18/26 px 700 `#000`; text 14/23 px 300 `#1f1f1f`.
- Po posledním řádku hairline `#e3ddd7`, pak padding‑bottom 48 px.
- Obsah: viz `content.json`.

### 6. Případová studie (volitelná sekce)
- `bgcolor #f5f3f8`, padding 48 px 40 px. Eyebrow „DŮKAZ MÍSTO SLIBŮ", H2 24/34 px 700, odstavec 15/26 px 300.
- Callout: levá svislá linka 2 px `#b48563`, obsah odsazen 18 px; nadpis „Výsledek architektury" 13/20 px 700 `#b48563`; text 15/25 px 400.
- Textový odkaz „Spočítat, kdy vám portfolio začne platit rentu →" 14 px, 600, `#9c6d4b`, underline → `…/#studie`.

### 7. Co u mě nenajdete
- `#ffffff`, padding 48 px 40 px 44 px. H2 24/34 px 700, mb 22 px.
- 3 karty: `bgcolor #f5f3f8`, `border 1px solid #e3ddd7`, radius 12 px, padding 18 px 22 px, mezera 12 px. Titul „✘ …" 16/24 px 700 `#9c6d4b`; text 14/23 px 300 `#1f1f1f`.

### 8. Patička
- `bgcolor #4d3625`, padding 44 px 40 px 28 px. Jméno 18/26 px 700 `#fff`; tagline 12/18 px 600 uppercase ls 0.06em `#c6a288`, mb 22 px.
- Dva sloupce 50/50 (mezera 14 px): nadpis 11/16 px 700 uppercase ls 0.08em `#c6a288`; položky 13/22 px 300 `#eaddd4`.
- Spodní blok: `border-top 1px solid #6b5140`, margin‑top 32 px, padding‑top 18 px, text 11/18 px 300 `#c6a288`; odkazy „Odhlásit odběr", „Zobrazit v prohlížeči" `#eaddd4` underline.

## Interactions & Behavior
- Žádné interakce mimo odkazy (e‑mail). Hover stavy neřešit (klienti je nepodporují konzistentně).
- Responzivita: pod 620 px je wrapper 100 % a horizontální padding 24 px; portrét/text v sekci 3 mohou zůstat vedle sebe (150 + text), případně stackovat.
- Preheader (skrytý span jako první prvek body): „Čtyři pilíře prosperity, jedna případová studie a tři věci, které u mě nikdy nenajdete."
- Doporučený předmět: „Přestaňte odkládat. Začněte budovat."

## State Management
Není. Volitelné sekce (Osobní slovo, Pilíře, Případová studie) jsou v návrhu přepínače — v produkci řešit jako podmíněné bloky šablony (`{{#if}}` / MJML `mj-raw` / props), aby šlo sestavit další vydání.

## Design Tokens (převzato ze `site/css/style.css`)
- `--copper` #b48563 — akcent, eyebrow, čísla, měděný pruh
- `--copper-light` #c6a288 — sekundární text na hnědé
- `--copper-dark` #9c6d4b — tlačítko, odkazy, „✘" tituly
- `--brown` #4d3625 — hlavička, patička
- `--sand` #eaddd4 — text v patičce
- `--surface` #f5f3f8 — světlé sekce, karty
- hairline #e3ddd7 (e‑mailová náhrada `rgba(0,0,0,.1)`), footer hairline #6b5140
- ink #000000 (nadpisy), body #1f1f1f, pozadí okolo e‑mailu #efeae5
- Typografie: Helvetica/Arial; váhy 300 (text), 400 (callout), 600 (tlačítko, tagline), 700 (nadpisy, eyebrow). Velikosti 11 / 12 / 13 / 14 / 15 / 17 / 18 / 24 / 26 / 28 / 40 px.
- Radius: tlačítko 6 px, portrét 10 px, karty 12 px. Žádné stíny.
- Vnitřní padding sekcí: 40 px horizontálně; vertikálně 44–56 px.

## Assets
- Portrét: https://jtomoszek.github.io/katka-salamonova-nahled/assets/img/katka-portret.webp (repo `site/assets/img/katka-portret.webp`) — pro e‑mail exportovat JPG 300×400 px (2×) a hostovat.
- Podpis: https://jtomoszek.github.io/katka-salamonova-nahled/assets/img/podpis.png (`site/assets/img/podpis.png`).
- Žádné ikony; „✘" je textový znak.

## Open items
- Doplnit sídlo/poštovní adresu v patičce (`[ulice a číslo], [PSČ město]`).
- Nahradit href odhlášení a „zobrazit v prohlížeči" merge‑tagy odesílacího nástroje.
- Href tlačítka → skutečný kontakt/kalendář.
- Otestovat v Litmus/Email on Acid (Gmail, Outlook 2016+, Apple Mail, dark mode).

## Files
- `newsletter-email.html` — odesílatelný e‑mail, primární reference.
- `Newsletter.dc.html` — interaktivní náhled s přepínači sekcí (vyžaduje runtime `support.js`, není určen k odeslání).
- `content.json` — texty pilířů a karet „Co u mě nenajdete".
