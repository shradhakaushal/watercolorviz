// Default vivid watercolor palette for v0.
//
// Fixed (not user-configurable yet — that's v1). Order: blue, violet, yellow,
// orange, green. Tuned to read as bright pigments rather than flat web colors.

export const VIVID = [
  '#2e6fb7', // blue
  '#7c4dbd', // violet
  '#f4c430', // yellow
  '#ef8c3b', // orange
  '#4ca85f', // green
];

// Color for the i-th mark, cycling through the palette.
export function colorAt(i) {
  return VIVID[((i % VIVID.length) + VIVID.length) % VIVID.length];
}

// Parse "#rrggbb" -> [r, g, b]. Used by the paint engine to build rgba() fills.
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function toHex([r, g, b]) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

// `n` monochromatic shades of one hue, dark → light. Powers the streamgraph's
// stacked-layer look (and any "ramp of one colour" need).
export function shades(hex, n) {
  const [r, g, b] = hexToRgb(hex);
  const dark = [r * 0.58, g * 0.58, b * 0.58];
  const light = [r + (255 - r) * 0.74, g + (255 - g) * 0.74, b + (255 - b) * 0.74];
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 0.5 : i / (n - 1);
    return toHex(dark.map((d, k) => d + (light[k] - d) * t));
  });
}
