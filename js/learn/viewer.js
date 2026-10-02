/* ═══════════════════════════════════════════════════════════
   viewer.js — session viewer: .txt parsing, question UI, answer
   handling, score tracking, notes, drag/resize.
   Depends on state.js, layout.js, io.js, toast.js, escape.js and tools.js
   (svEsc, renderMath, collapseMathNewlines, shuffleOptions, and the
   BLOCK_TOOLS registry that TABLE/TIMELINE/GRAPH blocks go through).
═══════════════════════════════════════════════════════════ */

const viewer = { nodeId: null, answers: new Map(), score: 0, total: 0, bonusAnswers: new Map(), checkpoints: [], questions: new Map(), bonuses: new Map() };
let svUserPositioned = false; // set once the window is dragged; stops auto-centering on resize

/* ── Session progress bar ──
   "Progress" is scroll position through the lesson, rescaled so the last
   question is 100%. Each question is a checkpoint; one completes when it's
   answered (right or wrong). The fill is clamped between the last checkpoint
   completed in order and the next one to come, so it can't run ahead of an
   unanswered question, and answering out of order doesn't skip ahead. */
function computeCheckpoints() {
  const body = document.getElementById('sv-body');
  const bodyRect = body.getBoundingClientRect();
  viewer.checkpoints = [...body.querySelectorAll('.q-card[data-qn]')]
    .map(el => ({ qn: parseInt(el.dataset.qn), top: el.getBoundingClientRect().top - bodyRect.top + body.scrollTop }))
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

/* ── Parser ──
   Each question and bonus carries its own correct answer inline
   ([ANSWER: X]). shuffleOptions (tools.js) reorders the options on screen,
   seeded off the question text, so the on-screen letter of the correct
   answer is randomized by the app rather than left to the model.

   Saved answers are stored by the option's ORIGINAL letter, not the
   on-screen one, and translated back through origOf/newOf, so a reshuffle
   can never turn a saved correct answer into a wrong one. */

function parseTxtSession(raw) {
  raw = collapseMathNewlines(raw);
  const questions = new Map(), bonuses = new Map();
  const blockMaps = {};
  BLOCK_TOOLS.forEach(t => { blockMaps[t.key] = new Map(); });

  let cleaned = raw.replace(/\[QUESTION\s+(\d+)\]([\s\S]*?)\[\/QUESTION\]/gi, (_, n, body) => {
    questions.set(parseInt(n), parseQuestionBody(parseInt(n), body));
    return `\x00Q:${n}\x00`;
  });
  cleaned = cleaned.replace(/\[BONUS\s+(\d+)\]([\s\S]*?)\[\/BONUS\]/gi, (_, n, body) => {
    bonuses.set(parseInt(n), parseBonusBody(parseInt(n), body));
    return ''; // bonus blocks are pulled out of the main flow
  });

  // Every other block type follows the same extract / placeholder / store pattern.
  BLOCK_TOOLS.forEach(tool => {
    let id = 0;
    const re = new RegExp(`\\[${tool.tag}\\]([\\s\\S]*?)\\[/${tool.tag}\\]`, 'gi');
    cleaned = cleaned.replace(re, (_, body) => {
      id++;
      blockMaps[tool.key].set(id, tool.parse(body));
      return `\x00${tool.code}:${id}\x00`;
    });
  });

  const parts = cleaned.split(/^===\s*SECTION\s+(\d+)[:.]\s*(.+?)\s*===/im);
  // Text before the first section header would otherwise vanish; fold it into Section 1.
  const leading = (parts[0] || '').trim();
  const sections = [];
  for (let i = 1; i < parts.length; i += 3)
    sections.push({ num: parts[i], title: parts[i+1].trim(), body: (parts[i+2] || '').trim() });
  if (leading && sections.length)
    sections[0].body = sections[0].body ? `${leading}\n\n${sections[0].body}` : leading;
  return { sections, questions, bonuses, ...blockMaps };
}

/* Shared by questions and bonuses: pulls out [ANSWER: X] and the raw (A)-(E)
   options, shuffles them, and reports whether the block is scoreable (`valid`:
   its answer letter names one of its own options). */
function parseChoiceBlock(prefix, n, raw) {
  const ansMatch = raw.match(/\[ANSWER:\s*([A-Ea-e])\]/i);
  const correctRaw = ansMatch ? ansMatch[1].toUpperCase() : null;
  const cleaned = raw.replace(/\[ANSWER:[^\]]+\]/gi, '');
  const rawOptions = {}, textLines = [];
  for (const line of cleaned.split('\n')) {
    const m = line.match(/^\(([A-Ea-e])\)\s+(.*)/);
    if (m) rawOptions[m[1].toUpperCase()] = m[2].trim();
    else   textLines.push(line);
  }
  const text = textLines.join('\n').trim();
  const { options, correct, origOf, newOf } = shuffleOptions(rawOptions, correctRaw, `${prefix}${n}|${text}`);
  return { n, text, options, correct, origOf, newOf, correctOrig: correctRaw, valid: correct !== null };
}
const parseQuestionBody = (n, raw) => parseChoiceBlock('Q', n, raw);
const parseBonusBody    = (n, raw) => parseChoiceBlock('B', n, raw);

