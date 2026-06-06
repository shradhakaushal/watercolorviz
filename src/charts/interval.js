// Confidence / uncertainty ribbon — the honest-uncertainty flagship.
//
// Instead of one crisp shaded region (which visually contradicts what a CI
// means), the band is built from several NESTED translucent washes between the
// mean and the bounds. They accumulate dense near the mean and fade out toward
// the edges, so the ribbon literally looks more uncertain where it is — works
// for confidence/prediction intervals, forecast cones and posterior bands.
//
//   data: { x, y (mean), lo, hi }   // lo/hi are the band bounds per x

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { paintBandWash } from './shapes.js';

export class Interval extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { x: xs, y: ys, lo, hi } = config.data;
    this.paintBackground();

    const numericX = typeof xs[0] === 'number';
    const x = numericX
      ? d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w])
      : d3.scalePoint().domain(xs).range([0, plot.w]);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(lo)), d3.max(hi)])
      .nice()
      .range([plot.h, 0]);
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const px = (i) => plot.x0 + x(xs[i]);
    const color = this.colorFor(0);
    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };

    // Nested bands at fractions of the way out to the bounds → density gradient.
    const levels = config.levels || [0.3, 0.55, 0.78, 1.0];
    this.withPlotClip(() => {
      levels.forEach((f, li) => {
        const top = xs.map((_, i) => [px(i), plot.y0 + y(ys[i] + f * (hi[i] - ys[i]))]);
        const bot = xs.map((_, i) => [px(i), plot.y0 + y(ys[i] - f * (ys[i] - lo[i]))]);
        paintBandWash(ctx, top, bot, {
          color,
          seed: seed + li * 9,
          intensity: config.bandIntensity ?? 0.26,
          extend,
        });
      });
    });

    // Mean line on top.
    const meanPts = xs.map((_, i) => [px(i), plot.y0 + y(ys[i])]);
    inkPath(ctx, meanPts, { seed, width: 2, gaps: false, color: config.lineColor || ink });

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
  }
}
