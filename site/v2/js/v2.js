/* Pohyb druhé verze webu.
 *
 *  1) dvě světelné stuhy se jedním tahem kreslí od začátku stránky:
 *     propletou se kolem hlavy a bez přerušení skončí na knoflíku
 *     přepínače — ten se v tu chvíli rozsvítí a doroste (--zrod),
 *     titulní fotka přitom z ostré měkne a lehce se přibližuje,
 *  2) přepínač SVOBODA cvakne, jakmile sekce projede zhruba do půlky;
 *     s ním se mění pozadí i zvýrazněný řádek (--zapnuto),
 *  3) oblouk, kterým sekce najíždí na fotku, se narovnává (--oblouk),
 *  4) lišta si podle podkladu pod sebou přepíná barvu písma,
 *  5) obsah sekcí najíždí zdola,
 *  6) menu přes celou obrazovku.
 *
 * Tvar linky se počítá z rozměrů sekcí, aby seděl na každém displeji.
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

  var plochaStuh = document.querySelector('.stuhy__plocha');
  var stuhy = [].slice.call(document.querySelectorAll('.stuha'));

  var ZLOM = 0.45;        // v jaké části sekce přepínač cvakne
  var KONEC_KRESBY = 0.3; // kdy linka dojede ke knoflíku

  function omez(h, min, max) { return h < min ? min : (h > max ? max : h); }

  /* ---------- tvar stuh ---------- */

  var delkyStuh = [];

  /* Střed knoflíku. Měří se ve stavu „před zrodem“, kdy je dráha přepínače
     nejužší — přesně tam mají stuhy skončit. Panel je v té chvíli přilepený
     k horní hraně, takže jeho souřadnice odpovídají souřadnicím v okně. */
  function stredKnofliku() {
    if (!knoflik || !panel || !prepinac) return null;
    var puvodni = prepinac.style.getPropertyValue('--zrod');
    prepinac.style.setProperty('--zrod', '0');
    var k = knoflik.getBoundingClientRect();
    var p = panel.getBoundingClientRect();
    if (puvodni) prepinac.style.setProperty('--zrod', puvodni);
    else prepinac.style.removeProperty('--zrod');
    return { x: k.left - p.left + k.width / 2, y: k.top - p.top + k.height / 2 };
  }

  /* Dvojice stuh podle videa: obě vycházejí ze stejného bodu nad
     obrazovkou, cestou se rozevřou do úzké čočky, u poloviny se zkříží
     a společně doputují na knoflík přepínače. Druhá stuha je jen ta
     samá páteř posunutá na opačnou stranu, proto drží pohromadě.

     strana = +1 / -1 určuje, na kterou stranu se stuha vyklene. */
  function tvarStuhy(W, H, k, strana) {
    // páteř: shora zprava obloukem přes hlavu, dolů doleva a zpět ke knoflíku
    var P0 = [W * 0.8, -H * 0.3];
    var C1 = [W * 0.94, H * 0.1];
    var C2 = [W * 0.32, H * 0.08];
    var M  = [W * 0.27, H * 0.4];    // spodní bod smyčky vlevo
    var C3 = [W * 0.21, H * 0.62];
    var C4 = [W * 0.88, H * 0.38];
    var K  = [k.x, k.y];

    // Kolmice k tětivě úseku — o ni se řídicí body odsunou a vznikne čočka.
    var kolmo = function (a, b, d) {
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var delka = Math.sqrt(dx * dx + dy * dy) || 1;
      return [-dy / delka * d, dx / delka * d];
    };
    var pos = function (bod, o) { return [bod[0] + o[0], bod[1] + o[1]]; };
    var z = function (bod) { return bod[0].toFixed(1) + ' ' + bod[1].toFixed(1); };

    var n1 = kolmo(P0, M, strana * W * 0.028);
    var n2 = kolmo(M, K, -strana * W * 0.022);   // opačně = zkřížení v bodě M

    return 'M ' + z(P0) +
      ' C ' + z(pos(C1, n1)) + ' ' + z(pos(C2, n1)) + ' ' + z(M) +
      ' C ' + z(pos(C3, n2)) + ' ' + z(pos(C4, n2)) + ' ' + z(K);
  }

  function prepocitejLinky() {
    if (!plochaStuh || !stuhy.length) return;
    var k = stredKnofliku();
    var r = plochaStuh.getBoundingClientRect();
    if (!k || !r.width || !r.height) return;

    plochaStuh.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
    delkyStuh = stuhy.map(function (cesta, i) {
      cesta.setAttribute('d', tvarStuhy(r.width, r.height, k, i === 0 ? 1 : -1));
      var delka = cesta.getTotalLength();
      cesta.style.strokeDasharray = delka;
      cesta.style.strokeDashoffset = omezitPohyb ? 0 : delka;
      return delka;
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
      koren.style.setProperty('--zmizeni', omez(najeto * 1.25, 0, 1).toFixed(3));
    }

    // 3) kreslení stuh, zrod přepínače a jeho přehození
    var zapnuto = false;
    if (prepinac) {
      var drahaSticky = prepinac.offsetHeight - oknoVyska;
      var postup = drahaSticky > 0
        ? omez(-prepinac.getBoundingClientRect().top / drahaSticky, 0, 1)
        : 0;

      if (stuhy.length && delkyStuh.length && !omezitPohyb && hero) {
        // Jeden tah od úplného začátku stránky ke knoflíku: nejdřív přes
        // titulní fotku, pak přes sekci filozofie.
        var draha = hero.offsetHeight + KONEC_KRESBY * drahaSticky;
        var kresba = omez(window.scrollY / draha, 0, 1);
        stuhy.forEach(function (cesta, i) {
          cesta.style.strokeDashoffset = (delkyStuh[i] * (1 - kresba)).toFixed(1);
        });
        // celá dvojice se přitom mírně stáčí
        koren.style.setProperty('--stoceni', (-7 + 13 * kresba).toFixed(2));
        // z tečky, kterou stuhy přinesly, vyroste celý přepínač
        var zrod = omez((postup - KONEC_KRESBY * 0.92) / (KONEC_KRESBY * 0.5), 0, 1);
        prepinac.style.setProperty('--zrod', zrod.toFixed(3));
      }

      zapnuto = postup > ZLOM;
      // po přepnutí je pozadí světlé, bílé stuhy by na něm zanikly
      koren.style.setProperty('--stuhy', zapnuto ? 0 : 1);
      prepinac.classList.toggle('je-zapnuto', zapnuto);
      prepinac.style.setProperty('--zapnuto', zapnuto ? 1 : 0);
    }

    // 4) barva lišty podle toho, co je zrovna pod ní. Pořadí odpovídá
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
