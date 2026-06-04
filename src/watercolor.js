// Watercolor paint engine — the make-or-break core of the library.
//
// Canonical generative-watercolor washes (Tyler Hobbs / Sighack) PLUS the
// physical effects that separate "top-tier" from "fine":
//
//   washes        many INDEPENDENT deformations of the base (never scaled
//                 copies — those make a lifeless gradient), stacked at low
//                 opacity → translucent, mottled body.
//   blooms        smaller interior patches → pigment pooling / back-runs.
//   edge darkening faint dark stroke per wash → pigment migrates to the rim.
//   granulation   pigment is pulled OFF the peaks of the shared paper-tooth
//                 noise field, so it settles into the paper's valleys exactly
//                 like real granulating pigment. (Coherent with the paper.)
//   shading       a directional value gradient (light → dark) gives the wash
//                 luminous, near-spherical depth instead of a flat disc.
//
// The mark is painted to an OFFSCREEN canvas so granulation/shading affect only
// the pigment, then composited onto the paper. (This is also the per-mark cache
// point for charts later.)

import * as d3 from 'd3';
import { hexToRgb } from './palette.js';
import { makeRng } from './rng.js';
import { fbm } from './noise.js';

function deform(points, depth, variance, gauss, vdiv = 2) {
  let pts = points.map((p) => [p[0], p[1]]);
  let v = variance;
  for (let d = 0; d < depth; d++) {
    const n = pts.length;
    const next = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i];
      const c = pts[(i + 1) % n];
      next.push(a);
      const dx = c[0] - a[0];
      const dy = c[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const off = gauss() * v;
      next.push([(a[0] + c[0]) / 2 + nx * off, (a[1] + c[1]) / 2 + ny * off]);
    }
    pts = next;
    v /= vdiv;
  }
  return pts;
}

// Chaikin corner-cutting: replaces each vertex with two points along its
// edges, rounding sharp corners into smooth curves. A couple of iterations
// turn a jagged deformed polygon into a clean, gently-wavy outline.
function chaikin(points, iters = 1) {
  let p = points;
  for (let k = 0; k < iters; k++) {
    const n = p.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const a = p[i];
      const b = p[(i + 1) % n];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = out;
  }
  return p;
}

function centroidOf(points) {
  let x = 0;
  let y = 0;
  for (const p of points) {
    x += p[0];
    y += p[1];
  }
  return [x / points.length, y / points.length];
}

function meanRadius(points, [cx, cy]) {
  let sum = 0;
  for (const [x, y] of points) sum += Math.hypot(x - cx, y - cy);
  return sum / points.length;
}

function tracePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
}

