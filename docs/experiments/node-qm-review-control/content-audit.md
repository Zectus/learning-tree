# Physics, mathematics and grading audit

Root read the original in full, both complete revision diffs, both reviews and revision notes, and all six final grader reports. Root separately checked the general identities, scope, question keys and distractors. This is a factual audit, not an independent blind teaching-quality grade. Raw lessons and scores were not edited in response.

## Lesson content

All three have the same four main and two bonus questions, byte-for-byte, with keys **C, D, B, A, E, C**. There are six underlying questions and eighteen key occurrences across the three texts. All keys are correct and uniquely defensible as general claims under the stated free parameters. Numerical coincidences at particular free-parameter values do not make a wrong general formula equivalent to the keyed expression.

Exact SymPy calculations in math-audit.py verify:

- The worked chi state reduces to [[1,1],[1,2]]/3 and gives local plus probability 5/6.
- The opening entangled state reduces to diag(3/4,1/4), with local purity 5/8 and joint purity one.
- Question 1 reduces to [[2,i],[-i,1]]/3, so C has the correct off-diagonal sign.
- Question 2 gives 3/4 for the y-plus outcome.
- Question 3's two phase-dependent local contributions sum to the same reduced operator; the cross terms cancel symbolically for arbitrary complex local vectors and real phase.
- Question 4's singlet and joint mixture have local purity 1/2, but joint plus-plus probabilities zero and 1/4 respectively.
- Bonus 1's 2-by-3 state reduces to [[1/2,1/4],[1/4,1/2]], with purity 5/8.
- Bonus 2 reduces to diag(p,1-p) because the environment projectors are normalized; the local plus probability is 1/2 regardless of overlap.

The general trace-index contraction is correct; the same discarded index appears on both sides. Positivity, unit trace and Hermiticity follow as stated. Unitarity cancels the discarded-basis coefficients; the retained system's coordinates remain in the same basis. Pure entangled joint states can have mixed local reductions, while local mixedness of a general joint mixed state does not alone establish entanglement. Reduction is not a physical collapse or a selected environment outcome. All versions preserve these distinctions.

The self-review addition `(I_A ⊗ <b|)|ac> = <b|c>|a>` correctly explains the tensor-bra map. The expanded off-diagonal entry uses the correct shared environment index and conjugation. The Luna-guided row/column labels and projector-to-outcome sentence are correct. Neither revision fixes a mathematical error. The critic's suggestion to mention general measurement effects was optional; Sol avoided a new measurement-theory detour. The original algebra already extends by linearity to other local operators; the scoped projective-outcome sentence is an exposition choice, not repair of a false result.

All three versions pass the app's actual lesson parser and question checks. They contain no graphs; graph-expression checks therefore have no applicable blocks. No rendered interaction or human learning outcome was measured.

## Grader accuracy and limitations

- **Readers 1, 2 and 5** accurately identify the self-review tensor-bra/amplitude additions and the Luna-review row-label/projective-outcome additions. Their preferences are concrete teaching judgments, with no verified consequential mathematical error.
- **Reader 3** has self=A, original=B, Luna=C. It falsely says B adds the explicit row/column explanation; B is the original, and the added sentence belongs only to C. Its report prose leans C ahead of A, but its formal JSON ranks C and A tied at 9.24. Aggregation uses the JSON tie without changing it.
- **Reader 4** has self=A, Luna=B, original=C. It falsely says A and C match apart from labels and both contain the explicit tensor-bra action. Only A contains that added action and the expanded amplitude products. The unchanged original C does not. Its Luna preference and tie remain preserved despite this conflation.
- **Reader 6** has Luna=A, self=B, original=C. It accurately identifies B's two additions, but calls A and C substantively identical and overlooks Luna's two actual additions. A tie can be a valid preference; the description that they are identical is inaccurate.

The narrow ranking differences should be read alongside these attribution errors. High self-reported confidence did not prevent conflating near-identical texts. No grader was rerun, excluded or rescored. Every reported overall score equals its five-criterion arithmetic mean, and all six formal JSON rankings are preserved.

All graders give every lesson 10 for correctness. Active-learning scores are essentially unchanged, consistent with identical questions. Reader 4 gives a small active-learning advantage to the Luna version despite unchanged questions; that can reflect surrounding support, but it is not evidence of new practice content. Several reports want explanatory feedback after answers; the app brief explicitly says answer tags are hidden and options shuffled, so a hidden answer tag itself should not be treated as explanatory feedback available to the reader.
