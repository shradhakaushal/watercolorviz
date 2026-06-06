---
name: watercolor-charts
description: >-
  Turn any data, chart description, or existing chart (Chart.js, Vega-Lite,
  matplotlib, D3, ECharts, a CSV, or a screenshot) into a watercolor-style
  visualization — soft bleeding edges, translucent washes, paper grain, and
  hand-drawn ink. Also "watercolifies" arbitrary shapes (a flame, star, logo,
  SVG path) into a painted watercolor blob. Use whenever the user asks to make
  something watercolor / "watercolor this chart" / "watercolify X" / wants a
  hand-painted, qualitative, uncertainty-friendly chart. Produces a runnable,
  zero-install HTML file (loaded from CDN) or a paste-in code snippet.
license: MIT
---

# watercolor-charts

This skill renders charts and shapes with **watercolorviz** — a watercolor-style
dataviz engine (flat saturated washes, undulating wet-on-dry edges, paper-grain
granulation, line-and-wash ink). The library is published on npm and served from
a CDN, so **the user installs nothing**: you emit a self-contained HTML file that
imports the library straight from jsdelivr.

If the user wants a **baked image file (PNG/SVG)** instead of an HTML page and a
Node sandbox is available, use the companion **`watercolor-render`** skill, which
ships scripts that render headlessly. This skill is the zero-install, works-everywhere
path.

## The one import line

watercolorviz is loaded from jsdelivr's `+esm` bundle, which **auto-resolves its
`d3` dependency** — no import map, no install:

```js
import { Bar, Line, Pie /* …whatever you need */ } from 'https://cdn.jsdelivr.net/npm/watercolorviz@0.1.0/+esm';
```

Always pin the version (`@0.1.0`). To use the latest, the user can drop the version,
but pinning keeps results reproducible.

## Workflow

1. **Figure out the intent.** Three entry points:
   - **"I have data" / "describe a chart"** → pick a chart class (see decision table)
     and build its `data` object.
   - **"Convert this existing chart"** (they paste Chart.js/Vega-Lite/matplotlib/D3/
     ECharts config, a CSV, or a screenshot/image) → read `reference/convert-from.md`,
     map their spec to a watercolorviz chart + `data`, and carry over title/labels/colors.
   - **"Watercolify this shape"** (a flame, heart, star, logo, an SVG `<path>`) →
     use the shape path (see "Watercolify any shape" below).
2. **Pick the output format** (you decide based on what they asked):
   - **Standalone HTML file** (default for most requests) — they open it in a browser
     and see the watercolor chart. Use `templates/chart.html` (charts) or
     `templates/shape.html` (shapes).
   - **Paste-in snippet** — when they say "give me the code" / "for my page" / are
     clearly working in an existing app. Emit just the `<canvas>` + `<script type="module">`.
   - **Want a PNG/SVG image file?** Hand off to the `watercolor-render` skill if a
     sandbox exists; otherwise produce the HTML and tell them to use the browser's
     export (the chart object exposes `toDataURL()` / `toBlob()` — see below) or screenshot.
3. **Build it** from the appropriate template, filling in the chart class, `data`,
   and options. Keep the watercolor defaults; only override what the request needs.
4. **Hand it over.** Write the file (or print the snippet) and tell them exactly how
   to view it (e.g. "open `watercolor-chart.html`").

## Choosing the chart (decision table)

| The data / request looks like…                          | Class            | Notes |
|---------------------------------------------------------|------------------|-------|
| categories with one value each                          | `Bar`            | `horizontal: true` for bar-left; grouped via `series` |
| categories with multiple series                         | `Bar`            | `data.series: { name: [...] }` |
| raw numbers to bin into a distribution                  | `Histogram`      | `bins: n` |
| a grid of category×category intensities                 | `Heatmap`        | |
| x/y where x is continuous (a trend, filled)             | `Area`           | |
| several series filled & stacked / a streamgraph         | `StackedArea`    | `stream: true` for streamgraph |
| several distributions stacked as ridges (joyplot)       | `Ridgeline`      | |
| x/y points, optional size                               | `Scatter`        | add `data.r` for bubbles |
| parts of a whole                                        | `Pie`            | `innerRadius` > 0 → donut |
| several metrics on spokes                               | `Radar`          | |
| a trend line (one or many series)                       | `Line`           | line is faked from washes |
| nodes + edges                                           | `Network`        | node positions in 0..1 |
| flows between stages                                    | `Sankey`         | |
| a value with a confidence/prediction band              | `Interval`       | honest uncertainty |
| effect sizes with CIs across studies                    | `Forest`         | meta-analysis |
| survey agree/disagree distributions                     | `Likert`         | diverging from center |
| a value per calendar day                                | `Calendar`       | GitHub-style |
| flows among a set of entities (square matrix)           | `Chord`          | |
| a tiny inline trend                                     | `Sparkline`      | |

When two fit, prefer the one that matches the **story**: watercolorviz is built for
qualitative, uncertainty-friendly storytelling, not precision dashboards. If the user
wants exact value-reading, say so and still render it, or suggest annotations.

The **exact `data` shape and per-chart options for every class** are in
`reference/chart-api.md`. Read it before writing the config.

## Shared options (every chart)

Pass these in the config object alongside `data`:

- **Colour:** `color` (one colour paints *every* mark), `colors` (palette, cycled per
  mark/series), `ink` (all outlines/axes/labels/text), `paper` (the sheet).
