/* ═══════════════════════════════════════════════════════════
   viewer.js — session viewer: .txt parsing, question UI,
   answer-click handling, score tracking, drag/resize.
   Depends on state.js, layout.js, io.js.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   SESSION VIEWER
═══════════════════════════════════════════════════════════ */
const viewer = { nodeId: null, answers: new Map(), score: 0, total: 0, answerKey: [], bonusAnswers: new Map(), bonusKeys: new Map(), checkpoints: [] };

/* ── Session progress bar ──────
   "Progress" is scroll position through the lesson, rescaled so the last
   question's position is 100%. Each question is a "checkpoint" at its own
   rescaled position; a checkpoint completes when that question is answered
   (right or wrong). The bar's fill is clamped between the last checkpoint
   completed *in order* and the next one still to come — so it tracks raw
   scrolling within that window, but can't run ahead of an unanswered
   question, and answering questions out of order (e.g. Q3 before Q2)
   doesn't advance it past Q1. */
function computeCheckpoints() {
  const body = document.getElementById('sv-body');
  const bodyRect = body.getBoundingClientRect();
  viewer.checkpoints = [...body.querySelectorAll('.q-card[data-qn]')]
    .map(el => ({
      qn:  parseInt(el.dataset.qn),
      top: el.getBoundingClientRect().top - bodyRect.top + body.scrollTop
    }))
    .sort((a, b) => a.qn - b.qn);
  renderCheckpointDots();
}
function renderCheckpointDots() {
  const wrap = document.getElementById('sv-progress-checkpoints');
  wrap.innerHTML = '';
  const cps = viewer.checkpoints;
  if (!cps.length) return;
  const lastTop = cps[cps.length - 1].top || 1;
  cps.forEach(cp => {
    const dot = document.createElement('div');
    dot.className = 'sv-checkpoint';
    dot.dataset.qn = cp.qn;
    dot.style.left = Math.min(100, (cp.top / lastTop) * 100) + '%';
    wrap.appendChild(dot);
  });
}
function updateSessionProgress() {
  const cps = viewer.checkpoints;
  const bar = document.getElementById('sv-progress-bar');
  if (!cps.length) { bar.style.width = '0%'; return; }
  const lastTop = cps[cps.length - 1].top || 1;
  const body = document.getElementById('sv-body');
  const raw  = Math.min(100, (body.scrollTop / lastTop) * 100);

  let lastDoneIdx = -1;
  for (let i = 0; i < cps.length; i++) {
    if (viewer.answers.has(cps[i].qn)) lastDoneIdx = i; else break;
  }
  const floorPct = lastDoneIdx >= 0 ? Math.min(100, (cps[lastDoneIdx].top / lastTop) * 100) : 0;
  const nextIdx  = lastDoneIdx + 1;
  const ceilPct  = nextIdx < cps.length ? Math.min(100, (cps[nextIdx].top / lastTop) * 100) : 100;

  bar.style.width = Math.min(ceilPct, Math.max(floorPct, raw)) + '%';

  document.querySelectorAll('#sv-progress-checkpoints .sv-checkpoint').forEach(dot => {
    dot.classList.toggle('done', viewer.answers.has(parseInt(dot.dataset.qn)));
  });
}

/* ── Key extraction ──────
   Requires every token to be <digits><single letter A-E>. A key line
   from a stale or hand-edited file that doesn't match this exactly is
   rejected outright (returns null) rather than partially parsed —
   letters outside A-E should never reach the UI as a "correct answer". */
function extractAnswerKey(raw) {
  const m = raw.match(/\[KEY:\s*([^\]]+)\]/i);
  if (!m) return null;
  const tokens = m[1].trim().split(/\s+/);
  const key = [];
  for (const tok of tokens) {
    const tm = tok.match(/^(\d+)([A-E])$/i);
    if (!tm) return null;
    key.push(tm[2].toUpperCase());
  }
  return key.length ? key : null;
}
function stripKeyLine(raw) { return raw.replace(/\[KEY:[^\]]+\]/gi, ''); }

/* Collapses newlines inside \[...\] and \(...\) math spans into a single
   space, before any paragraph/line splitting happens. renderProse() (see
   below) splits prose into paragraphs on blank lines and turns every
   remaining newline into <br> — either of those slices a multi-line
   display equation into separate DOM text nodes, and KaTeX's auto-render
   only matches delimiters within a single text node, so a display block
   written across multiple lines (the normal way to write anything but
   the shortest expression) would render as broken, unrendered raw LaTeX
   instead of typeset math. Collapsing here, once, centrally, before
   parseTxtSession does any splitting, means every block downstream —
   prose, questions, bonuses, table cells, timeline entries — is already
   a single line by the time paragraph/line splitting ever sees it. */
