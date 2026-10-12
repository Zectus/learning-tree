const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const lesson = '=== SECTION 1: A usable idea ===\n\nAn explanation with \\( x \\), a worked use, and a fresh question.\n\n[QUESTION 1]\n[ANSWER: B]\nChoose the matching case.\n\n(A) First\n(B) Second\n(C) Third\n(D) Fourth\n(E) Fifth\n[/QUESTION]\n';
const el = (app, id) => app.document.getElementById(id);
function loadTree(app, fixture = 'mini-tree.json') {
  app.window.__tree = app.fixture(fixture);
  assert.equal(app.ev('loadFromJSON(JSON.parse(__tree))'), true);
}
function packet(app) { return JSON.parse(app.ev('JSON.stringify(buildGenerationPacket())')); }
function record(app, id, content = lesson, overrides = {}) {
  return JSON.stringify({ format: 'learning-tree-lesson/v1', treeKey: packet(app).treeKey, id, content, ...overrides });
}
function merge(app, raw) {
  app.window.__output = raw;
  return JSON.parse(app.ev('JSON.stringify(mergeGenerationOutput(__output))'));
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
    assert.match(work.instructions, /IF SUBAGENTS ARE AVAILABLE/);
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
    el(app, 'generation-output').value = record(app, 'a') + '\n{"format":"cut off';
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
    assert.match(el(app, 'generation-start-message').value, /Lee el archivo/);
    // Error details retranslate as app-owned text, while ids and lesson content stay intact.
    el(app, 'generation-output').value = record(app, 'unknown');
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

test('Spanish batch rules reuse the Spanish template and lesson language remains independently editable', () => {
  const app = loadApp();
  try {
    loadTree(app);
    app.ev('state.isSpanish=true');
    let work = packet(app);
    assert.match(work.instructions, /GENERA LECCIONES/);
    assert.match(work.instructions, /Vas a producir una lección/);
    assert.match(work.instructions, /=== SECTION N:/);
    assert.doesNotMatch(work.instructions, /Entrégala como archivo descargable llamado/);
    work = JSON.parse(app.ev("JSON.stringify(buildGenerationPacket('Español de Perú','3'))"));
    assert.match(work.instructions, /=== SECCIÓN N:/);
    assert.match(work.instructions, /máximo por respuesta es 3/);
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
    el(app, 'generation-output').value = record(app, 'a');
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
    el(app, 'generation-output').value = record(app, 'a');
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
    el(app, 'generation-output').value = raw;
    el(app, 'btn-import-generation').click();
    el(app, 'generation-import-details').open = true;
    const issues = el(app, 'generation-issues').firstChild;
    const result = el(app, 'generation-result').textContent;
    const library = app.window.localStorage.getItem('tree-library');
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
