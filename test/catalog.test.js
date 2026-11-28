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

test('every entry in catalog/index.json matches its tree.json, collection item, signature, and DAG invariants', () => {
  const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'catalog', 'index.json'), 'utf8'));
  const app = loadApp();
  try {
    const ids = Object.keys(index.trees);
    assert.ok(ids.length >= 16);
    for (const id of ids) {
      const meta = index.trees[id];
      const item = JSON.parse(app.ev(`JSON.stringify(mathItems.get(${JSON.stringify(id)}) ? { name: mathItems.get(${JSON.stringify(id)}).name, isLeaf: !mathItems.get(${JSON.stringify(id)}).children } : null)`));
      assert.ok(item && item.isLeaf, `Unknown or non-leaf collectionId: ${id}`);
      const treePath = path.join(ROOT, 'catalog', meta.dir || id, 'tree.json');
      assert.ok(fs.existsSync(treePath), `Missing tree.json for ${id}`);
      const tree = JSON.parse(fs.readFileSync(treePath, 'utf8'));
      assert.equal(tree.collectionId, id);
      assert.equal(tree.topic, item.name);
      assert.equal(tree.language, 'English');
      assert.equal(tree.nodes.length, meta.nodeCount);
      for (const n of tree.nodes) {
        assert.match(n.id, /^[a-z][a-z0-9_]*$/);
        assert.ok(n.label && n.label.trim());
        assert.ok(n.explanation && n.explanation.trim());
        assert.equal('done' in n, false);
        if ('requires' in n) assert.ok(Array.isArray(n.requires) && n.requires.length > 0);
        if ('optional' in n) assert.equal(n.optional, true);
      }
      app.window.__tree = tree;
      assert.equal(app.ev('loadFromJSON(__tree)'), true, `loadFromJSON failed for ${id}`);
      assert.equal(app.ev('state.nodes.size'), meta.nodeCount);
      assert.equal(app.ev('treeSignature()'), meta.signature, `Signature mismatch for ${id}`);
      const rawEdgeCount = tree.nodes.reduce((s, n) => s + (n.requires ? n.requires.length : 0), 0);
      const liveEdgeCount = app.ev('buildTreeJSON(false).nodes.reduce((s, n) => s + (n.requires ? n.requires.length : 0), 0)');
      assert.equal(liveEdgeCount, rawEdgeCount, `Dropped or redundant edge in ${id}`);
      for (const n of tree.nodes) {
        const hasEdge = (n.requires && n.requires.length > 0) || tree.nodes.some(m => (m.requires || []).includes(n.id));
        assert.ok(hasEdge, `Isolated node ${n.id} in ${id}`);
      }
      for (const slug of (meta.lessons || [])) {
        assert.ok(fs.existsSync(path.join(ROOT, 'catalog', meta.dir || id, 'lessons', `${slug}.txt`)), `Missing lesson ${slug} in ${id}`);
      }
      if (meta.locales && typeof meta.locales === 'object') {
        const expectedLang = { es: 'Español' };
        for (const [loc, locMeta] of Object.entries(meta.locales)) {
          const locTreePath = path.join(ROOT, 'catalog', meta.dir || id, `tree.${loc}.json`);
          assert.ok(fs.existsSync(locTreePath), `Missing tree.${loc}.json for ${id}`);
          const locTree = JSON.parse(fs.readFileSync(locTreePath, 'utf8'));
          assert.equal(locTree.collectionId, id);
          if (expectedLang[loc]) assert.equal(locTree.language, expectedLang[loc]);
          assert.ok(locTree.topic && locTree.topic.trim());
          assert.equal(locTree.nodes.length, meta.nodeCount);
          for (let i = 0; i < tree.nodes.length; i++) {
            const enNode = tree.nodes[i], locNode = locTree.nodes[i];
            assert.equal(locNode.id, enNode.id, `Node id mismatch in ${id} (${loc}) at index ${i}`);
            assert.deepEqual(locNode.requires || [], enNode.requires || [], `Edges mismatch for ${enNode.id} in ${id} (${loc})`);
            assert.equal(Boolean(locNode.optional), Boolean(enNode.optional), `Optional flag mismatch for ${enNode.id} in ${id} (${loc})`);
            assert.ok(locNode.label && locNode.label.trim());
            assert.ok(locNode.explanation && locNode.explanation.trim());
            assert.equal('done' in locNode, false);
          }
          app.window.__tree = locTree;
          assert.equal(app.ev('loadFromJSON(__tree)'), true, `loadFromJSON failed for ${id} (${loc})`);
          assert.equal(app.ev('state.nodes.size'), meta.nodeCount);
          assert.equal(app.ev('treeSignature()'), locMeta.signature, `Signature mismatch for ${id} (${loc})`);
          for (const slug of (locMeta.lessons || [])) {
            assert.ok(
              fs.existsSync(path.join(ROOT, 'catalog', meta.dir || id, 'lessons', loc, `${slug}.txt`)),
              `Missing localized lesson ${loc}/${slug} in ${id}`
            );
          }
        }
      }
    }
  } finally {
    app.dom.window.close();
  }
});

test('bilingual built-in catalog loads Spanish tree & lessons when UI is Spanish and falls back to English for English-only trees', async () => {
  const app = loadApp();
  try {
    const fetched = installCatalogFetch(app);
    app.ev("setUILanguage('es', false)");

    const bilingualId = 'math_logic_and_proof_methods';
    const openedEs = await app.ev(`openBuiltinTree('${bilingualId}')`);
    assert.equal(openedEs, true);
    assert.deepEqual(fetched, [
      'catalog/index.json',
      `catalog/${bilingualId}/tree.es.json`,
    ]);
    assert.equal(app.ev('state.language'), 'Español');
    assert.equal(app.ev('state.collectionId'), bilingualId);
    assert.equal(app.ev('state.builtinId'), bilingualId);
    assert.equal(app.ev('state.nodes.size'), 14);
    assert.equal(app.document.querySelectorAll('.node-lesson-indicator').length, 14);

    // Clicking the first node lazily fetches its Spanish lesson and opens the viewer
    app.ev('state.nodes.get(1).el.click()');
    await tick();
    assert.deepEqual(fetched, [
      'catalog/index.json',
      `catalog/${bilingualId}/tree.es.json`,
      `catalog/${bilingualId}/lessons/es/statements_and_propositional_connectives.txt`,
    ]);
    assert.ok(app.document.getElementById('session-viewer').classList.contains('sv-open'));
    assert.ok(app.ev('viewer.total') >= 3);
    app.ev('closeViewer()');

    // English-only tree falls back cleanly to English tree.json and lessons/<slug>.txt
    const enOnlyId = 'math_banach_spaces_and_bounded_operators';
    const openedEn = await app.ev(`openBuiltinTree('${enOnlyId}')`);
    assert.equal(openedEn, true);
    assert.equal(app.ev('state.language'), 'English');
    assert.equal(app.ev('state.collectionId'), enOnlyId);
    assert.equal(fetched[fetched.length - 1], `catalog/${enOnlyId}/tree.json`);
    app.ev('state.nodes.get(1).el.click()');
    await tick();
    assert.equal(fetched[fetched.length - 1], `catalog/${enOnlyId}/lessons/normed_spaces_and_equivalence.txt`);
  } finally {
    app.dom.window.close();
  }
});
