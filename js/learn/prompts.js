/* ═══════════════════════════════════════════════════════════
   prompts.js — computes the per-node and per-tree prompt inputs
   (buildPrompt, buildTreePrompt, buildTreePromptFromFile) and
   hands them to the pure-text templates in node-prompt.js /
   tree-prompt.js; also owns both modals built around those
   prompts (the single-node "learn" modal and the "new tree"
   modal) and the copy-to-clipboard buttons shared by both.
   Depends on state.js, layout.js (prereqsOf/dependentsOf, via
   state.js), node-prompt.js, tree-prompt.js, io.js (slugify,
   loadFromJSON).
═══════════════════════════════════════════════════════════ */

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

  // PROMPT DESIGN RULE: prompt inputs describe the *node* — its place in
  // the tree, its scope — never the reader's own progress through it.
  // `n.done` is per-user session state (whether this particular person
  // has checked this particular node off), not something the tree itself
  // defines, so it must never be read into a prompt. A prior version did
  // exactly that here (a `doneNodes` list feeding a "the reader has also
  // separately already been through: ..." line) — removed. prereqLine and
  // leadsToLine stay: those come from the tree's actual edges, the same
  // for every reader, not from anyone's completion state.
  const prereqLine  = prereqs.length    ? `The reader has already been through, earlier in this sequence: ${prereqs.join(', ')}. Refer back to this the way one lesson naturally refers to an earlier one — "recall that...", "as seen when X was introduced...", "earlier, we found..." — rather than the word "prerequisite," which reads like a syllabus line rather than something anyone would actually say.` : `This is the first topic in the sequence — there is nothing earlier to refer back to.`;
  const leadsToLine = dependents.length ? `Material the reader hasn't seen yet will build on this one afterward: ${dependents.join(', ')}. Don't teach toward it or mention it by name here.` : '';
  const treeTopicLine = state.topic ? `This node belongs to a larger tree on ${state.topic}.` : '';
  const explanationLine = node.explanation
    ? `This node's scope, from the tree's own design notes (not shown to the reader, but binding on what you write): ${node.explanation} Treat this as the precise boundary of what belongs in this document — the topic name above is just the label; this defines which specific sub-results, cases, or pieces to cover, and which adjacent ones belong to a different node and should stay out even if a fuller treatment would naturally reach for them.`
    : '';
  const plainKey    = answers.map((a,i)=>`${i+1}${a}`).join(' ');
  const lang = language || 'English';
  const languageClause = `\nLANGUAGE\nWrite the entire document in ${lang} — every section title, all prose, every question, and every answer option. The structural markup a parser reads must stay exactly as specified above, in this literal form, regardless of language: "=== SECTION N: " and the closing "===" wrapping each section title (translate the title itself, not the wrapper), "[QUESTION N]" / "[/QUESTION]", the option markers "(A)" through "(E)", the final "[KEY: ...]" line, "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", "[GRAPH]" / "[/GRAPH]", and "[BONUS N]" / "[ANSWER: X]" / "[/BONUS]". Only the human-readable content moves to ${lang} — none of that markup does. This extends inside [GRAPH] blocks specifically: the field names themselves (type, title, xlabel, ylabel, zlabel, xrange, yrange, trange, trace, label, color, z, u, v) are parser keywords and must stay in English exactly as written in the spec, and every math expression (a trace's formula, z, u, v) must stay in plain ASCII math syntax regardless of document language, since a separate library evaluates them as expressions, not as text. Only the actual values after title:, xlabel:, ylabel:, zlabel:, and label: move to ${lang} — everything else in a [GRAPH] block does not.\n`;

  return renderNodePrompt({ topic, nodeId, plainKey, prereqLine, leadsToLine, treeTopicLine, explanationLine, languageClause });
}

/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — a separate flow from the per-node
   lesson prompt above; generates a prompt for designing a
   whole new prerequisite tree. The actual prompt text lives
   in tree-prompt.js, via renderTreePrompt().
═══════════════════════════════════════════════════════════ */
function buildTreePrompt(topic, language) {
  const fileSlug = slugify(topic);
  const lang = language || 'English';
  const languageClause = `\n\nLANGUAGE\nWrite every node's "label" value in ${lang}. Keep "id" slugs in plain lowercase ASCII snake_case regardless of language — they're internal wiring only, never shown to anyone, so there's nothing to gain by translating or transliterating them. Also set the top-level "language" field in your output to "${lang}" verbatim (see OUTPUT SCHEMA).`;

  return renderTreePrompt({ topic, fileSlug, languageClause });
}

// No inputs to compute — topic/starting point/language are all derived
// by Claude itself from the attached file(s), not by this app — but kept
// as a real function (rather than calling renderTreePromptFromFile()
// directly from io.js's wiring below) to match buildTreePrompt's role as
// the one place that sits between the modal and the template.
function buildTreePromptFromFile() {
  return renderTreePromptFromFile();
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
  const language = document.getElementById('tree-language-input').value.trim();
  document.getElementById('tree-prompt-box').value = topic
    ? buildTreePrompt(topic, language)
    : 'Fill in a topic above to generate the prompt.';
}

const TREE_MODAL_META = {
  topic: 'fill in the fields → copy the prompt → paste into Claude → answer its few quick calibration questions → upload the .json it gives you',
  file:  'copy the prompt → paste into Claude, attaching the file(s) you want to understand → answer its few quick calibration questions → upload the .json it gives you',
};

function setTreeMode(mode) {
  document.getElementById('tree-mode-tab-topic').classList.toggle('active', mode === 'topic');
  document.getElementById('tree-mode-tab-file').classList.toggle('active', mode === 'file');
  document.getElementById('tree-mode-topic-panel').classList.toggle('hidden', mode !== 'topic');
  document.getElementById('tree-mode-file-panel').classList.toggle('hidden', mode !== 'file');
  document.getElementById('tree-modal-meta').textContent = TREE_MODAL_META[mode];
  if (mode === 'file' && !document.getElementById('tree-file-prompt-box').value) {
    document.getElementById('tree-file-prompt-box').value = buildTreePromptFromFile();
  }
}
document.getElementById('tree-mode-tab-topic').addEventListener('click', () => setTreeMode('topic'));
document.getElementById('tree-mode-tab-file').addEventListener('click', () => setTreeMode('file'));

function openTreeModal() {
  setTreeMode('topic');
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
wireCopyButton('btn-copy-tree-file-prompt', 'tree-file-prompt-box');
