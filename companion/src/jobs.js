import { randomUUID, createHash } from 'node:crypto';
import format from '../../js/learn/generation-format.js';
import review from '../../js/learn/lesson-review.js';
const { generationTreeKey, lessonIsComplete } = format;
const { LESSON_REVIEW_SYSTEM, lessonAuditPrompt, lessonRepairPrompt, lessonVerificationPrompt, parseLessonAudit, parseLessonRepair, parseLessonVerification } = review;
const contentHash = content => createHash('sha256').update(content).digest('hex');
const clone = value => JSON.parse(JSON.stringify(value));
const questionIds = content => [...content.matchAll(/\[(QUESTION|BONUS)\s+(\d+)\]/gi)]
  .map(([, kind, number]) => kind.toUpperCase() + ':' + Number(number)).sort();
export class Jobs {
  constructor({ storage, providers, now = () => Date.now() }) { Object.assign(this, { storage, providers, now }); this.jobs = new Map(); this.active = null; }
  async init() {
    const saved = await this.storage.read('jobs.json', []);
    for (const job of saved) {
      if (job.status === 'running') { job.status = 'paused'; job.error = 'The companion stopped. Resume to continue from the last saved lesson.'; job.currentNode = null; job.currentPhase = null; }
      this.jobs.set(job.id, job);
    }
    await this.persist();
  }
  persist() { return this.storage.write('jobs.json', [...this.jobs.values()]); }
  summary(job) {
    const done = new Set(job.records.map(r => r.id));
    return { id: job.id, treeKey: job.treeKey, topic: job.tree.topic || 'Untitled tree', provider: job.provider, accountLabel: job.accountLabel || '', model: job.model, effort: job.effort,
      createdAt: job.createdAt, updatedAt: job.updatedAt, status: job.status, error: job.error || '',
      total: job.queue.length, completed: done.size, currentNode: job.currentNode || null, currentPhase: job.currentPhase || null, characters: job.characters || 0,
      nodes: job.queue.map(id => ({ id, label: job.tree.nodes.find(n => n.id === id).label, completed: done.has(id) })) };
  }
  get(id) { const job = this.jobs.get(id); if (!job) throw new Error('Generation job not found.'); return job; }
  list() { return [...this.jobs.values()].sort((a, b) => b.createdAt - a.createdAt).map(j => this.summary(j)); }
  async create(input) {
    const { tree, treeKey, queue, prompts, provider, model, effort = 'default', requestId, snapshot, account, accountLabel } = input || {};
    if (!tree || !Array.isArray(tree.nodes) || !tree.nodes.length || tree.nodes.length > 2000) throw new Error('A valid tree is required.');
    const ids = tree.nodes.map(n => n.id);
    if (ids.some(id => typeof id !== 'string' || !id || id.length > 200) || new Set(ids).size !== ids.length) throw new Error('Tree node IDs must be unique strings.');
    if (tree.nodes.some(n => typeof n.label !== 'string' || (n.requires && (!Array.isArray(n.requires) || n.requires.some(id => !ids.includes(id)))))) throw new Error('Invalid tree nodes or prerequisites.');
    if (tree.nodes.some(n => 'content' in n || 'done' in n || 'notes' in n)) throw new Error('Send tree structure only, without existing lessons or progress.');
    if (treeKey !== generationTreeKey(tree)) throw new Error('Tree identity does not match the generation job.');
    if (!Array.isArray(queue) || !queue.length || queue.length > 250 || new Set(queue).size !== queue.length || queue.some(id => !ids.includes(id))) throw new Error('Select between 1 and 250 valid nodes.');
    if (!Array.isArray(prompts) || prompts.length !== queue.length || prompts.some((p, i) => p.id !== queue[i] || typeof p.prompt !== 'string' || !p.prompt.trim() || p.prompt.length > 150000)) throw new Error('Each selected node needs its exact lesson prompt.');
    if (!Object.hasOwn(this.providers, provider) || typeof model !== 'string' || !/^[\w.:-]{1,120}$/.test(model) || !['default', 'low', 'medium', 'high', 'xhigh'].includes(effort)) throw new Error('Choose a valid provider, model, and reasoning effort.');
    if (snapshot && generationTreeKey(snapshot) !== treeKey) throw new Error('The recovery snapshot belongs to another tree.');
    if (typeof requestId !== 'string' || !/^[\w-]{16,80}$/.test(requestId)) throw new Error('A request ID is required for safe retries.');
    // Check ordering and cycles before persisting or spending any subscription use.
    const visited = new Set(), visiting = new Set(), byId = new Map(tree.nodes.map(n => [n.id, n]));
    const visit = id => { if (visited.has(id)) return; if (visiting.has(id)) throw new Error('The tree contains a prerequisite cycle.'); visiting.add(id); for (const parent of byId.get(id).requires || []) visit(parent); visiting.delete(id); visited.add(id); };
    queue.forEach(id => visit(id));
    for (const id of queue) for (const parent of tree.nodes.find(n => n.id === id).requires || []) {
      if (queue.includes(parent) && queue.indexOf(parent) > queue.indexOf(id)) throw new Error('Selected prerequisites must come before descendants.');
    }
    return this.storage.exclusive(async () => {
      const fingerprint = createHash('sha256').update(JSON.stringify({treeKey,queue,prompts,provider,model,effort,account})).digest('hex');
      const existing = [...this.jobs.values()].find(j => j.requestId === requestId);
      if (existing) {
        if (existing.fingerprint !== fingerprint) throw new Error('This request ID belongs to a different batch.');
        return this.summary(existing);
      }
      if (this.jobs.size >= 100) throw new Error('Delete an old job before creating another.');
      const job = { id: randomUUID(), requestId, fingerprint, account: account || null, accountLabel: accountLabel || '', tree: clone(tree), snapshot: clone(snapshot || tree), treeKey, queue: [...queue], prompts: clone(prompts), provider, model, effort,
        createdAt: this.now(), updatedAt: this.now(), status: 'paused', error: '', currentNode: null, records: [] };
      this.jobs.set(job.id, job);
      try { await this.persist(); } catch (error) { this.jobs.delete(job.id); throw error; }
      return this.summary(job);
    });
  }
  async start(id) {
    return this.storage.exclusive(async () => {
      const job = this.get(id);
      if (job.status === 'complete' || this.active?.id === id) return this.summary(job);
      if (this.active) throw new Error('Another job is running. Pause it before starting this one.');
      if (job.account) {
        const current = await this.providers[job.provider].status();
        if (!current.connected || (current.accountKey || current.email) !== job.account) throw new Error('Reconnect the subscription account used to create this job before resuming it.');
      }
      // A user-initiated Resume may start a new bounded acceptance cycle.
      // Preserve the rejected cycle and reuse its original draft, not a rewrite.
      if (job.pending?.blocked) {
        job.reviewHistory ||= [];
        job.reviewHistory.push({ ...clone(job.pending), outcome: 'blocked' });
        job.pending = { id: job.pending.id, draft: job.pending.draft };
      }
      const controller = new AbortController();
      job.status = 'running'; job.error = ''; job.updatedAt = this.now();
      this.active = { id, controller };
      try { await this.persist(); } catch (error) { this.active = null; job.status = 'paused'; throw error; }
      // The job runs independently of the browser tab/HTTP request.
      this.active.task = this.run(job, controller).catch(() => {});
      return this.summary(job);
    });
  }
  async run(job, controller) {
    try {
      for (const id of job.queue) {
        if (job.records.some(r => r.id === id)) continue;
        controller.signal.throwIfAborted();
        job.currentNode = id; job.characters = 0;
        const content = await this.acceptLesson(job, id, controller);
        await this.storage.exclusive(async () => {
          controller.signal.throwIfAborted();
          const record = { format: 'learning-tree-lesson/v1', treeKey: job.treeKey, id, content };
          const pending = job.pending;
          const history = {
            id, outcome: 'accepted', draftHash: contentHash(pending.draft), contentHash: contentHash(content),
            report: pending.report, verification: pending.verification || null,
            decisions: pending.repair ? { acceptedIssueIds: pending.repair.acceptedIssueIds, rejectedIssues: pending.repair.rejectedIssues } : null,
          };
          if (content !== pending.draft) history.originalContent = pending.draft;
          job.reviewHistory ||= [];
          job.reviewHistory.push(history); job.pending = null;
          job.records.push(record); job.updatedAt = this.now();
          try { await this.persist(); }
          catch (error) { job.records.pop(); job.reviewHistory.pop(); job.pending = pending; throw error; }
        });
      }
      job.status = 'complete'; job.error = '';
    } catch (error) {
      job.status = controller.signal.aborted ? 'paused' : 'failed';
      job.error = controller.signal.aborted ? '' : error.message;
    } finally {
      job.currentNode = null; job.currentPhase = null; job.characters = 0; job.updatedAt = this.now();
      try { await this.storage.exclusive(() => this.persist()); }
      finally { if (this.active?.id === job.id) this.active = null; }
    }
  }
  async reviewCheckpoint(job, controller, pending, phase) {
    await this.storage.exclusive(async () => {
      controller.signal.throwIfAborted();
      const previous = job.pending, previousPhase = job.currentPhase;
      job.pending = pending; job.currentPhase = phase; job.characters = 0; job.updatedAt = this.now();
      try { await this.persist(); }
      catch (error) { job.pending = previous; job.currentPhase = previousPhase; throw error; }
    });
  }
  async reviewCall(job, controller, prompt, reviewing = true) {
    const result = await this.providers[job.provider].generate({
      prompt, model: job.model, effort: job.effort, account: job.account,
      ...(reviewing ? { instructions: LESSON_REVIEW_SYSTEM } : {}),
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30 * 60 * 1000)]),
      onProgress: count => { job.characters = count; },
    });
    controller.signal.throwIfAborted();
    return result;
  }
  async blockReview(job, controller, message) {
    await this.reviewCheckpoint(job, controller, { ...job.pending, blocked: true, blockedReason: message }, job.currentPhase);
    throw new Error('This lesson needs attention before it can be saved. Its draft and detailed review are retained privately; earlier accepted lessons are saved. Resume explicitly to retry acceptance using the retained draft.');
  }
  async acceptLesson(job, id, controller) {
    const teachingPrompt = job.prompts.find(p => p.id === id).prompt;
    if (job.pending && job.pending.id !== id) throw new Error('A different lesson has a pending acceptance review.');
    if (!job.pending) {
      job.currentPhase = 'writing';
      const raw = await this.reviewCall(job, controller, teachingPrompt, false);
      const draft = String(raw).trim().replace(/^```(?:txt|text)?\s*\n([\s\S]*?)\n```\s*$/, '$1').trim();
      if (!draft || draft.length > 2_000_000) throw new Error('The model returned an empty or oversized lesson. Resume to retry this node.');
      await this.reviewCheckpoint(job, controller, { id, draft }, 'reviewing');
    }
    if (!job.pending.report) {
      await this.reviewCheckpoint(job, controller, job.pending, 'reviewing');
      const draft = job.pending.draft;
      // Structural failures go straight to the one repair; final verification
      // still audits meaning and assessment before anything is committed.
      const report = lessonIsComplete(draft)
        ? parseLessonAudit(await this.reviewCall(job, controller, lessonAuditPrompt(teachingPrompt, draft)), draft)
        : { issues: [{ id: 'structure', type: 'format', quote: draft.slice(0, 160), reason: 'The structural validator rejected the lesson. It requires SECTION 1, closed blocks, unique question numbers, nonempty options and exactly one valid answer tag per question.', correction: 'Restore complete valid structure while preserving the full teaching and practice.' }], uncertain: [] };
      await this.reviewCheckpoint(job, controller, { ...job.pending, report }, 'reviewing');
    }
    const { report, draft } = job.pending;
    if (report.uncertain.length) return this.blockReview(job, controller, 'Acceptance remains uncertain: ' + report.uncertain.join(' '));
    if (!report.issues.length) {
      if (!lessonIsComplete(draft)) return this.blockReview(job, controller, 'The review approved an invalid lesson structure.');
      return draft;
    }
    if (!job.pending.repair) {
      await this.reviewCheckpoint(job, controller, job.pending, 'repairing');
      const repair = parseLessonRepair(await this.reviewCall(job, controller, lessonRepairPrompt(teachingPrompt, draft, report)), report);
      await this.reviewCheckpoint(job, controller, { ...job.pending, repair }, 'repairing');
    }
    const { repair } = job.pending;
    if (repair.unresolved.length) return this.blockReview(job, controller, 'The repair left an unresolved issue: ' + repair.unresolved.join(' '));
    if (!lessonIsComplete(repair.content)) return this.blockReview(job, controller, 'The repaired lesson has incomplete or invalid question markup.');
    if (lessonIsComplete(draft) && JSON.stringify(questionIds(draft)) !== JSON.stringify(questionIds(repair.content))) {
      return this.blockReview(job, controller, 'The repair removed, added or renumbered assessment items in a structurally valid draft.');
    }
    if (!job.pending.verification) {
      await this.reviewCheckpoint(job, controller, job.pending, 'verifying');
      const verification = parseLessonVerification(await this.reviewCall(job, controller, lessonVerificationPrompt(teachingPrompt, draft, report, repair)));
      await this.reviewCheckpoint(job, controller, { ...job.pending, verification }, 'verifying');
    }
    if (!job.pending.verification.approved) return this.blockReview(job, controller, 'Repair verification failed: ' + job.pending.verification.reason + ' ' + job.pending.verification.remaining.join(' '));
    return repair.content;
  }
  async pause(id) {
    const job = this.get(id);
    if (this.active?.id === id) { const task = this.active.task; this.active.controller.abort(); await task; }
    return this.summary(job);
  }
  async remove(id) {
    await this.pause(id);
    await this.storage.exclusive(async () => { const old = this.get(id); this.jobs.delete(id); try { await this.persist(); } catch (error) { this.jobs.set(id, old); throw error; } });
  }
  async shutdown() { if (this.active) await this.pause(this.active.id); }
}
