# Node lesson prompt study — final findings

Completed October 30, 2026. The study saved **44 unique lessons across six nodes**, obtained **60 fresh blind Luna evaluations**, and separately checked **243 answer keys**. The last grading round finished before the usage limit; its aggregation and documentation have now been finalized. The additional four-node test was prepared but never started.

**The best-supported general prompt is the smaller “coherent” revision.** Across its six direct node comparisons with the current prompt, its equal-node mean is **9.5044 versus 9.4122**, with **27 blind preferences to 8, plus one tie**. It leads the mean on every tested node. The improvement is modest, and the results do not demonstrate uniformly near-perfect lessons or actual human learning.

The strongest combined revision initially won the tuning comparison, then lost its lead on new topics. The newest revision improved the limits sample set but weakened quantum transfer. Neither should be selected simply because it is newer or contains more teaching instructions.

## The prompt to keep

- [Reusable prompt text](best-performing-prompt.txt): the winning teaching instructions rendered through the app's existing assembly, with clearly marked context placeholders.
- [Exact calculus input](best-performing-prompt-limit-example.txt): the complete prompt actually given to a coherent-condition limits writer, byte-for-byte. This includes its real node context and Spanish output-language instruction.
- [Exact tested source](best-performing-prompt.js): byte-identical to variants/coherent.js, with no additional cleanup after the experiment.
- [Changes from the current prompt](best-performing-prompt.diff) and [file hashes](best-prompt-manifest.json).

The reusable text's context placeholders are NODE_TOPIC, NODE_ID, NODE_SCOPE, TREE_TOPIC, PREREQUISITE_LABEL, PREREQUISITE_SCOPE, LATER_TOPICS and OUTPUT_LANGUAGE. Prerequisite label/scope lines should contain the actual already-taught material, repeated as needed; an entry node instead uses the app's first-topic statement. The exact calculus input needs no placeholder replacement. These are English generation instructions; the requested lesson language remains a per-node choice.

The source is **45,780 characters**, versus the baseline's 46,365: **585 characters, or 1.26%, shorter**. Rendered input lengths vary with the node context. The source SHA-256 is `f629442764c4a507f6a0dab6b1ea5551982ad1b9c52076d34746af9f21765ea8`.

The app's node prompt has been updated to the exact tested coherent source. The experimental baseline is preserved from commit 70207a6. Output grammar, language selection, the parser and runtime behavior are unchanged; no runtime fallback was added. The report and frozen prompt are also saved in the repository's documentation.

## What changed, and why it matters

The winner preserves the baseline's explanation, derivation, worked-use, scope, notation and independent-answer-checking requirements. Its changes concentrate on pacing and conflicting instructions:

1. Let the reader complete one understandable use before accumulating qualifications, representations and cases. Introduce a caution where it matters and repeat it only when a new distinction requires it.
2. Separate teaching from answer leakage. General instruction and worked cases must prepare the learner; the visible lesson must not solve a quiz's particular setup or evaluate its options.
3. Allow limited early scaffolding when recall is not the skill being tested, while leaving the intended inference and later tool choice to the learner.
4. Place questions at manageable pauses after the required teaching, rather than interrupting necessary reasoning or postponing all checks.
5. Reuse an adequate graph and explain genuine representation limitations. Preserve the positive expectation of useful graphs without requiring a duplicate for every section.

One exact pacing instruction captures the central change:

> Let the reader complete one understandable use of the central idea before adding several qualifications, representations, or cases. Introduce notation and cautions where they first do useful work. State a limitation clearly once; return to it only when the next task needs a new distinction. If the opening carries too many new elements, distribute them across the progression rather than shortening the reasoning that makes the idea understandable.

The experiment tests this package, not the isolated effect of each sentence. It does not establish that graph reuse, early cues or this paragraph alone caused the gain.

## Models and comparison design

Every new lesson used **GPT 6.1 Sol, low reasoning effort, fresh history**. No outdated Sol model was substituted. Each condition/node used two identical rendered inputs to obtain two independent first outputs. Outputs were retained without quality selection or replacement. Exact prompt files, wrappers, source hashes, model arguments and completion records are archived per round.

Each node comparison had three conditions and six fresh **gpt-6-luna** graders, one for each presentation order. A grader saw three anonymously labeled lessons, a neutral reader/scope brief and the same rubric. Each author output was rated three times, once in each position. No grader was reused between packets. The blinding was procedural—agents were instructed to read only assigned files—not a separate filesystem security boundary.

The reader was an average first-time learner who actively reads, works examples, answers questions and uses the supported graphs, with exactly the existing tree's scope and prerequisites. Calculus lessons were in Spanish and quantum lessons in English; all generation instructions were English. No scope or reader background was softened for a candidate.

