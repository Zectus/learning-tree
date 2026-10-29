import { randomBytes, randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export const OPENAI_ISSUER = 'https://auth.openai.com';
export const OPENAI_RESOURCE = 'https://api.openai.com/v1';
const accountKey = account => createHash('sha256').update(account.subject + ':' + account.client_id).digest('hex');
const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export class ChatGPT {
  constructor({ storage, fetchImpl = fetch, verifyIdentity, now = () => Date.now() }) {
    Object.assign(this, { storage, fetch: fetchImpl, now });
    this.verifyIdentity = verifyIdentity || (async (token, audience) => {
      // Discover only from the fixed trusted issuer, never callback-provided URLs.
      if (!this.jwks) {
        const metadata = await this.configuration();
        const uri = new URL(metadata.jwks_uri);
        if (uri.origin !== OPENAI_ISSUER) throw new Error('Unexpected ChatGPT identity configuration.');
        this.jwks = createRemoteJWKSet(uri);
      }
      return (await jwtVerify(token, this.jwks, { issuer: OPENAI_ISSUER, audience, algorithms: ['RS256', 'ES256'] })).payload;
    });
    this.pending = new Map(); this.epoch = 0;
  }
  async init() {
    let host = await this.storage.read('host.json');
    if (!host) { host = { id: 'urn:uuid:' + randomUUID() }; await this.storage.write('host.json', host); }
    this.hostId = host.id;
  }
  async configuration() {
    if (this.metadata) return this.metadata;
    const response = await this.fetch(`${OPENAI_ISSUER}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error('Could not load ChatGPT sign-in configuration.');
    const metadata = await response.json();
    if (metadata.issuer !== OPENAI_ISSUER) throw new Error('Unexpected ChatGPT identity configuration.');
    this.metadata = metadata; return metadata;
  }
  async registrations() {
    const saved = await this.storage.read('registrations.json', []);
    const active = await this.storage.read('chatgpt.json');
    if (active && !saved.some(item => item.client_id === active.client_id)) saved.push({ client_id: active.client_id, subject: active.subject, email: active.email });
    return saved;
  }
  async status() {
    const account = await this.storage.read('chatgpt.json');
    return { connected: !!account, email: account?.email || '', subject: account?.subject || '',
      accountKey: account ? accountKey(account) : '', planUsage: !!account?.scopes?.includes('chatgpt.tokens.use.direct'),
      registrations: (await this.registrations()).map(item => ({ key: accountKey(item), email: item.email || '', registration: item.client_id.slice(-8) })) };
  }
  async authorize(origin, selected = null) {
    for (const [key, value] of this.pending) if (value.expires <= this.now()) this.pending.delete(key);
    if (this.pending.size >= 5) throw new Error('Finish or cancel the existing sign-in attempts first.');
    const active = await this.storage.read('chatgpt.json');
    const registrations = await this.registrations();
    const account = selected === true || selected === 'new' ? null : selected
      ? (active && accountKey(active) === selected ? active : registrations.find(item => accountKey(item) === selected))
      : active || registrations.at(-1) || null;
    if (selected && selected !== true && selected !== 'new' && !account) throw new Error('Choose a saved ChatGPT account or add a new one.');
    const state = randomBytes(32).toString('base64url'), nonce = randomBytes(32).toString('base64url'), verifier = randomBytes(48).toString('base64url');
    const redirect = origin + '/auth/callback';
    this.pending.set(state, { nonce, verifier, redirect, account, epoch: this.epoch, expires: this.now() + 10 * 60 * 1000 });
    const url = new URL(`${OPENAI_ISSUER}/api/accounts/authorize`);
    const values = { client_id: account?.client_id || 'dynamic_agent_client', ext_agent_host_id: this.hostId,
      response_type: 'code', redirect_uri: redirect, scope: SCOPES, resource: OPENAI_RESOURCE,
      state, nonce, code_challenge_method: 'S256', code_challenge: createHash('sha256').update(verifier).digest('base64url') };
    if (!account) values.agent_name_hint = 'Learning Tree';
    else if (account.id_token) values.id_token_hint = account.id_token;
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value);
    return url.href;
  }
  async callback(params) {
    const state = params.get('state'), attempt = this.pending.get(state);
    if (!attempt || attempt.expires <= this.now()) throw new Error('Sign-in expired or does not match this browser. Start again.');
    this.pending.delete(state); // Single use, including declined/failed attempts.
    if (params.has('error')) throw new Error('ChatGPT sign-in was declined or could not be completed. Your existing connection was kept.');
    const clientId = params.get('client_id') || attempt.account?.client_id;
    if (!clientId || clientId === 'dynamic_agent_client' || (attempt.account && clientId !== attempt.account.client_id) || !params.get('code')) throw new Error('ChatGPT did not return the expected client registration.');
    const tokens = await this.tokenRequest({ grant_type: 'authorization_code', client_id: clientId,
      code: params.get('code'), code_verifier: attempt.verifier, redirect_uri: attempt.redirect, resource: OPENAI_RESOURCE });
    const identity = await this.verifyIdentity(tokens.id_token, clientId);
    if (!identity.sub || !equal(identity.nonce, attempt.nonce) || (attempt.account && identity.sub !== attempt.account.subject)) throw new Error('ChatGPT identity did not match the sign-in request.');
    const scopes = String(tokens.scope || '').split(/\s+/).filter(Boolean);
    if (!scopes.includes('chatgpt.tokens.use.direct') || !scopes.includes('resource.invoke')) throw new Error('ChatGPT plan usage was not granted. Enable plan usage during sign-in, then try again.');
    if (!tokens.access_token || !tokens.refresh_token || tokens.token_type?.toLowerCase() !== 'bearer') throw new Error('ChatGPT did not return a renewable subscription connection.');
    await this.storage.exclusive(async () => {
      if (attempt.epoch !== this.epoch) throw new Error('This sign-in was cancelled. Start again.');
      const registrations = await this.registrations();
      if (!registrations.some(item => item.client_id === clientId)) {
        registrations.push({client_id: clientId, subject: identity.sub, email: identity.email || ''});
        await this.storage.write('registrations.json', registrations);
      }
      await this.storage.write('chatgpt.json', { ...tokens, scopes, client_id: clientId, subject: identity.sub, email: identity.email || '', expires_at: this.now() + Number(tokens.expires_in || 3600) * 1000 });
    });
  }
  async tokenRequest(values) {
    const response = await this.fetch(`${OPENAI_ISSUER}/api/accounts/oauth/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('ChatGPT authorization expired or failed. Sign in again; completed lessons are safe.');
    return response.json();
  }
  async accessToken(expectedAccount) {
    // A shared refresh promise prevents reuse of rotating refresh tokens.
    if (this.refreshing) { await this.refreshing; return this.accessToken(expectedAccount); }
    this.refreshing = this.storage.exclusive(async () => {
      const account = await this.storage.read('chatgpt.json');
      if (expectedAccount && account && accountKey(account) !== expectedAccount) throw new Error('Reconnect the subscription account used to create this job before resuming it.');
      if (!account?.scopes?.includes('chatgpt.tokens.use.direct')) throw new Error('Continue with ChatGPT first and grant ChatGPT plan usage.');
      if (account.expires_at > this.now() + 60000) return account.access_token;
      const tokens = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: account.refresh_token, client_id: account.client_id, resource: OPENAI_RESOURCE });
      const scopes = tokens.scope ? tokens.scope.split(/\s+/) : account.scopes;
      if (!tokens.access_token || !scopes.includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan usage is no longer authorized. Sign in again.');
      if (tokens.id_token) {
        const identity = await this.verifyIdentity(tokens.id_token, account.client_id);
        if (identity.sub !== account.subject) throw new Error('ChatGPT returned a different account during renewal. Sign in again.');
      }
      const renewed = { ...account, ...tokens, scopes, expires_at: this.now() + Number(tokens.expires_in || 3600) * 1000 };
      await this.storage.write('chatgpt.json', renewed);
      return renewed.access_token;
    }).finally(() => { this.refreshing = null; });
    return this.refreshing;
  }
  async disconnect() {
    this.epoch++; this.pending.clear();
    return this.storage.exclusive(async () => {
      const account = await this.storage.read('chatgpt.json'); let revoked = !account;
      if (account) {
        await this.storage.write('registrations.json', await this.registrations());
        try {
          const metadata = await this.configuration(), url = new URL(metadata.revocation_endpoint);
          if (url.origin !== OPENAI_ISSUER) throw new Error('Unexpected revocation endpoint.');
          for (let attempt = 0; attempt < 2; attempt++) {
            const response = await this.fetch(url.href, { method: 'POST', headers: {'Content-Type':'application/x-www-form-urlencoded'},
              body: new URLSearchParams({ token: account.refresh_token, token_type_hint:'refresh_token', client_id: account.client_id }), signal: AbortSignal.timeout(3000) });
            if (response.ok) { revoked = true; break; }
            if (response.status < 500) break;
            await new Promise(resolve => setTimeout(resolve, 250));
          }
        } catch {}
      }
      await this.storage.remove('chatgpt.json');
      return { revoked };
    });
  }
  async models() {
    const response = await this.fetch(`${OPENAI_RESOURCE}/models`, { headers: { Authorization: `Bearer ${await this.accessToken()}` }, signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('Could not load the models available to your ChatGPT subscription. Reconnect and try again.');
    const body = await response.json();
    return (body.models || []).filter(m => m.visibility === 'list' && typeof m.slug === 'string').map(m => ({ id: m.slug, name: m.display_name || m.slug }));
  }
  async generate({ prompt, model, effort, signal, onProgress, account }) {
    const body = { model, instructions: 'Write a complete lesson following the supplied teaching prompt. Return only its plain-text content. No files, tools, or external actions are needed.', input: [{ role: 'user', content: prompt }], store: false, stream: true };
    if (effort && effort !== 'default') body.reasoning = { effort };
    const response = await this.fetch(`${OPENAI_RESOURCE}/responses`, { method: 'POST',
      headers: { Authorization: `Bearer ${await this.accessToken(account)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!response.ok) {
      if (response.status === 429) throw new Error('ChatGPT usage limit reached. Resume this job when your subscription allowance resets.');
      if (response.status === 401 || response.status === 403) throw new Error('ChatGPT rejected the subscription connection. Reconnect and check plan usage permission.');
      throw new Error(`ChatGPT could not generate this lesson (HTTP ${response.status}). Try another available model or resume later.`);
    }
    let text = '', completed = false;
    for await (const event of readSSE(response.body)) {
      if (event.type === 'response.output_text.delta') { text += event.delta || ''; onProgress?.(text.length); }
      if (event.type === 'response.completed') {
        completed = true;
        const finalText = (event.response?.output || []).filter(o => o.type === 'message').flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('');
        if (finalText) text = finalText;
      }
      if (event.type === 'response.failed' || event.type === 'response.incomplete' || event.type === 'error') throw new Error('ChatGPT did not finish this lesson. Resume to try this node again; no partial lesson was saved.');
      if (text.length > 2_000_000) throw new Error('Lesson exceeded the safe output size.');
    }
    if (!completed) throw new Error('Connection ended before ChatGPT finished the lesson. Resume to retry this node.');
    return text;
  }
}

export async function* readSSE(stream) {
  const decoder = new TextDecoder(); let buffer = '';
  for await (const chunk of stream) {
    buffer = (buffer + decoder.decode(chunk, { stream: true })).replace(/\r\n/g, '\n');
    if (buffer.length > 4_000_000) throw new Error('Provider event exceeded the safe size.');
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, split); buffer = buffer.slice(split + 2);
      const data = block.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (data && data !== '[DONE]') yield JSON.parse(data);
    }
  }
}
