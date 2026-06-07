// Watercolify ANY shape to a PNG, headlessly — turn an outline into a painted
// watercolor blob with the watercolorviz engine.
//
// Two ways to call it:
//
// 1) Quick single shape (CLI flags):
//      node watercolify-shape.mjs --shape flame --color "#d6452f" --out fire.png
//      node watercolify-shape.mjs --svg "M10 10 C 20 0, 40 0, 50 10 ..." --color "#6f93c2"
//      node watercolify-shape.mjs --svg-file logo.svg --color "#7c4dbd" --scale 2
//
//    Flags: --shape <name> | --svg <path-d> | --svg-file <file> | --points <file.json>
//           --color <hex> --seed <n> --width <px> --height <px> --paper <hex>
//           --out <file.png>  --outline
//    Built-in shapes: star, flame, heart, hexagon, triangle, circle, blob
//
// 2) Layered composition (JSON spec) — richer, multi-blob art:
//      node watercolify-shape.mjs --spec art.json [out.png]
//    art.json:
//      {
//        "width": 640, "height": 640, "paper": "#f7efe1", "scale": 2,
//        "layers": [
//          { "shape": "flame", "color": "#d6452f", "seed": 11, "args": {"w":320,"h":470} },
//          { "svg": "M ...", "color": "#f0a23a", "seed": 23, "scale": 4, "dx": 80, "dy": 40 },
//          { "points": [[x,y],...], "color": "#e8b94f", "outline": true }
//        ]
//      }
//    Each layer is passed to paintPolygon as options; `points` is computed from
//    `shape` | `svg` | `points`. Layers paint in order (first = bottom).

import { readFile } from 'node:fs/promises';
import { renderShapes, writeCanvas } from './wcv-node.mjs';

// ---------------------------------------------------------------------------
// Built-in parametric shapes. Each returns a closed polygon ([x,y][]) centered
// in a width×height box (args override size).
// ---------------------------------------------------------------------------
const SHAPES = {
  circle: (W, H, a = {}) => ring(W / 2, H / 2, (a.r ?? Math.min(W, H) * 0.4), 64),
  triangle: (W, H, a = {}) => regular(W / 2, H / 2, (a.r ?? Math.min(W, H) * 0.42), 3, -Math.PI / 2),
  hexagon: (W, H, a = {}) => regular(W / 2, H / 2, (a.r ?? Math.min(W, H) * 0.42), 6, -Math.PI / 2),
  star: (W, H, a = {}) => starPts(W / 2, H / 2, a.r ?? Math.min(W, H) * 0.42, a.inner, a.points ?? 5),
  heart: (W, H, a = {}) => heartPts(W / 2, H * 0.46, a.s ?? Math.min(W, H) * 0.032),
  flame: (W, H, a = {}) => flamePts(W / 2, H * 0.86, a.w ?? W * 0.5, a.h ?? H * 0.72),
  blob: (W, H, a = {}) => blobPts(W / 2, H / 2, a.r ?? Math.min(W, H) * 0.38, a.seed ?? 1),
};

