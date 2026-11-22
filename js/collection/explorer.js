/* Subject discovery: branch prerequisite sub-trees + local neighborhood graph
   (with dashed cross-branch prerequisites and unlocks) + full prerequisite path.
   A collection leaf is a scope. Adding it saves a draft in the existing library;
   the existing AI tree designer supplies its eventual learning-node structure. */
const mathItems = new Map();
const MATH_STAGES = { elementary:'Elementary', secondary:'Secondary', university:'University', advanced:'Upper undergraduate', graduate:'Graduate' };
const MATH_BANDS = { elementary:'Foundations', secondary:'Intermediate', university:'Core', advanced:'Advanced', graduate:'Research' };
const MATH_STAGE_BASE = { elementary:1, secondary:3, university:5, advanced:7, graduate:9 };
const MATH_BAR_HEIGHTS = [0.22, 0.28, 0.34, 0.4, 0.47, 0.54, 0.62, 0.71, 0.8, 0.9];
const MATH_COLORS = ['#73aa91','#c09bcb','#d2ad78','#83a8d0','#b6ae72','#bc9687','#83b7bb','#c894a2','#9b9bce','#a0b48b'];

function indexMathCollection(node, parent = null, family = 0, branch = null) {
  node.parent = parent;
  node.family = family;
  node.branch = parent ? (branch || node) : null;
  node.path = parent ? [...parent.path, node.name] : [node.name];
  node.depth = parent ? parent.depth + 1 : 0;
  node.count = 0;
  node.leaves = [];
  node.leadsInto = [];
  mathItems.set(node.id, node);
  if (node.children) {
    node.children.forEach((child, i) => {
      const nextFamily = parent ? family : i;
      const nextBranch = parent ? (branch || node) : child;
      indexMathCollection(child, node, nextFamily, nextBranch);
      node.count += child.count;
      node.leaves.push(...child.leaves);
    });
  } else {
    node.count = 1;
    node.leaves.push(node);
  }
}
indexMathCollection(MATH_COLLECTION);

// Build reverse prerequisite links (leadsInto) and 1-10 difficulty ratings across the collection.
for (const leaf of MATH_COLLECTION.leaves) {
  for (const prepId of (leaf.recommendedPreparation || [])) {
    const prep = mathItems.get(prepId);
    if (prep && !prep.children) prep.leadsInto.push(leaf.id);
  }
}
(() => {
  const prepDepth = new Map();
  function getDepth(id) {
    if (prepDepth.has(id)) return prepDepth.get(id);
    const ps = mathItems.get(id)?.recommendedPreparation || [];
    const d = ps.length ? 1 + Math.max(...ps.map(getDepth)) : 0;
    prepDepth.set(id, d);
    return d;
  }
  MATH_COLLECTION.leaves.forEach(l => getDepth(l.id));
  const stageSplit = {};
  for (const st of Object.keys(MATH_STAGE_BASE)) {
    const ds = MATH_COLLECTION.leaves.filter(l => l.stage === st).map(l => prepDepth.get(l.id)).sort((a, b) => a - b);
    stageSplit[st] = ds[Math.floor(ds.length * 0.52)] ?? 0;
  }
  for (const leaf of MATH_COLLECTION.leaves) {
    const base = MATH_STAGE_BASE[leaf.stage] || 1;
    leaf.difficulty = prepDepth.get(leaf.id) >= stageSplit[leaf.stage] ? base + 1 : base;
  }
})();

function renderDifficultyBars(level, { compact = false } = {}) {
  const scale = compact ? 0.86 : 1;
  const bars = MATH_BAR_HEIGHTS.map((h, i) => {
    const on = i < level;
    const alpha = (0.54 + (i / 9) * 0.42).toFixed(2);
    const rem = +(h * scale).toFixed(3);
    return `<i${on ? ` class="on" style="height:${rem}rem;--bar-a:${alpha}"` : ` style="height:${rem}rem"`}></i>`;
  }).join('');
  return `<span class="explorer-bars${compact ? ' explorer-bars-sm' : ''}" aria-hidden="true">${bars}</span>`;
}

function difficultyLabel(leaf) {
  return t('Level {n}/10 · {band}', { n: leaf.difficulty, band: t(MATH_BANDS[leaf.stage]) });
}

const mathAtlas = {
  branchId: MATH_COLLECTION.children[0].id,
  selectedId: null,
  subFocusId: null,
  mode: 'branch', // 'branch' | 'neighbors' | 'path'
  stage: '',
  returnTo: null,
  returnHash: '',
  busy: false
};
let mathBuilderSelection = null;

const mathEl = id => document.getElementById(id);
const mathOwner = () => state.accountUser ? 'cloud:' + state.accountUser.uid : 'local';
const mathNormalize = value => String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const mathIsOpen = () => mathEl('explorer-backdrop').classList.contains('open');
const mathEntry = id => Object.entries(libraryCache).find(([, entry]) => entry.data?.collectionId === id);
function mathMatchesStage(node) {
  return !mathAtlas.stage || (node.children ? node.children.some(mathMatchesStage) : node.stage === mathAtlas.stage);
}
function mathCurrentBranch() {
  const b = mathItems.get(mathAtlas.branchId);
  return (b && b.depth === 1) ? b : MATH_COLLECTION.children[0];
}

// ── DAG helpers ──────────────────────────────────────────────
function transitiveReduce(ids, parentsOf) {
  const idSet = new Set(ids);
  const ancCache = new Map();
  function ancestors(id) {
    if (ancCache.has(id)) return ancCache.get(id);
    const set = new Set();
    for (const p of parentsOf(id)) {
      if (!idSet.has(p)) continue;
      set.add(p);
      for (const a of ancestors(p)) set.add(a);
    }
    ancCache.set(id, set);
    return set;
  }
  const edges = [];
  for (const id of ids) {
    const direct = parentsOf(id).filter(p => idSet.has(p));
    for (const p of direct) {
      const redundant = direct.some(other => other !== p && ancestors(other).has(p));
      if (!redundant) edges.push([p, id]);
    }
  }
  return edges;
}

