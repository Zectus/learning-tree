/* ═══════════════════════════════════════════════════════════
   toolbar.js — the toolbar itself: three grouped dropdowns
   (Mode ▾ / Tree ▾ / 👤 ▾ — see index.html) sharing one generic
   open/close mechanism, plus the standalone "+ node" button.
   This generalizes what used to be a single export-only dropdown
   (previously wired directly in io.js) into a mechanism every
   toolbar dropdown now shares — Mode and Account needed the exact
   same open/close/click-outside/Escape behavior, so it made sense
   to lift it out into one place rather than duplicate it three
   times.
   Also owns the Mode group's actual mode-switching logic. Edit,
   mark-known, and browse are mutually exclusive: setMarkKnownMode
   and applyEditMode each turn the other off when they turn
   themselves on (previously mark-known didn't turn edit mode off,
   which meant the two could technically both be "on" at once —
   harmless in practice since nodes.js's click handler checked
   editMode first, but not an honest reflection of what the UI
   now presents as one Mode picker, so it's fixed here as part of
   that reframing).
   Depends on state.js and nodes.js (cancelLink, doAddNode). The
   dark-mode toggle used to live here as its own toolbar button;
   it's now a plain .dropdown-item inside the Account group's
   menu, but the actual dark-mode logic hasn't moved.
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   GENERIC DROPDOWN MECHANISM
   Every toolbar dropdown is a ".dropdown-wrap" containing one
   ".tbtn" trigger followed by one ".dropdown-menu". Clicking a
   trigger toggles just that menu, closing any other open one;
   clicking anywhere outside, or Escape, closes whichever is open.
   Clicking any ".dropdown-item" inside closes its menu too — every
   item here performs one complete action (open a modal, flip a
   mode, trigger a download), not a setting you'd want the menu to
   stay open to keep adjusting.
═══════════════════════════════════════════════════════════ */
function closeAllDropdowns() {
  document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'));
}
document.querySelectorAll('.dropdown-wrap > .tbtn').forEach(trigger => {
  const menu = trigger.nextElementSibling;
  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = menu.classList.contains('open');
    closeAllDropdowns();
    if (!wasOpen) menu.classList.add('open');
  });
});
document.querySelectorAll('.dropdown-item').forEach(item => {
  item.addEventListener('click', closeAllDropdowns);
});
document.addEventListener('click', e => {
  if (!e.target.closest('.dropdown-wrap')) closeAllDropdowns();
});

/* ── keyboard ── */
window.addEventListener('keydown', e => {
  if (e.key === 'Escape') { cancelLink(); setMarkKnownMode(false); closeAllDropdowns(); }
});

/* ═══════════════════════════════════════════════════════════
   "+ node" — still a standalone button (only visible in edit
   mode; see #btn-add-node in toolbar.css), not folded into a
   dropdown, since it's the one action you'd want to hit
   repeatedly in a row while actually editing a tree.
═══════════════════════════════════════════════════════════ */
document.getElementById('btn-add-node').addEventListener('click', doAddNode);

/* ═══════════════════════════════════════════════════════════
   MODE GROUP — browse / edit / mark-known, mutually exclusive.
   The trigger button's own label always reflects whichever mode
   is active, so checking the current mode never requires opening
   the menu; the matching item inside the menu is also marked
   .current for the same reason once it IS open.
═══════════════════════════════════════════════════════════ */
function updateModeLabel() {
  const btn = document.getElementById('btn-mode');
  const currentId = state.editMode ? 'mode-edit-item' : state.markKnownMode ? 'mode-mark-known-item' : 'mode-browse-item';
  btn.textContent = state.editMode ? '✏️ Edit ▾' : state.markKnownMode ? '✓ Mark known ▾' : '👁 Browse ▾';
  btn.classList.toggle('active', state.editMode || state.markKnownMode);
  document.querySelectorAll('#mode-menu .dropdown-item').forEach(el => el.classList.toggle('current', el.id === currentId));
}

function setMarkKnownMode(on) {
  state.markKnownMode = on;
  if (on && state.editMode) { state.editMode = false; applyEditMode(); }
  document.body.classList.toggle('mark-known-mode', on);
  updateModeLabel();
}

function applyEditMode() {
  const on = state.editMode;
  document.body.classList.toggle('edit-mode', on);
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
  updateModeLabel();
}

document.getElementById('mode-browse-item').addEventListener('click', () => {
  if (state.editMode) { state.editMode = false; applyEditMode(); }
  if (state.markKnownMode) setMarkKnownMode(false);
});
document.getElementById('mode-edit-item').addEventListener('click', () => {
  state.editMode = !state.editMode;
  applyEditMode();
});
document.getElementById('mode-mark-known-item').addEventListener('click', () => {
  setMarkKnownMode(!state.markKnownMode);
});

updateModeLabel();

/* ── dark mode ── (moved into the Account ▾ menu; logic unchanged) */
const DARK_MODE_KEY = 'tree-dark-mode';
const menuDarkMode = document.getElementById('menu-dark-mode');
function setDarkMode(on) {
  document.body.classList.toggle('dark', on);
  menuDarkMode.textContent = on ? '☀️ Light mode' : '🌙 Dark mode';
  try { localStorage.setItem(DARK_MODE_KEY, on ? '1' : '0'); } catch {}
}
menuDarkMode.addEventListener('click', () => setDarkMode(!document.body.classList.contains('dark')));
try { setDarkMode(localStorage.getItem(DARK_MODE_KEY) === '1'); } catch { setDarkMode(false); }
