# Two actual messages: finished lesson, then independent critique and v2

**Four fresh blind graders preferred v2, 4–0.** The criterion-recomputed mean was **9.455 for v1 and 9.545 for v2**, a **+0.090** change. Sol changed one sentence; all questions, answers, graphs and other prose were preserved.

This pilot used the requested actual two-message interaction. The first lesson was completed and delivered before the same Sol agent received any mention of a critic or v2. No first-stage draft framing or advance instruction about a later review was supplied.

## Exact sequence

1. A fresh **gpt-6.1-sol**, **low** reasoning, `fork_turns: none`, received an operational wrapper directing it to read and follow the unchanged current rendered prompt and save its requested file. The wrapper contained no draft, critique, revision or experiment language. The [original prompt](original-prompt.txt) is byte-identical to the current monolithic input used in the preceding pilots: SHA-256 `1e243d11a82752a07a91b53a53c6b69cd45c3b05be3ef8db518720b16d293715`. No teaching instructions were changed or appended. The wrapper and original prompt are both preserved in the archive; the prompt was supplied through a file, rather than pasted inline into the tool message.
2. Sol finished its first turn and returned a link to `limit_intuition.txt`. Root then copied and hashed this finished delivery as [v1.txt](v1.txt), before sending the next message. Its SHA-256 is `88dd7ba86ae96075668455d59772f434eefa1108aea7d77dc9aac27a5fac9006`.
3. Root sent the [second message](second-message.txt) using `collaboration.followup_task` to that same, now-idle Sol agent. It required one fresh **gpt-6-luna** child with fresh history, no effort override and no children of its own, using the prepared [critic prompt](critic-prompt.txt) verbatim. Sol actually launched that child and waited for it to finish. The critic saw only v1 and the neutral reader/scope brief, not the original author prompt or any previous study. Its grade and critique are preserved in [critique.md](critique.md).
4. Sol verified the feedback, made one revision, and delivered [v2.txt](v2.txt). The initial file remained unchanged. The actual critic arguments, completion status and original hash are preserved in `process.json` inside the archive. The [revision notes](revision-notes.md) explain the accepted suggestion.
5. Four additional fresh **gpt-6-luna** agents, separate from the critic, evaluated anonymous A/B versions using the unchanged five-criterion engaged-human-reader rubric. Two saw v1 first and two saw v2 first. They saw no author prompt, critiques, model identities, version labels, dates or previous scores. Packet assignments and hashes were saved before their launches. No grader feedback was sent to Sol.

The node remains `limit_intuition` from the Spanish calculus tree, with English author instructions and Spanish lesson text. The only exposed Luna model identifier here is `gpt-6-luna`; no 6.1 Luna option was available in the session's model list. The resolved inherited Luna reasoning effort was not exposed. Blinding is procedural on a shared filesystem, not filesystem isolation.

## What changed

The critic scored v1 **9.2/10**, found no mathematical errors or inaccessible tasks, and suggested slightly sharpening what “as close as we want” means. Its score is a formative review, not one of the blind comparison scores.

Sol replaced this sentence:

> Podemos pedir una cercanía aún mayor y conseguirla acercando más la entrada, sin usar nunca \(2\).

With:

> No hay una precisión final prefijada: por pequeña que sea la distancia positiva que pidamos entre el resultado y \(4\), basta tomar una entrada cuya distancia a \(2\) sea menor que esa misma cantidad, sin usar nunca \(2\).

Both versions already contain the displayed identity `f(x)-4=x-2`, the verbal statement that output and input are equally close to their destinations, and a thousandth-distance example. The edit makes the arbitrary positive tolerance explicit; it does not add the identity or repair an incorrect calculation. It uses no epsilon-delta notation and remains within informal scope.

## Blind results

| Grader | Presentation | v1 | v2 | v2 minus v1 |
|---|---|---:|---:|---:|
| 1 | v1 first | 9.56 | 9.64 | +0.08 |
| 2 | v2 first | 9.40 | 9.44 | +0.04 |
| 3 | v1 first | 9.60 | 9.70 | +0.10 |
| 4 | v2 first | 9.26 | 9.40 | +0.14 |
| **Mean** | Balanced | **9.455** | **9.545** | **+0.090** |

All values above are recomputed from each grader's five equally weighted original criterion scores. Grader 4 reports v1 as 9.3, a valid one-decimal rounding of 9.26. The raw report and JSON are preserved, and no preference changes after using the exact mean.

| Criterion | v1 | v2 |
|---|---:|---:|
| Conceptual clarity/motivation | 9.425 | 9.600 |
| Scaffolding/pacing/load | 9.400 | 9.475 |
| Worked reasoning/transfer | 9.425 | 9.600 |
| Active learning | 9.150 | 9.150 |
| Correctness/precision | 9.875 | 9.900 |

The graders consistently valued the explicit connection between a requested output tolerance and sufficient input closeness. They described the difference as small and acknowledged that a reader preferring simpler conversational language could prefer v1. Reported confidence ranged from moderate to high; that is reviewer confidence, not statistical confidence from independent lesson samples.

All praised the progression from table and graph to algebra, the careful restriction on cancellation, and the separation of limit, sample approximation and value at the point. Some wanted explanations after answers or more feedback beyond multiple choice. Those are shared limitations; the revision did not change the exercises or their feedback.

## Verification and limits

Root read v1, the complete one-sentence diff, the critique, revision notes and all four blind reports. The original delivery and prompt hashes remain unchanged after the second turn. The critic's actual task message matches the prepared prompt verbatim, apart from the file's terminal newline. Both versions pass the app's real lesson parser, question validity checks and graph-expression checks. No runtime graph interaction or human learning outcome was measured.

All five underlying question keys are correct in both versions: **D, B, C, E, A**. They respectively test cancellation giving limit 6 despite a missing value, why a limit does not determine one particular nearby evaluation, invariance of limit -1 after changing the center value, finite-table evidence, and equal limits 8 for functions with different assigned center values. No substantive mathematical error was found in either version or in the edit.

Grader 2 somewhat overstates v1's omission when saying it does not specify a direct distance match: v1 already states equal closeness and gives a numerical tolerance example. Its narrower point about v2 explicitly matching *any* requested tolerance is accurate. Grader 4's small precision-score advantage is a judgment about explicitness, not evidence of a mathematical correction. No report falsely attributes the shared equation to v2 alone. Raw evaluations remain intact without reruns or selective exclusions.

This demonstrates that the requested two-message workflow was executed and that this specific revision received a small consistent preference. It **does not establish that advance “draft” framing caused the earlier score gap**, or that hiding a planned review is generally better than announcing it. There is only one newly generated lesson pair; four graders share that pair. The earlier paired experiment's +0.105 and this +0.090 are not comparable estimates of the framing effect. Different generated lessons and reviewer calibration remain confounded, and cross-experiment absolute scores are not a common ruler.

The production prompt remains unchanged. No fallback behavior was introduced. [aggregate.json](aggregate.json) contains all criteria and paired results. The [complete archive](experiment-records.zip) preserves exact inputs, both actual messages, stage records, reviewer prompt and critique, both lessons, diff, grading packets, raw reports, model arguments, validators and hashes. [protocol.md](protocol.md) records the design.
