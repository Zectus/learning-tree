/* ═══════════════════════════════════════════════════════════
   scale.js — one desktop UI-scale factor, computed once at load
   from the window's logical width. Exposed as --ui-scale (drives
   html{font-size} in theme.css, so every rem in the chrome scales)
   and window.UI_SCALE (used by layout.js for node pixel sizes).

   The chrome was tuned by eye at 1920×1080 with 150% browser zoom,
   i.e. a logical width of 1280px; that width maps to a scale of 1.
   It is computed once, not on resize, on purpose: resizing the
   window shouldn't rescale the UI out from under someone mid-session.
   At or below the mobile breakpoint the scale is forced to 1 so it
   never multiplies mobile.css's hand-tuned rules. The pannable canvas
   is unaffected — it just shows more or less of the tree.

   Loads first, before any stylesheet applies and before layout.js
   reads UI_SCALE, so there is no flash of unscaled sizing.
═══════════════════════════════════════════════════════════ */
const UI_REFERENCE_WIDTH   = 1280;
const UI_MOBILE_BREAKPOINT = 700; // inclusive — mobile.css uses max-width: 700px
const UI_SCALE_MIN = 0.65;
const UI_SCALE_MAX = 1.8;

// The single definition of "mobile layout" for JS, so it can't drift from mobile.css.
function isMobileViewport() { return window.innerWidth <= UI_MOBILE_BREAKPOINT; }

function computeUIScale() {
  if (isMobileViewport()) return 1;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, window.innerWidth / UI_REFERENCE_WIDTH));
}

window.UI_SCALE = computeUIScale();
document.documentElement.style.setProperty('--ui-scale', window.UI_SCALE);
