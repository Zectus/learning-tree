# Content and feedback audit

Root read both revised lessons in full, both critiques and revision notes, and the complete draft-to-final diffs. The reused controls retain the previous pilot's content audit. No new grade was authored and no lesson or raw grade was repaired. This is a separate factual check, not an independent blind teaching-quality judgment.

All **20 final keys (12 main, eight bonus)** are correct and uniquely defensible for their stated task. No substantive mathematical or scope defect was found in a delivered lesson. The app's parser and graph-expression checks pass all four final outputs. Graph checks concern source expressions and textual claims, not runtime screenshots.

| New final | Main keys | Bonus keys |
|---|---|---|
| task_02 | C: cancellation gives limit 6 without a point value; B: limit 5 and point value 12 are compatible; D: four samples suggest but do not establish limit 1 | E: limit of 8-2x at 4 remains zero after a point change; A: a positive squared difference can approach zero |
| task_04 | C: near -1 the outputs can approach 6 despite point value 10; B: cancellation gives limit -2 while g(-1)=7; D: 100 samples do not determine unexamined nearby behavior | A: p(x)-2=3(x-4) gives limit 2 despite point value -5; E: agreeing off zero preserves limit 5 but not the exact point value |

Both revised lessons restrict cancellation correctly, justify nearby behavior from the full rule rather than finite data, distinguish point value/limit/approximation, and remain within the informal scope. The controls' ten keys were independently checked in node-skill-pilot/content-audit.md; their saved hashes are unchanged.

## Actual feedback and revision

- task_02's critic found no mathematical errors, suggested a concrete graph-reading bridge and a reference from the general definition back to the distance example. Sol added these two small clarifications. It left the already adjacent graph caveat and declined an optional unscored self-explanation prompt. All five question keys are unchanged.
- task_04's critic suggested clearer opening wording, an explicit interpretation of the distance identity, and replacing a distractor about absence of nearby domain points. Sol made those three edits. The distractor change removes an unnecessary domain-convention edge case; it is not evidence that the original keyed answer was mathematically wrong under the usual accumulation-point convention.
- The second critic also falsely claimed that the reassigned graph point (2,9) is not isolated because the line accumulates around it. The other graph points lie on y=x+2, separated from (2,9) by a positive distance. Sol correctly rejected that criticism and retained the valid wording.
- Sol's revision note gives that distance as 7/sqrt(2), which is an arithmetic slip: the correct perpendicular distance is 5/sqrt(2). The conclusion that the point is isolated is nevertheless correct. The incorrect distance appears only in the process note, not in the final lesson. Both the critic's false claim and the note's slip remain preserved; neither was silently repaired.

Root observed and recorded both draft hashes while the critics were running. The draft files still have exactly those hashes after final delivery. Each workflow used exactly one fresh Luna critic, with the requested model and fresh history, before one revision. Neither critic was used as a final grader. All four final evaluation reports were read; no consequential factual error or arithmetic discrepancy was verified in those reports. Their preferences about summary tables, explicit distance equations, repeated cautions and practice variety are teaching judgments.
