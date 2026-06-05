// Shared shape helpers for the rectangular-wash charts (bar, histogram,
// heatmap). Keeps the fill recipe in ONE place so every Primitive-A chart reads
// like the painted reference: a flat matte, finely grainy, muted wash with a
// line-and-wash ink outline.

import { paintPolygon } from '../watercolor.js';

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

// Close a top curve down to a horizontal baseline into a filled polygon.
export function areaPolygon(top, baselineY) {
  const pts = top.slice();
  pts.push([top[top.length - 1][0], baselineY]);
  pts.push([top[0][0], baselineY]);
  return densify(pts);
}

// Close a band between an upper and lower curve (both left→right).
export function bandPolygon(top, bottom) {
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
  const { color, seed = 1, intensity = 0.95 } = opts;
  paintPolygon(ctx, areaPolygon(top, baselineY), areaFillOpts(color, seed, intensity));
}

export function paintBandWash(ctx, top, bottom, opts = {}) {
  const { color, seed = 1, intensity = 0.95 } = opts;
  paintPolygon(ctx, bandPolygon(top, bottom), areaFillOpts(color, seed, intensity));
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
