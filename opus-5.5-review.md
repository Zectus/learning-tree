# Opus 5.5's Review — Learning Tree audit

_Audit date: 2026-11-24 · Commit audited: `6a8f952` (`main`) · Test suite: **150/150 passing** (`npm test`, ~17 s)_

Scope: the security, data-integrity, persistence/sync, performance, accessibility, maintainability and repo-hygiene of the static app (`index.html`, `js/`, `css/`, `catalog/`). I verified every finding below against the code. Line numbers refer to the commit above.

---

## TL;DR

The app is in good shape for a no-build static site. Escaping is careful, math.js is sandboxed, heavy libraries load lazily, the modal focus handling is real, and the jsdom suite exercises the actual page wiring. **The serious risks are in cloud sync, not the UI.** Library and progress sync both write **whole-blob, last-write-wins** `set()` calls. When a load fails, the in-memory cache becomes empty but the app keeps writing to the cloud. Either case can silently wipe a signed-in user's saved trees or progress.

| # | Severity | Area | Finding |
|---|---|---|---|
| H1 | **High** | Sync | A failed cloud library load, followed by any save, overwrites the entire cloud library |
| H2 | **High** | Sync | A failed cloud progress load, followed by a flush, overwrites all cloud progress, with no error shown |
| H3 | **High** | Sync | Whole-blob last-write-wins across devices and tabs loses other devices' progress and trees |
| M1 | Medium | Data model | Progress is keyed by sorted root labels and node labels, which collide and get orphaned. Non-string labels crash it |
| M2 | Medium | Storage | Full lesson text in localStorage (~5 MB) and whole-library cloud rewrites on every rename or delete |
| M3 | Medium | UX / data | Nothing guards unsaved edits before another tree replaces the canvas |
| M4 | Medium | Supply chain | CDN scripts have no SRI. JSXGraph is unpinned (`@1`). There is no CSP |
| M5 | Medium | Security | The Firebase rules are the only access control, but they aren't versioned or tested |
| M6 | Medium | Process | There is no CI, so `main` deploys to Pages without tests running |
| L1–L8 | Low | Various | Escaping footgun, download URL revoke, docs drift, CSS scale, globals, prompt size… |

---

## High severity

### H1 — A failed cloud library load, followed by a save, wipes the account's library

