const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, ROOT } = require('./harness');

const tick = () => new Promise(resolve => setTimeout(resolve, 0));

function installCatalogFetch(app) {
  const fetched = [];
  app.window.fetch = async url => {
    const clean = String(url).split('?')[0];
    fetched.push(clean);
    const full = path.join(ROOT, clean);
    if (!fs.existsSync(full)) return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    const text = fs.readFileSync(full, 'utf8');
    return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
  };
  return fetched;
}

test('built-in catalog loads lazily: 0 fetches on startup, tree.json on open, lesson .txt on click, pointer-only My Trees save, copy-on-write on edit', async () => {
  const app = loadApp();
  try {
    const fetched = installCatalogFetch(app);
    assert.deepEqual(fetched, []);

    const builtinId = 'math_banach_spaces_and_bounded_operators';

    // Opening Explore trees fetches only catalog/index.json; unbuilt subjects stay "Build tree"
    app.ev("openMathAtlas({ target: 'math_integration_techniques' })");
    await tick();
    assert.deepEqual(fetched, ['catalog/index.json']);
    assert.equal(app.document.getElementById('explorer-tree-action').textContent, 'Build tree');

    // Built-in subject shows "Open tree"
    app.ev(`focusMathItem('${builtinId}')`);
    assert.equal(app.document.getElementById('explorer-tree-action').textContent, 'Open tree');

    // Clicking Open tree fetches only tree.json (no lessons yet) and stamps lesson indicators only for built-in lessons
    app.document.getElementById('explorer-tree-action').click();
    await tick();
    assert.deepEqual(fetched, ['catalog/index.json', `catalog/${builtinId}/tree.json`]);
    assert.equal(app.ev('state.topic'), 'Banach Spaces and Bounded Operators');
    assert.equal(app.ev('state.builtinId'), builtinId);
    assert.equal(app.ev('state.nodes.size'), 20);
    assert.equal(app.document.querySelectorAll('.node-lesson-indicator').length, 1);

    // Clicking the built-in lesson node lazily fetches its single .txt file and opens the viewer
    app.ev('state.nodes.get(1).el.click()');
    await tick();
    assert.deepEqual(fetched, [
      'catalog/index.json',
      `catalog/${builtinId}/tree.json`,
      `catalog/${builtinId}/lessons/normed_spaces_and_equivalence.txt`,
    ]);
    assert.ok(app.document.getElementById('session-viewer').classList.contains('sv-open'));
    assert.equal(app.ev('viewer.total'), 7);
    app.ev('closeViewer()');

    // Clicking a skeleton root node without a built-in lesson opens the Learn modal
    app.ev('state.nodes.get(2).el.click()');
    assert.ok(app.document.getElementById('modal-backdrop').classList.contains('open'));
    app.ev('closeModal()');

    // Even after reading a built-in lesson, saving on page exit writes only a lightweight pointer (no nodes/lessons)
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const savedId = app.ev('state.libraryId');
    assert.ok(savedId);
    const stored = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(stored[savedId].builtinId, builtinId);
    assert.equal(stored[savedId].data.nodes, undefined);

    // My Trees renders the pointer entry with node count and Open action, and reopens it cleanly
    await app.ev('openLibraryModal()');
    assert.match(app.document.querySelector('.library-card .lc-meta').textContent, /20 nodes/);
    assert.equal(app.document.querySelector('.library-card .lc-open').textContent, 'Open');
    app.document.querySelector('.library-card .lc-open').click();
    await tick();
    assert.equal(app.ev('state.builtinId'), builtinId);
    assert.equal(app.ev('state.libraryId'), savedId);

    // Editing the built-in tree forks it into a full snapshot (copy-on-write) on save
    app.ev('doAddNode()');
    assert.equal(app.ev('isUnmodifiedBuiltinTree()'), false);
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const forked = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(forked[savedId].builtinId, undefined);
    assert.equal(forked[savedId].data.nodes.length, 21);
  } finally {
    app.dom.window.close();
  }
});
