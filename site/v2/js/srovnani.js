/* Důkaz místo slibů — srovnávací kalkulačka.
 *
 * Stejná měsíční částka, stejný počet let, dvě cesty: peníze odkládané
 * po svém (spořicí účet) a peníze v portfoliu postaveném s Katkou.
 * Sekce ukazuje graf obou křivek, vyplněný rozdíl mezi nimi a dvě
 * výsledná čísla.
 *
 * Model je záměrně jednoduchý a ilustrativní: měsíční připisování,
 * bez daní, poplatků a inflace. Výnosy jsou konstanty níže — před
 * spuštěním je potvrďte s Katkou.
 */
(function () {
  'use strict';

  var VYNOS_SAM = 2;      // % p.a. — spořicí účet, dlouhodobý průměr
  var VYNOS_KATKA = 6;    // % p.a. — dlouhodobé diverzifikované portfolio

  var obal = document.querySelector('[data-srovnani]');
  if (!obal) return;

  var omezitPohyb = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- formátování ---------- */

  var cislo = function (h) {
    return Math.round(h).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };
  var kc = function (h) { return cislo(h) + ' Kč'; };
  var proc = function (h) { return String(h).replace('.', ',') + ' %'; };
  var sklonuj = function (n, jeden, dva, pet) {
    return n === 1 ? jeden : (n >= 2 && n <= 4 ? dva : pet);
  };
  var roky = function (n) { return n + ' ' + sklonuj(n, 'rok', 'roky', 'let'); };

  /* Zůstatek po daném počtu měsíců při měsíčním vkladu a ročním výnosu. */
  function zustatek(mesicne, rocniVynos, pocetMesicu) {
    var r = rocniVynos / 100 / 12;
    if (Math.abs(r) < 1e-12) return mesicne * pocetMesicu;
    return mesicne * (Math.pow(1 + r, pocetMesicu) - 1) / r;
  }

  /* ---------- prvky ---------- */

  var vstupy = {
    mesicne: obal.querySelector('[data-vstup="mesicne"]'),
    roky: obal.querySelector('[data-vstup="roky"]')
  };
  var vypis = function (klic) { return obal.querySelector('[data-vypis="' + klic + '"]'); };
  var vystup = function (klic) { return obal.querySelector('[data-vystup="' + klic + '"]'); };

  var caraSam = obal.querySelector('.srovnani__cara--sam');
  var caraKatka = obal.querySelector('.srovnani__cara--katka');
  var rozdil = obal.querySelector('.srovnani__rozdil');

  // Rozměry kreslicí plochy odpovídají viewBox 0 0 600 240.
  var PLOCHA = { x0: 0, x1: 600, y0: 14, y1: 232 };

  vypis('vynosSam').textContent = proc(VYNOS_SAM);
  vypis('vynosKatka').textContent = proc(VYNOS_KATKA);

  /* ---------- graf ---------- */

  /* Křivku vzorkujeme po měsících; při 40 letech je to 480 bodů, což
     graf stále vykreslí okamžitě. */
  function body(mesicne, vynos, pocetMesicu, strop) {
    var out = [];
    for (var m = 0; m <= pocetMesicu; m++) {
      var x = PLOCHA.x0 + (PLOCHA.x1 - PLOCHA.x0) * m / pocetMesicu;
      var y = PLOCHA.y1 - (PLOCHA.y1 - PLOCHA.y0) * zustatek(mesicne, vynos, m) / strop;
      out.push([x, y]);
    }
    return out;
  }

  function cesta(b) {
    return b.map(function (p, i) {
      return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1);
    }).join(' ');
  }

  /* Čára má non-scaling-stroke a graf se roztahuje nestejnoměrně
     (preserveAspectRatio="none"), takže se čárkování počítá v pixelech
     obrazovky, ne ve viewBoxu. Délku proto sčítáme z bodů přepočtených
     na skutečné rozměry SVG. */
  var graf = obal.querySelector('.srovnani__graf');
  function delkaNaObrazovce(b) {
    var r = graf.getBoundingClientRect();
    var sx = r.width / 600, sy = r.height / 240;
    var delka = 0;
    for (var i = 1; i < b.length; i++) {
      var dx = (b[i][0] - b[i - 1][0]) * sx;
      var dy = (b[i][1] - b[i - 1][1]) * sy;
      delka += Math.sqrt(dx * dx + dy * dy);
    }
    return delka;
  }
  function nastavDelku(cara, b) {
    // malá rezerva, aby při zaokrouhlení nezůstal na konci kousek mezery
    cara.style.setProperty('--delka', (delkaNaObrazovce(b) + 4).toFixed(1));
  }

  /* ---------- přepočet ---------- */

  function prepocitej() {
    var mesicne = parseFloat(vstupy.mesicne.value);
    var pocetLet = parseInt(vstupy.roky.value, 10);
    var pocetMesicu = pocetLet * 12;

    var sam = zustatek(mesicne, VYNOS_SAM, pocetMesicu);
    var katka = zustatek(mesicne, VYNOS_KATKA, pocetMesicu);

    vypis('mesicne').textContent = kc(mesicne);
    vypis('roky').textContent = roky(pocetLet);
    vypis('polovina').textContent = 'za ' + roky(Math.round(pocetLet / 2));
    vypis('konec').textContent = 'za ' + roky(pocetLet);

    vystup('sam').textContent = kc(sam);
    vystup('katka').textContent = kc(katka);
    vystup('rozdil').textContent = '+' + kc(katka - sam);

    // svislé měřítko podle vyšší křivky, s malou rezervou nahoře
    var strop = katka * 1.04;
    var bSam = body(mesicne, VYNOS_SAM, pocetMesicu, strop);
    var bKatka = body(mesicne, VYNOS_KATKA, pocetMesicu, strop);

    caraSam.setAttribute('d', cesta(bSam));
    caraKatka.setAttribute('d', cesta(bKatka));
    // rozdíl: po horní křivce tam, po spodní zpět
    rozdil.setAttribute('d', cesta(bKatka) + ' ' + cesta(bSam.slice().reverse()).replace(/^M/, 'L') + ' Z');

    nastavDelku(caraSam, bSam);
    nastavDelku(caraKatka, bKatka);
  }

  Object.keys(vstupy).forEach(function (klic) {
    vstupy[klic].addEventListener('input', prepocitej);
    vstupy[klic].addEventListener('change', prepocitej);
  });
  prepocitej();

  // po změně rozměrů okna se mění i délka čar v pixelech
  var cekaRozmer;
  window.addEventListener('resize', function () {
    clearTimeout(cekaRozmer);
    cekaRozmer = setTimeout(prepocitej, 150);
  });

  /* ---------- nájezd ---------- */

  /* Čáry se poprvé dokreslí, až sekce najede do okna. Pak přejdou do
     „usazeného“ stavu, ve kterém posuvník mění graf bez animace. */
  function nakresli() {
    obal.classList.add('je-nakresleny');
    setTimeout(function () { obal.classList.add('je-usazeny'); }, 1700);
  }

  if (omezitPohyb || !('IntersectionObserver' in window)) {
    obal.classList.add('je-nakresleny', 'je-usazeny');
    return;
  }

  var pozorovatel = new IntersectionObserver(function (zaznamy) {
    if (!zaznamy.some(function (z) { return z.isIntersecting; })) return;
    nakresli();
    pozorovatel.disconnect();
  }, { threshold: 0.35 });
  pozorovatel.observe(obal);
})();
