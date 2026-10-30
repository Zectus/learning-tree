/* Subscription generation happens in the user's ChatGPT conversation. The
   hosted bridge stores jobs/lessons; it never invokes a billable model API. */
const ONLINE_LEARNING_TREE = 'https://learning-tree-lessons.zectusone.chatgpt.site';
const onlineLessons = { transfer: null, chosenMethod: false };
function refreshOnlineLessonControls() {
  const packet = currentGenerationPacket(), target = Number(document.getElementById('generation-count').value);
  document.getElementById('btn-assistant-online').disabled = !packet?.queue.length || packet.queue.length > 250
    || (generationSelection.mode === 'manual' && packet.queue.length !== target);
}
function onlineLessonPayload() {
  const packet = currentGenerationPacket();
  if (!packet?.queue.length || packet.queue.length > 250) throw new Error('Select between 1 and 250 topics.');
  const live = [...state.nodes.keys()];
  return { tree: packet.tree, snapshot: buildTreeJSON(true), treeKey: packet.treeKey, queue: packet.queue,
    prompts: packet.queue.map(id => {
      const index = packet.tree.nodes.findIndex(n => n.id === id);
      const delivery = 'Save the complete plain-text lesson with the save_lesson tool. Do not create files or JSONL records. No other tools or external services are needed.';
      return { id, prompt: buildPrompt(live[index], packet.lessonLanguage, delivery) };
    }) };
}
function openOnlineLessons() {
  if (state.tutorialActive || document.getElementById('btn-assistant-online').disabled) return;
  const status = document.getElementById('assistant-online-status');
  try {
    const payload = onlineLessonPayload(), nonce = crypto.randomUUID();
    const url = new URL(ONLINE_LEARNING_TREE); url.searchParams.set('lt_handoff', nonce); url.searchParams.set('lt_origin', location.origin);
    const page = window.open(url.href, '_blank');
    if (!page) throw new Error('Allow popups for this site, then try again.');
    onlineLessons.transfer = { page, origin: url.origin, nonce, payload };
    uiText(status, 'Continue in the online window. Finished lessons will return to this tree.');
  } catch (error) { uiText(status, error.message); }
}
window.addEventListener('message', event => {
  const transfer = onlineLessons.transfer, data = event.data;
  if (!transfer || event.source !== transfer.page || event.origin !== transfer.origin || data?.nonce !== transfer.nonce) return;
  if (data.type === 'learning-tree-online-ready') {
    transfer.page.postMessage({ type: 'learning-tree-online-import', nonce: transfer.nonce, payload: transfer.payload }, transfer.origin);
  }
  if (data.type === 'learning-tree-online-records') {
    const tree = buildTreeJSON(false);
    if (!tree || generationTreeKey(tree) !== data.treeKey || data.treeKey !== transfer.payload.treeKey) {
      uiText(document.getElementById('assistant-online-status'), 'Your lessons are saved online. Reopen the original tree to receive them.'); return;
    }
    if (collectAssistantRecords(data, 'ChatGPT')) {
      uiText(document.getElementById('assistant-online-status'), 'Lessons received from ChatGPT and saved to this tree.');
      transfer.page.postMessage({type:'learning-tree-online-ack',nonce:transfer.nonce,jobId:data.jobId,next:data.next,ids:data.records.map(record=>record.id)}, transfer.origin);
    }
  }
});
document.getElementById('generation-method').addEventListener('change', () => { onlineLessons.chosenMethod = true; refreshOnlineLessonControls(); });
document.getElementById('btn-assistant-online').addEventListener('click', openOnlineLessons);
document.addEventListener('generation-selection-change', refreshOnlineLessonControls);
document.addEventListener('generation-opened', () => {
  if (!onlineLessons.chosenMethod && !state.tutorialActive && !state.assistantAvailable && !['127.0.0.1','localhost'].includes(location.hostname)) {
    document.getElementById('generation-method').value = 'online'; updateGenerationMethod();
  }
  refreshOnlineLessonControls();
});
