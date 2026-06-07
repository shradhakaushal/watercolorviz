# watercolorviz chart API — data shapes & options

Every chart is constructed the same way:

```js
new ChartClass(target, config);
// target: a '#selector' string, an HTMLCanvasElement, or a container element.
// config: { data: {...}, ...sharedOptions, ...chartSpecificOptions }
```

All charts accept the **shared options** (see SKILL.md: `color`, `colors`, `ink`,
`paper`, `width`, `height`, `margin`, `title`, `xLabel`, `yLabel`, `seed`,
`animation`, `interactive`, `tooltip`, `annotations`, …). Below are the
**`data` shapes** and the **options unique to each chart**.

---

## Bar
```js
// single series
data: { labels: ['A','B','C'], values: [30, 55, 42] }
// grouped (object form)
data: { labels: ['A','B'], series: { Apples: [3, 7], Pears: [5, 2] } }
// grouped (array form)
data: { labels: ['A','B'], values: [[3,7],[5,2]], names: ['Apples','Pears'] }
```
Options: `horizontal: true` (horizontal bars), `legend` (auto for multi-series).

## Histogram
```js
data: { values: [1, 2, 2, 3, 3, 3, 4, 5, ...] }   // raw numbers
```
Options: `bins` (number of bins, default 10).

## Heatmap
```js
data: {
  xLabels: ['Mon','Tue'],
  yLabels: ['AM','PM'],
  values: [[1, 2], [3, 4]]   // rows = yLabels, cols = xLabels
}
```
Intensity-encoded: low = pale wash, high = deep saturated wash.

## Area
```js
data: { x: [0,1,2,3], y: [1, 2, 3, 4] }   // x continuous; same length
```
Options: `intensity`, `yScale`, `yFormat`.

## StackedArea
```js
data: { x: [2019,2020,2021], series: { A: [1,2,1], B: [2,1,2] } }
```
Options: `stream: true` (streamgraph / centered wiggle), `maxSeries` (cap; extras
fold into "Other").

## Ridgeline (joyplot)
```js
data: {
  labels: ['Jan','Feb'],          // one per row
  x: [0,1,2],                     // shared x
  series: [[1,2,1], [2,1,2]]      // one array of y-values per row
}
```

## Scatter / Bubble
```js
data: { x: [1,2,3], y: [4,5,6] }            // scatter
data: { x: [1,2,3], y: [4,5,6], r: [8,14,5] } // bubble (r = radius)
```
Options: `xScale`/`yScale`, `legend: [{label,color}]` for a category key.

## Pie / Donut
```js
data: { labels: ['A','B','C'], values: [3, 5, 2] }
```
Options: `innerRadius` — a **fraction of the outer radius, 0–1** (e.g. `0.5` → donut). Not pixels.

## Radar / Spider
```js
data: {
  axes: ['Speed','Power','Range'],   // spoke labels
  series: [[1,2,3], [3,2,1]]         // one array per series, value per axis
}
```
Options: `max` (axis max; defaults to data max), `seriesNames: ['A','B']`.

## Line
```js
// single series
data: { x: [1,2,3], y: [4,5,6] }
// multiple series (object form)
data: { x: [1,2,3], series: { US: [4,5,6], EU: [3,4,5] } }
// multiple series (array form)
data: { x: [1,2,3], y: [[4,5,6],[3,4,5]], names: ['US','EU'] }
```
The "line" is faked from a thin watercolor wash. Options: `xScale: 'time'` for dates.

## Network
```js
data: {
  nodes: [{ x: 0.5, y: 0.5, label?, value? }, { x: 0.2, y: 0.2 }],  // x,y in 0..1
  links: [[0, 1], [1, 2]]   // pairs of node indices
}
```

## Sankey
```js
data: {
  nodes: ['A', 'B', 'C'],                                  // names (or { name })
  links: [
    { source: 'A', target: 'B', value: 5 },               // names or indices
    { source: 'B', target: 'C', value: 3 }
  ]
}
```

## Interval (confidence / prediction band)
```js
data: {
  x: [0,1,2],
  y:  [1,2,3],     // central estimate
  lo: [0,1,2],     // lower bound
  hi: [2,3,4]      // upper bound
}
```
Options: `bandIntensity`. Honest-uncertainty: uniform band + edge-bead bounds.

## Forest plot
```js
data: {
  studies: [
    { name: 'Study A', est: 1.0, lo: 0.5, hi: 1.5 },
    { name: 'Study B', est: 1.2, lo: 0.9, hi: 1.6 }
  ],
  summary: { est: 1.1, lo: 0.95, hi: 1.25 }   // optional diamond
}
```
Options: `summaryColor`.

## Likert
```js
data: {
  questions: ['I enjoy X', 'Y is easy'],
  levels: ['Strongly disagree','Disagree','Neutral','Agree','Strongly agree'],
  values: [[5,10,20,40,25], [2,8,15,50,25]]   // counts per level, per question
}
```
Diverges from the center.

## Calendar heatmap
```js
data: {
  days: [
    { date: '2026-01-01', value: 3 },
    { date: '2026-01-02', value: 5 }
  ]
}
```
`date` is anything `new Date()` parses.

## Chord / connectogram
```js
data: {
  names: ['A','B','C'],
  matrix: [[0,5,6],[5,0,5],[6,5,0]]   // square flow matrix
}
```

## Sparkline
```js
data: { y: [1,2,3,2,4] }   // or just: data: [1,2,3,2,4]
```
Options: `type: 'line' | 'area'`, `dotColor`.

---

## Annotations (any chart)
```js
annotations: [
  { type: 'circle',  at: [5, 60], r: 22 },
  { type: 'arrow',   from: [1, 30], to: [3, 50] },   // ⚠ arrow uses from/to, NOT at
  { type: 'text',    at: ['50%','12%'], text: 'note' },
  { type: 'callout', at: [2, 64], to: [5, 60], text: 'new high' },
  { type: 'band',    from: 3, to: 5, label: 'peak window' },   // highlight x-range
  { type: 'bracket', from: [0,12], to: [2,12], label: 'ramp-up' }
]
```
Points accept `[x, y]` data coords (cartesian charts only), `['50%','12%']` plot
fractions (any chart), or the `…Px` pixel form. `annotationColor` sets a default
colour for all. **See `annotations.md` for the full field reference, coordinate
rules, and which charts support data coords** — and note the `arrow` gotcha above.

## Export from a rendered chart (in the browser)
```js
const chart = new Bar('#chart', { data });
const url = chart.toDataURL('image/png');   // data URL (download via an <a>)
chart.toBlob(blob => { /* upload / save */ }, 'image/png');
```
