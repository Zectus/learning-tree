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

    // Opening Explore trees fetches only catalog/index.json
    app.ev("openMathAtlas({ target: 'math_integration_techniques' })");
    await tick();
    assert.deepEqual(fetched, ['catalog/index.json']);
    assert.equal(app.document.getElementById('explorer-tree-action').textContent, 'Open tree');

    // Clicking Open tree fetches only tree.json (no lessons yet) and stamps subject topic + lesson indicators
    app.document.getElementById('explorer-tree-action').click();
    await tick();
    assert.deepEqual(fetched, ['catalog/index.json', 'catalog/_placeholder/tree.json']);
    assert.equal(app.ev('state.topic'), 'Integration Techniques');
    assert.equal(app.ev('state.builtinId'), 'math_integration_techniques');
    assert.equal(app.ev('state.nodes.size'), 3);
    assert.equal(app.document.querySelectorAll('.node-lesson-indicator').length, 3);

    // Clicking node 1 lazily fetches its single lesson file and opens the viewer
    app.ev('state.nodes.get(1).el.click()');
    await tick();
    assert.deepEqual(fetched, [
      'catalog/index.json',
      'catalog/_placeholder/tree.json',
      'catalog/_placeholder/lessons/placeholder_1.txt',
    ]);
    assert.ok(app.document.getElementById('session-viewer').classList.contains('sv-open'));

    // Even after reading a built-in lesson, saving on page exit writes only a lightweight pointer (no nodes/lessons)
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const savedId = app.ev('state.libraryId');
    assert.ok(savedId);
    const stored = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(stored[savedId].builtinId, 'math_integration_techniques');
    assert.equal(stored[savedId].data.nodes, undefined);

    // My Trees renders the pointer entry with node count and Open action, and reopens it cleanly
    await app.ev('openLibraryModal()');
    assert.match(app.document.querySelector('.library-card .lc-meta').textContent, /3 nodes/);
    assert.equal(app.document.querySelector('.library-card .lc-open').textContent, 'Open');
    app.document.querySelector('.library-card .lc-open').click();
    await tick();
    assert.equal(app.ev('state.builtinId'), 'math_integration_techniques');
    assert.equal(app.ev('state.libraryId'), savedId);

    // Editing the built-in tree forks it into a full snapshot (copy-on-write) on save
    app.ev('doAddNode()');
    assert.equal(app.ev('isUnmodifiedBuiltinTree()'), false);
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const forked = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(forked[savedId].builtinId, undefined);
    assert.equal(forked[savedId].data.nodes.length, 4);
  } finally {
    app.dom.window.close();
  }
});
