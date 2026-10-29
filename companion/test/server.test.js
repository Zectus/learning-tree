import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { createCompanion } from '../src/server.js';
import { fixture, input, lesson, finish } from './helpers.js';

async function serverFixture() {
  const f = await fixture();
  const engines = { chatgpt: { status:async()=>({connected:true,email:'local-reader',accountKey:'account-1'}), models:async()=>[{id:'test-model',name:'Test Model'}], generate:async()=>lesson }, claude: {status:async()=>({connected:false,message:'Install Claude Code'})} };
  const companion = await createCompanion({directory:f.directory,port:0,providers:engines});
  const {server,origin} = await companion.listen();
  return { ...f, companion, origin, async cleanup(){ await companion.jobs.shutdown(); server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await f.cleanup(); } };
}
const headers = { 'X-Learning-Tree-Companion':'1','Content-Type':'application/json' };

test('local server rejects cross-site control and DNS rebinding, and never serves credential/job files',async()=>{
  const f=await serverFixture();
  try {
    assert.equal((await fetch(f.origin+'/')).status,200);
    assert.equal((await fetch(f.origin+'/companion/api/status')).status,403);
    assert.equal((await fetch(f.origin+'/companion/api/status',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
    assert.equal((await fetch(f.origin+'/companion/api/status',{headers:{...headers,'Sec-Fetch-Site':'cross-site'}})).status,403);
    const rebound = await new Promise((resolve,reject) => { const req = request(f.origin+'/', { headers:{Host:'evil.example'} }, response => { response.resume(); resolve(response.statusCode); }); req.on('error', reject); req.end(); });
    assert.equal(rebound,403);
    for(const path of ['/.git/config','/companion/src/server.js','/chatgpt.json','/jobs.json','/node_modules/express/package.json'])assert.equal((await fetch(f.origin+path)).status,404,path);
    const status=await fetch(f.origin+'/companion/api/status',{headers});assert.equal(status.status,200);assert.equal(status.headers.get('access-control-allow-origin'),null);assert.equal(status.headers.get('cache-control'),'no-store');
  }finally{await f.cleanup()}
});

test('job HTTP flow preserves tree identity, emits import-ready records, and retains baseline content in recovery exports',async()=>{
  const f=await serverFixture();
  try{
    const value=input();value.snapshot=JSON.parse(JSON.stringify(value.tree));value.snapshot.nodes[0].content=lesson;
    const created=await fetch(f.origin+'/companion/api/jobs',{method:'POST',headers,body:JSON.stringify(value)});assert.equal(created.status,201);const job=await created.json();
    assert.equal((await fetch(`${f.origin}/companion/api/jobs/${job.id}/start`,{method:'POST',headers})).status,200);await finish(f.companion.jobs);
    const records=await fetch(`${f.origin}/companion/api/jobs/${job.id}/records?after=1`,{headers}).then(r=>r.json());assert.equal(records.records.length,1);assert.equal(records.records[0].id,'b');assert.equal(records.records[0].format,'learning-tree-lesson/v1');
    const tree=await fetch(`${f.origin}/companion/api/jobs/${job.id}/tree`,{headers}).then(r=>r.json());assert.equal(tree.nodes[0].content,lesson.trim());assert.equal(tree.nodes[1].content,lesson.trim());
    const list=await fetch(f.origin+'/companion/api/jobs',{headers}).then(r=>r.json());assert.equal(list.jobs[0].status,'complete');assert.equal(list.jobs[0].prompts,undefined);assert.equal(list.jobs[0].records,undefined);
    assert.equal((await fetch(`${f.origin}/companion/api/jobs/${job.id}`,{method:'DELETE',headers})).status,200);
    assert.equal((await fetch(f.origin+'/companion/api/jobs',{headers}).then(r=>r.json())).jobs.length,0);
  }finally{await f.cleanup()}
});
