/* ═══════════════════════════════════════════════════════════
   NODE LESSON PROMPT — pure text template
   This is the prompt copied out of the app and pasted into a
   Claude conversation to generate one node's .txt lesson file.
   Called from buildPrompt() in io.js, which computes all of
   these values for a given node; this file holds no logic of
   its own, just the prompt text and where each value drops in.
═══════════════════════════════════════════════════════════ */
function renderNodePrompt({ topic, nodeId, plainKey, prereqLine, leadsToLine, contextLine, treeTopicLine, explanationLine, languageClause }) {
  return `You are producing a plain-text learning document (.txt) for the topic: ${topic}

Deliver this as a downloadable file named ${nodeId}.txt — that keeps it unambiguous which node in the tree this document belongs to when there are many. Do all planning, drafting, and double-checking in your thinking; your visible output should contain nothing but the file itself — no preamble, no summary, no commentary before or after it.

Think of this as a software engineering task. Your output is a file artifact — every part must serve a precise purpose, every gap in the argument is a bug, and filler is waste. Before writing a single word of content, work through the following completely in your head.

ANSWER KEY — read this before planning anything else

Here is a long bank of pre-generated answers: ${plainKey}. This bank is deliberately much longer than any one document needs — decide for yourself, based on how much the material actually supports, how many main questions this document earns; there's no target count, and using the whole bank is not the goal. Whatever count you land on, take that many entries off the FRONT of the bank, in order, as the target answers for question 1, question 2, question 3, and so on. Design each question, and its wrong options, around its assigned target — never derive a result first and then check whether it happens to match. If your first instinct is to work out what a question's "natural" answer would be and only then check it against the bank, you're already doing it backwards; the target answer comes first, the setup that produces it comes second.

For any question whose answer depends on specific values, a chosen example, or which of several plausible options gets picked, choose that value, example, or option so it lands exactly on the target answer — work this out before drafting any of the surrounding prose.

Some questions will hinge on a distinction that's easy to get backwards by accident — which of two similar things is which, which direction a relationship or cause runs, what happened before what, which side an effect lands on, what gets added versus subtracted. When a question's target answer depends on a choice like this, work it out deliberately and double-check it before finalizing the question. This is the single most common way a question quietly drifts from the answer it was supposed to hit.

If a question's content is naturally tied to material that only exists in one particular section (so it has to be placed there), check that some natural, non-contrived choice of values, example, or configuration in that context can actually produce the target answer before you commit to that placement. If it can't, look for freedom you haven't used yet — a relative sign or magnitude, a direction, which object or figure plays which role, which specific case or example you reach for — before forcing a strained setup.

Most documents land somewhere between a handful and a dozen or so main questions, but let the material's density decide — a rich, densely-connected node may earn more, a short foundational one may only need two or three. When you write the final [KEY: ...] line at the end of the document (see below), it must contain only the entries you actually used, trimmed to your real question count and in the same order — not the full bank above.

PLAN FIRST — ask yourself all of these:
- What are every sub-object and sub-result that must be established to reach the central result of ${topic}? List them in dependency order — if this node's scope note (see CONTEXT below) names specific sub-results or siblings, that list is the authoritative boundary, not just the topic name.
- Where does the standard textbook presentation say "it can be shown" or silently assert something without justification? Those are the bugs you must fix.
- Is every claim you make actually established, not just asserted? By the end of the document, could the reader work through a concrete instance of the central result themselves, using only what's been laid out here?
- What single concrete problem makes the reader feel the friction that ${topic} resolves, before they know what the concept is called?
- What is the subtlest step students usually accept without understanding?
- What problems genuinely test whether the ideas landed — not just whether the reader can recognize a keyword or formula?
- For each question you're planning, work out the concrete values, example, or configuration that hits its required target answer now — not later, while drafting the prose around it.

Only after exhausting this planning process, write the document.


OUTPUT FORMAT (follow exactly — a parser will read this file)

This is a plain .txt file. Rules:
- No markdown: no **, no ##, no backticks, no bullet points using *, no _italics_ — including using ** to fake bold for a vector symbol (e.g. **S**); that's KaTeX's job (\\mathbf{}), not markdown's, see the Math rule below
- No HTML, no code blocks, no widgets, no interactive elements of any kind
- Prose only — use plain paragraphs and the section/question/table/timeline markers below

Section headers:
=== SECTION N: TITLE ===

Questions must use this format exactly:

[QUESTION N]
Question text here, with \\( LaTeX \\) as needed.

(A) first option
(B) second option
(C) third option
(D) fourth option
(E) fifth option
[/QUESTION]

Three optional tools are available if the topic calls for them — none of them are mandatory, and a topic with no natural use for one just doesn't use it. Reach for whichever actually fits the material; don't force a topic without math into using KaTeX, and don't force a topic without a chronology or tabular structure into using a timeline or table just because the option exists.

- Math: inline with \\( ... \\), display with \\[ ... \\]. Skip entirely for a topic with nothing to typeset. This applies uniformly — there is no such thing as a mathematical symbol too minor or too casual to wrap. A single variable name, a subscript, a dot or cross product, a vector mentioned in passing mid-sentence: if it's math, it goes in \\( \\), with exactly the same treatment as a formula on its own display line. Don't let a symbol's position — sitting inside a flowing sentence versus standing alone — decide whether it gets KaTeX; a parser reading this file can't tell "casual mention" from "official equation," and treating them differently is what produces a document that's formatted one way in its displayed equations and drifts into bare ASCII (r_u, F · n) the moment the same math shows up in prose. Bold or vector notation is no exception to the no-markdown rule either — never fake it with ** (e.g. **S** for a bold vector); use the real KaTeX command (\\mathbf{}) inside \\( \\) instead.
- Tables, for anything genuinely tabular — a comparison across several things along the same dimensions, a small reference of values, anything a reader would otherwise have to hold in their head across several sentences:
[TABLE]
Header A | Header B | Header C
Row 1 col A | Row 1 col B | Row 1 col C
Row 2 col A | Row 2 col B | Row 2 col C
[/TABLE]
  First line is the header row; every line is cells separated by "|". Keep cells short — this renders as a real table, not a wall of prose crammed into cells.
- Timelines, for a genuine chronology or ordered progression — a sequence of dated events, stages, or steps where the ordering itself is part of what's being taught:
[TIMELINE]
Marker 1 | What happened or what this stage is
Marker 2 | What happened or what this stage is
[/TIMELINE]
  The marker is usually a date or year but can be any short label — a stage name, "Step 1," an era — whatever the sequence is actually ordered by. One line per point on the timeline, marker and description separated by "|".
${languageClause}

CONTEXT
${treeTopicLine}
${explanationLine}
${prereqLine}
${leadsToLine}
${contextLine}


DOCUMENT STRUCTURE

Open with one concrete problem or situation that demands ${topic} as a whole. This is the only motivating hook in the document — establish it once, here, and don't restate "why does this matter" again later. Do not open with a definition or "X is a...".

Then divide everything else into sections by content, not by teaching stage. Take the dependency-ordered list of sub-objects and sub-results from your planning step and use that as your section list — each section is one coherent piece of the subject, built out fully, with whatever mix of intuition, formal definition, and derivation that particular piece needs, before moving to the next.

Within a section, build only what that section's content requires. Don't re-derive or re-motivate the opening problem — pick up from what the previous section established. A short transition into the next piece is fine and often necessary, but that's a bridge between two pieces of content, not a restatement of why the topic exists.

The only hard rule beyond this: no section should mostly restate a previous one. If two sub-results would need near-identical treatment, merge them into one section instead of writing the same thing twice under different titles.

Wherever a formal definition appears — whether it's the central object of the whole document or a sub-piece inside one section — treat it as arrived at, not declared: why is it phrased exactly this way. Prove or derive each result at a rigor level matched to the topic — for foundational or subtle material, every non-trivial step should name what licenses it (which definition by name, which earlier result, which algebraic fact, which specific piece of evidence), with no "it can be shown that." For simpler topics, full step-by-step justification of every obvious move is unnecessary and just adds noise. The baseline rule: anything a reader might genuinely wonder "but why?" about must be addressed. Every abstract object or claim introduced should be shown to actually work in a concrete case — asserting that it exists or holds is not enough. Treat any instance worked through in the exposition as spent: if a question follows on that same concept, it must reach for a different case, configuration, or combination than the one already walked through, not a relabeled repeat of it — otherwise there is nothing left for the reader to do but recognize what they just read.

When an explicit derivation or argument replaces a quicker informal justification a reader might reach for instead, don't write as though that informal route is wrong or doesn't exist; keep it as a brief supporting aside alongside the explicit version, not a replacement for it. The reader should come away with both the quick intuitive route and the rigorous one, not a correction of the former by the latter.

Scatter your main questions throughout the document, embedded at the natural moment right after the concept or technique they test has just been introduced. A question about a definition should appear right after that definition, while it is fresh. A question about a derived result should appear immediately after the derivation. Questions should feel like a natural pause in the reading — "try this now" — not a separate block at the end. Do not group them, do not create a separate exercises section, do not label them "Practice Set" anything. Once a question is posed, nothing else in the document — not the sentences leading into it, not the transition that follows it — may discuss, justify, hint at, or evaluate its answer or any of its options. The reader can scroll ahead or back freely, so anything said nearby about why a choice is right or wrong is visible before, or instead of, working it out. After a question, move forward into the next new piece of content; don't loop back to recap, defend, or unpack what was just tested. Just use the [QUESTION N] format inline, numbered consecutively in the order they appear.

Every question should make the reader actually do something with what was just established — work through a genuinely new instance, combine two pieces, or take one real step past what the text said — not hand back a fact that's still sitting a sentence or two above it, dressed in more technical language. If a question's answer is just the preceding sentence restated, it isn't testing anything; replace it with one that needs an actual pen. Straightforward or mechanical questions are completely fine, often the right call for simpler topics — simple isn't the problem, restating is. The test: could someone answer from memory of the last paragraph alone, or do they have to sit with it and work it out? Aim for the second.

On the very last line of the document, after all sections, write a line in exactly this form:
[KEY: 1A 2C 3E ...]
using the same digit+letter tokens as the bank above (each token is the question's number immediately followed by its letter, space-separated) — but only as many tokens as you actually have main questions, trimmed from the front of the bank, in order, not the full bank. This is read by the viewer for answer verification, so the format must match exactly and the letters must be unaltered from the bank.

After the key line, add bonus practice questions using this separate format — genuine extra practice, not a preview of anything not yet covered. However many genuinely earn a place is up to you; there's no target count here either, could be a couple, could be quite a few. This is a good place to reach for something genuinely interesting if one comes to mind: a surprising special case, a configuration that makes the structure of the topic click in a new way, a harder problem that's satisfying to push through — using only the tools and derivations this document just built. Don't force it, though; a few solid harder versions of the main material, applied to a less standard case or a sharper edge case the main questions didn't reach, are just as good a use of a bonus slot. A bonus question may also pull in a non-obvious connection to something already established here or seen earlier in the sequence. What a bonus question must never do is require knowledge the reader hasn't been given — even though the context below tells you what later topic this one feeds into, do not write a question whose answer depends on understanding that later topic; the reader hasn't seen it yet. Gesturing at a real-world structure or application this machinery is used for elsewhere is fine as flavor in the setup, but the question itself must be fully answerable using only what this document derived.

[BONUS 1]
[ANSWER: X]
Question text here.

(A) option
(B) option
(C) option
(D) option
(E) option
[/BONUS]

Replace X with the correct letter. The answer tag is hidden from the reader and used only for feedback. Same question construction rules apply as for the main questions.


QUESTION CONSTRUCTION RULES (guidelines, not bureaucratic checklists — use judgment)
1. Distractors should be clearly wrong on reflection. For mathematical questions, avoid options that are equivalent in value even if written differently.
2. No duplicate options.
3. For complex or subtle topics, aim for questions where understanding the material is genuinely required — setups with a conceptual trap, cases where the obvious mechanical approach fails, situations where you must identify which principle, rule, or piece of evidence applies before you can proceed. For simpler topics, straightforward questions are fine and probably better — don't manufacture artificial complexity where none exists.
4. If working through a question requires some intermediate quantity or fact that follows from the given setup by a short, easy step, let the reader work that out themselves rather than stating it for them in the question. This is different from genuinely given data — measured values, constants, configuration the reader couldn't otherwise know — which should stay. The line is whether deriving it is itself a small piece of what makes the question worth doing; if it is, handing it over for free turns the question into a last-step fill-in instead of something the reader has to actually work through. The same applies to the reasoning path itself, not just numeric quantities: if the stem already spells out the specific relationship, mechanism, or chain of implications that leads to the answer, it has done the reader's thinking for them just as much as handing over a number would, and the question is only checking whether they can read.

The goal is questions that are worth the learner's time given the topic's difficulty. A well-crafted simple question beats a convoluted one every time.`;
}
