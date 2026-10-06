/* ═══════════════════════════════════════════════════════════
   progress.js — persistence of per-node progress (done flag, quiz/bonus
   answers, notes, scroll position), independent of the tree's own JSON
   (see io.js): a tree's structure and a learner's progress through it are
   saved separately on purpose (see treeSignature). Also owns the "reset
   progress" control, including its shift-click / long-press "reset every
   tree" variant.

   STORAGE SOURCE: signed out, progress lives in this browser's
   localStorage (PROGRESS_KEY); signed in (account.js/cloud.js) it lives
   under the user's uid in Firebase. refreshProgressFromSource() and
   writeProgressNow() are the only functions that know which is active
   (progressSource); everything else works on the in-memory progressCache.
   window.handleCloudAuthChange (account.js) triggers a refresh on every
   sign-in/out. library.js reads progressCache too, so its done/total
   counts are right for either source.

   WRITE BATCHING: autoSaveProgress() runs on every done toggle, quiz answer
   and (debounced upstream) notes edit or scroll — far too often to write
   each time, and a synchronous localStorage write mid-scroll shows up as
   stutter. persistProgress() only marks a write pending; the actual write
   happens when the tab is hidden or unloaded, or immediately through
   persistProgressNow() for one-off deliberate actions (seeding a new
   account, reset). A failed write leaves the write pending so a later flush
   retries it.

   FIREBASE KEY SAFETY: progressCache is keyed by tree signature and then by
   node label — arbitrary text that may contain characters ('.', '#', '$',
   '[', ']', '/') Firebase keys reject. localStorage doesn't care, so only
   the object sent to / read from the cloud goes through
   encodeProgressForCloud/decodeProgressFromCloud.

   Depends on state.js, toast.js, and viewer.js (closeViewer — only called on
   a click, after everything has loaded).
═══════════════════════════════════════════════════════════ */
const PROGRESS_KEY = 'tree-progress';

let progressCache  = {};      // in-memory mirror of whichever source is active
let progressSource = 'local'; // 'local' | 'cloud'

function readLocalProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}
function writeLocalProgress(obj) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(obj)); return true; }
  catch {
    showToast("Couldn't save your progress — this browser's storage is full or blocked. Signing in stores it in your account instead.");
    return false;
  }
}

/* ── Firebase key sanitization (cloud storage only) ──
   encodeURIComponent escapes '#', '$', '[', ']', '/'; '.' survives it, so it
   needs its own pass. */
function toFirebaseKey(k)   { return encodeURIComponent(String(k)).replace(/\./g, '%2E'); }
function fromFirebaseKey(k) { try { return decodeURIComponent(k); } catch { return k; } }
function encodeProgressForCloud(cache) {
  const out = {};
  for (const sig of Object.keys(cache)) {
    const perNode = {};
    for (const label of Object.keys(cache[sig] || {})) {
      // Records can hold `undefined` fields; JSON.stringify drops them for
      // localStorage, but Firebase's set() rejects them, so round-trip here.
      perNode[toFirebaseKey(label)] = JSON.parse(JSON.stringify(cache[sig][label]));
    }
    out[toFirebaseKey(sig)] = perNode;
  }
  return out;
}
function decodeProgressFromCloud(obj) {
  const out = {};
  for (const encSig of Object.keys(obj || {})) {
    const perNode = {};
    for (const encLabel of Object.keys(obj[encSig] || {})) perNode[fromFirebaseKey(encLabel)] = obj[encSig][encLabel];
    out[fromFirebaseKey(encSig)] = perNode;
  }
  return out;
}

/* Identifies "this tree" across re-exports and small edits without matching
   labels against every other tree ever loaded: the sorted set of root labels.
   Without it a node named "Chain Rule" could show as complete on an unrelated
   tree that once used the same label. */
function treeSignature() {
  const roots = [];
  state.nodes.forEach((n, id) => { if (prereqsOf(id).length === 0) roots.push(n.label.trim().toLowerCase()); });
  return roots.sort().join('|') || '(empty)';
}

/* ── source switching ──
   Called once at load (guest view, so progress works before Firebase has
   resolved a persisted session) and by handleCloudAuthChange on every
   sign-in/out. */
