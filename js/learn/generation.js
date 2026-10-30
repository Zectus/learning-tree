/* Whole-tree lesson generation. The work packet carries shared teaching rules
   once; the AI returns independent JSONL records, committed after each lesson.
   Depends on io.js, prompts.js, library.js, and viewer.js. No AI API is needed. */
const LESSON_RECORD_FORMAT = 'learning-tree-lesson/v1';
const WORK_PACKET_FORMAT = 'learning-tree-work/v1';

// Rank levels left-to-right, then by the number of distinct downstream topics.
// The same graph order also guarantees prerequisites precede their descendants.
function generationGraph(tree) {
  const byId = new Map(tree.nodes.map(n => [n.id, n]));
  const depth = new Map(), downstream = new Map(), visiting = new Set();
  function level(id) {
    if (depth.has(id)) return depth.get(id);
    if (!byId.has(id) || visiting.has(id)) throw new Error('The tree needs valid prerequisites before lessons can be generated.');
    visiting.add(id);
    const parents = byId.get(id).requires || [];
    const value = parents.length ? 1 + Math.max(...parents.map(level)) : 0;
    visiting.delete(id); depth.set(id, value); return value;
  }
  tree.nodes.forEach(n => { level(n.id); downstream.set(n.id, new Set()); });
  const positions = new Map(tree.nodes.map((n, i) => [n.id, i]));
  const order = [...byId.keys()].sort((a, b) => depth.get(b) - depth.get(a));
  for (const id of order) for (const parent of byId.get(id).requires || []) {
    downstream.get(parent).add(id);
    downstream.get(id).forEach(child => downstream.get(parent).add(child));
  }
  order.sort((a, b) => depth.get(a) - depth.get(b)
    || downstream.get(b).size - downstream.get(a).size || positions.get(a) - positions.get(b));
  return { order, downstream };
}

function orderGenerationNodes(tree) { return generationGraph(tree).order; }

const generationSelection = { mode: 'auto', count: null, selected: new Set(), draft: new Set() };

function generationQueue(tree, completed, options = generationSelection) {
  const { order } = generationGraph(tree), done = new Set(completed);
  const missing = order.filter(id => !done.has(id));
  const count = options.count == null ? missing.length : Math.max(0, Math.min(missing.length, Math.floor(Number(options.count) || 0)));
  if (options.mode === 'manual') {
    const selected = new Set(options.selected || []);
    return missing.filter(id => selected.has(id)).slice(0, count);
  }
  const byId = new Map(tree.nodes.map(n => [n.id, n]));
  // Only spend slots on optional lessons after all missing required lessons fit.
  const priority = [...missing.filter(id => !byId.get(id).optional), ...missing.filter(id => byId.get(id).optional)];
  const chosen = new Set(priority.slice(0, count));
  return missing.filter(id => chosen.has(id));
}

