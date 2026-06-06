// Ridgeline / joyplot — Primitive B (arbitrary filled polygon), stacked.
//
// One translucent grainy wash per series, each with a line-and-wash ridge,
// stacked top→bottom and OVERLAPPING so lower ridges occlude the ones behind —
// the signature joyplot look. This is the headline visualization.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkPath, tick } from '../axes.js';
import { areaPolygon, paintAreaWash, paintPolygonSelection, withRevealClip } from './shapes.js';

export class Ridgeline extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const { labels, x: xs, series } = config.data;
    this.paintBackground();

    const rows = series.length;
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const rowGap = plot.h / rows;
    const overlap = config.overlap ?? 1.9; // >1 → ridges overlap upward
    const amp = rowGap * overlap;
    const maxV = d3.max(series.flat());
    const colors = config.colors || series.map((_, i) => colorAt(i));

    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };
    const tops = [];
    const marks = [];
    // Back-to-front: top row first so each lower row paints over the one above.
    // Clipped to the plot so the sides/baseline stay clean despite edge wobble.
    this.withPlotClip(() => {
      for (let r = 0; r < rows; r++) {
        const baseY = plot.y0 + (r + 1) * rowGap;
        const top = xs.map((xv, i) => [plot.x0 + x(xv), baseY - (series[r][i] / maxV) * amp]);
        const reveal = this.loadProgress(r);
        tops.push({ top, baseY });
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
          paintAreaWash(ctx, top, baseY, { color: colors[r], seed: seed + r * 17, intensity: 0.9, extend });
        });
        marks.push({
          index: r,
          points: areaPolygon(top, baseY),
          top,
          color: colors[r],
          seed: seed + r * 17,
        });
      }
      marks.forEach((mark) => {
        paintPolygonSelection(ctx, mark.points, {
          color: mark.color,
          outlinePoints: mark.top,
          closedOutline: false,
          progress: this.selectionProgress(mark.index),
        });
      });
      marks.forEach((mark) => {
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, this.loadProgress(mark.index), () => {
          inkPath(ctx, mark.top, { seed: mark.seed, width: 1.7, opacity: 0.7 });
        });
      });
    });
    this.setInteractiveMarks(marks);
    // Row labels (left of the axis, so outside the clip).
    tops.forEach(({ baseY }, r) => this.text(labels[r], plot.x0 - 8, baseY - 4, { size: 13, align: 'right' }));

    // x ticks along the bottom baseline.
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true);
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    if (config.xLabel) this.text(config.xLabel, plot.x0 + plot.w / 2, this.height - 8, { size: 14 });
    this.scheduleLoadAnimation(marks.length);
  }
}