/* ── Renderer ── */

/* Makes an existing "Section N" mention in prose clickable (the lesson text
   refers back to earlier sections on its own; this only adds the jump). Works
   on already-escaped text and matches only literal "Section" + number.
   It's a <span role="link">, not an <a href>: an anchor's default fragment
   navigation and focus-scroll fight #sv-window's fixed positioning and blew
   its layout out. The keydown handler near the bottom adds Enter/Space. */
function linkifySectionRefs(escapedHtml) {
  return escapedHtml.replace(/\bSection\s+(\d+)\b/g,
    (whole, num) => `<span class="sv-sec-ref" data-sec="${num}" role="link" tabindex="0">${whole}</span>`);
}

function renderProse(text) {
  return text.split(/\n{2,}/).map(c => c.trim()).filter(Boolean)
    .map(c => `<p>${linkifySectionRefs(svEsc(c)).replace(/\n/g, '<br>')}</p>`).join('');
}

/* One card for a main question (kind 'q') or a bonus (kind 'b'). A block with
   no valid answer key is shown, disabled and flagged, but not scored and not a
   progress checkpoint (it carries no data-qn / data-bn). */
function renderChoiceCard(kind, q) {
  const attr  = kind === 'q' ? 'qn' : 'bn';
  const label = kind === 'q' ? 'Question' : 'Bonus';
  const keyAttr = q.valid ? ` data-${attr}="${q.n}"` : '';
  const opts = ['A','B','C','D','E'].filter(l => q.options[l] !== undefined)
    .map(l => `<button class="q-opt"${keyAttr} data-letter="${l}"${q.valid ? '' : ' disabled'}>
      <span class="q-letter">${l}</span><span class="q-text">${svEsc(q.options[l])}</span>
    </button>`).join('');
  const note = q.valid ? '' : `<div class="q-feedback fb-wrong">This ${label.toLowerCase()} has no valid answer key, so it can't be scored.</div>`;
  return `<div class="q-card${q.valid ? '' : ' q-card-invalid'}"${keyAttr}>
    <div class="q-num">${label} ${q.n}</div>
    <div class="q-body">${renderProse(q.text)}</div>
    <div class="q-opts">${opts}</div>
    <div class="q-feedback" id="${kind}fb-${q.n}"></div>${note}
  </div>`;
}

