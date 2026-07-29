/* ═══════════════════════════════════════════════════════════
   progress.js — localStorage persistence of per-node progress
   (done flag, quiz/bonus answers, notes, scroll position),
   independent of the tree's own JSON (see io.js) — a tree's
   structure and a learner's progress through it are saved
   separately on purpose (see treeSignature below). Also owns
   the "reset progress" button, including its shift-click / long-
   press "reset every tree" variant.
   Depends on state.js, layout.js (prereqsOf, via state.js), and
   viewer.js (closeViewer — only called on a button click, after
   every script has finished loading, so viewer.js loading after
   this file is fine).
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   PROGRESS  save / load / auto-save
   Storage is per-node: each node (keyed by label, under a
   per-tree signature) gets its own record — done flag, session
   quiz answers, bonus answers, the fallback answer key, and any
   notes — restored independently so nodes never share or
   clobber each other's state.
   • Auto-save: written to localStorage on every relevant change
     (done toggle, answering a question, editing notes) — this
     is the only save path, there is no manual save button.
   • Auto-restore: applied silently when a tree is loaded.
   • JSON export no longer carries done flags (see exportToJSON)
     — progress lives only in localStorage now.
═══════════════════════════════════════════════════════════ */
const PROGRESS_KEY = 'tree-progress';

/* Identifies "this tree" across re-exports/minor edits without matching
   labels against every OTHER tree ever loaded. Built from the sorted set
   of root labels (nodes with no prerequisites) — stable across small edits
   to a tree, but distinct enough that two different subjects effectively
   never collide. Without this, a node named e.g. "Chain Rule" or "Dot
   Product" could silently show as complete on a brand-new, unrelated tree
   just because a past tree happened to use the same label. */
function treeSignature() {
  const roots = [];
  state.nodes.forEach((n, id) => { if (prereqsOf(id).length === 0) roots.push(n.label.trim().toLowerCase()); });
  return roots.sort().join('|') || '(empty)';
}

/* Serializes every current node into its own keyed record under this
   tree's signature. Called on any change worth remembering — a done
   toggle, a quiz answer, a notes edit — so "where you are" in a node's
   session (and its notes) is never lost while working through a tree. */
function autoSaveProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const perNode = {};
    state.nodes.forEach(node => {
      perNode[node.label] = {
        done:           !!node.done,
        sessionAnswers: node._sessionAnswers || undefined,
        bonusAnswers:   node._bonusAnswers   || undefined,
        answerKey:      node._answerKey      || undefined,
        notes:          node._notes          || undefined,
        scrollTop:      node._scrollTop,
      };
    });
    all[treeSignature()] = perNode;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}

/** Restores each node's own record independently (done flag, session
    answers, notes, scroll position). */
function autoRestoreProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const saved = all[treeSignature()];
    if (!saved) return;
    let changed = false;
    state.nodes.forEach(node => {
      const rec = saved[node.label];
      if (!rec) return;
      if (rec.done) { node.done = true; changed = true; }
      if (rec.sessionAnswers) node._sessionAnswers = rec.sessionAnswers;
      if (rec.bonusAnswers)   node._bonusAnswers   = rec.bonusAnswers;
      if (rec.answerKey)      node._answerKey      = rec.answerKey;
      if (rec.notes)          node._notes          = rec.notes;
      if (rec.scrollTop != null) node._scrollTop   = rec.scrollTop;
    });
    if (changed) updateAllStatuses();
  } catch {}
}

/* Reset progress — clears the persisted record(s) plus the matching
   in-memory fields on every node, so the effect is immediate without a
   reload. Plain click: this tree only. Shift+click (or a long-press,
   for touch where there's no Shift key to hold): every tree ever
   saved. No confirmation dialog on purpose — mark-known mode already
   lets you freely toggle any node's done state with no safeguard, so
   this isn't introducing a new class of "undoable" risk. */
const btnResetProgress = document.getElementById('btn-reset-progress');
document.addEventListener('keydown', e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ reset ALL progress'; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ reset tree progress'; });

let resetAllArmed = false, resetPressTimer = null;
btnResetProgress.addEventListener('touchstart', () => {
  resetPressTimer = setTimeout(() => {
    resetAllArmed = true;
    btnResetProgress.textContent = '↺ reset ALL progress';
    if (navigator.vibrate) navigator.vibrate(15);
  }, 550);
}, { passive:true });
btnResetProgress.addEventListener('touchend', () => clearTimeout(resetPressTimer), { passive:true });
btnResetProgress.addEventListener('touchcancel', () => {
  clearTimeout(resetPressTimer);
  resetAllArmed = false;
  btnResetProgress.textContent = '↺ reset tree progress';
}, { passive:true });

function clearNodeProgressFields(node) {
  node.done = false;
  delete node._sessionAnswers;
  delete node._bonusAnswers;
  delete node._answerKey;
  delete node._notes;
  delete node._scrollTop;
}

btnResetProgress.addEventListener('click', e => {
  const resetAll = e.shiftKey || resetAllArmed;
  resetAllArmed = false;
  if (resetAll) {
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
    state.nodes.forEach(clearNodeProgressFields);
  } else {
    try {
      const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      delete all[treeSignature()];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch {}
    state.nodes.forEach(clearNodeProgressFields);
  }
  btnResetProgress.textContent = '↺ reset tree progress';
  closeViewer();
  // closeViewer() deliberately leaves viewer.nodeId alone so closing and
  // reopening the SAME session normally skips a full rebuild (see its own
  // comment). That shortcut is wrong right after a reset — reopening a
  // node whose data we just cleared needs to actually re-read that
  // (now-empty) data, not re-reveal the stale answers/notes/scroll
  // position still sitting in the DOM from before the reset.
  viewer.nodeId = null;
  updateAllStatuses();
});
