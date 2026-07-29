/* ═══════════════════════════════════════════════════════════
   autoscroll.js — page-wide middle-click autoscroll.
   Depends on nothing but the DOM; loads independently of
   state.js/nodes.js/etc. so it works identically everywhere
   in the app (session viewer, the "new tree" modal's scrolling
   body, a node's explanation textarea, any future scrollable
   region) without any of them needing to know it exists.

   This started out living inside viewer.js, scoped to just the
   session viewer window, because Chrome's native middle-click
   autoscroll behaved badly there. The same problem isn't
   specific to that one screen — any scrollable region on the
   page inherits the same native behavior — so this generalizes
   the fix to the whole document instead of re-solving it
   per-screen, and lives in its own file since it's no longer
   tied to the viewer's concerns.
═══════════════════════════════════════════════════════════ */

/* ── Middle-click autoscroll, matching Chrome's native behavior
   (verified against Chromium's actual source, autoscroll_controller.cc):
   - Press and release without moving (a tap): autoscroll goes "sticky" —
     it keeps running with no button held, following the cursor, until
     the next pointerdown of ANY button, anywhere, or Escape cancels it.
   - Press, drag, and release: scrolls while held, and stops the instant
     the button comes up.
   Speed is not linear — Chromium computes it per axis as
   distance^2.2 * 0.000008 (distance zeroed inside a 15px dead zone),
   which is why it ramps up far more aggressively than a straight-line
   drag the further the cursor gets from the anchor. The 2.2 exponent
   and 15px radius are exact; the 0.000008 coefficient feeds into
   Chromium's compositor-side fling system before becoming an actual
   scroll amount, which isn't visible from the page, so MCA_COEFF and
   the MCA_MAX_SPEED cap below are recalibrated to produce comparably
   aggressive results directly as px/frame rather than an exact port.

   The scrollable target is whichever element — found by walking up
   from whatever's under the cursor, all the way to the document root —
   actually has overflow to scroll in some direction. This is what makes
   it page-wide rather than tied to one container: it doesn't know or
   care whether that element is the session viewer's body, a modal's
   body, a textarea, or anything added later. */
const mca = { active:false, sticky:false, anchorX:0, anchorY:0, curX:0, curY:0, moved:false, raf:null, target:null, canX:false, canY:false, curDir:undefined };
const MCA_DEADZONE  = 15;      // px — exact value from Chromium (kNoMiddleClickAutoscrollRadius)
const MCA_EXPONENT  = 2.2;     // exact value from Chromium (kExponent)
const MCA_COEFF     = 0.0006;  // recalibrated (Chromium's 0.000008 isn't a direct px/frame value — see note above)
const MCA_MAX_SPEED = 220;     // px/frame cap so it stays controllable at extreme distances
const MCA_MOVE_TOL  = 6;       // px of movement that still counts as "didn't move" (a tap)

/* Walks up from `el` looking for the nearest ancestor that actually has
   overflow to scroll in some direction. No container is special-cased —
   this is what lets the feature work anywhere (the "new tree" modal's
   body, a node's explanation textarea, the session viewer, etc.) without
   ever needing to be told those elements exist. Falls back to the page
   itself in case a layout ever needs real page-level scrolling, though
   nothing in this app currently does (every scrollable region here is
   its own overflow:auto container, not the page). */
