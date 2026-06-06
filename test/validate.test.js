import { test } from 'node:test';
import assert from 'node:assert/strict';
import { requireArray, requireSameLength, cleanNumbers, isFiniteNumber } from '../src/validate.js';

test('requireArray rejects non-arrays and empties', () => {
  assert.throws(() => requireArray(5, 'data.x'), /watercolorviz: data\.x must be an array/);
  assert.throws(() => requireArray([], 'data.x'), /must not be empty/);
  assert.deepEqual(requireArray([], 'data.x', { allowEmpty: true }), []);
  assert.deepEqual(requireArray([1, 2], 'data.x'), [1, 2]);
});

test('requireSameLength reports mismatches clearly', () => {
  assert.throws(
    () => requireSameLength({ 'data.x': [1, 2, 3], 'data.y': [1, 2] }),
    /data\.x and data\.y must have the same length \(3 vs 2\)/,
  );
  assert.doesNotThrow(() => requireSameLength({ a: [1, 2], b: [3, 4] }));
});

test('cleanNumbers replaces non-finite entries', () => {
  assert.deepEqual(cleanNumbers([1, NaN, Infinity, null, undefined, 2]), [1, 0, 0, 0, 0, 2]);
  assert.deepEqual(cleanNumbers([1, NaN], -1), [1, -1]);
});

test('isFiniteNumber', () => {
  assert.equal(isFiniteNumber(3), true);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber('3'), false);
  assert.equal(isFiniteNumber(Infinity), false);
});
