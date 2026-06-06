// Chart base — the thin scaffold every watercolor chart shares.
//
// Per the spec, charts are thin: they set up the canvas + paper, compute a
// shape with D3, hand it to the paint engine, then draw crisp hand-drawn ink
// chrome (axes/labels) on top. This base owns the boring parts (sizing,
// margins, the plot rect, paper background, text) so each chart only implements
// `render()`.

import { paintPaper } from './paper.js';
import { inkLine, arrowhead } from './axes.js';

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const crosses = yi > y !== yj > y;
    if (!crosses) continue;
    const atX = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (x < atX) inside = !inside;
  }
  return inside;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

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
    this._interactiveMarks = [];
    this._selectionProgress = new Map();
    this._hoverTarget = null;
    this._hoverRaf = null;
    this._hoverLastTs = null;
    this._loadRaf = null;
    this._animationStart = this.now();
    this._interactionInstalled = false;
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

  now() {
    if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
      return performance.now();
    }
    return Date.now();
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

  // L-shaped hand-drawn ink axes with little arrowheads (x along the bottom,
  // y up the left). Shared by the rectangular-wash charts.
  drawAxisLines() {
    const { ctx, plot, seed } = this;
    inkLine(ctx, plot.x0, plot.y1, plot.x1 + 8, plot.y1, { seed: seed + 1 });
    arrowhead(ctx, plot.x1 + 12, plot.y1, 1, 0);
    inkLine(ctx, plot.x0, plot.y1, plot.x0, plot.y0 - 8, { seed: seed + 2 });
    arrowhead(ctx, plot.x0, plot.y0 - 12, 0, -1);
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

  setInteractiveMarks(marks) {
    this._interactiveMarks = marks;
    if (this.config.interactive === false || this.config.selection === false) return;
    if (this._interactionInstalled || typeof this.canvas.addEventListener !== 'function') return;

    const hitTest = (event) => {
      const box = this.canvas.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      const x = (event.clientX - box.left) * (this.canvas.width / box.width);
      const y = (event.clientY - box.top) * (this.canvas.height / box.height);
      for (let i = this._interactiveMarks.length - 1; i >= 0; i--) {
        const mark = this._interactiveMarks[i];
        if (mark.points && pointInPolygon(x, y, mark.points)) {
          return mark.index;
        }
        const pad = mark.hitPad ?? 4;
        if (mark.x == null || mark.y == null || mark.w == null || mark.h == null) continue;
        if (
          x >= mark.x - pad &&
          x <= mark.x + mark.w + pad &&
          y >= mark.y - pad &&
          y <= mark.y + mark.h + pad
        ) {
          return mark.index;
        }
      }
      return null;
    };

    const setTarget = (next) => {
      if (next === this._hoverTarget) return;
      this._hoverTarget = next;
      this.canvas.style.cursor = next == null ? '' : 'pointer';
      this.startSelectionAnimation();
    };

    this.canvas.addEventListener('pointermove', (event) => setTarget(hitTest(event)));
    this.canvas.addEventListener('pointerleave', () => setTarget(null));
    this._interactionInstalled = true;
  }

  selectionProgress(index) {
    return this._selectionProgress.get(index) || 0;
  }

  loadProgress(index = 0) {
    if (this.config.animation === false || this.config.animate === false) return 1;
    const duration = this.config.animationDuration ?? 850;
    const stagger = this.config.animationStagger ?? 65;
    const delay = this.config.animationDelay ?? 0;
    const raw = (this.now() - this._animationStart - delay - index * stagger) / duration;
    return easeOutCubic(clamp01(raw));
  }

  scheduleLoadAnimation(markCount = 1) {
    if (this.config.animation === false || this.config.animate === false) return;
    if (typeof requestAnimationFrame !== 'function') return;

    const duration = this.config.animationDuration ?? 850;
    const stagger = this.config.animationStagger ?? 65;
    const delay = this.config.animationDelay ?? 0;
    const total = delay + duration + Math.max(0, markCount - 1) * stagger;
    if (this.now() - this._animationStart >= total || this._loadRaf) return;

    this._loadRaf = requestAnimationFrame(() => {
      this._loadRaf = null;
      this.render();
    });
  }

  startSelectionAnimation() {
    if (this._hoverRaf) return;
    const raf = typeof requestAnimationFrame === 'function'
      ? requestAnimationFrame
      : (fn) => setTimeout(() => fn(performance.now()), 16);

    const tick = (ts) => {
      const previous = this._hoverLastTs ?? ts;
      this._hoverLastTs = ts;
      const dt = Math.min(48, ts - previous) / 1000;
      const speed = this.config.selectionSpeed ?? 10;
      const blend = 1 - Math.exp(-speed * dt);
      const live = new Set(this._interactiveMarks.map((mark) => mark.index));
      for (const index of this._selectionProgress.keys()) live.add(index);

      let active = false;
      for (const index of live) {
        const target = index === this._hoverTarget ? 1 : 0;
        const current = this._selectionProgress.get(index) || 0;
        let next = current + (target - current) * blend;
        if (Math.abs(next - target) < 0.01) next = target;
        if (next > 0) this._selectionProgress.set(index, next);
        else this._selectionProgress.delete(index);
        if (next !== target) active = true;
      }

      this.render();
      if (active) {
        this._hoverRaf = raf(tick);
      } else {
        this._hoverRaf = null;
        this._hoverLastTs = null;
      }
    };

    this._hoverRaf = raf(tick);
  }

  // Subclasses override.
  render() {}
}
