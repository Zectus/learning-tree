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

   External libraries: KaTeX (+ auto-render), JSXGraph (2D graphs), Plotly
   (3D surfaces) and math.js are only needed inside opened lessons, so they
   are all loaded on first use (loadKatex / loadGraphLibs below).
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
   Loaded lazily on the first lesson or graph that actually contains math
   delimiters, so initial page load never blocks on the KaTeX CDN. */
const KATEX_CSS            = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css';
const KATEX_JS             = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js';
const KATEX_AUTO_RENDER_JS = 'https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js';
let katexLoadPromise = null;

function loadKatex() {
  if (window.renderMathInElement) return Promise.resolve();
  if (!katexLoadPromise) {
    katexLoadPromise = Promise.all([loadStyleOnce(KATEX_CSS), loadScriptOnce(KATEX_JS)])
      .then(() => loadScriptOnce(KATEX_AUTO_RENDER_JS))
      .catch(err => { katexLoadPromise = null; throw err; });
  }
  return katexLoadPromise;
}

function runKatex(el) {
  if (!window.renderMathInElement || !el?.isConnected) return;
  renderMathInElement(el, {
    delimiters: [
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
    ],
    throwOnError: false,
  });
}

function renderMath(el) {
  if (!el) return;
  if (window.renderMathInElement) { runKatex(el); return; }
  const text = el.textContent || '';
  if (!text.includes('\\(') && !text.includes('\\[')) return;
  loadKatex().then(() => {
    if (!el.isConnected) return;
    runKatex(el);
    if (el.id === 'sv-body' && typeof computeCheckpoints === 'function' && typeof updateSessionProgress === 'function') {
      computeCheckpoints();
      updateSessionProgress();
    }
  }).catch(() => {});
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
          trace / point / segment / slider (2D types only; see below),
          fill (function2d only).

     trace:   <expression> | label: <text> | color: <optional>
              (parametric2d packs both components comma-separated)
     fill:    <upper>, <lower> | range: <start>, <end> | label: <text> | color: <c> | opacity: 0.22
     point:   <x>, <y> | label: <text> | color: <c> | offset: <dx>, <dy>
     segment: <x1>, <y1>, <x2>, <y2> | label: <text> | color: <c> | dashed: true
     slider:  <name> | range: <min>, <max> | init: <v> | step: <s>

   Any coordinate or trace expression may use a slider's name as a variable;
   moving the slider redraws the traces, fills, points and segments that use it.
   (Vector fields are drawn once, at the sliders' initial values.)

   Libraries: 2D types are drawn with JSXGraph (Desmos-like axes, labelled
   points, segments, live sliders, arrows). surface3d stays on Plotly, which
   is the better 3D renderer. math.js evaluates every expression in both.
   Titles and axis labels are captions typeset by the app's own KaTeX pass
   where the host element is HTML; inside the JSXGraph board, a label that is
   one single \( ... \) span is typeset with KaTeX, any other label is shown
   as plain text with the delimiters stripped. */
const GRAPH_LIST_KEYS = { trace: 'traces', fill: 'fills', point: 'points', segment: 'segments', slider: 'sliders' };

function parseGraphBody(raw) {
  const g = {
    type: 'function2d', title: '', xlabel: '', ylabel: '', zlabel: '', aspect: '',
    traces: [], fills: [], points: [], segments: [], sliders: [],
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
const GRAPH_PALETTE = Array.from({ length: 6 }, (_, i) => `var(--graph-${i + 1})`);

function renderGraph(g, id) {
  const title = g.title ? `<div class="sv-graph-title">${svEsc(g.title)}</div>` : '';
  const legend = (g.traces.length > 1 && g.traces.some(t => t.label)) || (g.fills || []).some(f => f.label)
    ? `<div class="sv-graph-legend" id="sv-graph-legend-${id}"></div>` : '';
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

/* Use the same 1–2–5 spacing rule on both axes, measured in screen pixels.
   Equal-scale plots then have square grid cells, including after a resize. */
function graphTickStep(pixelsPerUnit, minPixels) {
  const raw = minPixels / pixelsPerUnit;
  if (!(raw > 0) || !Number.isFinite(raw)) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  const fraction = raw / power;
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power;
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
let graphFontPx = 16; // set per board from the surrounding page's own text size
function labelAttrs(spec, color, extra) {
  return Object.assign({ strokeColor: color, highlightStrokeColor: color, highlightStrokeOpacity: 1,
    highlight: false, fixed: true, fontSize: graphFontPx, useKatex: spec.katex, display: 'html',
    cssClass: 'sv-graph-label', highlightCssClass: 'sv-graph-label' }, extra || {});
}
/* JSXGraph draws its text (tick numbers, axis names, point and segment labels)
   in its own font and size. Read the page's font where the plot sits, before
   the board adds its own classes, and force the board's text to match. */
function matchPageFont(el) {
  const cs = getComputedStyle(el);
  graphFontPx = parseFloat(cs.fontSize) || 16;
  let st = document.getElementById('sv-graph-font-css');
  if (!st) { st = document.createElement('style'); st.id = 'sv-graph-font-css'; document.head.appendChild(st); }
  st.textContent = `.sv-graph-plot .JXGtext, .sv-graph-plot svg text { font-family: ${cs.fontFamily} !important; }`;
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

function graphNeedsKatex(g) {
  if (g.type === 'surface3d') return false;
  const labels = [g.xlabel, g.ylabel, ...(g.points || []).map(p => p.label), ...(g.segments || []).map(s => s.label)];
  return labels.some(s => typeof s === 'string' && s.includes('\\('));
}

/* Runs after renderGraph()'s markup is in a visible page: both libraries must
   measure a real, laid-out element. Async because they load on first use. */
async function mountGraph(g, id) {
  const el = document.getElementById(`sv-graph-${id}`);
  if (!el) return;
  el.classList.add('sv-graph-loading');
  try {
    const loads = [loadGraphLibs(g.type)];
    if (!window.katex && graphNeedsKatex(g)) loads.push(loadKatex().catch(() => {}));
    await Promise.all(loads);
  } catch {
    el.classList.remove('sv-graph-loading');
    uiText(el, "This graph couldn't be loaded — check your connection and reopen the lesson.");
    return;
  }
  el.classList.remove('sv-graph-loading');
  if (!el.isConnected) return; // the viewer moved on to another lesson while the libraries loaded

  try {
    if (g.type === 'surface3d') await mountSurface3d(g, el);
    else mountBoard2d(g, el, id);
  } catch (e) {
    console.error('Graph render error:', e);
    uiText(el, 'This graph could not be rendered.');
  }
}

/* ── surface3d (Plotly) ── */
function surfaceThemeLayout(el) {
  const cs = getComputedStyle(el);
  const theme = name => cs.getPropertyValue(name).trim();
  const dark = document.documentElement.classList.contains('dark');
  const axis = {
    color: theme('--text-m'),
    gridcolor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.09)',
    zerolinecolor: theme('--line-h'),
    showbackground: false,
    showspikes: false,
    nticks: 5,
    tickfont: { size: 11, color: theme('--text-m') },
    titlefont: { size: 12, color: theme('--text') },
  };
  return {
    paper_bgcolor: theme('--bg'),
    font: { color: theme('--text'), family: cs.fontFamily, size: 12 },
    scene: {
      bgcolor: theme('--bg'),
      aspectmode: 'cube',
      xaxis: { ...axis }, yaxis: { ...axis }, zaxis: { ...axis },
    },
    hoverlabel: { bgcolor: theme('--surface'), bordercolor: theme('--border-h'), font: { color: theme('--text'), size: 12 } },
  };
}

function surfaceColorscale() {
  const dark = document.documentElement.classList.contains('dark');
  return dark
    ? [[0, '#2b4c7e'], [0.35, '#4682c8'], [0.68, '#5bc4d0'], [1, '#e8b86d']]
    : [[0, '#1e4e8c'], [0.38, '#2d70b3'], [0.72, '#3ba7b5'], [1, '#d98a3c']];
}

function refreshGraphThemes() {
  if (typeof Plotly === 'undefined') return;
  document.querySelectorAll('.sv-graph-plot.js-plotly-plot').forEach(el => {
    const { scene, ...layout } = surfaceThemeLayout(el);
    // Patch colors only, preserving the camera, ranges and axis captions.
    Plotly.relayout(el, { ...layout, 'scene.bgcolor': scene.bgcolor,
      ...Object.fromEntries(['xaxis', 'yaxis', 'zaxis'].flatMap(name =>
        Object.entries(scene[name]).map(([key, value]) => [`scene.${name}.${key}`, value]))),
    });
    Plotly.restyle(el, { colorscale: [surfaceColorscale()] });
  });
}

function mountSurface3d(g, el) {
  const [xlo, xhi] = g.xrange || GRAPH_DEFAULT_RANGE;
  const [ylo, yhi] = g.yrange || GRAPH_DEFAULT_RANGE;
  const xs = graphLinspace(xlo, xhi, GRAPH_SAMPLES_GRID);
  const ys = graphLinspace(ylo, yhi, GRAPH_SAMPLES_GRID);
  const f  = makeEval(g.z);
  // Plotly's surface convention: z[iy][ix] is the value at (xs[ix], ys[iy]).
  const zGrid = ys.map(y => xs.map(x => { const v = f({ x, y }); return Number.isNaN(v) ? null : v; }));
  const layout = surfaceThemeLayout(el);
  layout.margin = { t: 4, r: 4, b: 4, l: 4 };
  layout.showlegend = false;
  layout.scene.camera = { eye: { x: 1.45, y: 1.45, z: 1.15 } };
  ['x', 'y', 'z'].forEach(axis => { layout.scene[`${axis}axis`].title = { text: g[`${axis}label`] || '' }; });
  const traces = [{
    x: xs, y: ys, z: zGrid, type: 'surface', showscale: false,
    colorscale: surfaceColorscale(),
    lighting: { ambient: 0.65, diffuse: 0.65, specular: 0.2, roughness: 0.6, fresnel: 0.15 },
    contours: { z: { show: true, usecolormap: false, color: 'rgba(255,255,255,0.16)', width: 1, highlight: false } },
  }];
  return Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
}

// Close each finite run separately; never fill across an undefined sampled boundary.
// This is a sampled illustration, not a detector of every discontinuity.
function sampleGraphFill(fill, scope) {
  const start = fill.start(scope), end = fill.end(scope);
  const x = [], y = [];
  if (!Number.isFinite(start) || !Number.isFinite(end) || start === end) return { x, y };
  let run = [];
  const close = () => {
    if (run.length > 1) {
      const path = [...run.map(p => [p[0], p[1]]), ...run.slice().reverse().map(p => [p[0], p[2]]), [run[0][0], run[0][1]]];
      path.forEach(p => { x.push(p[0]); y.push(p[1]); });
      x.push(NaN); y.push(NaN);
    }
    run = [];
  };
  graphLinspace(Math.min(start, end), Math.max(start, end), GRAPH_SAMPLES_1D).forEach(v => {
    const sc = Object.assign({}, scope, { x: v });
    const upper = fill.upper(sc), lower = fill.lower(sc);
    if (Number.isFinite(upper) && Number.isFinite(lower)) run.push([v, upper, lower]);
    else close();
  });
  close();
  return { x, y };
}

/* ── 2D graph label de-overlapping ──
   JSXGraph places point and segment labels at fixed offsets, so a point near
   an axis label (e.g. (0, 1) next to ylabel) or a segment midpoint sharing
   coords with a labeled point can collide. After each render/update, measure
   actual rendered DOM rects and only nudge labels whose default spot overlaps
   another label, a plotted dot, a tick, or the plot edge. */
function rectOverlapArea(a, b, pad = 2) {
  const x = Math.min(a.r + pad, b.r + pad) - Math.max(a.l - pad, b.l - pad);
  const y = Math.min(a.b + pad, b.b + pad) - Math.max(a.t - pad, b.t - pad);
  return x > 0 && y > 0 ? x * y : 0;
}

function pickLabelPlacement(base, candidates, hardBoxes, dotBoxes, softBoxes, bounds) {
  let best = candidates[0], bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const box = { l: c.l, t: c.t, r: c.l + base.w, b: c.t + base.h };
    let score = 0;
    for (const h of hardBoxes) {
      const ov = rectOverlapArea(box, h, 3);
      if (ov > 0) score += 10000 + ov;
    }
    for (const d of dotBoxes) {
      const ov = rectOverlapArea(box, d, 2);
      if (ov > 0) score += 2500 + ov;
    }
    const clipX = Math.max(0, bounds.l - box.l) + Math.max(0, box.r - bounds.r);
    const clipY = Math.max(0, bounds.t - box.t) + Math.max(0, box.b - bounds.b);
    if (clipX > 0 || clipY > 0) score += 5000 + (clipX + clipY) * 20;
    for (const s of softBoxes) {
      const ov = rectOverlapArea(box, s, 2);
      if (ov > 0) score += 450 + ov;
    }
    score += 0.25 * Math.hypot(c.l - base.l, c.t - base.t) + i * 0.01;
    if (score < bestScore) { bestScore = score; best = c; }
    if (score === 0) break;
  }
  return best;
}

function resolveGraphLabelOverlaps(board, el, pointObjs, segmentObjs) {
  if (!el || !el.isConnected) return;
  const elRect = el.getBoundingClientRect();
  if (!elRect.width || !elRect.height) return;
  const boxOf = node => {
    const r = node.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    return { l: r.left - elRect.left, t: r.top - elRect.top, r: r.right - elRect.left, b: r.bottom - elRect.top, w: r.width, h: r.height };
  };
  const allMovable = [
    ...pointObjs.map(o => o?.label?.rendNode),
    ...segmentObjs.map(o => o?.label?.rendNode),
  ].filter(Boolean);
  if (!allMovable.length) return;
  allMovable.forEach(n => { n.style.transform = ''; });

  const bounds = { l: 4, t: 4, r: elRect.width - 4, b: elRect.height - 4 };
  const hardBoxes = [];
  for (const axis of ['x', 'y']) {
    const node = board.defaultAxes?.[axis]?.label?.rendNode;
    const b = node && boxOf(node);
    if (b) hardBoxes.push(b);
  }
  const dotBoxes = [];
  for (const o of pointObjs) {
    const sc = o?.coords?.scrCoords;
    if (sc && Number.isFinite(sc[1]) && Number.isFinite(sc[2])) {
      dotBoxes.push({ l: sc[1] - 7, t: sc[2] - 7, r: sc[1] + 7, b: sc[2] + 7 });
    }
  }
  const softBoxes = [];
  el.querySelectorAll('.sv-graph-tick').forEach(node => {
    const b = boxOf(node);
    if (b) softBoxes.push(b);
  });

  // Points get first pick, then segments dodge point labels and dots.
  for (const ptObj of pointObjs) {
    const node = ptObj?.label?.rendNode;
    const base = node && boxOf(node);
    const sc = ptObj?.coords?.scrCoords;
    if (!base || !sc || !Number.isFinite(sc[1]) || !Number.isFinite(sc[2])) continue;
    const px = sc[1], py = sc[2], w = base.w, h = base.h;
    const candidates = [{ l: base.l, t: base.t }];
    for (const g of [10, 18]) {
      candidates.push(
        { l: px + g,         t: py - g - h },
        { l: px + g,         t: py - h / 2 },
        { l: px + g,         t: py + g },
        { l: px - g - w,     t: py - g - h },
        { l: px - g - w,     t: py - h / 2 },
        { l: px - g - w,     t: py + g },
        { l: px - w / 2,     t: py - g - h },
        { l: px - w / 2,     t: py + g },
      );
    }
    const chosen = pickLabelPlacement(base, candidates, hardBoxes, dotBoxes, softBoxes, bounds);
    const tx = Math.round(chosen.l - base.l), ty = Math.round(chosen.t - base.t);
    if (tx || ty) node.style.transform = `translate(${tx}px, ${ty}px)`;
    hardBoxes.push({ l: chosen.l, t: chosen.t, r: chosen.l + w, b: chosen.t + h });
  }

  for (const segObj of segmentObjs) {
    const node = segObj?.label?.rendNode;
    const base = node && boxOf(node);
    const s1 = segObj?.point1?.coords?.scrCoords, s2 = segObj?.point2?.coords?.scrCoords;
    if (!base || !s1 || !s2) continue;
    const w = base.w, h = base.h;
    const candidates = [{ l: base.l, t: base.t }];
    const dx = s2[1] - s1[1], dy = s2[2] - s1[2], len = Math.hypot(dx, dy);
    if (len > 8) {
      const nx = -dy / len, ny = dx / len;
      const support = (Math.abs(nx) * w + Math.abs(ny) * h) / 2;
      for (const t of [0.5, 0.32, 0.68, 0.22, 0.78]) {
        const ax = s1[1] + dx * t, ay = s1[2] + dy * t;
        for (const side of [1, -1]) {
          for (const g of [9, 16]) {
            const dist = support + g;
            candidates.push({ l: ax + nx * side * dist - w / 2, t: ay + ny * side * dist - h / 2 });
          }
        }
      }
    }
    const chosen = pickLabelPlacement(base, candidates, hardBoxes, dotBoxes, softBoxes, bounds);
    const tx = Math.round(chosen.l - base.l), ty = Math.round(chosen.t - base.t);
    if (tx || ty) node.style.transform = `translate(${tx}px, ${ty}px)`;
    hardBoxes.push({ l: chosen.l, t: chosen.t, r: chosen.l + w, b: chosen.t + h });
  }
}

/* ── function2d / parametric2d / vectorfield2d (JSXGraph) ── */
function mountBoard2d(g, el, id) {
  freeStaleBoards();
  // Keep SVG strokes and HTML labels tied to the theme, including while a
  // lesson stays open. A computed color would freeze the theme at mount time.
  const textColor = 'var(--text)';
  matchPageFont(el);
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
  const fills = (g.fills || []).map(f => {
    if (g.type !== 'function2d') throw new Error('fill requires function2d');
    const edges = splitTopLevelComma(f.expr);
    const bounds = splitTopLevelComma(f.range || '');
    if (edges.length !== 2 || bounds.length !== 2 || [...edges, ...bounds].some(s => !s))
      throw new Error('fill needs two boundary expressions and range: start, end');
    return { f, upper: makeEval(edges[0]), lower: makeEval(edges[1]),
      start: makeEval(bounds[0]), end: makeEval(bounds[1]) };
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
      fills.forEach(fill => scopes.forEach(sc => ys.push(...sampleGraphFill(fill, sc).y)));
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
  const equalAspect = g.type !== 'function2d' || /^equal$/i.test(g.aspect);
  if (equalAspect) [xr, yr] = fitAspect(xr, yr, wPx, hPx);

  const xCap = captionSpec(g.xlabel), yCap = captionSpec(g.ylabel);
  const axisColor = 'var(--line-h)';
  const mutedColor = 'var(--text-m)';
  const tickFontPx = Math.round(graphFontPx * 0.78);
  const tickGap = Math.max(72, tickFontPx * 4.8);
  let board;
  const tickStep = axis => graphTickStep(board ? (axis === 'x' ? board.unitX : board.unitY)
    : (axis === 'x' ? wPx / (xr[1] - xr[0]) : hPx / (yr[1] - yr[0])), tickGap);
  const axisTicks = axis => ({
    insertTicks: false, ticksDistance: tickStep(axis),
    minorTicks: 0, majorHeight: 0, minorHeight: 0,
    drawLabels: true, drawZero: false, highlight: false,
    label: {
      strokeColor: mutedColor, fontSize: tickFontPx, display: 'html',
      highlight: false, highlightStrokeColor: mutedColor, highlightStrokeOpacity: 1,
      cssClass: 'sv-graph-tick', highlightCssClass: 'sv-graph-tick',
      offset: axis === 'x' ? [0, -10] : [-10, 0],
    },
  });
  board = JXG.JSXGraph.initBoard(el.id, {
    boundingbox: [xr[0], yr[1], xr[1], yr[0]],
    keepAspectRatio: equalAspect,
    axis: true, grid: false,
    showCopyright: false, showNavigation: false, showInfobox: false,
    pan: { enabled: false }, zoom: { enabled: false },
    defaultAxes: {
      x: {
        strokeColor: axisColor, strokeWidth: 1.25, strokeOpacity: 0.75, highlight: false, lastArrow: false,
        name: xCap.text, withLabel: !!xCap.text,
        label: labelAttrs(xCap, mutedColor, { position: 'rt', offset: [-12, 12], anchorX: 'right', anchorY: 'bottom' }),
        ticks: axisTicks('x'),
      },
      y: {
        strokeColor: axisColor, strokeWidth: 1.25, strokeOpacity: 0.75, highlight: false, lastArrow: false,
        name: yCap.text, withLabel: !!yCap.text,
        label: labelAttrs(yCap, mutedColor, { position: 'rt', offset: [10, -8], anchorX: 'left', anchorY: 'top' }),
        ticks: axisTicks('y'),
      },
    },
  });
  liveBoards.push(board);
  board.on('boundingbox', () => {
    board.suspendUpdate();
    ['x', 'y'].forEach(axis => board.defaultAxes[axis].ticks[0].setAttribute({ ticksDistance: tickStep(axis) }));
    board.unsuspendUpdate();
  });
  board.suspendUpdate();

  // Place a single origin "0" tucked neatly into the third quadrant using dynamic
  // pixel offsets (JSXGraph ignores `offset` on standalone text elements).
  if (xr[0] < 0 && xr[1] > 0 && yr[0] < 0 && yr[1] > 0) {
    board.create('text', [() => -8 / board.unitX, () => -8 / board.unitY, '0'], {
      strokeColor: mutedColor, highlightStrokeColor: mutedColor, highlightStrokeOpacity: 1,
      fontSize: tickFontPx, display: 'html', fixed: true, highlight: false,
      anchorX: 'right', anchorY: 'top',
      cssClass: 'sv-graph-tick', highlightCssClass: 'sv-graph-tick',
    });
  }

  try {
    board.create('grid', [], {
      majorStep: 'auto', minorElements: 0,
      strokeColor: 'var(--border-h)', strokeWidth: 1, highlight: false,
      major: { face: 'line', strokeOpacity: 0.28, drawZero: false },
    });
  } catch (e) { console.warn('Graph grid styling skipped:', e); }

  const legend = [];

  // Closed sampled paths behind the axes and curves. Recompute on every slider update.
  fills.forEach((fill, i) => {
    const color = safeColor(fill.f.color, GRAPH_PALETTE[i % GRAPH_PALETTE.length]);
    const rawOpacity = Number(fill.f.opacity);
    const opacity = fill.f.opacity && Number.isFinite(rawOpacity) ? Math.max(0, Math.min(1, rawOpacity)) : 0.22;
    const region = board.create('curve', [[], []], {
      fillColor: color, fillOpacity: opacity, strokeWidth: 0,
      highlight: false, fixed: true, layer: 1,
    });
    region.updateDataArray = function () {
      const data = sampleGraphFill(fill, base());
      this.dataX = data.x;
      this.dataY = data.y;
    };
    if (fill.f.label) legend.push({ label: fill.f.label, color, fill: true, opacity });
  });

  // Curves — confident weight so the main mathematical object leads the visual hierarchy.
  curves.forEach((c, i) => {
    const color = safeColor(c.tr.color, GRAPH_PALETTE[i % GRAPH_PALETTE.length]);
    if (g.type === 'function2d') {
      board.create('functiongraph', [x => c.f(Object.assign(base(), { x }))],
        { strokeColor: color, strokeWidth: 3.25, lineCap: 'round', highlight: false });
    } else {
      const [lo, hi] = g.trange || [0, 2 * Math.PI];
      board.create('curve', [
        t => c.fx(Object.assign(base(), { t })),
        t => c.fy(Object.assign(base(), { t })),
        lo, hi,
      ], { strokeColor: color, strokeWidth: 3.25, lineCap: 'round', highlight: false, numberPoints: GRAPH_SAMPLES_1D });
    }
    if (c.tr.label) legend.push({ label: c.tr.label, color });
  });

  // Vector field: arrows centred on a uniform square grid across the visible viewport.
  if (g.type === 'vectorfield2d') {
    const [vx0, vx1] = xr, [vy0, vy1] = yr;
    const spanY = vy1 - vy0, spanX = vx1 - vx0;
    const ny = Math.min(GRAPH_SAMPLES_FIELD, 11);
    const cell = spanY / ny;
    const nx = Math.max(3, Math.min(24, Math.round(spanX / cell)));
    const xs = graphLinspace(vx0 + cell * 0.5, vx1 - cell * 0.5, nx);
    const ys = graphLinspace(vy0 + cell * 0.5, vy1 - cell * 0.5, ny);
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
    const k = (0.76 * cell) / maxMag; // longest arrow spans 76% of a cell
    sample.forEach(s => {
      const dx = s.u * k, dy = s.v * k;
      if (Math.hypot(dx, dy) < cell * 0.05) return; // effectively zero: skip the stub
      const magRatio = Math.hypot(s.u, s.v) / maxMag;
      board.create('segment', [[s.x - dx / 2, s.y - dy / 2], [s.x + dx / 2, s.y + dy / 2]], {
        strokeColor: color, strokeWidth: 1.75,
        strokeOpacity: 0.45 + 0.5 * magRatio,
        lineCap: 'round', fixed: true, highlight: false,
        lastArrow: { type: 2, size: 4 },
        point1: { visible: false, fixed: true, withLabel: false },
        point2: { visible: false, fixed: true, withLabel: false },
      });
    });
  }

  // Segments, then points on top.
  const segmentObjs = segments.map(sg => {
    const hasCustomColor = !!sg.s.color;
    const color = safeColor(sg.s.color, textColor);
    const dashed = /^(true|1|yes)$/i.test(sg.s.dashed || '');
    const cap = captionSpec(sg.s.label);
    const segOffset = sg.s.offset ? { offset: parseNumList(sg.s.offset, 2, [0, 10]) } : {};
    return board.create('segment', [
      [() => sg.a(base()), () => sg.b(base())],
      [() => sg.c(base()), () => sg.d(base())],
    ], {
      strokeColor: color,
      strokeWidth: dashed ? 1.65 : 2,
      strokeOpacity: hasCustomColor ? 0.92 : (dashed ? 0.55 : 0.8),
      lineCap: 'round', highlight: false, fixed: true,
      dash: dashed ? 2 : 0,
      name: cap.text, withLabel: !!cap.text,
      label: labelAttrs(cap, textColor, segOffset),
      point1: { visible: false, fixed: true, withLabel: false },
      point2: { visible: false, fixed: true, withLabel: false },
    });
  });
  const pointObjs = points.map(pt => {
    const color = safeColor(pt.p.color, GRAPH_PALETTE[1]);
    const cap = captionSpec(pt.p.label);
    const [dx, dy] = parseNumList(pt.p.offset, 2, [10, 10]);
    return board.create('point', [() => pt.fx(base()), () => pt.fy(base())], {
      size: 4.75, face: 'o', fillColor: color, strokeColor: 'var(--bg)', strokeWidth: 2,
      fixed: true, highlight: false, showInfobox: false,
      name: cap.text, withLabel: !!cap.text,
      label: labelAttrs(cap, textColor, { offset: [dx, dy] }),
    });
  });

  board.unsuspendUpdate();
  const tidyLabels = () => resolveGraphLabelOverlaps(board, el, pointObjs, segmentObjs);
  tidyLabels();
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(tidyLabels);
  board.on('boundingbox', tidyLabels);

  // Legend (HTML, so labels can use \( \) like the rest of the page).
  const leg = document.getElementById(`sv-graph-legend-${id}`);
  if (leg && legend.length) {
    leg.innerHTML = legend.map(it => it.fill
      ? `<span class="sv-graph-legend-item"><span class="sv-graph-swatch-fill" style="background:${it.color};border-color:${it.color};opacity:${Math.min(1, it.opacity + 0.2)}"></span><span>${svEsc(it.label)}</span></span>`
      : `<span class="sv-graph-legend-item"><span class="sv-graph-swatch-line" style="background:${it.color}"></span><span>${svEsc(it.label)}</span></span>`
    ).join('');
    renderMath(leg);
  }

  // Sliders (HTML range inputs under the plot; touch-friendly and independent of board coordinates).
  const ctl = document.getElementById(`sv-graph-controls-${id}`);
  if (ctl && sliders.length) {
    const fmt = v => String(Math.round(v * 1e4) / 1e4);
    sliders.forEach(s => {
      const row = document.createElement('label');
      row.className = 'sv-graph-slider';
      const name = document.createElement('span');
      name.className = 'sv-graph-slider-label';
      const symbol = document.createElement('span');
      symbol.textContent = `${s.name} =`;
      const value = document.createElement('span');
      value.className = 'sv-graph-slider-value';
      name.append(symbol, value);
      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'sv-graph-slider-input';
      input.setAttribute('aria-label', s.name);
      input.min = s.lo; input.max = s.hi; input.step = s.step; input.value = s.value;
      const show = () => {
        value.textContent = fmt(s.value);
        const progress = s.hi > s.lo ? 100 * (s.value - s.lo) / (s.hi - s.lo) : 0;
        input.style.setProperty('--slider-fill', `${Math.max(0, Math.min(100, progress))}%`);
      };
      input.addEventListener('input', () => {
        s.value = parseFloat(input.value);
        show();
        board.update();
        tidyLabels();
      });
      show();
      row.append(name, input);
      ctl.appendChild(row);
    });
  }
}

/* ── CALLOUT ──
   Structured textbook card for formal statements, rules, axioms, remarks,
   pitfalls, and collapsible proofs/derivations. Leading "key: value" lines
   (id, label, title, tone, collapsed) are parsed only until the first blank
   line or non-header line, so colons in the body are never misread. */
const CALLOUT_HEADER_RE = /^(id|label|title|tone|collapsed):\s*(.*)$/i;
const VALID_CALLOUT_TONES = new Set(['key', 'note', 'caution']);

function parseCalloutBody(raw) {
  const lines = String(raw || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const meta = { id: '', label: '', title: '', tone: 'key', collapsed: false };
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) { i++; break; }
    const m = trimmed.match(CALLOUT_HEADER_RE);
    if (!m) break;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'id' && /^[a-z0-9_-]+$/i.test(val)) meta.id = val.toLowerCase();
    else if (key === 'label') meta.label = val;
    else if (key === 'title') meta.title = val;
    else if (key === 'tone' && VALID_CALLOUT_TONES.has(val.toLowerCase())) meta.tone = val.toLowerCase();
    else if (key === 'collapsed') meta.collapsed = /^(true|1|yes)$/i.test(val);
    i++;
  }
  const body = lines.slice(i).join('\n').trim();
  return { ...meta, body };
}

function renderCallout(c) {
  const anchorAttr = c.id ? ` data-anchor="${svEsc(c.id)}"` : '';
  const labelHtml = c.label ? `<span class="sv-callout-label">${svEsc(c.label)}</span>` : '';
  const titleHtml = c.title ? `<span class="sv-callout-title">${svEsc(c.title)}</span>` : '';
  const bodyHtml = typeof renderProse === 'function'
    ? renderProse(c.body, { anchorPrefix: c.id })
    : `<p>${svEsc(c.body)}</p>`;
  if (c.collapsed) {
    const heading = (labelHtml || titleHtml)
      ? `${labelHtml}${titleHtml}`
      : `<span class="sv-callout-label">${typeof uiHTML === 'function' ? uiHTML('Details') : 'Details'}</span>`;
    return `<details class="sv-callout sv-callout-${c.tone} sv-callout-collapsible"${anchorAttr}>
      <summary class="sv-callout-head"><span class="sv-callout-arrow" aria-hidden="true">▶</span><span class="sv-callout-heading">${heading}</span></summary>
      <div class="sv-callout-body">${bodyHtml}</div>
    </details>`;
  }
  const headHtml = (labelHtml || titleHtml)
    ? `<div class="sv-callout-head"><span class="sv-callout-heading">${labelHtml}${titleHtml}</span></div>`
    : '';
  return `<aside class="sv-callout sv-callout-${c.tone}"${anchorAttr}>${headHtml}<div class="sv-callout-body">${bodyHtml}</div></aside>`;
}

/* ── Registry ──
   tag: the bracket tag in the .txt; code: the letter in the placeholder token
   that stands in for the block during section splitting; key: the Map key on
   the parsed session; parse / render / optional mount. */
const BLOCK_TOOLS = [
  { tag: 'TABLE',    code: 'T', key: 'tables',    parse: parseTableBody,    render: renderTable },
  { tag: 'TIMELINE', code: 'L', key: 'timelines', parse: parseTimelineBody, render: renderTimeline },
  { tag: 'CALLOUT',  code: 'C', key: 'callouts',  parse: parseCalloutBody,  render: renderCallout },
  { tag: 'GRAPH',    code: 'G', key: 'graphs',    parse: parseGraphBody,    render: renderGraph, mount: mountGraph },
];
