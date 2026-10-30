# Small pilot: giant prompt versus skill-style files

**The giant prompt slightly outperformed the modular version in this pilot.** The mean was **9.625 vs 9.505**, with **two giant-prompt wins, zero modular wins and two ties**. This is preliminary evidence from one node and two author outputs per condition; it does not establish that modular prompts are generally worse.

Only idea 1 was tested. **Idea 2 was not tested:** writers worked independently, never summoned a Luna critic, never received the graders' feedback and never revised a lesson from it. Their ordinary planning and self-check were retained in both conditions because those were already in the original prompt.

## What was compared

Both conditions used the current winning coherent prompt and the familiar Spanish calculus node `limit_intuition`, with the same original scope, prerequisites and output language. Four fresh authors—two per condition—were all explicitly **GPT 6.1 Sol, low effort, fresh history**. No old model substitution, lesson reuse, regeneration or quality selection occurred.

| Giant prompt | Skill-style files |
|---|---|
| One complete input file | A SKILL.md entry point plus six reference files |
| Same teaching and formatting rules in one sequence | Planning, format, teaching, graphs, questions and final review routed to separate files |
| 44,507 source characters | 4,117-character entry; 45,118 characters across the complete bundle |

Every character of the original prompt was retained verbatim exactly once in the modular bundle. Reconstructing the original segments gives the same SHA-256. The treatment moves node context into the entry file and adds 611 characters of routing/frontmatter. Thus the experiment tests **skill-style organization and retrieval**, including that routing/order change; it does not isolate file count alone.

The entry instructs the author to read planning, format and teaching before drafting, graphs before using a graph, question construction before writing questions, and review for the final pass. Both modular authors report reading all seven files. One reports revisiting references during review. These are self-reported file-read lists, not token-usage telemetry or proof of precisely when each drafting step happened.

The modular entry is about 91% shorter than the giant prompt, but **the full rules are not shorter**: their total is about 1.4% larger. This pilot does not demonstrate token savings, context eviction, faster execution or lower cost. It uses a filesystem-equipped agent with ordinary SKILL.md-style files, not a platform-specific native skills loader.

The actual experimental package is available at [source/skill/SKILL.md](source/skill/SKILL.md). It contains the test node's context; it is an experiment artifact, not a newly installed app feature.

## Blind grading

Four fresh **gpt-6-luna** graders compared finished lessons using the previous study's five equally weighted criteria, adapted only from three labels to two: conceptual clarity, scaffolding/load, worked reasoning/transfer, active learning, and correctness. They judged an engaged first-time human reader with the tree's stated background. They saw no author prompts, packaging identity, model identity, prior grades or other reports. Grader effort had no explicit override; the resolved inherited setting was not exposed.

Two graders received the giant-prompt lesson first and two received the modular lesson first. Every saved output was rated twice, once in each position, and all four cross-condition output pairings occurred once. Assignment, source and split hashes were frozen before generation. Repeated ratings of a shared output are not independent generations.

| Panel | Order | Giant prompt | Modular | Preference |
|---|---|---:|---:|---|
| 1 | Giant first | 9.52 | 9.52 | Tie |
| 2 | Modular first | 9.54 | 9.36 | Giant |
| 3 | Modular first | 9.78 | 9.48 | Giant |
| 4 | Giant first | 9.66 | 9.66 | Tie |
| Mean | Balanced | **9.625** | **9.505** | **2–0, two ties** |

| Criterion | Giant prompt | Modular |
|---|---:|---:|
| Conceptual clarity/motivation | 9.575 | 9.450 |
| Scaffolding/pacing/load | 9.500 | 9.325 |
| Worked reasoning/transfer | 9.600 | 9.400 |
| Active learning | 9.450 | 9.350 |
| Correctness | 10.000 | 10.000 |

The two giant-prompt output means were 9.650 and 9.600; the modular output means were 9.440 and 9.570. Scores from different graders of the same output varied by up to 0.26, larger than the 0.12 condition-mean difference. No sampling precision or significance claim is warranted.

## What the graders valued

The giant-prompt lessons more often made the distance relationship an explicit reusable equation, paired it with a summary distinguishing the function value, one nearby output and the limit, and included transfer to functions that agree only in a punctured neighborhood. Readers 2 and 3 credited those features when preferring them. Those are properties of the generated samples, not proof that one file necessarily causes them.

The modular lessons were also strong. Reader 1 valued the earlier algebraic explanation and the extra graph showing a reassigned point value. Reader 4 valued the clean sequence of interpretation, point-value distinction and limits of finite evidence. Both modular lessons received a tie against one reference. Their relative weakness was usually less explicit reusable reasoning or narrower transfer, rather than a mathematical defect.

Grader preferences were not uniform pedagogical rules. Reader 1 liked introducing notation before the longer justification; other feedback favored seeing the algebraic reason first. Reader 4 preferred an initial interpretation check, while other readers rewarded a fresh calculation. We did not turn those differing preferences into untested edits.

## Verification and conclusion

Root independently checked all four lessons' central arguments and **19 keys: 12 main and seven bonus**. All keys were correct and uniquely defensible; no substantive scope error was found. All four outputs passed the app parser and graph-expression checks. This was source-level verification, not a live graph interaction test.

All prompt, lesson and packet hashes and balanced sample positions were validated. There were no arithmetic discrepancies, rescoring, replacement lessons or consequential factual grading errors identified in these four reports. Exact raw scores, reports and reasoning remain preserved.

**Decision: keep the current giant prompt for now.** Splitting it into these files is workable and may help maintainability, but this small experiment found no teaching-quality improvement. It cannot rule out a better decomposition, benefits on more demanding nodes, or a native skill-loading implementation. It also supplies no evidence about the separate Luna-feedback-and-revision idea, which remains untested. No production prompt, application behavior or fallback path was changed.

The [complete records](experiment-records.zip) preserve all actual author inputs, outputs, wrappers, model arguments, reported file reads, neutral grading packets, raw reports, split proof and validators. [aggregate.json](aggregate.json) contains exact criterion and output means; [split-proof.json](split-proof.json) documents the verbatim preservation and added routing.
