/* ═══════════════════════════════════════════════════════════
   library.js — "My Trees": a save/load library for whole trees (structure
   + each node's generated lesson content), separate from the manual JSON
   import/export in io.js and the progress tracking in progress.js.

   An entry is a stored snapshot in the exact shape loadFromJSON() reads
   (what buildTreeJSON() produces). Progress is deliberately not stored a
   second time: it already persists via progress.js, keyed by
   treeSignature(), so opening an entry restores its progress for free, and
   this file reads progressCache (not localStorage) so the done/total counts
   are right whichever source is active.

   STORAGE SOURCE: signed out, the library is this browser's localStorage
   (LIBRARY_KEY); signed in (account.js/cloud.js) it lives under the user's
   uid in Firebase. refreshLibraryFromSource() and persistLibrary() are the
   only two functions that know which; everything else works on libraryCache.

   state.libraryId tracks which entry the tree on the canvas came from, so
   "save" can update it in place. clearMap() resets it; openLibraryEntry()
   re-links it, the one place a load counts as "this IS that entry".

   Depends on state.js, io.js (buildTreeJSON, loadFromJSON), progress.js
   (progressCache), tools.js (svEsc), escape.js, toast.js, and — once
   signed in — window.cloud (cloud.js, a module that runs after this file).
═══════════════════════════════════════════════════════════ */
const LIBRARY_KEY = 'tree-library';

let libraryCache  = {};      // in-memory mirror of whichever source is active
let librarySource = 'local'; // 'local' | 'cloud'

function readLocalLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}'); } catch { return {}; }
}
function writeLocalLibrary(lib) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); return true; }
  catch {
    showToast("Couldn't save — this browser's storage is full or blocked. Export the tree as JSON instead, or sign in to store it in your account.");
    return false;
  }
}
function genLibraryId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Mirrors treeSignature() in progress.js (sorted, lowercased root labels) over
   a plain node array, so a stored entry's progress can be found without
   loading it onto the canvas. */
function signatureFromNodes(nodesArr) {
  const roots = (nodesArr || [])
    .filter(n => !n.requires || !n.requires.length)
    .map(n => String(n.label || '').trim().toLowerCase());
  return roots.sort().join('|') || '(empty)';
}

function libraryProgressFor(entryData) {
  const total = entryData.nodes?.length || 0;
  if (!total) return { done: 0, total: 0 };
  const rec = progressCache[signatureFromNodes(entryData.nodes)];
  if (!rec) return { done: 0, total };
  return { done: entryData.nodes.filter(n => rec[n.label]?.done).length, total };
}

/* ── source switching ──
   Called at load (guest view, before Firebase resolves a persisted session)
   and by handleCloudAuthChange (account.js) on every sign-in/out. */
async function refreshLibraryFromSource() {
  if (state.accountUser) {
    librarySource = 'cloud';
    try {
      libraryCache = await window.cloud.getLibrary(state.accountUser.uid);
    } catch (e) {
      console.error('Could not load cloud library:', e);
      showToast("Couldn't load your saved trees from your account.");
      libraryCache = {};
    }
    // A fresh account with an empty cloud library but trees saved locally
    // before signing in gets those copied up rather than orphaned.
    const local = readLocalLibrary();
    if (Object.keys(libraryCache).length === 0 && Object.keys(local).length > 0) {
      libraryCache = local;
      await persistLibrary();
    }
  } else {
    librarySource = 'local';
    libraryCache = readLocalLibrary();
  }
  if (document.getElementById('library-modal-backdrop')?.classList.contains('open')) renderLibraryGrid();
}

// Resolves to whether the write succeeded; failures are reported to the person.
async function persistLibrary() {
  if (librarySource === 'cloud' && state.accountUser) {
    try { await window.cloud.setLibrary(state.accountUser.uid, libraryCache); return true; }
    catch (e) {
      console.error('Cloud save failed:', e);
      showToast("Couldn't save to your account — check your connection and try again.");
      return false;
    }
  }
  return writeLocalLibrary(libraryCache);
}

/* ── save ──
   If the tree is already linked to an entry, overwrite it in place ("I edited
   a tree I opened from here, save my changes back"); otherwise it's a first
   save, so ask for a name. A failed write is rolled back so the grid never
   shows something that isn't actually stored. */
async function saveCurrentTreeToLibrary() {
  const snapshot = buildTreeJSON(true);
  if (!snapshot) { showToast('Add a topic before saving the tree.', 3000); return; }

  if (state.libraryId && libraryCache[state.libraryId]) {
    const entry = libraryCache[state.libraryId];
    const before = { data: entry.data, savedAt: entry.savedAt };
    entry.data = snapshot;
    entry.savedAt = Date.now();
    if (!(await persistLibrary())) Object.assign(entry, before);
    else showToast(`Saved changes to "${entry.name}".`, 3000);
    renderLibraryGrid();
    return;
  }

  const name = (window.prompt('Name this tree:', state.topic || 'Untitled tree') || '').trim();
  if (!name) return;
  const id = genLibraryId();
  libraryCache[id] = { name, savedAt: Date.now(), data: snapshot };
  if (await persistLibrary()) state.libraryId = id;
  else delete libraryCache[id];
  renderLibraryGrid();
}

/* "Save as new copy" — only offered once the tree is linked to an entry:
   branch off the saved version without overwriting it. */
