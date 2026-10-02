/* ═══════════════════════════════════════════════════════════
   toolbar.js — the toolbar's three grouped dropdowns (Mode ▾ / Tree ▾ /
   👤 ▾, see index.html) sharing one open/close mechanism, the standalone
   "+ node" button, the Mode group's switching logic, and dark mode.
   Depends on state.js, escape.js, and nodes.js (cancelLink, doAddNode).
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   GENERIC DROPDOWN MECHANISM
   Every dropdown is a ".dropdown-wrap" holding one ".tbtn" trigger followed
   by one ".dropdown-menu". Clicking a trigger toggles just that menu; a click
   elsewhere, or Escape, closes whichever is open; picking an item closes it
   (every item is one complete action, not a setting to keep adjusting).
═══════════════════════════════════════════════════════════ */
function setMenuOpen(menu, open) {
  menu.classList.toggle('open', open);
  menu.previousElementSibling?.setAttribute('aria-expanded', String(open));
}
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => setMenuOpen(m, false));
}
document.querySelectorAll('.dropdown-wrap > .tbtn').forEach(trigger => {
  const menu = trigger.nextElementSibling;
  trigger.setAttribute('aria-haspopup', 'menu');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) setMenuOpen(menu, true);
  });
});
document.querySelectorAll('.dropdown-item').forEach(item => item.addEventListener('click', closeAllDropdowns));
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) closeAllDropdowns();
});

onEscape(50, () => {
  const open = document.querySelector('.dropdown-menu.open');
  if (!open) return false;
  setMenuOpen(open, false);
  open.previousElementSibling?.focus();
  return true;
});
onEscape(20, () => {
  if (state.linkSource === null) return false;
  cancelLink();
  return true;
});
onEscape(5, () => {
  if (state.mode !== 'markKnown') return false;
  setMode('browse');
  return true;
});

/* "+ node" stays a standalone button (visible only in edit mode) — it's the
   one action you'd hit repeatedly in a row while editing. */
document.getElementById('btn-add-node').addEventListener('click', doAddNode);

/* ═══════════════════════════════════════════════════════════
   MODE — browse / edit / mark-known. One value, so they can't overlap.
   The trigger's label always shows the active mode, and the matching menu
   item is marked .current.
═══════════════════════════════════════════════════════════ */
const MODE_UI = {
  browse:    { label: '👁 Browse ▾',      item: 'mode-browse-item' },
  edit:      { label: '✏️ Edit ▾',        item: 'mode-edit-item' },
  markKnown: { label: '✓ Mark known ▾',  item: 'mode-mark-known-item' },
};

function updateModeLabel() {
  const ui  = MODE_UI[state.mode];
  const btn = document.getElementById('btn-mode');
  btn.textContent = ui.label;
  btn.classList.toggle('active', state.mode !== 'browse');
  document.querySelectorAll('#mode-menu .dropdown-item').forEach(el => el.classList.toggle('current', el.id === ui.item));
}

function setMode(mode) {
  const wasEditing = state.mode === 'edit';
  state.mode = mode;
  const editing = mode === 'edit';
  document.body.classList.toggle('edit-mode', editing);
  document.body.classList.toggle('mark-known-mode', mode === 'markKnown');
  state.nodes.forEach(node => {
    const t = node.el?.querySelector('.node-text');
    if (t) t.contentEditable = editing ? 'true' : 'false';
    const expl = node.el?.querySelector('.node-explanation-ta');
    if (expl) expl.readOnly = !editing;
  });
  if (wasEditing && !editing) {
    cancelLink();
    document.activeElement?.blur?.();
    document.querySelectorAll('.node.actions-open').forEach(el => el.classList.remove('actions-open'));
  }
  updateModeLabel();
  updateAllStatuses(); // node roles/labels differ between edit and non-edit modes
}

document.getElementById('mode-browse-item').addEventListener('click', () => setMode('browse'));
document.getElementById('mode-edit-item').addEventListener('click', () => setMode(state.mode === 'edit' ? 'browse' : 'edit'));
document.getElementById('mode-mark-known-item').addEventListener('click', () => setMode(state.mode === 'markKnown' ? 'browse' : 'markKnown'));

updateModeLabel();

/* ── dark mode ──
   The initial class is set by an inline script in <head> (before first paint,
   so there's no light flash), falling back to the OS preference when nothing
   is stored. This only handles toggling and persisting. */
const DARK_MODE_KEY = 'tree-dark-mode';
const menuDarkMode = document.getElementById('menu-dark-mode');
function setDarkMode(on, persist = true) {
  document.documentElement.classList.toggle('dark', on);
  menuDarkMode.textContent = on ? '☀️ Light mode' : '🌙 Dark mode';
  if (persist) { try { localStorage.setItem(DARK_MODE_KEY, on ? '1' : '0'); } catch {} }
}
menuDarkMode.addEventListener('click', () => setDarkMode(!document.documentElement.classList.contains('dark')));
setDarkMode(document.documentElement.classList.contains('dark'), false);
