/* ═══════════════════════════════════════════════════════════
   tools.js — self-contained content-block "tools": tables, timelines and
   math graphs, plus the KaTeX plumbing they share with plain prose. Each
   is a [TAG]...[/TAG] block in the .txt with a parse function, a render
   function returning markup, and (graphs only) a mount function that runs
   once that markup is in the page. Also owns shuffleOptions, the
   deterministic option shuffle shared by viewer.js's question and bonus
   parsers.

   Questions and bonuses are deliberately NOT here: they're tied into
   session state (scoring, checkpoints, persistence) and live in viewer.js.

   viewer.js loops over BLOCK_TOOLS instead of hard-coding a branch per
   type; adding a tool means adding one entry there.

   External libraries: KaTeX (+ auto-render) is loaded by index.html.
   JSXGraph (2D graphs), Plotly (3D surfaces) and math.js are only needed
   for [GRAPH] blocks, so they are loaded on first use (loadGraphLibs below).
═══════════════════════════════════════════════════════════ */

function svEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── Deterministic option shuffling ──
   The model marks the correct option with [ANSWER: X] wherever it happened
   to write it, and LLMs cluster correct answers on certain letters, so the
   app reshuffles each question's options at parse time. The shuffle is
   seeded from the question text so a given .txt always shuffles the same
   way, but a saved answer never depends on that: answers are stored by the
   option's ORIGINAL letter, and origOf / newOf translate between original
   and on-screen letters for the current render (see viewer.js
   handleOptionClick / openViewer). */
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/* rawOptions: { A: text, ... } as written; correctLetter: the raw letter marked
   correct; seedKey: unique to this question. Returns
     options: text under new (A)-(E) letters, shuffled — what gets rendered
     correct: the NEW letter that is correct (null if correctLetter matches nothing)
     origOf:  new letter → original letter
     newOf:   original letter → new letter */
function shuffleOptions(rawOptions, correctLetter, seedKey) {
  const origLetters = ['A','B','C','D','E'].filter(l => rawOptions[l] !== undefined);
  const rand = mulberry32(hashStr(seedKey));
  const order = [...origLetters];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const options = {}, origOf = {}, newOf = {};
  let correct = null;
  order.forEach((origLetter, idx) => {
    const newLetter = origLetters[idx];
    options[newLetter] = rawOptions[origLetter];
    origOf[newLetter] = origLetter;
    newOf[origLetter] = newLetter;
    if (origLetter === correctLetter) correct = newLetter;
  });
  return { options, correct, origOf, newOf };
}

/* ── KaTeX ──
   The one entry point for typesetting after HTML is in the DOM (auto-render
   walks real text nodes, so it can't run before insertion). */