async function saveCurrentTreeAsNewCopy() {
  const snapshot = buildTreeJSON(true);
  if (!snapshot) { showToast('Add a topic before saving the tree.', 3000); return; }
  const name = (window.prompt('Name this copy:', (state.topic || 'Untitled tree') + ' copy') || '').trim();
  if (!name) return;
  const id = genLibraryId();
  libraryCache[id] = { name, savedAt: Date.now(), data: snapshot };
  if (await persistLibrary()) state.libraryId = id;
  else delete libraryCache[id];
  renderLibraryGrid();
}

/* ── open / rename / duplicate / delete ── */
function openLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  if (!loadFromJSON(entry.data)) return; // clearMap() inside resets state.libraryId to null…
  state.libraryId = id;                  // …so re-link it: this load really is that entry
  closeLibraryModal();
}

async function renameLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  const name = (window.prompt('Rename tree:', entry.name) || '').trim();
  if (!name) return;
  const before = entry.name;
  entry.name = name;
  if (!(await persistLibrary())) entry.name = before;
  renderLibraryGrid();
}

async function duplicateLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  const newId = genLibraryId();
  libraryCache[newId] = { name: entry.name + ' copy', savedAt: Date.now(), data: entry.data };
  if (!(await persistLibrary())) delete libraryCache[newId];
  renderLibraryGrid();
}

async function deleteLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  if (!window.confirm(`Delete "${entry.name}"? This can't be undone.`)) return;
  delete libraryCache[id];
  if (!(await persistLibrary())) libraryCache[id] = entry;
  else if (state.libraryId === id) state.libraryId = null;
  renderLibraryGrid();
}

/* ── rendering ── */
function formatSavedAt(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)  return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

function renderLibraryGrid() {
  const grid  = document.getElementById('library-grid');
  const empty = document.getElementById('library-empty');
  const ids   = Object.keys(libraryCache).sort((a, b) => (libraryCache[b].savedAt || 0) - (libraryCache[a].savedAt || 0));

  document.getElementById('library-modal-meta').textContent = state.accountUser
    ? `synced to ${state.accountUser.username || state.accountUser.email}`
    : 'saved locally in this browser — sign in to sync across devices';

  const hasCurrentTree = state.nodes.size > 0;
  const linkedToOpen   = !!(state.libraryId && libraryCache[state.libraryId]);

  const saveBtn = document.getElementById('btn-save-current-tree');
  saveBtn.classList.toggle('hidden', !hasCurrentTree);
  saveBtn.textContent = linkedToOpen ? '💾 update saved copy' : '💾 save current tree';
  document.getElementById('btn-save-current-tree-copy').classList.toggle('hidden', !(hasCurrentTree && linkedToOpen));

  empty.classList.toggle('hidden', ids.length !== 0);
  grid.innerHTML = '';

  ids.forEach(id => {
    const entry = libraryCache[id];
    const total = entry.data.nodes?.length || 0;
    const { done } = libraryProgressFor(entry.data);
    const pct = total ? Math.round((done / total) * 100) : 0;
    const isOpen = state.libraryId === id;

    const card = document.createElement('div');
    card.className = 'library-card' + (isOpen ? ' library-card-open' : '');
    card.innerHTML = `
      <div class="lc-name">${svEsc(entry.name)}</div>
      <div class="lc-meta">${total} node${total !== 1 ? 's' : ''}${entry.data.language ? ' · ' + svEsc(entry.data.language) : ''}</div>
      <div class="lc-progress-track"><div class="lc-progress-bar" style="width:${pct}%"></div></div>
      <div class="lc-meta">${done}/${total} complete · saved ${formatSavedAt(entry.savedAt)}${isOpen ? ' · currently open' : ''}</div>
      <div class="lc-actions">
        <button class="btn lc-open">open</button>
        <button class="btn lc-rename">rename</button>
        <button class="btn lc-dup">duplicate</button>
        <button class="btn danger lc-del">delete</button>
      </div>
    `;
    card.querySelector('.lc-open').addEventListener('click', () => openLibraryEntry(id));
    card.querySelector('.lc-rename').addEventListener('click', () => renameLibraryEntry(id));
    card.querySelector('.lc-dup').addEventListener('click', () => duplicateLibraryEntry(id));
    card.querySelector('.lc-del').addEventListener('click', () => deleteLibraryEntry(id));
    grid.appendChild(card);
  });
}

/* ── modal open/close ── */
async function openLibraryModal() {
  document.getElementById('library-modal-backdrop').classList.add('open');
  await refreshLibraryFromSource();
  renderLibraryGrid();
}
function closeLibraryModal() {
  document.getElementById('library-modal-backdrop').classList.remove('open');
}

document.getElementById('btn-my-trees').addEventListener('click', openLibraryModal);
document.getElementById('library-modal-close').addEventListener('click', closeLibraryModal);
document.getElementById('library-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('library-modal-backdrop')) closeLibraryModal();
});
document.getElementById('btn-save-current-tree').addEventListener('click', saveCurrentTreeToLibrary);
document.getElementById('btn-save-current-tree-copy').addEventListener('click', saveCurrentTreeAsNewCopy);

onEscape(100, () => {
  if (!document.getElementById('library-modal-backdrop').classList.contains('open')) return false;
  closeLibraryModal();
  return true;
});

// Guest view is available immediately; refreshed again when Firebase reports a signed-in session.
refreshLibraryFromSource();
