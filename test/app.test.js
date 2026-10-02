const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));

// Loads a fixture tree by name through the real loadFromJSON.
function loadTree(app, fixture) {
  app.window.__json = app.fixture(fixture);
  return app.ev('loadFromJSON(JSON.parse(__json))');
}
const nodeIdByLabel = (app, label) => app.ev(`[...state.nodes.values()].find(n => n.label === ${JSON.stringify(label)}).id`);
const optionByText = (app, qn, text, attr = 'qn') =>
  [...app.document.querySelectorAll(`.q-card[data-${attr}="${qn}"] .q-opt`)].find(b => b.querySelector('.q-text').textContent === text);

/* ── account panel ── */
test('signed-in panel is hidden until someone is signed in', () => {
  const app = loadApp();
  const panel = app.document.getElementById('account-signed-in-panel');
  assert.equal(app.window.getComputedStyle(panel).display, 'none');
  app.ev("showSignedInPanel({ email: 'a@b.co', username: 'bob' })");
  assert.equal(app.window.getComputedStyle(panel).display, 'flex');
  app.ev('showSignedOutPanel()');
  assert.equal(app.window.getComputedStyle(panel).display, 'none');
});

test('password field switches autocomplete hint between sign-in and sign-up', () => {
  const app = loadApp();
  const pw = app.document.getElementById('account-password-input');
  assert.equal(pw.autocomplete, 'current-password');
  app.ev("setAccountMode('signup')");
  assert.equal(pw.autocomplete, 'new-password');
});

/* ── loading trees ── */
test('a valid tree loads, lays out by depth, and drops the implied edge', () => {
  const app = loadApp();
  assert.equal(loadTree(app, 'mini-tree.json'), true);
  assert.equal(app.ev('state.nodes.size'), 4);
  assert.equal(app.ev('state.topic'), 'Mini');
  assert.equal(app.ev('state.language'), 'English');
  const depths = app.ev('[...state.nodes.values()].map(n => n.label + ":" + n.depth).join(",")');
  assert.equal(depths, 'Alpha:0,Beta:1,Gamma:2,Delta:3');
  // a→c is implied by a→b→c and removed; edge elements are cached one per edge
  assert.equal(app.ev('state.edges.size'), 3);
  assert.equal(app.ev('edgeEls.size'), 3);
  assert.deepEqual(app.toasts(), []);
});

test('edges run from the right edge of the prerequisite to the left edge of the dependent', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const bad = app.ev(`
    const out = [];
    forEachEdge((f, t, key) => {
      const from = state.nodes.get(f), to = state.nodes.get(t);
      const m = edgeEls.get(key).getAttribute('d').match(/^M([-\\d.]+),([-\\d.]+) C.* ([-\\d.]+),([-\\d.]+)$/);
      if (+m[1] !== from.x + nodeW() || +m[3] !== to.x) out.push(key);
    });
    out.join(',')`);
  assert.equal(bad, '');
});

test('repairable problems in a tree file are dropped and reported', () => {
  const app = loadApp();
  assert.equal(loadTree(app, 'bad-tree.json'), true);
  assert.equal(app.ev('state.nodes.size'), 5);
  assert.equal(app.ev('state.edges.size'), 2); // x→y, and one direction of the p/q pair
  const [msg] = app.toasts();
  for (const part of ['1 prerequisite pointing at a topic that doesn\'t exist', '1 topic listing itself', '1 link that would form a loop', '1 repeated id'])
    assert.ok(msg.includes(part), `missing "${part}" in: ${msg}`);
  // and the graph is still acyclic, so every node got a depth
  assert.equal(app.ev('[...state.nodes.values()].every(n => Number.isInteger(n.depth))'), true);
});

test('a file that is not a tree is rejected and leaves the current tree alone', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  assert.equal(app.ev('loadFromJSON({ hello: 1 })'), false);
  assert.equal(app.ev('loadFromJSON({ nodes: [] })'), false);
  assert.equal(app.ev('state.nodes.size'), 4);
  assert.equal(app.toasts().length, 2);
});

test('deleting a node removes its edges and edge elements', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  app.ev(`deleteNode(${nodeIdByLabel(app, 'Beta')})`);
  // a→b and b→c went with it; c→d is untouched
  assert.equal(app.ev('state.edges.size'), 1);
  assert.equal(app.ev('edgeEls.size'), 1);
  assert.equal(app.ev(`dependentsOf(${nodeIdByLabel(app, 'Alpha')}).length`), 0);
  assert.equal(app.ev(`prereqsOf(${nodeIdByLabel(app, 'Gamma')}).length`), 0);
});