function layoutDagColumns(nodes, parentsOf) {
  const ids = nodes.map(n => n.id);
  const idSet = new Set(ids);
  const orderIndex = new Map(ids.map((id, i) => [id, i]));
  const edges = transitiveReduce(ids, parentsOf);

  // Longest-path column assignment
  const colOf = new Map();
  function getCol(id) {
    if (colOf.has(id)) return colOf.get(id);
    const ps = parentsOf(id).filter(p => idSet.has(p));
    const c = ps.length ? 1 + Math.max(...ps.map(getCol)) : 0;
    colOf.set(id, c);
    return c;
  }
  ids.forEach(getCol);

  const numCols = Math.max(1, ...ids.map(id => colOf.get(id) + 1));
  const cols = Array.from({ length: numCols }, () => []);
  ids.forEach(id => cols[colOf.get(id)].push(id));

  // Build reduced adjacency & weakly-connected components so unrelated sub-branches never interleave
  const inAdj = new Map(ids.map(id => [id, []]));
  const outAdj = new Map(ids.map(id => [id, []]));
  const undir = new Map(ids.map(id => [id, []]));
  for (const [u, v] of edges) {
    outAdj.get(u).push(v);
    inAdj.get(v).push(u);
    undir.get(u).push(v);
    undir.get(v).push(u);
  }

  const compOf = new Map();
  const comps = [];
  for (const id of ids) {
    if (compOf.has(id)) continue;
    const group = [];
    const q = [id];
    compOf.set(id, comps.length);
    while (q.length) {
      const cur = q.pop();
      group.push(cur);
      for (const nb of undir.get(cur)) {
        if (!compOf.has(nb)) { compOf.set(nb, comps.length); q.push(nb); }
      }
    }
    const minDiff = Math.min(...group.map(x => mathItems.get(x)?.difficulty || 1));
    const minOrder = Math.min(...group.map(x => orderIndex.get(x)));
    comps.push({ group, minDiff, minOrder });
  }
  comps.sort((a, b) => a.minDiff - b.minDiff || a.minOrder - b.minOrder);
  const compRank = new Map();
  comps.forEach((comp, idx) => comp.group.forEach(id => compRank.set(id, idx)));

  // Forward + backward barycenter sweeps within each component band
  const rowIndex = new Map();
  const refreshRows = () => cols.forEach(col => col.forEach((id, r) => rowIndex.set(id, r)));
  cols.forEach(col => col.sort((a, b) => compRank.get(a) - compRank.get(b) || orderIndex.get(a) - orderIndex.get(b)));
  refreshRows();

  const sortByNeighbors = (col, adjMap) => {
    col.sort((a, b) => {
      const ca = compRank.get(a), cb = compRank.get(b);
      if (ca !== cb) return ca - cb;
      const na = adjMap.get(a), nb = adjMap.get(b);
      const ba = na.length ? na.reduce((s, p) => s + rowIndex.get(p), 0) / na.length : Infinity;
      const bb = nb.length ? nb.reduce((s, p) => s + rowIndex.get(p), 0) / nb.length : Infinity;
      if (ba !== bb) return ba - bb;
      return orderIndex.get(a) - orderIndex.get(b);
    });
  };
  for (let pass = 0; pass < 2; pass++) {
    for (let c = 1; c < numCols; c++) { sortByNeighbors(cols[c], inAdj); refreshRows(); }
    for (let c = numCols - 2; c >= 0; c--) { sortByNeighbors(cols[c], outAdj); refreshRows(); }
  }

  return { cols, edges, colOf };
}

const mathScale = () => (typeof UI_SCALE === 'number' && UI_SCALE > 0 ? UI_SCALE : 1);

function edgeDefsMarkup() {
  return `<defs>
    <marker id="explorer-arrow-solid" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0,1 L6.5,3.5 L0,6 z" fill="var(--line-h)"/>
    </marker>
    <marker id="explorer-arrow-ext" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0,1 L6.5,3.5 L0,6 z" fill="var(--text-m)"/>
    </marker>
    <marker id="explorer-arrow-active" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
      <path d="M0,1 L6.5,3.5 L0,6 z" fill="var(--avail-bdr)"/>
    </marker>
  </defs>`;
}

