const { stepCount, goToStep } = require('./tutorial-navigation');
const test = require('node:test');
const assert = require('node:assert/strict');
const {loadApp} = require('./harness');
const tick = () => new Promise(resolve=>setTimeout(resolve,0));
const el = (app,id) => app.document.getElementById(id);
function loadTree(app) { app.window.__tree=app.fixture('mini-tree.json'); app.ev('loadFromJSON(JSON.parse(__tree))'); }

test('browser language sets the initial interface unless a saved choice overrides it',()=>{
 for (const [browserLanguages, uiLanguage, expected, storageUnavailable] of [
  [['es-MX','en-US'],null,'es',false],
  [['en-GB','es'],null,'en',false],
  [['fr-FR','es-ES'],null,'es',false],
  [['de-DE'],null,'en',false],
  [[],null,'en',false],
  [['es-ES'],'en','en',false],
  [['en-US'],'es','es',false],
  [['es-ES'],null,'es',true],
 ]) {
  const app=loadApp({browserLanguages,uiLanguage,storageUnavailable});
  try {
   assert.equal(app.document.documentElement.lang,expected);
   assert.equal(el(app,'btn-my-trees').textContent,expected==='es'?'📚 Mis árboles':'📚 My Trees');
   if (!storageUnavailable && uiLanguage===null) {
    assert.equal(app.window.localStorage.getItem('tree-ui-language'),null);
    el(app,'menu-language').click();
    assert.equal(app.window.localStorage.getItem('tree-ui-language'),expected==='es'?'en':'es');
   }
  } finally {app.window.close();}
 }
});

test('saved language localizes the initial page and Account switches back without a reload',()=>{
 const app=loadApp({uiLanguage:'es'});
 try {
  assert.equal(app.document.documentElement.lang,'es');
  assert.equal(app.document.title,'Árbol de progreso');
  assert.equal(el(app,'btn-my-trees').textContent,'📚 Mis árboles');
  assert.equal(el(app,'btn-mode').textContent,'👁 Explorar ▾');
  assert.equal(el(app,'menu-language').textContent,'🌐 English');
  assert.equal(el(app,'sv-notes-ta').placeholder,'Algo que quieras recordar sobre este tema…');
  el(app,'menu-language').click();
  assert.equal(app.document.documentElement.lang,'en');
  assert.equal(el(app,'btn-my-trees').textContent,'📚 My Trees');
  assert.equal(app.window.localStorage.getItem('tree-ui-language'),'en');
 } finally {app.window.close();}
});

test('switching preserves user names, lessons, notes, sketches, answer state, and editable fields',()=>{
 const app=loadApp();
 try {
  loadTree(app);
  app.ev(`state.nodes.get(1).label='My Trees'; state.nodes.get(1).el.querySelector('.node-text').textContent='My Trees'; state.nodes.get(2)._notes='Sign in';
    state.nodes.get(2)._drawing=[{color:'red',points:[[1,2],[3,4]]}];
    openViewer(state.nodes.get(2)._sessionTxt,2); toggleNotesPanel();
    showSignedInPanel({username:'Continue',email:'me@example.com'});
    state.accountUser={uid:'test',username:'Continue',email:'me@example.com'}; updateAccountButton();
    libraryCache={saved:{name:'My Trees',data:buildTreeJSON(true),savedAt:Date.now()}}; renderLibraryGrid();`);
  app.document.querySelector('.q-opt').click();
  const question=app.document.querySelector('.q-card');
  const contents=el(app,'sv-body').querySelector('.sv-prose').textContent;
  const before=app.ev('JSON.stringify({tree:buildTreeJSON(true),notes:state.nodes.get(2)._notes,drawing:state.nodes.get(2)._drawing,answers:[...viewer.answers]})');
  el(app,'tree-topic-input').value='My Trees'; el(app,'tree-language-input').value='French';
  el(app,'account-email-input').value='user@example.com';
  app.ev("setUILanguage('es')");
  assert.equal(app.document.querySelector('.node-text').textContent,'My Trees');
  assert.equal(app.document.querySelector('.lc-name').textContent,'My Trees');
  assert.equal(el(app,'account-name-display').textContent,'Continue');
  assert.equal(el(app,'btn-account-menu').textContent,'👤 Continue ▾');
  assert.equal(el(app,'sv-body').querySelector('.sv-prose').textContent,contents);
  assert.equal(app.document.querySelector('.q-card'),question);
  assert.equal(el(app,'tree-topic-input').value,'My Trees');
  assert.equal(el(app,'tree-language-input').value,'French');
  assert.equal(el(app,'account-email-input').value,'user@example.com');
  assert.equal(before,app.ev('JSON.stringify({tree:buildTreeJSON(true),notes:state.nodes.get(2)._notes,drawing:state.nodes.get(2)._drawing,answers:[...viewer.answers]})'));
  assert.match(question.querySelector('.q-num').textContent,/Pregunta/);
  assert.match(question.querySelector('.q-feedback').textContent,/Correcto|Respuesta correcta/);
  app.ev("setUILanguage('en')");
  assert.match(question.querySelector('.q-num').textContent,/Question/);
  assert.equal(app.document.querySelector('.q-card'),question);
 } finally {app.window.close();}
});