function findScrollTarget(el) {
  let node = el;
  while (node && node !== document.documentElement) {
    const cs   = getComputedStyle(node);
    const canY = /(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight;
    const canX = /(auto|scroll)/.test(cs.overflowX) && node.scrollWidth  > node.clientWidth;
    if (canY || canX) return { el: node, canX, canY };
    node = node.parentElement;
  }
  const de = document.documentElement;
  const canY = de.scrollHeight > de.clientHeight;
  const canX = de.scrollWidth  > de.clientWidth;
  if (canY || canX) return { el: (document.scrollingElement || de), canX, canY };
  return null;
}

/* ── Directional cursor, generated to match Chromium's 11-cursor set
   (NoMove2D/NoMoveHoriz/NoMoveVert at rest, 8 compass Pan* cursors while
   moving) — a center dot with arrow spokes for each scrollable axis, the
   active direction's arrow drawn bold, the rest faint. Cached per
   direction+capability combo and only swapped when it actually changes,
   since regenerating a data-URI every animation frame would be wasteful. */
const MCA_CURSOR_ANGLE = { E:0, SE:45, S:90, SW:135, W:180, NW:225, N:270, NE:315 };
const mcaCursorCache = new Map();
function buildPanCursorSVG(activeDir, canX, canY) {
  let dirs = [];
  if (canY) dirs.push('N', 'S');
  if (canX) dirs.push('E', 'W');
  if (canX && canY) dirs.push('NE', 'SE', 'SW', 'NW');
  let arrows = '';
  for (const d of dirs) {
    const active = d === activeDir;
    const tip = active ? 15 : 11;
    const halfW = active ? 6 : 4.5;
    const base = 4;
    const fill = active ? '#111' : '#ffffffdd';
    const stroke = active ? '#fff' : '#111';
    const sw = active ? 1.6 : 1.1;
    arrows += `<g transform="rotate(${MCA_CURSOR_ANGLE[d]})"><polygon points="${tip},0 ${base},-${halfW} ${base},${halfW}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/></g>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="-16 -16 32 32">${arrows}<circle r="3" fill="#111" stroke="#fff" stroke-width="1.4"/></svg>`;
}
function cursorFor(activeDir, canX, canY) {
  const key = `${activeDir}|${canX}|${canY}`;
  let url = mcaCursorCache.get(key);
  if (!url) {
    url = `url("data:image/svg+xml,${encodeURIComponent(buildPanCursorSVG(activeDir, canX, canY))}") 16 16, all-scroll`;
    mcaCursorCache.set(key, url);
  }
  return url;
}
// Same priority order Chromium uses: vertical (combined with horizontal
// for a diagonal) takes precedence over a pure horizontal direction.
function dirFor(dx, dy, canX, canY) {
  const north = dy < 0, south = dy > 0, east = dx > 0, west = dx < 0;
  if (north && canY) { if (canX) { if (east) return 'NE'; if (west) return 'NW'; } return 'N'; }
  if (south && canY) { if (canX) { if (east) return 'SE'; if (west) return 'SW'; } return 'S'; }
  if (east && canX) return 'E';
  if (west && canX) return 'W';
  return null; // at rest in the dead zone
}

function autoscrollStep() {
  if (!mca.active) return;
  let dx = mca.curX - mca.anchorX;
  let dy = mca.curY - mca.anchorY;
  if (Math.abs(dx) <= MCA_DEADZONE) dx = 0;
  if (Math.abs(dy) <= MCA_DEADZONE) dy = 0;
  if (mca.canX && dx !== 0) {
    const speed = Math.min(MCA_MAX_SPEED, Math.pow(Math.abs(dx), MCA_EXPONENT) * MCA_COEFF);
    mca.target.scrollLeft += Math.sign(dx) * speed;
  }
  if (mca.canY && dy !== 0) {
    const speed = Math.min(MCA_MAX_SPEED, Math.pow(Math.abs(dy), MCA_EXPONENT) * MCA_COEFF);
    mca.target.scrollTop += Math.sign(dy) * speed;
  }
  const dir = dirFor(dx, dy, mca.canX, mca.canY);
  if (dir !== mca.curDir) {
    mca.curDir = dir;
    mca.target.style.setProperty('cursor', cursorFor(dir, mca.canX, mca.canY));
  }
  mca.raf = requestAnimationFrame(autoscrollStep);
}

// Capture phase, and always live while active (hold OR sticky) — this is
// what makes a second click actually cancel instead of restarting: it
// runs and calls stopPropagation() before the event ever reaches the
// pointerdown listener below that would otherwise try to start a new
// session (or, on an element with its own middle-click handling, before
// that handler sees the click at all).
function autoscrollCancel(e) {
  if (!mca.active) return;
  e.preventDefault();
  e.stopPropagation();
  stopAutoscroll();
}
function autoscrollCancelOnEscape(e) { if (e.key === 'Escape') stopAutoscroll(); }

function startAutoscroll(target, x, y) {
  mca.active = true; mca.sticky = false; mca.moved = false; mca.curDir = undefined;
  mca.target = target.el; mca.canX = target.canX; mca.canY = target.canY;
  mca.anchorX = x; mca.anchorY = y; mca.curX = x; mca.curY = y;
  mca.target.classList.add('mca-active');
  mca.target.style.setProperty('cursor', cursorFor(null, mca.canX, mca.canY));
  document.addEventListener('pointerdown', autoscrollCancel, true);
  document.addEventListener('keydown', autoscrollCancelOnEscape);
  mca.raf = requestAnimationFrame(autoscrollStep);
}
function stopAutoscroll() {
  if (!mca.active) return;
  mca.active = false;
  if (mca.target) { mca.target.classList.remove('mca-active'); mca.target.style.removeProperty('cursor'); }
  if (mca.raf) cancelAnimationFrame(mca.raf);
  document.removeEventListener('pointerdown', autoscrollCancel, true);
  document.removeEventListener('keydown', autoscrollCancelOnEscape);
  mca.target = null;
}

// e.defaultPrevented lets any element that already does its own thing
// with the middle button (e.g. the canvas repurposing it for pan) opt
// itself out simply by calling preventDefault() first, same as it would
// need to for the browser's own native autoscroll — no special-casing
// of that element needed here. In practice this rarely even matters:
// findScrollTarget() only matches elements with real CSS overflow to
// scroll, which the canvas doesn't have (it pans via transform, not
// native scrolling), so a click there falls through to "no target"
// regardless.
document.addEventListener('pointerdown', e => {
  if (e.button !== 1 || mca.active || e.defaultPrevented) return;
  const target = findScrollTarget(e.target);
  if (!target) return;
  e.preventDefault();
  target.el.setPointerCapture?.(e.pointerId);
  startAutoscroll(target, e.clientX, e.clientY);
});
document.addEventListener('pointermove', e => {
  if (!mca.active) return;
  mca.curX = e.clientX; mca.curY = e.clientY;
  if (Math.hypot(e.clientX - mca.anchorX, e.clientY - mca.anchorY) > MCA_MOVE_TOL) mca.moved = true;
});
document.addEventListener('pointerup', e => {
  if (!mca.active) return;
  if (mca.target?.hasPointerCapture?.(e.pointerId)) mca.target.releasePointerCapture(e.pointerId);
  if (mca.moved) stopAutoscroll();
  else mca.sticky = true; // stays active — only the cancel handler above or Escape stops it from here
});
document.addEventListener('pointercancel', () => stopAutoscroll());
