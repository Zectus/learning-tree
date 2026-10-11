const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
const el = (app, id) => app.document.getElementById(id);
const active = app => app.ev('state.tutorialActive');
async function jump(app, i) {
  el(app, 'tutorial-section').value = String(i);
  el(app, 'tutorial-section').dispatchEvent(new app.window.Event('change'));
  await tick();
}
async function next(app) { el(app, 'tutorial-next').click(); await tick(); }
async function dispose(app) { if (active(app)) el(app, 'tutorial-skip').click(); await tick(); app.window.close(); }

// Observe genuine app errors rather than allowing jsdom console errors to pass.
function fresh(options) {
  const app = loadApp(options);
  app.errors = [];
  app.window.addEventListener('error', e => app.errors.push(e.error));
  return app;
}

test('first visit opens a UI tour; skipping reveals replay and remembers dismissal', async () => {
  const app = fresh({ tutorialSeen: false });
  try {
    assert.equal(active(app), true);
    assert.equal(el(app, 'tutorial-layer').hidden, false);
    assert.equal(el(app, 'menu-tutorial').hidden, true);
    assert.equal(app.ev('state.nodes.size'), 3);
    assert.equal(el(app, 'btn-tree-menu').hasAttribute('inert'), false);
    await tick();
    assert.equal(app.document.activeElement.id, 'tutorial-card');
    el(app, 'tutorial-skip').click(); await tick();
    assert.equal(active(app), false);
    assert.equal(app.ev('state.nodes.size'), 0);
    assert.equal(el(app, 'menu-tutorial').hidden, false);
    assert.equal(el(app, 'account-menu').classList.contains('open'), true);
    assert.equal(app.window.localStorage.getItem('tree-tutorial-seen'), '1');
    assert.match(app.toasts().join(' '), /View tutorial/);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('every stage can be skipped; replay resets the tour and never saves demo data', async () => {
  const app = fresh();
  try {
    const storageBefore = JSON.stringify(app.window.localStorage);
    const count = el(app, 'tutorial-section').options.length;
    for (let i = 0; i < count; i++) {
      el(app, 'menu-tutorial').click();
      assert.equal(el(app, 'tutorial-section').value, '0');
      await jump(app, i);
      el(app, 'tutorial-skip').click(); await tick();
      assert.equal(active(app), false);
      assert.equal(app.ev('state.nodes.size'), 0);
      assert.equal(app.ev('Object.keys(libraryCache).length'), 0);
      assert.equal(app.ev('Object.keys(progressCache).length'), 0);
      assert.equal(JSON.stringify(app.window.localStorage), storageBefore);
      assert.equal(el(app, 'menu-tutorial').hidden, false);
    }
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('Next demonstrates the whole real workflow without requiring generation or uploads', async () => {
  const app = fresh({ tutorialSeen: false });
  try {
    await next(app);
    assert.equal(el(app, 'tree-menu').classList.contains('open'), true);
    await next(app);
    assert.equal(el(app, 'tree-modal-backdrop').classList.contains('open'), true);
    assert.match(el(app, 'tree-prompt-box').value, /Learning something new/);
    await next(app);
    assert.equal(el(app, 'tree-mode-tab-file').classList.contains('active'), true);
    await next(app); await next(app); // sample import
    assert.equal(el(app, 'tree-modal-backdrop').classList.contains('open'), false);
    await next(app); await next(app);
    assert.equal(el(app, 'modal-backdrop').classList.contains('open'), true);
    await next(app);
    assert.equal(el(app, 'session-viewer').classList.contains('sv-open'), true);
    assert.equal(app.ev('viewer.total'), 1);
    await next(app);
    assert.equal(app.ev('viewer.score'), 1);
    assert.equal(app.document.querySelector('.q-feedback').textContent, '✓ Correct');
    await next(app); await next(app);
    assert.equal(el(app, 'sv-notes-panel').classList.contains('open'), true);
    await next(app); await next(app);
    assert.equal(app.ev('state.mode'), 'edit');
    await next(app); await next(app);
    assert.equal(app.ev('state.mode'), 'markKnown');
    await next(app);
    assert.equal(app.ev('nodeStatus(3)'), 'available');
    await next(app);
    assert.equal(el(app, 'library-modal-backdrop').classList.contains('open'), true);
    await next(app);
    assert.equal(app.document.querySelectorAll('#library-grid .library-card').length, 1);
    assert.equal(app.window.localStorage.getItem('tree-library'), null);
    await next(app); await next(app); await next(app); await next(app);
    assert.equal(active(app), false);
    assert.equal(app.ev('state.nodes.size'), 0);
    assert.equal(app.ev('Object.keys(libraryCache).length'), 0);
    assert.equal(app.window.localStorage.getItem('tree-progress'), null);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('highlighted controls perform actual actions; upload uses the prepared sample', async () => {
  const app = fresh({ tutorialSeen: false });
  try {
    el(app, 'btn-tree-menu').click(); await tick();
    el(app, 'menu-new-tree').click(); await tick();
    el(app, 'tree-topic-input').value = 'Algebra';
    el(app, 'tree-topic-input').dispatchEvent(new app.window.Event('input'));
    assert.match(el(app, 'tree-prompt-box').value, /Algebra/);
    await jump(app, 4);
    app.document.querySelector('#tree-modal-backdrop .upload-dropzone').click(); await tick();
    assert.equal(el(app, 'tutorial-section').value, '5');
    await jump(app, 6);
    app.ev('state.nodes.get(2).el.click()'); await tick();
    assert.equal(el(app, 'tutorial-section').value, '7');
    assert.equal(el(app, 'modal-backdrop').classList.contains('open'), true);
    await next(app);
    app.document.querySelector('#sv-body .q-opt').click(); await tick();
    assert.equal(el(app, 'tutorial-section').value, '9');
    assert.equal(app.ev('viewer.answers.size'), 1);
    await jump(app, 10);
    el(app, 'btn-toggle-notes').click(); await tick();
    assert.equal(el(app, 'tutorial-section').value, '11');
    el(app, 'sv-notes-ta').value = 'Temporary note';
    el(app, 'sv-notes-ta').dispatchEvent(new app.window.Event('input'));
    assert.equal(app.ev('state.nodes.get(2)._notes'), 'Temporary note');
    await jump(app, 13);
    el(app, 'btn-add-node').click();
    assert.equal(app.ev('state.nodes.size'), 4);
    await jump(app, 15);
    app.ev('state.nodes.get(2).el.click()'); await tick();
    assert.equal(app.ev('nodeStatus(3)'), 'available');
    await jump(app, 17);
    el(app, 'btn-save-current-tree').click(); await tick();
    assert.equal(el(app, 'tutorial-section').value, '18');
    assert.equal(app.document.querySelectorAll('#library-grid .library-card').length, 1);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('skip restores object identity, unsaved edits, lesson DOM, notes, mode, and viewport', async () => {
  const app = fresh();
  try {
    app.window.__tree = app.fixture('mini-tree.json');
    app.ev(`loadFromJSON(JSON.parse(__tree)); state.nodes.get(1).label = 'Unsaved label';
      state.nodes.get(2)._notes = 'Real notes'; openViewer(state.nodes.get(2)._sessionTxt, 2);
      state.viewport = {x: 42, y: 99, scale: 1.4}; applyTransform(false); setMode('edit');`);
    const nodes = app.ev('state.nodes'), node = app.ev('state.nodes.get(1)'), nodeDOM = node.el;
    const lessonDOM = el(app, 'sv-body').firstChild;
    const before = app.ev('JSON.stringify({tree:buildTreeJSON(true), viewport:state.viewport, mode:state.mode, notes:state.nodes.get(2)._notes})');
    const modeLabel = el(app, 'btn-mode').textContent;
    const storage = JSON.stringify(app.window.localStorage);
    el(app, 'menu-tutorial').click(); await jump(app, 17); await next(app);
    el(app, 'tutorial-skip').click(); await tick();
    assert.equal(app.ev('state.nodes'), nodes);
    assert.equal(app.ev('state.nodes.get(1)'), node);
    assert.equal(app.ev('state.nodes.get(1).el'), nodeDOM);
    assert.equal(el(app, 'sv-body').firstChild, lessonDOM);
    assert.equal(el(app, 'session-viewer').classList.contains('sv-open'), true);
    assert.equal(el(app, 'btn-mode').textContent, modeLabel);
    assert.equal(before, app.ev('JSON.stringify({tree:buildTreeJSON(true), viewport:state.viewport, mode:state.mode, notes:state.nodes.get(2)._notes})'));
    assert.equal(JSON.stringify(app.window.localStorage), storage);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('unrelated actions are blocked, and Escape only exits the tutorial', async () => {
  const app = fresh();
  try {
    el(app, 'menu-tutorial').click();
    const event = new app.window.MouseEvent('click', { bubbles: true, cancelable: true });
    el(app, 'menu-reset-progress').dispatchEvent(event);
    assert.equal(event.defaultPrevented, true);
    app.press('Escape'); await tick();
    assert.equal(active(app), false);
    assert.equal(el(app, 'menu-tutorial').hidden, false);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('auth that resolves during the tour is applied after restoring the real page', async () => {
  const app = fresh();
  try {
    el(app, 'menu-tutorial').click();
    app.ev(`applyAccountUser(null);`);
    assert.equal(app.ev('!!state.tutorialPendingAuth'), true);
    el(app, 'tutorial-skip').click(); await tick();
    assert.equal(app.ev('state.tutorialPendingAuth'), undefined);
    assert.equal(app.ev('state.accountUser'), null);
    assert.equal(app.ev('Object.keys(libraryCache).length'), 0);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('storage failures do not prevent skip/replay and theme demos do not persist', async () => {
  const app = fresh({ tutorialSeen: false, storageUnavailable: true, innerWidth: 390 });
  try {
    const dark = app.document.documentElement.classList.contains('dark');
    await jump(app, 20);
    el(app, 'menu-dark-mode').click();
    assert.equal(app.document.documentElement.classList.contains('dark'), !dark);
    app.press('Escape'); await tick();
    assert.equal(active(app), false);
    assert.equal(app.document.documentElement.classList.contains('dark'), dark);
    el(app, 'menu-tutorial').click();
    assert.equal(active(app), true);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('in-flight cloud reads are deferred without replacing the demo or saving it to the account', async () => {
  const app = fresh();
  try {
    app.window.__tree = app.fixture('mini-tree.json');
    app.ev(`loadFromJSON(JSON.parse(__tree)); state.accountUser = {uid:'real-user',email:'a@b.co'};
      window.cloud = {
        getProgress: () => new Promise(resolve => window.resolveProgress = resolve),
        getLibrary: () => new Promise(resolve => window.resolveLibrary = resolve),
        setProgress: () => { throw new Error('No demo cloud writes'); },
        setLibrary: () => { throw new Error('No demo cloud writes'); }
      };`);
    const progress = app.ev('refreshProgressFromSource()');
    const library = app.ev('refreshLibraryFromSource()');
    el(app, 'menu-tutorial').click(); await jump(app, 17); await next(app);
    app.window.resolveProgress({}); app.window.resolveLibrary({});
    await Promise.all([progress, library]);
    assert.equal(app.ev('state.nodes.size'), 3);
    assert.equal(app.ev('Object.keys(libraryCache).length'), 1);
    assert.equal(app.ev('state.tutorialRefreshProgress'), true);
    assert.equal(app.ev('state.tutorialRefreshLibrary'), true);
    app.ev('window.cloud.getProgress = window.cloud.getLibrary = async () => ({});');
    el(app, 'tutorial-skip').click(); await tick();
    assert.equal(app.ev('state.nodes.size'), 4);
    assert.equal(app.ev('Object.keys(libraryCache).length'), 0);
    assert.equal(app.ev('Object.keys(progressCache).length'), 0);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('keyboard navigation includes highlighted controls, and Back restores the right UI', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    for (const id of ['btn-tree-menu','tutorial-skip','tutorial-back','tutorial-section','tutorial-next']) {
      el(app,id).getClientRects = () => el(app,id).disabled ? [] : [{}];
    }
    el(app,'tutorial-card').focus();
    app.press('Tab', el(app,'tutorial-card'));
    assert.equal(app.document.activeElement.id,'btn-tree-menu');
    app.press('Tab', el(app,'btn-tree-menu'));
    assert.equal(app.document.activeElement.id,'tutorial-skip');
    await next(app); await next(app);
    el(app,'tutorial-back').click(); await tick();
    assert.equal(el(app,'tutorial-section').value,'1');
    assert.equal(el(app,'tree-menu').classList.contains('open'),true);
    assert.equal(el(app,'tree-modal-backdrop').classList.contains('open'),false);
    app.press('Escape'); await tick();
    assert.equal(app.document.activeElement.id,'btn-account-menu');
    assert.deepEqual(app.errors,[]);
  } finally { await dispose(app); }
});

test('hint expansion preserves the normal dialog sizing and edited prompt fields', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    await jump(app, 2);
    const shell = app.document.querySelector('#tree-modal-backdrop .modal-shell');
    const sizing = () => {
      const css = app.window.getComputedStyle(shell);
      return {width:css.width, maxHeight:css.maxHeight};
    };
    const duringTour = sizing();
    app.document.body.classList.remove('tutorial-active');
    assert.deepEqual(sizing(), duringTour);
    app.document.body.classList.add('tutorial-active');
    el(app,'tree-topic-input').value = 'My custom topic';
    el(app,'tree-topic-input').dispatchEvent(new app.window.Event('input'));
    const prompt = el(app,'tree-prompt-box').value;
    const expanded = el(app,'tutorial-toggle').getAttribute('aria-expanded');
    el(app,'tutorial-toggle').click();
    assert.notEqual(el(app,'tutorial-toggle').getAttribute('aria-expanded'), expanded);
    assert.deepEqual(sizing(), duringTour);
    el(app,'tutorial-toggle').click();
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'), expanded);
    assert.equal(el(app,'tree-topic-input').value, 'My custom topic');
    assert.equal(el(app,'tree-prompt-box').value, prompt);
    assert.equal(el(app,'tutorial-section').value,'2');
    assert.deepEqual(app.errors,[]);
  } finally { await dispose(app); }
});

test('progress step starts expanded even when the viewer fills the available space', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    const box = (left, top, right, bottom) => ({left, top, right, bottom, width:right-left, height:bottom-top});
    el(app,'sv-window').getBoundingClientRect = () => box(12, 12, 1268, 756);
    el(app,'tutorial-card').getBoundingClientRect = () => box(0, 0, 350, 250);
    const score = el(app,'sv-score'), progress = el(app,'sv-progress-wrap');
    score.getClientRects = progress.getClientRects = () => [{}];
    score.getBoundingClientRect = () => box(1000, 40, 1150, 70);
    progress.getBoundingClientRect = () => box(32, 80, 1248, 96);
    await jump(app, 9);
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'true');
    assert.equal(el(app,'tutorial-card').classList.contains('tutorial-compact'),false);
    assert.equal(app.document.querySelectorAll('#tutorial-mask rect[id^="tutorial-hole"]').length,2);
    el(app,'tutorial-toggle').click();
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'false');
    el(app,'tutorial-toggle').click();
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'true');
    assert.deepEqual(app.errors,[]);
  } finally { await dispose(app); }
});

test('mobile lesson instructions start expanded, and each new step restores a manually hidden hint', async () => {
  const app = fresh({tutorialSeen:false,innerWidth:390});
  try {
    await jump(app,7);
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'true');
    assert.match(el(app,'tutorial-intro').textContent,/Tap Try lesson/);
    assert.equal(el(app,'tutorial-next').textContent,'Try lesson →');
    el(app,'tutorial-toggle').click();
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'false');
    await next(app);
    assert.equal(el(app,'tutorial-toggle').getAttribute('aria-expanded'),'true');
    assert.equal(el(app,'tutorial-card').classList.contains('tutorial-compact'),false);
    assert.deepEqual(app.errors,[]);
  } finally {await dispose(app);}
});

test('unlock, My Trees, save, and reopening steps explain and perform the actual navigation', async () => {
  const app = fresh({tutorialSeen:false,innerWidth:390});
  try {
    await jump(app,16);
    assert.equal(app.ev('nodeStatus(3)'),'available');
    assert.equal(el(app,'tutorial-next').textContent,'My Trees →');
    assert.match(el(app,'tutorial-intro').textContent,/Tap 📚/);
    assert.equal(el(app,'btn-my-trees').hasAttribute('inert'),false);
    el(app,'btn-my-trees').click(); await tick();
    assert.equal(el(app,'tutorial-section').value,'17');
    assert.equal(el(app,'library-modal-backdrop').classList.contains('open'),true);
    assert.equal(el(app,'tutorial-next').textContent,'Save sample →');
    assert.match(el(app,'tutorial-intro').textContent,/name this sample Tutorial tree/);
    await next(app);
    assert.equal(el(app,'tutorial-section').value,'18');
    assert.equal(app.document.querySelector('.lc-name').textContent,'Tutorial tree');
    assert.equal(el(app,'tutorial-next').textContent,'Open tree →');
    assert.equal(app.window.localStorage.getItem('tree-library'),null);
    const rename = app.document.querySelector('.lc-rename');
    assert.equal(rename.closest('[inert]'),null);
    app.window.prompt = () => 'My renamed sample';
    rename.click(); await tick();
    assert.equal(app.document.querySelector('.lc-name').textContent,'My renamed sample');
    app.document.querySelector('.lc-dup').click(); await tick();
    assert.equal(app.document.querySelectorAll('.library-card').length,2);
    assert.equal(app.window.localStorage.getItem('tree-library'),null);
    await next(app);
    assert.equal(el(app,'tutorial-section').value,'19');
    assert.equal(el(app,'library-modal-backdrop').classList.contains('open'),false);
    assert.equal(el(app,'tree-menu').classList.contains('open'),true);
    assert.equal(app.ev('state.libraryId !== null'),true);
    assert.deepEqual(app.errors,[]);
  } finally {await dispose(app);}
});

test('advancing through the tutorial keeps practice edits until the tour ends', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    await jump(app,13);
    const label = app.ev('state.nodes.get(2).el.querySelector(".node-text")');
    label.textContent='My practice topic';
    label.dispatchEvent(new app.window.Event('input'));
    await next(app);
    assert.equal(app.ev('state.nodes.get(2).label'),'My practice topic');
    await next(app);
    assert.equal(app.ev('state.nodes.get(2).label'),'My practice topic');
    el(app,'tutorial-skip').click();
    assert.equal(app.ev('state.nodes.size'),0);
    assert.deepEqual(app.errors,[]);
  } finally {await dispose(app);}
});

test('the saved-tree step keeps the copy just saved when the demo library already has entries', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    app.ev("libraryCache={older:{name:'Earlier example',savedAt:1,data:buildTreeJSON(true)}}");
    await jump(app,17);
    await next(app);
    const savedId = app.ev('state.libraryId');
    assert.notEqual(savedId,'older');
    assert.equal(app.ev('libraryCache[state.libraryId].name'),'Tutorial tree');
    assert.equal(app.document.querySelector('.library-card-open .lc-name').textContent,'Tutorial tree');
    await next(app);
    assert.equal(app.ev('state.libraryId'),savedId);
    assert.equal(el(app,'library-modal-backdrop').classList.contains('open'),false);
    assert.deepEqual(app.errors,[]);
  } finally {await dispose(app);}
});

test('file tab and prompt have separate spotlights that leave the topic tab shaded', async () => {
  const app = fresh({tutorialSeen:false});
  try {
    await jump(app, 3);
    const box = (left, top, right, bottom) => ({left, top, right, bottom, width:right-left, height:bottom-top});
    const tab = el(app, 'tree-mode-tab-file'), panel = el(app, 'tree-mode-file-panel');
    tab.getClientRects = panel.getClientRects = () => [{}];
    tab.getBoundingClientRect = () => box(300, 100, 500, 140);
    panel.getBoundingClientRect = () => box(100, 170, 500, 400);
    el(app, 'tutorial-toggle').click();
    const holes = [...app.document.querySelectorAll('#tutorial-mask rect[id^="tutorial-hole"]')];
    assert.equal(holes.length, 2);
    assert.equal(+holes[0].getAttribute('x'), 300);
    assert.equal(+holes[0].getAttribute('width'), 200);
    assert.equal(+holes[1].getAttribute('y'), 164);
    assert.ok(holes.every(h => !(150 >= +h.getAttribute('x') && 150 <= +h.getAttribute('x') + +h.getAttribute('width') && 120 >= +h.getAttribute('y') && 120 <= +h.getAttribute('y') + +h.getAttribute('height'))));
    await jump(app, 4);
    assert.equal(app.document.querySelectorAll('.tutorial-extra-spotlight').length, 0);
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('notes drawing controls work during the tour and restore the original sketch and tool', async () => {
  const app = fresh();
  try {
    app.window.__tree = app.fixture('mini-tree.json');
    app.ev(`loadFromJSON(JSON.parse(__tree)); state.nodes.get(2)._drawing = [{color:'red',points:[[10,20],[30,40]]}];
      openViewer(state.nodes.get(2)._sessionTxt, 2); toggleNotesPanel(); setNotesMode(true);`);
    app.document.querySelector('[data-drawing-tool="red"]').click();
    const drawingDOM = el(app,'sv-drawing-pad').firstChild;
    const drawing = app.ev('state.nodes.get(2)._drawing');
    el(app,'menu-tutorial').click(); await jump(app,11);
    assert.equal(el(app,'sv-notes-ta').hidden,false);
    el(app,'sv-notes-draw-tab').click();
    assert.equal(el(app,'sv-notes-drawing').hidden,false);
    app.document.querySelector('[data-drawing-tool="blue"]').click();
    assert.equal(app.ev('drawingTool'),'blue');
    app.ev(`state.nodes.get(2)._drawing=[{color:'blue',points:[[1,2],[3,4]]}]; renderNotesDrawing();`);
    el(app,'sv-drawing-undo').click();
    assert.equal(app.ev('state.nodes.get(2)._drawing.length'),0);
    el(app,'tutorial-skip').click(); await tick();
    assert.equal(app.ev('state.nodes.get(2)._drawing'),drawing);
    assert.equal(el(app,'sv-drawing-pad').firstChild,drawingDOM);
    assert.equal(el(app,'sv-notes-drawing').hidden,false);
    assert.equal(el(app,'sv-notes-draw-tab').getAttribute('aria-selected'),'true');
    assert.equal(app.ev('drawingTool'),'red');
    assert.equal(app.document.querySelector('[data-drawing-tool="red"]').getAttribute('aria-pressed'),'true');
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});

test('page exit restores and saves real unsaved work rather than tutorial examples', async () => {
  const app = fresh();
  try {
    app.window.__tree = app.fixture('mini-tree.json');
    app.ev(`loadFromJSON(JSON.parse(__tree)); state.topic='My unsaved work'; state.nodes.get(1).label='My edited topic';`);
    el(app,'menu-tutorial').click(); await jump(app,17); await next(app);
    app.ev('autosaveTreeOnPageExit()');
    assert.equal(app.window.localStorage.getItem('tree-library'), null);
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    assert.equal(active(app),false);
    const entries=Object.values(JSON.parse(app.window.localStorage.getItem('tree-library')));
    assert.equal(entries.length,1);
    assert.equal(entries[0].data.topic,'My unsaved work');
    assert.ok(entries[0].data.nodes.some(n=>n.label==='My edited topic'));
    assert.ok(!JSON.stringify(entries).includes('Tutorial tree'));
    assert.deepEqual(app.errors, []);
  } finally { await dispose(app); }
});
