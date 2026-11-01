/* ═══════════════════════════════════════════════════════════
   TREE DESIGN PROMPTS — text templates for topic and file flows.
   Each node's label and explanation later become a lesson's teaching
   context (see prompts.js and node-prompt.js). The calibration conversation
   and source attachments are not automatically passed to that writer.
   Keep the teaching, scope and dependency rules shared between both flows.
   Keep instructions applicable across subjects; do not anchor them to a
   particular course, named result, or worked example. Lesson formatting
   and question construction belong in node-prompt.js, not here.
═══════════════════════════════════════════════════════════ */

const TREE_NODE_FRAMING = `Each node becomes a separate lesson that someone reads and works through in one sitting. Design a manageable learning goal and the route that makes it achievable from the reader's starting knowledge. A lesson must develop understanding and usable ability, with enough explanation, worked use, and practice to get there. Its length follows that work; there is no target number of nodes, sections, words, or questions.`;

// Calibration is visible conversation; file-only delivery starts afterward.
const TREE_FINAL_MESSAGE_RULE = `the calibration questions described below come first, as ordinary conversation — but once the tree is built, your final message should contain nothing but the file itself, no preamble, no summary, no commentary before or after it.`;

const TREE_LESSON_HANDOFF = `WHAT THE LATER LESSON WRITER WILL KNOW

The lesson writer receives the node's label and explanation, the labels and explanations of its direct prerequisites, the tree topic, and the names of immediately following nodes. It does not automatically receive this conversation, a separate starting-knowledge record, the source attachments, or every earlier lesson. Treat the explanation as a teaching brief that must survive that handoff.

Distinguish what this node actually teaches from what it assumes, supplies as an input, or leaves for later. Later lessons use prerequisite scopes as evidence of what has been established. A concept mentioned for motivation or explicitly excluded has not thereby been taught. State essential starting background where it is needed, including at roots; do not rely on a separate conversation to carry it. When using an earlier result whose scope is not visible in the direct prerequisite briefs, identify the established result and its relevant conditions in the current brief without making the learner repeat its lesson.`;

const TREE_CALIBRATION_METHOD = `Ask concrete checkpoint questions to locate what the learner can actually do. Prefer a small interpretation, distinction, or task they can attempt over asking whether they are comfortable with a named topic. Course names and reports of having seen a technique are clues, not evidence that its needed operations are available. Make the task understandable without knowing the answer, and allow the person to say they do not know.

Ask one checkpoint at a time, or a few together only when they test tightly related parts of the same ability. Wait for the person's reply before asking the next question or building the tree. Use selectable options if the conversation supports them; ordinary text works otherwise. Adapt to the answers rather than administering a fixed questionnaire or asking for a fixed number of turns.

Start with checkpoints that distinguish plausible starting levels for the intended destination, then investigate unresolved gaps near the first new learning. Check separate foundations separately when the learner's knowledge may be uneven across branches. A broad answer about a field does not settle every definition, operation, or convention within it. Equally, do not test every unfamiliar symbol when a short local explanation would suffice.

Stop when you can identify a defensible starting point for each needed branch and the background the early lessons may assume. Follow up on an actual ambiguity that would change those lessons; do not repeat a whole survey once the boundary is clear. Preserve the useful conclusions in the relevant node briefs. Continue to design and deliver the tree in this same conversation, without asking the person to paste the prompt or provide the same material again.`;

