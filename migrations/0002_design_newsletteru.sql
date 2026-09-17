-- Design newsletteru: volitelné sekce a odkaz „Zobrazit v prohlížeči“.

-- Které volitelné bloky šablony rozesílka obsahuje (JSON).
ALTER TABLE kampane ADD COLUMN sekce TEXT NOT NULL DEFAULT '{"pilire":true,"studie":true}';

-- Náhodný token pro veřejnou webovou verzi e-mailu. Bez něj by šlo
-- procházet všechna vydání jen podle pořadového čísla.
ALTER TABLE kampane ADD COLUMN verejny_token TEXT;
UPDATE kampane SET verejny_token = lower(hex(randomblob(16))) WHERE verejny_token IS NULL;
