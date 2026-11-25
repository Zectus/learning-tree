# Remaining Work & Handoff Notes

## 1. Update the Interactive Tutorial
- Update `js/core/tutorial.js`, `js/i18n/es.js`, and `test/tutorial.test.js` to match the redesigned flows:
  - **Single-lesson modal:** hidden prompt (`View prompt` `<details>`), side-by-side **Paste from clipboard** and **Upload `.txt` file**, hidden manual paste (`Paste manually` `<details>`).
  - **Design a new tree modal:** same hidden-prompt + clipboard/upload `.json` + manual-paste layout. (Once updated, the compatibility `.upload-dropzone` class on `#tree-modal-backdrop`'s upload label can be cleaned up if no longer targeted.)
  - **Explore trees:** opens Mathematics directly; left branch rail + Branch Sub-Tree DAG + Local Neighborhood (solid same-branch, dashed cross-branch prerequisites & unlocks) + Full Path toggle + 10-level ascending difficulty bars.
  - **Notes draw mode:** `"Draw with a mouse, finger, or pen"` text was removed.

## 2. Optional / Future Polish
- Consider whether `js/learn/node-prompt.js` (~46.5 KB) can be tightened without degrading lesson or graph quality.
- Confirm whether local `master` and `local-scratch-backup` branches (both currently carry 5 unmerged commits) are still needed before deleting them (never push them).
- Deferred from `opus-5.5-review.md` (require live browser / schema migration testing):
  - Add a `<meta http-equiv="Content-Security-Policy">` after verifying Google Sign-In popup, Firebase RTDB WebSocket/long-poll, Plotly 3D, JSXGraph, and KaTeX in a live browser (CDN SRI + pinned JSXGraph are already in place).
  - Evaluate IndexedDB for the guest local library (weighing `pagehide` synchronous autosave reliability and cross-tab `storage` events).
  - Migrate progress identity from root-label signature + node labels to stable `treeId` UUIDs and node slugs with backward-compatible migration for existing Firebase/localStorage records and `catalog/index.json`.
  - Add Firebase RTDB emulator rules tests if Firebase CLI/emulator tooling is added to CI (rules are now versioned in `database.rules.json` and structurally verified by `test/audit-fixes.test.js`).

## Established UI & Design Conventions
- **Palette:** Neutral, theme-native styling in both light and dark modes (`--invert-bg`/`--invert-text` for primary actions; avoid loud solid blue button fills).
- **Responsive scaling:** `js/core/scale.js` scales `html { font-size }` via `UI_SCALE` (up to `1.8×` on wide monitors). Any JS-computed layout dimensions must use `rem` or multiply by `window.UI_SCALE`.
- **AI prompt delivery:** Keep single-lesson (`.txt`) and tree-design (`.json`) prompts instructing downloadable file-only delivery so raw output stays hidden in AI chats while supporting 1-click copy from the AI file viewer or file download/upload.
