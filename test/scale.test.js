import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScale, tickFormat } from '../src/scale.js';

test('linear scale maps endpoints and exposes ticks', () => {
  const s = buildScale({ values: [0, 100], range: [200, 0] });
  assert.equal(s.type, 'linear');
  assert.equal(s.scale(0), 200);
  assert.equal(s.scale(100), 0);
  assert.ok(s.ticks.length > 0);
  assert.equal(s.format(50), '50');
});

test('includeZero anchors the domain at zero', () => {
  const s = buildScale({ values: [20, 50], range: [200, 0], includeZero: true });
  assert.equal(s.scale(0), 200);
});

test('log scale guards against non-positive domains', () => {
  const s = buildScale({ type: 'log', values: [0, 5, 100], range: [200, 0] });
  assert.equal(s.type, 'log');
  assert.ok(Number.isFinite(s.scale(100)));
  assert.ok(s.ticks.every((t) => t > 0));
});

test('time scale produces date ticks', () => {
  const s = buildScale({ type: 'time', values: [new Date(2025, 0, 1), new Date(2025, 11, 31)], range: [0, 200] });
  assert.equal(s.type, 'time');
  assert.ok(s.ticks.length > 0);
  assert.equal(typeof s.format(s.ticks[0]), 'string');
});

test('format option styles linear/log tick labels', () => {
  const s = buildScale({ values: [1000, 5000], range: [100, 0], format: '$,.0f' });
  assert.equal(s.format(1000), '$1,000');
});

test('tickFormat accepts specifiers, functions and a default', () => {
  assert.equal(tickFormat('.0%')(0.5), '50%');
  assert.equal(tickFormat((v) => `x${v}`)(3), 'x3');
  assert.equal(tickFormat()(3), '3');
});
