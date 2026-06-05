// Shared shape helpers for the rectangular-wash charts (bar, histogram,
// heatmap). Keeps the fill recipe in ONE place so every Primitive-A chart reads
// like the painted reference: a flat matte, finely grainy, muted wash with a
// line-and-wash ink outline.

import { paintPolygon, regularPolygon } from '../watercolor.js';

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

// An arbitrary closed/filled polygon as a soft grainy wash (sankey flows etc.).
export function paintFillWash(ctx, points, opts = {}) {
  const { color, seed = 1, intensity = 0.9, ink, outline = false } = opts;
  paintPolygon(ctx, densify(points, 14), {
    ...areaFillOpts(color, seed, intensity),
    outline,
    outlineColor: ink,
  });
}

// --- Primitive C: radial arcs (pie/donut) + Primitive D: point blobs ---

// An (annular) wedge polygon: outer arc a0→a1 at r1, closed back along the
// inner arc at r0 (or to the centre when r0 = 0).
export function wedgePolygon(cx, cy, r0, r1, a0, a1, segs = 28) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs);
    pts.push([cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]);
  }
  if (r0 > 0) {
    for (let i = segs; i >= 0; i--) {
      const a = a0 + (a1 - a0) * (i / segs);
      pts.push([cx + Math.cos(a) * r0, cy + Math.sin(a) * r0]);
    }
  } else {
    pts.push([cx, cy]);
  }
  return pts;
}

// Paint a pie/donut wedge as a grainy wash with a line-and-wash ink edge.
export function paintWedge(ctx, cx, cy, r0, r1, a0, a1, opts = {}) {
  const { color, seed = 1, intensity = 1.0, ink } = opts;
  paintPolygon(ctx, densify(wedgePolygon(cx, cy, r0, r1, a0, a1), 14), {
    color, seed, intensity,
    boundaryMode: 'outline', bleed: 0.035, shading: 0.2, mottle: 0.3,
    granulation: 0.45, paperScale: 0.28, outline: true, outlineWidth: 1.6, outlineColor: ink,
  });
}

// Paint an arbitrary CLOSED polygon as a translucent grainy wash (radar bodies).
export function paintClosedWash(ctx, points, opts = {}) {
  const { color, seed = 1, intensity = 0.85, outline = true, ink } = opts;
  paintPolygon(ctx, densify(points, 14), {
    color, seed, intensity,
    boundaryMode: 'outline', bleed: 0.04, shading: 0.18, mottle: 0.3,
    granulation: 0.4, paperScale: 0.28, outline, outlineWidth: 1.5, outlineColor: ink,
  });
}

// Paint a soft grainy translucent dot/blob (scatter points, line markers,
// network nodes).
export function paintDot(ctx, cx, cy, r, opts = {}) {
  const { color, seed = 1, intensity = 0.9, outline = false, ink } = opts;
  paintPolygon(ctx, regularPolygon(cx, cy, r, 28), {
    color, seed, intensity,
    bleed: 0.06, shading: 0.3, mottle: 0.3, granulation: 0.35, paperScale: 0.26,
    outline, outlineWidth: 1.3, outlineColor: ink,
  });
}

export function paintRectWash(ctx, x, y, w, h, opts = {}) {
  const { color, seed = 1, outline = true, intensity = 1.1, ink } = opts;
  // Content-addressed cache key: identical geometry+color+seed reuses the paint.
  const cacheKey = `rect:${CACHE_REV}:${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(h)}:${color}:${seed}:${intensity}:${outline}:${ink}`;
  paintPolygon(ctx, rectPoints(x, y, w, h), {
    color,
    seed,
    outline,
    intensity,
    outlineColor: ink,
    bleed: 0.03, // keep it rectangular; just a hand-painted waver
    shading: 0.15, // a flat matte wash — NOT a glossy 3D gradient
    mottle: 0.28, // gentle cloud; let the grain (not big blotches) dominate
    granulation: 0.55, // strong cold-press paper grain (the reference look)
    paperScale: 0.3, // finer tooth → fine even speckle, not soft blobs
    cacheKey,
  });
}
