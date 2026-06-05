// Area chart — Primitive B (arbitrary filled polygon).
//
// A soft grainy wash under the data curve, with a line-and-wash ink contour on
// top — the classic "line and wash" look. Accepts numeric or categorical x.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { paintAreaWash } from './shapes.js';

export class Area extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    this.paintBackground();

    const numericX = typeof xs[0] === 'number';
    const x = numericX
      ? d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w])
      : d3.scalePoint().domain(xs).range([0, plot.w]);
    const y = d3.scaleLinear().domain([0, d3.max(ys)]).nice().range([plot.h, 0]);

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const top = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(ys[i])]);
    const color = config.color || colorAt(0);
    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };
    this.withPlotClip(() => {
      paintAreaWash(ctx, top, plot.y1, { color, seed, intensity: config.intensity ?? 0.95, extend });
    });
    inkPath(ctx, top, { seed, width: 1.9 });

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
