# QM partial trace: Low versus Extra High, with and without self-review

**Extra High did not show a clear advantage in this small comparison.** Its reviewed lesson had the highest mean, but only by 0.015 over Low self-review. Several graders substantially confused passages between versions, making these tiny gaps especially weak evidence.

| Version | Mean / 10 |
|---|---:|
| Original Low | 9.4475 |
| Low self-review | 9.4900 |
| Original Extra High | 9.4925 |
| Extra High self-review | 9.5050 |

The two Low lessons are reused byte-for-byte from [the preceding QM experiment](../node-qm-review-control/README.md). Neither was regenerated, and no previous grade was reused. The production prompt stays unchanged.

## Method

The node remains **The Partial Trace and Reduced Density Operators** from the calibrated QM tree. The exact rendered author prompt, scope and reader background are unchanged. The prompt SHA-256 is `5309500d0c90745e7e666f2a10ed38a6b76c94783c29cf09317e13486e861b6c`.

One fresh **gpt-6.1-sol**, `reasoning_effort: xhigh`, `fork_turns: none`, generated the new original with the same original-delivery wrapper as Low, changing only file paths. It received no draft/review framing. It completed and delivered before review began. During its longer generation root sent a neutral progress query telling it to continue the original task unchanged; that message is recorded.

A separate fresh **gpt-6.1-sol xhigh** agent then used the prior Low self-review wrapper with **only paths changed**, receiving the same original prompt and reader context plus its own completed Extra High lesson. It reviewed independently and revised once, without subagents or external critique. This matches the fresh-agent self-review process used for Low; it is not a continuation retaining the initial writer's hidden reasoning or tool history. Exact model arguments, wrappers and inputs are archived.

Eight fresh **gpt-6-luna** agents evaluated anonymous A/B/C/D packets with the same five equally weighted teaching criteria for an actively engaged first-time human learner. They saw no prompts, models, effort settings, reviews, previous grades or condition labels. Four cyclic orders and their reversals give each version twice in each position and each pair in each relative order four times. Six graders ran first, with the remaining two launched as slots freed. No grader saw another report or gave feedback to authors. Blinding was procedural on a shared filesystem, not enforced isolation. No Luna effort override was set; its resolved inherited effort was not exposed. The session exposes no 6.1 Luna option, so the actual grader identifier remains gpt-6-luna.

## What Extra High produced and reviewed

The original Extra High lesson already explains the tensor-bra operation that Low later added in self-review. It supplies explicit index ranges, a full complex-valued joint density matrix and its reduction, a higher-rank local projector question, and separate purity and local-versus-joint transfer questions. The Low lessons use a leaner worked amplitude example and a singlet-versus-mixture question. More content is not automatically better: accessibility and cognitive load remain part of the rubric.

Extra High's review found no mathematical error. It moved the partial-inner-product maps, operator sandwich and tensor-term rule from the beginning of Section 3 to Section 4. This brings the first worked application of the entry rule forward and places the alternative representation beside the basis-independence argument. It also adds a purpose phrase and replaces “reverse map” with “map in the other direction.” All equations, examples and seven questions remain unchanged. The review changes sequence, rather than adding missing calculations or content.

The two preserved Low edits explicitly explain the environment bra's action and expand a worked off-diagonal entry into its amplitude products. Every condition has strong mathematical content; differences concern support, sequencing and practice coverage.

## Fresh blind results

| Panel | Low original | Low review | Extra High original | Extra High review |
|---|---:|---:|---:|---:|
| 1 | 9.44 | 9.48 | 9.60 | 9.64 |
| 2 | 9.36 | 9.36 | 9.56 | 9.58 |
| 3 | 9.46 | 9.54 | 9.38 | 9.34 |
| 4 | 9.64 | 9.64 | 9.62 | 9.66 |
| 5 | 9.54 | 9.64 | 9.48 | 9.54 |
| 6 | 9.38 | 9.50 | 9.56 | 9.54 |
| 7 | 9.48 | 9.48 | 9.42 | 9.42 |
| 8 | 9.28 | 9.28 | 9.32 | 9.32 |