function collapseMathNewlines(raw) {
  return raw
    .replace(/\\\[[\s\S]*?\\\]/g, m => m.replace(/\s*\n\s*/g, ' '))
    .replace(/\\\([\s\S]*?\\\)/g, m => m.replace(/\s*\n\s*/g, ' '));
}

/* ── Parser ────── */
function parseTxtSession(raw) {
  raw = collapseMathNewlines(raw);
  const questions = new Map(), bonuses = new Map(), tables = new Map(), timelines = new Map();
  let cleaned = raw.replace(/\[QUESTION\s+(\d+)\]([\s\S]*?)\[\/QUESTION\]/gi, (_, n, body) => {
    questions.set(parseInt(n), parseQuestionBody(parseInt(n), body));
    return `\x00Q:${n}\x00`;
  });
  cleaned = cleaned.replace(/\[BONUS\s+(\d+)\]([\s\S]*?)\[\/BONUS\]/gi, (_, n, body) => {
    bonuses.set(parseInt(n), parseBonusBody(parseInt(n), body));
    return '';  // bonus blocks removed from main flow
  });
  let tableId = 0;
  cleaned = cleaned.replace(/\[TABLE\]([\s\S]*?)\[\/TABLE\]/gi, (_, body) => {
    const id = ++tableId;
    tables.set(id, parseTableBody(body));
    return `\x00T:${id}\x00`;
  });
  let timelineId = 0;
  cleaned = cleaned.replace(/\[TIMELINE\]([\s\S]*?)\[\/TIMELINE\]/gi, (_, body) => {
    const id = ++timelineId;
    timelines.set(id, parseTimelineBody(body));
    return `\x00L:${id}\x00`;
  });
  const parts = cleaned.split(/^===\s*SECTION\s+(\d+)[:.]\s*(.+?)\s*===/im);
  const sections = [];
  for (let i = 1; i < parts.length; i += 3)
    sections.push({ num: parts[i], title: parts[i+1].trim(), body: (parts[i+2] || '').trim() });
  return { sections, questions, bonuses, tables, timelines };
}
/* [TABLE] rows are "cell | cell | cell" — first row is the header. */
function parseTableBody(raw) {
  const rows = raw.split('\n').map(l => l.trim()).filter(Boolean)
    .map(line => line.split('|').map(cell => cell.trim()));
  const [header, ...body] = rows;
  return { header: header || [], rows: body };
}
/* [TIMELINE] rows are "marker | description" — marker is often a date/year
   but can be any short label (a stage name, "Step 1", etc). */
function parseTimelineBody(raw) {
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
    const i = line.indexOf('|');
    return i === -1 ? { marker: '', text: line } : { marker: line.slice(0, i).trim(), text: line.slice(i + 1).trim() };
  });
}
function parseQuestionBody(n, raw) {
  const lines = raw.split('\n'), options = {}, textLines = [];
  for (const line of lines) {
    const m = line.match(/^\(([A-Ea-e])\)\s+(.*)/);
    if (m) options[m[1].toUpperCase()] = m[2].trim();
    else   textLines.push(line);
  }
  return { n, text: textLines.join('\n').trim(), options };
}
function parseBonusBody(n, raw) {
  const ansM = raw.match(/\[ANSWER:\s*([A-Ea-e])\]/i);
  const answer = ansM ? ansM[1].toUpperCase() : null;
  const cleaned = raw.replace(/\[ANSWER:[^\]]+\]/gi, '');
  const lines = cleaned.split('\n'), options = {}, textLines = [];
  for (const line of lines) {
    const m = line.match(/^\(([A-Ea-e])\)\s+(.*)/);
    if (m) options[m[1].toUpperCase()] = m[2].trim();
    else   textLines.push(line);
  }
  return { n, text: textLines.join('\n').trim(), options, answer };
}

