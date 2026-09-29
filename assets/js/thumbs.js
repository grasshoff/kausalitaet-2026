/* Kausalität 2026 — static diagram previews on the landing page (final state of a scene). */
(function () {
  'use strict';
  function init() {
    document.querySelectorAll('.thumb-fig[data-scene]').forEach(el => {
      try {
        const stage = window.KStage.make(el, el.dataset.scene, { thumb: true });
        if (stage) stage.update(JSON.parse(el.dataset.state || '{}'));
      } catch (err) { console.error(err); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
