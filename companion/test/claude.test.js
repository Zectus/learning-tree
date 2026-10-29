import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { Claude, subscriptionEnvironment } from '../src/claude.js';
import { fixture, lesson } from './helpers.js';

function fakeSpawn(results, calls) {
  return (command,args,options)=>{
    calls.push({command,args,options,input:''});const call=calls.at(-1),child=new EventEmitter();
    child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{};
    child.stdin.on('data',data=>call.input+=data);
    child.stdin.on('finish',()=>{const result=results.shift();child.stdout.end(JSON.stringify(result));setImmediate(()=>child.emit('close',0))});return child;
  };
}
test('Claude uses the signed-in CLI with no tools, shell, shared MCPs, hooks, or API credentials',async()=>{
 const f=await fixture(),calls=[];
 const claude=new Claude({directory:f.directory,spawnImpl:fakeSpawn([{loggedIn:true,authMethod:'claude.ai',email:'reader'},{type:'result',subtype:'success',result:lesson}],calls)});
 try{
  await claude.init();assert.equal(await claude.generate({prompt:'Teach a node',model:'opus',effort:'high'}),lesson);
  const generation=calls[1];assert.equal(generation.command,'claude');assert.equal(generation.options.shell,false);assert.equal(generation.input,'Teach a node');
  assert.equal(generation.args[generation.args.indexOf('--tools')+1],'');assert.ok(generation.args.includes('--no-session-persistence'));assert.ok(generation.args.includes('--strict-mcp-config'));assert.ok(!generation.args.includes('--bare'));
  const env=subscriptionEnvironment({PATH:'/bin',ANTHROPIC_API_KEY:'secret',ANTHROPIC_AUTH_TOKEN:'secret',CLAUDE_CODE_USE_BEDROCK:'1',CLAUDE_CODE_OAUTH_TOKEN:'secret'});assert.deepEqual(env,{PATH:'/bin'});
 }finally{await f.cleanup()}
});
test('Claude refuses Console/API billing instead of silently using it',async()=>{
 const f=await fixture(),calls=[];const claude=new Claude({directory:f.directory,spawnImpl:fakeSpawn([{loggedIn:true,authMethod:'api_key'}],calls)});
 try{await claude.init();await assert.rejects(claude.generate({prompt:'Teach',model:'opus'}),/subscription/);assert.equal(calls.length,1)}finally{await f.cleanup()}
});
