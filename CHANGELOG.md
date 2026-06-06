# Changelog

All notable changes to watercolorviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) once it reaches 1.0.

## [0.1.0] — 2026-06-06

First public release.

### Charts
Bar (incl. horizontal & grouped), Histogram, Heatmap, Area, Stacked Area /
Streamgraph, Ridgeline, Scatter / Bubble, Pie / Donut, Radar, Line (incl.
multi-series, log & time scales), Network, Sankey, Confidence Interval, Forest,
Likert, Calendar heatmap, Chord, Sparkline.

### Features
- Watercolor paint engine with paper grain, layered washes and hi-DPI rendering.
- Load + hover animations (respecting `prefers-reduced-motion`).
- Tooltips (with a `tooltipFormat` hook), responsive auto-resize, keyboard
  navigation and ARIA labels.
- Configurable colours, ink, paper, font, axes, legend; log/time scales and
  d3-format number/date tick formatting.
- Hand-drawn annotation layer (circles, arrows, callouts, bands, brackets).
- Live instance API: `update(config)`, `onClick`/`onHover` callbacks,
  `toDataURL()` / `toBlob()` export, `resize()` and `destroy()`.
- Input validation with clear errors and graceful empty states.
- Hand-authored TypeScript definitions; `node:test` suite and CI.
