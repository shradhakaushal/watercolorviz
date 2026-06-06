# Annotations & chart chrome (axes, title, labels)

Annotations and the chart "chrome" (axes, title, axis labels) work on **every**
chart via the same config object. This file is the source of truth for both —
read it whenever a request involves callouts, highlights, arrows, or controlling
axes/titles/labels.

---

## Chrome: axes, title, axis labels

These are **on by default** for the cartesian charts (Bar, Histogram, Area,
StackedArea, Scatter, Line, Interval) and render crisply over the paint:

```js
{
  title:  'Quarterly revenue',   // top, centered
  xLabel: 'quarter',             // bottom, centered
  yLabel: 'USD (millions)',      // left, rotated
  // axes are drawn automatically; tune them with:
  axes: true,                    // false → no spines at all
  xAxis: true,                   // false → hide x spine; { position: 'top' }
  yAxis: true,                   // false → hide y spine; { position: 'right' }
  axisArrows: true,              // false → spines without hand-drawn arrowheads
  grid: false,                   // faint gridlines
  xScale: 'linear',              // 'linear' | 'log' | 'time'
  yScale: 'linear',              // 'linear' | 'log'
  xFormat: '$,.0f', yFormat: '.0%',   // d3-format tick strings
}
```

Quality checklist for any cartesian chart you produce — make sure:
- **the title is set** (`title`) when the user gave one (or a sensible one),
- **both axis labels are set** (`xLabel`, `yLabel`) when the axes mean something,
- **both axes render** — they do by default; only set `xAxis:false`/`yAxis:false`
  or `axes:false` if the user explicitly wants them hidden.

> **Non-cartesian charts have no x/y axes.** Pie, Radar, Chord, Sankey, Network,
> Ridgeline, Forest, Likert, Calendar, Heatmap and Sparkline draw their own
> chrome (rings, spokes, legends, labels) — `xAxis`/`yAxis`/`xLabel`/`yLabel`
> don't apply. `title` still works on all of them.

---

## Annotations

Pass `annotations: [...]` (an array) on any chart. Each item has a `type` plus
its own fields, and optional `color` and `seed`. A chart-wide default colour
comes from `annotationColor` (defaults to a warm coral `#c8604f`).

### Coordinate systems (how `at` / `from` / `to` are resolved)
A point is `[x, y]`. It is interpreted as:
1. **Plot fraction** if given as percent strings: `['50%', '10%']` → 50% across,
   10% down the *plot area*. Works on **every** chart.
2. **Data coordinates** otherwise (e.g. `[5, 60]` or `['Q3', 42]`) — mapped
   through the chart's scales. **Only the cartesian charts support this**: Bar,
   Histogram, Area, StackedArea, Scatter, Line, Interval. (Bar uses the category
   label as x, e.g. `at: ['Q3', 42]`.)
3. **Raw pixels** as a fallback on charts without scales — prefer the explicit
   pixel form instead: `atPx`, `fromPx`, `toPx` override and take `[px, px]`.

> On a **non-cartesian** chart (Pie, Radar, …), use `%` fractions or the `…Px`
> pixel forms — bare data coords there fall back to raw pixels and will misplace.

### Types and their fields

```js
annotations: [
  // ── circle: ring around a point ──────────────────────────────────────────
  { type: 'circle', at: [5, 60], r: 22, ry: 22, width: 2, color: '#c8604f', seed: 1 },
  //   atPx: [px,px] to use pixels; ry optional (ellipse).

  // ── arrow: from a tail to a head.  USE from + to (NOT `at`). ─────────────
  { type: 'arrow', from: [1, 30], to: [3, 48], width: 2 },
  //   fromPx / toPx for pixels.   ⚠ `at` is NOT valid for arrow — it will throw.

  // ── text: a free label ───────────────────────────────────────────────────
  { type: 'text', at: ['50%', '12%'], text: 'note', size: 16, align: 'left' },

  // ── callout: a label that points at something (at = label, to = target) ──
  { type: 'callout', at: [2, 64], to: [5, 60], text: 'new high', size: 16 },

  // ── band: soft highlight over an x-RANGE (full plot height) ──────────────
  { type: 'band', from: 3, to: 5, label: 'peak window', opacity: 0.16,
    yRange: [40, 60] /* optional: limit vertical extent in data units */ },
  //   from/to are x values (numbers), data x, or '%' strings. Cartesian charts.

  // ── bracket: a span marker with end ticks + label ────────────────────────
  { type: 'bracket', from: [0, 12], to: [2, 12], label: 'ramp-up',
    width: 1.8, tick: 7, flip: false },
],
annotationColor: '#c8604f',   // default colour for any annotation without `color`
```

| type      | required fields            | point fields accept | notes |
|-----------|----------------------------|---------------------|-------|
| `circle`  | `at`                       | `at`/`atPx`         | `r`, `ry`, `width` |
| `arrow`   | `from`, `to`               | `from`/`fromPx`, `to`/`toPx` | **`at` is invalid** |
| `text`    | `at`, `text`               | `at`/`atPx`         | `size`, `align` |
| `callout` | `at`, `to`, `text`         | `at`/`atPx`, `to`/`toPx` | `at`=label, `to`=target |
| `band`    | `from`, `to`               | scalar x (num/`%`/data) | full-height highlight; `yRange`, `opacity`, `label` |
| `bracket` | `from`, `to`               | `from`/`fromPx`, `to`/`toPx` | `label`, `tick`, `flip`, `width` |

### Tips
- Keep `text`/`note` annotations away from `~'8%'` height or they collide with
  the title. Use `'18%'`+ or place them in data coords below the title band.
- Give each annotation a `seed` for reproducible hand-drawn wobble.
- Annotations are drawn **after** the chart and survive re-renders/animation.
- The annotation primitives are also exported standalone (`annotateArrow`,
  `annotateCircle`, `annotateText`, `annotateCallout`, `annotateBand`,
  `annotateBracket`) to draw on any canvas directly.
