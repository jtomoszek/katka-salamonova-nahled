/* Pohyb druhé verze webu.
 *
 *  1) oblouk, kterým sekce „Filozofie“ najíždí na titulní fotku,
 *     se při scrollu narovnává,
 *  2) přepínač SVOBODA se přehodí, jakmile sekce projede zhruba
 *     do půlky — s ním se mění pozadí i zvýrazněný řádek,
 *  3) lišta si podle podkladu pod sebou přepíná barvu písma,
 *  4) obsah sekcí najíždí zdola, jakmile se k němu uživatel dostane,
 *  5) menu přes celou obrazovku.
 *
 * Všechno, co se hýbe, se vypne při zapnutém „omezit pohyb“.
 */
(function () {
  'use strict';

  var omezitPohyb = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- menu ---------- */

  var menu = document.getElementById('menu');
  var otevrit = document.querySelector('[data-menu-otevrit]');
  var zavrit = document.querySelector('[data-menu-zavrit]');

  if (menu && otevrit) {
    // Bez skriptu by menu zůstalo schované, proto ho odkrýváme až tady.
    menu.hidden = false;

    var prepniMenu = function (otevreno) {
      menu.classList.toggle('je-otevrene', otevreno);
      otevrit.setAttribute('aria-expanded', otevreno ? 'true' : 'false');
      document.body.style.overflow = otevreno ? 'hidden' : '';
      if (otevreno) { (menu.querySelector('a') || zavrit).focus(); }
      else { otevrit.focus(); }
    };

    otevrit.addEventListener('click', function () { prepniMenu(true); });
    if (zavrit) zavrit.addEventListener('click', function () { prepniMenu(false); });
    menu.addEventListener('click', function (e) {
      if (e.target.closest('a')) prepniMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.classList.contains('je-otevrene')) prepniMenu(false);
    });
  }

  /* ---------- scroll: oblouk, přepínač, barva lišty ---------- */

  var hero = document.querySelector('.hero');
  var prepinac = document.querySelector('[data-prepinac]');
  var paticka = document.querySelector('.paticka');
  var lista = document.querySelector('.lista');
  var koren = document.documentElement;

  var ZLOM = 0.45;   // v jaké části sekce přepínač cvakne

  function omez(h, min, max) { return h < min ? min : (h > max ? max : h); }

  /* Kryje prvek bod y (měřeno od horní hrany okna)? */
  function kryje(prvek, y) {
    if (!prvek) return false;
    var r = prvek.getBoundingClientRect();
    return r.top <= y && r.bottom > y;
  }

  function prekresli() {
    var oknoVyska = window.innerHeight;

    // 1) oblouk se narovnává, jak sekce najíždí na fotku
    if (hero && prepinac) {
      var zaklad = window.innerWidth * (window.innerWidth < 700 ? 0.11 : 0.07);
      var najeto = omez(-prepinac.getBoundingClientRect().top / (oknoVyska * 0.6) + 1, 0, 1);
      koren.style.setProperty('--oblouk', (zaklad * (1 - najeto)).toFixed(1) + 'px');
    }

    // 2) přepínač
    var zapnuto = false;
    if (prepinac) {
      var drahaSticky = prepinac.offsetHeight - oknoVyska;
      var postup = drahaSticky > 0
        ? omez(-prepinac.getBoundingClientRect().top / drahaSticky, 0, 1)
        : 0;
      zapnuto = postup > ZLOM;
      prepinac.classList.toggle('je-zapnuto', zapnuto);
      prepinac.style.setProperty('--zapnuto', zapnuto ? 1 : 0);
    }

    // 3) barva lišty podle toho, co je zrovna pod ní. Pořadí odpovídá
    //    vrstvení: patička je nad vším, sekce přepínače nad fotkou.
    if (lista) {
      var y = 34;
      var tmavePozadi = kryje(hero, y);
      if (kryje(prepinac, y)) tmavePozadi = !zapnuto;
      if (kryje(paticka, y)) tmavePozadi = true;
      // je-tmava = tmavé písmo, tedy světlý podklad pod lištou
      lista.classList.toggle('je-tmava', !tmavePozadi);
    }
  }

  var ceka = false;
  function naScroll() {
    if (ceka) return;
    ceka = true;
    requestAnimationFrame(function () { ceka = false; prekresli(); });
  }

  window.addEventListener('scroll', naScroll, { passive: true });
  window.addEventListener('resize', naScroll);
  prekresli();

  /* ---------- nájezd obsahu ---------- */

  var prvky = [].slice.call(document.querySelectorAll('.odkryv'));
  if (!prvky.length) return;

  if (omezitPohyb || !('IntersectionObserver' in window)) {
    prvky.forEach(function (p) { p.classList.add('je-videt'); });
    return;
  }

  // Třída na <html> schová prvky až ve chvíli, kdy je skript umí odkrýt.
  koren.classList.add('prijezdy');

  var pozorovatel = new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) {
      if (!z.isIntersecting) return;
      z.target.classList.add('je-videt');
      pozorovatel.unobserve(z.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

  prvky.forEach(function (p) { pozorovatel.observe(p); });
})();
