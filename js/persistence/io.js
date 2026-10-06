/* ═══════════════════════════════════════════════════════════
   io.js — JSON import/export: serializing the tree to the on-disk
   format and parsing it back, with validation on the way in.
   Depends on state.js, layout.js, nodes.js (buildEl, wouldCycle,
   removeRedundantEdges), viewport.js (resetViewportForTreeLoad),
   progress.js (autoRestoreProgress), toast.js. library.js builds on
   buildTreeJSON and loadFromJSON below.

   Format: { "topic": "...", "language": "Spanish", "nodes": [
     { "id":"a", "label":"...", "explanation":"...", "requires":["b","c"], "optional":true, "content":"..." } ] }
   - `content` is the node's generated lesson .txt; it is only written by the
     "Structure + content" export. On import it goes straight into
     node._sessionTxt so the session reopens with no re-upload. Correct
     answers live inline in that text ([ANSWER: X]) and are re-derived, with a
     fresh deterministic option shuffle, whenever a session is opened.
   - `language` is the tree-wide default; it prefills (never locks) each
     node's language field in the learn modal.
   - `topic` names the exported file and is quoted in each node's prompt.
═══════════════════════════════════════════════════════════ */
function clearMap() {
  cancelLink();
  // Node ids restart at 1 on every load, so a viewer left pointing at "node 1"
  // would otherwise be re-revealed for the wrong tree.
  closeViewer();
  viewer.nodeId = null;
  state.nodes.forEach(n => n.el?.remove());
  clearEdgeEls();
  clearEdges();
  state.nodes.clear();
  state.nextId = 1;
  state.language = '';
  state.topic = '';
  state.libraryId = null; // a fresh load starts unlinked; openLibraryEntry() re-links it if that's where the load came from
}

// Unicode-aware, so a non-Latin topic still gets a usable filename/id
// instead of collapsing to "node".
function slugify(label) {
  const s = String(label || '').toLowerCase().trim()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'node';
}

/* Reads a picked .json file and hands the parsed object to onLoad; a file
   that can't be read or parsed is reported instead of silently ignored. */
function readJSONFile(file, onLoad) {
  const reader = new FileReader();
  reader.onload = ev => {
    let obj;
    try { obj = JSON.parse(ev.target.result); }
    catch { showToast(`"${file.name}" isn't valid JSON.`); return; }
    onLoad(obj);
  };
  reader.onerror = () => showToast(`Couldn't read "${file.name}".`);
  reader.readAsText(file);
}

/* Loads a tree object. Returns true on success. Problems that can be
   repaired (unknown prerequisites, self-links, links that would form a loop,
   repeated ids) are dropped and reported; a file that isn't a tree at all is
   rejected without touching whatever is currently on the canvas. */
function loadFromJSON(obj) {
  if (!obj || !Array.isArray(obj.nodes)) {
    showToast('That file isn\'t a tree — expected a JSON object with a "nodes" list.');
    return false;
  }
  const rawNodes = obj.nodes.filter(n => n && typeof n === 'object');
  if (!rawNodes.length) { showToast('That tree has no nodes.'); return false; }

  clearMap();
  state.language = typeof obj.language === 'string' ? obj.language.trim() : '';
  state.topic    = typeof obj.topic === 'string' ? obj.topic.trim() : '';

  const problems = { unknown: 0, self: 0, loop: 0, dupId: 0 };
  const idMap = new Map(); // string id → numeric id (first occurrence wins)
  const created = [];

  rawNodes.forEach(n => {
    const numId = state.nextId++;
    const label = n.label ?? '';
    const key   = String(n.id ?? slugify(label));
    if (idMap.has(key)) problems.dupId++; else idMap.set(key, numId);
    const node = { id:numId, slug:key, label, explanation:typeof n.explanation === 'string' ? n.explanation.trim() : '', optional:!!n.optional, done:!!n.done, depth:0, x:0, y:0, el:null };
    if (typeof n.content === 'string' && n.content.trim()) node._sessionTxt = n.content;
    state.nodes.set(numId, node);
    buildEl(node);
    created.push({ n, numId });
  });

  created.forEach(({ n, numId }) => {
    (Array.isArray(n.requires) ? n.requires : []).forEach(r => {
      const fromId = idMap.get(String(r));
      if (fromId === undefined)          { problems.unknown++; return; }
      if (fromId === numId)              { problems.self++;    return; }
      if (hasEdge(fromId, numId))        return;
      if (wouldCycle(fromId, numId))     { problems.loop++;    return; }
      addEdge(fromId, numId);
    });
  });

  layout();
  updateAllStatuses();
  resetViewportForTreeLoad();
  removeRedundantEdges();
  autoRestoreProgress();

  const notes = [];
  if (problems.unknown) notes.push(`${problems.unknown} prerequisite${problems.unknown > 1 ? 's' : ''} pointing at a topic that doesn't exist`);
  if (problems.self)    notes.push(`${problems.self} topic${problems.self > 1 ? 's' : ''} listing itself as a prerequisite`);
  if (problems.loop)    notes.push(`${problems.loop} link${problems.loop > 1 ? 's' : ''} that would form a loop`);
  if (problems.dupId)   notes.push(`${problems.dupId} repeated id${problems.dupId > 1 ? 's' : ''}`);
  if (notes.length) showToast(`Loaded, but ignored: ${notes.join('; ')}.`);
  return true;
}

/* Exportable JSON shape from the live nodes/edges — shared by exportToJSON
   (file download) and library.js (local/cloud save). */
function buildTreeJSON(includeContent) {
  if (!state.nodes.size) return null;
  const idToStr = new Map(), used = new Set();
  state.nodes.forEach((n, id) => {
    const base = n.slug || slugify(n.label);
    let s = base, i = 2;
    while (used.has(s)) s = `${base}_${i++}`;
    used.add(s);
    idToStr.set(id, s);
  });
  const nodes = [];
  state.nodes.forEach((n, id) => {
    const obj = { id: idToStr.get(id), label: n.label };
    if (n.explanation) obj.explanation = n.explanation;
    const reqs = prereqsOf(id).map(p => idToStr.get(p)).filter(Boolean);
    if (reqs.length) obj.requires = reqs;
    if (n.optional) obj.optional = true;
    if (includeContent && n._sessionTxt) obj.content = n._sessionTxt;
    nodes.push(obj);
  });
  const out = {};
  if (state.topic)    out.topic = state.topic;
  if (state.language) out.language = state.language;
  out.nodes = nodes;
  return out;
}

function exportToJSON(includeContent) {
  const out = buildTreeJSON(includeContent);
  if (!out) { showToast('Add a topic before exporting the tree.', 3000); return; }
  const blob = new Blob([JSON.stringify(out, null, 2)], { type:'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const base = state.topic ? slugify(state.topic) : 'progress-tree';
  a.href = url;
  a.download = includeContent ? `${base}-with-content.json` : `${base}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) readJSONFile(file, loadFromJSON);
  e.target.value = '';
});
document.getElementById('menu-export-structure').addEventListener('click', () => exportToJSON(false));
document.getElementById('menu-export-content').addEventListener('click', () => exportToJSON(true));
