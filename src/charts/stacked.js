// Stacked area / streamgraph — Primitive B (arbitrary filled polygon).
//
// Stacks several series as translucent grainy bands. `stream: true` centers the
// baseline (silhouette/wiggle offset) for a streamgraph.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { shades } from '../palette.js';
import { inkPath, tick } from '../axes.js';
import { paintBandWash } from './shapes.js';

export class StackedArea extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const series = config.data.series; // { name: [values...] }
    const names = Object.keys(series);
    const stream = config.stream;
    this.paintBackground();

    const totals = xs.map((_, i) => names.reduce((s, k) => s + series[k][i], 0));
    const maxTotal = d3.max(totals);
    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const y = d3.scaleLinear().domain([0, maxTotal]).range([plot.h, 0]);

    // Lower baseline per x: 0 (stacked) or centered (stream).
    let acc = xs.map((_, i) => (stream ? (maxTotal - totals[i]) / 2 : 0));

    // Colour mode: an explicit `colors` array → distinct hues with ink edges;
    // otherwise a monochromatic dark→light RAMP of one hue with WHITE separator
    // lines between layers — the classic streamgraph look.
    const useRamp = !(Array.isArray(config.colors) && config.colors.length);
    const colors = useRamp
      ? shades(config.color || '#3f7fb0', names.length)
      : names.map((_, si) => this.colorFor(si));
    const sepColor = config.separator || (useRamp ? '#fdf8f0' : ink);
    const sepOpacity = useRamp ? 0.85 : 0.6;

    // Bands are drawn bottom→top; extend each band's bottom a few px DOWN into
    // the band already painted below it, so the hand-painted edges overlap and
    // no paper seam shows between layers. Sides are pushed out + clipped so the
    // left/right edges stay clean; the bottom band is pushed down to the axis.
    const SEAM = 4;
    const ov = 18;
    this.withPlotClip(() => {
      names.forEach((k, si) => {
        const low = acc.slice();
        const high = acc.map((v, i) => v + series[k][i]);
        const topPts = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(high[i])]);
        const botPts = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(low[i]) + (si > 0 ? SEAM : 0)]);
        const extend = { x0: plot.x0, x1: plot.x1, ov, bottomOv: !stream && si === 0 ? ov : 0 };
        paintBandWash(ctx, topPts, botPts, { color: colors[si], seed: seed + si * 17, intensity: 0.95, extend });
        inkPath(ctx, topPts, { seed: seed + si * 17, width: 1.4, opacity: sepOpacity, color: sepColor, gaps: false });
        acc = high;
      });
    }, { bottom: !stream });

    if (!useRamp && config.legend !== false) {
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
        tick(ctx, plot.x0, ty, false, { color: ink });
        this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
      }
    }
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }
    if (!stream) this.drawAxisLines();
    this.drawTitleAndLabels();
  }
}
