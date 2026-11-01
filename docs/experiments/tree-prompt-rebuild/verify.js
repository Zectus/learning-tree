// Reproduce structural regressions and arithmetic checks for the review specimens.
// Optional argument: an earlier tree-prompt.js saved with `git show REF:PATH`.
// This does not call a model or measure learner outcomes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '../../..');
const specimens = require(path.join(root, 'test/fixtures/tree-design-cases.json'));
const source = fs.readFileSync(path.join(root, 'js/learn/tree-prompt.js'), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const args = { topic: 'Optics', fileSlug: 'optics', language: 'English', languageClause: '' };
function render(code, values = args, file = false) {
  return vm.runInNewContext(code + '\n' + (file
    ? 'renderTreePromptFromFile()'
    : `renderTreePrompt(${JSON.stringify(values)})`));
}
function schema(prompt) {
  const match = prompt.match(/OUTPUT SCHEMA\n\n(\{[\s\S]*?\n\})/);
  assert.ok(match, 'missing schema');
  return JSON.parse(match[1]);
}
function references(tree) {
  const seen = new Set();
  for (const node of tree.nodes) {
    assert.ok(node.id && !seen.has(node.id), `invalid or duplicate id: ${node.id}`);
    for (const parent of node.requires || []) {
      assert.ok(seen.has(parent), `missing or out-of-order prerequisite: ${parent}`);
    }
    seen.add(node.id);
  }
}
function regressions(code) {
  const checks = {
    topic_schema_dependencies: () => references(schema(render(code))),
    file_schema_dependencies: () => references(schema(render(code, args, true))),
    quoted_topic_round_trip: () => {
      const values = { ...args, topic: 'The "nearby" value: \\( x \\)\nC:\\notes\\lesson' };
      assert.equal(schema(render(code, values)).topic, values.topic);
    },
    quoted_language_round_trip: () => {
      const values = { ...args, language: 'Français (langue "française")' };
      assert.equal(schema(render(code, values)).language, values.language);
    },
  };
  return Object.fromEntries(Object.entries(checks).map(([name, check]) => {
    try { check(); return [name, { passed: true }]; }
    catch (error) { return [name, { passed: false, reason: error.message.split('\n')[0] }]; }
  }));
}
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);
const outer = a => a.map(x => a.map(y => x * y));
const scale = (a, factor) => a.map(row => row.map(x => x * factor));
const trace = a => a.reduce((sum, row, i) => sum + row[i], 0);
const multiply = (a, b) => a.map(row => b[0].map((_, j) => row.reduce((sum, x, k) => sum + x * b[k][j], 0)));
const sandwich = (p, rho) => multiply(multiply(p, rho), p);
const add = (a, b) => a.map((row, i) => row.map((x, j) => x + b[i][j]));
const diagonal = values => values.map((x, i) => values.map((_, j) => i === j ? x : 0));

// Independent matrix calculation for the source's actual operations and selection.
const rho = outer([1, 1, 1].map(x => x / Math.sqrt(3)));
const p01 = diagonal([1, 1, 0]);
const fineProjectors = [diagonal([1, 0, 0]), diagonal([0, 1, 0]), diagonal([0, 0, 1])];
const fineUnread = fineProjectors.map(p => sandwich(p, rho)).reduce(add);
const fineSelected = sandwich(p01, fineUnread);
const coarseSelected = sandwich(p01, rho);
const fineReport = trace(fineSelected), coarseReport = trace(coarseSelected);
close(fineReport, 2 / 3); close(coarseReport, 2 / 3);
const qPlus = outer([1 / Math.sqrt(2), 1 / Math.sqrt(2), 0]);
const fineNext = trace(multiply(qPlus, scale(fineSelected, 1 / fineReport)));
const coarseNext = trace(multiply(qPlus, scale(coarseSelected, 1 / coarseReport)));
close(fineNext, 1 / 2); close(coarseNext, 1);

// Recompute the changing-denominator comparison in the source memo.
const beforeRate = 80 / 1000, afterRate = 60 / 600;
close(beforeRate, 0.08); close(afterRate, 0.10);
assert.ok(60 < 80 && afterRate > beforeRate);

// Check the error definition against the exact and approximated model values.
const v0 = 4, acceleration = 0.2, tolerance = 0.05;
const maxTime = 2 * v0 * tolerance / acceleration;
close(maxTime, 2);
function relativeError(time) {
  const estimate = v0 * time;
  return Math.abs((v0 * time + acceleration * time ** 2 / 2) - estimate) / Math.abs(estimate);
}
for (const time of [0.01, 0.5, 1, 2]) {
  close(relativeError(time), acceleration * time / (2 * v0));
  assert.ok(relativeError(time) <= tolerance + 1e-12);
}
assert.ok(relativeError(2.1) > tolerance);
assert.ok(Number.isNaN(relativeError(0)));

// Check the indirect earlier relation in a transaction with a partial return.
const quantities = [3, 2], prices = [10, 15], returns = [1, 0], discount = 0.2;
const total = quantities.reduce((sum, q, i) => sum + q * prices[i], 0);
const refund = returns.reduce((sum, r, i) => sum + r * prices[i] * (1 - discount), 0);
const net = quantities.reduce((sum, q, i) => sum + (q - returns[i]) * prices[i] * (1 - discount), 0);
close(net, total * (1 - discount) - refund); close(net, 40);

// Check the local distance relation used in the informal limits brief.
for (const x of [-1, 1.9, 2.03, 4]) close(Math.abs((2 * x + 1) - 5), 2 * Math.abs(x - 2));

const current = regressions(source);
assert.ok(Object.values(current).every(check => check.passed));
for (const specimen of specimens) references(specimen.tree);
const result = {
  method: 'First-party design review specimens; deterministic structure and arithmetic checks, not independent model generations.',
  source_sha256: hash(source),
  fixture_sha256: hash(fs.readFileSync(path.join(root, 'test/fixtures/tree-design-cases.json'))),
  rendered_characters: { topic: render(source).length, file: render(source, args, true).length },
  structural_regressions: { current },
  specimen_count: specimens.length,
  specimen_node_count: specimens.reduce((sum, specimen) => sum + specimen.tree.nodes.length, 0),
  arithmetic: {
    quantum_retained_report: [fineReport, coarseReport],
    quantum_subsequent_prediction: [fineNext, coarseNext],
    memo_defect_rates: [beforeRate, afterRate],
    approximation_max_seconds: maxTime,
    approximation_after_interval_fails: relativeError(2.1) > tolerance,
    transaction_net: net,
    local_distance_relation_checked: true,
  },
};
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  result.baseline_sha256 = hash(baseline);
  result.structural_regressions.baseline = regressions(baseline);
  result.baseline_rendered_characters = { topic: render(baseline).length, file: render(baseline, args, true).length };
}
console.log(JSON.stringify(result, null, 2));
