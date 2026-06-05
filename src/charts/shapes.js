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
