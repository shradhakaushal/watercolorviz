// Radar / spider — Primitive C (radial). One translucent grainy polygon per
// series over a hand-drawn ink web (spokes + rings + axis labels).

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkLine, inkPath } from '../axes.js';
import { paintClosedWash } from './shapes.js';

export class Radar extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const axes = config.data.axes;
    const series = config.data.series; // [[v,v,...], ...]
    this.paintBackground();

    const cx = plot.x0 + plot.w / 2;
    const cy = plot.y0 + plot.h / 2;
    const R = Math.min(plot.w, plot.h) / 2 - 18;
    const n = axes.length;
    const maxV = config.max || d3.max(series.flat());
    const r = d3.scaleLinear().domain([0, maxV]).range([0, R]);
    const angle = (i) => -Math.PI / 2 + (i / n) * Math.PI * 2;

    // Web: concentric rings + spokes (faint ink).
    const rings = config.rings || 4;
    for (let k = 1; k <= rings; k++) {
      const ring = [];
      for (let i = 0; i <= n; i++) {
        const a = angle(i % n);
        ring.push([cx + Math.cos(a) * (R * k) / rings, cy + Math.sin(a) * (R * k) / rings]);
      }
      inkPath(ctx, ring, { opacity: 0.12, width: 1, seed: seed + k, gaps: false });
    }
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      inkLine(ctx, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, { opacity: 0.18, width: 1, jitter: 0.6, seed: seed + i });
      // axis label just beyond the rim
      const lx = cx + Math.cos(a) * (R + 14);
      const ly = cy + Math.sin(a) * (R + 14);
      this.text(axes[i], lx, ly, { size: 12 });
    }

    // Series polygons (translucent washes + ink outline).
    series.forEach((vals, s) => {
      const poly = vals.map((v, i) => {
        const a = angle(i);
        return [cx + Math.cos(a) * r(v), cy + Math.sin(a) * r(v)];
      });
      const color = (config.colors && config.colors[s]) || colorAt(s);
      paintClosedWash(ctx, poly, { color, seed: seed + s * 17, intensity: 0.7 });
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
  }
}
