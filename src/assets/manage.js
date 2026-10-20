/* /manage: the shared password decrypts the sheet link (sealed into the page by build.mjs) and forwards the browser to it.
   Nothing is sent anywhere; the link never appears in the published files in readable form. */
(function () {
  var form = document.getElementById('unlock'), msg = document.getElementById('unlock-msg');
  var opening = document.getElementById('opening'), link = document.getElementById('opening-link');
  var vault = JSON.parse(document.getElementById('vault').textContent);
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var fail = function (t) { msg.textContent = t; msg.hidden = false; };
  form.addEventListener('submit', async function (e) {
    e.preventDefault(); msg.hidden = true;
    if (!(window.crypto && crypto.subtle)) return fail('This browser cannot unlock the page. Try a current version of Chrome, Firefox, Safari or Edge.');
    var btn = form.querySelector('button'); btn.disabled = true; btn.textContent = 'Checking…';
    var url = null;
    try {
      var base = await crypto.subtle.importKey('raw', new TextEncoder().encode(document.getElementById('pw').value), 'PBKDF2', false, ['deriveKey']);
      var key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(vault.s), iterations: vault.n, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      url = new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(vault.i) }, key, b64(vault.c)));
    } catch (_) { fail('That password is not right.'); }
    btn.disabled = false; btn.textContent = 'Open the sheet';
    if (url) { link.href = url; form.hidden = true; opening.hidden = false; location.assign(url); }
  });
})();
