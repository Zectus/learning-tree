const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, ROOT } = require('./harness');

test('Spanish and legacy English section markers can coexist without losing content or references', async () => {
  const app = loadApp({ uiLanguage: 'es' });
  try {
    app.window.lesson = `=== SECCIÓN 1: Inicio ===
Consulta la Sección 2 y la Section 3.
[QUESTION 1]
[ANSWER: A]
Elige.
(A) Uno
(B) Dos
[/QUESTION]
=== seccion 2: Continuación ===
Segundo tramo.
=== SECTION 3: Final ===
Último tramo.`;
    app.ev('var parsedLesson = parseTxtSession(lesson)');
    assert.deepEqual(Array.from(app.ev('parsedLesson.sections'), sec => sec.num), ['1', '2', '3']);
    app.ev('openViewer(lesson, null)');
    assert.equal(app.document.querySelectorAll('.sv-section').length, 3);
    assert.equal(app.document.querySelector('.sv-section-label').textContent, 'Sección 1');
    assert.equal(app.document.querySelector('.q-num').textContent, 'Pregunta 1');
    for (const ref of app.document.querySelectorAll('.sv-sec-ref'))
      assert.ok(app.document.getElementById(`sv-section-${ref.dataset.sec}`));
    app.document.querySelector('.q-opt .q-text').parentElement.click();
    assert.equal(app.ev('viewer.answers.size'), 1);
    app.ev("setUILanguage('en')");
    assert.equal(app.document.querySelector('.sv-section-label').textContent, 'Section 1');
    assert.equal(app.document.querySelector('.sv-section-title').textContent, 'Inicio');
    assert.equal(app.ev('viewer.answers.size'), 1);
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally { app.window.close(); }
});

test('English prompt markers stay fixed while requested output language stays editable', () => {
  for (const uiLanguage of ['en', 'es']) {
    const app = loadApp({ uiLanguage });
    try {
      app.window.tree = app.fixture('mini-tree.json');
      app.ev('loadFromJSON(JSON.parse(tree))');
      for (const language of ['Español', 'español', 'Spanish', 'Spanish (Peru)', 'es-PE', 'Castellano']) {
        app.window.requestedLanguage = language;
        const prompt = app.ev('buildPrompt(2, requestedLanguage)');
        assert.match(prompt, /=== SECTION N:/);
        assert.match(prompt, /=== SECTION 1:/);
        assert.doesNotMatch(prompt, /=== SECCIÓN/);
        assert.ok(prompt.includes('Write the entire document in ' + language));
        assert.match(prompt, /\[QUESTION N\]/);
        assert.match(prompt, /fill:.*range:/);
      }
      for (const language of ['English', 'French']) {
        app.window.requestedLanguage = language;
        const prompt = app.ev('buildPrompt(2, requestedLanguage)');
        assert.match(prompt, /=== SECTION N:/);
        assert.doesNotMatch(prompt, /=== SECCIÓN/);
      }
      assert.match(app.ev("buildPrompt(2, '')"), /=== SECTION N:/);
    } finally { app.window.close(); }
  }
});

test('every Spanish example lesson parses all localized sections, questions, and graphs', () => {
  const app = loadApp({ uiLanguage: 'es' });
  try {
    const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/spanishcalc.json'), 'utf8'));
    for (const node of tree.nodes.filter(n => n.content)) {
      assert.doesNotMatch(node.content, /^=== SECTION/m);
      app.window.lesson = node.content;
      const parsed = app.ev('parseTxtSession(lesson)');
      assert.equal(parsed.sections.length, [...node.content.matchAll(/^=== SECCIÓN \d+:/gm)].length, node.id);
      assert.equal(parsed.questions.size, [...node.content.matchAll(/\[QUESTION \d+\]/g)].length, node.id);
      assert.equal(parsed.graphs.size, [...node.content.matchAll(/\[GRAPH\]/g)].length, node.id);
      app.window.parsedLesson = parsed;
      const html = app.ev('renderSession(parsedLesson)');
      assert.doesNotMatch(html, /=== (?:SECTION|SECCIÓN)/);
      assert.match(html, /Sección 1/);
    }
  } finally { app.window.close(); }
});
