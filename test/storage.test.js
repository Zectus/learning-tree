const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { loadApp, ROOT } = require('./harness');

test('progress survives root and node renames and a JSON round trip', () => {
  const app = loadApp();
  app.ev(`loadFromJSON({nodes:[{id:'root',label:'Original'}]});
    state.nodes.get(1).done = true;
    state.nodes.get(1)._notes = 'Remember this';
    autoSaveProgress();
    state.nodes.get(1).label = 'Renamed';
    const exported = buildTreeJSON(true);
    loadFromJSON(exported);`);
  assert.equal(app.ev('state.nodes.get(1).done'), true);
  assert.equal(app.ev('state.nodes.get(1)._notes'), 'Remember this');
  app.dom.window.close();
});

test('legacy label progress migrates without removing its original record', () => {
  const app = loadApp();
  app.ev(`progressCache = {original:{Original:{done:true,notes:'Old notes'}}};
    loadFromJSON({nodes:[{id:'root',label:'Original'}]});
    autoSaveProgress();
    state.nodes.get(1).label = 'Renamed';
    loadFromJSON(buildTreeJSON(true));`);
  assert.equal(app.ev('state.nodes.get(1)._notes'), 'Old notes');
  assert.equal(app.ev('progressCache.original.Original.done'), true);
  app.dom.window.close();
});

function cloudContext() {
  let source = fs.readFileSync(ROOT + '/js/persistence/cloud.js', 'utf8');
  source = source.replace(/import[\s\S]*?from "[^"]+";/g, '');
  const updates = [];
  const ctx = vm.createContext({
    window: {}, initializeApp:()=>({}), getAuth:()=>({}), getDatabase:()=>({}),
    GoogleAuthProvider:class {}, onAuthStateChanged:()=>{}, ref:(_,path)=>path,
    get:async()=>({exists:()=>true,val:()=>({tree:{node:{done:false,notes:'old'}}})}),
    update:async(path,changes)=>updates.push({path,changes}),
  });
  vm.runInContext(source, ctx);
  return { ctx, updates };
}

test('a stale client sends only changed fields, preserving unrelated remote progress', async () => {
  const {ctx,updates} = cloudContext();
  await vm.runInContext(`window.cloud.getProgress('u')`,ctx);
  await vm.runInContext(`window.cloud.setProgress('u',{tree:{node:{done:true,notes:'old'}}})`,ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(updates)),[
    {path:'users/u/progress',changes:{'tree/node/done':true}},
  ]);
});

test('failed cloud writes retain the baseline so retry resends the change', async () => {
  const {ctx,updates} = cloudContext();
  await vm.runInContext(`window.cloud.getProgress('u')`,ctx);
  ctx.update = async()=>{throw new Error('offline');};
  await assert.rejects(vm.runInContext(`window.cloud.setProgress('u',{tree:{node:{done:true,notes:'old'}}})`,ctx));
  ctx.update = async(path,changes)=>updates.push({path,changes});
  await vm.runInContext(`window.cloud.setProgress('u',{tree:{node:{done:true,notes:'old'}}})`,ctx);
  assert.equal(updates[0].changes['tree/node/done'],true);
});

test('library transaction refuses an entry changed on another device', async () => {
  const {ctx} = cloudContext();
  await vm.runInContext(`window.cloud.getLibrary('u')`,ctx);
  ctx.runTransaction = async(path, callback) => {
    const next = callback({node:{done:true,notes:'remote edit'}});
    assert.equal(next, undefined);
    return {committed:false};
  };
  await assert.rejects(vm.runInContext(`window.cloud.setLibrary('u',{tree:{node:{done:false,notes:'local edit'}}})`,ctx), /changed on another device/);
});

test('Google collision links the pending credential only after password authentication', async () => {
  const {ctx} = cloudContext();
  const credential = {providerId:'google.com'};
  ctx.GoogleAuthProvider.credentialFromError = () => credential;
  ctx.signInWithPopup = async()=>{throw {code:'auth/account-exists-with-different-credential',customData:{email:'a@example.com'}};};
  await assert.rejects(vm.runInContext(`window.cloud.signInWithGoogle()`,ctx));
  const calls = [];
  const user = {uid:'existing',email:'a@example.com'};
  ctx.signInWithEmailAndPassword = async()=>{calls.push('authenticate');return {user};};
  ctx.linkWithCredential = async(linkedUser,linkedCredential)=>{
    calls.push('link');
    assert.equal(linkedUser.uid,'existing');
    assert.equal(linkedCredential,credential);
  };
  await vm.runInContext(`window.cloud.signIn('a@example.com','password')`,ctx);
  assert.deepEqual(calls,['authenticate','link']);
});

