/* ═══════════════════════════════════════════════════════════
   scale.js — a single desktop UI-scale factor, computed ONCE
   from the window's logical (CSS-pixel) width at load, that
   everything else in the app's chrome — toolbar, modals, session
   viewer, node cards — scales against via rem units (see the
   html{font-size} rule in theme.css) and, for the parts computed
   in JS rather than pure CSS (node/column pixel sizes in
   layout.js), via window.UI_SCALE directly.

   WHY: this app's chrome was designed and tuned by eye against one
   concrete setup — a 1920×1080 screen at 150% browser zoom, i.e. a
   *logical* viewport width of about 1280px (1920 ÷ 1.5, since
   browser zoom shrinks how many logical CSS pixels fit in a given
   physical width). Every px value in the CSS is otherwise a
   literal, fixed size — so on any other logical width (a bigger
   monitor at 100% zoom, a smaller laptop screen, a different zoom
   level) the exact same toolbar button or node card ends up
   occupying a different FRACTION of the visible window than it
   does at the reference setup. That's what "looks different
   depending on resolution" actually is: not a broken layout, just
   an inconsistent size relative to the screen.

   HOW: UI_SCALE = (logical window width) ÷ 1280, clamped to a sane
   range, computed once when the page loads and left alone after
   that — deliberately NOT recomputed on window resize. This is a
   "which screen/zoom are you actually using" setting, not a "keep
   the app pinned to some fraction of whatever size the window
   happens to be right now" one; resizing the browser window
   shouldn't fight back against the resize by rescaling everything
   out from under you mid-session. At exactly the reference width
   this factor is 1, so nothing about today's appearance changes
   there. Below the existing mobile breakpoint (700px — see
   mobile.css), it's forced to 1 on purpose: that breakpoint is a
   deliberate, separate, hand-tuned design for touch/small screens,
   and this general desktop-scaling factor should never multiply
   against it.

   The infinite pannable/zoomable tree canvas (#canvas, #world,
   #svg-world) is not part of this at all — it already just fills
   whatever space is available and shows more or less of the tree
   on a bigger or smaller screen (see resetViewportForTreeLoad in
   viewport.js), which is existing, intentional behavior. Only the
   fixed-size chrome around it is what this standardizes.

   Loads first — before layout.js, which reads window.UI_SCALE
   once to set its own pixel constants, and before any stylesheet
   even applies, so there's no flash of default-then-corrected
   sizing.
═══════════════════════════════════════════════════════════ */
const UI_REFERENCE_WIDTH  = 1280; // 1920 ÷ 1.5 — logical width of the 1920×1080 @150%-zoom reference setup
const UI_MOBILE_BREAKPOINT = 700; // matches mobile.css's own breakpoint exactly
const UI_SCALE_MIN = 0.65;
const UI_SCALE_MAX = 1.8;

function computeUIScale() {
  if (window.innerWidth <= UI_MOBILE_BREAKPOINT) return 1; // hand-tuned mobile.css rules take over unscaled, exactly as before
  const raw = window.innerWidth / UI_REFERENCE_WIDTH;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, raw));
}

// Set once, at load, and never touched again — no resize listener here on
// purpose (see the file header above).
window.UI_SCALE = computeUIScale();
document.documentElement.style.setProperty('--ui-scale', window.UI_SCALE);
