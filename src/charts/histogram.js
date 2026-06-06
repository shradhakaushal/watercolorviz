// Histogram — Primitive A (rectangular wash) over d3-binned data.
//
// Takes raw numeric values, bins them with d3.bin, and paints one contiguous
// grainy wash per bin (touching, no padding) with the line-and-wash outline.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, tick } from '../axes.js';
import { tickFormat } from '../scale.js';
import { requireArray, cleanNumbers } from '../validate.js';
import { paintRectSelection, paintRectWashReveal } from './shapes.js';

export class Histogram extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const values = cleanNumbers(requireArray(config.data.values, 'data.values', { allowEmpty: true }));
    this.paintBackground();

    if (values.length === 0) {
      this.emptyState();
      return;
    }

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
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    // Faint horizontal gridlines under the bars.
    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    // One wash per bin, contiguous (a 1px seam keeps the ink edges legible).
    const marks = [];
    bins.forEach((b, i) => {
      const bx = plot.x0 + x(b.x0);
      const bw = x(b.x1) - x(b.x0) - 1;
      const top = plot.y0 + y(b.length);
      const bh = plot.y1 - top;
      if (bh <= 0 || bw <= 0) return;
      const color = this.colorFor(i);
      paintRectWashReveal(ctx, bx, top, bw, bh, {
        color,
        seed: seed + i * 13,
        ink,
        progress: this.loadProgress(i),
        reveal: 'up',
      });
      marks.push({ index: i, x: bx, y: top, w: bw, h: bh, color, seed: seed + i * 13, label: `[${Math.round(b.x0)}, ${Math.round(b.x1)}): ${b.length}` });
    });

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, {
        color: mark.color,
        seed: mark.seed,
        progress: this.selectionProgress(mark.index),
      });
    });
    this.setInteractiveMarks(marks);

    // y ticks (counts) + x value ticks at the bin thresholds.
    const yfmt = tickFormat(config.yFormat);
    const xfmt = tickFormat(config.xFormat);
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(yfmt(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(xfmt(t), tx, plot.y1 + 16, { size: 12 });
    }

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }
}