// One token regex for every block type's placeholder code plus 'Q' for questions.
const SV_TOKEN_RE      = new RegExp(`\\x00(Q|${BLOCK_TOOLS.map(t => t.code).join('|')}):(\\d+)\\x00`);
const SV_TOOLS_BY_CODE = Object.fromEntries(BLOCK_TOOLS.map(t => [t.code, t]));
function renderSession(parsed) {
  return parsed.sections.map(sec => {
    const parts = sec.body.split(SV_TOKEN_RE);
    let inner = '';
    for (let i = 0; i < parts.length; i += 3) {
      const plain = parts[i];
      if (plain && plain.trim()) inner += `<div class="sv-prose">${renderProse(plain.trim())}</div>`;
      const type = parts[i+1], id = parseInt(parts[i+2]);
      if (type === 'Q') {
        const q = parsed.questions.get(id); if (q) inner += renderChoiceCard('q', q);
      } else if (type && SV_TOOLS_BY_CODE[type]) {
        const tool = SV_TOOLS_BY_CODE[type];
        const item = parsed[tool.key].get(id);
        if (item) inner += tool.render(item, id);
      }
    }
    // id="sv-section-N" is the scroll target for the "Section N" links.
    return `<div class="sv-section" id="sv-section-${sec.num}"><div class="sv-section-label">Section ${sec.num}</div><div class="sv-section-title">${svEsc(sec.title)}</div>${inner}</div>`;
  }).join('');
}
function buildBonusSection(bonuses) {
  if (!bonuses.size) return '';
  const nums = [...bonuses.keys()].sort((a, b) => a - b);
  const cards = nums.map(n => renderChoiceCard('b', bonuses.get(n))).join('');
  return `<details id="sv-recap">
    <summary><span class="recap-arrow">▶</span> Bonus Practice — ${nums.length} extra question${nums.length !== 1 ? 's' : ''}</summary>
    <div id="sv-recap-body">${cards}</div>
  </details>`;
}

/* Marks a card as answered: disables its options, highlights the correct and
   any wrong pick, and writes the feedback line. */
function showResult(card, letter, correct) {
  card.querySelectorAll('.q-opt').forEach(b => {
    b.disabled = true;
    if (b.dataset.letter === correct) b.classList.add('q-correct');
    if (b.dataset.letter === letter && letter !== correct) b.classList.add('q-wrong');
  });
  const fb = card.querySelector('.q-feedback');
  if (fb) {
    fb.textContent = letter === correct ? '✓ Correct' : `✗  Correct answer: ${correct}`;
    fb.className = 'q-feedback ' + (letter === correct ? 'fb-correct' : 'fb-wrong');
  }
}
function applyAnswer(qn, letter, correct) {
  viewer.answers.set(qn, letter);
  if (letter === correct) viewer.score++;
  document.querySelectorAll(`.q-card[data-qn="${qn}"]`).forEach(card => showResult(card, letter, correct));
}
function handleOptionClick(btn) {
  const qn = parseInt(btn.dataset.qn), letter = btn.dataset.letter; // letter = this render's on-screen letter
  if (viewer.answers.has(qn)) return;
  const q = viewer.questions.get(qn);
  if (!q?.valid) return;
  const node = state.nodes.get(viewer.nodeId);
  // Persist by the ORIGINAL letter (see the Parser comment above).
  if (node) { if (!node._sessionAnswers) node._sessionAnswers = {}; node._sessionAnswers[qn] = q.origOf?.[letter] ?? letter; }
  applyAnswer(qn, letter, q.correct);
  updateViewerScore();
  computeCheckpoints();
  updateSessionProgress();
  // All scoreable questions answered → mark the topic done (taken in good faith).
  if (viewer.answers.size === viewer.total && node && !node.done) {
    node.done = true; updateAllStatuses(); autoSaveProgress();
  }
}
function handleBonusClick(btn) {
  const bn = parseInt(btn.dataset.bn), letter = btn.dataset.letter;
  if (viewer.bonusAnswers.has(bn)) return;
  const bonus = viewer.bonuses.get(bn);
  if (!bonus?.valid) return;
  const origLetter = bonus.origOf?.[letter] ?? letter;
  viewer.bonusAnswers.set(bn, origLetter);
  const node = state.nodes.get(viewer.nodeId);
  if (node) { if (!node._bonusAnswers) node._bonusAnswers = {}; node._bonusAnswers[bn] = origLetter; }
  document.querySelectorAll(`.q-card[data-bn="${bn}"]`).forEach(card => showResult(card, letter, bonus.correct));
}
function updateViewerScore() {
  const badge = document.getElementById('sv-score'); if (!badge) return;
  badge.textContent = viewer.total > 0 ? `${viewer.score} / ${viewer.total} correct` : '— / —';
  badge.classList.toggle('sv-perfect', viewer.answers.size === viewer.total && viewer.total > 0 && viewer.score === viewer.total);
}

