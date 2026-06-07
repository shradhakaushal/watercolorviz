// Radar / spider — Primitive C (radial). One translucent grainy polygon per
// series over a hand-drawn ink web (spokes + rings + axis labels).

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, inkPath } from '../axes.js';
import { paintClosedWash, paintPolygonSelection, bloomReveal } from './shapes.js';

export class Radar extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
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

    // Web: concentric rings + spokes (faint ink). `gridColor`, `gridOpacity`
    // and `gridWidth` tune the web; gridOpacity scales both rings and spokes,
    // keeping the spokes a touch stronger than the rings (the default look).
    const gridColor = config.gridColor || ink;
    const gridWidth = config.gridWidth ?? 1;
    const ringOpacity = config.gridOpacity ?? 0.12;
    const spokeOpacity = config.gridOpacity != null ? Math.min(1, config.gridOpacity * 1.5) : 0.18;
    const rings = config.rings || 4;
    for (let k = 1; k <= rings; k++) {
      const ring = [];
      for (let i = 0; i <= n; i++) {
        const a = angle(i % n);
        ring.push([cx + Math.cos(a) * (R * k) / rings, cy + Math.sin(a) * (R * k) / rings]);
      }
      inkPath(ctx, ring, { color: gridColor, opacity: ringOpacity, width: gridWidth, seed: seed + k, gaps: false });
    }
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      inkLine(ctx, cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R, { color: gridColor, opacity: spokeOpacity, width: gridWidth, jitter: 0.6, seed: seed + i });
      // axis label just beyond the rim
      const lx = cx + Math.cos(a) * (R + 14);
      const ly = cy + Math.sin(a) * (R + 14);
      this.text(axes[i], lx, ly, { size: 12 });
    }

    const seriesNames = config.seriesNames || (series.length > 1 ? series.map((_, s) => `Series ${s + 1}`) : series.map(() => 'Series'));
    // Series polygons (translucent washes + ink outline). Each blooms outward
    // from the web's centre, as if dropped onto the wet sheet.
    const marks = [];
    series.forEach((vals, s) => {
      const poly = vals.map((v, i) => {
        const a = angle(i);
        return [cx + Math.cos(a) * r(v), cy + Math.sin(a) * r(v)];
      });
      const color = this.colorFor(s);
      bloomReveal(ctx, cx, cy, R, this.loadProgress(s), () => {
        paintClosedWash(ctx, poly, { color, seed: seed + s * 17, intensity: 0.7, ink });
      });
      marks.push({ index: s, points: poly, color, label: seriesNames[s] });
    });
    // Hover: deepen the hovered series' wash and re-ink its edge.
    marks.forEach((mark) => {
      paintPolygonSelection(ctx, mark.points, { color: mark.color, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    // Series key (when names given, or whenever there is more than one series).
    if ((config.seriesNames || series.length > 1) && config.legend !== false) {
      this.drawLegend(seriesNames.map((n, s) => ({ label: n, color: this.colorFor(s) })), { y: plot.y1 + 18 });
    }

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    this.scheduleLoadAnimation(series.length);
  }
}
