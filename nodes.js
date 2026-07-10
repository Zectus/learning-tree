/* ═══════════════════════════════════════════════════════════
   nodes.js — individual node DOM construction, completion
   toggling, the linking gesture, add/delete.
   Depends on state.js and layout.js.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   NODE DOM
═══════════════════════════════════════════════════════════ */
function buildEl(node) {
  const el = document.createElement('div');
  el.className = 'node status-locked';
  el.dataset.id = node.id;

  const inner = document.createElement('div');
  inner.className = 'node-inner';

  const badge = document.createElement('div');
  badge.className = 'node-badge';
  badge.textContent = '○ locked';

  const textEl = document.createElement('div');
  textEl.className = 'node-text';
  textEl.contentEditable = state.editMode ? 'true' : 'false';
  textEl.spellcheck = false;
  textEl.dataset.placeholder = node.depth === 0 ? 'Root concept…' : 'Topic name…';
  textEl.textContent = node.label;

  const actions = document.createElement('div');
  actions.className = 'node-actions';

  const linkBtn = document.createElement('button');
  linkBtn.className = 'btn';
  linkBtn.textContent = '⟵ link prereq';
  linkBtn.title = 'Click, then click a prerequisite node';
  linkBtn.addEventListener('click', e => { e.stopPropagation(); startLink(node.id); });

  const optBtn = document.createElement('button');
  optBtn.className = 'btn';
  optBtn.textContent = node.optional ? '★ optional' : '☆ optional';
  optBtn.addEventListener('click', e => {
    e.stopPropagation();
    node.optional = !node.optional;
    optBtn.textContent = node.optional ? '★ optional' : '☆ optional';
    refreshTag(el, node);
  });

  const delTxtBtn = document.createElement('button');
  delTxtBtn.className = 'btn danger';
  delTxtBtn.textContent = '🗑 delete txt';
  delTxtBtn.title = 'Clear this node\'s generated lesson & quiz progress';
  delTxtBtn.addEventListener('click', e => { e.stopPropagation(); deleteNodeTxt(node.id); });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn danger';
  delBtn.textContent = '✕ delete';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteNode(node.id); });

  actions.append(linkBtn, optBtn, delTxtBtn, delBtn);
  inner.append(badge, textEl, actions);
  el.append(inner);

  textEl.addEventListener('input', () => { node.label = textEl.textContent; });
  textEl.addEventListener('keydown', e => {
    if (!state.editMode) return;
    if (e.key === 'Escape') { textEl.blur(); cancelLink(); }
    if (e.key === 'Tab') { e.preventDefault(); doAddNode(); }
  });

  el.addEventListener('mousedown', e => e.stopPropagation());
  el.addEventListener('mouseenter', () => highlightEdges(node.id));
  el.addEventListener('mouseleave', clearEdgeHighlight);
  el.addEventListener('click', e => {
    if (e.target.closest('.node-actions')) return;
    if (state.editMode) {
      if (state.linkSource !== null) finishLink(node.id);
      else textEl.focus();
    } else if (state.markKnownMode) {
      const s = nodeStatus(node.id);
      if (s !== 'locked') {
        node.done = !node.done;
        if (!node.done) cascadeUncomplete(node.id);
        updateAllStatuses();
        autoSaveProgress();
      }
    } else {
      const s = nodeStatus(node.id);
      if (s !== 'locked') {
        if (node._sessionTxt) continueViewer(node.id);
        else openLearnModal(node.id);
      }
    }
  });

  node.el = el;
  refreshTag(el, node);
  world.appendChild(el);
}

function refreshTag(el, node) {
  let tag = el.querySelector('.node-tag');
  if (node.optional) {
    if (!tag) {
      tag = document.createElement('div');
      tag.className = 'node-tag';
      el.querySelector('.node-inner').appendChild(tag);
    }
    tag.textContent = 'optional';
  } else if (tag) {
    tag.remove();
  }
}

/* ═══════════════════════════════════════════════════════════
   TOGGLE COMPLETION
═══════════════════════════════════════════════════════════ */
function cascadeUncomplete(id) {
  dependentsOf(id).forEach(dep => {
    const d = state.nodes.get(dep);
    if (d?.done) { d.done = false; cascadeUncomplete(dep); }
  });
}

