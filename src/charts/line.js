// Line chart — a continuous line-and-wash ink stroke through the data with a
// soft blob marker at each point. (The reference's line panel.)

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { paintDot } from './shapes.js';

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

    inkPath(ctx, pts, { seed, width: 2.1, gaps: false, color: lineColor });

    // Markers.
    const marks = [];
    pts.forEach((p, i) => {
      const r = config.radius || 6;
      const color = this.colorFor(i);
      paintDot(ctx, p[0], p[1], r, { color, seed: seed + i * 7, intensity: 0.95, outline: true, ink });
      marks.push({ index: i, x: p[0] - r, y: p[1] - r, w: 2 * r, h: 2 * r, hitPad: 6, color, label: `${xs[i]}: ${ys[i]}` });
    });
    this.setInteractiveMarks(marks);

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