function renderGenerationInstructions({ language, replySize, queue, completed, tree }) {
  const protocol = `GENERATE LESSONS WITH DURABLE CHECKPOINTS

This file contains the whole tree and the shared teaching rules once. tree.nodes provides each node's context; queue lists only the selected lessons in prerequisite order, and completed lists lessons already available. Generate only queue nodes; all other nodes are context, not additional work. Never change the tree's ids, labels, scopes, prerequisites, or language. Do not include personal learning progress.

For each node, use label as its topic and explanation as its learning goal and boundary. Its requires point to earlier lessons: use those nodes' exact labels and scopes as already-taught background. Do not assume independent sibling topics. Nodes requiring this one are future material: do not teach them or mention their names. Do not repeat the design rules for each node.

COMMIT EACH LESSON BEFORE STARTING ANOTHER
Return one independent JSON object per line (JSONL), with no enclosing array, required header, or global closing marker. Each record uses exactly format="${LESSON_RECORD_FORMAT}", treeKey=the treeKey in this file, id=the node id, and content=the entire finished lesson text. Use a JSON serializer when tools are available; escape newlines as \\n, quotes as \\" and every literal backslash in lesson text as \\\\. Decoded content must preserve LaTeX and every lesson marker. Never emit drafts or incomplete content records. Review the lesson, publish or save its record, then start the next one. Do not repeat records already completed in this chat or listed in completed.

WITHOUT FILE TOOLS: publish each finished record immediately in the chat. You may use a separate jsonl code fence for each record; each record inside must occupy one physical line. The maximum per reply is ${replySize === 'auto' ? 'as many as safely fit' : replySize}. Use fewer when needed to finish cleanly. Do not reduce lesson quality or scope to fit more nodes. When told Continue, proceed to the next pending node under these same rules without asking for the prompt again. If cut off, earlier complete records remain importable; only the unfinished record is lost. Text never published or saved cannot be recovered.

WITH FILE TOOLS: create a downloadable .jsonl journal and expose it after the first complete record. Append and save each complete record before continuing; use atomic writes or a complete-line append and flush when available. Do not save only at the end. Continue through queue while able; the chat reply maximum does not limit tool-based work. Preserve earlier checkpoints if a later lesson fails. For a known usage limit, reserve room to expose the last saved checkpoint. You may additionally produce a usable tree JSON by inserting each content into its tree node and saving atomically after each lesson; preserve structure, and never replace the journal with one giant rewrite. JSONL records are the interruption fallback.

IF SUBAGENTS ARE AVAILABLE: use a small wave of independent queue nodes. Prerequisites outside queue are background context and need no generation. Share the teaching rules once per worker and only the relevant node context. A single coordinator validates and commits each result as soon as it arrives. Do not have every worker rewrite the whole tree or write to one shared file. Do not start descendants until any prerequisites also in queue are committed. Preserve logical learning order and prioritize a usable path. Without subagents, work sequentially using the identical format.

SHARED RULES FOR EACH DECODED content
The plain-text restrictions below apply to lesson content, not its JSONL envelope. The topic and CONTEXT vary by node; every other teaching rule stays the same.`;
  const single = queue.length === 1;
  const graph = generationGraph(tree);
  const parallel = queue.some((id, i) => queue.slice(i + 1).some(other =>
    !graph.downstream.get(id).has(other) && !graph.downstream.get(other).has(id)));
  let tailoredProtocol = protocol;
  if (!parallel) tailoredProtocol = tailoredProtocol.replace(/IF SUBAGENTS ARE AVAILABLE:[\s\S]*?(?=\n\n)/, '');
  if (single) {
    tailoredProtocol = `GENERATE ONE LESSON

Generate only the node in queue. The rest of tree.nodes is context, not additional work. Preserve the tree structure.

Return one JSON record with format="${LESSON_RECORD_FORMAT}", treeKey="${generationTreeKey(tree)}", id="${queue[0]}" and content=the entire finished lesson. Use a JSON serializer to escape newlines, quotes, and backslashes without altering LaTeX. With file tools, deliver a downloadable .jsonl file; otherwise publish the complete record on one physical line inside a jsonl code fence. Review and finish the lesson before delivering it. The plain-text rules below apply to content.`;
    const liveIndex = tree.nodes.findIndex(n => n.id === queue[0]);
    const liveId = [...state.nodes.keys()][liveIndex];
    // Use the actual per-node context rather than placeholders for a one-node job.
    const lessonPrompt = buildPrompt(liveId, language, 'Deliver the lesson as content of the JSON record specified above.');
    return tailoredProtocol + '\n\n' + lessonPrompt;
  }
  const values = {
    topic: 'the current node’s label', nodeId: 'CURRENT_NODE_ID',
    deliveryInstruction: 'Write this lesson text as content in one completed record under the checkpoint protocol above. Do not create an individual .txt file.',
    treeTopicLine: 'The larger subject is tree.topic.',
    explanationLine: 'The learning goal and boundaries are the current node’s explanation.',
    prereqLine: 'Use the labels and explanations of all the current node’s requires as already-taught background. With no requires, this is an entry topic; respect any calibrated starting knowledge stated in explanation.',
    leadsToLine: 'Do not introduce material belonging to later nodes that require this one.',
    languageClause: `\nLANGUAGE\nWrite every lesson in ${language}. Use === SECTION N: TITLE === section headings. Keep QUESTION, ANSWER, BONUS, TABLE, TIMELINE, GRAPH and graph field names in their literal parser syntax.\n`,
  };
  const resumeNote = 'RESUME BACKUPS: when completed is nonempty, this work file deliberately omits those lessons’ text. A JSON built only from this packet does not contain all earlier lessons. Keep the journal of new records to merge into the original tree; export the complete backup from the app after importing.';
  return tailoredProtocol + (completed.length ? '\n\n' + resumeNote : '') + '\n\n' + renderNodePrompt(values);
}

