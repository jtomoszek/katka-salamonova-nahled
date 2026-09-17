/* Přihlášení k odběru novinek.
   Pošle adresu na Cloudflare Worker, ten odešle potvrzovací e-mail.
   Odběratelem se člověk stane až po kliknutí na odkaz v něm. */
(function () {
  var formular = document.getElementById('formular-novinky');
  if (!formular) return;

  var zprava = formular.querySelector('.novinky__zprava');
  var tlacitko = formular.querySelector('.novinky__tlacitko');
  var popisekTlacitka = tlacitko.textContent;

  function ukaz(text, typ) {
    zprava.textContent = text;
    zprava.className = 'novinky__zprava novinky__zprava--' + typ;
    zprava.hidden = false;
  }

  formular.addEventListener('submit', function (e) {
    e.preventDefault();
    zprava.hidden = true;

    var email = formular.email.value.trim();
    if (!email || !formular.email.checkValidity()) {
      ukaz('Zadejte prosím platnou e-mailovou adresu.', 'chyba');
      formular.email.focus();
      return;
    }
    if (!formular.souhlas.checked) {
      ukaz('Pro přihlášení je potřeba zaškrtnout souhlas.', 'chyba');
      formular.souhlas.focus();
      return;
    }

    tlacitko.disabled = true;
    tlacitko.textContent = 'Odesílám…';

    fetch('/api/newsletter/prihlasit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        jmeno: formular.jmeno.value.trim(),
        souhlas: true,
        web: formular.web.value,
      }),
    })
      .then(function (odpoved) {
        return odpoved.json().catch(function () { return {}; }).then(function (data) {
          if (!odpoved.ok) throw new Error(data.chyba || 'Přihlášení teď nefunguje. Zkuste to prosím později.');
        });
      })
      .then(function () {
        formular.reset();
        ukaz('Děkuji! Do schránky vám právě odešel e-mail s odkazem — odběr potvrdíte jedním kliknutím. Kdyby nedorazil, mrkněte do spamu.', 'ok');
      })
      .catch(function (err) {
        // Bez spojení (nebo na statickém náhledu bez serveru) fetch vůbec neprojde.
        ukaz(err instanceof TypeError ? 'Přihlášení teď nefunguje. Zkuste to prosím později.' : err.message, 'chyba');
      })
      .then(function () {
        tlacitko.disabled = false;
        tlacitko.textContent = popisekTlacitka;
      });
  });
})();
