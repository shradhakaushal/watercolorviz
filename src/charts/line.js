// Line chart — a continuous line-and-wash ink stroke through the data with a
// soft blob marker at each point. (The reference's line panel.)

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { paintDot } from './shapes.js';

export class Line extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    this.paintBackground();

    const numericX = typeof xs[0] === 'number';
    const x = numericX
      ? d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w])
      : d3.scalePoint().domain(xs).range([0, plot.w]);
    const y = d3.scaleLinear().domain([0, d3.max(ys) * 1.1]).nice().range([plot.h, 0]);

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const pts = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(ys[i])]);
    const color = config.color || colorAt(2);

    // The line: a continuous ink stroke (no gaps), with a faint colored under-
    // stroke for a hint of watercolor.
    inkPath(ctx, pts, { seed, width: 2.1, gaps: false });

    // Markers.
    pts.forEach((p, i) => {
      const c = (config.colors && config.colors[i % config.colors.length]) || color;
      paintDot(ctx, p[0], p[1], config.radius || 6, { color: c, seed: seed + i * 7, intensity: 0.95, outline: true });
    });

    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false);
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    if (numericX) {
      for (const t of x.ticks(6)) {
        const tx = plot.x0 + x(t);
        tick(ctx, tx, plot.y1, true);
        this.text(String(t), tx, plot.y1 + 16, { size: 12 });
      }
    } else {
      xs.forEach((xv) => this.text(String(xv), plot.x0 + x(xv), plot.y1 + 16, { size: 12 }));
    }

    this.drawAxisLines();
    this.drawTitleAndLabels();
  }
}
