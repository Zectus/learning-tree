/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — pure text template
   This is the prompt copied out of the "new tree" modal and
   pasted into a Claude conversation to generate a whole new
   tree .json for a subject. Called from buildTreePrompt() in
   io.js, which computes fileSlug/languageClause;
   this file holds no logic of its own, just the prompt text.
═══════════════════════════════════════════════════════════ */
function renderTreePrompt({ topic, fileSlug, languageClause }) {
  return `You are designing a prerequisite tree for the subject: ${topic}

Deliver this as a downloadable file named ${fileSlug}-tree.json — not as JSON pasted into the chat as text. Do all planning and double-checking in your thinking; your visible output should contain nothing but the file itself, no preamble, no summary, no commentary before or after it.

Each node in this tree becomes its own generated lesson later (a separate process turns one node into a full document someone reads in one sitting). Keep that in mind as the real constraint behind everything below: a node isn't a label on a graph, it's a promise about how much material someone is about to sit down and learn in one piece.${languageClause}

OUTPUT SCHEMA

{
  "topic": "${topic}",
  "language": "Spanish",
  "nodes": [
    { "id": "slug", "label": "Display Name", "explanation": "1-3 sentences pinning down exactly what this node covers and where its edges are", "requires": ["slug1","slug2"], "optional": false }
  ]
}

- topic: the exact subject this tree was designed for, exactly as given above. Always include this — it's used to label the tree and name its downloaded file.
- language: the language every node's "label" is written in, exactly as given to you above.
- id: a short, stable, lowercase snake_case slug. Only used to wire up "requires" — never shown to anyone. Pick something you'll still recognize if you have to reference it later.
- label: the human-readable name on the node card, and the thing the later lesson-generation step is handed as its topic. Name an actual concept, law, definition, or technique — not a chapter title, not a vague theme.
- explanation: a private note, never shown to the learner — it's handed straight to the later lesson-generation step alongside the label, as the actual working spec of what this node covers. The label is a name; the explanation is the boundary. Say which specific sub-results, cases, or siblings belong inside this node, and — just as importantly — which adjacent ones don't, so the later step isn't left guessing at scope from a two- or three-word title. This is also where you write down the broader family a narrow-sounding label actually belongs to (see SIZE EACH NODE TO A REAL DOCUMENT below) when the label alone wouldn't convey it. Always include it, even if it's short.
- requires: the ids of every node that must be completed before this one unlocks. Omit the key entirely for a root. Everything listed is ANDed — all of them must be done, not just one of them.
- optional: true tags a node as enrichment — interesting, not load-bearing for the rest of the tree. It's purely a label for the learner; it does not loosen locking. A node that requires an optional node still needs it done. Leave this off unless you mean it.
- done: don't set this. It only exists for re-importing a tree that already has progress on it.

THE QUESTION TO ASK FOR EVERY NODE

What, concretely, does this node teach that wasn't already taught by its prerequisites? If you can't answer without basically restating something a prerequisite covers, the node doesn't earn its place yet — either fold it into whichever node already covers that ground, or sharpen it until it has real content of its own that a reader couldn't get from its prerequisites alone.

GRANULARITY

A node is one law, one definition, one named result, one technique with its own derivation — not a multi-topic chapter, and not a single isolated fact either. If you're tempted to write a label like "Introduction to X" or "X Basics," that's usually a sign the node is actually several nodes squashed together, or so thin it should be folded into its neighbor.

BUNDLE WHEN THE NEXT STEP IS A REFRAMING, SPLIT WHEN IT NEEDS REAL NEW MACHINERY

If the immediate consequence of an idea is a small move — dividing by something, restating the same content in different notation, a one-line corollary — that consequence belongs in the SAME node as the idea it falls out of. Don't manufacture a second node whose entire content is "and therefore X," because that node will have almost nothing to say that the first node didn't already say. But if the next step needs a genuinely new piece of machinery — a new theorem or principle, a real derivation or argument, a different technique or method — give it its own node, even if it feels like the "obvious next thing" to glue on. The test is the same one as above: a node that's just a short corollary of its parent fails the "what does this teach on its own" question and should be folded back in.

SIZE EACH NODE TO A REAL DOCUMENT, NOT A SINGLE FACT

Each node becomes a self-contained document of roughly five to eight content sections and a handful to a dozen main questions, built entirely from that node's own real material — no padding. Before locking in a node's scope, list its content honestly, section by section, and check there's actually that much distinct, non-repetitive substance in it. One named result plus nothing but its own trivial restatements and edge cases does not clear that bar — a document forced out of a topic that thin ends up manufacturing filler to reach a reasonable length: special cases that don't teach anything genuinely new, a detour into some adjacent technique that isn't really this node's material. That's a symptom of the topic being too narrow, not a sign the node needs more padding — broaden it instead to the natural family that result belongs to. A single rule sits alongside the other rules in the same family; a single special case sits alongside the general result and its other special cases; a single technique sits alongside the other techniques that solve the same class of problem. Use the explanation field (see OUTPUT SCHEMA) to record precisely which of these siblings this node includes, so the label can stay a short, recognizable name while the real boundary lives in the explanation. The opposite failure is just as real and just as common: a topic that actually needs fifteen sections to do justice to isn't one node, it's several — split it the way GRANULARITY above already describes.

MULTIPLE ROOTS ARE FINE

A tree doesn't need exactly one starting node. If the subject genuinely has more than one independent foundation that only come together later, give it more than one root and let them merge downstream wherever that merge actually happens in the subject itself — not earlier, for the sake of having a single starting point. Two roots that don't touch each other for a long stretch, joining only once something genuinely needs both, is a completely normal shape. Don't invent a dependency between them just to make the graph look like a single tree.

CONVERGENCE SHOULD MARK REAL SYNTHESIS

A node with several requirements should have exactly that many because the concept genuinely is the combination of those specific pieces — not because you're trying to make the graph look connected or "give every branch somewhere to go." A good test: if you removed any one of its listed prerequisites, would the node still have something to teach? If yes, that prerequisite probably doesn't belong there. If you can't explain, in one sentence, why this particular node needs precisely these prerequisites together and not some subset of them, the convergence isn't real yet.

A NODE CAN REACH BACK ACROSS BRANCHES, NOT JUST TO "WHAT CAME RIGHT BEFORE IT"

Requirements don't have to come from the most recent layer or the same branch. If a node genuinely needs something from early in a totally different branch, alongside something much more recent, list both — it's normal for a node deep in one branch to depend on something from way back in another, sitting alongside something that was just established. Don't artificially limit a node to depend only on its immediate predecessor — depend on whatever it actually needs, wherever that sits in the tree.

DON'T FORCE A UNIFORM TEMPLATE ACROSS PARALLEL BRANCHES

If several branches each go through a similarly-shaped stage, that doesn't mean all of them need to mechanically continue the same way right after. One might genuinely head into the obvious next stage; another might need to resolve some inconsistency first; a third might just be finished. Follow what the subject actually does next at each point, not a pattern you started applying a few nodes ago just because it worked elsewhere in the tree.

ENDINGS CAN FAN BACK OUT

A tree doesn't need to converge to one final capstone node. Once a major synthesis point is reached, it's fine — often better — to fan back out into several independent applications or directions that each only need that synthesis node, rather than forcing one more linear chain to a single ending.

NAMING

Use the real name of the law, theorem, or concept as the label. Add a short parenthetical qualifier only when two nodes share a name and need to be told apart by form or version (e.g. one node being an early, restricted form of a result and another being the general version). Don't invent chapter-style titles that don't correspond to what's actually taught. A label can and often should stay narrow-sounding even when SIZE EACH NODE TO A REAL DOCUMENT above led you to broaden the node's actual content — that's exactly what the explanation field is for; don't pad the label itself into a run-on chapter title just to signal the broader scope.

DON'T HAND-WRING OVER TRANSITIVE REDUNDANCY

If C requires B and B already requires A, you don't need to also list A directly under C just to be thorough — the tool detects edges that are already implied by another path and removes them automatically. Get the real, direct dependency right for each node; don't burn effort manually tracing every possible indirect path.

FIND THE REAL STARTING POINT BY ASKING, NOT GUESSING

A free-text description of what someone already knows — even a good-faith one — is a genuinely unreliable way to pin down where a tree should start. People don't reliably know their own gaps: "I know linear algebra" can mean anything from a full course to a half-remembered term, and the boundary that actually matters — the first thing they'd genuinely struggle with — is usually invisible to the person standing on one side of it. That's exactly why this doesn't ask for a starting point up front and take it at face value; it's worked out from here, through real questions, not guessed from a label the person put on themselves.

Before designing anything, run a short calibration with the person. Pick concrete checkpoint concepts spread across the plausible range for ${topic} — from clearly foundational to clearly advanced for what this tree is about to cover — and for each one, ask something that tests it directly rather than asking them to self-rate. "Would you know how to [a specific, concrete task]?" or "Have you worked with [a specific named technique] before?" gets a far more honest answer than "are you comfortable with X?" — self-rated comfort with a named topic is exactly the kind of question people are worst at answering accurately about themselves, especially for gaps they don't know they have. Ask one checkpoint at a time, or a few together only when they're genuinely tightly related — never bundle unrelated checkpoints into a single question just to save turns. Let the number of checkpoints and questions be whatever the plausible range actually calls for, not a fixed target; keep going until you've bisected it well, not until you've hit some count.

That first round will usually locate a rough boundary rather than a precise one — the person clearly has some of what's involved and clearly lacks some of the rest, with a gray zone in between. That gray zone, not the parts you're already confident about in either direction, is exactly where the tree's earliest nodes are going to sit, so it's the one place worth spending more questions on. Once the first round shows roughly where the boundary falls, run a second round concentrated specifically there: the individual definitions, formulas, and named sub-results that a course or self-study path reaching that general level might easily have included or skipped — the kind of specific thing that determines whether the tree's first node reads as a redundant recap or a confusing leap, not whether the person is a beginner or advanced overall. If the first round already gave a clean, unambiguous cutover — nothing hazy, no reason to think some specific piece is sitting unresolved in the middle — a second round doesn't add anything; go straight to designing the tree. The second round only earns its place when there's an actual gray zone left to resolve, and even then it should stay just as targeted as the first, aimed at the boundary itself rather than a broader retake of the whole range. Here too, ask one thing at a time rather than stacking several sub-questions into one message.

If you have a way to present these as selectable options for the person to choose from, use it. If you don't have that capability in this conversation, just ask the questions plainly, as ordinary conversational text, one at a time, and wait for a reply before doing anything else.

Once you have real answers — from one round or two — use them, not a guess and not the free-text hint alone, to fix the actual starting point. Then continue straight into designing and outputting the tree in this same conversation. Don't ask the person to re-paste anything or treat this as a separate task; the calibration is step one of this same job, not a prerequisite conversation that ends before the real one begins.

PLAN FIRST

The output here is short — a few dozen lines of JSON, nowhere near the length of an actual lesson. That means almost all of your effort should go into working out the structure, not into writing the file. Don't start typing nodes as you think of them. Before you write a single line of JSON:

- Run the calibration in FIND THE REAL STARTING POINT above and get the person's answers. Nothing else on this list can be done honestly until you know where the tree actually needs to start.
- List every concept, law, definition, or technique a complete treatment of the subject would need, in roughly the order someone would need to learn them. This is your candidate node list, built before you've committed to any ids or edges.
- Go down that list and run the granularity question on each candidate: what does it teach that its neighbors don't? Merge anything that fails that test, split anything that's secretly two ideas bundled together.
- Run each candidate through SIZE EACH NODE TO A REAL DOCUMENT too: does it honestly have five to eight sections' worth of distinct content, or would writing it in full mean padding out one thin result? Broaden anything too thin into its natural sibling family before moving on, and draft the explanation that will pin down the broadened scope.
- For every place one topic seems to lead into the next, decide explicitly: is the second one a reframing of the first (bundle), or does it need real new machinery (split)?
- Identify the genuine starting points — the things that don't depend on anything else in your list — and don't force them into a single shared root if the subject doesn't actually have one.
- Identify the real convergence points: the handful of places where something only exists because two or more earlier threads come together. Everything else should carry the minimum prerequisites it actually needs, not a chain padded out for the sake of it.
- Identify where the subject fans back out into independent applications or directions rather than continuing as one straight line.

Only once this map is solid — in your head or in scratch notes — should you write the actual JSON. The JSON is the last step, not something you build incrementally while you're still discovering the structure.

Now design a tree, in this exact format, for: ${topic}`;
}

