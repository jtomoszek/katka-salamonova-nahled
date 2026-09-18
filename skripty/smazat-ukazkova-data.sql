-- Odstranění ukázkových dat (vše má doménu example.com / poznámku UKÁZKA)
DELETE FROM prijemci WHERE kampan_id IN (SELECT id FROM kampane WHERE predmet = 'Zářijové shrnutí a jeden tip na rezervu');
DELETE FROM kampane WHERE predmet = 'Zářijové shrnutí a jeden tip na rezervu';
DELETE FROM kontakty_stitky WHERE kontakt_id IN (SELECT id FROM kontakty WHERE email LIKE '%@example.com');
DELETE FROM kontakty WHERE email LIKE '%@example.com';
DELETE FROM stitky WHERE id NOT IN (SELECT stitek_id FROM kontakty_stitky) AND nazev IN ('Klienti','VIP','Hypotéky','Investice','Web');
