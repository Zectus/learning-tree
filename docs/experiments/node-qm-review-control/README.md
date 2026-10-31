# Difficult QM: self-review versus independent Luna critique

**On this lesson, Sol's own review performed best.** Six fresh blind Luna graders scored the original **9.330**, a Sol self-review revision **9.457**, and a Sol revision after Luna critique **9.390**. Self-review beat Luna-assisted review **4–1, with one tie**. Both revisions beat the original **5–0, with one tie** each. The gains are small, and several graders misattributed passages between these nearly identical versions.

The useful control here is an additional Sol review/revision pass without an external critic. Earlier draft/revision tests did not distinguish the value of outside advice from the value of another Sol pass. This pilot adds that control on a difficult node. The production prompt remains unchanged.

## Node and fixed starting lesson

The node is **The Partial Trace and Reduced Density Operators**, from the calibrated [QM tree](../../../test/fixtures/quantum-tree.json). It requires calculating a subsystem's state, preserving all local measurement probabilities, proving independence from the discarded basis, and distinguishing local mixedness from joint purity and physical collapse. Density operators and entanglement are established prerequisites.

The original is the **first current/coherent-prompt replicate**, round3 task_21, from the earlier prompt study. It was chosen by condition and replicate number, not by score or by inspecting which sample would favor a treatment. Its author was **gpt-6.1-sol, low**, fresh history; its original wrapper asked for the first complete, planned and checked output and did not announce an external critique or later revision. No original lesson was regenerated and no old grade was reused.

A fresh render through the current app is byte-identical to the archived author input: SHA-256 `5309500d0c90745e7e666f2a10ed38a6b76c94783c29cf09317e13486e861b6c`. The unchanged original lesson SHA-256 is `2c7c638658e95fb109036aac14880e3fe57d306a46838d910575a0b82f25318f`. The prompt source also matches the current production source. Exact inputs and original-writer provenance are archived.

## Controlled revision branches

Two fresh **gpt-6.1-sol low** agents received identical copies of the original author prompt, completed lesson and neutral reader context. One reviewed the completed lesson itself and revised once. The other summoned exactly one fresh **gpt-6-luna** critic, waited for its completed review, verified its advice and revised once. Both preserved the starting file; neither generated replacement candidates or repeated the loop.

This deliberately uses **symmetric fresh revision contexts**, rather than retaining the original author's history for only one branch. It is a different control design from the preceding same-author, actual-two-message pilot. The baseline was completed without advance critique framing; neither branch is a continuation of that original author's full history. The results therefore do not isolate the effect of withholding a later review request from a writer.

The external critic saw only the completed lesson and neutral reader brief. Its [prompt](critic-prompt.txt) asked for the same five teaching-quality dimensions, concrete consequential improvements, verification of mathematical claims, and preservation of what already worked. It did not receive the author's giant prompt, other lessons, grades or target scores. No 6.1 Luna option is exposed in this session; the actual critic and grader identifier is `gpt-6-luna`, with fresh history and no effort override. The resolved inherited Luna effort was not exposed.

Six additional fresh Luna agents graded anonymous A/B/C packets using **all six orders**. Each text appeared twice in each position. They received the same engaged-human-reader brief and equal-weight five-criterion rubric as the earlier experiments, with no prompts, model identities, reviews, condition labels or earlier grades. Blinding was procedural on the shared filesystem, not enforced file isolation. No final feedback went back to the revision agents.

## What the revisions changed

**Sol self-review:** added the concrete action of the environment bra on a product ket, explaining how it leaves a vector on the retained subsystem. It also expanded the worked off-diagonal entry into its two amplitude products before giving the result. These two small additions connect abstract notation directly to an executable calculation.

**Luna-assisted review:** added explicit row/column labels before the indexed trace derivation and a sentence linking local projectors to each outcome of a projective measurement. Sol declined to introduce generalized measurement effects or add questions and graphs. The critic found no mathematical error; its formative score was 9.0, separate from the final blind scores.

Both revisions preserved every question and answer, example, derivation and section sequence. Neither reconstructed the lesson, and neither repaired a wrong calculation. Exact final lessons, both reviews, revision notes and diffs are in the [complete archive](experiment-records.zip).

## Blind results