/* ═══════════════════════════════════════════════════════════
   LINKING
═══════════════════════════════════════════════════════════ */
function startLink(sourceId) {
  cancelLink();
  state.linkSource = sourceId;
  state.nodes.get(sourceId)?.el?.classList.add('link-source');
  document.body.classList.add('linking-mode');
}

function finishLink(targetId) {
  const src = state.linkSource;
  if (src === null) return;

  if (src === targetId) {
    cancelLink(); return;
  }

  // src = dependent, targetId = prereq → edge goes prereq→dependent
  const from = targetId, to = src;

  if (hasEdge(from, to)) {
    removeEdge(from, to);
    renderEdges();
    cancelLink();
    layout();
    updateAllStatuses();
    return;
  }
  if (wouldCycle(from, to)) {
    cancelLink(); return;
  }

  addEdge(from, to);
  layout();
  updateAllStatuses();
  cancelLink();
}

function cancelLink() {
  if (state.linkSource !== null) {
    state.nodes.get(state.linkSource)?.el?.classList.remove('link-source');
    state.linkSource = null;
  }
  document.body.classList.remove('linking-mode');
}

function wouldCycle(from, to) {
  const visited = new Set(), stack = [to];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === from) return true;
    if (visited.has(cur)) continue;
    visited.add(cur);
    dependentsOf(cur).forEach(d => stack.push(d));
  }
  return false;
}

/* ═══════════════════════════════════════════════════════════
   TRANSITIVE REDUCTION
   An edge A→C is redundant if C is already reachable from A
   through another path (e.g. A→B→C).  Removing such edges
   keeps the graph minimal without losing any information.
═══════════════════════════════════════════════════════════ */
function removeRedundantEdges() {
  if (state.edges.size === 0) return;

  // Build adjacency list once for efficiency
  const adj = new Map();
  state.nodes.forEach((_, id) => adj.set(id, []));
  for (const key of state.edges) {
    const [f, t] = key.split('→').map(Number);
    adj.get(f)?.push(t);
  }

  const toRemove = [];

  for (const key of state.edges) {
    const [from, to] = key.split('→').map(Number);

    // BFS from `from`'s other neighbors (skip the direct edge to `to`).
    // If we reach `to` this way, the direct edge is redundant.
    const visited = new Set();
    const queue   = [];
    for (const nb of adj.get(from) || []) {
      if (nb !== to) { visited.add(nb); queue.push(nb); }
    }

    let redundant = false, qi = 0;
    while (qi < queue.length && !redundant) {
      const cur = queue[qi++];
      if (cur === to) { redundant = true; break; }
      for (const nb of adj.get(cur) || []) {
        if (!visited.has(nb)) { visited.add(nb); queue.push(nb); }
      }
    }

    if (redundant) toRemove.push(key);
  }

  if (toRemove.length === 0) return;

  toRemove.forEach(key => state.edges.delete(key));
  layout();
  updateAllStatuses();
}

/* ═══════════════════════════════════════════════════════════
   ADD / DELETE
═══════════════════════════════════════════════════════════ */
function doAddNode() {
  const id   = state.nextId++;
  const node = { id, label:'', optional:false, done:false, depth:0, x:0, y:0, el:null };
  state.nodes.set(id, node);
  buildEl(node);
  layout();
  updateAllStatuses();
  setTimeout(() => node.el?.querySelector('.node-text')?.focus(), 40);
  return node;
}

function deleteNode(id) {
  for (const k of [...state.edges]) {
    const [f,t] = k.split('→').map(Number);
    if (f===id||t===id) state.edges.delete(k);
  }
  state.nodes.get(id)?.el?.remove();
  state.nodes.delete(id);
  if (state.linkSource === id) cancelLink();
  layout();
  updateAllStatuses();
}

/* Clears a node's stored lesson text along with everything tied to that
   session — answer key, main/bonus answers, scroll position, notes, and
   the done flag. If the session viewer is currently showing this node,
   close it too, since the text it's rendering would otherwise go stale
   mid-view. */
function deleteNodeTxt(id) {
  const node = state.nodes.get(id);
  if (!node || !node._sessionTxt) return;
  delete node._sessionTxt;
  delete node._answerKey;
  delete node._sessionAnswers;
  delete node._bonusAnswers;
  delete node._scrollTop;
  delete node._notes;
  if (node.done) { node.done = false; cascadeUncomplete(id); }
  if (viewer.nodeId === id) closeViewer();
  updateAllStatuses();
  autoSaveProgress();
}

