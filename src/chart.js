// Chart base — the thin scaffold every watercolor chart shares.
//
// Per the spec, charts are thin: they set up the canvas + paper, compute a
// shape with D3, hand it to the paint engine, then draw crisp hand-drawn ink
// chrome (axes/labels) on top. This base owns the boring parts (sizing,
// margins, the plot rect, paper background, text) so each chart only implements
// `render()`.

import { paintPaper } from './paper.js';
import { setRenderDpr, clearMarkCache } from './watercolor.js';
import { inkLine, arrowhead, INK } from './axes.js';
import { colorAt } from './palette.js';
import { annotateArrow, annotateCircle, annotateText, annotateCallout, annotateBand, annotateBracket } from './annotate.js';

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

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export class Chart {
  constructor(el, config = {}) {
    this.config = config;

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

    // Responsive: `width: '100%'` or `responsive: true` fits the host element
    // and re-fits on resize (see _setupResize). Otherwise fixed dimensions.
    this._host = typeof target.getContext === 'function' ? target.parentNode : target;
    this._responsive = config.width === '100%' || config.responsive === true;
    let width = config.width === '100%' ? null : config.width;
    let height = config.height;
    if (this._responsive) {
      const hostW = this._host && this._host.clientWidth;
      width = Math.max(160, hostW || 460);
      height = config.height || Math.round(width * (config.aspect || 0.6));
    }
    width = width || 460;
    height = height || 300;
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
    this._interactiveMarks = [];
    this._selectionProgress = new Map();
    this._hoverTarget = null;
    this._hoverRaf = null;
    this._hoverLastTs = null;
    this._loadRaf = null;
    this._animationStart = this.now();
    this._interactionInstalled = false;
    this._pointer = null; // last hover position, in LOGICAL coords (for tooltips)
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

    this._setupAccessibility();
    if (config.data) this.draw();
    this._setupResize();
  }

  // One full repaint: the chart, then annotations, then the tooltip overlay.
  // EVERY redraw path (initial, load animation, hover, resize) goes through
  // here so annotations and tooltips survive re-renders.
  draw() {
    this.render();
    this.drawAnnotations();
    this.drawTooltip();
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
    // Paper is a per-pixel noise field — by far the most expensive thing in a
    // frame. It only depends on the backing size, dpr and paper colour, none of
    // which change across the many redraws of an animation, so paint it ONCE to
    // an offscreen and just blit it each frame. (The cache invalidates itself
    // when the backing size changes, e.g. on resize.) Paper is written with
    // putImageData, which ignores the ctx transform, so it lives at device
    // pixel size (with the tooth scaled back to keep its logical frequency).
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    let cache = this._paperCache;
    if (!cache || cache.w !== cw || cache.h !== ch || cache.color !== this.paper) {
      const oc = document.createElement('canvas');
      oc.width = cw;
      oc.height = ch;
      paintPaper(oc.getContext('2d'), cw, ch, { color: this.paper, scale: 0.16 / this.dpr });
      cache = this._paperCache = { oc, w: cw, h: ch, color: this.paper };
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(cache.oc, 0, 0);
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

  setInteractiveMarks(marks) {
    this._interactiveMarks = marks;
    if (this.config.interactive === false || this.config.selection === false) return;
    if (this._interactionInstalled || typeof this.canvas.addEventListener !== 'function') return;

    const hitTest = (event) => {
      const box = this.canvas.getBoundingClientRect();
      if (!box.width || !box.height) return null;
      // Marks are in LOGICAL coords; map the pointer to logical px (CSS box maps
      // to this.width/height regardless of devicePixelRatio).
      const x = (event.clientX - box.left) * (this.width / box.width);
      const y = (event.clientY - box.top) * (this.height / box.height);
      this._pointer = { x, y };
      for (let i = this._interactiveMarks.length - 1; i >= 0; i--) {
        const mark = this._interactiveMarks[i];
        if (mark.points && pointInPolygon(x, y, mark.points)) {
          return mark.index;
        }
        if (mark.cx != null && mark.cy != null && mark.r != null) {
          const pad = mark.hitPad ?? 4;
          if (Math.hypot(x - mark.cx, y - mark.cy) <= mark.r + pad) {
            return mark.index;
          }
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
      this.draw();
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

      this.draw();
      if (active) {
        this._hoverRaf = raf(tick);
      } else {
        this._hoverRaf = null;
        this._hoverLastTs = null;
      }
    };

    this._hoverRaf = raf(tick);
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

  // Tooltip overlay: when a mark is hovered, show its `label` near the pointer.
  // Disable with `tooltip: false`. Marks opt in by carrying a `label` string.
  drawTooltip() {
    if (this.config.tooltip === false) return;
    if (this._hoverTarget == null || !this._pointer) return;
    const mark = this._interactiveMarks.find((m) => m.index === this._hoverTarget);
    if (!mark || !mark.label) return;

    const ctx = this.ctx;
    const lines = String(mark.label).split('\n');
    const size = 13;
    const lh = size + 4;
    const pad = 8;
    const sw = mark.color ? 12 : 0;
    ctx.save();
    ctx.font = `${size}px ${this.font}`;
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = textW + pad * 2 + sw;
    const bh = lines.length * lh + pad * 2 - 4;
    let bx = this._pointer.x + 14;
    let by = this._pointer.y + 14;
    if (bx + bw > this.width) bx = this._pointer.x - bw - 14;
    if (by + bh > this.height) by = this._pointer.y - bh - 14;
    if (bx < 2) bx = 2;
    if (by < 2) by = 2;

    roundRectPath(ctx, bx, by, bw, bh, 5);
    ctx.fillStyle = 'rgba(43, 38, 31, 0.92)';
    ctx.fill();
    if (sw) {
      ctx.fillStyle = mark.color;
      roundRectPath(ctx, bx + pad, by + pad + 1, 9, 9, 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fbf3e7';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, bx + pad + sw, by + pad + lh / 2 - 2 + i * lh));
    ctx.restore();
  }

  _setupAccessibility() {
    const c = this.canvas;
    if (!c || typeof c.setAttribute !== 'function') return;
    c.setAttribute('role', 'img');
    c.setAttribute('aria-label', this.ariaLabel());
  }

  // A plain-text summary of the chart for screen readers.
  ariaLabel() {
    if (this.config.ariaLabel) return this.config.ariaLabel;
    const parts = [];
    if (this.config.title) parts.push(this.config.title);
    const d = this.config.data;
    if (d && Array.isArray(d.labels) && Array.isArray(d.values)) {
      parts.push(d.labels.map((l, i) => `${l}: ${d.values[i]}`).join(', '));
    }
    return parts.join('. ') || 'watercolor chart';
  }

  // Responsive: re-fit to the host element's width on resize.
  _setupResize() {
    if (!this._responsive || !this._host) return;
    if (typeof ResizeObserver !== 'function') return;
    this._ro = new ResizeObserver(() => {
      const hostW = this._host.clientWidth;
      if (!hostW || Math.abs(hostW - this.width) < 2) return;
      const h = this.config.height || Math.round(hostW * (this.config.aspect || 0.6));
      this.resize(hostW, h);
    });
    this._ro.observe(this._host);
  }

  // Resize the canvas and repaint at new logical dimensions.
  resize(width, height) {
    this.width = width;
    this.height = height;
    const dpr = this.dpr;
    this.canvas.width = Math.round(width * dpr); // resets the 2D context state
    this.canvas.height = Math.round(height * dpr);
    if (this.canvas.style) {
      this.canvas.style.width = `${width}px`;
      this.canvas.style.height = `${height}px`;
    }
    this.ctx.scale(dpr, dpr);
    setRenderDpr(dpr);
    const m = this.margin;
    this.plot = {
      x0: m.left, y0: m.top,
      x1: width - m.right, y1: height - m.bottom,
      w: width - m.left - m.right, h: height - m.top - m.bottom,
    };
    clearMarkCache(); // geometry changed → old cached marks are stale
    this._animationStart = this.now();
    if (this.config.data) this.draw();
  }

  // Detach observers/listeners (call when removing a chart).
  destroy() {
    if (this._ro) this._ro.disconnect();
    this._ro = null;
  }

  // Subclasses override.
  render() {}
}
