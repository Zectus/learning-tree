import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Storage } from '../src/storage.js';
import format from '../../js/learn/generation-format.js';
export const lesson = '=== SECTION 1: A useful idea ===\nA worked explanation.\n[QUESTION 1]\n[ANSWER: B]\nChoose the matching case.\n(A) First\n(B) Second\n(C) Third\n[/QUESTION]\n';
export async function fixture() { const directory = await mkdtemp(join(tmpdir(), 'learning-tree-test-')); const storage = new Storage(directory); await storage.init(); return { directory, storage, cleanup: () => rm(directory, { recursive: true, force: true }) }; }
export function input(overrides = {}) {
  const tree = { topic: 'Test tree', nodes: [{ id: 'a', label: 'First' }, { id: 'b', label: 'Next', requires: ['a'] }] };
  return { tree, treeKey: format.generationTreeKey(tree), queue: ['a', 'b'], prompts: [{ id: 'a', prompt: 'Teach first' }, { id: 'b', prompt: 'Teach next' }], provider: 'chatgpt', model: 'test-model', requestId: 'safe-idempotent-request-1', ...overrides };
}
export const tick = () => new Promise(resolve => setImmediate(resolve));
export async function finish(jobs) { const active = jobs.active; if (active) await active.task; }
