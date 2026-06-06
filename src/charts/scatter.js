// Scatter / bubble — Primitive D (point blobs).
//
// Each point is a soft, translucent grainy blob; pass per-point radii for a
// bubble chart. Reuses the paint engine directly via paintDot.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { tick } from '../axes.js';
import { paintDot } from './shapes.js';

export class Scatter extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    const rs = config.data.r; // optional → bubble
    this.paintBackground();

    const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([0, plot.w]);
    const y = d3.scaleLinear().domain(d3.extent(ys)).nice().range([plot.h, 0]);
    const rScale = rs
      ? d3.scaleSqrt().domain([0, d3.max(rs)]).range([3, config.maxRadius || 26])
      : null;
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }

    const marks = [];
    xs.forEach((xv, i) => {
      const cx = plot.x0 + x(xv);
      const cy = plot.y0 + y(ys[i]);
      const r = rs ? rScale(rs[i]) : config.radius || 8;
      const color = this.colorFor(i);
      paintDot(ctx, cx, cy, r, { color, seed: seed + i * 7, intensity: 0.82, outline: r > 12, ink });
      marks.push({ index: i, x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, color, label: rs ? `${+xv.toFixed(1)}, ${+ys[i].toFixed(1)} · ${Math.round(rs[i])}` : `${+xv.toFixed(1)}, ${+ys[i].toFixed(1)}` });
    });
    this.setInteractiveMarks(marks);

    // Optional category key: pass `legend: [{ label, color }]`.
    if (Array.isArray(config.legend)) this.drawLegend(config.legend);

    this.drawAxisLines();
    this.drawTitleAndLabels();
  }
}
