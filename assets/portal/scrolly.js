/* PDAI landing pages — scroll controller.
   <section class="chapter" data-figure="name"> holds text steps (.step) and one figure (.fig).
   The figure is drawn when the chapter approaches the viewport; the step in the middle of the
   viewport activates itself and passes its data-highlight list (comma separated keys) to the chart. */
(function () {
  'use strict';

  function draw(el, name) {
    const spec = window.SITE && window.SITE.figures && window.SITE.figures[name];
    const fn = spec && window.SiteCharts[spec.type];
    if (!fn) { el.innerHTML = (document.documentElement.lang || 'de').startsWith('en') ? `<p class="fig-note">No specification for the figure “${name}”.</p>` : `<p class="fig-note">Für die Grafik „${name}“ liegt keine Spezifikation vor.</p>`; return null; }
    try { return fn(el, spec); } catch (err) {
      el.innerHTML = `<p class="fig-note">Die Grafik „${name}“ konnte nicht gezeichnet werden: ${err.message}</p>`;
      console.error(err);
      return null;
    }
  }

  function init() {
    const chapters = Array.from(document.querySelectorAll('.chapter[data-figure]'));
    const instances = new Map();
    const ensure = ch => {
      if (!instances.has(ch)) instances.set(ch, draw(ch.querySelector('.fig'), ch.dataset.figure));
      return instances.get(ch);
    };

    const lazy = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { ensure(e.target); lazy.unobserve(e.target); } });
    }, { rootMargin: '600px 0px' });
    chapters.forEach(ch => lazy.observe(ch));

    const stepObs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const step = e.target;
        const ch = step.closest('.chapter');
        ch.querySelectorAll('.step').forEach(s => s.classList.toggle('active', s === step));
        const inst = ensure(ch);
        const keys = (step.dataset.highlight || '').split(',').map(s => s.trim()).filter(Boolean);
        if (inst && inst.highlight) inst.highlight(keys);
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('.chapter[data-figure] .step').forEach(s => stepObs.observe(s));

    document.querySelectorAll('.fig[data-chart]').forEach(el => draw(el, el.dataset.chart));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
