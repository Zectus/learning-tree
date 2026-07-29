/* ═══════════════════════════════════════════════════════════
   viewport.js — canvas viewport: applyTransform, the load-time
   center+fit logic (resetViewportForTreeLoad), mouse pan/wheel-
   zoom, and touch one-finger-pan/two-finger-pinch. Also owns the
   global Escape shortcut for canceling a link gesture and mark-
   known mode, and the app's one-time startup init.
   This used to live inside the old io.js god-file; split out on
   its own since "move the camera around" has nothing to do with
   JSON import/export, toolbar mode toggles, or prompt-building —
   the other things that file used to also be responsible for.
   Depends on state.js, layout.js (nodeW/nodeH/COL_W, used by
   fitToContent/fitMobileInitialView), and nodes.js (cancelLink).
═══════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════
   VIEWPORT
═══════════════════════════════════════════════════════════ */
function applyTransform(animated) {
  const {x,y,scale} = state.viewport;
  const t = `translate(${x}px,${y}px) scale(${scale})`;
  if (animated) {
    const ease = 'transform .38s cubic-bezier(.4,0,.2,1)';
    world.style.transition = svgWorld.style.transition = ease;
    requestAnimationFrame(() => {
      world.style.transform = svgWorld.style.transform = t;
    });
    setTimeout(() => { world.style.transition = svgWorld.style.transition = ''; }, 420);
  } else {
    world.style.transform = svgWorld.style.transform = t;
  }
}

// Centering the viewport and fitting it to loaded content are bundled
// behind ONE entry point and kept out of reach on purpose: this is a
// load-time operation, not a general "recenter the view" utility. The two
// pieces below are closures — nothing outside this IIFE can call them
// directly — so the only way to trigger a viewport reset anywhere in the
// app is through the single function this returns, which has exactly two
// callers: the tree-load path in loadFromJSON(), and the startup IIFE for
// the empty canvas. Nothing else (a toolbar button, a node click, a future
// feature) can reach in and yank a user's pan/zoom out from under them
// mid-session, because there's simply no name left to call.
const resetViewportForTreeLoad = (function () {
  function centerViewport() {
    state.viewport = { x: window.innerWidth/2, y: window.innerHeight/2, scale: 1 };
    applyTransform(true);
  }

  // Mobile: fitting the WHOLE tree into view (like fitToContent below
  // does for desktop) means the more columns a tree has, the smaller
  // everything gets — on a wide tree a phone screen would end up showing
  // illegibly tiny nodes just to fit every column's width at once.
  // Instead: horizontally center on the leftmost column (depth 0, i.e.
  // where you actually start), and pick ONE zoom level sized to whatever
  // the TALLEST column anywhere in the tree needs — not just the
  // leftmost one — so that panning right to reach a taller column later
  // never requires a re-zoom; the scale already has room for it.
  function fitMobileInitialView(margin) {
    const byDepth = new Map();
    state.nodes.forEach(d => {
      if (!byDepth.has(d.depth)) byDepth.set(d.depth, []);
      byDepth.get(d.depth).push(d);
    });

    let minDepth = Infinity, tallestH = 0;
    byDepth.forEach((colNodes, depth) => {
      let colMinY = Infinity, colMaxY = -Infinity;
      colNodes.forEach(d => {
        colMinY = Math.min(colMinY, d.y);
        colMaxY = Math.max(colMaxY, d.y + nodeH(d.depth));
      });
      tallestH = Math.max(tallestH, colMaxY - colMinY);
      if (depth < minDepth) minDepth = depth;
    });

    const leftCol = byDepth.get(minDepth);
    let leftMinY = Infinity, leftMaxY = -Infinity;
    leftCol.forEach(d => {
      leftMinY = Math.min(leftMinY, d.y);
      leftMaxY = Math.max(leftMaxY, d.y + nodeH(d.depth));
    });
    const leftColH = leftMaxY - leftMinY;
    const leftColX = minDepth * COL_W; // layout() places every node's x at depth*COL_W
    const leftColW = nodeW(minDepth);

    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min((vh - margin * 2) / tallestH, 1.0);

    state.viewport = {
      x: vw / 2 - (leftColX + leftColW / 2) * scale,
      y: (vh - leftColH * scale) / 2 - leftMinY * scale,
      scale
    };
    applyTransform(true);
  }

  function fitToContent(margin = window.innerWidth < 700 ? 28 : 60) {
    if (state.nodes.size === 0) return;
    if (window.innerWidth < 700) { fitMobileInitialView(margin); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(data => {
      const w = nodeW(data.depth);
      const h = nodeH(data.depth);
      minX = Math.min(minX, data.x);
      minY = Math.min(minY, data.y);
      maxX = Math.max(maxX, data.x + w);
      maxY = Math.max(maxY, data.y + h);
    });
    const treeW = maxX - minX;
    const treeH = maxY - minY;
    const vw    = window.innerWidth;
    const vh    = window.innerHeight;
    const scale = Math.min(
      (vw - margin * 2) / treeW,
      (vh - margin * 2) / treeH,
      1.0  // never zoom in beyond 100%
    );
    state.viewport = {
      x: (vw - treeW * scale) / 2 - minX * scale,
      y: (vh - treeH * scale) / 2 - minY * scale,
      scale
    };
    applyTransform(true);
  }

  return function resetViewportForTreeLoad() {
    centerViewport();
    fitToContent();
  };
})();

/* ── pan ──
   Pointer Events + setPointerCapture, not mousedown/mousemove/mouseup.
   Plain mouse events only keep arriving on `window` for as long as the
   browser's own hit-test still thinks the cursor is inside the viewport;
   near an edge, that boundary is rounded to actual rendered pixels, and
   at a browser zoom other than 100% that rounding no longer lines up with
   the CSS-pixel coordinates our code reads (clientX/clientY, innerWidth).
   The result is the mismatch you saw: the cursor icon (a separate,
   always-accurate hit-test) says one thing, event delivery says another.
   setPointerCapture pins all subsequent pointer events to #canvas
   directly, regardless of where the cursor drifts or how the page is
   zoomed, so there's no boundary check left to disagree with itself. */
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return; // touch has its own pan/pinch handling below
  if (e.target.closest('.node')) return;
  // Middle-click ("pressing the wheel") triggers the browser's native
  // autoscroll mode by default — a separate scroll behavior that runs on
  // top of our own drag-pan below. The two disagree about pixel math once
  // the page isn't at 100% browser zoom, so the view jitters/drifts.
  // preventDefault() here stops the native autoscroll from ever starting,
  // leaving our drag-pan as the only thing moving the canvas.
  if (e.button === 1) e.preventDefault();
  cancelLink();
  canvas.setPointerCapture(e.pointerId);
  state.drag = { active:true, startX:e.clientX, startY:e.clientY, ox:state.viewport.x, oy:state.viewport.y };
  canvas.classList.add('dragging');
});
canvas.addEventListener('pointermove', e => {
  if (!state.drag.active) return;
  state.viewport.x = state.drag.ox + (e.clientX - state.drag.startX);
  state.viewport.y = state.drag.oy + (e.clientY - state.drag.startY);
  applyTransform(false);
});
canvas.addEventListener('pointerup', e => {
  state.drag.active = false;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});
