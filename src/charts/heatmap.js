// Heatmap — Primitive A (rectangular wash) on a grid.
//
// A grid of grainy washes of a single hue; the cell value maps to pigment
// DENSITY (intensity) — low values are pale, translucent washes, high values
// are deep saturated ones. Categorical labels along the bottom and left.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { hexToRgb } from '../palette.js';
import { paintRectWash } from './shapes.js';

export class Heatmap extends Chart {
  constructor(el, config = {}) {
    super(el, { margin: config.margin || { top: 44, right: 18, bottom: 46, left: 40 }, ...config });
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { xLabels, yLabels, values } = config.data;
    this.paintBackground();

    const rows = yLabels.length;
    const cols = xLabels.length;
    const cw = plot.w / cols;
    const ch = plot.h / rows;
    const gap = Math.min(cw, ch) * 0.12;

    const flat = values.flat();
    const min = d3.min(flat);
    const max = d3.max(flat);
    // Single-hue heatmap: `color` (or first of `colors`) sets the hue; value
    // maps to pigment density.
    const color = config.color || (config.colors && config.colors[0]) || '#3f7fb0';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = values[r][c];
        const t = max === min ? 0.5 : (v - min) / (max - min); // 0..1
        const cx = plot.x0 + c * cw + gap / 2;
        const cy = plot.y0 + r * ch + gap / 2;
        // Value → pigment density; keep a floor so empty cells still read.
        const intensity = 0.3 + t * 1.2;
        paintRectWash(ctx, cx, cy, cw - gap, ch - gap, {
          color,
          seed: seed + r * 31 + c * 7,
          intensity,
          outline: false,
          ink: this.ink,
        });
      }
    }

    xLabels.forEach((lab, c) => {
      this.text(lab, plot.x0 + (c + 0.5) * cw, plot.y1 + 16, { size: 13 });
    });
    yLabels.forEach((lab, r) => {
      this.text(lab, plot.x0 - 10, plot.y0 + (r + 0.5) * ch, { size: 13, align: 'right' });
    });

    // Colour key: a min→max gradient of the hue with end labels.
    if (config.legend !== false) {
      const [cr, cg, cb] = hexToRgb(color);
      const tint = (f) => `rgb(${cr + (255 - cr) * f},${cg + (255 - cg) * f},${cb + (255 - cb) * f})`;
      const bw = Math.min(120, plot.w * 0.4);
      const bh = 9;
      const bx = plot.x0 + (plot.w - bw) / 2;
      const by = plot.y1 + 26;
      const grad = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      grad.addColorStop(0, tint(0.8));
      grad.addColorStop(1, tint(0));
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = ink;
      ctx.globalAlpha = 0.4;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.restore();
      this.text(String(Math.round(min)), bx - 5, by + bh / 2, { size: 10, align: 'right' });
      this.text(String(Math.round(max)), bx + bw + 5, by + bh / 2, { size: 10, align: 'left' });
    }

    this.drawTitleAndLabels();
  }
}
