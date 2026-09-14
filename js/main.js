/* Náhrada chybějících fotografií placeholderem.
   Až budou skutečné soubory v assets/img/ (katka-portret.webp,
   pripadova-studie.webp), placeholder se přestane používat sám. */
document.addEventListener('DOMContentLoaded', function () {
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
});