| Panel | Presentation order | Original | Self-review | Luna-assisted |
|---|---|---:|---:|---:|
| 1 | Original, self, Luna | 9.46 | 9.60 | 9.50 |
| 2 | Original, Luna, self | 9.38 | 9.60 | 9.50 |
| 3 | Self, original, Luna | 9.18 | 9.24 | 9.24 |
| 4 | Self, Luna, original | 9.48 | 9.48 | 9.54 |
| 5 | Luna, original, self | 9.28 | 9.48 | 9.36 |
| 6 | Luna, self, original | 9.20 | 9.34 | 9.20 |
| **Mean** | All six orders | **9.330** | **9.457** | **9.390** |

Self-review gains **+0.127** over the original; Luna-assisted review gains **+0.060**. The self-review lead over Luna-assisted review is **0.067**. These are exact means rounded for display. All raw reported overall scores equal their five-criterion averages.

| Criterion | Original | Self-review | Luna-assisted |
|---|---:|---:|---:|
| Conceptual clarity/motivation | 9.283 | 9.433 | 9.383 |
| Scaffolding/pacing/load | 9.017 | 9.250 | 9.117 |
| Worked reasoning/transfer | 9.217 | 9.467 | 9.300 |
| Active learning | 9.133 | 9.133 | 9.150 |
| Correctness/precision | 10.000 | 10.000 | 10.000 |

Graders who preferred self-review valued its concrete tensor-bra action and explicit amplitude products. They placed those additions at an actual point of cognitive friction. The Luna version's index orientation and outcome framing were useful but generally less helpful for carrying out a calculation. Remaining shared concerns were dense sequences of symbolic proofs and limited explanatory feedback after multiple-choice answers. Some readers may prefer the original's compactness; all versions retain a strong teaching sequence.

The main original strengths remain substantial: the motivation tests more than one local basis, the trace rule is derived from measurement probabilities, the coherence example is predictive, the environment-basis cancellation is both general and concrete, and the final joint-measurement comparison prevents treating a reduction as collapse.

## Verification and reviewer reliability

Root read the original, both diffs, all reviews and revision notes, and all six grader reports. Exact symbolic and matrix checks confirm the worked reductions, local probabilities, purity values, phase cancellation and **all six underlying question keys** across all three versions. The questions are byte-identical. All files pass the app's actual parser and question checks; no graph blocks are present. No substantive mathematical or physical defect was found. [math-audit.json](math-audit.json) and the [content audit](content-audit.md) record the checks.

**Some reviewer descriptions are wrong.** Reader 3 attributes the added row/column explanation to the original. Reader 4 treats original and self-review as identical and credits both with the new tensor-bra explanation, which is only in self-review. Reader 6 treats original and Luna-assisted as identical, overlooking the latter's two added sentences. Reader 3's prose leans toward Luna over self, but its formal JSON gives a tie; aggregation retains that tie. All raw evaluations are preserved without selective reruns, exclusions or rescoring.

These errors limit confidence in the tiny numerical gaps, despite several graders reporting high confidence. The readers that accurately identify both sets of edits favor self-review, but this is an audit observation, not a replacement filtered score.

## What this supports

For this fixed hard-QM lesson, **one additional Sol self-review found more useful teaching edits than the Luna-guided branch**. The external review did not demonstrate added value over another Sol pass. This is evidence for testing the simpler self-review step further before making an external critic mandatory.

It is not evidence that Luna criticism is generally harmful, that self-review always wins, or that this resolves the earlier draft-framing hypothesis. There is one source lesson and one stochastic revision per method; six graders repeatedly judge the same outputs. Reviewer and critic share a model family. Scores are near the ceiling and sensitive to attribution errors. Human learning outcomes, costs and token usage were not measured. The earlier calculus results and these absolute scores are not a common scale.

No production prompt, app behavior or fallback was changed. [protocol.md](protocol.md) records the design fixed before agent launches. [aggregate.json](aggregate.json) preserves criteria, rankings, confidence and pairwise results. The [archive](experiment-records.zip) contains exact prompts/wrappers, original provenance, immutable starting text, both revised outputs, reviews and notes, critic spawn record, frozen packets, all raw grades, diffs, validators and hashes.
