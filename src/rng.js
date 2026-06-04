// Seedable pseudo-random number generator (mulberry32).
//
// Watercolor rendering is heavy on randomness — without a fixed seed, every
// reflow/redraw would repaint differently and feel broken. This gives us a
// deterministic stream of floats in [0, 1) from a single integer seed.
//
// Returns a function: each call yields the next float in the sequence.

export function makeRng(seed = 1) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
