# Saved drafts versus their own revisions

**All four fresh blind graders preferred the revisions.** The mean moved from **9.445 to 9.550**, a **+0.105** change on the ten-point rubric. Both author pairs improved in both presentation orders. These are modest local improvements on already strong lessons, not evidence of a large or reliable general workflow advantage.

No lesson was generated again. This recovers the exact first drafts and delivered revisions from [the preceding critique pilot](../node-critique-pilot/README.md). The production prompt remains unchanged.

## Design and models

The two original writers used **gpt-6.1-sol, low reasoning effort**, on the same `limit_intuition` node from the Spanish calculus tree. Each had completed one draft, obtained one independent Luna critique, verified the feedback and revised once. This follow-up reuses all four texts byte-for-byte, checking hashes against the original process records and root's observations while the critics were running.

Four fresh **gpt-6-luna** agents, separate from the writers, critics and preceding graders, each judged one draft/revision pair. Each author pair received two graders with opposite reading orders. Each text therefore appeared once as A and once as B. The assignments and packet hashes were saved before launch. Agents used fresh history (`fork_turns: none`), no reasoning-effort override and no children. The resolved inherited effort was not exposed.

The only Luna model exposed in this session's model list was `gpt-6-luna`; there was no exposed `gpt-6.1-luna` option. This is a tool-availability limitation, not a measured choice between Luna versions. Both 6.1 Sol and 6 Sol were exposed; the lesson writers here used 6.1 Sol. The requested Luna version should have been clarified earlier. This report makes the actual grader version explicit rather than implying 6.1 was used.

Graders saw only anonymous A/B lessons, the unchanged neutral reader-and-scope brief, and the same five-criterion rubric. They did not receive prompts, critiques, revision notes, dates, identities or prior grades. The rubric evaluates teaching quality for a human who actively works through the lesson and its questions, rather than a passive skimmer. Conceptual clarity, scaffolding, worked reasoning/transfer, active learning and correctness each contribute 20%. Blinding was procedural on the shared filesystem, not enforced filesystem isolation.

## Results

| Panel | Author pair | Order | Draft | Revision | Gain |
|---|---|---|---:|---:|---:|
| 1 | 02 | Draft first | 9.48 | 9.62 | +0.14 |
| 2 | 02 | Revision first | 9.48 | 9.56 | +0.08 |
| 3 | 04 | Revision first | 9.48 | 9.54 | +0.06 |
| 4 | 04 | Draft first | 9.34 | 9.48 | +0.14 |
| **Mean** | Both | Balanced | **9.445** | **9.550** | **+0.105** |

All four preferences favored revision; there were no ties or arithmetic discrepancies. Pair 02 averaged **9.48 → 9.59** (+0.11), and pair 04 **9.41 → 9.51** (+0.10). Confidence in the small comparative advantages was generally moderate, even where graders expressed high confidence that both lessons were strong.

| Criterion | Draft | Revision | Change |
|---|---:|---:|---:|
| Conceptual clarity/motivation | 9.400 | 9.575 | +0.175 |
| Scaffolding/pacing/load | 9.350 | 9.525 | +0.175 |
| Worked reasoning/transfer | 9.375 | 9.525 | +0.150 |
| Active learning | 9.300 | 9.325 | +0.025 |
| Correctness/precision | 9.800 | 9.800 | 0.000 |

[aggregate.json](aggregate.json) contains every original criterion score, assignment, confidence statement and paired result. Raw reports and scores are preserved in the [complete archive](experiment-records.zip), without rescoring or exclusion.

## What the graders valued

For pair 02, both graders valued the two added bridges: explicitly connecting a table row to a point on the graph and reconnecting the general limit description to the example's equal input/output distances. They considered these short additions helpful for a first-time reader, with little added cognitive load. Neither found a change in correctness or in the unchanged exercises. One noted that a reader who prefers compact explanations might prefer the draft.

For pair 04, the additional interpretation of the existing identity `f(x)-4=x-2` was the main positive judgment: it explicitly says that input distance from 2 equals output distance from 4 for any allowed input. The two graders disagreed about the changed question distractor. One preferred the draft's more subtle domain-edge-case option; the other preferred the revision's direct contrast between outputs approaching 6 and outputs approaching 10. Thus there was no unanimous preference for every individual edit.

The common strengths were the progression from table and graph to algebraic justification, correct restrictions on cancellation, separation of limit from point value and a particular approximation, and questions that confront plausible misconceptions. Some graders wanted constructed explanations or more explicit feedback beyond multiple choice. Those are shared limitations; the practice format was largely unchanged by revision, and no new exercise was added in this follow-up.

## Factual audit of the evaluations

**Panel 3 makes a material attribution error.** It credits revision A with displaying `f(x)-4=(x+2)-4=x-2` and states that draft B omits that equality. Both texts already contain the identical displayed equation. The revision adds its explicit interpretation in terms of distances. The report therefore overstates what changed, although it also recognizes the genuinely added explanation. Its preference and raw scores are retained and flagged; it was not selectively rerun, removed or silently corrected.

Panel 2 describes the added distance bridge as if it occurs directly after factoring. The actual new bridge is in section 2, after the general definition; the draft already had the concrete equal-distance example in section 1. The grader correctly recognizes a useful added connection, but its localization and description of the draft are imprecise. This is weaker evidence than its accurate identification of the added graph/table sentence.

Panel 4 accurately distinguishes the existing equation from the added interpretation. All four reports correctly identify the relevant limits and point values. No consequential mathematical error was verified in the lessons. The [content audit](content-audit.md) records the question checks and these grading limitations. App parser and graph-expression checks passed all four files; graphs were not tested through runtime interaction.

## What this changes about the previous conclusion

The preceding experiment found that two newly generated critique/revision workflows lost **4–0**, **9.340 versus 9.555**, to two older current-prompt references. That comparison could not establish whether critique made a fixed draft worse. This paired follow-up instead finds small judged improvements in those same drafts. The results are compatible: local improvement can leave a lesson less effective than another independently generated lesson.

Do not compare the new revised mean of 9.550 directly against the old references' 9.555 and infer parity. The same unchanged revisions scored 9.340 with the previous partners and graders. That 0.210 shift illustrates calibration and comparison-context variation, and exceeds this follow-up's 0.105 paired gain. Within-panel differences are the relevant observation here; cross-experiment absolute scores are not a common ruler.

The defensible finding is that **these critics prompted small useful clarifications, with no detected lesson-level mathematical harm**. It does not show that the added workflow reliably beats the current prompt, produces near-perfect human learning, or is worth its extra cost. We have two author pairs on one node, shared texts across judgments, one grader family and scores near the ceiling. Critics and final graders also share a model family, despite separate histories. No human outcomes, billing or token-efficiency measurements were collected.

The current production prompt stays unchanged. The complete archive includes the exact recovered texts, original critique-stage provenance, frozen assignments and packets, grader wrappers/model arguments, raw evaluations, diffs, validators and hashes. [protocol.md](protocol.md) describes the design. No fallback behavior was added.
