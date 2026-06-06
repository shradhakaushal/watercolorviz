// Scatter / bubble — Primitive D (point blobs).
//
// Each point is a soft, translucent grainy blob; pass per-point radii for a
// bubble chart. Reuses the paint engine directly via paintDot.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { tick } from '../axes.js';
import { buildScale } from '../scale.js';
import { paintDot, paintDotSelection } from './shapes.js';

export class Scatter extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    const rs = config.data.r; // optional → bubble
    this.paintBackground();

    // `xScale`/`yScale: 'log'` opt into log axes (positive data only).
    const xi = buildScale({ type: config.xScale, values: xs, range: [0, plot.w], tickCount: 6 });
    const yi = buildScale({ type: config.yScale, values: ys, range: [plot.h, 0], tickCount: 5 });
    const x = xi.scale;
    const y = yi.scale;
    const rScale = rs
      ? d3.scaleSqrt().domain([0, d3.max(rs)]).range([3, config.maxRadius || 26])
      : null;
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    for (const t of yi.ticks) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      const lab = yi.format(t);
      if (lab) this.text(lab, plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    for (const t of xi.ticks) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      const lab = xi.format(t);
      if (lab) this.text(lab, tx, plot.y1 + 16, { size: 12 });
    }

    const marks = [];
    xs.forEach((xv, i) => {
      const cx = plot.x0 + x(xv);
      const cy = plot.y0 + y(ys[i]);
      const r = rs ? rScale(rs[i]) : config.radius || 8;
      const reveal = this.loadProgress(i);
      if (reveal > 0) {
        const scale = 0.72 + reveal * 0.28;
        ctx.save();
        ctx.globalAlpha = 0.25 + reveal * 0.75;
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        paintDot(ctx, 0, 0, r, { color: this.colorFor(i), seed: seed + i * 7, intensity: 0.82, outline: r > 12, ink });
        ctx.restore();
      }
      paintDotSelection(ctx, cx, cy, r, {
        color: this.colorFor(i),
        progress: this.selectionProgress(i),
      });
      marks.push({ index: i, cx, cy, r, color: this.colorFor(i), label: rs ? `${+xv.toFixed(1)}, ${+ys[i].toFixed(1)} · ${Math.round(rs[i])}` : `${+xv.toFixed(1)}, ${+ys[i].toFixed(1)}` });
    });
    this.setInteractiveMarks(marks);

    // Optional category key: pass `legend: [{ label, color }]`.
    if (Array.isArray(config.legend)) this.drawLegend(config.legend);

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(xs.length);
  }
}
