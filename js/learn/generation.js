/* Whole-tree lesson generation. The work packet carries shared teaching rules
   once; the AI returns independent JSONL records, committed after each lesson.
   Depends on io.js, prompts.js, library.js, and viewer.js. No AI API is needed. */
const LESSON_RECORD_FORMAT = 'learning-tree-lesson/v1';
const WORK_PACKET_FORMAT = 'learning-tree-work/v1';

// Identity excludes content, node order, and personal progress. Editing a scope,
// label, language, or prerequisite makes old output ineligible for this tree.
function generationTreeKey(tree) {
  const canonical = JSON.stringify({
    topic: tree.topic || '', language: tree.language || '', isSpanish: tree.isSpanish === true,
    nodes: tree.nodes.map(n => ({
      id: String(n.id), label: n.label, explanation: n.explanation || '',
      optional: !!n.optional, requires: [...new Set(n.requires || [])].map(String).sort(),
    })).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  });
  // Two deterministic 32-bit hashes detect accidental mismatches, not authenticity.
  let a = 2166136261, b = 5381;
  for (let i = 0; i < canonical.length; i++) {
    a = Math.imul(a ^ canonical.charCodeAt(i), 16777619);
    b = Math.imul(b, 33) ^ canonical.charCodeAt(i);
  }
  return 'lt1-' + (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

function lessonIsComplete(content) {
  if (typeof content !== 'string' || !/^===\s*(?:SECTION|SECCI[OÓ]N)\s+1[:.]\s*.+?\s*===/i.test(content.trim())) return false;
  // Unclosed blocks and mismatched nesting are common signs of interrupted output.
  const stack = [], ids = new Set();
  const markers = content.matchAll(/\[(\/?)(QUESTION|BONUS|TABLE|TIMELINE|GRAPH)(?:\s+(\d+))?\]/gi);
  for (const [, closing, rawTag, number] of markers) {
    const tag = rawTag.toUpperCase();
    if (closing) { if (stack.pop() !== tag) return false; }
    else {
      if (tag === 'QUESTION' || tag === 'BONUS') {
        if (!number || Number(number) < 1 || ids.has(tag + ':' + Number(number))) return false;
        ids.add(tag + ':' + Number(number));
      }
      stack.push(tag);
    }
  }
  if (stack.length) return false;
  const parsed = parseTxtSession(content);
  if (!parsed.sections.length || !parsed.questions.size) return false;
  const choices = [...parsed.questions.values(), ...parsed.bonuses.values()];
  if (!choices.every(q => q.valid && q.text && Object.keys(q.options).length >= 2 && Object.values(q.options).every(Boolean))) return false;
  // The viewer tolerates malformed questions in legacy files; a new checkpoint
  // must have one answer and no repeated option labels in every choice block.
  for (const [, body] of content.matchAll(/\[(?:QUESTION|BONUS)\s+\d+\]([\s\S]*?)\[\/(?:QUESTION|BONUS)\]/gi)) {
    if ([...body.matchAll(/\[ANSWER:\s*[A-E]\]/gi)].length !== 1) return false;
    const letters = [...body.matchAll(/^\(([A-E])\)\s+/gim)].map(m => m[1].toUpperCase());
    if (new Set(letters).size !== letters.length) return false;
  }
  return true;
}

// Stable topological order. Prefer required topics and continue a ready path
// after its prerequisites rather than generating every foundation first.
function orderGenerationNodes(tree) {
  const byId = new Map(tree.nodes.map(n => [n.id, n]));
  const remaining = new Set(byId.keys()), emitted = new Set(), order = [];
  const positions = new Map(tree.nodes.map((n, i) => [n.id, i]));
  while (remaining.size) {
    const ready = [...remaining].filter(id => (byId.get(id).requires || []).every(p => emitted.has(p)));
    if (!ready.length) throw new Error('The tree needs valid prerequisites before lessons can be generated.');
    ready.sort((a, b) => Number(!!byId.get(a).optional) - Number(!!byId.get(b).optional)
      || (byId.get(b).requires || []).length - (byId.get(a).requires || []).length
      || positions.get(a) - positions.get(b));
    const id = ready[0];
    order.push(id); emitted.add(id); remaining.delete(id);
  }
  return order;
}

function renderGenerationInstructions({ language, sectionKeyword, replySize, spanish }) {
  const protocol = spanish ? `GENERA LECCIONES CON PUNTOS DE GUARDADO

Este archivo contiene un árbol completo y las reglas docentes compartidas una sola vez. tree.nodes contiene el contexto de cada nodo; queue es el orden recomendado y completed contiene lecciones ya disponibles. Genera solo los nodos de queue. Nunca cambies ids, etiquetas, alcances, requisitos ni idioma del árbol. No incluyas progreso personal.

Para cada nodo, usa su label como tema y explanation como objetivo y límite. Los requires identifican lecciones anteriores: usa sus etiquetas y alcances exactos como conocimientos ya enseñados. No supongas conocimientos de hermanos independientes. Los nodos que lo requieren son temas posteriores: no los enseñes ni menciones por nombre. No copies las reglas para cada nodo.

GUARDA CADA LECCIÓN ANTES DE EMPEZAR LA SIGUIENTE
Devuelve un registro JSON independiente por línea (JSONL), sin una lista envolvente, cabecera obligatoria ni cierre global. Cada registro usa exactamente format="${LESSON_RECORD_FORMAT}", treeKey=el valor treeKey de este archivo, id=el id del nodo y content=el texto completo de la lección. Usa un serializador JSON si tienes herramientas; escapa los saltos de línea como \\n, las comillas como \\" y cada barra inversa del texto como \\\\. El contenido decodificado debe conservar LaTeX y todos los marcadores. No incluyas borradores ni registros con contenido incompleto. Revisa la lección, publica o guarda su registro y solo entonces empieza otra. No repitas registros ya terminados en este chat ni los de completed.

SIN HERRAMIENTAS DE ARCHIVOS: publica cada registro terminado inmediatamente en el chat. Puedes usar un bloque de código jsonl por registro; dentro, cada registro ocupa una sola línea física. El máximo por respuesta es ${replySize === 'auto' ? 'lo que quepa con margen' : replySize}. Usa menos si es necesario para terminar bien. No reduzcas la calidad ni el alcance para meter más lecciones. Ante «Continúa», sigue con el próximo nodo pendiente usando estas mismas reglas, sin volver a pedir el prompt. Si te cortan, los registros completos anteriores siguen siendo importables; solo el registro incompleto se pierde. No se puede recuperar texto que nunca hayas publicado o guardado.

CON HERRAMIENTAS DE ARCHIVOS: crea un archivo .jsonl descargable y muéstralo desde el primer registro terminado. Añade y guarda cada registro completo por separado antes de seguir; usa escritura atómica o append de una línea terminada y flush si está disponible. No guardes todo únicamente al final. Sigue por queue mientras puedas; el máximo por respuesta del chat no limita este trabajo. Conserva los puntos de guardado anteriores si falla otra lección. Si hay límite conocido, reserva margen para publicar el último punto guardado. Puedes generar además un árbol JSON utilizable insertando cada content en su nodo de tree y guardándolo atómicamente después de cada lección; conserva la estructura y nunca sustituyas el diario por una reescritura gigante. Los registros JSONL son el respaldo ante un corte.

SI DISPONES DE SUBAGENTES: aprovecha una oleada pequeña de nodos independientes cuyos requisitos ya estén en completed o guardados por el coordinador. Comparte las reglas una vez con cada trabajador y solo el contexto relevante del nodo. Un único coordinador valida y guarda cada resultado en cuanto llegue. No hagas que todos reescriban el árbol ni escriban al mismo archivo. No empieces descendientes antes de guardar sus requisitos. Mantén el orden lógico de aprendizaje y prioriza una ruta utilizable. Sin subagentes, trabaja secuencialmente con el mismo formato.

REGLAS COMPARTIDAS PARA EL TEXTO DECODIFICADO DE CADA content
Las restricciones de texto plano de abajo se aplican al contenido de la lección, no al envoltorio JSONL. El tema y CONTEXTO cambian por nodo; todas las demás reglas siguen iguales.` : `GENERATE LESSONS WITH DURABLE CHECKPOINTS

This file contains the whole tree and the shared teaching rules once. tree.nodes provides each node's context; queue is the recommended order, and completed lists lessons already available. Generate only queue nodes. Never change the tree's ids, labels, scopes, prerequisites, or language. Do not include personal learning progress.

For each node, use label as its topic and explanation as its learning goal and boundary. Its requires point to earlier lessons: use those nodes' exact labels and scopes as already-taught background. Do not assume independent sibling topics. Nodes requiring this one are future material: do not teach them or mention their names. Do not repeat the design rules for each node.

COMMIT EACH LESSON BEFORE STARTING ANOTHER
Return one independent JSON object per line (JSONL), with no enclosing array, required header, or global closing marker. Each record uses exactly format="${LESSON_RECORD_FORMAT}", treeKey=the treeKey in this file, id=the node id, and content=the entire finished lesson text. Use a JSON serializer when tools are available; escape newlines as \\n, quotes as \\" and every literal backslash in lesson text as \\\\. Decoded content must preserve LaTeX and every lesson marker. Never emit drafts or incomplete content records. Review the lesson, publish or save its record, then start the next one. Do not repeat records already completed in this chat or listed in completed.

WITHOUT FILE TOOLS: publish each finished record immediately in the chat. You may use a separate jsonl code fence for each record; each record inside must occupy one physical line. The maximum per reply is ${replySize === 'auto' ? 'as many as safely fit' : replySize}. Use fewer when needed to finish cleanly. Do not reduce lesson quality or scope to fit more nodes. When told Continue, proceed to the next pending node under these same rules without asking for the prompt again. If cut off, earlier complete records remain importable; only the unfinished record is lost. Text never published or saved cannot be recovered.

WITH FILE TOOLS: create a downloadable .jsonl journal and expose it after the first complete record. Append and save each complete record before continuing; use atomic writes or a complete-line append and flush when available. Do not save only at the end. Continue through queue while able; the chat reply maximum does not limit tool-based work. Preserve earlier checkpoints if a later lesson fails. For a known usage limit, reserve room to expose the last saved checkpoint. You may additionally produce a usable tree JSON by inserting each content into its tree node and saving atomically after each lesson; preserve structure, and never replace the journal with one giant rewrite. JSONL records are the interruption fallback.

IF SUBAGENTS ARE AVAILABLE: use a small wave of independent nodes whose prerequisites are already in completed or committed by the coordinator. Share the teaching rules once per worker and only the relevant node context. A single coordinator validates and commits each result as soon as it arrives. Do not have every worker rewrite the whole tree or write to one shared file. Do not start descendants until their prerequisites are committed. Preserve logical learning order and prioritize a usable path. Without subagents, work sequentially using the identical format.

SHARED RULES FOR EACH DECODED content
The plain-text restrictions below apply to lesson content, not its JSONL envelope. The topic and CONTEXT vary by node; every other teaching rule stays the same.`;
  const values = {
    topic: spanish ? 'label del nodo actual' : 'the current node’s label', nodeId: 'CURRENT_NODE_ID',
    sectionKeyword, language,
    deliveryInstruction: spanish
      ? 'Escribe el texto de esta lección como content de un único registro terminado, siguiendo el protocolo de guardado de arriba. No crees un archivo .txt individual.'
      : 'Write this lesson text as content in one completed record under the checkpoint protocol above. Do not create an individual .txt file.',
    treeTopicLine: spanish ? 'El tema global es tree.topic.' : 'The larger subject is tree.topic.',
    explanationLine: spanish ? 'El objetivo y los límites son la explanation del nodo actual.' : 'The learning goal and boundaries are the current node’s explanation.',
    prereqLine: spanish ? 'Usa los labels y explanations de todos los requires del nodo actual como conocimientos ya enseñados. Si no hay requires, es un tema inicial; respeta los conocimientos de entrada descritos en explanation.' : 'Use the labels and explanations of all the current node’s requires as already-taught background. With no requires, this is an entry topic; respect any calibrated starting knowledge stated in explanation.',
    leadsToLine: spanish ? 'No adelantes material de los nodos posteriores que requieren este.' : 'Do not introduce material belonging to later nodes that require this one.',
    languageClause: `\nLANGUAGE\nWrite every lesson in ${language}. Use === ${sectionKeyword} N: TITLE === section headings. Keep QUESTION, ANSWER, BONUS, TABLE, TIMELINE, GRAPH and graph field names in their literal parser syntax.\n`,
  };
  const resumeNote = spanish
    ? 'COPIAS AL RETOMAR: si completed no está vacío, el archivo de trabajo omite deliberadamente el texto de esas lecciones. Un JSON construido solo desde este archivo no contiene todas las lecciones anteriores. Conserva el diario de nuevos registros para fusionarlo en el árbol original; exporta la copia completa desde la app después de importar.'
    : 'RESUME BACKUPS: when completed is nonempty, this work file deliberately omits those lessons’ text. A JSON built only from this packet does not contain all earlier lessons. Keep the journal of new records to merge into the original tree; export the complete backup from the app after importing.';
  return protocol + '\n\n' + resumeNote + '\n\n' + (spanish ? renderNodePromptEs(values) : renderNodePrompt(values));
}

function buildGenerationPacket(language, replySize = '1') {
  const tree = buildTreeJSON(false);
  if (!tree) return null;
  const spanish = state.isSpanish === true || uiLanguage === 'es';
  const lessonLanguage = language || state.language || (spanish ? 'Español' : 'English');
  const allOrder = orderGenerationNodes(tree);
  const liveNodes = [...state.nodes.values()];
  const completed = tree.nodes.filter((_, i) => lessonIsComplete(liveNodes[i]._sessionTxt)).map(n => n.id);
  const ready = new Set(completed);
  return {
    format: WORK_PACKET_FORMAT, treeKey: generationTreeKey(tree),
    instructions: renderGenerationInstructions({ language: lessonLanguage, sectionKeyword: lessonSectionKeyword(lessonLanguage), replySize, spanish }),
    lessonLanguage, tree, completed, queue: allOrder.filter(id => !ready.has(id)),
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
      result.updated++;
      continue;
    }
    // Merge content only: no reload, no layout reset, no changes to progress.
    node._sessionTxt = record.content;
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

function generationStartMessage() {
  return uiLanguage === 'es'
    ? 'Lee el archivo AI work adjunto y sigue sus instructions. Genera queue y guarda inmediatamente cada lección terminada. Usa subagentes si están disponibles. Sin herramientas de archivos, publica registros JSONL completos en el chat y retoma cuando diga «Continúa». No esperes al final para entregar las lecciones.'
    : 'Read the attached AI work file and follow its instructions. Generate its queue and checkpoint each completed lesson immediately. Use subagents if available. Without file tools, emit complete JSONL records in chat and resume when I say Continue. Do not hold finished lessons until the end.';
}

function refreshGenerationStatus() {
  const tree = buildTreeJSON(false);
  const completed = [...state.nodes.values()].filter(n => lessonIsComplete(n._sessionTxt)).length;
  uiText(document.getElementById('generation-status'), `${completed} / ${tree?.nodes.length || 0} lessons ready`);
  document.getElementById('btn-download-ai-work').disabled = !tree;
  document.getElementById('generation-start-message').value = generationStartMessage();
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
  if (!state.nodes.size) { showToast('Load a tree before generating lessons.'); return; }
  closeModal();
  const input = document.getElementById('generation-language');
  input.value = state.language || '';
  if (!generationImportBusy) document.getElementById('generation-replace-existing').checked = false;
  refreshGenerationStatus();
  clearGenerationReceipt();
  document.getElementById('generation-modal-backdrop').classList.add('open');
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
  const packet = buildGenerationPacket(document.getElementById('generation-language').value.trim(), document.getElementById('generation-reply-size').value);
  if (!packet) { showToast('Load a tree before generating lessons.'); return; }
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
  clearGenerationReceipt();
  document.getElementById('generation-output').value = '';
  document.getElementById('generation-replace-existing').checked = false;
  refreshGenerationStatus();
});
