/* Pohyb druhé verze webu.
 *
 *  1) světelná linka se při scrollu vykresluje: obloukem přes titulní
 *     fotku, pak sjede dolů a skončí přesně na knoflíku přepínače —
 *     ten se v tu chvíli rozsvítí a doroste (--zrod),
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

  var linkaHero = document.querySelector('.linka--hero');
  var prsteny = [].slice.call(document.querySelectorAll('.linka__prstenec'));
  var linkaPanel = document.querySelector('.linka--panel');

  var ZLOM = 0.45;        // v jaké části sekce přepínač cvakne
  var KONEC_KRESBY = 0.3; // kdy linka dojede ke knoflíku

  function omez(h, min, max) { return h < min ? min : (h > max ? max : h); }

  /* ---------- tvar linky ---------- */

  /* Připraví SVG: viewBox v pixelech prvku a linku schová do dashoffsetu. */
  function nastavLinku(svg, d) {
    if (!svg) return 0;
    var cesta = svg.querySelector('path');
    var r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return 0;
    svg.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
    cesta.setAttribute('d', d);
    var delka = cesta.getTotalLength();
    cesta.style.strokeDasharray = delka;
    cesta.style.strokeDashoffset = omezitPohyb ? 0 : delka;
    return delka;
  }

  var delkaPanel = 0;
  var stredPrstence = null;

  /* Střed knoflíku v souřadnicích panelu. Měří se ve stavu „před zrodem“,
     kdy je dráha přepínače nejužší — přesně tam má linka skončit. */
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

  function prepocitejLinky() {
    // Prstenec kolem hlavy: velikost podle sekce, natočení řeší prekresli().
    if (hero && linkaHero && prsteny.length) {
      var h = hero.getBoundingClientRect();
      linkaHero.setAttribute('viewBox', '0 0 ' + Math.round(h.width) + ' ' + Math.round(h.height));
      var uzky = h.width < 700;
      stredPrstence = {
        x: h.width * 0.5,
        y: h.height * (uzky ? 0.33 : 0.36),
        rx: h.width * (uzky ? 0.36 : 0.19),
        ry: h.height * (uzky ? 0.3 : 0.34)
      };
    }

    if (panel && linkaPanel) {
      var p = panel.getBoundingClientRect();
      var k = stredKnofliku();
      if (k) {
        var W = p.width, H = p.height;
        // sjezd shora: navazuje na oblouk v heru a končí na knoflíku
        delkaPanel = nastavLinku(linkaPanel,
          'M ' + (k.x + W * 0.46).toFixed(1) + ' ' + (-H * 0.55).toFixed(1) +
          ' C ' + (k.x + W * 0.30).toFixed(1) + ' ' + (-H * 0.04).toFixed(1) +
          ' ' + (k.x - W * 0.34).toFixed(1) + ' ' + (H * 0.02).toFixed(1) +
          ' ' + (k.x - W * 0.20).toFixed(1) + ' ' + (k.y - H * 0.20).toFixed(1) +
          ' S ' + (k.x - W * 0.03).toFixed(1) + ' ' + (k.y - H * 0.02).toFixed(1) +
          ' ' + k.x.toFixed(1) + ' ' + k.y.toFixed(1));
      }
    }
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

    // 1) prstenec kolem hlavy se scrollem otáčí a staví se na hranu
    if (stredPrstence && !omezitPohyb) {
      var p1 = omez(window.scrollY / (oknoVyska * 1.1), 0, 1);
      var s1 = stredPrstence;
      // rx se zmenšuje = prstenec se natáčí k nám hranou
      var rx = s1.rx * (1 - 0.62 * p1);
      var uhel = -26 + 30 * p1;
      prsteny.forEach(function (e, i) {
        var o = i === 0 ? 1 : 0.88;   // druhá smyčka je o kus menší
        e.setAttribute('cx', s1.x.toFixed(1));
        e.setAttribute('cy', s1.y.toFixed(1));
        e.setAttribute('rx', Math.max(2, rx * o).toFixed(1));
        e.setAttribute('ry', (s1.ry * o).toFixed(1));
        e.setAttribute('transform', 'rotate(' + (uhel + i * 5).toFixed(1) + ' ' + s1.x.toFixed(1) + ' ' + s1.y.toFixed(1) + ')');
        // mezera ve stuze putuje dokola, ať prstenec „teče“
        var obvod = Math.PI * (3 * (rx * o + s1.ry * o) / 2);
        e.style.strokeDasharray = (obvod * 0.62).toFixed(1) + ' ' + (obvod * 0.38).toFixed(1);
        e.style.strokeDashoffset = (-obvod * (0.25 + p1 * 0.5)).toFixed(1);
      });
    }

    // 2) sekce filozofie se do fotky prolne a titulní obsah se rozplyne
    if (hero && prepinac) {
      var najeto = omez((oknoVyska - prepinac.getBoundingClientRect().top) / (oknoVyska * 0.85), 0, 1);
      prepinac.style.setProperty('--najeto', najeto.toFixed(3));
      koren.style.setProperty('--zmizeni', omez(najeto * 1.25, 0, 1).toFixed(3));
    }

    // 3) linka v panelu, zrod přepínače a jeho přehození
    var zapnuto = false;
    if (prepinac) {
      var drahaSticky = prepinac.offsetHeight - oknoVyska;
      var postup = drahaSticky > 0
        ? omez(-prepinac.getBoundingClientRect().top / drahaSticky, 0, 1)
        : 0;

      if (linkaPanel && delkaPanel && !omezitPohyb) {
        var kresba = omez(postup / KONEC_KRESBY, 0, 1);
        linkaPanel.querySelector('path').style.strokeDashoffset = delkaPanel * (1 - kresba);
        // z tečky, kterou linka přinesla, vyroste celý přepínač
        var zrod = omez((postup - KONEC_KRESBY * 0.92) / (KONEC_KRESBY * 0.5), 0, 1);
        prepinac.style.setProperty('--zrod', zrod.toFixed(3));
      }

      zapnuto = postup > ZLOM;
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
