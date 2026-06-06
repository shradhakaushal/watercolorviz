// Pie / donut — Primitive C (arc → polygon).
//
// Each slice is a wedge polygon painted as a grainy wash with a line-and-wash
// ink edge. Pass `innerRadius` (0..1 of the radius) for a donut.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { paintWedge, wedgePolygon } from './shapes.js';

export class Pie extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { labels, values } = config.data;
    this.paintBackground();

    const cx = plot.x0 + plot.w / 2;
    const cy = plot.y0 + plot.h / 2;
    const r1 = Math.min(plot.w, plot.h) / 2 - 6;
    const r0 = (config.innerRadius || 0) * r1;

    const total = d3.sum(values);
    const marks = [];
    let a = -Math.PI / 2; // start at 12 o'clock
    values.forEach((v, i) => {
      const a1 = a + (v / total) * Math.PI * 2;
      const color = this.colorFor(i);
      paintWedge(ctx, cx, cy, r0, r1, a, a1, { color, seed: seed + i * 13, ink });
      marks.push({ index: i, points: wedgePolygon(cx, cy, r0, r1, a, a1), color, label: `${labels[i]}: ${v} (${Math.round((v / total) * 100)}%)` });
      const mid = (a + a1) / 2;
      // category label just outside the rim
      const lr = r1 + 16;
      this.text(labels[i], cx + Math.cos(mid) * lr, cy + Math.sin(mid) * lr, { size: 13 });
      // percentage inside the slice (skip if the slice is too thin to fit)
      const pct = Math.round((v / total) * 100);
      if (config.percent !== false && a1 - a > 0.25) {
        const ir = r0 + (r1 - r0) * (r0 > 0 ? 0.5 : 0.62);
        this.text(`${pct}%`, cx + Math.cos(mid) * ir, cy + Math.sin(mid) * ir, { size: 12 });
      }
      a = a1;
    });
    this.setInteractiveMarks(marks);

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
  }
}
