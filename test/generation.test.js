const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const lesson = '=== SECTION 1: A usable idea ===\n\nAn explanation with \\( x \\), a worked use, and a fresh question.\n\n[QUESTION 1]\n[ANSWER: B]\nChoose the matching case.\n\n(A) First\n(B) Second\n(C) Third\n(D) Fourth\n(E) Fifth\n[/QUESTION]\n';
const el = (app, id) => app.document.getElementById(id);
function paste(app, raw) {
  el(app, 'generation-output').value = raw;
  el(app, 'generation-output').dispatchEvent(new app.window.Event('input', { bubbles: true }));
}
function loadTree(app, fixture = 'mini-tree.json') {
  app.window.__tree = app.fixture(fixture);
  assert.equal(app.ev('loadFromJSON(JSON.parse(__tree))'), true);
}
function packet(app) { return JSON.parse(app.ev('JSON.stringify(buildGenerationPacket())')); }
function record(app, id, content = lesson, overrides = {}) {
  return JSON.stringify({ format: 'learning-tree-lesson/v1', treeKey: packet(app).treeKey, id, content, ...overrides });
}
function merge(app, raw, options = {}) {
  app.window.__output = raw;
  app.window.__mergeOptions = options;
  return JSON.parse(app.ev('JSON.stringify(mergeGenerationOutput(__output, __mergeOptions))'));
}

test('one work packet reuses teaching rules and queues missing lessons without personal data', () => {
  const app = loadApp();
  try {
    loadTree(app);
    app.ev(`state.nodes.get(1).done=true; state.nodes.get(1)._notes='PRIVATE'; state.nodes.get(1)._sessionAnswers={1:'A'};`);
    const work = packet(app);
    assert.equal(work.format, 'learning-tree-work/v1');
    assert.deepEqual(work.completed, ['b']);
    assert.deepEqual(work.queue, ['a', 'c', 'd']);
    assert.equal((work.instructions.match(/PLAN FIRST/g) || []).length, 1);
    assert.match(work.instructions, /QUESTION CONSTRUCTION RULES/);
    for (const node of work.tree.nodes) {
      assert.equal(node.content, undefined);
      assert.equal(node.done, undefined);
    }
    assert.ok(!JSON.stringify(work).includes('PRIVATE'));
    assert.match(work.instructions, /WITHOUT FILE TOOLS/);
    assert.match(work.instructions, /WITH FILE TOOLS/);
    assert.doesNotMatch(work.instructions, /IF SUBAGENTS ARE AVAILABLE/); // This fixture is one chain.
    assert.match(work.instructions, /maximum per reply is 1/);
    assert.match(work.instructions, /Do not create an individual \.txt file/);
    assert.doesNotMatch(work.instructions, /Deliver this as a downloadable file named/);
  } finally { app.window.close(); }
});

test('a cut-off response recovers every complete record and leaves the unfinished node pending', async () => {
  const app = loadApp();
  try {
    loadTree(app);
    const first = record(app, 'a');
    const unfinished = record(app, 'c').slice(0, -40);
    const result = merge(app, `Here are the lessons:\n\n\`\`\`jsonl\n${first}\n${unfinished}`);
    assert.equal(result.imported, 1);
    assert.equal(result.rejected, 1);
    assert.match(result.issues[0], /Incomplete/);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(app.ev('state.nodes.get(3)._sessionTxt'), undefined);
    assert.deepEqual(packet(app).queue, ['c', 'd']);
    const usable = JSON.parse(app.ev('JSON.stringify(buildTreeJSON(true))'));
    assert.equal(usable.nodes.length, 4);
    assert.equal(usable.nodes.filter(n => n.content).length, 2);
    app.ev('openViewer(state.nodes.get(1)._sessionTxt, 1)');
    assert.equal(app.ev('viewer.total'), 1);
    assert.match(el(app, 'sv-body').textContent, /Choose the matching case/);
    await tick(); // allow viewer rendering/focus observers to finish before closing jsdom
  } finally { app.window.close(); }
});

test('malformed middle lines, duplicate imports and out-of-order workers do not lose completed lessons', () => {
  const app = loadApp();
  try {
    loadTree(app);
    const third = record(app, 'c');
    const first = record(app, 'a');
    const result = merge(app, `${third}\n{"format":"learning-tree-lesson/v1","content":"broken\n${first}\n${third}\n`);
    assert.equal(result.imported, 2);
    assert.equal(result.existing, 1);
    assert.equal(result.rejected, 1);
    assert.deepEqual(packet(app).queue, ['d']);
    assert.equal(merge(app, `${first}\n${third}`).existing, 2);
    assert.equal(merge(app, record(app, 'a', lesson.replace('An explanation', 'A different explanation'))).existing, 1);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
  } finally { app.window.close(); }
});

