/* Jednotkové testy čtení CSV pro import (běží bez serveru). */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dekoduj, odhadniOddelovac, parsuj, odhadniMapovani, naKontakty } from '../site/admin/js/csv.js';

test('Windows-1250 z českého Excelu se dekóduje správně', () => {
  const bajty = new Uint8Array([0x50, 0xf8, 0xed, 0x6a, 0x6d, 0x65, 0x6e, 0xed]); // „Příjmení“ ve cp1250
  assert.equal(dekoduj(bajty.buffer), 'Příjmení');
});

test('UTF-8 s BOM zůstane UTF-8 a BOM zmizí', () => {
  const bajty = new TextEncoder().encode('\uFEFFJméno;E-mail');
  assert.equal(dekoduj(bajty.buffer), 'Jméno;E-mail');
});

test('oddělovač se pozná a ignoruje znaky v uvozovkách', () => {
  assert.equal(odhadniOddelovac('email;jmeno;"a,b,c,d"\n'), ';');
  assert.equal(odhadniOddelovac('email,jmeno\n'), ',');
  assert.equal(odhadniOddelovac('email\tjmeno\n'), '\t');
});

test('uvozovky: oddělovač, nový řádek a zdvojená uvozovka uvnitř buňky', () => {
  const radky = parsuj('a;"b;c";"řádek\nnový";"řekl ""ahoj"""\r\nx;y;z;w\r\n\r\n', ';');
  assert.deepEqual(radky, [['a', 'b;c', 'řádek\nnový', 'řekl "ahoj"'], ['x', 'y', 'z', 'w']]);
});

test('mapování podle hlavičky i bez ní', () => {
  const s = odhadniMapovani([['E-mail', 'Křestní jméno', 'Příjmení', 'Štítky'], ['a@b.cz', 'A', 'B', 'x']]);
  assert.equal(s.maHlavicku, true);
  assert.deepEqual(s.mapovani, ['email', 'jmeno', 'prijmeni', 'stitky']);

  const bez = odhadniMapovani([['Jana', 'jana@example.cz'], ['Petr', 'petr@example.cz']]);
  assert.equal(bez.maHlavicku, false);
  assert.deepEqual(bez.mapovani, ['', 'email']);
});

test('celé jméno se rozdělí a štítky rozseknou podle čárky', () => {
  const [k] = naKontakty([['Jana Nová Svobodová', 'jana@example.cz', 'Klienti, Hypotéky|VIP']], ['celeJmeno', 'email', 'stitky']);
  assert.deepEqual(k, { email: 'jana@example.cz', jmeno: 'Jana', prijmeni: 'Nová Svobodová', stitky: ['Klienti', 'Hypotéky', 'VIP'] });
});
