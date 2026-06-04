// Vertical bar chart — Primitive A (rectangular wash).
//
// The first real chart: it proves the engine + D3 scales + hand-drawn ink
// chrome compose into something that reads like the painted reference. Each bar
// is a (slightly wobbly) rectangle handed to `paintPolygon` with an ink
// outline; the axes/ticks/labels are drawn crisply on top.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { paintPolygon } from '../watercolor.js';
import { colorAt } from '../palette.js';
import { inkLine, arrowhead, tick, INK } from '../axes.js';

// A rectangle as a closed polygon with subdivided edges, so the paint engine's
// gentle edge wobble has points to act on (4 corners alone would round into a
// blob). Wound clockwise from the top-left.
function rectPoints(x, y, w, h, per = 5) {
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

export class Bar extends Chart {
  render() {
    const { ctx, plot, seed, config } = this;
    const { labels, values } = config.data;

    this.paintBackground();

    const x = d3.scaleBand().domain(labels).range([0, plot.w]).padding(0.36);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(values)])
      .nice()
      .range([plot.h, 0]);

    // Faint horizontal gridlines first, under the bars.
    if (config.grid !== false) {
      for (const t of y.ticks(5)) {
        const gy = plot.y0 + y(t);
        inkLine(ctx, plot.x0, gy, plot.x1, gy, {
          opacity: 0.08,
          width: 1,
          jitter: 0.5,
          seed: seed + t,
        });
      }
    }

    // Bars: watercolor fills with a line-and-wash ink outline.
    values.forEach((v, i) => {
      const bw = x.bandwidth();
      const bx = plot.x0 + x(labels[i]);
      const top = plot.y0 + y(v);
      const bh = plot.y1 - top;
      if (bh <= 0) return;
      const color = (config.colors && config.colors[i]) || colorAt(i);
      paintPolygon(ctx, rectPoints(bx, top, bw, bh), {
        color,
        seed: seed + i * 13,
        outline: true,
        intensity: 1.1, // dense enough to read as pigment, grain still shows
        bleed: 0.03, // keep it rectangular; just a hand-painted waver
        shading: 0.15, // a flat matte wash — NOT a glossy 3D gradient
        mottle: 0.28, // gentle cloud; let the grain (not big blotches) dominate
        granulation: 0.55, // strong cold-press paper grain (the reference look)
        paperScale: 0.3, // finer tooth → fine even speckle, not soft blobs
      });
    });

    this.drawAxes(x, y, labels);

    if (config.title) {
      this.text(config.title, this.width / 2, this.margin.top / 2, { size: 22 });
    }
    if (config.yLabel) {
      ctx.save();
      ctx.translate(14, plot.y0 + plot.h / 2);
      ctx.rotate(-Math.PI / 2);
      this.text(config.yLabel, 0, 0, { size: 14 });
      ctx.restore();
    }
    if (config.xLabel) {
      this.text(config.xLabel, plot.x0 + plot.w / 2, this.height - 8, { size: 14 });
    }
  }

  drawAxes(x, y, labels) {
    const { ctx, plot, seed } = this;

    // y ticks + numbers
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false);
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }

    // x category labels
    labels.forEach((lab) => {
      const tx = plot.x0 + x(lab) + x.bandwidth() / 2;
      this.text(lab, tx, plot.y1 + 17, { size: 14 });
    });

    // Axis lines with little arrowheads, drawn on top.
    inkLine(ctx, plot.x0, plot.y1, plot.x1 + 8, plot.y1, { seed: seed + 1 });
    arrowhead(ctx, plot.x1 + 12, plot.y1, 1, 0);
    inkLine(ctx, plot.x0, plot.y1, plot.x0, plot.y0 - 8, { seed: seed + 2 });
    arrowhead(ctx, plot.x0, plot.y0 - 12, 0, -1);
  }
}
