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


