# Changelog

All notable changes to watercolorviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) once it reaches 1.0.

## [0.1.1] — 2026-06-07

### Fixed
- **Streamgraph / stacked area:** neighbouring bands no longer leave white paper
  seams, and the boundary lines now sit on the pigment instead of beside it. Bands
  overlap on both edges and all fills are clipped to the exact silhouette, so the
  fill stays continuous while the outline stays crisp.

### Added
- **Stacked area:** `bleed` (wash-edge softness; lower = crisper, default 0.022),
  `boundaryOpacity`, plus typings for `groupOther` and `boundary`.
- **Radar:** `gridColor`, `gridOpacity`, `gridWidth` to control the web (rings +
  spokes); `gridOpacity` scales both together.

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
