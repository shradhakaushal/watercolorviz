// Shared scale + tick helper.
//
// Charts build their continuous axes through buildScale() so scale type
// (linear / log), tick selection and tick formatting live in one place. It
// returns the d3 scale plus a ready list of tick values and a label formatter;
// for log axes the formatter blanks the minor ticks (the classic decade look),
// so callers draw a tick mark for every value but only a label where the
// formatter returns a non-empty string.
//
//   const yi = buildScale({ type: config.yScale, values, range: [h, 0], includeZero: true });
//   const y = yi.scale;
//   for (const t of yi.ticks) { tick(...); const s = yi.format(t); if (s) text(s, ...); }

import * as d3 from 'd3';

export function buildScale({
  type = 'linear',
  values = [],
  range,
  includeZero = false,
  nice = true,
  tickCount = 5,
} = {}) {
  if (type === 'time') {
    // Accept Date objects, epoch millis or parseable date strings.
    const dates = values.map((v) => (v instanceof Date ? v : new Date(v)));
    const scale = d3.scaleTime().domain(d3.extent(dates)).range(range);
    if (nice) scale.nice();
    const ticks = scale.ticks(tickCount);
    // d3's multi-scale time formatter labels each tick at the right resolution
    // (year / month / day / hour) for the span being shown.
    const f = scale.tickFormat();
    return { scale, type: 'time', ticks, format: (v) => f(v) };
  }

  if (type === 'log') {
    const positive = values.filter((v) => v > 0);
    let lo = d3.min(positive);
    let hi = d3.max(values);
    // Log scales need a strictly positive domain; guard against zero/negatives.
    if (!(lo > 0)) lo = hi > 0 ? hi / 1000 : 1;
    if (!(hi > lo)) hi = lo * 10;
    const scale = d3.scaleLog().domain([lo, hi]).range(range);
    if (nice) scale.nice();
    const ticks = scale.ticks(tickCount);
    const f = scale.tickFormat(tickCount);
    return { scale, type: 'log', ticks, format: (v) => f(v) };
  }

  // Linear (default).
  let lo = d3.min(values);
  let hi = d3.max(values);
  if (includeZero) {
    lo = Math.min(0, lo);
    hi = Math.max(0, hi);
  }
  const scale = d3.scaleLinear().domain([lo, hi]).range(range);
  if (nice) scale.nice();
  const ticks = scale.ticks(tickCount);
  return { scale, type: 'linear', ticks, format: (v) => String(v) };
}
