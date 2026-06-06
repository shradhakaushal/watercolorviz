// Confidence / uncertainty ribbon — the honest-uncertainty flagship.
//
// A single 95% CI of given width is UNIFORM — every point inside is "in the
// interval" equally — so the band is one even translucent wash (no vertical
// fade that would imply a probability gradient the data doesn't carry). The
// bounds are defined the way a real wet wash dries: a soft darker pigment "bead"
// pooled along the hi/lo edges, plus a thin crisp line, so the interval reads
// clearly without a mechanical dashed rule. The mean rides on top as a bold,
// even-weight line. Works for confidence/prediction intervals and posterior
// bands.
//
//   data: { x, y (mean), lo, hi }   // lo/hi are the band bounds per x
//   config: bandIntensity?, lineColor?, boundColor?, bounds? (false → hide edges)

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath, inkLine, tick } from '../axes.js';
import { paintBandWash, paintRectSelection, withRevealClip } from './shapes.js';
import { hexToRgb } from '../palette.js';

// A concentrated ("deep") tone of a wash colour: push the off-channels away from
// the brightest one (raise saturation) and darken a touch — for the mean line
// and the edge bead, so they read as the same pigment, just pooled darker.
function deepen(hex, k = 0.55, dark = 0.92) {
  const [r, g, b] = hexToRgb(hex);
  const mx = Math.max(r, g, b);
  return [r - (mx - r) * k, g - (mx - g) * k, b - (mx - b) * k].map((v) => Math.round(v * dark));
}
const rgba = ([r, g, b], a) => `rgba(${r},${g},${b},${a})`;

function strokePolyline(ctx, pts, { color, width = 1.6, opacity = 1 }) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = typeof color === 'string' ? color : rgba(color, opacity);
  ctx.lineWidth = width;
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.stroke();
  ctx.restore();
}

export class Interval extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { x: xs, y: ys, lo, hi } = config.data;
    this.paintBackground();

    const numericX = typeof xs[0] === 'number';
    const x = numericX
      ? d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w])
      : d3.scalePoint().domain(xs).range([0, plot.w]);
    const y = d3
      .scaleLinear()
      .domain([Math.min(0, d3.min(lo)), d3.max(hi)])
      .nice()
      .range([plot.h, 0]);
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const px = (i) => plot.x0 + x(xs[i]);
    const color = this.colorFor(0);
    const extend = { x0: plot.x0, x1: plot.x1, ov: 18 };

    // One even wash from lo → hi (uniform: a 95% CI is the same everywhere
    // inside), with a soft pigment "bead" pooled along each bound so the edges
    // read clearly. The whole ribbon washes in left → right as a wet sweep.
    const reveal = this.loadProgress(0);
    const topPts = xs.map((_, i) => [px(i), plot.y0 + y(hi[i])]);
    const botPts = xs.map((_, i) => [px(i), plot.y0 + y(lo[i])]);
    const beadRgb = config.boundColor ? hexToRgb(config.boundColor) : deepen(color, 0.6, 0.8);
    this.withPlotClip(() => {
      withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
        paintBandWash(ctx, topPts, botPts, {
          color,
          seed,
          intensity: config.bandIntensity ?? 0.42,
          extend,
        });
        if (config.bounds !== false) {
          for (const line of [topPts, botPts]) {
            strokePolyline(ctx, line, { color: beadRgb, width: 5.5, opacity: 0.16 }); // soft pool
            strokePolyline(ctx, line, { color: beadRgb, width: 1.5, opacity: 0.7 }); // crisp rim
          }
        }
      });
    });

    // Mean line on top — bold, even-weight, in a deepened pigment — drawn on
    // behind the same sweeping wet front.
    const meanPts = xs.map((_, i) => [px(i), plot.y0 + y(ys[i])]);
    const meanColor = config.lineColor || rgba(deepen(color, 0.5, 0.62), 1);
    withRevealClip(ctx, plot.x0, plot.y0 - 4, plot.w, plot.h + 8, reveal, () => {
      inkPath(ctx, meanPts, { seed, width: 2.6, gaps: false, uniform: true, color: meanColor });
    });

    // Per-x hover targets (a slim vertical strip) → value + CI bounds tooltip.
    const stepW = xs.length > 1 ? (px(1) - px(0)) : 16;
    const marks = xs.map((xv, i) => ({
      index: i,
      x: px(i) - stepW / 2,
      y: plot.y0 + y(hi[i]),
      w: Math.max(6, stepW),
      h: plot.y0 + y(lo[i]) - (plot.y0 + y(hi[i])),
      color,
      seed: seed + i,
      label: `${xv}: ${+ys[i].toFixed(1)} [${+lo[i].toFixed(1)}, ${+hi[i].toFixed(1)}]`,
    }));
    // Hover: a deepened column over the hovered x-slice.
    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, { color: mark.color, seed: mark.seed, progress: this.selectionProgress(mark.index) });
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
    this.scheduleLoadAnimation(1);
  }
}