function ring(cx, cy, r, n = 48) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2;
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  });
}
function regular(cx, cy, r, sides, rot = 0) {
  return Array.from({ length: sides }, (_, i) => {
    const t = rot + (i / sides) * Math.PI * 2;
    return [cx + Math.cos(t) * r, cy + Math.sin(t) * r];
  });
}
function starPts(cx, cy, rOuter, rInner, points = 5) {
  rInner = rInner ?? rOuter * 0.42;
  const steps = points * 2;
  return Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
}
function heartPts(cx, cy, s) {
  const pts = [];
  for (let i = 0; i <= 200; i++) {
    const t = (i / 200) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + x * s, cy - y * s]);
  }
  return pts;
}
function flamePts(cx, baseY, w, h) {
  const pts = [];
  const N = 160;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const y = baseY - t * h;
    const flick = Math.sin(t * 9) * 0.06 + Math.sin(t * 23) * 0.03;
    const width = (Math.sin(t * Math.PI) ** 0.7) * (w / 2) * (1 - t * 0.35);
    pts.push([cx + width + flick * w, y]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    const y = baseY - t * h;
    const flick = Math.sin(t * 11 + 1.7) * 0.05;
    const width = (Math.sin(t * Math.PI) ** 0.7) * (w / 2) * (1 - t * 0.35);
    pts.push([cx - (width + flick * w), y]);
  }
  return pts;
}
function blobPts(cx, cy, r, seed = 1) {
  // smooth pseudo-random radial wobble
  const pts = [];
  const N = 96;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const wob = 1 + 0.18 * Math.sin(t * 3 + seed) + 0.1 * Math.sin(t * 5 + seed * 2);
    pts.push([cx + Math.cos(t) * r * wob, cy + Math.sin(t) * r * wob]);
  }
  return pts;
}

// ---------------------------------------------------------------------------
// SVG path flattener — no DOM. Supports M/L/H/V/C/S/Q/T/Z (abs + relative).
// Arcs (A/a) are not supported (warns + skips). Returns ONE flattened polygon
// per subpath; we paint each subpath as its own blob.
// ---------------------------------------------------------------------------
function flattenPath(d, { samplesPerCurve = 24, scale = 1, dx = 0, dy = 0 } = {}) {
  const tokens = d.match(/[a-zA-Z]|-?\.?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi) || [];
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  const isCmd = (t) => /[a-zA-Z]/.test(t);

  const subpaths = [];
  let cur = null;
  let x = 0, y = 0, startX = 0, startY = 0;
  let px = 0, py = 0; // last control point reflection (for S/T)
  let cmd = '';
  const push = (nx, ny) => { x = nx; y = ny; cur.push([x * scale + dx, y * scale + dy]); };
  const cubic = (x1, y1, x2, y2, ex, ey) => {
    for (let s = 1; s <= samplesPerCurve; s++) {
      const t = s / samplesPerCurve, u = 1 - t;
      const bx = u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex;
      const by = u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey;
      cur.push([bx * scale + dx, by * scale + dy]);
    }
    px = x2; py = y2; x = ex; y = ey;
  };
  const quad = (x1, y1, ex, ey) => {
    for (let s = 1; s <= samplesPerCurve; s++) {
      const t = s / samplesPerCurve, u = 1 - t;
      const bx = u * u * x + 2 * u * t * x1 + t * t * ex;
      const by = u * u * y + 2 * u * t * y1 + t * t * ey;
      cur.push([bx * scale + dx, by * scale + dy]);
    }
    px = x1; py = y1; x = ex; y = ey;
  };

  while (i < tokens.length) {
    if (isCmd(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? x : 0, oy = rel ? y : 0;
    switch (C) {
      case 'M': {
        if (cur && cur.length > 1) subpaths.push(cur);
        cur = [];
        x = ox + num(); y = oy + num(); startX = x; startY = y;
        cur.push([x * scale + dx, y * scale + dy]);
        cmd = rel ? 'l' : 'L'; // subsequent pairs are implicit lineto
        break;
      }
      case 'L': push(ox + num(), oy + num()); break;
      case 'H': push(ox + num(), y); break;
      case 'V': push(x, oy + num()); break;
      case 'C': cubic(ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()); break;
      case 'S': {
        const rx = 2 * x - px, ry = 2 * y - py;
        cubic(rx, ry, ox + num(), oy + num(), ox + num(), oy + num());
        break;
      }
      case 'Q': quad(ox + num(), oy + num(), ox + num(), oy + num()); break;
      case 'T': {
        const rx = 2 * x - px, ry = 2 * y - py;
        quad(rx, ry, ox + num(), oy + num());
        break;
      }
      case 'Z': {
        if (cur) { cur.push([startX * scale + dx, startY * scale + dy]); subpaths.push(cur); }
        cur = null; x = startX; y = startY;
        break;
      }
      case 'A':
        console.warn('watercolify: arc (A/a) commands are not supported and were skipped.');
        num(); num(); num(); num(); num(); push(ox + num(), oy + num());
        break;
      default:
        throw new Error(`watercolify: unsupported path command "${cmd}"`);
    }
  }
  if (cur && cur.length > 1) subpaths.push(cur);
  return subpaths;
}

// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      if (key === 'outline') { a.outline = true; continue; }
      a[key] = argv[++i];
    } else if (!a._out) {
      a._out = t;
    }
  }
  return a;
}

