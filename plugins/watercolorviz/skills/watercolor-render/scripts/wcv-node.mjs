// Shared Node helpers for headless watercolorviz rendering.
//
// watercolorviz draws to a <canvas>. In Node we back that with `node-canvas`
// (the `canvas` package). Every DOM/window access in the library is feature-
// detected, so the ONLY shim needed is `document.createElement('canvas')` for
// the engine's offscreen marks. We pass a node-canvas straight in as the target.

import { createCanvas } from 'canvas';

// Minimal DOM shim: the engine creates offscreen <canvas> elements for marks.
if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tag) {
      if (tag === 'canvas') return createCanvas(1, 1);
      throw new Error(`wcv-node: unsupported document.createElement('${tag}')`);
    },
  };
}

export { createCanvas };

// Resolve watercolorviz from the locally installed npm package (see package.json)
// so it works offline once installed. Imported after the shim is in place.
export const lib = await import('watercolorviz');

/**
 * Render a chart to a node-canvas.
 * @param {string} chartName  e.g. 'Bar' (must be an exported chart class)
 * @param {object} data       the chart's data object
 * @param {object} options    shared + chart-specific options
 * @param {number} width      logical width  (px)
 * @param {number} height     logical height (px)
 * @param {number} scale      pixel density / supersampling (1 = exact, 2 = retina)
 * @returns {import('canvas').Canvas}
 */
export function renderChart(chartName, data, options = {}, width = 720, height = 480, scale = 2) {
  const Cls = lib[chartName];
  if (typeof Cls !== 'function') {
    throw new Error(`Unknown chart "${chartName}". Exported charts: ${chartClasses().join(', ')}`);
  }
  const canvas = createCanvas(width, height);
  // animation:false → final frame drawn synchronously (no requestAnimationFrame
  // in Node anyway). dpr drives supersampling; the Chart resizes the canvas.
  // eslint-disable-next-line no-new
  new Cls(canvas, { ...options, data, width, height, dpr: scale, animation: false, interactive: false });
  return canvas;
}

/** Names of every exported chart class. */
export function chartClasses() {
  return Object.keys(lib).filter((k) => {
    const v = lib[k];
    return typeof v === 'function' && /^[A-Z]/.test(k) && v.prototype instanceof lib.Chart;
  });
}

/**
 * Paint arbitrary shapes onto a fresh watercolor sheet.
 * @param {Array<{points:[number,number][], color?:string, seed?:number, [k:string]:any}>} layers
 * @param {object} sheet  { width, height, paper, paperSeed }
 * @returns {import('canvas').Canvas}
 */
export function renderShapes(layers, sheet = {}) {
  const { width = 640, height = 640, paper = '#f7efe1', paperSeed = 7, scale = 2 } = sheet;
  // Render at full output resolution and scale the GEOMETRY (not the context):
  // paintPaper writes device-pixel image data, so a scaled context would misplace
  // it. Points come in logical (width×height) coords; multiply by `scale`.
  const W = Math.round(width * scale);
  const H = Math.round(height * scale);
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  lib.paintPaper(ctx, W, H, { color: paper, seed: paperSeed });
  for (const layer of layers) {
    const { points, ...opts } = layer;
    const pts = scale === 1 ? points : points.map(([x, y]) => [x * scale, y * scale]);
    lib.paintPolygon(ctx, pts, opts);
  }
  return canvas;
}

/** Write a node-canvas to a PNG file. */
export async function writeCanvas(canvas, outPath) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(outPath, canvas.toBuffer('image/png'));
  return outPath;
}
