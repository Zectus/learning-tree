/* ═══════════════════════════════════════════════════════════
   io.js — viewport/pan/zoom, toolbar wiring, JSON import/
   export, progress persistence, and the prompt-generation
   layer (buildPrompt, buildTreePrompt).
   Depends on state.js, layout.js, and nodes.js.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   VIEWPORT
═══════════════════════════════════════════════════════════ */
function applyTransform(animated) {
  const {x,y,scale} = state.viewport;
  const t = `translate(${x}px,${y}px) scale(${scale})`;
  if (animated) {
    const ease = 'transform .38s cubic-bezier(.4,0,.2,1)';
    world.style.transition = svgWorld.style.transition = ease;
    requestAnimationFrame(() => {
      world.style.transform = svgWorld.style.transform = t;
    });
    setTimeout(() => { world.style.transition = svgWorld.style.transition = ''; }, 420);
  } else {
    world.style.transform = svgWorld.style.transform = t;
  }
}

// Centering the viewport and fitting it to loaded content are bundled
// behind ONE entry point and kept out of reach on purpose: this is a
// load-time operation, not a general "recenter the view" utility. The two
// pieces below are closures — nothing outside this IIFE can call them
// directly — so the only way to trigger a viewport reset anywhere in the
// app is through the single function this returns, which has exactly two
// callers: the tree-load path in loadFromJSON(), and the startup IIFE for
// the empty canvas. Nothing else (a toolbar button, a node click, a future
// feature) can reach in and yank a user's pan/zoom out from under them
// mid-session, because there's simply no name left to call.
const resetViewportForTreeLoad = (function () {
  function centerViewport() {
    state.viewport = { x: window.innerWidth/2, y: window.innerHeight/2, scale: 1 };
    applyTransform(true);
  }

  function fitToContent(margin = window.innerWidth < 700 ? 28 : 60) {
    if (state.nodes.size === 0) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(data => {
      const w = nodeW(data.depth);
      const h = nodeH(data.depth);
      minX = Math.min(minX, data.x);
      minY = Math.min(minY, data.y);
      maxX = Math.max(maxX, data.x + w);
      maxY = Math.max(maxY, data.y + h);
    });
    const treeW = maxX - minX;
    const treeH = maxY - minY;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;
    const scale = Math.min(
      (vw - margin * 2) / treeW,
      (vh - margin * 2) / treeH,
      1.0  // never zoom in beyond 100%
    );
    state.viewport = {
      x: (vw - treeW * scale) / 2 - minX * scale,
      y: (vh - treeH * scale) / 2 - minY * scale,
      scale
    };
    applyTransform(true);
  }

  return function resetViewportForTreeLoad() {
    centerViewport();
    fitToContent();
  };
})();

/* ── pan ── */
canvas.addEventListener('mousedown', e => {
  if (e.target.closest('.node')) return;
  cancelLink();
  state.drag = { active:true, startX:e.clientX, startY:e.clientY, ox:state.viewport.x, oy:state.viewport.y };
  canvas.classList.add('dragging');
});
window.addEventListener('mousemove', e => {
  if (!state.drag.active) return;
  state.viewport.x = state.drag.ox + (e.clientX - state.drag.startX);
  state.viewport.y = state.drag.oy + (e.clientY - state.drag.startY);
  applyTransform(false);
});
window.addEventListener('mouseup', () => { state.drag.active=false; canvas.classList.remove('dragging'); });

/* ── zoom ── */
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.07 : 1/1.07;
  const ns = Math.min(10, Math.max(0.01, state.viewport.scale*factor));
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  state.viewport.x = mx - (mx-state.viewport.x)*(ns/state.viewport.scale);
  state.viewport.y = my - (my-state.viewport.y)*(ns/state.viewport.scale);
  state.viewport.scale = ns;
  applyTransform(false);
}, { passive:false });

