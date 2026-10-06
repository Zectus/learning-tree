/* ═══════════════════════════════════════════════════════════
   NODE LESSON PROMPT — pure text template
   This is the prompt copied out of the app and pasted into a
   Claude conversation to generate one node's .txt lesson file.
   Called from buildPrompt() in prompts.js, which computes all of
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
   3. Which letter ends up correct for a given question is not this
      file's concern at all. Every main question marks its own
      correct option inline with [ANSWER: X] — exactly the same
      mechanism the [BONUS] format already used — and the app
      shuffles each question's options into a random order and
      relabels them at render time (see shuffleOptions in tools.js).
      This used to work the other way around: a long pre-generated
      bank of random target letters was handed to the model, which
      had to design each question's setup and values to land on
      whichever letter the bank assigned. That forced backward
      design on computational questions — reverse-engineering
      numbers to force a derivation onto a pre-picked letter — and
      is exactly the kind of contorted setup GETTING THE TARGET
      RIGHT below warns against. Marking the true answer after
      working it out, and letting the app handle letter position
      and distribution entirely on its own, removes that problem
      instead of managing it.
   4. Graphs need a positive trigger, not just permission. When the
      tools paragraph only said graphs were optional and not to force
      them, the model took that as a reason never to draw one, even
      for sections whose whole subject is a shape. The paragraph now
      says graphs are the default wherever a section's central object
      has a shape, and the final review checks for the omission. Keep
      that framing when editing, and keep the trigger stated in terms
      of kinds of object (function, curve, surface, field, points and
      lines), never a named topic (see rule 1). The graph syntax is
      parsed by parseGraphBody in tools.js; the two must stay in sync.
═══════════════════════════════════════════════════════════ */
function renderNodePrompt({ topic, nodeId, prereqLine, leadsToLine, treeTopicLine, explanationLine, languageClause }) {
  return `You are producing a plain-text learning document (.txt) for the topic: ${topic}

Deliver this as a downloadable file named ${nodeId}.txt — that keeps it unambiguous which node in the tree this document belongs to when there are many. Do all planning, drafting, and double-checking in your thinking; your visible output should contain nothing but the file itself — no preamble, no summary, no commentary before or after it.

Write for an average student encountering this node's material for the first time, with the background described in CONTEXT. The lesson should help them make sense of the idea and use it at the intended level. Mathematical correctness and readable markup are necessary, but so are motivation, accessible examples, and a manageable sequence. Plan the lesson before drafting; let its length follow the learning goal.

HOW MANY QUESTIONS, AND HOW EACH ONE IS MARKED

The number of main questions should be however many it actually takes to verify that every main idea in this document has landed — and landed as something the reader can use, not just something they can recognize or recite. For a topic where the ideas are mathematical, that means confirming the reader can actually apply the mathematics, not just state the definition or theorem back; for a topic without computation, the equivalent bar still applies in whatever form real use takes there — correctly applying a principle to a new case, telling apart two things that are easy to confuse, recognizing which situation calls for which idea — rather than settling for "can restate it." Don't add questions to build up volume, for variety, or as extra practice — that's what the bonus section further down is for. A document with few main ideas, each confirmed by one solid question, is complete as it is; one with many interlocking ideas needs as many questions as those ideas actually require, no more.

Every main question marks its own correct option inline, with an [ANSWER: X] line inside its [QUESTION N]...[/QUESTION] block — see OUTPUT FORMAT below. This tag is never shown to the reader; it's read only by the app that scores the reader's answer. Design each question's setup and its wrong options with real care — don't let whichever answer happens to fall out of a quick derivation dictate lazy distractors (see DISTRACTORS under QUESTION CONSTRUCTION RULES below) — but there is no target letter to hit. Work out the question's correct answer as a normal part of designing that question, mark it with [ANSWER: X], and move on. The app shuffles each question's options into random order and relabels them before anyone ever sees them, so don't try to steer which letter the correct answer lands on, and don't worry about the distribution of correct letters across the document — none of that is this document's concern, and time spent on it is time not spent on making the question itself sharp.

PLAN FIRST

- Read CONTEXT as a learning goal and scope boundary. Identify the ability the reader should gain and distinguish central content from supporting cases. An older scope note may be only a topic list: organize it into a coherent progression instead of treating every item as equally important. Cover required content economically without expanding into excluded methods.
- Choose a meaningful question that gives the central idea a purpose within this scope. Motivation can be a concrete interpretive problem; it need not require techniques or later applications the reader has not learned.
- Choose an accessible example that can carry the first explanation. Check all its background knowledge against CONTEXT. Prefer a simple case that exposes the idea over an impressive case that adds unfamiliar machinery.
- Plan the order in which meaning, notation, general statements, worked use, and important contrasts become understandable. Identify likely misconceptions, including ones your own wording or pictures could create.
- Decide what justification the intended level needs. Distinguish an illustration or estimate from a general guarantee, but do not turn an informal introduction into a proof lesson. Make abstract phrases concrete before asking the reader to reason with them.
- Plan questions that first check understanding and then transfer it to a fresh case. Work out each answer and its distractors before committing to the setup.
- For visual objects, plan graphs where they first help the reader understand the object. Choose ranges and marks that show the relevant feature honestly within the supported graph format.



OUTPUT FORMAT (follow exactly — a parser will read this file)

This is a plain .txt file. Rules:
- No markdown: no **, no ##, no backticks, no bullet points using *, no _italics_ — including using ** to fake bold for a vector symbol (e.g. **S**); that's KaTeX's job (\\mathbf{}), not markdown's, see the Math rule below
- No HTML, no code blocks, no widgets, and no interactive elements of any kind — the one exception is the slider line a graph block can carry (see Graphs below), which is part of the graph format, not HTML
- Prose only — use plain paragraphs and the section/question/table/timeline/graph markers below

Section headers:
=== SECTION N: TITLE ===

The very first line of the document must be "=== SECTION 1: TITLE ===" — nothing precedes it. No title line, no opening sentence, no framing paragraph sits above the first section header; the parser only reads content from that marker onward, so anything placed before it is silently dropped and never reaches the reader.

Questions must use this format exactly:

[QUESTION N]
[ANSWER: X]
Question text here, with \\( LaTeX \\) as needed.

(A) first option
(B) second option
(C) third option
(D) fourth option
(E) fifth option
[/QUESTION]

Replace X with whichever letter is actually correct, as (A)-(E) are written above. This works exactly like the [ANSWER: X] tag in the [BONUS] format further down — hidden from the reader, read only by the app, and not something to think about when deciding where to place the correct option among (A)-(E); place it wherever it naturally falls as you write the options, in any order you like. Nothing anywhere else in the document — before this block, after it, or much later — may explain, defend, or hint at why the correct option is correct or a wrong option is wrong. [ANSWER: X] is the only place that answer lives.

Four tools are available. Math, tables and timelines are for material that has something to typeset, compare, or put in order: don't force KaTeX onto a topic without math, or a table or timeline onto material with no tabular or chronological structure. Graphs are different: they are the default, not an extra. Whenever a section's central object has a shape — a function, a curve, a surface, a field, a relationship between two quantities, a configuration of points and lines in a plane — draw it, at the point where that section first works with it, so the reader sees the object while the prose is analyzing it. Prose alone asks the reader to hold in their head a picture that a graph hands over for free. Skip a graph only when the section has nothing visual to show: purely symbolic manipulation, a definition with no geometric content, non-quantitative material. A document on a topic with geometry in it that comes out with no graph at all has a gap, and the final review below checks for it.

- Math: inline with \\( ... \\), display with \\[ ... \\]. Skip entirely for a topic with nothing to typeset. This applies uniformly — there is no such thing as a mathematical symbol too minor or too casual to wrap. A single variable name, a subscript, a dot or cross product, a vector mentioned in passing mid-sentence: if it's math, it goes in \\( \\), with exactly the same treatment as a formula on its own display line. Don't let a symbol's position — sitting inside a flowing sentence versus standing alone — decide whether it gets KaTeX; a parser reading this file can't tell "casual mention" from "official equation," and treating them differently is what produces a document that's formatted one way in its displayed equations and drifts into bare ASCII (r_u, F · n) the moment the same math shows up in prose. Bold or vector notation is no exception to the no-markdown rule either — never fake it with ** (e.g. **S** for a bold vector); use the real KaTeX command (\\mathbf{}) inside \\( \\) instead.
- Tables, for anything genuinely tabular — a comparison across several things along the same dimensions, a small reference of values, anything a reader would otherwise have to hold in their head across several sentences:
[TABLE]
Header A | Header B | Header C
Row 1 col A | Row 1 col B | Row 1 col C
Row 2 col A | Row 2 col B | Row 2 col C
[/TABLE]
  First line is the header row; every line is cells separated by " | " — always with a single space on each side, exactly as in the example above. That spacing is what a column divider actually looks like; a bare "|" with no space around it (an absolute value bar, a norm, a set-builder pipe, sitting inside a cell's own math) is read as content, not a divider, so you don't need to avoid literal pipes in table-cell math. Still, prefer \\lvert ... \\rvert over bare | ... | for absolute value inside a table cell — it typesets with better spacing — and never use \\| for a single absolute-value bar; that's a different symbol (‖, a norm). Keep cells short — this renders as a real table, not a wall of prose crammed into cells.
- Timelines, for a genuine chronology or ordered progression — a sequence of dated events, stages, or steps where the ordering itself is part of what's being taught:
[TIMELINE]
Marker 1 | What happened or what this stage is
Marker 2 | What happened or what this stage is
[/TIMELINE]
  The marker is usually a date or year but can be any short label — a stage name, "Step 1," an era — whatever the sequence is actually ordered by. One line per point on the timeline, marker and description separated by " | " (spaced, same convention as TABLE above, for the same reason — it's what tells a real divider apart from a bare pipe that happens to sit inside the marker or description's own math).
- Graphs, for a function, curve, surface, field, or set of points and lines that is worth seeing rather than just describing — see the paragraph above for when a graph is expected, and the notes after the four types for how to make one earn its place. There are four types:

  function2d — one or more y = f(x) curves on the same axes:
[GRAPH]
type: function2d
title: what this graph shows
xlabel: x
ylabel: y
xrange: -5, 5
trace: x^2 - 3*x | label: f(x)
trace: 2*x - 3 | label: f'(x)
[/GRAPH]

  parametric2d — one or more curves traced out by (x(t), y(t)):
[GRAPH]
type: parametric2d
title: what this graph shows
xlabel: x
ylabel: y
trange: 0, 6.283
trace: cos(t), sin(t) | label: unit circle
[/GRAPH]

  surface3d — a single surface z = f(x, y):
[GRAPH]
type: surface3d
title: what this graph shows
xlabel: x
ylabel: y
zlabel: z
xrange: -3, 3
yrange: -3, 3
z: x^2 - y^2
[/GRAPH]

  vectorfield2d — a single vector field, given by its two components as functions of x and y:
[GRAPH]
type: vectorfield2d
title: what this graph shows
xlabel: x
ylabel: y
xrange: -3, 3
yrange: -3, 3
u: -y
v: x
[/GRAPH]

  function2d, parametric2d and vectorfield2d graphs can also carry marked points, drawn segments, and sliders: extra lines in the same block, all optional, repeatable, and not available for surface3d. Optional too is "aspect: equal" (function2d), which gives both axes the same unit length — use it whenever the true shape or an angle matters; parametric2d and vectorfield2d already do this on their own.

point: x, y | label: caption | color: optional | offset: dx, dy
segment: x1, y1, x2, y2 | label: caption | color: optional | dashed: true
slider: name | range: min, max | init: value | step: size

  A point marks one specific location the prose works with (a given data point, an intercept, a place of interest). A segment connects two locations (a distance, a change along each axis, a side of a figure, a stretch between two points). Their coordinates are plain expressions in the same calculator notation as the traces. A slider adds a draggable control under the plot, and any trace, point, or segment expression that uses the slider's name as a variable is redrawn as it moves (a vector field is drawn once, at the slider's starting value). Use a slider when what the section is about is how something changes as a parameter varies: the reader dragging it and watching the picture respond is something prose can only describe. A complete example, for the syntax only:
[GRAPH]
type: function2d
title: what this graph shows
xlabel: x
ylabel: y
xrange: -4, 4
trace: s*x | label: family member
point: 2, 2*s | label: P
segment: 0, 0, 2, 2*s | dashed: true
slider: s | range: -3, 3 | init: 1 | step: 0.1
[/GRAPH]
  Expressions are self-contained: there are no user-defined functions, so a quantity built from another curve is written out in full, in terms of x (or t) and the slider names.

  A graph is part of the exposition, so it follows the same rules as the prose around it. It may show the instances the text works through and the general shape of the objects involved; it must not plot the specific object a nearby question asks about, mark that question's answer, or otherwise do the reader's work for it. It should earn its place: take the graph away and the surrounding prose should lose something. Mark the points the prose actually computes with, draw the segments the prose names, and use a slider when the prose compares many members of one family. One graph per idea is plenty; don't plot the same object twice, and keep a plot to a handful of curves so it stays readable. The block sits on its own lines between paragraphs, like a table.

  Every field on its own "key: value" line. title/xlabel/ylabel/zlabel are always optional but should usually be filled in. The range requirements depend on the type: function2d needs xrange (yrange is optional — left out, the vertical window is fitted to the curves, so give it only when a specific window matters), parametric2d needs trange (xrange and yrange are optional there too), and surface3d and vectorfield2d need both xrange and yrange. Pick bounds that actually show what the graph is for, the way a chosen numeric example elsewhere in this document is chosen to land on its point, not a generic default. function2d and parametric2d can repeat the trace line for more than one curve on the same axes; surface3d and vectorfield2d take exactly one z (or one u and one v) — nothing to repeat there. label and color on a trace line are both optional. A parametric2d trace line packs both components into one line, comma-separated: trace: cos(t), sin(t) | label: .... The fields of a line are separated by " | " with a space on each side, exactly as in a table row.

  Every expression (trace, z, u, v, and the coordinates of a point or segment) is evaluated as a plain math expression by a separate library, not typeset by KaTeX — write x^2, sin(x), sqrt(x^2 + y^2), atan2(y, x), abs(x) in ordinary calculator-style notation (abs(x), not |x| — bars aren't valid syntax here), never inside \\( \\) and never with LaTeX commands like \\sin or \\frac{}{}. Captions are the opposite, with one wrinkle. The title and the label on a trace go through the normal KaTeX pass like anything else in this document, so \\( \\) works there exactly as it would in a sentence. The xlabel, the ylabel, and the label on a point or a segment are drawn inside the plot itself, where a label must be either one single \\( ... \\) span (the whole label is math) or plain text with no math in it; never mix prose and a math span in one of those, and keep them short. The zlabel is plain text. Keep the two apart — an expression written in LaTeX syntax won't evaluate, and a label written in plain-expression syntax just won't typeset.
${languageClause}

CONTEXT
${treeTopicLine}
${explanationLine}
${prereqLine}
${leadsToLine}


DOCUMENT STRUCTURE

Organize sections around coherent learning steps in the subject. An example, a definition, and a worked use may belong together when they develop the same idea; a new difficulty may need a separate section. There is no section quota. Merge repetitive treatments and give the central idea more attention than peripheral cases.

Begin with a concrete question or situation that makes the idea worth understanding. A brief statement of purpose is welcome when it helps the reader know what question is being answered. Avoid announcements of the document's outline and repeated motivational preambles.

Build meaning through an accessible case, then introduce the general statement and its notation. Explain each new symbol's role and how to read the whole expression; do not assume a displayed formula explains itself. Translate abstract phrases into concrete comparisons, choices, or numerical requirements before relying on them. Metaphors should help without implying properties the concept does not have. Use a contrasting case when it resolves a likely misconception.

Show how the reader uses the idea at this node's level: interpreting information, making a prediction, distinguishing cases, or carrying out a method. A conceptual node still needs worked use even when calculation techniques are excluded. Keep the example's purpose visible and its background requirements modest.

Match justification to the learning goal. Derive a method when understanding its derivation is part of the scope; explain the reason behind a conceptual claim at a level the reader can follow. Definitions need meaning and examples rather than a manufactured proof. State the relevant assumptions and avoid unsupported leaps, but do not prove every non-trivial assertion merely because it is possible to do so. In an informal lesson, a short explanation of why a pattern persists may suffice. Clearly distinguish what sampled data suggest from what a stated rule guarantees, without letting that distinction dominate the first encounter with the idea.

Introduce supporting contrasts after the central idea is secure. Do not give a catalog of exceptions more space than understanding and using the ordinary case. Keep excluded techniques and later formalism outside the lesson, while preserving motivation and accurate interpretation.

A visual must agree with the mathematical or factual object described. Do not depict a missing point by deleting a visible interval or imply that finite sampling captures all behavior. Use only supported graph features. If the format cannot faithfully mark a distinction, explain the representation's limitation and choose a different illustration rather than inventing syntax or claiming the picture shows something it does not.

Scatter your main questions throughout the document, embedded at the natural moment right after the concept or technique they test has just been introduced. A question about a definition should appear right after that definition, while it is fresh. A question about a derived result should appear immediately after the derivation. Questions should feel like a natural pause in the reading — "try this now" — not a separate block at the end. Do not group them, do not create a separate exercises section, do not label them "Practice Set" anything. Once a question is posed, nothing else in the document — not the sentences leading into it, not the transition that follows it, no matter how far downstream — may discuss, justify, hint at, or evaluate its answer or any of its options. One disguise of this is easy to miss while writing it: a reflective aside, introduced as "worth noting" or "worth pausing on," that revisits why a particular wrong option might have looked tempting. Framing it as a general observation doesn't change what it is — it's still explaining one of the question's own options, and it counts the same as putting that explanation directly beneath the question. The reader can scroll ahead or back freely, so anything said nearby about why a choice is right or wrong is visible before, or instead of, working it out. After a question, move forward into the next new piece of content; don't loop back to recap, defend, or unpack what was just tested. Just use the [QUESTION N] format inline, numbered consecutively in the order they appear. Everything about what makes a good question, once you're at the point of writing one, is collected under QUESTION CONSTRUCTION RULES below — read it before drafting your first one.

After the last main question, add bonus practice questions using this separate format — genuine extra practice, not a preview of anything not yet covered. However many genuinely earn a place is up to you; there's no target count here either, could be a couple, could be quite a few. This is a good place to reach for something genuinely interesting if one comes to mind: a surprising special case, a configuration that makes the structure of the topic click in a new way, a harder problem that's satisfying to push through — using only the tools and derivations this document just built. Don't force it, though; a few solid harder versions of the main material, applied to a less standard case or a sharper edge case the main questions didn't reach, are just as good a use of a bonus slot. A bonus question may also pull in a non-obvious connection to something already established here or seen earlier in the sequence. What a bonus question must never do is require knowledge the reader hasn't been given — even though the context below tells you what later topic this one feeds into, do not write a question whose answer depends on understanding that later topic; the reader hasn't seen it yet. This includes facts that feel like a small, natural step from what's already established: if the document never actually states or demonstrates it, even once, it hasn't been given, no matter how obvious the step feels while writing it — a reader who hasn't had that exact leap modeled for them has no way to know it's expected. Gesturing at a real-world structure or application this machinery is used for elsewhere is fine as flavor in the setup, but the question itself must be fully answerable using only what this document derived.

[BONUS 1]
[ANSWER: X]
Question text here.

(A) option
(B) option
(C) option
(D) option
(E) option
[/BONUS]

Replace X with the correct letter, same as for main questions above. The answer tag is hidden from the reader and used only for feedback. Same question construction rules apply as for the main questions.


QUESTION CONSTRUCTION RULES (guidelines, not a bureaucratic checklist — use judgment, and read this in full before drafting your first question)

A question is only doing its job if answering it takes something the reader doesn't already have in hand: a new instance to work through, a real decision to make, or a step of reasoning nobody has spelled out for them yet. Simplicity is never the problem — a well-crafted simple question beats a convoluted one every time, and for a simple topic a straightforward question is usually the right call. Restating is the problem: if a question can be answered from memory of the sentence sitting directly above it, it isn't testing anything. What follows are the specific, recognizable shapes that failure takes in practice. Check every drafted question against all of them before moving on.

FRESH WORK AT THE RIGHT LEVEL. A question must leave meaningful work for the reader rather than repeat a specific answer already supplied. Early checks may use a familiar structure with new values when the task is to learn how to read notation or carry out a first application. Later checks should require a fresh interpretation, a choice between cases, a correction of a mistaken claim, or transfer to a different setup. Do not demand a new kind of object for every question: that can introduce difficulty unrelated to the goal. Across the lesson, include both accessible checks and genuine transfer. Keep all questions answerable with established knowledge.
HANDED-OVER REASONING. If solving a question requires some intermediate fact that follows from the given setup by a short, easy step, make the reader work that out — don't state it in the question. This is different from genuinely given data (measurements, constants, configuration the reader has no other way to know), which should stay. The same goes for the reasoning path itself, not just quantities: if the stem already spells out the specific relationship, mechanism, or formula that leads to the answer, it has done the reader's thinking for them, and all that's left is a plug-in. This has a common, easy-to-spot shape: the prose derives some formula or relationship, and the very next question opens by restating that same formula before asking the reader to apply it — "Using [the thing just derived], find/compute/determine..." Don't open or frame a question that way, and don't re-serve an already-established result in the stem at all; trust the reader to recall it unprompted. If several established results are legitimately in play and naming them is genuinely needed for clarity, pair that naming with a real decision the reader still has to make (which case applies, what sign or direction is correct, how two pieces combine), so recalling the tool is only the entry ticket, not the whole task.

TEST THE INTENDED ABILITY. Judge a question by the learning goal, not by the number of calculations or decision points. A simple substitution or identification may be appropriate for an initial check if it tests a newly learned interpretation. It is insufficient as the only evidence of conceptual understanding. Include questions where the options distinguish explanations, representations, assumptions, or cases, so success requires more than recognizing the wording of the preceding paragraph.
BYPASSABLE CONCEPT. For complex or subtle topics, aim for questions where understanding the material is genuinely required: a conceptual trap, a case where the obvious mechanical approach fails, a need to identify which principle applies before proceeding at all. For simpler topics, straightforward questions are fine and often better — don't manufacture complexity where none exists. Either way, check this concretely before finalizing a question built around a specific technique or identity: is there a different, more direct path to the same answer that skips the technique entirely — computing the raw result by hand instead of applying what the section just built, say — and is that bypass at least as easy? If so, the question isn't testing the thing it's attached to, however relevant it looks on the page. Reshape the setup so the technique is genuinely the fastest or only reasonable route, or don't ask it.

CONCISENESS. State what's given and what's being asked, then stop. Re-explaining context the reader already has, narrating the setup instead of presenting it, and announcing which tool to reach for before the reader's had a chance to reach for it themselves are all padding, not clarity — cut them. This applies to answer options too: once the stem has already fixed an ordering, a variable name, or a piece of notation, repeating it in front of every single option adds nothing — give the value alone and let the stem carry what it represents.

DISTRACTORS. Should be clearly wrong on reflection; for mathematical questions, avoid options that are equivalent in value even if written differently, and never duplicate an option outright. When a question's real content is that some quantity turns out to be independent of a variable that looks like it should matter — the same for every case, every index, every choice of an otherwise-free parameter — that independence claim is exactly what a distractor should test: include at least one option representing what the value would be if it did depend on that variable, not just numeric variants clustered around the right magnitude. Otherwise the question can be answered by guessing "it's probably the boring constant one" without ever engaging with why it's constant.

GETTING THE TARGET RIGHT. Some questions hinge on a distinction that's easy to get backwards by accident — which of two similar things is which, which direction a relationship or cause runs, what happened before what, which side an effect lands on, what gets added versus subtracted. When a question's correct answer depends on a choice like this, work it out deliberately and double-check it before finalizing — this is the single most common way a question quietly drifts toward the wrong answer without anyone noticing while drafting. And if a question's content is naturally tied to material that only exists in one particular section, confirm before committing to that placement that some natural, non-contrived choice of values or configuration there can actually produce a clean, defensible answer; if it can't, look for freedom you haven't used yet — a relative sign or magnitude, a direction, which object plays which role, which specific case you reach for — before forcing a strained setup.

FINAL REVIEW — before treating the document as finished, reread it once, straight through, in the order a reader will actually meet it. Everything above is written to be applied while drafting each piece — a section, a question, a table — and checking a piece against a rule while writing it will not catch a problem that only exists in how two pieces relate to each other across a distance. That's what this pass is for: read it the way a first-time reader would, start to end, and watch for failures that are invisible piece-by-piece but obvious once the whole thing is visible at once.

- Forward references: does any question, or any tool block, depend on a formula, definition, or result that doesn't actually appear until later in the document? A question may only use what a reader would have already seen by that exact point in the reading order — not what's coming a section, or even a paragraph, later. This is easy to miss while drafting a question right after writing the paragraph that motivates it, since the formula it needs feels close by even when it hasn't been derived yet.
- Does the opening give the central idea a meaningful purpose? Are brief explanations of purpose useful rather than repeated announcements? Can a first-time reader follow the progression without already knowing the conclusion?
- Does the central statement have a clear meaning, explained notation, an accessible example, and worked use? Is its justification appropriate to the scope, without unsupported claims or premature formalism?
- Do questions leave real work at the intended level, progressing from accessible checks to fresh interpretation or transfer? Are any questions merely repeating an answer already given, or introducing unfamiliar machinery to manufacture difficulty?
- No "using the ___" openers anywhere, and no stem that restates an already-derived tool right before asking the reader to apply it.
- No paragraph anywhere in the document — before a question, immediately after it, or much later, however it's framed — that discusses, defends, hints at, or explains why a specific option is right or wrong.
- Every bonus question's reasoning traceable to something the main document actually stated or demonstrated on the page — not a natural-feeling extension of it that was never actually shown.
- Every main and bonus question has exactly one [ANSWER: X] tag naming a letter that is actually one of that question's own listed options — a missing, mistyped, or dangling tag means that question silently fails to score.
- Every section whose central object has a shape: does it have a graph, placed where the section first works with that object? A section about a visible object that is explained in prose alone is a gap to fix now.
- Do wording and visuals avoid misleading implications? Do plots faithfully represent the described domain and features, with limitations acknowledged when the supported format cannot show a distinction?
- Every graph block: expressions in plain calculator notation (no LaTeX, no bars for absolute value, ^ for powers); every slider name used in an expression is defined by a slider line; ranges that actually show the feature the prose is about; no graph plots or marks the specific object a nearby question asks about; xlabel, ylabel, point and segment labels are each one math span or plain text, never a mix; fields separated by " | " with spaces.
- No literal "|" sitting inside a table cell outside \\lvert \\rvert.

If the read-through turns up any of these, fix it before finalizing. Having applied a rule correctly while drafting a piece is not the same guarantee as the finished document actually being right — the read-through is what confirms it, not an assumption that following the rules along the way was enough.`;
}
