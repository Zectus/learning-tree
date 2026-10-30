---
name: write-node-lesson
description: Write the assigned learning-tree node lesson.
---

You are producing a plain-text learning document (.txt) for the topic: Límite de una función: interpretación informal

Deliver this as a downloadable file named limit_intuition.txt — that keeps it unambiguous which node in the tree this document belongs to when there are many. Do all planning, drafting, and double-checking in your thinking; your visible output should contain nothing but the file itself — no preamble, no summary, no commentary before or after it.

Write for an average student encountering this node's material for the first time, with the background described in CONTEXT. The lesson should help them make sense of the idea and use it at the intended level. Mathematical correctness and readable markup are necessary, but so are motivation, accessible examples, and a manageable sequence. Plan the lesson before drafting; let its length follow the learning goal.



WORKFLOW
This lesson skill is split into reference files. Before drafting, read references/planning.md, references/format.md, and references/teaching.md in full. Read references/graphs.md before creating or checking any graph. Read references/questions.md before drafting any question. Read references/review.md for the final read-through. Apply every relevant rule; the separate files organize the work, not lower its requirements. Work on your own; no delegated critique or feedback pass is part of this workflow.

LANGUAGE
Write the entire document in español — every section title, all prose, every question, and every answer option. The structural markup a parser reads must stay exactly as specified above, in this literal form, regardless of language: "=== SECTION N: " and the closing "===" wrapping each section title (translate the title itself, not the wrapper), "[QUESTION N]" / "[/QUESTION]", "[ANSWER: X]", the option markers "(A)" through "(E)", "[TABLE]" / "[/TABLE]", "[TIMELINE]" / "[/TIMELINE]", "[GRAPH]" / "[/GRAPH]", and "[BONUS N]" / "[/BONUS]". Only the human-readable content moves to español — none of that markup does. This extends inside [GRAPH] blocks specifically: the field names themselves (type, title, xlabel, ylabel, zlabel, xrange, yrange, trange, trace, fill, range, opacity, point, segment, slider, label, color, z, u, v) are parser keywords and must stay in English exactly as written in the spec, and every math expression (a trace's formula, z, u, v) must stay in plain ASCII math syntax regardless of document language, since a separate library evaluates them as expressions, not as text. Only the actual values after title:, xlabel:, ylabel:, zlabel:, and label: move to español — everything else in a [GRAPH] block does not.


CONTEXT
This node belongs to a larger tree on bases_del_calculo_desde_definicion_informal_de_limites_hasta_derivadas_e_integrales_pasando_por_suma_de_riemann_breve.
This node's scope, from the tree's own design notes (not shown to the reader, but binding on what you write): Interpretar lim x→a f(x)=L como el comportamiento de los valores de f cuando x se acerca a a, sin exigir que x alcance a. Partir de una tabla y una gráfica con un hueco para distinguir límite, valor de la función y mera aproximación numérica. Se supone manipulación algebraica decente y conocimiento de las funciones habituales; recordar brevemente intervalos y lectura de gráficas si hace falta. No introducir la definición épsilon-delta ni presentar tablas como demostraciones. Use this brief to identify the intended learner ability, central idea, supporting content, and scope boundaries. If it is written as a topic list, organize those items into a learnable progression rather than equal-length treatments. Keep explicit exclusions, but still show a meaningful use of the idea at this level.
This is the first topic in the sequence — there is nothing earlier to refer back to.
Material the reader hasn't seen yet will build on this one afterward: Límites laterales y existencia del límite, Leyes de los límites y sustitución directa. Don't teach toward it or mention it by name here.


