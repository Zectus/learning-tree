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
   Plotly and math.js are large and only needed for [GRAPH] blocks, so they
   are loaded on first use (loadGraphLibs below).
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
   "key: value" lines plus repeatable "trace:" lines. The authoritative
   format spec is in node-prompt.js; this parser accepts exactly that.
   Types: function2d, parametric2d, surface3d, vectorfield2d. Keys: type,
   title, xlabel, ylabel, zlabel, xrange, yrange, trange, z (surface3d),
   u/v (vectorfield2d), trace (function2d/parametric2d):
     trace: <expression> | label: <text> | color: <optional>
   A parametric2d trace packs both components comma-separated.
   Titles and axis labels are captions typeset by the app's own KaTeX pass,
   not Plotly's MathJax — one math engine for the whole app. */
function parseGraphBody(raw) {
  const g = { type: 'function2d', title: '', xlabel: '', ylabel: '', zlabel: '', traces: [] };
  raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) return;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'trace') {
      // Split only on a spaced "|" (same rule as TABLE), so a slip can't corrupt the trace.
      const [expr, ...metaParts] = val.split(/\s\|\s/).map(s => s.trim());
      const trace = { expr };
      metaParts.forEach(mp => {
        const mm = mp.match(/^(\w+):\s*(.*)$/);
        if (mm) trace[mm[1].toLowerCase()] = mm[2].trim();
      });
      g.traces.push(trace);
    } else if (key === 'xrange' || key === 'yrange' || key === 'trange') {
      g[key] = val.split(',').map(s => parseFloat(s.trim()));
    } else {
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
const PLOTLY_URL = 'https://cdn.plot.ly/plotly-3.6.0.min.js';
const MATHJS_URL = 'https://cdn.jsdelivr.net/npm/mathjs@15.2.0';
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
function loadGraphLibs() { return Promise.all([loadScriptOnce(PLOTLY_URL), loadScriptOnce(MATHJS_URL)]); }

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

const GRAPH_DEFAULT_RANGE = [-10, 10];
const GRAPH_SAMPLES_1D    = 300; // function2d / parametric2d curve resolution
const GRAPH_SAMPLES_GRID  = 40;  // surface3d, per axis
const GRAPH_SAMPLES_FIELD = 15;  // vectorfield2d arrows, per axis

function renderGraph(g, id) {
  const title = g.title ? `<div class="sv-graph-title">${svEsc(g.title)}</div>` : '';
  return `<div class="sv-graph-wrap">${title}<div class="sv-graph-plot" id="sv-graph-${id}"></div></div>`;
}

/* Runs after renderGraph()'s markup is in a visible page: Plotly must measure
   a real, laid-out element. Async because the libraries load on first use. */
async function mountGraph(g, id) {
  const el = document.getElementById(`sv-graph-${id}`);
  if (!el) return;
  el.classList.add('sv-graph-loading');
  try {
    await loadGraphLibs();
  } catch {
    el.classList.remove('sv-graph-loading');
    el.textContent = "This graph couldn't be loaded — check your connection and reopen the lesson.";
    return;
  }
  el.classList.remove('sv-graph-loading');
  if (!el.isConnected) return; // the viewer moved on to another lesson while the libraries loaded

  const layout = {
    margin: { t: 10, r: 10, b: 40, l: 50 },
    xaxis: { title: g.xlabel || '' },
    yaxis: { title: g.ylabel || '' },
    showlegend: g.traces.length > 1,
  };
  let traces = [];

  try {
    if (g.type === 'function2d') {
      const [lo, hi] = g.xrange || GRAPH_DEFAULT_RANGE;
      const xs = graphLinspace(lo, hi, GRAPH_SAMPLES_1D);
      traces = g.traces.map(tr => {
        const f = compileGraphExpr(tr.expr);
        const ys = xs.map(x => { try { return f.evaluate({ x }); } catch { return null; } });
        return { x: xs, y: ys, type: 'scatter', mode: 'lines', name: tr.label || tr.expr, line: tr.color ? { color: tr.color } : undefined };
      });

    } else if (g.type === 'parametric2d') {
      const [lo, hi] = g.trange || [0, 2 * Math.PI];
      const ts = graphLinspace(lo, hi, GRAPH_SAMPLES_1D);
      traces = g.traces.map(tr => {
        const [exprX, exprY] = splitTopLevelComma(tr.expr);
        const fx = compileGraphExpr(exprX), fy = compileGraphExpr(exprY);
        const xs = ts.map(t => { try { return fx.evaluate({ t }); } catch { return null; } });
        const ys = ts.map(t => { try { return fy.evaluate({ t }); } catch { return null; } });
        return { x: xs, y: ys, type: 'scatter', mode: 'lines', name: tr.label || tr.expr, line: tr.color ? { color: tr.color } : undefined };
      });

    } else if (g.type === 'surface3d') {
      const [xlo, xhi] = g.xrange || GRAPH_DEFAULT_RANGE;
      const [ylo, yhi] = g.yrange || GRAPH_DEFAULT_RANGE;
      const xs = graphLinspace(xlo, xhi, GRAPH_SAMPLES_GRID);
      const ys = graphLinspace(ylo, yhi, GRAPH_SAMPLES_GRID);
      const f  = compileGraphExpr(g.z);
      // Plotly's surface convention: z[iy][ix] is the value at (xs[ix], ys[iy]).
      const zGrid = ys.map(y => xs.map(x => { try { return f.evaluate({ x, y }); } catch { return null; } }));
      traces = [{ x: xs, y: ys, z: zGrid, type: 'surface', showscale: false }];
      layout.scene = { xaxis: { title: g.xlabel || '' }, yaxis: { title: g.ylabel || '' }, zaxis: { title: g.zlabel || '' } };

    } else if (g.type === 'vectorfield2d') {
      const [xlo, xhi] = g.xrange || GRAPH_DEFAULT_RANGE;
      const [ylo, yhi] = g.yrange || GRAPH_DEFAULT_RANGE;
      const xs = graphLinspace(xlo, xhi, GRAPH_SAMPLES_FIELD);
      const ys = graphLinspace(ylo, yhi, GRAPH_SAMPLES_FIELD);
      const fu = compileGraphExpr(g.u), fv = compileGraphExpr(g.v);
      const px = [], py = [], angle = [], mag = [];
      xs.forEach(x => ys.forEach(y => {
        let u = 0, v = 0;
        try { u = fu.evaluate({ x, y }); v = fv.evaluate({ x, y }); } catch {}
        px.push(x); py.push(y);
        angle.push(Math.atan2(v, u) * 180 / Math.PI);
        mag.push(Math.hypot(u, v));
      }));
      const maxMag = Math.max(...mag, 1e-9);
      // Plotly's 'arrow' marker with a per-point angle is a quiver plot; size
      // scales with field magnitude so the arrows carry that too.
      traces = [{
        x: px, y: py, type: 'scatter', mode: 'markers', hoverinfo: 'skip',
        marker: { symbol: 'arrow', angle, size: mag.map(m => 8 + 14 * (m / maxMag)), color: g.traces[0]?.color || undefined },
      }];
    }
  } catch (e) {
    console.error('Graph render error:', e);
    el.textContent = 'This graph could not be rendered.';
    return;
  }

  Plotly.newPlot(el, traces, layout, { displayModeBar: false, responsive: true });
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
