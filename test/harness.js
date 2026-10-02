// Loads the real index.html and the app's classic scripts, in index.html order,
// into a jsdom window. Top-level `const`/`let` in classic scripts live in the
// context's global lexical scope, so tests read them with app.ev('state').
const { JSDOM } = require('jsdom');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function loadApp({ innerWidth = 1280 } = {}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'http://localhost/' });
  const { window } = dom;
  window.innerWidth = innerWidth;

  // Stylesheets that decide visibility (so computed-style assertions are real).
  // (modals.css is where .hidden is defined; a partial checkout without it gets the same one-line rule.)
  for (const css of ['css/modals.css', 'css/account.css']) {
    const file = path.join(ROOT, css);
    const style = window.document.createElement('style');
    style.textContent = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '.hidden { display: none; }';
    window.document.head.appendChild(style);
  }

  // External libraries the page loads from CDNs aren't available offline.
  window.renderMathInElement = undefined;
  window.document.execCommand = () => false;

  const ctx = dom.getInternalVMContext();
  // math.js's browser bundle is the same file tools.js loads from the CDN. It runs inside the
  // page's own realm; importing Node's copy instead would trip math.js's cross-realm type checks.
  new vm.Script(fs.readFileSync(path.join(ROOT, 'node_modules/mathjs/lib/browser/math.js'), 'utf8'), { filename: 'mathjs' }).runInContext(ctx);
  // classic <script src="…"> tags, in order; the type="module" cloud.js tag has
  // a different shape and is skipped on purpose.
  const srcs = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
  for (const src of srcs) {
    const file = path.join(ROOT, src);
    // node-prompt.js is only used when a lesson prompt is built; stub it if absent from a partial checkout.
    const code = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : 'function renderNodePrompt() { return ""; }';
    new vm.Script(code, { filename: src }).runInContext(ctx);
  }

  const app = {
    dom, window, document: window.document, ctx,
    ev: code => vm.runInContext(code, ctx),
    toasts: () => [...window.document.querySelectorAll('#toast-host .toast')].map(t => t.textContent),
    press: (key, target = window) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })),
    fixture: name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'),
  };
  return app;
}

module.exports = { loadApp, ROOT };