/* ── Renderer ────── */
function svEsc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function renderProse(text) {
  return text.split(/\n{2,}/).map(c=>c.trim()).filter(Boolean)
    .map(c=>`<p>${svEsc(c).replace(/\n/g,'<br>')}</p>`).join('');
}
function renderQuestionCard(q) {
  const opts = ['A','B','C','D','E'].filter(l => q.options[l] !== undefined)
    .map(l => `<button class="q-opt" data-qn="${q.n}" data-letter="${l}">
      <span class="q-letter">${l}</span><span class="q-text">${svEsc(q.options[l])}</span>
    </button>`).join('');
  return `<div class="q-card" data-qn="${q.n}">
    <div class="q-num">Question ${q.n}</div>
    <div class="q-body">${renderProse(q.text)}</div>
    <div class="q-opts">${opts}</div>
    <div class="q-feedback" id="qfb-${q.n}"></div>
  </div>`;
}
function renderTable(t) {
  const head = t.header.length ? `<thead><tr>${t.header.map(h => `<th>${svEsc(h)}</th>`).join('')}</tr></thead>` : '';
  const body = t.rows.map(r => `<tr>${r.map(c => `<td>${svEsc(c)}</td>`).join('')}</tr>`).join('');
  return `<div class="sv-table-wrap"><table class="sv-table">${head}<tbody>${body}</tbody></table></div>`;
}
function renderTimeline(items) {
  const rows = items.map(it => `<div class="sv-tl-item">
    <div class="sv-tl-dot"></div>
    <div class="sv-tl-content"><div class="sv-tl-marker">${svEsc(it.marker)}</div><div class="sv-tl-text">${svEsc(it.text)}</div></div>
  </div>`).join('');
  return `<div class="sv-timeline">${rows}</div>`;
}
function renderSession(parsed) {
  return parsed.sections.map(sec => {
    const parts = sec.body.split(/\x00(Q|T|L):(\d+)\x00/);
    let inner = '';
    for (let i = 0; i < parts.length; i += 3) {
      const plain = parts[i];
      if (plain && plain.trim()) inner += `<div class="sv-prose">${renderProse(plain.trim())}</div>`;
      const type = parts[i+1], id = parseInt(parts[i+2]);
      if      (type === 'Q') { const q = parsed.questions.get(id); if (q) inner += renderQuestionCard(q); }
      else if (type === 'T') { const t = parsed.tables.get(id);    if (t) inner += renderTable(t); }
      else if (type === 'L') { const l = parsed.timelines.get(id); if (l) inner += renderTimeline(l); }
    }
    return `<div class="sv-section"><div class="sv-section-label">Section ${sec.num}</div><div class="sv-section-title">${svEsc(sec.title)}</div>${inner}</div>`;
  }).join('');
}
function buildBonusSection(bonuses) {
  if (!bonuses.size) return '';
  const nums = [...bonuses.keys()].sort((a,b)=>a-b);
  const cards = nums.map(n => {
    const b = bonuses.get(n);
    const opts = ['A','B','C','D','E'].filter(l => b.options[l] !== undefined)
      .map(l => `<button class="q-opt" data-bn="${b.n}" data-letter="${l}">
        <span class="q-letter">${l}</span><span class="q-text">${svEsc(b.options[l])}</span>
      </button>`).join('');
    return `<div class="q-card" data-bn="${b.n}">
      <div class="q-num">Bonus ${b.n}</div>
      <div class="q-body">${renderProse(b.text)}</div>
      <div class="q-opts">${opts}</div>
      <div class="q-feedback" id="bfb-${b.n}"></div>
    </div>`;
  }).join('');
  return `<details id="sv-recap">
    <summary><span class="recap-arrow">▶</span> Bonus Practice — ${nums.length} extra question${nums.length!==1?'s':''}</summary>
    <div id="sv-recap-body">${cards}</div>
  </details>`;
}

