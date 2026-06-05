// Bar chart — Primitive A (rectangular wash). Vertical by default; pass
// `horizontal: true` for the axis-swapped version.
//
// Each bar is a rectangular watercolor wash (shared grainy fill recipe) with a
// line-and-wash ink outline; the axes/ticks/labels/title are drawn crisply on
// top via the hand-drawn ink chrome.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, tick } from '../axes.js';
import { paintRectWash } from './shapes.js';

export class Bar extends Chart {
  render() {
    if (this.config.horizontal) return this.renderHorizontal();
    return this.renderVertical();
  }

  renderVertical() {
    const { ctx, plot, seed, config, ink } = this;
    const { labels, values } = config.data;
    this.paintBackground();

    const x = d3.scaleBand().domain(labels).range([0, plot.w]).padding(0.36);
    const y = d3.scaleLinear().domain([0, d3.max(values)]).nice().range([plot.h, 0]);

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    values.forEach((v, i) => {
      const bw = x.bandwidth();
      const bx = plot.x0 + x(labels[i]);
      const top = plot.y0 + y(v);
      const bh = plot.y1 - top;
      if (bh <= 0) return;
      paintRectWash(ctx, bx, top, bw, bh, { color: this.colorFor(i), seed: seed + i * 13, ink });
    });

    // y ticks + numbers, x category labels
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 + x(lab) + x.bandwidth() / 2, plot.y1 + 17, { size: 14 });
    });

    this.drawAxisLines();
    this.drawTitleAndLabels();
  }

  renderHorizontal() {
    const { ctx, plot, seed, config, ink } = this;
    const { labels, values } = config.data;
    this.paintBackground();

    const y = d3.scaleBand().domain(labels).range([0, plot.h]).padding(0.36);
    const x = d3.scaleLinear().domain([0, d3.max(values)]).nice().range([0, plot.w]);

    if (config.grid !== false) {
      for (const t of x.ticks(5)) {
        const gx = plot.x0 + x(t);
        inkLine(ctx, gx, plot.y0, gx, plot.y1, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    values.forEach((v, i) => {
      const bh = y.bandwidth();
      const by = plot.y0 + y(labels[i]);
      const bw = x(v);
      if (bw <= 0) return;
      paintRectWash(ctx, plot.x0, by, bw, bh, { color: this.colorFor(i), seed: seed + i * 13, ink });
    });

    // x ticks + numbers, y category labels
    for (const t of x.ticks(5)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(String(t), tx, plot.y1 + 16, { size: 13 });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 - 10, plot.y0 + y(lab) + y.bandwidth() / 2, { size: 14, align: 'right' });
    });

    this.drawAxisLines();
    this.drawTitleAndLabels();
  }
}