test('loading a new tree closes the viewer and cancels link mode', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const id = nodeIdByLabel(app, 'Beta');
  app.ev(`openViewer(state.nodes.get(${id})._sessionTxt, ${id})`);
  assert.ok(app.document.getElementById('session-viewer').classList.contains('sv-open'));
  app.ev(`startLink(${id})`);
  assert.ok(app.document.body.classList.contains('linking-mode'));

  loadTree(app, 'mini-tree.json'); // ids restart at 1, so a stale viewer would point at the wrong node
  assert.equal(app.ev('viewer.nodeId'), null);
  assert.ok(!app.document.getElementById('session-viewer').classList.contains('sv-open'));
  assert.ok(!app.document.body.classList.contains('linking-mode'));
});

/* ── viewer ── */
test('viewer scores answers, saves them by original letter, and restores them', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const id = nodeIdByLabel(app, 'Beta');
  app.ev(`openViewer(state.nodes.get(${id})._sessionTxt, ${id})`);
  assert.equal(app.ev('viewer.total'), 2);

  optionByText(app, 1, '7').click();
  assert.equal(app.ev('viewer.score'), 1);
  assert.equal(app.document.querySelector('.q-card[data-qn="1"] .q-correct .q-text').textContent, '7');
  assert.equal(app.ev(`state.nodes.get(${id})._sessionAnswers[1]`), 'C'); // original letter in the .txt
  assert.equal(app.ev(`state.nodes.get(${id}).done`), false);

  optionByText(app, 2, '5').click(); // wrong
  assert.match(app.document.getElementById('qfb-2').textContent, /Correct answer: [A-D]/);
  assert.equal(app.ev(`state.nodes.get(${id}).done`), true); // all scoreable questions answered

  // bonus
  optionByText(app, 1, 'yes', 'bn').click();
  assert.ok(app.document.querySelector('.q-card[data-bn="1"] .q-correct'));
  assert.equal(app.ev(`state.nodes.get(${id})._bonusAnswers[1]`), 'B');

  // reopen from scratch: answers come back attached to the same options
  app.ev('viewer.nodeId = null');
  app.ev(`continueViewer(${id})`);
  assert.equal(app.ev('viewer.score'), 1);
  assert.equal(app.document.querySelector('.q-card[data-qn="1"] .q-correct .q-text').textContent, '7');
  assert.equal(app.document.querySelector('.q-card[data-qn="2"] .q-wrong .q-text').textContent, '5');
  assert.ok(optionByText(app, 1, '7').disabled);
});

test('a saved answer stays attached to its option however the options get shuffled', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const id = nodeIdByLabel(app, 'Beta');
  // Save "C" (the prime, 7) as the original letter, then open under a different shuffle seed
  // by editing the question text slightly — the *option* must still be the one marked right.
  app.ev(`state.nodes.get(${id})._sessionAnswers = { 1: 'C' }`);
  app.ev(`state.nodes.get(${id})._sessionTxt = state.nodes.get(${id})._sessionTxt.replace('Which of these is prime?', 'Which of these numbers is prime?')`);
  app.ev(`openViewer(state.nodes.get(${id})._sessionTxt, ${id})`);
  assert.equal(app.document.querySelector('.q-card[data-qn="1"] .q-correct .q-text').textContent, '7');
  assert.equal(app.document.querySelectorAll('.q-card[data-qn="1"] .q-wrong').length, 0);
});

test('a question without a valid answer key is flagged, not scored', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const id = nodeIdByLabel(app, 'Beta');
  // One good question, one whose tag names a letter that isn't an option.
  const txt = app.fixture('mini-lesson.txt').replace('[ANSWER: A]', '[ANSWER: E]');
  app.window.__txt = txt;
  app.ev(`openViewer(__txt, ${id})`);
  assert.equal(app.ev('viewer.total'), 1);
  assert.equal(app.document.querySelectorAll('.q-card-invalid').length, 1);
  assert.ok(app.document.querySelector('.q-card-invalid .q-opt').disabled);
  assert.equal(app.document.querySelectorAll('.sv-checkpoint').length, 1);
  assert.match(app.toasts().join(' '), /no valid answer key/);
});

test('a lesson with no usable answers does not open, and says why', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const id = nodeIdByLabel(app, 'Beta');
  app.window.__txt = app.fixture('no-answers-lesson.txt');
  app.ev(`openViewer(__txt, ${id})`);
  assert.ok(!app.document.getElementById('session-viewer').classList.contains('sv-open'));
  assert.match(app.toasts()[0], /valid answer key/);

  app.ev(`openViewer('just some text', ${id})`);
  assert.match(app.toasts()[1], /no \[QUESTION\] blocks/);
});