test('Spanish prompts preserve literal parser/schema keys and all interpolated user content',()=>{
 const app=loadApp({uiLanguage:'es'});
 try {
  loadTree(app);
  app.ev(`state.topic='My original tree'; state.nodes.get(2).label='My Trees'; state.nodes.get(2).explanation='Do not translate this scope'; openLearnModal(2)`);
  let prompt=el(app,'prompt-box').value;
  assert.match(prompt,/Vas a producir una lección/);
  assert.match(prompt,/My Trees/); assert.match(prompt,/Do not translate this scope/);
  assert.match(prompt,/My original tree/); assert.match(prompt,/\[ANSWER: X\]/);
  assert.match(prompt,/=== SECTION N:/); assert.match(prompt,/type: function2d/);
  assert.match(prompt,/type: surface3d/); assert.match(prompt,/en English/);
  assert.match(app.ev("buildPrompt(2,'')"),/en Español/);
  app.ev("openTreeModal()");
  el(app,'tree-topic-input').value='My original topic';
  el(app,'tree-language-input').value='French';
  el(app,'tree-topic-input').dispatchEvent(new app.window.Event('input'));
  prompt=el(app,'tree-prompt-box').value;
  assert.match(prompt,/Vas a diseñar/); assert.match(prompt,/My original topic/);
  assert.match(prompt,/"nodes"/); assert.match(prompt,/"language": "French"/);
  app.ev("setTreeMode('file')");
  assert.match(el(app,'tree-file-prompt-box').value,/archivos adjuntos/);
  app.ev("setUILanguage('en')");
  assert.match(el(app,'tree-prompt-box').value,/You are designing/);
  assert.equal(el(app,'tree-language-input').value,'French');
 } finally {app.window.close();}
});

test('dynamic errors, native dialogs, counts, status, metadata, and tooltips are translated',()=>{
 const app=loadApp({uiLanguage:'es'});
 try {
  loadTree(app);
  app.ev(`showToast('Saved changes to "My Trees".'); showAccountError(friendlyAuthError({code:'auth/wrong-password'}));
    libraryCache={saved:{name:'My Trees',data:buildTreeJSON(true),savedAt:Date.now()}}; renderLibraryGrid(); setMode('edit');`);
  assert.match(app.toasts().join(' '),/guardado.*My Trees/);
  assert.match(el(app,'account-error').textContent,/contraseña/);
  assert.match(app.document.querySelector('.lc-meta').textContent,/nodos/);
  assert.match(app.document.querySelectorAll('.lc-meta')[1].textContent,/ahora mismo/);
  assert.match(app.document.querySelector('.node-badge').textContent,/Bloqueado|Disponible|Completado/);
  assert.match(app.document.querySelector('.node-explanation-ta').placeholder,/Define exactamente/);
  let dialog=''; app.window.confirm=msg=>{dialog=msg;return false;};
  app.ev("deleteLibraryEntry('saved')");
  assert.equal(dialog,'¿Eliminar «My Trees»? Esta acción no se puede deshacer.');
  app.ev(`showToast('Loaded, but ignored: 2 repeated ids; 1 link that would form a loop.');`);
  assert.match(app.toasts().join(' '),/2 identificadores repetidos; 1 enlace que crearía un ciclo/);
 } finally {app.window.close();}
});

test('complete Spanish tutorial, language switching mid-tour, and restoration keep the chosen language',async()=>{
 const app=loadApp({uiLanguage:'es',tutorialSeen:false});
 try {
  const errors=[]; app.window.addEventListener('error',e=>errors.push(e.error));
  const count=stepCount(app);
  for(let i=0;i<count;i++){
   await goToStep(app,i);
   const english=el(app,'tutorial-title').dataset.uiText;
   assert.notEqual(el(app,'tutorial-title').textContent,english);
   assert.notEqual(el(app,'tutorial-intro').textContent,el(app,'tutorial-intro').dataset.uiText);
  }
  await goToStep(app,20);
  el(app,'menu-language').click();
  assert.equal(app.document.documentElement.lang,'en');
  assert.equal(el(app,'tutorial-title').textContent,'Account settings');
  el(app,'menu-language').click();
  el(app,'tutorial-skip').click(); await tick();
  assert.equal(app.document.documentElement.lang,'es');
  assert.equal(el(app,'btn-my-trees').textContent,'📚 Mis árboles');
  assert.equal(el(app,'btn-mode').textContent,'👁 Explorar ▾');
  assert.equal(app.window.localStorage.getItem('tree-ui-language'),'es');
  assert.match(app.toasts().join(' '),/Ver tutorial/);
  assert.deepEqual(errors,[]);
 } finally {app.window.close();}
});

test('language switching works when storage is blocked',()=>{
 const app=loadApp({storageUnavailable:true});
 try {
  el(app,'tutorial-skip').click(); el(app,'menu-language').click();
  assert.equal(app.document.documentElement.lang,'es');
  assert.equal(el(app,'btn-my-trees').textContent,'📚 Mis árboles');
 } finally {app.window.close();}
});

test('changing language during a replay also translates a restored prompt window',()=>{
 const app=loadApp();
 try {
  loadTree(app); app.ev('openLearnModal(2)');
  assert.match(el(app,'prompt-box').value,/You are producing/);
  el(app,'menu-tutorial').click();
  app.ev("setUILanguage('es')");
  el(app,'tutorial-skip').click();
  assert.equal(el(app,'modal-backdrop').classList.contains('open'),true);
  assert.match(el(app,'prompt-box').value,/Vas a producir/);
  assert.equal(el(app,'node-language-input').value,'English');
 } finally {app.window.close();}
});
