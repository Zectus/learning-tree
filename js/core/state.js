/* ═══════════════════════════════════════════════════════════
   state.js — shared state object, DOM refs, edge helpers.
   Script load order is defined in index.html; this file loads first
   among the app's own scripts and everything else reads from it.
═══════════════════════════════════════════════════════════ */
const state = {
  nodes:      new Map(),  // id → { id, label, explanation, optional, done, depth, x, y, el }
  edges:      new Set(),  // "fromId→toId" (prereq → dependent) — canonical key set, also the DOM key for connector paths
  prereqs:    new Map(),  // id → Set of prerequisite ids (adjacency, kept in sync by the edge helpers below)
  dependents: new Map(),  // id → Set of dependent ids
  nextId:     1,
  viewport:   { x: 0, y: 0, scale: 1 },
  drag:       { active: false, startX: 0, startY: 0, ox: 0, oy: 0 },
  mode:       'browse',   // 'browse' | 'edit' | 'markKnown' — mutually exclusive by construction
  linkSource: null,
  language:   '',   // tree-wide default language from a loaded tree; prefills each node's language field
  topic:      '',   // tree-wide subject name; used for the export filename and quoted in each node's prompt
  libraryId:  null, // "My Trees" entry the current tree was opened from (library.js); reset by clearMap(), re-linked by openLibraryEntry()
  accountUser: null, // { uid, email, username } when signed in (account.js), else null; set only by applyAccountUser()
};

const canvas   = document.getElementById('canvas');
const world    = document.getElementById('world');
const svgWorld = document.getElementById('svg-world');
const progBar  = document.getElementById('progress-bar');

/* ── edge helpers ──
   Always go through these; they keep state.edges and both adjacency maps
   consistent, so prereqsOf/dependentsOf are lookups instead of re-parsing keys. */
function edgeKey(f, t) { return `${f}→${t}`; }
function adjacency(map, id) {
  let s = map.get(id);
  if (!s) map.set(id, s = new Set());
  return s;
}
function addEdge(f, t) {
  state.edges.add(edgeKey(f, t));
  adjacency(state.dependents, f).add(t);
  adjacency(state.prereqs, t).add(f);
}
function hasEdge(f, t) { return state.edges.has(edgeKey(f, t)); }
function removeEdge(f, t) {
  state.edges.delete(edgeKey(f, t));
  state.dependents.get(f)?.delete(t);
  state.prereqs.get(t)?.delete(f);
}
function clearEdges() {
  state.edges.clear();
  state.prereqs.clear();
  state.dependents.clear();
}
function prereqsOf(id)    { return [...(state.prereqs.get(id) ?? [])]; }
function dependentsOf(id) { return [...(state.dependents.get(id) ?? [])]; }
function removeEdgesOf(id) {
  prereqsOf(id).forEach(p => removeEdge(p, id));
  dependentsOf(id).forEach(d => removeEdge(id, d));
}
function forEachEdge(fn) { // fn(fromId, toId, key)
  state.dependents.forEach((set, f) => set.forEach(t => fn(f, t, edgeKey(f, t))));
}