/* ── graphs ── */
test('graph expressions compile in a sandbox that blocks reaching outside', () => {
  const app = loadApp();
  assert.equal(app.ev("compileGraphExpr('x^2 - 3*x').evaluate({ x: 3 })"), 0);
  assert.ok(app.ev("Number.isFinite(compileGraphExpr('sin(x) + sqrt(x^2 + y^2) + atan2(y, x) + abs(-x)').evaluate({ x: 1, y: 1 }))"));
  for (const bad of ["evaluate('1+1')", "import({ a: 1 })", "parse('1')", "simplify('x+x')", "createUnit('foo')"])
    assert.throws(() => app.ev(`compileGraphExpr(${JSON.stringify(bad)}).evaluate()`), /disabled/, bad);
});

/* ── modes, keyboard, escape ── */
test('modes are mutually exclusive', () => {
  const app = loadApp();
  const click = id => app.document.getElementById(id).click();
  click('mode-edit-item');
  assert.equal(app.ev('state.mode'), 'edit');
  assert.ok(app.document.body.classList.contains('edit-mode'));
  click('mode-mark-known-item');
  assert.equal(app.ev('state.mode'), 'markKnown');
  assert.ok(!app.document.body.classList.contains('edit-mode'));
  assert.ok(app.document.body.classList.contains('mark-known-mode'));
  click('mode-mark-known-item'); // toggles off
  assert.equal(app.ev('state.mode'), 'browse');
});

test('one Escape closes one thing: a modal first, then mark-known mode', async () => {
  const app = loadApp();
  app.document.getElementById('mode-mark-known-item').click();
  app.document.getElementById('btn-my-trees').click();
  await tick();
  assert.ok(app.document.getElementById('library-modal-backdrop').classList.contains('open'));

  app.press('Escape');
  assert.ok(!app.document.getElementById('library-modal-backdrop').classList.contains('open'));
  assert.equal(app.ev('state.mode'), 'markKnown'); // survived the press that closed the modal

  app.press('Escape');
  assert.equal(app.ev('state.mode'), 'browse');
});

test('opening a modal moves focus in, and closing returns it', async () => {
  const app = loadApp();
  const opener = app.document.getElementById('btn-my-trees');
  opener.focus();
  opener.click();
  await tick();
  assert.equal(app.document.activeElement.getAttribute('role'), 'dialog');
  app.press('Escape');
  await tick();
  assert.equal(app.document.activeElement, opener);
});

test('dropdown triggers report expanded state', () => {
  const app = loadApp();
  const trigger = app.document.getElementById('btn-tree-menu');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
  trigger.click();
  assert.equal(trigger.getAttribute('aria-expanded'), 'true');
  app.press('Escape');
  assert.equal(trigger.getAttribute('aria-expanded'), 'false');
});

test('a node card is keyboard-operable and named for screen readers', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  const el = app.ev(`state.nodes.get(${nodeIdByLabel(app, 'Alpha')}).el`);
  assert.equal(el.tabIndex, 0);
  assert.equal(el.getAttribute('role'), 'button');
  assert.equal(el.getAttribute('aria-label'), 'Alpha, available');
  const locked = app.ev(`state.nodes.get(${nodeIdByLabel(app, 'Gamma')}).el`);
  assert.equal(locked.getAttribute('aria-disabled'), 'true');
  app.press('Enter', el);
  assert.ok(app.document.getElementById('modal-backdrop').classList.contains('open'));
});

test('Enter in a node label commits it instead of inserting a line break', () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  app.document.getElementById('mode-edit-item').click();
  const text = app.ev(`state.nodes.get(${nodeIdByLabel(app, 'Alpha')}).el`).querySelector('.node-text');
  const ev = new app.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  text.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, true);
});

/* ── prompts / language ── */
test('the learn modal never carries one tree\'s language into another', () => {
  const app = loadApp();
  const input = app.document.getElementById('node-language-input');
  const open = () => app.ev('openLearnModal([...state.nodes.keys()][0])');
  const withLang = lang => { app.window.__t = { language: lang, nodes: [{ id: 'a', label: 'A' }] }; app.ev('loadFromJSON(JSON.parse(JSON.stringify(__t)))'); };

  withLang('Spanish'); open();
  assert.equal(input.value, 'Spanish');
  withLang('French'); open();
  assert.equal(input.value, 'French');           // prefilled value is replaced…
  input.value = 'German';
  withLang('Italian'); open();
  assert.equal(input.value, 'German');           // …but a language typed by hand is kept
});

