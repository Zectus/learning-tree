/* ═══════════════════════════════════════════════════════════
   layout.js — pure graph-computation layer: depth assignment,
   left-to-right layout, node-status resolution, SVG edge rendering,
   hover highlight. No user interaction. Depends on state.js and
   scale.js (window.UI_SCALE).
═══════════════════════════════════════════════════════════ */

// Node pixel sizes are fixed at load from the UI scale (see scale.js).
const LAYOUT_SCALE = window.UI_SCALE || 1;
const BASE_W = 190 * LAYOUT_SCALE;
const BASE_H = 72  * LAYOUT_SCALE;
const COL_W  = 260 * LAYOUT_SCALE;  // horizontal px between depth columns
const ROW_H  = 110 * LAYOUT_SCALE;  // vertical px between nodes in the same column

function nodeW() { return Math.round(BASE_W); }
function nodeH() { return Math.round(BASE_H); }

/* ═══════════════════════════════════════════════════════════
   DEPTH ASSIGNMENT — longest path from any root (Kahn's algorithm).
   Nodes caught in a cycle are never dequeued and fall back to depth 0;
   loadFromJSON and finishLink both refuse to create cycles.
═══════════════════════════════════════════════════════════ */
function recomputeDepths() {
  const depth = new Map(), indegree = new Map(), queue = [];
  state.nodes.forEach((_, id) => {
    const n = state.prereqs.get(id)?.size ?? 0;
    indegree.set(id, n);
    if (n === 0) { depth.set(id, 0); queue.push(id); }
  });
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i];
    state.dependents.get(id)?.forEach(t => {
      depth.set(t, Math.max(depth.get(t) ?? 0, depth.get(id) + 1));
      indegree.set(t, indegree.get(t) - 1);
      if (indegree.get(t) === 0) queue.push(t);
    });
  }
  state.nodes.forEach((node, id) => { node.depth = depth.get(id) ?? 0; });
}

/* ═══════════════════════════════════════════════════════════
   LEFT-TO-RIGHT LAYOUT — depth 0 on the left, one column per level;
   each column sorted by the average y of its prerequisites so edges
   stay as untangled as possible.
═══════════════════════════════════════════════════════════ */
function layout() {
  if (state.nodes.size === 0) { renderEdges(); return; }
  recomputeDepths();

  const byDepth = new Map();
  state.nodes.forEach((node, id) => {
    if (!byDepth.has(node.depth)) byDepth.set(node.depth, []);
    byDepth.get(node.depth).push(id);
  });

  [...byDepth.keys()].sort((a, b) => a - b).forEach(depth => {
    const col = byDepth.get(depth);
    // Prerequisites sit in earlier columns, so their _cy is already set.
    const avgPrereqY = id => {
      const ps = prereqsOf(id);
      if (!ps.length) return id; // roots: stable order by id
      return ps.reduce((s, pid) => s + (state.nodes.get(pid)?._cy ?? 0), 0) / ps.length;
    };
    col.sort((a, b) => avgPrereqY(a) - avgPrereqY(b));

    col.forEach((id, i) => {
      const node = state.nodes.get(id);
      const cy = (i - (col.length - 1) / 2) * ROW_H;
      node.x   = depth * COL_W;
      node.y   = cy - nodeH() / 2;
      node._cy = cy;
    });
  });

  applyNodePositions();
  updateDepthClasses();
  renderEdges();
}

function applyNodePositions() {
  state.nodes.forEach(data => {
    if (!data.el) return;
    data.el.style.left  = data.x + 'px';
    data.el.style.top   = data.y + 'px';
    data.el.style.width = nodeW() + 'px';
  });
}

function updateDepthClasses() {
  state.nodes.forEach(data => {
    if (!data.el) return;
    data.el.classList.remove('root', 'd1', 'd2', 'd3', 'd4');
    data.el.classList.add(data.depth === 0 ? 'root' : `d${Math.min(data.depth, 4)}`);
    // Text/badge/padding sizes are set inline (not in rem) so they track the UI scale.
    const s = LAYOUT_SCALE;
    const textEl = data.el.querySelector('.node-text');
    if (textEl) {
      textEl.style.fontSize   = (data.depth === 0 ? 15 : 13.5) * s + 'px';
      textEl.style.fontWeight = data.depth === 0 ? '500' : '';
    }
    const badge = data.el.querySelector('.node-badge');
    if (badge) badge.style.fontSize = (10 * s) + 'px';
    const tag = data.el.querySelector('.node-tag');
    if (tag) tag.style.fontSize = (10 * s) + 'px';
    const inner = data.el.querySelector('.node-inner');
    if (inner) inner.style.padding = `${Math.round(10*s)}px ${Math.round(14*s)}px ${Math.round(11*s)}px`;
  });
}

