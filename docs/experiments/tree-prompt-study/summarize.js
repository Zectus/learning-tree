const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const root=__dirname;
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json')));
const assignments=JSON.parse(fs.readFileSync(path.join(root,'review-assignments.json')));
const audit=JSON.parse(fs.readFileSync(path.join(root,'output-audit.json')));
const criteria=['correctness_and_destination','prerequisite_sufficiency','teachable_scope_and_progression','lesson_handoff'];
const mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length;
const tasks=new Map(manifest.tasks.map(t=>[t.id,t]));
const ratings=[],reports=[];
for(const assignment of assignments){
 const file=path.join(root,'review',assignment.id,'report.json');
 if(!fs.existsSync(file))continue;
 const raw=fs.readFileSync(file,'utf8');const report=JSON.parse(raw);
 if(!Array.isArray(report.trees)||report.trees.length!==4)throw Error(`${assignment.id}: expected four tree assessments`);
 const labels=new Set();
 for(const tree of report.trees){
  if(!assignment.mapping[tree.label]||labels.has(tree.label))throw Error(`${assignment.id}: unknown/duplicate label ${tree.label}`);labels.add(tree.label);
  for(const c of criteria)if(!Number.isInteger(tree.scores[c])||tree.scores[c]<1||tree.scores[c]>5)throw Error(`${assignment.id} ${tree.label}: invalid ${c}`);
  const id=assignment.mapping[tree.label],task=tasks.get(id);
  ratings.push({reviewer:assignment.id,label:tree.label,task:id,case:task.case,condition:task.condition,replicate:task.replicate,scores:tree.scores,overall:mean(criteria.map(c=>tree.scores[c])),assessment:tree.assessment,findings:tree.findings||[]});
 }
 reports.push({id:assignment.id,sha256:createHash('sha256').update(raw).digest('hex'),ranking:report.ranking,comparison:report.comparison,confidence:report.confidence,counterevidence:report.counterevidence});
}
const caseIds=[...new Set(manifest.tasks.map(t=>t.case))];
const byCase=caseIds.map(id=>{
 const values=ratings.filter(r=>r.case===id);
 const conditions=Object.fromEntries(['baseline','rebuilt'].map(condition=>{
  const selected=values.filter(r=>r.condition===condition);
  const outputs=manifest.tasks.filter(t=>t.case===id&&t.condition===condition).map(t=>{
   const rs=selected.filter(r=>r.task===t.id),a=audit.find(x=>x.id===t.id);
   return {task:t.id,replicate:t.replicate,nodes:a?.nodes,brief_characters:a?.brief_characters,ratings:rs.length,mean:rs.length?mean(rs.map(r=>r.overall)):null};
  });
  return [condition,{ratings:selected.length,overall:selected.length?mean(selected.map(r=>r.overall)):null,criteria:Object.fromEntries(criteria.map(c=>[c,selected.length?mean(selected.map(r=>r.scores[c])):null])),outputs}];
 }));
 const reviewerPreferences=reports.filter(r=>r.id.startsWith(id+'_')).map(report=>{
 const xs=values.filter(r=>r.reviewer===report.id);
 const b=mean(xs.filter(r=>r.condition==='baseline').map(r=>r.overall)),n=mean(xs.filter(r=>r.condition==='rebuilt').map(r=>r.overall));
 return {reviewer:report.id,baseline:b,rebuilt:n,preference:b===n?'tie':b>n?'baseline':'rebuilt'};
 });
 return {case:id,conditions,reviewer_score_preferences:reviewerPreferences};
});
const complete=reports.length===8&&audit.filter(x=>x.status==='complete').length===16;
const aggregate=complete?Object.fromEntries(['baseline','rebuilt'].map(condition=>[condition,{overall:mean(byCase.map(c=>c.conditions[condition].overall)),criteria:Object.fromEntries(criteria.map(k=>[k,mean(byCase.map(c=>c.conditions[condition].criteria[k]))]))}])):null;
const output={complete,authors_completed:audit.filter(x=>x.status==='complete').length,reviewers_completed:reports.length,tree_ratings:ratings.length,aggregate,by_case:byCase,reports,ratings};
fs.writeFileSync(path.join(root,'results.json'),JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify({complete:output.complete,authors_completed:output.authors_completed,reviewers_completed:output.reviewers_completed,tree_ratings:output.tree_ratings,aggregate,by_case:byCase},null,2));
