/* ═══════════════════════════════════════════════════════════
   progress.js — persistence of per-node progress (done flag,
   quiz/bonus answers, notes, scroll position), independent of
   the tree's own JSON (see io.js) — a tree's structure and a
   learner's progress through it are saved separately on purpose
   (see treeSignature below). Also owns the "reset progress"
   control, including its shift-click / long-press "reset every
   tree" variant. Lives as a .dropdown-item inside the 👤 ▾ toolbar
   menu (see index.html/toolbar.js) rather than a standalone
   button, but the element itself and all the logic below are
   otherwise unchanged.

   STORAGE SOURCE: same local/cloud split as library.js (see that
   file's own header for the fuller rationale). Signed out, every
   tree's progress lives in this browser's localStorage
   (PROGRESS_KEY below) — no account needed. Signed in (see
   account.js/cloud.js), it lives instead under this user's own
   uid in Firebase, so progress follows the account across
   devices. refreshProgressFromSource() and persistProgress() are
   the only two functions that know which of those two is
   currently active (progressSource) — every other function in
   this file just reads/writes the in-memory progressCache and
   doesn't care where it came from. window.handleCloudAuthChange
   (account.js) calls refreshProgressFromSource() on every sign-in/
   sign-out, which is what actually switches the source.

   FIREBASE KEY SAFETY: progressCache is keyed first by tree
   signature (treeSignature() below) and then by node label —
   both are arbitrary text a person typed or a tree author wrote,
   which can contain characters ('.', '#', '$', '[', ']', '/')
   that Firebase Realtime Database keys reject outright.
   localStorage has no such restriction, so the in-memory shape
   and the local storage shape stay exactly as before; only the
   object actually handed to cloud.setProgress, and read back
   from cloud.getProgress, goes through
   encodeProgressForCloud/decodeProgressFromCloud below.

   Depends on state.js, layout.js (prereqsOf, via state.js), and
   viewer.js (closeViewer — only called on a click, after every
   script has finished loading, so viewer.js loading after this
   file is fine).
═══════════════════════════════════════════════════════════ */
const PROGRESS_KEY = 'tree-progress';

let progressCache  = {};      // in-memory mirror of whichever source is currently active
let progressSource = 'local'; // 'local' | 'cloud'

function readLocalProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}
function writeLocalProgress(obj) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj)); } catch {}
}

/* ── Firebase key sanitization (cloud storage only — see file header) ──
   encodeURIComponent already escapes '#', '$', '[', ']', '/' (all invalid
   in an RTDB key); '.' survives encodeURIComponent untouched since it's a
   legal URI character, so it needs its own extra pass. */
function toFirebaseKey(k) {
  return encodeURIComponent(String(k)).replace(/\./g, '%2E');
}
function fromFirebaseKey(k) {
  try { return decodeURIComponent(k); } catch { return k; }
}
function encodeProgressForCloud(cache) {
  const out = {};
  for (const sig of Object.keys(cache)) {
    const encPerNode = {};
    for (const label of Object.keys(cache[sig] || {})) encPerNode[toFirebaseKey(label)] = cache[sig][label];
    out[toFirebaseKey(sig)] = encPerNode;
  }
  return out;
}
function decodeProgressFromCloud(obj) {
  const out = {};
  for (const encSig of Object.keys(obj || {})) {
    const decPerNode = {};
    for (const encLabel of Object.keys(obj[encSig] || {})) decPerNode[fromFirebaseKey(encLabel)] = obj[encSig][encLabel];
    out[fromFirebaseKey(encSig)] = decPerNode;
  }
  return out;
}

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

/* ── source switching ──────
   Called once at load (guest view, so progress works before Firebase has
   even resolved whether there's a persisted session) and again by
   window.handleCloudAuthChange (account.js) on every sign-in/sign-out. */
async function refreshProgressFromSource() {
  if (state.accountUser) {
    progressSource = 'cloud';
    try {
      progressCache = decodeProgressFromCloud(await window.cloud.getProgress(state.accountUser.uid));
    } catch (e) {
      console.error('Could not load cloud progress:', e);
      progressCache = {};
    }
    // One-time convenience, mirroring library.js: a fresh account with an
    // empty cloud progress blob, but progress saved locally before
    // signing in, gets that local progress copied up rather than
    // silently orphaned — signing in shouldn't make progress someone
    // already made disappear.
    const local = readLocalProgress();
    if (Object.keys(progressCache).length === 0 && Object.keys(local).length > 0) {
      progressCache = local;
      await persistProgress();
    }
  } else {
    progressSource = 'local';
    progressCache = readLocalProgress();
  }

  // The source (and therefore the progress data itself) may have just
  // changed out from under whatever tree is currently on the canvas —
  // e.g. signing in mid-session should pull in that account's own
  // done/answer state for the tree already open, not leave the guest
  // session's state sitting there. Clear every node's in-memory progress
  // fields first so a node that was done under the old source but has no
  // matching record under the new one doesn't stay stuck looking done.
  if (state.nodes.size) {
    state.nodes.forEach(clearNodeProgressFields);
    autoRestoreProgress();
    if (typeof closeViewer === 'function') closeViewer();
    // See the reset-progress handler's own comment below for why nodeId
    // needs clearing too, not just closing the viewer.
    if (typeof viewer !== 'undefined') viewer.nodeId = null;
    updateAllStatuses();
  }
}

