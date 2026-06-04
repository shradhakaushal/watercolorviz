// Seedable 2D value noise — the shared "paper tooth" field.
//
// Both the paper background and the pigment granulation sample THIS field with
// the same seed/scale, so pigment settles into the same valleys the paper has.
// That coherence (pigment ↔ paper) is what makes granulation read as real
// watercolor rather than random speckle.

// Integer hash -> [0, 1). Cheap, deterministic, decent distribution.
function hash2(ix, iy, seed) {
  let h = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 69069)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise(x, y, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const v00 = hash2(x0, y0, seed);
  const v10 = hash2(x0 + 1, y0, seed);
  const v01 = hash2(x0, y0 + 1, seed);
  const v11 = hash2(x0 + 1, y0 + 1, seed);
  const a = v00 + (v10 - v00) * fx;
  const b = v01 + (v11 - v01) * fx;
  return a + (b - a) * fy;
}

// Fractal (multi-octave) value noise in [0, 1]. Octaves stack fine detail on
// coarse structure — like the mix of large fibers and fine tooth in real paper.
export function fbm(x, y, seed = 1, octaves = 4, lacunarity = 2, gain = 0.55) {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amp * valueNoise(x * freq, y * freq, seed + o * 101);
    norm += amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum / norm;
}
