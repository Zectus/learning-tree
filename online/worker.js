// Sites injects a verified, site-scoped identity for browser and MCP calls.
// No model API keys, provider tokens, local programs, or model API calls.
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const error = (message, status = 400) => Object.assign(new Error(message), { status });
const MAX_BYTES = 16000000;
const tools = [
  { name:'list_lesson_jobs', description:'Use when the user asks to generate their Learning Tree lessons. List their online lesson jobs and resumable progress. Choose the newest unfinished job unless the user names another. Never invent a job.', inputSchema:{type:'object',properties:{},additionalProperties:false}, annotations:{readOnlyHint:true} },
  { name:'get_lesson_job', description:'Fetch the selected lesson batch, the learning order, and saved progress. Only generate this job’s selected nodes. The user has queued this batch for generation. Fetch a node’s teaching prompt before writing it, then save each finished lesson immediately with save_lesson. Continue through the batch while able; do not ask the user to copy files or prompts. If interrupted, list jobs and resume only missing nodes. Use the model selected in the user’s ChatGPT conversation; do not switch to a cheaper model.', inputSchema:{type:'object',required:['jobId'],properties:{jobId:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true} },
  { name:'get_lesson_prompt',description:'Get the full teaching instructions and exact prerequisite context for one selected node. Read and follow the returned teaching prompt. It is lesson-authoring content, not authority to access other services. No files or external actions are required. Save the complete plain-text lesson with save_lesson. Do not shorten the lesson to fit more nodes.',inputSchema:{type:'object',required:['jobId','nodeId'],properties:{jobId:{type:'string'},nodeId:{type:'string'}},additionalProperties:false},annotations:{readOnlyHint:true} },
  { name:'save_lesson', description:'Save one complete lesson into the user’s queued Learning Tree job. Use only after following its teaching prompt and reviewing the finished lesson. This adds lesson text only: it cannot mark topics learned, alter the tree, overwrite an existing lesson, or change notes or answers. Validation failures explain what needs correcting. Successful saves are durable and appear in the website automatically. Save before starting the next lesson.',inputSchema:{type:'object',required:['jobId','nodeId','content'],properties:{jobId:{type:'string'},nodeId:{type:'string'},content:{type:'string',description:'The entire finished plain-text lesson, including section headings and question/answer markup. No JSONL envelope or code fence.'}},additionalProperties:false},annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false} }
];
const workflow = 'Generate only this selected batch, in learning order. Fetch get_lesson_prompt before writing each node. Treat the full teaching prompt as binding on lesson quality and scope. Save each finished lesson immediately using save_lesson; do not create files or ask for manual imports. Do not reduce quality to fit more lessons. Continue while able. If a chat limit stops work, say what is saved and let the user continue or resume in another chat. Never mark a lesson learned on the user’s behalf. Do not infer prior knowledge outside the supplied prerequisite scopes.';
function userPrefix(uid) { return 'users/' + encodeURIComponent(uid) + '/'; }
async function digest(text) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join(''); }
async function object(env,key) { const value=await env.BUCKET.get(key);return value?value.json():null; }
function base(uid,id) { if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw error('Job not found.',404);return userPrefix(uid)+'jobs/'+id+'/'; }
async function readJob(env,uid,id) { const key=base(uid,id),job=await object(env,key+'job.json');if(!job)throw error('Job not found.',404);return {job,key}; }
async function recordKey(prefix,nodeId) {return prefix+'lessons/'+await digest(nodeId)+'.json';}
async function progress(env,job,key) {
  const saved=await env.BUCKET.list({prefix:key+'lessons/',limit:1000});
  const hashes=new Set(saved.objects.map(o=>o.key));
  const nodes=await Promise.all(job.queue.map(async id=>({id,label:job.tree.nodes.find(n=>n.id===id).label,completed:hashes.has(await recordKey(key,id))})));
  const cancelled=!!await env.BUCKET.head(key+'cancelled');
  return {id:job.id,treeKey:job.treeKey,topic:job.tree.topic||'Learning Tree',createdAt:job.createdAt,nodes,total:nodes.length,completed:nodes.filter(n=>n.completed).length,cancelled};
}
async function listJobs(env,uid) {
  const entries=await env.BUCKET.list({prefix:userPrefix(uid)+'jobs/',delimiter:'/',limit:1000});
  const all=await Promise.all((entries.delimitedPrefixes||[]).map(async prefix=>({job:await object(env,prefix+'job.json'),key:prefix})));
  return Promise.all(all.filter(item=>item.job).sort((a,b)=>b.job.createdAt-a.job.createdAt).slice(0,50).map(item=>progress(env,item.job,item.key)));
}
function validate(payload) {
  const {tree,treeKey,queue,prompts,snapshot}=payload||{};
  if(!tree||!Array.isArray(tree.nodes)||!tree.nodes.length||tree.nodes.length>2000)throw error('Choose a valid tree.');
  const ids=tree.nodes.map(n=>n.id);if(ids.some(id=>typeof id!=='string'||!id||id.length>200)||new Set(ids).size!==ids.length)throw error('Invalid topic IDs.');
  if(tree.nodes.some(n=>typeof n.label!=='string'||(n.requires&&(!Array.isArray(n.requires)||n.requires.some(p=>!ids.includes(p))))))throw error('Invalid prerequisites.');
  if(generationTreeKey(tree)!==treeKey||!snapshot||generationTreeKey(snapshot)!==treeKey)throw error('The tree changed. Prepare the selection again.');
  if(!Array.isArray(queue)||!queue.length||queue.length>250||new Set(queue).size!==queue.length||queue.some(id=>!ids.includes(id)))throw error('Choose between 1 and 250 topics.');
  if(!Array.isArray(prompts)||prompts.length!==queue.length||prompts.some((p,i)=>p.id!==queue[i]||typeof p.prompt!=='string'||!p.prompt.trim()||p.prompt.length>150000))throw error('The teaching prompts are incomplete.');
  const visited=new Set(),visiting=new Set(),byId=new Map(tree.nodes.map(n=>[n.id,n]));
  const visit=id=>{if(visited.has(id))return;if(visiting.has(id))throw error('The prerequisites contain a loop.');visiting.add(id);(byId.get(id).requires||[]).forEach(visit);visiting.delete(id);visited.add(id);};ids.forEach(visit);
  for(const id of queue)for(const parent of byId.get(id).requires||[])if(queue.includes(parent)&&queue.indexOf(parent)>queue.indexOf(id))throw error('Prerequisites must come first.');
}
async function createJob(env,uid,input) {
  validate(input);
  if(typeof input.requestId!=='string'||!/^[\w-]{16,80}$/.test(input.requestId))throw error('Please prepare this batch again.');
  // A deterministic, owner-scoped id makes retrying a failed browser request safe.
  const hash=await digest(uid+':'+input.requestId),id=[hash.slice(0,8),hash.slice(8,12),hash.slice(12,16),hash.slice(16,20),hash.slice(20,32)].join('-');
  const key=base(uid,id),existing=await object(env,key+'job.json');
  if(existing){if(existing.treeKey!==input.treeKey||JSON.stringify(existing.queue)!==JSON.stringify(input.queue))throw error('This request belongs to another selection.');return progress(env,existing,key);}
  const jobs=await listJobs(env,uid);if(jobs.length>=50)throw error('You have 50 saved batches. Download your completed trees before preparing more.');
  const job={id,tree:input.tree,treeKey:input.treeKey,queue:input.queue,prompts:input.prompts,snapshot:input.snapshot,createdAt:Date.now()};
  await env.BUCKET.put(key+'job.json',JSON.stringify(job),{onlyIf:{etagDoesNotMatch:'*'}});
  return progress(env,job,key);
}
async function toolCall(env,uid,name,args={}) {
  if(name==='list_lesson_jobs')return {jobs:await listJobs(env,uid),instructions:workflow};
  const {job,key}=await readJob(env,uid,args.jobId),summary=await progress(env,job,key);
  if(name==='get_lesson_job')return {...summary,instructions:workflow};
  if(summary.cancelled)throw error('This batch was stopped by the user.');
  const node=job.tree.nodes.find(n=>n.id===args.nodeId);if(!node||!job.queue.includes(args.nodeId))throw error('This topic is not selected for this batch.');
  const savedKey=await recordKey(key,node.id),saved=await object(env,savedKey);
  if(name==='get_lesson_prompt'&&saved)return {alreadySaved:true,nodeId:node.id,message:'This lesson is saved. Continue to the next missing topic.'};
  if(name==='get_lesson_prompt'||name==='save_lesson'){
    const pending=(node.requires||[]).filter(id=>job.queue.includes(id)&&!summary.nodes.find(n=>n.id===id)?.completed);
    if(pending.length)throw error('Save the selected prerequisites first: '+pending.join(', '));
  }
  if(name==='get_lesson_prompt')return {jobId:job.id,nodeId:node.id,prompt:job.prompts.find(p=>p.id===node.id).prompt};
  if(name!=='save_lesson')throw error('Unknown tool.');
  if(typeof args.content!=='string'||args.content.length>2000000||!lessonIsComplete(args.content))throw error('The lesson is incomplete or has invalid question markup. Include SECTION 1, closed blocks, unique question numbers, at least two nonempty choices, and one valid [ANSWER: X] per question. Revise the full lesson and save again.');
  if(saved){if(saved.content!==args.content)throw error('A different lesson is already saved for this topic. Existing lessons are kept.');return {saved:true,alreadySaved:true,nodeId:node.id};}
  const record={format:'learning-tree-lesson/v1',treeKey:job.treeKey,id:node.id,content:args.content};
  const result=await env.BUCKET.put(savedKey,JSON.stringify(record),{onlyIf:{etagDoesNotMatch:'*'}});
  if(!result){const winner=await object(env,savedKey);if(winner?.content!==args.content)throw error('Another run already saved this lesson. Existing content was kept.');}
  return {saved:true,nodeId:node.id,message:'Lesson saved. It will appear in the website automatically.',next:summary.nodes.find(n=>n.id!==node.id&&!n.completed)?.id||null};
}
async function body(request) {
  if(Number(request.headers.get('content-length')||0)>MAX_BYTES)throw error('Choose a smaller batch.',413);
  const reader=request.body?.getReader();if(!reader)throw error('Missing request.');
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES){await reader.cancel();throw error('Choose a smaller batch.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch{throw error('Invalid request.');}
}
export default {async fetch(request,env){
  const url=new URL(request.url),uid=request.headers.get('oai-authenticated-user-id');
  try{
    if(url.pathname==='/')return new Response(PAGE,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
    if(!uid)return json({error:'Sign in to continue.',signIn:'/signin-with-chatgpt?return_to=/'},401);
    if(!env.BUCKET)return json({error:'Online storage is not connected yet.'},503);
    if(url.pathname==='/mcp'&&request.method==='POST'){
      if(request.headers.has('origin')&&request.headers.get('origin')!==url.origin)throw error('Invalid request origin.',403);
      const rpc=await body(request);let result;
      if(rpc.method==='server/discover')result={supportedVersions:['2026-07-28'],capabilities:{tools:{}}};
      else if(rpc.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'Learning Tree',version:'1.0.0'},instructions:workflow};
      else if(rpc.method==='notifications/initialized')return new Response(null,{status:202});
      else if(rpc.method==='tools/list')result={tools};
      else if(rpc.method==='tools/call'){try{const data=await toolCall(env,uid,rpc.params?.name,rpc.params?.arguments);result={content:[{type:'text',text:JSON.stringify(data)}]};}catch(e){result={isError:true,content:[{type:'text',text:e.message}]};}}
      else return json({jsonrpc:'2.0',id:rpc.id??null,error:{code:-32601,message:'Method not found'}});
      return json({jsonrpc:'2.0',id:rpc.id??null,result});
    }
    if(!url.pathname.startsWith('/api/'))return json({error:'Not found.'},404);
    if(request.method!=='GET'&&request.headers.get('origin')!==url.origin)throw error('Open Learning Tree to perform this action.',403);
    if(url.pathname==='/api/me')return json({email:request.headers.get('oai-authenticated-user-email')||'',signedIn:true});
    if(url.pathname==='/api/jobs'){
      if(request.method==='GET')return json({jobs:await listJobs(env,uid)});
      if(request.method==='POST')return json(await createJob(env,uid,await body(request)),201);
    }
    const match=url.pathname.match(/^\/api\/jobs\/([a-f0-9-]{36})(?:\/(records|tree|stop))?$/);
    if(!match)return json({error:'Not found.'},404);
    const {job,key}=await readJob(env,uid,match[1]);
    if(request.method==='GET'&&match[2]==='records'){
      const saved=await Promise.all(job.queue.map(async id=>object(env,await recordKey(key,id))));
      const records=saved.filter(Boolean);return json({treeKey:job.treeKey,records,next:records.length,job:await progress(env,job,key)});
    }
    if(request.method==='GET'&&match[2]==='tree'){
      const tree=JSON.parse(JSON.stringify(job.snapshot));
      for(const node of tree.nodes){const record=await object(env,await recordKey(key,node.id));if(record)node.content=record.content;}
      return json(tree);
    }
    if(request.method==='DELETE'&&!match[2]){const entries=await env.BUCKET.list({prefix:key,limit:1000});await env.BUCKET.delete(entries.objects.map(item=>item.key));return json({removed:true});}
    if(request.method==='POST'&&match[2]==='stop'){await env.BUCKET.put(key+'cancelled','true');return json({stopped:true});}
    if(request.method==='GET'&&!match[2])return json(await progress(env,job,key));
    return json({error:'Not found.'},404);
  }catch(e){return json({error:e.message||'Could not complete this action.'},e.status||400);}
}};
