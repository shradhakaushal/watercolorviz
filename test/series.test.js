import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSeries, isMultiSeries } from '../src/series.js';

test('flat y/values become a single unnamed series', () => {
  assert.deepEqual(normalizeSeries({ y: [1, 2, 3] }), [{ name: '', values: [1, 2, 3] }]);
  assert.deepEqual(normalizeSeries({ values: [4, 5] }), [{ name: '', values: [4, 5] }]);
});

test('series object becomes named series', () => {
  const out = normalizeSeries({ series: { a: [1, 2], b: [3, 4] } });
  assert.deepEqual(out, [{ name: 'a', values: [1, 2] }, { name: 'b', values: [3, 4] }]);
});

test('nested arrays use names (or defaults)', () => {
  assert.deepEqual(normalizeSeries({ values: [[1], [2]], names: ['p', 'q'] }), [
    { name: 'p', values: [1] },
    { name: 'q', values: [2] },
  ]);
  assert.equal(normalizeSeries({ y: [[1], [2]] })[1].name, 'series 2');
});

test('non-finite values are sanitised to 0', () => {
  assert.deepEqual(normalizeSeries({ y: [1, NaN, Infinity, 4] })[0].values, [1, 0, 0, 4]);
});

test('isMultiSeries detects multi vs single', () => {
  assert.equal(isMultiSeries({ y: [1, 2] }), false);
  assert.equal(isMultiSeries({ values: [1, 2] }), false);
  assert.equal(isMultiSeries({ series: { a: [1] } }), true);
  assert.equal(isMultiSeries({ values: [[1], [2]] }), true);
});
