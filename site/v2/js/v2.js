/* Pohyb druhé verze webu.
 *
 *  1) světelná linka: smyčka kolem hlavy, která se při scrollu stáčí,
 *     zužuje a stoupá, zatímco její ocas doputuje na knoflík přepínače —
 *     ten se v tu chvíli rozsvítí a doroste (--zrod). Titulní fotka
 *     přitom z ostré měkne a lehce se přibližuje,
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

  var valec = document.querySelector('.hranice__valec');
  var kroky = [].slice.call(document.querySelectorAll('.hranice__texty .krok'));

  // Linky na pozadí obsahových sekcí — kreslí se, jak sekce projíždí.
  var pozadi = [].slice.call(document.querySelectorAll('.krivky')).map(function (obal) {
    return { cesta: obal.querySelector('path'), sekce: obal.closest('section'), delka: 0 };
  });

  var plochaStuh = document.querySelector('.stuhy__plocha');
  var stuha = document.querySelector('.stuha');

  var ZLOM = 0.45;        // v jaké části sekce přepínač cvakne
  var KONEC_KRESBY = 0.3; // kdy linka dojede ke knoflíku

  function omez(h, min, max) { return h < min ? min : (h > max ? max : h); }

  /* ---------- tvar stuh ---------- */

  /* Střed knoflíku. Měří se ve stavu „před zrodem“, kdy je dráha přepínače
     nejužší — přesně tam má linka skončit. Panel je v té chvíli přilepený
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

  /* Světelná linka je jedno „laso“: smyčka kolem hlavy plus ocas.
     Podle snímků ve složce podklady/Scroll se při scrollu proměňuje —
     smyčka se stáčí, zužuje a stoupá z obrazovky, ocas se natahuje
     a jeho konec doputuje přesně na knoflík přepínače.

     Tvar drží tři klíčové polohy (na začátku, v půlce, na konci) a mezi
     nimi se plynule přechází. Souřadnice jsou v dílech šířky a výšky
     okna, takže sedí na každém displeji. */
  var KLICE = [
    // smyčka kolem hlavy, ocas se z ní vyplétá doprava pod bradou
    { cx: .50, cy: .33, rx: .115, ry: .25, uhel: -16, od: 265, do: 565,
      t1x: .43, t1y: .54, t2x: .56, t2y: .53, tx: .625, ty: .47 },
    // smyčka se stáčí a zvedá, ocas míří dolů ke středu
    { cx: .53, cy: .14, rx: .085, ry: .16, uhel: -34, od: 250, do: 545,
      t1x: .44, t1y: .33, t2x: .50, t2y: .34, tx: .492, ty: .42 },
    // z obrazovky zbývá kus smyčky, ocas končí na knoflíku
    { cx: .56, cy: -.1, rx: .06, ry: .11, uhel: -52, od: 240, do: 530,
      t1x: .47, t1y: .06, t2x: .50, t2y: .2, tx: null, ty: null },
  ];

  function mezi(a, b, t) { return a + (b - a) * t; }

  function klicovaPoloha(p) {
    var i = p < 0.55 ? 0 : 1;
    var t = i === 0 ? p / 0.55 : (p - 0.55) / 0.45;
    var a = KLICE[i], b = KLICE[i + 1], v = {};
    for (var klic in a) {
      if (a[klic] === null || b[klic] === null) { v[klic] = b[klic] === null ? null : b[klic]; continue; }
      v[klic] = mezi(a[klic], b[klic], t);
    }
    return v;
  }

  function tvarSmycky(W, H, k, p) {
    var v = klicovaPoloha(omez(p, 0, 1));
    var cx = v.cx * W, cy = v.cy * H, rx = v.rx * W, ry = v.ry * H;
    var rad = v.uhel * Math.PI / 180;
    var cosR = Math.cos(rad), sinR = Math.sin(rad);

    // bod na natočené elipse pro daný úhel (ve stupních)
    var naElipse = function (st) {
      var u = st * Math.PI / 180;
      var x = rx * Math.cos(u), y = ry * Math.sin(u);
      return [cx + x * cosR - y * sinR, cy + x * sinR + y * cosR];
    };
    var z = function (b) { return b[0].toFixed(1) + ' ' + b[1].toFixed(1); };

    var zacatek = naElipse(v.od);
    var konecOblouku = naElipse(v.do);
    var velkyOblouk = Math.abs(v.do - v.od) > 180 ? 1 : 0;

    // konec ocasu: na konci animace přesně na knoflíku
    var konec = v.tx === null ? [k.x, k.y] : [v.tx * W, v.ty * H];

    return 'M ' + z(zacatek) +
      ' A ' + rx.toFixed(1) + ' ' + ry.toFixed(1) + ' ' + v.uhel.toFixed(1) +
      ' ' + velkyOblouk + ' 1 ' + z(konecOblouku) +
      ' C ' + z([v.t1x * W, v.t1y * H]) + ' ' + z([v.t2x * W, v.t2y * H]) + ' ' + z(konec);
  }

  var plochaRozmer = null;
  var stredKnoflikuBod = null;

  function prepocitejPozadi() {
    pozadi.forEach(function (p) {
      if (!p.cesta) return;
      p.delka = p.cesta.getTotalLength();
      p.cesta.style.strokeDasharray = p.delka;
      p.cesta.style.strokeDashoffset = omezitPohyb ? 0 : p.delka;
    });
  }

  function prepocitejLinky() {
    prepocitejPozadi();
    if (!plochaStuh || !stuha) return;
    var k = stredKnofliku();
    var r = plochaStuh.getBoundingClientRect();
    if (!k || !r.width || !r.height) return;
    plochaStuh.setAttribute('viewBox', '0 0 ' + Math.round(r.width) + ' ' + Math.round(r.height));
    plochaRozmer = { w: r.width, h: r.height };
    stredKnoflikuBod = k;
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

    // 3) kreslení stuh, zrod přepínače a jeho přehození
    var zapnuto = false;
    if (prepinac) {
      var drahaSticky = prepinac.offsetHeight - oknoVyska;
      var postup = drahaSticky > 0
        ? omez(-prepinac.getBoundingClientRect().top / drahaSticky, 0, 1)
        : 0;

      if (stuha && plochaRozmer && stredKnoflikuBod && !omezitPohyb && hero) {
        // Jeden průběh od začátku stránky ke knoflíku: nejdřív přes
        // titulní fotku, pak přes sekci filozofie.
        var draha = hero.offsetHeight + KONEC_KRESBY * drahaSticky;
        var postupLinky = omez(window.scrollY / draha, 0, 1);
        stuha.setAttribute('d', tvarSmycky(plochaRozmer.w, plochaRozmer.h, stredKnoflikuBod, postupLinky));

        // Na začátku se linka ještě dokresluje, pak už se jen proměňuje.
        var delka = stuha.getTotalLength();
        var kresba = omez(postupLinky / 0.18, 0, 1);
        stuha.style.strokeDasharray = delka;
        stuha.style.strokeDashoffset = (delka * (1 - kresba)).toFixed(1);

        // z tečky na konci linky vyroste celý přepínač
        var zrod = omez((postup - KONEC_KRESBY * 0.92) / (KONEC_KRESBY * 0.5), 0, 1);
        prepinac.style.setProperty('--zrod', zrod.toFixed(3));
      }

      zapnuto = postup > ZLOM;
      // po přepnutí je pozadí světlé, bílá linka by na něm zanikla
      koren.style.setProperty('--stuhy', zapnuto ? 0 : 1);
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
