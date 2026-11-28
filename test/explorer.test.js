const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./harness');
const el = (app,id) => app.document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve,0));
const integration = 'math_integration_techniques';

test('the complete math hierarchy has unique IDs, bounded scopes, monotonic 1-10 difficulty, and navigable branch sub-trees', () => {
  const app=loadApp();
  try {
    assert.equal(app.ev('MATH_COLLECTION.count'),143);
    assert.equal(app.ev('[...mathItems.values()].filter(n=>!n.children).every(n=>!!n.scope && !!MATH_STAGES[n.stage] && n.difficulty>=1 && n.difficulty<=10)'),true);
    assert.equal(app.ev('MATH_COLLECTION.leaves.every(l=>l.recommendedPreparation.every(p=>mathItems.get(p).difficulty<=l.difficulty))'),true);
    assert.equal(app.ev('mathItems.size'),app.ev('(function count(n){return 1+(n.children||[]).reduce((s,c)=>s+count(c),0)})(MATH_COLLECTION)'));
    app.ev('openMathAtlas()');
    assert.equal(el(app,'explorer-rail').querySelectorAll('.explorer-branch-btn').length,10);
    el(app,'explorer-rail').querySelector('[data-math-id="math_calculus_and_analysis"]').click();
    assert.equal(el(app,'explorer-detail-title').textContent,'Calculus and Analysis');
    assert.equal(el(app,'explorer-nodes').querySelectorAll('.explorer-node').length,28);
    assert.equal(el(app,'explorer-nodes').querySelector(`[data-math-id="${integration}"]`).querySelectorAll('.explorer-bars i.on').length,5);
    assert.ok(el(app,'explorer-edges').querySelectorAll('.explorer-edge').length > 20);
    el(app,'explorer-nodes').querySelector(`[data-math-id="${integration}"]`).click();
    assert.equal(el(app,'explorer-detail-title').textContent,'Integration Techniques');
    assert.equal(app.ev('mathAtlas.mode'),'neighbors');
    el(app,'explorer-back-branch').click();
    assert.equal(app.ev('mathAtlas.selectedId'),null);
    assert.equal(el(app,'explorer-detail-title').textContent,'Calculus and Analysis');
  } finally {app.dom.window.close();}
});

