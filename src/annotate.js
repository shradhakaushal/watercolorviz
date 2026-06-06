// Annotation layer — hand-drawn arrows, circles and text callouts that match
// the watercolor charts. Draw these on a chart's canvas context AFTER it has
// rendered. The killer feature of the aesthetic is that annotations look like
// they belong.

import { inkPath, arrowhead, INK } from './axes.js';
import { hexToRgb } from './palette.js';
import { makeRng } from './rng.js';

const FONT = '"Caveat", "Comic Sans MS", "Segoe Print", cursive';

// A gently wobbly polyline between two points (hand-drawn shaft).
function wobbly(x1, y1, x2, y2, seed) {
  const rng = makeRng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const n = Math.max(2, Math.round(len / 18));
  const nx = -(y2 - y1) / len;
  const ny = (x2 - x1) / len;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : (rng() - 0.5) * 2.2;
    pts.push([x1 + (x2 - x1) * t + nx * off, y1 + (y2 - y1) * t + ny * off]);
  }
  return pts;
}

// A hand-drawn arrow from (x1,y1) to (x2,y2).
export function annotateArrow(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = INK, width = 2, opacity = 0.9, seed = 1 } = opts;
  inkPath(ctx, wobbly(x1, y1, x2, y2, seed), { color, width, opacity, seed, gaps: false });
  arrowhead(ctx, x2, y2, x2 - x1, y2 - y1, { color, size: width * 4.5, opacity, width: width * 0.9 });
}

// A hand-drawn ring around (x,y) — slightly over-drawn, like a marker circle.
export function annotateCircle(ctx, x, y, rx, ry = rx, opts = {}) {
  const { color = INK, width = 2, opacity = 0.9, seed = 1 } = opts;
  const start = -0.35;
  const end = Math.PI * 2 + 0.55; // overshoot the loop
  const n = 44;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = start + (end - start) * (i / n);
    const w = 1 + Math.sin(a * 3 + seed) * 0.025;
    pts.push([x + Math.cos(a) * rx * w, y + Math.sin(a) * ry * w]);
  }
  inkPath(ctx, pts, { color, width, opacity, seed, gaps: false });
}

// A handwriting-font text label.
export function annotateText(ctx, x, y, text, opts = {}) {
  const { color = INK, size = 16, align = 'left', baseline = 'middle', font = FONT, opacity = 1 } = opts;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// A soft translucent highlight band between x1 and x2 (a "highlighter swipe"
// over an x-range), feathered at both edges, with an optional label at the top.
export function annotateBand(ctx, x1, yTop, x2, yBot, opts = {}) {
  const { color = '#c8604f', opacity = 0.16, label, font = FONT, size = 14, seed = 1 } = opts;
  const [r, g, b] = hexToRgb(color);
  const lo = Math.min(x1, x2);
  const hi = Math.max(x1, x2);
  const span = hi - lo || 1;
  const fe = Math.min(14, span * 0.18) / span; // edge feather fraction
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

// A hand-drawn bracket spanning (x1,y1)→(x2,y2) with end ticks and a label,
// for marking a range. `flip` puts the ticks/label on the other side.
export function annotateBracket(ctx, x1, y1, x2, y2, opts = {}) {
  const { color = INK, width = 1.8, seed = 1, label, font = FONT, size = 14, tick = 7, flip = false } = opts;
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  let nx = -(y2 - y1) / len;
  let ny = (x2 - x1) / len;
  if (flip) { nx = -nx; ny = -ny; }
  inkPath(ctx, wobbly(x1, y1, x2, y2, seed), { color, width, seed, gaps: false });
  inkPath(ctx, [[x1, y1], [x1 + nx * tick, y1 + ny * tick]], { color, width, seed: seed + 1, gaps: false });
  inkPath(ctx, [[x2, y2], [x2 + nx * tick, y2 + ny * tick]], { color, width, seed: seed + 2, gaps: false });
  if (label) {
    annotateText(ctx, (x1 + x2) / 2 + nx * (tick + size * 0.7), (y1 + y2) / 2 + ny * (tick + size * 0.7), label, { color, size, font, align: 'center' });
  }
}

// A text callout: label at (tx,ty) with an arrow pointing to (px,py).
export function annotateCallout(ctx, tx, ty, px, py, text, opts = {}) {
  const { color = INK, size = 16, seed = 1, font = FONT } = opts;
  annotateText(ctx, tx, ty, text, { color, size, font, align: tx <= px ? 'left' : 'right' });
  const ax = tx + (tx <= px ? text.length * size * 0.3 : -text.length * size * 0.3);
  annotateArrow(ctx, ax, ty + size * 0.4, px, py, { color, width: 1.8, seed });
}
