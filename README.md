# learning-tree

A prerequisite-tree learning app. You build (or generate) a tree of topics where each node unlocks once its prerequisites are done; each node becomes a generated lesson with quiz questions; progress, notes and saved trees can sync to an account.

Static site, no build step. Firebase (auth + realtime database) is used only for optional account sync.

## Running it

Serve the folder over http — opening `index.html` straight from disk (`file://`) won't work fully, because browsers refuse to load the ES-module `js/persistence/cloud.js` from `file://`, so sign-in and sync are dead. Everything else still works offline.

```sh
python3 -m http.server 8000     # or any static server
# then open http://localhost:8000
```

## How it's used

1. **Tree ▾ → New tree** gives you a prompt to paste into an AI chatbot (from a topic, or with a file attached). Upload the `.json` it produces.
2. Click an available node: **the learn modal** gives you a prompt for that node's lesson. Upload the `.txt` it produces to open the session viewer and answer the questions.
3. **📚 My Trees** saves whole trees (with their lessons) in this browser, or in your account when signed in.

Lesson files mark each question's correct option inline with `[ANSWER: X]`.

## Interface language

On your first visit, the interface uses your browser's preferred supported language
(English or Spanish), falling back to English. A saved language choice takes priority.
Choose **Account → Español / English** to switch the entire interface without
reloading. The choice is remembered in this browser. Menus, dialogs, tooltips,
errors, lesson controls, drawing tools, tutorial examples, and built-in generation
prompts are available in both languages. Blank generation-language fields default
to the interface language; an explicit language or one stored in a tree is preserved.

Tree JSON also includes an AI-determined boolean `isSpanish`, independent of the
user's `language` text. Tree-generation prompts ask the AI to set it to `true`
only for exclusively Spanish output, including regional varieties, and `false`
for other languages or mixed output. Only literal `true` forces the Spanish
lesson prompt template even with an English interface; false or missing flags
keep the usual interface-based template selection. The language field stays
editable and is preserved. The flag survives import, exports, and library saves.

Imported lesson text, tree names, node labels and explanations, account identities,
notes, drawings, and editable field values stay as written. Switching the interface
does not regenerate lessons or reset answers, progress, or the current tree.

## First-visit tutorial

The UI tour opens on the first visit in each browser. A spotlight highlights
actual controls; you can click them, answer a sample question, write or draw notes, edit
nodes, and save a sample in the real My Trees panel. **Show me / Next** can
demonstrate each action for you. No content generation or file upload is needed.
Every step has **Skip tutorial**; Escape skips the whole tour. Use Back and Next
to browse at your own pace.

On desktop, the tour keeps dialogs, lessons, and notes at their normal sizes. Its hint sits
beside the active window when space allows. On phones, the hint stays in a
bottom dock and the active window uses the space above it. Instructions stay visible on every step, with
Back, Next, and Skip available. Moving forward keeps your practice edits until the tour ends.

On phones, choose **Edit** and tap a topic to open its editor. Change its name,
scope, optional setting, and prerequisites in a panel that stays readable at any
tree zoom. The prerequisite dropdown shows existing links you can remove and
valid topics you can add. **+** adds a topic and opens its editor. Dragging or pinching can start
on a topic without opening it. Desktop editing stays inside the topic cards.

The tour temporarily puts aside the current tree and lesson DOM, uses a demo
tree and library in memory, and restores your unsaved work and viewport on exit.
Demo progress, notes, tree saves, and theme changes are never persisted or synced.
Authentication/source refreshes that resolve during the tour are deferred until
the real page is restored. Closing the page restores the real tree before
the usual save-on-exit runs.

Finishing or skipping remembers the choice in this browser and reveals
**Account dropdown → View tutorial**, with the menu revealed and a reminder shown
after dismissal (an already-open lesson or dialog is restored instead).
If browser storage is blocked, the app and replay still work, but the choice
cannot be remembered across reloads.

## Layout

```
index.html            page shell, modals, and the script load order
css/                  one stylesheet per area; theme.css holds every colour/variable
js/core/              scale, state, layout, escape-key stack, toasts, modal focus handling
js/graph/             nodes, viewport (pan/zoom), toolbar
js/learn/             prompt templates + builders, lesson viewer, content-block tools (tables/timelines/graphs)
js/persistence/       tree JSON import/export, progress, saved-tree library, account, Firebase (cloud.js)
js/lib/               autoscroll (middle-click)
scripts/              one-off maintenance scripts
test/                 node:test suite (runs the real index.html + scripts in jsdom)
```

Scripts are plain classic scripts sharing globals, loaded in the order listed in `index.html`; each file's header comment says what it depends on.

## Tests

```sh
npm install
npm test
```

The suite loads `index.html` and every app script into jsdom in page order, so it exercises the real wiring (DOM ids, script order, handlers) rather than isolated copies of the functions.

## Firebase

`js/persistence/cloud.js` contains the project's client config. That config is not a secret; what protects the data is the database's security rules. They should restrict `users/$uid` to `auth.uid === $uid` and allow `usernames/$key` to be written only when it doesn't already exist (see the header of `cloud.js`).

### Filled graph regions

In a lesson's `[GRAPH]` block, `function2d` supports repeatable `fill` lines:

```text
[GRAPH]
type: function2d
xrange: 0, 2
trace: x+1 | label: Upper curve
trace: x^2 | label: Lower curve
fill: x+1, x^2 | range: 0, 1 | label: Area between curves | color: #2d70b3 | opacity: 0.22
[/GRAPH]
```

The first two expressions describe the boundaries; use `0` for the horizontal
axis or constants for rectangles. `range` supplies the horizontal endpoints.
Expressions and endpoints can use graph sliders. Color, label, and opacity
(0–1, default 0.22) are optional. Regions appear behind curves and marks and
participate in automatic vertical fitting. Add traces separately for outlines.
Split regions at crossings or sign changes when separate labels/colors help
explain signed accumulation. Filled paths are sampled illustrations; use finite,
continuous boundaries on the chosen intervals.

[examples/spanishcalc.json](examples/spanishcalc.json) is an importable Spanish
calculus tree with shaded finite-sum and Riemann rectangles, signed integral contributions,
and an accumulation strip controlled by a slider.

Spanish lessons use `=== SECCIÓN N: Título ===` section headings. The parser also
accepts `SECCION` and legacy `SECTION` headings, including mixed files. Prompt
headings follow the requested lesson language, while the viewer's section and
question labels follow the selected interface language. Question, answer, table,
and graph block markers and graph field names keep their existing parser syntax.