async function persistProgress() {
  if (progressSource === 'cloud' && state.accountUser) {
    try { await window.cloud.setProgress(state.accountUser.uid, encodeProgressForCloud(progressCache)); }
    catch (e) { console.error('Cloud progress save failed:', e); }
  } else {
    writeLocalProgress(progressCache);
  }
}

/* Serializes every current node into its own keyed record under this
   tree's signature, into progressCache, then persists to whichever
   source (local or cloud) is currently active. Called on any change
   worth remembering — a done toggle, a quiz answer, a notes edit — so
   "where you are" in a node's session (and its notes) is never lost
   while working through a tree. */
function autoSaveProgress() {
  const perNode = {};
  state.nodes.forEach(node => {
    perNode[node.label] = {
      done:           !!node.done,
      sessionAnswers: node._sessionAnswers || undefined,
      bonusAnswers:   node._bonusAnswers   || undefined,
      notes:          node._notes          || undefined,
      scrollTop:      node._scrollTop,
    };
  });
  progressCache[treeSignature()] = perNode;
  persistProgress(); // fire-and-forget, same as every other call site here — all synchronous event handlers
}

/** Restores each node's own record independently (done flag, session
    answers, notes, scroll position) from progressCache. */
function autoRestoreProgress() {
  const saved = progressCache[treeSignature()];
  if (!saved) return;
  let changed = false;
  state.nodes.forEach(node => {
    const rec = saved[node.label];
    if (!rec) return;
    if (rec.done) { node.done = true; changed = true; }
    if (rec.sessionAnswers) node._sessionAnswers = rec.sessionAnswers;
    if (rec.bonusAnswers)   node._bonusAnswers   = rec.bonusAnswers;
    if (rec.notes)          node._notes          = rec.notes;
    if (rec.scrollTop != null) node._scrollTop   = rec.scrollTop;
  });
  if (changed) updateAllStatuses();
}

/* Reset progress — clears the persisted record(s) plus the matching
   in-memory fields on every node, so the effect is immediate without a
   reload. Plain click: this tree only. Shift+click (or a long-press,
   for touch where there's no Shift key to hold): every tree ever
   saved. No confirmation dialog on purpose — mark-known mode already
   lets you freely toggle any node's done state with no safeguard, so
   this isn't introducing a new class of "undoable" risk.
   Now routed through progressCache/persistProgress instead of talking to
   localStorage directly, so a reset while signed in actually clears the
   account's cloud copy too, not just this browser's local copy. */
const btnResetProgress = document.getElementById('menu-reset-progress');
document.addEventListener('keydown', e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ Reset ALL progress'; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ Reset tree progress'; });

let resetAllArmed = false, resetPressTimer = null;
btnResetProgress.addEventListener('touchstart', () => {
  resetPressTimer = setTimeout(() => {
    resetAllArmed = true;
    btnResetProgress.textContent = '↺ Reset ALL progress';
    if (navigator.vibrate) navigator.vibrate(15);
  }, 550);
}, { passive:true });
btnResetProgress.addEventListener('touchend', () => clearTimeout(resetPressTimer), { passive:true });
btnResetProgress.addEventListener('touchcancel', () => {
  clearTimeout(resetPressTimer);
  resetAllArmed = false;
  btnResetProgress.textContent = '↺ Reset tree progress';
}, { passive:true });

function clearNodeProgressFields(node) {
  node.done = false;
  delete node._sessionAnswers;
  delete node._bonusAnswers;
  delete node._notes;
  delete node._scrollTop;
}

btnResetProgress.addEventListener('click', async e => {
  const resetAll = e.shiftKey || resetAllArmed;
  resetAllArmed = false;
  if (resetAll) {
    progressCache = {};
  } else {
    delete progressCache[treeSignature()];
  }
  state.nodes.forEach(clearNodeProgressFields);
  await persistProgress();
  btnResetProgress.textContent = '↺ Reset tree progress';
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

// Guest view is available immediately; refreshed again the moment
// Firebase reports an actual signed-in session (see handleCloudAuthChange
// in account.js), which may swap the source out from under this.
refreshProgressFromSource();
