/* Pohyb druhé verze webu.
 *
 *  1) titulní fotka z ostré měkne a lehce se přibližuje,
 *  2) přepínač SVOBODA cvakne, jakmile sekce projede zhruba do půlky;
 *     s ním se mění pozadí i zvýrazněný řádek (--zapnuto),
 *  3) sekce filozofie se do fotky prolne (--najeto),
 *  4) linky na pozadí sekcí se dokreslují, jak sekce projíždějí,
 *  5) v „Hranicích spolupráce“ se přepíná druhá číslice,
 *  6) časová osa profesních milníků se kreslí zleva doprava a body se
 *     rozsvěcejí, jakmile k nim linka dojede,
 *  7) lišta si podle podkladu pod sebou přepíná barvu písma,
 *  8) obsah sekcí najíždí zdola a menu jede přes celou obrazovku.
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
  var pribeh = document.querySelector('.sekce--pribeh');   // tmavá scéna s fotkou
  var lista = document.querySelector('.lista');
  var koren = document.documentElement;

  var valec = document.querySelector('.hranice__valec');
  var kroky = [].slice.call(document.querySelectorAll('.hranice__texty .krok'));

  // Časová osa milníků: obal nese dráhu, panel se v něm lepí.
  var osa = document.querySelector('[data-osa]');
  var osaVrstva = osa && osa.closest('.osa-vrstva');
  var osaPanel = osa && osa.closest('.osa-panel');
  var osaLinka = osa && osa.querySelector('.osa__linka');
  var osaBody = osa ? [].slice.call(osa.querySelectorAll('.osa__bod')) : [];

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

    // 5) časová osa: kolik už je nakresleno a které body svítí
    if (osa && osaLinka) {
      var postupOsy;
      if (omezitPohyb) {
        postupOsy = 1;
      } else if (osaVrstva && osaPanel && osaVrstva.offsetHeight - osaPanel.offsetHeight > 40) {
        // panel se lepí — dráhou je přesah obalu nad výšku panelu
        var drahaOsy = osaVrstva.offsetHeight - oknoVyska;
        postupOsy = drahaOsy > 0
          ? omez(-osaVrstva.getBoundingClientRect().top / drahaOsy, 0, 1)
          : 1;
      } else {
        /* Stojatá osa na úzkém displeji: kreslit se začne, jakmile její
           vršek vstoupí do spodní pětiny okna, a dokreslí se ve chvíli,
           kdy spodek vystoupá nad polovinu. */
        var rOsy = osa.getBoundingClientRect();
        var zacatek = oknoVyska * 0.85;
        var drahaStojate = rOsy.height + oknoVyska * 0.4;
        postupOsy = omez((zacatek - rOsy.top) / drahaStojate, 0, 1);
      }
      osa.style.setProperty('--postup', postupOsy.toFixed(3));

      /* Práh každého bodu čteme z rozvržení, ne z pevného čísla — osa je
         jednou na šířku a jednou na výšku a body nemusí být rozmístěné
         rovnoměrně. */
      var rLinky = osaLinka.getBoundingClientRect();
      var svisla = rLinky.height > rLinky.width;
      var delkaOsy = svisla ? rLinky.height : rLinky.width;
      if (delkaOsy > 0) {
        osaBody.forEach(function (bod) {
          var tecka = bod.querySelector('.osa__tecka');
          if (!tecka) return;
          var rT = tecka.getBoundingClientRect();
          var podil = svisla
            ? (rT.top + rT.height / 2 - rLinky.top) / delkaOsy
            : (rT.left + rT.width / 2 - rLinky.left) / delkaOsy;
          // první bod stojí na samém začátku — ať se nerozsvítí dřív,
          // než se linka vůbec rozjede
          bod.classList.toggle('je-tam', postupOsy >= Math.max(podil, 0.05));
        });
      }
    }

    // 6) linky na pozadí se dokreslují, jak jejich sekce projíždí
    if (!omezitPohyb) {
      pozadi.forEach(function (p) {
        if (!p.delka || !p.sekce) return;
        var r = p.sekce.getBoundingClientRect();
        var postupSekce = omez((oknoVyska - r.top) / (r.height * 0.7 + oknoVyska), 0, 1);
        p.cesta.style.strokeDashoffset = (p.delka * (1 - postupSekce)).toFixed(1);
      });
    }

    // 7) barva lišty podle toho, co je zrovna pod ní. Pořadí odpovídá
    //    vrstvení: patička je nad vším, sekce přepínače nad fotkou.
    if (lista) {
      var y = 34;
      var tmavePozadi = kryje(hero, y);
      if (kryje(prepinac, y)) tmavePozadi = !zapnuto;
      if (kryje(pribeh, y)) tmavePozadi = true;
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
