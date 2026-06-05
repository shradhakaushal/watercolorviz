// Ridgeline / joyplot — Primitive B (arbitrary filled polygon), stacked.
//
// One translucent grainy wash per series, each with a line-and-wash ridge,
// stacked top→bottom and OVERLAPPING so lower ridges occlude the ones behind —
// the signature joyplot look. This is the headline visualization.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkPath, tick } from '../axes.js';
import { paintAreaWash } from './shapes.js';

export class Ridgeline extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const { labels, x: xs, series } = config.data;
    this.paintBackground();

    const rows = series.length;
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const rowGap = plot.h / rows;
    const overlap = config.overlap ?? 1.9; // >1 → ridges overlap upward
    const amp = rowGap * overlap;
    const maxV = d3.max(series.flat());
    const colors = config.colors || series.map((_, i) => colorAt(i));

    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };
    const tops = [];
    // Back-to-front: top row first so each lower row paints over the one above.
    // Clipped to the plot so the sides/baseline stay clean despite edge wobble.
    this.withPlotClip(() => {
      for (let r = 0; r < rows; r++) {
        const baseY = plot.y0 + (r + 1) * rowGap;
        const top = xs.map((xv, i) => [plot.x0 + x(xv), baseY - (series[r][i] / maxV) * amp]);
        tops.push({ top, baseY });
        paintAreaWash(ctx, top, baseY, { color: colors[r], seed: seed + r * 17, intensity: 0.9, extend });
        inkPath(ctx, top, { seed: seed + r * 17, width: 1.7, opacity: 0.7 });
      }
    });
    // Row labels (left of the axis, so outside the clip).
    tops.forEach(({ baseY }, r) => this.text(labels[r], plot.x0 - 8, baseY - 4, { size: 13, align: 'right' }));

    // x ticks along the bottom baseline.
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true);
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    if (config.xLabel) this.text(config.xLabel, plot.x0 + plot.w / 2, this.height - 8, { size: 14 });
  }
}