/* ── Open / Close ── */
function openViewer(txtContent, nodeId) {
  const node = state.nodes.get(nodeId);
  const parsed = parseTxtSession(txtContent);

  const scoreable = [...parsed.questions.values()].filter(q => q.valid);
  if (!scoreable.length) {
    showToast(parsed.questions.size
      ? 'None of this lesson\'s questions has a valid answer key ([ANSWER: X]), so it can\'t be opened. Regenerate it with the current prompt.'
      : 'That file has no [QUESTION] blocks, so it isn\'t a lesson this viewer can open.');
    return;
  }
  const skipped = parsed.questions.size - scoreable.length;
  if (skipped) showToast(`${skipped} question${skipped > 1 ? 's' : ''} in this lesson ${skipped > 1 ? 'have' : 'has'} no valid answer key and won't be scored.`);

  if (node) node._sessionTxt = txtContent;
  Object.assign(viewer, {
    nodeId, answers: new Map(), score: 0, total: scoreable.length, bonusAnswers: new Map(), checkpoints: [],
    // Kept for this render so click handlers (which only see a number and an on-screen letter) can look up origOf/correct.
    questions: parsed.questions, bonuses: parsed.bonuses,
  });
  svUserPositioned = false; // this open re-centres the window, so auto-centering on resize applies again
  document.getElementById('sv-topic').textContent = node?.label ?? 'Session';

  const body = document.getElementById('sv-body');
  body.innerHTML = renderSession(parsed) + buildBonusSection(parsed.bonuses);
  renderMath(body);

  body.querySelectorAll('.q-opt[data-qn]').forEach(btn => btn.addEventListener('click', () => handleOptionClick(btn)));
  body.querySelectorAll('.q-opt[data-bn]').forEach(btn => btn.addEventListener('click', () => handleBonusClick(btn)));

  // Restore saved answers. Stored values are ORIGINAL letters; newOf says where
  // that option landed in THIS render.
  for (const [qn, origLetter] of Object.entries(node?._sessionAnswers || {})) {
    const q = parsed.questions.get(parseInt(qn));
    if (!q?.valid) continue;
    applyAnswer(q.n, q.newOf?.[origLetter] ?? origLetter, q.correct);
  }
  for (const [bn, origLetter] of Object.entries(node?._bonusAnswers || {})) {
    const bonus = parsed.bonuses.get(parseInt(bn));
    if (!bonus?.valid) continue;
    viewer.bonusAnswers.set(bonus.n, origLetter);
    const letter = bonus.newOf?.[origLetter] ?? origLetter;
    document.querySelectorAll(`.q-card[data-bn="${bonus.n}"]`).forEach(card => showResult(card, letter, bonus.correct));
  }
  updateViewerScore();

  document.getElementById('modal-backdrop').classList.remove('open');
  document.getElementById('session-viewer').classList.add('sv-open');

  // Everything below measures layout, so it must run after the viewer is visible
  // (a display:none ancestor makes every size read as 0).
  const win = document.getElementById('sv-window');
  win.style.left = Math.max(0, (window.innerWidth  - win.offsetWidth)  / 2) + 'px';
  win.style.top  = Math.max(0, (window.innerHeight - win.offsetHeight) / 2) + 'px';
  body.scrollTop = node?._scrollTop || 0; // resume this node's own reading position

  // Tools that attach a live widget (Plotly) mount now that they can measure.
  const mounts = [];
  BLOCK_TOOLS.forEach(tool => {
    if (tool.mount) parsed[tool.key].forEach((item, id) => mounts.push(tool.mount(item, id)));
  });

  computeCheckpoints();
  updateSessionProgress();
  // Graphs load their libraries asynchronously; re-measure once they've settled.
  Promise.allSettled(mounts).then(() => {
    if (viewer.nodeId === nodeId) { computeCheckpoints(); updateSessionProgress(); }
  });

  loadNotesForCurrentNode();
  syncNotesPanelPosition();
}

