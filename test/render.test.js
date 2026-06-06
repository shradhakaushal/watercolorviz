// Smoke coverage for EVERY chart type — constructs each with representative
// valid data and asserts it renders without throwing. This is the CI safety net
// for the chart classes (the visual audit harness lives outside the repo), so a
// refactor that breaks any chart fails CI instead of slipping through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import * as wcv from '../src/index.js';

globalThis.document = { createElement: () => createCanvas(10, 10) };

const cases = {
  Bar: { data: { labels: ['A', 'B', 'C'], values: [3, 7, 5] } },
  Histogram: { data: { values: [1, 2, 2, 3, 3, 3, 4, 5] }, bins: 5 },
  Heatmap: { data: { xLabels: ['a', 'b'], yLabels: ['x', 'y'], values: [[1, 2], [3, 4]] } },
  Area: { data: { x: [0, 1, 2, 3], y: [1, 2, 3, 4] } },
  Ridgeline: { data: { labels: ['a', 'b'], x: [0, 1, 2], series: [[1, 2, 1], [2, 1, 2]] } },
  StackedArea: { data: { x: [0, 1, 2], series: { A: [1, 2, 1], B: [2, 1, 2] } } },
  Scatter: { data: { x: [1, 2, 3], y: [4, 5, 6] } },
  Pie: { data: { labels: ['A', 'B'], values: [3, 5] } },
  Radar: { max: 5, data: { axes: ['a', 'b', 'c'], series: [[1, 2, 3]] } },
  Line: { data: { x: [1, 2, 3], y: [4, 5, 6] } },
  Network: { data: { nodes: [{ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.2 }], links: [[0, 1]] } },
  Sankey: { data: { nodes: ['A', 'B', 'C'], links: [{ source: 'A', target: 'B', value: 5 }, { source: 'B', target: 'C', value: 3 }] } },
  Interval: { data: { x: [0, 1, 2], y: [1, 2, 3], lo: [0, 1, 2], hi: [2, 3, 4] } },
  Sparkline: { data: { y: [1, 2, 3, 2, 4] } },
  Likert: { data: { questions: ['Q1'], levels: ['a', 'b', 'c'], values: [[10, 20, 30]] } },
  Forest: { data: { studies: [{ name: 'A', est: 1, lo: 0.5, hi: 1.5 }], summary: { est: 1, lo: 0.8, hi: 1.2 } } },
  Calendar: { data: { days: [{ date: '2026-01-01', value: 3 }, { date: '2026-01-02', value: 5 }] } },
  Chord: { data: { names: ['A', 'B', 'C'], matrix: [[0, 5, 6], [5, 0, 5], [6, 5, 0]] } },
};

// Every exported chart class must have a case here (guards against adding a
// chart and forgetting to cover it).
const exportedCharts = Object.keys(wcv).filter((k) => {
  const v = wcv[k];
  return typeof v === 'function' && /^[A-Z]/.test(k) && v.prototype instanceof wcv.Chart;
});

test('every exported chart class is covered by this test', () => {
  const missing = exportedCharts.filter((name) => !(name in cases));
  assert.deepEqual(missing, [], `add render cases for: ${missing.join(', ')}`);
});

for (const [name, config] of Object.entries(cases)) {
  test(`${name} renders without throwing`, () => {
    const Cls = wcv[name];
    assert.ok(Cls, `${name} is exported`);
    let chart;
    assert.doesNotThrow(() => {
      chart = new Cls(createCanvas(460, 300), { ...config, animation: false, seed: 3 });
    });
    // Produced a usable canvas and ran setInteractiveMarks (array always set).
    assert.ok(Array.isArray(chart._interactiveMarks));
    assert.ok(chart.toDataURL().startsWith('data:image/png'));
  });
}