test('foreign, stale, unknown, and incomplete records leave the tree and learner progress untouched', () => {
  const app = loadApp();
  try {
    loadTree(app);
    app.ev(`state.nodes.get(1).done=true; state.nodes.get(1)._notes='keep'; state.nodes.get(1)._drawing=[{color:'red'}]; state.nodes.get(1)._sessionAnswers={1:'A'}; state.viewport.x=731; state.libraryId='saved';`);
    const before = app.ev('JSON.stringify({tree:buildTreeJSON(true), answers:state.nodes.get(1)._sessionAnswers, notes:state.nodes.get(1)._notes, drawing:state.nodes.get(1)._drawing, viewport:state.viewport, libraryId:state.libraryId, done:state.nodes.get(1).done})');
    const stale = record(app, 'a');
    const output = [
      record(app, 'a', lesson, { treeKey: 'another-tree' }),
      record(app, 'unknown'),
      record(app, 'a', lesson + '[GRAPH]\ntype: function2d'),
      record(app, 'a', lesson.replace('[ANSWER: B]', '[ANSWER: Z]')),
      record(app, 'a', lesson + lesson),
    ].join('\n');
    const result = merge(app, output);
    assert.equal(result.imported, 0);
    assert.equal(result.rejected, 5);
    assert.equal(before, app.ev('JSON.stringify({tree:buildTreeJSON(true), answers:state.nodes.get(1)._sessionAnswers, notes:state.nodes.get(1)._notes, drawing:state.nodes.get(1)._drawing, viewport:state.viewport, libraryId:state.libraryId, done:state.nodes.get(1).done})'));
    app.ev("state.nodes.get(1).explanation='Edited scope'");
    assert.equal(merge(app, stale).rejected, 1);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), undefined);
    assert.equal(merge(app, record(app, 'a')).imported, 1);
    assert.equal(app.ev('state.nodes.get(1)._notes'), 'keep');
    assert.equal(app.ev('state.nodes.get(1)._sessionAnswers[1]'), 'A');
    assert.equal(app.ev('state.nodes.get(1).done'), true);
    assert.equal(app.ev('state.libraryId'), 'saved');
    assert.equal(app.ev('state.viewport.x'), 731);
  } finally { app.window.close(); }
});

test('resume identity survives lesson imports, tree reordering, content export, and reopening', () => {
  const app = loadApp();
  const resumed = loadApp();
  try {
    loadTree(app);
    const key = packet(app).treeKey;
    assert.equal(merge(app, record(app, 'a')).imported, 1);
    assert.equal(packet(app).treeKey, key);
    app.ev(`state.nodes=new Map([...state.nodes].reverse())`);
    assert.equal(packet(app).treeKey, key);
    resumed.window.__tree = app.ev('JSON.stringify(buildTreeJSON(true))');
    resumed.ev('loadFromJSON(JSON.parse(__tree))');
    assert.equal(packet(resumed).treeKey, key);
    assert.deepEqual(packet(resumed).completed.sort(), ['a', 'b']);
    assert.deepEqual(packet(resumed).queue, ['c', 'd']);
    assert.equal(merge(resumed, record(app, 'c')).imported, 1);
  } finally { app.window.close(); resumed.window.close(); }
});

test('intact filled-tree JSON and record arrays merge lessons while preserving the current tree', () => {
  const app = loadApp();
  try {
    loadTree(app);
    const filled = packet(app).tree;
    filled.nodes.find(n => n.id === 'a').content = lesson;
    filled.nodes.find(n => n.id === 'a').done = true;
    assert.equal(merge(app, JSON.stringify(filled, null, 2)).imported, 1);
    assert.equal(app.ev('state.nodes.get(1).done'), false);
    assert.equal(merge(app, `[${record(app, 'c')},${record(app, 'd')}]`).imported, 2);
    assert.deepEqual(packet(app).queue, []);
    filled.nodes.find(n => n.id === 'a').label = 'Changed';
    assert.equal(merge(app, JSON.stringify(filled)).rejected, 1);
    assert.equal(app.ev('state.nodes.get(1).label'), 'Alpha');
  } finally { app.window.close(); }
});

test('AI work-file checkpoints import nested lessons and resume from actual content', () => {
  const app = loadApp();
  try {
    loadTree(app);
    const work = packet(app);
    work.tree.nodes.find(n => n.id === 'a').content = lesson;
    work.completed = ['a', 'b', 'c']; // claimed completion alone must not import c
    work.queue = ['d'];
    const result = merge(app, JSON.stringify(work, null, 2));
    assert.equal(result.imported, 1);
    assert.equal(result.rejected, 0);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(app.ev('state.nodes.get(3)._sessionTxt'), undefined);
    assert.deepEqual(packet(app).queue, ['c', 'd']);
    assert.equal(merge(app, JSON.stringify(work)).existing, 1);
    app.ev("state.nodes.get(1).explanation='Edited scope'");
    assert.match(merge(app, JSON.stringify(work)).issues[0], /different or edited tree/);
  } finally { app.window.close(); }
});

test('wrapped checkpoints reject mismatched identities and explain work files without lesson text', () => {
  const app = loadApp();
  try {
    loadTree(app);
    const work = packet(app);
    assert.match(merge(app, JSON.stringify(work)).issues[0], /no lesson text to import/);
    work.tree.nodes.find(n => n.id === 'a').content = lesson;
    work.treeKey = 'wrong-identity';
    const result = merge(app, JSON.stringify(work));
    assert.equal(result.imported, 0);
    assert.equal(result.rejected, 1);
    assert.match(result.issues[0], /identity does not match its nested tree/);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), undefined);
  } finally { app.window.close(); }
});