function applyAnswer(qn, letter, correct) {
  viewer.answers.set(qn, letter);
  if (letter === correct) viewer.score++;
  document.querySelectorAll(`.q-card[data-qn="${qn}"]`).forEach(card => {
    card.querySelectorAll('.q-opt').forEach(b => {
      b.disabled = true;
      if (b.dataset.letter === correct) b.classList.add('q-correct');
      if (b.dataset.letter === letter && letter !== correct) b.classList.add('q-wrong');
    });
    const fb = card.querySelector('.q-feedback');
    if (fb) { fb.textContent = letter === correct ? '✓ Correct' : `✗  Correct answer: ${correct}`; fb.className = 'q-feedback ' + (letter === correct ? 'fb-correct' : 'fb-wrong'); }
  });
}
function handleOptionClick(btn) {
  const qn = parseInt(btn.dataset.qn), letter = btn.dataset.letter;
  if (viewer.answers.has(qn)) return;
  const correct = viewer.answerKey[qn - 1];
  const node = state.nodes.get(viewer.nodeId);
  if (node) { if (!node._sessionAnswers) node._sessionAnswers = {}; node._sessionAnswers[qn] = letter; }
  applyAnswer(qn, letter, correct);
  updateViewerScore();
  computeCheckpoints();
  updateSessionProgress();
  // Auto-complete: all main questions answered → mark topic done (good faith)
  if (viewer.answers.size === viewer.total) {
    if (node && !node.done) { node.done = true; updateAllStatuses(); autoSaveProgress(); }
  }
}
function handleBonusClick(btn) {
  const bn = parseInt(btn.dataset.bn), letter = btn.dataset.letter;
  if (viewer.bonusAnswers.has(bn)) return;
  const correct = viewer.bonusKeys.get(bn);
  viewer.bonusAnswers.set(bn, letter);
  const node = state.nodes.get(viewer.nodeId);
  if (node) { if (!node._bonusAnswers) node._bonusAnswers = {}; node._bonusAnswers[bn] = letter; }
  document.querySelectorAll(`.q-card[data-bn="${bn}"]`).forEach(card => {
    card.querySelectorAll('.q-opt').forEach(b => {
      b.disabled = true;
      if (b.dataset.letter === correct) b.classList.add('q-correct');
      if (b.dataset.letter === letter && letter !== correct) b.classList.add('q-wrong');
    });
    const fb = card.querySelector('.q-feedback');
    if (fb) { fb.textContent = letter === correct ? '✓ Correct' : `✗  Correct answer: ${correct}`; fb.className = 'q-feedback ' + (letter === correct ? 'fb-correct' : 'fb-wrong'); }
  });
}
function updateViewerScore() {
  const badge = document.getElementById('sv-score'); if (!badge) return;
  badge.textContent = viewer.total > 0 ? `${viewer.score} / ${viewer.total} correct` : '— / —';
  badge.classList.toggle('sv-perfect', viewer.answers.size === viewer.total && viewer.total > 0 && viewer.score === viewer.total);
}

/* ── Open / Close ────── */
function openViewer(txtContent, nodeId) {
  const node = state.nodes.get(nodeId);
  viewer.answerKey = extractAnswerKey(txtContent) || node?._answerKey || [];
  if (!viewer.answerKey.length) return;

  if (node) node._sessionTxt = txtContent;

  viewer.nodeId = nodeId; viewer.answers = new Map(); viewer.score = 0; viewer.total = viewer.answerKey.length;
  viewer.bonusAnswers = new Map(); viewer.bonusKeys = new Map(); viewer.checkpoints = [];
  document.getElementById('sv-topic').textContent = node?.label ?? 'Session';

  const body   = document.getElementById('sv-body');
  const parsed = parseTxtSession(stripKeyLine(txtContent));

  // Populate bonus answer keys
  parsed.bonuses.forEach((b, n) => { if (b.answer) viewer.bonusKeys.set(n, b.answer); });

  body.innerHTML = renderSession(parsed) + buildBonusSection(parsed.bonuses);
  if (window.renderMathInElement) renderMathInElement(body, { delimiters: [{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}], throwOnError: false });

  body.querySelectorAll('.q-opt[data-qn]').forEach(btn => btn.addEventListener('click', () => handleOptionClick(btn)));
  body.querySelectorAll('.q-opt[data-bn]').forEach(btn => btn.addEventListener('click', () => handleBonusClick(btn)));

  // Restore saved answers
  const saved = node?._sessionAnswers || {};
  for (const [qn, letter] of Object.entries(saved))
    applyAnswer(parseInt(qn), letter, viewer.answerKey[qn - 1]);

  // Restore saved bonus answers
  const savedBonus = node?._bonusAnswers || {};
  for (const [bn, letter] of Object.entries(savedBonus)) {
    const bni = parseInt(bn);
    viewer.bonusAnswers.set(bni, letter);
    const correct = viewer.bonusKeys.get(bni);
    document.querySelectorAll(`.q-card[data-bn="${bni}"]`).forEach(card => {
      card.querySelectorAll('.q-opt').forEach(b => {
        b.disabled = true;
        if (b.dataset.letter === correct) b.classList.add('q-correct');
        if (b.dataset.letter === letter && letter !== correct) b.classList.add('q-wrong');
      });
      const fb = card.querySelector('.q-feedback');
      if (fb) { fb.textContent = letter === correct ? '✓ Correct' : `✗  Correct answer: ${correct}`; fb.className = 'q-feedback ' + (letter === correct ? 'fb-correct' : 'fb-wrong'); }
    });
  }

  updateViewerScore();

  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('session-viewer').classList.add('sv-open');

  // Must measure AFTER the viewer is visible: while #session-viewer still
  // had display:none, #sv-window's offsetWidth/offsetHeight both read as 0
  // (a hidden ancestor means nothing inside it is laid out yet), which
  // silently turned "center the window" into "pin its top-left corner to
  // screen-center" — the window ended up shifted toward the bottom-right
  // by roughly half its own size instead of actually centered.
  const win = document.getElementById('sv-window');
  win.style.left = Math.max(0, (window.innerWidth  - win.offsetWidth)  / 2) + 'px';
  win.style.top  = Math.max(0, (window.innerHeight - win.offsetHeight) / 2) + 'px';

  // Resume this node's own reading position rather than always starting at
  // the top — restored per node, so switching to a different node's
  // session and back doesn't leave you scrolled to wherever that other
  // node happened to be.
  body.scrollTop = node?._scrollTop || 0;

  // Must also come after the viewer is visible, for the same
  // display:none/getBoundingClientRect reason as the centering above.
  computeCheckpoints();
  updateSessionProgress();

  loadNotesForCurrentNode();
  syncNotesPanelPosition();
}