/* ── touch: one-finger pan, two-finger pinch-zoom ──
   Mirrors the mouse pan/wheel-zoom logic above. `touchState` holds
   whichever gesture is currently active; switching finger count
   mid-gesture (e.g. lifting one finger during a pinch) just restarts
   state for whatever's left, same as picking the gesture up fresh. */
let touchState = null;

function pinchDist(a, b) { return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
function pinchMid(a, b)  { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

canvas.addEventListener('touchstart', e => {
  if (e.target.closest('.node')) { touchState = null; return; }
  cancelLink();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchState = { mode:'pan', x:t.clientX, y:t.clientY, ox:state.viewport.x, oy:state.viewport.y };
  } else if (e.touches.length === 2) {
    const [a,b] = e.touches;
    const mid = pinchMid(a,b);
    touchState = { mode:'pinch', dist:pinchDist(a,b), midX:mid.x, midY:mid.y, scale:state.viewport.scale, vx:state.viewport.x, vy:state.viewport.y };
  }
}, { passive:true });

canvas.addEventListener('touchmove', e => {
  if (!touchState) return;
  if (touchState.mode === 'pan' && e.touches.length === 1) {
    const t = e.touches[0];
    state.viewport.x = touchState.ox + (t.clientX - touchState.x);
    state.viewport.y = touchState.oy + (t.clientY - touchState.y);
    applyTransform(false);
  } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
    const [a,b] = e.touches;
    const dist   = pinchDist(a,b);
    const factor = dist / touchState.dist;
    const ns     = Math.min(10, Math.max(0.01, touchState.scale * factor));
    const rect   = canvas.getBoundingClientRect();
    const mx = touchState.midX - rect.left, my = touchState.midY - rect.top;
    state.viewport.x = mx - (mx - touchState.vx) * (ns / touchState.scale);
    state.viewport.y = my - (my - touchState.vy) * (ns / touchState.scale);
    state.viewport.scale = ns;
    applyTransform(false);
  }
}, { passive:true });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 1) {
    // Dropped from a pinch to one finger — keep going as a pan instead
    // of ending the gesture outright.
    const t = e.touches[0];
    touchState = { mode:'pan', x:t.clientX, y:t.clientY, ox:state.viewport.x, oy:state.viewport.y };
  } else if (e.touches.length === 0) {
    touchState = null;
  }
}, { passive:true });
canvas.addEventListener('touchcancel', () => { touchState = null; }, { passive:true });

/* ── keyboard ── */
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cancelLink(); setMarkKnownMode(false); }
});

/* ═══════════════════════════════════════════════════════════
   TOOLBAR
═══════════════════════════════════════════════════════════ */
document.getElementById('btn-add-node').addEventListener('click', doAddNode);

/* ── dark mode ── */
const DARK_MODE_KEY = 'tree-dark-mode';
const btnDarkMode = document.getElementById('btn-dark-mode');
function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  btnDarkMode.classList.toggle('active', on);
  btnDarkMode.textContent = on ? '☀️ light' : '🌙 dark';
  try { localStorage.setItem(DARK_MODE_KEY, on ? '1' : '0'); } catch {}
}
btnDarkMode.addEventListener('click', () => setDarkMode(!document.body.classList.contains('dark')));
try { setDarkMode(localStorage.getItem(DARK_MODE_KEY) === '1'); } catch { setDarkMode(false); }

const btnMarkKnown = document.getElementById('btn-autocomplete');
function setMarkKnownMode(on) {
  state.markKnownMode = on;
  document.body.classList.toggle('mark-known-mode', on);
  btnMarkKnown.classList.toggle('active', on);
  btnMarkKnown.textContent = on ? '✓ marking known…' : '✓ mark known';
}
btnMarkKnown.addEventListener('click', () => setMarkKnownMode(!state.markKnownMode));

