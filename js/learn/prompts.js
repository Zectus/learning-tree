/* ═══════════════════════════════════════════════════════════
   prompts.js — computes the per-node and per-tree prompt inputs
   (buildPrompt, buildTreePrompt, buildTreePromptFromFile), hands them to
   the pure-text templates in node-prompt.js / tree-prompt.js, and owns the
   two modals built around those prompts (the single-node "learn" modal and
   the "new tree" modal) plus their copy-to-clipboard buttons.
   Depends on state.js, escape.js, node-prompt.js, tree-prompt.js and io.js
   (slugify, readJSONFile, loadFromJSON).
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   NODE LESSON PROMPT — per-node values (prerequisite context, tree topic,
   scope note) handed to renderNodePrompt(). Answer checking lives in
   viewer.js: each question marks its own correct option with [ANSWER: X]
   and the app shuffles options at parse time (shuffleOptions in tools.js),
   so nothing here computes an answer key.
═══════════════════════════════════════════════════════════ */
function buildPrompt(id, language) {
  const node   = state.nodes.get(id);
  const topic  = node.label;
  const nodeId = node.slug || slugify(node.label);

  const prereqNodes = prereqsOf(id).map(pid => state.nodes.get(pid)).filter(Boolean);
  const dependents  = dependentsOf(id).map(pid => state.nodes.get(pid)?.label).filter(Boolean);

  // Each prerequisite is listed with its own `explanation` (the scope note the
  // tree designer wrote), not just its name, so the model can tell "fully
  // established, safe to build on" from "sounds adjacent, re-explain
  // defensively".
  const prereqDetailList = prereqNodes
    .map(n => `- ${n.label}${n.explanation ? ` — ${n.explanation}` : ''}`)
    .join('\n');
  const prereqLine = prereqNodes.length
    ? `The reader has already been through, earlier in this sequence, every one of the following — each line is that document's own label plus the exact scope it covered, so you know precisely what's already been established (and its boundaries) rather than guessing from the name alone:\n${prereqDetailList}\nTreat everything described above as already fully taught and available to build on without re-deriving or re-explaining it — refer back to it the way one lesson naturally refers to an earlier one ("recall that...", "as seen when X was introduced...", "earlier, we found...") rather than the word "prerequisite," which reads like a syllabus line rather than something anyone would actually say. Where a listed scope stops short of something you need here, that gap is genuinely new material for this node to cover, not something to assume was already handled.`
    : `This is the first topic in the sequence — there is nothing earlier to refer back to.`;
  const leadsToLine = dependents.length
    ? `Material the reader hasn't seen yet will build on this one afterward: ${dependents.join(', ')}. Don't teach toward it or mention it by name here.`
    : '';
  const treeTopicLine = state.topic ? `This node belongs to a larger tree on ${state.topic}.` : '';
  const explanationLine = node.explanation
    ? `This node's scope, from the tree's own design notes (not shown to the reader, but binding on what you write): ${node.explanation} Use this brief to identify the intended learner ability, central idea, supporting content, and scope boundaries. If it is written as a topic list, organize those items into a learnable progression rather than equal-length treatments. Keep explicit exclusions, but still show a meaningful use of the idea at this level.`
    : '';
  const lang = language || 'English';
  const languageClause = `\nLANGUAGE\nWrite the entire document in ${lang} — every section title, all prose, every question, and every answer option. The structural markup a parser reads must stay exactly as specified above, in this literal form, regardless of language: "=== SECTION N: " and the closing "===" wrapping each section title (translate the title itself, not the wrapper), "[QUESTION N]" / "[/QUESTION]", "[ANSWER: X]", the option markers "(A)" through "(E)", "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", "[GRAPH]" / "[/GRAPH]", and "[BONUS N]" / "[/BONUS]". Only the human-readable content moves to ${lang} — none of that markup does. This extends inside [GRAPH] blocks specifically: the field names themselves (type, title, xlabel, ylabel, zlabel, xrange, yrange, trange, trace, label, color, z, u, v) are parser keywords and must stay in English exactly as written in the spec, and every math expression (a trace's formula, z, u, v) must stay in plain ASCII math syntax regardless of document language, since a separate library evaluates them as expressions, not as text. Only the actual values after title:, xlabel:, ylabel:, zlabel:, and label: move to ${lang} — everything else in a [GRAPH] block does not.\n`;

  return renderNodePrompt({ topic, nodeId, prereqLine, leadsToLine, treeTopicLine, explanationLine, languageClause });
}

