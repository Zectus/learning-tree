const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const {loadApp}=require('./harness');
const format=require('../js/learn/generation-format');
const lesson='=== SECTION 1: Idea ===\nA useful explanation.\n[QUESTION 1]\n[ANSWER: A]\nWhich case fits?\n(A) First\n(B) Second\n[/QUESTION]';
async function worker(){const source=fs.readFileSync(path.join(__dirname,'../js/learn/generation-format.js'),'utf8')+'\nconst PAGE="test";\n'+fs.readFileSync(path.join(__dirname,'../online/worker.js'),'utf8');return(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).default;}
class Bucket{
 constructor(){this.objects=new Map()}
 async get(key){const value=this.objects.get(key);return value?{json:async()=>JSON.parse(value.text)}:null}
 async delete(keys){for(const key of Array.isArray(keys)?keys:[keys])this.objects.delete(key)}
 async head(key){return this.objects.has(key)?{}:null}
 async put(key,text,options){if(options?.onlyIf&&this.objects.has(key))return null;this.objects.set(key,{text,uploaded:new Date()});return{etag:'saved'}}
 async list({prefix,delimiter}){const entries=[...this.objects].filter(([key])=>key.startsWith(prefix));if(delimiter)return{objects:[],delimitedPrefixes:[...new Set(entries.map(([key])=>prefix+key.slice(prefix.length).split('/')[0]+'/'))]};return{objects:entries.map(([key,v])=>({key,uploaded:v.uploaded}))}}
}
function payload(){const tree={topic:'Online tree',nodes:[{id:'a',label:'Root A'},{id:'b',label:'Root B'},{id:'c',label:'Later',requires:['a']}]};return{tree,treeKey:format.generationTreeKey(tree),snapshot:tree,queue:['a','b','c'],prompts:tree.nodes.map(n=>({id:n.id,prompt:'Teach '+n.label})),requestId:'request-identity-1234'}}
async function call(w,env,url,{uid='owner',method='GET',data,origin='https://site.test'}={}){const headers={'oai-authenticated-user-id':uid};if(origin)headers.origin=origin;if(data)headers['content-type']='application/json';const response=await w.fetch(new Request('https://site.test'+url,{method,headers,body:data?JSON.stringify(data):undefined}),env);return{status:response.status,body:await response.json()}}
async function rpc(w,env,name,args,uid='owner'){return(await call(w,env,'/mcp',{uid,method:'POST',origin:null,data:{jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}}})).body.result}

test('online jobs require identity, same-origin browser writes, and exact selected tree/prompt context',async()=>{
 const w=await worker(),env={BUCKET:new Bucket()};
 assert.equal((await call(w,env,'/api/jobs',{uid:''})).status,401);
 assert.equal((await call(w,env,'/api/jobs',{method:'POST',data:payload(),origin:'https://evil.test'})).status,403);
 const created=await call(w,env,'/api/jobs',{method:'POST',data:payload()});assert.equal(created.status,201);assert.equal(created.body.total,3);
 const again=await call(w,env,'/api/jobs',{method:'POST',data:payload()});assert.equal(again.body.id,created.body.id);
 assert.equal((await call(w,env,'/api/jobs/'+created.body.id,{uid:'someone-else'})).status,404);
 assert.equal((await call(w,env,'/api/jobs',{uid:'someone-else'})).body.jobs.length,0);
 const bad=await call(w,env,'/api/jobs',{method:'POST',data:{...payload(),treeKey:'wrong'}});assert.equal(bad.status,400);
 const prompts=await rpc(w,env,'get_lesson_prompt',{jobId:created.body.id,nodeId:'c'});assert.equal(prompts.isError,true);assert.match(prompts.content[0].text,/prerequisites/);
});

