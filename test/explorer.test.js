const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./harness');
const el = (app,id) => app.document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve,0));
const integration = 'math_integration_techniques';

test('the complete math hierarchy has unique IDs, bounded scopes, and navigable regions', () => {
  const app=loadApp();
  try {
    assert.equal(app.ev('MATH_COLLECTION.count'),140);
    assert.equal(app.ev('[...mathItems.values()].filter(n=>!n.children).every(n=>!!n.scope && !!MATH_STAGES[n.stage])'),true);
    assert.equal(app.ev('mathItems.size'),app.ev('(function count(n){return 1+(n.children||[]).reduce((s,c)=>s+count(c),0)})(MATH_COLLECTION)'));
    app.ev('openMathAtlas()');
    el(app,'explorer-detail').querySelector('[data-math-id="math_calculus_and_analysis"]').click();
    assert.equal(el(app,'explorer-detail-title').textContent,'Calculus and Analysis');
    assert.ok(el(app,'explorer-map').querySelector('[data-math-id="math_calculus"]'));
    el(app,'explorer-outline-tab').click();
    assert.equal(el(app,'explorer-map-wrap').hidden,true);
    el(app,'explorer-outline').querySelector('[data-math-id="math_calculus"]').click();
    assert.equal(el(app,'explorer-detail-title').textContent,'Calculus');
    assert.match(el(app,'explorer-breadcrumbs').textContent,/Mathematics.*Calculus and Analysis.*Calculus/);
  } finally {app.dom.window.close();}
});

test('search uses scope and hierarchy, supports keyboard selection, and respects stage filters', () => {
  const app=loadApp();
  try {
    app.ev('openMathAtlas()');
    el(app,'explorer-search').value='partial fractions';
    el(app,'explorer-search').dispatchEvent(new app.window.Event('input'));
    assert.equal(el(app,'explorer-results').querySelectorAll('button').length,1);
    app.press('Enter',el(app,'explorer-search'));
    assert.equal(el(app,'explorer-detail-title').textContent,'Integration Techniques');
    assert.match(el(app,'explorer-detail').textContent,/substitution/i);
    assert.match(app.window.location.hash,/math_integration_techniques/);
    el(app,'explorer-search').value='integration';
    el(app,'explorer-stage').value='graduate';
    el(app,'explorer-stage').dispatchEvent(new app.window.Event('change'));
    assert.equal(el(app,'explorer-results').querySelector(`[data-math-id="${integration}"]`),null);
    assert.ok(el(app,'explorer-results').querySelector('[data-math-id="math_lebesgue_integration"]'));
  } finally {app.dom.window.close();}
});

test('adding a scope persists once, leaves the active tree intact, and reopens as a scoped builder', async () => {
  const app=loadApp();
  try {
    app.ev('loadFromJSON({topic:"Existing",nodes:[{id:"a",label:"Keep me"}]})');
    const before=app.ev('JSON.stringify(buildTreeJSON(true))');
    const id=await app.ev(`addMathTreeToLibrary('${integration}')`);
    assert.ok(id);
    assert.equal(await app.ev(`addMathTreeToLibrary('${integration}')`),id);
    assert.equal(app.ev('Object.keys(libraryCache).length'),1);
    assert.equal(app.ev('JSON.stringify(buildTreeJSON(true))'),before);
    const stored=JSON.parse(app.window.localStorage.getItem('tree-library'));
    assert.equal(stored[id].data.collectionId,integration);
    assert.deepEqual(stored[id].data.nodes,[]);
    await app.ev('refreshLibraryFromSource()');
    app.window.__id=id;
    app.ev('openLibraryEntry(__id)');
    assert.equal(el(app,'tree-topic-input').value,'Integration Techniques');
    assert.match(el(app,'tree-prompt-box').value,/MATHEMATICS COLLECTION SCOPE/);
    assert.match(el(app,'tree-prompt-box').value,/partial fractions/);
    assert.match(el(app,'tree-prompt-box').value,/Do not ask calibration questions or wait for learner answers/);
    assert.match(el(app,'tree-prompt-box').value,/state them explicitly in the relevant root teaching briefs/);
    assert.doesNotMatch(el(app,'tree-prompt-box').value,/CALIBRATE THE STARTING|Ask concrete checkpoint|Begin with calibration|Keep the calibration/);
    assert.match(el(app,'tree-prompt-box').value,/"collectionId": "math_integration_techniques"/);
    assert.equal(app.ev('JSON.stringify(buildTreeJSON(true))'),before);
    app.ev('closeTreeModal(); openTreeModal()');
    assert.doesNotMatch(el(app,'tree-prompt-box').value,/MATHEMATICS COLLECTION SCOPE/);
    assert.match(app.ev("buildTreePrompt('Optics', 'English')"),/CALIBRATE THE STARTING KNOWLEDGE/);
    assert.match(app.ev('buildTreePromptFromFile()'),/CALIBRATE THE PERSON/);
  } finally {app.dom.window.close();}
});

test('a generated structure replaces its scope draft and preserves collection identity on export and reopening', async () => {
  const app=loadApp();
  try {
    const id=await app.ev(`addMathTreeToLibrary('${integration}')`);
    app.window.__id=id;
    app.ev(`openLibraryEntry(__id); loadFromJSON({topic:'Integration Techniques',nodes:[{id:'a',label:'An imported topic'}]}); closeTreeModal()`);
    await tick();
    assert.equal(app.ev('state.libraryId'),id);
    assert.equal(app.ev('state.collectionId'),integration);
    assert.equal(app.ev('buildTreeJSON(true).collectionId'),integration);
    assert.equal(app.ev('libraryCache[__id].data.nodes.length'),1);
    app.ev('clearMap(); openLibraryEntry(__id)');
    assert.equal(app.ev('state.collectionId'),integration);
    assert.equal(app.ev('state.nodes.size'),1);
    app.ev('openMathAtlas({target:state.collectionId})');
    assert.equal(el(app,'explorer-tree-action').textContent,'Open tree');
    el(app,'explorer-tree-action').click();
    assert.equal(app.ev('state.libraryId'),id);
    assert.equal(el(app,'explorer-backdrop').classList.contains('open'),false);
  } finally {app.dom.window.close();}
});

