// Bar chart — Primitive A (rectangular wash). Vertical by default; pass
// `horizontal: true` for the axis-swapped version.
//
// Single series:  data: { labels, values: [num, ...] }
// Grouped:        data: { labels, series: { name: [num, ...], ... } }
//          or:    data: { labels, values: [[...], [...]], names: [...] }
// Grouped bars cluster one bar per series within each label; each series gets
// its own colour, a legend entry and tooltips ("name — label: value").
//
// Each bar is a rectangular watercolor wash (shared grainy fill recipe) with a
// line-and-wash ink outline; the axes/ticks/labels/title are drawn crisply on
// top via the hand-drawn ink chrome.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkLine, tick } from '../axes.js';
import { tickFormat } from '../scale.js';
import { normalizeSeries, isMultiSeries } from '../series.js';
import { requireArray, requireSameLength } from '../validate.js';
import { paintRectSelection, paintRectWashReveal } from './shapes.js';

export class Bar extends Chart {
  legendReserve() {
    if (this.config.legend === false) return 0;
    return isMultiSeries(this.config.data) ? 30 : 0;
  }

  render() {
    const labels = requireArray(this.config.data.labels, 'data.labels', { allowEmpty: true });
    const series = normalizeSeries(this.config.data);
    if (labels.length === 0 || series.every((sr) => sr.values.length === 0)) {
      this.emptyState();
      return;
    }
    for (const sr of series) requireSameLength({ 'data.labels': labels, [`series "${sr.name}"`]: sr.values });

    if (series.length > 1) {
      return this.config.horizontal ? this.renderGroupedHorizontal(series) : this.renderGroupedVertical(series);
    }
    const values = series[0].values; // sanitised (non-finite → 0)
    if (this.config.horizontal) return this.renderHorizontal(values);
    return this.renderVertical(values);
  }

  renderGroupedVertical(series) {
    const { ctx, plot, seed, config, ink } = this;
    const labels = config.data.labels;
    this.paintBackground();

    const S = series.length;
    const N = labels.length;
    const xOuter = d3.scaleBand().domain(labels).range([0, plot.w]).padding(0.28);
    const xInner = d3.scaleBand().domain(d3.range(S)).range([0, xOuter.bandwidth()]).padding(0.12);
    const allV = series.flatMap((sr) => sr.values);
    const y = d3.scaleLinear().domain([Math.min(0, d3.min(allV)), d3.max(allV)]).nice().range([plot.h, 0]);
    const zeroY = plot.y0 + y(0);
    this.project = (lab, v) => [plot.x0 + xOuter(lab) + xOuter.bandwidth() / 2, plot.y0 + y(v)];

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const marks = [];
    labels.forEach((lab, i) => {
      series.forEach((sr, s) => {
        const v = sr.values[i];
        const bx = plot.x0 + xOuter(lab) + xInner(s);
        const bw = xInner.bandwidth();
        const top = plot.y0 + y(Math.max(v, 0));
        const bh = Math.abs((plot.y0 + y(Math.min(v, 0))) - top);
        if (bh <= 0) return;
        const idx = i * S + s;
        const color = this.colorFor(s);
        paintRectWashReveal(ctx, bx, top, bw, bh, {
          color, seed: seed + idx * 13, ink, fill: config.fill, progress: this.loadProgress(idx), reveal: 'up',
        });
        marks.push({ index: idx, x: bx, y: top, w: bw, h: bh, color, seed: seed + idx * 13, label: `${sr.name} — ${lab}: ${v}` });
      });
    });

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, { color: mark.color, seed: mark.seed, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    const vfmt = tickFormat(config.yFormat);
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(vfmt(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 + xOuter(lab) + xOuter.bandwidth() / 2, zeroY + 17, { size: 14 });
    });

    this.drawLegend(series.map((sr, s) => ({ label: sr.name, color: this.colorFor(s) })));
    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }

