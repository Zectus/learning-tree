const test = require('node:test');
const assert = require('node:assert/strict');
const { loadApp } = require('./harness');
const lesson = '=== SECTION 1: A useful idea ===\nWorked explanation.\n[QUESTION 1]\n[ANSWER: B]\nChoose the matching case.\n(A) First\n(B) Second\n(C) Third\n[/QUESTION]\n';
const element = (app,id) => app.document.getElementById(id);
const tick = () => new Promise(resolve => setTimeout(resolve,0));
function load(app) { app.window.__tree=app.fixture('mini-tree.json');app.ev('loadFromJSON(JSON.parse(__tree))'); }

test('the static app keeps file generation and shows a deliberate local-app setup instead of probing localhost',async()=>{
 const app=loadApp();let calls=0;app.window.fetch=()=>{calls++;throw Error('No probing')};
 try{
  load(app);element(app,'generation-method').value='automatic';app.ev('updateGenerationMethod()');await tick();
  assert.equal(calls,0);assert.equal(element(app,'assistant-local-setup').classList.contains('hidden'),false);
  assert.equal(element(app,'assistant-connected-controls').classList.contains('hidden'),true);
  assert.ok([...app.document.querySelectorAll('.generation-file-step')].every(el=>el.classList.contains('hidden')));
  element(app,'generation-method').value='files';app.ev('updateGenerationMethod()');
  assert.ok([...app.document.querySelectorAll('.generation-file-step')].every(el=>!el.classList.contains('hidden')));
 }finally{app.window.close()}
});

test('automatic requests use the exact selected nodes and actual prompts without file/coordinator instructions or personal progress',async()=>{
 const app=loadApp();
 try{
  load(app);await tick();app.ev("setUILanguage('es')");element(app,'generation-language').value='Español';
  app.ev(`generationSelection.count=1;generationSelection.mode='manual';generationSelection.selected=new Set(['c']);state.nodes.get(3)._notes='PRIVATE NOTES';state.nodes.get(3).done=true;refreshGenerationSelection();`);
  const option=app.document.createElement('option');option.value='test-model';option.textContent='Test';element(app,'assistant-model').appendChild(option);
  const payload=JSON.parse(app.ev('JSON.stringify(assistantJobPayload())'));
  assert.deepEqual(payload.queue,['c']);assert.equal(payload.prompts.length,1);assert.match(payload.prompts[0].prompt,/topic: Gamma/);
  assert.match(payload.prompts[0].prompt,/Write the entire document in Español/);assert.match(payload.prompts[0].prompt,/application saves it automatically/);assert.doesNotMatch(payload.prompts[0].prompt,/subagents|checkpoint protocol|Deliver this as a downloadable file named/i);
  assert.ok(!JSON.stringify(payload).includes('PRIVATE NOTES'));assert.equal(payload.tree.nodes[0].done,undefined);assert.equal(payload.tree.nodes[1].content,undefined);assert.ok(payload.snapshot.nodes[1].content);
  assert.equal(JSON.parse(app.ev('JSON.stringify(assistantJobPayload())')).requestId,payload.requestId);
 }finally{app.window.close()}
});

test('automatic records merge only into their tree and preserve answers, notes, completion, and library identity',async()=>{
 const app=loadApp();
 try{
  load(app);await tick();app.window.__lesson=lesson;
  app.ev(`state.nodes.get(1).done=true;state.nodes.get(1)._notes='keep';state.nodes.get(1)._sessionAnswers={1:'A'};state.libraryId='original';libraryCache.original={name:'Original',savedAt:1,data:buildTreeJSON(true)};`);
  const key=app.ev('generationTreeKey(buildTreeJSON(false))');app.window.__records={treeKey:key,records:[{format:'learning-tree-lesson/v1',treeKey:key,id:'a',content:lesson}]};
  assert.equal(app.ev('collectAssistantRecords(__records)'),true);assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),lesson);
  assert.equal(app.ev('state.nodes.get(1).done'),true);assert.equal(app.ev('state.nodes.get(1)._notes'),'keep');assert.equal(app.ev('state.nodes.get(1)._sessionAnswers[1]'),'A');assert.equal(app.ev('state.libraryId'),'original');
  app.window.__records.treeKey='another-tree';assert.equal(app.ev('collectAssistantRecords(__records)'),false);
  await tick();
 }finally{app.window.close()}
});

test('handoff messages require the expected source window, exact origin, nonce, and current tree identity',async()=>{
 const app=loadApp();
 try{
  load(app);await tick();app.window.__lesson=lesson;
  app.ev(`assistantState.outgoing={opened:window,origin:location.origin,nonce:'expected-nonce'};`);
  const key=app.ev('generationTreeKey(buildTreeJSON(false))');
  const data={type:'learning-tree-companion-records',nonce:'expected-nonce',treeKey:key,records:[{format:'learning-tree-lesson/v1',treeKey:key,id:'a',content:lesson}]};
  app.window.dispatchEvent(new app.window.MessageEvent('message',{data,source:app.window,origin:'https://evil.example'}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),undefined);
  app.window.dispatchEvent(new app.window.MessageEvent('message',{data:{...data,nonce:'wrong'},source:app.window,origin:'http://localhost'}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),undefined);
  app.window.dispatchEvent(new app.window.MessageEvent('message',{data,source:app.window,origin:'http://localhost'}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),lesson);
  await tick();
 }finally{app.window.close()}
});
