/* The mathematics collection contains bounded tree scopes, not lesson nodes.
   Grouping branches encompass all descendant scopes. IDs remain stable when
   names are displayed elsewhere; personal tree structures live in library.js. */
const MATH_COLLECTION = (() => {
  const id = name => 'math_' + name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/_$/, '');
  const branch = (name, children) => ({ id: id(name), name, children });
  const leaf = (name, stage, scope) => ({ id: id(name), name, stage, scope });
  const elementary = (name, scope) => leaf(name, 'elementary', scope);
  const secondary = (name, scope) => leaf(name, 'secondary', scope);
  const university = (name, scope) => leaf(name, 'university', scope);
  const advanced = (name, scope) => leaf(name, 'advanced', scope);
  const graduate = (name, scope) => leaf(name, 'graduate', scope);
  return branch('Mathematics', [
    branch('Numbers and Arithmetic', [
      branch('Whole Numbers', [
        elementary('Counting and Quantity', 'Counting, matching quantities, cardinality, comparing amounts, and ordering whole numbers.'),
        elementary('Place Value', 'Base-ten representation, composing and decomposing numbers, expanded notation, and rounding.'),
        branch('Addition and Subtraction', [
          elementary('Addition and Subtraction Foundations', 'Meanings of addition and subtraction, their relationship, basic facts, and simple situations.'),
          elementary('Addition and Subtraction Methods', 'Mental strategies, multidigit calculation, regrouping, estimation, and checking results.')
        ]),
        branch('Multiplication and Division', [
          elementary('Multiplication and Division Foundations', 'Equal groups, arrays, sharing, grouping, basic facts, and inverse relationships.'),
          elementary('Multiplication and Division Methods', 'Multidigit calculation, remainders, estimation, and multistep arithmetic problems.')
        ]),
        elementary('Factors, Multiples, and Divisibility', 'Factor structure, primes, divisibility, greatest common factors, and least common multiples.')
      ]),
      branch('Fractions, Decimals, and Percents', [
        elementary('Fraction Foundations', 'Fractions as quantities and numbers, equivalence, comparison, ordering, and mixed numbers.'),
        elementary('Fraction Arithmetic', 'The four operations with fractions and mixed numbers, including interpreting their results.'),
        elementary('Decimal Numbers and Arithmetic', 'Decimal place value, comparison, rounding, operations, and connections to fractions.'),
        elementary('Percent Foundations', 'Percent as a representation, fraction–decimal–percent conversion, and basic percentage calculations.')
      ]),
      branch('Proportional Reasoning', [
        secondary('Ratios and Rates', 'Ratio representations, equivalent ratios, unit rates, and comparisons between quantities.'),
        secondary('Proportional Relationships', 'Proportions, scaling, proportional graphs, direct variation, and percentage change.')
      ]),
      secondary('Signed Numbers and Powers', 'Integer and rational-number arithmetic, absolute value, integer exponents, and order of operations.')
    ]),
    branch('Algebra and Functions', [
      branch('Elementary Algebra', [
        secondary('Expressions and Formulas', 'Translating relationships into algebra, simplifying expressions, substitution, and rearranging formulas.'),
        branch('Linear Relationships', [
          secondary('Linear Equations and Inequalities', 'Solving and interpreting one-variable linear equations, inequalities, and compound inequalities.'),
          secondary('Linear Functions and Systems', 'Slope, intercepts, linear models, and systems of linear equations and inequalities.')
        ]),
        branch('Polynomial and Quadratic Algebra', [
          secondary('Polynomials and Factoring', 'Polynomial operations, algebraic identities, factorization, and relationships between factors and roots.'),
          secondary('Quadratic Equations and Functions', 'Quadratic solution methods, parabolas, discriminants, and quadratic modeling.')
        ]),
        secondary('Rational Expressions and Equations', 'Algebraic fractions, restrictions, simplification, rational equations, and rational-function behavior.'),
        secondary('Radicals and Rational Exponents', 'Roots, fractional powers, radical expressions, radical equations, and associated domain restrictions.'),
        secondary('Complex Numbers', 'Complex arithmetic, geometric representation, polar form, powers, and roots.')
      ]),
      branch('Functions and Precalculus', [
        secondary('Function Language and Transformations', 'Domain, range, representations, composition, inverses, and transformations of established function families.'),
        secondary('Exponential and Logarithmic Functions', 'Exponential growth and decay, logarithms, equations, and corresponding models.'),
        secondary('Sequences and Discrete Growth', 'Arithmetic and geometric sequences, finite sums, recursive descriptions, and compound growth.')
      ]),
      branch('Linear Algebra', [
        secondary('Elementary Vectors', 'Vector representation, components, arithmetic, magnitude, direction, and elementary geometric applications.'),
        university('Linear Systems and Matrix Computation', 'Elimination, matrix operations, inverses, rank, and the structure of solution sets.'),
        university('Vector Spaces and Linear Maps', 'Subspaces, independence, bases, dimension, linear transformations, and changes of coordinates.'),
        university('Determinants and Eigenstructure', 'Determinants, eigenvalues, eigenvectors, diagonalization, and elementary canonical forms.'),
        university('Inner Products and Orthogonality', 'Orthogonal projection, least squares, orthonormal bases, symmetric operators, and spectral decomposition.')
      ]),
      branch('Abstract Algebra', [
        branch('Group Theory', [
          advanced('Groups and Quotient Structures', 'Groups, subgroups, homomorphisms, normal subgroups, quotients, and isomorphism theorems.'),
          advanced('Group Actions and Finite Groups', 'Actions, orbit–stabilizer methods, conjugacy, Sylow theory, and finite-group structure.'),
          graduate('Finite-Group Representation Theory', 'Linear representations, irreducibility, characters, decomposition, and structural applications.')
        ]),
        branch('Rings and Modules', [
          advanced('Rings, Ideals, and Polynomial Algebra', 'Ring structure, ideals, quotient rings, polynomial rings, factorization, and integral domains.'),
          graduate('Modules and Tensor Products', 'Module structure, exact sequences, tensor products, and their principal algebraic uses.'),
          graduate('Commutative Algebra Foundations', 'Localization, prime and maximal ideals, Noetherian structures, integral extensions, and dimension basics.')
        ]),
        advanced('Field Extensions and Galois Theory', 'Algebraic extensions, splitting fields, finite fields, automorphisms, and the Galois correspondence.')
      ])
    ]),
    branch('Geometry and Topology', [
      branch('Measurement and Elementary Geometry', [
        elementary('Measurement and Units', 'Measuring quantities, selecting units, converting units, estimating, and interpreting precision.'),
        elementary('Time and Money', 'Clocks, calendars, elapsed time, currency calculations, change, and simple budgets.'),
        elementary('Shapes and Spatial Relationships', 'Plane and solid shapes, their properties, symmetry, position, and spatial visualization.'),
        elementary('Perimeter, Area, and Volume', 'Measuring boundaries and regions, standard formulas, composite figures, and geometric units.')
      ]),
      branch('Euclidean Geometry', [
        secondary('Geometric Proof and Congruence', 'Deductive geometric arguments, triangle congruence, and consequences for lines and polygons.'),
        secondary('Similarity and Right-Triangle Geometry', 'Similar figures, scale relationships, the Pythagorean theorem, and right-triangle applications.'),
        secondary('Circle Geometry', 'Chords, tangents, arcs, angles, and metric relationships within circles.')
      ]),
      branch('Trigonometry and Coordinate Geometry', [
        secondary('Trigonometric Functions', 'Angle measurement, the unit circle, trigonometric graphs, and solving triangles.'),
        secondary('Trigonometric Identities and Equations', 'Trigonometric identities, transformations, inverse functions, and equation solving.'),
        secondary('Coordinate Geometry and Conics', 'Coordinate methods, distance and midpoint relationships, circles, parabolas, ellipses, and hyperbolas.')
      ]),
      branch('Differential Geometry', [
        advanced('Curves and Surfaces', 'Parametrized curves, surfaces, curvature, fundamental forms, and classical local geometry.'),
        advanced('Smooth Manifolds and Tangent Spaces', 'Charts, smooth maps, tangent spaces, vector fields, and basic manifold constructions.'),
        advanced('Differential Forms and Manifold Integration', 'Differential forms, pullbacks, exterior differentiation, orientation, and generalized Stokes’ theorem.'),
        advanced('Introductory Riemannian Geometry', 'Riemannian metrics, connections, geodesics, curvature, and elementary geometric consequences.')
      ]),
      branch('Topology', [
        branch('General Topology', [
          advanced('Topological Spaces and Constructions', 'Topologies, bases, continuity, subspaces, products, and quotient spaces.'),
          advanced('Compactness and Connectedness', 'Compactness, connectedness, separation properties, and their consequences for continuous maps.')
        ]),
        branch('Algebraic Topology', [
          graduate('Fundamental Groups and Covering Spaces', 'Homotopy of paths, fundamental groups, covering spaces, lifting, and standard computations.'),
          graduate('Homology', 'Chain complexes, simplicial and singular homology, exact sequences, and computational tools.'),
          graduate('Cohomology and Duality', 'Cohomology groups, products, universal coefficient results, and introductory manifold duality.')
        ])
      ]),
      branch('Algebraic Geometry', [
        graduate('Affine Algebraic Geometry', 'Affine varieties, polynomial ideals, coordinate rings, morphisms, and algebra–geometry correspondence.'),
        graduate('Projective Algebraic Geometry', 'Projective space, homogeneous ideals, projective varieties, morphisms, and basic intersection behavior.'),
        graduate('Local Algebraic Geometry', 'Local rings, tangent spaces, singularities, local geometric behavior, and the first scheme constructions.')
      ])
    ]),
    branch('Calculus and Analysis', [
      branch('Calculus', [
        branch('Differential Calculus', [
          university('Limits and Continuity', 'Limits of functions, one-sided and infinite limits, asymptotes, and continuity.'),
          university('Differentiation', 'Derivatives, differentiation rules, implicit differentiation, and derivatives of standard function families.'),
          university('Applications of Derivatives', 'Approximation, related rates, optimization, curve analysis, and the mean value theorem.')
        ]),
        branch('Integral Calculus', [
          university('Definite Integrals and Antiderivatives', 'Accumulation, Riemann sums, antiderivatives, and the fundamental theorem of calculus.'),
          university('Integration Techniques', 'Substitution, integration by parts, partial fractions, trigonometric methods, and improper integrals.'),
          university('Applications of Integration', 'Area, volume, arc length, work, average values, and continuous accumulation models.')
        ]),
        branch('Sequences and Series', [
          university('Sequences and Infinite Series', 'Sequence limits, numerical series, convergence tests, and absolute and conditional convergence.'),
          university('Power Series and Taylor Approximation', 'Power-series representations, convergence intervals, Taylor expansions, and approximation error.')
        ]),
        branch('Multivariable Calculus', [
          university('Multivariable Differentiation', 'Functions of several variables, partial derivatives, gradients, local approximation, and constrained extrema.'),
          university('Multiple Integration', 'Double and triple integrals, coordinate changes, Jacobians, and geometric applications.')
        ]),
        branch('Vector Calculus', [
          university('Vector Fields and Line Integrals', 'Vector fields, path integrals, conservative fields, potentials, and Green’s theorem.'),
          university('Surface Integrals and Integral Theorems', 'Surface integration, flux, divergence, curl, and the theorems of Gauss and Stokes.')
        ])
      ]),
      branch('Real Analysis', [
        advanced('Real Numbers and Sequence Convergence', 'Completeness, rigorous sequence and series arguments, subsequences, and convergence criteria.'),
        advanced('Rigorous Continuity and Differentiation', 'Proof-based treatment of continuity, compact-interval results, differentiation, and mean value results.'),
        advanced('Integration and Function Convergence', 'Riemann integration, sequences and series of functions, uniform convergence, and interchange of limiting operations.'),
        advanced('Metric Spaces', 'Metric structure, open and closed sets, convergence, completeness, compactness, and continuity.')
      ]),
      branch('Complex Analysis', [
        advanced('Complex Differentiation', 'Holomorphic functions, Cauchy–Riemann equations, complex power series, and local analytic structure.'),
        advanced('Complex Integration and Residues', 'Contour integration, Cauchy’s theorems, Laurent series, singularities, and residue methods.'),
        advanced('Conformal Maps and Analytic Continuation', 'Conformal mappings, Möbius transformations, continuation, and global behavior of analytic functions.')
      ]),
      branch('Measure and Integration', [
        graduate('Measures and Measurable Functions', 'Sigma-algebras, measures, measurable mappings, measure construction, and almost-everywhere reasoning.'),
        graduate('Lebesgue Integration', 'The Lebesgue integral, convergence theorems, product measures, and iterated integration.'),
        graduate('Signed Measures and Lᵖ Spaces', 'Signed measures, absolute continuity, Radon–Nikodym theory, and foundational Lᵖ relationships.')
      ]),
      branch('Functional Analysis', [
        graduate('Banach Spaces and Bounded Operators', 'Normed spaces, completeness, bounded linear maps, operator norms, and dual spaces.'),
        graduate('Hilbert Space Methods', 'Orthogonality, projections, orthonormal systems, representation of functionals, and Hilbert-space operators.'),
        graduate('Fundamental Functional Analysis Theorems', 'Hahn–Banach, uniform boundedness, open mapping, closed graph, and their main applications.'),
        graduate('Compact Operators and Spectral Theory', 'Compactness of operators, spectra, compact self-adjoint operators, and introductory spectral methods.')
      ]),
      branch('Fourier Analysis', [
        graduate('Fourier Series and Convergence', 'Fourier coefficients, orthogonal expansions, convergence behavior, summability, and function approximation.'),
        graduate('Fourier Transforms and Convolution', 'Transform methods, convolution, inversion, Plancherel theory, and introductory harmonic-analysis estimates.')
      ])
    ]),
    branch('Discrete Mathematics', [
      branch('Counting and Combinatorics', [
        university('Induction and Elementary Counting', 'Mathematical induction, counting principles, permutations, combinations, and inclusion–exclusion.'),
        advanced('Enumerative Combinatorics', 'Structured counting, generating functions, combinatorial identities, partitions, and combinatorial recurrences.'),
        advanced('Extremal and Probabilistic Combinatorics', 'Extremal bounds, existence arguments, random constructions, and introductory probabilistic methods.')
      ]),
      branch('Graph Theory', [
        university('Graphs and Discrete Networks', 'Graph representations, paths, cycles, trees, connectivity, and basic graph algorithms.'),
        advanced('Graph Structure, Coloring, and Matching', 'Structural graph results, coloring, matchings, flows, and selected graph classes.')
      ]),
      university('Recurrence Relations', 'Recursive sequences, recurrence models, solution methods, and elementary analysis of discrete growth.')
    ]),
    branch('Number Theory', [
      branch('Elementary Number Theory', [
        advanced('Divisibility and Modular Arithmetic', 'Integer arithmetic, congruences, modular equations, prime structure, and classical arithmetic theorems.'),
        advanced('Diophantine Equations and Reciprocity', 'Integer solutions, quadratic residues, reciprocity, arithmetic functions, and elementary number-theoretic methods.')
      ]),
      branch('Algebraic Number Theory', [
        graduate('Algebraic Number Fields', 'Number fields, algebraic integers, integral bases, ideals, and unique factorization of ideals.'),
        graduate('Valuations and Local Fields', 'Valuations, completions, p-adic numbers, local fields, and introductory ramification.')
      ]),
      graduate('Analytic Methods in Number Theory', 'Dirichlet series, zeta and L-functions, analytic continuation, and applications to prime distribution.')
    ]),
    branch('Differential Equations and Dynamics', [
      branch('Ordinary Differential Equations', [
        university('First-Order Differential Equations', 'Separable and linear equations, initial-value problems, direction fields, and elementary models.'),
        university('Second-Order Linear Differential Equations', 'Homogeneous and forced equations, characteristic methods, oscillation, and resonance.')
      ]),
      branch('Dynamical Systems', [
        university('Systems of Differential Equations', 'Matrix methods, linear systems, equilibria, phase portraits, and stability.'),
        university('Nonlinear Dynamics', 'Nonlinear systems, local behavior, bifurcations, periodic behavior, and introductory chaos.')
      ]),
      branch('Partial Differential Equations', [
        graduate('First-Order Partial Differential Equations', 'Characteristics, transport equations, conservation laws, and introductory shock formation.'),
        graduate('Classical Linear Partial Differential Equations', 'Heat, wave, and Laplace equations on standard domains using separation, transforms, and Green’s functions.'),
        graduate('Weak Solutions and Variational PDE Methods', 'Distributions, introductory Sobolev spaces, weak formulations, and basic existence and energy arguments.')
      ])
    ]),
    branch('Probability and Statistics', [
      elementary('Elementary Data', 'Collecting and organizing data, reading charts, averages, spread, and simple comparisons.'),
      branch('Probability', [
        branch('Probability Foundations', [
          university('Events and Conditional Probability', 'Probability rules, conditional probability, independence, Bayes’ theorem, and event-based models.'),
          university('Discrete Random Variables', 'Discrete distributions, expectation, variance, and joint discrete models.'),
          university('Continuous Random Variables', 'Densities, continuous distributions, joint distributions, transformations, and dependence.'),
          university('Expectation and Probability Limits', 'Conditional expectation in elementary settings, inequalities, laws of large numbers, and the central limit theorem.')
        ]),
        graduate('Measure-Theoretic Probability', 'Probability spaces, random-variable convergence, conditional expectation, and rigorous probability limit arguments.'),
        branch('Stochastic Processes', [
          graduate('Markov Chains and Jump Processes', 'Transition structure, recurrence, stationary distributions, continuous-time chains, and long-term behavior.'),
          graduate('Martingales and Stopping Times', 'Filtrations, martingales, stopping, convergence results, and standard discrete-time applications.'),
          graduate('Brownian Motion and Stochastic Integration', 'Brownian motion, Itô integration, Itô’s formula, and elementary stochastic differential equations.')
        ])
      ]),
      branch('Statistics', [
        branch('Statistical Inference Foundations', [
          university('Sampling and Estimation', 'Sampling distributions, point estimation, estimator properties, and confidence intervals.'),
          university('Hypothesis Testing', 'Tests, errors, power, significance, and comparisons of populations and treatments.'),
          university('Regression and Experimental Design', 'Linear regression, model interpretation, diagnostics, randomization, blocking, and introductory analysis of variance.'),
          university('Introductory Bayesian Inference', 'Priors, likelihoods, posterior distributions, conjugate models, and posterior prediction.')
        ]),
        branch('Statistical Theory', [
          graduate('Likelihood and Asymptotic Inference', 'Likelihood theory, estimator consistency, asymptotic normality, information, and large-sample testing.'),
          graduate('Statistical Decision Theory', 'Loss, risk, sufficiency, optimal estimation and testing, minimax reasoning, and admissibility.')
        ]),
        branch('Advanced Statistical Models and Methods', [
          graduate('Bayesian Models and Computation', 'Hierarchical models, posterior analysis, Bayesian prediction, and introductory computational inference.'),
          graduate('Generalized Linear Models', 'Exponential-family models, link functions, fitting, inference, diagnostics, and common response types.'),
          graduate('Nonparametric Statistical Methods', 'Distribution-free inference, resampling, density estimation, and introductory nonparametric regression.')
        ])
      ])
    ]),
    branch('Applied and Computational Mathematics', [
      branch('Numerical Analysis', [
        university('Numerical Error and Root Finding', 'Floating-point arithmetic, conditioning, error propagation, and iterative equation solving.'),
        university('Interpolation and Numerical Integration', 'Polynomial approximation, interpolation error, quadrature, and numerical differentiation.'),
        university('Numerical Linear Algebra', 'Matrix factorizations, computational linear systems, least squares, and numerical eigenvalue methods.'),
        university('Numerical Differential Equations', 'Time-stepping methods, consistency, stability, convergence, and error control for ordinary differential equations.')
      ]),
      branch('Optimization', [
        advanced('Convex Sets and Functions', 'Convexity, separation, convex functions, subgradients, and foundational convex optimization results.'),
        advanced('Linear Programming and Duality', 'Linear optimization models, feasible geometry, solution methods, duality, and sensitivity.'),
        advanced('Nonlinear Constrained Optimization', 'Optimality conditions, Lagrange multipliers, KKT conditions, and standard iterative methods.')
      ]),
      branch('Mathematical Modeling', [
        advanced('Model Formulation and Scaling', 'Translating systems into mathematics, dimensional analysis, nondimensionalization, and model interpretation.'),
        advanced('Perturbation and Asymptotic Approximation', 'Asymptotic expansions, regular and singular perturbations, boundary layers, and multiple scales.')
      ])
    ]),
    branch('Logic and Foundations', [
      branch('Mathematical Language and Reasoning', [
        university('Logic and Proof Methods', 'Statements, quantifiers, direct proof, contradiction, contraposition, and counterexamples.'),
        university('Sets, Relations, and Functions', 'Set operations, equivalence relations, orders, mappings, injectivity, surjectivity, and cardinality basics.')
      ]),
      branch('Formal Logic', [
        graduate('Formal Theories and Completeness', 'First-order syntax, semantics, proof systems, soundness, and completeness.'),
        graduate('Introductory Model Theory', 'Structures, elementary equivalence, compactness, Löwenheim–Skolem results, and basic model constructions.')
      ]),
      branch('Computability and Formal Limits', [
        graduate('Computability', 'Models of computation, computable functions, undecidable problems, and reductions.'),
        graduate('Incompleteness and Arithmetic', 'Formal arithmetic, representability, incompleteness theorems, and limits of formal proof.')
      ]),
      branch('Set Theory', [
        graduate('Axiomatic Set Theory', 'Set-theoretic axioms, foundational constructions, choice principles, and their principal consequences.'),
        graduate('Ordinals and Cardinals', 'Well-orders, transfinite induction and recursion, ordinal arithmetic, and cardinal arithmetic.')
      ])
    ])
  ]);
})();