function renderMath(el) {
  if (!window.renderMathInElement) return;
  renderMathInElement(el, {
    delimiters: [
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
  });
}

/* Collapses newlines inside \[...\] and \(...\) spans to one space before any
   paragraph/line splitting: splitting a multi-line equation into separate DOM
   text nodes breaks KaTeX, which only matches delimiters within one node. */
function collapseMathNewlines(raw) {
  return raw
    .replace(/\\\[[\s\S]*?\\\]/g, m => m.replace(/\s*\n\s*/g, ' '))
    .replace(/\\\([\s\S]*?\\\)/g, m => m.replace(/\s*\n\s*/g, ' '));
}

/* ── TABLE ──
   Rows are "cell | cell | cell"; the first row is the header. Only a "|" with
   whitespace on both sides is a column divider, so a literal bar inside a
   cell (absolute value, norm) never splits it — even unwrapped in \( \). */
function parseTableBody(raw) {
  const rows = raw.split('\n').map(l => l.trim()).filter(Boolean)
    .map(line => line.split(/\s\|\s/).map(cell => cell.trim()));
  const [header, ...body] = rows;
  return { header: header || [], rows: body };
}
function renderTable(t) {
  const head = t.header.length ? `<thead><tr>${t.header.map(h => `<th>${svEsc(h)}</th>`).join('')}</tr></thead>` : '';
  const body = t.rows.map(r => `<tr>${r.map(c => `<td>${svEsc(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="sv-table-wrap"><table class="sv-table">${head}<tbody>${body}</tbody></table></div>`;
}

/* ── TIMELINE ──
   Rows are "marker | description" (marker: a date, stage name, "Step 1"…).
   Same spaced-bar rule as TABLE; only the first one divides marker from text. */
function parseTimelineBody(raw) {
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const m = line.match(/\s\|\s/);
    if (!m) return { marker: '', text: line };
    return { marker: line.slice(0, m.index).trim(), text: line.slice(m.index + m[0].length).trim() };
  });
}
function renderTimeline(items) {
  const rows = items.map(it => `<div class="sv-tl-item">
    <div class="sv-tl-dot"></div>
    <div class="sv-tl-content"><div class="sv-tl-marker">${svEsc(it.marker)}</div><div class="sv-tl-text">${svEsc(it.text)}</div></div>
  </div>`).join('');
  return `<div class="sv-timeline">${rows}</div>`;
}

/* ── GRAPH ──
   "key: value" lines plus repeatable "trace:", "point:", "segment:" and
   "slider:" lines. The authoritative format spec is in node-prompt.js; this
   parser accepts exactly that.

   Types: function2d, parametric2d, surface3d, vectorfield2d.
   Keys:  type, title, xlabel, ylabel, zlabel, xrange, yrange, trange,
          aspect (optional: "equal"), z (surface3d), u / v (vectorfield2d),
          trace / point / segment / slider (2D types only; see below).

     trace:   <expression> | label: <text> | color: <optional>
              (parametric2d packs both components comma-separated)
     point:   <x>, <y> | label: <text> | color: <c> | offset: <dx>, <dy>
     segment: <x1>, <y1>, <x2>, <y2> | label: <text> | color: <c> | dashed: true
     slider:  <name> | range: <min>, <max> | init: <v> | step: <s>

   Any coordinate or trace expression may use a slider's name as a variable;
   moving the slider redraws the traces, points and segments that use it.
   (Vector fields are drawn once, at the sliders' initial values.)

   Libraries: 2D types are drawn with JSXGraph (Desmos-like axes, labelled
   points, segments, live sliders, arrows). surface3d stays on Plotly, which
   is the better 3D renderer. math.js evaluates every expression in both.
   Titles and axis labels are captions typeset by the app's own KaTeX pass
   where the host element is HTML; inside the JSXGraph board, a label that is
   one single \( ... \) span is typeset with KaTeX, any other label is shown
   as plain text with the delimiters stripped. */
const GRAPH_LIST_KEYS = { trace: 'traces', point: 'points', segment: 'segments', slider: 'sliders' };

function parseGraphBody(raw) {
  const g = {
    type: 'function2d', title: '', xlabel: '', ylabel: '', zlabel: '', aspect: '',
    traces: [], points: [], segments: [], sliders: [],
  };
  raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) return;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (GRAPH_LIST_KEYS[key]) {
      // Split only on a spaced "|" (same rule as TABLE), so a slip can't corrupt the line.
      const [expr, ...metaParts] = val.split(/\s\|\s/).map(s => s.trim());
      const item = { expr };
      metaParts.forEach(mp => {
        const mm = mp.match(/^(\w+):\s*(.*)$/);
        if (mm) item[mm[1].toLowerCase()] = mm[2].trim();
      });
      g[GRAPH_LIST_KEYS[key]].push(item);
    } else if (key === 'xrange' || key === 'yrange' || key === 'trange') {
      g[key] = val.split(',').map(s => parseFloat(s.trim()));
    } else if (!(key in GRAPH_LIST_KEYS) && !Array.isArray(g[key])) {
      g[key] = val;
    }
  });
  return g;
}

/* "cos(t), sin(t)" → ["cos(t)", "sin(t)"], ignoring commas inside a call's arguments. */
function splitTopLevelComma(str) {
  let depth = 0, cur = '';
  const parts = [];
  for (const ch of str) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  parts.push(cur.trim());
  return parts;
}

function graphLinspace(lo, hi, n) {
  const step = (hi - lo) / (n - 1);
  return Array.from({ length: n }, (_, i) => lo + i * step);
}

/* ── graph libraries: loaded on first use ── */
const PLOTLY_URL     = 'https://cdn.plot.ly/plotly-3.6.0.min.js';
const MATHJS_URL     = 'https://cdn.jsdelivr.net/npm/mathjs@15.2.0';
const JSXGRAPH_URL   = 'https://cdn.jsdelivr.net/npm/jsxgraph@1/distrib/jsxgraphcore.js';
const JSXGRAPH_CSS   = 'https://cdn.jsdelivr.net/npm/jsxgraph@1/distrib/jsxgraph.css';
const scriptLoads = new Map();
function loadScriptOnce(src) {
  if (!scriptLoads.has(src)) {
    scriptLoads.set(src, new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.charset = 'utf-8';
      s.onload = resolve;
      s.onerror = () => { scriptLoads.delete(src); reject(new Error(`Failed to load ${src}`)); }; // allow a retry
      document.head.appendChild(s);
    }));
  }
  return scriptLoads.get(src);
}
function loadStyleOnce(href) {
  if (scriptLoads.has(href)) return scriptLoads.get(href);
  const p = new Promise((resolve, reject) => {
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = href;
    l.onload = resolve;
    l.onerror = () => { scriptLoads.delete(href); reject(new Error(`Failed to load ${href}`)); };
    document.head.appendChild(l);
  });
  scriptLoads.set(href, p);
  return p;
}
function loadGraphLibs(type) {
  if (type === 'surface3d') return Promise.all([loadScriptOnce(PLOTLY_URL), loadScriptOnce(MATHJS_URL)]);
  return Promise.all([loadScriptOnce(JSXGRAPH_URL), loadStyleOnce(JSXGRAPH_CSS), loadScriptOnce(MATHJS_URL)]);
}

/* Graph expressions come from lesson files, and trees are shareable files, so
   they are untrusted input. Compile through a math.js instance with the
   functions that can reach the outside disabled (per math.js's security docs).
   `compile` is read first so it's already built before the overrides land. */
let safeMath = null;
function getSafeMath() {
  if (safeMath) return safeMath;
  const instance = math.create(math.all);
  const compile = instance.compile;
  const disabled = () => { throw new Error('Function is disabled'); };
  instance.import({
    import: disabled, createUnit: disabled, reviver: disabled, evaluate: disabled,
    parse: disabled, simplify: disabled, derivative: disabled, resolve: disabled, compile: disabled,
  }, { override: true });
  safeMath = { compile };
  return safeMath;
}
function compileGraphExpr(expr) {
  const c = getSafeMath().compile(expr); // throws on a bad expression; mountGraph reports it
  return c;
}
/* scope → finite number, or NaN where the expression is undefined / not real. */
function makeEval(expr) {
  const c = compileGraphExpr(expr);
  return scope => {
    try {
      const v = c.evaluate(scope);
      return (typeof v === 'number' && isFinite(v)) ? v : NaN;
    } catch { return NaN; }
  };
}

const GRAPH_DEFAULT_RANGE = [-10, 10];
const GRAPH_SAMPLES_1D    = 300; // function2d / parametric2d curve resolution
const GRAPH_SAMPLES_FIT   = 150; // samples used only to pick an automatic y range
const GRAPH_SAMPLES_GRID  = 40;  // surface3d, per axis
const GRAPH_SAMPLES_FIELD = 15;  // vectorfield2d arrows, per axis
const GRAPH_HEIGHT_2D     = 340; // px, used when the stylesheet gives the plot box no height
const GRAPH_PALETTE = ['#2d70b3', '#c74440', '#388c46', '#6042a6', '#fa7e19', '#00a0b0'];

function renderGraph(g, id) {
  const title = g.title ? `<div class="sv-graph-title">${svEsc(g.title)}</div>` : '';
  const legend = (g.traces.length > 1 && g.traces.some(t => t.label))
    ? `<div class="sv-graph-legend" id="sv-graph-legend-${id}" style="display:flex;flex-wrap:wrap;gap:4px 0;margin-top:6px;font-size:0.9em"></div>` : '';
  const controls = g.sliders.length ? `<div class="sv-graph-controls" id="sv-graph-controls-${id}"></div>` : '';
  return `<div class="sv-graph-wrap">${title}<div class="sv-graph-plot" id="sv-graph-${id}"></div>${legend}${controls}</div>`;
}

/* ── 2D range helpers ── */

/* Min/max of the values, unless a few extreme outliers (an asymptote) stretch
   the span past 8x the span of the middle 90%; then the outliers are ignored. */
function robustRange(vals) {
  const v = vals.filter(Number.isFinite).sort((a, b) => a - b);
  if (!v.length) return [-1, 1];
  const q = p => v[Math.min(v.length - 1, Math.max(0, Math.round(p * (v.length - 1))))];
  let lo = v[0], hi = v[v.length - 1];
  const q05 = q(0.05), q95 = q(0.95), core = q95 - q05;
  if (core > 0 && hi - lo > 8 * core) { lo = q05 - 0.15 * core; hi = q95 + 0.15 * core; }
  return [lo, hi];
}
function padRange([lo, hi], frac = 0.08) {
  const span = hi - lo;
  if (!(span > 1e-9)) { const c = (hi + lo) / 2; return [c - 1, c + 1]; }
  return [lo - span * frac, hi + span * frac];
}
/* Widen the narrower axis so one unit is the same length in x and y. */
function fitAspect(xr, yr, wPx, hPx) {
  let [xlo, xhi] = xr, [ylo, yhi] = yr;
  const sx = xhi - xlo, sy = yhi - ylo, target = wPx / hPx;
  if (sx / sy < target) { const n = sy * target, c = (xlo + xhi) / 2; xlo = c - n / 2; xhi = c + n / 2; }
  else { const n = sx / target, c = (ylo + yhi) / 2; ylo = c - n / 2; yhi = c + n / 2; }
  return [[xlo, xhi], [ylo, yhi]];
}

/* ── JSXGraph helpers ── */
function safeColor(c, fallback) {
  return (typeof c === 'string' && /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/.test(c)) ? c : fallback;
}
function parseNumList(str, n, fallback) {
  const a = String(str || '').split(',').map(s => parseFloat(s));
  return (a.length >= n && a.slice(0, n).every(Number.isFinite)) ? a.slice(0, n) : fallback;
}
/* A caption that is exactly one \( ... \) span is typeset by KaTeX inside the
   board; anything else is shown as plain text with the delimiters removed. */
function captionSpec(str) {
  const s = (str || '').trim();
  const whole = s.match(/^\\\(([\s\S]*)\\\)$/);
  if (whole && !whole[1].includes('\\)') && window.katex) return { text: whole[1].trim(), katex: true };
  return { text: s.replace(/\\\(|\\\)/g, '').trim(), katex: false };
}
function labelAttrs(spec, color, extra) {
  return Object.assign({ strokeColor: color, fontSize: 14, useKatex: spec.katex, display: 'html' }, extra || {});
}

function makeSliders(g) {
  return g.sliders.map(s => {
    const [lo, hi] = parseNumList(s.range, 2, [-5, 5]);
    const stepIn = parseFloat(s.step);
    const step = stepIn > 0 ? stepIn : (hi - lo) / 100;
    let init = parseFloat(s.init);
    if (!Number.isFinite(init)) init = lo;
    return { name: s.expr, lo, hi, step, value: Math.min(hi, Math.max(lo, init)) };
  });
}
function sliderScope(sliders) {
  const o = {};
  sliders.forEach(s => { o[s.name] = s.value; });
  return o;
}

/* Boards from lessons the viewer has since left are released the next time a
   board is mounted (their container is no longer in the document). */
const liveBoards = [];
function freeStaleBoards() {
  for (let i = liveBoards.length - 1; i >= 0; i--) {
    const b = liveBoards[i];
    if (!b.containerObj || !b.containerObj.isConnected) {
      try { JXG.JSXGraph.freeBoard(b); } catch {}
      liveBoards.splice(i, 1);
    }
  }
}

/* Runs after renderGraph()'s markup is in a visible page: both libraries must
   measure a real, laid-out element. Async because they load on first use. */
async function mountGraph(g, id) {
  const el = document.getElementById(`sv-graph-${id}`);
  if (!el) return;
  el.classList.add('sv-graph-loading');
  try {
    await loadGraphLibs(g.type);
  } catch {
    el.classList.remove('sv-graph-loading');
    el.textContent = "This graph couldn't be loaded — check your connection and reopen the lesson.";
    return;
  }
  el.classList.remove('sv-graph-loading');
  if (!el.isConnected) return; // the viewer moved on to another lesson while the libraries loaded

  try {
    if (g.type === 'surface3d') mountSurface3d(g, el);
    else mountBoard2d(g, el, id);
  } catch (e) {
    console.error('Graph render error:', e);
    el.textContent = 'This graph could not be rendered.';
  }
}

/* ── surface3d (Plotly) ── */
function mountSurface3d(g, el) {
  const [xlo, xhi] = g.xrange || GRAPH_DEFAULT_RANGE;
  const [ylo, yhi] = g.yrange || GRAPH_DEFAULT_RANGE;
  const xs = graphLinspace(xlo, xhi, GRAPH_SAMPLES_GRID);
  const ys = graphLinspace(ylo, yhi, GRAPH_SAMPLES_GRID);
  const f  = makeEval(g.z);
  // Plotly's surface convention: z[iy][ix] is the value at (xs[ix], ys[iy]).
  const zGrid = ys.map(y => xs.map(x => { const v = f({ x, y }); return Number.isNaN(v) ? null : v; }));
  const layout = {
    margin: { t: 10, r: 10, b: 40, l: 50 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    scene: { xaxis: { title: g.xlabel || '' }, yaxis: { title: g.ylabel || '' }, zaxis: { title: g.zlabel || '' } },
  };
  const traces = [{ x: xs, y: ys, z: zGrid, type: 'surface', showscale: false }];
  Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
}

/* ── function2d / parametric2d / vectorfield2d (JSXGraph) ── */
function mountBoard2d(g, el, id) {
  freeStaleBoards();
  const textColor = getComputedStyle(el).color || '#333';
  if (el.clientHeight < 120) el.style.height = GRAPH_HEIGHT_2D + 'px';
  const wPx = el.clientWidth || 600, hPx = el.clientHeight || GRAPH_HEIGHT_2D;

  const sliders = makeSliders(g);
  const base = () => sliderScope(sliders);
  const withVar = (name, v) => Object.assign(base(), { [name]: v });

  // Compile everything first: a bad expression throws before anything is drawn.
  const curves = [];
  if (g.type === 'function2d') {
    g.traces.forEach(tr => curves.push({ tr, f: makeEval(tr.expr) }));
  } else if (g.type === 'parametric2d') {
    g.traces.forEach(tr => {
      const [ex, ey] = splitTopLevelComma(tr.expr);
      curves.push({ tr, fx: makeEval(ex), fy: makeEval(ey) });
    });
  }
  const fu = g.type === 'vectorfield2d' ? makeEval(g.u) : null;
  const fv = g.type === 'vectorfield2d' ? makeEval(g.v) : null;
  const points = g.points.map(p => {
    const [ex, ey] = splitTopLevelComma(p.expr);
    return { p, fx: makeEval(ex), fy: makeEval(ey) };
  });
  const segments = g.segments.map(s => {
    const parts = splitTopLevelComma(s.expr);
    if (parts.length !== 4) throw new Error('segment needs x1, y1, x2, y2');
    const [a, b, c, d] = parts.map(makeEval);
    return { s, a, b, c, d };
  });

  // Slider settings that make every trace look different: initial, plus each slider at its ends.
  const scopes = [base()];
  sliders.forEach(s => { scopes.push(withVar(s.name, s.lo)); scopes.push(withVar(s.name, s.hi)); });

  // Visible ranges.
  let xr, yr;
  if (g.type === 'function2d') {
    xr = g.xrange || GRAPH_DEFAULT_RANGE;
    if (g.yrange) yr = g.yrange;
    else {
      const xs = graphLinspace(xr[0], xr[1], GRAPH_SAMPLES_FIT), ys = [];
      curves.forEach(c => scopes.forEach(sc => xs.forEach(x => ys.push(c.f(Object.assign({}, sc, { x }))))));
      points.forEach(pt => scopes.forEach(sc => ys.push(pt.fy(sc))));
      segments.forEach(sg => scopes.forEach(sc => { ys.push(sg.b(sc), sg.d(sc)); }));
      yr = padRange(robustRange(ys));
    }
  } else if (g.type === 'parametric2d') {
    const [lo, hi] = g.trange || [0, 2 * Math.PI];
    const ts = graphLinspace(lo, hi, GRAPH_SAMPLES_FIT), vx = [], vy = [];
    curves.forEach(c => scopes.forEach(sc => ts.forEach(t => {
      const s2 = Object.assign({}, sc, { t });
      vx.push(c.fx(s2)); vy.push(c.fy(s2));
    })));
    points.forEach(pt => { vx.push(pt.fx(base())); vy.push(pt.fy(base())); });
    xr = g.xrange || padRange(robustRange(vx));
    yr = g.yrange || padRange(robustRange(vy));
  } else { // vectorfield2d
    xr = padRange(g.xrange || GRAPH_DEFAULT_RANGE, 0.04);
    yr = padRange(g.yrange || GRAPH_DEFAULT_RANGE, 0.04);
  }
  if (g.type !== 'function2d' || /^equal$/i.test(g.aspect)) [xr, yr] = fitAspect(xr, yr, wPx, hPx);

  const xCap = captionSpec(g.xlabel), yCap = captionSpec(g.ylabel);
  const axisTicks = { strokeColor: textColor, strokeOpacity: 0.5, label: { strokeColor: textColor, fontSize: 12 } };
  const board = JXG.JSXGraph.initBoard(el.id, {
    boundingbox: [xr[0], yr[1], xr[1], yr[0]],
    axis: true, grid: false,
    showCopyright: false, showNavigation: false, showInfobox: false,
    pan: { enabled: false }, zoom: { enabled: false },
    defaultAxes: {
      x: {
        strokeColor: textColor, strokeWidth: 1.5, highlight: false,
        name: xCap.text, withLabel: !!xCap.text,
        label: labelAttrs(xCap, textColor, { position: 'rt', offset: [-8, 14] }),
        ticks: axisTicks,
      },
      y: {
        strokeColor: textColor, strokeWidth: 1.5, highlight: false,
        name: yCap.text, withLabel: !!yCap.text,
        label: labelAttrs(yCap, textColor, { position: 'rt', offset: [12, -10] }),
        ticks: axisTicks,
      },
    },
  });
  liveBoards.push(board);
  board.suspendUpdate();

  try {
    board.create('grid', [], {
      strokeColor: textColor, strokeOpacity: 0.14, highlight: false,
      major: { strokeColor: textColor, strokeOpacity: 0.2 },
      minor: { strokeColor: textColor, strokeOpacity: 0.08 },
    });
  } catch (e) { console.warn('Graph grid styling skipped:', e); }

  const legend = [];

  // Curves.
  curves.forEach((c, i) => {
    const color = safeColor(c.tr.color, GRAPH_PALETTE[i % GRAPH_PALETTE.length]);
    if (g.type === 'function2d') {
      board.create('functiongraph', [x => c.f(Object.assign(base(), { x }))],
        { strokeColor: color, strokeWidth: 2.5, highlight: false });
    } else {
      const [lo, hi] = g.trange || [0, 2 * Math.PI];
      board.create('curve', [
        t => c.fx(Object.assign(base(), { t })),
        t => c.fy(Object.assign(base(), { t })),
        lo, hi,
      ], { strokeColor: color, strokeWidth: 2.5, highlight: false, numberPoints: GRAPH_SAMPLES_1D });
    }
    if (c.tr.label) legend.push({ label: c.tr.label, color });
  });

  // Vector field: arrows centred on a grid of sample points, length proportional to magnitude.
  if (g.type === 'vectorfield2d') {
    const [x0, x1] = g.xrange || GRAPH_DEFAULT_RANGE, [y0, y1] = g.yrange || GRAPH_DEFAULT_RANGE;
    const n = GRAPH_SAMPLES_FIELD;
    const xs = graphLinspace(x0, x1, n), ys = graphLinspace(y0, y1, n);
    const cellX = (x1 - x0) / (n - 1), cellY = (y1 - y0) / (n - 1);
    const sample = [];
    let maxMag = 1e-9;
    xs.forEach(x => ys.forEach(y => {
      const sc = Object.assign(base(), { x, y });
      const u = fu(sc), v = fv(sc);
      if (!Number.isFinite(u) || !Number.isFinite(v)) return;
      sample.push({ x, y, u, v });
      maxMag = Math.max(maxMag, Math.hypot(u, v));
    }));
    const color = safeColor(g.traces[0] && g.traces[0].color, GRAPH_PALETTE[0]);
    const k = 0.85 / maxMag; // longest arrow spans 85% of a cell
    sample.forEach(s => {
      const dx = s.u * k * cellX, dy = s.v * k * cellY;
      if (Math.hypot(dx / cellX, dy / cellY) < 0.04) return; // effectively zero: skip the stub
      board.create('segment', [[s.x - dx / 2, s.y - dy / 2], [s.x + dx / 2, s.y + dy / 2]], {
        strokeColor: color, strokeWidth: 1.6, fixed: true, highlight: false,
        lastArrow: { type: 2, size: 5 },
        point1: { visible: false, fixed: true, withLabel: false },
        point2: { visible: false, fixed: true, withLabel: false },
      });
    });
  }

  // Segments, then points on top.
  segments.forEach(sg => {
    const color = safeColor(sg.s.color, textColor);
    const cap = captionSpec(sg.s.label);
    board.create('segment', [
      [() => sg.a(base()), () => sg.b(base())],
      [() => sg.c(base()), () => sg.d(base())],
    ], {
      strokeColor: color, strokeWidth: 2, highlight: false, fixed: true,
      dash: /^(true|1|yes)$/i.test(sg.s.dashed || '') ? 2 : 0,
      name: cap.text, withLabel: !!cap.text,
      label: labelAttrs(cap, textColor),
      point1: { visible: false, fixed: true, withLabel: false },
      point2: { visible: false, fixed: true, withLabel: false },
    });
  });
  points.forEach(pt => {
    const color = safeColor(pt.p.color, GRAPH_PALETTE[1]);
    const cap = captionSpec(pt.p.label);
    const [dx, dy] = parseNumList(pt.p.offset, 2, [10, 10]);
    board.create('point', [() => pt.fx(base()), () => pt.fy(base())], {
      size: 4, face: 'o', fillColor: color, strokeColor: color,
      fixed: true, highlight: false, showInfobox: false,
      name: cap.text, withLabel: !!cap.text,
      label: labelAttrs(cap, textColor, { offset: [dx, dy] }),
    });
  });

  board.unsuspendUpdate();

  // Legend (HTML, so labels can use \( \) like the rest of the page).
  const leg = document.getElementById(`sv-graph-legend-${id}`);
  if (leg && legend.length) {
    leg.innerHTML = legend.map(it =>
      `<span style="display:inline-flex;align-items:center;gap:6px;margin-right:16px">` +
      `<span style="width:18px;height:3px;border-radius:2px;background:${it.color}"></span>` +
      `<span>${svEsc(it.label)}</span></span>`).join('');
    renderMath(leg);
  }

  // Sliders (HTML range inputs under the plot; touch-friendly and independent of board coordinates).
  const ctl = document.getElementById(`sv-graph-controls-${id}`);
  if (ctl && sliders.length) {
    ctl.style.cssText = 'display:flex;flex-direction:column;gap:6px;margin-top:10px';
    const fmt = v => String(Math.round(v * 1e4) / 1e4);
    sliders.forEach(s => {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;gap:12px';
      const name = document.createElement('span');
      name.style.cssText = 'min-width:6em;font-variant-numeric:tabular-nums';
      const input = document.createElement('input');
      input.type = 'range';
      input.min = s.lo; input.max = s.hi; input.step = s.step; input.value = s.value;
      input.style.flex = '1';
      const show = () => { name.textContent = `${s.name} = ${fmt(s.value)}`; };
      input.addEventListener('input', () => {
        s.value = parseFloat(input.value);
        show();
        board.update();
      });
      show();
      row.append(name, input);
      ctl.appendChild(row);
    });
  }
}

/* ── Registry ──
   tag: the bracket tag in the .txt; code: the letter in the placeholder token
   that stands in for the block during section splitting; key: the Map key on
   the parsed session; parse / render / optional mount. */
const BLOCK_TOOLS = [
  { tag: 'TABLE',    code: 'T', key: 'tables',    parse: parseTableBody,    render: renderTable },
  { tag: 'TIMELINE', code: 'L', key: 'timelines', parse: parseTimelineBody, render: renderTimeline },
  { tag: 'GRAPH',    code: 'G', key: 'graphs',    parse: parseGraphBody,    render: renderGraph, mount: mountGraph },
];
