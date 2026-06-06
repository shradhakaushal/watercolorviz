// Series normalisation, shared by the multi-series charts (Line, Bar).
//
// A chart's value data can arrive three ways — a flat array (one series), a
// `series: { name: values }` object, or a nested array with optional `names`.
// normalizeSeries() collapses all three into a single `[{ name, values }]`
// shape (with non-finite values sanitised), so charts have one code path.
// `Line` keys its values under `y`, `Bar` under `values`; both are accepted.

import { requireArray, cleanNumbers } from './validate.js';

function flatValues(data) {
  return data.values ?? data.y;
}

export function isMultiSeries(data = {}) {
  const flat = flatValues(data);
  const seriesObj = data.series && !Array.isArray(data.series);
  const nested = Array.isArray(flat) && Array.isArray(flat[0]);
  return Boolean(seriesObj || nested);
}

export function normalizeSeries(data = {}) {
  if (data.series && !Array.isArray(data.series)) {
    return Object.entries(data.series).map(([name, values]) => ({
      name,
      values: cleanNumbers(requireArray(values, `data.series["${name}"]`, { allowEmpty: true })),
    }));
  }
  const flat = flatValues(data);
  if (Array.isArray(flat) && Array.isArray(flat[0])) {
    const names = data.names || flat.map((_, i) => `series ${i + 1}`);
    return flat.map((values, i) => ({
      name: names[i] ?? `series ${i + 1}`,
      values: cleanNumbers(requireArray(values, `data values[${i}]`, { allowEmpty: true })),
    }));
  }
  return [{
    name: data.name || '',
    values: cleanNumbers(requireArray(flat ?? [], 'data.values / data.y', { allowEmpty: true })),
  }];
}
