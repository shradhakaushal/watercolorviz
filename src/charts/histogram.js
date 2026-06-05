// Histogram — Primitive A (rectangular wash) over d3-binned data.
//
// Takes raw numeric values, bins them with d3.bin, and paints one contiguous
// grainy wash per bin (touching, no padding) with the line-and-wash outline.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, tick } from '../axes.js';
import { paintRectWash } from './shapes.js';

export class Histogram extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const values = config.data.values;
    this.paintBackground();

    const x = d3
      .scaleLinear()
      .domain(d3.extent(values))
      .nice()
      .range([0, plot.w]);

    const bins = d3
      .bin()
      .domain(x.domain())
      .thresholds(config.bins || 10)(values);

    const y = d3
      .scaleLinear()
      .domain([0, d3.max(bins, (b) => b.length)])
      .nice()
      .range([plot.h, 0]);

    // Faint horizontal gridlines under the bars.
    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    // One wash per bin, contiguous (a 1px seam keeps the ink edges legible).
    bins.forEach((b, i) => {
      const bx = plot.x0 + x(b.x0);
      const bw = x(b.x1) - x(b.x0) - 1;
      const top = plot.y0 + y(b.length);
      const bh = plot.y1 - top;
      if (bh <= 0 || bw <= 0) return;
      paintRectWash(ctx, bx, top, bw, bh, { color: this.colorFor(i), seed: seed + i * 13, ink });
    });

    // y ticks (counts) + x value ticks at the bin thresholds.
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

    this.drawAxisLines();
    this.drawTitleAndLabels();
  }
}
