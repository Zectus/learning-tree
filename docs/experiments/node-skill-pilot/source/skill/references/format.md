OUTPUT FORMAT (follow exactly — a parser will read this file)

This is a plain .txt file. Rules:
- No markdown: no **, no ##, no backticks, no bullet points using *, no _italics_ — including using ** to fake bold for a vector symbol (e.g. **S**); that's KaTeX's job (\mathbf{}), not markdown's, see the Math rule below
- No HTML, no code blocks, no widgets, and no interactive elements of any kind — the one exception is the slider line a graph block can carry (see Graphs below), which is part of the graph format, not HTML
- Prose only — use plain paragraphs and the section/question/table/timeline/graph markers below

Section headers:
=== SECTION N: TITLE ===

The very first line of the document must be "=== SECTION 1: TITLE ===" — nothing precedes it. No title line, no opening sentence, no framing paragraph sits above the first section header; start the lesson at that marker so its structure is clear.

Questions must use this format exactly:

[QUESTION N]
[ANSWER: X]
Question text here, with \( LaTeX \) as needed.

(A) first option
(B) second option
(C) third option
(D) fourth option
(E) fifth option
[/QUESTION]

Replace X with whichever letter is actually correct, as (A)-(E) are written above. This works exactly like the [ANSWER: X] tag in the [BONUS] format further down — hidden from the reader, read only by the app, and not something to think about when deciding where to place the correct option among (A)-(E); place it wherever it naturally falls as you write the options, in any order you like. Keep each question's particular solution and option evaluation out of the visible lesson, including later passages. Teach the general ideas and demonstrate them on other cases before asking the question; do not work through that question's own setup or reveal its distinguishing conclusion. Check that no passage or graph supplies the specific answer without the intended learner work. The answer tag is the only place that explicitly identifies the correct option.

Four tools are available. Math, tables and timelines are for material that has something to typeset, compare, or put in order: don't force KaTeX onto a topic without math, or a table or timeline onto material with no tabular or chronological structure. Graphs are different: they are the default, not an extra. Whenever a section's central object has a shape — a function, a curve, a surface, a field, a relationship between two quantities, a configuration of points and lines in a plane — draw it, at the point where that section first works with it, so the reader sees the object while the prose is analyzing it. Prose alone asks the reader to hold in their head a picture that a graph hands over for free. Refer back to an existing graph when it already serves the next learning step. For purely symbolic or non-visual material, do not force a graph. If the supported format cannot represent a relevant distinction faithfully, use a different accurate illustration or explain its limitation; never distort the object to satisfy this expectation. A document on a topic with geometry in it that comes out with no graph at all has a gap, and the final review below checks for it.

- Math: inline with \( ... \), display with \[ ... \]. Skip entirely for a topic with nothing to typeset. This applies uniformly — there is no such thing as a mathematical symbol too minor or too casual to wrap. A single variable name, a subscript, a dot or cross product, a vector mentioned in passing mid-sentence: if it's math, it goes in \( \), with exactly the same treatment as a formula on its own display line. Don't let a symbol's position — sitting inside a flowing sentence versus standing alone — decide whether it gets KaTeX; a parser reading this file can't tell "casual mention" from "official equation," and treating them differently is what produces a document that's formatted one way in its displayed equations and drifts into bare ASCII (r_u, F · n) the moment the same math shows up in prose. Bold or vector notation is no exception to the no-markdown rule either — never fake it with ** (e.g. **S** for a bold vector); use the real KaTeX command (\mathbf{}) inside \( \) instead.
- Tables, for anything genuinely tabular — a comparison across several things along the same dimensions, a small reference of values, anything a reader would otherwise have to hold in their head across several sentences:
[TABLE]
Header A | Header B | Header C
Row 1 col A | Row 1 col B | Row 1 col C
Row 2 col A | Row 2 col B | Row 2 col C
[/TABLE]
  First line is the header row; every line is cells separated by " | " — always with a single space on each side, exactly as in the example above. That spacing is what a column divider actually looks like; a bare "|" with no space around it (an absolute value bar, a norm, a set-builder pipe, sitting inside a cell's own math) is read as content, not a divider, so you don't need to avoid literal pipes in table-cell math. Still, prefer \lvert ... \rvert over bare | ... | for absolute value inside a table cell — it typesets with better spacing — and never use \| for a single absolute-value bar; that's a different symbol (‖, a norm). Keep cells short — this renders as a real table, not a wall of prose crammed into cells.
- Timelines, for a genuine chronology or ordered progression — a sequence of dated events, stages, or steps where the ordering itself is part of what's being taught:
[TIMELINE]
Marker 1 | What happened or what this stage is
Marker 2 | What happened or what this stage is
[/TIMELINE]
  The marker is usually a date or year but can be any short label — a stage name, "Step 1," an era — whatever the sequence is actually ordered by. One line per point on the timeline, marker and description separated by " | " (spaced, same convention as TABLE above, for the same reason — it's what tells a real divider apart from a bare pipe that happens to sit inside the marker or description's own math).
