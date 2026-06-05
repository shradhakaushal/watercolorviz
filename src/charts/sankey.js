// Sankey diagram — flows as filled watercolor ribbons between stacked nodes.
//
// Nodes are laid out in columns (by longest-path depth) and sized by their
// throughput; each link is a translucent ribbon (a cubic-curved Primitive-B
// polygon) from the right of its source to the left of its target. No
// d3-sankey dependency — the layout is computed here.
//
//   data: {
//     nodes: ['A', 'B', ...],                      // names (or { name })
//     links: [{ source, target, value }, ...],     // names or indices
//   }

import { Chart } from '../chart.js';
import { paintRectWash, paintFillWash } from './shapes.js';

// Sampled horizontal cubic bezier from (x0,y0) to (x1,y1) — the classic Sankey
// S-curve (control points pulled to the horizontal midpoint).
function ribbonEdge(x0, y0, x1, y1, segs = 22) {
  const cx = (x0 + x1) / 2;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const mt = 1 - t;
    const x = mt * mt * mt * x0 + 3 * mt * mt * t * cx + 3 * mt * t * t * cx + t * t * t * x1;
    const y = mt * mt * mt * y0 + 3 * mt * mt * t * y0 + 3 * mt * t * t * y1 + t * t * t * y1;
    pts.push([x, y]);
  }
  return pts;
}

export class Sankey extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    this.paintBackground();

    const names = config.data.nodes.map((n) => (typeof n === 'string' ? n : n.name));
    const index = new Map(names.map((n, i) => [n, i]));
    const resolve = (v) => (typeof v === 'number' ? v : index.get(v));
    const links = config.data.links.map((l) => ({
      source: resolve(l.source),
      target: resolve(l.target),
      value: l.value,
    }));
    const N = names.length;

    // Longest-path layer (column) for each node.
    const layer = new Array(N).fill(0);
    for (let iter = 0; iter < N; iter++) {
      let changed = false;
      for (const l of links) {
        if (layer[l.target] < layer[l.source] + 1) {
          layer[l.target] = layer[l.source] + 1;
          changed = true;
        }
      }
      if (!changed) break;
    }
    const maxLayer = Math.max(0, ...layer);

    // Node throughput = max(in, out).
    const inSum = new Array(N).fill(0);
    const outSum = new Array(N).fill(0);
    for (const l of links) {
      outSum[l.source] += l.value;
      inSum[l.target] += l.value;
    }
    const nodeValue = names.map((_, i) => Math.max(inSum[i], outSum[i], 1e-6));

    const columns = Array.from({ length: maxLayer + 1 }, () => []);
    names.forEach((_, i) => columns[layer[i]].push(i));
    const colTotal = columns.map((c) => c.reduce((s, i) => s + nodeValue[i], 0));
    const maxColTotal = Math.max(...colTotal);

    const nodeW = config.nodeWidth || 14;
    const pad = config.nodePadding || 14;
    const tallest = columns.reduce((m, c) => Math.max(m, c.length), 1);
    const scale = (plot.h - pad * (tallest - 1)) / maxColTotal;

    // Place each node's rectangle; columns centred vertically.
    const rect = new Array(N);
    columns.forEach((c, ci) => {
      const colH = colTotal[ci] * scale + pad * (c.length - 1);
      let y = plot.y0 + (plot.h - colH) / 2;
      const x = plot.x0 + (ci / (maxLayer || 1)) * (plot.w - nodeW);
      for (const i of c) {
        rect[i] = { x, y, w: nodeW, h: nodeValue[i] * scale };
        y += rect[i].h + pad;
      }
    });

    // Links (ribbons) under the nodes; attachments stack along each node edge.
    const outOff = new Array(N).fill(0);
    const inOff = new Array(N).fill(0);
    links.forEach((l, li) => {
      const s = rect[l.source];
      const t = rect[l.target];
      const h = l.value * scale;
      const sy = s.y + outOff[l.source];
      const ty = t.y + inOff[l.target];
      outOff[l.source] += h;
      inOff[l.target] += h;
      const sx = s.x + s.w;
      const tx = t.x;
      const poly = ribbonEdge(sx, sy, tx, ty).concat(ribbonEdge(tx, ty + h, sx, sy + h));
      const color = config.linkColor || this.colorFor(l.source);
      paintFillWash(ctx, poly, { color, seed: seed + li * 7, intensity: config.linkIntensity ?? 0.5, ink });
    });

    // Nodes + labels.
    names.forEach((name, i) => {
      const r = rect[i];
      paintRectWash(ctx, r.x, r.y, r.w, r.h, { color: this.colorFor(i), seed: seed + 100 + i, ink });
      const onRight = layer[i] === maxLayer;
      this.text(name, onRight ? r.x - 6 : r.x + r.w + 6, r.y + r.h / 2, {
        size: 12,
        align: onRight ? 'right' : 'left',
      });
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
  }
}