function bezierPath(x1, y1, x2, y2, skipCols = 1) {
  const s = mathScale();
  const dx = Math.max(28 * s, (x2 - x1) * 0.44);
  if (skipCols > 1 && Math.abs(y1 - y2) < 14 * s) {
    const lift = 30 * s;
    return `M${x1},${y1} C${x1 + dx},${y1 - lift} ${x2 - dx},${y2 - lift} ${x2},${y2}`;
  }
  return `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
}

function externalLinkCount(leaf) {
  const branchId = leaf.branch?.id;
  let count = 0;
  for (const p of leaf.recommendedPreparation) if (mathItems.get(p)?.branch?.id !== branchId) count++;
  for (const u of leaf.leadsInto) if (mathItems.get(u)?.branch?.id !== branchId) count++;
  return count;
}

function renderNodeCard(leaf, { x, y, w, h, selected = false, external = false, dim = false, subFocus = false, showExtBadge = false }) {
  const saved = !!mathEntry(leaf.id);
  const extCount = showExtBadge ? externalLinkCount(leaf) : 0;
  const color = MATH_COLORS[leaf.family];
  const classes = ['explorer-node'];
  if (selected) classes.push('explorer-node-selected');
  if (external) classes.push('explorer-node-external');
  if (dim) classes.push('explorer-dim');
  if (subFocus) classes.push('explorer-subfocus');

  const diffTitle = difficultyLabel(leaf);
  const metaLeft = external
    ? `<span class="explorer-node-branch-tag"><span class="explorer-branch-dot" style="background:${color}"></span>${svEsc(leaf.branch.name)}</span>`
    : `<span class="explorer-diff" title="${svEsc(diffTitle)}">${renderDifficultyBars(leaf.difficulty)}<span class="explorer-diff-num">${leaf.difficulty}</span></span>`;

  const badges = [];
  if (external) badges.push(`<span class="explorer-diff" title="${svEsc(diffTitle)}">${renderDifficultyBars(leaf.difficulty, { compact: true })}</span>`);
  if (saved) badges.push(`<span class="explorer-node-saved" title="${svEsc(t('✓ In My Trees'))}">✓</span>`);
  if (extCount > 0) badges.push(`<span class="explorer-node-ext-badge" title="${svEsc(t('{n} cross-branch links', { n: extCount }))}">+${extCount}</span>`);

  const ariaLabel = external
    ? `${leaf.name}, ${leaf.branch.name}, ${diffTitle}`
    : `${leaf.name}, ${diffTitle}`;

  return `<button class="${classes.join(' ')}" data-math-id="${leaf.id}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px" aria-label="${svEsc(ariaLabel)}"${selected ? ' aria-current="true"' : ''}>
    <span class="explorer-node-top">
      <span class="explorer-node-dot" style="background:${color}" aria-hidden="true"></span>
      <span class="explorer-node-title">${svEsc(leaf.name)}</span>
    </span>
    <span class="explorer-node-meta">
      ${metaLeft}
      ${badges.length ? `<span class="explorer-node-badges">${badges.join('')}</span>` : ''}
    </span>
  </button>`;
}

// ── Renderers ────────────────────────────────────────────────
function renderBranchRail() {
  const activeBranchId = mathCurrentBranch().id;
  mathEl('explorer-rail').innerHTML = MATH_COLLECTION.children.map(branch => {
    const matching = branch.leaves.filter(mathMatchesStage).length;
    const active = branch.id === activeBranchId;
    const dim = mathAtlas.stage && matching === 0;
    const color = MATH_COLORS[branch.family];
    return `<button class="explorer-branch-btn${dim ? ' explorer-dim' : ''}" data-math-id="${branch.id}" aria-current="${active ? 'true' : 'false'}">
      <span class="explorer-branch-dot" style="background:${color}" aria-hidden="true"></span>
      <span class="explorer-branch-name">${svEsc(branch.name)}</span>
      <span class="explorer-branch-count">${mathAtlas.stage ? matching : branch.count}</span>
    </button>`;
  }).join('');
}

function renderGraphBar() {
  const bar = mathEl('explorer-graph-bar');
  const branch = mathCurrentBranch();
  if (!mathAtlas.selectedId) {
    const matching = branch.leaves.filter(mathMatchesStage).length;
    bar.innerHTML = `<div class="explorer-bar-left">
      <span class="explorer-branch-dot" style="background:${MATH_COLORS[branch.family]}" aria-hidden="true"></span>
      <span class="explorer-bar-title">${svEsc(branch.name)}</span>
      <span class="explorer-bar-hint">${uiHTML('{n} learning trees', { n: mathAtlas.stage ? matching : branch.count })} · ${uiHTML('Click any tree to see its prerequisites and what it unlocks')}</span>
    </div>`;
    return;
  }

  const node = mathItems.get(mathAtlas.selectedId);
  const home = node.branch || branch;
  const isNeighbors = mathAtlas.mode !== 'path';
  bar.innerHTML = `<div class="explorer-bar-left">
      <button id="explorer-back-branch" class="btn explorer-back-btn" data-math-id="${home.id}">← ${svEsc(home.name)}</button>
    </div>
    <div class="explorer-bar-right">
      <span class="explorer-legend" aria-hidden="true">
        <span class="explorer-legend-item"><span class="explorer-legend-swatch"></span>${uiHTML('Same branch')}</span>
        <span class="explorer-legend-item"><span class="explorer-legend-swatch dashed"></span>${uiHTML('Other branch')}</span>
      </span>
      <div class="explorer-mode-switch" role="group" aria-label="${svEsc(t('Graph view'))}">
        <button id="explorer-mode-neighbors" class="btn" aria-pressed="${isNeighbors}">${uiHTML('Neighbors')}</button>
        <button id="explorer-mode-path" class="btn" aria-pressed="${!isNeighbors}">${uiHTML('Full path')}</button>
      </div>
    </div>`;

  mathEl('explorer-mode-neighbors').addEventListener('click', () => {
    if (mathAtlas.mode === 'neighbors') return;
    mathAtlas.mode = 'neighbors';
    renderMathExplorer();
    const canvas = mathEl('explorer-canvas');
    if (canvas) { canvas.scrollLeft = 0; canvas.scrollTop = 0; }
  });
  mathEl('explorer-mode-path').addEventListener('click', () => {
    if (mathAtlas.mode === 'path') return;
    mathAtlas.mode = 'path';
    renderMathExplorer();
    const canvas = mathEl('explorer-canvas');
    if (canvas) { canvas.scrollLeft = canvas.scrollWidth; canvas.scrollTop = 0; }
  });
}

function renderBranchTree(branch) {
  const leaves = branch.leaves;
  const { cols, edges, colOf } = layoutDagColumns(leaves, id => mathItems.get(id).recommendedPreparation);

  const s = mathScale();
  const CARD_W = Math.round(216 * s), CARD_H = Math.round(82 * s);
  const COL_GAP = Math.round(64 * s), ROW_GAP = Math.round(16 * s);
  const PAD_X = Math.round(28 * s), PAD_Y = Math.round(24 * s);
  const maxRows = Math.max(1, ...cols.map(c => c.length));
  const contentH = maxRows * CARD_H + (maxRows - 1) * ROW_GAP;
  const totalW = PAD_X * 2 + cols.length * CARD_W + Math.max(0, cols.length - 1) * COL_GAP;
  const totalH = PAD_Y * 2 + contentH;

  const pos = new Map();
  const subFocusSet = mathAtlas.subFocusId ? new Set(mathItems.get(mathAtlas.subFocusId)?.leaves.map(l => l.id) || []) : null;

  cols.forEach((col, c) => {
    const colH = col.length * CARD_H + Math.max(0, col.length - 1) * ROW_GAP;
    const startY = PAD_Y + Math.round((contentH - colH) / 2);
    const x = PAD_X + c * (CARD_W + COL_GAP);
    col.forEach((id, r) => pos.set(id, { x, y: startY + r * (CARD_H + ROW_GAP), w: CARD_W, h: CARD_H }));
  });

  const graph = mathEl('explorer-graph');
  graph.style.width = totalW + 'px';
  graph.style.height = totalH + 'px';

  const svg = mathEl('explorer-edges');
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  svg.innerHTML = edgeDefsMarkup() + edges.map(([u, v]) => {
    const a = pos.get(u), b = pos.get(v);
    const d = bezierPath(a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2, colOf.get(v) - colOf.get(u));
    return `<path class="explorer-edge" data-from="${u}" data-to="${v}" d="${d}" marker-end="url(#explorer-arrow-solid)"/>`;
  }).join('');

  mathEl('explorer-nodes').innerHTML = leaves.map(leaf => {
    const p = pos.get(leaf.id);
    return renderNodeCard(leaf, {
      ...p,
      dim: !mathMatchesStage(leaf),
      subFocus: !!subFocusSet?.has(leaf.id),
      showExtBadge: true
    });
  }).join('');
}

function renderNeighborhood(node) {
  const preps = node.recommendedPreparation.map(id => mathItems.get(id)).filter(Boolean);
  const unlocks = node.leadsInto
    .map(id => mathItems.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const aSame = a.branch?.id === node.branch?.id ? 0 : 1;
      const bSame = b.branch?.id === node.branch?.id ? 0 : 1;
      return aSame - bSame || a.family - b.family;
    });

  const s = mathScale();
  const COL_W = Math.round(252 * s), CENTER_W = Math.round(268 * s), CARD_H = Math.round(88 * s);
  const COL_GAP = Math.round(82 * s), ROW_GAP = Math.round(14 * s);
  const PAD_X = Math.round(32 * s), PAD_Y = Math.round(22 * s), HEADER_H = Math.round(32 * s);
  const leftCount = Math.max(1, preps.length);
  const rightCount = Math.max(1, unlocks.length);
  const maxRows = Math.max(1, leftCount, rightCount);
  const contentH = maxRows * CARD_H + (maxRows - 1) * ROW_GAP;
  const totalW = PAD_X * 2 + COL_W + COL_GAP + CENTER_W + COL_GAP + COL_W;
  const totalH = PAD_Y * 2 + HEADER_H + contentH;

  const leftX = PAD_X;
  const centerX = PAD_X + COL_W + COL_GAP;
  const rightX = centerX + CENTER_W + COL_GAP;
  const bodyTop = PAD_Y + HEADER_H;

  const centerY = bodyTop + Math.min(Math.round((contentH - CARD_H) / 2), Math.round(130 * s));
  const placeColumn = (items, x) => {
    const colH = items.length * CARD_H + Math.max(0, items.length - 1) * ROW_GAP;
    const idealY = Math.round(centerY + CARD_H / 2 - colH / 2);
    const startY = Math.max(bodyTop, Math.min(bodyTop + contentH - colH, idealY));
    return items.map((item, i) => ({ item, x, y: startY + i * (CARD_H + ROW_GAP), w: COL_W, h: CARD_H }));
  };

  const leftPlaced = placeColumn(preps, leftX);
  const rightPlaced = placeColumn(unlocks, rightX);

  const graph = mathEl('explorer-graph');
  graph.style.width = totalW + 'px';
  graph.style.height = totalH + 'px';

  const edges = [];
  for (const p of leftPlaced) {
    const ext = p.item.branch?.id !== node.branch?.id;
    const d = bezierPath(p.x + p.w, p.y + p.h / 2, centerX - 2, centerY + CARD_H / 2);
    edges.push(`<path class="explorer-edge${ext ? ' explorer-edge-external' : ''}" data-from="${p.item.id}" data-to="${node.id}" d="${d}" marker-end="url(#explorer-arrow-${ext ? 'ext' : 'solid'})"/>`);
  }
  for (const u of rightPlaced) {
    const ext = u.item.branch?.id !== node.branch?.id;
    const d = bezierPath(centerX + CENTER_W, centerY + CARD_H / 2, u.x - 2, u.y + u.h / 2);
    edges.push(`<path class="explorer-edge${ext ? ' explorer-edge-external' : ''}" data-from="${node.id}" data-to="${u.item.id}" d="${d}" marker-end="url(#explorer-arrow-${ext ? 'ext' : 'solid'})"/>`);
  }

  const svg = mathEl('explorer-edges');
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  svg.innerHTML = edgeDefsMarkup() + edges.join('');

  const html = [];
  html.push(`<div class="explorer-col-heading" id="explorer-preparation-title" style="left:${leftX}px;top:${PAD_Y}px;width:${COL_W}px">${uiHTML('Recommended preparation')}</div>`);
  html.push(`<div class="explorer-col-heading" style="left:${centerX}px;top:${PAD_Y}px;width:${CENTER_W}px">${uiHTML('Selected tree')}</div>`);
  html.push(`<div class="explorer-col-heading" style="left:${rightX}px;top:${PAD_Y}px;width:${COL_W}px">${uiHTML('Leads into')}</div>`);

  // Left column (wrapped for semantic/test grouping)
  html.push('<div class="explorer-preparation" aria-labelledby="explorer-preparation-title">');
  if (leftPlaced.length) {
    for (const p of leftPlaced) {
      html.push(renderNodeCard(p.item, {
        x: p.x, y: p.y, w: p.w, h: p.h,
        external: p.item.branch?.id !== node.branch?.id
      }));
    }
  } else {
    html.push(`<div class="explorer-empty-slot" style="left:${leftX}px;top:${centerY}px;width:${COL_W}px;height:${CARD_H}px">${uiHTML('No preparation trees recommended. Start here.')}</div>`);
  }
  html.push('</div>');

  // Center node
  html.push(renderNodeCard(node, {
    x: centerX, y: centerY, w: CENTER_W, h: CARD_H,
    selected: true
  }));

  // Right column
  html.push('<div class="explorer-unlocks">');
  if (rightPlaced.length) {
    for (const u of rightPlaced) {
      html.push(renderNodeCard(u.item, {
        x: u.x, y: u.y, w: u.w, h: u.h,
        external: u.item.branch?.id !== node.branch?.id
      }));
    }
  } else {
    html.push(`<div class="explorer-empty-slot" style="left:${rightX}px;top:${centerY}px;width:${COL_W}px;height:${CARD_H}px">${uiHTML('Destination in this collection')}</div>`);
  }
  html.push('</div>');

  mathEl('explorer-nodes').innerHTML = html.join('');
}

function renderFullPath(node) {
  // Collect node and all transitive recommendedPreparation ancestors
  const visited = new Set();
  const stack = [node.id];
  while (stack.length) {
    const id = stack.pop();
    if (visited.has(id)) continue;
    visited.add(id);
    const item = mathItems.get(id);
    if (item && !item.children) {
      for (const p of item.recommendedPreparation) stack.push(p);
    }
  }
  const leaves = MATH_COLLECTION.leaves.filter(l => visited.has(l.id));
  const { cols, edges, colOf } = layoutDagColumns(leaves, id => mathItems.get(id).recommendedPreparation);

  const s = mathScale();
  const CARD_W = Math.round(224 * s), CARD_H = Math.round(84 * s);
  const COL_GAP = Math.round(68 * s), ROW_GAP = Math.round(16 * s);
  const PAD_X = Math.round(28 * s), PAD_Y = Math.round(24 * s);
  const maxRows = Math.max(1, ...cols.map(c => c.length));
  const contentH = maxRows * CARD_H + (maxRows - 1) * ROW_GAP;
  const totalW = PAD_X * 2 + cols.length * CARD_W + Math.max(0, cols.length - 1) * COL_GAP;
  const totalH = PAD_Y * 2 + contentH;

  const pos = new Map();
  cols.forEach((col, c) => {
    const colH = col.length * CARD_H + Math.max(0, col.length - 1) * ROW_GAP;
    const startY = PAD_Y + Math.round((contentH - colH) / 2);
    const x = PAD_X + c * (CARD_W + COL_GAP);
    col.forEach((id, r) => pos.set(id, { x, y: startY + r * (CARD_H + ROW_GAP), w: CARD_W, h: CARD_H }));
  });

  const graph = mathEl('explorer-graph');
  graph.style.width = totalW + 'px';
  graph.style.height = totalH + 'px';

  const svg = mathEl('explorer-edges');
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  svg.innerHTML = edgeDefsMarkup() + edges.map(([u, v]) => {
    const a = pos.get(u), b = pos.get(v);
    const ext = mathItems.get(u)?.branch?.id !== node.branch?.id || mathItems.get(v)?.branch?.id !== node.branch?.id;
    const d = bezierPath(a.x + a.w, a.y + a.h / 2, b.x - 2, b.y + b.h / 2, colOf.get(v) - colOf.get(u));
    return `<path class="explorer-edge${ext ? ' explorer-edge-external' : ''}" data-from="${u}" data-to="${v}" d="${d}" marker-end="url(#explorer-arrow-${ext ? 'ext' : 'solid'})"/>`;
  }).join('');

  mathEl('explorer-nodes').innerHTML = leaves.map(leaf => {
    const p = pos.get(leaf.id);
    return renderNodeCard(leaf, {
      ...p,
      selected: leaf.id === node.id,
      external: leaf.branch?.id !== node.branch?.id
    });
  }).join('');
}

function renderMathDetail() {
  const detail = mathEl('explorer-detail');
  if (!mathAtlas.selectedId) {
    const branch = mathCurrentBranch();
    const matching = branch.leaves.filter(mathMatchesStage).length;
    detail.innerHTML = `<div class="explorer-detail-main">
      <div class="explorer-detail-head">
        <span class="explorer-branch-dot" style="background:${MATH_COLORS[branch.family]}" aria-hidden="true"></span>
        <h3 id="explorer-detail-title" tabindex="-1">${svEsc(branch.name)}</h3>
        <span class="explorer-stage-badge">${uiHTML('{n} learning trees', { n: mathAtlas.stage ? matching : branch.count })}</span>
      </div>
      <p class="explorer-note">${uiHTML('Suggestions, not requirements. You can start any tree.')}</p>
    </div>`;
    return;
  }

  const node = mathItems.get(mathAtlas.selectedId);
  const entry = mathEntry(node.id);
  const built = entry?.[1].data.nodes?.length > 0;
  const primaryLabel = mathAtlas.busy ? 'Saving…' : built ? 'Open tree' : 'Build tree';

  detail.innerHTML = `<div class="explorer-detail-main">
      <div class="explorer-detail-head">
        <h3 id="explorer-detail-title" tabindex="-1">${svEsc(node.name)}</h3>
        <span class="explorer-stage-badge" title="${svEsc(difficultyLabel(node))}">${renderDifficultyBars(node.difficulty, { compact: true })}<span>${node.difficulty}/10 · ${uiHTML(MATH_BANDS[node.stage])}</span></span>
        ${entry ? `<span class="explorer-saved-label">${uiHTML('✓ In My Trees')}</span>` : ''}
      </div>
      <p class="explorer-detail-path">${svEsc(node.path.slice(0, -1).join(' › '))}</p>
      <p class="explorer-description">${svEsc(node.scope)}</p>
      <p class="explorer-note">${node.recommendedPreparation.length
        ? uiHTML('Suggestions, not requirements. You can start any tree.')
        : uiHTML('No preparation trees recommended. Start here.')}</p>
    </div>
    <div class="explorer-detail-actions">
      <button id="explorer-tree-action" class="btn explorer-primary" ${mathAtlas.busy ? 'disabled' : ''}>${uiHTML(primaryLabel)}</button>
      ${!entry ? `<button id="explorer-tree-save" class="btn" ${mathAtlas.busy ? 'disabled' : ''}>${uiHTML('Add to my trees')}</button>` : ''}
    </div>`;

  mathEl('explorer-tree-action')?.addEventListener('click', async () => {
    if (mathAtlas.busy) return;
    let current = mathEntry(node.id);
    if (!current) {
      const libraryId = await addMathTreeToLibrary(node.id);
      if (!libraryId) return;
      current = mathEntry(node.id);
      if (!current) return;
    }
    const returnTo = mathAtlas.returnTo;
    closeMathAtlas(false);
    if (current[1].data.nodes?.length) openLibraryEntry(current[0]);
    else openMathTreeBuilder(node.id, current[0], returnTo);
  });

  mathEl('explorer-tree-save')?.addEventListener('click', async () => {
    if (mathAtlas.busy) return;
    await addMathTreeToLibrary(node.id);
  });
}

function renderMathExplorer() {
  renderBranchRail();
  renderGraphBar();
  if (!mathAtlas.selectedId) {
    renderBranchTree(mathCurrentBranch());
  } else {
    const node = mathItems.get(mathAtlas.selectedId);
    if (mathAtlas.mode === 'path') renderFullPath(node);
    else renderNeighborhood(node);
  }
  renderMathDetail();

  const count = MATH_COLLECTION.leaves.filter(mathMatchesStage).length;
  uiText(mathEl('explorer-count'), t('{n} learning trees', { n: count }));
}

// ── Navigation & Link Sync ───────────────────────────────────
function updateMathLink() {
  if (!mathIsOpen()) return;
  const url = new URL(location.href);
  url.hash = 'explore=' + (mathAtlas.selectedId || mathAtlas.branchId);
  history.replaceState(history.state, '', url);
}

function focusMathItem(id, moveFocus = false) {
  const node = mathItems.get(id);
  if (!node) return;
  mathEl('explorer-results').hidden = true;

  if (node.depth === 0) {
    mathAtlas.selectedId = null;
    mathAtlas.subFocusId = null;
    mathAtlas.mode = 'branch';
  } else if (node.children) {
    mathAtlas.branchId = node.branch.id;
    mathAtlas.selectedId = null;
    mathAtlas.subFocusId = node.depth > 1 ? node.id : null;
    mathAtlas.mode = 'branch';
  } else {
    if (!mathMatchesStage(node)) {
      mathAtlas.stage = '';
      mathEl('explorer-stage').value = '';
    }
    mathAtlas.branchId = node.branch.id;
    mathAtlas.selectedId = node.id;
    mathAtlas.subFocusId = null;
    if (mathAtlas.mode === 'branch') mathAtlas.mode = 'neighbors';
  }

  renderMathExplorer();
  updateMathLink();

  const canvas = mathEl('explorer-canvas');
  if (canvas) {
    if (mathAtlas.subFocusId) {
      const firstSub = mathEl('explorer-nodes').querySelector('.explorer-subfocus');
      firstSub?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
    } else if (mathAtlas.selectedId && mathAtlas.mode === 'path') {
      canvas.scrollLeft = canvas.scrollWidth;
    } else {
      canvas.scrollLeft = 0;
      canvas.scrollTop = 0;
    }
  }
  if (moveFocus) mathEl('explorer-detail-title')?.focus();
}

function searchMathCollection() {
  const query = mathNormalize(mathEl('explorer-search').value.trim());
  const results = mathEl('explorer-results');
  if (!query) { results.hidden = true; return; }
  const words = query.split(/\s+/);
  const found = [...mathItems.values()].filter(node => {
    if (node.depth === 0) return false;
    const text = mathNormalize(node.path.join(' ') + ' ' + (node.scope || ''));
    return mathMatchesStage(node) && words.every(word => text.includes(word));
  }).sort((a, b) =>
    Number(mathNormalize(b.name) === query) - Number(mathNormalize(a.name) === query) ||
    Number(mathNormalize(b.name).startsWith(query)) - Number(mathNormalize(a.name).startsWith(query)) ||
    Number(!!a.children) - Number(!!b.children) ||
    a.depth - b.depth
  );
  results.innerHTML = found.length
    ? found.map(node => `<button class="explorer-result" data-math-id="${node.id}"><strong>${svEsc(node.name)}</strong><span>${svEsc(node.path.slice(0, -1).join(' › '))}</span><span class="explorer-result-meta">${node.children ? uiHTML('{n} learning trees', { n: node.count }) : `${renderDifficultyBars(node.difficulty, { compact: true })}<span>${node.difficulty}/10 · ${uiHTML(MATH_BANDS[node.stage])}</span>`}</span></button>`).join('')
    : `<p class="explorer-no-results" role="status">${uiHTML('No matching subjects. Try another word or stage.')}</p>`;
  results.hidden = false;
}

// ── Library & Tree Builder Integration ───────────────────────
async function addMathTreeToLibrary(id) {
  const node = mathItems.get(id);
  if (!node || node.children || mathAtlas.busy) return null;
  mathAtlas.busy = true;
  renderMathDetail();
  try {
    if (!libraryReady) await refreshLibraryFromSource();
    if (!libraryReady) return null;
    const existing = mathEntry(id);
    if (existing) return existing[0];
    const cache = libraryCache, owner = mathOwner(), libraryId = genLibraryId();
    cache[libraryId] = { name: node.name, savedAt: Date.now(), data: { topic: node.name, collectionId: id, nodes: [] } };
    const saved = await persistLibrary();
    if (!saved) { delete cache[libraryId]; return null; }
    if (cache !== libraryCache || owner !== mathOwner()) return null;
    showToast(t('Added "{name}" to My Trees.', { name: node.name }));
    renderLibraryGrid();
    return libraryId;
  } finally {
    mathAtlas.busy = false;
    if (mathIsOpen()) renderMathExplorer();
  }
}

function resetMathTreeBuilder() {
  mathBuilderSelection = null;
  mathEl('tree-collection-scope').classList.add('hidden');
}

function openMathTreeBuilder(id, libraryId, returnTo = 'library') {
  const node = mathItems.get(id);
  if (!node || node.children) return;
  openTreeModal();
  mathBuilderSelection = { id, libraryId, owner: mathOwner(), returnTo };
  mathEl('tree-topic-input').value = node.name;
  mathEl('tree-collection-description').textContent = node.scope;
  mathEl('tree-collection-scope').classList.remove('hidden');
  updateTreePromptPreview();
}

function mathCollectionPrompt(topic) {
  const node = mathItems.get(mathBuilderSelection?.id);
  if (!node || node.name !== topic) return '';
  return `\n\nMATHEMATICS COLLECTION SCOPE\nSubject path: ${node.path.join(' > ')}\nIntended stage: ${MATH_STAGES[node.stage]}\nScope: ${node.scope}\n\nRECOMMENDED PREPARATION (OPTIONAL)\n${node.recommendedPreparation.length ? node.recommendedPreparation.map(id => { const tree = mathItems.get(id); return '- ' + tree.name + ' — ' + tree.scope; }).join('\n') : 'No preparation trees recommended; this is a starting tree.'}\nThese are suggestions, not requirements or evidence of completing specific collection trees. Do not assume the learner has completed them. Use the suggested scopes to clarify likely background at the collection-defined entry level, following the main prompt’s entry-knowledge guidance. Do not add these collection links as mandatory learning-node dependencies or require completing entire preparation trees.\n\nDesign only this focused learning block, roughly 4–6 weeks at the stated level, rather than its parent subject. The collection fixes the destination and starting level. Assume the standard entry knowledge for this bounded subject at the stated stage has been learned in other trees. Work out the specific prerequisite abilities from this scope and level, and state them explicitly in the relevant root teaching briefs so later lesson writers receive them. Keep prerequisite subjects outside this tree; explain small local conventions where needed without expanding the destination. The surrounding subject hierarchy is organizational, not a prerequisite chain.\nKeep the top-level topic exactly ${JSON.stringify(node.name)} and include the top-level field "collectionId": ${JSON.stringify(node.id)} in the output JSON so it returns to this saved collection tree.\n`;
}

function resolveMathCollectionImport(obj) {
  const candidate = mathItems.get(mathBuilderSelection?.id);
  const selected = candidate && mathBuilderSelection.owner === mathOwner() && mathEl('tree-topic-input').value.trim() === candidate.name && !mathEl('tree-mode-topic-panel').classList.contains('hidden') ? candidate : null;
  const supplied = mathItems.get(obj.collectionId);
  const node = supplied && !supplied.children ? supplied : selected;
  return node && node.name === String(obj.topic || '').trim() ? node.id : null;
}

document.addEventListener('tree-loaded', () => {
  const selection = mathBuilderSelection;
  if (!selection || selection.id !== state.collectionId || selection.owner !== mathOwner()) return;
  const entry = libraryCache[selection.libraryId];
  if (!entry || entry.data.collectionId !== selection.id) return;
  state.libraryId = selection.libraryId;
  const before = { data: entry.data, savedAt: entry.savedAt }, snapshot = buildTreeJSON(true);
  entry.data = snapshot;
  entry.savedAt = Date.now();
  void persistLibrary().then(ok => {
    if (!ok && libraryCache[selection.libraryId] === entry && entry.data === snapshot) Object.assign(entry, before);
    renderLibraryGrid();
  });
});

// ── Modal Lifecycle ──────────────────────────────────────────
function showMathCollections() {
  mathEl('explorer-shell').classList.add('explorer-picking');
  mathEl('explorer-collection-picker').hidden = false;
  mathEl('explorer-collections').hidden = true;
  uiText(mathEl('explorer-shell').querySelector('.explorer-eyebrow'), 'Collections');
  const url = new URL(location.href);
  url.hash = 'explore=collections';
  history.replaceState(history.state, '', url);
  mathEl('explorer-open-math').focus();
}

// Mathematics is currently the only collection, so open it directly.
function openTreeExplorer() { openMathAtlas(); }

function openMathAtlas({ target, returnTo } = {}) {
  mathEl('explorer-shell').classList.remove('explorer-picking');
  mathEl('explorer-collection-picker').hidden = true;
  mathEl('explorer-collections').hidden = false;
  uiText(mathEl('explorer-shell').querySelector('.explorer-eyebrow'), 'Mathematics');
  if (!mathIsOpen()) {
    mathAtlas.returnTo = returnTo || (mathEl('library-modal-backdrop').classList.contains('open') ? 'library' : null);
    mathAtlas.returnHash = location.hash;
  }
  closeLibraryModal();
  mathEl('explorer-backdrop').classList.add('open');
  if (target && mathItems.has(target)) {
    focusMathItem(target);
  } else {
    renderMathExplorer();
    updateMathLink();
  }
  if (!mathEl('explorer-search').value) mathEl('explorer-search').focus();
  else { mathEl('explorer-title').tabIndex = -1; mathEl('explorer-title').focus(); }
}

function closeMathAtlas(restore = true) {
  if (!mathIsOpen()) return;
  mathEl('explorer-backdrop').classList.remove('open');
  mathEl('explorer-results').hidden = true;
  const url = new URL(location.href);
  url.hash = mathAtlas.returnHash;
  history.replaceState(history.state, '', url);
  if (restore && mathAtlas.returnTo === 'library') void openLibraryModal();
}

// ── Hover Highlighting & Drag-to-Pan ─────────────────────────
function setGraphHover(id) {
  const edges = mathEl('explorer-edges').querySelectorAll('.explorer-edge');
  const nodes = mathEl('explorer-nodes').querySelectorAll('.explorer-node');
  if (!id) {
    edges.forEach(p => {
      p.classList.remove('is-active', 'is-muted');
      const ext = p.classList.contains('explorer-edge-external');
      p.setAttribute('marker-end', `url(#explorer-arrow-${ext ? 'ext' : 'solid'})`);
    });
    nodes.forEach(n => n.classList.remove('is-linked'));
    return;
  }
  const linked = new Set();
  edges.forEach(p => {
    const hit = p.dataset.from === id || p.dataset.to === id;
    p.classList.toggle('is-active', hit);
    p.classList.toggle('is-muted', !hit);
    const ext = p.classList.contains('explorer-edge-external');
    p.setAttribute('marker-end', hit ? 'url(#explorer-arrow-active)' : `url(#explorer-arrow-${ext ? 'ext' : 'solid'})`);
    if (hit) { linked.add(p.dataset.from); linked.add(p.dataset.to); }
  });
  nodes.forEach(n => n.classList.toggle('is-linked', n.dataset.mathId !== id && linked.has(n.dataset.mathId)));
}