test('ChatGPT tools save validated lessons durably, refuse overwrites, and return all independent outputs regardless of arrival order',async()=>{
 const w=await worker(),env={BUCKET:new Bucket()};const job=(await call(w,env,'/api/jobs',{method:'POST',data:payload()})).body;
 const list=await rpc(w,env,'list_lesson_jobs',{});assert.equal(JSON.parse(list.content[0].text).jobs.length,1);
 assert.equal((await rpc(w,env,'save_lesson',{jobId:job.id,nodeId:'b',content:lesson})).isError,undefined);
 const before=(await call(w,env,'/api/jobs/'+job.id+'/records')).body;assert.deepEqual(before.records.map(r=>r.id),['b']);
 assert.equal((await rpc(w,env,'save_lesson',{jobId:job.id,nodeId:'a',content:lesson})).isError,undefined);
 const after=(await call(w,env,'/api/jobs/'+job.id+'/records')).body;assert.deepEqual(after.records.map(r=>r.id),['a','b']);
 assert.equal((await rpc(w,env,'save_lesson',{jobId:job.id,nodeId:'a',content:lesson.replace('explanation','different explanation')})).isError,true);
 assert.equal((await rpc(w,env,'save_lesson',{jobId:job.id,nodeId:'c',content:'partial'})).isError,true);
 assert.equal((await rpc(w,env,'save_lesson',{jobId:job.id,nodeId:'c',content:lesson})).isError,undefined);
 const complete=(await call(w,env,'/api/jobs/'+job.id)).body;assert.equal(complete.completed,3);
 const exported=(await call(w,env,'/api/jobs/'+job.id+'/tree')).body;assert.equal(exported.nodes[2].content,lesson);
 const foreign=await rpc(w,env,'get_lesson_job',{jobId:job.id},'someone-else');assert.equal(foreign.isError,true);
});

test('online UI uses a browser button, exact node prompts, and verifies window/origin/nonce before importing',async()=>{
 const app=loadApp();try{
 app.window.__tree=app.fixture('mini-tree.json');app.ev('loadFromJSON(JSON.parse(__tree));generationSelection.count=1;');
 const packet=JSON.parse(app.ev('JSON.stringify(onlineLessonPayload())'));assert.equal(packet.queue.length,1);assert.match(packet.prompts[0].prompt,/save_lesson/);assert.doesNotMatch(packet.prompts[0].prompt,/checkpoint protocol|downloadable file named|subagents/i);
 const method=app.document.getElementById('generation-method');method.value='online';app.ev('updateGenerationMethod()');
 assert.equal(app.document.getElementById('assistant-online-panel').classList.contains('hidden'),false);
 assert.equal(app.document.getElementById('assistant-generation-panel').classList.contains('hidden'),true);
 const key=app.ev('generationTreeKey(buildTreeJSON(false))');app.ev(`onlineLessons.transfer={page:window,origin:'https://online.test',nonce:'expected',payload:{treeKey:${JSON.stringify(key)}}};`);
 const data={type:'learning-tree-online-records',nonce:'expected',treeKey:key,records:[{format:'learning-tree-lesson/v1',treeKey:key,id:'a',content:lesson}]};
 app.window.dispatchEvent(new app.window.MessageEvent('message',{source:app.window,origin:'https://evil.test',data}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),undefined);
 app.window.dispatchEvent(new app.window.MessageEvent('message',{source:app.window,origin:'https://online.test',data:{...data,nonce:'bad'}}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),undefined);
 app.window.dispatchEvent(new app.window.MessageEvent('message',{source:app.window,origin:'https://online.test',data}));assert.equal(app.ev('state.nodes.get(1)._sessionTxt'),lesson);
 await new Promise(resolve=>setTimeout(resolve,0));
 }finally{app.window.close()}
});


test('online page script parses and removing a batch is user-scoped',async()=>{
 const vm=require('node:vm'),html=fs.readFileSync(path.join(__dirname,'../online/page.html'),'utf8');
 new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1]);
 const w=await worker(),env={BUCKET:new Bucket()};const job=(await call(w,env,'/api/jobs',{method:'POST',data:payload()})).body;
 assert.equal((await call(w,env,'/api/jobs/'+job.id,{method:'DELETE',uid:'someone-else'})).status,404);
 assert.equal((await call(w,env,'/api/jobs/'+job.id,{method:'DELETE',origin:'https://evil.test'})).status,403);
 assert.equal((await call(w,env,'/api/jobs/'+job.id,{method:'DELETE'})).status,200);
 assert.equal((await call(w,env,'/api/jobs')).body.jobs.length,0);
});
