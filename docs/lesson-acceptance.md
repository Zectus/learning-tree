# Lesson acceptance and targeted repair

Implementation status: implemented, not tested. The user explicitly deferred testing. No unit suites, generation experiments, provider calls, or deployment validation were run for this change.

Each finished lesson is subject to an acceptance procedure before its durable completion record is saved. The shared procedure lives in `js/learn/lesson-review.js` and is attached to per-node prompts and the multi-node work packet. It leaves the teaching template, tree schema and finished lesson record format intact.

The check covers the actual learner scope and prerequisites, hypotheses and reasoning bridges, every main and bonus answer option, answer leakage, faithful graph semantics and valid structural markup. Questions are solved before consulting their keys. The reviewer must distinguish a valid keyed answer from a uniquely qualifying option; weaker bounds and larger sufficient cutoffs are explicitly checked. Supplied facts are permitted within their intended scope. A criticism needs exact evidence and supporting reasoning; optional polish is not a mandatory rewrite.

## Prompt and files / online ChatGPT

The coordinator accepts each worker's returned draft, verifies any criticism, makes one local repair if needed and checks affected material before saving. It can use a fresh focused reviewer for advanced or uncertain material, with the selected model and effort. Without independent workers the same explicit audit is required, without claiming independence. There is one review, at most one targeted repair, and one repair verification per lesson in a run; unresolved substantive concerns hold that node and its descendants. Independent branches can continue. Review notes, issue lists and worked quiz solutions remain outside the delivered lesson and completed JSONL journal.

New online jobs receive this procedure in their actual node prompts. The online worker's workflow and tool descriptions also describe it. The hosted bridge still validates structure and saves content; it does not invoke a review model or prove semantic correctness. Existing saved job prompts are not retroactively rewritten. The worker continues to refuse overwrites of already saved lessons. Updated worker descriptions take effect when that bridge is deployed; the new client prompts carry the procedure independently.

## Local companion

The companion executes separate, stateless provider calls rather than relying only on an instruction to reread:

1. Write and privately checkpoint the draft.
2. Run the existing structural validator. If structure is valid, call a fresh acceptance reviewer with the exact teaching prompt and full draft. If invalid, record a structural finding and proceed to the one repair.
3. If the reviewer returns no confirmed defects or consequential uncertainty, save the accepted original immediately.
4. For confirmed defects, call the repair coordinator once. It must account for every finding as corrected or rejected with a reason. Keep the full candidate privately and validate its structure. A structurally valid original must retain its main and bonus question identifiers; a repair cannot silently delete or renumber assessment items.
5. Call a fresh verifier with the original, candidate, findings and repair decisions. Accept only an affirmative decision with no remaining consequential issue, then save immediately.

A clean lesson uses two provider requests including authoring. A repaired lesson normally uses four; structural-only repair uses three. All calls retain the job's provider, subscription account, model and reasoning effort. Review and repair roles have their own JSON-response system instruction; the original author-only plain-text system instruction is not reused for those roles. The original teaching requirements remain input data for the review, not authority to use tools or change the review response format.

Review parsers require complete JSON, bounded issue lists, unique issue IDs, exact quotations present in the draft, and accounting for every finding. This is validation of the model's review envelope, not machine verification of its mathematical truth. The verifier checks false criticism, lost content, unsupported rejections and answer leakage as well as corrections. The selected model can still make mistakes; empirical quality and overhead remain to be tested.

Private `job.pending` state checkpoints the draft, completed review, repair and verification between calls. Pause or restart resumes the unfinished stage without regenerating a checkpointed draft or repeating a completed stage. Only accepted text enters `job.records` and browser imports. A failure preserves earlier completed records. The companion currently processes nodes sequentially, so an unresolved issue pauses that batch.

A substantive review failure is marked blocked. An explicit user Resume archives the rejected cycle and starts another bounded acceptance cycle from the retained original draft; no automatic retry loop is started. Interrupted calls and malformed response envelopes can be retried by an explicit Resume at their unfinished stage. An accepted audit and the final content commit share the same atomic persisted job snapshot. Review history retains hashes and decisions, plus original text for changed lessons; blocked cycles retain their private candidate and findings. These private records are not exposed in lesson exports or learner prose.

The job display distinguishes generating, reviewing, repairing and checking a repair. The generation dialog notes that review and repair can increase time and usage. Provider usage overhead has not been measured.

## Deferred verification

The next testing phase should exercise:

- Procedure appears once in single-node, multi-node, online and local prompts; correct prerequisite context and selected effort reach reviewer calls.
- Clean drafts pass without a repair, and accepted content saves before a dependent starts.
- The Fourier weaker-bound ambiguity and missing absolute-continuity conditions are detected and repaired without teaching the answer in surrounding prose.
- False criticisms are rejected with evidence and the unchanged correct content passes verification.
- Missing citations, malformed review JSON, duplicate issue IDs, unaccounted findings, unresolved concerns and rejected verification cannot save an unaccepted candidate.
- Pause/crash/storage failure at each stage preserves the previous durable state; accepted-record persistence failure does not skip acceptance or repeat paid stages unnecessarily.
- Existing jobs resume, online write-once behavior remains intact, and original lessons/notes/progress are not silently overwritten.
- Original and revised content remain recoverable privately; review notes and solutions never enter the visible lesson.
- Compare confirmed defects found, false fixes, regressions, elapsed time and reported allowance with the previous process. A higher review score alone is not evidence of a better workflow.

Detailed blocked-review reasons are retained in private job state, not copied to the visible job error, because they can contain quiz solutions. The visible status identifies the need for attention and the retained checkpoint without revealing answers.