const TREE_DESIGN_PRINCIPLES = `PLAN BACKWARD FROM USABLE ABILITIES

Identify what the learner should be able to interpret, explain, distinguish, predict, or do at the destination. Work backward from those abilities to what must be learned, stopping at the background established for this tree. A list of concepts, laws, or techniques can help check coverage, but it is not itself a node plan. Build candidate nodes around meaningful gains in ability and the work needed to reach them.

For each candidate, ask what the learner can do afterward that they could not do with its prerequisites alone. A new name is not necessarily a new learning goal; a familiar name can hide a substantial new difficulty. Make the intended level clear. Interpreting a statement, applying a supplied rule, developing that rule, and justifying its range of validity can require different routes. Choose the treatment the destination needs rather than silently requiring all of them or treating them as interchangeable.

CHECK THE ROUTE BEFORE FIXING THE NODE BOUNDARY

Sketch an accessible problem or situation that gives the goal a purpose. Identify the obstacle the new idea resolves, a case that can carry the explanation, and how the learner reaches a meaningful use. For a result to be developed, check the choices, reasons, operations, and intermediate relations connecting the starting information to the conclusion. Announcing a finished result and checking an example does not supply that route. For a definition or supplied rule, plan its meaning and use rather than inventing a proof.

Classify the important inputs: what is already established, what may explicitly be supplied at this level, and what this lesson must develop. A rule may be accepted when the goal is its use or interpretation; do not use that permission to assume the very result the goal requires the learner to develop or explain. Preserve the connecting argument for new consequences of supplied inputs. Do not re-prove prerequisite results or import an unfamiliar theorem as a convenient shortcut.

Audit the knowledge needed by the route, not just the words in its title. This includes unfamiliar operations, representations, notation conventions, and background needed by the worked case. A small new convention can be explained where it first helps. A substantial independent body of knowledge may need an earlier lesson. Choose a more accessible case when its extra background would distract from the intended goal.

Where a goal involves a procedure or model, identify what is done, what information is retained, and what supports the next inference. For sequential reasoning, check what enters each stage. Where a statistical claim or approximation matters, identify the interpretation and conditions that license its use. Include the distinctions necessary for this goal; do not turn every node into a catalog of possible caveats or require an unrelated theory to explain one local step.

SIZE NODES BY THE WORK OF LEARNING

A node is one coherent, usable learning outcome. It may need several connected steps, new operations, or representations. New machinery alone is not a reason to split: it can be exactly what the lesson needs to develop its central ability. Conversely, several closely related facts can still impose too much learning load. Judge the whole route at the stated starting level, including explanation and practice, rather than counting topics or compressing reasoning until it fits.

Let the learner reach one understandable use before accumulating qualifications, alternate representations, and exceptional cases. Introduce notation and cautions where they first do useful work. First try a better progression or remove peripheral material when a candidate feels crowded. Split when it contains independently valuable outcomes, or when its essential route still cannot be understood and used in one sitting from the stated background. Each resulting node must have a usable outcome; avoid isolated notation lessons, detached proof fragments, or a long staircase whose learner cannot do anything until the end.

Merge candidates that repeat the same ability or separate a small supporting step from the use that gives it meaning. Keep distinct nodes when a later treatment adds a real capability at a different level. Do not enlarge a complete short lesson to fill space, and do not remove the reasoning that makes a method reusable merely to make the lesson shorter.

CHECK WHAT INDEPENDENT USE WOULD REQUIRE

Plan room for accessible first attempts and a fresh use of the established tools at the intended level. Depending on the goal, that can mean interpreting another case, choosing a method, explaining a distinction, diagnosing a mistake, or making a prediction. Changing values in an already completed template alone may not show the intended understanding. Do not manufacture difficulty by importing unfamiliar knowledge.

The learner may draw a new conclusion or combine established steps without first seeing that exact answer demonstrated. Distinguish that legitimate reasoning from requiring a new untaught rule, operation, or premise. If useful practice cannot be attempted within the proposed scope, repair its teaching route, inputs, or boundaries. Excluding later formalism or methods must still leave the learner a meaningful use of the idea. Plan this feasibility; the output is a tree, not drafted lessons or a bank of quiz questions.

REQUIRE WHAT THE FULL GOAL NEEDS

A prerequisite is an ability needed before this lesson begins. Read the actual prerequisite brief, not just its label: a lesson that introduced an idea informally has not necessarily established its formal machinery. Every essential input must be established starting background, available from the prerequisite path, explicitly supplied when appropriate, or developed in this node. If a missing input needs substantial teaching of its own, provide a real prerequisite rather than concealing it in an assumption.

For each proposed dependency, ask: without this prerequisite, could the learner still reach the node's full intended ability using the remaining background and the teaching planned here? Retain it when its absence would leave a necessary gap. The fact that some smaller part of the node would remain teachable is not a reason to remove it. Drop a dependency that is merely related, customary in a syllabus, or needed only by an unnecessarily advanced example.

Several prerequisites belong together when their abilities are all needed for the full goal. This may be a major synthesis or a lesson that uses a separate foundational tool; it need not be a grand capstone. Explain what each contributes. A node may reach back to an earlier or different branch when that knowledge is needed. Do not force an edge to the most recent node, serialize independent branches, or connect branches merely to make the graph look unified.

If one prerequisite is already guaranteed by a path through another, its edge need not be repeated: the app removes transitive edges. Preserve the actual knowledge requirement and enough context for the later writer even when an edge is indirect. Do not spend effort padding the graph with every implied link.

LET THE SUBJECT DETERMINE THE SHAPE

Independent foundations can be separate roots and join only when a later ability needs them together. A root has no earlier node in this tree, but may still assume background established for this tree; write that background in its brief. Branches can differ in length and treatment, stop at different places, or fan back out after a synthesis. Do not impose a single root, a single final node, equal branch lengths, or a repeated sequence of stages.

NAME THE ABILITY'S ACTUAL SUBJECT

Use a recognizable name for the concept, result, method, or interpretive task taught. Add a short qualifier when it distinguishes the level or treatment from another node. The label and brief must agree. Avoid a vague chapter heading that hides several independent goals, and avoid a narrow label whose brief secretly demands a whole chapter.`;

