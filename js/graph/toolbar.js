/* ═══════════════════════════════════════════════════════════
   toolbar.js — the toolbar's own buttons and the interaction
   modes they drive: add-node, dark mode, mark-known mode, edit
   mode. Also owns the global Escape shortcut that backs out of
   whatever transient mode/gesture is active (a link in progress,
   mark-known mode) — grouped here rather than in viewport.js
   since it's really "cancel the current mode," not camera
   movement, even though the key it listens for is a keyboard
   event like viewport.js's own shortcuts.
   Depends on state.js and nodes.js (cancelLink, doAddNode).
═══════════════════════════════════════════════════════════ */

/* ── keyboard ── */
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cancelLink(); setMarkKnownMode(false); }
});

/* ═══════════════════════════════════════════════════════════
   TOOLBAR
═══════════════════════════════════════════════════════════ */
document.getElementById('btn-add-node').addEventListener('click', doAddNode);

/* ── dark mode ── */
const DARK_MODE_KEY = 'tree-dark-mode';
const btnDarkMode = document.getElementById('btn-dark-mode');
function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  btnDarkMode.classList.toggle('active', on);
  btnDarkMode.textContent = on ? '☀️ light' : '🌙 dark';
  try { localStorage.setItem(DARK_MODE_KEY, on ? '1' : '0'); } catch {}
}
btnDarkMode.addEventListener('click', () => setDarkMode(!document.body.classList.contains('dark')));
try { setDarkMode(localStorage.getItem(DARK_MODE_KEY) === '1'); } catch { setDarkMode(false); }

const btnMarkKnown = document.getElementById('btn-autocomplete');
function setMarkKnownMode(on) {
  state.markKnownMode = on;
  document.body.classList.toggle('mark-known-mode', on);
  btnMarkKnown.classList.toggle('active', on);
  btnMarkKnown.textContent = on ? '✓ marking known…' : '✓ mark known';
}
btnMarkKnown.addEventListener('click', () => setMarkKnownMode(!state.markKnownMode));

const btnEditMode = document.getElementById('btn-edit-mode');
function applyEditMode() {
  const on = state.editMode;
  document.body.classList.toggle('edit-mode', on);
  btnEditMode.classList.toggle('active', on);
  btnEditMode.textContent = on ? '✏️ editing' : '✏️ edit';
  state.nodes.forEach(node => {
    const t = node.el?.querySelector('.node-text');
    if (t) t.contentEditable = on ? 'true' : 'false';
    const expl = node.el?.querySelector('.node-explanation-ta');
    if (expl) expl.readOnly = !on;
  });
  if (!on) {
    cancelLink();
    document.activeElement?.blur?.();
    document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
  }
  if (on) setMarkKnownMode(false);
}
btnEditMode.addEventListener('click', () => { state.editMode=!state.editMode; applyEditMode(); });