test('tree prompts: language example is templated, and the file-only rule is scoped to the final message', () => {
  const app = loadApp();
  const topic = app.ev(`renderTreePrompt({ topic: 'Optics', fileSlug: 'optics', language: 'English', languageClause: '' })`);
  const file  = app.ev('renderTreePromptFromFile()');
  assert.ok(topic.includes('"language": "English"'));
  assert.ok(!topic.includes('Spanish') && !file.includes('Spanish'));
  for (const p of [topic, file]) {
    assert.ok(p.includes('once the tree is built, your final message should contain nothing but the file itself'));
    assert.ok(!p.includes('your visible output should contain nothing but the file itself'));
  }
  const principles = app.ev('TREE_DESIGN_PRINCIPLES');
  assert.ok(topic.includes(principles) && file.includes(principles));
});

/* ── small units ── */
test('slugify keeps non-Latin text', () => {
  const app = loadApp();
  assert.equal(app.ev("slugify('微积分 入门')"), '微积分_入门');
  assert.equal(app.ev("slugify('Ünïcode  Topic!')"), 'ünïcode_topic');
  assert.equal(app.ev("slugify('!!!')"), 'node');
});

test('shuffleOptions is a deterministic permutation with consistent lookups', () => {
  const app = loadApp();
  const r = JSON.parse(app.ev(`JSON.stringify(shuffleOptions({ A: 'a', B: 'b', C: 'c', D: 'd' }, 'B', 'seed'))`));
  const again = JSON.parse(app.ev(`JSON.stringify(shuffleOptions({ A: 'a', B: 'b', C: 'c', D: 'd' }, 'B', 'seed'))`));
  assert.deepEqual(r, again);
  assert.deepEqual(Object.values(r.options).sort(), ['a', 'b', 'c', 'd']);
  assert.equal(r.options[r.correct], 'b');
  for (const [nl, ol] of Object.entries(r.origOf)) assert.equal(r.newOf[ol], nl);
  assert.equal(JSON.parse(app.ev(`JSON.stringify(shuffleOptions({ A: 'a', B: 'b' }, 'F', 'x'))`)).correct, null);
});

test('mobile breakpoint is one shared, inclusive definition', () => {
  assert.equal(loadApp({ innerWidth: 700 }).ev('isMobileViewport()'), true);
  assert.equal(loadApp({ innerWidth: 701 }).ev('isMobileViewport()'), false);
  assert.equal(loadApp({ innerWidth: 700 }).ev('window.UI_SCALE'), 1);
});

/* ── viewport ── */
test('a non-animated transform is not overwritten by an animated one still in flight', async () => {
  const app = loadApp();
  app.ev('state.viewport = { x: 10, y: 10, scale: 1 }; applyTransform(true)');
  app.ev('state.viewport = { x: 99, y: 99, scale: 2 }; applyTransform(false)');
  await tick(60);
  assert.equal(app.document.getElementById('world').style.transform.replace(/\s/g, ''), 'translate(99px,99px)scale(2)');
  assert.equal(app.document.getElementById('world').style.transition, '');
});

test('wheel zoom is proportional to the wheel delta', () => {
  const app = loadApp();
  const canvas = app.document.getElementById('canvas');
  const wheel = deltaY => canvas.dispatchEvent(new app.window.WheelEvent('wheel', { deltaY, clientX: 0, clientY: 0, cancelable: true, bubbles: true }));
  app.ev('state.viewport = { x: 0, y: 0, scale: 1 }');
  wheel(-100);                        // one classic mouse notch
  assert.ok(Math.abs(app.ev('state.viewport.scale') - 1.07) < 1e-9);
  app.ev('state.viewport.scale = 1');
  wheel(-10);                         // a trackpad-sized delta zooms far less
  const s = app.ev('state.viewport.scale');
  assert.ok(s > 1 && s < 1.01);
});

test('right-click does not start a canvas pan', () => {
  const app = loadApp();
  const canvas = app.document.getElementById('canvas');
  canvas.setPointerCapture = () => {};
  const PointerEvt = app.window.PointerEvent || app.window.MouseEvent;
  canvas.dispatchEvent(new PointerEvt('pointerdown', { button: 2, bubbles: true }));
  assert.equal(app.ev('state.drag.active'), false);
  canvas.dispatchEvent(new PointerEvt('pointerdown', { button: 0, bubbles: true }));
  assert.equal(app.ev('state.drag.active'), true);
});

