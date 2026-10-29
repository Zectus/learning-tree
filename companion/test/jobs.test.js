import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Jobs } from '../src/jobs.js';
import { fixture, lesson, input, finish, tick } from './helpers.js';

test('completed lessons are durable before the next starts, and same-request retries do not duplicate jobs', async () => {
  const f = await fixture(); let called = 0;
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { async generate() { if (called++) assert.equal((await f.storage.read('jobs.json'))[0].records.length, 1); return lesson; } } } });
  try {
    await jobs.init(); const job = await jobs.create(input());
    assert.equal((await jobs.create(input())).id, job.id);
    await assert.rejects(jobs.create(input({ model: 'different' })), /different batch/);
    await jobs.start(job.id); await finish(jobs);
    assert.equal(jobs.get(job.id).status, 'complete');
    assert.deepEqual(jobs.get(job.id).records.map(r => r.id), ['a', 'b']);
    assert.equal(jobs.get(job.id).records[0].treeKey, input().treeKey);
    const info = await stat(join(f.directory, 'jobs.json')); assert.equal(info.mode & 0o777, 0o600);
    const restored = new Jobs({ storage: f.storage, providers: {} }); await restored.init();
    assert.equal(restored.get(job.id).records.length, 2);
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('pause cancels the unfinished lesson, retains earlier records, and resumes without regeneration', async () => {
  const f = await fixture(); let calls = 0, startedSecond;
  const second = new Promise(resolve => { startedSecond = resolve; });
  const provider = { async generate({ signal }) {
    calls++;
    if (calls === 2) { startedSecond(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }
    return lesson;
  } };
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: provider } });
  try {
    await jobs.init(); const job = await jobs.create(input()); await jobs.start(job.id); await second;
    await jobs.pause(job.id);
    assert.equal(jobs.get(job.id).status, 'paused'); assert.equal(jobs.get(job.id).records.length, 1);
    await jobs.start(job.id); await finish(jobs);
    assert.equal(calls, 3); assert.equal(jobs.get(job.id).status, 'complete');
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('failed or incomplete output stops without retries or partial imports; restarting never starts paid work', async () => {
  const f = await fixture(); let calls = 0;
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { async generate() { calls++; return '=== SECTION 1: Interrupted ===\n[QUESTION 1]'; } } } });
  try {
    await jobs.init(); const job = await jobs.create(input()); await jobs.start(job.id); await finish(jobs);
    assert.equal(calls, 1); assert.equal(jobs.get(job.id).records.length, 0); assert.equal(jobs.get(job.id).status, 'failed');
    const saved = await f.storage.read('jobs.json'); saved[0].status = 'running'; await f.storage.write('jobs.json', saved);
    const restarted = new Jobs({ storage: f.storage, providers: {} }); await restarted.init();
    assert.equal(restarted.get(job.id).status, 'paused'); assert.match(restarted.get(job.id).error, /stopped/);
    await tick(); assert.equal(calls, 1);
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('wrong identities, cycles, extra queue IDs and out-of-order prerequisites are rejected before generation', async () => {
  const f = await fixture(); const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: {} } });
  try {
    await jobs.init();
    await assert.rejects(jobs.create(input({ treeKey: 'foreign' })), /identity/);
    await assert.rejects(jobs.create(input({ queue: ['missing'] })), /valid nodes/);
    await assert.rejects(jobs.create(input({ queue: ['b', 'a'], prompts: [{id:'b',prompt:'B'},{id:'a',prompt:'A'}] })), /prerequisites/);
    await assert.rejects(jobs.create(input({ requestId: '../file' })), /request ID/);
    await assert.rejects(jobs.create(input({ prompts: [{id:'a',prompt:'only one'}] })), /exact lesson prompt/);
    assert.equal(jobs.jobs.size, 0);
  } finally { await f.cleanup(); }
});

test('a resumed job cannot silently switch subscription accounts', async () => {
  const f = await fixture();
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { status: async () => ({connected:true,accountKey:'other-account'}) } } });
  try { await jobs.init(); const job = await jobs.create(input({ account: 'original-account' })); await assert.rejects(jobs.start(job.id), /subscription account/); assert.equal(jobs.active, null); }
  finally { await f.cleanup(); }
});
