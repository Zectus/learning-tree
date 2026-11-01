const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {loadApp}=require('../../../test/harness');
const root=__dirname;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const cases=JSON.parse(fs.readFileSync(path.join(root,'cases.json')));
const rubric=fs.readFileSync(path.join(root,'rubric.txt'),'utf8');
const completed=new Set(JSON.parse(fs.readFileSync(path.join(root,'author-completions.json'))));
const previous=new Map((fs.existsSync(path.join(root,'output-audit.json'))?JSON.parse(fs.readFileSync(path.join(root,'output-audit.json'))):[]).map(a=>[a.id,a]));
const sha=text=>createHash('sha256').update(text).digest('hex');
const app=loadApp();
const audit=[];
try {
for(const task of manifest.tasks){
 const dir=path.join(root,'generation',task.id),file=path.join(dir,'tree.json');
 if(!completed.has(task.id)){audit.push({id:task.id,status:'pending'});continue;}
 if(!fs.existsSync(file)){audit.push({id:task.id,status:fs.existsSync(path.join(dir,'question.txt'))?'question':'pending'});continue;}
 const raw=fs.readFileSync(file,'utf8');
 const cached=previous.get(task.id);
 if(cached?.status==='complete'&&cached.sha256===sha(raw)&&fs.existsSync(path.join(dir,'imported-tree.json'))){audit.push(cached);continue;}
 try {
 const tree=JSON.parse(raw),ids=new Set();
 if(!Array.isArray(tree.nodes)||!tree.nodes.length)throw Error('missing nodes');
 for(const n of tree.nodes){if(typeof n.id!=='string'||!n.id||ids.has(n.id))throw Error('invalid/duplicate id');ids.add(n.id);if(!n.label?.trim()||!n.explanation?.trim())throw Error('missing label or brief');}
 for(const n of tree.nodes)for(const p of n.requires||[])if(!ids.has(p)||p===n.id)throw Error('invalid prerequisite');
 const byId=new Map(tree.nodes.map(n=>[n.id,n])),visiting=new Set(),done=new Set();
 const visit=id=>{if(visiting.has(id))throw Error('cycle');if(done.has(id))return;visiting.add(id);for(const p of byId.get(id).requires||[])visit(p);visiting.delete(id);done.add(id);};
 tree.nodes.forEach(n=>visit(n.id));
 app.window.__tree=raw;
 if(!app.ev('loadFromJSON(JSON.parse(__tree))'))throw Error('app import rejected tree');
 const imported=JSON.parse(app.ev('JSON.stringify(buildTreeJSON(false))'));
 fs.writeFileSync(path.join(dir,'imported-tree.json'),JSON.stringify(imported,null,2)+'\n');
 audit.push({id:task.id,status:'complete',sha256:sha(raw),nodes:tree.nodes.length,roots:tree.nodes.filter(n=>!n.requires?.length).length,brief_characters:tree.nodes.reduce((s,n)=>s+n.explanation.length,0),raw_edges:tree.nodes.reduce((s,n)=>s+(n.requires||[]).length,0),imported_edges:imported.nodes.reduce((s,n)=>s+(n.requires||[]).length,0)});
 }catch(error){audit.push({id:task.id,status:'invalid',error:error.message});}
}
}finally{app.window.close();}
fs.writeFileSync(path.join(root,'output-audit.json'),JSON.stringify(audit,null,2)+'\n');
const assignments=[];
// Opaque labels and a half-rotation put each condition in every position.
const permutations={calculus:[2,0,3,1],http:[1,3,0,2],diagnostic:[3,1,2,0],policy:[0,2,1,3]};
for(const c of cases){
 const tasks=manifest.tasks.filter(t=>t.case===c.id);
 if(!tasks.every(t=>audit.find(a=>a.id===t.id)?.status==='complete'))continue;
 const labels=['K','M','R','T'];
 const labeled=permutations[c.id].map((ix,i)=>({label:labels[i],task:tasks[ix]}));
 for(let reader=1;reader<=2;reader++){
 const dir=path.join(root,'review',`${c.id}_${reader}`);fs.mkdirSync(dir,{recursive:true});
 const order=reader===1?labeled:[...labeled.slice(2),...labeled.slice(0,2)];
 const packet={destination:c.destination,calibration:c.calibration,source:c.source||null,trees:order.map(x=>({label:x.label,tree:JSON.parse(fs.readFileSync(path.join(root,'generation',x.task.id,'imported-tree.json')))}))};
 fs.writeFileSync(path.join(dir,'packet.json'),JSON.stringify(packet,null,2)+'\n');
 fs.writeFileSync(path.join(dir,'instructions.txt'),rubric+'\nSave report.json in this review directory. Suggested shape: {trees:[{label,scores:{correctness_and_destination,prerequisite_sufficiency,teachable_scope_and_progression,lesson_handoff},assessment,findings:[{severity,node_ids,evidence,repair}]}],ranking,comparison,confidence,counterevidence}.\n');
 assignments.push({id:`${c.id}_${reader}`,case:c.id,order:order.map(x=>x.label),mapping:Object.fromEntries(labeled.map(x=>[x.label,x.task.id])),packet_sha256:sha(fs.readFileSync(path.join(dir,'packet.json')))});
 }
}
fs.writeFileSync(path.join(root,'review-assignments.json'),JSON.stringify(assignments,null,2)+'\n');
console.log(JSON.stringify({authors:audit,review_packets:assignments.map(x=>x.id)},null,2));
