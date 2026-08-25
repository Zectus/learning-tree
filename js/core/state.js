/* ═══════════════════════════════════════════════════════════
   state.js — shared state object, DOM refs, edge helpers.
   Loads first; everything else reads from here.
   Load order: state.js → layout.js → nodes.js → io.js → viewer.js
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   STATE
═══════════════════════════════════════════════════════════ */
const state = {
  nodes:         new Map(),  // id → { id, label, optional, done, depth, x, y, el }
  edges:         new Set(),  // "fromId→toId"  (prereq → dependent)
  nextId:        1,
  viewport:      { x: 0, y: 0, scale: 1 },
  drag:          { active: false, startX: 0, startY: 0, ox: 0, oy: 0 },
  editMode:      false,
  markKnownMode: false,
  linkSource:    null,
  language:      '',   // tree-wide default language (from a loaded tree's "language" field, if any) — used to prefill each node's own language field when it's left blank
  topic:         '',   // tree-wide subject name (from a loaded tree's "topic" field, if any) — used for the export filename and mentioned in each node's prompt for context
  libraryId:     null, // id of the "My Trees" entry (library.js) the current tree was opened from, if any — lets "save" update that entry instead of always creating a new one. Reset to null by clearMap() on every load; re-linked explicitly by openLibraryEntry().
  accountUser:   null, // { uid, email } of the signed-in account (account.js/cloud.js), or null when signed out — this is what decides whether library.js reads "My Trees" from localStorage or from the cloud. Set only by window.handleCloudAuthChange, never directly.
};

/* ═══════════════════════════════════════════════════════════
   DOM
═══════════════════════════════════════════════════════════ */
const canvas   = document.getElementById('canvas');
const world    = document.getElementById('world');
const svgWorld = document.getElementById('svg-world');
const progBar  = document.getElementById('progress-bar');

/* ═══════════════════════════════════════════════════════════
   EDGE HELPERS
═══════════════════════════════════════════════════════════ */
function edgeKey(f, t)    { return `${f}→${t}`; }
function addEdge(f, t)    { state.edges.add(edgeKey(f, t)); }
function hasEdge(f, t)    { return state.edges.has(edgeKey(f, t)); }
function removeEdge(f, t) { state.edges.delete(edgeKey(f, t)); }

function prereqsOf(id) {
  const out = [];
  for (const k of state.edges) { const [f,t]=k.split('→').map(Number); if(t===id) out.push(f); }
  return out;
}
function dependentsOf(id) {
  const out = [];
  for (const k of state.edges) { const [f,t]=k.split('→').map(Number); if(f===id) out.push(t); }
  return out;
}