function clamp255(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Paint one watercolor mark from `basePoints` (a closed polygon [[x,y], ...]).
//
// Aesthetic opts:
//   color          base hex color
//   intensity      light→dark fill (scales pigment density; 1 = default)
//   layers         independent translucent washes
//   layerOpacity   per-wash alpha
//   bleed          edge feather (× mean radius)
//   wobble         per-wash size variation → interior mottling
//   blooms / bloomStrength   interior pigment pools
//   edgeDarkening  dark rim deposit strength
//   variegation    per-wash color jitter
//   granulation    pigment pulled off paper-tooth peaks (0 = none)
//   shading        directional value gradient strength (0 = flat)
//   lightAngle     light direction in radians (default upper-right)
//   outline        thin tight hand-drawn ink boundary (bool)
//   outlineColor / outlineWidth / outlineOpacity
//   texture / speckles   extra fine speckle (granulation usually suffices)
//   paperSeed / paperScale   MUST match paintPaper so grain aligns to paper
//   seed           seeds the deterministic RNG
export function paintPolygon(ctx, basePoints, opts = {}) {
  const {
    color = '#cd7d68',
    intensity = 1,
    layers = 28,
    layerOpacity = 0.03,
    bleed = 0.05,
    wobble = 0.08,
    blooms = 10,
    bloomStrength = 1.45,
    edgeDarkening = 1,
    variegation = 0.13,
    granulation = 0.3,
    shading = 0.8,
    lightAngle = -Math.PI / 4,
    outline = false,
    outlineColor = '#2b2b2b',
    outlineWidth = 1.1,
    outlineOpacity = 0.75,
    texture = false,
    speckles = 0,
    paperSeed = 7,
    paperScale = 0.16,
    seed = 1,
  } = opts;

  const rng = makeRng(seed);
  const gauss = d3.randomNormal.source(rng)(0, 1);
  const [br, bg, bb] = hexToRgb(color);

  const centroid = centroidOf(basePoints);
  const [cx, cy] = centroid;
  const r = meanRadius(basePoints, centroid);
  const washAlpha = layerOpacity * intensity;

  // Offscreen bbox (generous margin for the feathered edge + outline).
  let minx = Infinity;
  let miny = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  for (const [x, y] of basePoints) {
    if (x < minx) minx = x;
    if (x > maxx) maxx = x;
    if (y < miny) miny = y;
    if (y > maxy) maxy = y;
  }
  const margin = r * 0.55 + outlineWidth + 4;
  const ox = Math.floor(minx - margin);
  const oy = Math.floor(miny - margin);
  const w = Math.ceil(maxx + margin) - ox;
  const h = Math.ceil(maxy + margin) - oy;

  const oc = makeCanvas(w, h);
  const octx = oc.getContext('2d');
  octx.lineJoin = 'round';

  // Faint specks clipped to a polygon (optional; granulation usually suffices).
  function stipple(pts, rgb, alpha, count) {
    octx.save();
    tracePath(octx, pts);
    octx.clip();
    for (let i = 0; i < count; i++) {
      const x = minx + rng() * (maxx - minx);
      const y = miny + rng() * (maxy - miny);
      octx.fillStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * (0.5 + rng())})`;
      octx.beginPath();
      octx.arc(x, y, 0.4 + rng() * 1.6, 0, Math.PI * 2);
      octx.fill();
    }
    octx.restore();
  }

  function paintBlob(pts, alpha, jitter, darkenEdge) {
    const lr = clamp255(br * (1 + gauss() * jitter));
    const lg = clamp255(bg * (1 + gauss() * jitter));
    const lb = clamp255(bb * (1 + gauss() * jitter));
    tracePath(octx, pts);
    octx.fillStyle = `rgba(${lr},${lg},${lb},${alpha})`;
    octx.fill();
    if (darkenEdge > 0) {
      octx.strokeStyle = `rgba(${(lr * 0.5) | 0},${(lg * 0.5) | 0},${(lb * 0.5) | 0},${alpha * darkenEdge})`;
      octx.lineWidth = 1.2;
      octx.stroke();
    }
    if (texture && speckles > 0) stipple(pts, [lr, lg, lb], alpha, speckles);
  }

  // --- 1. Body + edge, painted in global coords on the offscreen canvas.
  octx.save();
  octx.translate(-ox, -oy);

  // ONE crisp, slightly-irregular boundary defines the edge. Everything is
  // clipped to it, so the wash has a defined edge (wet-on-dry) — not a halo.
  const bJit = basePoints.map(([x, y]) => [
    x + gauss() * r * bleed * 0.15,
    y + gauss() * r * bleed * 0.15,
  ]);
  const boundary = chaikin(deform(bJit, 3, r * bleed * 0.35, gauss, 2.6), 3);

  octx.save();
  tracePath(octx, boundary);
  octx.clip();

  // Even body: washes sized to fully cover the boundary (slightly oversize),
  // clipped to it. Per-wash color jitter gives subtle tonal variation; the
  // crisp edge comes entirely from the clip, never from the wash silhouettes.
  for (let l = 0; l < layers; l++) {
    const v = r * bleed * (0.4 + rng() * 0.5);
    const start = basePoints.map(([x, y]) => [
      x + gauss() * v * 0.4,
      y + gauss() * v * 0.4,
    ]);
    let pts = deform(start, 5, v, gauss, 2);
    const s = 1.05 + rng() * (wobble * 1.3);
    pts = pts.map(([x, y]) => [cx + (x - cx) * s, cy + (y - cy) * s]);
    paintBlob(pts, washAlpha, variegation, 0);
  }

  // Gentle, distributed interior blooms → mottle (not a central blotch).
  for (let i = 0; i < blooms; i++) {
    const ang = rng() * Math.PI * 2;
    const dist = (0.15 + rng() * 0.55) * r;
    const bx = cx + Math.cos(ang) * dist;
    const by = cy + Math.sin(ang) * dist;
    const brad = r * (0.14 + rng() * 0.24);
    const bv = brad * 0.22 * (0.5 + rng());
    const base = regularPolygon(bx, by, brad, 8).map(([x, y]) => [
      x + gauss() * bv,
      y + gauss() * bv,
    ]);
    const bloom = deform(base, 4, bv, gauss, 2);
    paintBlob(bloom, washAlpha * bloomStrength, variegation * 1.4, 0);
  }

  // Edge darkening: darker pigment pooled just INSIDE the boundary. A few
  // jittered wide strokes of a darker tone, clipped to the boundary, leave only
  // their inner half — an uneven dark rim, the signature wet-on-dry edge.
  if (edgeDarkening > 0) {
    const dr = (br * 0.5) | 0;
    const dg = (bg * 0.5) | 0;
    const db = (bb * 0.5) | 0;
    for (let p = 0; p < 4; p++) {
      const cj = boundary.map(([x, y]) => [
        x + gauss() * r * 0.012,
        y + gauss() * r * 0.012,
      ]);
      tracePath(octx, cj);
      octx.strokeStyle = `rgba(${dr},${dg},${db},${0.1 * edgeDarkening})`;
      octx.lineWidth = r * 0.05 * (0.7 + rng() * 0.7);
      octx.stroke();
    }
  }

  octx.restore(); // drop clip
  octx.restore(); // drop translate

  // --- 2. Granulation: pull pigment off the paper-tooth PEAKS (sampled in
  // global coords with the same seed/scale as the paper), so it settles into
  // the valleys. This is the grainy, mottled texture of real granulating paint.
  if (granulation > 0) {
    const im = octx.getImageData(0, 0, w, h);
    const dt = im.data;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const i = (yy * w + xx) * 4;
        const a = dt[i + 3];
        if (a === 0) continue;
        const n = fbm((xx + ox) * paperScale, (yy + oy) * paperScale, paperSeed, 4);
        const peak = n > 0.5 ? (n - 0.5) * 2 : 0; // 0..1 on raised tooth
        dt[i + 3] = a * (1 - peak * granulation);
      }
    }
    octx.putImageData(im, 0, 0);
  }

  // --- 3. Directional shading: brighten toward the light, darken away from it.
  // `source-atop` confines the gradients to existing pigment.
  if (shading > 0) {
    const hX = cx - ox + Math.cos(lightAngle) * r * 0.45;
    const hY = cy - oy + Math.sin(lightAngle) * r * 0.45;
    octx.globalCompositeOperation = 'source-atop';

    // Shadow: smooth value gradient deepening away from the light → 3D form.
    const dr = (br * 0.4) | 0;
    const dg = (bg * 0.4) | 0;
    const db = (bb * 0.4) | 0;
    const shadow = octx.createRadialGradient(hX, hY, r * 0.15, hX, hY, r * 2.1);
    shadow.addColorStop(0, `rgba(${dr},${dg},${db},0)`);
    shadow.addColorStop(0.35, `rgba(${dr},${dg},${db},0)`);
    shadow.addColorStop(1, `rgba(${dr},${dg},${db},${0.62 * shading})`);
    octx.fillStyle = shadow;
    octx.fillRect(0, 0, w, h);

    // Highlight: a soft luminous hot-spot toward the light, where paper shows.
    const hl = octx.createRadialGradient(hX, hY, 0, hX, hY, r * 0.8);
    hl.addColorStop(0, `rgba(255,251,244,${0.62 * shading})`);
    hl.addColorStop(0.5, `rgba(255,251,244,${0.16 * shading})`);
    hl.addColorStop(1, 'rgba(255,251,244,0)');
    octx.fillStyle = hl;
    octx.fillRect(0, 0, w, h);

    octx.globalCompositeOperation = 'source-over';
  }

  // --- 4. Optional tight hand-drawn ink boundary, on top of everything.
  if (outline) {
    octx.save();
    octx.translate(-ox, -oy);
    const v = r * bleed * 0.4;
    const start = basePoints.map(([x, y]) => [
      x + gauss() * v * 0.2,
      y + gauss() * v * 0.2,
    ]);
    const contour = deform(start, 4, v, gauss, 2.8);
    const [or_, og, ob] = hexToRgb(outlineColor);
    tracePath(octx, contour);
    octx.strokeStyle = `rgba(${or_},${og},${ob},${outlineOpacity})`;
    octx.lineWidth = outlineWidth;
    octx.stroke();
    octx.restore();
  }

  // --- 5. Composite the finished mark onto the paper.
  ctx.drawImage(oc, ox, oy);
}

// Build a regular n-gon centered at (cx, cy). Round marks use many sides; the
// deformation supplies the organic edge.
export function regularPolygon(cx, cy, radius, sides = 36) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const t = (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(t) * radius, cy + Math.sin(t) * radius]);
  }
  return pts;
}
