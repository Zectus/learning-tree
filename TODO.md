# Remaining Work & Handoff Notes

## 1. Viewer: Definition / Theorem / Callout Block Tool
- **Motivation:** Formal definitions, numbered axiom lists, theorems, and remarks (e.g., norm axioms) currently render as plain paragraphs that blend into body prose.
- **Scope:**
  - Add a structured block tag (e.g. `[CALLOUT]` or `[DEF]`/`[THEOREM]`/`[PROOF]` — confirm exact syntax with the user before implementing) rendered as a clean, minimal textbook card in `js/learn/viewer.js` / `js/learn/tools.js` and `css/viewer.css`.
  - Support clean numbered/bulleted lists inside callouts (and/or lesson prose) if needed.
  - Update `js/learn/generation-format.js` (`validateLessonStructure`) and `js/learn/node-prompt.js` to document and validate the new tag.
  - Add unit tests in `test/`.

## 2. Update the Interactive Tutorial
- Update `js/core/tutorial.js`, `js/i18n/es.js`, and `test/tutorial.test.js` to match the redesigned flows:
  - **Single-lesson modal:** hidden prompt (`View prompt` `<details>`), side-by-side **Paste from clipboard** and **Upload `.txt` file**, hidden manual paste (`Paste manually` `<details>`).
  - **Design a new tree modal:** same hidden-prompt + clipboard/upload `.json` + manual-paste layout. (Once updated, the compatibility `.upload-dropzone` class on `#tree-modal-backdrop`'s upload label can be cleaned up if no longer targeted.)
  - **Explore trees:** opens Mathematics directly; left branch rail + Branch Sub-Tree DAG + Local Neighborhood (solid same-branch, dashed cross-branch prerequisites & unlocks) + Full Path toggle + 10-level ascending difficulty bars.
  - **Notes draw mode:** `"Draw with a mouse, finger, or pen"` text was removed.

## 3. Optional / Future Polish
- Consider whether `js/learn/node-prompt.js` (~46.5 KB) can be tightened without degrading lesson or graph quality.
- Delete the local `local-scratch-backup` branch once confirmed unneeded (never push it).

## Established UI & Design Conventions
- **Palette:** Neutral, theme-native styling in both light and dark modes (`--invert-bg`/`--invert-text` for primary actions; avoid loud solid blue button fills).
- **Responsive scaling:** `js/core/scale.js` scales `html { font-size }` via `UI_SCALE` (up to `1.8×` on wide monitors). Any JS-computed layout dimensions must use `rem` or multiply by `window.UI_SCALE`.
- **AI prompt delivery:** Keep single-lesson (`.txt`) and tree-design (`.json`) prompts instructing downloadable file-only delivery so raw output stays hidden in AI chats while supporting 1-click copy from the AI file viewer or file download/upload.
