/* Kausalität 2026 — animated stage for causal diagrams, coincidence tables and timelines.

   Graphemes follow the CVL standard of the volumes (causal-visuals.qmd):
     - every conjunct keeps its own arrow into the effect;
     - the conjuncts of one cluster are tied by an ARC across their shafts near the effect;
       the arc ends on the outermost shafts;
     - alternative clusters: separate arrows, no arc;
     - negation: one '¬' box on the shaft near the source;
     - arrowhead fill marks the level: hollow = causal regularity (event types),
       filled = instantiated regularity (the cluster that fired in this case);
     - token layer: shaded node = present in this case, dashed grey = absent.
   Colours are those of web/shared/identity.js in causal-architect.

   A scene (window.KSCENES[name]) has nodes {id: {x, y, label, cap: {de, en}}},
   clusters {id: {target, members: ["A", "~B"], bend: [..]}}, links (correlation lines),
   an optional table {cols, rows, extra} and an optional timeline {items}.
   A state (one per scroll step) may set:
     nodes, clusters, links    ids that are visible (default: all)
     struck                    clusters removed by a rule (red, dashed)
     active                    clusters that fired in the case (filled heads)
     drop {cluster: member}    one conjunct left out for a removal test
     focus                     node or cluster ids drawn with the gold halo
     token {id: 0|1}           token layer
     rows, dim, mark {i: "ok"|"no"|"key"}, cols    coincidence table
     items                     timeline entries lit
     note {de, en}             line under the figure */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const COL = {
    node: '#ffffff', nodeOn: '#dbe3ee', border: '#002147', borderOff: '#9aa7b6',
    text: '#0d1b2a', textOff: '#7c8794', edge: '#334e68', conj: '#b3902a',
    deleted: '#c62828', halo: '#cfb53b', bg: '#ffffff', corr: '#8c6d2a',
  };
  const DUR = 550;
  const lang = () => (document.documentElement.lang || 'de').slice(0, 2);
  const tr = v => (v && typeof v === 'object' && !Array.isArray(v)) ? (v[lang()] ?? v.de ?? '') : (v ?? '');

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  /* ------------------------------------------------------------ geometry */
  function nodeSize(label) { return { w: Math.max(42, 20 + 12 * label.length), h: 36 }; }

  function boundary(n, tx, ty) {
    const dx = tx - n.x, dy = ty - n.y;
    if (!dx && !dy) return { x: n.x, y: n.y };
    const s = Math.min((n.w / 2 + 3) / Math.abs(dx || 1e-9), (n.h / 2 + 3) / Math.abs(dy || 1e-9));
    return { x: n.x + dx * s, y: n.y + dy * s };
  }
  const quad = (p0, c, p1, t) => ({
    x: (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * c.x + t * t * p1.x,
    y: (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * c.y + t * t * p1.y,
  });
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  // point where the segment from outside point o to inside point q leaves the node's rectangle
  function rectExit(n, o, q) {
    const hw = n.w / 2 + 3, hh = n.h / 2 + 3;
    let lo = 0, hi = 1;
    const inside = p => Math.abs(p.x - n.x) <= hw && Math.abs(p.y - n.y) <= hh;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      const p = { x: o.x + (q.x - o.x) * mid, y: o.y + (q.y - o.y) * mid };
      if (inside(p)) hi = mid; else lo = mid;
    }
    return { x: o.x + (q.x - o.x) * hi, y: o.y + (q.y - o.y) * hi };
  }

  function shaft(src, tgt, bend, aim) {
    const q = aim || { x: tgt.x, y: tgt.y };
    const c0 = { x: (src.x + q.x) / 2, y: (src.y + q.y) / 2 };
    const len = Math.hypot(q.x - src.x, q.y - src.y) || 1;
    const nx = -(q.y - src.y) / len, ny = (q.x - src.x) / len;
    const c = { x: c0.x + nx * bend, y: c0.y + ny * bend };
    const p0 = boundary(src, c.x, c.y);
    const p1 = rectExit(tgt, c, q);
    const ang = Math.atan2(p1.y - c.y, p1.x - c.x);
    const tip = { x: p1.x, y: p1.y };
    const end = { x: tip.x - 4 * Math.cos(ang), y: tip.y - 4 * Math.sin(ang) };
    return { p0, c, p1: end, tip, ang };
  }
  // parameter t at which the shaft is at distance r from point q (searching from the head)
  function tAtDistance(s, q, r) {
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (dist(quad(s.p0, s.c, s.p1, mid), q) > r) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }
  function tAtArcLength(s, d) {
    let acc = 0, prev = s.p0;
    for (let i = 1; i <= 80; i++) {
      const p = quad(s.p0, s.c, s.p1, i / 80);
      acc += dist(prev, p);
      if (acc >= d) return i / 80;
      prev = p;
    }
    return 1;
  }

  function head(tip, ang) {
    const L = 12, W = 6.8;
    const x1 = tip.x - L * Math.cos(ang) - W * Math.sin(ang), y1 = tip.y - L * Math.sin(ang) + W * Math.cos(ang);
    const x2 = tip.x - L * Math.cos(ang) + W * Math.sin(ang), y2 = tip.y - L * Math.sin(ang) - W * Math.cos(ang);
    return `M${tip.x} ${tip.y} L${x1} ${y1} L${x2} ${y2} Z`;
  }

  /* ------------------------------------------------------------ diagram */
  function diagram(host, scene) {
    const W = scene.width || 640, H = scene.height || 360;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': tr(scene.title) || 'Diagramm' });
    host.appendChild(svg);
    const defs = el('defs', {}, svg);
    const f = el('filter', { id: `halo-${scene.id}`, x: '-40%', y: '-40%', width: '180%', height: '180%' }, defs);
    el('feGaussianBlur', { in: 'SourceAlpha', stdDeviation: '4', result: 'b' }, f);
    el('feFlood', { 'flood-color': COL.halo, 'flood-opacity': '0.85' }, f);
    el('feComposite', { in2: 'b', operator: 'in', result: 'g' }, f);
    const m = el('feMerge', {}, f); el('feMergeNode', { in: 'g' }, m); el('feMergeNode', { in: 'SourceGraphic' }, m);

    const gLinks = el('g', {}, svg), gEdges = el('g', {}, svg), gArcs = el('g', {}, svg),
      gNodes = el('g', {}, svg), gMarks = el('g', {}, svg);

    const nodes = {};
    for (const [id, n] of Object.entries(scene.nodes || {})) {
      nodes[id] = Object.assign({ id }, n, nodeSize(n.label || id));
    }

    // correlation links (no causal claim): dotted, no head
    const links = {};
    for (const [id, l] of Object.entries(scene.links || {})) {
      const a = nodes[l.a], b = nodes[l.b];
      const pa = boundary(a, b.x, b.y), pb = boundary(b, a.x, a.y);
      const g = el('g', { 'data-id': id }, gLinks);
      el('line', { x1: pa.x, y1: pa.y, x2: pb.x, y2: pb.y, stroke: COL.corr, 'stroke-width': 2, 'stroke-dasharray': '2,5', 'stroke-linecap': 'round' }, g);
      if (l.label) {
        const t = el('text', { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 - 8, 'text-anchor': 'middle', class: 'stage-lbl', fill: COL.corr }, g);
        t.textContent = tr(l.label);
      }
      links[id] = g;
    }

    // arrival points: all shafts into one target are spread across its edge, ordered by the
    // direction they come from, so that the conjuncts of a cluster are visibly apart where the
    // arc crosses them
    const SPREAD = 11;
    const incoming = {};
    for (const [id, c] of Object.entries(scene.clusters || {})) {
      c.members.forEach((mem, i) => {
        const src = nodes[mem.startsWith('~') ? mem.slice(1) : mem];
        (incoming[c.target] = incoming[c.target] || []).push({ id, i, src });
      });
    }
    const aimOf = {};
    for (const [t, list] of Object.entries(incoming)) {
      const tgt = nodes[t];
      const mean = Math.atan2(list.reduce((a, e) => a + Math.sin(Math.atan2(e.src.y - tgt.y, e.src.x - tgt.x)), 0),
        list.reduce((a, e) => a + Math.cos(Math.atan2(e.src.y - tgt.y, e.src.x - tgt.x)), 0));
      const rel = e => { let d = Math.atan2(e.src.y - tgt.y, e.src.x - tgt.x) - mean; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
      const sorted = list.slice().sort((a, b) => rel(a) - rel(b) || a.id.localeCompare(b.id) || a.i - b.i);
      const px = -Math.sin(mean), py = Math.cos(mean);
      const lim = Math.max(tgt.h, tgt.w) / 2 - 6;
      sorted.forEach((e, k) => {
        let off = (k - (sorted.length - 1) / 2) * SPREAD;
        off = Math.max(-lim, Math.min(lim, off));
        aimOf[`${e.id}|${e.i}`] = { x: tgt.x + px * off, y: tgt.y + py * off };
      });
    }

    // clusters: one shaft per member, arc across the shafts
    const clusters = {};
    for (const [id, c] of Object.entries(scene.clusters || {})) {
      const tgt = nodes[c.target];
      const parts = { edges: {}, heads: [], arc: null, negs: {}, g: el('g', { 'data-id': id }, gEdges) };
      const shafts = [];
      c.members.forEach((mem, i) => {
        const neg = mem.startsWith('~');
        const src = nodes[neg ? mem.slice(1) : mem];
        const bend = Array.isArray(c.bend) ? (c.bend[i] || 0) : (c.bend || 0);
        const s = shaft(src, tgt, bend, aimOf[`${id}|${i}`]);
        shafts.push(s);
        const eg = el('g', { 'data-member': mem }, parts.g);
        el('path', { d: `M${s.p0.x} ${s.p0.y} Q${s.c.x} ${s.c.y} ${s.p1.x} ${s.p1.y}`, fill: 'none', stroke: COL.edge, 'stroke-width': 2, class: 'shaft' }, eg);
        const h = el('path', { d: head(s.tip, s.ang), fill: COL.bg, stroke: COL.edge, 'stroke-width': 1.7, class: 'head' }, eg);
        parts.heads.push(h);
        if (neg) {
          const p = quad(s.p0, s.c, s.p1, tAtArcLength(s, 26));
          const sz = 19;
          el('rect', { x: p.x - sz / 2, y: p.y - sz / 2, width: sz, height: sz, rx: 3, fill: COL.bg, stroke: COL.edge, 'stroke-width': 1.5, class: 'negbox' }, eg);
          const t = el('text', { x: p.x, y: p.y + 5.5, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-size': 15, 'font-weight': 700, fill: COL.edge, class: 'negtxt' }, eg);
          t.textContent = '\u00ac';
        }
        parts.edges[mem] = eg;
      });
      if (shafts.length > 1) {
        const r = Math.max(tgt.w, tgt.h) / 2 + (c.arc || 30);
        const pts = shafts.map(s => quad(s.p0, s.c, s.p1, tAtDistance(s, tgt, r)));
        const angs = pts.map(p => Math.atan2(p.y - tgt.y, p.x - tgt.x));
        const mean = Math.atan2(angs.reduce((a, x) => a + Math.sin(x), 0), angs.reduce((a, x) => a + Math.cos(x), 0));
        const rel = angs.map(x => { let d = x - mean; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; });
        const a1 = mean + Math.min(...rel), a2 = mean + Math.max(...rel);
        const q1 = { x: tgt.x + r * Math.cos(a1), y: tgt.y + r * Math.sin(a1) };
        const q2 = { x: tgt.x + r * Math.cos(a2), y: tgt.y + r * Math.sin(a2) };
        parts.arc = el('path', { d: `M${q1.x} ${q1.y} A${r} ${r} 0 0 1 ${q2.x} ${q2.y}`, fill: 'none', stroke: COL.conj, 'stroke-width': 2.6, 'stroke-linecap': 'round' }, gArcs);
      }
      if (c.label) {
        const s0 = shafts[0];
        const p = quad(s0.p0, s0.c, s0.p1, 0.5);
        const t = el('text', { x: p.x + (c.label_dx || 0), y: p.y - 8 + (c.label_dy || 0), 'text-anchor': 'middle', class: 'stage-lbl' }, gMarks);
        t.textContent = tr(c.label);
        parts.label = t;
      }
      clusters[id] = parts;
    }

    // nodes on top
    const nodeEls = {};
    for (const n of Object.values(nodes)) {
      const g = el('g', { 'data-id': n.id, transform: `translate(${n.x},${n.y})` }, gNodes);
      const r = el('rect', { x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 9, fill: COL.node, stroke: COL.border, 'stroke-width': 1.6 }, g);
      const t = el('text', { x: 0, y: 6, 'text-anchor': 'middle', 'font-family': 'Georgia,serif', 'font-size': 18, 'font-style': 'italic', fill: COL.text }, g);
      t.textContent = n.label || n.id;
      let cap = null;
      if (n.cap) {
        const dy = n.cap_above ? -n.h / 2 - 9 : n.h / 2 + 16;
        cap = el('text', { x: n.cap_dx || 0, y: dy, 'text-anchor': 'middle', class: 'stage-cap' }, g);
        cap.textContent = tr(n.cap);
      }
      nodeEls[n.id] = { g, r, t, cap };
    }

    const d3sel = x => window.d3.select(x);

    function update(st) {
      const visNodes = st.nodes ? new Set(st.nodes) : null;
      const visCl = st.clusters ? new Set(st.clusters) : null;
      const visLinks = st.links ? new Set(st.links) : new Set();
      const struck = new Set(st.struck || []);
      const off = new Set(st.off || []);
      const active = new Set(st.active || []);
      const focus = new Set(st.focus || []);
      const drop = st.drop || {};
      const token = st.token || null;

      for (const [id, n] of Object.entries(nodeEls)) {
        const on = !visNodes || visNodes.has(id);
        const tk = token ? token[id] : undefined;
        d3sel(n.g).transition().duration(DUR).attr('opacity', on ? 1 : 0);
        d3sel(n.r).transition().duration(DUR)
          .attr('fill', tk === 1 ? COL.nodeOn : COL.node)
          .attr('stroke', tk === 0 ? COL.borderOff : COL.border)
          .attr('stroke-dasharray', tk === 0 ? '5,3' : 'none');
        d3sel(n.t).transition().duration(DUR).attr('fill', tk === 0 ? COL.textOff : COL.text);
        n.g.setAttribute('filter', focus.has(id) ? `url(#halo-${scene.id})` : '');
      }
      for (const [id, g] of Object.entries(links)) {
        d3sel(g).transition().duration(DUR).attr('opacity', visLinks.has(id) ? 1 : 0);
      }
      for (const [id, c] of Object.entries(clusters)) {
        const on = !visCl || visCl.has(id);
        const isStruck = struck.has(id);
        const isOff = off.has(id);
        const colr = isStruck ? COL.deleted : isOff ? COL.borderOff : COL.edge;
        d3sel(c.g).transition().duration(DUR).attr('opacity', on ? (isStruck ? 0.75 : isOff ? 0.45 : 1) : 0);
        for (const [mem, eg] of Object.entries(c.edges)) {
          const dropped = drop[id] === mem;
          const sh = eg.querySelector('.shaft');
          d3sel(sh).transition().duration(DUR).attr('stroke', dropped ? COL.borderOff : colr)
            .attr('stroke-dasharray', (isStruck || dropped || isOff) ? '7,5' : 'none');
          d3sel(eg).transition().duration(DUR).attr('opacity', dropped ? 0.35 : 1);
          eg.querySelectorAll('.negbox').forEach(x => d3sel(x).transition().duration(DUR).attr('stroke', colr));
          eg.querySelectorAll('.negtxt').forEach(x => d3sel(x).transition().duration(DUR).attr('fill', colr));
        }
        c.heads.forEach(h => d3sel(h).transition().duration(DUR)
          .attr('fill', active.has(id) ? colr : COL.bg).attr('stroke', colr));
        if (c.arc) {
          d3sel(c.arc).transition().duration(DUR).attr('opacity', on ? (isStruck ? 0.6 : isOff ? 0.4 : 1) : 0)
            .attr('stroke', isStruck ? COL.deleted : isOff ? COL.borderOff : COL.conj);
          c.arc.setAttribute('filter', focus.has(id) ? `url(#halo-${scene.id})` : '');
        }
        c.g.setAttribute('filter', focus.has(id) ? `url(#halo-${scene.id})` : '');
        if (c.label) d3sel(c.label).transition().duration(DUR).attr('opacity', on ? 1 : 0);
      }
    }
    return { update };
  }

  /* ------------------------------------------------------------ coincidence table */
  function table(host, spec) {
    const wrap = document.createElement('div');
    wrap.className = 'ctable-wrap';
    const t = document.createElement('table');
    t.className = 'ctable';
    const colSpecs = spec.cols.concat((spec.extra || []).map(x => x.col));
    const cols = colSpecs.map(c => (typeof c === 'object' ? (c.de || c.en) : c));
    const thead = t.createTHead().insertRow();
    const th0 = document.createElement('th'); th0.textContent = tr(spec.row_label || { de: 'Fall', en: 'case' }); thead.appendChild(th0);
    const colIdx = {};
    cols.forEach((c, i) => {
      const th = document.createElement('th');
      th.textContent = tr(colSpecs[i]);
      th.dataset.col = c; colIdx[c] = i;
      if (spec.outcome === c) th.classList.add('outcome');
      if (i >= spec.cols.length) th.classList.add('extra');
      thead.appendChild(th);
    });
    const thm = document.createElement('th'); thm.className = 'mark'; thead.appendChild(thm);
    const body = t.createTBody();
    const rowEls = spec.rows.map((r, i) => {
      const tr_ = body.insertRow();
      const td0 = tr_.insertCell(); td0.textContent = String(i + 1); td0.className = 'rn';
      const vals = r.concat((spec.extra || []).map(x => x.values[i]));
      vals.forEach((v, j) => {
        const td = tr_.insertCell();
        v = tr(v);
        td.textContent = v;
        td.dataset.col = cols[j];
        td.className = (v === 1 || v === '1') ? 'one' : (v === 0 || v === '0') ? 'zero' : 'num';
        if (spec.outcome === cols[j]) td.classList.add('outcome');
        if (j >= spec.cols.length) td.classList.add('extra');
      });
      const tm = tr_.insertCell(); tm.className = 'mark';
      return tr_;
    });
    t.appendChild(body);
    wrap.appendChild(t);
    host.appendChild(wrap);

    function update(st) {
      const lit = new Set(st.rows || []), dim = new Set(st.dim || []), mark = st.mark || {};
      const hc = new Set(st.cols || []);
      const showExtra = new Set(st.extra || []);
      rowEls.forEach((row, i) => {
        const n = i + 1;
        row.classList.toggle('lit', lit.has(n));
        row.classList.toggle('dim', dim.has(n));
        const m = mark[n];
        const cell = row.lastElementChild;
        cell.textContent = m === 'ok' ? '\u2713' : m === 'no' ? '\u2717' : m === 'key' ? '\u25C0' : '';
        cell.className = 'mark' + (m ? ' ' + m : '');
      });
      t.querySelectorAll('[data-col]').forEach(c => {
        c.classList.toggle('hc', hc.has(c.dataset.col));
        if (c.classList.contains('extra')) c.classList.toggle('shown', showExtra.has(c.dataset.col));
      });
      wrap.classList.toggle('collapsed', st.table === false);
    }
    return { update };
  }

  /* ------------------------------------------------------------ timeline */
  function timeline(host, spec) {
    const items = spec.items;
    const W = 640, rowH = 46, H = 24 + items.length * rowH;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': tr(spec.title) || '' });
    host.appendChild(svg);
    el('line', { x1: 70, y1: 16, x2: 70, y2: H - 10, stroke: '#cdbfa4', 'stroke-width': 2 }, svg);
    const gs = items.map((it, i) => {
      const y = 30 + i * rowH;
      const g = el('g', { 'data-id': it.id }, svg);
      const yr = el('text', { x: 56, y: y + 5, 'text-anchor': 'end', class: 'tl-year' }, g); yr.textContent = it.year;
      el('circle', { cx: 70, cy: y, r: 7, fill: '#fffdf8', stroke: '#002147', 'stroke-width': 2, class: 'dot' }, g);
      const a = el('text', { x: 88, y: y - 2, class: 'tl-who' }, g); a.textContent = tr(it.who);
      const b = el('text', { x: 88, y: y + 15, class: 'tl-what' }, g); b.textContent = tr(it.what);
      return g;
    });
    function update(st) {
      const lit = new Set(st.items || []);
      const any = lit.size > 0;
      gs.forEach((g, i) => {
        const on = lit.has(items[i].id);
        window.d3.select(g).transition().duration(DUR).attr('opacity', !any || on ? 1 : 0.3);
        window.d3.select(g.querySelector('.dot')).transition().duration(DUR).attr('fill', on ? '#c4a15a' : '#fffdf8');
      });
    }
    return { update };
  }

  /* ------------------------------------------------------------ scene */
  function make(host, name, opts) {
    opts = opts || {};
    const base = (window.KSCENES || {})[name];
    if (!base) { host.innerHTML = `<p class="fig-note">No scene “${name}”.</p>`; return null; }
    const scene = Object.assign({}, base, { id: name + (opts.thumb ? '-t' + Math.random().toString(36).slice(2, 7) : '') });
    host.innerHTML = '';
    if (scene.title && !opts.thumb) { const p = document.createElement('p'); p.className = 'fig-title'; p.textContent = tr(scene.title); host.appendChild(p); }
    const parts = [];
    if (scene.nodes) parts.push(diagram(host, scene));
    if (scene.table && (!opts.thumb || !scene.nodes)) parts.push(table(host, scene.table));
    if (scene.timeline && !opts.thumb) parts.push(timeline(host, scene.timeline));
    const note = document.createElement('p'); note.className = 'fig-note stage-note'; host.appendChild(note);
    if (opts.thumb) note.style.display = 'none';
    if (scene.legend !== false && scene.nodes && !opts.thumb) {
      const lg = document.createElement('p');
      lg.className = 'stage-legend';
      lg.innerHTML = lang() === 'en'
        ? '<span class="lg-arc"></span> arc: one cluster · <span class="lg-neg">¬</span> absence · <span class="lg-h"></span> regularity · <span class="lg-f"></span> fired in this case'
        : '<span class="lg-arc"></span> Bogen: ein Cluster · <span class="lg-neg">¬</span> Abwesenheit · <span class="lg-h"></span> Regularität · <span class="lg-f"></span> in diesem Fall ausgelöst';
      host.appendChild(lg);
    }
    function update(st) {
      st = st || {};
      parts.forEach(p => p.update(st));
      note.textContent = tr(st.note) || '';
    }
    update(scene.initial || {});
    return { update };
  }

  window.KStage = { make };
})();