/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — FROM A FILE
   Same idea, different starting point: instead of the person
   typing a topic/starting-point/language into the modal, this
   static prompt (no inputs — see the "from a file" tab in the
   new-tree modal) is pasted into a fresh Claude conversation
   ALONGSIDE the file(s) they actually want to understand — a
   paper, a textbook excerpt, a photo of a problem they're stuck
   on. Claude reads the file(s) first and derives the topic,
   starting point, and language itself, then builds a tree whose
   destination is specifically that file's content, not a generic
   survey of its broader subject. Every structural principle below
   (granularity, bundling, convergence, etc.) is identical to
   renderTreePrompt above on purpose — a good tree is a good tree
   regardless of where the topic came from.
═══════════════════════════════════════════════════════════ */
function renderTreePromptFromFile() {
  return `You are designing a prerequisite tree based on the file(s) attached to this conversation — a paper, a textbook excerpt, lecture notes, a photo of a problem, anything the person wants to fully understand but feels like they're missing a lot of what leads up to it.

Read every attached file in full before doing anything else. From them, you need to work out three things yourself — none of it is given to you here:

- THE TOPIC. Not the broad field the material happens to sit in, but the actual, specific thing being taught or asked — the concept, result, or problem the file is built around. If several files are attached together, treat them as one body of material and find the topic that ties them together (or, if they're genuinely unrelated, go with whichever is clearly the main subject and treat the rest as supporting context).
- THE STARTING POINT. Look at what the file assumes without explaining — notation used without defining it, results cited without proving them, techniques applied without introducing them first. That's a first hypothesis for the level the tree should start from — don't build from absolute scratch, and don't guess at a generic "intro" level; infer it from what the material itself is already taking for granted. But treat it as exactly that, a hypothesis: what a file assumes its reader knows and what the actual person attaching it here really knows are two different things, and only one of them is who the tree is for. See FIND THE REAL STARTING POINT BY ASKING, NOT GUESSING below for how to confirm it with them before treating it as settled.
- THE LANGUAGE. Match whatever language the attached file(s) are written in. If they're in more than one, follow whichever the core material is in.

Deliver this as a downloadable file named after a short lowercase snake_case slug you derive from the topic you identify — e.g. subject_name-tree.json — not as JSON pasted into the chat as text. Do all reading, planning, and double-checking in your thinking; your visible output should contain nothing but the file itself, no preamble, no summary, no commentary before or after it.

Each node in this tree becomes its own generated lesson later (a separate process turns one node into a full document someone reads in one sitting). Keep that in mind as the real constraint behind everything below: a node isn't a label on a graph, it's a promise about how much material someone is about to sit down and learn in one piece.

THE DESTINATION IS THE FILE ITSELF, NOT THE SUBJECT IT BELONGS TO

This isn't a generic survey of the broader field the file happens to sit in. The tree's terminal node or nodes should represent full understanding of exactly what's in the attached file(s) — able to actually read the passage, follow the actual derivation, or solve the actual problem, not just "know about" the general area around it. Everything upstream of that earns its place because the file's own content genuinely needs it — not because it's commonly taught alongside the topic elsewhere.

OUTPUT SCHEMA

{
  "topic": "Subject Name",
  "language": "Spanish",
  "nodes": [
    { "id": "slug", "label": "Display Name", "explanation": "1-3 sentences pinning down exactly what this node covers and where its edges are", "requires": ["slug1","slug2"], "optional": false }
  ]
}

- topic: the specific topic you identified from the attached file(s) (see THE TOPIC above), written the way a person would naturally refer to it. Always include this — it's used to label the tree and name its downloaded file. The example above is illustrative, not a value to copy.
- language: the language you identified the file(s) to be written in (see THE LANGUAGE above), and the language every node's "label" is written in.
- id: a short, stable, lowercase snake_case slug. Only used to wire up "requires" — never shown to anyone. Pick something you'll still recognize if you have to reference it later.
- label: the human-readable name on the node card, and the thing the later lesson-generation step is handed as its topic. Name an actual concept, law, definition, or technique — not a chapter title, not a vague theme.
- explanation: a private note, never shown to the learner — it's handed straight to the later lesson-generation step alongside the label, as the actual working spec of what this node covers. The label is a name; the explanation is the boundary. Say which specific sub-results, cases, or siblings belong inside this node, and — just as importantly — which adjacent ones don't, so the later step isn't left guessing at scope from a two- or three-word title. This is also where you write down the broader family a narrow-sounding label actually belongs to (see SIZE EACH NODE TO A REAL DOCUMENT below) when the label alone wouldn't convey it. Always include it, even if it's short.
- requires: the ids of every node that must be completed before this one unlocks. Omit the key entirely for a root. Everything listed is ANDed — all of them must be done, not just one of them.
- optional: true tags a node as enrichment — interesting, not load-bearing for the rest of the tree. It's purely a label for the learner; it does not loosen locking. A node that requires an optional node still needs it done. Leave this off unless you mean it.
- done: don't set this. It only exists for re-importing a tree that already has progress on it.

THE QUESTION TO ASK FOR EVERY NODE

What, concretely, does this node teach that wasn't already taught by its prerequisites? If you can't answer without basically restating something a prerequisite covers, the node doesn't earn its place yet — either fold it into whichever node already covers that ground, or sharpen it until it has real content of its own that a reader couldn't get from its prerequisites alone.

GRANULARITY

A node is one law, one definition, one named result, one technique with its own derivation — not a multi-topic chapter, and not a single isolated fact either. If you're tempted to write a label like "Introduction to X" or "X Basics," that's usually a sign the node is actually several nodes squashed together, or so thin it should be folded into its neighbor.

BUNDLE WHEN THE NEXT STEP IS A REFRAMING, SPLIT WHEN IT NEEDS REAL NEW MACHINERY

If the immediate consequence of an idea is a small move — dividing by something, restating the same content in different notation, a one-line corollary — that consequence belongs in the SAME node as the idea it falls out of. Don't manufacture a second node whose entire content is "and therefore X," because that node will have almost nothing to say that the first node didn't already say. But if the next step needs a genuinely new piece of machinery — a new theorem or principle, a real derivation or argument, a different technique or method — give it its own node, even if it feels like the "obvious next thing" to glue on. The test is the same one as above: a node that's just a short corollary of its parent fails the "what does this teach on its own" question and should be folded back in.

SIZE EACH NODE TO A REAL DOCUMENT, NOT A SINGLE FACT

Each node becomes a self-contained document of roughly five to eight content sections and a handful to a dozen main questions, built entirely from that node's own real material — no padding. Before locking in a node's scope, list its content honestly, section by section, and check there's actually that much distinct, non-repetitive substance in it. One named result plus nothing but its own trivial restatements and edge cases does not clear that bar — a document forced out of a topic that thin ends up manufacturing filler to reach a reasonable length: special cases that don't teach anything genuinely new, a detour into some adjacent technique that isn't really this node's material. That's a symptom of the topic being too narrow, not a sign the node needs more padding — broaden it instead to the natural family that result belongs to. A single rule sits alongside the other rules in the same family; a single special case sits alongside the general result and its other special cases; a single technique sits alongside the other techniques that solve the same class of problem. Use the explanation field (see OUTPUT SCHEMA) to record precisely which of these siblings this node includes, so the label can stay a short, recognizable name while the real boundary lives in the explanation. The opposite failure is just as real and just as common: a topic that actually needs fifteen sections to do justice to isn't one node, it's several — split it the way GRANULARITY above already describes.

MULTIPLE ROOTS ARE FINE

A tree doesn't need exactly one starting node. If the subject genuinely has more than one independent foundation that only come together later, give it more than one root and let them merge downstream wherever that merge actually happens in the subject itself — not earlier, for the sake of having a single starting point. Two roots that don't touch each other for a long stretch, joining only once something genuinely needs both, is a completely normal shape. Don't invent a dependency between them just to make the graph look like a single tree.

CONVERGENCE SHOULD MARK REAL SYNTHESIS

A node with several requirements should have exactly that many because the concept genuinely is the combination of those specific pieces — not because you're trying to make the graph look connected or "give every branch somewhere to go." A good test: if you removed any one of its listed prerequisites, would the node still have something to teach? If yes, that prerequisite probably doesn't belong there. If you can't explain, in one sentence, why this particular node needs precisely these prerequisites together and not some subset of them, the convergence isn't real yet.

A NODE CAN REACH BACK ACROSS BRANCHES, NOT JUST TO "WHAT CAME RIGHT BEFORE IT"

Requirements don't have to come from the most recent layer or the same branch. If a node genuinely needs something from early in a totally different branch, alongside something much more recent, list both — it's normal for a node deep in one branch to depend on something from way back in another, sitting alongside something that was just established. Don't artificially limit a node to depend only on its immediate predecessor — depend on whatever it actually needs, wherever that sits in the tree.

DON'T FORCE A UNIFORM TEMPLATE ACROSS PARALLEL BRANCHES

If several branches each go through a similarly-shaped stage, that doesn't mean all of them need to mechanically continue the same way right after. One might genuinely head into the obvious next stage; another might need to resolve some inconsistency first; a third might just be finished. Follow what the subject actually does next at each point, not a pattern you started applying a few nodes ago just because it worked elsewhere in the tree.

ENDINGS CAN FAN BACK OUT — BUT EVERY LEAF MUST STILL LAND ON THE FILE'S OWN CONTENT

A tree doesn't need to converge to one final capstone node; once a major synthesis point is reached, it's fine — often better — to fan back out into several independent applications or directions that each only need that synthesis node, rather than forcing one more linear chain to a single ending. The one constraint specific to this file-based tree: whatever the leaves are, at least one of them (ideally the natural final one) has to actually be the file's own content — the specific result, passage, or problem it contains — not a nearby application you invented because endings are supposed to fan out.

NAMING

Use the real name of the law, theorem, or concept as the label. Add a short parenthetical qualifier only when two nodes share a name and need to be told apart by form or version (e.g. one node being an early, restricted form of a result and another being the general version). Don't invent chapter-style titles that don't correspond to what's actually taught. A label can and often should stay narrow-sounding even when SIZE EACH NODE TO A REAL DOCUMENT above led you to broaden the node's actual content — that's exactly what the explanation field is for; don't pad the label itself into a run-on chapter title just to signal the broader scope.

DON'T HAND-WRING OVER TRANSITIVE REDUNDANCY

If C requires B and B already requires A, you don't need to also list A directly under C just to be thorough — the tool detects edges that are already implied by another path and removes them automatically. Get the real, direct dependency right for each node; don't burn effort manually tracing every possible indirect path.

FIND THE REAL STARTING POINT BY ASKING, NOT GUESSING

What the file assumes its reader already knows is a reasonable first hypothesis, but it's still only a hypothesis about the person actually attached to this conversation, not a confirmed fact about them — someone might attach a paper that assumes real fluency they don't have, or undersell what they already know by attaching something introductory. Don't skip straight from "here's what the file assumes" to designing the tree.

Before designing anything, run a short calibration with the person. From what the file assumes and what it's actually teaching, pick concrete checkpoint concepts spread across the plausible range — from clearly foundational to clearly advanced for what this tree is about to cover — and for each one, ask something that tests it directly rather than asking them to self-rate. "Would you know how to [a specific, concrete task]?" or "Have you worked with [a specific named technique] before?" gets a far more honest answer than "are you comfortable with X?" — self-rated comfort with a named topic is exactly the kind of question people are worst at answering accurately about themselves, especially for gaps they don't know they have. Ask one checkpoint at a time, or a few together only when they're genuinely tightly related — never bundle unrelated checkpoints into a single question just to save turns. Let the number of checkpoints and questions be whatever the plausible range actually calls for, not a fixed target; keep going until you've bisected it well, not until you've hit some count.

That first round will usually locate a rough boundary rather than a precise one — the person clearly has some of what's involved and clearly lacks some of the rest, with a gray zone in between. That gray zone, not the parts you're already confident about in either direction, is exactly where the tree's earliest nodes are going to sit, so it's the one place worth spending more questions on. Once the first round shows roughly where the boundary falls, run a second round concentrated specifically there: the individual definitions, formulas, and named sub-results that a course or self-study path reaching that general level might easily have included or skipped — the kind of specific thing that determines whether the tree's first node reads as a redundant recap or a confusing leap, not whether the person is a beginner or advanced overall. If the first round already gave a clean, unambiguous cutover — nothing hazy, no reason to think some specific piece is sitting unresolved in the middle — a second round doesn't add anything; go straight to designing the tree. The second round only earns its place when there's an actual gray zone left to resolve, and even then it should stay just as targeted as the first, aimed at the boundary itself rather than a broader retake of the whole range. Here too, ask one thing at a time rather than stacking several sub-questions into one message.

If you have a way to present these as selectable options for the person to choose from, use it. If you don't have that capability in this conversation, just ask the questions plainly, as ordinary conversational text, one at a time, and wait for a reply before doing anything else.

Once you have real answers — from one round or two — use them, not the file-based hypothesis alone, to fix the actual starting point. Then continue straight into designing and outputting the tree in this same conversation. Don't ask the person to re-attach the file or treat this as a separate task; the calibration is step one of this same job, not a prerequisite conversation that ends before the real one begins.

PLAN FIRST

The output here is short — a few dozen lines of JSON, nowhere near the length of an actual lesson. That means almost all of your effort should go into reading the file and working out the structure, not into writing the file. Don't start typing nodes as you think of them. Before you write a single line of JSON:

- Read the attached file(s) fully and settle THE TOPIC and THE LANGUAGE from above. For THE STARTING POINT, run the calibration in FIND THE REAL STARTING POINT above and get the person's answers — don't settle it from the file-based hypothesis alone. These three decide everything that follows, so get them right before anything else.
- List every concept, law, definition, or technique someone would need to go from that starting point to fully understanding the file's actual content, in roughly the order they'd need to learn them. This is your candidate node list, built before you've committed to any ids or edges.
- Go down that list and run the granularity question on each candidate: what does it teach that its neighbors don't? Merge anything that fails that test, split anything that's secretly two ideas bundled together.
- Run each candidate through SIZE EACH NODE TO A REAL DOCUMENT too: does it honestly have five to eight sections' worth of distinct content, or would writing it in full mean padding out one thin result? Broaden anything too thin into its natural sibling family before moving on, and draft the explanation that will pin down the broadened scope.
- For every place one topic seems to lead into the next, decide explicitly: is the second one a reframing of the first (bundle), or does it need real new machinery (split)?
- Identify the genuine starting points — the things that don't depend on anything else in your list — and don't force them into a single shared root if the subject doesn't actually have one.
- Identify the real convergence points: the handful of places where something only exists because two or more earlier threads come together. Everything else should carry the minimum prerequisites it actually needs, not a chain padded out for the sake of it.
- Confirm the file's own content is genuinely reachable as a leaf (or set of leaves) from this structure — if it isn't yet, that's a gap in the candidate list, not something to patch over at the end.

Only once this map is solid — in your head or in scratch notes — should you write the actual JSON. The JSON is the last step, not something you build incrementally while you're still discovering the structure.

Now read the attached file(s), and design a tree, in this exact format, for what they teach.`;
}
