// Watercolor-paper background.
//
// A warm off-white wash plus a *coherent* cold-press tooth sampled from the
// shared noise field (so pigment granulation can align to it). Optional soft
// edge shadow gives the "photo of a real sheet" feel.

import { fbm } from './noise.js';
import { hexToRgb } from './palette.js';

export function paintPaper(ctx, width, height, opts = {}) {
  const {
    color = '#f3efe2', // warm cream
    seed = 7,
    scale = 0.16, // paper tooth frequency (larger = finer grain)
    strength = 6, // tooth contrast (luminance ± per pixel) — subtle
    vignette = true,
  } = opts;

  const [br, bg, bb] = hexToRgb(color);

  const img = ctx.createImageData(width, height);
  const d = img.data;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Two scales: broad mottling + fine tooth.
      const n = fbm(x * scale, y * scale, seed, 4);
      const delta = (n - 0.5) * 2 * strength;
      const i = (y * width + x) * 4;
      d[i] = clamp(br + delta);
      d[i + 1] = clamp(bg + delta);
      d[i + 2] = clamp(bb + delta * 0.92); // slightly warmer in shadows
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // Soft shadow near the bottom/edges, like a sheet lit from above.
  if (vignette) {
    const g = ctx.createLinearGradient(0, height * 0.6, 0, height);
    g.addColorStop(0, 'rgba(120,110,90,0)');
    g.addColorStop(1, 'rgba(120,110,90,0.07)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
  }
}

function clamp(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
