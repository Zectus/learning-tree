/* ═══════════════════════════════════════════════════════════
   escape.js — the one Escape-key listener. Every feature that reacts to
   Escape registers a handler with a priority; one press runs handlers
   highest-priority first and stops at the first that returns true ("I
   closed something"). That's what stops a single press from, say,
   closing a modal AND dropping out of mark-known mode.

   Priorities in use: 100 modals, 60 session viewer, 50 open dropdown,
   20 link in progress, 10 node action rows, 5 mark-known mode.
═══════════════════════════════════════════════════════════ */
const escapeHandlers = [];

function onEscape(priority, handler) {
  escapeHandlers.push({ priority, handler });
  escapeHandlers.sort((a, b) => b.priority - a.priority);
}

window.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  for (const { handler } of escapeHandlers) if (handler(e)) return;
});
