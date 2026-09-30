/* Ancient sundials — two chart types for window.SiteCharts (loaded after charts.js).

   dialhero  The shadow of the nodus on a conic sundial, seen along the polar axis.
             Closed forms of paper S2 (nodus on the axis, apex at distance d above it, d = 1):
               day circle of declination δ:   axial distance  l(δ) = d / (1 - tanα tanδ),  radius r(δ) = l(δ) tanα
               hour angle around the axis:    H, with  cos H0 = -tanφ tanδ  at sunrise and sunset
               seasonal hour k (0..12):       H = (k - 6)/6 · H0(δ)
             The hour network drawn is the exact one: curves through the seasonal-hour divisions of every day circle.
   astro     The astronomical picture of the dials with a determined latitude (values from the register,
             Skyfield, obliquity of the year -100), with the analytic curves of the latitude for comparison. */
(function () {
  'use strict';
  const EN = (document.documentElement.lang || 'de').startsWith('en');
  const T = (en, de) => (EN ? en : de);
  const C = { oxford: '#002147', oxfordSoft: '#2c4a6e', gold: '#c4a15a', goldDeep: '#8c6d2a', goldPale: '#efe3c4', line: '#e3d9c6', lineStrong: '#cdbfa4', muted: '#5c5348', ink: '#1b2733', paper: '#fffdf8', teal: '#3f7686', brick: '#9a4f3c' };
  const rad = Math.PI / 180, deg = 180 / Math.PI;
  const num = (v, d = 1) => v.toFixed(d).replace('.', EN ? '.' : ',');
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];

  let tipEl = null;
  function tip(evt, html) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    if (html === null) { tipEl.style.opacity = 0; return; }
    tipEl.innerHTML = html; tipEl.style.opacity = 1;
    tipEl.style.left = Math.min(evt.clientX + 14, window.innerWidth - tipEl.offsetWidth - 10) + 'px';
    tipEl.style.top = Math.min(evt.clientY + 14, window.innerHeight - tipEl.offsetHeight - 10) + 'px';
  }

  /* ================================================================== dialhero */
  function dialhero(el, spec) {
    const eps = spec.eps;
    const tanE = Math.tan(eps * rad);
    const presets = spec.presets || [];
    const st = { phi: 37.97, alpha: 34.3, delta: eps, u: 0.25, play: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, preset: presets.length ? presets[0].id : 'free' };
    if (presets.length) { st.phi = presets[0].phi; st.alpha = presets[0].alpha; }

    const root = d3.select(el);
    root.selectAll('*').remove();
    const box = root.append('div').attr('class', 'sd-hero');
    const figure = box.append('div').attr('class', 'sd-fig');
    const side = box.append('div').attr('class', 'sd-side');
    const W = 560, H = 560, cx = W / 2, cy = H / 2 - 4, RP = 236;
    const svg = figure.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img')
      .attr('aria-label', T('Shadow of the nodus on a conic sundial, seen along the polar axis', 'Schatten des Nodus auf einer Kegelsonnenuhr, gesehen entlang der Polachse'));
    const gDial = svg.append('g'), gNet = svg.append('g'), gDay = svg.append('g'), gSun = svg.append('g');

    const x = () => Math.tan(st.alpha * rad) * tanE;
    const radius = dd => { const ta = Math.tan(st.alpha * rad); return ta / (1 - ta * Math.tan(dd * rad)); };
    const H0 = dd => { const c = -Math.tan(st.phi * rad) * Math.tan(dd * rad); return Math.acos(Math.max(-1, Math.min(1, c))); };
    // the noon direction points down; morning shadows fall to the right
    const pos = (r, h, s) => [cx - s * r * Math.sin(h), cy + s * r * Math.cos(h)];

    function draw() {
      const rMax = radius(eps), s = RP / (rMax * 1.06);
      gDial.selectAll('*').remove(); gNet.selectAll('*').remove(); gDay.selectAll('*').remove();
      gDial.append('circle').attr('cx', cx).attr('cy', cy).attr('r', RP).attr('fill', '#f3ead6').attr('stroke', C.lineStrong);
      gDial.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 3).attr('fill', C.oxford);
      gDial.append('text').attr('class', 'sd-lbl').attr('x', cx + 7).attr('y', cy - 6).attr('fill', C.oxford).text(T('nodus (on the axis)', 'Nodus (auf der Achse)'));
      // the three classical day circles
      [[-eps, T('winter solstice', 'Wintersonnenwende'), C.teal], [0, T('equinox', 'Tagundnachtgleiche'), C.goldDeep], [eps, T('summer solstice', 'Sommersonnenwende'), C.brick]].forEach(([d, lab, col], i) => {
        const r = radius(d) * s;
        gNet.append('circle').attr('cx', cx).attr('cy', cy).attr('r', r).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1).attr('stroke-dasharray', '5 4').attr('opacity', 0.75);
        gNet.append('text').attr('class', 'sd-lbl').attr('x', cx - 4).attr('y', cy - r - 4 - (i === 1 ? 0 : 0)).attr('text-anchor', 'end').attr('fill', col).text(lab);
      });
      // seasonal hour curves: each passes through the k-th division of every day circle
      const ds = d3.range(-eps, eps + 1e-9, eps / 24);
      for (let k = 0; k <= 12; k++) {
        const pts = ds.map(d => pos(radius(d) * s, (k - 6) / 6 * H0(d), 1));
        gNet.append('path').attr('d', d3.line()(pts)).attr('fill', 'none').attr('stroke', k === 6 ? C.oxford : C.oxfordSoft)
          .attr('stroke-width', k === 6 ? 1.6 : 0.8).attr('opacity', k === 6 ? 0.9 : 0.55);
      }
      for (let k = 1; k <= 12; k++) {
        const p = pos(radius(eps) * s * 1.05, (k - 0.5 - 6) / 6 * H0(eps), 1);
        gNet.append('text').attr('class', 'sd-hour').attr('x', p[0]).attr('y', p[1] + 4).attr('text-anchor', 'middle').text(ROMAN[k - 1]);
      }
      // the chosen day
      const r = radius(st.delta) * s, h0 = H0(st.delta);
      const arc = d3.range(-h0, h0 + 1e-9, h0 / 60).map(h => pos(r, h, 1));
      gDay.append('path').attr('d', d3.line()(arc)).attr('fill', 'none').attr('stroke', C.oxford).attr('stroke-width', 3.2).attr('stroke-linecap', 'round');
      st.scale = s;
    }

    function place() {
      const s = st.scale, h0 = H0(st.delta), h = -h0 + 2 * h0 * st.u, r = radius(st.delta) * s;
      const tipP = pos(r, h, 1), far = pos(RP * 1.0 + 26, h, 1), sun = [2 * cx - far[0], 2 * cy - far[1]];
      gSun.selectAll('*').remove();
      gSun.append('line').attr('x1', cx).attr('y1', cy).attr('x2', tipP[0]).attr('y2', tipP[1]).attr('stroke', C.ink).attr('stroke-width', 3).attr('stroke-linecap', 'round');
      gSun.append('line').attr('x1', tipP[0]).attr('y1', tipP[1]).attr('x2', sun[0]).attr('y2', sun[1]).attr('stroke', C.gold).attr('stroke-width', 1.2).attr('stroke-dasharray', '2 5');
      gSun.append('circle').attr('cx', tipP[0]).attr('cy', tipP[1]).attr('r', 6.5).attr('fill', C.gold).attr('stroke', C.oxford).attr('stroke-width', 1.6);
      const inside = Math.hypot(sun[0] - cx, sun[1] - cy);
      const sp = inside > RP + 6 ? sun : [cx + (sun[0] - cx) * (RP + 18) / inside, cy + (sun[1] - cy) * (RP + 18) / inside];
      gSun.append('circle').attr('cx', sp[0]).attr('cy', sp[1]).attr('r', 11).attr('fill', '#e8c56b').attr('stroke', C.goldDeep);
      readout();
    }

    // ---- side panel
    const pre = side.append('div').attr('class', 'sd-ctrl');
    pre.append('label').text(T('Object', 'Objekt'));
    const sel = pre.append('select').attr('aria-label', T('Object', 'Objekt'));
    presets.forEach(p => sel.append('option').attr('value', p.id).text(`ObjID ${p.id} · ${p.sub.split(',')[0]} · φ ${num(p.phi, 2)}° · α ${num(p.alpha, 1)}°`));
    sel.append('option').attr('value', 'free').text(T('free choice', 'freie Wahl'));
    sel.property('value', st.preset);
    sel.on('change', function () {
      st.preset = this.value;
      const p = presets.find(q => q.id === this.value);
      if (p) { st.phi = p.phi; st.alpha = p.alpha; syncSliders(); draw(); place(); }
    });
    function slider(label, key, min, max, step, fmt, onchange) {
      const row = side.append('div').attr('class', 'sd-ctrl');
      const lab = row.append('label'); const name = lab.append('span').text(label); const val = lab.append('b');
      const inp = row.append('input').attr('type', 'range').attr('min', min).attr('max', max).attr('step', step).attr('aria-label', label);
      const sync = () => { inp.property('value', st[key]); val.text(fmt(st[key])); };
      inp.on('input', function () { st[key] = +this.value; val.text(fmt(st[key])); if (onchange) onchange(); });
      sync();
      return sync;
    }
    const s1 = slider(T('Latitude φ', 'Breite φ'), 'phi', 20, 55, 'any', v => num(v, 2) + '°', () => { st.preset = 'free'; sel.property('value', 'free'); draw(); place(); });
    const s2 = slider(T('Cone half-angle α', 'Kegel-Halbwinkel α'), 'alpha', 15, 55, 0.1, v => num(v, 1) + '°', () => { st.preset = 'free'; sel.property('value', 'free'); draw(); place(); });
    const s3 = slider(T('Day (solar declination δ)', 'Tag (Sonnendeklination δ)'), 'delta', -eps, eps, 'any', v => (v >= 0 ? '+' : '−') + num(Math.abs(v), 1) + '°', () => { draw(); place(); });
    const s4 = slider(T('Time of day', 'Tageszeit'), 'u', 0, 1, 0.002, v => T('hour ', 'Stunde ') + num(v * 12, 1), () => { st.play = false; btn.text(T('Play', 'Abspielen')); place(); });
    function syncSliders() { s1(); s2(); s3(); s4(); }
    const quick = side.append('div').attr('class', 'sd-quick');
    [[-eps, T('Winter', 'Winter')], [0, T('Equinox', 'Äquinoktium')], [eps, T('Summer', 'Sommer')]].forEach(([d, lab]) =>
      quick.append('button').attr('type', 'button').text(lab).on('click', () => { st.delta = d; s3(); draw(); place(); }));
    const btn = quick.append('button').attr('type', 'button').attr('class', 'play').text(st.play ? T('Pause', 'Pause') : T('Play', 'Abspielen'))
      .on('click', () => { st.play = !st.play; btn.text(st.play ? T('Pause', 'Pause') : T('Play', 'Abspielen')); });
    const out = side.append('div').attr('class', 'sd-read');
    function readout() {
      const h0 = H0(st.delta), xx = x(), L = 2 * h0 * deg / 15;
      out.html(
        `<p><b>${T('Day length', 'Tageslänge')}</b> ${num(L, 1)} h · <b>${T('seasonal hour', 'Temporalstunde')}</b> ${num(L * 5, 0)} min</p>` +
        `<p><b>${T('Workshop rule', 'Werkstattregel')}</b> x = tan α · tan ε = ${num(xx, 3)}; ${T('noon marks', 'Mittagsmarken')} ${num(1 / (1 + xx), 2)} : 1 : ${num(1 / (1 - xx), 2)}</p>` +
        `<p class="sd-hint">${T('Closed forms of paper S2; obliquity ε = ', 'Geschlossene Formeln des Aufsatzes S2; Schiefe ε = ')}${num(eps, 2)}° (${T('year −100', 'Jahr −100')}).</p>`);
    }

    draw(); place();
    let last = 0, raf = 0;
    function tick(ts) {
      if (!el.isConnected) return;
      if (st.play && ts - last > 16) { st.u += (ts - last) / 14000; if (st.u > 1) st.u = 0; s4(); place(); }
      last = ts; raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return { highlight() {} };
  }

  /* ================================================================== astro */
  function astro(el, spec) {
    const eps = spec.eps, data = spec.data.filter(d => d.phi != null && d.seasons);
    const Q = {
      noon_alt: { en: 'Noon altitude of the sun (°)', de: 'Mittagshöhe der Sonne (°)', f: (phi, d) => 90 - Math.abs(phi - d), dom: [0, 90] },
      day_length: { en: 'Day length (hours)', de: 'Tageslänge (Stunden)', f: (phi, d) => 2 * Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi * rad) * Math.tan(d * rad)))) * deg / 15, dom: [0, 24] },
      seasonal_hour: { en: 'Length of a seasonal hour (minutes)', de: 'Länge einer Temporalstunde (Minuten)', f: (phi, d) => 2 * Math.acos(Math.max(-1, Math.min(1, -Math.tan(phi * rad) * Math.tan(d * rad)))) * deg / 15 * 5, dom: [0, 120] },
      noon_shadow: { en: 'Noon shadow of a gnomon of length 1', de: 'Mittagsschatten eines Gnomons der Länge 1', f: (phi, d) => 1 / Math.tan(Math.max(0.5, 90 - Math.abs(phi - d)) * rad), dom: [0, 4] },
    };
    const SEAS = [['WS', -eps, T('winter solstice', 'Wintersonnenwende'), C.teal], ['EQ', 0, T('equinox', 'Tagundnachtgleiche'), C.goldDeep], ['SS', eps, T('summer solstice', 'Sommersonnenwende'), C.brick]];
    let q = 'noon_alt';
    const root = d3.select(el); root.selectAll('*').remove();
    if (spec.title) root.append('p').attr('class', 'fig-title').text(spec.title);
    const bar = root.append('div').attr('class', 'sd-quick sd-qbar');
    const Wd = 760, Hd = 400, m = { t: 18, r: 14, b: 46, l: 52 };
    const svg = root.append('svg').attr('viewBox', `0 0 ${Wd} ${Hd}`).attr('preserveAspectRatio', 'xMidYMid meet').attr('role', 'img').attr('aria-label', spec.title || '');
    const x = d3.scaleLinear().domain([0, 65]).range([m.l, Wd - m.r]);
    const g = svg.append('g');
    const leg = root.append('div').attr('class', 'fig-legend');
    SEAS.forEach(([, , lab, col]) => { const sp = leg.append('span'); sp.append('i').style('background', col); sp.append('span').text(lab); });
    const sp = leg.append('span'); sp.append('i').style('background', 'transparent').style('border', `2px solid ${C.ink}`); sp.append('span').text(T('hollow: latitude provisional', 'hohl: Breite vorläufig'));
    if (spec.note) root.append('p').attr('class', 'fig-note').html(spec.note);

    function render() {
      const vals = [];
      data.forEach(d => SEAS.forEach(([k]) => vals.push(d.seasons[k][q])));
      const hi = d3.max(vals) * 1.08;
      const y = d3.scaleLinear().domain([0, q === 'noon_alt' ? 90 : Math.ceil(hi)]).nice().range([Hd - m.b, m.t]);
      g.selectAll('*').remove();
      g.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6)).call(a => a.select('.domain').remove());
      g.append('g').attr('class', 'axis').attr('transform', `translate(0,${Hd - m.b})`).call(d3.axisBottom(x).ticks(13).tickFormat(v => v + '°'));
      g.append('text').attr('class', 'lbl').attr('x', 0).attr('y', 11).text(T(Q[q].en, Q[q].de));
      g.append('text').attr('class', 'lbl').attr('x', x(32.5)).attr('y', Hd - 8).attr('text-anchor', 'middle').text(T('determined latitude φ of the dial', 'bestimmte Breite φ der Uhr'));
      SEAS.forEach(([k, dd, lab, col]) => {
        const pts = d3.range(0, 65.01, 0.5).map(phi => [x(phi), y(Q[q].f(phi, dd))]);
        g.append('path').attr('d', d3.line()(pts.filter(p => isFinite(p[1]) && p[1] <= y.range()[0] + 1))).attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.2).attr('opacity', 0.55);
      });
      SEAS.forEach(([k, , lab, col]) => {
        g.append('g').selectAll('circle').data(data).join('circle')
          .attr('cx', d => x(d.phi)).attr('cy', d => y(d.seasons[k][q])).attr('r', 3.6)
          .attr('fill', d => d.provisional ? C.paper : col).attr('stroke', d => d.provisional ? col : '#fff').attr('stroke-width', d => d.provisional ? 1.6 : 0.6).attr('fill-opacity', 0.85)
          .style('cursor', d => d.did ? 'pointer' : 'default')
          .on('mousemove', (e, d) => tip(e, `<b>ObjID ${esc(d.id)} · ${esc(d.sub)}</b><br>φ = ${num(d.phi, 2)}° ± ${num(d.sigma || 0, 2)}°${d.provisional ? ' (' + T('provisional', 'vorläufig') + ')' : ''}<br>${esc(d.klima || '')}<br>${esc(lab)}: ${num(d.seasons[k][q], 2)}<br>${T('grade', 'Güte')} ${esc(d.grade || '–')}${d.did ? '<br><i>' + T('click: object page', 'Klick: Objektseite') + '</i>' : ''}`))
          .on('mouseleave', () => tip(null, null))
          .on('click', (e, d) => { if (d.did) window.open(`${spec.repoBase}object/${d.did}`, '_blank', 'noopener'); });
      });
    }
    Object.keys(Q).forEach(k => bar.append('button').attr('type', 'button').attr('data-q', k).text(T(Q[k].en, Q[k].de).replace(/ \(.*\)/, ''))
      .on('click', function () { q = k; bar.selectAll('button').classed('on', function () { return this.dataset.q === q; }); render(); }));
    bar.selectAll('button').classed('on', function () { return this.dataset.q === q; });
    render();
    return { highlight() {} };
  }

  window.SiteCharts = Object.assign(window.SiteCharts || {}, { dialhero, astro });
})();