async function refreshProgressFromSource() {
  if (state.accountUser) {
    progressSource = 'cloud';
    try {
      progressCache = decodeProgressFromCloud(await window.cloud.getProgress(state.accountUser.uid));
    } catch (e) {
      console.error('Could not load cloud progress:', e);
      progressCache = {};
    }
    // A fresh account with no cloud progress but local progress from before
    // signing in gets the local copy uploaded rather than orphaned.
    const local = readLocalProgress();
    if (Object.keys(progressCache).length === 0 && Object.keys(local).length > 0) {
      progressCache = local;
      await persistProgressNow();
    }
  } else {
    progressSource = 'local';
    progressCache = readLocalProgress();
  }

  // The data may have just changed under the tree on screen (e.g. signing in
  // mid-session): clear every node's in-memory progress, then restore from the
  // new source, so a node done under the old source doesn't stay stuck done.
  if (state.nodes.size) {
    state.nodes.forEach(clearNodeProgressFields);
    autoRestoreProgress();
    if (typeof closeViewer === 'function') closeViewer();
    if (typeof viewer !== 'undefined') viewer.nodeId = null; // see the reset handler below
    updateAllStatuses();
  }

  if (document.getElementById('library-modal-backdrop')?.classList.contains('open') && typeof renderLibraryGrid === 'function') {
    renderLibraryGrid();
  }
}

async function writeProgressToCloud() {
  if (!state.accountUser) return false;
  try {
    await window.cloud.setProgress(state.accountUser.uid, encodeProgressForCloud(progressCache));
    return true;
  } catch (e) {
    console.error('Cloud progress save failed:', e);
    showToast("Couldn't sync your progress to your account. It will retry the next time the page is hidden or closed.");
    return false;
  }
}

/* Writes to whichever source is active; resolves to whether it succeeded.
   The local branch runs synchronously, which matters on pagehide. */
function writeProgressNow() {
  if (progressSource === 'cloud' && state.accountUser) return writeProgressToCloud();
  return Promise.resolve(writeLocalProgress(progressCache));
}

let progressPending = false;

/* Sends the pending write now — on tab-hide/unload, before sign-out, and
   safe to call when nothing is pending. A failure re-marks it pending. */
async function flushProgress() {
  if (!progressPending) return;
  progressPending = false;
  if (!(await writeProgressNow())) progressPending = true;
}

function persistProgress() { progressPending = true; }

async function persistProgressNow() {
  progressPending = false;
  if (!(await writeProgressNow())) progressPending = true;
}

// pagehide is more reliable than beforeunload on mobile/Safari, so wire both
// events that mean "this tab is going away or out of view". Neither guarantees
// a network write finishes (there's no sendBeacon for Firebase RTDB), but the
// local write is synchronous.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushProgress();
});
window.addEventListener('pagehide', () => { flushProgress(); });

/* Serializes every node into its record under this tree's signature, then
   marks a write pending. Called on any change worth remembering. */
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
  persistProgress();
}

/* Restores each node's record (done flag, answers, notes, scroll) from progressCache. */
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

/* ── reset progress ──
   Plain click: this tree only. Shift+click (or long-press on touch, where
   there's no Shift): every tree. Resetting one tree needs no confirmation —
   mark-known mode already toggles any node freely — but wiping every tree
   (including the synced copy) does. Goes through progressCache/persist so a
   reset while signed in clears the account's copy too. */
const btnResetProgress = document.getElementById('menu-reset-progress');
const RESET_LABEL_TREE = '↺ Reset tree progress', RESET_LABEL_ALL = '↺ Reset ALL progress';
document.addEventListener('keydown', e => { if (e.key === 'Shift') btnResetProgress.textContent = RESET_LABEL_ALL; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') btnResetProgress.textContent = RESET_LABEL_TREE; });

let resetAllArmed = false, resetPressTimer = null;
btnResetProgress.addEventListener('touchstart', () => {
  resetPressTimer = setTimeout(() => {
    resetAllArmed = true;
    btnResetProgress.textContent = RESET_LABEL_ALL;
    if (navigator.vibrate) navigator.vibrate(15);
  }, 550);
}, { passive:true });
btnResetProgress.addEventListener('touchend', () => clearTimeout(resetPressTimer), { passive:true });
btnResetProgress.addEventListener('touchcancel', () => {
  clearTimeout(resetPressTimer);
  resetAllArmed = false;
  btnResetProgress.textContent = RESET_LABEL_TREE;
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
  btnResetProgress.textContent = RESET_LABEL_TREE;
  if (resetAll && !window.confirm(`Reset progress on every tree${state.accountUser ? ', including the copy synced to your account' : ''}? This can't be undone.`)) return;

  if (resetAll) progressCache = {};
  else delete progressCache[treeSignature()];
  state.nodes.forEach(clearNodeProgressFields);
  await persistProgressNow();
  closeViewer();
  // closeViewer() leaves viewer.nodeId alone so reopening the SAME session
  // normally skips a rebuild. After a reset that shortcut would re-reveal the
  // stale answers/notes still in the DOM, so force a real rebuild next time.
  viewer.nodeId = null;
  updateAllStatuses();
});

// Guest view is available immediately; refreshed again when Firebase reports
// a signed-in session (see handleCloudAuthChange in account.js).
refreshProgressFromSource();
