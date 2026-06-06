// Chart base — the thin scaffold every watercolor chart shares.
//
// Per the spec, charts are thin: they set up the canvas + paper, compute a
// shape with D3, hand it to the paint engine, then draw crisp hand-drawn ink
// chrome (axes/labels) on top. This base owns the boring parts (sizing,
// margins, the plot rect, paper background, text) so each chart only implements
// `render()`.

import { paintPaper } from './paper.js';
import { setRenderDpr } from './watercolor.js';
import { inkLine, arrowhead, INK } from './axes.js';
import { colorAt } from './palette.js';
import { annotateArrow, annotateCircle, annotateText, annotateCallout, annotateBand, annotateBracket } from './annotate.js';

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
    // Hi-DPI: back the canvas at device resolution, present at CSS (logical)
    // size, and scale the context so all drawing stays in logical coords —
    // text, ink and marks all land crisp on retina screens.
    const dpr = config.dpr || (typeof window !== 'undefined' && window.devicePixelRatio ? Math.min(3, window.devicePixelRatio) : 1);
    this.dpr = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    if (canvas.style) {
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.scale(dpr, dpr);
    setRenderDpr(dpr); // marks render at the same resolution
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

    if (config.data) {
      this.render();
      this.drawAnnotations();
    }
  }

  // Resolve an annotation point. A point is either:
  //   [dataX, dataY]        — chart data coords (mapped via `this.project`,
  //                           which cartesian charts set during render)
  //   ['40%', '60%']        — fraction of the plot rect (works on ANY chart)
  //   pixel [x, y]          — used as-is when no projection applies
  // A `*Px` variant on the annotation forces pixels.
  resolvePt(pt, pxPt) {
    if (pxPt) return pxPt;
    if (!pt) return null;
    if (typeof pt[0] === 'string' && pt[0].endsWith('%')) {
      return [this.plot.x0 + (parseFloat(pt[0]) / 100) * this.plot.w, this.plot.y0 + (parseFloat(pt[1]) / 100) * this.plot.h];
    }
    if (this.project) return this.project(pt[0], pt[1]);
    return pt;
  }

  // Resolve a single x-value (for x-range annotations: band, bracket spans).
  resolveX(v) {
    if (typeof v === 'string' && v.endsWith('%')) return this.plot.x0 + (parseFloat(v) / 100) * this.plot.w;
    if (this.project) return this.project(v, 0)[0];
    return v;
  }

  // Hand-drawn annotations, available on EVERY chart via `config.annotations`.
  // Each item: { type: 'circle'|'arrow'|'text'|'callout', ... , color?, seed? }.
  drawAnnotations() {
    const list = this.config.annotations;
    if (!Array.isArray(list) || !list.length) return;
    const ctx = this.ctx;
    const accent = this.config.annotationColor || '#c8604f';
    for (const a of list) {
      const color = a.color || accent;
      const seed = a.seed ?? 1;
      if (a.type === 'circle') {
        const [x, y] = this.resolvePt(a.at, a.atPx);
        annotateCircle(ctx, x, y, a.r ?? 22, a.ry ?? a.r ?? 22, { color, width: a.width ?? 2, seed });
      } else if (a.type === 'arrow') {
        const [x1, y1] = this.resolvePt(a.from, a.fromPx);
        const [x2, y2] = this.resolvePt(a.to, a.toPx);
        annotateArrow(ctx, x1, y1, x2, y2, { color, width: a.width ?? 2, seed });
      } else if (a.type === 'text') {
        const [x, y] = this.resolvePt(a.at, a.atPx);
        annotateText(ctx, x, y, a.text, { color, size: a.size ?? 16, align: a.align ?? 'left', font: this.font });
      } else if (a.type === 'callout') {
        const [tx, ty] = this.resolvePt(a.at, a.atPx);
        const [px, py] = this.resolvePt(a.to, a.toPx);
        annotateCallout(ctx, tx, ty, px, py, a.text, { color, size: a.size ?? 16, seed, font: this.font });
      } else if (a.type === 'band') {
        // Highlight over an x-range; spans the full plot height unless `yRange`.
        const x1 = this.resolveX(a.from);
        const x2 = this.resolveX(a.to);
        let yTop = this.plot.y0;
        let yBot = this.plot.y1;
        if (a.yRange && this.project) {
          yTop = this.project(a.from, a.yRange[1])[1];
          yBot = this.project(a.from, a.yRange[0])[1];
        }
        annotateBand(ctx, x1, yTop, x2, yBot, { color, opacity: a.opacity ?? 0.16, label: a.label, size: a.size ?? 14, seed, font: this.font });
      } else if (a.type === 'bracket') {
        const [x1, y1] = this.resolvePt(a.from, a.fromPx);
        const [x2, y2] = this.resolvePt(a.to, a.toPx);
        annotateBracket(ctx, x1, y1, x2, y2, { color, width: a.width ?? 1.8, seed, label: a.label, size: a.size ?? 14, tick: a.tick ?? 7, flip: a.flip, font: this.font });
      }
    }
  }

  paintBackground() {
    // Paper is written with putImageData, which ignores the ctx transform, so
    // render it at the device pixel size (and scale the tooth back to keep its
    // logical frequency).
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    paintPaper(ctx, this.canvas.width, this.canvas.height, { color: this.paper, scale: 0.16 / this.dpr });
    ctx.restore();
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

  // Shared key/legend. `items` = [{ label, color }]. Horizontal centred under
  // the plot by default; pass `orientation: 'vertical'` (+ x/y) for a corner key.
  drawLegend(items, opts = {}) {
    const { ctx, plot } = this;
    const { orientation = 'horizontal', size = 11, swatch = 10 } = opts;
    const swatchAt = (x, y, color) => {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - swatch / 2, swatch, swatch);
      ctx.restore();
    };
    if (orientation === 'vertical') {
      const x = opts.x ?? plot.x1 - 96;
      let y = opts.y ?? plot.y0 + 8;
      for (const it of items) {
        swatchAt(x, y, it.color);
        this.text(it.label, x + swatch + 6, y, { size, align: 'left' });
        y += size + 7;
      }
      return;
    }
    const w = (it) => swatch + 6 + it.label.length * size * 0.56 + 16;
    const total = items.reduce((a, it) => a + w(it), 0);
    let x = opts.x ?? plot.x0 + Math.max(0, (plot.w - total) / 2);
    const y = opts.y ?? plot.y1 + 24;
    for (const it of items) {
      swatchAt(x, y, it.color);
      this.text(it.label, x + swatch + 5, y, { size, align: 'left' });
      x += w(it);
    }
  }

  // Subclasses override.
  render() {}
}
