// Viewport orientation changes when the keyboard resizes the page; physical
// screen orientation does not. Keep the portrait guard tied to the device.
function updateScreenOrientation() {
  const type = window.screen.orientation?.type;
  let landscape;
  if (type) {
    landscape = type.startsWith('landscape');
  } else if (typeof window.orientation === 'number') {
    // Older iOS Safari exposes the device rotation angle instead.
    landscape = Math.abs(window.orientation) === 90;
  } else {
    landscape = window.screen.width > window.screen.height;
  }
  document.documentElement.toggleAttribute('data-screen-landscape', landscape);
}

updateScreenOrientation();
window.screen.orientation?.addEventListener('change', updateScreenOrientation);
window.addEventListener('orientationchange', updateScreenOrientation);
window.addEventListener('resize', updateScreenOrientation);
