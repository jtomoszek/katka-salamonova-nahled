/* Náhrada chybějících fotografií placeholderem.
   Až budou skutečné soubory v assets/img/ (katka-portret.webp,
   pripadova-studie.webp), placeholder se přestane používat sám. */
function nastavNahradyObrazku() {
  document.querySelectorAll('img[data-fallback]').forEach(function (img) {
    var swap = function () {
      var fb = img.getAttribute('data-fallback');
      if (fb && img.src.indexOf(fb) === -1) {
        img.src = fb;
        img.classList.add('je-placeholder');
      }
    };
    if (img.complete && img.naturalWidth === 0) swap();
    img.addEventListener('error', swap, { once: true });
  });
}

/* Paralax fotky v hero sekci.
   Fotka se při scrollu posouvá pomaleji než stránka, takže hero působí
   hlouběji. Rozsah posunu je v CSS proměnné --parallax-range.

   Výška hera se drží v proměnné a přepočítává jen při resize, takže
   v obsluze scrollu se nic neměří — jen se zapíše transform. Není proto
   potřeba requestAnimationFrame (ten se navíc ve skrytých panelech
   pozastavuje a efekt by zamrznul). */
function nastavParalax() {
  var hero = document.querySelector('.s--hero');
  var vrstva = document.querySelector('.hero-bg');
  if (!hero || !vrstva) return;

  var zpomalenyPohyb = window.matchMedia('(prefers-reduced-motion: reduce)');
  var rozsah = parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--parallax-range')
  ) || 0;

  var vyska = hero.offsetHeight;
  var bezi = false;
  var posledni = null;

  function prekresli() {
    if (!vyska) return;
    // 0 na začátku sekce, 1 když je hero právě odscrollované pryč
    var postup = Math.min(Math.max(window.scrollY / vyska, 0), 1);
    var posun = (postup * rozsah).toFixed(2);
    if (posun === posledni) return;
    posledni = posun;
    vrstva.style.transform = 'translate3d(0,' + posun + 'px,0)';
  }

  function naResize() {
    vyska = hero.offsetHeight;
    prekresli();
  }

  function zapni() {
    if (bezi) return;
    bezi = true;
    window.addEventListener('scroll', prekresli, { passive: true });
    window.addEventListener('resize', naResize);
    naResize();
  }

  function vypni() {
    if (!bezi) return;
    bezi = false;
    window.removeEventListener('scroll', prekresli);
    window.removeEventListener('resize', naResize);
    vrstva.style.transform = '';
    posledni = null;
  }

  function podleNastaveni() {
    if (zpomalenyPohyb.matches) vypni();
    else zapni();
  }

  podleNastaveni();
  // Uživatel může předvolbu přepnout za běhu systému.
  if (zpomalenyPohyb.addEventListener) {
    zpomalenyPohyb.addEventListener('change', podleNastaveni);
  }
}

document.addEventListener('DOMContentLoaded', function () {
  nastavNahradyObrazku();
  nastavParalax();
});
