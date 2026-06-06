// watercolorviz — public entry point.
//
// Re-exports the paint engine, paper, palette and chart classes so consumers
// can `import { Bar, paintPolygon } from 'watercolorviz'`.

export { paintPolygon, regularPolygon, clearMarkCache } from './watercolor.js';
export { paintPaper } from './paper.js';
export { VIVID, colorAt, hexToRgb, shades, diverging, sequential } from './palette.js';
export { inkLine, arrowhead, tick, INK } from './axes.js';
export { buildScale, tickFormat } from './scale.js';
export { annotateArrow, annotateCircle, annotateText, annotateCallout, annotateBand, annotateBracket } from './annotate.js';
export { Chart } from './chart.js';
export {
  rectPoints,
  paintRectWash,
  paintRectWashReveal,
  paintRectSelection,
  paintPolygonSelection,
  withRevealClip,
  areaPolygon,
  bandPolygon,
  paintAreaWash,
  paintBandWash,
  wedgePolygon,
  paintWedge,
  paintClosedWash,
  paintFillWash,
  paintDot,
} from './charts/shapes.js';
export { inkPath } from './axes.js';
export { Bar } from './charts/bar.js';
export { Histogram } from './charts/histogram.js';
export { Heatmap } from './charts/heatmap.js';
export { Area } from './charts/area.js';
export { Ridgeline } from './charts/ridgeline.js';
export { StackedArea } from './charts/stacked.js';
export { Scatter } from './charts/scatter.js';
export { Pie } from './charts/pie.js';
export { Radar } from './charts/radar.js';
export { Line } from './charts/line.js';
export { Network } from './charts/network.js';
export { Sankey } from './charts/sankey.js';
export { Interval } from './charts/interval.js';
export { Sparkline } from './charts/sparkline.js';
export { Likert } from './charts/likert.js';
export { Forest } from './charts/forest.js';
export { Calendar } from './charts/calendar.js';
export { Chord } from './charts/chord.js';
