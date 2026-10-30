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
  function2d also supports filled regions, repeatable within a block:
fill: upper_expression, lower_expression | range: start, end | label: caption | color: optional | opacity: 0.22
  Both boundaries use x and calculator notation; write 0 for the horizontal axis, or constants for rectangle heights. The required range gives the horizontal endpoints. Boundaries and endpoints may use sliders and update as they move. label, color and opacity are optional; opacity is between 0 and 1. Fill is behind curves and marks. Draw the boundary traces separately when their outlines matter. Use fills for areas under or between curves, signed contributions, Riemann rectangles, and accumulation strips. Split at crossings or sign changes and use separate colors and labels when the distinction matters; shading itself is geometric and does not encode the sign of an integral. Sampling does not prove continuity or detect every discontinuity, so choose intervals where the boundaries are finite and continuous. Do not use fill with parametric2d, vectorfield2d or surface3d.

  Expressions are self-contained: there are no user-defined functions, so a quantity built from another curve is written out in full, in terms of x (or t) and the slider names. Conditional expressions use condition ? value_if_true : value_if_false; for example, x == 0 ? 1 : sin(x)/x specifies an explicitly defined continuous extension at zero. Use a conditional only for values established by the text or its model; do not assign an arbitrary value to a genuinely undefined point.

  For scalar profiles or relationships whose axes measure different quantities, use function2d with independently fitted axes unless equal axis-unit lengths serve the interpretation. Use parametric2d when the object is a path or planar configuration whose geometric shape matters; its equal axis-unit lengths can flatten a scalar profile across a wide horizontal range.

  A graph is part of the exposition, so it follows the same rules as the prose around it. It may show the instances the text works through and the general shape of the objects involved; it must not plot the specific object a nearby question asks about, mark that question's answer, or otherwise do the reader's work for it. It should earn its place: take the graph away and the surrounding prose should lose something. Mark the points the prose actually computes with, draw the segments the prose names, and use a slider when the prose compares many members of one family. One graph per idea is plenty; don't plot the same object twice, and keep a plot to a handful of curves so it stays readable. The block sits on its own lines between paragraphs, like a table.

  Every field on its own "key: value" line. title/xlabel/ylabel/zlabel are always optional but should usually be filled in. The range requirements depend on the type: function2d needs xrange (yrange is optional — left out, the vertical window is fitted to the curves, so give it only when a specific window matters), parametric2d needs trange (xrange and yrange are optional there too), and surface3d and vectorfield2d need both xrange and yrange. Pick bounds that actually show what the graph is for, the way a chosen numeric example elsewhere in this document is chosen to land on its point, not a generic default. function2d and parametric2d can repeat the trace line for more than one curve on the same axes; surface3d and vectorfield2d take exactly one z (or one u and one v) — nothing to repeat there. label and color on a trace line are both optional. A parametric2d trace line packs both components into one line, comma-separated: trace: cos(t), sin(t) | label: .... The fields of a line are separated by " | " with a space on each side, exactly as in a table row.

  Every expression (trace, z, u, v, and the coordinates of a point or segment) is evaluated as a plain math expression by a separate library, not typeset by KaTeX — write x^2, sin(x), sqrt(x^2 + y^2), atan2(y, x), abs(x) in ordinary calculator-style notation (abs(x), not |x| — bars aren't valid syntax here), never inside \( \) and never with LaTeX commands like \sin or \frac{}{}. Captions are the opposite, with one wrinkle. The title and the label on a trace go through the normal KaTeX pass like anything else in this document, so \( \) works there exactly as it would in a sentence. The xlabel, the ylabel, and the label on a point or a segment are drawn inside the plot itself, where a label must be either one single \( ... \) span (the whole label is math) or plain text with no math in it; never mix prose and a math span in one of those, and keep them short. The zlabel is plain text. Keep the two apart — an expression written in LaTeX syntax won't evaluate, and a label written in plain-expression syntax just won't typeset.

