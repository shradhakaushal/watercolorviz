// Heatmap — Primitive A (rectangular wash) on a grid.
//
// A grid of grainy washes of a single hue; the cell value maps to pigment
// DENSITY (intensity) — low values are pale, translucent washes, high values
// are deep saturated ones. Categorical labels along the bottom and left.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { paintRectSelection, paintRectWashReveal } from './shapes.js';

export class Heatmap extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
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
    const color = config.color || '#3f7fb0'; // single-hue heatmap

    const marks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = values[r][c];
        const t = max === min ? 0.5 : (v - min) / (max - min); // 0..1
        const cx = plot.x0 + c * cw + gap / 2;
        const cy = plot.y0 + r * ch + gap / 2;
        // Value → pigment density; keep a floor so empty cells still read.
        const intensity = 0.3 + t * 1.2;
        paintRectWashReveal(ctx, cx, cy, cw - gap, ch - gap, {
          color,
          seed: seed + r * 31 + c * 7,
          intensity,
          outline: false,
          progress: this.loadProgress(r * cols + c),
          reveal: 'center',
        });
        marks.push({
          index: r * cols + c,
          x: cx,
          y: cy,
          w: cw - gap,
          h: ch - gap,
          color,
          seed: seed + r * 31 + c * 7,
        });
      }
    }

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, {
        color: mark.color,
        seed: mark.seed,
        progress: this.selectionProgress(mark.index),
      });
    });
    this.setInteractiveMarks(marks);

    xLabels.forEach((lab, c) => {
      this.text(lab, plot.x0 + (c + 0.5) * cw, plot.y1 + 16, { size: 13 });
    });
    yLabels.forEach((lab, r) => {
      this.text(lab, plot.x0 - 10, plot.y0 + (r + 0.5) * ch, { size: 13, align: 'right' });
    });

    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }
}