/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — a separate flow that generates a prompt for
   designing a whole new prerequisite tree. The text lives in tree-prompt.js.
═══════════════════════════════════════════════════════════ */
function buildTreePrompt(topic, language) {
  const fileSlug = slugify(topic);
  const lang = language || 'English';
  const languageClause = `\n\nLANGUAGE\nWrite every node's "label" value in ${lang}. Keep "id" slugs in plain lowercase ASCII snake_case regardless of language — they're internal wiring only, never shown to anyone, so there's nothing to gain by translating or transliterating them. Also set the top-level "language" field in your output to "${lang}" verbatim (see OUTPUT SCHEMA).`;
  return renderTreePrompt({ topic, fileSlug, language: lang, languageClause });
}

// No inputs: topic, starting point and language are all derived by Claude from
// the attached file(s). Kept as a function so this file stays the one place
// between the modal and the templates.
function buildTreePromptFromFile() {
  return renderTreePromptFromFile();
}

/* ── learn modal ── */
let _modalNodeId = null;
let _languagePrefill = ''; // what we last put in the language field ourselves

function openLearnModal(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  _modalNodeId = id;
  const languageInput = document.getElementById('node-language-input');
  // Prefill with the tree's language, but only over a blank field or a value we
  // put there ourselves — so a language typed by hand survives, while the
  // previous tree's language doesn't leak into this one.
  const current = languageInput.value.trim();
  if (!current || current === _languagePrefill) {
    languageInput.value = state.language || '';
    _languagePrefill = state.language || '';
  }
  const prompt = buildPrompt(id, languageInput.value.trim());

  document.getElementById('modal-title').textContent = node.label;
  document.getElementById('modal-meta').textContent =
    `${prereqsOf(id).length} prerequisite${prereqsOf(id).length !== 1 ? 's' : ''} · copy prompt → paste into Claude → upload the .txt file`;
  document.getElementById('prompt-box').value = prompt;
  resetCopyButton('btn-copy-prompt');
  document.getElementById('modal-backdrop').classList.add('open');
}

document.getElementById('node-language-input').addEventListener('input', () => {
  if (_modalNodeId === null) return;
  document.getElementById('prompt-box').value = buildPrompt(_modalNodeId, document.getElementById('node-language-input').value.trim());
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

document.getElementById('menu-new-tree').addEventListener('click', openTreeModal);
document.getElementById('tree-modal-close').addEventListener('click', closeTreeModal);
document.getElementById('tree-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('tree-modal-backdrop')) closeTreeModal();
});
document.getElementById('tree-topic-input').addEventListener('input', updateTreePromptPreview);
document.getElementById('tree-language-input').addEventListener('input', updateTreePromptPreview);

document.getElementById('tree-json-input').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) {
    readJSONFile(file, obj => {
      if (!loadFromJSON(obj)) return; // the modal stays open so they can try another file
      if (!state.topic) state.topic = document.getElementById('tree-topic-input').value.trim();
      closeTreeModal();
    });
  }
  e.target.value = '';
});

onEscape(100, () => {
  if (document.getElementById('tree-modal-backdrop').classList.contains('open')) { closeTreeModal(); return true; }
  if (document.getElementById('modal-backdrop').classList.contains('open'))      { closeModal();     return true; }
  return false;
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
      else showToast("Couldn't copy automatically — select the prompt text and copy it by hand.");
    };
    // The async Clipboard API needs a secure context (so not file://, and
    // Firefox refuses it there outright); fall back to selection-based copy.
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
