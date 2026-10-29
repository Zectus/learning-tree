/* Optional local subscription companion. The normal static site still works
   without it. Provider credentials never enter this browser or Firebase. */
const assistantState = { available: false, status: null, checking: false, busy: false,
  jobs: [], cursors: new Map(), polling: false, timer: null, request: null,
  handoff: null, outgoing: null, incoming: null };
const assistantEl = id => document.getElementById(id);

async function assistantAPI(path, options = {}) {
  const response = await fetch('/companion/api/' + path, {
    ...options, headers: { 'X-Learning-Tree-Companion': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: options.signal || AbortSignal.timeout(20000), cache: 'no-store',
  });
  let data;
  try { data = await response.json(); } catch { throw new Error('The local companion is not available. Start it and open the local app.'); }
  if (!response.ok) throw new Error(data.error || 'The companion could not complete this action.');
  return data;
}
function showAssistantError(error) {
  const el = assistantEl('assistant-error');
  uiText(el, error?.message || '');
  el.classList.toggle('hidden', !error);
}
function updateGenerationMethod() {
  const automatic = assistantEl('generation-method').value === 'automatic';
  assistantEl('assistant-generation-panel').classList.toggle('hidden', !automatic);
  assistantEl('generation-file-help').classList.toggle('hidden', automatic);
  document.querySelectorAll('.generation-file-step').forEach(el => el.classList.toggle('hidden', automatic));
  if (automatic && !assistantState.status && !assistantState.checking) void refreshAssistantConnection();
  refreshAssistantControls();
}
function refreshAssistantControls() {
  const { available, status, busy } = assistantState;
  const automatic = assistantEl('generation-method').value === 'automatic';
  assistantEl('generation-reply-field').classList.toggle('hidden', automatic || (currentGenerationPacket()?.queue.length || 0) <= 1);
  assistantEl('assistant-local-setup').classList.toggle('hidden', available);
  assistantEl('assistant-connected-controls').classList.toggle('hidden', !available);
  if (!available) {
    uiText(assistantEl('assistant-status'), 'Run the local companion to use your subscription here. No API key is needed.');
    return;
  }
  const provider = assistantEl('assistant-provider').value;
  const account = status?.[provider];
  const accounts = assistantEl('assistant-chatgpt-account'), registrations = status?.chatgpt?.registrations || [];
  const signature = JSON.stringify(registrations), oldAccount = accounts.value;
  if (accounts.dataset.catalog !== signature) {
    accounts.replaceChildren();
    for (const registration of registrations) {
      const option = document.createElement('option'); option.value = registration.key;
      option.textContent = `${registration.email || t('Saved account')} · ${registration.registration}`; accounts.appendChild(option);
    }
    const add = document.createElement('option'); add.value = 'new'; uiText(add, 'Add a ChatGPT account'); accounts.appendChild(add);
    accounts.value = [...accounts.options].some(o => o.value === oldAccount) ? oldAccount : status?.chatgpt?.accountKey || 'new';
    accounts.dataset.catalog = signature;
  }
  if (status?.chatgpt?.accountKey && assistantState.lastActiveAccount !== status.chatgpt.accountKey) accounts.value = status.chatgpt.accountKey;
  assistantState.lastActiveAccount = status?.chatgpt?.accountKey || '';
  assistantEl('assistant-account-field').classList.toggle('hidden', provider !== 'chatgpt');

  uiText(assistantEl('assistant-status'), 'Local companion ready. Finished lessons appear in the tree automatically.');
  // Account identities are user content and must not pass through translation.
  userText(assistantEl('assistant-account'), account?.connected ? account.email || t('Subscription connected') : t('Not connected'));
  assistantEl('btn-assistant-connect').classList.toggle('hidden', provider !== 'chatgpt');
  assistantEl('btn-assistant-disconnect').classList.toggle('hidden', provider !== 'chatgpt' || !account?.connected);
  assistantEl('assistant-claude-help').classList.toggle('hidden', provider !== 'claude');
  uiText(assistantEl('btn-assistant-connect'), 'Continue with ChatGPT');
  assistantEl('btn-assistant-connect').disabled = busy || assistantState.checking || assistantState.jobs.some(j => j.status === 'running');
  assistantEl('btn-assistant-disconnect').disabled = busy;
  const target = Number(assistantEl('generation-count').value);
  const packet = currentGenerationPacket();
  const validSelection = !!packet?.queue.length && (generationSelection.mode !== 'manual' || packet.queue.length === target);
  assistantEl('btn-assistant-start').disabled = busy || !account?.connected || !assistantEl('assistant-model').value
    || !validSelection || packet.queue.length > 250 || assistantState.jobs.some(j => j.status === 'running');
}
async function refreshAssistantConnection() {
  if (assistantState.checking) return;
  // Never probe a user's private network from the hosted site. Navigation to
  // the local app is a deliberate click; only it talks to the local service.
  if (location.hostname !== '127.0.0.1' || location.protocol !== 'http:') { refreshAssistantControls(); return; }
  assistantState.checking = true;
  try {
    const status = await assistantAPI('status');
    if (status.service !== 'learning-tree-companion' || status.version !== 1) throw new Error('Unexpected local service.');
    assistantState.available = true; state.assistantAvailable = true; assistantState.status = status;
    if (status.authMessage) showAssistantError(status.authError ? new Error(status.authMessage) : null);
    if (!state.tutorialActive) { await loadAssistantModels(); await pollAssistantJobs(); }
  } catch (error) {
    if (assistantState.available) showAssistantError(error);
  } finally { assistantState.checking = false; refreshAssistantControls(); }
}
async function loadAssistantModels() {
  const select = assistantEl('assistant-model'), provider = assistantEl('assistant-provider').value;
  const old = select.value, account = assistantState.status?.[provider]?.accountKey || assistantState.status?.[provider]?.email;
  select.replaceChildren();
  if (!assistantState.status?.[provider]?.connected) return;
  const data = await assistantAPI('models/' + provider);
  if (provider !== assistantEl('assistant-provider').value || account !== (assistantState.status?.[provider]?.accountKey || assistantState.status?.[provider]?.email)) return;
  if (!data.models.length) throw new Error('No models are available to this subscription account. Check plan usage permission and refresh.');
  for (const model of data.models) {
    const option = document.createElement('option'); option.value = model.id; option.textContent = model.name; select.appendChild(option);
  }
  if ([...select.options].some(o => o.value === old)) select.value = old;
  // Preserve the provider catalog order; do not substitute a cheaper model.
  refreshAssistantControls();
}
function assistantJobPayload() {
  const packet = currentGenerationPacket();
  if (!packet?.queue.length) throw new Error('Select the nodes to generate first.');
  const live = [...state.nodes.keys()];
  const prompts = packet.queue.map(id => {
    const index = packet.tree.nodes.findIndex(n => n.id === id);
    const delivery = uiLanguage === 'es' || state.isSpanish === true
      ? 'Devuelve únicamente el texto completo de la lección. La aplicación lo guardará automáticamente; no crees archivos ni registros JSON y no uses herramientas.'
      : 'Return only the complete plain-text lesson. The application saves it automatically; do not create files or JSON records, and do not use tools.';
    return { id, prompt: buildPrompt(live[index], packet.lessonLanguage, delivery) };
  });
  const signature = JSON.stringify([packet.treeKey, packet.queue, assistantEl('assistant-provider').value, assistantEl('assistant-model').value, assistantEl('assistant-effort').value, packet.lessonLanguage]);
  if (assistantState.request?.signature !== signature) assistantState.request = { signature, id: crypto.randomUUID() };
  return { tree: packet.tree, snapshot: buildTreeJSON(true), treeKey: packet.treeKey, queue: packet.queue, prompts,
    provider: assistantEl('assistant-provider').value, model: assistantEl('assistant-model').value,
    effort: assistantEl('assistant-effort').value, requestId: assistantState.request.id };
}
async function startAssistantGeneration() {
  if (assistantState.busy || assistantEl('btn-assistant-start').disabled || state.tutorialActive) return;
  assistantState.busy = true; showAssistantError(null); refreshAssistantControls();
  try {
    const job = await assistantAPI('jobs', { method: 'POST', body: JSON.stringify(assistantJobPayload()) });
    await assistantAPI(`jobs/${job.id}/start`, { method: 'POST' });
    assistantState.request = null;
    await pollAssistantJobs();
  } catch (error) { showAssistantError(error); }
  finally { assistantState.busy = false; refreshAssistantControls(); }
}
function collectAssistantRecords(data) {
  if (state.tutorialActive || !data.records?.length) return false;
  const tree = buildTreeJSON(false);
  if (!tree || generationTreeKey(tree) !== data.treeKey) return false;
  const result = mergeGenerationOutput(data.records.map(record => JSON.stringify(record)).join('\n'));
  if (result.rejected) showAssistantError(new Error(result.issues.join(' ')));
  if (result.imported) {
    finishGenerationImport(result, 'Local companion');
    updateAllStatuses();
    showToast(`${result.imported} lessons added from the local companion.`, 3500);
  }
  if (assistantState.handoff?.opener && !assistantState.handoff.opener.closed) {
    const { opener, origin, nonce } = assistantState.handoff;
    opener.postMessage({ type: 'learning-tree-companion-records', nonce, treeKey: data.treeKey, records: data.records }, origin);
  }
  return !result.rejected;
}
async function pollAssistantJobs() {
  if (!assistantState.available || assistantState.polling) return;
  assistantState.polling = true; clearTimeout(assistantState.timer);
  try {
    const data = await assistantAPI('jobs');
    assistantState.jobs = data.jobs;
    const tree = buildTreeJSON(false), key = tree && generationTreeKey(tree);
    for (const job of data.jobs) {
      if (job.treeKey !== key || state.tutorialActive) continue;
      const after = assistantState.cursors.get(job.id) || 0;
      if (job.completed <= after) continue;
      const records = await assistantAPI(`jobs/${job.id}/records?after=${after}`);
      if (collectAssistantRecords(records)) assistantState.cursors.set(job.id, records.next);
    }
    renderAssistantJobs(); refreshAssistantControls();
  } catch (error) { showAssistantError(error); }
  finally {
    assistantState.polling = false;
    assistantState.timer = setTimeout(pollAssistantJobs, document.hidden ? 15000 : 3000);
  }
}
function renderAssistantJobs() {
  const container = assistantEl('assistant-jobs'), tree = buildTreeJSON(false), key = tree && generationTreeKey(tree);
  const ids = new Set(assistantState.jobs.map(job => job.id));
  for (const el of [...container.children]) if (!ids.has(el.dataset.jobId)) el.remove();
  for (const job of assistantState.jobs) {
    let card = [...container.children].find(el => el.dataset.jobId === job.id);
    if (!card) {
      card = document.createElement('div'); card.className = 'assistant-job'; card.dataset.jobId = job.id;
      for (const className of ['assistant-job-title', 'assistant-job-progress', 'assistant-job-state', 'assistant-job-error']) {
        const text = document.createElement('p'); text.className = className; card.appendChild(text);
      }
      const actions = document.createElement('div'); actions.className = 'assistant-buttons';
      for (const [action, label] of [['resume', 'Resume'], ['pause', 'Pause'], ['open', 'Open job tree'], ['export', 'Download saved lessons'], ['delete', 'Delete job']]) {
        const button = document.createElement('button'); button.className = 'btn'; button.dataset.action = action; uiText(button, label);
        button.addEventListener('click', () => void assistantJobAction(job.id, action)); actions.appendChild(button);
      }
      card.appendChild(actions); container.appendChild(card);
    }
    userText(card.querySelector('.assistant-job-title'), `${job.topic} · ${job.provider === 'chatgpt' ? 'ChatGPT' : 'Claude'} · ${job.model}${job.accountLabel ? ' · ' + job.accountLabel : ''}`);
    uiText(card.querySelector('.assistant-job-progress'), `${job.completed} / ${job.total} lessons saved`);
    const current = job.nodes.find(n => n.id === job.currentNode);
    userText(card.querySelector('.assistant-job-state'), t({ running: 'Generating', paused: 'Paused', failed: 'Needs attention', complete: 'Complete' }[job.status] || job.status) + (current ? ' · ' + current.label : ''));
    uiText(card.querySelector('.assistant-job-error'), job.error || (job.treeKey !== key ? 'This job belongs to another tree. Open its tree to collect the lessons.' : ''));
    card.querySelector('[data-action="resume"]').disabled = job.status === 'running' || job.status === 'complete' || assistantState.jobs.some(j => j.status === 'running');
    card.querySelector('[data-action="pause"]').disabled = job.status !== 'running';
    card.querySelector('[data-action="open"]').classList.toggle('hidden', job.treeKey === key);
    card.querySelector('[data-action="export"]').disabled = !job.completed;
    card.querySelector('[data-action="delete"]').disabled = job.status === 'running';
  }
  if (!assistantState.jobs.length) { const p = document.createElement('p'); p.className = 'generation-help'; uiText(p, 'No generation jobs yet.'); container.replaceChildren(p); }
}
async function assistantJobAction(id, action) {
  showAssistantError(null);
  try {
    if (action === 'delete') {
      if (!window.confirm(t('Delete this saved job and its recovery copy? Lessons already imported into trees stay.'))) return;
      await assistantAPI(`jobs/${id}`, { method: 'DELETE' }); assistantState.cursors.delete(id);
    }
    if (action === 'resume' || action === 'pause') await assistantAPI(`jobs/${id}/${action === 'resume' ? 'start' : 'pause'}`, { method: 'POST' });
    if (action === 'open') {
      if (state.nodes.size && !libraryReady) throw new Error('Wait for saved trees to finish loading before opening a job tree.');
      const tree = await assistantAPI(`jobs/${id}/tree`);
      autosaveTreeOnPageExit();
      if (!loadFromJSON(tree)) throw new Error('Could not open this job tree.');
      openGenerationModal();
    }
    if (action === 'export') {
      const data = await assistantAPI(`jobs/${id}/records`);
      const blob = new Blob([data.records.map(r => JSON.stringify(r)).join('\n') + '\n'], { type: 'application/x-ndjson' });
      const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = `learning-tree-${id}.jsonl`; link.click(); URL.revokeObjectURL(url);
    }
    await pollAssistantJobs();
  } catch (error) { showAssistantError(error); }
}

// Hosted app -> local app transfer uses a user-opened window and exact origins,
// source-window checks, and a fresh nonce. It does not send credentials or expose
// the companion API to cross-origin requests/private-network probing.
function localCompanionOrigin() {
  const url = new URL(assistantEl('assistant-local-address').value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('Use an address such as http://127.0.0.1:8765.');
  return url.origin;
}
function openLocalAssistant() {
  showAssistantError(null);
  try {
    const origin = localCompanionOrigin(), nonce = crypto.randomUUID();
    const url = new URL(origin); url.searchParams.set('lt_handoff', nonce); url.searchParams.set('lt_origin', location.origin);
    const opened = window.open(url.href, '_blank');
    if (!opened) throw new Error('Allow popups for this site, then try again.');
    const snapshot = buildTreeJSON(true);
    assistantState.outgoing = { origin, nonce, opened, snapshot, selection: { mode: generationSelection.mode, count: generationSelection.count, selected: [...generationSelection.selected] }, language: assistantEl('generation-language').value };
  } catch (error) { showAssistantError(error); }
}
window.addEventListener('message', event => {
  const data = event.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'learning-tree-auth-complete' && event.origin === location.origin && assistantState.available) { void refreshAssistantConnection(); return; }
  const outgoing = assistantState.outgoing;
  if (outgoing && event.source === outgoing.opened && event.origin === outgoing.origin && data.nonce === outgoing.nonce) {
    if (data.type === 'learning-tree-companion-ready') outgoing.opened.postMessage({ type: 'learning-tree-companion-import', nonce: outgoing.nonce, tree: outgoing.snapshot, selection: outgoing.selection, language: outgoing.language }, outgoing.origin);
    if (data.type === 'learning-tree-companion-records') {
      const tree = buildTreeJSON(false);
      if (!tree || data.treeKey !== generationTreeKey(tree)) return;
      collectAssistantRecords(data);
    }
  }
  const incoming = assistantState.incoming;
  if (incoming && event.source === window.opener && event.origin === incoming.origin && data.nonce === incoming.nonce && data.type === 'learning-tree-companion-import') {
    // Receiving a tree never starts generation. Confirm the source explicitly.
    incoming.payload = data;
    userText(assistantEl('assistant-handoff-description'), `${t('Receive a tree from')} ${event.origin}: ${String(data.tree?.topic || t('Untitled tree'))}`);
    assistantEl('assistant-handoff').classList.remove('hidden');
  }
});
function acceptAssistantTree() {
  const incoming = assistantState.incoming, data = incoming?.payload;
  if (!data?.tree) return;
  if (state.nodes.size && !libraryReady) { showToast('Wait for saved trees to finish loading before opening a job tree.'); return; }
  autosaveTreeOnPageExit();
  if (!loadFromJSON(data.tree)) return;
  generationSelection.mode = data.selection?.mode === 'manual' ? 'manual' : 'auto';
  generationSelection.count = data.selection?.count == null ? null : Math.max(1, Number(data.selection.count) || 1);
  generationSelection.selected = new Set(Array.isArray(data.selection?.selected) ? data.selection.selected.filter(id => typeof id === 'string') : []);
  assistantEl('generation-selection-mode').value = generationSelection.mode;
  try { localStorage.setItem('tree-tutorial-seen', '1'); } catch {}
  assistantEl('menu-tutorial').hidden = false;
  assistantState.handoff = { opener: window.opener, origin: incoming.origin, nonce: incoming.nonce };
  assistantState.incoming = null;
  assistantEl('assistant-handoff').classList.add('hidden');
  openGenerationModal();
  assistantEl('generation-language').value = String(data.language || state.language || '');
  assistantEl('generation-method').value = 'automatic';
  refreshGenerationSelection(); updateGenerationMethod();
}

assistantEl('generation-method').addEventListener('change', updateGenerationMethod);
assistantEl('assistant-provider').addEventListener('change', () => { showAssistantError(null); void loadAssistantModels().catch(showAssistantError); refreshAssistantControls(); });
assistantEl('assistant-model').addEventListener('change', refreshAssistantControls);
assistantEl('btn-assistant-start').addEventListener('click', startAssistantGeneration);
assistantEl('btn-assistant-refresh').addEventListener('click', () => { showAssistantError(null); void refreshAssistantConnection(); });
assistantEl('btn-assistant-jobs-refresh').addEventListener('click', pollAssistantJobs);
assistantEl('btn-assistant-connect').addEventListener('click', async () => {
  // Open synchronously with the click so browser popup blockers do not discard it.
  const popup = window.open('about:blank', '_blank');
  if (!popup) { showAssistantError(new Error('Allow popups for this site, then try again.')); return; }
  try {
    const data = await assistantAPI('chatgpt/connect', { method: 'POST', body: JSON.stringify({ account: assistantEl('assistant-chatgpt-account').value || 'new' }) });
    const url = new URL(data.url);
    if (url.origin !== 'https://auth.openai.com') throw new Error('Unexpected ChatGPT authorization address.');
    popup.location.href = url.href;
  } catch (error) { popup.close(); showAssistantError(error); }
});
assistantEl('btn-assistant-disconnect').addEventListener('click', async () => {
  try {
    const result = await assistantAPI('chatgpt/disconnect', { method: 'POST' }); await refreshAssistantConnection();
    if (result.revoked === false) showAssistantError(new Error('Disconnected locally. Remote revocation could not be confirmed; revoke Learning Tree in ChatGPT settings.'));
  }
  catch (error) { showAssistantError(error); }
});
assistantEl('btn-assistant-open-local').addEventListener('click', openLocalAssistant);
assistantEl('btn-assistant-accept-tree').addEventListener('click', acceptAssistantTree);
assistantEl('btn-assistant-decline-tree').addEventListener('click', () => { assistantState.incoming = null; assistantEl('assistant-handoff').classList.add('hidden'); });
document.addEventListener('generation-selection-change', refreshAssistantControls);
document.addEventListener('tree-loaded', () => { assistantState.cursors.clear(); assistantState.request = null; if (assistantState.available) void pollAssistantJobs(); });
document.addEventListener('ui-language-change', () => { refreshAssistantControls(); renderAssistantJobs(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && assistantState.available) { void refreshAssistantConnection(); void pollAssistantJobs(); } });

void refreshAssistantConnection().then(() => {
  if (!window.document) return;
  if (assistantState.available && !state.tutorialActive) { assistantEl('generation-method').value = 'automatic'; updateGenerationMethod(); }
  const url = new URL(location.href), nonce = url.searchParams.get('lt_handoff'), source = url.searchParams.get('lt_origin');
  if (assistantState.available && window.opener && nonce && /^[\w-]{16,80}$/.test(nonce) && source) {
    try {
      const origin = new URL(source).origin;
      if (!/^https?:/.test(origin)) return;
      assistantState.incoming = { nonce, origin };
      window.opener.postMessage({ type: 'learning-tree-companion-ready', nonce }, origin);
      url.searchParams.delete('lt_handoff'); url.searchParams.delete('lt_origin'); history.replaceState(null, '', url);
    } catch {}
  }
});
