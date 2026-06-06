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
import {
  paintFillWash,
  paintPolygonSelection,
  paintRectSelection,
  paintRectWash,
} from './shapes.js';

// Sampled horizontal cubic bezier from (x0,y0) to (x1,y1) — the classic Sankey
// S-curve (control points pulled to the horizontal midpoint).
function ribbonEdge(x0, y0, x1, y1, segs = 32) {
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

function boundsFor(points) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of points) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
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

    const nodeW = config.nodeWidth || 10;
    const pad = config.nodePadding || 24;
    const tallest = columns.reduce((m, c) => Math.max(m, c.length), 1);
    const scale = (plot.h - pad * (tallest - 1)) / maxColTotal;

    // Reserve horizontal room for the outside labels on the first/last columns.
    const labelGap = config.labelSpace ?? 62;
    const xLeft = plot.x0 + labelGap;
    const xRight = plot.x1 - labelGap - nodeW;
    const span = Math.max(0, xRight - xLeft);

    // Place each node's rectangle; columns centred vertically.
    const rect = new Array(N);
    columns.forEach((c, ci) => {
      const colH = colTotal[ci] * scale + pad * (c.length - 1);
      let y = plot.y0 + (plot.h - colH) / 2;
      const x = xLeft + (ci / (maxLayer || 1)) * span;
      for (const i of c) {
        rect[i] = { x, y, w: nodeW, h: nodeValue[i] * scale };
        y += rect[i].h + pad;
      }
    });

    // Links (ribbons) under the nodes; attachments stack along each node edge.
    const outOff = new Array(N).fill(0);
    const inOff = new Array(N).fill(0);
    const flowMarks = [];
    const linkProgress = links.map((_, li) => this.selectionProgress(li));
    const active = Math.max(0, ...linkProgress);
    const nodeFocus = new Array(N).fill(0);
    links.forEach((l, li) => {
      nodeFocus[l.source] = Math.max(nodeFocus[l.source], linkProgress[li]);
      nodeFocus[l.target] = Math.max(nodeFocus[l.target], linkProgress[li]);
    });
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
      flowMarks.push({
        index: li,
        points: poly,
        ...boundsFor(poly),
        hitPad: 0,
        source: l.source,
        target: l.target,
        color: config.linkColor || this.colorFor(l.source),
        label: `${names[l.source]} → ${names[l.target]}: ${l.value}`,
      });
      const color = config.linkColor || this.colorFor(l.source);
      // Low bleed → cleaner ribbon edges (a polished Sankey, not a wavy blob);
      // `soft: true` loosens the boundaries so it reads less like plumbing.
      const flowBleed = config.flowBleed ?? (config.soft ? 0.05 : 0.012);
      const flowIntensity = config.linkIntensity ?? (config.soft ? 0.42 : 0.58);
      const reveal = this.loadProgress(li);
      const fade = active > 0 && linkProgress[li] <= 0 ? 1 - active * 0.38 : 1;
      ctx.save();
      ctx.globalAlpha = (0.25 + reveal * 0.75) * fade;
      ctx.beginPath();
      ctx.rect(plot.x0, plot.y0, plot.w * reveal, plot.h);
      ctx.clip();
      paintFillWash(ctx, poly, { color, seed: seed + li * 7, intensity: flowIntensity, ink, bleed: flowBleed });
      ctx.restore();
    });

    flowMarks.forEach((mark) => {
      paintPolygonSelection(ctx, mark.points, {
        color: mark.color,
        outlinePoints: mark.points,
        closedOutline: true,
        boundaryStrength: 0.82,
        glowStrength: 0.9,
        progress: this.selectionProgress(mark.index),
      });
    });

    // Nodes + labels. Labels sit OUTSIDE the flow: left column to the left,
    // right column to the right, interior columns above their node.
    names.forEach((name, i) => {
      const r = rect[i];
      const reveal = this.loadProgress(links.length + i);
      const fade = active > 0 && nodeFocus[i] <= 0 ? 1 - active * 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = (0.3 + reveal * 0.7) * fade;
      paintRectWash(ctx, r.x, r.y, r.w, r.h, { color: this.colorFor(i), seed: seed + 100 + i, ink });
      ctx.restore();
      paintRectSelection(ctx, r.x, r.y, r.w, r.h, {
        color: this.colorFor(i),
        seed: seed + 100 + i,
        progress: nodeFocus[i] * 0.85,
      });
      const cy = r.y + r.h / 2;
      ctx.save();
      ctx.globalAlpha = fade;
      if (layer[i] === 0) {
        this.text(name, r.x - 7, cy, { size: 12, align: 'right' });
      } else if (layer[i] === maxLayer) {
        this.text(name, r.x + r.w + 7, cy, { size: 12, align: 'left' });
      } else {
        this.text(name, r.x + r.w / 2, r.y - 9, { size: 12, align: 'center' });
      }
      ctx.restore();
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    this.setInteractiveMarks(flowMarks);
    this.scheduleLoadAnimation(links.length + N);
  }
}
