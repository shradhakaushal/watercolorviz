import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import { Bar } from '../src/index.js';

// A canvas with event tracking, passed directly as the target.
function trackedCanvas() {
  const c = createCanvas(400, 300);
  const handlers = {};
  c.addEventListener = (type, fn) => { handlers[type] = fn; };
  c.removeEventListener = (type) => { delete handlers[type]; };
  c.setAttribute = () => {};
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  c.style = {};
  c._handlers = handlers;
  return c;
}
globalThis.document = { createElement: () => trackedCanvas() };

test('update() re-renders in place with new data', () => {
  const chart = new Bar(trackedCanvas(), { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false });
  assert.equal(chart._interactiveMarks.length, 2);
  const returned = chart.update({ data: { labels: ['A', 'B', 'C', 'D'], values: [5, 6, 7, 8] } });
  assert.equal(chart._interactiveMarks.length, 4);
  assert.equal(returned, chart, 'update() returns this for chaining');
});

test('update() recomputes layout when the legend appears', () => {
  const chart = new Bar(trackedCanvas(), { data: { labels: ['A'], values: [1] }, animation: false });
  const before = chart.margin.bottom;
  chart.update({ data: { labels: ['A'], series: { X: [1], Y: [2] } } });
  assert.ok(chart.margin.bottom > before, 'reserves legend space after becoming multi-series');
});

test('onClick fires with the mark payload', () => {
  let payload = null;
  const c = trackedCanvas();
  const chart = new Bar(c, { data: { labels: ['A', 'B', 'C'], values: [10, 20, 15] }, animation: false, onClick: (p) => { payload = p; } });
  const m = chart._interactiveMarks[1];
  c._handlers.click({ clientX: m.x + m.w / 2, clientY: m.y + m.h / 2 });
  assert.equal(payload.index, 1);
  assert.equal(payload.label, 'B: 20');
  assert.ok(payload.color);
});

test('onHover fires on enter and clears (null) on leave', () => {
  const seen = [];
  const c = trackedCanvas();
  const chart = new Bar(c, { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false, onHover: (p) => seen.push(p) });
  const m = chart._interactiveMarks[0];
  c._handlers.pointermove({ clientX: m.x + m.w / 2, clientY: m.y + m.h / 2 });
  c._handlers.pointerleave();
  assert.equal(seen[0].index, 0);
  assert.equal(seen[seen.length - 1], null);
});

test('toDataURL exports a PNG data URL', () => {
  const chart = new Bar(trackedCanvas(), { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false });
  assert.ok(chart.toDataURL().startsWith('data:image/png'));
});

test('tooltipFormat customises tooltip content', () => {
  let arg = null;
  const chart = new Bar(trackedCanvas(), {
    data: { labels: ['A', 'B'], values: [1, 2] },
    animation: false,
    tooltipFormat: (p) => { arg = p; return `custom ${p.label}`; },
  });
  chart._hoverTarget = 0;
  chart._pointer = { x: 50, y: 50 };
  chart.drawTooltip();
  assert.equal(arg.index, 0);
  assert.equal(arg.label, 'A: 1');
});

test('destroy() removes the click listener', () => {
  const removed = [];
  const c = trackedCanvas();
  c.removeEventListener = (type) => removed.push(type);
  const chart = new Bar(c, { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false, onClick() {} });
  chart.destroy();
  assert.ok(removed.includes('click'));
});