test('generation panel downloads one packet, imports pasted output, checkpoints to My Trees, and closes with Escape', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    app.ev('openLearnModal(1)');
    assert.equal(el(app, 'single-lesson-controls').open, false);
    el(app, 'btn-generate-tree-lessons').click();
    assert.equal(el(app, 'modal-backdrop').classList.contains('open'), false);
    assert.equal(el(app, 'generation-modal-backdrop').classList.contains('open'), true);
    assert.equal(el(app, 'generation-status').textContent, '1 / 4 lessons ready');
    let downloaded, filename;
    app.window.URL.createObjectURL = blob => { downloaded = blob; return 'blob:test'; };
    app.window.URL.revokeObjectURL = () => {};
    app.window.HTMLAnchorElement.prototype.click = function () { filename = this.download; };
    el(app, 'btn-download-ai-work').click();
    assert.equal(filename, 'mini-ai-work.json');
    const text = await new Promise(resolve => { const reader = new app.window.FileReader(); reader.onload = e => resolve(e.target.result); reader.readAsText(downloaded); });
    assert.equal(JSON.parse(text).queue.length, 3);
    paste(app, record(app, 'a') + '\n{"format":"cut off');
    el(app, 'btn-import-generation').click();
    assert.equal(el(app, 'generation-status').textContent, '2 / 4 lessons ready');
    assert.match(el(app, 'generation-result').textContent, /1 lessons imported.*1 rejected/);
    assert.equal(el(app, 'generation-import-details').classList.contains('hidden'), false);
    const saved = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(Object.values(saved).length, 1);
    assert.equal(Object.values(saved)[0].data.nodes.find(n => n.id === 'a').content, lesson);
    app.press('Escape');
    assert.equal(el(app, 'generation-modal-backdrop').classList.contains('open'), false);
    app.ev("setUILanguage('es')");
    el(app, 'menu-generate-lessons').click();
    assert.match(el(app, 'generation-status').textContent, /2 \/ 4 lecciones disponibles/);
    assert.match(el(app, 'generation-start-message').value, /Read the attached AI work file/);
    // Error details retranslate as app-owned text, while ids and lesson content stay intact.
    paste(app, record(app, 'unknown'));
    el(app, 'btn-import-generation').click();
    assert.match(el(app, 'generation-issues').textContent, /unknown: el registro señala un tema desconocido/);
    app.ev("setUILanguage('en')");
    assert.match(el(app, 'generation-issues').textContent, /unknown: Checkpoint names an unknown topic/);
  } finally { app.window.close(); }
});

test('multiple worker files import together and a tree switch during reads cannot attach to the new tree', async () => {
  const app = loadApp();
  try {
    loadTree(app);
    const input = el(app, 'generation-files');
    const files = [new app.window.File([record(app, 'c')], 'worker-1.jsonl'), new app.window.File([record(app, 'a')], 'worker-2.jsonl')];
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    input.dispatchEvent(new app.window.Event('change'));
    for (let i = 0; i < 15 && !app.ev('state.nodes.get(1)._sessionTxt'); i++) await tick();
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(app.ev('state.nodes.get(3)._sessionTxt'), lesson);
    Object.defineProperty(input, 'files', { configurable: true, value: [new app.window.File([record(app, 'd')], 'later.jsonl')] });
    input.dispatchEvent(new app.window.Event('change'));
    app.ev("loadFromJSON({topic:'Other',nodes:[{id:'d',label:'Other topic'}]})");
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), undefined);
    assert.match(app.toasts().join(' '), /tree changed while files were loading/);
  } finally { app.window.close(); }
});

test('the real AI checkpoint reports 29 imports and empty paste or canceled uploads cannot replace that receipt', async () => {
  const app = loadApp();
  try {
    loadTree(app, 'quantum-tree.json'); await tick();
    app.ev('openGenerationModal()');
    const input = el(app, 'generation-files');
    const file = new app.window.File([app.fixture('quantum-checkpoint.json')], 'quantum_mechanics-checkpoint.json');
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new app.window.Event('change'));
    assert.equal(input.disabled, true);
    assert.equal(el(app, 'btn-import-generation').disabled, true);
    for (let i = 0; i < 50 && !el(app, 'generation-result').textContent; i++) await tick();
    const receipt = '29 lessons imported; 0 already present; 0 rejected.';
    assert.equal(el(app, 'generation-result').textContent, receipt);
    assert.equal(el(app, 'generation-status').textContent, '29 / 95 lessons ready');
    assert.equal(el(app, 'generation-import-source').textContent, 'Last import: quantum_mechanics-checkpoint.json');
    assert.equal(el(app, 'generation-issues').children.length, 0);
    assert.equal(el(app, 'generation-import-details').classList.contains('hidden'), true);
    assert.equal(app.ev('buildGenerationPacket().queue.length'), 66);
    assert.equal(el(app, 'btn-import-generation').disabled, true);
    // Exercise both the disabled button and the defensive handler guard.
    el(app, 'btn-import-generation').click();
    el(app, 'btn-import-generation').dispatchEvent(new app.window.Event('click'));
    Object.defineProperty(input, 'files', { configurable: true, value: [] });
    input.dispatchEvent(new app.window.Event('change')); await tick();
    assert.equal(el(app, 'generation-result').textContent, receipt);
    assert.equal(el(app, 'generation-issues').children.length, 0);
    paste(app, ' \n\t');
    assert.equal(el(app, 'btn-import-generation').disabled, true);
    assert.equal(el(app, 'generation-result').textContent, receipt);
    // Re-imports describe existing lessons accurately; they do not regenerate.
    Object.defineProperty(input, 'files', { configurable: true, value: [file] });
    input.dispatchEvent(new app.window.Event('change'));
    for (let i = 0; i < 50 && input.disabled; i++) await tick();
    assert.equal(el(app, 'generation-result').textContent, '0 lessons imported; 29 already present; 0 rejected.');
    assert.equal(app.ev('buildGenerationPacket().completed.length'), 29);
    const stored = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(Object.values(stored)[0].data.nodes.filter(n => n.content).length, 29);
  } finally { app.window.close(); }
});

