// Render a watercolorviz chart to a PNG, headlessly.
//
//   node render-chart.mjs <config.json> [out.png]
//   node render-chart.mjs -          [out.png]   # read config JSON from stdin
//
// config.json:
//   {
//     "chart":   "Bar",                 // any exported chart class
//     "data":    { ... },               // the chart's data object
//     "options": { "title": "...", "colors": [...], "seed": 7, ... },
//     "width":   720,                   // logical px (default 720)
//     "height":  480,                   // logical px (default 480)
//     "scale":   2                      // supersampling: 2 = retina-crisp (default 2)
//   }
//
// See reference/config-schema.md (and the watercolor-charts skill's
// reference/chart-api.md) for every chart's data shape and options.

import { readFile } from 'node:fs/promises';
import { renderChart, writeCanvas, chartClasses } from './wcv-node.mjs';

async function readConfig(src) {
  if (src === '-' || src === '/dev/stdin') {
    const chunks = [];
    for await (const c of process.stdin) chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
  return JSON.parse(await readFile(src, 'utf8'));
}

const [, , configPath, outArg] = process.argv;
if (!configPath) {
  console.error('usage: node render-chart.mjs <config.json|-> [out.png]');
  console.error('charts:', chartClasses().join(', '));
  process.exit(1);
}

const cfg = await readConfig(configPath);
if (!cfg.chart || !cfg.data) {
  console.error('config must include at least { "chart": "...", "data": {...} }');
  process.exit(1);
}

const out = outArg || `watercolor-${cfg.chart.toLowerCase()}.png`;
const canvas = renderChart(
  cfg.chart,
  cfg.data,
  cfg.options || {},
  cfg.width || 720,
  cfg.height || 480,
  cfg.scale || 2,
);
await writeCanvas(canvas, out);
console.log(`wrote ${out} (${canvas.width}×${canvas.height}px)`);
