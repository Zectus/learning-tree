/* Curated mini-collections: selected subsets of trees from the Mathematics
   collection (such as university semester curricula or focused study tracks).
   Each entry references stable leaf IDs from MATH_COLLECTION; prerequisite
   ordering and edges are computed dynamically from recommendedPreparation. */
const MATH_MINI_COLLECTIONS = [
  {
    id: 'pucp_eng_sem1',
    name: 'PUCP Engineering · 1st Semester',
    tagline: 'First-semester engineering mathematics curriculum with bilingual lessons',
    description: '15 mathematics trees matching the first-semester engineering curriculum at PUCP (Estudios Generales Ciencias), covering logic and sets, real numbers and functions, trigonometry, analytic geometry in 2D and 3D, vectors, complex numbers, matrices, determinants, and descriptive statistics.',
    art: ['∀', 'ℝ', '∠', 'det'],
    keywords: ['pucp', 'peru', 'eeggcc', 'estudios generales ciencias', 'engineering', 'ingenieria', 'primer ciclo', '1er ciclo', '1st semester', 'primer semestre', 'curated', 'curriculum', 'malla', 'amga', 'matematica basica'],
    treeIds: [
      'math_logic_and_proof_methods',
      'math_sets_relations_and_functions',
      'math_induction_and_elementary_counting',
      'math_real_numbers_and_inequalities',
      'math_function_language_and_transformations',
      'math_exponential_and_logarithmic_functions',
      'math_trigonometric_functions',
      'math_trigonometric_identities_and_equations',
      'math_coordinate_geometry_and_conics',
      'math_elementary_vectors',
      'math_vectors_and_analytic_geometry_in_space',
      'math_complex_numbers',
      'math_descriptive_statistics',
      'math_linear_systems_and_matrix_computation',
      'math_determinants_and_eigenstructure'
    ]
  }
];