test('paste results are separate from file results and another tree cannot inherit old import errors', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick(); app.ev('openGenerationModal()');
    assert.equal(el(app, 'btn-import-generation').disabled, true);
    paste(app, record(app, 'unknown'));
    assert.equal(el(app, 'btn-import-generation').disabled, false);
    el(app, 'btn-import-generation').click();
    assert.equal(el(app, 'generation-import-source').textContent, 'Last import: Pasted reply');
    assert.match(el(app, 'generation-issues').textContent, /unknown topic/);
    app.ev("setUILanguage('es')");
    assert.equal(el(app, 'generation-import-source').textContent, 'Última importación: respuesta pegada');
    app.ev("loadFromJSON({topic:'Other',nodes:[{id:'other',label:'Other'}]})");
    assert.equal(el(app, 'generation-result').textContent, '');
    assert.equal(el(app, 'generation-import-source').textContent, '');
    assert.equal(el(app, 'generation-issues').children.length, 0);
    assert.equal(el(app, 'generation-output').value, '');
    assert.equal(el(app, 'btn-import-generation').disabled, true);
  } finally { app.window.close(); }
});

test('batch rules always use English instructions and preserve the requested lesson language', () => {
  const app = loadApp();
  try {
    loadTree(app);
    app.ev("setUILanguage('es')");
    let work = packet(app);
    assert.match(work.instructions, /GENERATE LESSONS/);
    assert.match(work.instructions, /You are producing a plain-text/);
    assert.match(work.instructions, /=== SECTION N:/);
    assert.doesNotMatch(work.instructions, /Deliver this as a downloadable file named/);
    work = JSON.parse(app.ev("JSON.stringify(buildGenerationPacket('Español de Perú','3'))"));
    assert.match(work.instructions, /=== SECTION N:/);
    assert.match(work.instructions, /maximum per reply is 3/);
    assert.equal(work.lessonLanguage, 'Español de Perú');
    assert.equal(work.tree.language, 'English');
  } finally { app.window.close(); }
});

test('an imported checkpoint keeps a local cloud outbox backup when sync fails', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    app.window.cloud = { setLibraryEntry: async () => { throw new Error('Offline'); } };
    app.ev("state.accountUser={uid:'checkpoint-user'}; librarySource='cloud'; openGenerationModal()");
    paste(app, record(app, 'a'));
    el(app, 'btn-import-generation').click();
    await tick();
    const outbox = JSON.parse(app.window.localStorage.getItem('tree-library-exit-checkpoint-user'));
    assert.equal(Object.keys(outbox).length, 1);
    assert.equal(Object.values(outbox)[0].data.nodes.find(n => n.id === 'a').content, lesson);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
  } finally { app.window.close(); }
});

test('blocked browser storage reports the failed checkpoint while a usable export stays available', async () => {
  const app = loadApp({ storageUnavailable: true });
  try {
    // With blocked storage the first-visit tutorial cannot remember dismissal.
    // Exit it through the real UI before exercising the user's import flow.
    el(app, 'tutorial-skip').click(); await tick();
    loadTree(app); await tick();
    app.ev('openGenerationModal()');
    paste(app, record(app, 'a'));
    el(app, 'btn-import-generation').click();
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(app.ev('buildTreeJSON(true).nodes.find(n=>n.id === "a").content'), lesson);
    assert.match(app.toasts().join(' '), /storage is full or blocked.*Export the tree/);
  } finally { app.window.close(); }
});

test('tutorial sample imports never replace real checkpoint output or saved-tree state', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    app.ev('openGenerationModal()');
    const raw = record(app, 'a') + '\n{"format":"unfinished';
    paste(app, raw);
    el(app, 'btn-import-generation').click();
    el(app, 'generation-import-details').open = true;
    const issues = el(app, 'generation-issues').firstChild;
    const result = el(app, 'generation-result').textContent;
    const library = app.window.localStorage.getItem('tree-library');
    el(app, 'generation-replace-existing').checked = true;
    el(app, 'menu-tutorial').click();
    const { goToStep } = require('./tutorial-navigation');
    await goToStep(app, 7);
    el(app, 'btn-import-generation').click(); await tick();
    assert.equal(app.window.localStorage.getItem('tree-library'), library);
    el(app, 'tutorial-skip').click(); await tick();
    assert.equal(el(app, 'generation-modal-backdrop').classList.contains('open'), true);
    assert.equal(el(app, 'generation-output').value, raw);
    assert.equal(el(app, 'generation-result').textContent, result);
    assert.equal(el(app, 'generation-issues').firstChild, issues);
    assert.equal(el(app, 'generation-import-details').open, true);
    assert.equal(el(app, 'generation-replace-existing').checked, true);
    assert.equal(el(app, 'generation-status').textContent, '2 / 4 lessons ready');
    assert.equal(app.window.localStorage.getItem('tree-library'), library);
  } finally { app.window.close(); }
});