(() => {
  const nodesWrap = mathEl('explorer-nodes');
  nodesWrap.addEventListener('mouseover', e => {
    const card = e.target.closest('.explorer-node');
    if (card) setGraphHover(card.dataset.mathId);
  });
  nodesWrap.addEventListener('mouseout', e => {
    const card = e.target.closest('.explorer-node');
    if (card && !card.contains(e.relatedTarget)) setGraphHover(null);
  });
  nodesWrap.addEventListener('focusin', e => {
    const card = e.target.closest('.explorer-node');
    if (card) setGraphHover(card.dataset.mathId);
  });
  nodesWrap.addEventListener('focusout', () => setGraphHover(null));

  const canvas = mathEl('explorer-canvas');
  let drag = null;
  canvas.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sl: canvas.scrollLeft, st: canvas.scrollTop };
    canvas.classList.add('dragging');
    canvas.setPointerCapture?.(e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag || drag.id !== e.pointerId) return;
    canvas.scrollLeft = drag.sl - (e.clientX - drag.x);
    canvas.scrollTop = drag.st - (e.clientY - drag.y);
  });
  const endDrag = e => {
    if (!drag || drag.id !== e.pointerId) return;
    if (canvas.hasPointerCapture?.(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    canvas.classList.remove('dragging');
    drag = null;
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
})();

// ── Event Wiring ─────────────────────────────────────────────
mathEl('btn-explore-trees').addEventListener('click', openTreeExplorer);
mathEl('explorer-open-math').addEventListener('click', () => openMathAtlas());
mathEl('explorer-collections').addEventListener('click', showMathCollections);
mathEl('menu-explore-trees').addEventListener('click', openTreeExplorer);
mathEl('explorer-close').addEventListener('click', () => closeMathAtlas());
mathEl('explorer-library').addEventListener('click', () => { closeMathAtlas(false); void openLibraryModal(); });
mathEl('explorer-backdrop').addEventListener('click', e => { if (e.target === mathEl('explorer-backdrop')) closeMathAtlas(); });
mathEl('explorer-shell').addEventListener('click', e => {
  const target = e.target.closest('[data-math-id]');
  if (target) focusMathItem(target.dataset.mathId, !!target.closest('#explorer-results'));
});
mathEl('explorer-search').addEventListener('input', searchMathCollection);
mathEl('explorer-search').addEventListener('focus', searchMathCollection);
mathEl('explorer-stage').addEventListener('change', e => {
  mathAtlas.stage = e.target.value;
  renderMathExplorer();
  searchMathCollection();
});
mathEl('explorer-shell').addEventListener('keydown', e => {
  const results = [...mathEl('explorer-results').querySelectorAll('button')];
  if (e.key === 'ArrowDown' && (e.target.id === 'explorer-search' || e.target.closest('#explorer-results'))) {
    e.preventDefault(); results[(results.indexOf(e.target) + 1) % results.length]?.focus();
  } else if (e.key === 'ArrowUp' && e.target.closest('#explorer-results')) {
    e.preventDefault(); const i = results.indexOf(e.target); (i > 0 ? results[i - 1] : mathEl('explorer-search')).focus();
  } else if (e.key === 'Enter' && e.target.id === 'explorer-search' && !mathEl('explorer-results').hidden && results[0]) {
    e.preventDefault(); focusMathItem(results[0].dataset.mathId, true);
  }
});
mathEl('tree-back-to-atlas').addEventListener('click', () => {
  const selection = mathBuilderSelection;
  closeTreeModal();
  if (selection) openMathAtlas({ target: selection.id, returnTo: selection.returnTo });
});
onEscape(110, () => {
  if (!mathIsOpen()) return false;
  if (mathEl('explorer-shell').classList.contains('explorer-picking')) { closeMathAtlas(); return true; }
  if (!mathEl('explorer-results').hidden) { mathEl('explorer-search').focus(); mathEl('explorer-results').hidden = true; }
  else closeMathAtlas();
  return true;
});
document.addEventListener('ui-language-change', () => { if (mathIsOpen()) { renderMathExplorer(); searchMathCollection(); } });
document.addEventListener('library-updated', () => { if (mathIsOpen()) renderMathExplorer(); });

const mathLinkedId = new URLSearchParams(location.hash.slice(1)).get('explore');
if (mathItems.has(mathLinkedId)) { openMathAtlas({ target: mathLinkedId }); mathAtlas.returnHash = ''; }
if (mathLinkedId === 'collections') { openMathAtlas(); showMathCollections(); mathAtlas.returnHash = ''; }
