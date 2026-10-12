const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, ROOT } = require('./harness');

function boardApp(raw) {
  const app = loadApp();
  const objects = [];
  const board = {
    containerObj: null,
    create(type, parents, attrs) {
      const object = { type, parents, attrs };
      objects.push(object);
      return object;
    },
    suspendUpdate() {},
    unsuspendUpdate() { this.update(); },
    update() { objects.forEach(o => o.updateDataArray?.()); },
  };
  app.window.JXG = { JSXGraph: { initBoard: (id, options) => { board.options = options; return board; }, freeBoard() {} } };
  app.window.rawGraph = raw;
  app.ev('var testGraph = parseGraphBody(rawGraph)');
  app.document.body.insertAdjacentHTML('beforeend', app.ev('renderGraph(testGraph, "test")'));
  board.containerObj = app.document.getElementById('sv-graph-test');
  app.ev('mountBoard2d(testGraph, document.getElementById("sv-graph-test"), "test")');
  return { app, objects, board };
}

function area(region) {
  let twice = 0;
  for (let i = 1; i < region.dataX.length; i++) {
    if ([region.dataX[i - 1], region.dataY[i - 1], region.dataX[i], region.dataY[i]].every(Number.isFinite))
      twice += region.dataX[i - 1] * region.dataY[i] - region.dataX[i] * region.dataY[i - 1];
  }
  return Math.abs(twice) / 2;
}

test('filled regions have the expected area between curves below the axis and resize with sliders', () => {
  const { app, objects, board } = boardApp(`type: function2d
xrange: 0, 3
fill: -1, -3 | range: 0, b | label: Between curves | color: #388c46 | opacity: 0.3
slider: b | range: 0, 3 | init: 2 | step: 0.1`);
  const region = objects.find(o => o.type === 'curve' && o.attrs.fillColor);
  assert.ok(Math.abs(area(region) - 4) < 1e-8);
  assert.equal(region.attrs.fillOpacity, 0.3);
  assert.equal(region.attrs.layer, 1);
  assert.ok(board.options.boundingbox[1] > -1);
  assert.ok(board.options.boundingbox[3] < -3);
  assert.match(app.document.getElementById('sv-graph-legend-test').textContent, /Between curves/);
  const input = app.document.querySelector('#sv-graph-controls-test input');
  input.value = '3';
  input.dispatchEvent(new app.window.Event('input'));
  assert.ok(Math.abs(area(region) - 6) < 1e-8);
  input.value = '0';
  input.dispatchEvent(new app.window.Event('input'));
  assert.equal(region.dataX.length, 0);
});

test('fills split at undefined sampled boundaries and reject missing ranges', () => {
  const { objects } = boardApp(`type: function2d
xrange: -1, 1
fill: sqrt(x^2-0.25), 0 | range: -1, 1`);
  const region = objects.find(o => o.type === 'curve' && o.attrs.fillColor);
  assert.equal(region.dataX.filter(Number.isNaN).length, 2);
  assert.ok(region.dataX.filter(Number.isFinite).every(x => Math.abs(x) >= 0.5));
  assert.throws(() => boardApp('fill: x, 0'), /range/);
  assert.throws(() => boardApp('type: parametric2d\nfill: x, 0 | range: 0, 1'), /function2d/);
});

test('the updated Spanish tree renders every new fill in the five revised lessons', () => {
  const tree = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples/spanishcalc.json'), 'utf8'));
  const ids = [];
  for (const node of tree.nodes) {
    if (!node.content?.includes('fill:')) continue;
    ids.push(node.id);
    for (const match of node.content.matchAll(/\[GRAPH\]([\s\S]*?)\[\/GRAPH\]/g)) {
      if (!match[1].includes('fill:')) continue;
      const { objects } = boardApp(match[1]);
      const regions = objects.filter(o => o.type === 'curve' && o.attrs.fillColor);
      assert.ok(regions.length > 0);
      regions.forEach(region => assert.ok(area(region) > 0, node.id));
      if (node.id === 'sigma_notation') {
        const areas = regions.map(area);
        [2, 6, 4].forEach((expected, i) => assert.ok(Math.abs(areas[i] - expected) < 1e-8));
      }
    }
  }
  assert.deepEqual(ids, ['sigma_notation', 'riemann_sums', 'definite_integral', 'integral_properties', 'ftc_accumulation']);
});