test('IndexedDB migration removes the legacy copy only after transaction commit', async () => {
  const records = new Map();
  const legacy = new Map([['tree-library',JSON.stringify({saved:{name:'Legacy'}})]]);
  let committed = false;
  const database = {transaction(name,mode) {
    const tx = {objectStore:()=>({
      get(key) { const req = {}; queueMicrotask(()=>{req.result=records.get(key);req.onsuccess();}); return req; },
      put(value,key) { queueMicrotask(()=>{records.set(key,value);committed=true;tx.oncomplete();}); },
    })};
    return tx;
  }};
  const indexedDB = {open() { const req = {}; queueMicrotask(()=>{req.result=database;req.onsuccess();}); return req; }};
  const ctx = vm.createContext({window:{indexedDB},indexedDB,localStorage:{
    getItem:key=>legacy.get(key),
    removeItem:key=>{assert.equal(committed,true);legacy.delete(key);},
  }});
  vm.runInContext(fs.readFileSync(ROOT+'/js/persistence/storage.js','utf8'),ctx);
  const value = await vm.runInContext(`browserStore.read('tree-library')`,ctx);
  assert.equal(value.saved.name,'Legacy');
  assert.equal(records.get('tree-library').saved.name,'Legacy');
  assert.equal(legacy.has('tree-library'),false);
});

test('library saves compare Firebase shapes and prime each transaction cache', async () => {
  const {ctx} = cloudContext();
  let remote = {name:'Tree',savedAt:1,data:{nodes:[{id:'root',requires:[]}]}};
  let primed = false;
  ctx.get = async path => {
    if (path.endsWith('/tree')) primed = true;
    return {exists:()=>true,val:()=>path.endsWith('/tree') ? remote : {tree:remote}};
  };
  ctx.runTransaction = async (path, callback) => {
    assert.equal(primed, true);
    primed = false;
    // Firebase strips empty arrays and can expose numeric-key objects.
    const stored = JSON.parse(JSON.stringify(remote));
    stored.data.nodes = {0:{id:'root'}};
    const next = callback(stored);
    assert.notEqual(next, undefined);
    remote = next;
    return {committed:true};
  };
  await vm.runInContext(`window.cloud.getLibrary('u')`,ctx);
  for (const savedAt of [2,3]) {
    await vm.runInContext(`window.cloud.setLibrary('u',{tree:{name:'Tree',savedAt:${savedAt},data:{nodes:[{id:'root',requires:[]}]}}})`,ctx);
  }
  assert.equal(remote.savedAt,3);
});

test('rapid library saves share one pending mutation and recover after failure', async () => {
  const app = loadApp();
  let release;
  let saves = 0;
  app.window.cloud = {setLibrary:async()=>{saves++; await new Promise(resolve=>{release=resolve;}); throw new Error('offline');}};
  app.ev(`loadFromJSON({nodes:[{id:'root',label:'Root'}]});
    state.accountUser={uid:'u'}; librarySource='cloud';
    libraryCache={saved:{name:'Tree',savedAt:1,data:buildTreeJSON(true)}};
    state.libraryId='saved';`);
  const first = app.ev('saveCurrentTreeToLibrary()');
  await app.ev('saveCurrentTreeToLibrary()');
  assert.equal(saves,1);
  assert.equal(app.document.getElementById('btn-save-current-tree').disabled,true);
  release();
  await first;
  assert.equal(app.ev('libraryCache.saved.savedAt'),1);
  assert.equal(app.document.getElementById('btn-save-current-tree').disabled,false);
  app.dom.window.close();
});

test('repeated conflict warnings display a single dismissible toast', () => {
  const app = loadApp();
  app.ev(`for(let i=0;i<4;i++) showToast('Saved tree conflict');`);
  assert.deepEqual(app.toasts(),['Saved tree conflict']);
  app.document.querySelector('#toast-host .toast').click();
  assert.deepEqual(app.toasts(),[]);
  app.dom.window.close();
});
