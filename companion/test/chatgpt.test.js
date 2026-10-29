import test from 'node:test';
import assert from 'node:assert/strict';
import { ChatGPT, readSSE } from '../src/chatgpt.js';
import { fixture } from './helpers.js';

const tokens = { access_token:'private-access', refresh_token:'private-refresh', id_token:'identity', token_type:'Bearer', expires_in:3600, scope:'openid resource.invoke chatgpt.tokens.use.direct offline_access' };
function sse(events, close = true) {
  const text = events.map(event => 'data: ' + JSON.stringify(event) + '\r\n\r\n').join('');
  return new ReadableStream({ start(controller) { for (const char of text) controller.enqueue(new TextEncoder().encode(char)); if (close) controller.close(); } });
}

test('sign-in uses first-party OSS registration, state, nonce, PKCE, the issued client and the exact loopback URI', async () => {
  const f = await fixture(); let request, nonce;
  const gpt = new ChatGPT({ storage:f.storage, fetchImpl:async (url, options) => { request = {url,options}; return Response.json(tokens); }, verifyIdentity:async (_token,audience) => { assert.equal(audience,'issued-client'); return {sub:'person',email:'reader@example.com',nonce}; } });
  try {
    await gpt.init(); const host = gpt.hostId;
    const url = new URL(await gpt.authorize('http://127.0.0.1:8765'));
    assert.equal(url.origin,'https://auth.openai.com'); assert.equal(url.searchParams.get('client_id'),'dynamic_agent_client');
    assert.equal(url.searchParams.get('code_challenge_method'),'S256'); assert.equal(url.searchParams.get('ext_agent_host_id'),host);
    nonce = url.searchParams.get('nonce');
    await assert.rejects(gpt.callback(new URLSearchParams({state:'wrong',code:'bad',client_id:'issued-client'})), /expired|match/);
    await gpt.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'code',client_id:'issued-client'}));
    const form = request.options.body;
    assert.equal(form.get('client_id'),'issued-client'); assert.equal(form.get('redirect_uri'),'http://127.0.0.1:8765/auth/callback');
    assert.equal(form.get('resource'),'https://api.openai.com/v1'); assert.ok(form.get('code_verifier'));
    const status = await gpt.status(); assert.equal(status.connected,true); assert.equal(status.email,'reader@example.com'); assert.ok(!JSON.stringify(status).includes('private-'));
    await assert.rejects(gpt.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'code',client_id:'issued-client'})), /expired|match/);
    const again = new URL(await gpt.authorize('http://127.0.0.1:9000'));
    assert.equal(again.searchParams.get('client_id'),'issued-client'); assert.equal(again.searchParams.get('ext_agent_host_id'),host);
    assert.equal(again.searchParams.get('agent_name_hint'),null);
    const second = new ChatGPT({storage:f.storage}); await second.init(); assert.equal(second.hostId,host);
  } finally { await f.cleanup(); }
});

test('declined permission and nonce/client mismatches do not replace a saved account', async () => {
  const f = await fixture();
  const gpt = new ChatGPT({ storage:f.storage, fetchImpl:async()=>Response.json(tokens), verifyIdentity:async()=>({sub:'person',nonce:'wrong'}) });
  try {
    await gpt.init(); await f.storage.write('chatgpt.json',{...tokens,subject:'original',client_id:'original-client',scopes:['chatgpt.tokens.use.direct']});
    let url = new URL(await gpt.authorize('http://127.0.0.1:8765'));
    await assert.rejects(gpt.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'code',client_id:'different'})), /registration/);
    url = new URL(await gpt.authorize('http://127.0.0.1:8765',true));
    await assert.rejects(gpt.callback(new URLSearchParams({state:url.searchParams.get('state'),code:'code',client_id:'issued'})), /identity/);
    assert.equal((await f.storage.read('chatgpt.json')).subject,'original');
    url = new URL(await gpt.authorize('http://127.0.0.1:8765',true));
    await assert.rejects(gpt.callback(new URLSearchParams({state:url.searchParams.get('state'),error:'access_denied'})), /declined/);
    assert.equal((await f.storage.read('chatgpt.json')).subject,'original');
  } finally { await f.cleanup(); }
});

