/* My Trees stores structure/content separately from learner progress.
   IndexedDB backs guest snapshots; cloud writes operate on individual entries
   and reject stale edits. Exported tree IDs identify each progress record. */
const LIBRARY_KEY = 'tree-library';

let libraryCache  = {};      // in-memory mirror of whichever source is active
let librarySource = 'local'; // 'local' | 'cloud'
let libraryMutationPending = false;

function guardLibraryMutation(action) {
  return async (...args) => {
    if (libraryMutationPending) return;
    libraryMutationPending = true;
    renderLibraryGrid();
    try { return await action(...args); }
    finally {
      libraryMutationPending = false;
      renderLibraryGrid();
    }
  };
}

async function readLocalLibrary() { return browserStore.read(LIBRARY_KEY); }
async function writeLocalLibrary(lib) {
  try { await browserStore.write(LIBRARY_KEY, lib); return true; }
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
  const rec = progressCache[entryData.treeId] || progressCache[signatureFromNodes(entryData.nodes)];
  if (!rec) return { done: 0, total };
  return { done: entryData.nodes.filter(n => (rec[n.progressId || n.id] || rec[n.label])?.done).length, total };
}

/* ── source switching ──
   Called at load (guest view, before Firebase resolves a persisted session)
   and by handleCloudAuthChange (account.js) on every sign-in/out. */
let libraryRefreshGeneration = 0;
async function refreshLibraryFromSource() {
  if (libraryMutationPending) return;
  const generation = ++libraryRefreshGeneration;
  const uid = state.accountUser?.uid;
  const originalCache = libraryCache;
  if (state.accountUser) {
    librarySource = 'cloud';
    try {
      const loaded = await window.cloud.getLibrary(state.accountUser.uid);
      if (generation !== libraryRefreshGeneration || uid !== state.accountUser?.uid) return;
      libraryCache = loaded;
    } catch (e) {
      console.error('Could not load cloud library:', e);
      showToast("Couldn't load your saved trees from your account.");
      return;
    }
    // A fresh account with an empty cloud library but trees saved locally
    // before signing in gets those copied up rather than orphaned.
    const local = await readLocalLibrary();
    if (generation !== libraryRefreshGeneration || uid !== state.accountUser?.uid) return;
    if (Object.keys(libraryCache).length === 0 && Object.keys(local).length > 0) {
      libraryCache = local;
      await persistLibrary();
    }
  } else {
    librarySource = 'local';
    if (!window.indexedDB) libraryCache = JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}');
    else {
      const loaded = await readLocalLibrary();
      if (generation !== libraryRefreshGeneration || uid !== state.accountUser?.uid || libraryCache !== originalCache) return;
      libraryCache = loaded;
    }
  }
  if (document.getElementById('library-modal-backdrop')?.classList.contains('open')) renderLibraryGrid();
}

// Resolves to whether the write succeeded; failures are reported to the person.
async function persistLibrary() {
  if (librarySource === 'cloud' && state.accountUser) {
    try { await window.cloud.setLibrary(state.accountUser.uid, libraryCache); return true; }
    catch (e) {
      console.error('Cloud save failed:', e);
      showToast(e.message || "Couldn't save to your account — check your connection and try again.");
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
  if (!snapshot) return;

  if (state.libraryId && libraryCache[state.libraryId]) {
    const entry = libraryCache[state.libraryId];
    const before = { data: entry.data, savedAt: entry.savedAt };
    entry.data = snapshot;
    entry.savedAt = Date.now();
    if (!(await persistLibrary())) Object.assign(entry, before);
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
  if (!snapshot) return;
  snapshot.treeId = 'tree_' + crypto.randomUUID();
  const name = (window.prompt('Name this copy:', (state.topic || 'Untitled tree') + ' copy') || '').trim();
  if (!name) return;
  const id = genLibraryId();
  libraryCache[id] = { name, savedAt: Date.now(), data: snapshot };
  if (await persistLibrary()) { state.libraryId = id; state.treeId = snapshot.treeId; }
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
  libraryCache[newId] = { name: entry.name + ' copy', savedAt: Date.now(), data: { ...JSON.parse(JSON.stringify(entry.data)), treeId: 'tree_' + crypto.randomUUID() } };
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
  for (const button of document.querySelectorAll('.library-save-row button, #library-grid button')) {
    button.disabled = libraryMutationPending;
  }
}

/* ── modal open/close ── */
async function openLibraryModal() {
  document.getElementById('library-modal-backdrop').classList.add('open');
  await refreshLibraryFromSource().catch(() => showToast("Couldn't load this browser's saved trees."));
  renderLibraryGrid();
}
function closeLibraryModal() {
  document.getElementById('library-modal-backdrop').classList.remove('open');
}

saveCurrentTreeToLibrary = guardLibraryMutation(saveCurrentTreeToLibrary);
saveCurrentTreeAsNewCopy = guardLibraryMutation(saveCurrentTreeAsNewCopy);
renameLibraryEntry = guardLibraryMutation(renameLibraryEntry);
duplicateLibraryEntry = guardLibraryMutation(duplicateLibraryEntry);
deleteLibraryEntry = guardLibraryMutation(deleteLibraryEntry);

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
refreshLibraryFromSource().catch(() => showToast("Couldn't load this browser's saved trees."));
