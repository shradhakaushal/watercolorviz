// Input validation helpers.
//
// A charting library is fed messy data constantly. These helpers fail FAST with
// a clear, namespaced message for programmer errors (missing keys, mismatched
// array lengths) and quietly sanitise merely-dirty numeric data (NaN/Infinity →
// finite) so a stray bad value degrades gracefully instead of silently drawing
// garbage. Degenerate-but-valid cases (empty data, zero totals) are handled by
// each chart's empty-state path, not here.

export function fail(message) {
  throw new Error(`watercolorviz: ${message}`);
}

export function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

// Require `value` to be a non-empty array (or empty-allowed when allowEmpty).
export function requireArray(value, name, { allowEmpty = false } = {}) {
  if (!Array.isArray(value)) fail(`${name} must be an array (got ${describe(value)})`);
  if (!allowEmpty && value.length === 0) fail(`${name} must not be empty`);
  return value;
}

// Require several named arrays to share a length (parallel data columns).
export function requireSameLength(spec) {
  const entries = Object.entries(spec);
  for (const [name, arr] of entries) {
    if (!Array.isArray(arr)) fail(`${name} must be an array (got ${describe(arr)})`);
  }
  const [refName, refArr] = entries[0];
  for (let i = 1; i < entries.length; i++) {
    const [name, arr] = entries[i];
    if (arr.length !== refArr.length) {
      fail(`${refName} and ${name} must have the same length (${refArr.length} vs ${arr.length})`);
    }
  }
}

// Replace non-finite entries (NaN, Infinity, null, undefined) with `fallback`,
// so one bad point can't poison a whole scale/path. Returns a new array.
export function cleanNumbers(arr, fallback = 0) {
  return arr.map((v) => (isFiniteNumber(v) ? v : fallback));
}

function describe(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}
