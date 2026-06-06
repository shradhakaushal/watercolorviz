// Sparkline — a tiny inline chart, no axes or chrome.
//
//   data: { y: [...] }  or  data: [...]      // type: 'line' (default) | 'area'

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { inkPath } from '../axes.js';
import { paintAreaWash, paintDot, withRevealClip } from './shapes.js';

export class Sparkline extends Chart {
  constructor(el, config = {}) {
    super(el, {
      width: config.width || 160,
      height: config.height || 40,
      margin: config.margin || { top: 7, right: 8, bottom: 7, left: 8 },
      ...config,
    });
  }

  render() {
    const { ctx, plot, seed, config, ink } = this;
    const ys = Array.isArray(config.data) ? config.data : config.data.y;
    this.paintBackground();

    const x = d3.scaleLinear().domain([0, ys.length - 1]).range([0, plot.w]);
    const y = d3.scaleLinear().domain(d3.extent(ys)).range([plot.h, 0]);
    const pts = ys.map((v, i) => [plot.x0 + x(i), plot.y0 + y(v)]);
    const color = this.colorFor(0);

    // Draw on left → right, like a pen tracing the trend.
    const reveal = this.loadProgress(0);
    withRevealClip(ctx, plot.x0, plot.y0 - 4, plot.w, plot.h + 8, reveal, () => {
      if (config.type === 'area') {
        const extend = { x0: plot.x0, x1: plot.x1, ov: 8 };
        this.withPlotClip(() => {
          paintAreaWash(ctx, pts, plot.y1, { color, seed, intensity: 0.7, extend });
        });
      }
      inkPath(ctx, pts, { seed, width: 1.6, gaps: false, color: config.type === 'area' ? ink : color });
    });

    // The end dot lands once the line reaches it.
    if (config.dot !== false && reveal > 0.92) {
      const last = pts[pts.length - 1];
      paintDot(ctx, last[0], last[1], 3.5, { color: config.dotColor || color, seed, intensity: 1, outline: true, ink });
    }
    this.scheduleLoadAnimation(1);
  }
}
