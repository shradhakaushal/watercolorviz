// Chord / connectogram — soft watercolor arcs + ribbons. d3.chord computes the
// layout; the ribbons are built as polygons here so they can be painted as
// translucent washes (not crisp SVG paths).
//
//   data: { names: [...], matrix: [[...], ...] }   // square flow matrix

import * as d3 from 'd3';
import { Chart } from '../chart.js';
import { paintWedge, paintFillWash, wedgePolygon, paintPolygonSelection, bloomReveal } from './shapes.js';

// Points along a ring arc (angles measured from 12 o'clock, like the wedges).
function arcPts(cx, cy, r, a0, a1, segs = 20) {
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = a0 + (a1 - a0) * (i / segs) - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Quadratic bezier through a control point (interior points only).
function quad(p0, c, p1, segs = 16) {
  const out = [];
  for (let i = 1; i < segs; i++) {
    const t = i / segs;
    const mt = 1 - t;
    out.push([
      mt * mt * p0[0] + 2 * mt * t * c[0] + t * t * p1[0],
      mt * mt * p0[1] + 2 * mt * t * c[1] + t * t * p1[1],
    ]);
  }
  return out;
}

export class Chord extends Chart {
  render() {
    const { ctx, plot, seed, config, ink } = this;
    const { names, matrix } = config.data;
    this.paintBackground();

    const chords = d3.chord().padAngle(0.06).sortSubgroups(d3.descending)(matrix);
    const cx = plot.x0 + plot.w / 2;
    const cy = plot.y0 + plot.h / 2;
    const R = Math.min(plot.w, plot.h) / 2 - 26;
    const r0 = R - 13; // inner radius where ribbons attach

    // Group arcs around the ring. Each wedge blooms outward from the centre.
    const marks = [];
    chords.groups.forEach((g, i) => {
      const color = this.colorFor(i);
      const a0 = g.startAngle - Math.PI / 2;
      const a1 = g.endAngle - Math.PI / 2;
      bloomReveal(ctx, cx, cy, R, this.loadProgress(i), () => {
        paintWedge(ctx, cx, cy, r0, R, a0, a1, { color, seed: seed + i, ink });
      });
      const mid = (g.startAngle + g.endAngle) / 2 - Math.PI / 2;
      this.text(names[i], cx + Math.cos(mid) * (R + 15), cy + Math.sin(mid) * (R + 15), { size: 11 });
      marks.push({ index: i, points: wedgePolygon(cx, cy, r0, R, a0, a1), color, label: `${names[i]}: ${Math.round(g.value)}` });
    });

    // Ribbons: source arc → curve through centre → target arc → curve back. They
    // wash in just after the ring (a single fade keyed off the last group).
    const ribbonReveal = this.loadProgress(chords.groups.length);
    chords.forEach((ch, ci) => {
      const s = ch.source;
      const t = ch.target;
      const sa = arcPts(cx, cy, r0, s.startAngle, s.endAngle);
      const ta = arcPts(cx, cy, r0, t.startAngle, t.endAngle);
      const poly = [
        ...sa,
        ...quad(sa[sa.length - 1], [cx, cy], ta[0]),
        ...ta,
        ...quad(ta[ta.length - 1], [cx, cy], sa[0]),
      ];
      ctx.save();
      ctx.globalAlpha = ribbonReveal;
      paintFillWash(ctx, poly, { color: this.colorFor(s.index), seed: seed + 100 + ci, intensity: 0.4, ink, bleed: 0.02 });
      ctx.restore();
    });

    // Hover: deepen the hovered group's wedge and re-ink its edge.
    marks.forEach((mark) => {
      paintPolygonSelection(ctx, mark.points, { color: mark.color, progress: this.selectionProgress(mark.index) });
    });
    this.setInteractiveMarks(marks);

    this.drawTitleAndLabels();
    this.scheduleLoadAnimation(chords.groups.length + 1);
  }
}
