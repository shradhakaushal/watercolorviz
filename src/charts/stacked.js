// Stacked area / streamgraph — Primitive B (arbitrary filled polygon).
//
// Stacks several series as translucent grainy bands. `stream: true` uses a
// wiggle-minimized streamgraph baseline and inside-out layer ordering.

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { shades, sequential } from '../palette.js';
import { inkPath, tick } from '../axes.js';
import { bandPolygon, paintBandWash, paintPolygonSelection, withRevealClip } from './shapes.js';

export class StackedArea extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const xs = config.data.x;
    const stream = config.stream;
    this.paintBackground();

    // Readability cap: too many bands turn a watercolor streamgraph to mush.
    // Keep the largest (maxSeries-1) and collapse the rest into an "Other" band.
    let series = config.data.series; // { name: [values...] }
    let names = Object.keys(series);
    const maxSeries = config.maxSeries ?? 8;
    if (names.length > maxSeries) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          `watercolorviz: ${names.length} series exceeds maxSeries=${maxSeries}; ` +
          (config.groupOther === false ? 'rendering all (groupOther:false).' : 'collapsing the smallest into "Other".'),
        );
      }
      if (config.groupOther !== false) {
        const ranked = names
          .map((nm) => ({ nm, total: series[nm].reduce((s, v) => s + v, 0) }))
          .sort((a, b) => b.total - a.total);
        const keep = ranked.slice(0, maxSeries - 1).map((d) => d.nm);
        const drop = ranked.slice(maxSeries - 1).map((d) => d.nm);
        const grouped = {};
        keep.forEach((nm) => { grouped[nm] = series[nm]; });
        grouped.Other = xs.map((_, i) => drop.reduce((s, nm) => s + series[nm][i], 0));
        series = grouped;
        names = Object.keys(series);
      }
    }

    const rows = xs.map((xv, i) => {
      const row = { x: xv };
      names.forEach((name) => {
        row[name] = series[name][i];
      });
      return row;
    });
    const stack = d3.stack()
      .keys(names)
      .order(stream ? d3.stackOrderInsideOut : d3.stackOrderNone)
      .offset(stream ? d3.stackOffsetWiggle : d3.stackOffsetNone)(rows);

    const x = d3.scaleLinear().domain(d3.extent(xs)).range([0, plot.w]);
    const yDomain = stream
      ? [d3.min(stack, (layer) => d3.min(layer, (d) => d[0])), d3.max(stack, (layer) => d3.max(layer, (d) => d[1]))]
      : [0, d3.max(stack, (layer) => d3.max(layer, (d) => d[1]))];
    const y = d3.scaleLinear().domain(yDomain).nice().range([plot.h, 0]);
    this.project = (dx, dy) => [plot.x0 + x(dx), plot.y0 + y(dy)];

    // Colour mode. Explicit `colors` → those hues. A single `color` → a
    // monochromatic dark→light ramp. Otherwise a viridis-style SEQUENTIAL
    // palette (good for ordered stacked layers, like the reference).
    const useRamp = !(Array.isArray(config.colors) && config.colors.length);
    const colors = !useRamp
      ? names.map((_, si) => this.colorFor(si))
      : config.color
        ? shades(config.color, names.length)
        : sequential(names.length);
    // Boundary lines: with watercolor it's unclear where one band ends, so every
    // band is fully enclosed by a crisp, continuous, near-black line by default
    // (configurable). Explicit-colour mode keeps the warm ink edge.
    const sepColor = config.separator || config.boundaryColor || (useRamp ? '#141414' : ink);
    const sepOpacity = config.boundaryOpacity ?? (useRamp ? 0.92 : 0.6);

    // Bands are drawn bottom→top; extend each band's bottom a few px DOWN into
    // the band already painted below it, so the hand-painted edges overlap and
    // no paper seam shows between layers. This applies to the streamgraph too —
    // its wiggly bands would otherwise leave white seams between layers. Sides
    // are pushed out + clipped so the left/right edges stay clean; in the
    // non-stream case the bottom band is also pushed down to the axis.
    const SEAM = 6;
    const ov = 18;
    // Crisp wash edges (small bleed) so the pigment sits ON the boundary lines
    // instead of wobbling/retreating inward and showing paper.
    const washBleed = config.bleed ?? 0.022;
    const marks = [];
    // The exact outer silhouette (upper contour + lower contour). All fills are
    // clipped to it, so the both-edge overshoot below can fill generously
    // without ever leaking past the outline.
    const upperSil = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(d3.max(stack, (layer) => layer[i][1]))]);
    const lowerSil = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(d3.min(stack, (layer) => layer[i][0]))]);
    this.withPlotClip(() => {
      ctx.save();
      ctx.beginPath();
      upperSil.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
      for (let i = lowerSil.length - 1; i >= 0; i--) ctx.lineTo(lowerSil[i][0], lowerSil[i][1]);
      ctx.closePath();
      ctx.clip();
      stack.forEach((layer, si) => {
        const colorIndex = names.indexOf(layer.key);
        const topPts = layer.map((d) => [plot.x0 + x(d.data.x), plot.y0 + y(d[1])]);
        const bandBotPts = layer.map((d) => [plot.x0 + x(d.data.x), plot.y0 + y(d[0])]);
        // Overlap neighbouring bands on BOTH edges: the watercolor wash feathers
        // inward from the geometric edge, so abutting bands would leave a paper
        // seam and the (opaque) boundary ink would land on paper. Pushing each
        // band's top up and bottom down into its neighbours makes the pigment
        // continuous and puts the boundary line on solid colour. The crisp
        // boundary lines (drawn afterwards on the TRUE edges) hide the overlap.
        // Overshoot BOTH edges into the neighbours; the silhouette clip trims
        // the outer overshoot back to the outline, so fills stay continuous (no
        // paper seam) AND the outer edge is crisp on the boundary line.
        const paintTopPts = topPts.map(([px, py]) => [px, py - SEAM]);
        const paintBotPts = bandBotPts.map(([px, py]) => [px, py + SEAM]);
        const color = colors[colorIndex];
        const reveal = this.loadProgress(si);
        const extend = { x0: plot.x0, x1: plot.x1, ov, bottomOv: !stream && si === 0 ? ov : 0 };
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, reveal, () => {
          paintBandWash(ctx, paintTopPts, paintBotPts, { color, seed: seed + si * 17, intensity: 0.95, extend, bleed: washBleed });
        });
        marks.push({
          index: si,
          points: bandPolygon(topPts, bandBotPts),
          top: topPts,
          color,
          seed: seed + si * 17,
          label: layer.key,
        });
      });
      ctx.restore(); // end the silhouette clip (fills only)
      marks.forEach((mark) => {
        paintPolygonSelection(ctx, mark.points, {
          color: mark.color,
          outlinePoints: mark.points,
          closedOutline: true,
          boundaryStrength: stream ? 0.72 : 0.82,
          glowStrength: stream ? 1.1 : 1,
          progress: this.selectionProgress(mark.index),
        });
      });
      // Boundaries: each band's top (= its neighbour's bottom) plus, for a
      // stream, the lower silhouette — so every layer is fully enclosed.
      const boundaryWidth = config.boundaryWidth ?? 1.15;
      marks.forEach((mark) => {
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, this.loadProgress(mark.index), () => {
          inkPath(ctx, mark.top, { seed: mark.seed, width: boundaryWidth, opacity: sepOpacity, color: sepColor, gaps: false, uniform: true });
        });
      });
      if (stream && config.boundary !== false) {
        const bottomSil = xs.map((xv, i) => [plot.x0 + x(xv), plot.y0 + y(d3.min(stack, (layer) => layer[i][0]))]);
        withRevealClip(ctx, plot.x0, plot.y0, plot.w, plot.h, this.loadProgress(names.length - 1), () => {
          inkPath(ctx, bottomSil, { seed: seed + 999, width: boundaryWidth, opacity: sepOpacity, color: sepColor, gaps: false, uniform: true });
        });
      }
    }, { bottom: !stream });
    this.setInteractiveMarks(marks);

    if (!useRamp && config.legend !== false) {
      this.drawLegend(names.map((k, si) => ({ label: k, color: colors[si] })), {
        orientation: 'vertical',
        x: plot.x1 - 92,
        y: plot.y0 + 10,
      });
    }

    // Axes exist for the streamgraph too (the y-scale is the wiggle offset).
    for (const t of y.ticks(5)) {
      const ty = plot.y0 + y(t);
      tick(ctx, plot.x0, ty, false, { color: ink });
      this.text(String(t), plot.x0 - 11, ty, { size: 13, align: 'right' });
    }
    for (const t of x.ticks(6)) {
      const tx = plot.x0 + x(t);
      tick(ctx, tx, plot.y1, true, { color: ink });
      this.text(String(t), tx, plot.y1 + 16, { size: 12 });
    }
    this.drawAxisLines();
    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(marks.length);
  }
}
