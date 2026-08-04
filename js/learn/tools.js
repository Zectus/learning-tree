/* ═══════════════════════════════════════════════════════════
   tools.js — self-contained content-block "tools": tables,
   timelines, and math graphs, plus the KaTeX plumbing they (and
   plain prose) all share. Anything here follows the same shape:
   a [TAG]...[/TAG] block in the .txt, a parse function, a render
   function that returns markup, and — for tools that need a real
   DOM element to attach to (currently just graphs, via Plotly) —
   a mount function that runs after that markup is actually in
   the page.

   What's deliberately NOT here: questions and bonuses. They look
   like content blocks too, but they're wired into session state
   (answer keys, scoring, checkpoints, per-node persistence) in a
   way none of these are — that's the interactive exercise engine,
   and it stays in viewer.js.

   Depends on: nothing outside the browser globals it uses
   (window.renderMathInElement from KaTeX's auto-render, window.Plotly,
   window.math from math.js). viewer.js depends on this file — see
   BLOCK_TOOLS below, which viewer.js's parser and renderer loop over
   generically instead of hardcoding a branch per block type. Adding a
   future tool means adding one entry to BLOCK_TOOLS; nothing in
   viewer.js has to change.

   EXTERNAL SCRIPTS REQUIRED (add to index.html, not loaded here):
   - KaTeX + the auto-render extension (already required before this
     file existed; unchanged)
   - Plotly.js, for GRAPH blocks
   - math.js (exposes the global `math`), for evaluating the
     expressions a GRAPH block's traces are written in
═══════════════════════════════════════════════════════════ */

/* ── shared small helpers ────── */
function svEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

/* ── KaTeX ────── 
   Single shared entry point for typesetting math after a block of HTML
   is inserted into the DOM — must run after insertion, not before, since
   KaTeX's auto-render walks real DOM text nodes. The delimiter config
   lives in exactly one place here, since prose, tables, timelines,
   graphs, and questions (rendered from viewer.js) all rely on the same
   pass over the same #sv-body. */
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

/* Collapses newlines inside \[...\] and \(...\) math spans into a single
   space, before any paragraph/line splitting happens. Splitting prose (or
   a table cell, timeline entry, graph label) into lines/paragraphs turns
   a multi-line display equation into separate DOM text nodes, and KaTeX's
   auto-render only matches delimiters within a single text node — so a
   display block written across multiple lines would otherwise render as
   broken, unrendered raw LaTeX instead of typeset math. Collapsing here,
   once, centrally, before parseTxtSession does any splitting, means every
   block downstream is already a single line by the time paragraph/line
   splitting ever sees it. */
function collapseMathNewlines(raw) {
  return raw
    .replace(/\\\[[\s\S]*?\\\]/g, m => m.replace(/\s*\n\s*/g, ' '))
    .replace(/\\\([\s\S]*?\\\)/g, m => m.replace(/\s*\n\s*/g, ' '));
}

/* ── TABLE ────── 
   [TABLE] rows are "cell | cell | cell" — first row is the header. Only a
   "|" with whitespace on both sides counts as a real column separator —
   that's what the format spec itself asks for ("cell | cell", always
   spaced) and it's also what actually distinguishes an intentional
   divider from a literal "|" that's part of a cell's own content: an
   absolute value bar, a \left|...\right| pair, a norm. "|x-y|" has no
   space on either side of either bar, so it never matches, regardless of
   whether it's wrapped in \( \), escaped, or — the case that actually
   broke this — not wrapped in math delimiters at all. Splitting on every
   bare "|" (what this used to do, and what a "protect math spans first"
   version of this still did) breaks the moment a cell's own content has
   that character and something upstream didn't wrap it the way it was
   supposed to; this doesn't depend on that having gone right. Shared with
   [TIMELINE] below, which has the identical problem on its own "|" split. */
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

/* ── TIMELINE ────── 
   [TIMELINE] rows are "marker | description" — marker is often a date/year
   but can be any short label (a stage name, "Step 1", etc). Same
   whitespace-boundary rule as TABLE: only the first whitespace-bounded
   "|" is the marker/text divider, so a math "|" inside either half —
   wrapped or not — can't be mistaken for it. */
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

