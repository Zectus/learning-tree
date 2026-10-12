const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, ROOT } = require('./harness');
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function load(app, flag, language = 'Spanish') {
  app.window.tree = { language, nodes: [{ id: 'a', label: 'A' }] };
  if (flag !== undefined) app.window.tree.isSpanish = flag;
  app.ev('loadFromJSON(tree)');
}

test('only literal true overrides lesson prompt selection and preserves requested language', async () => {
  const app = loadApp();
  try {
    for (const flag of [true, false, undefined, 'true', 'false', 1, null]) {
      load(app, flag, 'español');
      assert.equal(app.ev('state.isSpanish'), flag === true);
      const prompt = app.ev("buildPrompt(1, 'Spanish')");
      assert.match(prompt, flag === true ? /^Vas a producir/ : /^You are producing/);
      assert.match(prompt, /=== SECCIÓN N:/);
      assert.match(app.ev("buildPrompt(1, 'French')"), flag === true ? /en French/ : /in French/);
      app.ev('openLearnModal(1)');
      assert.equal(app.document.getElementById('node-language-input').value, 'español');
      assert.equal(app.ev('state.language'), 'español');
    }
    load(app, true);
    assert.match(app.ev("buildPrompt(1, '')"), /en Español/);
    app.ev("setUILanguage('es')");
    load(app, false, 'English');
    assert.match(app.ev("buildPrompt(1, 'English')"), /^Vas a producir/);
    app.ev('clearMap()');
    assert.equal(app.ev('state.isSpanish'), false);
    await tick();
  } finally { app.window.close(); }
});

test('AI classification appears in all four tree-generation prompt variants', () => {
  const app = loadApp();
  try {
    for (const language of ['en', 'es']) {
      app.ev(`setUILanguage('${language}')`);
      const prompts = [app.ev("buildTreePrompt('Calculus', 'español peruano')"), app.ev('buildTreePromptFromFile()')];
      for (const prompt of prompts) {
        assert.match(prompt, /"isSpanish": false/);
        assert.match(prompt, /isSpanish:.*(?:Determine it yourself|Determínalo tú)/);
        assert.match(prompt, /(?:mixed\/multilingual|mixta\/multilingüe)/);
      }
      assert.match(prompts[0], /"language": "español peruano"/);
    }
    // A loaded tree's override applies to its lessons, not to designing a new tree.
    app.ev("setUILanguage('en')");
    load(app, true);
    assert.match(app.ev("buildTreePrompt('Physics', 'English')"), /^You are designing/);
  } finally { app.window.close(); }
});

test('exports, library autosave, and tutorial restoration preserve the Spanish flag', async () => {
  const app = loadApp();
  try {
    load(app, true, 'castellano');
    for (const includeContent of [true, false]) {
      const snapshot = app.ev(`buildTreeJSON(${includeContent})`);
      assert.equal(snapshot.isSpanish, true);
      assert.equal(snapshot.language, 'castellano');
      app.window.snapshot = snapshot;
      app.ev('loadFromJSON(snapshot)');
      assert.equal(app.ev('state.isSpanish'), true);
    }
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    const id = app.ev('state.libraryId');
    let saved = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(saved[id].data.isSpanish, true);
    app.ev('state.isSpanish = false');
    app.window.dispatchEvent(new app.window.Event('pagehide'));
    saved = JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(saved[id].data.isSpanish, false);
    app.ev('state.isSpanish = true');
    app.document.getElementById('menu-tutorial').click();
    assert.equal(app.ev('state.tutorialActive'), true);
    assert.equal(app.ev('state.isSpanish'), false); // English tutorial sample.
    app.document.getElementById('tutorial-skip').click();
    await tick();
    assert.equal(app.ev('state.isSpanish'), true);
    assert.match(app.ev("buildPrompt(1, 'castellano')"), /^Vas a producir/);
  } finally { app.window.close(); }
});

test('the existing Spanish calculus tree opts into Spanish prompts on an English interface', async () => {
  const app = loadApp();
  try {
    app.window.tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/spanishcalc.json'), 'utf8'));
    app.ev('loadFromJSON(tree); openLearnModal(1)');
    assert.equal(app.ev('state.isSpanish'), true);
    assert.equal(app.document.documentElement.lang, 'en');
    assert.equal(app.document.getElementById('node-language-input').value, 'español');
    assert.match(app.document.getElementById('prompt-box').value, /^Vas a producir/);
    await tick();
  } finally { app.window.close(); }
});
