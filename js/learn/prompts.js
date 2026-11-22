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
function buildPrompt(id, language, deliveryInstruction) {
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
  const lang = language || (uiLanguage === 'es' ? 'Español' : 'English');
  const languageClause = `\nLANGUAGE\nWrite the entire document in ${lang} — every section title, all prose, every question, and every answer option. The structural markup a parser reads must stay exactly as specified above, in this literal form, regardless of language: "=== SECTION N: " and the closing "===" wrapping each section title (translate the title itself, not the wrapper), "[QUESTION N]" / "[/QUESTION]", "[ANSWER: X]", the option markers "(A)" through "(E)", "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", "[CALLOUT]" / "[/CALLOUT]", "[REF: target | visible text]", "[GRAPH]" / "[/GRAPH]", and "[BONUS N]" / "[/BONUS]". Only the human-readable content moves to ${lang} — none of that markup does. Inside [CALLOUT] blocks, keep the header keywords (id, label, title, tone, collapsed), ASCII id slugs, and keyword values (key, note, caution, true, false) in English; write the values after label: and title:, the callout body, and the visible text after "|" in [REF: ...] in ${lang}. This extends inside [GRAPH] blocks specifically: the field names themselves (type, title, xlabel, ylabel, zlabel, xrange, yrange, trange, trace, fill, range, opacity, point, segment, slider, label, color, z, u, v) are parser keywords and must stay in English exactly as written in the spec, and every math expression (a trace's formula, z, u, v) must stay in plain ASCII math syntax regardless of document language, since a separate library evaluates them as expressions, not as text. Only the actual values after title:, xlabel:, ylabel:, zlabel:, and label: move to ${lang} — everything else in a [GRAPH] block does not.\n`;

  return renderNodePrompt({ topic, nodeId, prereqLine, leadsToLine, treeTopicLine, explanationLine, languageClause, deliveryInstruction });
}

/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — a separate flow that generates a prompt for
   designing a whole new prerequisite tree. The text lives in tree-prompt.js.
═══════════════════════════════════════════════════════════ */
function buildTreePrompt(topic, language) {
  const fileSlug = slugify(topic);
  const lang = language || (uiLanguage === 'es' ? 'Español' : 'English');
  const languageClause = `\n\nLANGUAGE\nWrite every node's "label" value in ${lang}. Keep "id" slugs in plain lowercase ASCII snake_case regardless of language — they're internal wiring only, never shown to anyone, so there's nothing to gain by translating or transliterating them. Also set the top-level "language" field in your output to "${lang}" verbatim (see OUTPUT SCHEMA).`;
  const scope = typeof mathCollectionPrompt === 'function' ? mathCollectionPrompt(topic) : '';
  return renderTreePrompt({ topic, fileSlug, language: lang, languageClause, collectionContext: scope });
}

// No inputs: topic, starting point and language are all derived by the AI chatbot from
// the attached file(s). Kept as a function so this file stays the one place
// between the modal and the templates.
function buildTreePromptFromFile() {
  return renderTreePromptFromFile();
}

/* ── learn modal ── */
let _modalNodeId = null;
let _languagePrefill = ''; // what we last put in the language field ourselves
let _pendingSingleLesson = '';
let _pendingSingleErrors = [];