/* ── autoscroll ── */
test('autoscroll speed scales with frame time and carries fractional pixels', () => {
  const app = loadApp();
  app.ev('mca.target = { scrollTop: 0 }');
  // 100px from the anchor is ~15 px per 60Hz frame; two half-frames (a 120Hz display) must add up to the same.
  app.ev("mca.remY = stepAxis('scrollTop', 100, 0, 0.5)");
  app.ev("mca.remY = stepAxis('scrollTop', 100, mca.remY, 0.5)");
  const half = app.ev('mca.target.scrollTop');
  app.ev('mca.target = { scrollTop: 0 }');
  app.ev("stepAxis('scrollTop', 100, 0, 1)");
  assert.equal(half, app.ev('mca.target.scrollTop'));
  // just outside the dead zone the step is under a pixel, but it isn't lost
  app.ev('mca.target = { scrollTop: 0 }; mca.remY = 0');
  for (let i = 0; i < 10; i++) app.ev("mca.remY = stepAxis('scrollTop', 16, mca.remY, 1)");
  assert.ok(app.ev('mca.target.scrollTop') >= 2);
});

/* ── persistence failures ── */
test('a failed progress write is reported and stays pending for the next flush', async () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  app.ev('autoSaveProgress()');
  assert.equal(app.ev('progressPending'), true);

  const proto = app.window.Storage.prototype, real = proto.setItem;
  proto.setItem = () => { throw new app.window.Error('QuotaExceededError'); };
  await app.ev('flushProgress()');
  assert.equal(app.ev('progressPending'), true);
  assert.match(app.toasts().join(' '), /Couldn't save your progress/);

  proto.setItem = real;
  await app.ev('flushProgress()');
  assert.equal(app.ev('progressPending'), false);
  assert.ok(app.window.localStorage.getItem('tree-progress'));
});

test('a failed library save is rolled back instead of shown as saved', async () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  app.window.prompt = () => 'My tree';
  const proto = app.window.Storage.prototype, real = proto.setItem;
  proto.setItem = () => { throw new app.window.Error('QuotaExceededError'); };
  await app.ev('saveCurrentTreeToLibrary()');
  proto.setItem = real;
  assert.equal(app.ev('Object.keys(libraryCache).length'), 0);
  assert.equal(app.ev('state.libraryId'), null);
  assert.match(app.toasts().join(' '), /storage is full/);
});

test('"reset all progress" asks first', async () => {
  const app = loadApp();
  loadTree(app, 'mini-tree.json');
  app.ev(`progressCache = { keep: { Alpha: { done: true } } }`);
  const btn = app.document.getElementById('menu-reset-progress');
  const click = () => btn.dispatchEvent(new app.window.MouseEvent('click', { shiftKey: true, bubbles: true }));

  app.window.confirm = () => false;
  click(); await tick();
  assert.deepEqual(Object.keys(app.ev('progressCache')), ['keep']);

  app.window.confirm = () => true;
  click(); await tick();
  assert.deepEqual(Object.keys(app.ev('progressCache')), []);
});

test('sign-out flushes pending progress before revoking auth', async () => {
  const app = loadApp();
  const order = [];
  app.window.cloud = { signOutUser: async () => { order.push('signOut'); } };
  app.ev(`state.accountUser = { uid: 'u1', email: 'a@b.co', username: 'bob' }; progressSource = 'cloud'; progressPending = true;`);
  app.window.cloud.setProgress = async () => { order.push('flush'); };
  await app.ev('submitSignOut()');
  assert.deepEqual(order, ['flush', 'signOut']);
});

test('sign-up rolls the account back if claiming the username throws', async () => {
  const app = loadApp();
  const calls = [];
  app.window.cloud = {
    signUp: async () => ({ user: { uid: 'u1', email: 'a@b.co' } }),
    claimUsername: async () => { throw new app.window.Error('permission denied'); },
    deleteCurrentUser: async () => { calls.push('deleted'); },
  };
  app.ev("setAccountMode('signup')");
  app.document.getElementById('account-email-input').value = 'a@b.co';
  app.document.getElementById('account-password-input').value = 'secret1';
  app.document.getElementById('account-username-input').value = 'bob';
  await app.ev('submitAccountForm()');
  assert.deepEqual(calls, ['deleted']);
  assert.match(app.document.getElementById('account-error').textContent, /permission denied/);
});

/* ── theme ── */
test('dark mode toggles on the root element', () => {
  const app = loadApp();
  app.ev('setDarkMode(true, false)');
  assert.ok(app.document.documentElement.classList.contains('dark'));
  app.ev('setDarkMode(false, false)');
  assert.ok(!app.document.documentElement.classList.contains('dark'));
});