async function layersFromArgs(a, W, H) {
  const base = { color: a.color || '#dc8068', seed: a.seed ? +a.seed : 7, outline: !!a.outline };
  if (a.shape) {
    const fn = SHAPES[a.shape];
    if (!fn) throw new Error(`unknown --shape "${a.shape}". options: ${Object.keys(SHAPES).join(', ')}`);
    return [{ points: fn(W, H), ...base }];
  }
  if (a.points) {
    const pts = JSON.parse(await readFile(a.points, 'utf8'));
    return [{ points: pts, ...base }];
  }
  const d = a.svg || (a['svg-file'] ? extractPathD(await readFile(a['svg-file'], 'utf8')) : null);
  if (d) {
    const opts = { scale: a.scale ? +a.scale : 1, dx: a.dx ? +a.dx : 0, dy: a.dy ? +a.dy : 0 };
    return flattenPath(d, opts).map((points) => ({ points, ...base }));
  }
  throw new Error('provide one of: --shape, --svg, --svg-file, --points, or --spec');
}

function extractPathD(svgText) {
  const ds = [...svgText.matchAll(/<path[^>]*\sd="([^"]+)"/gi)].map((m) => m[1]);
  if (!ds.length) throw new Error('no <path d="..."> found in SVG file');
  return ds.join(' '); // concatenate subpaths; flattener splits on M/Z
}

async function layersFromSpec(spec) {
  const W = spec.width || 640, H = spec.height || 640;
  const out = [];
  for (const layer of spec.layers || []) {
    const { shape, svg, points, args, dx, dy, scale, ...paint } = layer;
    let pts;
    if (shape) pts = (SHAPES[shape] || (() => { throw new Error(`unknown shape "${shape}"`); }))(W, H, args || {});
    else if (points) pts = points;
    else if (svg) {
      const subs = flattenPath(svg, { scale: scale || 1, dx: dx || 0, dy: dy || 0 });
      // a single svg layer may yield multiple subpaths → emit one paint per subpath
      for (const sub of subs) out.push({ points: sub, ...paint });
      continue;
    } else throw new Error('each layer needs shape | svg | points');
    out.push({ points: pts, ...paint });
  }
  return { layers: out, sheet: { width: W, height: H, paper: spec.paper, paperSeed: spec.paperSeed, scale: spec.scale || 2 } };
}

// ---------------------------------------------------------------------------
const a = parseArgs(process.argv.slice(2));

let layers, sheet, out;
if (a.spec) {
  const spec = JSON.parse(await readFile(a.spec, 'utf8'));
  ({ layers, sheet } = await layersFromSpec(spec));
  out = a._out || 'watercolor-shape.png';
} else {
  const W = a.width ? +a.width : 640, H = a.height ? +a.height : 640;
  layers = await layersFromArgs(a, W, H);
  sheet = { width: W, height: H, paper: a.paper, scale: 2 };
  out = a.out || a._out || 'watercolor-shape.png';
}

const canvas = renderShapes(layers, sheet);
await writeCanvas(canvas, out);
console.log(`wrote ${out} (${canvas.width}×${canvas.height}px, ${layers.length} layer${layers.length === 1 ? '' : 's'})`);
