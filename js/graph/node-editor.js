/* Mobile topic editor: fields and prerequisite choices stay readable at any
   canvas zoom. Edits use the same node objects and edge rules as desktop. */
let mobileEditId = null;
const nodeEditor = document.getElementById('node-editor-backdrop');
const editorName = document.getElementById('node-editor-name');
const editorScope = document.getElementById('node-editor-scope');
const editorOptional = document.getElementById('node-editor-optional');
const editorPrerequisites = document.getElementById('node-editor-prerequisites');

function renderNodeEditorLinks() {
  const node = state.nodes.get(mobileEditId);
  const list = document.getElementById('node-editor-links');
  list.replaceChildren();
  if (!node) return;
  const selected = prereqsOf(node.id).length;
  uiText(document.getElementById('node-editor-links-summary'), selected ? `Prerequisites (${selected} selected)` : 'Choose prerequisites');
  state.nodes.forEach(other => {
    if (other.id === node.id) return;
    const checked = hasEdge(other.id, node.id);
    // Existing links remain removable. New links must not introduce a cycle.
    if (!checked && wouldCycle(other.id, node.id)) return;
    const label = document.createElement('label');
    label.className = 'node-editor-choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.dataset.nodeId = other.id;
    input.checked = checked;
    const name = document.createElement('span');
    userText(name, other.label || t('Untitled topic'));
    input.addEventListener('change', () => {
      if (input.checked && wouldCycle(other.id, node.id)) { input.checked = false; return; }
      if (input.checked) addEdge(other.id, node.id); else removeEdge(other.id, node.id);
      layout(); updateAllStatuses(); renderNodeEditorLinks();
      list.querySelector('input[data-node-id="' + other.id + '"]')?.focus({preventScroll:true});
    });
    label.append(input, name); list.appendChild(label);
  });
  if (!list.children.length) {
    const empty = document.createElement('p');
    empty.className = 'node-editor-help';
    uiText(empty, 'No topics can be linked here yet.');
    list.appendChild(empty);
  }
}

function openNodeEditor(id) {
  const node = state.nodes.get(id);
  if (!node || state.mode !== 'edit' || !isMobileViewport()) return;
  cancelLink(); closeAllDropdowns();
  mobileEditId = id;
  editorName.value = node.label;
  editorScope.value = node.explanation || '';
  editorOptional.checked = !!node.optional;
  editorPrerequisites.open = false;
  document.getElementById('node-editor-delete-lesson').disabled = !node._sessionTxt;
  renderNodeEditorLinks();
  document.getElementById('node-editor-shell').setAttribute('aria-modal', String(!state.tutorialActive));
  nodeEditor.classList.add('open');
  document.getElementById('node-editor-shell').scrollTop = 0;
  nodeEditor.querySelector('.modal-body').scrollTop = 0;
}
function closeNodeEditor() {
  nodeEditor.classList.remove('open');
  editorPrerequisites.open = false;
  mobileEditId = null;
  if (nodeEditor.contains(document.activeElement)) document.activeElement.blur();
}
editorName.addEventListener('input', () => {
  const node = state.nodes.get(mobileEditId);
  if (!node) return;
  node.label = editorName.value;
  userText(node.el.querySelector('.node-text'), node.label);
  updateAllStatuses();
});
editorName.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); closeNodeEditor(); }
});
editorScope.addEventListener('input', () => {
  const node = state.nodes.get(mobileEditId);
  if (!node) return;
  node.explanation = editorScope.value;
  node.el.querySelector('.node-explanation-ta').value = node.explanation;
});
editorOptional.addEventListener('change', () => {
  const node = state.nodes.get(mobileEditId);
  if (!node) return;
  node.optional = editorOptional.checked;
  uiText(node.el.querySelectorAll('.node-actions .btn')[1], node.optional ? '★ Optional' : '☆ Optional');
  refreshTag(node.el, node); updateTreeIcon();
});
document.getElementById('node-editor-done').addEventListener('click', closeNodeEditor);
nodeEditor.addEventListener('click', e => { if (e.target === nodeEditor) closeNodeEditor(); });
document.getElementById('node-editor-delete-lesson').addEventListener('click', () => {
  deleteNodeTxt(mobileEditId);
  document.getElementById('node-editor-delete-lesson').disabled = true;
});
document.getElementById('node-editor-delete').addEventListener('click', () => {
  const id = mobileEditId;
  closeNodeEditor(); deleteNode(id);
});
onEscape(100, () => {
  if (!nodeEditor.classList.contains('open')) return false;
  closeNodeEditor(); return true;
});
window.addEventListener('resize', () => {
  state.nodes.forEach(node => {
    if (node.el) node.el.querySelector('.node-text').contentEditable = state.mode === 'edit' && !isMobileViewport() ? 'true' : 'false';
  });
  if (!isMobileViewport()) closeNodeEditor();
});
// iOS often resizes only the visual viewport when its keyboard opens. Keep
// the editor and tutorial navigation above the keyboard in that case too.
function syncMobileVisualViewport() {
  const viewport = window.visualViewport;
  const height = viewport?.height || window.innerHeight;
  const inset = viewport ? Math.max(0, window.innerHeight - height - viewport.offsetTop) : 0;
  document.documentElement.style.setProperty('--mobile-viewport-height', height + 'px');
  document.documentElement.style.setProperty('--mobile-keyboard-inset', inset + 'px');
}
window.addEventListener('resize', syncMobileVisualViewport);
window.visualViewport?.addEventListener('resize', syncMobileVisualViewport);
window.visualViewport?.addEventListener('scroll', syncMobileVisualViewport);
syncMobileVisualViewport();
document.addEventListener('ui-language-change', () => {
  if (nodeEditor.classList.contains('open')) renderNodeEditorLinks();
});
