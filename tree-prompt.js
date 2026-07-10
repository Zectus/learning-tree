/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPT — pure text template
   This is the prompt copied out of the "new tree" modal and
   pasted into a Claude conversation to generate a whole new
   tree .json for a subject. Called from buildTreePrompt() in
   io.js, which computes fileSlug/startClause/languageClause;
   this file holds no logic of its own, just the prompt text.
═══════════════════════════════════════════════════════════ */
function renderTreePrompt({ topic, fileSlug, startClause, languageClause }) {
  return `You are designing a prerequisite tree for the subject: ${topic}

Deliver this as a downloadable file named ${fileSlug}-tree.json — not as JSON pasted into the chat as text. Do all planning and double-checking in your thinking; your visible output should contain nothing but the file itself, no preamble, no summary, no commentary before or after it.

Each node in this tree becomes its own generated lesson later (a separate process turns one node into a full document someone reads in one sitting). Keep that in mind as the real constraint behind everything below: a node isn't a label on a graph, it's a promise about how much material someone is about to sit down and learn in one piece.${startClause}${languageClause}

OUTPUT SCHEMA

{
  "topic": "${topic}",
  "language": "Spanish",
  "nodes": [
    { "id": "slug", "label": "Display Name", "requires": ["slug1","slug2"], "optional": false }
  ]
}

- topic: the exact subject this tree was designed for, exactly as given above. Always include this — it's used to label the tree and name its downloaded file.
- language: the language every node's "label" is written in, exactly as given to you above. Omit this key entirely if no language was specified — the default is English and there's nothing to record.
- id: a short, stable, lowercase snake_case slug. Only used to wire up "requires" — never shown to anyone. Pick something you'll still recognize if you have to reference it later.
- label: the human-readable name on the node card, and the thing the later lesson-generation step is handed as its topic. Name an actual concept, law, definition, or technique — not a chapter title, not a vague theme.
- requires: the ids of every node that must be completed before this one unlocks. Omit the key entirely for a root. Everything listed is ANDed — all of them must be done, not just one of them.
- optional: true tags a node as enrichment — interesting, not load-bearing for the rest of the tree. It's purely a label for the learner; it does not loosen locking. A node that requires an optional node still needs it done. Leave this off unless you mean it.
- done: don't set this. It only exists for re-importing a tree that already has progress on it.

THE QUESTION TO ASK FOR EVERY NODE

What, concretely, does this node teach that wasn't already taught by its prerequisites? If you can't answer without basically restating something a prerequisite covers, the node doesn't earn its place yet — either fold it into whichever node already covers that ground, or sharpen it until it has real content of its own that a reader couldn't get from its prerequisites alone.

GRANULARITY

A node is one law, one definition, one named result, one technique with its own derivation — not a multi-topic chapter, and not a single isolated fact either. If you're tempted to write a label like "Introduction to X" or "X Basics," that's usually a sign the node is actually several nodes squashed together, or so thin it should be folded into its neighbor.

BUNDLE WHEN THE NEXT STEP IS A REFRAMING, SPLIT WHEN IT NEEDS REAL NEW MACHINERY

If the immediate consequence of an idea is a small move — dividing by something, restating the same content in different notation, a one-line corollary — that consequence belongs in the SAME node as the idea it falls out of. Don't manufacture a second node whose entire content is "and therefore X," because that node will have almost nothing to say that the first node didn't already say. But if the next step needs a genuinely new piece of machinery — a new theorem or principle, a real derivation or argument, a different technique or method — give it its own node, even if it feels like the "obvious next thing" to glue on. The test is the same one as above: a node that's just a short corollary of its parent fails the "what does this teach on its own" question and should be folded back in.

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

Use the real name of the law, theorem, or concept as the label. Add a short parenthetical qualifier only when two nodes share a name and need to be told apart by form or version (e.g. one node being an early, restricted form of a result and another being the general version). Don't invent chapter-style titles that don't correspond to what's actually taught.

DON'T HAND-WRING OVER TRANSITIVE REDUNDANCY

If C requires B and B already requires A, you don't need to also list A directly under C just to be thorough — the tool detects edges that are already implied by another path and removes them automatically. Get the real, direct dependency right for each node; don't burn effort manually tracing every possible indirect path.

PLAN FIRST

The output here is short — a few dozen lines of JSON, nowhere near the length of an actual lesson. That means almost all of your effort should go into working out the structure, not into writing the file. Don't start typing nodes as you think of them. Before you write a single line of JSON:

- List every concept, law, definition, or technique a complete treatment of the subject would need, in roughly the order someone would need to learn them. This is your candidate node list, built before you've committed to any ids or edges.
- Go down that list and run the granularity question on each candidate: what does it teach that its neighbors don't? Merge anything that fails that test, split anything that's secretly two ideas bundled together.
- For every place one topic seems to lead into the next, decide explicitly: is the second one a reframing of the first (bundle), or does it need real new machinery (split)?
- Identify the genuine starting points — the things that don't depend on anything else in your list — and don't force them into a single shared root if the subject doesn't actually have one.
- Identify the real convergence points: the handful of places where something only exists because two or more earlier threads come together. Everything else should carry the minimum prerequisites it actually needs, not a chain padded out for the sake of it.
- Identify where the subject fans back out into independent applications or directions rather than continuing as one straight line.

Only once this map is solid — in your head or in scratch notes — should you write the actual JSON. The JSON is the last step, not something you build incrementally while you're still discovering the structure.

Now design a tree, in this exact format, for: ${topic}`;
}
