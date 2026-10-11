const { goToStep } = require('./tutorial-navigation');
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./harness');
const el = (app, id) => app.document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
function mobileApp() {
  const app = loadApp({innerWidth:390});
  app.ev(`loadFromJSON({nodes:[{id:'a',label:'Foundation'}, {id:'b',label:'Next',requires:['a']}, {id:'c',label:'Advanced',requires:['b']}]}); setMode('edit');`);
  return app;
}
async function dispose(app) { await tick(); app.window.close(); }

test('mobile topic edits update the real tree without editing inside the zoomed canvas', async () => {
  const app = mobileApp();
  try {
    app.ev('state.nodes.get(2).el.click()');
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),true);
    assert.equal(app.ev('state.nodes.get(2).el.querySelector(".node-text").contentEditable'),'false');
    el(app,'node-editor-name').value='Renamed topic';
    el(app,'node-editor-name').dispatchEvent(new app.window.Event('input'));
    el(app,'node-editor-scope').value='Private scope';
    el(app,'node-editor-scope').dispatchEvent(new app.window.Event('input'));
    el(app,'node-editor-optional').click();
    assert.equal(app.ev('state.nodes.get(2).label'),'Renamed topic');
    assert.equal(app.ev('state.nodes.get(2).explanation'),'Private scope');
    assert.equal(app.ev('state.nodes.get(2).optional'),true);
    assert.equal(app.ev('state.nodes.get(2).el.querySelector(".node-text").textContent'),'Renamed topic');
    app.ev("setUILanguage('es')");
    assert.equal(el(app,'node-editor-name').value,'Renamed topic');
    assert.equal(el(app,'node-editor-title').textContent,'Editar tema');
    el(app,'node-editor-done').click();
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),false);
    app.ev("setMode('browse')");
    assert.equal(app.ev('state.nodes.get(2).label'),'Renamed topic');
  } finally {await dispose(app);}
});

test('mobile prerequisites prevent cycles and keep both adjacency maps consistent when removed and added', async () => {
  const app = mobileApp();
  try {
    app.ev('openNodeEditor(2)');
    const checkbox = id => app.document.querySelector('#node-editor-links input[data-node-id="'+id+'"]');
    assert.equal(el(app,'node-editor-prerequisites').open,false);
    el(app,'node-editor-links-summary').click();
    assert.equal(el(app,'node-editor-prerequisites').open,true);
    assert.equal(checkbox(1).checked,true);
    assert.equal(checkbox(2),null);
    assert.equal(checkbox(3),null);
    assert.equal(app.document.querySelector('#node-editor-links input:disabled'),null);
    checkbox(1).click();
    assert.equal(app.ev('hasEdge(1,2)'),false);
    assert.equal(app.ev('prereqsOf(2).length'),0);
    assert.equal(app.ev('dependentsOf(1).length'),0);
    checkbox(1).click();
    assert.equal(app.ev('hasEdge(1,2)'),true);
    assert.equal(app.ev('prereqsOf(2)[0]'),1);
    assert.equal(app.ev('dependentsOf(1)[0]'),2);
    assert.equal(checkbox(3),null);
    assert.equal(el(app,'node-editor-links-summary').textContent,'Prerequisites (1 selected)');
    app.ev("setMode('browse')");
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),false);
  } finally {await dispose(app);}
});

test('adding a mobile topic opens its editor and changing trees closes the stale editor', async () => {
  const app = mobileApp();
  try {
    el(app,'btn-add-node').click();
    assert.equal(app.ev('mobileEditId'),4);
    assert.equal(el(app,'node-editor-name').value,'');
    assert.equal(app.ev('state.nodes.size'),4);
    el(app,'node-editor-delete').click();
    assert.equal(app.ev('state.nodes.size'),3);
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),false);
    app.ev('openNodeEditor(2); loadFromJSON({nodes:[{id:1,label:"New tree"}]})');
    assert.equal(app.ev('mobileEditId'),null);
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),false);
  } finally {await dispose(app);}
});

test('mobile tour restores an open editor, original fields, and live prerequisite controls', async () => {
  const app = mobileApp();
  try {
    app.ev('openNodeEditor(2)');
    el(app,'node-editor-prerequisites').open=true;
    const originalChoice = app.document.querySelector('#node-editor-links input[data-node-id="1"]');
    el(app,'menu-tutorial').click();
    await goToStep(app,13);
    app.ev('state.nodes.get(2).el.click()');
    el(app,'node-editor-name').value='Only the demo';
    el(app,'node-editor-name').dispatchEvent(new app.window.Event('input'));
    el(app,'tutorial-skip').click();
    assert.equal(app.ev('mobileEditId'),2);
    assert.equal(el(app,'node-editor-name').value,'Next');
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),true);
    assert.equal(el(app,'node-editor-prerequisites').open,true);
    assert.equal(app.document.querySelector('#node-editor-links input[data-node-id="1"]'),originalChoice);
    originalChoice.click();
    assert.equal(app.ev('hasEdge(1,2)'),false);
    assert.equal(app.ev('state.nodes.get(2).label'),'Next');
    assert.equal(app.document.body.style.getPropertyValue('--tutorial-height'),'');
  } finally {await dispose(app);}
});

test('dragging on a mobile topic pans the canvas without opening its editor', async () => {
  const app = mobileApp();
  try {
    const node = app.ev('state.nodes.get(2).el');
    const touch = (type, x, y) => {
      const event = new app.window.Event(type,{bubbles:true});
      event.touches = type === 'touchend' ? [] : [{clientX:x,clientY:y}];
      node.dispatchEvent(event);
    };
    const initial = app.ev('state.viewport.x');
    touch('touchstart',100,100); touch('touchmove',160,100); touch('touchend',160,100);
    node.click();
    assert.equal(app.ev('state.viewport.x'),initial+60);
    assert.equal(el(app,'node-editor-backdrop').classList.contains('open'),false);
  } finally {await dispose(app);}
});