The five equally weighted criteria were conceptual clarity/motivation; scaffolding/pacing/load; worked reasoning/transfer; active questions; and mathematical correctness. Above 9.5 was anchored as mostly minor polish; above 9.8 as no important teaching weakness. These anchors differ from some earlier chat experiments, so their absolute scores should not be directly pooled with this study.

Round 1's coordinator was explicitly Sol low; its Luna spawns omitted an effort override. Resumed Rounds 2–4 also specified the Luna model and fresh history without an effort override, under coordinators with different inherited settings. The tools did not expose the resolved grader effort. The within-round comparisons remain matched, but this is an additional reason to emphasize direct comparisons rather than small changes in absolute scores between rounds.

## Candidates

| Candidate | Change from baseline | Source characters |
|---|---|---:|
| Baseline | Current English app node prompt, derived from the October 12 version | 46,365 |
| Application | More explicit meaningful worked use, planning backward from an achievable learner action, plus pacing protection | 47,695 |
| Coherent | Pacing, answer-secrecy/scaffolding consistency and graph-reuse repairs | 45,780 |
| Synthesis | Coherent plus application's stronger worked-use orientation | 46,659 |
| Guided | Synthesis plus finer staging, a residual conciseness/scaffolding repair and plausible misconception-based distractors | 47,143 |

The variants contain no new topic-specific teaching examples, fixed section/question/word quotas, changed reader prerequisites or model substitutions. Guided was frozen before the transfer-test results; it was not rewritten after seeing its lessons.

## All completed rounds

All numbers below are exact-mean aggregates rounded to four decimals. Preferences and generation counts matter alongside the means.

| Round | Node set | New lessons | Reused references | Fresh graders | Mean scores |
|---|---|---:|---:|---:|---|
| 1: initial pilot | Limits intuition; relative phase | 12 | 0 | 12 | Baseline 9.4150; application 9.4533; coherent 9.5200 |
| 2: combination | Same two tuning nodes | 4 | 8 | 12 | Application 9.4583; coherent 9.5033; synthesis 9.5350 |
| 3: transfer | One-sided limits; chain rule; bra-ket notation; partial trace | 24 | 0 | 24 | Baseline 9.4108; coherent 9.4967; synthesis 9.4358 |
| 4: further revision | Original two tuning nodes | 4 | 8 | 12 | Baseline 9.4917; synthesis 9.5217; guided 9.4833 |

There are 60 lesson slots across rounds but **44 unique saved outputs**; reused references do not become new author samples. Likewise, 60 graders are not 60 independent lesson generations.

### Round 1: small, promising gain

| Node | Baseline | Application | Coherent |
|---|---:|---:|---:|
| Limits intuition | 9.4500 | 9.5033 | 9.5633 |
| Relative phase | 9.3800 | 9.4033 | 9.4767 |

Coherent beat baseline 4–2 on limits and 5–0 with one tie on phase. Against application it won limits 5–1 and split phase 3–3. This supported testing coherence repairs further, rather than treating either application's useful worked examples or coherent's higher mean as a universal answer.

The table includes the original quantum grader's factual correction, described below. Before that correction, baseline's mean was 9.3900 rather than 9.4150. Original reports and aggregates remain preserved.

### Round 2: the combination leads on tuning topics

| Node | Application | Coherent | Synthesis |
|---|---:|---:|---:|
| Limits intuition | 9.4733 | 9.4933 | 9.5167 |
| Relative phase | 9.4433 | 9.5133 | 9.5533 |

Synthesis led both means narrowly. However, application beat it 4–2 in limits preferences; synthesis beat application 5–1 and coherent 4–2 on phase. The mean lead therefore concealed mixed preferences on the simpler node.

Reviewers repeatedly valued a concrete closeness/accuracy calculation and a general unequal-amplitude interference prediction. They also described the cost of introducing many representations or qualifications together. Combining the desirable features was promising, but required new-topic evidence.

Eight references were reused under exact input equality. Of the four new lessons, task_06's complete first output survived the usage interruption but its original final-status message could not be recovered. The file was retained, validated and hashed; it was not regenerated. This provenance qualification is recorded separately from the unchanged original launch log.

### Round 3: the smaller revision transfers better

These four nodes were selected before the pilot results. All 24 lessons were fresh; neither output nor scope was selected to favor a candidate.

| Node | Baseline | Coherent | Synthesis | Coherent vs baseline preferences |
|---|---:|---:|---:|---|
| One-sided limits | 9.2967 | 9.4000 | 9.3933 | 4–2 |
| Chain rule | 9.3667 | 9.5333 | 9.5233 | 5–1 |
| Bra-ket notation | 9.5133 | 9.5400 | 9.3867 | 4–2 |
| Partial trace | 9.4667 | 9.5133 | 9.4400 | 5–1 |

