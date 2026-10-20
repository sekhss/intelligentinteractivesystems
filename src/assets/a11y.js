/* Accessibility panel, shared by every page. Preferences persist in this browser only. */
(function () {
  var KEY = 'iis-a11y', root = document.documentElement;
  var os = matchMedia('(prefers-reduced-motion: reduce)');
  var prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) {}
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) {} };

  var api = window.IIS_A11Y = {
    motionOff: function () { return root.dataset.motion === 'off'; }
  };

  function apply() {
    root.dataset.motion = prefs.motion === 'off' || (prefs.motion !== 'on' && os.matches) ? 'off' : 'on';
    ['text', 'contrast', 'font', 'links'].forEach(function (k) { if (prefs[k]) root.dataset[k] = prefs[k]; else delete root.dataset[k]; });
    if (prefs.font === 'readable' && !document.getElementById('font-readable')) {
      var l = document.createElement('link');
      l.id = 'font-readable'; l.rel = 'stylesheet';
      l.href = 'https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:wght@400;700&display=swap';
      document.head.appendChild(l);
    }
    if (api.motionOff()) document.querySelectorAll('video[data-hover]').forEach(function (v) { v.pause(); v.closest('.thumb') && v.closest('.thumb').classList.remove('playing'); });
    document.dispatchEvent(new CustomEvent('a11ychange'));
  }
  os.addEventListener && os.addEventListener('change', apply);

  var OPTIONS = [
    { key: 'motion', label: 'Pause motion', hint: 'Stops animations, moving backgrounds and hover videos.',
      get: function () { return api.motionOff(); }, set: function (on) { prefs.motion = on ? 'off' : 'on'; } },
    { key: 'text', label: 'Larger text', hint: 'Makes all text 25% bigger.',
      get: function () { return prefs.text === 'large'; }, set: function (on) { if (on) prefs.text = 'large'; else delete prefs.text; } },
    { key: 'contrast', label: 'High contrast', hint: 'Black on white, strong borders, no decoration.',
      get: function () { return prefs.contrast === 'high'; }, set: function (on) { if (on) prefs.contrast = 'high'; else delete prefs.contrast; } },
    { key: 'font', label: 'Readable font', hint: 'Switches to Atkinson Hyperlegible, designed for low vision.',
      get: function () { return prefs.font === 'readable'; }, set: function (on) { if (on) prefs.font = 'readable'; else delete prefs.font; } },
    { key: 'links', label: 'Underline links', hint: 'Always underline links.',
      get: function () { return prefs.links === 'underline'; }, set: function (on) { if (on) prefs.links = 'underline'; else delete prefs.links; } }
  ];

  var host = document.getElementById('a11y');
  if (host) {
    host.innerHTML =
      '<button class="a11y-btn" type="button" aria-expanded="false" aria-controls="a11y-panel">' +
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="4.5" r="2"/><path d="M4 8.5l8 1.5 8-1.5M12 10v5m0 0l-3 6m3-6l3 6"/></svg>Accessibility</button>' +
      '<div class="a11y-panel" id="a11y-panel" role="group" aria-labelledby="a11y-title" hidden>' +
      '<h2 id="a11y-title">Make this site easier to use</h2><p>Saved on this device only.</p>' +
      OPTIONS.map(function (o) { return '<button class="sw" type="button" role="switch" data-opt="' + o.key + '"><span>' + o.label + '<small>' + o.hint + '</small></span><span class="track" aria-hidden="true"></span></button>'; }).join('') +
      '<button class="chip a11y-reset" type="button">Reset to defaults</button></div>';
    var btn = host.querySelector('.a11y-btn'), panel = host.querySelector('.a11y-panel');
    var sync = function () { OPTIONS.forEach(function (o) { host.querySelector('[data-opt="' + o.key + '"]').setAttribute('aria-checked', String(o.get())); }); };
    var toggle = function (open) { panel.hidden = !open; btn.setAttribute('aria-expanded', String(open)); };
    btn.addEventListener('click', function () { toggle(panel.hidden); if (!panel.hidden) panel.querySelector('.sw').focus(); });
    panel.addEventListener('click', function (e) {
      var s = e.target.closest('.sw');
      if (s) { var o = OPTIONS.filter(function (x) { return x.key === s.dataset.opt; })[0]; o.set(!o.get()); save(); apply(); sync(); }
      else if (e.target.closest('.a11y-reset')) { prefs = {}; save(); apply(); sync(); }
    });
    document.addEventListener('click', function (e) { if (!panel.hidden && !host.contains(e.target)) toggle(false); });
    host.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { toggle(false); btn.focus(); } });
    sync(); document.addEventListener('a11ychange', sync);
  }

  /* Hover-to-play video thumbnails: only ever play when motion is allowed. */
  function thumbFor(e) { var t = e.target.closest && e.target.closest('.item'); return t && t.querySelector('.thumb video[data-hover]'); }
  function play(v) { if (api.motionOff()) return; var p = v.play(); if (p && p.catch) p.catch(function () {}); v.closest('.thumb').classList.add('playing'); }
  function stop(v) { v.pause(); v.closest('.thumb').classList.remove('playing'); try { v.currentTime = 0; } catch (e) {} }
  document.addEventListener('pointerover', function (e) { if (e.pointerType !== 'mouse') return; var v = thumbFor(e); if (v && v.paused) play(v); });
  document.addEventListener('pointerout', function (e) { if (e.pointerType !== 'mouse') return; var v = thumbFor(e); if (v && !(e.target.closest('.item').contains(e.relatedTarget))) stop(v); });
  document.addEventListener('focusin', function (e) { var v = thumbFor(e); if (v && v.paused) play(v); });
  document.addEventListener('focusout', function (e) { var v = thumbFor(e); if (v && !(e.target.closest('.item').contains(e.relatedTarget))) stop(v); });

  apply();
})();
