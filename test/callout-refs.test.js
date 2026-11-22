const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');

const SAMPLE_LESSON = `=== SECTION 1: Normed spaces ===

Before computing distances, fix the axioms once.

[CALLOUT]
id: norm
label: Definition
title: Norm and normed vector space

Let \\( V \\) be a vector space over \\( \\mathbb{K} \\). A norm satisfies three axioms:

(1) Positive definiteness: \\( \\|x\\| \\ge 0 \\), and \\( \\|x\\| = 0 \\) iff \\( x = 0 \\).

(2) Absolute homogeneity: \\( \\|\\lambda x\\| = |\\lambda|\\|x\\| \\).

(3) Triangle inequality: \\( \\|x + y\\| \\le \\|x\\| + \\|y\\| \\).
[/CALLOUT]

Notice that in axiom [REF: norm.1 | (1)] the zero appears in two roles. Two consequences of axiom [REF: norm.2 | (2)] follow immediately, and the whole [REF: norm | norm definition] determines geometry. Also see [REF: proof_box | the short proof] and Section 2.

[CALLOUT]
id: caution_zero
label: Common Pitfall
tone: caution
Case 1: Dropping homogeneity leaves only a metric-like function.
[/CALLOUT]

[CALLOUT]
id: proof_box
label: Proof
title: Reverse triangle inequality
tone: note
collapsed: true
Apply [REF: norm.3 | the triangle inequality] to \\( x = (x - y) + y \\).
[/CALLOUT]

1984. A standalone year line should remain a plain paragraph.

Regular loose bullet list:
- First plain item
- Second plain item

[QUESTION 1]
[ANSWER: A]
By [REF: norm.2 | homogeneity], what is \\( \\|-x\\| \\)?
(A) \\( \\|x\\| \\)
(B) \\( -\\|x\\| \\)
(C) \\( 0 \\)
[/QUESTION]

=== SECTION 2: Examples ===
Check [REF: caution_zero | the scaling pitfall] and [REF: missing_id | fallback plain text].
`;

test('callouts, lists, and [REF] peek-and-jump popovers render and behave cleanly', async () => {
  const app = loadApp({ uiLanguage: 'en' });
  try {
    app.window.lesson = SAMPLE_LESSON;
    app.ev('openViewer(lesson, null)');
    const body = app.document.getElementById('sv-body');

    // Callout tones, headers, body-colon preservation, and collapsed <details>.
    const callouts = body.querySelectorAll('.sv-callout');
    assert.equal(callouts.length, 3);
    assert.equal(callouts[0].dataset.anchor, 'norm');
    assert.ok(callouts[0].classList.contains('sv-callout-key'));
    assert.equal(callouts[0].querySelector('.sv-callout-label').textContent, 'Definition');
    assert.equal(callouts[0].querySelector('.sv-callout-title').textContent, 'Norm and normed vector space');

    assert.ok(callouts[1].classList.contains('sv-callout-caution'));
    assert.match(callouts[1].textContent, /Case 1: Dropping homogeneity/);

    assert.equal(callouts[2].tagName, 'DETAILS');
    assert.equal(callouts[2].open, false);
    assert.ok(callouts[2].classList.contains('sv-callout-note'));

    // Loose (1)/(2)/(3) items merge into one ordered list with automatic id.N anchors.
    const normItems = callouts[0].querySelectorAll('.sv-list-item');
    assert.equal(normItems.length, 3);
    assert.deepEqual([...normItems].map(li => li.dataset.anchor), ['norm.1', 'norm.2', 'norm.3']);
    assert.deepEqual([...normItems].map(li => li.querySelector('.sv-list-marker').textContent), ['(1)', '(2)', '(3)']);

    // Standalone "1984." stays a paragraph; "- " bullets form a <ul>.
    assert.ok([...body.querySelectorAll('p')].some(p => p.textContent.startsWith('1984.')));
    assert.equal(body.querySelectorAll('ul.sv-list-bullet .sv-list-item').length, 2);

    // Dangling [REF: missing_id | fallback plain text] degrades to plain text.
    assert.equal(body.querySelector('.sv-ref[data-ref="missing_id"]'), null);
    assert.match(body.textContent, /fallback plain text/);

    // Clicking a sub-item [REF] opens the peek popover with heading + exact item.
    const ref1 = body.querySelector('.sv-ref[data-ref="norm.1"]');
    assert.ok(ref1);
    ref1.click();
    let pop = app.document.getElementById('sv-ref-popover');
    assert.ok(pop);
    assert.equal(ref1.getAttribute('aria-expanded'), 'true');
    assert.match(pop.querySelector('.sv-ref-pop-head').textContent, /Definition/);
    assert.match(pop.querySelector('.sv-ref-pop-body').textContent, /Positive definiteness/);
    assert.doesNotMatch(pop.querySelector('.sv-ref-pop-body').textContent, /Triangle inequality/);
    // Cloned content inside popover never duplicates data-anchor.
    assert.equal(pop.querySelector('[data-anchor]'), null);
    const jumpBtn = pop.querySelector('.sv-ref-pop-jump');
    assert.equal(jumpBtn.getAttribute('aria-label'), 'Jump to source');
    // Jump button sits in the header row (no separate empty footer row).
    assert.equal(pop.querySelector('.sv-ref-pop-foot'), null);
    assert.equal(jumpBtn.closest('.sv-ref-pop-head'), pop.querySelector('.sv-ref-pop-head'));

    // Escape closes the popover first without closing the viewer window.
    app.press('Escape');
    assert.equal(app.document.getElementById('sv-ref-popover'), null);
    assert.equal(ref1.getAttribute('aria-expanded'), 'false');
    assert.equal(app.document.getElementById('session-viewer').classList.contains('sv-open'), true);

    // Keyboard Enter opens a collapsed callout reference; jumping opens its <details> and highlights it.
    const proofRef = body.querySelector('.sv-ref[data-ref="proof_box"]');
    app.press('Enter', proofRef);
    pop = app.document.getElementById('sv-ref-popover');
    assert.ok(pop);
    assert.match(pop.textContent, /Reverse triangle inequality/);
    // Nested [REF] inside popover clone is flattened to plain text.
    assert.equal(pop.querySelector('.sv-ref'), null);

    // Switching UI language to Spanish translates the jump button tooltip.
    app.ev("setUILanguage('es')");
    assert.equal(pop.querySelector('.sv-ref-pop-jump').getAttribute('aria-label'), 'Ir al origen');

    // Clicking jump opens the collapsed <details>, closes the popover, and flashes highlight.
    pop.querySelector('.sv-ref-pop-jump').click();
    assert.equal(app.document.getElementById('sv-ref-popover'), null);
    assert.equal(callouts[2].open, true);
    assert.ok(callouts[2].classList.contains('sv-ref-highlight'));

    // Clicking the same ref twice toggles it open then closed.
    const wholeRef = body.querySelector('.sv-ref[data-ref="norm"]');
    wholeRef.click();
    assert.ok(app.document.getElementById('sv-ref-popover'));
    wholeRef.click();
    assert.equal(app.document.getElementById('sv-ref-popover'), null);

    // Second Escape (with no popover open) closes the viewer as usual.
    app.press('Escape');
    assert.equal(app.document.getElementById('session-viewer').classList.contains('sv-open'), false);
    await new Promise(resolve => setTimeout(resolve, 0));
  } finally { app.window.close(); }
});