Coherent led all four means, beat baseline **18–6**, and beat synthesis **15–7 with two ties**. Synthesis split each calculus preference comparison with coherent 3–3, but lost bra-ket 1–5 and partial trace 0–4 with two ties. Its earlier tuning lead did not generalize reliably.

The recurring strengths were concrete bridges: an exact area-change expansion before the chain-rule argument; solving for a projector coefficient through an orthogonal residual; and constructing a reduced state from local probabilities before showing its basis-index rule. The recurring weakness was density, particularly when multiple notations, equivalent formulas and general proofs arrived together.

Synthesis's weaker bra-ket result was concentrated in one output: its two output means were 9.2333 and 9.5400. Coherent's chain-rule output means were 9.4000 and 9.6667. These differences are larger than many condition-level gaps, so neither mean scores nor a single polished example justify a deterministic claim about a prompt.

### Round 4: extra staging helps one topic and hurts another

| Node | Baseline | Synthesis | Guided |
|---|---:|---:|---:|
| Limits intuition | 9.4900 | 9.4833 | 9.5433 |
| Relative phase | 9.4933 | 9.5600 | 9.4233 |

Guided beat baseline 4–2 on limits but lost phase 1–5. It split limits with synthesis 3–3, then lost phase 0–5 with one tie. Its later generation date did not earn it a better overall result.

Guided's richer limits sample explained absolute value as distance, used a concrete accuracy target, and tested a finite-sample-compatible counterexample. The cost was additional notation. Its phase lessons staged the initial distinctions and added checkpoints but omitted a worked general unequal-magnitude derivation. The established matrix still made the questions solvable; nevertheless, graders consistently found the transfer support thinner. The worked-reasoning criterion was 9.0333 for guided phase versus 9.6833 for synthesis phase.

This is a useful failure: **smaller steps do not compensate for removing the connecting reasoning that makes a method reusable**. It is not proof that early scaffolding or plausible distractors are harmful—the guided package changed several things, so those effects remain unisolated.

## Overall comparison and what it establishes

For the broad recommendation, pool only the direct baseline/coherent comparisons in Rounds 1 and 3, weighting each of the six nodes equally. Both conditions have two independent authors per node. Exclude repeated ratings of reused references in Rounds 2 and 4 from this pool.

| Prompt | Six-node mean | Head-to-head wins | Ties |
|---|---:|---:|---:|
| Coherent | 9.5044 | 27 | 1 |
| Baseline | 9.4122 | 8 | 1 |

The mean gain is **0.0922 out of 10**. The direction repeats across all six node means and the four new-topic preference comparisons. That makes coherent the best-supported general candidate in this study. It does not make it a decisive universal winner: coherent and synthesis are close on several topics, and application/guided did not receive the same breadth of fresh-node testing.

The original ambition of consistently near-perfect lessons was **not met**. Coherent's one-sided-limits mean is 9.40, load concerns remain, and the score gains are small. The study stopped because of the usage limit, not because every topic reached 9.8 or because model scores established human learning.

## Correctness, grader mistakes and sensitivity

All 44 unique lessons passed the app's source-level structural checks. The separate audits checked **156 main and 87 bonus keys** and found no substantive wrong key, calculation or scope violation. The 24-lesson transfer audit additionally verified conjugation/index conventions, basis invariance, local probabilities and zero-intermediate-change arguments, using symbolic checks for nontrivial arithmetic. This is a source-level audit: runtime graph screenshots and actual learner interaction were not tested.

Four factual grading mistakes were verified:

1. **Round 1, phase reader 6:** the grader reversed output labels and called a correct certainty condition wrong. The same grader confirmed its mistake and changed only correctness from 8.5 to 10. Original files and raw aggregate are preserved; rankings were unchanged.
2. **Round 2, limits reader 5:** the report said no question challenged a conclusion from finite samples, overlooking a bonus that asks exactly what additional information is sufficient. No score was changed; a narrower preference for a main-path check could still be reasonable.
3. **Round 3, chain-rule reader 5:** the report claimed Bonus 1 was keyed C and that C lacked 24x. The saved key is E, which is the correct complete derivative; C contains 24x but lacks another factor. This false claim supported correctness 9.2 and active learning 8.8. The old grader session ended before the planned factual adjudication; its raw scores remain unchanged.
4. **Round 4, phase reader 5:** the report said baseline task_07 never generalized to arbitrary magnitudes. Its Section 3 explicitly derives the general formula and works an unequal-magnitude example. The absence claim is false; raw scores and rankings remain unchanged.