/* ── GRAPH ────── 
   [GRAPH] blocks are "key: value" lines, plus one or more "trace: ..."
   lines for the types that support multiple traces. See node-prompt.js's
   OUTPUT FORMAT section for the authoritative spec handed to the model —
   this parser only has to accept exactly what that spec asks for.

   Recognized types: function2d, parametric2d, surface3d, vectorfield2d.
   Recognized keys: type, title, xlabel, ylabel, zlabel, xrange, yrange,
   trange, z (surface3d), u/v (vectorfield2d, the two component
   expressions), and repeated trace lines (function2d/parametric2d):
     trace: <expression> | label: <text> | color: <optional>
   parametric2d traces pack two expressions into one trace line, comma-
   separated: trace: cos(t), sin(t) | label: unit circle

   Titles/axis labels are plain captions rendered through the app's own
   KaTeX pass (see renderGraph below), not through Plotly's own title
   (which uses MathJax) — one math-typesetting engine for the whole app,
   and \( \) math notation works in graph labels for free as a result. */
function parseGraphBody(raw) {
  const g = { type: 'function2d', title: '', xlabel: '', ylabel: '', zlabel: '', traces: [] };
  raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) return;
    const key = m[1].toLowerCase(), val = m[2].trim();
    if (key === 'trace') {
      // Same whitespace-boundary rule as TABLE/TIMELINE — expressions here
      // shouldn't contain a bare "|" at all (mathjs syntax uses abs(), not
      // bars, per the prompt spec), but splitting only on a spaced "|"
      // rather than every "|" costs nothing and means a slip doesn't
      // silently corrupt the trace.
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

/* Splits "cos(t), sin(t)" into ["cos(t)", "sin(t)"] without breaking on a
   comma that's inside a function call's own argument list (e.g. an
   expression using atan2(y, x) as one of the two parametric components). */
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
function compileGraphExpr(expr) {
  try { return math.compile(expr); } catch (e) { console.error('Graph expression could not be parsed:', expr, e); return null; }
}
const GRAPH_DEFAULT_RANGE = [-10, 10];
const GRAPH_SAMPLES_1D    = 300; // function2d / parametric2d curve resolution
const GRAPH_SAMPLES_GRID  = 40;  // surface3d, per axis
const GRAPH_SAMPLES_FIELD = 15;  // vectorfield2d arrows, per axis

function renderGraph(g, id) {
  const title = g.title ? `<div class="sv-graph-title">${svEsc(g.title)}</div>` : '';
  return `<div class="sv-graph-wrap">${title}<div class="sv-graph-plot" id="sv-graph-${id}"></div></div>`;
}

/* Plotly needs a real, attached DOM element to measure and draw into —
   same reason KaTeX rendering and the session-window centering in
   viewer.js both wait until after their markup exists in the page — so
   this can't run at render time, only after renderGraph()'s output is
   actually in the DOM. viewer.js calls this via the BLOCK_TOOLS registry. */
function mountGraph(g, id) {
  const el = document.getElementById(`sv-graph-${id}`);
  if (!el || typeof Plotly === 'undefined' || typeof math === 'undefined') return;

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
      // Plotly's surface convention: z is rows-of-y, columns-of-x, i.e.
      // z[iy][ix] is the value at (xs[ix], ys[iy]).
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
      // Plotly's 'arrow' marker symbol with a per-point angle draws a
      // quiver plot directly — no manual line-segment/arrowhead building
      // needed. Size scales with local field magnitude so the arrows
      // themselves carry that information, not just their direction.
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

/* ── Registry ────── 
   Every entry here is one full "tool": the bracket tag it's written with
   in the .txt, the single-letter code used in the placeholder token that
   stands in for it during section-splitting, the Map key it's stored
   under on the parsed-session object, and its parse/render/mount
   functions. viewer.js's parseTxtSession and renderSession loop over this
   instead of hardcoding a branch per type — see the header comment above. */
const BLOCK_TOOLS = [
  { tag: 'TABLE',    code: 'T', key: 'tables',    parse: parseTableBody,    render: renderTable },
  { tag: 'TIMELINE', code: 'L', key: 'timelines', parse: parseTimelineBody, render: renderTimeline },
  { tag: 'GRAPH',    code: 'G', key: 'graphs',    parse: parseGraphBody,    render: renderGraph, mount: mountGraph },
];
