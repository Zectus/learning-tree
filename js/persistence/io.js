/* ═══════════════════════════════════════════════════════════
   io.js — JSON import/export only: serializing the tree to the
   on-disk format and parsing it back. This used to be one section
   inside a much larger file (viewport/toolbar/progress/prompts
   all lived here too); everything else has moved to its own file
   (viewport.js, toolbar.js, progress.js, prompts.js) and this
   file now does exactly what its name says — reads and writes
   the tree's JSON. "Load JSON" and both export options now live
   as .dropdown-item entries inside the Tree ▾ toolbar menu (see
   index.html) rather than standalone buttons; the open/close
   behavior for that dropdown is generic now (toolbar.js), so this
   file only wires up what each item actually does.
   Depends on state.js, layout.js (buildEl,
   removeRedundantEdges), viewport.js (resetViewportForTreeLoad),
   progress.js (autoRestoreProgress). library.js (the local/cloud
   "My Trees" save/load feature) depends on buildTreeJSON and
   loadFromJSON below, and loads after this file.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   JSON  import / export
   Format: { "language": "Spanish", "nodes": [{ "id":"a", "label":"...", "requires":["b","c"], "optional":true, "done":false, "content":"..." }] }
   `content` is optional and, when present, is the full generated
   lesson .txt for that node (the same text you'd otherwise upload
   by hand). It's only written when the "Structure + content"
   export option is chosen (see exportToJSON) — plain "structure
   only" exports omit it entirely. On import, a node with `content`
   has it restored straight into node._sessionTxt, so its session
   can be reopened immediately with no re-upload needed. Each
   question's correct answer lives inline in that text (an
   [ANSWER: X] tag per [QUESTION]/[BONUS] block — see viewer.js's
   parseQuestionBody/parseBonusBody) and is re-derived, along with
   a fresh deterministic option shuffle (tools.js's shuffleOptions),
   every time the session is opened — there's no separate answer
   key to extract or restore here.
   `language` is optional too, and is the tree-wide language it was
   designed in (see buildTreePrompt). It's read into state.language on
   import, which prefills — but doesn't lock in — each node's own
   language field in the learn modal whenever that field is blank, so
   generating per-node content defaults to the tree's language instead
   of English without forcing it.
   `topic` is the tree's subject name, read into state.topic on import.
   Used for the exported filename (instead of a generic one) and quoted
   in each node's own prompt for a little broader context.
═══════════════════════════════════════════════════════════ */
function clearMap() {
  state.nodes.forEach(n => n.el?.remove());
  document.querySelectorAll('.connector').forEach(c=>c.remove());
  state.nodes.clear();
  state.edges.clear();
  state.nextId = 1;
  state.linkSource = null;
  state.language = '';
  state.topic = '';
  state.libraryId = null; // any fresh load starts unlinked; openLibraryEntry() (library.js) re-links it right after, if that's where the load came from
}

/* ── slug helper: used for prompt filenames and round-tripping JSON ids ── */
function slugify(label) {
  const s = String(label || '').toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return s || 'node';
}

function loadFromJSON(obj) {
  if (!obj || !Array.isArray(obj.nodes)) return;
  clearMap();
  state.language = typeof obj.language === 'string' ? obj.language.trim() : '';
  state.topic = typeof obj.topic === 'string' ? obj.topic.trim() : '';

  const idMap = new Map();
  obj.nodes.forEach(n => {
    const numId = state.nextId++;
    idMap.set(String(n.id), numId);
    const node = { id:numId, slug:String(n.id), label:n.label??n.text??'', explanation:typeof n.explanation==='string'?n.explanation.trim():'', optional:!!n.optional, done:!!n.done, depth:0, x:0, y:0, el:null };
    if (typeof n.content === 'string' && n.content.trim()) {
      node._sessionTxt = n.content;
      // Correct answers and their on-screen letters are re-derived (with
      // their own deterministic shuffle) whenever the session is opened —
      // see parseQuestionBody/parseBonusBody in viewer.js. No separate
      // key to extract or stash on the node here anymore.
    }
    state.nodes.set(numId, node);
    buildEl(node);
  });
  obj.nodes.forEach(n => {
    const toId = idMap.get(String(n.id));
    (n.requires||[]).forEach(r => {
      const fromId = idMap.get(String(r));
      if (fromId!=null && toId!=null) addEdge(fromId, toId);
    });
  });

  layout();
  updateAllStatuses();
  resetViewportForTreeLoad();
  removeRedundantEdges();
  autoRestoreProgress();
}

/* Builds the exportable JSON shape from the live state.nodes/state.edges —
   shared by exportToJSON (file download) and library.js (local/cloud
   save), since both just want the same plain-object shape; only what
   happens to the result differs. */
function buildTreeJSON(includeContent) {
  if (!state.nodes.size) return null;
  const idToStr = new Map();
  const used = new Set();
  state.nodes.forEach((n,id)=>{
    const base = n.slug || slugify(n.label);
    let s = base, i = 2;
    while (used.has(s)) s = `${base}_${i++}`;
    used.add(s);
    idToStr.set(id, s);
  });
  const nodes=[];
  state.nodes.forEach((n,id)=>{
    const obj={id:idToStr.get(id), label:n.label};
    if (n.explanation) obj.explanation=n.explanation;
    const reqs=prereqsOf(id).map(p=>idToStr.get(p)).filter(Boolean);
    if (reqs.length) obj.requires=reqs;
    if (n.optional) obj.optional=true;
    if (includeContent && n._sessionTxt) obj.content=n._sessionTxt;
    nodes.push(obj);
  });
  const out = {};
  if (state.topic) out.topic = state.topic;
  if (state.language) out.language = state.language;
  out.nodes = nodes;
  return out;
}

function exportToJSON(includeContent) {
  const out = buildTreeJSON(includeContent);
  if (!out) return;
  const json=JSON.stringify(out,null,2);
  const blob=new Blob([json],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  const filenameBase = state.topic ? slugify(state.topic) : 'progress-tree';
  a.href=url; a.download = includeContent ? `${filenameBase}-with-content.json` : `${filenameBase}.json`; a.click();
  URL.revokeObjectURL(url);
}

document.getElementById('file-input').addEventListener('change', e => {
  const file=e.target.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=ev=>{
    try {
      const obj = JSON.parse(ev.target.result);
      loadFromJSON(obj);
    } catch {}
  };
  reader.readAsText(file);
  e.target.value='';
});
document.getElementById('menu-export-structure').addEventListener('click', () => exportToJSON(false));
document.getElementById('menu-export-content').addEventListener('click', () => exportToJSON(true));
