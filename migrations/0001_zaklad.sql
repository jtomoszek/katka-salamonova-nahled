-- Základní schéma administrace newsletteru.
-- Časy jsou v milisekundách od epochy (Date.now()).

-- Uživatelé administrace. password_hash je NULL, dokud pozvaný uživatel
-- nepřijme pozvánku a nenastaví si heslo.
CREATE TABLE uzivatele (
  id                  INTEGER PRIMARY KEY,
  email               TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  jmeno               TEXT    NOT NULL DEFAULT '',
  role                TEXT    NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  heslo_hash          TEXT,
  pozvanka_hash       TEXT,
  pozvanka_platnost   INTEGER,
  vytvoreno           INTEGER NOT NULL,
  posledni_prihlaseni INTEGER
);

-- Přihlášení. Ukládá se jen SHA-256 tokenu, samotný token je v cookie.
CREATE TABLE relace (
  token_hash   TEXT    PRIMARY KEY,
  uzivatel_id  INTEGER NOT NULL REFERENCES uzivatele(id) ON DELETE CASCADE,
  vytvoreno    INTEGER NOT NULL,
  platnost     INTEGER NOT NULL
);
CREATE INDEX relace_uzivatel ON relace(uzivatel_id);
CREATE INDEX relace_platnost ON relace(platnost);

-- Omezení počtu pokusů (přihlášení, odběr newsletteru).
CREATE TABLE omezeni (
  klic          TEXT    PRIMARY KEY,
  pocet         INTEGER NOT NULL,
  zacatek_okna  INTEGER NOT NULL
);

-- Kontakty. Stav:
--   cekajici  — přihlásil se na webu, ale ještě nepotvrdil odběr
--   prihlasen — dostává e-maily
--   odhlasen  — odhlásil se; importem ani ručně ho znovu přihlásit nelze
CREATE TABLE kontakty (
  id                 INTEGER PRIMARY KEY,
  email              TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  jmeno              TEXT    NOT NULL DEFAULT '',
  prijmeni           TEXT    NOT NULL DEFAULT '',
  stav               TEXT    NOT NULL CHECK (stav IN ('cekajici', 'prihlasen', 'odhlasen')),
  zdroj              TEXT    NOT NULL CHECK (zdroj IN ('web', 'import', 'rucne')),
  souhlas_cas        INTEGER,
  souhlas_poznamka   TEXT,
  potvrzeni_hash     TEXT,
  potvrzeni_platnost INTEGER,
  odhlaseni_token    TEXT    NOT NULL UNIQUE,
  odhlaseno          INTEGER,
  vytvoreno          INTEGER NOT NULL,
  upraveno           INTEGER NOT NULL
);
CREATE INDEX kontakty_stav ON kontakty(stav);
CREATE INDEX kontakty_vytvoreno ON kontakty(vytvoreno);

CREATE TABLE stitky (
  id        INTEGER PRIMARY KEY,
  nazev     TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  barva     TEXT    NOT NULL DEFAULT '#b48563',
  vytvoreno INTEGER NOT NULL
);

CREATE TABLE kontakty_stitky (
  kontakt_id INTEGER NOT NULL REFERENCES kontakty(id) ON DELETE CASCADE,
  stitek_id  INTEGER NOT NULL REFERENCES stitky(id)   ON DELETE CASCADE,
  PRIMARY KEY (kontakt_id, stitek_id)
);
CREATE INDEX kontakty_stitky_stitek ON kontakty_stitky(stitek_id);

-- Rozeslané e-maily. vyber_stitku: 'vsem' = všem přihlášeným,
-- 'kterykoli' = aspoň jeden z vybraných štítků, 'vsechny' = všechny vybrané.
CREATE TABLE kampane (
  id            INTEGER PRIMARY KEY,
  predmet       TEXT    NOT NULL,
  text          TEXT    NOT NULL,
  stitky        TEXT    NOT NULL DEFAULT '[]',
  vyber_stitku  TEXT    NOT NULL DEFAULT 'vsem' CHECK (vyber_stitku IN ('vsem', 'kterykoli', 'vsechny')),
  stav          TEXT    NOT NULL CHECK (stav IN ('odesila_se', 'odeslano', 'selhalo')),
  prijemcu      INTEGER NOT NULL DEFAULT 0,
  odeslano      INTEGER NOT NULL DEFAULT 0,
  selhalo       INTEGER NOT NULL DEFAULT 0,
  vytvoril      INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,
  vytvoreno     INTEGER NOT NULL,
  dokonceno     INTEGER
);
CREATE INDEX kampane_vytvoreno ON kampane(vytvoreno);

-- Přílohy leží v R2. kampan_id je NULL, dokud soubor jen čeká v rozepsaném
-- e-mailu; při odeslání se přiřadí ke kampani.
CREATE TABLE prilohy (
  id          INTEGER PRIMARY KEY,
  kampan_id   INTEGER REFERENCES kampane(id) ON DELETE CASCADE,
  r2_klic     TEXT    NOT NULL UNIQUE,
  nazev       TEXT    NOT NULL,
  typ         TEXT    NOT NULL,
  velikost    INTEGER NOT NULL,
  nahral      INTEGER REFERENCES uzivatele(id) ON DELETE SET NULL,
  vytvoreno   INTEGER NOT NULL
);

-- Fronta a historie odeslání jednotlivým příjemcům.
--   ve_fronte → odesila_se → odeslano | selhalo | preskoceno
-- preskoceno = mezi zařazením a odesláním se kontakt odhlásil nebo byl smazán.
CREATE TABLE prijemci (
  id           INTEGER PRIMARY KEY,
  kampan_id    INTEGER NOT NULL REFERENCES kampane(id) ON DELETE CASCADE,
  kontakt_id   INTEGER REFERENCES kontakty(id) ON DELETE SET NULL,
  email        TEXT    NOT NULL,
  stav         TEXT    NOT NULL CHECK (stav IN ('ve_fronte', 'odesila_se', 'odeslano', 'selhalo', 'preskoceno')),
  pokusu       INTEGER NOT NULL DEFAULT 0,
  id_zpravy    TEXT,
  chyba        TEXT,
  zabrano      INTEGER,
  odeslano     INTEGER,
  UNIQUE (kampan_id, email)
);
CREATE INDEX prijemci_fronta ON prijemci(stav, id);
CREATE INDEX prijemci_kampan ON prijemci(kampan_id, stav);
CREATE INDEX prijemci_odeslano ON prijemci(odeslano);