// Reopen a session for this node. If the viewer is already showing this
// exact node, just re-reveal it (preserves scroll position). Otherwise
// rebuild for the requested node — each node has its own saved progress.
function continueViewer(nodeId) {
  const node = state.nodes.get(nodeId);
  if (!node?._sessionTxt) return;
  document.getElementById('modal-backdrop').classList.remove('open');
  if (viewer.nodeId === nodeId) {
    document.getElementById('session-viewer').classList.add('sv-open');
    updateSessionProgress();
    syncNotesPanelPosition();
  } else {
    openViewer(node._sessionTxt, nodeId);
  }
}

function closeViewer() {
  // Don't clear viewer state — answers and scroll position are preserved in the DOM
  document.getElementById('session-viewer').classList.remove('sv-open');
}

/* ── Per-node notes ────── 
   A simple sidebar textarea anchored to the right edge of the session
   window. Saved per node (keyed by label, alongside session progress) so
   switching between nodes never mixes notes up — "don't overcomplicate
   it" means no rich text, no per-topic tabs, just one plain textarea
   whose content follows whichever node's session is currently open.
   Position (left/top) tracks the session window as it's dragged/resized;
   its own width/height are independent and user-resizable via
   #sv-notes-resize, same as the session window itself. */
let notesSaveTimer = null;

function syncNotesPanelPosition() {
  const panel = document.getElementById('sv-notes-panel');
  if (!panel.classList.contains('open')) return;
  const r = document.getElementById('sv-window').getBoundingClientRect();
  panel.style.left = (r.right + 10) + 'px';
  panel.style.top  = r.top + 'px';
}

// Pads the textarea with enough blank lines that every visible row is a
// real line a click can land on — "as if you had spammed the enter key
// beforehand" — rather than dead space below the last typed line that
// just dumps the cursor at the end of the text. Trimmed back off before
// anything is actually saved (see the input listener below).
const NOTES_PAD_LINES = 60;
function padNotes(text) {
  const lines = text.split('\n').length;
  return lines >= NOTES_PAD_LINES ? text : text + '\n'.repeat(NOTES_PAD_LINES - lines);
}

function loadNotesForCurrentNode() {
  const node = state.nodes.get(viewer.nodeId);
  document.getElementById('sv-notes-ta').value = padNotes(node?._notes || '');
}

function toggleNotesPanel() {
  const panel = document.getElementById('sv-notes-panel');
  const open  = !panel.classList.contains('open');
  panel.classList.toggle('open', open);
  document.getElementById('btn-toggle-notes').classList.toggle('active', open);
  if (open) {
    loadNotesForCurrentNode();
    // Default size on first-ever open only; a manual resize (which sets
    // an inline style) is left alone on every open after that.
    if (!panel.style.height) panel.style.height = document.getElementById('sv-window').getBoundingClientRect().height + 'px';
    syncNotesPanelPosition();
  }
}