// Reopen a node's session. If the viewer already shows this node, just
// re-reveal it (keeps scroll position); otherwise rebuild for that node.
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
  // viewer state is kept: answers and scroll position live on in the DOM
  document.getElementById('session-viewer').classList.remove('sv-open');
}

onEscape(60, () => {
  if (!document.getElementById('session-viewer').classList.contains('sv-open')) return false;
  closeViewer();
  return true;
});

/* ── Per-node notes ──
   A plain textarea on the right edge of the session window, saved per node
   alongside its progress. Its left/top track the session window; its own
   size is independent and user-resizable. */
let notesSaveTimer = null;

function syncNotesPanelPosition() {
  const panel = document.getElementById('sv-notes-panel');
  if (!panel.classList.contains('open')) return;
  const r = document.getElementById('sv-window').getBoundingClientRect();
  panel.style.left = (r.right + 10) + 'px';
  panel.style.top  = r.top + 'px';
}

// Pads the textarea with blank lines so every visible row is a line a click can
// land on, instead of dead space that dumps the cursor at the end. Trimmed off
// again before saving.
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
    // Default height on first open only; a manual resize (inline style) is kept.
    if (!panel.style.height) panel.style.height = document.getElementById('sv-window').getBoundingClientRect().height + 'px';
    syncNotesPanelPosition();
  }
}

