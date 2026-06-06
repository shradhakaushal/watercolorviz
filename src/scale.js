// Shared scale + tick helper.
//
// Charts build their continuous axes through buildScale() so scale type
// (linear / log / time), tick selection and tick formatting live in one place.
// It returns the d3 scale plus a ready list of tick values and a label
// formatter; for log axes the formatter blanks the minor ticks (the classic
// decade look), so callers draw a tick mark for every value but only a label
// where the formatter returns a non-empty string.
//
//   const yi = buildScale({ type: config.yScale, values, range: [h, 0], includeZero: true, format: config.yFormat });
//   const y = yi.scale;
//   for (const t of yi.ticks) { tick(...); const s = yi.format(t); if (s) text(s, ...); }
//
// `format` accepts a d3-format specifier string (e.g. ',.0f', '$,.0f', '.0%',
// '~s') or a (value) => string function; it overrides the default labelling on
// linear and log axes. Time axes keep their multi-scale date formatter.

import * as d3 from 'd3';

// Resolve a tick `format` (d3 specifier string, function, or nullish) into a
// labelling function. Default is String().
export function tickFormat(format) {
  if (!format) return (v) => String(v);
  if (typeof format === 'function') return format;
  return d3.format(format);
}

// Resolve a cartesian x-axis from raw x data + config, shared by Line/Area.
// Detects three kinds: a time axis (Date values or `xScale: 'time'`), a numeric
// linear axis, or a categorical band of the raw labels. Returns the d3 scale,
// the `kind`, the pixel-space `values` to plot against, the tick values
// (`null` for categorical → label every category), a tick `format`, and
// `labelAt(i)` for tooltips (formatted dates / numbers / raw category).
export function resolveXScale({ xs, plot, config = {} }) {
  const timeX = config.xScale === 'time' || xs[0] instanceof Date;
  const numericX = !timeX && typeof xs[0] === 'number';

  if (timeX) {
    const values = xs.map((d) => (d instanceof Date ? d : new Date(d)));
    const xi = buildScale({ type: 'time', values, range: [0, plot.w], tickCount: config.xTicks || 6, nice: config.xNice !== false });
    const tip = d3.timeFormat(config.timeFormat || '%b %e, %Y');
    return { x: xi.scale, kind: 'time', values, ticks: xi.ticks, format: xi.format, labelAt: (i) => tip(values[i]) };
  }
  if (numericX) {
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const fmt = tickFormat(config.xFormat);
    return { x, kind: 'numeric', values: xs, ticks: x.ticks(config.xTicks || 6), format: fmt, labelAt: (i) => fmt(xs[i]) };
  }
  const x = d3.scalePoint().domain(xs).range([0, plot.w]);
  return { x, kind: 'categorical', values: xs, ticks: null, format: (v) => String(v), labelAt: (i) => xs[i] };
}

export function buildScale({
  type = 'linear',
  values = [],
  range,
  includeZero = false,
  nice = true,
  tickCount = 5,
  format,
} = {}) {
  const custom = format ? tickFormat(format) : null;

  if (type === 'time') {
    // Accept Date objects, epoch millis or parseable date strings.
    const dates = values.map((v) => (v instanceof Date ? v : new Date(v)));
    const scale = d3.scaleTime().domain(d3.extent(dates)).range(range);
    if (nice) scale.nice();
    const ticks = scale.ticks(tickCount);
    // d3's multi-scale time formatter labels each tick at the right resolution
    // (year / month / day / hour) for the span being shown; a custom function
    // (e.g. a d3.timeFormat) can override it.
    const f = typeof format === 'function' ? format : scale.tickFormat();
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
    // Default log formatter blanks minor ticks; a custom format labels them all.
    const f = custom || scale.tickFormat(tickCount);
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
  const f = custom || ((v) => String(v));
  return { scale, type: 'linear', ticks, format: (v) => f(v) };
}