const TREE_FIELD_NOTES = `- id: a unique, stable, lowercase ASCII snake_case slug. Internal wiring only; it is not the title the learner sees.
- label: the human-readable subject of this lesson. Use the naming guidance above.
- explanation: always include a self-contained teaching brief in compact connected sentences. State the ability gained, the central material actually taught, and the important boundary with neighboring nodes. Distinguish assumed background, any explicitly supplied inputs, and the result or reasoning to be developed. Identify the essential bridge or unfamiliar operation when omitting it would invite a leap, plus a meaningful use the lesson must make possible. Include a motivating case, representation, condition, or misconception when it materially affects teachability; not every brief needs every item. Carry necessary starting background and source details into this field. Describe scope and teaching obligations, not a rigid section outline, a complete lesson, or a catalog of related facts. Make required positive content clear as well as exclusions.
- requires: the ids of direct prerequisite nodes. All listed nodes must be completed; these are AND requirements, never alternative routes. Omit the key for a root. Use only ids present in this file, with no self-references or cycles.
- optional: true marks enrichment outside the required path to the destination. It is a label, not an exemption from locking: any node requiring an optional node still needs it completed. If the core destination depends on a node, that node is required and must not be tagged optional. Omit this key for required nodes.
- done: do not set this; the new tree has no learner progress. Do not add lesson content or new schema fields.

Use the selected tree language for labels and teaching briefs. Keep JSON field names exactly as shown and ids in ASCII snake_case. The schema illustrates fields and a dependency, not a required node count or graph shape. Replace all illustrative names and briefs with actual content.`;

const TREE_NODES_SCHEMA = `[
    { "id": "foundation", "label": "Foundation name", "explanation": "What is assumed and what usable ability this lesson develops." },
    { "id": "goal", "label": "Goal name", "explanation": "How this lesson builds on the foundation to develop its own usable ability, within clear boundaries.", "requires": ["foundation"] }
  ]`;

const TREE_PLAN_AND_REVIEW = `BUILD AND REVIEW BEFORE SERIALIZING

Do the planning privately once the starting background is established. Establish the destination abilities, trace their needed knowledge back to the starting background, and sketch candidate learning routes before committing to ids or edges. Revise the boundaries and dependencies together: splitting, merging, or changing a worked case can change what must come first. Write the briefs once those choices are coherent.

Then walk the proposed tree in a valid learning order as a first-time learner, checking the actual briefs:

- Can each lesson begin with the knowledge available at that point, develop its promised result without a hidden leap, and support a meaningful independent use? Look for operations, conventions, conditions, and source details that were silently assumed.
- Does each prerequisite scope actually supply the ability the dependent needs? Are indirect knowledge requirements clear to the later writer? Have any root assumptions drifted beyond the established starting background? Check for circular teaching, even when the ids themselves form no cycle.
- Is each node manageable after allowing for its real explanation and practice? Have you preserved the central reasoning, staged the first use before peripheral complications, and avoided both overloaded chapters and fragments with no usable outcome?
- Do the terminal abilities together fulfill the intended destination? Is anything required missing, or merely familiar neighboring material included without a purpose? Can the core destination be reached without optional enrichment?
- Could a lesson writer with only the stated handoff context tell what is prior knowledge, what may be supplied, what must be developed, and what stays outside this node? Repair an ambiguous brief now rather than relying on the later writer to infer your plan.

Finally validate the file itself: strict JSON, unique nonempty ids, nonempty labels and explanations, existing prerequisite ids, no repeated or self dependencies, and an acyclic graph. Put prerequisites before dependents in the nodes list for readability. Omit requires on roots and progress fields everywhere. Escape quotes, line breaks, and backslashes correctly inside JSON strings, including any source notation. Check topic and language against the flow's instructions. Use a JSON serializer or parser to check the file when tools are available. Deliver the downloadable file only after these checks pass.`;

