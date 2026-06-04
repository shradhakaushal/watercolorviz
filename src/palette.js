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
