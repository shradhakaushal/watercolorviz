import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from 'canvas';
import * as wcv from '../src/index.js';

// Minimal DOM shim: charts only need document.createElement('canvas').
globalThis.document = { createElement: () => createCanvas(10, 10) };

const C = () => createCanvas(400, 300);

test('valid data constructs every cartesian chart without throwing', () => {
  assert.doesNotThrow(() => new wcv.Bar(C(), { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Line(C(), { data: { x: ['A', 'B'], y: [1, 2] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Area(C(), { data: { x: [0, 1, 2], y: [1, 2, 3] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Scatter(C(), { data: { x: [1, 2], y: [3, 4] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Pie(C(), { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Histogram(C(), { data: { values: [1, 2, 2, 3] }, animation: false }));
});

test('degenerate data degrades gracefully (no throw)', () => {
  assert.doesNotThrow(() => new wcv.Bar(C(), { data: { labels: [], values: [] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Pie(C(), { data: { labels: ['A', 'B'], values: [0, 0] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Bar(C(), { data: { labels: ['A'] }, animation: false }));
  assert.doesNotThrow(() => new wcv.Line(C(), { data: { x: ['A', 'B', 'C'], y: [1, NaN, 3] }, animation: false }));
});

test('malformed data throws a clear, namespaced error', () => {
  assert.throws(
    () => new wcv.Scatter(C(), { data: { x: [1, 2, 3], y: [1, 2] }, animation: false }),
    /watercolorviz: data\.x and data\.y must have the same length/,
  );
  assert.throws(
    () => new wcv.Bar(C(), { data: { labels: ['A', 'B', 'C'], values: [1, 2] }, animation: false }),
    /watercolorviz: .* must have the same length/,
  );
});

test('multi-series and scale options work', () => {
  const bar = new wcv.Bar(C(), { data: { labels: ['Q1', 'Q2'], series: { N: [1, 2], S: [3, 4] } }, animation: false });
  assert.equal(bar._interactiveMarks.length, 4);
  const line = new wcv.Line(C(), { data: { x: [1, 2, 3], y: [10, 100, 1000] }, yScale: 'log', animation: false });
  assert.ok(line._interactiveMarks.length === 3);
});

// A canvas with event/attr tracking, passed directly as the target.
function trackedCanvas() {
  const c = createCanvas(400, 300);
  const events = [];
  c.addEventListener = (type) => events.push(`add:${type}`);
  c.removeEventListener = (type) => events.push(`rm:${type}`);
  c.setAttribute = () => {};
  c.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 });
  c.style = {};
  c._events = events;
  return c;
}

test('destroy() removes listeners and cancels animation frames', () => {
  const cancelled = [];
  const prevCancel = globalThis.cancelAnimationFrame;
  globalThis.cancelAnimationFrame = (id) => cancelled.push(id);
  try {
    const c = trackedCanvas();
    const chart = new wcv.Bar(c, { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false });
    assert.ok(c._events.some((e) => e === 'add:pointermove'));
    chart._loadRaf = 11;
    chart._hoverRaf = 22;
    chart.destroy();
    assert.ok(c._events.includes('rm:pointermove'));
    assert.ok(c._events.includes('rm:pointerleave'));
    assert.ok(c._events.includes('rm:keydown'));
    assert.deepEqual(cancelled.sort(), [11, 22]);
    // draw() is a no-op after destroy.
    let rendered = false;
    chart.render = () => { rendered = true; };
    chart.draw();
    assert.equal(rendered, false);
  } finally {
    globalThis.cancelAnimationFrame = prevCancel;
  }
});

test('paper buffer is built once and reused across draws', () => {
  const chart = new wcv.Bar(C(), { data: { labels: ['A', 'B'], values: [1, 2] }, animation: false });
  const buf = chart._paperCache && chart._paperCache.oc;
  assert.ok(buf, 'paper buffer created on first draw');
  chart.draw();
  assert.equal(chart._paperCache.oc, buf, 'same buffer reused on re-draw');
});

test('keyboard navigation moves the highlight across marks', () => {
  const c = trackedCanvas();
  const chart = new wcv.Bar(c, { data: { labels: ['A', 'B', 'C'], values: [1, 2, 3] }, animation: false });
  chart._handleKey({ key: 'ArrowRight', preventDefault() {} });
  assert.equal(chart._hoverTarget, 0);
  chart._handleKey({ key: 'End', preventDefault() {} });
  assert.equal(chart._hoverTarget, 2);
  chart._handleKey({ key: 'Escape', preventDefault() {} });
  assert.equal(chart._hoverTarget, null);
});
