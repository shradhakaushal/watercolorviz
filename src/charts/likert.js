// Likert / survey results — diverging stacked bars, centred on neutral, whose
// segments visibly BLEED into each other (fuzzy data drawn fuzzily).
//
//   data: { questions: [labels], levels: [labels], values: [[n per level], ...] }

import { Chart } from '../chart.js';
import { diverging } from '../palette.js';
import { inkLine } from '../axes.js';
import { paintRectWash } from './shapes.js';

export class Likert extends Chart {
  constructor(el, config = {}) {
    super(el, { margin: config.margin || { top: 50, right: 24, bottom: 40, left: 132 }, ...config });
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { questions, levels, values } = config.data;
    this.paintBackground();

    const L = levels.length;
    const mid = (L - 1) / 2;
    const rows = values.map((v) => {
      const s = v.reduce((a, b) => a + b, 0) || 1;
      return v.map((x) => x / s);
    });
    const colors = config.colors || diverging(L);

    // Left/right extent of each row about the centre → a single width scale.
    const sideOf = (r) => {
      let left = 0;
      let right = 0;
      r.forEach((f, li) => {
        if (li < mid) left += f;
        else if (li > mid) right += f;
        else { left += f / 2; right += f / 2; }
      });
      return [left, right];
    };
    const maxSide = Math.max(...rows.map((r) => Math.max(...sideOf(r))));
    const cx = plot.x0 + plot.w / 2;
    const sc = (plot.w / 2 - 4) / maxSide;

    const rowH = plot.h / questions.length;
    const barH = rowH * 0.62;

    // Centre reference line behind the bars.
    inkLine(ctx, cx, plot.y0 - 4, cx, plot.y1 + 4, { color: ink, opacity: 0.35, width: 1.2, jitter: 0.4, seed });

    questions.forEach((q, qi) => {
      const r = rows[qi];
      const [left] = sideOf(r);
      const y0 = plot.y0 + qi * rowH + (rowH - barH) / 2;
      let xpos = cx - left * sc;
      r.forEach((f, li) => {
        const w = f * sc;
        // Overlap each segment 1px into its neighbour so the edges bleed.
        if (w > 0.6) paintRectWash(ctx, xpos - 1, y0, w + 2, barH, { color: colors[li], seed: seed + qi * 7 + li, intensity: 0.95, ink });
        xpos += w;
      });
      this.text(q, plot.x0 - 10, y0 + barH / 2, { size: 12, align: 'right' });
    });

    // Legend along the bottom (centred), under the bars.
    if (config.legend !== false) {
      const widths = levels.map((lab) => 26 + lab.length * 5.6);
      const total = widths.reduce((a, b) => a + b, 0);
      let lx = plot.x0 + Math.max(0, (plot.w - total) / 2);
      const ly = plot.y1 + 24;
      levels.forEach((lab, li) => {
        ctx.save();
        ctx.fillStyle = colors[li];
        ctx.globalAlpha = 0.85;
        ctx.fillRect(lx, ly - 5, 10, 10);
        ctx.restore();
        this.text(lab, lx + 14, ly, { size: 10, align: 'left' });
        lx += widths[li];
      });
    }

    this.drawTitleAndLabels();
  }
}
