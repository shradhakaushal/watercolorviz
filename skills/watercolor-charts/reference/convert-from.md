# Converting an existing chart → watercolorviz

When the user pastes a chart from another library, a CSV, or a screenshot, map it to
a watercolorviz chart class + `data` object (shapes in `chart-api.md`). Carry over the
**title, axis labels, series names, and colours** so the watercolor version is clearly
"the same chart, repainted." Then render via a template.

General steps:
1. Identify the chart **type** in the source → pick the watercolorviz class.
2. Extract the **data arrays** → reshape into watercolorviz's `data`.
3. Carry over **title / labels / colors** → shared options (`title`, `xLabel`,
   `yLabel`, `colors`/`color`).
4. Pick output (HTML file vs snippet) and render.

---

## Chart.js
`config.type` → class; data lives in `data.labels` + `data.datasets`.

| Chart.js `type`     | watercolorviz | Mapping |
|---------------------|---------------|---------|
| `bar`               | `Bar`         | `labels` → `data.labels`; one dataset → `values`; many → `series: {label: data}` |
| `bar` + `indexAxis:'y'` | `Bar` (`horizontal:true`) | |
| `line`              | `Line`        | `labels` → `x`; datasets → `series` |
| `pie` / `doughnut`  | `Pie`         | `labels`+`data` → `labels`/`values`; doughnut → `innerRadius` |
| `radar`             | `Radar`       | `labels` → `axes`; datasets' `data` → `series` |
| `scatter` / `bubble`| `Scatter`     | `{x,y}` points → `x`/`y` arrays; bubble `r` → `data.r` |

Colours: `dataset.backgroundColor` → `colors` (array) or `color` (single).
Title: `options.plugins.title.text` → `title`.

## Vega-Lite
`mark` + `encoding` drive the mapping.

| Vega-Lite `mark`        | watercolorviz | Mapping |
|-------------------------|---------------|---------|
| `bar`                   | `Bar`         | nominal field → `labels`; quantitative → `values`; `color`/`column` field → series |
| `line`                  | `Line`        | x field → `x`; y → `y`/`series` (by `color` field) |
| `area`                  | `Area` / `StackedArea` | stacked if a `color` field stacks |
| `arc`                   | `Pie`         | theta → `values`; color field → `labels` |
| `point`/`circle`        | `Scatter`     | x/y → arrays; `size` → `r` |
| `rect` (heatmap)        | `Heatmap`     | x,y nominal → `xLabels`/`yLabels`; color quantitative → `values` grid |

Pull rows from the inline `data.values` array; group by the relevant fields.

## matplotlib / seaborn (from code or a screenshot)

| matplotlib call               | watercolorviz | Mapping |
|-------------------------------|---------------|---------|
| `ax.bar` / `plt.bar`          | `Bar`         | x ticks → `labels`; heights → `values` |
| `ax.barh`                     | `Bar` (`horizontal:true`) | |
| `ax.plot`                     | `Line`        | x → `x`; each line → a series |
| `ax.fill_between`             | `Area` or `Interval` | if y1/y2 are bounds → `Interval` (`lo`/`hi`) |
| `ax.scatter`                  | `Scatter`     | `s` → `r` |
| `ax.hist`                     | `Histogram`   | raw values → `values`; `bins` → `bins` |
| `plt.pie`                     | `Pie`         | sizes → `values`; labels → `labels` |
| `sns.heatmap`                 | `Heatmap`     | matrix → `values`; index/cols → labels |
| `sns.kdeplot` ridges / joyplot| `Ridgeline`   | |
| errorbar / CI plots           | `Interval` / `Forest` | |

`set_title` → `title`; `set_xlabel`/`set_ylabel` → `xLabel`/`yLabel`.

## D3
Read the data binding and scales, not the SVG. `selectAll('rect')` over a band scale
→ `Bar`; `d3.line()` → `Line`; `d3.arc()`/`d3.pie()` → `Pie`; `d3.sankey()` → `Sankey`;
`d3.chord()` → `Chord`; force graph → `Network` (normalise node positions to 0..1).

## ECharts
`series[].type` maps like Chart.js: `bar`→`Bar`, `line`→`Line`, `pie`→`Pie`,
`scatter`→`Scatter`, `radar`→`Radar`, `heatmap`→`Heatmap`, `sankey`→`Sankey`,
`graph`→`Network`. `xAxis.data` → labels/x; `series[].data` → values.

## CSV / table
- Two columns (category, number) → `Bar` or `Pie`.
- One numeric column → `Histogram` (raw) or `Sparkline`/`Line` (ordered).
- A wide table (first col = category, rest = series) → grouped `Bar` or multi-series `Line`.
- A square numeric matrix with matching row/col headers → `Chord`; non-square → `Heatmap`.
- A `date,value` table → `Calendar` (daily) or `Line` (time series, `xScale:'time'`).

## Screenshot / image of a chart
1. Identify the type from the visual (bars, slices, lines, dots, grid…).
2. Read off labels and approximate values (state that values are estimated).
3. Pick the matching class and build `data`. Match the colour family if it carries meaning.
4. Render and tell the user the values were read by eye — offer to refine if they share the numbers.

---

When the source type has no direct watercolorviz equivalent (e.g. boxplot, treemap,
gauge), pick the **closest honest representation** (a boxplot → `Interval` or
`Forest`-style summary; a gauge → `Bar`/`Pie` fraction), and tell the user what you
substituted and why.
