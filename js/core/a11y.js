/* ═══════════════════════════════════════════════════════════
   a11y.js — keyboard/focus behavior shared by every modal, so the
   individual open/close functions don't each reimplement it. When a
   modal (.modal-backdrop.open or #session-viewer.sv-open) opens, focus
   moves into it and Tab stays inside; when it closes, focus returns to
   whatever opened it. Also makes the file-picking <label>s reachable and
   activatable from the keyboard.
   Loads last, after every modal's markup and script exists.
═══════════════════════════════════════════════════════════ */
(function () {
  const FOCUSABLE = 'button:not([disabled]), input:not([disabled]):not([type="file"]):not([type="hidden"]), textarea, a[href], [tabindex]:not([tabindex="-1"])';
  const backdrops = [...document.querySelectorAll('.modal-backdrop')];
  const viewerEl  = document.getElementById('session-viewer');
  const isOpen    = el => el.classList.contains('open') || el.classList.contains('sv-open');
  const visible   = el => el.getClientRects().length > 0;
  const returnFocus = new Map();

  // Backdrops sit above the session viewer (z-index 400 vs 300), so they win.
  const topModal = () => backdrops.find(isOpen) || (isOpen(viewerEl) ? viewerEl : null);

  const observer = new MutationObserver(records => {
    for (const { target: el } of records) {
      if (isOpen(el) && !returnFocus.has(el)) {
        returnFocus.set(el, document.activeElement);
        if (!el.contains(document.activeElement)) {
          const shell = el.querySelector('[role="dialog"]');
          if (shell) { shell.tabIndex = -1; shell.focus(); }
        }
      } else if (!isOpen(el) && returnFocus.has(el)) {
        const prev = returnFocus.get(el);
        returnFocus.delete(el);
        if (prev && prev.isConnected && typeof prev.focus === 'function') prev.focus();
      }
    }
  });
  [...backdrops, viewerEl].forEach(el => observer.observe(el, { attributes: true, attributeFilter: ['class'] }));

  document.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const top = topModal();
    if (!top) return;
    const items = [...top.querySelectorAll(FOCUSABLE)].filter(visible);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1], active = document.activeElement;
    if (e.shiftKey && (active === first || !top.contains(active) || active.getAttribute('role') === 'dialog')) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && (active === last || !top.contains(active))) {
      e.preventDefault(); first.focus();
    }
  });

  document.querySelectorAll('label.upload-dropzone, label.dropdown-item').forEach(label => {
    label.tabIndex = 0;
    label.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); label.click(); }
    });
  });
})();