/* ── from a topic ── */
function renderTreePrompt({ topic, fileSlug, language, languageClause, collectionContext = '' }) {
  return `You are designing a prerequisite tree for the subject: ${topic}

Deliver this as a downloadable file named ${fileSlug}-tree.json — not as JSON pasted into the chat as text. Do all planning and double-checking in your thinking; ${collectionContext ? "your final message should contain nothing but the downloadable file itself, with no preamble or commentary. Begin designing immediately; do not ask calibration questions." : TREE_FINAL_MESSAGE_RULE}

${TREE_NODE_FRAMING}${languageClause}

${TREE_LESSON_HANDOFF}

${collectionContext || `CALIBRATE THE STARTING KNOWLEDGE AND DESTINATION

Before building the tree, locate the learner's starting knowledge through questions relevant to ${topic}. Do not infer fluency from a broad self-description. If the subject leaves the intended destination or depth materially ambiguous, clarify it during this calibration. Preserve the requested subject: do not silently substitute a small nearby topic or expand it into an unbounded survey of its whole field.

${TREE_CALIBRATION_METHOD}

The finished tree should cover the agreed subject at the intended level from that starting point. Its terminal abilities may include independent applications or directions; they need not funnel into one final capstone. Each required branch must contribute to that coverage, and any enrichment must stay outside the core path.`}

${TREE_DESIGN_PRINCIPLES}

OUTPUT SCHEMA

{
  "topic": ${JSON.stringify(topic)},
  "language": ${JSON.stringify(language)},
  "nodes": ${TREE_NODES_SCHEMA}
}

- topic: the exact subject given above, unchanged. Always include it; the app uses it to label the tree and name its file.
- language: the selected language given above, unchanged.
${TREE_FIELD_NOTES}

${TREE_PLAN_AND_REVIEW}

${collectionContext ? 'Use the collection-defined starting point and destination to design, check, and deliver the tree now. No questions or learner calibration are needed.' : "Begin with calibration and wait for the person's answers. Once the starting knowledge and destination are clear, design, check, and deliver the tree in this conversation."}`;
}

/* ── from a file ── */
function renderTreePromptFromFile() {
  return `You are designing a prerequisite tree based on the file(s) attached to this conversation — material the person wants to understand, such as a paper, excerpt, lecture notes, or a problem.

Read every attached file in full before designing the tree. If necessary material is missing or unreadable, ask for it rather than inventing its content. Identify the specific result, passage, argument, or problem the material is built around, rather than just its broad field. Treat related files as one body of material. If unrelated files leave the intended destination unclear, clarify which material the tree should cover.

Deliver this as a downloadable file named after a short lowercase snake_case slug derived from that topic, followed by -tree.json. Do not paste the JSON into chat as text. Do all reading, planning, and double-checking in your thinking; ${TREE_FINAL_MESSAGE_RULE}

${TREE_NODE_FRAMING}

${TREE_LESSON_HANDOFF}

THE DESTINATION IS UNDERSTANDING THE ACTUAL SOURCE

Work backward from what it takes to read the passage, follow the argument or derivation, interpret the result, or solve the actual problem. The required terminal node or nodes must reach those abilities using the source's actual content and conditions. Cover every part needed for the agreed destination. Do not replace the source with a generic survey, stop at its prerequisites, or end with an invented neighboring application. Several terminal nodes are fine when the source has several outcomes; each required branch must contribute to understanding it. Add unrelated enrichment only if requested.

The later writer will not automatically have these attachments. Put the essential source statements, givens, definitions, conventions, and assumptions into the relevant explanations, including an exact relation or excerpt when the intended task depends on it. A citation, page number, or instruction to "use the attached file" cannot substitute for content the writer needs but will not receive. Keep briefs economical without dropping the details that make the destination specific and teachable. Do not require the learner to prove a premise the source itself explicitly takes as an input unless that is part of the agreed goal; do preserve the reasoning needed to understand its consequences.

CALIBRATE THE PERSON, NOT THE SOURCE'S ASSUMED READER

Use unexplained notation, cited results, and techniques in the source to identify possible background requirements. These are hypotheses about what needs checking, not evidence that this person knows them. Before building, ask checkpoint questions across the plausible starting range and resolve the gaps that matter to reaching the source.

${TREE_CALIBRATION_METHOD}

Derive the tree's topic from the specific destination in the source. Use the source's language for labels and briefs; if the files use several languages, follow the core material unless the person requests another language. Resolve an ambiguity only when it affects the requested tree.

${TREE_DESIGN_PRINCIPLES}

OUTPUT SCHEMA

{
  "topic": "Specific source topic",
  "language": "Source language",
  "nodes": ${TREE_NODES_SCHEMA}
}

- topic: the specific subject identified from the source, written as a natural name for its actual destination. The schema value is illustrative, not text to copy.
- language: the source language selected above, or the person's explicitly requested output language. The schema value is illustrative, not text to copy.
${TREE_FIELD_NOTES}

${TREE_PLAN_AND_REVIEW}

Read the attached material, then begin calibration and wait for the person's answers. Once the starting knowledge and source destination are clear, design, check, and deliver the tree in this conversation.`;
}
