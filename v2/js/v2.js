/* Pohyb druhé verze webu.
 *
 *  1) titulní fotka z ostré měkne a lehce se přibližuje,
 *  2) přepínač SVOBODA cvakne, jakmile sekce projede zhruba do půlky;
 *     s ním se mění pozadí i zvýrazněný řádek (--zapnuto),
 *  3) sekce filozofie se do fotky prolne (--najeto),
 *  4) linky na pozadí sekcí se dokreslují, jak sekce projíždějí,
 *  5) v „Hranicích spolupráce“ se přepíná druhá číslice,
 *  6) lišta si podle podkladu pod sebou přepíná barvu písma,
 *  7) obsah sekcí najíždí zdola a menu jede přes celou obrazovku.
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

  /* ---------- prvky ---------- */

  var hero = document.querySelector('.hero');
  var prepinac = document.querySelector('[data-prepinac]');
  var panel = document.querySelector('.prepinac__panel');
  var knoflik = document.querySelector('.spinac__knoflik');
  var paticka = document.querySelector('.paticka');
  var lista = document.querySelector('.lista');
  var koren = document.documentElement;

  var valec = document.querySelector('.hranice__valec');
  var kroky = [].slice.call(document.querySelectorAll('.hranice__texty .krok'));

  // Linky na pozadí obsahových sekcí — kreslí se, jak sekce projíždí.
  var pozadi = [].slice.call(document.querySelectorAll('.krivky')).map(function (obal) {
    return { cesta: obal.querySelector('path'), sekce: obal.closest('section'), delka: 0 };
  });

  var ZLOM = 0.45;        // v jaké části sekce přepínač cvakne

  function omez(h, min, max) { return h < min ? min : (h > max ? max : h); }

  /* ---------- linky na pozadí ---------- */

  function prepocitejLinky() {
    pozadi.forEach(function (p) {
      if (!p.cesta) return;
      p.delka = p.cesta.getTotalLength();
      p.cesta.style.strokeDasharray = p.delka;
      p.cesta.style.strokeDashoffset = omezitPohyb ? 0 : p.delka;
    });
  }

  /* ---------- scroll ---------- */

  /* Kryje prvek bod y (měřeno od horní hrany okna)? */
  function kryje(prvek, y) {
    if (!prvek) return false;
    var r = prvek.getBoundingClientRect();
    return r.top <= y && r.bottom > y;
  }

  function prekresli() {
    var oknoVyska = window.innerHeight;

    // 1) fotka: na začátku ostrá, se scrollem měkne a lehce se přiblíží
    if (hero) {
      koren.style.setProperty('--mekkost',
        omez(window.scrollY / (hero.offsetHeight * 0.85), 0, 1).toFixed(3));
    }

    // 2) sekce filozofie se do fotky prolne a titulní obsah se rozplyne
    if (hero && prepinac) {
      var najeto = omez((oknoVyska - prepinac.getBoundingClientRect().top) / (oknoVyska * 0.85), 0, 1);
      prepinac.style.setProperty('--najeto', najeto.toFixed(3));
    }

    // 3) přehození přepínače SVOBODA
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

    // 4) v „Hranicích spolupráce“ se mění jen druhá číslice: platí ten
    //    blok, jehož vršek už vystoupal nad 45 % výšky okna
    if (valec && kroky.length) {
      var hranice = oknoVyska * 0.45;
      var ktery = 0;
      kroky.forEach(function (blok, i) {
        if (blok.getBoundingClientRect().top <= hranice) ktery = i;
      });
      valec.style.setProperty('--krok', ktery);
    }

    // 5) linky na pozadí se dokreslují, jak jejich sekce projíždí
    if (!omezitPohyb) {
      pozadi.forEach(function (p) {
        if (!p.delka || !p.sekce) return;
        var r = p.sekce.getBoundingClientRect();
        var postupSekce = omez((oknoVyska - r.top) / (r.height * 0.7 + oknoVyska), 0, 1);
        p.cesta.style.strokeDashoffset = (p.delka * (1 - postupSekce)).toFixed(1);
      });
    }

    // 6) barva lišty podle toho, co je zrovna pod ní. Pořadí odpovídá
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

  var cekaRozmer;
  function naZmenuRozmeru() {
    clearTimeout(cekaRozmer);
    cekaRozmer = setTimeout(function () { prepocitejLinky(); prekresli(); }, 150);
  }

  window.addEventListener('scroll', naScroll, { passive: true });
  window.addEventListener('resize', naZmenuRozmeru);
  // po načtení písem se výška obsahu mění — linku je pak nutné přeměřit
  window.addEventListener('load', function () { prepocitejLinky(); prekresli(); });
  prepocitejLinky();
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
