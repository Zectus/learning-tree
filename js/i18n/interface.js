/* Only explicitly marked interface strings are localized. User text is never
   searched or rewritten, even when it happens to match an interface label. */
const UI_LANGUAGE_KEY = 'tree-ui-language';
let uiLanguage = 'en';
try { if (localStorage.getItem(UI_LANGUAGE_KEY) === 'es') uiLanguage = 'es'; } catch {}
const uiPatterns = Object.entries(UI_ES).filter(([key]) => /\{\w+\}/.test(key)).map(([key, value]) => {
  const names = [];
  const pattern = key.split(/(\{\w+\})/).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '([\\s\\S]*?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return { regex: new RegExp('^' + pattern + '$'), names, value };
});
function t(source, values = {}) {
  const raw = String(source).replace(/\{(\w+)\}/g, (all, name) => Object.hasOwn(values, name) ? String(values[name]) : all);
  if (uiLanguage === 'en') return raw;
  if (Object.hasOwn(UI_ES, raw)) return UI_ES[raw];
  for (const { regex, names, value } of uiPatterns) {
    const match = raw.match(regex);
    if (!match) continue;
    return value.replace(/\{(\w+)\}/g, (_, name) => {
      const captured = match[names.indexOf(name) + 1];
      // These two fields contain other app-owned strings, never user text.
      if (name === 'details') return captured.split('; ').map(part => t(part)).join('; ');
      if (name === 'time') return t(captured);
      return captured;
    });
  }
  return raw;
}
function uiText(el, source) {
  el.dataset.uiText = source;
  el.textContent = t(source);
}
function userText(el, value) {
  delete el.dataset.uiText;
  el.textContent = value;
}
function uiAttr(el, attr, source) {
  const sources = JSON.parse(el.dataset.uiAttrs || '{}');
  sources[attr] = source;
  el.dataset.uiAttrs = JSON.stringify(sources);
  el.setAttribute(attr, t(source));
}
function uiHTML(source, values = {}) {
  const raw = source.replace(/\{(\w+)\}/g, (all, name) => Object.hasOwn(values, name) ? String(values[name]) : all);
  const escape = text => String(text).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  return `<span data-ui-text="${escape(raw)}">${escape(t(raw))}</span>`;
}
function refreshInterfaceLanguage() {
  document.documentElement.lang = uiLanguage;
  document.querySelectorAll('[data-ui-text]').forEach(el => { el.textContent = t(el.dataset.uiText); });
  document.querySelectorAll('[data-ui-attrs]').forEach(el => {
    for (const [attr, source] of Object.entries(JSON.parse(el.dataset.uiAttrs))) el.setAttribute(attr, t(source));
  });
  const button = document.getElementById('menu-language');
  button.textContent = uiLanguage === 'en' ? '🌐 Español' : '🌐 English';
  button.setAttribute('aria-label', t(uiLanguage === 'en' ? 'Switch interface to Spanish' : 'Switch interface to English'));
}
function setUILanguage(language, persist = true) {
  if (!['en', 'es'].includes(language)) return;
  uiLanguage = language;
  if (persist) { try { localStorage.setItem(UI_LANGUAGE_KEY, language); } catch {} }
  refreshInterfaceLanguage();
  document.dispatchEvent(new CustomEvent('ui-language-change'));
}
document.getElementById('menu-language').addEventListener('click', () => setUILanguage(uiLanguage === 'en' ? 'es' : 'en'));
refreshInterfaceLanguage();