const btnEditMode = document.getElementById('btn-edit-mode');
function applyEditMode() {
  const on = state.editMode;
  document.body.classList.toggle('edit-mode', on);
  btnEditMode.classList.toggle('active', on);
  btnEditMode.textContent = on ? '✏️ editing' : '✏️ edit';
  state.nodes.forEach(node => {
    const t = node.el?.querySelector('.node-text');
    if (t) t.contentEditable = on ? 'true' : 'false';
  });
  if (!on) {
    cancelLink();
    document.activeElement?.blur?.();
    document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
  }
  if (on) setMarkKnownMode(false);
}
btnEditMode.addEventListener('click', () => { state.editMode=!state.editMode; applyEditMode(); });

/* ═══════════════════════════════════════════════════════════
   JSON  import / export
   Format: { "language": "Spanish", "nodes": [{ "id":"a", "label":"...", "requires":["b","c"], "optional":true, "done":false, "content":"..." }] }
   `content` is optional and, when present, is the full generated
   lesson .txt for that node (the same text you'd otherwise upload
   by hand). It's only written when the "Structure + content"
   export option is chosen (see exportToJSON) — plain "structure
   only" exports omit it entirely. On import, a node with `content`
   has it restored straight into node._sessionTxt (and its answer
   key re-parsed from the [KEY: ...] line), so its session can be
   reopened immediately with no re-upload needed.
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
    const node = { id:numId, slug:String(n.id), label:n.label??n.text??'', optional:!!n.optional, done:!!n.done, depth:0, x:0, y:0, el:null };
    if (typeof n.content === 'string' && n.content.trim()) {
      node._sessionTxt = n.content;
      const key = extractAnswerKey(n.content);
      if (key) node._answerKey = key;
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

function exportToJSON(includeContent) {
  if (!state.nodes.size) return;
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
document.getElementById('btn-export').addEventListener('click', e => {
  e.stopPropagation();
  document.getElementById('export-menu').classList.toggle('open');
});
document.getElementById('btn-export-structure').addEventListener('click', () => {
  document.getElementById('export-menu').classList.remove('open');
  exportToJSON(false);
});
document.getElementById('btn-export-content').addEventListener('click', () => {
  document.getElementById('export-menu').classList.remove('open');
  exportToJSON(true);
});
document.addEventListener('click', e => {
  if (!e.target.closest('.export-wrap')) document.getElementById('export-menu').classList.remove('open');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('export-menu').classList.remove('open');
});

/* Touch devices have no :hover, so a node's action row (link/optional/
   delete/delete-txt) is opened by tapping a small "⋯" toggle instead
   (see buildEl in nodes.js) rather than always showing them, which would
   bring back the "always fat" problem hover-only expansion was meant to
   fix. Tapping anywhere outside the open node — or Escape — closes it. */
document.addEventListener('click', e => {
  if (e.target.closest('.node.actions-open')) return;
  document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
});

/* ═══════════════════════════════════════════════════════════
   PROGRESS  save / load / auto-save
   Storage is per-node: each node (keyed by label, under a
   per-tree signature) gets its own record — done flag, session
   quiz answers, bonus answers, the fallback answer key, and any
   notes — restored independently so nodes never share or
   clobber each other's state.
   • Auto-save: written to localStorage on every relevant change
     (done toggle, answering a question, editing notes) — this
     is the only save path, there is no manual save button.
   • Auto-restore: applied silently when a tree is loaded.
   • JSON export no longer carries done flags (see exportToJSON)
     — progress lives only in localStorage now.
═══════════════════════════════════════════════════════════ */
const PROGRESS_KEY = 'tree-progress';

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

/* Serializes every current node into its own keyed record under this
   tree's signature. Called on any change worth remembering — a done
   toggle, a quiz answer, a notes edit — so "where you are" in a node's
   session (and its notes) is never lost while working through a tree. */
function autoSaveProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const perNode = {};
    state.nodes.forEach(node => {
      perNode[node.label] = {
        done:           !!node.done,
        sessionAnswers: node._sessionAnswers || undefined,
        bonusAnswers:   node._bonusAnswers   || undefined,
        answerKey:      node._answerKey      || undefined,
        notes:          node._notes          || undefined,
        scrollTop:      node._scrollTop,
      };
    });
    all[treeSignature()] = perNode;
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
  } catch {}
}

