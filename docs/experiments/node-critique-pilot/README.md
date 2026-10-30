# Small pilot: current prompt versus Luna critique and Sol revision

**The current-prompt references won this pilot: 9.555 versus 9.340, with all four blind preferences favoring current.** This does not establish that Luna feedback is generally harmful, or that the revision lowered the quality of these particular drafts. It means the two new complete workflows did not outperform the two fixed reference lessons in this small comparison.

The production prompt stays unchanged. Skill files were not used in this test.

## Candidate prompt and workflow

The [full idea-2 prompt](idea-2-prompt.txt) is the current giant prompt for the same limits node with this [added instruction](prompt-addition.txt). All existing teaching rules remain intact. The addition requires:

1. Finish a complete first draft with the prompt's usual planning and self-check.
2. Summon one fresh independent **gpt-6-luna** subagent and give it the draft plus the reader's scope/background. Ask for specific evidence-backed teaching feedback, not a rewrite or invented faults. Do not supply other lessons, previous grades or a target score.
3. Verify the critique's factual claims and revise once where justified, preserving correct reasoning, scope, achievable questions and markup.
4. Deliver only the finished lesson. Do not repeat the critique loop or substitute self-critique for the required critic.

The experiment additionally preserves the immutable first draft and its pre-critique hash, actual critic spawn arguments and final status, critique text, final output, revision notes and diff. Both author agents actually summoned their own critics after completing their drafts; this was not a root-authored simulation of feedback.

## Models, references and blinding

Both new author workflows used **GPT 6.1 Sol, low reasoning effort, fresh history**. Each spawned exactly one fresh **gpt-6-luna** critic, fork none, with no effort override. Critics saw only their assigned draft and the neutral reader context. Each writer waited for the critic's completion before producing one revised final output. First drafts were retained rather than selected or regenerated.

The current condition reuses the two monolithic lessons from the preceding skill-file pilot, byte-for-byte: its task_01 and task_03. **No current lesson was regenerated, and no old grade was reused.** All files use the same `limit_intuition` node from the Spanish calculus tree, unchanged scope/background and Spanish lesson language. The author instructions are English. There was no modular/skill-file treatment.

Four additional fresh Luna agents graded the final lessons; these were separate from both critics. They saw only anonymously labeled finished lessons and the unchanged neutral reader brief and five-criterion rubric. They did not see author prompts, drafts, critiques, revisions, model identities, conditions or past results. Two panels received current first and two revised first. Each saved lesson was rated twice, once per position, and every cross-condition output pairing occurred once. The resolved inherited grader effort was not exposed.

## Results

| Panel | Order | Current | Critique + revision | Preference |
|---|---|---:|---:|---|
| 1 | Current first | 9.66 | 9.48 | Current |
| 2 | Revised first | 9.60 | 9.24 | Current |
| 3 | Revised first | 9.44 | 9.24 | Current |
| 4 | Current first | 9.52 | 9.40 | Current |
| Mean | Balanced | **9.555** | **9.340** | **4–0** |

| Equally weighted criterion | Current | Critique + revision |
|---|---:|---:|
| Conceptual clarity/motivation | 9.500 | 9.250 |
| Scaffolding/pacing/load | 9.375 | 9.175 |
| Worked reasoning/transfer | 9.575 | 9.225 |
| Active learning | 9.425 | 9.175 |
| Correctness/precision | 9.900 | 9.875 |

The two current output means were 9.550 and 9.560. The two revised output means were 9.360 and 9.320. There were no arithmetic discrepancies, preference changes or rescoring. Exact results and original criteria are in [aggregate.json](aggregate.json).

These current references previously scored 9.625 in the skill-file experiment and score 9.555 here despite identical text. They received fresh graders and different comparison partners. This illustrates calibration/context variation; it does not mean the references changed quality or that a prompt changed between tests.

## What changed after feedback

**First workflow:** the critic found no mathematical error. Sol added a sentence connecting a table row to a plotted point and a sentence linking the general definition back to the distance example. It preserved the adjacent graph caveat and declined an optional self-explanation exercise as redundant. The questions were unchanged.

**Second workflow:** Sol clarified the opening, explained that the signed identity implies equal distances for every allowed input, and replaced an unnecessary domain-edge-case distractor. It rejected a false criticism about an isolated point. These were modest edits, not a reconstruction of the lesson's worked use or transfer sequence.

The complete critiques, revision notes and diffs are in the [experiment archive](experiment-records.zip). No final-grader feedback went back to the authors.

## Why the final graders preferred current

The current lessons gave them a more explicit reusable distance relation, summary tables separating the function value from one nearby output and the limit, and a broader set of applications. Both include a transfer case where two functions agree only within a punctured neighborhood, so changes at the center or farther away cannot alter the limit.

The revised lessons were accurate and readable. Their graph interpretation and point-value examples were strengths, and one required a useful cancellation calculation combined with a different assigned value. The comparative weakness was narrower worked transfer and, for one lesson, a less explicit algebraic distance equation and less organized comparison of the three quantities. The critique passes mainly polished local clarity rather than addressing the broader support that final graders valued in the references.

This is a description of these samples and reports, not proof that a summary table is always needed or that a particular added sentence caused lower scores.

## Verification and a useful warning from the actual process

Root separately checked all **20 final answer keys (12 main and eight bonus)**, the central reasoning and scope. All were correct; no substantive mathematical error was found in a delivered lesson. All four final files passed the app parser and graph-expression checks. No runtime graph interaction or human-learning outcome was measured. Original final-grader reports were read and preserved; no consequential factual grading error was verified.

One Luna critic incorrectly claimed that the added point (2,9) was not isolated from the graph y=x+2. Sol correctly rejected that advice. Its revision note then misstated the positive perpendicular distance as 7/sqrt(2), whereas it is 5/sqrt(2). The note's arithmetic slip does not affect the correct isolation conclusion and does not appear in the lesson. The [content audit](content-audit.md) records both errors. They were not silently repaired in the artifacts.

This demonstrates why the candidate prompt asks the writer to verify critique rather than obey every suggestion. It also shows that verification itself is not infallible. A critic pass is an opportunity for improvement, not a guarantee of a better lesson.

## Interpretation and limits

This was **two new author workflows, two critic calls and four fresh blind final graders**, on one familiar node, against two reused controls. Shared outputs make the four preferences dependent; there are only two generated samples per condition. The scores are near the ceiling and come from one reviewer model family.

The treatment adds an external critique and a Sol revision, and knowing a critique is coming may influence the initial draft. We did not blind-grade each saved draft against its own revision. Therefore this test **cannot establish that revision made the drafts worse**, isolate Luna feedback from the extra Sol pass, or estimate a pure wording effect. Actual billing/token efficiency was not measured. Critic and final evaluator both belong to the Luna family, although the agents and histories were separate.

The defensible decision is to **keep the current production prompt**: this pilot found no advantage for the added workflow. A later paired draft-versus-revision test would answer whether this feedback improves a fixed starting lesson; it was not added to the present small experiment.

The [complete records](experiment-records.zip) contain exact prompts/wrappers, both reused lessons, new immutable drafts, critic reports and spawn records, final lessons, revision notes/diffs, frozen assignments, neutral packets, raw grades, hashes and validators. [protocol.md](protocol.md) records the design frozen before generation. No fallback or production behavior was introduced.
