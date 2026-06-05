// Chart base — the thin scaffold every watercolor chart shares.
//
// Per the spec, charts are thin: they set up the canvas + paper, compute a
// shape with D3, hand it to the paint engine, then draw crisp hand-drawn ink
// chrome (axes/labels) on top. This base owns the boring parts (sizing,
// margins, the plot rect, paper background, text) so each chart only implements
// `render()`.

import { paintPaper } from './paper.js';
import { inkLine, arrowhead, INK } from './axes.js';
import { colorAt } from './palette.js';

export class Chart {
  constructor(el, config = {}) {
    this.config = config;
    const width = config.width || 460;
    const height = config.height || 300;

    // `el` may be a canvas, a DOM container, or a selector string. Resolve a
    // selector to its element FIRST, then decide: if it's already a canvas use
    // it directly; otherwise create a canvas inside it. (Appending a canvas
    // *inside* a <canvas> would render nothing — it becomes fallback content.)
    const target = typeof el === 'string' ? document.querySelector(el) : el;
    if (!target) {
      throw new Error(`watercolorviz: no element found for "${el}"`);
    }
    let canvas;
    if (typeof target.getContext === 'function') {
      canvas = target; // already a <canvas>
    } else {
      canvas = document.createElement('canvas');
      target.appendChild(canvas);
    }
    canvas.width = width;
    canvas.height = height;

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.width = width;
    this.height = height;
    this.seed = config.seed ?? 7;
    // Every colour is configurable. `ink` colours all outlines/axes/labels;
    // `paper` colours the sheet; fills come from colorFor() below.
    this.ink = config.ink || INK;
    this.paper = config.paper; // undefined → paintPaper's default cream
    // A soft humanist/handwriting font carries half the aesthetic (spec §1.6).
    this.font = config.font || '"Caveat", "Comic Sans MS", "Segoe Print", cursive';
    this.margin = Object.assign(
      { top: 46, right: 30, bottom: 44, left: 48 },
      config.margin,
    );

    // The plot rectangle (inside the margins).
    const m = this.margin;
    this.plot = {
      x0: m.left,
      y0: m.top,
      x1: width - m.right,
      y1: height - m.bottom,
      w: width - m.left - m.right,
      h: height - m.top - m.bottom,
    };

    if (config.data) this.render();
  }

  paintBackground() {
    paintPaper(this.ctx, this.width, this.height, { color: this.paper });
  }

  // Resolve the fill colour for the i-th mark. A single `color` paints every
  // mark that colour (so picking blue gives an all-blue chart); `colors` cycles
  // an explicit palette; otherwise the default palette cycles.
  colorFor(i) {
    const c = this.config;
    if (Array.isArray(c.colors) && c.colors.length) return c.colors[i % c.colors.length];
    if (c.color) return c.color;
    return colorAt(i);
  }

  // Crisp text helper (titles, labels) in the chart's font.
  text(str, x, y, opts = {}) {
    const {
      size = 15,
      align = 'center',
      baseline = 'middle',
      color = this.ink,
      opacity = 1,
    } = opts;
    const ctx = this.ctx;
    ctx.save();
    ctx.font = `${size}px ${this.font}`;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  // L-shaped hand-drawn ink axes with little arrowheads (x along the bottom,
  // y up the left). Shared by the rectangular-wash charts.
  drawAxisLines() {
    const { ctx, plot, seed, ink } = this;
    inkLine(ctx, plot.x0, plot.y1, plot.x1 + 8, plot.y1, { seed: seed + 1, color: ink });
    arrowhead(ctx, plot.x1 + 12, plot.y1, 1, 0, { color: ink });
    inkLine(ctx, plot.x0, plot.y1, plot.x0, plot.y0 - 8, { seed: seed + 2, color: ink });
    arrowhead(ctx, plot.x0, plot.y0 - 12, 0, -1, { color: ink });
  }

  drawTitleAndLabels() {
    const { plot, config, ctx } = this;
    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    if (config.yLabel) {
      ctx.save();
      ctx.translate(14, plot.y0 + plot.h / 2);
      ctx.rotate(-Math.PI / 2);
      this.text(config.yLabel, 0, 0, { size: 14 });
      ctx.restore();
    }
    if (config.xLabel) this.text(config.xLabel, plot.x0 + plot.w / 2, this.height - 8, { size: 14 });
  }

  // Run `fn` with the canvas clipped to the plot's horizontal extent and (by
  // default) its bottom baseline, leaving the top open. Area/band charts paint
  // their fills here: the fill polygon is pushed OUTWARD past these edges, so
  // the clip yields a clean fill right up to the axis/edges with no white gaps.
  withPlotClip(fn, { bottom = true } = {}) {
    const { ctx, plot } = this;
    ctx.save();
    ctx.beginPath();
    const yTop = -100000;
    const yBot = bottom ? plot.y1 : 100000;
    ctx.rect(plot.x0, yTop, plot.w, yBot - yTop);
    ctx.clip();
    fn();
    ctx.restore();
  }

  // Subclasses override.
  render() {}
}