/** Restores each node's own record independently (done flag, session
    answers, notes, scroll position). */
function autoRestoreProgress() {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    const saved = all[treeSignature()];
    if (!saved) return;
    let changed = false;
    state.nodes.forEach(node => {
      const rec = saved[node.label];
      if (!rec) return;
      if (rec.done) { node.done = true; changed = true; }
      if (rec.sessionAnswers) node._sessionAnswers = rec.sessionAnswers;
      if (rec.bonusAnswers)   node._bonusAnswers   = rec.bonusAnswers;
      if (rec.answerKey)      node._answerKey      = rec.answerKey;
      if (rec.notes)          node._notes          = rec.notes;
      if (rec.scrollTop != null) node._scrollTop   = rec.scrollTop;
    });
    if (changed) updateAllStatuses();
  } catch {}
}

/* Reset progress — clears the persisted record(s) plus the matching
   in-memory fields on every node, so the effect is immediate without a
   reload. Plain click: this tree only. Shift+click (or a long-press,
   for touch where there's no Shift key to hold): every tree ever
   saved. No confirmation dialog on purpose — mark-known mode already
   lets you freely toggle any node's done state with no safeguard, so
   this isn't introducing a new class of "undoable" risk. */
const btnResetProgress = document.getElementById('btn-reset-progress');
document.addEventListener('keydown', e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ reset ALL progress'; });
document.addEventListener('keyup',   e => { if (e.key === 'Shift') btnResetProgress.textContent = '↺ reset tree progress'; });

let resetAllArmed = false, resetPressTimer = null;
btnResetProgress.addEventListener('touchstart', () => {
  resetPressTimer = setTimeout(() => {
    resetAllArmed = true;
    btnResetProgress.textContent = '↺ reset ALL progress';
    if (navigator.vibrate) navigator.vibrate(15);
  }, 550);
}, { passive:true });
btnResetProgress.addEventListener('touchend', () => clearTimeout(resetPressTimer), { passive:true });
btnResetProgress.addEventListener('touchcancel', () => {
  clearTimeout(resetPressTimer);
  resetAllArmed = false;
  btnResetProgress.textContent = '↺ reset tree progress';
}, { passive:true });

function clearNodeProgressFields(node) {
  node.done = false;
  delete node._sessionAnswers;
  delete node._bonusAnswers;
  delete node._answerKey;
  delete node._notes;
  delete node._scrollTop;
}

btnResetProgress.addEventListener('click', e => {
  const resetAll = e.shiftKey || resetAllArmed;
  resetAllArmed = false;
  if (resetAll) {
    try { localStorage.removeItem(PROGRESS_KEY); } catch {}
    state.nodes.forEach(clearNodeProgressFields);
  } else {
    try {
      const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
      delete all[treeSignature()];
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(all));
    } catch {}
    state.nodes.forEach(clearNodeProgressFields);
  }
  btnResetProgress.textContent = '↺ reset tree progress';
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

/* ═══════════════════════════════════════════════════════════
   LEARN SYSTEM — computes the per-node values (answer key bank,
   prerequisite context) and hands them to renderNodePrompt(),
   defined in node-prompt.js, which holds the actual prompt text.
   Answer verification lives further down, in the SESSION VIEWER
   section.
═══════════════════════════════════════════════════════════ */

/* ── a long, fixed-length bank of candidate answers. The document only
   ever uses a prefix of this (see the ANSWER KEY section of the prompt
   in node-prompt.js) — a generous constant length comfortably covers
   even a very question-dense node without ever running out, while
   leaving the actual question count entirely up to the model. ── */
const ANSWER_BANK_SIZE = 40;
function randomAnswerKey(n = ANSWER_BANK_SIZE) {
  const letters = ['A','B','C','D','E'];
  return Array.from({length:n}, () => letters[Math.floor(Math.random()*5)]);
}

/* ── compute prompt inputs for this node, then render ── */
function buildPrompt(id, language) {
  const node       = state.nodes.get(id);
  const topic      = node.label;
  const nodeId     = node.slug || slugify(node.label);
  const answers    = randomAnswerKey();

  // store for verification (fallback if the uploaded file's key line ever
  // fails to parse). This is the full bank, not the trimmed count the
  // model actually ends up using — fine as a last-resort fallback, since
  // the normal path reads the real (shorter) key straight off the file.
  node._answerKey  = answers;

  const prereqs    = prereqsOf(id).map(pid => state.nodes.get(pid)?.label).filter(Boolean);
  const dependents = dependentsOf(id).map(pid => state.nodes.get(pid)?.label).filter(Boolean);
  const doneNodes  = [...state.nodes.values()].filter(n => n.done && n.id !== id).map(n => n.label);

  const prereqLine  = prereqs.length    ? `The reader has already been through, earlier in this sequence: ${prereqs.join(', ')}. Refer back to this the way one lesson naturally refers to an earlier one — "recall that...", "as seen when X was introduced...", "earlier, we found..." — rather than the word "prerequisite," which reads like a syllabus line rather than something anyone would actually say.` : `This is the first topic in the sequence — there is nothing earlier to refer back to.`;
  const leadsToLine = dependents.length ? `Material the reader hasn't seen yet will build on this one afterward: ${dependents.join(', ')}. Don't teach toward it or mention it by name here.` : '';
  const contextLine = doneNodes.length  ? `The reader has also separately already been through: ${doneNodes.join(', ')}.` : '';
  const treeTopicLine = state.topic ? `This node belongs to a larger tree on ${state.topic}.` : '';
  const plainKey    = answers.map((a,i)=>`${i+1}${a}`).join(' ');
  const lang = language || 'English';
  const languageClause = `\nLANGUAGE\nWrite the entire document in ${lang} — every section title, all prose, every question, and every answer option. The structural markup a parser reads must stay exactly as specified above, in this literal form, regardless of language: "=== SECTION N: " and the closing "===" wrapping each section title (translate the title itself, not the wrapper), "[QUESTION N]" / "[/QUESTION]", the option markers "(A)" through "(E)", the final "[KEY: ...]" line, "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", and "[BONUS N]" / "[ANSWER: X]" / "[/BONUS]". Only the human-readable content moves to ${lang} — none of that markup does.\n`;

  return renderNodePrompt({ topic, nodeId, plainKey, prereqLine, leadsToLine, contextLine, treeTopicLine, languageClause });
}

/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — a separate flow from the per-node
   lesson prompt above; generates a prompt for designing a
   whole new prerequisite tree. The actual prompt text lives
   in tree-prompt.js, via renderTreePrompt().
═══════════════════════════════════════════════════════════ */
function buildTreePrompt(topic, startPoint, language) {
  const fileSlug = slugify(topic);
  const startClause = startPoint
    ? `\n\nAssume the person already knows everything up through: ${startPoint}. Don't include nodes for material at or before that point — the tree should start from genuinely new material just past it, with root nodes representing the first new things someone would learn next.`
    : '';
  const lang = language || 'English';
  const languageClause = `\n\nLANGUAGE\nWrite every node's "label" value in ${lang}. Keep "id" slugs in plain lowercase ASCII snake_case regardless of language — they're internal wiring only, never shown to anyone, so there's nothing to gain by translating or transliterating them. Also set the top-level "language" field in your output to "${lang}" verbatim (see OUTPUT SCHEMA).`;

  return renderTreePrompt({ topic, fileSlug, startClause, languageClause });
}

/* ── modal state ── */
let _modalNodeId = null;

function openLearnModal(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  _modalNodeId = id;
  const languageInput = document.getElementById('node-language-input');
  // Default to the tree's own language (if it has one) instead of English
  // whenever the field is currently empty — still just a prefill, so the
  // person can clear or override it for this one node if they want.
  if (!languageInput.value.trim() && state.language) languageInput.value = state.language;
  const language = languageInput.value.trim();
  const prompt = buildPrompt(id, language);

  document.getElementById('modal-title').textContent = node.label;
  document.getElementById('modal-meta').textContent =
    `${prereqsOf(id).length} prerequisite${prereqsOf(id).length!==1?'s':''} · copy prompt → paste into Claude → upload the .txt file`;
  document.getElementById('prompt-box').value = prompt;
  resetCopyButton('btn-copy-prompt');
  document.getElementById('modal-backdrop').classList.add('open');
}

document.getElementById('node-language-input').addEventListener('input', () => {
  if (_modalNodeId === null) return;
  const language = document.getElementById('node-language-input').value.trim();
  document.getElementById('prompt-box').value = buildPrompt(_modalNodeId, language);
  resetCopyButton('btn-copy-prompt');
});

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  _modalNodeId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
});

