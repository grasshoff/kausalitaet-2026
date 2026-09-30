/* PDAI landing pages — chart library (D3 v7).
   Every chart is drawn from a figure specification in window.SITE.figures[name]:
     { type, title, note, ... } written by build/facts/*.py from the collection data.
   A chart function takes a container element and the specification and returns
   { highlight(keys) }. highlight() dims every mark whose datum key is not listed;
   an empty list restores all marks. Types: columns, bars, strip, map. */
(function () {
  'use strict';

  const EN = (document.documentElement.lang || 'de').startsWith('en');
  const locale = d3.formatLocale(EN ? { decimal: '.', thousands: ',', grouping: [3], currency: ['€', ''] }
                                    : { decimal: ',', thousands: '.', grouping: [3], currency: ['', ' €'] });
  const fmt = locale.format(',d');
  const fmt1 = locale.format(',.1f');
  const C = {
    oxford: '#002147', oxfordSoft: '#2c4a6e', gold: '#c4a15a', goldDeep: '#8c6d2a', goldPale: '#efe3c4',
    line: '#e3d9c6', lineStrong: '#cdbfa4', muted: '#5c5348', ink: '#1b2733', paper: '#fffdf8',
  };
  const PALETTE = ['#002147', '#8c6d2a', '#3f7686', '#9a4f3c', '#5f6b3a', '#56708f', '#b8765f', '#6b8e8f', '#a8927a', '#c4a15a'];

  let tipEl = null;
  function showTip(evt, html) {
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'tip'; document.body.appendChild(tipEl); }
    tipEl.innerHTML = html;
    tipEl.style.opacity = 1;
    const x = Math.min(evt.clientX + 14, window.innerWidth - tipEl.offsetWidth - 10);
    const y = Math.min(evt.clientY + 14, window.innerHeight - tipEl.offsetHeight - 10);
    tipEl.style.left = x + 'px';
    tipEl.style.top = y + 'px';
  }
  function hideTip() { if (tipEl) tipEl.style.opacity = 0; }
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function frame(el, spec, W, H) {
    const root = d3.select(el);
    root.selectAll('*').remove();
    if (spec.title) root.append('p').attr('class', 'fig-title').text(spec.title);
    const s = root.append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img').attr('aria-label', spec.title || '');
    return s;
  }
  function legendFor(el, items) {
    if (!items || !items.length) return;
    const div = d3.select(el).append('div').attr('class', 'fig-legend');
    items.forEach(it => { const sp = div.append('span'); sp.append('i').style('background', it.color); sp.append('span').text(it.label); });
  }
  function noteFor(el, spec) { if (spec.note) d3.select(el).append('p').attr('class', 'fig-note').html(spec.note); }

  function colorOf(spec) {
    const groups = spec.groups || [];
    const map = new Map(groups.map((g, i) => [g.key, g.color || PALETTE[i % PALETTE.length]]));
    return { map, of: k => map.get(k) || C.oxford, legend: groups.map((g, i) => ({ color: g.color || PALETTE[i % PALETTE.length], label: g.label })) };
  }
  function dimmer(sel, keyOf) {
    return keys => {
      const on = !keys || !keys.length;
      const set = new Set(keys || []);
      sel.transition().duration(350).attr('opacity', d => (on || set.has(keyOf(d))) ? 1 : 0.22);
    };
  }
  function tipHtml(d, spec) {
    if (d.tip) return d.tip;
    const unit = spec.unit ? ' ' + esc(spec.unit) : '';
    return `<b>${esc(d.label)}</b><br>${fmt(d.v)}${unit}${d.group && spec.groupLabels ? '<br>' + esc(spec.groupLabels[d.group] || d.group) : ''}`;
  }

  const charts = {};

  /* ------------------------------------------------------------------ columns */
  charts.columns = function (el, spec) {
    const W = 760, H = spec.height || 340, m = { t: 22, r: 8, b: 44, l: 46 };
    const s = frame(el, spec, W, H);
    const data = spec.data;
    const col = colorOf(spec);
    const x = d3.scaleBand().domain(data.map(d => d.k)).range([m.l, W - m.r]).paddingInner(0.14);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.v) || 1]).nice().range([H - m.b, m.t]);
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(fmt)).call(g => g.select('.domain').remove());
    if (spec.ylabel) s.append('text').attr('class', 'lbl').attr('x', 0).attr('y', 12).text(spec.ylabel);
    const every = spec.tickEvery || Math.ceil(data.length / 14);
    const ticks = data.filter((d, i) => i % every === 0);
    const ax = s.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`);
    ax.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('stroke', C.lineStrong);
    ticks.forEach(d => ax.append('text').attr('x', x(d.k) + x.bandwidth() / 2).attr('y', 16).attr('text-anchor', 'middle').text(d.label ?? d.k));
    let bars;
    if (spec.stack) {
      // stacked columns: d.parts[key] per stack key, bottom to top in the order of spec.stack
      const segs = [];
      data.forEach(d => { let acc = 0; spec.stack.forEach(k => { const v = (d.parts && d.parts[k]) || 0; if (v) segs.push({ d, k, y0: acc, y1: acc + v }); acc += v; }); });
      bars = s.append('g').selectAll('rect').data(segs).join('rect')
        .attr('x', g => x(g.d.k)).attr('width', x.bandwidth()).attr('y', g => y(g.y1)).attr('height', g => y(g.y0) - y(g.y1))
        .attr('fill', g => col.of(g.k)).attr('rx', 0.5)
        .on('mousemove', (e, g) => showTip(e, `<b>${esc(g.d.label)}</b><br>${esc((spec.groups.find(q => q.key === g.k) || {}).label || g.k)}: ${fmt(g.y1 - g.y0)}`)).on('mouseleave', hideTip);
    } else {
      bars = s.append('g').selectAll('rect').data(data).join('rect')
        .attr('x', d => x(d.k)).attr('width', x.bandwidth()).attr('y', d => y(d.v)).attr('height', d => y(0) - y(d.v))
        .attr('fill', d => col.of(d.group)).attr('rx', 0.5)
        .on('mousemove', (e, d) => showTip(e, tipHtml(d, spec))).on('mouseleave', hideTip);
    }
    legendFor(el, col.legend);
    noteFor(el, spec);
    return { highlight: dimmer(bars, g => spec.stack ? (g.d.hk ?? g.d.k) : (g.hk ?? g.k)) };
  };

  /* ------------------------------------------------------------------ bars (horizontal) */
  charts.bars = function (el, spec) {
    const data = spec.data;
    const rowH = spec.rowHeight || 24;
    const m = { t: 8, r: 64, b: 10, l: spec.labelWidth || 210 };
    const W = 760, H = m.t + m.b + rowH * data.length;
    const s = frame(el, spec, W, H);
    const col = colorOf(spec);
    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.v) || 1]).range([m.l, W - m.r]);
    const row = s.append('g').selectAll('g').data(data).join('g')
      .attr('transform', (d, i) => `translate(0,${m.t + i * rowH})`)
      .on('mousemove', (e, d) => showTip(e, tipHtml(d, spec))).on('mouseleave', hideTip);
    row.append('text').attr('class', 'lbl').attr('x', m.l - 8).attr('y', rowH / 2 + 4).attr('text-anchor', 'end')
      .text(d => (d.label.length > 34 ? d.label.slice(0, 33) + '…' : d.label));
    row.append('rect').attr('x', m.l).attr('y', 4).attr('height', rowH - 9).attr('width', d => Math.max(1, x(d.v) - m.l))
      .attr('fill', d => col.of(d.group));
    row.append('text').attr('class', 'lbl').attr('x', d => x(d.v) + 6).attr('y', rowH / 2 + 4).text(d => (spec.valueLabel ? spec.valueLabel(d) : fmt(d.v)));
    legendFor(el, col.legend);
    noteFor(el, spec);
    return { highlight: dimmer(row, d => d.hk ?? d.k) };
  };

  /* ------------------------------------------------------------------ strip: sorted dots with error bars */
  charts.strip = function (el, spec) {
    const W = 760, H = spec.height || 380, m = { t: 20, r: 12, b: 44, l: 52 };
    const s = frame(el, spec, W, H);
    const data = spec.data.slice();
    const col = colorOf(spec);
    const x = d3.scalePoint().domain(data.map(d => d.k)).range([m.l + 6, W - m.r - 6]).padding(0.2);
    const lo = d3.min(data, d => d.v - (d.err || 0)), hi = d3.max(data, d => d.v + (d.err || 0));
    const y = d3.scaleLinear().domain(spec.domain || [Math.floor(lo / 5) * 5, Math.ceil(hi / 5) * 5]).range([H - m.b, m.t]);
    s.append('g').attr('class', 'axis').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6));
    if (spec.ylabel) s.append('text').attr('class', 'lbl').attr('x', 0).attr('y', 12).text(spec.ylabel);
    (spec.refLines || []).forEach(r => {
      s.append('line').attr('x1', m.l).attr('x2', W - m.r).attr('y1', y(r.v)).attr('y2', y(r.v)).attr('stroke', C.gold).attr('stroke-dasharray', '4 3');
      s.append('text').attr('class', 'lbl').attr('x', W - m.r - 2).attr('y', y(r.v) - 4).attr('text-anchor', 'end').attr('fill', C.goldDeep).text(r.label);
    });
    const g = s.append('g').selectAll('g').data(data).join('g')
      .on('mousemove', (e, d) => showTip(e, tipHtml(d, spec))).on('mouseleave', hideTip);
    g.filter(d => d.err).append('line').attr('x1', d => x(d.k)).attr('x2', d => x(d.k))
      .attr('y1', d => y(d.v - d.err)).attr('y2', d => y(d.v + d.err)).attr('stroke', C.lineStrong).attr('stroke-width', 1.2);
    g.append('circle').attr('cx', d => x(d.k)).attr('cy', d => y(d.v)).attr('r', spec.r || 3.2).attr('fill', d => col.of(d.group));
    s.append('text').attr('class', 'lbl').attr('x', m.l).attr('y', H - 10).text(spec.xlabel || '');
    legendFor(el, col.legend);
    noteFor(el, spec);
    return { highlight: dimmer(g, d => d.hk ?? d.k) };
  };

  /* ------------------------------------------------------------------ map */
  charts.map = function (el, spec) {
    const W = 760, H = spec.height || 400;
    const s = frame(el, spec, W, H);
    const col = colorOf(spec);
    const box = spec.box || [-12, 20, 48, 50];       // lon0, lat0, lon1, lat1
    const geo = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]], [box[0], box[1]]]] } };
    const proj = d3.geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], geo);
    const path = d3.geoPath(proj);
    const land = topojson.feature(window.WORLD110, window.WORLD110.objects.countries);
    s.append('g').selectAll('path').data(land.features || [land]).join('path').attr('d', path)
      .attr('fill', '#ece3d2').attr('stroke', '#cdbfa4').attr('stroke-width', 0.5);
    const pts = s.append('g').selectAll('circle').data(spec.data).join('circle')
      .attr('cx', d => proj([d.lon, d.lat])[0]).attr('cy', d => proj([d.lon, d.lat])[1])
      .attr('r', d => d.r || 3.4).attr('fill', d => col.of(d.group)).attr('fill-opacity', 0.78).attr('stroke', '#fff').attr('stroke-width', 0.6)
      .on('mousemove', (e, d) => showTip(e, tipHtml(d, spec))).on('mouseleave', hideTip);
    (spec.labels || []).forEach(l => {
      const p = proj([l.lon, l.lat]);
      s.append('text').attr('class', 'lbl-serif').attr('x', p[0] + 6).attr('y', p[1] + 4).attr('fill', C.oxfordSoft).text(l.label);
    });
    legendFor(el, col.legend);
    noteFor(el, spec);
    return { highlight: dimmer(pts, d => d.group) };
  };

  window.SiteCharts = charts;
})();