/* ═══════════════════════════════════════════════════════════
   NODE STATUS
═══════════════════════════════════════════════════════════ */
function nodeStatus(id) {
  const node = state.nodes.get(id);
  if (!node) return 'locked';
  if (node.done) return 'done';
  return prereqsOf(id).every(pid => state.nodes.get(pid)?.done) ? 'available' : 'locked';
}

function updateAllStatuses() {
  const editing = state.mode === 'edit';
  state.nodes.forEach((node, id) => {
    if (!node.el) return;
    const s = nodeStatus(id);
    node.el.classList.remove('status-done', 'status-available', 'status-locked');
    node.el.classList.add(`status-${s}`);
    const badge = node.el.querySelector('.node-badge');
    if (badge) badge.textContent = s === 'done' ? '✓ complete' : s === 'available' ? '● available' : '○ locked';

    // Outside edit mode a node is one button; in edit mode it holds its own controls.
    if (editing) {
      ['role', 'aria-label', 'aria-disabled'].forEach(a => node.el.removeAttribute(a));
    } else {
      node.el.setAttribute('role', 'button');
      node.el.setAttribute('aria-label', `${node.label || 'Untitled'}, ${s === 'done' ? 'complete' : s}`);
      node.el.setAttribute('aria-disabled', s === 'locked' ? 'true' : 'false');
    }
  });
  updateEdgeStyles();
  updateProgress();
}

function updateProgress() {
  const total = state.nodes.size;
  const done  = [...state.nodes.values()].filter(n => n.done).length;
  progBar.style.width = total ? (done / total * 100) + '%' : '0%';
}

/* ═══════════════════════════════════════════════════════════
   EDGE RENDERING
   Edges always run from a lower depth column to a higher one, so each
   curve starts at the prerequisite's right edge and ends at the
   dependent's left edge — that's what keeps the arrowhead visible
   instead of buried under the opaque node card.
   Path elements are cached by edge key; nothing queries the DOM per edge.
═══════════════════════════════════════════════════════════ */
const edgeEls = new Map(); // edge key → <path>

function nodeCenterY(data) { return data._cy ?? (data.y + nodeH() / 2); }

function clearEdgeEls() {
  edgeEls.forEach(p => p.remove());
  edgeEls.clear();
}

function edgeStatus(fromId, toId) {
  const f = state.nodes.get(fromId), t = state.nodes.get(toId);
  if (!f || !t) return 'lock';
  if (f.done && t.done) return 'done';
  if (f.done) return 'available';
  return 'lock';
}

function renderEdges() {
  edgeEls.forEach((path, key) => {
    if (!state.edges.has(key)) { path.remove(); edgeEls.delete(key); }
  });

  forEachEdge((fid, tid, key) => {
    const from = state.nodes.get(fid), to = state.nodes.get(tid);
    if (!from || !to) return;

    let path = edgeEls.get(key);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.classList.add('connector');
      path.dataset.edge = key;
      svgWorld.appendChild(path);
      edgeEls.set(key, path);
    }

    const sx = from.x + nodeW(), sy = nodeCenterY(from);
    const tx = to.x,             ty = nodeCenterY(to);
    const mx = (sx + tx) / 2;
    path.setAttribute('d', `M${sx},${sy} C${mx},${sy} ${mx},${ty} ${tx},${ty}`);
    path.setAttribute('stroke-width', 1.8);
  });
  updateEdgeStyles();
}

const EDGE_MARKERS = { done: 'arrow-done', available: 'arrow-avail', lock: 'arrow-lock' };

function updateEdgeStyles() {
  forEachEdge((fid, tid, key) => {
    const path = edgeEls.get(key);
    if (!path) return;
    const es = edgeStatus(fid, tid);
    path.classList.remove('edge-done', 'edge-available', 'edge-lock');
    path.classList.add(`edge-${es}`);
    path.setAttribute('marker-end', `url(#${EDGE_MARKERS[es]})`);
  });
}

/* Hover focus: prerequisite edges turn blue, dependent edges orange,
   everything else fades. */
function highlightEdges(id) {
  document.body.classList.add('node-focused');
  forEachEdge((fid, tid, key) => {
    const path = edgeEls.get(key);
    if (!path) return;
    if (tid === id) path.classList.add('hi-prereq');
    else if (fid === id) path.classList.add('hi-dep');
  });
}

function clearEdgeHighlight() {
  document.body.classList.remove('node-focused');
  edgeEls.forEach(p => p.classList.remove('hi-prereq', 'hi-dep'));
}
