import test from 'node:test';
import assert from 'node:assert/strict';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Jobs } from '../src/jobs.js';
import { fixture, lesson, input, finish, tick } from './helpers.js';

const cleanAudit = JSON.stringify({ issues: [], uncertain: [] });

test('completed lessons are durable before the next starts, and same-request retries do not duplicate jobs', async () => {
  const f = await fixture(); let writes = 0;
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { async generate({ instructions }) {
    if (instructions) return cleanAudit;
    if (writes++) assert.equal((await f.storage.read('jobs.json'))[0].records.length, 1);
    return lesson;
  } } } });
  try {
    await jobs.init(); const job = await jobs.create(input());
    assert.equal((await jobs.create(input())).id, job.id);
    await assert.rejects(jobs.create(input({ model: 'different' })), /different batch/);
    await jobs.start(job.id); await finish(jobs);
    assert.equal(jobs.get(job.id).status, 'complete');
    assert.deepEqual(jobs.get(job.id).records.map(r => r.id), ['a', 'b']);
    assert.equal(jobs.get(job.id).records[0].treeKey, input().treeKey);
    assert.equal(jobs.get(job.id).reviewHistory.length, 2);
    assert.equal(jobs.get(job.id).reviewHistory[0].outcome, 'accepted');
    if (process.platform !== 'win32') {
      const info = await stat(join(f.directory, 'jobs.json'));
      assert.equal(info.mode & 0o777, 0o600);
    }
    const restored = new Jobs({ storage: f.storage, providers: {} }); await restored.init();
    assert.equal(restored.get(job.id).records.length, 2);
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('pause cancels the unfinished lesson, retains earlier records and drafts, and resumes without regeneration', async () => {
  const f = await fixture(); let writes = 0, audits = 0, startedSecondWrite;
  const secondWrite = new Promise(resolve => { startedSecondWrite = resolve; });
  const provider = { async generate({ signal, instructions }) {
    if (instructions) { audits++; return cleanAudit; }
    writes++;
    if (writes === 2) { startedSecondWrite(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }
    return lesson;
  } };
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: provider } });
  try {
    await jobs.init(); const job = await jobs.create(input()); await jobs.start(job.id); await secondWrite;
    await jobs.pause(job.id);
    assert.equal(jobs.get(job.id).status, 'paused'); assert.equal(jobs.get(job.id).records.length, 1);
    await jobs.start(job.id); await finish(jobs);
    assert.equal(writes, 3); assert.equal(audits, 2); assert.equal(jobs.get(job.id).status, 'complete');
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('pause mid-review resumes from the checkpointed draft without rewriting', async () => {
  const f = await fixture(); let writes = 0, audits = 0, startedAudit;
  const auditStarted = new Promise(resolve => { startedAudit = resolve; });
  const provider = { async generate({ signal, instructions }) {
    if (!instructions) { writes++; return lesson; }
    audits++;
    if (audits === 1) { startedAudit(); await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })); }
    return cleanAudit;
  } };
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: provider } });
  try {
    await jobs.init(); const job = await jobs.create(input({ queue: ['a'], prompts: [{ id: 'a', prompt: 'Teach first' }] }));
    await jobs.start(job.id); await auditStarted;
    await jobs.pause(job.id);
    assert.equal(jobs.get(job.id).pending.draft, lesson.trim());
    await jobs.start(job.id); await finish(jobs);
    assert.equal(writes, 1); assert.equal(audits, 2);
    assert.equal(jobs.get(job.id).status, 'complete');
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('failed or incomplete output stops after bounded repair without loops; restarting never starts paid work', async () => {
  const f = await fixture(); let calls = 0;
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { async generate() { calls++; return '=== SECTION 1: Interrupted ===\n[QUESTION 1]'; } } } });
  try {
    await jobs.init(); const job = await jobs.create(input()); await jobs.start(job.id); await finish(jobs);
    // 1 write + 1 structural repair call (which returns invalid JSON and stops cleanly).
    assert.equal(calls, 2); assert.equal(jobs.get(job.id).records.length, 0); assert.equal(jobs.get(job.id).status, 'failed');
    const saved = await f.storage.read('jobs.json'); saved[0].status = 'running'; await f.storage.write('jobs.json', saved);
    const restarted = new Jobs({ storage: f.storage, providers: {} }); await restarted.init();
    assert.equal(restarted.get(job.id).status, 'paused'); assert.match(restarted.get(job.id).error, /stopped/);
    await tick(); assert.equal(calls, 2);
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('bounded acceptance repairs confirmed defects, verifies them, and keeps original content privately', async () => {
  const f = await fixture();
  const repaired = lesson.replace('A worked explanation.', 'A sharper worked explanation.');
  let stage = 0;
  const provider = { async generate({ instructions }) {
    stage++;
    if (stage === 1) { assert.equal(instructions, undefined); return lesson; }
    assert.ok(instructions);
    if (stage === 2) return JSON.stringify({ issues: [{ id: 'clarity-1', type: 'correctness', quote: 'A worked explanation.', reason: 'Missing condition.', correction: 'Add condition.' }], uncertain: [] });
    if (stage === 3) return JSON.stringify({ content: repaired, acceptedIssueIds: ['clarity-1'], rejectedIssues: [], unresolved: [] });
    if (stage === 4) return JSON.stringify({ approved: true, remaining: [], reason: 'Condition restored accurately.' });
    throw new Error('Unexpected extra call ' + stage);
  } };
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: provider } });
  try {
    await jobs.init();
    const job = await jobs.create(input({ queue: ['a'], prompts: [{ id: 'a', prompt: 'Teach first' }] }));
    await jobs.start(job.id); await finish(jobs);
    assert.equal(stage, 4);
    const done = jobs.get(job.id);
    assert.equal(done.status, 'complete');
    assert.equal(done.records[0].content, repaired);
    assert.equal(done.reviewHistory[0].originalContent, lesson.trim());
    assert.deepEqual(done.reviewHistory[0].decisions.acceptedIssueIds, ['clarity-1']);
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('repair rejecting a false criticism preserves content; deleted questions or rejected verification block without leaking answers', async () => {
  const f = await fixture();
  const deletedQuestion = '=== SECTION 1: Broken ===\nExplanation.\n[QUESTION 2]\n[ANSWER: B]\nRenumbered.\n(A) One\n(B) Two\n[/QUESTION]\n';
  let calls = 0;
  const provider = { async generate({ instructions }) {
    calls++;
    if (!instructions) return lesson;
    if (calls === 2) return JSON.stringify({ issues: [{ id: 'q-check', type: 'assessment', quote: 'Choose the matching case.', reason: 'SECRET_ANSWER_B_IS_WRONG', correction: 'Fix question.' }], uncertain: [] });
    if (calls === 3) return JSON.stringify({ content: deletedQuestion, acceptedIssueIds: ['q-check'], rejectedIssues: [], unresolved: [] });
    // After user explicitly resumes, a new cycle runs on the retained draft (no rewrite) and rejects false criticism cleanly.
    if (calls === 4) return JSON.stringify({ issues: [{ id: 'false-1', type: 'correctness', quote: 'A worked explanation.', reason: 'False alarm.', correction: 'Rewrite.' }], uncertain: [] });
    if (calls === 5) return JSON.stringify({ content: lesson.trim(), acceptedIssueIds: [], rejectedIssues: [{ id: 'false-1', reason: 'Original is already valid.' }], unresolved: [] });
    if (calls === 6) return JSON.stringify({ approved: true, remaining: [], reason: 'Rejection verified.' });
    throw new Error('Unexpected call ' + calls);
  } };
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: provider } });
  try {
    await jobs.init();
    const job = await jobs.create(input({ queue: ['a'], prompts: [{ id: 'a', prompt: 'Teach first' }] }));
    await jobs.start(job.id); await finish(jobs);
    const blocked = jobs.get(job.id);
    assert.equal(blocked.status, 'failed');
    assert.equal(blocked.records.length, 0);
    assert.equal(blocked.pending.blocked, true);
    assert.ok(!blocked.error.includes('SECRET_ANSWER_B_IS_WRONG'));
    // Explicit resume archives the blocked cycle and retries review on the retained draft without rewriting.
    await jobs.start(job.id); await finish(jobs);
    const complete = jobs.get(job.id);
    assert.equal(calls, 6);
    assert.equal(complete.status, 'complete');
    assert.equal(complete.records[0].content, lesson.trim());
    assert.equal(complete.reviewHistory.length, 2);
    assert.equal(complete.reviewHistory[0].outcome, 'blocked');
    assert.equal(complete.reviewHistory[1].outcome, 'accepted');
  } finally { await jobs.shutdown(); await f.cleanup(); }
});

test('review: false runs single-pass generation while still enforcing structural validation', async () => {
  const f = await fixture(); let calls = 0;
  const jobs = new Jobs({ storage: f.storage, providers: { chatgpt: { async generate() { calls++; return calls === 1 ? lesson : '=== SECTION 1: Bad ===\nNo questions here.'; } } } });
  try {
    await jobs.init();
    const job = await jobs.create(input({ review: false }));
    await jobs.start(job.id); await finish(jobs);
    assert.equal(calls, 2);
    assert.equal(jobs.get(job.id).records.length, 1);
    assert.equal(jobs.get(job.id).status, 'failed');
    assert.match(jobs.get(job.id).error, /\[QUESTION N\]/);
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
