// Pie / donut — Primitive C (arc → polygon).
//
// Each slice is a wedge polygon painted as a grainy wash with a line-and-wash
// ink edge. Pass `innerRadius` (0..1 of the radius) for a donut.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { paintWedge } from './shapes.js';

export class Pie extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const { labels, values } = config.data;
    this.paintBackground();

    const cx = plot.x0 + plot.w / 2;
    const cy = plot.y0 + plot.h / 2;
    const r1 = Math.min(plot.w, plot.h) / 2 - 6;
    const r0 = (config.innerRadius || 0) * r1;

    const total = d3.sum(values);
    let a = -Math.PI / 2; // start at 12 o'clock
    values.forEach((v, i) => {
      const a1 = a + (v / total) * Math.PI * 2;
      const color = (config.colors && config.colors[i % config.colors.length]) || colorAt(i);
      paintWedge(ctx, cx, cy, r0, r1, a, a1, { color, seed: seed + i * 13 });
      // label just outside the mid-angle
      const mid = (a + a1) / 2;
      const lr = r1 + 16;
      this.text(labels[i], cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr, { size: 13 });
      a = a1;
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
  }
}