document.getElementById('btn-toggle-notes').addEventListener('click', toggleNotesPanel);
document.getElementById('sv-notes-ta').addEventListener('input', e => {
  const node = state.nodes.get(viewer.nodeId);
  if (!node) return;
  node._notes = e.target.value.replace(/\n+$/, ''); // strip the padding before persisting
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

/* ── Per-node scroll position ── remembered per node so switching sessions and back resumes where you were. */
let scrollSaveTimer = null;
document.getElementById('sv-body').addEventListener('scroll', e => {
  const node = state.nodes.get(viewer.nodeId);
  if (!node) return;
  node._scrollTop = e.target.scrollTop;
  updateSessionProgress();
  clearTimeout(scrollSaveTimer);
  scrollSaveTimer = setTimeout(autoSaveProgress, 500);
});

/* "Section N" link clicks, delegated on #sv-body because its innerHTML is
   replaced on every open. Deliberately not scrollIntoView(): in this nested
   fixed-position structure the browser picked the wrong scroll container and
   distorted #sv-window. Setting only #sv-body's own scroll offset avoids that. */
function scrollToSectionRef(link) {
  const body = document.getElementById('sv-body');
  const target = document.getElementById(`sv-section-${link.dataset.sec}`);
  if (!body || !target) return;
  const targetTop = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
  body.scrollTo({ top: targetTop, behavior: 'smooth' });
}
document.getElementById('sv-body').addEventListener('click', e => {
  const link = e.target.closest('.sv-sec-ref');
  if (link) scrollToSectionRef(link);
});
document.getElementById('sv-body').addEventListener('keydown', e => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const link = e.target.closest?.('.sv-sec-ref');
  if (!link) return;
  e.preventDefault(); // Space would otherwise also scroll #sv-body
  scrollToSectionRef(link);
});

/* ── Drag / resize ──
   Pointer events with capture (not mouse events), so dragging and resizing
   also work with a finger or pen on a tablet wide enough to get the
   floating window instead of the fullscreen mobile layout. */
function bindPointerDrag(el, { start, move, ignore }) {
  let active = false;
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || (ignore && ignore(e))) return;
    active = true;
    el.setPointerCapture(e.pointerId);
    start(e);
    e.preventDefault(); e.stopPropagation();
  });
  el.addEventListener('pointermove', e => { if (active) move(e); });
  const end = e => {
    if (!active) return;
    active = false;
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

const svDrag = { startX: 0, startY: 0, winX: 0, winY: 0 };
bindPointerDrag(document.getElementById('sv-header'), {
  ignore: e => e.target.closest('button'),
  start: e => {
    const r = document.getElementById('sv-window').getBoundingClientRect();
    Object.assign(svDrag, { startX: e.clientX, startY: e.clientY, winX: r.left, winY: r.top });
  },
  move: e => {
    svUserPositioned = true;
    const win = document.getElementById('sv-window');
    win.style.left = Math.max(0, Math.min(window.innerWidth  - 80, svDrag.winX + e.clientX - svDrag.startX)) + 'px';
    win.style.top  = Math.max(0, Math.min(window.innerHeight - 40, svDrag.winY + e.clientY - svDrag.startY)) + 'px';
    syncNotesPanelPosition();
  },
});

const svResize = { startX: 0, startY: 0, startW: 0, startH: 0 };
bindPointerDrag(document.getElementById('sv-resize'), {
  start: e => {
    const win = document.getElementById('sv-window');
    Object.assign(svResize, { startX: e.clientX, startY: e.clientY, startW: win.offsetWidth, startH: win.offsetHeight });
  },
  move: e => {
    const win = document.getElementById('sv-window');
    win.style.width  = Math.max(380, svResize.startW + e.clientX - svResize.startX) + 'px';
    win.style.height = Math.max(280, svResize.startH + e.clientY - svResize.startY) + 'px';
    syncNotesPanelPosition();
  },
});

const notesResize = { startX: 0, startY: 0, startW: 0, startH: 0 };
bindPointerDrag(document.getElementById('sv-notes-resize'), {
  start: e => {
    const panel = document.getElementById('sv-notes-panel');
    Object.assign(notesResize, { startX: e.clientX, startY: e.clientY, startW: panel.offsetWidth, startH: panel.offsetHeight });
  },
  move: e => {
    const panel = document.getElementById('sv-notes-panel');
    panel.style.width  = Math.max(200, notesResize.startW + e.clientX - notesResize.startX) + 'px';
    panel.style.height = Math.max(200, notesResize.startH + e.clientY - notesResize.startY) + 'px';
  },
});

/* Keep the window centred through viewport changes (F11, DevTools opening):
   it was centred once in openViewer() using the height at that moment, so a
   later resize leaves it too high with a dead gap below. Re-centre on resize
   unless the person has dragged it somewhere on purpose. */
window.addEventListener('resize', () => {
  const win = document.getElementById('sv-window');
  if (!win.style.top && !win.style.left) return; // never opened yet
  if (svUserPositioned) return;
  win.style.left = Math.max(0, (window.innerWidth  - win.offsetWidth)  / 2) + 'px';
  win.style.top  = Math.max(0, (window.innerHeight - win.offsetHeight) / 2) + 'px';
  syncNotesPanelPosition();
});

/* ── Wiring ── */
document.getElementById('session-file-input').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload  = ev => openViewer(ev.target.result, _modalNodeId);
    reader.onerror = () => showToast(`Couldn't read "${file.name}".`);
    reader.readAsText(file);
  }
  e.target.value = '';
});
document.getElementById('btn-close-viewer').addEventListener('click', closeViewer);
