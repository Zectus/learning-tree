/* ═══════════════════════════════════════════════════════════
   library.js — "My Trees": a save/load library for whole trees
   (structure + each node's generated lesson content), separate
   from the manual JSON import/export in io.js and the per-node
   progress tracking in progress.js.

   A library entry is just a stored snapshot in the exact shape
   loadFromJSON() already knows how to read (the same shape
   buildTreeJSON() in io.js produces for a file export) — this
   file only adds the "usual" save/open/rename/duplicate/delete
   operations, and the card-grid UI, on top of that. Progress
   (done flags, quiz answers, notes) is deliberately NOT stored
   here a second time — it already persists independently in
   localStorage, keyed by treeSignature() (see progress.js), so
   opening a library entry restores its progress for free.

   STORAGE SOURCE: signed out, the whole library lives in this
   browser's localStorage (LIBRARY_KEY below) — no account
   needed. Signed in (see account.js/cloud.js), it lives instead
   under this user's own uid in Firebase, so it follows them
   across devices. refreshLibraryFromSource() and persistLibrary()
   are the only two functions that know which of those two is
   currently active (librarySource) — every other function in this
   file just reads/writes the in-memory libraryCache and doesn't
   care where it came from. window.handleCloudAuthChange (in
   account.js) calls refreshLibraryFromSource() on every sign-in/
   sign-out, which is what actually switches the source.

   state.libraryId tracks which saved entry (if any) the tree
   currently on the canvas came from, so "save" can tell whether
   to update that entry in place or create a new one. It's reset
   to null by clearMap() (io.js) on every load, and set explicitly
   by openLibraryEntry() below right after — the one place a load
   should actually count as "this IS that saved entry" rather than
   "a tree that happens to look like it."

   Depends on state.js, io.js (buildTreeJSON, loadFromJSON,
   slugify), progress.js (PROGRESS_KEY, and the same per-node
   record shape autoSaveProgress writes), tools.js (svEsc), and
   — only once a person actually signs in — window.cloud, set up
   by cloud.js (a module that runs after this file; see its own
   header for why that ordering is safe).
═══════════════════════════════════════════════════════════ */

const LIBRARY_KEY = 'tree-library';

let libraryCache  = {};      // in-memory mirror of whichever source is currently active
let librarySource = 'local'; // 'local' | 'cloud'

function readLocalLibrary() {
  try { return JSON.parse(localStorage.getItem(LIBRARY_KEY) || '{}'); } catch { return {}; }
}
function writeLocalLibrary(lib) {
  try { localStorage.setItem(LIBRARY_KEY, JSON.stringify(lib)); } catch {}
}
function genLibraryId() {
  return 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* Mirrors treeSignature() in progress.js exactly (sorted, lowercased root
   labels) but works off a plain node array — a stored entry's own
   data.nodes — instead of the live state.nodes Map, so a saved entry's
   progress can be looked up without loading it onto the canvas first. */
function signatureFromNodes(nodesArr) {
  const roots = (nodesArr || [])
    .filter(n => !n.requires || !n.requires.length)
    .map(n => String(n.label || '').trim().toLowerCase());
  return roots.sort().join('|') || '(empty)';
}

function libraryProgressFor(entryData) {
  const total = entryData.nodes?.length || 0;
  if (!total) return { done: 0, total: 0 };
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const rec = all[signatureFromNodes(entryData.nodes)];
    if (!rec) return { done: 0, total };
    const done = entryData.nodes.filter(n => rec[n.label]?.done).length;
    return { done, total };
  } catch { return { done: 0, total }; }
}

/* ── source switching ──────
   Called once at load (guest view, so "My Trees" works before Firebase
   has even resolved whether there's a persisted session) and again by
   window.handleCloudAuthChange (account.js) on every sign-in/sign-out. */
async function refreshLibraryFromSource() {
  if (state.accountUser) {
    librarySource = 'cloud';
    try {
      libraryCache = await window.cloud.getLibrary(state.accountUser.uid);
    } catch (e) {
      console.error('Could not load cloud library:', e);
      libraryCache = {};
    }
    // One-time convenience: a fresh account with an empty cloud library,
    // but trees saved locally before signing in, gets those local trees
    // copied up rather than silently orphaned — signing in shouldn't make
    // work someone already did disappear from "My Trees".
    const local = readLocalLibrary();
    if (Object.keys(libraryCache).length === 0 && Object.keys(local).length > 0) {
      libraryCache = local;
      await persistLibrary();
    }
  } else {
    librarySource = 'local';
    libraryCache = readLocalLibrary();
  }
  if (document.getElementById('library-modal-backdrop')?.classList.contains('open')) {
    renderLibraryGrid();
  }
}

