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
    this._computeLayout();

    this._setupAccessibility();
    if (config.data) this.draw();
    this._setupResize();
  }

  // Derive the margin + plot rectangle from the current config and dimensions.
  // Shared by the constructor, resize() and update() so the layout stays in one
  // place (a chart that gains/loses a legend on update reserves space correctly).
  _computeLayout() {
    this.margin = Object.assign(
      { top: 46, right: 30, bottom: 44, left: 48 },
      this.config.margin,
    );
    // Subclasses that draw an auto legend below the plot (multi-series bar/line)
    // reserve extra bottom margin so the legend clears the axis labels.
    const reserve = this.legendReserve();
    if (reserve && !(this.config.margin && this.config.margin.bottom != null)) {
      this.margin.bottom += reserve;
    }
    const m = this.margin;
    this.plot = {
      x0: m.left,
      y0: m.top,
      x1: this.width - m.right,
      y1: this.height - m.bottom,
      w: this.width - m.left - m.right,
      h: this.height - m.top - m.bottom,
    };
  }

  // Re-render in place with new data and/or options — the supported way to
  // change a live chart without tearing it down. Shallow-merges into config
  // (pass a whole `data` object to replace it), recomputes layout, restarts the
  // load animation and repaints. Returns `this` for chaining.
  update(config = {}) {
    if (this._destroyed) return this;
    this.config = { ...this.config, ...config };
    // Re-derive config-dependent state that the constructor set up.
    this.ink = this.config.ink || INK;
    const prevPaper = this.paper;
    this.paper = this.config.paper;
    if (this.config.seed != null) this.seed = this.config.seed;
    this._computeLayout();
    // Only drop the (expensive, per-pixel) paper cache when the paper colour
    // actually changed; paintBackground also rebuilds it on a size change.
    // Nuking it on EVERY update made live tweaks (sliders, recolour) sluggish.
    if (this.paper !== prevPaper) this._paperCache = null;
    this._selectionProgress.clear();
    this._hoverTarget = null;
    this._pointer = null;
    this._animationStart = this.now();
    this._setupAccessibility();
    this.draw();
    return this;
  }

  // One full repaint: the chart, then annotations, then the tooltip overlay.
  // EVERY redraw path (initial, load animation, hover, resize) goes through
  // here so annotations and tooltips survive re-renders.
  draw() {
    if (this._destroyed) return;
    // Mark resolution is a module-level default in the paint engine; set it to
    // THIS chart's dpr before every render so multiple charts (potentially at
    // different devicePixelRatios) don't read each other's value.
    setRenderDpr(this.dpr);
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
  // Extra bottom margin to reserve for an auto legend. Base charts reserve
  // none; multi-series bar/line override this (see their legendReserve()).
  legendReserve() {
    return 0;
  }

  // The hand-drawn axis spines + arrowheads, drawn crisply over the paint.
  // Configurable:
  //   axes: false                 → draw no spines at all
  //   xAxis / yAxis: false        → hide just that spine
  //   xAxis: { position: 'top' }  → x spine along the top instead of bottom
  //   yAxis: { position: 'right' }→ y spine along the right instead of left
  //   axisArrows: false           → spines without the arrowheads
  drawAxisLines() {
    const { ctx, plot, seed, ink, config } = this;
    if (config.axes === false) return;
    const arrows = config.axisArrows !== false;
    if (config.xAxis !== false) {
      const pos = (config.xAxis && config.xAxis.position) || 'bottom';
      const ay = pos === 'top' ? plot.y0 : plot.y1;
      inkLine(ctx, plot.x0, ay, plot.x1 + 8, ay, { seed: seed + 1, color: ink });
      if (arrows) arrowhead(ctx, plot.x1 + 12, ay, 1, 0, { color: ink });
    }
    if (config.yAxis !== false) {
      const pos = (config.yAxis && config.yAxis.position) || 'left';
      const ax = pos === 'right' ? plot.x1 : plot.x0;
      inkLine(ctx, ax, plot.y1, ax, plot.y0 - 8, { seed: seed + 2, color: ink });
      if (arrows) arrowhead(ctx, ax, plot.y0 - 12, 0, -1, { color: ink });
    }
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

  // Paint just the paper, title and a faint centred message. Charts call this
  // when there is nothing to plot, so empty/degenerate data degrades to a clear
  // frame instead of throwing a cryptic canvas error.
  emptyState(message = 'No data') {
    this.paintBackground();
    if (this.config.title) this.text(this.config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    this.text(message, this.plot.x0 + this.plot.w / 2, this.plot.y0 + this.plot.h / 2, { size: 15, opacity: 0.45 });
    this.setInteractiveMarks([]);
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

  // Hit-test a pointer event against the marks (in LOGICAL coords) and record
  // the pointer position for the tooltip. Returns the hit mark's index or null.
  _hitTest(event) {
    const box = this.canvas.getBoundingClientRect();
    if (!box.width || !box.height) return null;
    // The CSS box maps to this.width/height regardless of devicePixelRatio.
    const x = (event.clientX - box.left) * (this.width / box.width);
    const y = (event.clientY - box.top) * (this.height / box.height);
    this._pointer = { x, y };
    for (let i = this._interactiveMarks.length - 1; i >= 0; i--) {
      const mark = this._interactiveMarks[i];
      if (mark.points && pointInPolygon(x, y, mark.points)) return mark.index;
      if (mark.cx != null && mark.cy != null && mark.r != null) {
        const pad = mark.hitPad ?? 4;
        if (Math.hypot(x - mark.cx, y - mark.cy) <= mark.r + pad) return mark.index;
      }
      const pad = mark.hitPad ?? 4;
      if (mark.x == null || mark.y == null || mark.w == null || mark.h == null) continue;
      if (x >= mark.x - pad && x <= mark.x + mark.w + pad && y >= mark.y - pad && y <= mark.y + mark.h + pad) {
        return mark.index;
      }
    }
    return null;
  }

  // A representative point for a mark (used to place the tooltip for keyboard
  // navigation, where there is no pointer position).
  _markCenter(mark) {
    if (mark.cx != null && mark.cy != null) return { x: mark.cx, y: mark.cy };
    if (mark.x != null && mark.w != null) return { x: mark.x + mark.w / 2, y: mark.y + mark.h / 2 };
    if (mark.points && mark.points.length) {
      let sx = 0; let sy = 0;
      for (const p of mark.points) { sx += p[0]; sy += p[1]; }
      return { x: sx / mark.points.length, y: sy / mark.points.length };
    }
    return { x: this.plot.x0 + this.plot.w / 2, y: this.plot.y0 + this.plot.h / 2 };
  }

  // The public shape passed to onHover/onClick: the mark's index plus its label
  // and colour. Consumers map `index` back to their own datum.
  _markPayload(mark) {
    return mark ? { index: mark.index, label: mark.label, color: mark.color } : null;
  }

  _setHoverTarget(next) {
    if (next === this._hoverTarget) return;
    this._hoverTarget = next;
    if (this.canvas.style) this.canvas.style.cursor = next == null ? '' : 'pointer';
    const mark = next == null ? null : this._interactiveMarks.find((m) => m.index === next);
    // Announce the focused datum to assistive tech (restore the summary when
    // nothing is focused).
    if (typeof this.canvas.setAttribute === 'function') {
      this.canvas.setAttribute('aria-label', mark && mark.label ? String(mark.label) : this.ariaLabel());
    }
    if (typeof this.config.onHover === 'function') this.config.onHover(this._markPayload(mark));
    this.startSelectionAnimation();
  }

  // Arrow keys move the highlight across marks; Home/End jump to the ends;
  // Escape clears. Gives keyboard users access to the same data the tooltip shows.
  _handleKey(e) {
    const marks = this._interactiveMarks;
    if (!marks.length) return;
    const order = marks.map((m) => m.index);
    let cur = order.indexOf(this._hoverTarget);
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': cur = cur < 0 ? 0 : (cur + 1) % order.length; break;
      case 'ArrowLeft': case 'ArrowUp': cur = cur < 0 ? order.length - 1 : (cur - 1 + order.length) % order.length; break;
      case 'Home': cur = 0; break;
      case 'End': cur = order.length - 1; break;
      case 'Escape': this._setHoverTarget(null); return;
      case 'Enter': case ' ': {
        // Activate the focused mark (keyboard equivalent of a click).
        if (this._hoverTarget != null && typeof this.config.onClick === 'function') {
          e.preventDefault();
          this.config.onClick(this._markPayload(marks.find((m) => m.index === this._hoverTarget)), e);
        }
        return;
      }
      default: return;
    }
    e.preventDefault();
    const idx = order[cur];
    this._pointer = this._markCenter(marks.find((m) => m.index === idx));
    this._setHoverTarget(idx);
  }

  setInteractiveMarks(marks) {
    this._interactiveMarks = marks;
    if (this.config.interactive === false || this.config.selection === false) return;
    if (this._interactionInstalled || typeof this.canvas.addEventListener !== 'function') return;

    // Keep handler references so destroy() can remove them (avoids leaks when a
    // chart is torn down in an SPA).
    this._onPointerMove = (event) => this._setHoverTarget(this._hitTest(event));
    this._onPointerLeave = () => this._setHoverTarget(null);
    // Click → onClick(payload, event) for the mark under the pointer.
    this._onClick = (event) => {
      if (typeof this.config.onClick !== 'function') return;
      const idx = this._hitTest(event);
      if (idx == null) return;
      this.config.onClick(this._markPayload(this._interactiveMarks.find((m) => m.index === idx)), event);
    };
    this.canvas.addEventListener('pointermove', this._onPointerMove);
    this.canvas.addEventListener('pointerleave', this._onPointerLeave);
    this.canvas.addEventListener('click', this._onClick);

    // Keyboard access: make the canvas focusable and navigate marks with the
    // arrow keys (disable with `keyboard: false`).
    if (this.config.keyboard !== false && typeof this.canvas.setAttribute === 'function') {
      this.canvas.setAttribute('tabindex', '0');
      this._onKeyDown = (e) => this._handleKey(e);
      this._onBlur = () => this._setHoverTarget(null);
      this.canvas.addEventListener('keydown', this._onKeyDown);
      this.canvas.addEventListener('blur', this._onBlur);
    }
    this._interactionInstalled = true;
  }

  selectionProgress(index) {
    return this._selectionProgress.get(index) || 0;
  }

  // Animations are suppressed when disabled in config OR when the user's OS
  // signals prefers-reduced-motion (an accessibility requirement).
  _reducedMotion() {
    if (this.config.animation === false || this.config.animate === false) return true;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  loadProgress(index = 0) {
    if (this._reducedMotion()) return 1;
    const duration = this.config.animationDuration ?? 850;
    const stagger = this.config.animationStagger ?? 65;
    const delay = this.config.animationDelay ?? 0;
    const raw = (this.now() - this._animationStart - delay - index * stagger) / duration;
    return easeOutCubic(clamp01(raw));
  }

  scheduleLoadAnimation(markCount = 1) {
    if (this._reducedMotion()) return;
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
    if (this._reducedMotion()) {
      // No tween: snap the selection to its target and repaint once.
      const live = new Set(this._interactiveMarks.map((m) => m.index));
      for (const i of this._selectionProgress.keys()) live.add(i);
      for (const i of live) {
        if (i === this._hoverTarget) this._selectionProgress.set(i, 1);
        else this._selectionProgress.delete(i);
      }
      this.draw();
      return;
    }
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
  // Configurable via config: `legend: false` hides it; `legendGap` sets the gap
  // below the axis labels; `legendX`/`legendY` pin an exact position;
  // `legendOrientation: 'vertical'`.
  drawLegend(items, opts = {}) {
    const { ctx, plot, config } = this;
    if (config.legend === false) return;
    const orientation = opts.orientation || config.legendOrientation || 'horizontal';
    const size = opts.size ?? 11;
    const swatch = opts.swatch ?? 10;
    const swatchAt = (x, y, color) => {
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = color;
      ctx.fillRect(x, y - swatch / 2, swatch, swatch);
      ctx.restore();
    };
    if (orientation === 'vertical') {
      const x = opts.x ?? config.legendX ?? plot.x1 - 96;
      let y = opts.y ?? config.legendY ?? plot.y0 + 8;
      for (const it of items) {
        swatchAt(x, y, it.color);
        this.text(it.label, x + swatch + 6, y, { size, align: 'left' });
        y += size + 7;
      }
      return;
    }
    const w = (it) => swatch + 6 + it.label.length * size * 0.56 + 16;
    const total = items.reduce((a, it) => a + w(it), 0);
    let x = opts.x ?? config.legendX ?? plot.x0 + Math.max(0, (plot.w - total) / 2);
    // Sit clear below the axis labels (which live ~17px under the baseline),
    // with a configurable gap; the matching bottom margin is reserved up front.
    const gap = opts.gap ?? config.legendGap ?? 40;
    const y = opts.y ?? config.legendY ?? plot.y1 + gap;
    for (const it of items) {
      swatchAt(x, y, it.color);
      this.text(it.label, x + swatch + 5, y, { size, align: 'left' });
      x += w(it);
    }
  }

  // Tooltip overlay: when a mark is hovered, show its `label` near the pointer.
  // Disable with `tooltip: false`. Customise the text with a `tooltipFormat`
  // function `(payload) => string` (may return multi-line text or '' to hide).
  // Marks opt in by carrying a `label` string.
  drawTooltip() {
    if (this.config.tooltip === false) return;
    if (this._hoverTarget == null || !this._pointer) return;
    const mark = this._interactiveMarks.find((m) => m.index === this._hoverTarget);
    if (!mark) return;
    const text = typeof this.config.tooltipFormat === 'function'
      ? this.config.tooltipFormat(this._markPayload(mark))
      : mark.label;
    if (text == null || text === '') return;

    const ctx = this.ctx;
    const lines = String(text).split('\n');
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
    const d = this.config.data || {};
    const type = this.constructor.name.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
    const parts = [];
    if (this.config.title) parts.push(this.config.title);
    if (Array.isArray(d.labels) && Array.isArray(d.values) && typeof d.values[0] === 'number') {
      // Categorical charts read out their values.
      parts.push(d.labels.map((l, i) => `${l}: ${d.values[i]}`).join(', '));
    } else {
      // Every other chart gets at least a type + item-count summary so screen
      // readers announce something useful (override with `ariaLabel`).
      const n = (Array.isArray(d.x) && d.x.length)
        || (Array.isArray(d.values) && d.values.length)
        || (Array.isArray(d.studies) && d.studies.length)
        || (Array.isArray(d.nodes) && d.nodes.length)
        || (Array.isArray(d.days) && d.days.length)
        || (Array.isArray(d.names) && d.names.length)
        || (Array.isArray(d.questions) && d.questions.length)
        || (d.series && (Array.isArray(d.series) ? d.series.length : Object.keys(d.series).length))
        || 0;
      parts.push(n ? `${type} chart, ${n} ${n === 1 ? 'item' : 'items'}` : `${type} chart`);
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
    this._computeLayout();
    // Old-size marks become stale but are keyed by geometry, so they simply
    // stop being hit and age out of the LRU — no global wipe (which would also
    // evict every OTHER chart's cached marks on the page). The paper cache
    // self-invalidates on the size change in paintBackground().
    this._animationStart = this.now();
    if (this.config.data) this.draw();
  }

  // Detach observers, listeners and pending animation frames (call when
  // removing a chart). After destroy(), draw() is a no-op.
  destroy() {
    this._destroyed = true;
    if (this._ro) this._ro.disconnect();
    this._ro = null;
    if (this._loadRaf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._loadRaf);
    if (this._hoverRaf != null && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this._hoverRaf);
    this._loadRaf = null;
    this._hoverRaf = null;
    if (this._onPointerMove) this.canvas.removeEventListener('pointermove', this._onPointerMove);
    if (this._onPointerLeave) this.canvas.removeEventListener('pointerleave', this._onPointerLeave);
    if (this._onClick) this.canvas.removeEventListener('click', this._onClick);
    if (this._onKeyDown) this.canvas.removeEventListener('keydown', this._onKeyDown);
    if (this._onFocus) this.canvas.removeEventListener('focus', this._onFocus);
    if (this._onBlur) this.canvas.removeEventListener('blur', this._onBlur);
  }

  // Export the rendered chart as a data URL (default PNG). A thin wrapper over
  // the backing canvas — handy for "download" / embedding in reports.
  toDataURL(type = 'image/png', quality) {
    return this.canvas.toDataURL(type, quality);
  }

  // Export as a Blob via callback (browser canvases only).
  toBlob(callback, type = 'image/png', quality) {
    return this.canvas.toBlob(callback, type, quality);
  }

  // Subclasses override.
  render() {}
}