/* ── create-tree modal ── */
function updateTreePromptPreview() {
  const topic = document.getElementById('tree-topic-input').value.trim();
  const startPoint = document.getElementById('tree-start-input').value.trim();
  const language = document.getElementById('tree-language-input').value.trim();
  document.getElementById('tree-prompt-box').value = topic
    ? buildTreePrompt(topic, startPoint, language)
    : 'Fill in a topic above to generate the prompt.';
}

function openTreeModal() {
  updateTreePromptPreview();
  document.getElementById('tree-modal-backdrop').classList.add('open');
  document.getElementById('tree-topic-input').focus();
}

function closeTreeModal() {
  document.getElementById('tree-modal-backdrop').classList.remove('open');
}

document.getElementById('btn-create-tree').addEventListener('click', openTreeModal);
document.getElementById('tree-modal-close').addEventListener('click', closeTreeModal);
document.getElementById('tree-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('tree-modal-backdrop')) closeTreeModal();
});
document.getElementById('tree-topic-input').addEventListener('input', updateTreePromptPreview);
document.getElementById('tree-start-input').addEventListener('input', updateTreePromptPreview);
document.getElementById('tree-language-input').addEventListener('input', updateTreePromptPreview);

document.getElementById('tree-json-input').addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const obj = JSON.parse(ev.target.result);
      loadFromJSON(obj);
      if (!state.topic) state.topic = document.getElementById('tree-topic-input').value.trim();
      closeTreeModal();
    } catch {}
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (document.getElementById('tree-modal-backdrop').classList.contains('open')) closeTreeModal();
  else closeModal();
});

/* ── copy buttons (shared by both modals) ── */
function resetCopyButton(btnId) {
  const btn = document.getElementById(btnId);
  btn.textContent = 'copy';
  btn.classList.remove('copied');
}
function wireCopyButton(btnId, taId) {
  document.getElementById(btnId).addEventListener('click', () => {
    const ta = document.getElementById(taId);
    const onCopied = () => {
      const btn = document.getElementById(btnId);
      btn.textContent = 'copied ✓';
      btn.classList.add('copied');
      setTimeout(() => resetCopyButton(btnId), 2000);
    };
    const fallbackCopy = () => {
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      if (ok) onCopied();
    };
    // The async Clipboard API needs a secure context; this app is meant to
    // run from file://, where it's frequently unavailable or blocked
    // (Firefox refuses it outright on file://). Fall back to the older
    // selection-based copy instead of failing silently.
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(ta.value).then(onCopied).catch(fallbackCopy);
    } else {
      fallbackCopy();
    }
  });
}
wireCopyButton('btn-copy-prompt', 'prompt-box');
wireCopyButton('btn-copy-tree-prompt', 'tree-prompt-box');

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
(function init() {
  resetViewportForTreeLoad();
  // Load a JSON via the 📂 button to get started.
})();

