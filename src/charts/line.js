// Line chart — a continuous line-and-wash ink stroke through the data with a
// soft blob marker at each point. (The reference's line panel.)

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
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
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    this.paintBackground();

    const numericX = typeof xs[0] === 'number';
    const x = numericX
      ? d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w])
      : d3.scalePoint().domain(xs).range([0, plot.w]);
    const y = d3.scaleLinear().domain([0, d3.max(ys) * 1.1]).nice().range([plot.h, 0]);
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const pts = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(ys[i])]);
    // The line takes the chart's chosen colour (so a blue chart is a blue line);
    // `lineColor` overrides just the stroke if you want it inked separately.
    const lineColor = config.lineColor || this.colorFor(0);

    const lineReveal = this.loadProgress(0);
    const visiblePts = partialPolyline(pts, lineReveal);
    if (visiblePts.length > 1) {
      inkPath(ctx, visiblePts, { seed, width: 2.1, gaps: false, color: lineColor });
    }

    pts.forEach((_, i) => {
      const progress = this.selectionProgress(i);
      if (progress <= 0.01) return;
      if (i > 0) {
        inkPath(ctx, [pts[i - 1], pts[i]], { seed: seed + 600 + i, width: 2.6 + progress, gaps: false, color: '#000000', opacity: 0.78 * progress });
      }
      if (i < pts.length - 1) {
        inkPath(ctx, [pts[i], pts[i + 1]], { seed: seed + 700 + i, width: 2.6 + progress, gaps: false, color: '#000000', opacity: 0.78 * progress });
      }
    });

    // Markers.
    const marks = [];
    pts.forEach((p, i) => {
      const r = config.radius || 6;
      const reveal = this.loadProgress(i + 1);
      if (reveal > 0) {
        const scale = 0.72 + reveal * 0.28;
        ctx.save();
        ctx.globalAlpha = 0.25 + reveal * 0.75;
        ctx.translate(p[0], p[1]);
        ctx.scale(scale, scale);
        paintDot(ctx, 0, 0, r, { color: this.colorFor(i), seed: seed + i * 7, intensity: 0.95, outline: true, ink });
        ctx.restore();
      }
      paintDotSelection(ctx, p[0], p[1], r, {
        color: this.colorFor(i),
        progress: this.selectionProgress(i),
      });
      marks.push({ index: i, cx: p[0], cy: p[1], r, hitPad: 6 });
    });

    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    if (numericX) {
      for (const t of x.ticks(6)) {
        const tx = plot.x0 + x(t);
        tick(ctx, tx, plot.y1, true, { color: ink });
        this.text(String(t), tx, plot.y1 + 16, { size: 12 });
      }
    } else {
      xs.forEach((xv) => this.text(String(xv), plot.x0 + x(xv), plot.y1 + 16, { size: 12 }));
    }

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.setInteractiveMarks(marks);
    this.scheduleLoadAnimation(pts.length + 1);
  }
}