function buildGenerationPacket(language, replySize = '1', options = generationSelection) {
  const tree = buildTreeJSON(false);
  if (!tree) return null;
  const lessonLanguage = language || state.language || (uiLanguage === 'es' ? 'Español' : 'English');
  const liveNodes = [...state.nodes.values()];
  const completed = tree.nodes.filter((_, i) => lessonIsComplete(liveNodes[i]._sessionTxt)).map(n => n.id);
  const queue = generationQueue(tree, completed, options);
  if (replySize !== 'auto') replySize = String(Math.min(Number(replySize) || 1, Math.max(1, queue.length)));
  return {
    format: WORK_PACKET_FORMAT, treeKey: generationTreeKey(tree),
    instructions: renderGenerationInstructions({ language: lessonLanguage, replySize, queue, completed, tree }),
    lessonLanguage, tree, completed, queue,
  };
}

// Accept a journal, a JSON array of records, or an intact filled tree (including
// a work packet whose nested tree was filled by the AI). For
// interrupted replies, parse lines independently so a bad line never consumes
// subsequent records. JSONL content encodes newlines, so one line is one commit.
function readGenerationOutput(raw) {
  const records = [], issues = [];
  if (!String(raw).trim()) return { records, issues }; // No input is not a rejected checkpoint.
  function collect(value) {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (value?.format === LESSON_RECORD_FORMAT) { records.push(value); return; }
    if (value?.format === WORK_PACKET_FORMAT && Array.isArray(value.tree?.nodes)) {
      if (value.treeKey !== generationTreeKey(value.tree)) {
        issues.push('Checkpoint identity does not match its nested tree.');
        return;
      }
      if (!value.tree.nodes.some(n => typeof n?.content === 'string' && n.content.trim())) {
        issues.push('This work file has no lesson text to import. Ask the AI for completed lesson checkpoints.');
        return;
      }
      collect(value.tree);
      return;
    }
    if (value && Array.isArray(value.nodes)) {
      const key = generationTreeKey(value);
      value.nodes.filter(n => typeof n?.content === 'string').forEach(n => records.push({ format: LESSON_RECORD_FORMAT, treeKey: key, id: n.id, content: n.content }));
      return;
    }
    issues.push('Unrecognized checkpoint ignored.');
  }
  const cleaned = String(raw).replace(/^\uFEFF/, '').replace(/^\s*```[^\n]*$/gm, '').trim();
  try { collect(JSON.parse(cleaned)); return { records, issues }; } catch {}
  let candidates = 0;
  for (const line of cleaned.split(/\r?\n/)) {
    const text = line.trim().replace(/,$/, '');
    if (!text.startsWith('{')) continue; // prose, fences, and array wrappers
    candidates++;
    try { collect(JSON.parse(text)); }
    catch { issues.push('Incomplete or invalid checkpoint ignored.'); }
  }
  if (!candidates) issues.push('No complete lesson checkpoints found.');
  return { records, issues };
}

// Answer letters belong to a particular question and option ordering. Keep
// answers only when the numbered question still has the same meaning and key.
function retainUnchangedLessonAnswers(node, content) {
  const before = parseTxtSession(node._sessionTxt || '');
  const after = parseTxtSession(content);
  function signature(choice) {
    if (!choice?.valid) return null;
    const options = Object.entries(choice.options).map(([letter, text]) => [choice.origOf[letter], text]);
    options.sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify([choice.text, options, choice.correctOrig]);
  }
  for (const [field, collection] of [['_sessionAnswers', 'questions'], ['_bonusAnswers', 'bonuses']]) {
    if (!node[field]) continue;
    const kept = {};
    for (const [number, answer] of Object.entries(node[field])) {
      const oldChoice = before[collection].get(Number(number));
      const newChoice = after[collection].get(Number(number));
      const oldSignature = signature(oldChoice);
      if (oldSignature && oldSignature === signature(newChoice)) kept[number] = answer;
    }
    if (Object.keys(kept).length) node[field] = kept;
    else delete node[field];
  }
  delete node._scrollTop;
  // Reopening this node must rebuild the cached viewer with the new lesson.
  if (viewer.nodeId === node.id) { closeViewer(); viewer.nodeId = null; }
}

function mergeGenerationOutput(raw, { replaceExisting = false, beforeReplace } = {}) {
  const { records, issues } = readGenerationOutput(raw);
  const tree = buildTreeJSON(false);
  const result = { imported: 0, updated: 0, existing: 0, rejected: issues.length, issues };
  if (!tree) { result.rejected++; result.issues.push('Load a tree before importing lessons.'); return result; }
  const key = generationTreeKey(tree);
  const live = [...state.nodes.values()];
  const byId = new Map(tree.nodes.map((n, i) => [n.id, live[i]]));
  for (const record of records) {
    const node = byId.get(record.id);
    let error;
    if (record.treeKey !== key) error = 'Checkpoint belongs to a different or edited tree.';
    else if (!node) error = 'Checkpoint names an unknown topic.';
    else if (!lessonIsComplete(record.content)) error = 'Lesson is incomplete or has invalid question markup.';
    if (error) {
      result.rejected++;
      result.issues.push(`${String(record.id || '?')}: ${error}`);
      continue;
    }
    if (node._sessionTxt === record.content) { result.existing++; continue; }
    if (lessonIsComplete(node._sessionTxt)) {
      if (!replaceExisting) { result.existing++; continue; }
      // Back up before changing content or any answers, never for rejected or
      // identical records. File batches share this callback for one backup.
      try { if (beforeReplace) beforeReplace(); }
      catch {
        result.rejected++;
        result.issues.push(`${record.id}: Couldn't download a backup. The existing lesson was kept.`);
        continue;
      }
      retainUnchangedLessonAnswers(node, record.content);
      node._sessionTxt = record.content;
      refreshNodeLessonIndicator(node);
      result.updated++;
      continue;
    }
    // Merge content only: no reload, no layout reset, no changes to progress.
    node._sessionTxt = record.content;
    refreshNodeLessonIndicator(node);
    result.imported++;
  }
  return result;
}

