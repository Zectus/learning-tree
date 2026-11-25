const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, ROOT } = require('./harness');

const tick = (ms = 0) => new Promise(resolve => setTimeout(resolve, ms));

function loadTree(app, fixture) {
  app.window.__json = app.fixture(fixture);
  return app.ev('loadFromJSON(JSON.parse(__json))');
}

/* ── H1: Failed cloud library load must never overwrite account library ── */
test('H1: failed cloud library load blocks writes, retries load, and never wipes cloud library', async () => {
  const app = loadApp();
  try {
    loadTree(app, 'mini-tree.json');
    let getCalls = 0;
    const writes = [];
    app.window.cloud = {
      getLibrary: async () => { getCalls++; throw new Error('offline'); },
      setLibrary: async (...args) => { writes.push(['setLibrary', ...args]); },
      setLibraryEntry: async (...args) => { writes.push(['setLibraryEntry', ...args]); },
      removeLibraryEntry: async (...args) => { writes.push(['removeLibraryEntry', ...args]); },
      updateLibraryEntries: async (...args) => { writes.push(['updateLibraryEntries', ...args]); },
    };
    app.ev("state.accountUser = { uid: 'u1', email: 'a@b.co' }");
    await app.ev('refreshLibraryFromSource()');
    assert.equal(app.ev('libraryReady'), false);
    assert.equal(app.ev('libraryLoadFailed'), true);
    assert.equal(getCalls, 1);

    // Attempting to save while cloud load is failed retries getLibrary, still fails, and performs zero writes.
    app.window.prompt = () => 'Should Not Wipe';
    await app.ev('saveCurrentTreeToLibrary()');
    assert.equal(getCalls, 2);
    assert.deepEqual(writes, []);
    assert.equal(app.ev('state.libraryId'), null);
    assert.match(app.toasts().join(' '), /Couldn't reach your saved trees/);

    // Once connection recovers, save retries load, preserves existing cloud trees, and writes only the new entry.
    app.window.cloud.getLibrary = async () => ({
      existing1: { name: 'Other Device Tree', savedAt: 100, data: { topic: 'Other', nodes: [{ id: 'a', label: 'A' }] } },
    });
    app.window.prompt = () => 'Recovered Save';
    await app.ev('saveCurrentTreeToLibrary()');
    assert.equal(app.ev('libraryReady'), true);
    assert.equal(app.ev('libraryLoadFailed'), false);
    assert.equal(writes.length, 1);
    assert.equal(writes[0][0], 'setLibraryEntry');
    assert.equal(writes[0][1], 'u1');
    const savedId = writes[0][2];
    assert.equal(writes[0][3].name, 'Recovered Save');
    assert.ok(app.ev('libraryCache.existing1'));

    // Rename, duplicate, and delete each touch only a single entry (no whole-library setLibrary).
    app.window.prompt = () => 'Renamed Save';
    await app.ev(`renameLibraryEntry(${JSON.stringify(savedId)})`);
    assert.equal(writes[1][0], 'setLibraryEntry');
    assert.equal(writes[1][2], savedId);
    assert.equal(writes[1][3].name, 'Renamed Save');

    await app.ev(`duplicateLibraryEntry(${JSON.stringify(savedId)})`);
    assert.equal(writes[2][0], 'setLibraryEntry');
    const dupId = writes[2][2];
    assert.notEqual(dupId, savedId);

    app.window.confirm = () => true;
    await app.ev(`deleteLibraryEntry(${JSON.stringify(dupId)})`);
    assert.equal(writes[3][0], 'removeLibraryEntry');
    assert.equal(writes[3][2], dupId);
    assert.equal(writes.some(w => w[0] === 'setLibrary'), false);
  } finally {
    app.dom.window.close();
  }
});

/* ── H2: Failed cloud progress load must never seed local data or overwrite cloud ── */
test('H2: failed cloud progress load shows error, skips local seeding, and blocks cloud flush', async () => {
  const app = loadApp();
  try {
    // Seed local guest progress before signing in.
    app.window.localStorage.setItem('tree-progress', JSON.stringify({
      alpha: { Alpha: { done: true } },
    }));
    const writes = [];
    app.window.cloud = {
      getProgress: async () => { throw new Error('network down'); },
      setProgress: async (...args) => { writes.push(['setProgress', ...args]); },
      updateProgressTrees: async (...args) => { writes.push(['updateProgressTrees', ...args]); },
      setProgressForTree: async (...args) => { writes.push(['setProgressForTree', ...args]); },
    };
    app.ev("state.accountUser = { uid: 'u1', email: 'a@b.co' }");
    await app.ev('refreshProgressFromSource()');
    assert.equal(app.ev('progressReady'), false);
    assert.equal(app.ev('progressLoadFailed'), true);
    assert.deepEqual(writes, []);
    assert.match(app.toasts().join(' '), /Couldn't load your progress/);

    // Subsequent edits and tab-hide flush must NOT overwrite cloud while progressReady is false.
    loadTree(app, 'mini-tree.json');
    app.ev('state.nodes.get(1).done = true; autoSaveProgress()');
    await app.ev('flushProgress()');
    assert.deepEqual(writes, []);
    assert.equal(app.ev('progressPending'), true);
  } finally {
    app.dom.window.close();
  }
});

/* ── H3: Per-tree progress writes and fresh-account merge avoid whole-blob clobbering ── */
test('H3: cloud progress flush updates only dirty trees and fresh-account seeding merges per entry', async () => {
  const app = loadApp();
  try {
    const progressPatches = [];
    const libraryMerges = [];
    app.window.cloud = {
      getProgress: async () => ({
        other_tree: { Root: { done: true } },
      }),
      updateProgressTrees: async (uid, patch) => { progressPatches.push({ uid, patch }); },
      setProgress: async () => { throw new Error('Should not overwrite whole progress blob'); },
      getLibrary: async () => ({}),
      updateLibraryEntries: async (uid, entries) => { libraryMerges.push({ uid, entries }); },
      setLibrary: async () => { throw new Error('Should not overwrite whole library blob'); },
    };
    app.window.localStorage.setItem('tree-library', JSON.stringify({
      local1: { name: 'Local Tree', savedAt: 10, data: { topic: 'Local', nodes: [{ id: 'a', label: 'A' }] } },
    }));
    app.ev("state.accountUser = { uid: 'u2', email: 'b@b.co' }");
    await app.ev('refreshProgressFromSource()');
    await app.ev('refreshLibraryFromSource()');

    // Fresh-account library seeding uses updateLibraryEntries instead of setLibrary.
    assert.equal(libraryMerges.length, 1);
    assert.equal(libraryMerges[0].uid, 'u2');
    assert.ok(libraryMerges[0].entries.local1);

    // Modifying mini-tree progress flushes ONLY mini-tree's key, leaving other_tree untouched.
    loadTree(app, 'mini-tree.json');
    app.ev('state.nodes.get(1).done = true; autoSaveProgress()');
    await app.ev('flushProgress()');
    assert.equal(progressPatches.length, 1);
    assert.equal(progressPatches[0].uid, 'u2');
    assert.deepEqual(Object.keys(progressPatches[0].patch), ['alpha']);
    assert.equal(progressPatches[0].patch.alpha.Alpha.done, true);
  } finally {
    app.dom.window.close();
  }
});

/* ── M1 & L1: Non-string node labels and HTML attribute escaping ── */
test('M1 & L1: non-string labels coerce safely and svEsc escapes quotes and non-strings', () => {
  const app = loadApp();
  try {
    const ok = app.ev("loadFromJSON({ topic: 'Numbers', nodes: [{ id: '1', label: 42 }, { id: '2', label: null, requires: ['1'] }] })");
    assert.equal(ok, true);
    assert.equal(app.ev('state.nodes.get(1).label'), '42');
    assert.equal(app.ev('state.nodes.get(2).label'), '');
    assert.equal(app.ev('treeSignature()'), '42');

    assert.equal(app.ev(`svEsc('a"b\\'c<d>&')`), 'a&quot;b&#39;c&lt;d&gt;&amp;');
    assert.equal(app.ev('svEsc(null)'), '');
    assert.equal(app.ev('svEsc(123)'), '123');
  } finally {
    app.dom.window.close();
  }
});

/* ── M3: Unsaved edits to a linked tree are preserved before another tree replaces the canvas ── */
test('M3: opening another saved tree preserves unsaved edits on the currently linked tree', async () => {
  const app = loadApp();
  try {
    app.ev(`libraryCache = {
      t1: { name: 'Tree One', savedAt: 100, data: { topic: 'One', nodes: [{ id: 'a', label: 'A' }] } },
      t2: { name: 'Tree Two', savedAt: 200, data: { topic: 'Two', nodes: [{ id: 'b', label: 'B' }] } },
    }; writeLocalLibrary(libraryCache);`);

    app.ev("openLibraryEntry('t1')");
    assert.equal(app.ev('state.libraryId'), 't1');
    app.ev("state.nodes.get(1)._sessionTxt = 'Edited lesson content'");

    // Switching to t2 must preserve t1's edited lesson instead of discarding it.
    app.ev("openLibraryEntry('t2')");
    assert.equal(app.ev('state.libraryId'), 't2');
    assert.equal(app.ev('state.topic'), 'Two');
    const stored = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(stored.t1.data.nodes[0].content, 'Edited lesson content');
  } finally {
    app.dom.window.close();
  }
});

/* ── M4: Pinned JSXGraph version and SRI + crossOrigin on CDN loaders ── */
test('M4: CDN scripts and stylesheets use pinned versions, SRI hashes, and anonymous CORS', () => {
  const app = loadApp();
  try {
    assert.doesNotMatch(app.ev('JSXGRAPH_URL'), /jsxgraph@1\//);
    assert.match(app.ev('JSXGRAPH_URL'), /jsxgraph@1\.\d+\.\d+\//);
    assert.match(app.ev('JSXGRAPH_CSS'), /jsxgraph@1\.\d+\.\d+\//);

    // Trigger KaTeX and graph lib injection and verify integrity + crossOrigin attributes.
    app.ev('loadKatex().catch(() => {})');
    app.ev("loadGraphLibs('function2d').catch(() => {})");
    app.ev("loadGraphLibs('surface3d').catch(() => {})");

    const externalTags = [...app.document.head.querySelectorAll('script[src^="https://"], link[href^="https://"]')];
    assert.ok(externalTags.length >= 6);
    for (const tag of externalTags) {
      assert.match(tag.integrity, /^sha384-[A-Za-z0-9+/=]+$/, `missing SRI on ${tag.src || tag.href}`);
      assert.equal(tag.crossOrigin, 'anonymous', `missing crossOrigin on ${tag.src || tag.href}`);
    }
  } finally {
    app.dom.window.close();
  }
});

/* ── M5: Firebase Realtime Database rules are committed and enforce isolation/validation ── */
test('M5: database.rules.json and firebase.json enforce per-user access control and schema validation', () => {
  const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
  assert.equal(fb.database.rules, 'database.rules.json');

  const rules = JSON.parse(fs.readFileSync(path.join(ROOT, 'database.rules.json'), 'utf8'));
  assert.equal(rules.rules['.read'], false);
  assert.equal(rules.rules['.write'], false);
  assert.equal(rules.rules.users.$uid['.read'], 'auth != null && auth.uid === $uid');
  assert.equal(rules.rules.users.$uid['.write'], 'auth != null && auth.uid === $uid');
  assert.equal(rules.rules.usernames['.read'], undefined, 'root /usernames must not be enumerable');
  assert.equal(rules.rules.usernames.$key['.read'], 'auth != null');
  assert.match(rules.rules.usernames.$key['.write'], /!data\.exists\(\)/);
  assert.ok(rules.rules.users.$uid.library.$treeId['.validate']);
  assert.ok(rules.rules.users.$uid.progress.$treeSig.$nodeKey['.validate']);
});

/* ── L2: Export defers URL.revokeObjectURL instead of revoking synchronously ── */
test('L2: exportToJSON defers blob URL revocation so large downloads are not aborted', async () => {
  const app = loadApp();
  try {
    loadTree(app, 'mini-tree.json');
    let revoked = false;
    app.window.URL.createObjectURL = () => 'blob:export-test';
    app.window.URL.revokeObjectURL = () => { revoked = true; };
    app.window.HTMLAnchorElement.prototype.click = () => {};

    app.ev('exportToJSON(false)');
    assert.equal(revoked, false, 'URL should not be revoked synchronously during click');
  } finally {
    app.dom.window.close();
  }
});
