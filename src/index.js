// watercolorviz — public entry point.
//
// Re-exports the paint engine, paper, palette and chart classes so consumers
// can `import { Bar, paintPolygon } from 'watercolorviz'`.

export { paintPolygon, regularPolygon, clearMarkCache } from './watercolor.js';
export { paintPaper } from './paper.js';
export { VIVID, colorAt, hexToRgb } from './palette.js';
export { inkLine, arrowhead, tick, INK } from './axes.js';
export { Chart } from './chart.js';
export { rectPoints, paintRectWash } from './charts/shapes.js';
export { Bar } from './charts/bar.js';
export { Histogram } from './charts/histogram.js';
export { Heatmap } from './charts/heatmap.js';