These use exact means of the original criterion scores. Panel 8 reports every overall as 9.3, valid rounding to one decimal, and formally ties all four. Raw reports and JSON are preserved. The score averages above use the exact criteria; pairwise preferences retain the original JSON ties.

| Comparison | First preferred | Second preferred | Ties |
|---|---:|---:|---:|
| Low review vs Low original | 4 | 0 | 4 |
| Extra High review vs Extra High original | 4 | 2 | 2 |
| Extra High original vs Low original | 3 | 4 | 1 |
| Extra High review vs Low review | 4 | 3 | 1 |
| Extra High original vs Low review | 3 | 4 | 1 |
| Extra High review vs Low original | 4 | 2 | 2 |

Low self-review gains **0.0425** over its original. Extra High self-review gains **0.0125**. Original Extra High's mean is 0.0450 above original Low, but more graders prefer Low in that direct pairing; different-sized panel gaps explain the discrepancy. The reviewed Extra High versus reviewed Low comparison is nearly split. No general effort ranking is established.

| Criterion | Low original | Low review | Extra High original | Extra High review |
|---|---:|---:|---:|---:|
| Conceptual clarity | 9.438 | 9.475 | 9.463 | 9.475 |
| Scaffolding/pacing | 9.288 | 9.338 | 9.275 | 9.288 |
| Worked reasoning/transfer | 9.350 | 9.438 | 9.475 | 9.513 |
| Active learning | 9.213 | 9.250 | 9.300 | 9.300 |
| Correctness/precision | 9.950 | 9.950 | 9.950 | 9.950 |

Some graders value Extra High's concrete full-matrix calculation, broader projectors and explicit joint-probability comparison. Others favor Low's more compact route and lighter symbolic load. The sequencing change in Extra High review has mixed preferences. This is consistent with a tradeoff rather than a decisive improvement from more reasoning effort.

## Verification and grading limitations

Root read the complete new original, revision diff, review and notes, and every grader report. Exact matrix calculations verify the examples and all new answer keys. The two Low files retain their prior checks and hashes. All **13 underlying questions / 26 key occurrences** across four texts are correct; every question remains unchanged within its review pair. All outputs pass the actual app parser and question checks. No graphs, rendered interactions or human-learning outcomes were measured.

**The graders made significant attribution mistakes.** Reader 1 credits Extra High review with adding material actually moved from the original. Reader 2 calls the two distinct Low files identical. Reader 3 justifies its Low preference using the Extra High mixture example and fifth question. Reader 4 attributes the Low review's new tensor-bra explanation to Low original and claims a shared Extra High proof is missing from one version. Reader 5 also attributes Extra High examples to Low original. Reader 6 mislocates the moved block. [content-audit.md](content-audit.md) records details. Raw scores remain intact, with no selective reruns, filtering or rescoring.

Consequently the score differences should not be treated as a precise measurement of effort or review benefits. There is only one original and one review per effort level, all eight graders share those outputs, and near-identical revisions are demonstrably difficult for this grader family to track. The unchanged Low pair receives different gains here than in the preceding experiment, illustrating comparison-context and reviewer variation. Absolute scores across studies are not a common ruler. No billing or token-efficiency comparison was measured.

The defensible result is **a near tie in this sample**, with a narrow numerical lead for Extra High self-review. It does not justify claiming that Extra High reliably improves these lessons or that its review is unnecessary. Production behavior stays unchanged.

[aggregate.json](aggregate.json) preserves all criteria, assignments, preferences and confidence statements. [protocol.md](protocol.md) records the frozen design. The [complete archive](experiment-records.zip) includes exact inputs and wrappers, original provenance, reviews, notes, diff, all lessons, anonymous packets, raw grades, validation scripts and hashes. The four lesson files are also available individually beside this report.
