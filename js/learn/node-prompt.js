/* ═══════════════════════════════════════════════════════════
   NODE LESSON PROMPT — pure text template
   This is the prompt copied out of the app and pasted into a
   Claude conversation to generate one node's .txt lesson file.
   Called from buildPrompt() in io.js, which computes all of
   these values for a given node; this file holds no logic of
   its own, just the prompt text and where each value drops in.

   PROMPT DESIGN RULES:
   1. This file writes lessons on every subject there is, so no
      instruction in it should carry a worked example from one
      specific topic (a named formula, a named theorem, a named
      historical event). A topic-specific example anchors the
      instruction to that one subject instead of the general shape
      of the mistake being warned against, and reads as if that
      subject is what's being taught. State each rule generally
      enough to fit any topic — but not so generally that it goes
      vague: describe the exact structural pattern (what the prose
      does, what the question then does, why that sequence fails)
      in placeholder terms, precise enough that the failure is
      unmistakable without ever anchoring it to one domain's content.
   2. This template's inputs describe the *node* — its scope, its
      place in the tree — never a specific reader's own progress
      through it (which nodes they personally have or haven't
      completed). Progress is per-user session state computed
      elsewhere (see prompts.js); it must never be threaded into a
      prompt input here. Context about the tree's structure
      (prerequisites, what a node leads to) is fine, since that's
      the same for every reader — the line is whether the fact
      belongs to the tree or to one person's history with it.
═══════════════════════════════════════════════════════════ */
function renderNodePrompt({ topic, nodeId, plainKey, prereqLine, leadsToLine, treeTopicLine, explanationLine, languageClause }) {
  return `You are producing a plain-text learning document (.txt) for the topic: ${topic}

Deliver this as a downloadable file named ${nodeId}.txt — that keeps it unambiguous which node in the tree this document belongs to when there are many. Do all planning, drafting, and double-checking in your thinking; your visible output should contain nothing but the file itself — no preamble, no summary, no commentary before or after it.

Think of this as a software engineering task. Your output is a file artifact — every part must serve a precise purpose, every gap in the argument is a bug, and filler is waste. Before writing a single word of content, work through the following completely in your head.

ANSWER KEY — read this before planning anything else

Here is a long bank of pre-generated answers: ${plainKey}. This bank is deliberately much longer than any one document needs — decide for yourself, based on how much the material actually supports, how many main questions this document earns; there's no target count, and using the whole bank is not the goal. Whatever count you land on, take that many entries off the FRONT of the bank, in order, as the target answers for question 1, question 2, question 3, and so on. Design each question, and its wrong options, around its assigned target — never derive a result first and then check whether it happens to match. If your first instinct is to work out what a question's "natural" answer would be and only then check it against the bank, you're already doing it backwards; the target answer comes first, the setup that produces it comes second.

For any question whose answer depends on specific values, a chosen example, or which of several plausible options gets picked, choose that value, example, or option so it lands exactly on the target answer — work this out before drafting any of the surrounding prose.

The number of main questions should be however many it actually takes to verify that every main idea in this document has landed — and landed as something the reader can use, not just something they can recognize or recite. For a topic where the ideas are mathematical, that means confirming the reader can actually apply the mathematics, not just state the definition or theorem back; for a topic without computation, the equivalent bar still applies in whatever form real use takes there — correctly applying a principle to a new case, telling apart two things that are easy to confuse, recognizing which situation calls for which idea — rather than settling for "can restate it." Don't add questions to build up volume, for variety, or as extra practice — that's what the bonus section further down is for. A document with few main ideas, each confirmed by one solid question, is complete as it is; one with many interlocking ideas needs as many questions as those ideas actually require, no more. When you write the final [KEY: ...] line at the end of the document (see below), it must contain only the entries you actually used, trimmed to your real question count and in the same order — not the full bank above.

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

The very first line of the document must be "=== SECTION 1: TITLE ===" — nothing precedes it. No title line, no opening sentence, no framing paragraph sits above the first section header; the parser only reads content from that marker onward, so anything placed before it is silently dropped and never reaches the reader. Whatever you'd otherwise be tempted to put before Section 1 — including the motivating hook described under DOCUMENT STRUCTURE below — belongs inside Section 1, as its own opening prose, not above it.

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


DOCUMENT STRUCTURE

Open with one concrete problem or situation that demands ${topic} as a whole. This is the only motivating hook in the document — establish it once, here, and don't restate "why does this matter" again later. Do not open with a definition or "X is a...". This hook is the opening prose of Section 1 itself (see the OUTPUT FORMAT rule above — nothing may appear before the first "=== SECTION 1: TITLE ===" line), not a separate introduction standing before any section.

Then divide everything else into sections by content, not by teaching stage. Take the dependency-ordered list of sub-objects and sub-results from your planning step and use that as your section list — each section is one coherent piece of the subject, built out fully, with whatever mix of intuition, formal definition, and derivation that particular piece needs, before moving to the next.

Within a section, build only what that section's content requires. Don't re-derive or re-motivate the opening problem — pick up from what the previous section established. A short transition into the next piece is fine and often necessary, but that's a bridge between two pieces of content, not a restatement of why the topic exists.

The only hard rule beyond this: no section should mostly restate a previous one. If two sub-results would need near-identical treatment, merge them into one section instead of writing the same thing twice under different titles.

Wherever a formal definition appears — whether it's the central object of the whole document or a sub-piece inside one section — treat it as arrived at, not declared: why is it phrased exactly this way. Prove or derive each result at a rigor level matched to the topic — for foundational or subtle material, every non-trivial step should name what licenses it (which definition by name, which earlier result, which algebraic fact, which specific piece of evidence), with no "it can be shown that." For simpler topics, full step-by-step justification of every obvious move is unnecessary and just adds noise. The baseline rule: anything a reader might genuinely wonder "but why?" about must be addressed. Every abstract object or claim introduced should be shown to actually work in a concrete case — asserting that it exists or holds is not enough. Once such a case has been worked through here, it's spent — see REUSED MATERIAL under QUESTION CONSTRUCTION RULES below for exactly what that rules out in the questions that follow.

When an explicit derivation or argument replaces a quicker informal justification a reader might reach for instead, don't write as though that informal route is wrong or doesn't exist; keep it as a brief supporting aside alongside the explicit version, not a replacement for it. The reader should come away with both the quick intuitive route and the rigorous one, not a correction of the former by the latter.

Scatter your main questions throughout the document, embedded at the natural moment right after the concept or technique they test has just been introduced. A question about a definition should appear right after that definition, while it is fresh. A question about a derived result should appear immediately after the derivation. Questions should feel like a natural pause in the reading — "try this now" — not a separate block at the end. Do not group them, do not create a separate exercises section, do not label them "Practice Set" anything. Once a question is posed, nothing else in the document — not the sentences leading into it, not the transition that follows it — may discuss, justify, hint at, or evaluate its answer or any of its options. The reader can scroll ahead or back freely, so anything said nearby about why a choice is right or wrong is visible before, or instead of, working it out. After a question, move forward into the next new piece of content; don't loop back to recap, defend, or unpack what was just tested. Just use the [QUESTION N] format inline, numbered consecutively in the order they appear. Everything about what makes a good question, once you're at the point of writing one, is collected under QUESTION CONSTRUCTION RULES below — read it before drafting your first one.

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


QUESTION CONSTRUCTION RULES (guidelines, not a bureaucratic checklist — use judgment, and read this in full before drafting your first question)

A question is only doing its job if answering it takes something the reader doesn't already have in hand: a new instance to work through, a real decision to make, or a step of reasoning nobody has spelled out for them yet. Simplicity is never the problem — a well-crafted simple question beats a convoluted one every time, and for a simple topic a straightforward question is usually the right call. Restating is the problem: if a question can be answered from memory of the sentence sitting directly above it, it isn't testing anything. What follows are the specific, recognizable shapes that failure takes in practice. Check every drafted question against all of them before moving on.

REUSED MATERIAL. Treat any instance worked through in the exposition — a concrete example, a specific case, a fully-derived expression — as spent. A question that follows on the same concept must reach for different objects: a different function, field, configuration, or combination, not the same one relabeled. Two disguises of this are worth naming, because neither looks like a repeat on the surface. First: the exposition keeps a case symbolic, and the question takes those exact same objects and just asks for their value at one specific point — nothing about the objects changed, only a number got attached to a result that was already finished. Second, more blatant: the question's content is the identical expression the exposition just finished deriving and stating the value of, with nothing changed at all — sometimes set up by a lead-in that fully previews the case ("consider such-and-such") right before the question restates the same specifics. Either way, if the sentence immediately before a question already gives away the specific setup or the specific answer to what the question is about to ask, the question is redundant by construction. Fix it by reaching for genuinely different objects, not by rephrasing the same ones.

HANDED-OVER REASONING. If solving a question requires some intermediate fact that follows from the given setup by a short, easy step, make the reader work that out — don't state it in the question. This is different from genuinely given data (measurements, constants, configuration the reader has no other way to know), which should stay. The same goes for the reasoning path itself, not just quantities: if the stem already spells out the specific relationship, mechanism, or formula that leads to the answer, it has done the reader's thinking for them, and all that's left is a plug-in. This has a common, easy-to-spot shape: the prose derives some formula or relationship, and the very next question opens by restating that same formula before asking the reader to apply it — "Using [the thing just derived], find/compute/determine..." Don't open or frame a question that way, and don't re-serve an already-established result in the stem at all; trust the reader to recall it unprompted. If several established results are legitimately in play and naming them is genuinely needed for clarity, pair that naming with a real decision the reader still has to make (which case applies, what sign or direction is correct, how two pieces combine), so recalling the tool is only the entry ticket, not the whole task.

NO REAL WORK LEFT. Independent of whether a formula gets restated, a question whose entire work reduces to one arithmetic operation on numbers already sitting in the stem — one multiplication, one substitution, one subtraction — tests whether the reader can compute, not whether the concept landed. Count the genuine decision points between reading the stem and reaching the answer: which fact applies, which case this is, what sign or setup is correct, how two results combine. Zero decision points, only arithmetic, means the question needs a real step built in, not just different numbers.

BYPASSABLE CONCEPT. For complex or subtle topics, aim for questions where understanding the material is genuinely required: a conceptual trap, a case where the obvious mechanical approach fails, a need to identify which principle applies before proceeding at all. For simpler topics, straightforward questions are fine and often better — don't manufacture complexity where none exists. Either way, check this concretely before finalizing a question built around a specific technique or identity: is there a different, more direct path to the same answer that skips the technique entirely — computing the raw result by hand instead of applying what the section just built, say — and is that bypass at least as easy? If so, the question isn't testing the thing it's attached to, however relevant it looks on the page. Reshape the setup so the technique is genuinely the fastest or only reasonable route, or don't ask it.

CONCISENESS. State what's given and what's being asked, then stop. Re-explaining context the reader already has, narrating the setup instead of presenting it, and announcing which tool to reach for before the reader's had a chance to reach for it themselves are all padding, not clarity — cut them. This applies to answer options too: once the stem has already fixed an ordering, a variable name, or a piece of notation, repeating it in front of every single option adds nothing — give the value alone and let the stem carry what it represents.

DISTRACTORS. Should be clearly wrong on reflection; for mathematical questions, avoid options that are equivalent in value even if written differently, and never duplicate an option outright. When a question's real content is that some quantity turns out to be independent of a variable that looks like it should matter — the same for every case, every index, every choice of an otherwise-free parameter — that independence claim is exactly what a distractor should test: include at least one option representing what the value would be if it did depend on that variable, not just numeric variants clustered around the right magnitude. Otherwise the question can be answered by guessing "it's probably the boring constant one" without ever engaging with why it's constant.

GETTING THE TARGET RIGHT. Some questions hinge on a distinction that's easy to get backwards by accident — which of two similar things is which, which direction a relationship or cause runs, what happened before what, which side an effect lands on, what gets added versus subtracted. When a question's target answer (see ANSWER KEY above) depends on a choice like this, work it out deliberately and double-check it before finalizing — this is the single most common way a question quietly drifts from the answer it was supposed to hit. And if a question's content is naturally tied to material that only exists in one particular section, confirm before committing to that placement that some natural, non-contrived choice of values or configuration there can actually produce the target answer; if it can't, look for freedom you haven't used yet — a relative sign or magnitude, a direction, which object plays which role, which specific case you reach for — before forcing a strained setup.`;
}
