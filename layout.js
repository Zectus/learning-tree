/* ═══════════════════════════════════════════════════════════
   layout.js — pure graph-computation layer.
   Depth assignment, left-to-right layout, node-status
   resolution, SVG edge rendering, and hover highlight.
   No user interaction; depends on state.js only.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   LAYOUT CONSTANTS
═══════════════════════════════════════════════════════════ */
const BASE_W      = 190;
const BASE_H      = 72;
const DEPTH_SCALE = 1.0;   // uniform node size — no shrinking by depth
const MIN_SCALE   = 1.0;
const COL_W       = 260;   // horizontal px between depth columns
const ROW_H       = 110;   // vertical px between nodes in the same column

function depthS(d)  { return Math.max(MIN_SCALE, Math.pow(DEPTH_SCALE, d)); }
function nodeW(d)   { return Math.round(BASE_W * depthS(d)); }
function nodeH(d)   { return Math.round(BASE_H * depthS(d)); }

/* ═══════════════════════════════════════════════════════════
   DEPTH ASSIGNMENT
═══════════════════════════════════════════════════════════ */
function recomputeDepths() {
  const depth = new Map();
  const ids   = [...state.nodes.keys()];
  ids.forEach(id => { if (prereqsOf(id).length === 0) depth.set(id, 0); });
  let changed = true, guard = 0;
  while (changed && guard++ < 500) {
    changed = false;
    for (const k of state.edges) {
      const [f,t] = k.split('→').map(Number);
      const nd = (depth.get(f) ?? 0) + 1;
      if (!depth.has(t) || depth.get(t) < nd) { depth.set(t, nd); changed = true; }
    }
  }
  ids.forEach(id => { if (!depth.has(id)) depth.set(id, 0); });
  state.nodes.forEach((node, id) => { node.depth = depth.get(id) ?? 0; });
}