canvas.addEventListener('pointercancel', e => {
  state.drag.active = false;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
});

/* ── zoom ──
   Skip canvas zoom when the wheel event is over a scrollable text field
   inside the canvas (currently just the node explanation textarea) —
   otherwise scrolling that field's content is impossible to do with the
   wheel, since the canvas's own zoom handler grabs every wheel event
   over #canvas and preventDefault()s it before the field ever sees it.
   Letting the event fall through here (no preventDefault, no return
   early into zoom logic) hands it back to the browser's normal
   textarea-scroll behavior. */
canvas.addEventListener('wheel', e => {
  if (e.target.closest('.node-explanation-ta')) return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.07 : 1/1.07;
  const ns = Math.min(10, Math.max(0.01, state.viewport.scale*factor));
  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX-rect.left, my = e.clientY-rect.top;
  state.viewport.x = mx - (mx-state.viewport.x)*(ns/state.viewport.scale);
  state.viewport.y = my - (my-state.viewport.y)*(ns/state.viewport.scale);
  state.viewport.scale = ns;
  applyTransform(false);
}, { passive:false });

/* ── touch: one-finger pan, two-finger pinch-zoom ──
   Mirrors the mouse pan/wheel-zoom logic above. `touchState` holds
   whichever gesture is currently active; switching finger count
   mid-gesture (e.g. lifting one finger during a pinch) just restarts
   state for whatever's left, same as picking the gesture up fresh. */
let touchState = null;

function pinchDist(a, b) { return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
function pinchMid(a, b)  { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }

canvas.addEventListener('touchstart', e => {
  if (e.target.closest('.node')) { touchState = null; return; }
  cancelLink();
  if (e.touches.length === 1) {
    const t = e.touches[0];
    touchState = { mode:'pan', x:t.clientX, y:t.clientY, ox:state.viewport.x, oy:state.viewport.y };
  } else if (e.touches.length === 2) {
    const [a,b] = e.touches;
    const mid = pinchMid(a,b);
    touchState = { mode:'pinch', dist:pinchDist(a,b), midX:mid.x, midY:mid.y, scale:state.viewport.scale, vx:state.viewport.x, vy:state.viewport.y };
  }
}, { passive:true });

canvas.addEventListener('touchmove', e => {
  if (!touchState) return;
  if (touchState.mode === 'pan' && e.touches.length === 1) {
    const t = e.touches[0];
    state.viewport.x = touchState.ox + (t.clientX - touchState.x);
    state.viewport.y = touchState.oy + (t.clientY - touchState.y);
    applyTransform(false);
  } else if (touchState.mode === 'pinch' && e.touches.length === 2) {
    const [a,b] = e.touches;
    const dist   = pinchDist(a,b);
    const factor = dist / touchState.dist;
    const ns     = Math.min(10, Math.max(0.01, touchState.scale * factor));
    const rect   = canvas.getBoundingClientRect();
    const mx = touchState.midX - rect.left, my = touchState.midY - rect.top;
    state.viewport.x = mx - (mx - touchState.vx) * (ns / touchState.scale);
    state.viewport.y = my - (my - touchState.vy) * (ns / touchState.scale);
    state.viewport.scale = ns;
    applyTransform(false);
  }
}, { passive:true });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 1) {
    // Dropped from a pinch to one finger — keep going as a pan instead
    // of ending the gesture outright.
    const t = e.touches[0];
    touchState = { mode:'pan', x:t.clientX, y:t.clientY, ox:state.viewport.x, oy:state.viewport.y };
  } else if (e.touches.length === 0) {
    touchState = null;
  }
}, { passive:true });
canvas.addEventListener('touchcancel', () => { touchState = null; }, { passive:true });

/* ═══════════════════════════════════════════════════════════
   INIT
═══════════════════════════════════════════════════════════ */
(function init() {
  resetViewportForTreeLoad();
  // Load a JSON via the 📂 button to get started.
})();

