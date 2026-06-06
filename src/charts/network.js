// Network graph — Primitive D nodes (blobs) + faked stroke edges (ink lines).
//
// No new brushstroke engine: edges are thin hand-drawn ink lines between node
// centres, nodes are soft grainy blobs painted on top. Node positions are given
// in normalised [0,1] coordinates (mapped into the plot) or as pixels.

import { Chart } from '../chart.js';
import { inkLine } from '../axes.js';
import { paintDot, paintDotSelection } from './shapes.js';

export class Network extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const nodes = config.data.nodes;
    const links = config.data.links || [];
    this.paintBackground();

    const norm = config.pixels !== true;
    const px = (n) => (norm ? plot.x0 + n.x * plot.w : n.x);
    const py = (n) => (norm ? plot.y0 + n.y * plot.h : n.y);
    const radius = (n) => n.r || config.radius || 15;
    const selected = nodes.map((_, i) => this.selectionProgress(i));
    const active = Math.max(0, ...selected);
    const neighborCue = new Array(nodes.length).fill(0);
    links.forEach(([i, j]) => {
      neighborCue[i] = Math.max(neighborCue[i], selected[j] * 0.45);
      neighborCue[j] = Math.max(neighborCue[j], selected[i] * 0.45);
    });

    // Edges first (under the nodes).
    links.forEach(([i, j], k) => {
      const a = nodes[i];
      const b = nodes[j];
      const reveal = this.loadProgress(k);
      if (reveal <= 0) return;
      const x1 = px(a);
      const y1 = py(a);
      const x2 = x1 + (px(b) - x1) * reveal;
      const y2 = y1 + (py(b) - y1) * reveal;
      const focus = Math.max(selected[i], selected[j]);
      const unrelatedFade = active > 0 && focus <= 0 ? 1 - active * 0.42 : 1;
      inkLine(ctx, x1, y1, x2, y2, {
        color: focus > 0 ? '#000000' : config.edgeColor || ink,
        opacity: (0.48 + focus * 0.42) * unrelatedFade,
        width: 1.25 + focus * 1.45,
        jitter: 1.2,
        seed: seed + k,
      });
    });

    // Nodes.
    nodes.forEach((n, i) => {
      const color = n.color || this.colorFor(i);
      const r = radius(n);
      const reveal = this.loadProgress(links.length + i);
      if (reveal <= 0) return;
      const focus = Math.max(selected[i], neighborCue[i]);
      const unrelatedFade = active > 0 && focus <= 0 ? 1 - active * 0.28 : 1;
      const scale = 0.72 + reveal * 0.28;
      ctx.save();
      ctx.globalAlpha = (0.25 + reveal * 0.75) * unrelatedFade;
      ctx.translate(px(n), py(n));
      ctx.scale(scale, scale);
      paintDot(ctx, 0, 0, r, { color, seed: seed + i * 11, intensity: 0.95, outline: true, ink });
      ctx.restore();

      if (neighborCue[i] > 0) {
        paintDotSelection(ctx, px(n), py(n), r, { color, progress: neighborCue[i], glow: true });
      }
      paintDotSelection(ctx, px(n), py(n), r, { color, progress: selected[i], glow: true });

      if (n.label) {
        ctx.save();
        ctx.globalAlpha = unrelatedFade;
        this.text(n.label, px(n), py(n) + r + 11, { size: 12 });
        ctx.restore();
      }
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    this.setInteractiveMarks(nodes.map((n, i) => ({
      index: i,
      cx: px(n),
      cy: py(n),
      r: radius(n),
      color: n.color || this.colorFor(i),
      label: n.label != null ? `${n.label}` : `node ${i}`,
    })));
    this.scheduleLoadAnimation(links.length + nodes.length);
  }
}