- **Layout:** `width` (px or `'100%'` for responsive), `height`, `margin`, `title`,
  `xLabel`, `yLabel`, `aspect`.
- **Texture:** `seed` (deterministic watercolor — change it to reshuffle the bleed).
- **Axes/legend (cartesian):** `axes`, `grid`, `legend`, `xScale`/`yScale`
  (`'linear'|'log'|'time'`), `xFormat`/`yFormat` (d3-format strings like `'$,.0f'`, `'.0%'`).
- **Interactivity:** `interactive`, `tooltip`, `tooltipFormat`, `onClick`, `onHover`,
  `selection`, `keyboard`, `ariaLabel`.
- **Animation:** `animation` (entrance bloom; default on in the browser — set
  `animation: false` for a static render).
- **Annotations:** `annotations: [...]` on ANY chart — `circle`, `arrow`, `text`,
  `callout`, `band`, `bracket`, placed in data coords, `'40%'` plot fractions, or pixels.
  Full field reference and the coordinate rules are in `reference/annotations.md`.

### Always finish the chrome (sanity checks)

For every **cartesian** chart (Bar, Histogram, Area, StackedArea, Scatter, Line,
Interval), make sure the output is complete:
- **Title** — set `title` (use the source chart's title, or a clear one).
- **Both axis labels** — set `xLabel` and `yLabel` whenever the axes carry meaning.
- **Both axes render** — the x and y spines are on by default; only hide them
  (`xAxis:false`/`yAxis:false`/`axes:false`) if the user explicitly asks.

Non-cartesian charts (Pie, Radar, Chord, Sankey, Network, Ridgeline, Forest,
Likert, Calendar, Heatmap, Sparkline) have **no x/y axes** — `title` still applies,
but `xLabel`/`yLabel`/`xAxis`/`yAxis` do not. See `reference/annotations.md`.

### Annotations — the gotchas

- **`arrow` uses `from` + `to`, NOT `at`** — `{ type:'arrow', from:[x,y], to:[x,y] }`.
  Using `at` on an arrow throws and breaks the whole render.
- **Data coordinates only resolve on cartesian charts.** On Pie/Radar/etc. use
  `'%'` plot fractions (`at: ['50%','30%']`) or the pixel forms (`atPx`/`fromPx`/`toPx`).
- Keep text/notes below ~`'15%'` height so they don't collide with the title.

The default palette is vivid watercolor; the default paper is warm cream. Honour any
colours the user already has (e.g. a brand palette or the source chart's colors).

## The font matters

Half the aesthetic is the handwriting font. The templates load **Caveat** from Google
Fonts. Keep that `<link>` in. To match a brand, override per-chart with `font: '...'`.

## Watercolify any shape

Beyond charts, the engine paints **any polygon** as a watercolor blob via `paintPolygon`
(plus `paintPaper` for the sheet). Use `templates/shape.html`. Flow:

1. Get the shape as an array of `[x, y]` points (a closed polygon, in canvas pixels):
   - For **built-in-ish shapes** (star, heart, flame, hexagon, blob), generate the points
     in JS — the template includes helpers and you can write the parametric outline.
   - For a **user's SVG** `<path d="…">` or logo, sample points along the path. In the
     browser you can use `path.getTotalLength()` + `getPointAtLength()` to sample a `<path>`
     into points (the template shows this). Keep ~120–240 points for a smooth edge.
2. Paint it:
   ```js
   import { paintPaper, paintPolygon } from 'https://cdn.jsdelivr.net/npm/watercolorviz@0.1.0/+esm';
   paintPaper(ctx, W, H, { color: '#f9f1e6' });
   paintPolygon(ctx, points, { color: '#dc8068', seed: 7, granulation: 0.18, mottle: 0.45 });
   ```
3. `paintPolygon` options worth knowing: `color`, `intensity`, `bleed`, `wobble`,
   `granulation`, `mottle`, `shading`, `edgeDarkening`, `outline` (+`outlineColor`,
   `outlineWidth`), `seed`. Defaults already look like real watercolor — start there.

For "watercolor fire" / "watercolor a star" etc., **you generate the outline path**
(SVG path string or point array) for the requested subject, then watercolify it. Layer
multiple `paintPolygon` calls (e.g. a red flame over an orange one) for richer results.

## Quality bar

- Default to watercolorviz's tuned defaults; don't add gradients/shading that imply
  structure the data doesn't carry (it's an honest-encoding library).
- Always keep the Caveat font link and the warm paper unless asked otherwise.
- Pin the CDN version.
- Give a fixed `seed` so the result is reproducible.
- Tell the user precisely how to view/use what you produced.

## Files in this skill

- `reference/chart-api.md` — exact `data` shape + options for all 18 chart classes. **Read before configuring a chart.**
- `reference/annotations.md` — annotations (all 6 types, coordinate rules, gotchas) **and** chrome (axes, title, axis labels). Read when a request involves callouts/highlights or controlling axes/titles.
- `reference/convert-from.md` — mapping tables from Chart.js / Vega-Lite / matplotlib / D3 / ECharts / CSV / screenshots → watercolorviz.
- `templates/chart.html` — self-contained chart page scaffold (CDN import, Caveat font, canvas).
- `templates/shape.html` — self-contained "watercolify a shape" scaffold (paintPaper + paintPolygon, SVG-path sampler).