test('validateLessonStructure checks callouts and [REF] targets accurately', () => {
  const app = loadApp();
  try {
    const check = txt => {
      app.window.__txt = txt;
      return JSON.parse(app.ev('JSON.stringify(validateLessonStructure(__txt))'));
    };

    const valid = `=== SECTION 1: Test ===
[CALLOUT]
id: def_a
label: Definición
title: Concepto A
tone: key

(1) Primera propiedad.
(2) Segunda propiedad.
[/CALLOUT]

Por [REF: def_a.1 | la propiedad (1)] y [REF: def_a | la definición].

[QUESTION 1]
[ANSWER: A]
Elige.
(A) Uno
(B) Dos
[/QUESTION]`;
    assert.equal(check(valid).valid, true);

    // Dangling REF target
    const badRef = valid.replace('def_a.1', 'def_a.9');
    const rBadRef = check(badRef);
    assert.equal(rBadRef.valid, false);
    assert.match(rBadRef.errors.join(' '), /def_a\.9.*does not match/);

    // Invalid tone
    const badTone = valid.replace('tone: key', 'tone: purple');
    assert.equal(check(badTone).valid, false);
    assert.match(check(badTone).errors.join(' '), /unsupported tone/i);

    // Duplicate callout id
    const dupId = valid.replace('[/CALLOUT]', '[/CALLOUT]\n[CALLOUT]\nid: def_a\nBody.\n[/CALLOUT]');
    assert.equal(check(dupId).valid, false);
    assert.match(check(dupId).errors.join(' '), /duplicates callout id/i);

    // Empty body
    const emptyBody = valid.replace('(1) Primera propiedad.\n(2) Segunda propiedad.', '');
    assert.equal(check(emptyBody).valid, false);
    assert.match(check(emptyBody).errors.join(' '), /missing its body/i);

    // Nested callout inside question
    const nested = valid.replace('Elige.', '[CALLOUT]\nNested\n[/CALLOUT]\nElige.');
    assert.equal(check(nested).valid, false);
    assert.match(check(nested).errors.join(' '), /cannot be nested/i);

    // Unclosed callout
    const unclosed = valid.replace('[/CALLOUT]', '');
    assert.equal(check(unclosed).valid, false);
    assert.match(check(unclosed).errors.join(' '), /Unclosed \[CALLOUT\]/);
  } finally { app.window.close(); }
});

test('node prompt documents [CALLOUT] and [REF] and keeps parser keywords in English for Spanish lessons', () => {
  const app = loadApp({ uiLanguage: 'es' });
  try {
    app.window.tree = app.fixture('mini-tree.json');
    app.ev('loadFromJSON(JSON.parse(tree))');
    const prompt = app.ev("buildPrompt(2, 'Español')");
    assert.match(prompt, /\[CALLOUT\]/);
    assert.match(prompt, /\[\/CALLOUT\]/);
    assert.match(prompt, /\[REF:/);
    assert.match(prompt, /tone: key/);
    assert.match(prompt, /collapsed:/);
    assert.match(prompt, /keep the header keywords \(id, label, title, tone, collapsed\)/i);
  } finally { app.window.close(); }
});
