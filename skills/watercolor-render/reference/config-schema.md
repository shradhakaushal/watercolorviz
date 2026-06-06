# render-chart config schema

`render-chart.mjs` consumes a single JSON object:

```jsonc
{
  "chart":   "Bar",        // required — an exported chart class name
  "data":    { },          // required — that chart's data object (shapes below)
  "options": { },          // optional — shared + chart-specific options
  "width":   720,          // optional — logical px (default 720)
  "height":  480,          // optional — logical px (default 480)
  "scale":   2             // optional — supersampling; 2 = retina-crisp (default 2)
}
```

Output PNG dimensions are `width*scale × height*scale`.

## Chart class names
`Bar`, `Histogram`, `Heatmap`, `Area`, `StackedArea`, `Ridgeline`, `Scatter`,
`Pie`, `Radar`, `Line`, `Network`, `Sankey`, `Interval`, `Forest`, `Likert`,
`Calendar`, `Chord`, `Sparkline`.

## `options` (common)
`title`, `xLabel`, `yLabel`, `color`, `colors` (array), `ink`, `paper`, `seed`,
`margin`, `legend`, `grid`, `axes`, `xAxis`, `yAxis`, `axisArrows`,
`xScale`/`yScale` (`"linear"|"log"|"time"`), `xFormat`/`yFormat` (d3-format
strings), `annotations` (array), `annotationColor`, plus chart-specific ones
(`horizontal`, `bins`, `stream`, `innerRadius` (0–1 fraction), `max`, …).

### Chrome (axes / title / labels)
For cartesian charts (Bar, Histogram, Area, StackedArea, Scatter, Line, Interval)
the x and y axes render by default. Set `title`, `xLabel`, `yLabel` for a complete
chart; hide axes with `"axes": false` / `"xAxis": false` / `"yAxis": false`.
Non-cartesian charts have no x/y axes (only `title` applies).

### Annotations
```jsonc
"options": {
  "annotations": [
    { "type": "circle",  "at": ["Q4", 61], "r": 24 },
    { "type": "arrow",   "from": ["Q1", 30], "to": ["Q2", 55] },   // arrow uses from/to, NOT at
    { "type": "callout", "at": ["50%","18%"], "to": ["Q4", 61], "text": "peak" },
    { "type": "text",    "at": ["50%","12%"], "text": "note" },
    { "type": "band",    "from": 3, "to": 5, "label": "window" },
    { "type": "bracket", "from": [0,12], "to": [2,12], "label": "ramp" }
  ],
  "annotationColor": "#c8604f"
}
```
Points are `[x,y]` data coords (cartesian charts only), `["50%","12%"]` plot
fractions (any chart), or the `…Px` pixel forms. Full rules: the `watercolor-charts`
skill's `reference/annotations.md`.

> Interactivity, tooltips and animation don't apply to a static render and are
> ignored / disabled automatically.

## `data` shapes (quick reference)

```jsonc
// Bar (single)        { "labels": ["A","B"], "values": [3, 7] }
// Bar (grouped)       { "labels": ["A","B"], "series": { "X": [3,7], "Y": [5,2] } }
// Histogram           { "values": [1,2,2,3,3,3,4] }                 // options.bins
// Heatmap             { "xLabels": ["a","b"], "yLabels": ["x","y"], "values": [[1,2],[3,4]] }
// Area                { "x": [0,1,2,3], "y": [1,2,3,4] }
// StackedArea         { "x": [2019,2020], "series": { "A": [1,2], "B": [2,1] } }  // options.stream
// Ridgeline           { "labels": ["a","b"], "x": [0,1,2], "series": [[1,2,1],[2,1,2]] }
// Scatter / Bubble    { "x": [1,2,3], "y": [4,5,6], "r": [8,14,5] }  // r optional
// Pie / Donut         { "labels": ["A","B"], "values": [3,5] }       // options.innerRadius = 0..1 fraction (donut)
// Radar               { "axes": ["a","b","c"], "series": [[1,2,3]] } // options.max
// Line (single)       { "x": [1,2,3], "y": [4,5,6] }
// Line (multi)        { "x": [1,2,3], "series": { "US": [4,5,6] } }
// Network             { "nodes": [{"x":0.5,"y":0.5}], "links": [[0,1]] }  // x,y in 0..1
// Sankey              { "nodes": ["A","B"], "links": [{"source":"A","target":"B","value":5}] }
// Interval            { "x": [0,1,2], "y": [1,2,3], "lo": [0,1,2], "hi": [2,3,4] }
// Forest              { "studies": [{"name":"A","est":1,"lo":0.5,"hi":1.5}], "summary": {"est":1,"lo":0.8,"hi":1.2} }
// Likert              { "questions": ["Q1"], "levels": ["lo","mid","hi"], "values": [[10,20,30]] }
// Calendar            { "days": [{"date":"2026-01-01","value":3}] }
// Chord               { "names": ["A","B","C"], "matrix": [[0,5,6],[5,0,5],[6,5,0]] }
// Sparkline           { "y": [1,2,3,2,4] }
```

The `watercolor-charts` skill's `reference/chart-api.md` has the full detail and
`reference/convert-from.md` maps other charting libraries onto these shapes.

## Examples

```sh
# Titled bar chart, brand palette, retina
node render-chart.mjs - revenue.png <<'JSON'
{ "chart": "Bar",
  "data": { "labels": ["Q1","Q2","Q3","Q4"], "values": [30,55,42,61] },
  "options": { "title": "Quarterly revenue", "colors": ["#dc8068","#e8b94f","#94a854","#6f93c2"], "seed": 7 },
  "width": 800, "height": 500, "scale": 2 }
JSON
```
