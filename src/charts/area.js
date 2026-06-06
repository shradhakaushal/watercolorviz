// Area chart — Primitive B (arbitrary filled polygon).
//
// A soft grainy wash under the data curve, with a line-and-wash ink contour on
// top — the classic "line and wash" look. Accepts numeric or categorical x.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { buildScale } from '../scale.js';
import { areaPolygon, paintAreaWash, paintPolygonSelection, withRevealClip } from './shapes.js';

export class Area extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const ys = config.data.y;
    this.paintBackground();

    // x can be time (Date values or xScale:'time'), numeric or categorical;
    // y is linear (zero baseline) by default, or yScale:'log'.
    const timeX = config.xScale === 'time' || xs[0] instanceof Date;
    const xvals = timeX ? xs.map((d) => (d instanceof Date ? d : new Date(d))) : xs;
    const numericX = !timeX && typeof xs[0] === 'number';
    let x;
    let xi = null;
    if (timeX) {
      xi = buildScale({ type: 'time', values: xvals, range: [0, plot.w], tickCount: config.xTicks || 6, nice: config.xNice !== false });
      x = xi.scale;
    } else if (numericX) {
      x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    } else {
      x = d3.scalePoint().domain(xs).range([0, plot.w]);
    }
    const yi = buildScale({ type: config.yScale, values: ys, range: [plot.h, 0], includeZero: true, tickCount: 5 });
    const y = yi.scale;
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    if (config.grid !== false) {
      for (const t of yi.ticks) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const top = xvals.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(ys[i])]);
    const color = this.colorFor(0);
    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };
    const selectionPoints = areaPolygon(top, plot.y1);
    const reveal = this.loadProgress(0);
    this.withPlotClip(() => {
      withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
        paintAreaWash(ctx, top, plot.y1, { color, seed, intensity: config.intensity ?? 0.95, extend });
      });
      paintPolygonSelection(ctx, selectionPoints, {
        color,
        outlinePoints: top,
        closedOutline: false,
        progress: this.selectionProgress(0),
      });
    });
    this.setInteractiveMarks([{ index: 0, points: selectionPoints }]);
    withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
      inkPath(ctx, top, { seed, width: 1.9, color: ink });
    });

    for (const t of yi.ticks) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      const lab = yi.format(t);
      if (lab) this.text(lab, plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    if (timeX) {
      for (const t of xi.ticks) {
        const tx = plot.x0 + x(t);
        tick(ctx, tx, plot.y1, true, { color: ink });
        const lab = xi.format(t);
        if (lab) this.text(lab, tx, plot.y1 + 16, { size: 12 });
      }
    } else if (numericX) {
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
    this.scheduleLoadAnimation(1);
  }
}
