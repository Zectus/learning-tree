/* ═══════════════════════════════════════════════════════════
   nodes.js — node DOM construction, the linking gesture, add/delete,
   and the touch "tap ⋯ to reveal actions" mechanism (opening in buildEl,
   closing at the bottom of this file). Depends on state.js and layout.js.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   NODE DOM
═══════════════════════════════════════════════════════════ */
function buildEl(node) {
  const editing = state.mode === 'edit';
  const el = document.createElement('div');
  el.className = 'node status-locked';
  el.dataset.id = node.id;
  el.tabIndex = 0;

  const inner = document.createElement('div');
  inner.className = 'node-inner';

  const badge = document.createElement('div');
  badge.className = 'node-badge';
  badge.textContent = '○ locked';

  const textEl = document.createElement('div');
  textEl.className = 'node-text';
  textEl.contentEditable = editing ? 'true' : 'false';
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
  delTxtBtn.title = "Clear this node's generated lesson & quiz progress";
  delTxtBtn.addEventListener('click', e => { e.stopPropagation(); deleteNodeTxt(node.id); });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn danger';
  delBtn.textContent = '✕ delete';
  delBtn.addEventListener('click', e => { e.stopPropagation(); deleteNode(node.id); });

  actions.append(linkBtn, optBtn, delTxtBtn, delBtn);

  const explWrap = document.createElement('div');
  explWrap.className = 'node-explanation-wrap';

  const explLabel = document.createElement('div');
  explLabel.className = 'node-explanation-label';
  explLabel.textContent = 'explanation (private — sent to the lesson prompt, never shown to the learner)';

  const explTa = document.createElement('textarea');
  explTa.className = 'node-explanation-ta';
  explTa.spellcheck = false;
  explTa.readOnly = !editing;
  explTa.placeholder = 'Pin down exactly what this node covers and where its edges are…';
  explTa.value = node.explanation || '';

  explWrap.append(explLabel, explTa);

  explTa.addEventListener('click', e => e.stopPropagation());
  explTa.addEventListener('input', () => { node.explanation = explTa.value; });
  explTa.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Escape') explTa.blur();
  });

  // Touch equivalent of hover (hidden on real-hover devices — see .node-more-btn
  // in nodes.css). stopPropagation keeps the tap from also reaching el's click
  // handler below, which would focus the label or start a link.
  const moreBtn = document.createElement('button');
  moreBtn.className = 'node-more-btn';
  moreBtn.textContent = '⋯';
  moreBtn.title = 'Show actions';
  moreBtn.setAttribute('aria-label', 'Show actions');
  moreBtn.addEventListener('click', e => {
    e.stopPropagation();
    const opening = !el.classList.contains('actions-open');
    document.querySelectorAll('.node.actions-open').forEach(n => { if (n !== el) n.classList.remove('actions-open'); });
    el.classList.toggle('actions-open', opening);
  });

  inner.append(badge, textEl, actions, explWrap);
  el.append(inner, moreBtn);

  // A label is a single plain-text line: no pasted markup, no line breaks.
  textEl.addEventListener('input', () => { node.label = textEl.textContent; });
  textEl.addEventListener('paste', e => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text/plain').replace(/\s*[\r\n]+\s*/g, ' ');
    document.execCommand('insertText', false, text);
  });
  textEl.addEventListener('drop', e => e.preventDefault());
  textEl.addEventListener('keydown', e => {
    if (state.mode !== 'edit') return;
    if (e.key === 'Enter')  { e.preventDefault(); textEl.blur(); }
    if (e.key === 'Escape') { textEl.blur(); cancelLink(); }
    if (e.key === 'Tab')    { e.preventDefault(); doAddNode(); }
  });

  el.addEventListener('mouseenter', () => highlightEdges(node.id));
  el.addEventListener('mouseleave', clearEdgeHighlight);
  el.addEventListener('click', e => {
    if (e.target.closest('.node-actions')) return;
    if (state.mode === 'edit') {
      if (state.linkSource !== null) finishLink(node.id);
      else textEl.focus();
    } else if (state.mode === 'markKnown') {
      if (nodeStatus(node.id) !== 'locked') {
        node.done = !node.done;
        if (!node.done) cascadeUncomplete(node.id);
        updateAllStatuses();
        autoSaveProgress();
      }
    } else if (nodeStatus(node.id) !== 'locked') {
      if (node._sessionTxt) continueViewer(node.id);
      else openLearnModal(node.id);
    }
  });
  // Keyboard equivalent of clicking the card (only when the card itself has focus).
  el.addEventListener('keydown', e => {
    if (e.target !== el || (e.key !== 'Enter' && e.key !== ' ')) return;
    e.preventDefault();
    el.click();
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
   COMPLETION
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
  if (src === targetId) { cancelLink(); return; }

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
    showToast("That link would create a loop — a topic can't depend, even indirectly, on something that depends on it.");
    cancelLink();
    return;
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

// Would adding from→to create a cycle? Only if `from` is already reachable from `to`.
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
   An edge A→C is redundant if C is already reachable from A through
   another path (e.g. A→B→C); removing it loses no information.
═══════════════════════════════════════════════════════════ */
function removeRedundantEdges() {
  const redundant = [];
  forEachEdge((from, to) => {
    // Search from `from`'s *other* neighbours; reaching `to` means the direct edge is implied.
    const seen = new Set(), queue = [];
    state.dependents.get(from)?.forEach(nb => { if (nb !== to) { seen.add(nb); queue.push(nb); } });
    for (let i = 0; i < queue.length; i++) {
      const cur = queue[i];
      if (cur === to) { redundant.push([from, to]); return; }
      state.dependents.get(cur)?.forEach(nb => { if (!seen.has(nb)) { seen.add(nb); queue.push(nb); } });
    }
  });
  if (!redundant.length) return;
  redundant.forEach(([f, t]) => removeEdge(f, t));
  layout();
  updateAllStatuses();
}

/* ═══════════════════════════════════════════════════════════
   ADD / DELETE
═══════════════════════════════════════════════════════════ */
function doAddNode() {
  const id   = state.nextId++;
  const node = { id, label:'', explanation:'', optional:false, done:false, depth:0, x:0, y:0, el:null };
  state.nodes.set(id, node);
  buildEl(node);
  layout();
  updateAllStatuses();
  setTimeout(() => node.el?.querySelector('.node-text')?.focus(), 40);
  return node;
}

function deleteNode(id) {
  removeEdgesOf(id);
  state.nodes.get(id)?.el?.remove();
  state.nodes.delete(id);
  if (state.linkSource === id) cancelLink();
  layout();
  updateAllStatuses();
}

/* Clears a node's stored lesson and everything tied to it — answers, scroll
   position, notes, and the done flag. Closes the viewer if it's showing this node. */
function deleteNodeTxt(id) {
  const node = state.nodes.get(id);
  if (!node) return;
  if (!node._sessionTxt) {
    showToast('This topic has no TXT to delete.', 3000);
    return;
  }
  delete node._sessionTxt;
  delete node._sessionAnswers;
  delete node._bonusAnswers;
  delete node._scrollTop;
  delete node._notes;
  if (node.done) { node.done = false; cascadeUncomplete(id); }
  if (viewer.nodeId === id) { closeViewer(); viewer.nodeId = null; }
  updateAllStatuses();
  autoSaveProgress();
  showToast(`TXT and lesson progress cleared for "${node.label || 'Untitled topic'}".`, 3500);
}

/* ═══════════════════════════════════════════════════════════
   TOUCH ACTION-ROW CLEANUP — tapping outside an open node, or Escape,
   closes its action row (the opening half is the moreBtn above).
═══════════════════════════════════════════════════════════ */
document.addEventListener('click', e => {
  if (e.target.closest('.node.actions-open')) return;
  document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
});
onEscape(10, () => {
  const open = document.querySelectorAll('.node.actions-open');
  open.forEach(el => el.classList.remove('actions-open'));
  return open.length > 0;
});
