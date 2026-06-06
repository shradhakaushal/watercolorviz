// Area chart — Primitive B (arbitrary filled polygon).
//
// A soft grainy wash under the data curve, with a line-and-wash ink contour on
// top — the classic "line and wash" look. Accepts numeric or categorical x.

import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { buildScale, resolveXScale } from '../scale.js';
import { requireArray, requireSameLength, cleanNumbers } from '../validate.js';
import { areaPolygon, paintAreaWash, paintPolygonSelection, withRevealClip } from './shapes.js';

export class Area extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = requireArray(config.data.x, 'data.x', { allowEmpty: true });
    const ys = cleanNumbers(requireArray(config.data.y, 'data.y', { allowEmpty: true }));
    this.paintBackground();

    if (xs.length === 0 || ys.length === 0) {
      this.emptyState();
      return;
    }
    requireSameLength({ 'data.x': xs, 'data.y': ys });

    // x axis (time / numeric / categorical); y is linear (zero baseline) by
    // default, or yScale:'log'.
    const X = resolveXScale({ xs, plot, config });
    const x = X.x;
    const xvals = X.values;
    const yi = buildScale({ type: config.yScale, values: ys, range: [plot.h, 0], includeZero: true, tickCount: 5, format: config.yFormat });
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
    if (X.kind === 'categorical') {
      xs.forEach((xv) => this.text(String(xv), plot.x0 + x(xv), plot.y1 + 16, { size: 12 }));
    } else {
      for (const t of X.ticks) {
        const tx = plot.x0 + x(t);
        tick(ctx, tx, plot.y1, true, { color: ink });
        const lab = X.format(t);
        if (lab) this.text(lab, tx, plot.y1 + 16, { size: 12 });
      }
    }

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(1);
  }
}