test('the 95-node quantum tree produces a valid order and resumes after a small interruption test', () => {
  const app = loadApp();
  try {
    loadTree(app, 'quantum-tree.json');
    const work = packet(app);
    assert.equal(work.tree.nodes.length, 95);
    assert.equal(work.queue.length, 95);
    const positions = new Map(work.queue.map((id, i) => [id, i]));
    for (const node of work.tree.nodes) for (const prerequisite of node.requires || []) {
      assert.ok(positions.get(prerequisite) < positions.get(node.id), `${prerequisite} must precede ${node.id}`);
    }
    const [first, second, third] = work.queue;
    const result = merge(app, record(app, first) + '\n' + record(app, second) + '\n' + record(app, third).slice(0, -7));
    assert.equal(result.imported, 2);
    assert.equal(result.rejected, 1);
    const resumed = packet(app);
    assert.equal(resumed.queue.length, 93);
    assert.equal(resumed.queue[0], third);
    assert.equal(resumed.treeKey, work.treeKey);
    assert.equal(app.ev('buildTreeJSON(true).nodes.filter(n=>n.content).length'), 2);
  } finally { app.window.close(); }
});

test('corrections are explicit, validated, idempotent, and retain answers only for unchanged choices', async () => {
  const app = loadApp();
  try {
    loadTree(app);
    const second = lesson.match(/\[QUESTION 1\][\s\S]*?\[\/QUESTION\]/)[0].replace('QUESTION 1', 'QUESTION 2');
    const bonus = second.replace('QUESTION 2', 'BONUS 1').replace('/QUESTION', '/BONUS');
    const original = lesson + second + '\n' + bonus;
    const corrected = original.replace('An explanation', 'A clearer explanation')
      .replace('[QUESTION 2]\n[ANSWER: B]\nChoose the matching case.', '[QUESTION 2]\n[ANSWER: B]\nCompare a new case.')
      .replace('[BONUS 1]\n[ANSWER: B]', '[BONUS 1]\n[ANSWER: C]');
    merge(app, record(app, 'a', original));
    app.ev(`state.nodes.get(1).done=true; state.nodes.get(1)._notes='keep notes'; state.nodes.get(1)._drawing=[{color:'red'}];
      state.nodes.get(1)._sessionAnswers={1:'B',2:'A'}; state.nodes.get(1)._bonusAnswers={1:'B'};
      state.nodes.get(1)._scrollTop=300; state.viewport.x=731; state.libraryId='saved'; openViewer(state.nodes.get(1)._sessionTxt,1);`);
    const key = packet(app).treeKey;
    assert.equal(merge(app, record(app, 'a', corrected)).existing, 1);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), original);
    assert.equal(merge(app, record(app, 'a', corrected, { treeKey: 'wrong' }), { replaceExisting: true }).rejected, 1);
    assert.equal(merge(app, record(app, 'a', corrected + '[GRAPH]'), { replaceExisting: true }).rejected, 1);
    let backups = 0;
    const result = merge(app, record(app, 'a', corrected), { replaceExisting: true, beforeReplace: () => backups++ });
    assert.equal(result.updated, 1);
    assert.equal(result.imported, 0);
    assert.equal(backups, 1);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), corrected);
    assert.equal(app.ev('JSON.stringify(state.nodes.get(1)._sessionAnswers)'), '{"1":"B"}');
    assert.equal(app.ev('state.nodes.get(1)._bonusAnswers'), undefined);
    assert.equal(app.ev('state.nodes.get(1)._scrollTop'), undefined);
    assert.equal(app.ev('state.nodes.get(1)._notes'), 'keep notes');
    assert.equal(app.ev('state.nodes.get(1)._drawing[0].color'), 'red');
    assert.equal(app.ev('state.nodes.get(1).done'), true);
    assert.equal(app.ev('state.viewport.x'), 731);
    assert.equal(app.ev('state.libraryId'), 'saved');
    assert.equal(app.ev('viewer.nodeId'), null);
    assert.equal(packet(app).treeKey, key);
    app.ev('continueViewer(1)');
    assert.match(el(app, 'sv-body').textContent, /A clearer explanation/);
    assert.equal(app.ev('viewer.answers.size'), 1);
    assert.equal(app.ev('viewer.score'), 1);
    assert.equal(app.ev('viewer.bonusAnswers.size'), 0);
    assert.equal(merge(app, record(app, 'a', corrected), { replaceExisting: true, beforeReplace: () => backups++ }).existing, 1);
    assert.equal(backups, 1);
    const changedOption = corrected.replace('(B) Second', '(B) Different');
    assert.equal(merge(app, record(app, 'a', changedOption), { replaceExisting: true }).updated, 1);
    assert.equal(app.ev('state.nodes.get(1)._sessionAnswers'), undefined);
    await tick();
  } finally { app.window.close(); }
});

