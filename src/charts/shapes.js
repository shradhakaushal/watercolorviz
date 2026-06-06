// Shared shape helpers for the rectangular-wash charts (bar, histogram,
// heatmap). Keeps the fill recipe in ONE place so every Primitive-A chart reads
// like the painted reference: a flat matte, finely grainy, muted wash with a
// line-and-wash ink outline.

import { paintPolygon } from '../watercolor.js';
import { hexToRgb } from '../palette.js';

// A rectangle as a closed polygon with subdivided edges, so the engine's gentle
// edge wobble has points to act on (4 corners alone round into a blob).
export function rectPoints(x, y, w, h, per = 5) {
  const pts = [];
  const edge = (ax, ay, bx, by) => {
    for (let i = 0; i < per; i++) {
      const t = i / per;
      pts.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
  return pts;
}

// The tuned rectangular-wash fill (matches the reference dashboard): flat matte
// shading, strong fine-grained granulation (cold-press tooth), gentle mottle,
// dense enough to read as pigment. Bump CACHE_REV if the recipe changes so old
// cached marks are not reused.
const CACHE_REV = 1;

// --- Primitive B: arbitrary filled polygons (area / ridgeline / stacked) ---

// Insert points along any edge longer than `maxSeg` so the closed polygon has
// no long segments. The engine's corner-smoothing cuts a FRACTION off each edge
// end, so a single long edge (e.g. the baseline of an area) would get a huge
// chunk sliced off its corners — leaving white wedges. Densifying keeps every
// cut tiny and local.
function densify(points, maxSeg = 12) {
  const out = [];
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    out.push(a);
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const k = Math.floor(d / maxSeg);
    for (let j = 1; j <= k; j++) {
      const t = j / (k + 1);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

// Close a top curve down to a baseline into a filled polygon.
//
// With `extend = { x0, x1, ov }`, the SIDES and BASELINE are pushed OUTWARD
// beyond [x0, x1] and below the baseline by `ov`. Combined with a clip to the
// plot rect (see Chart.withPlotClip), this guarantees the wash covers all the
// way to the axis and the left/right edges even though the engine wobbles the
// boundary — only the top data curve stays inside the plot and organic.
export function areaPolygon(top, baselineY, extend) {
  if (extend) {
    const { x0, x1, ov = 18 } = extend;
    const yL = top[0][1];
    const yR = top[top.length - 1][1];
    return densify([
      ...top,
      [x1 + ov, yR],
      [x1 + ov, baselineY + ov],
      [x0 - ov, baselineY + ov],
      [x0 - ov, yL],
    ]);
  }
  return densify([...top, [top[top.length - 1][0], baselineY], [top[0][0], baselineY]]);
}

// Close a band between an upper and lower curve (both left→right). `extend`
// pushes the sides out (and, with `bottomOv`, the lower curve down).
export function bandPolygon(top, bottom, extend) {
  if (extend) {
    const { x0, x1, ov = 18, bottomOv = 0 } = extend;
    const bot = bottomOv ? bottom.map(([x, y]) => [x, y + bottomOv]) : bottom;
    return densify([
      [x0 - ov, top[0][1]],
      ...top,
      [x1 + ov, top[top.length - 1][1]],
      [x1 + ov, bot[bot.length - 1][1]],
      ...bot.slice().reverse(),
      [x0 - ov, bot[0][1]],
    ]);
  }
  return densify(top.concat(bottom.slice().reverse()));
}

// The arbitrary-polygon wash recipe (area/ridgeline/stacked): a soft, grainy,
// translucent wash that follows the given OUTLINE (flat baselines stay flat,
// the data profile stays faithful) — not the radial blob boundary.
function areaFillOpts(color, seed, intensity) {
  return {
    color,
    seed,
    intensity,
    boundaryMode: 'outline',
    bleed: 0.05, // gentle hand-painted edge along the curve
    shading: 0.18, // nearly flat
    mottle: 0.32,
    granulation: 0.42,
    paperScale: 0.28,
    outline: false, // the chart inks the top contour itself (inkPath)
  };
}

export function paintAreaWash(ctx, top, baselineY, opts = {}) {
  const { color, seed = 1, intensity = 0.95, extend } = opts;
  paintPolygon(ctx, areaPolygon(top, baselineY, extend), areaFillOpts(color, seed, intensity));
}

export function paintBandWash(ctx, top, bottom, opts = {}) {
  const { color, seed = 1, intensity = 0.95, extend } = opts;
  paintPolygon(ctx, bandPolygon(top, bottom, extend), areaFillOpts(color, seed, intensity));
}

export function withRevealClip(ctx, x0, y0, w, h, progress, fn) {
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return;
  ctx.save();
  if (p < 0.995) {
    ctx.beginPath();
    ctx.rect(x0, y0, w * p, h);
    ctx.clip();
    ctx.globalAlpha = 0.25 + p * 0.75;
  }
  fn();
  ctx.restore();
}

export function paintRectWash(ctx, x, y, w, h, opts = {}) {
  const { color, seed = 1, outline = true, intensity = 1.1 } = opts;
  // Content-addressed cache key: identical geometry+color+seed reuses the paint.
  const cacheKey = `rect:${CACHE_REV}:${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}:${color}:${seed}:${intensity}:${outline}`;
  paintPolygon(ctx, rectPoints(x, y, w, h), {
    color,
    seed,
    outline,
    intensity,
    bleed: 0.03, // keep it rectangular; just a hand-painted waver
    shading: 0.15, // a flat matte wash — NOT a glossy 3D gradient
    mottle: 0.28, // gentle cloud; let the grain (not big blotches) dominate
    granulation: 0.55, // strong cold-press paper grain (the reference look)
    paperScale: 0.3, // finer tooth → fine even speckle, not soft blobs
    cacheKey,
  });
}

export function paintRectWashReveal(ctx, x, y, w, h, opts = {}) {
  const { progress = 1, reveal = 'up' } = opts;
  const p = Math.max(0, Math.min(1, progress));
  if (p <= 0) return;
  if (p >= 0.995) {
    paintRectWash(ctx, x, y, w, h, opts);
    return;
  }

  let cx = x;
  let cy = y;
  let cw = w;
  let ch = h;
  if (reveal === 'right') {
    cw = w * p;
  } else if (reveal === 'center') {
    cw = w * (0.15 + p * 0.85);
    ch = h * (0.15 + p * 0.85);
    cx = x + (w - cw) / 2;
    cy = y + (h - ch) / 2;
  } else {
    ch = h * p;
    cy = y + h - ch;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(cx, cy, cw, ch);
  ctx.clip();
  ctx.globalAlpha = 0.28 + p * 0.72;
  paintRectWash(ctx, x, y, w, h, opts);
  ctx.restore();
}

function traceSketchRect(ctx, x, y, w, h, seed, jitter = 1.2) {
  const pts = rectPoints(x, y, w, h, 7);
  const n = pts.length;
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const wave = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    const offset = (wave - Math.floor(wave) - 0.5) * jitter;
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    let nx = -(next[1] - prev[1]);
    let ny = next[0] - prev[0];
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    const qx = px + nx * offset;
    const qy = py + ny * offset;
    if (i === 0) ctx.moveTo(qx, qy);
    else ctx.lineTo(qx, qy);
  });
  ctx.closePath();
}

function tracePoints(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
}

function traceOpenPoints(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
}

function deepPigment(color) {
  const [r, g, b] = hexToRgb(color);
  const max = Math.max(r, g, b);
  return {
    rgb: [r, g, b],
    deep: [
      Math.max(0, Math.round(r - (max - r) * 0.45)),
      Math.max(0, Math.round(g - (max - g) * 0.45)),
      Math.max(0, Math.round(b - (max - b) * 0.45)),
    ],
  };
}

// Animated in-chart selection for rectangular marks. It deepens the chosen wash
// and redraws the edge directly on the mark so selection belongs to the bar
// instead of reading as a separate frame around it.
export function paintRectSelection(ctx, x, y, w, h, opts = {}) {
  const { color = '#3f7fb0', seed = 1, progress = 0 } = opts;
  if (progress <= 0.01) return;

  const p = 1 - Math.pow(1 - progress, 3);
  const { rgb: [r, g, b], deep } = deepPigment(color);
  const perimeter = 2 * (w + h);

  ctx.save();
  ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},${0.2 * p})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},${0.16 * p})`;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  ctx.save();
  traceSketchRect(ctx, x, y, w, h, seed + 41, 1.2);
  ctx.strokeStyle = `rgba(${r},${g},${b},${0.22 * p})`;
  ctx.lineWidth = 4 + p * 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();

  ctx.save();
  traceSketchRect(ctx, x, y, w, h, seed + 11, 0.8);
  ctx.setLineDash([Math.max(1, perimeter * p), perimeter]);
  ctx.lineDashOffset = -perimeter * 0.04;
  ctx.strokeStyle = `rgba(59,51,43,${0.78 * p})`;
  ctx.lineWidth = 1.4 + p * 1.2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

export function paintPolygonSelection(ctx, points, opts = {}) {
  const { color = '#3f7fb0', progress = 0, outlinePoints = points, closedOutline = true } = opts;
  if (progress <= 0.01 || !points || points.length < 3) return;

  const p = 1 - Math.pow(1 - progress, 3);
  const { rgb: [r, g, b], deep } = deepPigment(color);

  ctx.save();
  tracePoints(ctx, points);
  ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},${0.18 * p})`;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  tracePoints(ctx, points);
  ctx.fillStyle = `rgba(${deep[0]},${deep[1]},${deep[2]},${0.14 * p})`;
  ctx.fill();
  ctx.restore();

  if (outlinePoints && outlinePoints.length > 1) {
    const traceOutline = closedOutline ? tracePoints : traceOpenPoints;
    ctx.save();
    traceOutline(ctx, outlinePoints);
    ctx.strokeStyle = `rgba(${r},${g},${b},${0.24 * p})`;
    ctx.lineWidth = 5 + p * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();

    ctx.save();
    traceOutline(ctx, outlinePoints);
    ctx.strokeStyle = `rgba(59,51,43,${0.54 * p})`;
    ctx.lineWidth = 1.2 + p * 0.9;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}
