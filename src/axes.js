// Hand-drawn ink chrome for watercolor charts.
//
// Axes, ticks and arrowheads are NOT crisp SVG-style rules — that fights the
// painterly fill. They are slightly wobbly ink lines (a light per-point jitter
// off the straight path) in the same warm dark ink as the mark outlines,
// drawn crisply ON TOP of the paint so the data stays legible.

import { makeRng } from './rng.js';
import { hexToRgb } from './palette.js';
import { fbm } from './noise.js';

export const INK = '#3b332b'; // warm dark ink, shared with the mark outline

// A slightly wobbly ink line (x1,y1)→(x2,y2): split into segments and nudge the
// interior points off the straight path so it reads as hand-drawn. Endpoints
// stay put so lines still meet cleanly at the axis corner.
export function inkLine(ctx, x1, y1, x2, y2, opts = {}) {
  const {
    color = INK,
    width = 1.6,
    opacity = 0.92,
    jitter = 1.0,
    seed = 1,
  } = opts;
  const rng = makeRng(seed);
  const len = Math.hypot(x2 - x1, y2 - y1) || 1;
  const n = Math.max(2, Math.round(len / 16));
  const nx = -(y2 - y1) / len; // unit normal
  const ny = (x2 - x1) / len;
  const [r, g, b] = hexToRgb(color);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const off = i === 0 || i === n ? 0 : (rng() - 0.5) * 2 * jitter;
    const px = x1 + (x2 - x1) * t + nx * off;
    const py = y1 + (y2 - y1) * t + ny * off;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.stroke();
  ctx.restore();
}

// A line-and-wash ink stroke along an open polyline (`points` = [[x,y], ...]) —
// the same fountain-pen feel as the mark outline: width swells, uneven
// darkness, occasional lifts/gaps. Used for area tops, ridgeline ridges, and
// (later) line charts. Pass `closed: true` to ink a full loop.
export function inkPath(ctx, points, opts = {}) {
  const { color = INK, width = 1.7, opacity = 0.82, seed = 1, closed = false, gaps = true } = opts;
  const [r, g, b] = hexToRgb(color);
  const n = points.length;
  const last = closed ? n : n - 1;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 0; i < last; i++) {
    const a = points[i];
    const c = points[(i + 1) % n];
    const sw = fbm(a[0] * 0.018, a[1] * 0.018, seed + 71, 3);
    const lift = fbm(a[0] * 0.03 + 5, a[1] * 0.03 + 5, seed + 97, 2);
    if (gaps && lift < 0.28) continue; // pen lifted → a gap
    const w = width * (0.4 + sw * sw * 1.8);
    const alpha = Math.min(1, opacity * (0.55 + sw * 0.7));
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(c[0], c[1]);
    ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.lineWidth = w;
    ctx.stroke();
  }
  ctx.restore();
}

// A small two-stroke arrowhead at (x,y) pointing along (dx,dy).
export function arrowhead(ctx, x, y, dx, dy, opts = {}) {
  const { color = INK, size = 7, opacity = 0.92, width = 1.5 } = opts;
  const a = Math.atan2(dy, dx);
  const spread = 0.4;
  const [r, g, b] = hexToRgb(color);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(a - spread), y - size * Math.sin(a - spread));
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(a + spread), y - size * Math.sin(a + spread));
  ctx.stroke();
  ctx.restore();
}

// A short tick mark perpendicular to an axis, centered at (x,y).
export function tick(ctx, x, y, horizontal, opts = {}) {
  const { color = INK, length = 5, opacity = 0.85, width = 1.3 } = opts;
  const [r, g, b] = hexToRgb(color);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`;
  ctx.lineWidth = width;
  ctx.beginPath();
  if (horizontal) {
    ctx.moveTo(x, y - length);
    ctx.lineTo(x, y + length);
  } else {
    ctx.moveTo(x - length, y);
    ctx.lineTo(x + length, y);
  }
  ctx.stroke();
  ctx.restore();
}