- [library.js:89-95](js/persistence/library.js#L89-L95): if `cloud.getLibrary()` throws (offline, a transient error, a rules hiccup), the catch block sets `libraryCache = {}` but leaves `librarySource = 'cloud'` (set at line 80).
- [library.js:253-297](js/persistence/library.js#L253-L297): `saveCurrentTreeToLibrary` / `saveCurrentTreeAsNewCopy` / rename / duplicate / delete never check `libraryReady`.
- [library.js:129-136](js/persistence/library.js#L129-L136) → [cloud.js:144-146](js/persistence/cloud.js#L144-L146): `persistLibrary()` calls `set(ref(db, users/${uid}/library), snapshot)`, which **replaces the whole subtree**.

**Scenario:** you sign in on a flaky connection, see the "Couldn't load your saved trees" toast, then click **Save current tree**. The account now holds one tree and every other saved tree is deleted.

**Fix:** on load failure, put the library in an `unavailable` state that blocks writes, or retries the load before writing. Independently, stop rewriting the whole library: use `setLibraryEntry()` (it already exists at [cloud.js:148](js/persistence/cloud.js#L148)) for save/rename/duplicate, and `remove(ref(.../library/id))` for delete.

### H2 — A failed cloud progress load silently resets the account's progress

- [progress.js:102-106](js/persistence/progress.js#L102-L106): on a `getProgress()` failure, `progressCache = {}`. Only a `console.error` runs, with no toast.
- [progress.js:109-115](js/persistence/progress.js#L109-L115): the "fresh account" branch then sees an empty cache. It uploads **this browser's local guest progress** over the account's real progress via `persistProgressNow()`.
- Even with no local progress, the next answer or note marks a write pending. [progress.js:178-181](js/persistence/progress.js#L178-L181) flushes it on the next `visibilitychange`, and [progress.js:141](js/persistence/progress.js#L141) `setProgress()` overwrites everything with only the current tree.

**Fix:** track a `progressLoaded` flag. Never seed or flush to the cloud unless the load succeeded. Show a toast on failure. Write per tree (`users/{uid}/progress/{sig}`) instead of the whole map.

### H3 — Whole-blob last-write-wins across devices and tabs

Even when nothing fails, the two sync paths clobber each other:

- Progress is read from the cloud only on sign-in or auth change ([progress.js:94-101](js/persistence/progress.js#L94-L101)). After that, every tab hide writes the **entire** `progressCache` ([progress.js:141](js/persistence/progress.js#L141)).
  **Scenario:** a laptop tab stays open for days. You study tree B on your phone, then switch away from the laptop tab. The laptop's stale map overwrites the phone's tree-B progress.
- The library refreshes only when the modal opens and the cache is older than 15 s ([library.js:427-431](js/persistence/library.js#L427-L431)). After that, `persistLibrary()` writes the whole map, so trees saved on another device since the last fetch disappear.

**Fix (in increasing effort):**
1. Write per entry and per tree with `update()`, so unrelated trees never overwrite each other. This alone removes most of the loss.
2. Add `updatedAt` to each entry and progress record, and merge on load (newest wins per record).
3. Subscribe with `onValue` to keep caches live while signed in.

> [!IMPORTANT]
> H1–H3 share one root cause: `set()` on `users/{uid}/library` and `users/{uid}/progress`. Moving to per-record writes fixes most of all three.

---

## Medium severity

### M1 — Fragile progress identity

- [progress.js:84-88](js/persistence/progress.js#L84-L88): a tree's identity is its **sorted, lowercased root labels**. Two unrelated trees with the same root (e.g. "Foundations", "Introduction") share progress. Renaming a root orphans all progress for that tree.
- [progress.js:189](js/persistence/progress.js#L189) / [progress.js:209](js/persistence/progress.js#L209): records are keyed by **node label**. Renaming a topic loses its answers, notes and drawing, and two nodes with the same label share one record.
- [io.js:90](js/persistence/io.js#L90) accepts any `label` type (`n.label ?? ''`). A JSON with `"label": 5` loads, then `n.label.trim()` at [progress.js:86](js/persistence/progress.js#L86) throws `TypeError`.

**Fix:** coerce `label = String(n.label ?? '')` on import. Longer term, store a stable `treeId` (UUID) in the tree JSON and library entry, and key node records by slug/id. Migrate by computing the old signature once.

### M2 — Storage capacity and write amplification

- A real lesson is ~48 KB ([normed_spaces_and_equivalence.txt](catalog/math_banach_spaces_and_bounded_operators/lessons/normed_spaces_and_equivalence.txt)). The guest library stores full lesson text in **localStorage** ([library.js:43-49](js/persistence/library.js#L43-L49)). That ~5 MB per-origin quota is shared with progress (including freehand drawings), the exit outbox, and settings. Expect "storage full" failures at roughly 80–100 saved lessons.
- Signed in, **every** rename, duplicate or delete re-uploads the whole library, with every lesson of every tree ([library.js:318-348](js/persistence/library.js#L318-L348) → `setLibrary`). That gets slow on mobile and grows Firebase bandwidth for no reason.

**Fix:** move the local library (and drawings) to IndexedDB (a ~30-line wrapper, or `idb-keyval`). Use per-entry cloud writes (see H1).

### M3 — No guard for unsaved edits when the canvas is replaced

`loadFromJSON()` starts with `clearMap()` ([io.js:78](js/persistence/io.js#L78)). It is called from **Load JSON** ([io.js:171-175](js/persistence/io.js#L171-L175)), the tree designer upload ([prompts.js:312](js/learn/prompts.js#L312)), the catalog ([catalog.js:155](js/persistence/catalog.js#L155)) and **My Trees → Open** ([library.js:313](js/persistence/library.js#L313)). The tree autosave runs only on `pagehide` ([library.js:154-246](js/persistence/library.js#L154-L246)), and the codebase has no dirty check or `confirm()` for this case. Editing a linked tree, then opening another one, silently discards those edits.

**Fix:** before `clearMap()`, compare `treeContentKey(buildTreeJSON(true))` with the linked entry, the same comparison `autosaveTreeOnPageExit` already makes. Then autosave, or ask the user.

### M4 — Third-party code: no SRI, one floating version, no CSP

- [tools.js:74-76](js/learn/tools.js#L74-L76), [tools.js:272-275](js/learn/tools.js#L272-L275): KaTeX, Plotly, math.js and JSXGraph are injected by `loadScriptOnce` with no `integrity`/`crossOrigin`. **JSXGraph is pinned only to `@1`**, so any new 1.x release runs in users' pages untested.
- [cloud.js:63-80](js/persistence/cloud.js#L63-L80): the Firebase ES modules come from gstatic without integrity.
- There is no Content-Security-Policy. Lesson and tree files are shareable, untrusted input, so a CSP is cheap defense in depth around an already well-escaped renderer.

**Fix:** pin `jsxgraph@1.x.y`. Pass an SRI hash into `loadScriptOnce`/`loadStyleOnce` and set `crossOrigin = 'anonymous'`. Add a `<meta http-equiv="Content-Security-Policy">` that allows `'self'`, `cdn.jsdelivr.net`, `cdn.plot.ly`, `www.gstatic.com`, `*.firebaseio.com` and Google auth. The inline theme script ([index.html:14-29](index.html#L14-L29)) and the `onload="this.media='all'"` attributes ([index.html:37-42](index.html#L37-L42)) will need hashes or moving into `scale.js`.

### M5 — Firebase rules aren't in the repo

The README and the [cloud.js](js/persistence/cloud.js#L44-L54) header correctly say the database rules are the only thing protecting user data, but no `database.rules.json` exists to review, diff or test. Also note:

- `usernames/$key` with `.read: auth != null` lets any signed-in user enumerate usernames (low risk, but intentional?).
- The rules shown don't limit size or shape (e.g. `users/$uid/library` could hold arbitrary data).

**Fix:** commit `database.rules.json` plus `firebase.json`. Add `.validate` rules for shape and size. Add a rules test with the Firebase emulator.

### M6 — No CI on a branch that deploys directly

The workflow pushes straight to `origin/main`, which GitHub Pages serves, and the repo has no `.github/workflows`. The 150-test suite is good but only runs when someone remembers.

**Fix:** add a ~15-line GitHub Action (`actions/setup-node`, `npm ci`, `npm test`) on push and PR.

---

## Low severity / hygiene

- **L1 — `svEsc` escaping footgun.** [tools.js:21](js/learn/tools.js#L21) escapes `& < >` only, yet it's used inside attribute values ([explorer.js:257-268](js/collection/explorer.js#L257-L268), [explorer.js:320](js/collection/explorer.js#L320), [explorer.js:570](js/collection/explorer.js#L570), [tools.js:1048](js/learn/tools.js#L1048), [viewer.js:153](js/learn/viewer.js#L153), [viewer.js:257](js/learn/viewer.js#L257)). Each use is currently safe: the inputs are regex-restricted (`[a-z0-9_-]`) or app-owned. But a translation or catalog name containing `"` would break markup. It also throws on non-strings, e.g. a cloud entry missing `name` or a numeric `language` at [library.js:403-404](js/persistence/library.js#L403-L404). Replace it with a single `escapeHtml(String(s ?? ''))` that covers `&<>"'` (`uiHTML` already has one at [interface.js:58](js/i18n/interface.js#L58)).
- **L2 — Download URL revoked immediately.** [io.js:167-168](js/persistence/io.js#L167-L168) calls `URL.revokeObjectURL` synchronously after `a.click()`, which can abort large downloads in some browsers. Defer it with `setTimeout(..., 0–1000)`.
- **L3 — Docs drift.** [README.md:217](README.md#L217) lists a `scripts/` directory that doesn't exist. [TODO.md](TODO.md) §1 (tutorial out of date with the redesigned lesson, tree and explorer modals) is still open, and first-visit users see the stale tour.
- **L4 — Stale local branches.** `master` and `local-scratch-backup` still exist locally. TODO.md already says to delete the latter once confirmed.
- **L5 — CSS layering.** The z-index values are ad hoc (`1, 2, 20, 100, 150, 200, 250, 300, 400, 600, 1000, 999999`), and the CSS has 38 `!important`. Define a z-index scale in `theme.css` (`--z-modal`, `--z-toast`, `--z-tutorial`…).
- **L6 — Pan doesn't batch to frames.** The `pointermove`/`touchmove` handlers apply a transform per event ([viewport.js:134-139](js/graph/viewport.js#L134-L139), [viewport.js:184-201](js/graph/viewport.js#L184-L201)). It's cheap today, but coalescing into one `requestAnimationFrame` avoids extra work on high-rate pointers and large trees.
- **L7 — Global-script architecture.** There is ~567 KB of classic scripts sharing globals, with order-dependent loading and many `typeof fn === 'function'` guards. Several files are big: [tools.js](js/learn/tools.js) 1078 lines, [viewer.js](js/learn/viewer.js) 1010, [explorer.js](js/collection/explorer.js) 851. This is manageable now, but migrating file by file to native ES modules (no bundler needed) would make dependencies explicit and catch misspelled globals.
- **L8 — Prompt size.** [node-prompt.js](js/learn/node-prompt.js) is 49.7 KB and is copied into every single-lesson prompt. On free-tier chats that's a big share of the context window before the model writes anything. This is already on TODO.md. One option is a short core prompt, with the GRAPH/CALLOUT spec included only when the topic is likely to need it.

---

## What's done well

- **Rendering untrusted lesson text safely:** everything AI-provided goes through `svEsc` before `innerHTML`. Callout ids and `[REF]` targets are regex-whitelisted. Graph colors pass `safeColor` ([tools.js:394](js/learn/tools.js#L394)). KaTeX runs with its default `trust: false`.
- **math.js sandbox:** `import`, `evaluate`, `parse` and the rest are disabled per math.js's security guidance ([tools.js:312-324](js/learn/tools.js#L312-L324)).
- **Robust import:** the JSONL recovery tolerates fences, prose, truncated lines and out-of-order records ([generation.js:145-185](js/learn/generation.js#L145-L185)). Loops, self-links and unknown prerequisites are repaired and reported, not fatal ([io.js:101-123](js/persistence/io.js#L101-L123)).
- **Careful local persistence:** failed saves roll back the UI. A per-account exit outbox survives interrupted page-exit writes. Answers are stored by original option letter, so reshuffles can't corrupt scores.
- **Atomic username claim** via an RTDB transaction, with rollback of half-created accounts.
- **Performance:** KaTeX, JSXGraph, Plotly, math.js and Firebase all load lazily. Firebase is never contacted for signed-out guests. Non-critical CSS is deferred, with a `<noscript>` fallback.
- **Accessibility:** a shared focus trap with focus return ([a11y.js](js/core/a11y.js)), `role="dialog"` + `aria-modal` on all modals, an Escape-key priority stack, `prefers-reduced-motion`, a `:focus-visible` ring on nodes, an `aria-live` toast host, and keyboard-activatable file labels.
- **i18n design:** only marked UI strings are translated, user text is never rewritten, and pattern keys handle pluralized and interpolated messages.
- **Tests:** 150 jsdom tests that load the real `index.html` in script order. They cover the wiring, not just isolated functions.

---

## Suggested order of work

1. **Per-record cloud writes plus a "loaded" guard** (H1, H2, H3; mostly `library.js`, `progress.js`, `cloud.js`). Add tests that simulate a failed `getLibrary`/`getProgress` followed by a save.
2. **Commit and test the Firebase rules** (M5), and **add CI** (M6).
3. **An unsaved-changes guard** before `clearMap()` (M3).
4. **Pin JSXGraph, add SRI, add a CSP** (M4).
5. **A stable tree id plus label coercion** (M1), then **IndexedDB** for the local library (M2).
6. The tutorial refresh from TODO.md and the low-severity items as time allows.
