// Likert / survey results — diverging stacked bars, centred on neutral, whose
// segments visibly BLEED into each other (fuzzy data drawn fuzzily).
//
//   data: { questions: [labels], levels: [labels], values: [[n per level], ...] }

import { Chart } from '../chart.js';
import { diverging } from '../palette.js';
import { inkLine } from '../axes.js';
import { paintRectWash, paintRectSelection, bloomReveal } from './shapes.js';

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

    const marks = [];
    questions.forEach((q, qi) => {
      const r = rows[qi];
      const [left] = sideOf(r);
      const y0 = plot.y0 + qi * rowH + (rowH - barH) / 2;
      const reveal = this.loadProgress(qi);
      let xpos = cx - left * sc;
      r.forEach((f, li) => {
        const w = f * sc;
        // Overlap each segment 1px into its neighbour so the edges bleed.
        if (w > 0.6) {
          const rw = w + 2;
          const segSeed = seed + qi * 7 + li;
          const maxR = Math.hypot(rw, barH) / 2;
          bloomReveal(ctx, xpos - 1 + rw / 2, y0 + barH / 2, maxR, reveal, () => {
            paintRectWash(ctx, xpos - 1, y0, rw, barH, { color: colors[li], seed: segSeed, intensity: 0.95, ink });
          });
          marks.push({
            index: marks.length,
            x: xpos - 1, y: y0, w: rw, h: barH,
            color: colors[li], seed: segSeed,
            label: `${q}\n${levels[li]}: ${values[qi][li]} (${Math.round(f * 100)}%)`,
          });
        }
        xpos += w;
      });
      this.text(q, plot.x0 - 10, y0 + barH / 2, { size: 12, align: 'right' });
    });

    // Hover: deepen the hovered segment with a sketched edge + tooltip.
    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, { color: mark.color, seed: mark.seed, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    // Legend along the bottom, under the bars.
    if (config.legend !== false) {
      this.drawLegend(levels.map((lab, li) => ({ label: lab, color: colors[li] })), { size: 10 });
    }

    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(questions.length);
  }
}