function extractLessonText(raw) {
  let text = String(raw || '').replace(/^\uFEFF/, '').trim();
  // Unwrap a single outer code fence (e.g. ```txt ... ```) if the AI used one.
  const fenced = text.match(/^```[^\r\n]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (fenced) text = fenced[1].trim();
  // If the AI added a short intro before Section 1 (or wrapped it in a code block
  // after an intro), jump directly to the lesson start.
  if (!/^===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.]/i.test(text)) {
    const innerFence = text.match(/```[^\r\n]*\r?\n(===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.][\s\S]*?)\r?\n```/i);
    if (innerFence) text = innerFence[1].trim();
    else {
      const start = text.match(/^===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.]/im);
      if (start) text = text.slice(start.index).trim();
    }
  }
  return text;
}
function clearSingleLessonFeedback() {
  _pendingSingleLesson = '';
  _pendingSingleErrors = [];
  const box = document.getElementById('single-lesson-feedback');
  if (box) box.classList.add('hidden');
  const list = document.getElementById('single-lesson-errors');
  if (list) list.replaceChildren();
}
function refreshSingleLessonControls() {
  const input = document.getElementById('single-lesson-input');
  const btn = document.getElementById('btn-open-single-lesson');
  if (input && btn) btn.disabled = !input.value.trim();
}
function buildSingleLessonFixPrompt(errors) {
  return `The lesson you returned has structural markup issues that prevent it from loading cleanly:\n${errors.map(e => `- ${e}`).join('\n')}\n\nPlease fix these issues and return the complete corrected plain-text lesson (no preamble or commentary), keeping all teaching content, questions, and language intact.`;
}
function openSingleLessonText(raw) {
  if (_modalNodeId === null) return false;
  const cleaned = extractLessonText(raw);
  if (!cleaned) return false;
  const check = typeof validateLessonStructure === 'function' ? validateLessonStructure(cleaned) : { valid: true, errors: [] };
  if (check.valid) {
    clearSingleLessonFeedback();
    openViewer(cleaned, _modalNodeId);
    return true;
  }
  _pendingSingleLesson = cleaned;
  _pendingSingleErrors = check.errors;
  const pasteBox = document.getElementById('single-lesson-input');
  if (pasteBox && pasteBox.value !== cleaned) {
    pasteBox.value = cleaned;
    refreshSingleLessonControls();
  }
  const list = document.getElementById('single-lesson-errors');
  list.replaceChildren();
  for (const err of check.errors) {
    const li = document.createElement('li');
    li.textContent = err;
    list.appendChild(li);
  }
  document.getElementById('single-lesson-feedback').classList.remove('hidden');
  return false;
}
async function pasteSingleLessonFromClipboard() {
  if (_modalNodeId === null) return;
  const revealManual = () => {
    const manual = document.getElementById('single-lesson-manual');
    if (manual) manual.open = true;
    document.getElementById('single-lesson-input')?.focus();
  };
  if (!navigator.clipboard?.readText) {
    revealManual();
    showToast("Couldn't read clipboard automatically — paste the lesson below.");
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!String(text || '').trim()) {
      showToast("Your clipboard is empty. Copy the AI's finished lesson first.");
      return;
    }
    openSingleLessonText(text);
  } catch {
    revealManual();
    showToast("Couldn't read clipboard automatically — paste the lesson below.");
  }
}

function openLearnModal(id) {
  const node = state.nodes.get(id);
  if (!node) return;

  _modalNodeId = id;
  const promptDetails = document.getElementById('single-prompt-details');
  if (promptDetails) promptDetails.open = false;
  const manualDetails = document.getElementById('single-lesson-manual');
  if (manualDetails) manualDetails.open = false;
  const pasteBox = document.getElementById('single-lesson-input');
  if (pasteBox) pasteBox.value = '';
  clearSingleLessonFeedback();
  refreshSingleLessonControls();
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
  uiText(document.getElementById('modal-meta'), `${prereqsOf(id).length} prerequisite${prereqsOf(id).length !== 1 ? 's' : ''} · copy prompt, paste into AI, then bring the lesson back`);
  document.getElementById('prompt-box').value = prompt;
  resetCopyButton('btn-copy-prompt');
  document.getElementById('modal-backdrop').classList.add('open');
}

document.getElementById('node-language-input').addEventListener('input', () => {
  if (_modalNodeId === null) return;
  document.getElementById('prompt-box').value = buildPrompt(_modalNodeId, document.getElementById('node-language-input').value.trim());
  resetCopyButton('btn-copy-prompt');
});

document.getElementById('btn-paste-single-lesson').addEventListener('click', () => {
  void pasteSingleLessonFromClipboard();
});
document.getElementById('single-lesson-input').addEventListener('input', () => {
  clearSingleLessonFeedback();
  refreshSingleLessonControls();
});
document.getElementById('btn-open-single-lesson').addEventListener('click', () => {
  openSingleLessonText(document.getElementById('single-lesson-input').value);
});
document.getElementById('btn-open-single-anyway').addEventListener('click', () => {
  if (_modalNodeId === null || !_pendingSingleLesson) return;
  const text = _pendingSingleLesson;
  clearSingleLessonFeedback();
  openViewer(text, _modalNodeId);
});
document.getElementById('btn-copy-single-fix').addEventListener('click', () => {
  if (!_pendingSingleErrors.length) return;
  const fixPrompt = buildSingleLessonFixPrompt(_pendingSingleErrors);
  const btn = document.getElementById('btn-copy-single-fix');
  const markCopied = () => {
    clearTimeout(_copyTimers.get('btn-copy-single-fix'));
    uiText(btn, 'Copied ✓');
    btn.classList.add('copied');
    _copyTimers.set('btn-copy-single-fix', setTimeout(() => {
      uiText(btn, 'Copy fix prompt');
      btn.classList.remove('copied');
      _copyTimers.delete('btn-copy-single-fix');
    }, 2000));
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(fixPrompt).then(markCopied).catch(() => showToast("Couldn't copy automatically — select the prompt text and copy it by hand."));
  } else {
    showToast("Couldn't copy automatically — select the prompt text and copy it by hand.");
  }
});

function closeModal() {
  document.getElementById('modal-backdrop').classList.remove('open');
  clearSingleLessonFeedback();
  _modalNodeId = null;
}

document.getElementById('modal-close').addEventListener('click', closeModal);
document.getElementById('modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-backdrop')) closeModal();
});

/* ── create-tree modal ── */
let _pendingTreeError = '';

function extractTreeJSON(raw) {
  let text = String(raw || '').replace(/^\uFEFF/, '').trim();
  if (!text) return { ok: false, error: t('No JSON text provided.') };
  const fenced = text.match(/^```[^\r\n]*\r?\n([\s\S]*?)\r?\n```\s*$/);
  if (fenced) text = fenced[1].trim();
  try { return { ok: true, obj: JSON.parse(text) }; } catch {}
  const innerFence = text.match(/```(?:json)?[^\r\n]*\r?\n([\s\S]*?)\r?\n```/i);
  if (innerFence) {
    try { return { ok: true, obj: JSON.parse(innerFence[1].trim()) }; } catch {}
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try { return { ok: true, obj: JSON.parse(text.slice(firstBrace, lastBrace + 1)) }; } catch (err) {
      return { ok: false, error: err?.message || t('Invalid JSON syntax.') };
    }
  }
  return { ok: false, error: t('Expected a JSON object with a "nodes" list.') };
}

function clearTreeImportFeedback() {
  _pendingTreeError = '';
  const box = document.getElementById('tree-import-feedback');
  if (box) box.classList.add('hidden');
  const list = document.getElementById('tree-import-errors');
  if (list) list.replaceChildren();
}

function showTreeImportFeedback(message, rawText) {
  _pendingTreeError = message;
  const pasteBox = document.getElementById('tree-json-paste');
  if (pasteBox && typeof rawText === 'string' && pasteBox.value !== rawText) {
    pasteBox.value = rawText;
    refreshTreePasteControls();
  }
  const list = document.getElementById('tree-import-errors');
  if (list) {
    list.replaceChildren();
    const li = document.createElement('li');
    li.textContent = message;
    list.appendChild(li);
  }
  document.getElementById('tree-import-feedback')?.classList.remove('hidden');
}

function refreshTreePasteControls() {
  const input = document.getElementById('tree-json-paste');
  const btn = document.getElementById('btn-load-pasted-tree');
  if (input && btn) btn.disabled = !input.value.trim();
}

function buildTreeFixPrompt(error) {
  return `The tree JSON you returned could not be loaded:\n- ${error}\n\nPlease fix this and return the complete corrected tree as a valid downloadable .json file (strict JSON object with "topic", "language", and a non-empty "nodes" list), with no preamble or commentary.`;
}

function loadTreeObjectFromModal(obj) {
  if (!obj || !Array.isArray(obj.nodes)) {
    showTreeImportFeedback(t('That file isn\'t a tree — expected a JSON object with a "nodes" list.'));
    return false;
  }
  const rawNodes = obj.nodes.filter(n => n && typeof n === 'object');
  if (!rawNodes.length) {
    showTreeImportFeedback(t('That tree has no nodes.'));
    return false;
  }
  if (!loadFromJSON(obj)) return false;
  if (!state.topic) state.topic = document.getElementById('tree-topic-input').value.trim();
  clearTreeImportFeedback();
  closeTreeModal();
  return true;
}

function importTreeJSONText(raw) {
  const parsed = extractTreeJSON(raw);
  if (!parsed.ok) {
    showTreeImportFeedback(parsed.error, String(raw || '').trim());
    return false;
  }
  return loadTreeObjectFromModal(parsed.obj);
}

async function pasteTreeJSONFromClipboard() {
  const revealManual = () => {
    const manual = document.getElementById('tree-json-manual');
    if (manual) manual.open = true;
    document.getElementById('tree-json-paste')?.focus();
  };
  if (!navigator.clipboard?.readText) {
    revealManual();
    showToast("Couldn't read clipboard automatically — paste the JSON below.");
    return;
  }
  try {
    const text = await navigator.clipboard.readText();
    if (!String(text || '').trim()) {
      showToast("Your clipboard is empty. Copy the AI's finished tree JSON first.");
      return;
    }
    importTreeJSONText(text);
  } catch {
    revealManual();
    showToast("Couldn't read clipboard automatically — paste the JSON below.");
  }
}

function updateTreePromptPreview() {
  const topic = document.getElementById('tree-topic-input').value.trim();
  const language = document.getElementById('tree-language-input').value.trim();
  if (typeof mathBuilderSelection !== 'undefined' && mathBuilderSelection) {
    document.getElementById('tree-collection-scope').classList.toggle('hidden', !mathCollectionPrompt(topic));
  }
  document.getElementById('tree-prompt-box').value = topic
    ? buildTreePrompt(topic, language)
    : t('Fill in a topic above to generate the prompt.');
  const copyBtn = document.getElementById('btn-copy-tree-prompt');
  if (copyBtn) copyBtn.disabled = !topic;
  resetCopyButton('btn-copy-tree-prompt');
}

const TREE_MODAL_META = {
  topic: 'Enter a topic → copy the prompt into an AI chat → bring the .json back',
  file:  'Copy the prompt into an AI chat with your file(s) → bring the .json back',
};

function setTreeMode(mode) {
  document.getElementById('tree-mode-tab-topic').classList.toggle('active', mode === 'topic');
  document.getElementById('tree-mode-tab-file').classList.toggle('active', mode === 'file');
  document.getElementById('tree-mode-topic-panel').classList.toggle('hidden', mode !== 'topic');
  document.getElementById('tree-mode-file-panel').classList.toggle('hidden', mode !== 'file');
  uiText(document.getElementById('tree-modal-meta'), TREE_MODAL_META[mode]);
  if (mode === 'file' && !document.getElementById('tree-file-prompt-box').value) {
    document.getElementById('tree-file-prompt-box').value = buildTreePromptFromFile();
  }
}
document.getElementById('tree-mode-tab-topic').addEventListener('click', () => setTreeMode('topic'));
document.getElementById('tree-mode-tab-file').addEventListener('click', () => setTreeMode('file'));

function openTreeModal() {
  if (typeof resetMathTreeBuilder === 'function') resetMathTreeBuilder();
  const topicDetails = document.getElementById('tree-prompt-details');
  if (topicDetails) topicDetails.open = false;
  const fileDetails = document.getElementById('tree-file-prompt-details');
  if (fileDetails) fileDetails.open = false;
  const manualDetails = document.getElementById('tree-json-manual');
  if (manualDetails) manualDetails.open = false;
  const pasteBox = document.getElementById('tree-json-paste');
  if (pasteBox) pasteBox.value = '';
  clearTreeImportFeedback();
  refreshTreePasteControls();
  resetCopyButton('btn-copy-tree-file-prompt');
  setTreeMode('topic');
  updateTreePromptPreview();
  document.getElementById('tree-modal-backdrop').classList.add('open');
  document.getElementById('tree-topic-input').focus();
}

function closeTreeModal() {
  document.getElementById('tree-modal-backdrop').classList.remove('open');
  clearTreeImportFeedback();
  if (typeof resetMathTreeBuilder === 'function') resetMathTreeBuilder();
}

document.getElementById('menu-new-tree').addEventListener('click', openTreeModal);
document.getElementById('tree-modal-close').addEventListener('click', closeTreeModal);
document.getElementById('tree-modal-backdrop').addEventListener('click', e => {
  if (e.target === document.getElementById('tree-modal-backdrop')) closeTreeModal();
});
document.getElementById('tree-topic-input').addEventListener('input', updateTreePromptPreview);
document.getElementById('tree-language-input').addEventListener('input', updateTreePromptPreview);

document.getElementById('btn-paste-tree-json').addEventListener('click', () => {
  void pasteTreeJSONFromClipboard();
});
document.getElementById('tree-json-paste').addEventListener('input', () => {
  clearTreeImportFeedback();
  refreshTreePasteControls();
});
document.getElementById('btn-load-pasted-tree').addEventListener('click', () => {
  importTreeJSONText(document.getElementById('tree-json-paste').value);
});
document.getElementById('btn-copy-tree-fix').addEventListener('click', () => {
  if (!_pendingTreeError) return;
  const fixPrompt = buildTreeFixPrompt(_pendingTreeError);
  const btn = document.getElementById('btn-copy-tree-fix');
  const markCopied = () => {
    clearTimeout(_copyTimers.get('btn-copy-tree-fix'));
    uiText(btn, 'Copied ✓');
    btn.classList.add('copied');
    _copyTimers.set('btn-copy-tree-fix', setTimeout(() => {
      uiText(btn, 'Copy fix prompt');
      btn.classList.remove('copied');
      _copyTimers.delete('btn-copy-tree-fix');
    }, 2000));
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(fixPrompt).then(markCopied).catch(() => showToast("Couldn't copy automatically — select the prompt text and copy it by hand."));
  } else {
    showToast("Couldn't copy automatically — select the prompt text and copy it by hand.");
  }
});

document.getElementById('tree-json-input').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (file) {
    readJSONFile(file, obj => {
      loadTreeObjectFromModal(obj);
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
const _copyTimers = new Map();
function resetCopyButton(btnId) {
  clearTimeout(_copyTimers.get(btnId));
  _copyTimers.delete(btnId);
  const btn = document.getElementById(btnId);
  const label = btn.dataset.copyLabel || 'Copy';
  const target = btn.querySelector('[data-ui-text]') || btn;
  uiText(target, label);
  btn.classList.remove('copied');
}
function wireCopyButton(btnId, taId) {
  document.getElementById(btnId).addEventListener('click', () => {
    const ta = document.getElementById(taId);
    const onCopied = () => {
      clearTimeout(_copyTimers.get(btnId));
      const btn = document.getElementById(btnId);
      const target = btn.querySelector('[data-ui-text]') || btn;
      uiText(target, 'Copied ✓');
      btn.classList.add('copied');
      _copyTimers.set(btnId, setTimeout(() => resetCopyButton(btnId), 2000));
    };
    const fallbackCopy = () => {
      const details = ta.closest('details');
      const wasClosed = details && !details.open;
      if (wasClosed) details.open = true;
      ta.focus(); ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch {}
      if (wasClosed) details.open = false;
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

// Rebuild app-owned instructions without touching any editable field.
document.addEventListener('ui-language-change', () => {
  updateTreePromptPreview();
  document.getElementById('tree-file-prompt-box').value = buildTreePromptFromFile();
  if (_modalNodeId !== null && state.nodes.has(_modalNodeId)) {
    document.getElementById('prompt-box').value = buildPrompt(_modalNodeId, document.getElementById('node-language-input').value.trim());
  }
});
