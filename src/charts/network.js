// Network graph — Primitive D nodes (blobs) + faked stroke edges (ink lines).
//
// No new brushstroke engine: edges are thin hand-drawn ink lines between node
// centres, nodes are soft grainy blobs painted on top. Node positions are given
// in normalised [0,1] coordinates (mapped into the plot) or as pixels.

import { Chart } from '../chart.js';
import { colorAt } from '../palette.js';
import { inkLine } from '../axes.js';
import { paintDot } from './shapes.js';

export class Network extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const nodes = config.data.nodes;
    const links = config.data.links || [];
    this.paintBackground();

    const norm = config.pixels !== true;
    const px = (n) => (norm ? plot.x0 + n.x * plot.w : n.x);
    const py = (n) => (norm ? plot.y0 + n.y * plot.h : n.y);

    // Edges first (under the nodes).
    links.forEach(([i, j], k) => {
      const a = nodes[i];
      const b = nodes[j];
      inkLine(ctx, px(a), py(a), px(b), py(b), { opacity: 0.5, width: 1.4, jitter: 1.2, seed: seed + k });
    });

    // Nodes.
    nodes.forEach((n, i) => {
      const color = n.color || (config.colors && config.colors[i % config.colors.length]) || colorAt(i);
      paintDot(ctx, px(n), py(n), n.r || config.radius || 15, { color, seed: seed + i * 11, intensity: 0.95, outline: true });
      if (n.label) this.text(n.label, px(n), py(n) + (n.r || 15) + 11, { size: 12 });
    });

    if (config.title) this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
  }
}
