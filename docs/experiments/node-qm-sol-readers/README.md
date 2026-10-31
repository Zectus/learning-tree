# Same four QM lessons, four fresh GPT 6.1 Sol readers

**All four Sol readers preferred both Extra High lessons to both Low lessons.** Extra High self-review ranks first on mean score, but its advantage over the Extra High original is tiny. No lesson was regenerated or edited.

| Version | Sol-reader mean / 10 |
|---|---:|
| Original Low | 9.225 |
| Low self-review | 9.315 |
| Original Extra High | 9.480 |
| Extra High self-review | 9.495 |

These are new grades of the exact four lessons from [the preceding effort experiment](../node-qm-effort-pilot/README.md), on **The Partial Trace and Reduced Density Operators**. All text hashes match. The production prompt is unchanged.

## Readers, orders and unchanged inputs

Four fresh **gpt-6.1-sol** agents, **low reasoning effort**, `fork_turns: none`, judged the lessons independently. The user specified Sol 6.1 readers without an effort setting; Low was the explicit assumption stated before launch. No reader spawned children or saw other reports, previous scores, prompts, model identities, effort labels or review notes.

The rubric and neutral reader/scope brief are byte-identical to the previous experiment: an average first-time learner who actively reads, works examples and answers questions. Conceptual clarity, scaffolding, worked reasoning/transfer, active learning and correctness each contribute 20%. The task wrapper specifies the new output paths and four anonymous labels, without revealing conditions.

The exact anonymous packets from prior panels **1, 3, 5 and 7** were reused. This subset was fixed before any new reader launched. It puts every version once in every label position and each pair in each relative order twice. Packet hashes and rubric bytes match the corresponding previous packets. This is a balanced four-reader subset of the earlier eight-reader design, rather than eight new calls. Blinding is procedural on a shared filesystem, not enforced file isolation.

No new writer or critic was called. Both Low files and both Extra High files remain exactly as previously delivered. Prior mathematical and parser checks are reused through verified byte identity; this grading task adds no application changes or fallbacks.

## Results

| Panel | Presentation order | Low original | Low review | Extra High original | Extra High review |
|---|---|---:|---:|---:|---:|
| 1 | Low original, Low review, High original, High review | 9.22 | 9.30 | 9.46 | 9.50 |
| 2 | High original, High review, Low original, Low review | 9.18 | 9.30 | 9.42 | 9.46 |
| 3 | High review, High original, Low review, Low original | 9.36 | 9.44 | 9.60 | 9.62 |
| 4 | Low review, Low original, High review, High original | 9.14 | 9.22 | 9.44 | 9.40 |
| **Mean** | Balanced | **9.225** | **9.315** | **9.480** | **9.495** |

All overall scores are exact equal-weight criterion means; no arithmetic correction or rounding adjustment was needed. The raw JSON rankings agree with the score orderings and contain no ties.

| Comparison | First preferred | Second preferred |
|---|---:|---:|
| Low review vs Low original | 4 | 0 |
| Extra High review vs Extra High original | 3 | 1 |
| Extra High original vs Low original | 4 | 0 |
| Extra High original vs Low review | 4 | 0 |
| Extra High review vs Low original | 4 | 0 |
| Extra High review vs Low review | 4 | 0 |

Low self-review improves its mean by **0.090**. Extra High self-review improves its mean by **0.015**. Extra High original exceeds Low original by **0.255** and Low review by **0.165**; the reviewed Extra High exceeds reviewed Low by **0.180**.

| Criterion | Low original | Low review | Extra High original | Extra High review |
|---|---:|---:|---:|---:|
| Conceptual clarity | 9.475 | 9.475 | 9.675 | 9.675 |
| Scaffolding/pacing | 8.875 | 9.100 | 9.250 | 9.325 |
| Worked reasoning/transfer | 8.975 | 9.200 | 9.600 | 9.600 |
| Active learning | 8.800 | 8.800 | 8.875 | 8.875 |
| Correctness/precision | 10.000 | 10.000 | 10.000 | 10.000 |

## Why they preferred Extra High

The readers consistently value its explicit four-index trace expansion and Kronecker delta, the comparison with the local trace before identifying reduced entries, a fully worked complex joint matrix, and the local/joint checks of a complex-basis probability. The numerical joint-projector comparison between a pure state and its statistical mixture makes the no-collapse distinction a worked consequence. These are identified as useful reasoning bridges, rather than rewards for longer text or more questions.

The Low lessons retain compensating strengths: a compact real-amplitude example, a phase-dependent basis-change exercise that probes cancellation more deeply than matrix subtraction, and an explicit mixed-joint-state bonus and entanglement caveat. All four readers correctly recognize Low self-review's two added bridges and judge them useful.

For the Extra High pair, three readers prefer completing the first calculation before introducing another operator representation. One prefers the original's earlier tensor-map explanation so the meaning precedes the matrix computation. That is a legitimate learner-support tradeoff; no content or mathematical correction differentiates the pair. The 0.015 mean gain is correspondingly slight.

All four readers identify missing written explanations after attempted questions as a shared remaining weakness, especially for phase signs and nontrivial transfer. This keeps active-learning scores lower even though they find the questions meaningful and achievable. They do not assume the hidden answer tags provide explanatory feedback.

## Attribution accuracy and limits

Root read all four reports in full and checked their descriptions against the exact texts and saved diffs. **No consequential passage-attribution error was verified.** In particular, they distinguish content moved between sections from genuinely added content, correctly separate the Low singlet example from the Extra High joint-projector example, and recognize the two Low additions rather than calling the files identical. The [content audit](content-audit.md) records these checks. All raw grades remain intact; there were no selective reruns or exclusions.

This makes the new stated rationales more dependable than the preceding Luna reports that demonstrably confused passages. It does not establish that Sol grades are a human-learning ground truth or that Sol never makes those mistakes. Authors and new readers share a model family, and family-specific style preferences remain possible.

There is still one original and one self-review per effort level. Four readers share those same texts; their judgments do not create independent author replications. Scores are near the ceiling, no human outcomes were measured, and review value versus extra time/cost was not measured. The defensible result is a clear **preference within this four-Sol panel** for the Extra High samples, with only a very small additional benefit from their self-review.

## Relationship to the previous Luna scores

The previous eight-Luna means were 9.4475, 9.4900, 9.4925 and 9.5050 in the table's condition order. On the exact four packet orders reused here, those Luna means were **9.480, 9.535, 9.470 and 9.485**. The new Sol means are **9.225, 9.315, 9.480 and 9.495**.

Both references are preserved in the archive's `luna-reference.json`. The balanced four-Luna subset favored Low review, while the full eight-Luna panel narrowly favored Extra High review. This illustrates why small differences and selected panel counts should not be treated as precise rankings. The four packet orders were chosen for position and relative-order balance before the new grades, not chosen after seeing Sol results.

Changing grader model and panel size changes calibration and interpretation, not lesson content. Do not read the lower Low scores as degradation or the new relative separation as a precise human-learning effect. The Sol reports support their preferences with accurately attributed teaching differences; replication on other lessons and nodes remains necessary for general claims.

[aggregate.json](aggregate.json) contains every criterion, confidence statement and pairwise preference. [protocol.md](protocol.md) records the fixed design. The [complete archive](experiment-records.zip) contains all four unchanged lesson texts, exact packets and instructions, reader model arguments, raw reports and scores, hashes, reused checks, prior Luna references and validation scripts. No production change was made.
