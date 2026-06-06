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
    { type: 'band', from: 3, to: 5, label: 'peak window' },   // highlight an x-range
    { type: 'bracket', from: [0, 12], to: [2, 12], label: 'ramp-up' }, // mark a span
  ],
});
```

Types: `circle`, `arrow`, `text`, `callout`, `band` (soft highlight over an x-range), `bracket`
(hand-drawn range marker with end ticks + label). The primitives are also exported standalone
(`annotateArrow`, `annotateCircle`, `annotateText`, `annotateCallout`, `annotateBand`,
`annotateBracket`) to draw on any canvas directly.

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

### Multiple series

`Line` and `Bar` accept several series at once — pass a `series` object (or a nested array with
optional `names`). Each series gets its own colour, an auto legend, and per-series tooltips.
Single-series data (a flat `y`/`values` array) keeps working unchanged.

```js
// Multi-series line — three lines + legend
new Line('#el', {
  data: {
    x: [2018, 2019, 2020, 2021, 2022],
    series: { Apples: [12, 19, 15, 27, 24], Pears: [8, 11, 14, 12, 18] },
  },
});

// Grouped bars — one bar per series within each label (also `horizontal: true`)
new Bar('#el', {
  data: { labels: ['Q1', 'Q2', 'Q3'], series: { North: [28, 42, 35], South: [20, 30, 40] } },
});
```

### Scales, axes & tick formatting

On the cartesian charts (`Line`, `Area`, `Scatter`, plus `Bar`/`Histogram` value axes):

- **Log scale** — `yScale: 'log'` (and `xScale: 'log'` on `Scatter`) for positive data; log axes
  draw decade labels and leave the minor ticks unlabelled.
- **Time scale** — `Line`/`Area` auto-detect `Date` x-values (or set `xScale: 'time'` for epoch/ISO
  strings). Ticks label at the right resolution (year / month / day); tooltips show formatted dates
  (`timeFormat`, a [d3 time-format](https://github.com/d3/d3-time-format) string).
- **Number formatting** — `xFormat` / `yFormat` take a
  [d3-format](https://github.com/d3/d3-format) specifier (`'$,.0f'`, `'.0%'`, `'~s'`, `','`) or a
  `(value) => string` function, for currency / percent / SI / grouped-thousands axes.

The axis chrome and legend are configurable on every cartesian chart:

| Option | Effect |
|---|---|
| `axes: false` | draw no axis spines |
| `xAxis: false` / `yAxis: false` | hide one spine |
| `xAxis: { position: 'top' }` / `yAxis: { position: 'right' }` | move a spine |
| `axisArrows: false` | spines without the arrowheads |
| `grid: false` | drop the gridlines |
| `legend: false` | hide the auto legend |
| `legendOrientation: 'vertical'` | corner key instead of a bottom strip |
| `legendGap`, `legendX`, `legendY` | nudge / pin the legend |

```js
new Bar('#el', {
  data: { labels: ['Q1', 'Q2', 'Q3', 'Q4'], values: [12000, 28000, 21500, 35000] },
  yFormat: '$,.0f',        // $12,000 …
  yAxis: { position: 'right' },
});
```

## Working with a chart instance

A chart is a live object — update it, listen to it, export it, and tear it down:

```js
const chart = new Bar('#el', {
  data: { labels: ['A', 'B', 'C'], values: [3, 7, 5] },
  onClick: (mark, event) => console.log('clicked', mark.index, mark.label),
  onHover: (mark) => setHighlighted(mark?.index ?? null), // null when nothing is hovered
  tooltipFormat: (mark) => `${mark.label}\nclick to drill in`,
});

// Re-render in place with new data/options — no teardown, restarts the reveal.
chart.update({ data: { labels: ['A', 'B', 'C'], values: [9, 2, 6] } });

// Export the current frame.
const pngUrl = chart.toDataURL();          // → "data:image/png;base64,…"
chart.toBlob((blob) => download(blob));    // browser

// Remove it cleanly (detaches listeners, observers and animation frames).
chart.destroy();
```

- **`update(config)`** shallow-merges into the existing config (pass a whole `data` object to replace the data) and repaints. The supported way to drive a chart from a framework or live feed.
- **`onClick(mark, event)`** / **`onHover(mark|null)`** give you the mark's `{ index, label, color }`; map `index` back to your own data. Clicks also fire from the keyboard (Enter/Space on the focused mark).
- **`tooltipFormat(mark)`** returns the tooltip string (multi-line ok; return `''` to suppress).
- **`toDataURL(type?, quality?)`** / **`toBlob(cb, type?, quality?)`** export the canvas.

## Interactive, responsive, accessible
- **Hi-DPI** — canvases render at `devicePixelRatio`, so text/ink/marks are crisp on retina.
- **Animations** — marks reveal in on load (disable with `animation: false`).
- **Tooltips** — hover any mark to see its value + colour key; interactive out of the box on
  every chart (`tooltip: false` to disable). Chrome (axes/ticks/annotations) is drawn as crisp
  technical pen, distinct from the watercolor fills.
  - Honours **`prefers-reduced-motion`** — reveal/hover animations are skipped automatically.
- **Responsive** — pass `width: '100%'` (or `responsive: true`, plus optional `aspect`) and the
  chart fits its container and re-fits on resize. Call `chart.destroy()` to detach observers,
  listeners and animation frames.
- **Accessible** — each canvas gets `role="img"` and an `aria-label` summary (override with
  `ariaLabel`). Charts are **keyboard navigable**: focus the canvas and use the arrow keys
  (Home/End/Escape) to move the highlight across marks; the focused datum is announced and shown
  in the tooltip (disable with `keyboard: false`).
- **Robust input** — malformed data (mismatched array lengths, missing keys) throws a clear
  `watercolorviz:` error; empty or all-zero data renders a tidy empty frame; stray `NaN`/`Infinity`
  values are sanitised rather than drawn as garbage.

## Running the demos

The demos load as ES modules, so they need to be served over HTTP (not opened from `file://`).

- **In Conductor:** click **Run** (executes `scripts/dev.sh`, serving on `CONDUCTOR_PORT`).
- **From a terminal:** `npm run dev` → the printed `http://localhost:<port>/…` links.

| Demo | Shows |
|---|---|
| `examples/showcase.html` | flagship — all twelve forms on real demographic data |
| `examples/charts.html` | bar, histogram, heatmap |
| `examples/areas.html` | area, ridgeline, stacked area, streamgraph |
| `examples/more-charts.html` | scatter, pie, donut, radar, line, multi-series + log + time line, network, sankey |
| `examples/uncertainty.html` | CI band, forest, likert, calendar, chord, sparklines, annotations |
| `examples/config.html` | configurable axes, legend & number-formatted ticks |
| `examples/blob.html` | the paint engine, with live sliders |

## Docs
- [Specification](./docs/SPEC.md) — vision, architecture, the paint engine, API, non-goals.
- [Roadmap](./docs/ROADMAP.md) — phased build order (engine, all chart phases and the interactivity/scales work done; release polish remaining).

A real **brushstroke** engine (for richer line/flow/Sankey work) remains deferred; line and network
here fake their edges as hand-drawn ink strokes over the fill engine.
