/* Runs in <head> before first paint so saved accessibility choices never flash. */
(function () {
  var d = document.documentElement, p = {};
  try { p = JSON.parse(localStorage.getItem('iis-a11y') || '{}') || {}; } catch (e) {}
  var os = false; try { os = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  d.dataset.motion = p.motion === 'off' || (p.motion !== 'on' && os) ? 'off' : 'on';
  ['text', 'contrast', 'font', 'links'].forEach(function (k) { if (p[k]) d.dataset[k] = p[k]; });
})();
