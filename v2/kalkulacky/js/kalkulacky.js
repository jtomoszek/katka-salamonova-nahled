/* Finanční kalkulačky.
 *
 * Každá sekce s atributem data-kalkulacka má posuvníky (data-vstup),
 * popisky hodnot (data-vypis) a výsledky (data-vystup). Skript načte
 * hodnoty, pošle je do funkce podle názvu kalkulačky a vrácené texty
 * rozdá do výsledků. Počítá se při každém pohnutí posuvníkem.
 *
 * Všechny výpočty jsou orientační a záměrně jednoduché: měsíční
 * připisování, žádné poplatky ani daně (kromě těch, které jsou u dané
 * kalkulačky výslovně uvedené).
 */
(function () {
  'use strict';

  /* ---------- formátování ---------- */

  var cislo = function (h) {
    return Math.round(h).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  };
  var kc = function (h) { return cislo(h) + '\u00a0Kč'; };
  var proc = function (h, des) {
    return h.toFixed(des === undefined ? 1 : des).replace('.', ',') + '\u00a0%';
  };
  var sklonuj = function (n, jeden, dva, pet) {
    return n === 1 ? jeden : (n >= 2 && n <= 4 ? dva : pet);
  };
  var roky = function (n) { return n + '\u00a0' + sklonuj(n, 'rok', 'roky', 'let'); };
  var mesicu = function (n) { return n + '\u00a0' + sklonuj(n, 'měsíc', 'měsíce', 'měsíců'); };
  var vek = function (n) { return n + '\u00a0' + sklonuj(n, 'rok', 'roky', 'let'); };

  /* Budoucí hodnota pravidelného měsíčního vkladu (na konci období). */
  function budouciHodnota(pocatek, mesicne, rocniVynos, pocetMesicu) {
    var r = rocniVynos / 100 / 12;
    if (Math.abs(r) < 1e-12) return pocatek + mesicne * pocetMesicu;
    var narust = Math.pow(1 + r, pocetMesicu);
    return pocatek * narust + mesicne * (narust - 1) / r;
  }

  /* ---------- jednotlivé kalkulačky ---------- */

  var KALKULACKY = {

    hypoteka: {
      popisky: {
        uver: kc,
        sazba: function (h) { return proc(h); },
        roky: roky
      },
      spocitej: function (v) {
        var pocetMesicu = v.roky * 12;
        var r = v.sazba / 100 / 12;
        // anuita: splátka je po celou dobu stejná
        var splatka = r ? v.uver * r / (1 - Math.pow(1 + r, -pocetMesicu)) : v.uver / pocetMesicu;
        var celkem = splatka * pocetMesicu;
        var uroky = celkem - v.uver;
        return {
          splatka: kc(splatka),
          celkem: kc(celkem),
          uroky: kc(uroky),
          preplaceni: proc(uroky / v.uver * 100, 0)
        };
      }
    },

    investice: {
      popisky: {
        jednorazove: kc,
        mesicne: kc,
        vynos: function (h) { return proc(h); },
        roky: roky
      },
      spocitej: function (v) {
        var pocetMesicu = v.roky * 12;
        var hodnota = budouciHodnota(v.jednorazove, v.mesicne, v.vynos, pocetMesicu);
        var vlozeno = v.jednorazove + v.mesicne * pocetMesicu;
        return {
          hodnota: kc(hodnota),
          vlozeno: kc(vlozeno),
          vynosCelkem: kc(hodnota - vlozeno),
          zhodnoceni: proc((hodnota - vlozeno) / vlozeno * 100, 0)
        };
      }
    },

    renta: {
      popisky: {
        vek: vek,
        odchod: function (h) { return h + '\u00a0letech'; },
        uspory: kc,
        mesicne: kc,
        vynos: function (h) { return proc(h); }
      },
      spocitej: function (v) {
        var let_ = Math.max(0, v.odchod - v.vek);
        var pocetMesicu = let_ * 12;
        var kapital = budouciHodnota(v.uspory, v.mesicne, v.vynos, pocetMesicu);
        var renta = kapital * 0.04 / 12;          // bezpečný výběr 4 % ročně
        var r = v.vynos / 100 / 12;

        /* Jak dlouho kapitál vydrží: když výnos pokryje výběr, nevyčerpá se.
           Jinak dopočítáme počet měsíců, než klesne na nulu. */
        var vydrzi;
        if (let_ === 0) {
          vydrzi = '—';
        } else if (kapital * r >= renta - 1e-9) {
          vydrzi = 'trvale';
        } else {
          var m = Math.log(renta / (renta - kapital * r)) / Math.log(1 + r);
          vydrzi = roky(Math.round(m / 12));
        }

        return {
          renta: kc(renta),
          kapital: kc(kapital),
          vklady: kc(v.uspory + v.mesicne * pocetMesicu),
          vydrzi: vydrzi
        };
      }
    },

    penzijni: {
      popisky: {
        vklad: kc,
        zamestnavatel: kc,
        vek: vek,
        odchod: function (h) { return h + '\u00a0letech'; }
      },
      spocitej: function (v) {
        var let_ = Math.max(0, v.odchod - v.vek);
        var pocetMesicu = let_ * 12;

        // státní příspěvek: 20 % z vlastního vkladu od 500 Kč, nejvýš 340 Kč
        var statMesicne = v.vklad >= 500 ? Math.min(340, Math.round(v.vklad * 0.2)) : 0;
        // daňový odpočet: z části vkladu nad 1 700 Kč, ročně nejvýš 48 000 Kč
        var odpocet = Math.min(Math.max(0, (v.vklad - 1700) * 12), 48000);

        var mesicniVklad = v.vklad + v.zamestnavatel + statMesicne;
        var nasporeno = budouciHodnota(0, mesicniVklad, v.fond, pocetMesicu);
        var vklady = v.vklad * pocetMesicu;
        var odZamestnavatele = v.zamestnavatel * pocetMesicu;
        var stat = statMesicne * pocetMesicu;

        return {
          nasporeno: kc(nasporeno),
          vklady: kc(vklady),
          odZamestnavatele: kc(odZamestnavatele),
          stat: kc(stat),
          zhodnoceni: kc(Math.max(0, nasporeno - vklady - odZamestnavatele - stat)),
          statMesicne: kc(statMesicne),
          dan: kc(odpocet * 0.15)
        };
      }
    },

    stavebni: {
      popisky: {
        vklad: kc,
        roky: roky,
        sazba: function (h) { return proc(h); }
      },
      spocitej: function (v) {
        /* Rok po roce: vklady se úročí měsíčně, státní podpora přibývá
           jednou ročně (5 % z ročního vkladu, nejvýš 1 000 Kč). */
        var r = v.sazba / 100 / 12;
        var zustatek = 0, podporaCelkem = 0;
        for (var rok = 0; rok < v.roky; rok++) {
          for (var m = 0; m < 12; m++) zustatek = zustatek * (1 + r) + v.vklad;
          var podpora = Math.min(v.vklad * 12 * 0.05, 1000);
          zustatek += podpora;
          podporaCelkem += podpora;
        }
        var vklady = v.vklad * 12 * v.roky;
        return {
          nasporeno: kc(zustatek),
          vklady: kc(vklady),
          podpora: kc(podporaCelkem),
          uroky: kc(Math.max(0, zustatek - vklady - podporaCelkem))
        };
      }
    },

    cil: {
      popisky: {
        cil: kc,
        mesice: function (h) {
          return h % 12 === 0 ? roky(h / 12) : mesicu(h);
        },
        vynos: function (h) { return proc(h); }
      },
      spocitej: function (v) {
        var r = v.vynos / 100 / 12;
        var mesicne = r
          ? v.cil * r / (Math.pow(1 + r, v.mesice) - 1)
          : v.cil / v.mesice;
        var vlozeno = mesicne * v.mesice;
        return {
          mesicne: kc(mesicne),
          vlozeno: kc(vlozeno),
          vynosCelkem: kc(Math.max(0, v.cil - vlozeno)),
          cilVysledek: kc(v.cil)
        };
      }
    }
  };

  /* ---------- obsluha ---------- */

  function obsluzKalkulacku(sekce) {
    var nazev = sekce.getAttribute('data-kalkulacka');
    var kalkulacka = KALKULACKY[nazev];
    if (!kalkulacka) return;

    var vstupy = [].slice.call(sekce.querySelectorAll('[data-vstup]'));

    function precti() {
      var v = {};
      vstupy.forEach(function (prvek) {
        var klic = prvek.getAttribute('data-vstup');
        if (prvek.type === 'radio') {
          if (prvek.checked) v[klic] = parseFloat(prvek.value);
        } else {
          v[klic] = parseFloat(prvek.value);
        }
      });
      return v;
    }

    function prepocitej() {
      var v = precti();

      // popisky u posuvníků
      Object.keys(kalkulacka.popisky).forEach(function (klic) {
        var cil = sekce.querySelector('[data-vypis="' + klic + '"]');
        if (cil && v[klic] !== undefined) cil.textContent = kalkulacka.popisky[klic](v[klic]);
      });

      // výsledky
      var vysledky = kalkulacka.spocitej(v);
      Object.keys(vysledky).forEach(function (klic) {
        var cil = sekce.querySelector('[data-vystup="' + klic + '"]');
        if (cil) cil.textContent = vysledky[klic];
      });
    }

    vstupy.forEach(function (prvek) {
      prvek.addEventListener('input', prepocitej);
      prvek.addEventListener('change', prepocitej);
    });
    prepocitej();
  }

  document.querySelectorAll('[data-kalkulacka]').forEach(obsluzKalkulacku);
})();
