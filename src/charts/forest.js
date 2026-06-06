// Forest plot (meta-analysis) — each study's estimate + CI whisker, with a
// diamond summary. Honest and distinctive for clinical/research work.
//
//   data: {
//     studies: [{ name, est, lo, hi, weight }],
//     summary: { est, lo, hi },     // optional diamond
//   }

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, tick } from '../axes.js';
import { paintDot, paintFillWash } from './shapes.js';

export class Forest extends Chart {
  constructor(el, config = {}) {
    super(el, { margin: config.margin || { top: 46, right: 28, bottom: 42, left: 120 }, ...config });
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const studies = config.data.studies;
    const summary = config.data.summary;
    this.paintBackground();

    const lo = d3.min(studies, (s) => s.lo);
    const hi = d3.max(studies, (s) => s.hi);
    const x = d3
      .scaleLinear()
      .domain([Math.min(lo, summary ? summary.lo : lo), Math.max(hi, summary ? summary.hi : hi)])
      .nice()
      .range([0, plot.w]);
    const X = (v) => plot.x0 + x(v);

    const rows = studies.length + (summary ? 1.4 : 0);
    const rowH = plot.h / rows;
    const nullX = config.null ?? 0;
    const wScale = d3.scaleSqrt().domain([0, d3.max(studies, (s) => s.weight || 1)]).range([4, 13]);

    // Null reference line.
    inkLine(ctx, X(nullX), plot.y0 - 2, X(nullX), plot.y1 + 2, { color: ink, opacity: 0.3, width: 1, jitter: 0.4, seed });

    studies.forEach((s, i) => {
      const cy = plot.y0 + (i + 0.5) * rowH;
      inkLine(ctx, X(s.lo), cy, X(s.hi), cy, { color: ink, opacity: 0.7, width: 1.4, jitter: 0.5, seed: seed + i });
      paintDot(ctx, X(s.est), cy, wScale(s.weight || 1), { color: this.colorFor(i), seed: seed + i * 7, intensity: 0.95, outline: true, ink });
      this.text(s.name, plot.x0 - 10, cy, { size: 11, align: 'right' });
    });

    if (summary) {
      const cy = plot.y0 + (studies.length + 0.6) * rowH;
      const dh = Math.min(9, rowH * 0.4);
      const diamond = [[X(summary.lo), cy], [X(summary.est), cy - dh], [X(summary.hi), cy], [X(summary.est), cy + dh]];
      paintFillWash(ctx, diamond, { color: config.summaryColor || this.colorFor(studies.length), seed: seed + 99, intensity: 0.92, outline: true, ink, bleed: 0.02 });
      this.text(config.summaryLabel || 'Summary', plot.x0 - 10, cy, { size: 12, align: 'right' });
    }

    inkLine(ctx, plot.x0, plot.y1, plot.x1, plot.y1, { color: ink, seed: seed + 1 });
    for (const t of x.ticks(6)) {
      tick(ctx, X(t), plot.y1, true, { color: ink });
      this.text(String(t), X(t), plot.y1 + 16, { size: 11 });
    }

    this.drawTitleAndLabels();
  }
}