  renderGroupedHorizontal(series) {
    const { ctx, plot, seed, config, ink } = this;
    const labels = config.data.labels;
    this.paintBackground();

    const S = series.length;
    const yOuter = d3.scaleBand().domain(labels).range([0, plot.h]).padding(0.28);
    const yInner = d3.scaleBand().domain(d3.range(S)).range([0, yOuter.bandwidth()]).padding(0.12);
    const allV = series.flatMap((sr) => sr.values);
    const x = d3.scaleLinear().domain([Math.min(0, d3.min(allV)), d3.max(allV)]).nice().range([0, plot.w]);
    this.project = (v, lab) => [plot.x0 + x(v), plot.y0 + yOuter(lab) + yOuter.bandwidth() / 2];

    if (config.grid !== false) {
      for (const t of x.ticks(5)) {
        const gx = plot.x0 + x(t);
        inkLine(ctx, gx, plot.y0, gx, plot.y1, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const marks = [];
    labels.forEach((lab, i) => {
      series.forEach((sr, s) => {
        const v = sr.values[i];
        const by = plot.y0 + yOuter(lab) + yInner(s);
        const bh = yInner.bandwidth();
        const left = plot.x0 + x(Math.min(v, 0));
        const bw = Math.abs((plot.x0 + x(Math.max(v, 0))) - left);
        if (bw <= 0) return;
        const idx = i * S + s;
        const color = this.colorFor(s);
        paintRectWashReveal(ctx, left, by, bw, bh, {
          color, seed: seed + idx * 13, ink, fill: config.fill, progress: this.loadProgress(idx), reveal: 'right',
        });
        marks.push({ index: idx, x: left, y: by, w: bw, h: bh, color, seed: seed + idx * 13, label: `${sr.name} — ${lab}: ${v}` });
      });
    });

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, { color: mark.color, seed: mark.seed, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    const vfmt = tickFormat(config.xFormat);
    for (const t of x.ticks(5)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(vfmt(t), tx, plot.y1 + 16, { size: 13 });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 - 10, plot.y0 + yOuter(lab) + yOuter.bandwidth() / 2, { size: 14, align: 'right' });
    });

    this.drawLegend(series.map((sr, s) => ({ label: sr.name, color: this.colorFor(s) })));
    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }

  renderVertical(values = this.config.data.values) {
    const { ctx, plot, seed, config, ink } = this;
    const { labels } = config.data;
    this.paintBackground();

    const x = d3.scaleBand().domain(labels).range([0, plot.w]).padding(0.36);
    const y = d3.scaleLinear().domain([0, d3.max(values)]).nice().range([plot.h, 0]);
    this.project = (lab, v) => [plot.x0 + x(lab) + x.bandwidth() / 2, plot.y0 + y(v)];

    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const marks = [];
    values.forEach((v, i) => {
      const bw = x.bandwidth();
      const bx = plot.x0 + x(labels[i]);
      const top = plot.y0 + y(v);
      const bh = plot.y1 - top;
      if (bh <= 0) return;
      const color = this.colorFor(i);
      paintRectWashReveal(ctx, bx, top, bw, bh, {
        color,
        seed: seed + i * 13,
        ink,
        fill: config.fill,
        progress: this.loadProgress(i),
        reveal: 'up',
      });
      marks.push({ index: i, x: bx, y: top, w: bw, h: bh, color, seed: seed + i * 13, label: `${labels[i]}: ${values[i]}` });
    });

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, {
        color: mark.color,
        seed: mark.seed,
        progress: this.selectionProgress(mark.index),
      });
    });
    this.setInteractiveMarks(marks);

    // y ticks + numbers, x category labels
    const vfmt = tickFormat(config.yFormat);
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(vfmt(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 + x(lab) + x.bandwidth() / 2, plot.y1 + 17, { size: 14 });
    });

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }

  renderHorizontal(values = this.config.data.values) {
    const { ctx, plot, seed, config, ink } = this;
    const { labels } = config.data;
    this.paintBackground();

    const y = d3.scaleBand().domain(labels).range([0, plot.h]).padding(0.36);
    const x = d3.scaleLinear().domain([0, d3.max(values)]).nice().range([0, plot.w]);
    this.project = (v, lab) => [plot.x0 + x(v), plot.y0 + y(lab) + y.bandwidth() / 2];

    if (config.grid !== false) {
      for (const t of x.ticks(5)) {
        const gx = plot.x0 + x(t);
        inkLine(ctx, gx, plot.y0, gx, plot.y1, { color: ink, opacity: 0.08, width: 1, jitter: 0.5, seed: seed + t });
      }
    }

    const marks = [];
    values.forEach((v, i) => {
      const bh = y.bandwidth();
      const by = plot.y0 + y(labels[i]);
      const bw = x(v);
      if (bw <= 0) return;
      const color = this.colorFor(i);
      paintRectWashReveal(ctx, plot.x0, by, bw, bh, {
        color,
        seed: seed + i * 13,
        ink,
        fill: config.fill,
        progress: this.loadProgress(i),
        reveal: 'right',
      });
      marks.push({ index: i, x: plot.x0, y: by, w: bw, h: bh, color, seed: seed + i * 13, label: `${labels[i]}: ${values[i]}` });
    });

    marks.forEach((mark) => {
      paintRectSelection(ctx, mark.x, mark.y, mark.w, mark.h, {
        color: mark.color,
        seed: mark.seed,
        progress: this.selectionProgress(mark.index),
      });
    });
    this.setInteractiveMarks(marks);

    // x ticks + numbers, y category labels
    const vfmt = tickFormat(config.xFormat);
    for (const t of x.ticks(5)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(vfmt(t), tx, plot.y1 + 16, { size: 13 });
    }
    labels.forEach((lab) => {
      this.text(lab, plot.x0 - 10, plot.y0 + y(lab) + y.bandwidth() / 2, { size: 14, align: 'right' });
    });

    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }
}
