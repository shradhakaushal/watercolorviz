// Chart base — the thin scaffold every watercolor chart shares.
//
// Per the spec, charts are thin: they set up the canvas + paper, compute a
// shape with D3, hand it to the paint engine, then draw crisp hand-drawn ink
// chrome (axes/labels) on top. This base owns the boring parts (sizing,
// margins, the plot rect, paper background, text) so each chart only implements
// `render()`.

import { paintPaper } from './paper.js';

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
    paintPaper(this.ctx, this.width, this.height);
  }

  // Crisp text helper (titles, labels) in the chart's font.
  text(str, x, y, opts = {}) {
    const {
      size = 15,
      align = 'center',
      baseline = 'middle',
      color = '#3b332b',
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

  // Subclasses override.
  render() {}
}
