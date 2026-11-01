# Tree prompt rebuild

The subsequent [fresh-author comparison](../tree-prompt-study/README.md) tests actual old-prompt and rebuilt-prompt generations with separate anonymous reviewers. This document records the earlier compatibility checks and first-party walkthroughs.

Completed October 31, 2026 (America/Lima), against checkout `53afa70`. The topic and file templates now plan the full route from calibrated knowledge to a usable ability before choosing node boundaries. They share the same teaching, dependency, brief, and review instructions. The lesson prompt and app's tree schema are unchanged.

The old tree's teaching text dated to October 6 (`3389398`), whereas the lesson prompt had subsequently made reasoning bridges, supplied inputs, notation, procedures, and pacing substantially more explicit. This rebuild brings those requirements into tree planning without copying the lesson's formatting or quiz-writing instructions into it.

The main decisions are:

- Plan backward from destination abilities, then check a credible learning route, its inputs, worked use, and independent practice. Inventorying topic names serves coverage rather than determining the graph.
- Size a node by the explanation and practice it needs. New operations can belong within one coherent outcome. Try better staging before splitting; preserve the central reasoning when reducing load. Retain flexible length and graph shape.
- Distinguish calibrated background, prerequisite results, supplied inputs, and new consequences. A supplied rule can support a use-oriented goal, but cannot replace a derivation the goal promises.
- Test a prerequisite against the dependent's **full** intended ability. Retain necessary tools even if a smaller part could be taught without them. Several parents need not constitute a grand synthesis.
- Write briefs for the actual lesson handoff: own scope, direct prerequisite scopes, tree topic, and immediate future labels. Preserve essential background, indirect earlier results, and source details that the later writer otherwise cannot see.
- Calibrate with concrete tasks and adaptive follow-ups, accounting for uneven foundations. Keep questions conversational and reserve file-only delivery for the final answer.
- For file trees, reach the actual source's outcomes and preserve the statements, data, conventions, and assumptions needed to teach them without the attachment. For topic trees, resolve consequential depth ambiguity without silently narrowing the subject.

The teaching instructions remain general across subjects, with no named disciplinary example, fixed node count, lesson outline, or question quota. Scope briefs can include the particular source details they need. The rendered topic prompt is 17,683 characters versus 14,822 before; the file prompt is 19,761 versus 17,930, using the verifier's fixed inputs and no extra language clause. These lengths describe prompt cost, not teaching quality.

Validation used deterministic app tests and five **hand-authored, first-party review specimens**, not independent model generations or blind ratings. The specimens document concrete design decisions and exercise their handoff through the real app. They establish compatibility and expose reviewable scope assumptions; they do not establish how consistently an external model will follow the new instructions or how much people will learn.

| Review specimen | Decision checked | Review and executable evidence |
|---|---|---|
| Informal limits, Spanish | Keep a small unfamiliar distance convention inside a usable introductory lesson; preserve meaning and use while excluding formal quantified definitions. | Two distinct abilities, with no separate notation prerequisite. Briefs and Spanish metadata survive import/export and lesson assembly. The linear distance relation checks arithmetically. |
| Quantum operations | Preserve two independent foundations and both prerequisites for the comparison. Treat physical update prescriptions as inputs while developing their consequences. | The final brief includes the actual initial state, projectors, retained report, second measurement, and no-evolution assumption. Independent matrix calculation gives report probability 2/3 for both operations, then subsequent probabilities 1/2 and 1. Removing either parent leaves the full goal unsupported. |
| Synthetic committee memo | Reach the actual passage's numerical and evidential interpretation without substituting a broad survey. | Two independent foundations feed the source analysis. Its exact passage, counts, changing totals, and comparability limitations remain in the final lesson prompt. Recomputed rates rise from 8% to 10% despite the falling count; the brief does not infer a causal effect from that alone. |
| Approximation interval | Introduce relative error within its use, accept a supplied displacement model, and check the whole interval without requiring calculus. | One coherent node includes the error denominator, domain, units, and conditions. Direct evaluation confirms a two-second maximum, failure beyond it, and an undefined relative ratio at zero rather than a false initial validity argument. |
| Indirect context and enrichment | Preserve an early result when its direct edge is absent; keep enrichment outside the required path. | The test deliberately adds a redundant edge to the otherwise direct-only specimen. The app removes it, while the final brief retains the necessary earlier total relation and refund assumptions. Both lesson assembly paths preserve that brief; optional successive discounts block no required node. The net-revenue arithmetic is independently checked. |

All **129 app tests passed**, including seven new tree-prompt integration tests. After cleaning the indirect-context specimen to express only direct dependencies and moving the redundant-edge injection into the test, the seven targeted tests passed again. Tests cover the rendered schema examples, quoted/backslashed/newline/Unicode metadata, imports without repairs, exact brief preservation, real prerequisite scopes in single-node prompts, whole-tree work packets, prerequisite ordering, optional paths, and removal of the deliberately redundant edge. Existing tests also retain the shared-principle and calibration/final-file delivery checks for both flows, plus language and tutorial coverage.

The schema regression checks find four failures in the old **illustrative examples** and none in the rebuilt examples: dangling references in each flow, unescaped quoted topic metadata, and unescaped quoted language metadata. These are example/rendering checks, not evidence that every previously generated tree was invalid. The new examples contain a valid root and dependency; dynamic metadata uses JSON serialization. [validation.json](validation.json) records hashes, exact lengths, structural outcomes, and arithmetic results. [verify.js](verify.js) reproduces these checks.

Reproduce from the repository root:

```sh
node --check js/learn/tree-prompt.js
node --test --test-isolation=none test/*.test.js
git show 53afa70:js/learn/tree-prompt.js > /tmp/tree-prompt-baseline.js
node docs/experiments/tree-prompt-rebuild/verify.js /tmp/tree-prompt-baseline.js
git diff --check
```

Node's default spawned-file test isolation was unavailable in this managed environment. The complete app suite was run with isolation disabled; no tests were filtered or skipped. The verifier performs no network calls and accepts an optional saved baseline source file. Test specimens are in [tree-design-cases.json](../../../test/fixtures/tree-design-cases.json).
