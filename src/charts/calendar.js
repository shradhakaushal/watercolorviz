// Calendar heatmap — GitHub-style contribution grid, but with watercolor
// squares (single hue, value → density) that vary slightly in shape.
//
//   data: { days: [{ date: 'YYYY-MM-DD' | Date, value }] }   // contiguous range

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { paintRectWash, paintRectSelection, bloomReveal } from './shapes.js';

const MS_DAY = 86400000;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export class Calendar extends Chart {
  constructor(el, config = {}) {
    super(el, {
      margin: config.margin || { top: 44, right: 16, bottom: 22, left: 40 },
      // Many small cells: a tight stagger keeps the column-by-column sweep brisk.
      animationStagger: config.animationStagger ?? 13,
      ...config,
    });
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const days = config.data.days.map((d) => ({ date: new Date(d.date), value: d.value }));
    this.paintBackground();

    const start = days[0].date;
    const end = days[days.length - 1].date;
    const startSun = new Date(start);
    startSun.setDate(start.getDate() - start.getDay());
    const weekOf = (d) => Math.floor((d - startSun) / (7 * MS_DAY));
    const nWeeks = weekOf(end) + 1;

    const cell = Math.min(plot.w / nWeeks, plot.h / 7);
    const gap = cell * 0.16;
    const max = d3.max(days, (d) => d.value) || 1;
    const color = config.color || (config.colors && config.colors[0]) || '#4ca85f';

    // Day-of-week labels (Mon/Wed/Fri).
    [1, 3, 5].forEach((dow) => {
      this.text(DOW[dow], plot.x0 - 6, plot.y0 + (dow + 0.5) * cell, { size: 10, align: 'right' });
    });

    let lastMonth = -1;
    const marks = [];
    const cw = cell - gap;
    const maxR = Math.hypot(cw, cw) / 2; // half-diagonal covers the whole cell
    days.forEach((d, i) => {
      const wi = weekOf(d.date);
      const dow = d.date.getDay();
      const cx = plot.x0 + wi * cell;
      const cy = plot.y0 + dow * cell;
      const t = d.value / max;
      const rx = cx + gap / 2;
      const ry = cy + gap / 2;
      // Stagger by week so the cells bloom in column by column, left → right.
      bloomReveal(ctx, rx + cw / 2, ry + cw / 2, maxR, this.loadProgress(wi), () => {
        paintRectWash(ctx, rx, ry, cw, cw, {
          color,
          seed: seed + i,
          intensity: 0.22 + t * 1.25,
          outline: false,
          ink,
        });
      });
      marks.push({ index: i, x: rx, y: ry, w: cw, h: cw, seed: seed + i, color, label: `${MON[d.date.getMonth()]} ${d.date.getDate()}: ${d.value}` });
      // Month label at the first week a new month appears.
      const m = d.date.getMonth();
      if (m !== lastMonth && dow === 0) {
        this.text(MON[m], cx + cell / 2, plot.y0 - 8, { size: 10 });
        lastMonth = m;
      }
    });
    // Hover: deepen the hovered day's wash with a sketched edge.
    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, { color: mark.color, seed: mark.seed, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(nWeeks);
  }
}
