// Annotation layer — sketchy, technical, roughViz/rough.js-style marks
// (NOT watercolor): crisp double-stroke bowed lines, sketchy ellipses, clean
// arrowheads. Solid colour, uniform thin width — they read as deliberate
// callouts over the painterly chart, not part of the paint.

import { hexToRgb } from './palette.js';
import { makeRng } from './rng.js';

const FONT = '"Caveat", "Comic Sans MS", "Segoe Print", cursive';
const ACCENT = '#c8543b';

// --- rough.js-style primitives --------------------------------------------

// A sketchy line: a couple of slightly-bowed passes between the endpoints, with
// small randomized perturbation — the hallmark "drawn twice by hand" look.
function roughLine(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = ACCENT, width = 1.7, roughness = 1.3, seed = 1, passes = 2 } = opts;
  const rng = makeRng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const r = (k = 1) => (rng() * 2 - 1) * roughness * k;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let p = 0; p < passes; p++) {
    const bow = p === 0 ? 1 : -1; // bow the two passes opposite ways
    const sx = x1 + r(0.5);
    const sy = y1 + r(0.5);
    const ex = x2 + r(0.5);
    const ey = y2 + r(0.5);
    const c1x = x1 + (x2 - x1) * 0.32 + nx * (r() + bow * roughness * 0.6);
    const c1y = y1 + (y2 - y1) * 0.32 + ny * (r() + bow * roughness * 0.6);
    const c2x = x1 + (x2 - x1) * 0.68 + nx * (r() - bow * roughness * 0.6);
    const c2y = y1 + (y2 - y1) * 0.68 + ny * (r() - bow * roughness * 0.6);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}

// A sketchy ellipse: 1–2 perturbed loops with a little overshoot so the ends
// cross, like a marker ring.
function roughEllipse(ctx, cx, cy, rx, ry, opts = {}) {
  const { color = ACCENT, width = 1.7, roughness = 1.6, seed = 1, passes = 2 } = opts;
  const rng = makeRng(seed);
  const r = () => (rng() * 2 - 1) * roughness;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const n = 20;
  for (let p = 0; p < passes; p++) {
    const start = rng() * 0.6;
    ctx.beginPath();
    for (let i = 0; i <= n + 3; i++) {
      // overshoot by 3 steps so the loop closes past its start
      const a = start + (i / n) * Math.PI * 2;
      const x = cx + Math.cos(a) * (rx + r());
      const y = cy + Math.sin(a) * (ry + r());
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

function roughArrowHead(ctx, x, y, dx, dy, opts = {}) {
  const { color = ACCENT, size = 10, width = 1.7, seed = 1 } = opts;
  const a = Math.atan2(dy, dx);
  const spread = 0.42;
  roughLine(ctx, x, y, x - size * Math.cos(a - spread), y - size * Math.sin(a - spread), { color, width, seed, roughness: 0.8, passes: 1 });
  roughLine(ctx, x, y, x - size * Math.cos(a + spread), y - size * Math.sin(a + spread), { color, width, seed: seed + 7, roughness: 0.8, passes: 1 });
}

// --- public annotations ----------------------------------------------------

export function annotateArrow(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = ACCENT, width = 1.8, seed = 1 } = opts;
  roughLine(ctx, x1, y1, x2, y2, { color, width, seed });
  roughArrowHead(ctx, x2, y2, x2 - x1, y2 - y1, { color, width, size: 6 + width * 3, seed: seed + 3 });
}

export function annotateCircle(ctx, x, y, rx, ry = rx, opts = {}) {
  const { color = ACCENT, width = 1.8, seed = 1 } = opts;
  roughEllipse(ctx, x, y, rx, ry, { color, width, seed });
}

export function annotateText(ctx, x, y, text, opts = {}) {
  const { color = ACCENT, size = 16, align = 'left', baseline = 'middle', font = FONT, opacity = 1, weight = 600 } = opts;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Soft translucent highlight band between x1 and x2, feathered edges + label.
export function annotateBand(ctx, x1, yTop, x2, yBot, opts = {}) {
  const { color = ACCENT, opacity = 0.16, label, font = FONT, size = 14, seed = 1 } = opts;
  const [r, g, b] = hexToRgb(color);
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const span = hi - lo || 1;
  const fe = Math.min(14, span * 0.18) / span;
  ctx.save();
  const grad = ctx.createLinearGradient(lo, 0, hi, 0);
  grad.addColorStop(0, `rgba(${r},${g},${b},0)`);
  grad.addColorStop(fe, `rgba(${r},${g},${b},${opacity})`);
  grad.addColorStop(1 - fe, `rgba(${r},${g},${b},${opacity})`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(lo, yTop, span, yBot - yTop);
  ctx.restore();
  if (label) annotateText(ctx, (lo + hi) / 2, yTop + size * 0.9, label, { color, size, font, align: 'center' });
}

// A sketchy bracket spanning (x1,y1)→(x2,y2) with end ticks + a label.
export function annotateBracket(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = ACCENT, width = 1.7, seed = 1, label, font = FONT, size = 14, tick = 7, flip = false } = opts;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / len;
  let ny = (x2 - x1) / len;
  if (flip) { nx = -nx; ny = -ny; }
  roughLine(ctx, x1, y1, x2, y2, { color, width, seed });
  roughLine(ctx, x1, y1, x1 + nx * tick, y1 + ny * tick, { color, width, seed: seed + 1, passes: 1 });
  roughLine(ctx, x2, y2, x2 + nx * tick, y2 + ny * tick, { color, width, seed: seed + 2, passes: 1 });
  if (label) {
    annotateText(ctx, (x1 + x2) / 2 + nx * (tick + size * 0.7), (y1 + y2) / 2 + ny * (tick + size * 0.7), label, { color, size, font, align: 'center' });
  }
}

// A text callout: label at (tx,ty) with an arrow pointing to (px,py).
export function annotateCallout(ctx, tx, ty, px, py, text, opts = {}) {
  const { color = ACCENT, size = 16, seed = 1, font = FONT } = opts;
  const align = tx <= px ? 'left' : 'right';
  annotateText(ctx, tx, ty, text, { color, size, font, align });
  const ax = tx + (align === 'left' ? text.length * size * 0.32 + 4 : -(text.length * size * 0.32 + 4));
  annotateArrow(ctx, ax, ty + size * 0.35, px, py, { color, width: 1.7, seed });
}
