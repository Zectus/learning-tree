/* ═══════════════════════════════════════════════════════════
   viewport.js — canvas viewport: applyTransform, the load-time
   center+fit (resetViewportForTreeLoad), mouse pan / wheel zoom, and
   touch one-finger pan / two-finger pinch. Also the startup init.
   Depends on state.js, layout.js (nodeW/nodeH/COL_W), scale.js
   (isMobileViewport), and nodes.js (cancelLink).
═══════════════════════════════════════════════════════════ */

let currentTransform = '', transformTimer = null;
function applyTransform(animated) {
  const { x, y, scale } = state.viewport;
  currentTransform = `translate(${x}px,${y}px) scale(${scale})`;
  clearTimeout(transformTimer);
  if (animated) {
    world.style.transition = svgWorld.style.transition = 'transform .38s cubic-bezier(.4,0,.2,1)';
    // Apply whatever is current when the frame fires, so a non-animated update
    // issued in between isn't overwritten by a stale target.
    requestAnimationFrame(() => { world.style.transform = svgWorld.style.transform = currentTransform; });
    transformTimer = setTimeout(() => { world.style.transition = svgWorld.style.transition = ''; }, 420);
  } else {
    world.style.transition = svgWorld.style.transition = ''; // cancel any easing still in flight
    world.style.transform = svgWorld.style.transform = currentTransform;
  }
}

/* Zoom to `newScale` keeping the point (mx,my) fixed on screen. `base` is the
   viewport the zoom is measured from (the current one for the wheel; the one
   captured at gesture start for a pinch). */
function zoomAbout(mx, my, base, newScale) {
  const ns = Math.min(10, Math.max(0.01, newScale));
  state.viewport.x = mx - (mx - base.x) * (ns / base.scale);
  state.viewport.y = my - (my - base.y) * (ns / base.scale);
  state.viewport.scale = ns;
  applyTransform(false);
}

/* Centering and fitting are one load-time operation behind a single entry
   point on purpose: the pieces below are closures, so nothing else in the app
   (a toolbar button, a node click) can yank the user's pan/zoom mid-session.
   The only callers are loadFromJSON() and the startup init at the bottom. */
const resetViewportForTreeLoad = (function () {
  function centerViewport() {
    state.viewport = { x: window.innerWidth / 2, y: window.innerHeight / 2, scale: 1 };
    applyTransform(true);
  }

  // Mobile: fitting the whole tree shrinks nodes to illegibility on wide trees.
  // Instead centre on the leftmost column (where you start) and pick one zoom
  // sized for the TALLEST column anywhere, so panning right never needs a re-zoom.
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
        colMaxY = Math.max(colMaxY, d.y + nodeH());
      });
      tallestH = Math.max(tallestH, colMaxY - colMinY);
      if (depth < minDepth) minDepth = depth;
    });

    let leftMinY = Infinity, leftMaxY = -Infinity;
    byDepth.get(minDepth).forEach(d => {
      leftMinY = Math.min(leftMinY, d.y);
      leftMaxY = Math.max(leftMaxY, d.y + nodeH());
    });
    const leftColX = minDepth * COL_W; // layout() puts every node's x at depth*COL_W

    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min((vh - margin * 2) / tallestH, 1.0);
    state.viewport = {
      x: vw / 2 - (leftColX + nodeW() / 2) * scale,
      y: (vh - (leftMaxY - leftMinY) * scale) / 2 - leftMinY * scale,
      scale
    };
    applyTransform(true);
  }

  function fitToContent(margin = isMobileViewport() ? 28 : 60) {
    if (state.nodes.size === 0) return;
    if (isMobileViewport()) { fitMobileInitialView(margin); return; }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    state.nodes.forEach(data => {
      minX = Math.min(minX, data.x);
      minY = Math.min(minY, data.y);
      maxX = Math.max(maxX, data.x + nodeW());
      maxY = Math.max(maxY, data.y + nodeH());
    });
    const treeW = maxX - minX, treeH = maxY - minY;
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min((vw - margin * 2) / treeW, (vh - margin * 2) / treeH, 1.0); // never zoom past 100%
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
   Pointer Events + setPointerCapture rather than mouse events: plain mouse
   events stop arriving near a window edge when the browser zoom isn't 100%
   (its pixel hit-test and our CSS-pixel math disagree). Capture pins every
   later event to #canvas regardless of where the cursor drifts. */
function endPan(e) {
  state.drag.active = false;
  canvas.classList.remove('dragging');
  if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
}
canvas.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') return; // touch has its own pan/pinch handling below
  if (e.button === 2) return;            // right button is for the context menu, not panning
  if (e.target.closest('.node')) return;
  // Middle button would start the browser's native autoscroll on top of our
  // drag-pan; the two disagree once browser zoom isn't 100%, so block it.
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
canvas.addEventListener('pointerup', endPan);
canvas.addEventListener('pointercancel', endPan);

/* ── zoom ──
   Wheel events over the node explanation textarea are left alone so the
   field can scroll its own content. Zoom is proportional to the wheel delta
   (a 100-unit mouse notch = 7%, the old fixed step), so a trackpad's stream
   of small deltas zooms smoothly instead of 7% per event. */
const WHEEL_ZOOM_RATE = Math.log(1.07) / 100;
canvas.addEventListener('wheel', e => {
  if (e.target.closest('.node-explanation-ta')) return;
  e.preventDefault();
  const unit  = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1; // lines / pages → pixels
  const delta = Math.max(-200, Math.min(200, e.deltaY * unit));
  const rect  = canvas.getBoundingClientRect();
  zoomAbout(e.clientX - rect.left, e.clientY - rect.top, { ...state.viewport }, state.viewport.scale * Math.exp(-delta * WHEEL_ZOOM_RATE));
}, { passive:false });

/* ── touch: one-finger pan, two-finger pinch-zoom ──
   touchState holds the active gesture; changing finger count mid-gesture
   just restarts state for whatever's left. */
let touchState = null;

function pinchDist(a, b) { return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY); }
function pinchMid(a, b)  { return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }; }
function startTouchPan(t) {
  touchState = { mode:'pan', x:t.clientX, y:t.clientY, ox:state.viewport.x, oy:state.viewport.y };
}

canvas.addEventListener('touchstart', e => {
  if (e.target.closest('.node')) { touchState = null; return; }
  cancelLink();
  if (e.touches.length === 1) {
    startTouchPan(e.touches[0]);
  } else if (e.touches.length === 2) {
    const [a, b] = e.touches;
    const mid = pinchMid(a, b);
    touchState = { mode:'pinch', dist:pinchDist(a, b), midX:mid.x, midY:mid.y, scale:state.viewport.scale, vx:state.viewport.x, vy:state.viewport.y };
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
    const [a, b] = e.touches;
    const rect = canvas.getBoundingClientRect();
    zoomAbout(
      touchState.midX - rect.left, touchState.midY - rect.top,
      { x: touchState.vx, y: touchState.vy, scale: touchState.scale },
      touchState.scale * (pinchDist(a, b) / touchState.dist)
    );
  }
}, { passive:true });

canvas.addEventListener('touchend', e => {
  if (e.touches.length === 1) startTouchPan(e.touches[0]); // dropped from a pinch: keep going as a pan
  else if (e.touches.length === 0) touchState = null;
}, { passive:true });
canvas.addEventListener('touchcancel', () => { touchState = null; }, { passive:true });

/* ═══════════════════════════════════════════════════════════
   INIT — centre the empty canvas. Load a JSON via the Tree menu to start.
═══════════════════════════════════════════════════════════ */
resetViewportForTreeLoad();
