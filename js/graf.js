/* Interaktivní graf k případové studii.
 *
 * Příběh z textu: klientovi je 42, portfolio je roztříštěné do deseti
 * produktů a ujídá ho inflace s poplatky. Cíl je renta 60 000 Kč měsíčně
 * od padesáti. Graf ukazuje, kdy se každá z obou cest protne s cílem.
 *
 * Model je vědomě jednoduchý a ilustrativní — výnosy jsou reálné,
 * tedy už po inflaci, a nejde o příslib. Návštěvník si hýbe se třemi
 * vstupy, které zná ze své situace: výchozí portfolio, měsíční investice
 * a cílová renta. Rozdíl mezi křivkami dělají poplatky a to, jestli
 * kapitál skutečně pracuje.
 */
(function () {
  'use strict';

  var M = {
    vekStart: 42,
    vekMax: 72,
    vynosTrh: 5.5,      // % p.a. reálně, po inflaci
    poplatekArch: 0.6,  // % p.a. — jeden provázaný celek
    poplatekPuv: 2.4,   // % p.a. — deset produktů vedle sebe
    neefektivita: 2.9,  // % p.a. — část kapitálu, která reálně nevydělává
    miraVyberu: 4       // % p.a. — bezpečný roční výběr z portfolia
  };

  var CESTY = [
    { klic: 'arch', nazev: 'Architektura', barva: 'var(--copper-dark)',
      vynos: (M.vynosTrh - M.poplatekArch) / 100 },
    { klic: 'puv', nazev: 'Původní nastavení', barva: 'var(--copper-light)',
      vynos: (M.vynosTrh - M.poplatekPuv - M.neefektivita) / 100 }
  ];

  var PLOCHA = { x0: 56, x1: 500, y0: 26, y1: 254 };
  var SIRKA = 520;
  var poradiInstance = 0;

  function kapital(roky, pocatek, mesicne, vynos) {
    var rocne = mesicne * 12;
    if (Math.abs(vynos) < 1e-9) return pocatek + rocne * roky;
    var r = Math.pow(1 + vynos, roky);
    return pocatek * r + rocne * (r - 1) / vynos;
  }

  function renta(kap) {
    return kap * (M.miraVyberu / 100) / 12;
  }

  /* Věk, ve kterém cesta poprvé dosáhne cílové renty. null = nedosáhne. */
  function vekCile(cesta, vstup) {
    var rozsah = M.vekMax - M.vekStart;
    var predchozi = renta(kapital(0, vstup.pocatek, vstup.mesicne, cesta.vynos));
    if (predchozi >= vstup.cil) return M.vekStart;
    for (var t = 0.25; t <= rozsah; t += 0.25) {
      var ted = renta(kapital(t, vstup.pocatek, vstup.mesicne, cesta.vynos));
      if (ted >= vstup.cil) {
        var podil = (vstup.cil - predchozi) / (ted - predchozi);
        return M.vekStart + (t - 0.25) + podil * 0.25;
      }
      predchozi = ted;
    }
    return null;
  }

  function kc(hodnota) {
    return Math.round(hodnota).toLocaleString('cs-CZ') + ' Kč';
  }

  function let_(pocet) {
    var n = Math.round(pocet);
    if (n === 1) return '1 rok';
    if (n >= 2 && n <= 4) return n + ' roky';
    return n + ' let';
  }

  function init(korenu) {
    var svg = korenu.querySelector('.graf__plocha');
    var odecet = korenu.querySelector('.graf__odecet');
    var shrnuti = korenu.querySelector('.graf__shrnuti');
    var popis = korenu.querySelector('.graf__popis');
    var vstupy = {
      pocatek: korenu.querySelector('[data-vstup="pocatek"]'),
      mesicne: korenu.querySelector('[data-vstup="mesicne"]'),
      cil: korenu.querySelector('[data-vstup="cil"]')
    };
    if (!svg || !vstupy.pocatek) return;

    var ns = 'http://www.w3.org/2000/svg';
    var idOrez = 'graf-orez-' + (++poradiInstance);

    // Křivky můžou vystoupat nad horní hranu — ořez je uřízne čistě,
    // místo aby se nahoře zploštily a předstíraly plató.
    var defs = document.createElementNS(ns, 'defs');
    var cp = document.createElementNS(ns, 'clipPath');
    cp.setAttribute('id', idOrez);
    var orez = document.createElementNS(ns, 'rect');
    orez.setAttribute('x', PLOCHA.x0 - 4);
    orez.setAttribute('y', PLOCHA.y0 - 14);
    orez.setAttribute('width', PLOCHA.x1 - PLOCHA.x0 + 8);
    orez.setAttribute('height', PLOCHA.y1 - PLOCHA.y0 + 18);
    cp.appendChild(orez);
    defs.appendChild(cp);
    svg.appendChild(defs);

    var vrstvy = {};
    ['mrizka', 'cil', 'kurzor', 'krivky', 'body', 'osy'].forEach(function (n) {
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'graf__' + n);
      if (n === 'krivky' || n === 'kurzor') g.setAttribute('clip-path', 'url(#' + idOrez + ')');
      svg.appendChild(g);
      vrstvy[n] = g;
    });

    var stav = null;

    function prectiVstupy() {
      return {
        pocatek: +vstupy.pocatek.value,
        mesicne: +vstupy.mesicne.value,
        cil: +vstupy.cil.value
      };
    }

    function el(jmeno, atributy) {
      var e = document.createElementNS(ns, jmeno);
      for (var k in atributy) e.setAttribute(k, atributy[k]);
      return e;
    }

    function prazdno(g) { while (g.firstChild) g.removeChild(g.firstChild); }

    function vykresli() {
      var vstup = prectiVstupy();
      var rozsah = M.vekMax - M.vekStart;

      // Osa Y se řídí cílem, ne koncem křivky — jinak by se cílová linka
      // zmáčkla dolů a protnutí, kvůli kterému tu graf je, by nebylo vidět.
      // Co vyroste nad horní hranu, ořízne clipPath.
      var maxRenta = vstup.cil * 2.2;
      var krok = Math.pow(10, Math.floor(Math.log10(maxRenta / 4)));
      var dilek = Math.ceil(maxRenta / 4 / krok) * krok;
      var vrchol = dilek * 4;

      var xOd = function (vek) {
        return PLOCHA.x0 + (vek - M.vekStart) / rozsah * (PLOCHA.x1 - PLOCHA.x0);
      };
      var yOd = function (r) {
        return PLOCHA.y1 - r / vrchol * (PLOCHA.y1 - PLOCHA.y0);
      };

      stav = { vstup: vstup, xOd: xOd, yOd: yOd, rozsah: rozsah };

      // mřížka + popisky osy Y
      prazdno(vrstvy.mrizka);
      for (var i = 0; i <= 4; i++) {
        var hod = dilek * i, y = yOd(hod);
        vrstvy.mrizka.appendChild(el('line', {
          x1: PLOCHA.x0, x2: PLOCHA.x1, y1: y, y2: y, class: 'graf__linka'
        }));
        var t = el('text', { x: PLOCHA.x0 - 10, y: y + 4, class: 'graf__popisek graf__popisek--y' });
        t.textContent = hod >= 1000 ? Math.round(hod / 1000) + ' tis.' : String(hod);
        vrstvy.mrizka.appendChild(t);
      }
      // popisky osy X
      prazdno(vrstvy.osy);
      for (var vek = M.vekStart; vek <= M.vekMax; vek += 6) {
        var tx = el('text', { x: xOd(vek), y: PLOCHA.y1 + 22, class: 'graf__popisek graf__popisek--x' });
        tx.textContent = vek;
        vrstvy.osy.appendChild(tx);
      }
      var osaNazev = el('text', { x: PLOCHA.x1, y: PLOCHA.y1 + 44, class: 'graf__popisek graf__popisek--osa' });
      osaNazev.textContent = 'věk';
      vrstvy.osy.appendChild(osaNazev);

      // cílová linka
      prazdno(vrstvy.cil);
      var yCil = yOd(vstup.cil);
      vrstvy.cil.appendChild(el('line', {
        x1: PLOCHA.x0, x2: PLOCHA.x1, y1: yCil, y2: yCil, class: 'graf__cilLinka'
      }));
      var stitek = el('text', { x: PLOCHA.x0 + 6, y: yCil - 8, class: 'graf__cilStitek' });
      stitek.textContent = 'cíl ' + kc(vstup.cil) + ' měsíčně';
      vrstvy.cil.appendChild(stitek);

      // křivky
      prazdno(vrstvy.krivky);
      prazdno(vrstvy.body);
      var dosazeno = {};
      CESTY.forEach(function (c) {
        var d = '';
        for (var t = 0; t <= rozsah; t += 0.5) {
          var r = renta(kapital(t, vstup.pocatek, vstup.mesicne, c.vynos));
          d += (t === 0 ? 'M' : 'L') + xOd(M.vekStart + t).toFixed(1) + ' ' + yOd(r).toFixed(1);
        }
        vrstvy.krivky.appendChild(el('path', {
          d: d, class: 'graf__krivka graf__krivka--' + c.klic, style: 'stroke:' + c.barva
        }));

        var vek = vekCile(c, vstup);
        dosazeno[c.klic] = vek;
        if (vek !== null && vek <= M.vekMax) {
          vrstvy.body.appendChild(el('circle', {
            cx: xOd(vek), cy: yCil, r: 6, class: 'graf__bod', style: 'fill:' + c.barva
          }));
          var lbl = el('text', {
            x: xOd(vek), y: yCil + 26, class: 'graf__bodStitek', style: 'fill:' + c.barva
          });
          lbl.textContent = Math.round(vek) + ' let';
          vrstvy.body.appendChild(lbl);
        }
      });

      poradi(dosazeno, vstup);
      ukazHodnoty(null);
    }

    function poradi(dosazeno, vstup) {
      var a = dosazeno.arch, p = dosazeno.puv;
      var veta;
      if (a === null) {
        veta = 'S těmito vstupy se cíl do ' + M.vekMax + ' let nepodaří naplnit ani jednou cestou. '
             + 'Zkuste vyšší měsíční investici nebo nižší cílovou rentu.';
      } else if (p === null) {
        veta = 'Architektura dosáhne cíle v ' + let_(a - M.vekStart) + ', tedy ve věku '
             + Math.round(a) + '. Původní nastavení se k němu do ' + M.vekMax + ' let nedostane vůbec.';
      } else {
        veta = 'Architektura dosáhne cíle ve věku ' + Math.round(a) + ', původní nastavení až ve '
             + Math.round(p) + '. Rozdíl je ' + let_(p - a) + ' svobody.';
      }
      shrnuti.textContent = veta;
      popis.textContent = 'Graf: dosažitelná měsíční renta podle věku. ' + veta;
    }

    function ukazHodnoty(vek) {
      if (!stav) return;
      var v = vek === null ? null : vek;
      prazdno(vrstvy.kurzor);

      // Bez kurzoru jen legenda a pobídka — čísla z pravého okraje osy
      // by mátla, protože nikam nepatří.
      var radky = CESTY.map(function (c) {
        var hodnota = '';
        if (v !== null) {
          var r = renta(kapital(v - M.vekStart, stav.vstup.pocatek, stav.vstup.mesicne, c.vynos));
          hodnota = ' <strong>' + kc(r) + '</strong>';
        }
        return '<span class="graf__legendaPolozka"><i style="background:' + c.barva + '"></i>'
             + c.nazev + hodnota + '</span>';
      });
      var hlavicka = v === null
        ? '<span class="graf__vyzva">Přejeďte po grafu</span>'
        : '<span class="graf__odecetVek">Ve věku ' + Math.round(v) + ' let</span>';
      odecet.innerHTML = hlavicka + radky.join('');

      if (v !== null) {
        var x = stav.xOd(v);
        vrstvy.kurzor.appendChild(el('line', {
          x1: x, x2: x, y1: PLOCHA.y0, y2: PLOCHA.y1, class: 'graf__vodic'
        }));
        CESTY.forEach(function (c) {
          var r = renta(kapital(v - M.vekStart, stav.vstup.pocatek, stav.vstup.mesicne, c.vynos));
          vrstvy.kurzor.appendChild(el('circle', {
            cx: x, cy: stav.yOd(r), r: 4.5, class: 'graf__kurzorBod', style: 'fill:' + c.barva
          }));
        });
      }
    }

    function vekZBodu(klientX) {
      var r = svg.getBoundingClientRect();
      var pomer = SIRKA / r.width;
      var x = (klientX - r.left) * pomer;
      var podil = (x - PLOCHA.x0) / (PLOCHA.x1 - PLOCHA.x0);
      podil = Math.min(Math.max(podil, 0), 1);
      return M.vekStart + podil * (M.vekMax - M.vekStart);
    }

    svg.addEventListener('pointermove', function (e) { ukazHodnoty(vekZBodu(e.clientX)); });
    svg.addEventListener('pointerleave', function () { ukazHodnoty(null); });

    Object.keys(vstupy).forEach(function (k) {
      vstupy[k].addEventListener('input', function () {
        korenu.querySelector('[data-vypis="' + k + '"]').textContent =
          k === 'cil' || k === 'mesicne' ? kc(+vstupy[k].value)
                                         : (+vstupy[k].value / 1000000).toFixed(1).replace('.', ',') + ' mil. Kč';
        vykresli();
      });
      vstupy[k].dispatchEvent(new Event('input'));
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-graf]').forEach(init);
  });
})();