async function persistLibrary() {
  if (librarySource === 'cloud' && state.accountUser) {
    try { await window.cloud.setLibrary(state.accountUser.uid, libraryCache); }
    catch (e) { console.error('Cloud save failed:', e); }
  } else {
    writeLocalLibrary(libraryCache);
  }
}

/* ── save ──────
   Plain "save": if the current tree is already linked to a library entry
   (state.libraryId), overwrite that entry's data in place — this is the
   path for "I edited a tree I opened from here, save my changes back."
   Otherwise it's a first save, so ask for a name and create a new entry. */
async function saveCurrentTreeToLibrary() {
  const snapshot = buildTreeJSON(true);
  if (!snapshot) return;

  if (state.libraryId && libraryCache[state.libraryId]) {
    libraryCache[state.libraryId].data = snapshot;
    libraryCache[state.libraryId].savedAt = Date.now();
    await persistLibrary();
    renderLibraryGrid();
    return;
  }

  const suggested = state.topic || 'Untitled tree';
  const name = (window.prompt('Name this tree:', suggested) || '').trim();
  if (!name) return;

  const id = genLibraryId();
  libraryCache[id] = { name, savedAt: Date.now(), data: snapshot };
  await persistLibrary();
  state.libraryId = id;
  renderLibraryGrid();
}

/* "Save as a new copy" — only relevant once a tree IS already linked to an
   entry (see the button's own visibility in renderLibraryGrid): lets you
   branch off the saved version currently open without overwriting it. */
async function saveCurrentTreeAsNewCopy() {
  const snapshot = buildTreeJSON(true);
  if (!snapshot) return;
  const suggested = (state.topic || 'Untitled tree') + ' copy';
  const name = (window.prompt('Name this copy:', suggested) || '').trim();
  if (!name) return;
  const id = genLibraryId();
  libraryCache[id] = { name, savedAt: Date.now(), data: snapshot };
  await persistLibrary();
  state.libraryId = id;
  renderLibraryGrid();
}

/* ── open / rename / duplicate / delete ────── */
function openLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  loadFromJSON(entry.data);   // clearMap() inside this resets state.libraryId to null first
  state.libraryId = id;       // ...then this re-links it, since this load really is that entry
  closeLibraryModal();
}

async function renameLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  const name = (window.prompt('Rename tree:', entry.name) || '').trim();
  if (!name) return;
  entry.name = name;
  await persistLibrary();
  renderLibraryGrid();
}

async function duplicateLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  const newId = genLibraryId();
  libraryCache[newId] = { name: entry.name + ' copy', savedAt: Date.now(), data: entry.data };
  await persistLibrary();
  renderLibraryGrid();
}

async function deleteLibraryEntry(id) {
  const entry = libraryCache[id];
  if (!entry) return;
  if (!window.confirm(`Delete "${entry.name}"? This can't be undone.`)) return;
  delete libraryCache[id];
  await persistLibrary();
  if (state.libraryId === id) state.libraryId = null;
  renderLibraryGrid();
}

/* ── rendering ────── */
function formatSavedAt(ts) {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
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
    ? `synced to ${state.accountUser.email}`
    : 'saved locally in this browser — sign in to sync across devices';

  const hasCurrentTree = state.nodes.size > 0;
  const linkedToOpen    = !!(state.libraryId && libraryCache[state.libraryId]);

  const saveBtn = document.getElementById('btn-save-current-tree');
  saveBtn.classList.toggle('hidden', !hasCurrentTree);
  saveBtn.textContent = linkedToOpen ? '💾 update saved copy' : '💾 save current tree';

  const saveCopyBtn = document.getElementById('btn-save-current-tree-copy');
  saveCopyBtn.classList.toggle('hidden', !(hasCurrentTree && linkedToOpen));

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

/* ── modal open/close ────── */
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

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('library-modal-backdrop').classList.contains('open'))
    closeLibraryModal();
});

// Guest view is available immediately; refreshed again the moment
// Firebase reports an actual signed-in session (see handleCloudAuthChange
// in account.js), which may swap the source out from under this.
refreshLibraryFromSource();