document.getElementById('btn-toggle-notes').addEventListener('click', toggleNotesPanel);
document.getElementById('sv-notes-ta').addEventListener('input', e => {
  const node = state.nodes.get(viewer.nodeId);
  if (!node) return;
  // Strip the padding lines back off before persisting — the textarea's
  // own value (with padding intact) is left untouched so clicking further
  // down still works for the rest of this session.
  node._notes = e.target.value.replace(/\n+$/, '');
  clearTimeout(notesSaveTimer);
  notesSaveTimer = setTimeout(autoSaveProgress, 500);
});
document.getElementById('sv-notes-ta').addEventListener('keydown', e => {
  if (e.key !== 'Tab') return;
  e.preventDefault();
  const ta = e.target;
  const start = ta.selectionStart, end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + '\t' + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + 1;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ── Per-node scroll position ────── 
   Remembers how far into each node's lesson the reader has scrolled, keyed
   to that node specifically — so switching to a different node's session
   and back resumes where you left off instead of resetting to the top
   (previously there was nowhere for this to live except the live DOM, so
   it was really just whichever node happened to be open, not a per-node
   memory at all). */
let scrollSaveTimer = null;
document.getElementById('sv-body').addEventListener('scroll', e => {
  const node = state.nodes.get(viewer.nodeId);
  if (!node) return;
  node._scrollTop = e.target.scrollTop;
  updateSessionProgress();
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(autoSaveProgress, 500);
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.getElementById('session-viewer').classList.contains('sv-open'))
    closeViewer();
});

/* ── Drag ────── */
const svDrag = { active: false, startX: 0, startY: 0, winX: 0, winY: 0 };
document.getElementById('sv-header').addEventListener('mousedown', e => {
  if (e.button !== 0 || e.target.closest('button')) return;
  const r = document.getElementById('sv-window').getBoundingClientRect();
  Object.assign(svDrag, { active: true, startX: e.clientX, startY: e.clientY, winX: r.left, winY: r.top });
  e.preventDefault();
});

/* ── Resize ────── */
const svResize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 };
document.getElementById('sv-resize').addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const win = document.getElementById('sv-window');
  Object.assign(svResize, { active: true, startX: e.clientX, startY: e.clientY, startW: win.offsetWidth, startH: win.offsetHeight });
  e.preventDefault(); e.stopPropagation();
});

const notesResize = { active: false, startX: 0, startY: 0, startW: 0, startH: 0 };
document.getElementById('sv-notes-resize').addEventListener('mousedown', e => {
  if (e.button !== 0) return;
  const panel = document.getElementById('sv-notes-panel');
  Object.assign(notesResize, { active: true, startX: e.clientX, startY: e.clientY, startW: panel.offsetWidth, startH: panel.offsetHeight });
  e.preventDefault(); e.stopPropagation();
});

document.addEventListener('mousemove', e => {
  if (svDrag.active) {
    const win = document.getElementById('sv-window');
    win.style.left = Math.max(0, Math.min(window.innerWidth  - 80, svDrag.winX  + e.clientX - svDrag.startX))  + 'px';
    win.style.top  = Math.max(0, Math.min(window.innerHeight - 40, svDrag.winY  + e.clientY - svDrag.startY))  + 'px';
    syncNotesPanelPosition();
  }
  if (svResize.active) {
    const win = document.getElementById('sv-window');
    win.style.width  = Math.max(380, svResize.startW + e.clientX - svResize.startX) + 'px';
    win.style.height = Math.max(280, svResize.startH + e.clientY - svResize.startY) + 'px';
    syncNotesPanelPosition();
  }
  if (notesResize.active) {
    const panel = document.getElementById('sv-notes-panel');
    panel.style.width  = Math.max(200, notesResize.startW + e.clientX - notesResize.startX) + 'px';
    panel.style.height = Math.max(200, notesResize.startH + e.clientY - notesResize.startY) + 'px';
  }
});
document.addEventListener('mouseup', () => { svDrag.active = false; svResize.active = false; notesResize.active = false; });

/* ── Wiring ────── */
document.getElementById('session-file-input').addEventListener('change', e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => openViewer(ev.target.result, _modalNodeId);
  reader.readAsText(file); e.target.value = '';
});
document.getElementById('btn-close-viewer').addEventListener('click', closeViewer);