test('local neighborhood shows solid same-branch and dashed cross-branch prerequisites and unlocks, plus full path', () => {
  const app=loadApp();
  try {
    app.ev("openMathAtlas({target:'math_complex_numbers'})");
    assert.equal(app.ev('mathAtlas.mode'),'neighbors');
    assert.ok(el(app,'explorer-nodes').querySelector('.explorer-node-selected[data-math-id="math_complex_numbers"]'));
    // Trigonometric Functions is a cross-branch prep (Geometry and Topology -> Algebra and Functions), so it must be dashed
    const extPrep=el(app,'explorer-nodes').querySelector('.explorer-preparation [data-math-id="math_trigonometric_functions"]');
    assert.ok(extPrep);
    assert.ok(extPrep.classList.contains('explorer-node-external'));
    assert.ok(el(app,'explorer-edges').querySelector('.explorer-edge-external[data-from="math_trigonometric_functions"][data-to="math_complex_numbers"]'));
    // Determinants and Eigenstructure is a same-branch unlock (Algebra and Functions), so it must be solid
    const sameUnlock=el(app,'explorer-nodes').querySelector('.explorer-unlocks [data-math-id="math_determinants_and_eigenstructure"]');
    assert.ok(sameUnlock);
    assert.equal(sameUnlock.classList.contains('explorer-node-external'),false);
    // Complex Differentiation is a cross-branch unlock (Calculus and Analysis), so it must be dashed
    const extUnlock=el(app,'explorer-nodes').querySelector('.explorer-unlocks [data-math-id="math_complex_differentiation"]');
    assert.ok(extUnlock);
    assert.ok(extUnlock.classList.contains('explorer-node-external'));
    // Toggle Full path to inspect transitive ancestors with cross-branch ancestors dashed
    el(app,'explorer-mode-path').click();
    assert.equal(app.ev('mathAtlas.mode'),'path');
    assert.ok(el(app,'explorer-nodes').querySelectorAll('.explorer-node').length > 5);
    assert.ok(el(app,'explorer-nodes').querySelector('.explorer-node-external[data-math-id="math_trigonometric_functions"]'));
    // Clicking a cross-branch node walks there and updates the active branch in the rail
    el(app,'explorer-mode-neighbors').click();
    el(app,'explorer-nodes').querySelector('[data-math-id="math_trigonometric_functions"]').click();
    assert.equal(app.ev('mathAtlas.selectedId'),'math_trigonometric_functions');
    assert.equal(app.ev('mathAtlas.branchId'),'math_geometry_and_topology');
    assert.equal(el(app,'explorer-rail').querySelector('[data-math-id="math_geometry_and_topology"]').getAttribute('aria-current'),'true');
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
    assert.match(el(app,'tree-prompt-box').value,/state them explicitly in the relevant root teaching briefs/);
    assert.doesNotMatch(el(app,'tree-prompt-box').value,/calibrat|wait for learner answers/i);
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

test('clicking Build tree on an unsaved scope saves it and opens the tree designer in one click', async () => {
  const app=loadApp();
  try {
    app.ev(`openMathAtlas({target:'${integration}'})`);
    assert.equal(el(app,'explorer-tree-action').textContent,'Build tree');
    assert.equal(el(app,'explorer-tree-save').textContent,'Add to my trees');
    el(app,'explorer-tree-action').click();
    await tick();
    assert.equal(el(app,'explorer-backdrop').classList.contains('open'),false);
    assert.equal(el(app,'tree-topic-input').value,'Integration Techniques');
    assert.equal(app.ev('Object.keys(libraryCache).length'),1);
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

test('returning to My Trees and reopening preserves atlas selection and mode', async () => {
  const app=loadApp();
  try {
    await app.ev('openLibraryModal()');
    el(app,'btn-explore-trees').click();
    app.ev(`focusMathItem('${integration}')`);
    el(app,'explorer-mode-path').click();
    app.press('Escape');
    await tick();
    assert.ok(el(app,'library-modal-backdrop').classList.contains('open'));
    assert.equal(app.window.location.hash,'');
    el(app,'btn-explore-trees').click();
    assert.equal(app.ev('mathAtlas.selectedId'),integration);
    assert.equal(app.ev('mathAtlas.mode'),'path');
  } finally {app.dom.window.close();}
});

test('collection chrome switches language without changing collection scope content', () => {
  const app=loadApp();
  try {
    app.ev(`openMathAtlas({target:'${integration}'}); setUILanguage('es',false)`);
    assert.equal(el(app,'explorer-title').textContent,'Explorar árboles');
    assert.equal(el(app,'explorer-tree-action').textContent,'Crear el árbol');
    assert.equal(el(app,'explorer-tree-save').textContent,'Añadir a mis árboles');
    assert.match(el(app,'explorer-detail').textContent,/5\/10 · Base universitaria/);
    assert.equal(el(app,'explorer-detail-title').textContent,'Integration Techniques');
    assert.match(el(app,'explorer-detail').textContent,/partial fractions/);
  } finally {app.dom.window.close();}
});

test('My Trees opens Mathematics directly by default, with Collections still reachable from the header', async () => {
  const app=loadApp();
  try {
    await app.ev('openLibraryModal()');
    assert.ok(el(app,'btn-explore-trees').closest('.modal-header-bar'));
    assert.equal(app.document.querySelector('.library-collection'),null);
    el(app,'btn-explore-trees').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,true);
    assert.equal(el(app,'explorer-shell').classList.contains('explorer-picking'),false);
    el(app,'explorer-collections').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,false);
    assert.ok(el(app,'explorer-shell').classList.contains('explorer-picking'));
    el(app,'explorer-open-math').click();
    assert.equal(el(app,'explorer-collection-picker').hidden,true);
    el(app,'explorer-collections').click();
    app.press('Escape');
    await tick();
    assert.ok(el(app,'library-modal-backdrop').classList.contains('open'));
  } finally {app.dom.window.close();}
});

test('all collection scopes have explicit preparation links to valid trees without cycles', () => {
  const app=loadApp();
  try {
    const trees=JSON.parse(app.ev('JSON.stringify([...mathItems.values()].filter(n=>!n.children).map(n=>({id:n.id,links:n.recommendedPreparation})))'));
    const index=new Map(trees.map(tree=>[tree.id,tree]));
    const visited=new Set(),path=new Set();
    function visit(tree) {
      assert.equal(path.has(tree.id),false,'Preparation cycle at '+tree.id);
      if (visited.has(tree.id)) return;
      assert.ok(Array.isArray(tree.links));
      assert.equal(new Set(tree.links).size,tree.links.length);
      path.add(tree.id);
      for (const id of tree.links) {
        assert.notEqual(id,tree.id);
        assert.ok(index.has(id),'Unknown preparation tree '+id);
        visit(index.get(id));
      }
      path.delete(tree.id); visited.add(tree.id);
    }
    trees.forEach(visit);
    assert.deepEqual(index.get('math_counting_and_quantity').links,[]);
    assert.deepEqual(index.get('math_shapes_and_spatial_relationships').links,[]);
  } finally {app.dom.window.close();}
});

test('preparation links navigate across subjects and stages without requiring completion', async () => {
  const app=loadApp();
  try {
    app.ev("loadFromJSON({topic:'Current',nodes:[{id:'a',label:'Keep this'}]}); mathAtlas.stage='graduate'; openMathAtlas({target:'math_banach_spaces_and_bounded_operators'})");
    const before=app.ev('JSON.stringify(buildTreeJSON(true))');
    assert.match(el(app,'explorer-detail').textContent,/Suggestions, not requirements/);
    el(app,'explorer-nodes').querySelector('.explorer-preparation [data-math-id="math_metric_spaces"]').click();
    assert.equal(el(app,'explorer-detail-title').textContent,'Metric Spaces');
    assert.equal(app.ev('mathAtlas.stage'),'');
    assert.equal(el(app,'explorer-stage').value,'');
    assert.equal(el(app,'explorer-tree-action').disabled,false);
    const id=await app.ev("addMathTreeToLibrary('math_metric_spaces')");
    assert.ok(id);
    assert.equal(app.ev('Object.keys(libraryCache).length'),1);
    assert.equal(app.ev('JSON.stringify(buildTreeJSON(true))'),before);
  } finally {app.dom.window.close();}
});

test('tree design includes optional preparation scopes without assuming mastery or adding hard dependencies', async () => {
  const app=loadApp();
  try {
    const id=await app.ev(`addMathTreeToLibrary('${integration}')`);
    app.window.__id=id;
    app.ev('openLibraryEntry(__id)');
    const prompt=el(app,'tree-prompt-box').value;
    assert.match(prompt,/RECOMMENDED PREPARATION \(OPTIONAL\)/);
    assert.match(prompt,/Definite Integrals and Antiderivatives — Accumulation/);
    assert.match(prompt,/Do not assume the learner has completed them/);
    assert.match(prompt,/Do not add these collection links as mandatory learning-node dependencies/);
    assert.equal(app.ev('libraryCache[__id].data.nodes.length'),0);
  } finally {app.dom.window.close();}
});

test('starting trees describe the absence of preparation and localize recommendation labels', () => {
  const app=loadApp();
  try {
    app.ev("openMathAtlas({target:'math_counting_and_quantity'})");
    assert.match(el(app,'explorer-detail').textContent,/No preparation trees recommended. Start here./);
    assert.equal(el(app,'explorer-nodes').querySelectorAll('.explorer-preparation [data-math-id]').length,0);
    app.ev("setUILanguage('es',false)");
    assert.equal(el(app,'explorer-preparation-title').textContent,'Preparación recomendada');
    assert.match(el(app,'explorer-detail').textContent,/No se recomiendan árboles previos/);
  } finally {app.dom.window.close();}
});
