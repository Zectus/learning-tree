/* ═══════════════════════════════════════════════════════════
   toast.js — showToast(message): a small non-blocking message for things
   the person needs to know (a file that couldn't be loaded, a save that
   failed) instead of failing silently.
═══════════════════════════════════════════════════════════ */
function showToast(message, duration = 7000) {
  let host = document.getElementById('toast-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const existing = [...host.children].find(toast => toast.textContent === message);
  if (existing) {
    clearTimeout(existing.dismissTimer);
    existing.dismissTimer = setTimeout(() => existing.remove(), duration);
    return;
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toast.title = 'Click to dismiss';
  toast.addEventListener('click', () => toast.remove());
  host.appendChild(toast);
  toast.dismissTimer = setTimeout(() => toast.remove(), duration);
}
