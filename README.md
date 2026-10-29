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
2. **Tree ▾ → Generate tree lessons** downloads one AI work file with the tree, shared lesson rules, and a prerequisite-ordered queue. Attach it in an AI chat with the short message shown in the panel. Import its lesson checkpoints together, even from an interrupted response. Download a fresh work file to resume only missing lessons.
3. **📚 My Trees** saves whole trees (with their lessons) in this browser, or in your account when signed in.

Lesson files mark each question's correct option inline with `[ANSWER: X]`.

## Automatic generation with your subscription

An optional local companion can fill the selected nodes without copying prompts
or moving lesson files. It uses the documented ChatGPT OSS plan-usage sign-in or
your official Claude Code subscription session. It has no paid model-API fallback.

```sh
npm ci --prefix companion
npm run companion
# Open http://127.0.0.1:8765
```

Choose **Automatic · use my subscription** in the lesson generation screen.
The hosted app can hand its tree and selection to the local app; completed
lessons return to the original tab automatically. Jobs checkpoint each lesson,
run independently of the browser tab, and support pause/resume and recovery.
The computer and companion process must remain running.

See [setup instructions, provider limitations, and remaining user steps](docs/assistant-setup.md).
This is a local-only worker, not a public multi-user backend. The existing file
workflow remains available. Companion tests use simulated providers and do not
consume a subscription: `npm run test:companion`.

## Generating and resuming lessons

The work file contains the full tree structure and the teaching prompt **once**.
It omits existing lesson text, quiz answers, notes, and personal progress to keep
the input smaller. Choose how many missing lessons to generate. Automatic selection fills required
topics first, moving left to right by prerequisite level and preferring topics
with more distinct downstream dependents within a level. Optional topics enter
only when the count exceeds the missing required topics. Manual selection uses
**Select nodes on map**: tap nodes (including locked topics) to select the exact
batch, then confirm. Existing lessons are dimmed and cannot be selected. The
preview lists the selected lessons in prerequisite order. Selection does not
change learning progress, and a new tree resets the batch settings.

Only the selected nodes enter the work file's queue; the rest of the tree stays
as context. Single-node jobs use the concrete node prompt and a short JSONL
delivery instruction, with no continuation or subagent guidance. Multi-node
jobs keep checkpoint instructions and mention subagents only when independent
selected branches can run in parallel. Numerical reply limits are capped to the
batch size. A lesson being generated does not mark its topic learned or unlock it.

Free chats need no API, file tools, subscription, or subagents. The default is
one complete lesson per reply. Say **Continue** in the same chat to advance using
the same instructions. Increase the reply size when the AI has enough output
capacity. Upload a `.jsonl`/`.ndjson` file or paste the entire response into the
generation panel; code fences and surrounding prose are accepted. Multiple files
can be selected together and import automatically. **Import pasted reply** is
only for the text box; it is disabled when the box is empty. Results name the
input they describe, and canceling a file picker or an empty action preserves
the previous result. Loading another tree clears the previous tree's receipt.
A complete record is saved independently:

```json
{"format":"learning-tree-lesson/v1","treeKey":"<from the work file>","id":"<node id>","content":"=== SECTION 1: Title ===\n...finished lesson..."}
```

Each JSONL record occupies **one physical line**. A JSON serializer escapes the
lesson's newlines, quotes, and LaTeX backslashes; the imported lesson keeps its
original text. A cut-off or malformed line is ignored while complete records
before and after it are recovered. No enclosing array or final closing marker
is needed. The current unfinished lesson cannot be recovered, nor can content
the AI has not yet published or saved. Start the next attempt from the last
complete checkpoint rather than asking the AI to finish a broken JSON line.

AIs with file tools are instructed to append/save and expose the journal after
each lesson, and continue while able. They may also keep an atomically updated
whole-tree JSON. On a resumed job, the work file omits earlier lesson text;
merge the new records into the original tree and export from the app to retain
all previous content. AIs with subagents can generate a small wave of independent
branches; one coordinator validates and checkpoints each result immediately,
and descendants wait for their prerequisites. The app accepts the same records
from either workflow, including worker output received out of order.

Imports merge only completed lesson text into the **currently loaded tree**;
they preserve answers, notes, completion flags, viewport, and library identity.
Existing valid lessons are kept, making repeated/overlapping imports safe. A
tree identity rejects output for a different structure or edited scope. Lesson
validation checks headings, closed blocks, unique question numbers, answer keys,
and options; it does not assess subject accuracy or teaching quality. Intact
structure + content JSON from the AI is also accepted when its structure matches,
including an AI work file with completed lesson text inside `tree.nodes`.
The work file's `completed` and `queue` lists do not substitute for actual lesson
text; its identity must match both the nested tree and the currently loaded tree.
Use **Load JSON** to open a different tree instead.

For reviewed lesson corrections, enable **Replace existing lessons with
corrections** before uploading files or importing a pasted reply. This accepts
the same JSONL records or filled checkpoint as normal generation. Only valid
lessons belonging to the current tree can replace content. Identical records
are skipped. Before the first replacement, the app downloads one full tree
backup with the original lesson texts; a batch of files shares that backup.
Files apply in selection order, so put the latest corrections last. The option
resets after importing or opening another tree. Notes, drawings, completion,
and library identity stay. Saved quiz and bonus answers stay only where the
numbered question, options, and answer key are unchanged; changed questions
start unanswered, and the corrected viewer rebuilds when reopened. Switching
trees while files load cancels the import, even if the new tree has the same
structure. The backup includes edits made during loading and precedes all
records in the batch.

A review summary describes the teaching problems and their fixes; it is not
lesson content. A revised node prompt informs the shared app templates, so both
single-node prompts and fresh whole-tree work files use the same guidance.
A corrections-only JSONL applies selected revised lessons. A filled checkpoint
contains the current lessons inside `tree.nodes`; importing it merges content
into the loaded tree. Its instructions and claimed queue do not override the
app's fresh work file or the lessons actually present.

The shared English and Spanish lesson rules ask the author to distinguish
prior knowledge, definitions, supplied inputs, and new consequences; develop
the choice, reason, operation, and intermediate step behind each central
result; explain unfamiliar operations and plotting conventions at first use;
and leave meaningful reasoning for later questions. Bonus questions may combine
established tools without introducing untaught premises. These rules guide
authorship; the importer checks file structure, not teaching quality.

The English prompt also distinguishes actual operations from reported data,
individual outcomes from distributional or finite-data claims, and answer
equivalence from a requested coordinate representation. Approximation checks
account for changes to their own comparison scales and the relevant range or
history. Its graph instructions document conditional expressions for defined
piecewise or continuous values and the choice between scalar plots and paths.

After an import, the app immediately checkpoints the updated tree to My Trees
using its existing local save/cloud outbox. Storage failures are reported; use
**Download tree with completed lessons** to keep an independent usable backup.
For another AI or a fresh chat, download the work file again: finished lessons
are listed as completed and only missing ones remain in the queue. The full
content export still uses the existing tree JSON schema, so older trees and
lessons remain compatible. Single-node prompt/TXT controls remain available
under **Single lesson / legacy TXT** in the learn dialog.

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