test('correction UI backs up originals, checkpoints updates and answer changes, and translates the receipt', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    merge(app, record(app, 'a'));
    app.ev(`state.nodes.get(1)._sessionAnswers={1:'B'}; state.nodes.get(1)._notes='keep'; state.nodes.get(1).done=true;
      autoSaveProgress(); __downloads=[]; downloadGenerationFile=(data,name)=>__downloads.push({data,name}); openGenerationModal();`);
    const corrected = lesson.replace('Choose the matching case.', 'Choose a different case.');
    el(app, 'generation-replace-existing').checked = true;
    paste(app, record(app, 'a', corrected));
    el(app, 'btn-import-generation').click();
    assert.equal(el(app, 'generation-result').textContent, '0 lessons imported; 1 corrected; 0 already present; 0 rejected.');
    assert.equal(el(app, 'generation-replace-existing').checked, false);
    assert.equal(app.ev('__downloads.length'), 1);
    const backup = JSON.parse(app.ev('JSON.stringify(__downloads[0])'));
    assert.match(backup.name, /-before-corrections\.json$/);
    assert.equal(backup.data.nodes.find(n => n.id === 'a').content, lesson);
    const saved = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(Object.values(saved)[0].data.nodes.find(n => n.id === 'a').content, corrected);
    const progress = JSON.parse(app.window.localStorage.getItem('tree-progress'));
    const nodeProgress = Object.values(progress)[0].Alpha;
    assert.equal(nodeProgress.sessionAnswers, undefined);
    assert.equal(nodeProgress.notes, 'keep');
    assert.equal(nodeProgress.done, true);
    app.ev("setUILanguage('es')");
    assert.equal(el(app, 'generation-result').textContent, '0 lecciones importadas; 1 corregidas; 0 ya existentes; 0 rechazadas.');
    assert.match(el(app, 'generation-corrections-help').textContent, /copia del árbol/);
    el(app, 'generation-replace-existing').checked = true;
    app.ev('openGenerationModal()');
    assert.equal(el(app, 'generation-replace-existing').checked, false);
  } finally { app.window.close(); }
});

test('correction file batches share one original backup and freeze the mode while reading', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    merge(app, record(app, 'a'));
    app.ev('__downloads=[]; downloadGenerationFile=(data,name)=>__downloads.push({data,name}); openGenerationModal();');
    const corrected = lesson.replace('An explanation', 'A correction');
    const input = el(app, 'generation-files');
    const files = [
      new app.window.File([record(app, 'c')], 'new.jsonl'),
      new app.window.File([record(app, 'a', corrected)], 'corrections.jsonl'),
      new app.window.File([record(app, 'a', corrected)], 'duplicate.jsonl'),
    ];
    Object.defineProperty(input, 'files', { configurable: true, value: files });
    el(app, 'generation-replace-existing').checked = true;
    input.dispatchEvent(new app.window.Event('change'));
    assert.equal(el(app, 'generation-replace-existing').disabled, true);
    for (let i = 0; i < 50 && app.ev('generationImportBusy'); i++) await tick();
    assert.equal(el(app, 'generation-result').textContent, '1 lessons imported; 1 corrected; 1 already present; 0 rejected.');
    assert.equal(app.ev('__downloads.length'), 1);
    assert.equal(app.ev("__downloads[0].data.nodes.find(n=>n.id==='a').content"), lesson);
    assert.equal(app.ev("__downloads[0].data.nodes.find(n=>n.id==='c').content"), undefined);
    assert.equal(el(app, 'generation-replace-existing').disabled, false);
    assert.equal(el(app, 'generation-replace-existing').checked, false);
  } finally { app.window.close(); }
});

test('backup failures and invalid or identical correction records never replace existing lessons', () => {
  const app = loadApp();
  try {
    loadTree(app);
    merge(app, record(app, 'a'));
    const corrected = lesson.replace('An explanation', 'A correction');
    const options = { replaceExisting: true, beforeReplace() { throw new Error('Download unavailable'); } };
    const result = merge(app, record(app, 'a', corrected), options);
    assert.equal(result.updated, 0);
    assert.equal(result.rejected, 1);
    assert.match(result.issues[0], /backup.*existing lesson was kept/);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(merge(app, record(app, 'a'), options).existing, 1);
    assert.equal(merge(app, record(app, 'a', corrected, { treeKey: 'wrong' }), options).rejected, 1);
  } finally { app.window.close(); }
});

test('reopening another copy of the same tree while correction files load leaves that copy untouched', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    merge(app, record(app, 'a'));
    app.ev('__downloads=[]; downloadGenerationFile=(data,name)=>__downloads.push({data,name}); openGenerationModal();');
    const key = packet(app).treeKey;
    const corrected = lesson.replace('An explanation', 'A correction');
    const input = el(app, 'generation-files');
    Object.defineProperty(input, 'files', { configurable: true, value: [new app.window.File([record(app, 'a', corrected)], 'corrections.jsonl')] });
    el(app, 'generation-replace-existing').checked = true;
    input.dispatchEvent(new app.window.Event('change'));
    app.ev('loadFromJSON(buildTreeJSON(true))');
    assert.equal(packet(app).treeKey, key);
    for (let i = 0; i < 50 && app.ev('generationImportBusy'); i++) await tick();
    assert.equal(app.ev('generationImportBusy'), false);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), lesson);
    assert.equal(app.ev('__downloads.length'), 0);
    assert.match(app.toasts().join(' '), /tree changed while files were loading/);
  } finally { app.window.close(); }
});

test('a correction backup includes edits made while files load and keeps the originally selected mode', async () => {
  const app = loadApp();
  try {
    loadTree(app); await tick();
    merge(app, record(app, 'a'));
    app.ev('__downloads=[]; downloadGenerationFile=(data,name)=>__downloads.push({data,name}); openGenerationModal();');
    const corrected = lesson.replace('An explanation', 'A correction');
    const edited = lesson.replace('An explanation', 'An edit during reading');
    const input = el(app, 'generation-files');
    Object.defineProperty(input, 'files', { configurable: true, value: [new app.window.File([record(app, 'a', corrected)], 'corrections.jsonl')] });
    el(app, 'generation-replace-existing').checked = true;
    input.dispatchEvent(new app.window.Event('change'));
    app.window.__edited = edited;
    app.ev('state.nodes.get(1)._sessionTxt=__edited; closeGenerationModal(); openGenerationModal();');
    assert.equal(el(app, 'generation-replace-existing').checked, true);
    assert.equal(el(app, 'generation-replace-existing').disabled, true);
    for (let i = 0; i < 50 && app.ev('generationImportBusy'); i++) await tick();
    assert.equal(app.ev('generationImportBusy'), false);
    assert.equal(app.ev('state.nodes.get(1)._sessionTxt'), corrected);
    assert.equal(app.ev('__downloads.length'), 1);
    assert.equal(app.ev("__downloads[0].data.nodes.find(n=>n.id==='a').content"), edited);
    assert.match(el(app, 'generation-result').textContent, /1 corrected/);
  } finally { app.window.close(); }
});

