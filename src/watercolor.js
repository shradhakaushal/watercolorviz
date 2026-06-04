// Watercolor paint engine — the make-or-break core of the library.
//
// Tuned against real watercolor references. The guiding insight: a flat wash is
// NOT a shaded sphere. Pigment stays a translucent, luminous FILM; what varies
// is its CONCENTRATION — and as it concentrates it grows more SATURATED (the
// dominant channel holds, the others drop), it does not turn grey. Every
// "deepening" here heads toward a single saturated `deep` tone, so pools read as
// rich pigment, never mud.
//
//   washes        translucent layers build the body over the warm paper.
//   boundary      one crisp, gently-undulating edge (low-frequency radial
//                 noise — hand-painted wobble, not regular scallops). The wash
//                 is clipped to it: a defined wet-on-dry edge, not a halo.
//   edge bead     soft, patchy, multi-pass darkening just inside the rim, where
//                 pigment pools as the wash dries.
//   shading       a gentle DIRECTIONAL wash gradient: the far-from-light side
//                 deepens (more saturated + more opaque), the lit side dilutes
//                 toward paper. No specular highlight — a flat wash, not a ball.
//   mottle        broad two-scale noise that locally pools/thins the pigment →
//                 soft cloudy unevenness.
//   granulation   pigment pulled OFF the peaks of the shared paper-tooth noise
//                 field so it settles into the valleys, coherent with the paper.
//
// The mark is painted to an OFFSCREEN canvas so the per-pixel pigment field
// (granulation/shading/mottle) affects only the pigment, then composited onto
// the paper. (This is also the per-mark cache point for charts later.)

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
//   edgeDarkening  soft rim-bead deposit strength
//   variegation    per-wash tonal variation (deepen/dilute, never a hue shift)
//   granulation    pigment pulled off paper-tooth peaks (0 = none)
//   mottle         broad cloudy pooling/thinning of the pigment (0 = even)
//   shading        directional wash-gradient strength (0 = flat, no sphere)
//   lightAngle     light direction in radians (default upper-right)
//   outline        thin tight hand-drawn ink boundary (bool)
//   outlineColor / outlineWidth / outlineOpacity
//   texture / speckles   extra fine speckle (granulation usually suffices)
//   paperSeed / paperScale   MUST match paintPaper so grain aligns to paper
//   seed           seeds the deterministic RNG
export function paintPolygon(ctx, basePoints, opts = {}) {
  const {
    color = '#ff8a72',
    intensity = 1,
    layers = 22,
    layerOpacity = 0.036,
    bleed = 0.05,
    wobble = 0.08,
    blooms = 5,
    bloomStrength = 1.15,
    edgeDarkening = 1.0,
    variegation = 0.1,
    granulation = 0.18,
    mottle = 0.45, // low-frequency tonal unevenness (soft pooling clouds)
    shading = 1.0, // directional wash gradient (NOT a sphere)
    lightAngle = -1.05, // light from the upper-right
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

  // Concentrated ("deep") tone: as watercolor pigment pools it grows MORE
  // saturated — the dominant channel holds while the others drop — it does NOT
  // just turn grey/dark. Every deepening pass (edge, shade, blooms, mottle)
  // heads toward this tone, so pools read as rich pigment, not mud. Hue-general:
  // push each channel away from the brightest one (raise saturation).
  const mx = Math.max(br, bg, bb);
  const sat = 0.55;
  const deepR = clamp255(br - (mx - br) * sat);
  const deepG = clamp255(bg - (mx - bg) * sat);
  const deepB = clamp255(bb - (mx - bb) * sat);

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

  function paintBlob(pts, alpha, jitter, darkenEdge, rgb = [br, bg, bb]) {
    // Per-wash tonal variation expressed the way pigment actually varies:
    // randomly a touch MORE concentrated (toward the saturated deep tone) or a
    // touch more DILUTE (toward white). Never a raw per-channel multiply — that
    // clips the dominant channel and biases the average toward mud.
    const s = gauss() * jitter;
    let lr = rgb[0];
    let lg = rgb[1];
    let lb = rgb[2];
    if (s > 0) {
      lr = clamp255(lr + (deepR - lr) * s);
      lg = clamp255(lg + (deepG - lg) * s);
      lb = clamp255(lb + (deepB - lb) * s);
    } else {
      const t = -s * 0.6;
      lr = clamp255(lr + (255 - lr) * t);
      lg = clamp255(lg + (255 - lg) * t);
      lb = clamp255(lb + (255 - lb) * t);
    }
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
  //
  // The wobble is generated by perturbing each vertex's RADIUS with a smooth
  // noise field sampled around the ring. This gives gentle, low-frequency
  // hand-painted undulation (a few soft lobes) plus a touch of fine roughness —
  // NOT the regular high-frequency scallops that midpoint displacement creates.
  const bJit = basePoints.map(([x, y]) => {
    const ang = Math.atan2(y - cy, x - cx);
    // Walk a small circle through the noise field → periodic around the ring.
    const lo = fbm(Math.cos(ang) * 2.0 + 7, Math.sin(ang) * 2.0 + 7, seed + 3, 2);
    const hi = fbm(Math.cos(ang) * 8 + 19, Math.sin(ang) * 8 + 19, seed + 5, 2);
    const rr = 1 + (lo - 0.5) * bleed * 1.8 + (hi - 0.5) * bleed * 0.45;
    return [cx + (x - cx) * rr, cy + (y - cy) * rr];
  });
  const boundary = chaikin(bJit, 2);

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
    // Pools are more concentrated → tint partway toward the deep tone.
    const t = 0.5;
    const bloomRgb = [
      br + (deepR - br) * t,
      bg + (deepG - bg) * t,
      bb + (deepB - bb) * t,
    ];
    paintBlob(bloom, washAlpha * bloomStrength, variegation * 1.4, 0, bloomRgb);
  }

  // Edge darkening: darker pigment pooled just INSIDE the boundary, the
  // signature wet-on-dry rim. Drawn as many short segments along the boundary
  // whose opacity is driven by a low-frequency noise field, so the rim is
  // PATCHY (dark in places, near-absent in others) — never a uniform ring.
  // Each stroke straddles the clip edge, so only its inner half survives.
  if (edgeDarkening > 0) {
    const N = boundary.length;
    octx.lineCap = 'round';
    octx.lineJoin = 'round';
    // Several passes centered on the boundary: a narrow, strong bead right at
    // the edge plus wider, fainter passes that reach inward — only the inner
    // half of each survives the clip, so they stack into a soft band that is
    // darkest at the rim and fades inward. Opacity is noise-modulated so the
    // bead is uneven (darker in places) like a real drying edge.
    const passes = [
      [0.09, 0.16],
      [0.18, 0.1],
      [0.3, 0.06],
    ];
    for (const [pw, pa] of passes) {
      for (let i = 0; i < N; i++) {
        const a = boundary[i];
        const b = boundary[(i + 1) % N];
        const n = fbm(a[0] * 0.03, a[1] * 0.03, seed + 11, 3); // patchy
        const m = 0.12 + Math.max(0, n - 0.18) / 0.82; // mostly faint, patchy
        const alpha = Math.min(0.85, pa * edgeDarkening * m);
        if (alpha < 0.01) continue;
        octx.beginPath();
        octx.moveTo(a[0], a[1]);
        octx.lineTo(b[0], b[1]);
        octx.strokeStyle = `rgba(${deepR},${deepG},${deepB},${alpha})`;
        octx.lineWidth = r * pw * (0.7 + n * 0.6);
        octx.stroke();
      }
    }
  }

  octx.restore(); // drop clip
  octx.restore(); // drop translate

  // --- 2. Per-pixel pigment field: granulation, tonal mottle and the
  // directional wash gradient, all in one pass over the pigment.
  //
  //   granulation  pulls pigment OFF the paper-tooth peaks (sampled in global
  //                coords with the paper's seed/scale) so it settles into the
  //                valleys — the grainy texture of granulating paint.
  //   shading      a directional pigment gradient: the far-from-light side
  //                DEEPENS toward the saturated tone, the lit side DILUTES
  //                toward paper. Like a real wash drying on tilted paper. NOT a
  //                sphere — no specular highlight, no grey shadow.
  //   mottle       a broad noise field that locally deepens / dilutes the
  //                pigment → soft cloudy pooling, the hallmark of a flat wash.
  //
  // Deepening/diluting is done by blending toward the deep tone (sat. pigment)
  // or by lifting green/blue toward paper — this keeps RED high, exactly how
  // real pigment behaves, so washes never turn muddy/grey.
  if (granulation > 0 || mottle > 0 || shading > 0) {
    const im = octx.getImageData(0, 0, w, h);
    const dt = im.data;
    const mscale = paperScale * 0.1; // coarse, cloudy tonal field
    const dxl = Math.cos(lightAngle);
    const dyl = Math.sin(lightAngle);
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const i = (yy * w + xx) * 4;
        const a = dt[i + 3];
        if (a === 0) continue;

        if (granulation > 0) {
          const n = fbm((xx + ox) * paperScale, (yy + oy) * paperScale, paperSeed, 4);
          const peak = n > 0.5 ? (n - 0.5) * 2 : 0; // 0..1 on raised tooth
          dt[i + 3] = a * (1 - peak * granulation);
        }

        let deepen = 0;
        let dilute = 0;

        if (shading > 0) {
          const ndx = (xx + ox - cx) / r;
          const ndy = (yy + oy - cy) / r;
          const dir = -(ndx * dxl + ndy * dyl); // +1 far side, -1 lit side
          if (dir > 0) deepen += dir * shading;
          else dilute += -dir * shading * 0.85;
        }

        if (mottle > 0) {
          // Two scales of noise → organic clouds rather than a single smooth
          // blob: a broad pooling field plus a medium-frequency break-up.
          const nc = fbm((xx + ox) * mscale, (yy + oy) * mscale, seed + 23, 4);
          const nc2 = fbm((xx + ox) * mscale * 2.9, (yy + oy) * mscale * 2.9, seed + 41, 3);
          const s = ((nc * 0.62 + nc2 * 0.38) - 0.5) * 2 * mottle; // signed pooling
          if (s > 0) deepen += s;
          else dilute += -s;
        }

        if (deepen > 0) {
          if (deepen > 1) deepen = 1;
          dt[i] = clamp255(dt[i] + (deepR - dt[i]) * deepen);
          dt[i + 1] = clamp255(dt[i + 1] + (deepG - dt[i + 1]) * deepen);
          dt[i + 2] = clamp255(dt[i + 2] + (deepB - dt[i + 2]) * deepen);
          // Pooled pigment is also more OPAQUE, so less paper shows through and
          // the deepened tone actually reads dark in the final composite.
          dt[i + 3] = clamp255(dt[i + 3] + (255 - dt[i + 3]) * deepen * 0.7);
        }
        if (dilute > 0) {
          const t = dilute * 0.6; // lift toward white → thinner, lighter wash
          dt[i] = clamp255(dt[i] + (255 - dt[i]) * t);
          dt[i + 1] = clamp255(dt[i + 1] + (255 - dt[i + 1]) * t);
          dt[i + 2] = clamp255(dt[i + 2] + (255 - dt[i + 2]) * t);
          dt[i + 3] = dt[i + 3] * (1 - dilute * 0.2); // thinner → paper shows
        }
      }
    }
    octx.putImageData(im, 0, 0);
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
