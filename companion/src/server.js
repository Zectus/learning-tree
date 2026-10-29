import express from 'express';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Storage } from './storage.js';
import { ChatGPT } from './chatgpt.js';
import { Claude } from './claude.js';
import { Jobs } from './jobs.js';

const ROOT = resolve(fileURLToPath(new URL('../../', import.meta.url)));
export async function createCompanion({ directory, port = 8765, providers, storage = new Storage(directory) }) {
  await storage.init();
  const engines = providers || { chatgpt: new ChatGPT({ storage }), claude: new Claude({ directory }) };
  for (const provider of Object.values(engines)) await provider.init?.();
  const jobs = new Jobs({ storage, providers: engines }); await jobs.init();
  const app = express(); app.disable('x-powered-by');
  let origin = `http://127.0.0.1:${port}`, authMessage = '', authError = false;
  app.use((req, res, next) => {
    // Do not accept LAN exposure, proxy headers, or DNS-rebinding hosts.
    if (req.headers.host !== new URL(origin).host) return res.status(403).json({ error: 'Use the companion at ' + origin });
    res.set('Referrer-Policy', 'no-referrer'); res.set('X-Content-Type-Options', 'nosniff'); res.set('X-Frame-Options', 'DENY');
    if (req.path.startsWith('/companion/api/')) {
      res.set('Cache-Control', 'no-store');
      if (req.get('X-Learning-Tree-Companion') !== '1' || (req.get('Origin') && req.get('Origin') !== origin) || req.get('Sec-Fetch-Site') === 'cross-site') return res.status(403).json({ error: 'Open the local Learning Tree app to control generation.' });
    }
    next();
  });
  app.use(express.json({ limit: '32mb' }));
  app.get('/companion/api/status', async (_req, res) => {
    const [chatgpt, claude] = await Promise.all([engines.chatgpt.status(), engines.claude.status()]);
    res.json({ service: 'learning-tree-companion', version: 1, chatgpt, claude, authMessage, authError });
  });
  app.post('/companion/api/chatgpt/connect', async (req, res) => {
    if (jobs.active) throw new Error('Pause the running job before switching accounts.');
    authMessage = ''; authError = false;
    res.json({ url: await engines.chatgpt.authorize(origin, req.body?.account || (req.body?.addAccount === true ? true : null)) });
  });
  app.post('/companion/api/chatgpt/disconnect', async (_req, res) => {
    if (jobs.active && jobs.get(jobs.active.id).provider === 'chatgpt') await jobs.pause(jobs.active.id);
    const result = await engines.chatgpt.disconnect(); authMessage = ''; authError = false; res.json({ ok: true, ...result });
  });
  app.get('/auth/callback', async (req, res) => {
    res.set('Cache-Control', 'no-store');
    try { await engines.chatgpt.callback(new URL(req.originalUrl, origin).searchParams); authMessage = 'ChatGPT connected.'; authError = false; }
    catch (error) { authMessage = error.message; authError = true; }
    // Fixed content only; neither codes nor provider errors are reflected into HTML.
    res.type('html').send('<!doctype html><html><meta charset="utf-8"><title>Learning Tree sign-in</title><body><p>Return to Learning Tree to see your connection status.</p><a href="/">Open Learning Tree</a><script>if(window.opener){window.opener.postMessage({type:"learning-tree-auth-complete"},location.origin);window.close()}</script></body></html>');
  });
  app.get('/companion/api/models/:provider', async (req, res) => {
    const provider = Object.hasOwn(engines, req.params.provider) && engines[req.params.provider];
    if (!provider) return res.status(404).json({ error: 'Provider not found.' });
    res.json({ models: await provider.models() });
  });
  app.get('/companion/api/jobs', (_req, res) => res.json({ jobs: jobs.list() }));
  app.post('/companion/api/jobs', async (req, res) => {
    const engine = Object.hasOwn(engines, req.body?.provider) && engines[req.body.provider];
    if (!engine) throw new Error('Choose ChatGPT or Claude.');
    const account = await engine.status();
    if (!account.connected) throw new Error('Connect your subscription first.');
    res.status(201).json(await jobs.create({ ...req.body, account: account.accountKey || account.email, accountLabel: account.email || '' }));
  });
  app.get('/companion/api/jobs/:id', (req, res) => res.json(jobs.summary(jobs.get(req.params.id))));
  app.get('/companion/api/jobs/:id/tree', (req, res) => {
    const job = jobs.get(req.params.id), tree = JSON.parse(JSON.stringify(job.snapshot || job.tree));
    const records = new Map(job.records.map(record => [record.id, record.content]));
    for (const node of tree.nodes) if (records.has(node.id)) node.content = records.get(node.id);
    res.json(tree);
  });
  app.get('/companion/api/jobs/:id/records', (req, res) => {
    const job = jobs.get(req.params.id);
    const after = Math.max(0, Math.floor(Number(req.query.after) || 0));
    res.json({ treeKey: job.treeKey, records: job.records.slice(after), next: job.records.length, job: jobs.summary(job) });
  });
  app.get('/companion/api/jobs/:id/export', (req, res) => {
    const job = jobs.get(req.params.id);
    res.set('Content-Disposition', `attachment; filename="learning-tree-${job.id}.jsonl"`);
    res.type('text/plain').send(job.records.map(record => JSON.stringify(record)).join('\n') + '\n');
  });
  app.post('/companion/api/jobs/:id/start', async (req, res) => res.json(await jobs.start(req.params.id)));
  app.post('/companion/api/jobs/:id/pause', async (req, res) => res.json(await jobs.pause(req.params.id)));
  app.delete('/companion/api/jobs/:id', async (req, res) => { await jobs.remove(req.params.id); res.json({ ok: true }); });
  app.get('/companion/setup', (_req, res) => res.type('text/plain').sendFile(join(ROOT, 'docs/assistant-setup.md')));
  app.get('/', (_req, res) => res.sendFile(join(ROOT, 'index.html')));
  // Explicit static allowlist: never expose .git, credentials, local jobs,
  // dependencies, source server files, or arbitrary user-selected paths.
  for (const directory of ['css', 'js', 'assets', 'examples']) app.use('/' + directory, express.static(join(ROOT, directory), { dotfiles: 'deny', index: false }));
  app.use((_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    res.status(error.type === 'entity.too.large' ? 413 : 400).json({ error: error.type === 'entity.too.large' ? 'Choose a smaller generation batch.' : error instanceof SyntaxError ? 'Invalid JSON request.' : error.message || 'The companion could not complete this action.' });
  });
  return { app, jobs, storage, providers: engines,
    async listen() {
      const server = await new Promise((resolve, reject) => { const server = app.listen(port, '127.0.0.1', () => resolve(server)); server.on('error', reject); });
      origin = `http://127.0.0.1:${server.address().port}`;
      return { server, origin };
    } };
}
