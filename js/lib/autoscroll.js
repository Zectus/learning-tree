/* ═══════════════════════════════════════════════════════════
   autoscroll.js — page-wide middle-click autoscroll. Depends on nothing
   but the DOM, so it works the same in the session viewer, modal bodies,
   textareas, and any scrollable region added later.

   Chrome's native middle-click autoscroll misbehaves in this app, so this
   reimplements it to match Chromium's autoscroll_controller.cc:
   - Press and release without moving (a tap): stays running with no button
     held, following the cursor, until the next pointerdown or Escape.
   - Press, drag, release: scrolls while held, stops when the button comes up.
   Speed per axis is distance^2.2 * coefficient, with a 15px dead zone. The
   2.2 exponent and 15px radius are Chromium's; the coefficient is
   recalibrated to px/frame because Chromium's value feeds a compositor-side
   fling system that isn't visible from the page.

   The scroll target is the nearest ancestor of the element under the cursor
   that actually has overflow to scroll — no container is special-cased.
═══════════════════════════════════════════════════════════ */
const mca = { active:false, anchorX:0, anchorY:0, curX:0, curY:0, moved:false, raf:null, last:0, remX:0, remY:0, target:null, canX:false, canY:false, curDir:undefined };
const MCA_DEADZONE  = 15;      // px — Chromium's kNoMiddleClickAutoscrollRadius
const MCA_EXPONENT  = 2.2;     // Chromium's kExponent
const MCA_COEFF     = 0.0006;  // recalibrated, see above
const MCA_MAX_SPEED = 220;     // px per 60Hz frame, cap so it stays controllable
const MCA_MOVE_TOL  = 6;       // px of movement that still counts as a tap
const MCA_FRAME_MS  = 1000 / 60;

/* Walks up from `el` to the nearest ancestor with real overflow in some
   direction; falls back to the page itself. */
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

/* ── Directional cursor, generated to match Chromium's 11-cursor set: a
   center dot with an arrow per scrollable axis, the active direction bold.
   Cached per direction+capability so a data URI isn't rebuilt every frame. */
const MCA_CURSOR_ANGLE = { E:0, SE:45, S:90, SW:135, W:180, NW:225, N:270, NE:315 };
const mcaCursorCache = new Map();
function buildPanCursorSVG(activeDir, canX, canY) {
  const dirs = [];
  if (canY) dirs.push('N', 'S');
  if (canX) dirs.push('E', 'W');
  if (canX && canY) dirs.push('NE', 'SE', 'SW', 'NW');
  let arrows = '';
  for (const d of dirs) {
    const active = d === activeDir;
    const tip = active ? 15 : 11, halfW = active ? 6 : 4.5, base = 4;
    const fill = active ? '#111' : '#ffffffdd', stroke = active ? '#fff' : '#111', sw = active ? 1.6 : 1.1;
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
// Chromium's priority: vertical (combined with horizontal for a diagonal) beats pure horizontal.
function dirFor(dx, dy, canX, canY) {
  const north = dy < 0, south = dy > 0, east = dx > 0, west = dx < 0;
  if (north && canY) { if (canX) { if (east) return 'NE'; if (west) return 'NW'; } return 'N'; }
  if (south && canY) { if (canX) { if (east) return 'SE'; if (west) return 'SW'; } return 'S'; }
  if (east && canX) return 'E';
  if (west && canX) return 'W';
  return null; // at rest in the dead zone
}

/* Scrolls one axis by this frame's share of the speed. Fractional pixels are
   carried in `rem` because browsers snap fractional scroll offsets, which
   would freeze slow scrolling near the dead zone. Returns the new remainder. */
function stepAxis(prop, distance, rem, frames) {
  const speed = Math.min(MCA_MAX_SPEED, Math.pow(Math.abs(distance), MCA_EXPONENT) * MCA_COEFF) * frames;
  rem += Math.sign(distance) * speed;
  const whole = Math.trunc(rem);
  if (whole === 0) return rem;
  const before = mca.target[prop];
  mca.target[prop] += whole;
  return mca.target[prop] === before ? 0 : rem - whole; // hit the end: drop the remainder
}

function autoscrollStep(now) {
  if (!mca.active) return;
  // Scale by elapsed time so a 144Hz display isn't 2.4× faster than 60Hz.
  const frames = Math.min(3, (now - mca.last) / MCA_FRAME_MS);
  mca.last = now;

  let dx = mca.curX - mca.anchorX;
  let dy = mca.curY - mca.anchorY;
  if (Math.abs(dx) <= MCA_DEADZONE) dx = 0;
  if (Math.abs(dy) <= MCA_DEADZONE) dy = 0;
  if (mca.canX && dx !== 0) mca.remX = stepAxis('scrollLeft', dx, mca.remX, frames);
  if (mca.canY && dy !== 0) mca.remY = stepAxis('scrollTop',  dy, mca.remY, frames);

  const dir = dirFor(dx, dy, mca.canX, mca.canY);
  if (dir !== mca.curDir) {
    mca.curDir = dir;
    mca.target.style.setProperty('cursor', cursorFor(dir, mca.canX, mca.canY));
  }
  mca.raf = requestAnimationFrame(autoscrollStep);
}

// Capture phase, live for the whole session (held or sticky): a second click
// cancels instead of restarting, because this runs and stops propagation
// before the pointerdown listener below could start a new session.
function autoscrollCancel(e) {
  if (!mca.active) return;
  e.preventDefault();
  e.stopPropagation();
  stopAutoscroll();
}
// Also capture + stopPropagation, so this Escape doesn't additionally close
// whatever modal the central handler (escape.js) would otherwise close.
function autoscrollCancelOnEscape(e) {
  if (e.key !== 'Escape') return;
  e.stopPropagation();
  stopAutoscroll();
}

function startAutoscroll(target, x, y) {
  mca.active = true; mca.moved = false; mca.curDir = undefined; mca.remX = mca.remY = 0;
  mca.target = target.el; mca.canX = target.canX; mca.canY = target.canY;
  mca.anchorX = x; mca.anchorY = y; mca.curX = x; mca.curY = y;
  mca.last = performance.now();
  mca.target.style.setProperty('cursor', cursorFor(null, mca.canX, mca.canY));
  document.addEventListener('pointerdown', autoscrollCancel, true);
  document.addEventListener('keydown', autoscrollCancelOnEscape, true);
  mca.raf = requestAnimationFrame(autoscrollStep);
}
function stopAutoscroll() {
  if (!mca.active) return;
  mca.active = false;
  if (mca.target) mca.target.style.removeProperty('cursor');
  if (mca.raf) cancelAnimationFrame(mca.raf);
  document.removeEventListener('pointerdown', autoscrollCancel, true);
  document.removeEventListener('keydown', autoscrollCancelOnEscape, true);
  mca.target = null;
}

// An element that repurposes the middle button (the canvas uses it to pan)
// opts out by calling preventDefault() first; e.defaultPrevented covers it.
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
  if (mca.moved) stopAutoscroll(); // a tap (no movement) leaves it running until the next click or Escape
});
document.addEventListener('pointercancel', () => stopAutoscroll());
