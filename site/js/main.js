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

/* Příjezd prvků zprava při scrollu — časová osa profesních milníků.
   Samotný pohyb dělá CSS transition, tady se jen ve správnou chvíli
   přidá třída. Prvek se odkryje, jakmile jeho horní hrana vystoupá nad
   85 % výšky okna; jednou odkrytý už zůstane. Až jsou odkryté všechny,
   posluchač se odpojí. */
function nastavPrijezdy() {
  var prvky = [].slice.call(document.querySelectorAll('[data-prijezd]'));
  if (!prvky.length) return;

  var zpomalenyPohyb = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (zpomalenyPohyb.matches) return;

  // Až teď má smysl prvky schovat — bez JS zůstanou rovnou vidět.
  document.documentElement.classList.add('prijezdy-aktivni');

  function zkontroluj() {
    var prah = window.innerHeight * 0.85;
    prvky = prvky.filter(function (prvek) {
      if (prvek.getBoundingClientRect().top > prah) return true;
      prvek.classList.add('je-videt');
      return false;
    });
    if (!prvky.length) {
      window.removeEventListener('scroll', zkontroluj);
      window.removeEventListener('resize', zkontroluj);
    }
  }

  window.addEventListener('scroll', zkontroluj, { passive: true });
  window.addEventListener('resize', zkontroluj);
  zkontroluj();

  // Prohlížeč umí obnovit pozici scrollu až po DOMContentLoaded. Kdyby se
  // to stalo, první kontrola by proběhla nahoře a prvky by dole zůstaly
  // neviditelné, dokud uživatel nescrolluje. Kontrola po load to pojistí.
  window.addEventListener('load', zkontroluj, { once: true });
}

/* Plovoucí navigace: rozbalování na úzkém displeji a přitmavení skla,
   jakmile pod lištou začne projíždět obsah. */
function nastavNavigaci() {
  var nav = document.querySelector('.nav');
  if (!nav) return;

  var prepinac = nav.querySelector('.nav__prepinac');
  var odkazy = nav.querySelector('.nav__odkazy');

  if (prepinac && odkazy) {
    prepinac.addEventListener('click', function () {
      var otevreno = prepinac.getAttribute('aria-expanded') === 'true';
      prepinac.setAttribute('aria-expanded', String(!otevreno));
      prepinac.setAttribute('aria-label', otevreno ? 'Otevřít menu' : 'Zavřít menu');
      nav.classList.toggle('je-otevrena', !otevreno);
    });

    // Po kliknutí na odkaz nemá smysl nechat menu roztažené přes obsah.
    odkazy.addEventListener('click', function (e) {
      if (e.target.tagName !== 'A') return;
      prepinac.setAttribute('aria-expanded', 'false');
      prepinac.setAttribute('aria-label', 'Otevřít menu');
      nav.classList.remove('je-otevrena');
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !nav.classList.contains('je-otevrena')) return;
      prepinac.setAttribute('aria-expanded', 'false');
      prepinac.setAttribute('aria-label', 'Otevřít menu');
      nav.classList.remove('je-otevrena');
      prepinac.focus();
    });
  }

  var odscrollovano = false;
  function podleScrollu() {
    var ted = window.scrollY > 12;
    if (ted === odscrollovano) return;
    odscrollovano = ted;
    nav.classList.toggle('je-odscrollovano', ted);
  }
  window.addEventListener('scroll', podleScrollu, { passive: true });
  podleScrollu();
}

document.addEventListener('DOMContentLoaded', function () {
  nastavNavigaci();
  nastavNahradyObrazku();
  nastavParalax();
  nastavPrijezdy();
});
