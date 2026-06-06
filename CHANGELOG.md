# Changelog

All notable changes to watercolorviz are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and the project aims to follow
[Semantic Versioning](https://semver.org/) once it reaches 1.0.

## [Unreleased]

### Added
- **`update(config)`** — re-render a chart in place with new data/options
  (shallow-merged into config), recomputing layout and restarting the reveal.
- **`onClick(mark, event)` / `onHover(mark | null)`** interaction callbacks,
  with the mark payload `{ index, label, color }`. Clicks also fire from the
  keyboard (Enter/Space on the focused mark).
- **`toDataURL()` / `toBlob()`** image export.
- **`tooltipFormat(mark)`** hook to customise tooltip content.
- Render-coverage tests for every chart type (CI now exercises all 18 classes).
- Richer screen-reader `aria-label` summaries for non-categorical charts.

### Fixed
- TypeScript types for `Calendar` (`data.days`) and `Sparkline`
  (`number[]` | `{ y }`) now match the implementation.

## [0.1.0]

First public-ready release.

### Charts
Bar (incl. horizontal & grouped), Histogram, Heatmap, Area, Stacked Area /
Streamgraph, Ridgeline, Scatter / Bubble, Pie / Donut, Radar, Line (incl.
multi-series, log & time scales), Network, Sankey, Confidence Interval, Forest,
Likert, Calendar heatmap, Chord, Sparkline.

### Features
- Watercolor paint engine with paper grain, layered washes and hi-DPI rendering.
- Load + hover animations (respecting `prefers-reduced-motion`).
- Tooltips, responsive auto-resize, keyboard navigation and ARIA labels.
- Configurable colours, ink, paper, font, axes, legend; log/time scales and
  d3-format number/date tick formatting.
- Hand-drawn annotation layer (circles, arrows, callouts, bands, brackets).
- Input validation with clear errors and graceful empty states.
- Hand-authored TypeScript definitions; `node:test` suite and CI.