test('unrelated imports never inherit a selected collection draft', async () => {
  const app=loadApp();
  try {
    const id=await app.ev(`addMathTreeToLibrary('${integration}')`);
    app.window.__id=id;
    app.ev(`openLibraryEntry(__id); loadFromJSON({topic:'Other',nodes:[{id:'a',label:'Other'}]}); closeTreeModal()`);
    assert.equal(app.ev('state.collectionId'),null);
    assert.equal(app.ev('state.libraryId'),null);
    assert.equal(app.ev('libraryCache[__id].data.nodes.length'),0);
    assert.equal(app.ev('loadFromJSON({nodes:[]})'),false);
  } finally {app.dom.window.close();}
});

test('failed persistence rolls back a scope and does not claim it was added', async () => {
  const app=loadApp();
  try {
    app.ev('writeLocalLibrary=()=>false');
    assert.equal(await app.ev(`addMathTreeToLibrary('${integration}')`),null);
    assert.equal(app.ev('Object.keys(libraryCache).length'),0);
    assert.equal(app.ev('mathAtlas.busy'),false);
    assert.equal(app.toasts().some(message=>message.includes('Added')),false);
  } finally {app.dom.window.close();}
});

test('collection drafts use account storage and cannot leak into another source during a save', async () => {
  const app=loadApp();
  try {
    app.ev(`state.accountUser={uid:'first'}; librarySource='cloud'; libraryReady=true;
      window.cloud={setLibrary:async(uid,data)=>{window.savedUid=uid;window.savedCollection=Object.values(data)[0].data.collectionId}}`);
    await app.ev(`addMathTreeToLibrary('${integration}')`);
    assert.equal(app.window.savedUid,'first');
    assert.equal(app.window.savedCollection,integration);
    assert.equal(app.window.localStorage.getItem('tree-library'),null);
    app.ev(`libraryCache={}; window.cloud.setLibrary=()=>new Promise(resolve=>window.finishMathSave=resolve)`);
    const pending=app.ev(`addMathTreeToLibrary('${integration}')`);
    await tick();
    app.ev(`state.accountUser=null; librarySource='local'; libraryCache={}; window.finishMathSave()`);
    assert.equal(await pending,null);
    assert.equal(app.ev('Object.keys(libraryCache).length'),0);
  } finally {app.dom.window.close();}
});

test('the tutorial restores the active collection identity', () => {
  const app=loadApp();
  try {
    app.ev(`loadFromJSON({topic:'Integration Techniques',collectionId:'${integration}',nodes:[{id:'a',label:'Existing'}]})`);
    el(app,'menu-tutorial').click();
    el(app,'tutorial-skip').click();
    assert.equal(app.ev('state.collectionId'),integration);
    assert.equal(app.ev('buildTreeJSON(true).collectionId'),integration);
  } finally {app.dom.window.close();}
});

test('returning to My Trees and reopening preserves atlas selection and camera', async () => {
  const app=loadApp();
  try {
    await app.ev('openLibraryModal()');
    el(app,'btn-explore-trees').click();
    app.ev(`focusMathItem('${integration}'); zoomMathCamera(1.5)`);
    const camera=app.ev('JSON.stringify(mathAtlas.camera)');
    app.press('Escape');
    await tick();
    assert.ok(el(app,'library-modal-backdrop').classList.contains('open'));
    assert.equal(app.window.location.hash,'');
    el(app,'btn-explore-trees').click();
    assert.equal(app.ev('mathAtlas.selectedId'),integration);
    assert.equal(app.ev('JSON.stringify(mathAtlas.camera)'),camera);
  } finally {app.dom.window.close();}
});

test('collection chrome switches language without changing collection scope content', () => {
  const app=loadApp();
  try {
    app.ev(`openMathAtlas({target:'${integration}'}); setUILanguage('es',false)`);
    assert.equal(el(app,'explorer-title').textContent,'Explorar árboles');
    assert.equal(el(app,'explorer-tree-action').textContent,'Añadir a mis árboles');
    assert.match(el(app,'explorer-detail').textContent,/Universidad/);
    assert.equal(el(app,'explorer-detail-title').textContent,'Integration Techniques');
    assert.match(el(app,'explorer-detail').textContent,/partial fractions/);
  } finally {app.dom.window.close();}
});


test('My Trees exposes a header action leading through collections before the mathematics map', async () => {
  const app=loadApp();
  try {
    await app.ev('openLibraryModal()');
    assert.ok(el(app,'btn-explore-trees').closest('.modal-header-bar'));
    assert.equal(app.document.querySelector('.library-collection'),null);
    el(app,'btn-explore-trees').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,false);
    assert.ok(el(app,'explorer-shell').classList.contains('explorer-picking'));
    el(app,'explorer-open-math').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,true);
    assert.equal(el(app,'explorer-shell').classList.contains('explorer-picking'),false);
    el(app,'explorer-collections').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,false);
    app.press('Escape');
    await tick();
    assert.ok(el(app,'library-modal-backdrop').classList.contains('open'));
  } finally {app.dom.window.close();}
});
