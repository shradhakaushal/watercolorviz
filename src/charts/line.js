// Line chart — a continuous line-and-wash ink stroke through the data with a
// soft blob marker at each point. (The reference's line panel.)
//
// Single series:   data: { x: [...], y: [num, ...] }
// Multiple series:  data: { x: [...], series: { name: [num, ...], ... } }
//             or:  data: { x: [...], y: [[...], [...]], names: [...] }
// Each series gets its own colour, an entry in the auto legend, and its own
// markers/tooltips ("name — x: y"). Single-series usage is unchanged.

import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { buildScale, resolveXScale } from '../scale.js';
import { normalizeSeries, isMultiSeries } from '../series.js';
import { requireArray, requireSameLength } from '../validate.js';
import { paintDot, paintDotSelection } from './shapes.js';

function partialPolyline(points, progress) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0 || points.length < 2) return [];
  if (p >= 0.995) return points;

  const lengths = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    lengths.push(len);
    total += len;
  }

  let remaining = total * p;
  const out = [points[0]];
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (remaining >= lengths[i]) {
      out.push(b);
      remaining -= lengths[i];
      continue;
    }
    const t = lengths[i] ? remaining / lengths[i] : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    break;
  }
  return out;
}

export class Line extends Chart {
  legendReserve() {
    if (this.config.legend === false) return 0;
    return isMultiSeries(this.config.data) ? 30 : 0;
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = requireArray(config.data.x, 'data.x', { allowEmpty: true });
    this.paintBackground();

    const series = normalizeSeries(config.data);
    if (xs.length === 0 || series.every((sr) => sr.values.length === 0)) {
      this.emptyState();
      return;
    }
    // x and every series must line up point-for-point.
    for (const sr of series) requireSameLength({ 'data.x': xs, [`series "${sr.name}"`]: sr.values });

    const multi = series.length > 1;
    const S = series.length;
    const N = xs.length;
    // Multi-series → each series is one palette colour; single series keeps the
    // old behaviour (per-point marker colours, `lineColor`/`color` for the line).
    const seriesColor = (s) => this.colorFor(s);
    const markerColor = (s, i) => (multi ? this.colorFor(s) : this.colorFor(i));

    // x axis (time / numeric / categorical) resolved by the shared helper.
    const X = resolveXScale({ xs, plot, config });
    const x = X.x;
    const xvals = X.values;
    const xLabel = (i) => X.labelAt(i);
    const allY = series.flatMap((sr) => sr.values);
    // `yScale: 'log'` opts into a log value axis (positive data only); linear
    // (with a zero baseline) is the default.
    const yi = buildScale({ type: config.yScale, values: allY, range: [plot.h, 0], includeZero: true, tickCount: 5, format: config.yFormat });
    const y = yi.scale;
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    if (config.grid !== false) {
      for (const t of yi.ticks) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    // Pixel-space points per series.
    const ptsBy = series.map((sr) => xvals.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(sr.values[i])]));

    // Lines (reveal indices 0..S-1), drawn under the markers.
    series.forEach((sr, s) => {
      const lineColor = multi ? seriesColor(s) : (config.lineColor || this.colorFor(0));
      const reveal = this.loadProgress(s);
      const visible = partialPolyline(ptsBy[s], reveal);
      if (visible.length > 1) {
        inkPath(ctx, visible, { seed: seed + s * 31, width: 2.1, gaps: false, color: lineColor });
      }
    });

    // Hover emphasis: darken the segments adjacent to the selected point.
    series.forEach((sr, s) => {
      const pts = ptsBy[s];
      pts.forEach((_, i) => {
        const progress = this.selectionProgress(S + s * N + i);
        if (progress <= 0.01) return;
        if (i > 0) {
          inkPath(ctx, [pts[i - 1], pts[i]], { seed: seed + 600 + s * 97 + i, width: 2.6 + progress, gaps: false, color: '#000000', opacity: 0.78 * progress });
        }
        if (i < pts.length - 1) {
          inkPath(ctx, [pts[i], pts[i + 1]], { seed: seed + 700 + s * 97 + i, width: 2.6 + progress, gaps: false, color: '#000000', opacity: 0.78 * progress });
        }
      });
    });

    // Markers (reveal indices S + s*N + i) + interactive marks.
    const marks = [];
    const showMarkers = config.markers !== false;
    series.forEach((sr, s) => {
      const pts = ptsBy[s];
      pts.forEach((p, i) => {
        const r = config.radius || 6;
        const markIndex = S + s * N + i;
        const reveal = this.loadProgress(markIndex);
        if (showMarkers && reveal > 0) {
          const scale = 0.72 + reveal * 0.28;
          ctx.save();
          ctx.globalAlpha = 0.25 + reveal * 0.75;
          ctx.translate(p[0], p[1]);
          ctx.scale(scale, scale);
          paintDot(ctx, 0, 0, r, { color: markerColor(s, i), seed: seed + s * 53 + i * 7, intensity: 0.95, outline: true, ink });
          ctx.restore();
        }
        if (showMarkers) {
          paintDotSelection(ctx, p[0], p[1], r, { color: markerColor(s, i), progress: this.selectionProgress(markIndex) });
        }
        const label = multi ? `${sr.name} — ${xLabel(i)}: ${sr.values[i]}` : `${xLabel(i)}: ${sr.values[i]}`;
        marks.push({ index: markIndex, cx: p[0], cy: p[1], r, hitPad: 6, color: markerColor(s, i), label });
      });
    });

    for (const t of yi.ticks) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      const lab = yi.format(t);
      if (lab) this.text(lab, plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    if (X.kind === 'categorical') {
      xs.forEach((xv) => this.text(String(xv), plot.x0 + x(xv), plot.y1 + 16, { size: 12 }));
    } else {
      for (const t of X.ticks) {
        const tx = plot.x0 + x(t);
        tick(ctx, tx, plot.y1, true, { color: ink });
        const lab = X.format(t);
        if (lab) this.text(lab, tx, plot.y1 + 16, { size: 12 });
      }
    }

    if (multi) {
      this.drawLegend(series.map((sr, s) => ({ label: sr.name, color: seriesColor(s) })));
    } else if (Array.isArray(config.legend)) {
      this.drawLegend(config.legend);
    }

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.setInteractiveMarks(marks);
    this.scheduleLoadAnimation(S + S * N);
  }
}