test('the seven reviewed quantum records import new lessons and explicitly update the three already in the earlier checkpoint', () => {
  const app = loadApp();
  try {
    loadTree(app, 'quantum-tree.json');
    assert.equal(merge(app, app.fixture('quantum-checkpoint.json')).imported, 29);
    const corrections = app.fixture('quantum-corrections.jsonl');
    const initial = merge(app, corrections);
    assert.equal(initial.imported, 4);
    assert.equal(initial.existing, 3);
    assert.equal(initial.rejected, 0);
    const result = merge(app, corrections, { replaceExisting: true });
    assert.equal(result.updated, 3);
    assert.equal(result.existing, 4);
    assert.equal(result.rejected, 0);
    const tree = JSON.parse(app.ev('JSON.stringify(buildTreeJSON(true))'));
    for (const line of corrections.trim().split('\n')) {
      const row = JSON.parse(line);
      assert.equal(tree.nodes.find(n => n.id === row.id).content, row.content);
    }
    assert.equal(packet(app).completed.length, 33);
    assert.equal(packet(app).queue.length, 62);
    assert.equal(merge(app, corrections, { replaceExisting: true }).existing, 7);
  } finally { app.window.close(); }
});

test('automatic batches rank required nodes by level then downstream reach, adding optional nodes only when slots remain', () => {
  const app = loadApp();
  try {
    app.window.__tree = JSON.stringify({ nodes: [
      { id: 'small', label: 'Small root' },
      { id: 'big', label: 'Big root' },
      { id: 'optional', label: 'Optional root', optional: true },
      { id: 'leaf', label: 'Leaf', requires: ['small'] },
      { id: 'hub', label: 'Hub', requires: ['big'] },
      { id: 'end1', label: 'End 1', requires: ['hub'] },
      { id: 'end2', label: 'End 2', requires: ['hub', 'small'] },
    ] });
    app.ev('loadFromJSON(JSON.parse(__tree))');
    const batch = count => JSON.parse(app.ev(`JSON.stringify(buildGenerationPacket('', 'auto', {count:${count}}))`));
    assert.deepEqual(batch(1).queue, ['big']);
    assert.deepEqual(batch(2).queue, ['big', 'small']);
    assert.deepEqual(batch(4).queue, ['big', 'small', 'hub', 'leaf']);
    assert.ok(!batch(6).queue.includes('optional'));
    assert.equal(batch(7).queue.length, 7);
    assert.ok(batch(7).queue.includes('optional'));
    const all = batch(7), positions = new Map(all.queue.map((id, i) => [id, i]));
    for (const node of all.tree.nodes) for (const parent of node.requires || []) assert.ok(positions.get(parent) < positions.get(node.id));
    merge(app, record(app, 'big'));
    assert.deepEqual(batch(1).queue, ['small']);
    assert.equal(batch(1).treeKey, all.treeKey);
  } finally { app.window.close(); }
});

test('single-node packets use English instructions and concrete context in both interfaces', () => {
  const app = loadApp();
  try {
    loadTree(app);
    const single = JSON.parse(app.ev(`JSON.stringify(buildGenerationPacket('English', 'auto', {count:1, mode:'manual', selected:['c']}))`));
    assert.deepEqual(single.queue, ['c']);
    assert.match(single.instructions, /topic: Gamma/);
    assert.match(single.instructions, /- Beta/);
    // Teaching prose can say "continue"; single-node work must omit batch continuation commands.
    assert.doesNotMatch(single.instructions, /subagents|When told Continue|Continue through queue|CURRENT_NODE_ID|RESUME BACKUPS|Deliver this as a downloadable file named/i);
    app.window.__packet = single;
    assert.doesNotMatch(app.ev('generationStartMessage(__packet)'), /subagents|Continue/i);
    app.ev("setUILanguage('es')");
    const spanish = JSON.parse(app.ev(`JSON.stringify(buildGenerationPacket('Español', '3', {count:1}))`));
    assert.match(spanish.instructions, /GENERATE ONE LESSON/);
    assert.match(spanish.instructions, /topic: Alpha/);
    assert.doesNotMatch(spanish.instructions, /subagents|When told Continue|Continue through queue|CURRENT_NODE_ID|Deliver this as a downloadable file named/i);
    const multi = JSON.parse(app.ev(`JSON.stringify(buildGenerationPacket('English', '3', {count:2}))`));
    assert.doesNotMatch(multi.instructions, /SUBAGENTS/); // A single chain cannot run in parallel.
  } finally { app.window.close(); }
});

