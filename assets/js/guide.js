/* Reading-guide hint: the "Read first" sticker and banner on a landing page can be switched off.
   The card on the landing page stays either way. The state is kept per site in localStorage. */
(function () {
  'use strict';
  var slug = (document.currentScript && document.currentScript.dataset.slug) || '';
  var key = 'guide-hint:' + slug;
  var root = document.documentElement;
  function set(off) {
    root.classList.toggle('guide-off', off);
    try { if (off) localStorage.setItem(key, 'off'); else localStorage.removeItem(key); } catch (e) {}
  }
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-guide-off]')) set(true);
    else if (e.target.closest('[data-guide-on]')) set(false);
  });
})();
