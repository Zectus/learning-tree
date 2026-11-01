const test = require('node:test');
const assert = require('node:assert/strict');
const cases = require('./fixtures/tree-design-cases.json');
const { loadApp } = require('./harness');

function schemaFrom(prompt) {
  const match = prompt.match(/OUTPUT SCHEMA\n\n(\{[\s\S]*?\n\})/);
  assert.ok(match, 'the rendered prompt must contain a complete schema example');
  return JSON.parse(match[1]);
}

function readJSON(app, expression) {
  return JSON.parse(app.ev(`JSON.stringify(${expression})`));
}

function loadTree(app, tree) {
  app.window.__tree = JSON.stringify(tree);
  assert.equal(app.ev('loadFromJSON(JSON.parse(__tree))'), true);
  assert.deepEqual(app.toasts(), [], 'import must not silently repair the designed graph');
}

test('topic schemas round-trip free-text metadata and remain importable without repairs', () => {
  const app = loadApp();
  try {
    for (const [topic, language] of [
      ['Optics', 'English'],
      ['The "nearby" value: \\( x \\)\nPaths C:\\notes\\lesson', 'Français (langue "française")'],
      ['微积分 — límites y cambios', 'Español'],
    ]) {
      app.window.__topic = topic;
      app.window.__language = language;
      const prompt = app.ev('buildTreePrompt(__topic, __language)');
      const schema = schemaFrom(prompt);
      assert.equal(schema.topic, topic);
      assert.equal(schema.language, language);
      loadTree(app, schema);
      assert.deepEqual(readJSON(app, 'buildTreeJSON(false)'), schema);
    }
  } finally { app.window.close(); }
});

test('the file-flow schema has a real dependency and imports without dangling references', () => {
  const app = loadApp();
  try {
    const schema = schemaFrom(app.ev('buildTreePromptFromFile()'));
    assert.ok(schema.nodes.some(node => node.requires?.length));
    assert.ok(schema.nodes.some(node => !Object.hasOwn(node, 'requires')));
    loadTree(app, schema);
    assert.deepEqual(readJSON(app, 'buildTreeJSON(false)'), schema);
  } finally { app.window.close(); }
});

// These are first-party review specimens, not independent model generations.
// They exercise the handoff promised by the prompt through the actual app.
for (const specimen of cases) {
  test(`${specimen.id}: teaching briefs and dependencies survive import, export, and lesson assembly`, () => {
    const app = loadApp();
    try {
      const input = structuredClone(specimen.tree);
      if (specimen.id === 'indirect_context') {
        // Exercise import's real transitive-edge removal without making the
        // reviewed specimen itself depend on a redundant direct edge.
        input.nodes.find(node => node.id === 'net_revenue').requires.unshift('line_totals');
      }
      loadTree(app, input);
      const exported = readJSON(app, 'buildTreeJSON(false)');
      assert.equal(exported.topic, specimen.tree.topic);
      assert.equal(exported.language, specimen.tree.language);
      assert.deepEqual(exported.nodes.map(node => node.id), specimen.tree.nodes.map(node => node.id));

      for (const node of exported.nodes) {
        const original = specimen.tree.nodes.find(candidate => candidate.id === node.id);
        assert.equal(node.label, original.label);
        assert.equal(node.explanation, original.explanation);
        assert.equal(node.optional, original.optional);
        assert.deepEqual(node.requires, original.requires);
        app.window.__nodeSlug = node.id;
        const prompt = app.ev('buildPrompt([...state.nodes.values()].find(n => n.slug === __nodeSlug).id, state.language)');
        assert.ok(prompt.includes(node.explanation), `missing current brief for ${node.id}`);
        for (const id of node.requires || []) {
          const prerequisite = exported.nodes.find(candidate => candidate.id === id);
          assert.ok(prompt.includes(`${prerequisite.label} — ${prerequisite.explanation}`),
            `missing actual prerequisite scope ${id} for ${node.id}`);
        }
      }

      const work = readJSON(app, 'buildGenerationPacket()');
      assert.deepEqual(work.tree, exported);
      assert.equal(work.queue.length, exported.nodes.length);
      for (const node of exported.nodes) {
        for (const id of node.requires || []) {
          assert.ok(work.queue.indexOf(id) < work.queue.indexOf(node.id),
            `lesson ${node.id} scheduled before prerequisite ${id}`);
        }
        if (!node.optional) {
          app.window.__nodeSlug = node.id;
          // Required paths must not be blocked by optional enrichment.
          for (const enrichment of exported.nodes.filter(candidate => candidate.optional)) {
            app.window.__optionalSlug = enrichment.id;
            assert.equal(app.ev('generationGraph(buildTreeJSON(false)).downstream.get(__optionalSlug).has(__nodeSlug)'), false);
          }
        }
      }

      if (specimen.id === 'indirect_context') {
        const terminal = exported.nodes.find(node => node.id === 'net_revenue');
        assert.deepEqual(terminal.requires, ['percentage_discount']);
        // The early scope is no longer directly visible. Its necessary relation
        // must remain in the current brief, as the rebuilt prompt requires.
        app.window.__nodeSlug = terminal.id;
        const prompt = app.ev('buildPrompt([...state.nodes.values()].find(n => n.slug === __nodeSlug).id, state.language)');
        assert.ok(prompt.includes('total=sum_i q_i*p_i'));
        assert.ok(!prompt.includes(specimen.tree.nodes[0].explanation));
      }
    } finally { app.window.close(); }
  });
}