/* ═══════════════════════════════════════════════════════════
   LEFT-TO-RIGHT PROGRESS TREE LAYOUT
   Depth 0 (no prerequisites) on the left; each level one
   column to the right.  Nodes in each column are sorted by
   the average y-position of their prerequisites so edges
   stay as untangled as possible.
═══════════════════════════════════════════════════════════ */
function layout() {
  if (state.nodes.size === 0) { renderEdges(); return; }
  recomputeDepths();

  // 1. Group node ids by depth level
  const byDepth = new Map();
  state.nodes.forEach((node, id) => {
    const d = node.depth;
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(id);
  });
  const depthLevels = [...byDepth.keys()].sort((a, b) => a - b);

  // 2. Process columns left → right; sort each by average prereq y
  //    (prereqs are placed in the previous iteration, so their _cy is ready)
  depthLevels.forEach(depth => {
    const col = byDepth.get(depth);

    col.sort((a, b) => {
      const avgPrereqY = id => {
        const ps = prereqsOf(id);
        if (!ps.length) return id; // roots: stable order by id
        return ps.reduce((s, pid) => s + (state.nodes.get(pid)?._cy ?? 0), 0) / ps.length;
      };
      return avgPrereqY(a) - avgPrereqY(b);
    });

    const count = col.length;
    col.forEach((id, i) => {
      const node = state.nodes.get(id);
      const cy   = (i - (count - 1) / 2) * ROW_H;
      node.x     = depth * COL_W;
      node.y     = cy - nodeH(depth) / 2;
      node._cx   = depth * COL_W + nodeW(depth) / 2;
      node._cy   = cy;
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
    data.el.style.width = nodeW(data.depth) + 'px';
  });
}

function updateDepthClasses() {
  state.nodes.forEach(data => {
    if (!data.el) return;
    data.el.classList.remove('root','d1','d2','d3','d4');
    data.el.classList.add(data.depth === 0 ? 'root' : `d${Math.min(data.depth, 4)}`);
    const s = depthS(data.depth);
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
    if (inner) inner.style.padding =
      `${Math.round(10*s)}px ${Math.round(14*s)}px ${Math.round(11*s)}px`;
  });
}

/* ═══════════════════════════════════════════════════════════
   NODE STATUS
═══════════════════════════════════════════════════════════ */
function nodeStatus(id) {
  const node = state.nodes.get(id);
  if (!node) return 'locked';
  if (node.done) return 'done';
  const prereqs = prereqsOf(id);
  return prereqs.every(pid => state.nodes.get(pid)?.done) ? 'available' : 'locked';
}

function updateAllStatuses() {
  state.nodes.forEach((node, id) => {
    if (!node.el) return;
    const s = nodeStatus(id);
    node.el.classList.remove('status-done','status-available','status-locked');
    node.el.classList.add(`status-${s}`);
    const badge = node.el.querySelector('.node-badge');
    if (badge) {
      badge.textContent = s === 'done' ? '✓ complete'
                        : s === 'available' ? '● available' : '○ locked';
    }
  });
  updateEdgeStyles();
  updateProgress();
}

function updateProgress() {
  const total = state.nodes.size;
  const done  = [...state.nodes.values()].filter(n => n.done).length;
  progBar.style.width = total ? (done/total*100)+'%' : '0%';
}

/* ═══════════════════════════════════════════════════════════
   EDGE RENDERING  — center-to-center bezier curves
═══════════════════════════════════════════════════════════ */
function nodeCenter(data) {
  // Use the pre-computed center from layout if available
  if (data._cx != null) return { x: data._cx, y: data._cy };
  const el = data.el;
  const h  = el ? (el.offsetHeight || nodeH(data.depth)) : nodeH(data.depth);
  return {
    x: data.x + nodeW(data.depth) / 2,
    y: data.y + h / 2,
  };
}

function edgeStatus(fromId, toId) {
  const f = state.nodes.get(fromId);
  const t = state.nodes.get(toId);
  if (!f || !t) return 'lock';
  if (f.done && t.done) return 'done';
  if (f.done) return 'available';
  return 'lock';
}

function renderEdges() {
  document.querySelectorAll('.connector').forEach(p => {
    if (!state.edges.has(p.dataset.edge)) p.remove();
  });

  for (const key of state.edges) {
    const [fid, tid] = key.split('→').map(Number);
    const from = state.nodes.get(fid);
    const to   = state.nodes.get(tid);
    if (!from || !to) continue;

    let path = document.querySelector(`[data-edge="${key}"]`);
    if (!path) {
      path = document.createElementNS('http://www.w3.org/2000/svg','path');
      path.classList.add('connector');
      path.dataset.edge = key;
      svgWorld.appendChild(path);
    }

    const fc = nodeCenter(from);
    const tc = nodeCenter(to);
    const mx = (fc.x + tc.x) / 2;
    const my = (fc.y + tc.y) / 2;
    path.setAttribute('d', `M${fc.x},${fc.y} C${mx},${fc.y} ${mx},${tc.y} ${tc.x},${tc.y}`);
    path.setAttribute('stroke-width', Math.max(1, 1.8 * depthS(from.depth)));
  }
  updateEdgeStyles();
}

function updateEdgeStyles() {
  for (const key of state.edges) {
    const path = document.querySelector(`[data-edge="${key}"]`);
    if (!path) continue;
    const [fid,tid] = key.split('→').map(Number);
    const es = edgeStatus(fid,tid);
    path.classList.remove('edge-done','edge-available','edge-lock');
    path.classList.add(`edge-${es === 'lock' ? 'lock' : es}`);
    const markers = { done:'arrow-done', available:'arrow-avail', lock:'arrow-lock' };
    path.setAttribute('marker-end', `url(#${markers[es]??'arrow-lock'})`);
  }
}

/* ═══════════════════════════════════════════════════════════
   EDGE HIGHLIGHT ON HOVER
   Prereq edges → blue   Dependent edges → orange
   Everything else fades to near-invisible.
═══════════════════════════════════════════════════════════ */
function highlightEdges(id) {
  document.body.classList.add('node-focused');
  for (const key of state.edges) {
    const path = document.querySelector(`[data-edge="${key}"]`);
    if (!path) continue;
    const [fid, tid] = key.split('→').map(Number);
    if (tid === id) path.classList.add('hi-prereq');   // points INTO hovered node
    else if (fid === id) path.classList.add('hi-dep'); // points OUT of hovered node
  }
}

function clearEdgeHighlight() {
  document.body.classList.remove('node-focused');
  document.querySelectorAll('.hi-prereq, .hi-dep').forEach(p => {
    p.classList.remove('hi-prereq', 'hi-dep');
  });
}

