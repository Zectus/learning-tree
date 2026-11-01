# Fresh tree prompt comparison

Completed October 31, 2026 (America/Lima). **The rebuild showed a small advantage in teaching-brief completeness. This test did not demonstrate a general improvement in learning-path quality.** Both prompts produced strong trees; reviewers accepted their different proof routes, decompositions, and graph shapes. The production prompt remains byte-identical to the rebuilt source tested here.

There were **16 fresh tree generations**: two authors for each of two prompts across four subjects. Eight separate fresh reviewers assessed the trees anonymously, giving 32 tree ratings. Every first completed output was retained. This is a model-generated comparison with independent reviewer histories, not a human learning trial.

The baseline is the tree template at `53afa70`, whose teaching body dates to October 6. The rebuilt template was frozen before generation. [protocol.md](protocol.md), [rubric.txt](rubric.txt), [cases.json](cases.json), and [manifest.json](manifest.json) record the design, reader backgrounds, destinations, assignments and hashes. None of the earlier hand-authored specimens was used as an output in this comparison.

| Subject | Old prompt mean | Rebuilt mean | Old / rebuilt node counts |
|---|---:|---:|---|
| Spanish polynomial derivatives and their rules | 5.00 | 5.00 | 9, 9 / 7, 6 |
| Reliable HTTP retries | 4.75 | 5.00 | 16, 15 / 11, 9 |
| Diagnostic-assay source argument | 4.94 | 5.00 | 7, 6 / 4, 4 |
| Synthetic archive policy and its cases | 4.88 | 5.00 | 6, 6 / 2, 2 |
| Equal-subject mean | **4.89** | **5.00** | |

These are descriptive means on an anchored **integer 1–5 rubric**, not precise measurements of teaching quality. A 5 means ready with only minor polish; it does not mean perfect. Four criteria were weighted equally: correctness/destination, prerequisite sufficiency, teachable scope/progression, and lesson handoff. Both conditions received 5.00 on prerequisite sufficiency and scope/progression. Most differentiation was in handoff completeness: 4.69 for the old prompt and 5.00 for the rebuild. The coarse scale has a substantial ceiling effect.

Comparing each reviewer's average over the two authors per condition gives **five rebuilt advantages and three ties**, with none favoring the baseline. These are eight reviews of only four subject sets, not eight independent subject replications. In every subject at least one baseline output tied all rebuilt outputs at the highest rating. The data support a narrow consistency gain in these samples, not a decisive universal winner. See [results.json](results.json) for individual-output and reviewer-level results.

The findings behind the scores were concrete:

- **Calculus was a four-way tie for both reviewers.** Difference-of-powers factorization, repeated-product induction, and an exact-increment argument all supplied valid routes to the polynomial rules. The extra old-prompt stages had actual purposes. Neither reviewer found a demonstrated overload, missing prerequisite, circular proof, or omitted target ability.
- **One old-prompt HTTP tree left a timing requirement implicit.** It explicitly checked time after a wait and before a send, but did not require a clock check after the active send settled and before accepting its response. Both reviewers identified the delayed-timer case: a response observed at 110 ms can precede an overdue timeout callback even when the absolute deadline is 100 ms. The final brief also transmitted the waiting contract more clearly than its active-attempt contract. Both rebuilt outputs and the other baseline output explicitly covered result-acceptance checks. This is an underspecified teaching obligation, not an observed bug in executed client code. The reviewers differed on severity but agreed on the limited repair and numeric ratings.
- **One old-prompt policy tree omitted the actual 09:00–17:00 rule everywhere.** It referred to “the stated weekday hours” and supplied Tuesday 11:00 as a passing case. The later writer cannot infer both boundaries from that example. Both reviewers scored this as a small source-handoff omission; all supplied case decisions were correct. The six-node baseline and two-node rebuilt decompositions were otherwise accepted equally.
- **One diagnostic root referred to an unavailable source.** Its `expected_counts` brief asked for a contrast with “the excerpt's stipulated population split” but contained no numerical source inputs and had no prerequisites. One reviewer lowered its handoff score; the other gave the whole tree a 5 and described related input restatement as optional polish. Both agreed that the terminal numerical argument was mathematically reconstructible.

An initial coordinator concern about the diagnostic tree was too strong: it omitted the explicit assay rates, but its terminal brief supplied enough counts to recover them as 360/400 = 0.90 and 980/19,600 = 0.05. That is a clarity issue rather than an impossible derivation. The root's separate demand to discuss the unavailable excerpt remains a real local handoff omission. The raw reviews and grades have been preserved; no reviewer was asked to revise a score to favor either condition. [content-audit.md](content-audit.md) records the factual checks and this distinction.

The rebuilt trees consistently used fewer nodes with denser briefs: **45 versus 74 nodes**, with **60,995 versus 47,515 brief characters** across eight outputs per condition. This is an observed structural and writing-cost change. The reviewers found both groupings viable; fewer lessons are not evidence of better learning, shorter total study time, or reliable one-sitting durations.

Minor suggestions also applied to rebuilt outputs: clarify units on numerical model variables, use separate symbols for a coefficient and an evaluation point, define whether a supplied HTTP send includes response-body completion, and state uniformity when supplying a full-jitter random draw. These were rated polish rather than demonstrated failures of the requested goals. No further production wording was added after seeing these results, so the saved rebuilt source is the actual tested version.

Both versions received identical **completed calibration records** with concrete learner answers and confirmed destinations. That isolates post-calibration tree design. Adaptive calibration itself was not tested. No downstream lessons were generated and no human learner outcomes were measured. Authors and reviewers all inherited the session's model/effort configuration without overrides; this does not establish cross-model behavior. Blinding was procedural through allowed-file instructions rather than a separate filesystem security boundary. Reviewers could still infer likely provenance from prose style. The clear task records and capable authors may also reduce differences that appear in less constrained use.

The artifact layout is:

- `source/`: exact baseline and rebuilt JavaScript templates.
- `generation/task_XX/`: exact rendered prompt, completed calibration context, combined input, optional source attachment, first tree, and app-imported tree.
- `review/SUBJECT_READER/`: neutral packet, instructions, and original anonymous report.
- `author-wrapper.txt`, `author-completions.json`, `reviewer-completions.json`: generation wrapper and completed-task records.
- `output-audit.json`, `review-assignments.json`: structural audit, import results, anonymous-label mapping and packet hashes.
- `results.json`: unblinded individual ratings and equal-subject aggregation.

Each author had fresh history and read one assigned prompt only. Each reviewer had fresh history and read neither generation prompt. Review order was balanced so that each condition occupied each of the four positions across the two reviewers. Graphs were inspected through the real import behavior before review; all 16 were valid DAGs, and no transitive edges were removed. App tests were not rerun for this study.

To reproduce the saved-output audit and aggregation from the repository root:

```sh
node docs/experiments/tree-prompt-study/prepare-review.js
node docs/experiments/tree-prompt-study/summarize.js
```

Those commands process the retained model outputs; they do not regenerate authors or reviews. The archived prompts, wrapper, rubric and mappings support a new generation round, whose outputs would be new samples rather than an exact replay.