There was also one arithmetic error: Round 3 one-sided reader 1 reported 9.08 where its criteria average to 9.28. Aggregation uses the exact 9.28 and preserves the reported criteria and ranking. No discretionary score adjustment was made.

The unresolved Round 3 penalty does not decide the broad winner. Even hypothetically setting **both** affected criteria to their maximum 10 raises that round's baseline mean only to **9.4275**, below coherent's 9.4967. It raises the six-node baseline to **9.4233**, below coherent's 9.5044. The affected lesson's individual score could rise only to 9.62, still below its panel alternatives at 9.64 and 9.72. These are explicit upper bounds, **not replacement grades**; [the sensitivity calculation](round3/adjudication-sensitivity.json) retains that distinction.

Small local rankings should remain tentative. Re-reviewing every report does not turn Luna judgments into ground truth, and blanket correctness praise is not evidence that the grader checked each key. Independent factual verification matters even when teaching-quality judgments are blind.

## Lessons for further prompt work

- Preserve a visible reasoning bridge and a worked use, then leave a genuinely achievable step to the learner. A general formula plus a substitution check is not automatically a derivation; more checkpoints are not automatically better transfer.
- Repair conflicting absolutes before adding more requirements. General teaching is necessary preparation, while exposing a quiz's particular solution defeats its purpose. Recall, interpretation and tool choice need different levels of support.
- Keep caveats local and purposeful. Many are essential, especially in quantum operations, but collecting all of them before the first usable result increases load.
- Judge the learning function of examples and graphs, rather than their count. Reuse can reduce incidental notation and let the learner see the same mechanism across successive tasks.
- Keep simple checks when they test a newly learned interpretation. Requiring every question to be novel in every respect can add unrelated difficulty. Later transfer still needs meaningful independent work.
- Preserve adequate worked support when simplifying. The guided phase result demonstrates the risk of trading a reusable derivation for a smoother surface sequence.
- Treat reviewer feedback as evidence to verify, not a literal instruction list. Several criticisms misdescribed the source, and score variability exceeded many prompt effects.

Some reviewers requested explanatory feedback after answers. The current viewer supplies correctness and the correct letter, while the prompt keeps question-specific solutions out of visible prose. Hidden explanatory feedback would require a deliberate format/product change; it was not tested or added here.

The winning prompt also retains an unresolved tension: its old CONCISENESS paragraph discourages naming a tool, while its revised scaffolding rule permits limited early cues. Guided repaired that paragraph as part of a larger package, but did not establish that the isolated repair helps. The exported winner is deliberately the exact tested version, not an untested final mixture. An isolated follow-up could test that repair, preservation of general worked transfer, and the distribution of complex proof steps.

## What did not run

The additional reserve was sigma notation, average rate of change, projective measurement and WKB tunneling. Their existing scopes were archived before Round 3 outcomes. An initial baseline/synthesis/guided plan was amended, before any author launch, to baseline/coherent/guided after coherent led the transfer test. The original plan is preserved with NOT-RUN.md; the amendment is explicit rather than represented as an unchanged preregistration.

The final planned test contains **zero generated lessons and zero grades**. It supplies no evidence about beginner summation, advanced tunneling, guided generalization or further gains. No results were inferred from prepared prompts. Usage ended the run; finalization completed saved data checks, documentation and prompt exports.

## Evidence and reproducibility

[Machine-readable results](study-results.json) contain all round means, node means, preference counts, arithmetic discrepancies, unique lesson hashes and sensitivity values. [Completion checks](completion-checks.json) validate the saved inputs, outputs, packets and report copies. The [complete experiment archive](experiment-records.zip) preserves exact inputs, outputs, assignments, launch metadata, raw reports, scores, aggregates, content audits and notes. Round 1 and Round 3 retain pre-adjudication copies. The archive also includes the neutral packets and instructions actually shown to graders. Unrun plans are labeled separately and have no lesson or grade files.

Applying the exact winning template also required narrowing an existing test that rejected the word “Continue” anywhere in a single-node prompt. The new teaching prose legitimately says to continue to new content after a question; the test now rejects the actual batch-continuation commands while preserving its other checks. This changes a test's overly broad assertion, not the teaching prompt or the single-node workflow. Final app and companion check results are saved with the records.

The study is limited to six nodes from two mathematical trees, with two author samples per condition/node and one grader model family. Repeated reviews are dependent through shared outputs; no sampling-precision or human-learning claim follows from the preference counts. Node difficulty and output language were not separately randomized. Grader calibration and style preferences remain potential influences despite order balancing and concealed candidate identities.

The durable finding is a modest, repeated advantage for the exact pacing-and-consistency revision, together with clear evidence that combining more instructions or selecting the newest revision would have been a worse general decision on these samples.