test('independent batches retain subagent guidance and cap numeric reply size to the selected count', () => {
  const app = loadApp();
  try {
    app.window.__tree = JSON.stringify({ nodes: [{ id:'x', label:'X' }, { id:'y', label:'Y' }, { id:'z', label:'Z', requires:['x'] }] });
    app.ev('loadFromJSON(JSON.parse(__tree))');
    const work = JSON.parse(app.ev(`JSON.stringify(buildGenerationPacket('', '3', {count:2}))`));
    assert.deepEqual(work.queue, ['x', 'y']);
    assert.match(work.instructions, /IF SUBAGENTS ARE AVAILABLE/);
    assert.match(work.instructions, /maximum per reply is 2/);
    assert.doesNotMatch(work.instructions, /RESUME BACKUPS/);
  } finally { app.window.close(); }
});

test('map picking selects locked nodes with keyboard support, preserves progress, and cancels safely', () => {
  const app = loadApp();
  try {
    loadTree(app);
    app.ev("setMode('edit'); openGenerationModal()");
    const input = el(app, 'generation-count'); input.value = '1'; input.dispatchEvent(new app.window.Event('input'));
    const mode = el(app, 'generation-selection-mode'); mode.value = 'manual'; mode.dispatchEvent(new app.window.Event('change'));
    assert.equal(el(app, 'btn-download-ai-work').disabled, true);
    const before = app.ev('JSON.stringify(buildTreeJSON(true))');
    assert.equal(app.window.getComputedStyle(el(app, 'generation-pick-bar')).display, 'none');
    el(app, 'btn-pick-generation-nodes').click();
    assert.equal(app.ev('state.generationPicking'), true);
    assert.equal(el(app, 'generation-modal-backdrop').classList.contains('open'), false);
    // Already-filled node is disabled, even with spare capacity.
    app.ev('state.nodes.get(2).el.click()');
    assert.equal(el(app, 'btn-confirm-generation-pick').disabled, true);
    // Gamma is locked, but it can still be generated.
    const gamma = app.ev('state.nodes.get(3).el');
    app.press('Enter', gamma);
    assert.equal(gamma.getAttribute('aria-pressed'), 'true');
    assert.equal(gamma.getAttribute('aria-disabled'), 'false');
    assert.equal(el(app, 'btn-confirm-generation-pick').disabled, false);
    app.ev('state.nodes.get(1).el.click()'); // Full: do not silently replace Gamma.
    assert.equal(app.ev('generationSelection.draft.size'), 1);
    el(app, 'btn-confirm-generation-pick').click();
    assert.deepEqual(packet(app).queue, ['c']);
    assert.equal(app.ev('state.mode'), 'edit');
    assert.equal(app.window.getComputedStyle(el(app, 'generation-pick-bar')).display, 'none');
    assert.equal(app.ev('JSON.stringify(buildTreeJSON(true))'), before);
    assert.equal(el(app, 'btn-download-ai-work').disabled, false);
    assert.doesNotMatch(el(app, 'generation-start-message').value, /subagents|Continue/i);
    el(app, 'btn-pick-generation-nodes').click();
    gamma.click(); app.ev('state.nodes.get(1).el.click()');
    app.press('Escape');
    assert.deepEqual(packet(app).queue, ['c']);
    assert.equal(app.document.querySelector('.generation-selected'), null);
    loadTree(app, 'quantum-tree.json');
    assert.equal(app.ev('generationSelection.count'), null);
    assert.equal(app.ev('generationSelection.mode'), 'auto');
    assert.equal(packet(app).queue.length, 95);
  } finally { app.window.close(); }
});

test('generation count is clamped after imports and downloads stop when no lessons are missing', () => {
  const app = loadApp();
  try {
    loadTree(app); app.ev('openGenerationModal()');
    const input = el(app, 'generation-count'); input.value = '900'; input.dispatchEvent(new app.window.Event('input'));
    assert.equal(input.value, '3');
    paste(app, ['a', 'c', 'd'].map(id => record(app, id)).join('\n'));
    el(app, 'btn-import-generation').click();
    assert.equal(input.value, '0');
    assert.equal(input.disabled, true);
    assert.equal(el(app, 'btn-download-ai-work').disabled, true);
    assert.equal(el(app, 'generation-start-message').value, '');
  } finally { app.window.close(); }
});

test('effort slider updates work-file instructions for workers and single lessons', () => {
  const app = loadApp();
  try {
    app.window.__tree = JSON.stringify({ nodes: [{id:'x',label:'X'}, {id:'y',label:'Y'}] });
    app.ev('loadFromJSON(JSON.parse(__tree)); openGenerationModal()');
    const slider = el(app, 'generation-effort');
    assert.equal(slider.value, '0');
    for (const [index, value] of ['low','medium','high','xhigh'].entries()) {
      slider.value = String(index);
      slider.dispatchEvent(new app.window.Event('input'));
      const work = packet(app);
      assert.match(work.instructions, /every worker;/);
      assert.ok(work.instructions.includes(`explicitly set reasoning_effort="${value}"`));
      assert.equal(slider.getAttribute('aria-valuetext'), el(app, 'generation-effort-value').textContent);
    }
    assert.equal(el(app, 'generation-effort-value').textContent, 'Extra High');
    const single = app.ev(`buildGenerationPacket('English', '1', {count:1}).instructions`);
    assert.match(single, /reasoning_effort="xhigh"/);
    assert.doesNotMatch(single, /subagents/i);
    app.ev('closeGenerationModal(); openGenerationModal()');
    assert.equal(slider.value, '3');
  } finally { app.window.close(); }
});