test('concurrent token refreshes are serialized and rotation is persisted atomically', async () => {
  const f = await fixture(); let calls=0;
  const gpt = new ChatGPT({storage:f.storage,verifyIdentity:async()=>({sub:'person'}),fetchImpl:async()=>{calls++;return Response.json({...tokens,access_token:'renewed',refresh_token:'rotated'})}});
  try {
    await f.storage.write('chatgpt.json',{...tokens,subject:'person',client_id:'client',scopes:tokens.scope.split(' '),expires_at:0});
    assert.deepEqual(await Promise.all([gpt.accessToken(),gpt.accessToken(),gpt.accessToken()]),['renewed','renewed','renewed']);
    assert.equal(calls,1);assert.equal((await f.storage.read('chatgpt.json')).refresh_token,'rotated');
    await gpt.disconnect();assert.equal((await gpt.status()).connected,false);
  } finally {await f.cleanup()}
});

test('SSE parsing handles split CRLF and generation requires completed inference without API billing fallback', async()=>{
  const f=await fixture(); let body;
  const gpt=new ChatGPT({storage:f.storage,fetchImpl:async(_url,options)=>{body=JSON.parse(options.body);return new Response(sse([{type:'response.output_text.delta',delta:'lesson'},{type:'response.completed',response:{output:[]}}]))}});
  try {
    await f.storage.write('chatgpt.json',{...tokens,scopes:tokens.scope.split(' '),expires_at:Date.now()+3600000});
    const content=await gpt.generate({prompt:'teach',model:'available-model',effort:'high'});assert.equal(content,'lesson');assert.equal(body.store,false);assert.equal(body.stream,true);assert.equal(body.model,'available-model');assert.equal(body.reasoning.effort,'high');
    for(const unsupported of ['background','max_output_tokens','previous_response_id','temperature','tools'])assert.equal(body[unsupported],undefined);
    gpt.fetch=async()=>new Response(sse([{type:'response.output_text.delta',delta:'unfinished'}]));
    await assert.rejects(gpt.generate({prompt:'teach',model:'available-model'}),/before ChatGPT finished/);
    gpt.fetch=async()=>new Response('',{status:429});await assert.rejects(gpt.generate({prompt:'teach',model:'available-model'}),/usage limit/);
  }finally{await f.cleanup()}
});

test('disconnect revokes at the trusted advertised endpoint and preserves the token-free registration for resume',async()=>{
  const f=await fixture();const calls=[];
  const gpt=new ChatGPT({storage:f.storage,fetchImpl:async(url,options)=>{calls.push({url,options});return options?.method==='POST'?new Response(null,{status:200}):Response.json({issuer:'https://auth.openai.com',revocation_endpoint:'https://auth.openai.com/revoke'})}});
  try{
    await gpt.init();await f.storage.write('chatgpt.json',{...tokens,subject:'person',email:'reader',client_id:'issued-client',scopes:tokens.scope.split(' ')});
    const key=(await gpt.status()).accountKey;
    assert.deepEqual(await gpt.disconnect(),{revoked:true});assert.equal((await gpt.status()).connected,false);
    const form=calls[1].options.body;assert.equal(form.get('token'),tokens.refresh_token);assert.equal(form.get('client_id'),'issued-client');assert.equal(form.get('token_type_hint'),'refresh_token');
    const registered=await f.storage.read('registrations.json');assert.equal(registered[0].client_id,'issued-client');assert.equal(registered[0].access_token,undefined);
    const url=new URL(await gpt.authorize('http://127.0.0.1:8765',key));assert.equal(url.searchParams.get('client_id'),'issued-client');assert.equal(url.searchParams.get('id_token_hint'),null);
  }finally{await f.cleanup()}
});

test('revocation cannot send tokens to a foreign endpoint, and generation cannot borrow a switched account token',async()=>{
  const f=await fixture();let calls=0;
  const gpt=new ChatGPT({storage:f.storage,fetchImpl:async()=>{calls++;return Response.json({issuer:'https://auth.openai.com',revocation_endpoint:'https://evil.example/revoke'})}});
  try{
    await f.storage.write('chatgpt.json',{...tokens,subject:'person',client_id:'client',scopes:tokens.scope.split(' '),expires_at:Date.now()+3600000});
    await assert.rejects(gpt.accessToken('another-account'),/subscription account/);
    assert.deepEqual(await gpt.disconnect(),{revoked:false});assert.equal(calls,1);assert.equal((await gpt.status()).connected,false);
  }finally{await f.cleanup()}
});
