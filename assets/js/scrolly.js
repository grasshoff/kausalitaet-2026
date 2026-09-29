/* Kausalität 2026 — scroll controller.
   <section class="chapter" data-scene="name"> holds text steps (.step[data-step]) and one
   figure (.fig). The chapter's states are a JSON array in <script type="application/json"
   class="states">. The step in the middle of the viewport selects its state; the stage
   animates to it. Arrow keys and the step buttons move through the steps as well. */
(function () {
  'use strict';

  function init() {
    const chapters = Array.from(document.querySelectorAll('.chapter[data-scene]'));
    const inst = new Map();

    function ensure(ch) {
      if (inst.has(ch)) return inst.get(ch);
      let stage = null;
      try { stage = window.KStage.make(ch.querySelector('.fig'), ch.dataset.scene); } catch (err) {
        ch.querySelector('.fig').innerHTML = `<p class="fig-note">${err.message}</p>`;
        console.error(err);
      }
      const states = JSON.parse(ch.querySelector('script.states')?.textContent || '[]');
      const rec = { stage, states };
      inst.set(ch, rec);
      if (stage) stage.update(states[0] || {});
      return rec;
    }

    function activate(step) {
      const ch = step.closest('.chapter');
      ch.querySelectorAll('.step').forEach(s => s.classList.toggle('active', s === step));
      const rec = ensure(ch);
      const i = parseInt(step.dataset.step || '0', 10);
      if (rec.stage) rec.stage.update(rec.states[Math.min(i, rec.states.length - 1)] || {});
      const counter = ch.querySelector('.step-count');
      if (counter) counter.textContent = `${i + 1} / ${ch.querySelectorAll('.step').length}`;
    }

    const lazy = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        ensure(e.target);
        lazy.unobserve(e.target);
      });
    }, { rootMargin: '400px 0px' });
    chapters.forEach(ch => lazy.observe(ch));

    // The active step is the one whose centre is nearest the centre of the viewport.
    // (An IntersectionObserver only reports changes and misses a short step whose
    // neighbour already overlaps the middle band.)
    function pick() {
      chapters.forEach(ch => {
        const box = ch.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        // on narrow screens the figure is pinned at the top: measure the middle of the
        // text area below it
        const fig = ch.querySelector('.chapter-figure');
        const fr = fig ? fig.getBoundingClientRect() : null;
        const pinned = fr && getComputedStyle(fig).position === 'sticky' && fr.top <= 1;
        const top = pinned ? fr.bottom : 0;
        const mid = top + (window.innerHeight - top) / 2;
        let best = null, bestD = Infinity;
        ch.querySelectorAll('.step').forEach(s => {
          const r = s.getBoundingClientRect();
          const d = Math.abs((r.top + r.bottom) / 2 - mid);
          if (d < bestD) { bestD = d; best = s; }
        });
        if (best && !best.classList.contains('active')) activate(best);
      });
    }
    window.addEventListener('scroll', pick, { passive: true });
    window.addEventListener('resize', pick);

    // Deep link to a step: #k3-2 is chapter 3, step 2.
    function jump() {
      const m = location.hash.match(/^#k(\d+)-(\d+)$/);
      if (!m) return false;
      const ch = document.getElementById('k' + m[1]);
      const step = ch && ch.querySelectorAll('.step')[parseInt(m[2], 10) - 1];
      if (!step) return false;
      document.documentElement.style.scrollBehavior = 'auto';
      step.scrollIntoView({ block: 'center' });
      const fig = ch.querySelector('.chapter-figure');
      if (fig && getComputedStyle(fig).position === 'sticky') {
        const fr = fig.getBoundingClientRect(), sr = step.getBoundingClientRect();
        const target = fr.bottom + (window.innerHeight - fr.bottom) / 2;
        window.scrollBy(0, (sr.top + sr.bottom) / 2 - target);
      }
      activate(step);
      return true;
    }
    window.addEventListener('hashchange', jump);
    if (!jump()) pick();

    document.querySelectorAll('.chapter[data-scene] .step-nav button').forEach(btn => {
      btn.addEventListener('click', () => {
        const ch = btn.closest('.chapter');
        const steps = Array.from(ch.querySelectorAll('.step'));
        const cur = Math.max(0, steps.findIndex(s => s.classList.contains('active')));
        const next = Math.min(steps.length - 1, Math.max(0, cur + (btn.dataset.dir === 'next' ? 1 : -1)));
        steps[next].scrollIntoView({ behavior: 'smooth', block: 'center' });
        activate(steps[next]);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
