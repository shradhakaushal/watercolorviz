# watercolorviz

A library for **watercolor-style data visualizations** — soft bleeding edges, translucent layered
washes, paper-grain granulation, and hand-drawn line-and-wash ink. Like
[roughViz](https://github.com/jwilber/roughViz) for hand-drawn charts, but the medium is watercolor.
Built for **qualitative, uncertainty-friendly** storytelling rather than precision dashboards.

> Status: all v1 chart types implemented (vanilla JS, Canvas, D3 for the math).

## The charts
All ride a single **watercolor fill engine** plus hand-drawn ink chrome:

| Family | Charts |
|---|---|
| **Rectangular wash** | vertical bar, horizontal bar, histogram, heatmap |
| **Area path** | area, stacked area / streamgraph, ridgeline / joyplot |
| **Radial** | pie / donut, radar / spider |
| **Point blob** | scatter / bubble |
| **Stroke (faked)** | line, network |
| **Flow** | sankey, chord / connectogram |
| **Honest uncertainty** | confidence/prediction interval, forest plot |
| **Survey & craft** | likert, calendar heatmap, sparkline |

### Annotations (on any chart)
Pass `annotations: [...]` to **any** chart — hand-drawn circles, arrows, text and callouts that
match the aesthetic, placed in **data coordinates** (cartesian charts), `'40%'` plot fractions
(any chart), or pixels:

```js
new Line('#el', {
  data: { x: [0, 1, 2, 3, 4, 5], y: [20, 32, 28, 50, 41, 60] },
  annotations: [
    { type: 'circle', at: [5, 60], r: 22 },
    { type: 'callout', at: [2, 64], to: [5, 60], text: 'new high' },
    { type: 'text', at: ['50%', '10%'], text: 'note' },
  ],
});
```

The primitives are also exported standalone (`annotateArrow`, `annotateCircle`, `annotateText`,
`annotateCallout`) to draw on any canvas directly.

## Usage

```html
<script type="importmap">
  { "imports": { "d3": "https://cdn.jsdelivr.net/npm/d3@7/+esm" } }
</script>
<canvas id="chart"></canvas>
<script type="module">
  import { Bar } from './src/index.js';
  new Bar('#chart', {
    title: 'Bar Chart',
    data: { labels: ['A', 'B', 'C', 'D', 'E'], values: [30, 55, 42, 38, 18] },
    colors: ['#dc8068', '#e8b94f', '#94a854', '#6f93c2', '#a07fbb'],
    seed: 7,
  });
</script>
```

Every chart takes a `'#selector'`/canvas/element, a `data` object, and shared options
(`color`, `colors`, `ink`, `paper`, `width`, `height`, `margin`, `title`, `seed`, …). Classes:
`Bar` (with `horizontal: true`), `Histogram`, `Heatmap`, `Area`, `StackedArea` (with
`stream: true`), `Ridgeline`, `Scatter`, `Pie` (with `innerRadius` for a donut), `Radar`, `Line`,
`Network`, `Sankey`, `Interval` (confidence/prediction band), `Forest`, `Likert`, `Calendar`,
`Chord`, `Sparkline`.

### Colours are fully configurable
- `color` — a single colour paints **every** mark that colour (pick blue → an all-blue chart).
- `colors` — an explicit palette, cycled per mark/series.
- `ink` — colour of every outline, axis, tick and label.
- `paper` — colour of the sheet.

Omit them all and a default muted palette cycles.

## Running the demos

The demos load as ES modules, so they need to be served over HTTP (not opened from `file://`).

- **In Conductor:** click **Run** (executes `scripts/dev.sh`, serving on `CONDUCTOR_PORT`).
- **From a terminal:** `npm run dev` → the printed `http://localhost:<port>/…` links.

| Demo | Shows |
|---|---|
| `examples/showcase.html` | flagship — all twelve forms on real demographic data |
| `examples/charts.html` | bar, histogram, heatmap |
| `examples/areas.html` | area, ridgeline, stacked area, streamgraph |
| `examples/more-charts.html` | scatter, pie, donut, radar, line, network, sankey |
| `examples/uncertainty.html` | CI band, forest, likert, calendar, chord, sparklines, annotations |
| `examples/blob.html` | the paint engine, with live sliders |

## Docs
- [Specification](./docs/SPEC.md) — vision, architecture, the paint engine, API, non-goals.
- [Roadmap](./docs/ROADMAP.md) — phased build order (Phases 0–4 done).

A real **brushstroke** engine (for richer line/flow/Sankey work) remains deferred; line and network
here fake their edges as hand-drawn ink strokes over the fill engine.
