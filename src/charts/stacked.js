// Stacked area / streamgraph — Primitive B (arbitrary filled polygon).
//
// Stacks several series as translucent grainy bands. `stream: true` centers the
// baseline (silhouette/wiggle offset) for a streamgraph.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkPath, tick } from '../axes.js';
import { bandPolygon, paintBandWash, paintPolygonSelection, withRevealClip } from './shapes.js';

export class StackedArea extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const xs = config.data.x;
    const series = config.data.series; // { name: [values...] }
    const names = Object.keys(series);
    const stream = config.stream;
    this.paintBackground();

    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const rows = xs.map((xv, i) => {
      const row = { x: xv };
      names.forEach((name) => {
        row[name] = series[name][i];
      });
      return row;
    });
    const stack = d3.stack()
      .keys(names)
      .order(stream ? d3.stackOrderInsideOut : d3.stackOrderNone)
      .offset(stream ? d3.stackOffsetWiggle : d3.stackOffsetNone)(rows);
    const yDomain = stream
      ? [d3.min(stack, (layer) => d3.min(layer, (d) => d[0])), d3.max(stack, (layer) => d3.max(layer, (d) => d[1]))]
      : [0, d3.max(stack.at(-1), (d) => d[1])];
    const y = d3.scaleLinear().domain(yDomain).nice().range([plot.h, 0]);
    const colors = config.colors || names.map((_, i) => colorAt(i));

    // Bands are drawn bottom→top; extend each band's bottom a few px DOWN into
    // the band already painted below it, so the hand-painted edges overlap and
    // no paper seam shows between layers. Sides are pushed out + clipped so the
    // left/right edges stay clean; the bottom band is pushed down to the axis.
    const SEAM = 4;
    const ov = 18;
    const marks = [];
    this.withPlotClip(() => {
      stack.forEach((layer, si) => {
        const topPts = layer.map((d) => [plot.x0 + x(d.data.x), plot.y0 + y(d[1])]);
        const botPts = layer.map((d) => [plot.x0 + x(d.data.x), plot.y0 + y(d[0]) + (!stream && si > 0 ? SEAM : 0)]);
        const color = colors[names.indexOf(layer.key)];
        const reveal = stream ? this.loadProgress(si) : this.loadProgress(names.indexOf(layer.key));
        const extend = { x0: plot.x0, x1: plot.x1, ov, bottomOv: !stream && si === 0 ? ov : 0 };
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
          paintBandWash(ctx, topPts, botPts, { color, seed: seed + si * 17, intensity: 0.95, extend });
        });
        marks.push({
          index: si,
          points: bandPolygon(topPts, botPts),
          top: topPts,
          color,
          seed: seed + si * 17,
        });
      });
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
          inkPath(ctx, mark.top, { seed: mark.seed, width: 1.5, opacity: 0.6 });
        });
      });
    }, { bottom: !stream });
    this.setInteractiveMarks(marks);

    if (config.legend !== false) {
      names.forEach((k, si) => {
        const ly = plot.y0 + 6 + si * 18;
        ctx.save();
        ctx.fillStyle = colors[si];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(plot.x1 - 96, ly - 8, 12, 12);
        ctx.restore();
        this.text(k, plot.x1 - 80, ly - 2, { size: 13, align: 'left' });
      });
    }

    if (!stream) {
      for (const t of y.ticks(5)) {
        const ty = plot.y0 + y(t);
        tick(ctx, plot.x0, ty, false);
        this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
      }
    }
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true);
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }
    if (!stream) this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }
}