function downloadGenerationFile(value, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function generationImportOptions(replaceExisting = document.getElementById('generation-replace-existing').checked) {
  const backup = replaceExisting ? buildTreeJSON(true) : null;
  let backedUp = false;
  return { replaceExisting, beforeReplace() {
    if (backedUp || state.tutorialActive) return;
    downloadGenerationFile(backup, `${slugify(state.topic || 'tree')}-before-corrections.json`);
    backedUp = true;
  } };
}

function generationStartMessage(packet = buildGenerationPacket()) {
  if (!packet?.queue.length) return '';
  if (packet.queue.length === 1) return 'Read the attached AI work file and generate only the lesson listed in queue. Return the complete JSONL record following its instructions.';
  const message = 'Read the attached AI work file and follow its instructions. Generate its queue and checkpoint each completed lesson immediately. Use subagents if available. Without file tools, emit complete JSONL records in chat and resume when I say Continue. Do not hold finished lessons until the end.';
  return /IF SUBAGENTS ARE AVAILABLE/.test(packet.instructions) ? message
    : message.replace(' Use subagents if available.', '');
}

function currentGenerationPacket() {
  return buildGenerationPacket(document.getElementById('generation-language').value.trim(), document.getElementById('generation-reply-size').value);
}

function refreshGenerationSelection() {
  const missing = [...state.nodes.values()].filter(n => !lessonIsComplete(n._sessionTxt)).length;
  const input = document.getElementById('generation-count');
  input.max = missing;
  input.disabled = !missing;
  if (generationSelection.count !== null) generationSelection.count = Math.min(missing, generationSelection.count);
  input.value = generationSelection.count ?? missing;
  const packet = currentGenerationPacket();
  const manual = generationSelection.mode === 'manual';
  const queue = packet?.queue || [];
  const target = Number(input.value);
  document.getElementById('btn-pick-generation-nodes').classList.toggle('hidden', !manual);
  document.getElementById('btn-pick-generation-nodes').disabled = !missing;
  document.getElementById('generation-selection-help').classList.toggle('hidden', manual);
  document.getElementById('generation-reply-field').classList.toggle('hidden', queue.length <= 1);
  document.getElementById('btn-download-ai-work').disabled = !queue.length || (manual && queue.length !== target);
  uiText(document.getElementById('generation-selection-status'), `${queue.length} / ${target} nodes selected`);
  const preview = document.getElementById('generation-selection-preview');
  preview.replaceChildren();
  for (const id of queue) {
    const li = document.createElement('li');
    li.textContent = packet.tree.nodes.find(n => n.id === id).label;
    preview.appendChild(li);
  }
  document.getElementById('generation-start-message').value = generationStartMessage(packet);
  uiText(document.getElementById('generation-chat-help'), queue.length <= 1
    ? 'Return the finished lesson as one JSONL record, then import it below.'
    : 'In the same chat, say Continue for the next selected lessons. Save or publish each finished lesson before starting another.');
  document.dispatchEvent(new Event('generation-selection-change'));
}

function beginGenerationPicking() {
  generationSelection.draft = new Set(currentGenerationPacket()?.queue || []);
  state.generationPicking = true;
  generationSelection.previousMode = state.mode;
  setMode('browse');
  closeViewer();
  closeGenerationModal();
  closeAllDropdowns();
  document.body.classList.add('generation-picking');
  document.getElementById('toolbar').inert = true;
  document.getElementById('generation-pick-bar').classList.remove('hidden');
  refreshGenerationPicking();
  requestAnimationFrame(() => document.getElementById('btn-cancel-generation-pick').focus());
}

function refreshGenerationPicking() {
  const tree = buildTreeJSON(false);
  const live = [...state.nodes.values()];
  const limit = Number(document.getElementById('generation-count').value);
  tree.nodes.forEach((n, i) => {
    const node = live[i], hasLesson = lessonIsComplete(node._sessionTxt);
    const selected = generationSelection.draft.has(n.id);
    node.el.classList.toggle('generation-selected', selected);
    node.el.classList.toggle('generation-has-lesson', hasLesson);
    node.el.setAttribute('aria-pressed', String(selected));
    node.el.setAttribute('aria-disabled', String(hasLesson));
  });
  uiText(document.getElementById('generation-pick-status'), `${generationSelection.draft.size} / ${limit} nodes selected`);
  document.getElementById('btn-confirm-generation-pick').disabled = generationSelection.draft.size !== limit || !limit;
}

function toggleGenerationNode(id) {
  const node = state.nodes.get(id);
  if (!node || lessonIsComplete(node._sessionTxt)) return;
  const tree = buildTreeJSON(false);
  const slug = tree.nodes[[...state.nodes.keys()].indexOf(id)].id;
  if (generationSelection.draft.has(slug)) generationSelection.draft.delete(slug);
  else {
    if (generationSelection.draft.size >= Number(document.getElementById('generation-count').value)) {
      showToast('Selection is full. Deselect a node to choose another.'); return;
    }
    generationSelection.draft.add(slug);
  }
  refreshGenerationPicking();
}

function finishGenerationPicking(save, reopen = true) {
  if (!state.generationPicking) return;
  if (save) generationSelection.selected = new Set(generationSelection.draft);
  state.generationPicking = false;
  document.body.classList.remove('generation-picking');
  document.getElementById('toolbar').inert = false;
  document.getElementById('generation-pick-bar').classList.add('hidden');
  state.nodes.forEach(node => {
    node.el?.classList.remove('generation-selected', 'generation-has-lesson');
    node.el?.removeAttribute('aria-pressed');
  });
  setMode(generationSelection.previousMode || 'browse');
  if (reopen) {
    refreshGenerationStatus();
    document.getElementById('generation-modal-backdrop').classList.add('open');
  }
}

document.getElementById('generation-count').addEventListener('input', e => {
  const max = Number(e.target.max);
  generationSelection.count = Math.max(max ? 1 : 0, Math.min(max, Math.floor(Number(e.target.value) || 1)));
  refreshGenerationSelection();
});
document.getElementById('generation-selection-mode').addEventListener('change', e => {
  generationSelection.mode = e.target.value;
  refreshGenerationSelection();
});
for (const id of ['generation-language', 'generation-reply-size']) {
  document.getElementById(id).addEventListener('input', refreshGenerationSelection);
}
document.getElementById('btn-pick-generation-nodes').addEventListener('click', beginGenerationPicking);
document.getElementById('btn-confirm-generation-pick').addEventListener('click', () => finishGenerationPicking(true));
document.getElementById('btn-cancel-generation-pick').addEventListener('click', () => finishGenerationPicking(false));
onEscape(120, () => {
  if (!state.generationPicking) return false;
  finishGenerationPicking(false); return true;
});

function refreshGenerationStatus() {
  const tree = buildTreeJSON(false);
  const completed = [...state.nodes.values()].filter(n => lessonIsComplete(n._sessionTxt)).length;
  uiText(document.getElementById('generation-status'), `${completed} / ${tree?.nodes.length || 0} lessons ready`);
  refreshGenerationSelection();
  refreshGenerationImportControls();
}

let generationImportBusy = false;
function refreshGenerationImportControls() {
  document.getElementById('btn-import-generation').disabled = generationImportBusy
    || !document.getElementById('generation-output').value.trim();
  document.getElementById('generation-files').disabled = generationImportBusy;
  document.getElementById('generation-replace-existing').disabled = generationImportBusy;
}

function clearGenerationReceipt() {
  uiText(document.getElementById('generation-result'), '');
  uiText(document.getElementById('generation-import-source'), '');
  document.getElementById('generation-issues').replaceChildren();
  document.getElementById('generation-import-details').classList.add('hidden');
}

function openGenerationModal() {
  if (!state.nodes.size && !state.assistantAvailable) { showToast('Load a tree before generating lessons.'); return; }
  closeModal();
  const input = document.getElementById('generation-language');
  input.value = state.language || '';
  if (!generationImportBusy) document.getElementById('generation-replace-existing').checked = false;
  refreshGenerationStatus();
  clearGenerationReceipt();
  document.getElementById('generation-modal-backdrop').classList.add('open');
  document.dispatchEvent(new Event('generation-opened'));
}
function closeGenerationModal() {
  document.getElementById('generation-modal-backdrop').classList.remove('open');
}

function finishGenerationImport(result, source = 'Pasted reply') {
  refreshGenerationStatus();
  uiText(document.getElementById('generation-import-source'), `Last import: ${source}`);
  uiText(document.getElementById('generation-result'), result.updated
    ? `${result.imported} lessons imported; ${result.updated} corrected; ${result.existing} already present; ${result.rejected} rejected.`
    : `${result.imported} lessons imported; ${result.existing} already present; ${result.rejected} rejected.`);
  document.getElementById('generation-replace-existing').checked = false;
  const list = document.getElementById('generation-issues');
  list.replaceChildren();
  for (const issue of result.issues) {
    const li = document.createElement('li'); uiText(li, issue); list.appendChild(li);
  }
  document.getElementById('generation-import-details').classList.toggle('hidden', !result.issues.length);
  if ((result.imported || result.updated) && !state.tutorialActive) {
    // Checkpoint immediately using the existing local/cloud outbox path. It
    // retains a local backup before a cloud write and reports storage failures.
    autosaveTreeOnPageExit();
    if (result.updated) { autoSaveProgress(); void persistProgressNow(); }
    if (!libraryReady) showToast('Lessons are in this tree. Download a copy while saved trees are still loading.');
  }
}

document.getElementById('menu-generate-lessons').addEventListener('click', openGenerationModal);
document.getElementById('btn-generate-tree-lessons').addEventListener('click', openGenerationModal);
document.getElementById('generation-close').addEventListener('click', closeGenerationModal);
document.getElementById('generation-modal-backdrop').addEventListener('click', e => {
  if (e.target.id === 'generation-modal-backdrop') closeGenerationModal();
});
document.getElementById('btn-download-ai-work').addEventListener('click', () => {
  const packet = currentGenerationPacket();
  if (!packet?.queue.length) return;
  if (generationSelection.mode === 'manual' && packet.queue.length !== Number(document.getElementById('generation-count').value)) return;
  downloadGenerationFile(packet, `${slugify(state.topic || 'tree')}-ai-work.json`);
});
document.getElementById('btn-export-generation-tree').addEventListener('click', () => exportToJSON(true));
document.getElementById('btn-import-generation').addEventListener('click', () => {
  const raw = document.getElementById('generation-output').value;
  if (generationImportBusy || !raw.trim()) return;
  finishGenerationImport(mergeGenerationOutput(raw, generationImportOptions()));
});
document.getElementById('generation-output').addEventListener('input', refreshGenerationImportControls);
document.getElementById('generation-files').addEventListener('change', async e => {
  const files = [...e.target.files];
  e.target.value = '';
  if (!files.length || generationImportBusy) return;
  const expectedTree = buildTreeJSON(false);
  const expectedKey = expectedTree && generationTreeKey(expectedTree);
  const expectedNodes = [...state.nodes.values()];
  const replaceExisting = document.getElementById('generation-replace-existing').checked;
  generationImportBusy = true;
  refreshGenerationImportControls();
  // Read independently, then merge in selection order so repeated imports and
  // parallel worker output have deterministic, first-complete-record behavior.
  const reads = await Promise.allSettled(files.map(file => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsText(file);
  })));
  generationImportBusy = false;
  refreshGenerationImportControls();
  const current = buildTreeJSON(false);
  if (!current || generationTreeKey(current) !== expectedKey
    || expectedNodes.some(node => state.nodes.get(node.id) !== node)) {
    showToast('The tree changed while files were loading. Select them again.'); return;
  }
  // Capture the original content after reading, before any batch record merges.
  // This includes lesson edits made while files loaded and preserves the mode
  // selected when the upload began, even if the panel has since been reopened.
  const options = generationImportOptions(replaceExisting);
  const total = { imported: 0, updated: 0, existing: 0, rejected: 0, issues: [] };
  reads.forEach((read, i) => {
    if (read.status === 'rejected') { total.issues.push(`Couldn't read "${files[i].name}".`); total.rejected++; return; }
    const result = mergeGenerationOutput(read.value, options);
    for (const key of ['imported', 'updated', 'existing', 'rejected']) total[key] += result[key];
    total.issues.push(...result.issues);
  });
  finishGenerationImport(total, files.map(file => file.name).join(', '));
});
wireCopyButton('btn-copy-generation-message', 'generation-start-message');
onEscape(110, () => {
  if (!document.getElementById('generation-modal-backdrop').classList.contains('open')) return false;
  closeGenerationModal(); return true;
});
document.addEventListener('ui-language-change', refreshGenerationStatus);
document.addEventListener('tree-loaded', () => {
  if (state.generationPicking) finishGenerationPicking(false, false);
  generationSelection.count = null;
  generationSelection.mode = 'auto';
  generationSelection.selected.clear();
  document.getElementById('generation-selection-mode').value = 'auto';
  clearGenerationReceipt();
  document.getElementById('generation-output').value = '';
  document.getElementById('generation-replace-existing').checked = false;
  refreshGenerationStatus();
});
