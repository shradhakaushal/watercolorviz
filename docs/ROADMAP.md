# watercolorviz — Roadmap

Build order is chosen so each phase **de-risks the next**. The paint engine is proven in isolation
before any chart depends on it. See [SPEC.md](./SPEC.md) for the full design.

---

## Phase 0 — Paint engine (the make-or-break milestone) ✅ DONE
**Goal:** one gorgeous watercolor blob on a `<canvas>`.

- [x] Seedable RNG utility (`src/rng.js`, mulberry32).
- [x] Recursive polygon edge-deformation (Gaussian midpoint displacement, fractal falloff).
- [x] Layer stacking (default 50 layers, ~4.5% opacity).
- [x] Per-layer Gaussian scale (`spread`) → the soft fade band. *(Key fix: identical layers gave a
      flat opaque blob; varying each layer's scale about the centroid produces the watercolor fade.)*
- [x] Optional paper-grain stipple per layer (`speckles`).
- [x] Watercolor-paper background (`src/paper.js`).
- [x] `paintPolygon(ctx, points, opts)` standalone API + `regularPolygon` helper.
- [x] Tweakable single-blob demo (`examples/blob.html`) with live sliders.
- [ ] Two-hue interleaving for color depth (deferred — single hue looks good already).

**Exit criterion:** MET. A static blob that genuinely reads as watercolor (soft faded edges,
pooled center, subtle edge-darkening), painting in ~17ms at 50 layers.

To view: `python3 -m http.server 8000` then open `http://localhost:8000/examples/blob.html`.

---

## Phase 1 — Primitive A: rectangular washes ✅ DONE
**Goal:** first real charts; prove engine + D3 scales + crisp axes.

- [x] D3 scales/axes scaffold + canvas chart base class (`src/chart.js`, `src/axes.js`).
- [x] **Vertical bar** (`src/charts/bar.js`)
- [x] **Horizontal bar** (`Bar` with `horizontal: true`)
- [x] **Histogram** (`d3-bin`, `src/charts/histogram.js`)
- [x] **Heatmap** (grid of washes, `src/charts/heatmap.js`)
- [x] Crisp hand-drawn ink axis/label layer above the fill. *(Hover tooltip deferred.)*
- [x] Offscreen-canvas caching per mark (`opts.cacheKey`); recompute only on data change.

**Exit criterion:** MET. All four charts render legibly with the shared grainy/matte/muted
watercolor fill (`src/charts/shapes.js`), tuned against the painted reference. Demo:
`examples/charts.html`.

---

## Phase 2 — Primitive B: arbitrary filled polygons (the sweet spot) ✅ DONE
**Goal:** the "wow" visualizations.

- [x] **Area** (`src/charts/area.js`) — grainy wash + line-and-wash ink contour.
- [x] **Stacked area / streamgraph** (`src/charts/stacked.js`, `stream: true`).
- [x] **Ridgeline / joyplot** (`src/charts/ridgeline.js`) — overlapping ridges.

Engine: added `boundaryMode: 'outline'` to `paintPolygon` (perpendicular edge
wobble that preserves an arbitrary outline instead of the radial blob boundary),
`inkPath` for open-polyline line-and-wash strokes, and `paintAreaWash` /
`paintBandWash` shape helpers.

**Exit criterion:** MET. The ridgeline reads as a hand-painted joyplot. Demo:
`examples/areas.html`.

---

## Phase 3 — Primitive D: point blobs ✅ DONE
**Goal:** cheap reuse.

- [x] **Scatter / bubble** (size = bubble radius, `src/charts/scatter.js`, via `paintDot`)

---

## Phase 4 — Primitive C: radial arcs (the one new geometry) ✅ DONE
**Goal:** round out the 10.

- [x] Arc→polygon conversion (`wedgePolygon` in `src/charts/shapes.js`).
- [x] **Pie / donut** (`src/charts/pie.js`, `innerRadius` for donut)
- [x] **Radar / spider** (`src/charts/radar.js`)

---

## Bonus — line & network via faked ribbon/stroke edges
Officially deferred (need the brushstroke engine), but done now without it: the
edges are hand-drawn ink strokes (`inkPath`/`inkLine`) and the nodes/markers are
`paintDot` blobs — no second engine.

- [x] **Line** (`src/charts/line.js`) — continuous line-and-wash stroke + markers.
- [x] **Network** (`src/charts/network.js`) — blob nodes + ink-stroke edges.
- [x] **Sankey** (`src/charts/sankey.js`) — flows as filled watercolor ribbons
      (own column/stack layout, no d3-sankey dependency).

Demo for the new classes: `examples/more-charts.html`. The flagship
`examples/showcase.html` now covers all twelve forms on real demographic data.

**Colours are fully configurable** (Chart base `colorFor()` + `ink`/`paper`):
a single `color` paints every mark that colour, `colors` cycles an explicit
palette, `ink` colours all chrome, `paper` colours the sheet — no chart hardcodes
its colours anymore.

---

## Phase 6 — Honest-uncertainty & craft charts ✅ DONE
Charts chosen for being underserved by existing libs AND genuinely improved by
the watercolor aesthetic (see [[next-phase-chart-ideas]] in notes). All thin
classes on the fill engine; demo `examples/uncertainty.html`.

- [x] **Confidence / prediction interval** (`src/charts/interval.js`) — the
      flagship: nested translucent bands so density fades toward the bounds, so
      the uncertainty *looks* uncertain. Also forecast cones / posterior bands.
- [x] **Forest plot** (`src/charts/forest.js`) — study CIs + diamond summary.
- [x] **Likert / survey** (`src/charts/likert.js`) — diverging stacked bars whose
      segments bleed into each other (`palette.diverging()`).
- [x] **Calendar heatmap** (`src/charts/calendar.js`) — GitHub-style grid.
- [x] **Chord / connectogram** (`src/charts/chord.js`) — d3.chord layout, soft
      arcs + translucent ribbons.
- [x] **Sparkline** (`src/charts/sparkline.js`) — tiny inline line/area.
- [x] **Soft Sankey** — `Sankey({ soft: true })` loosens the flow boundaries.
- [x] **Annotation layer** (`src/annotate.js`) — hand-drawn arrows / circles /
      callouts that match the aesthetic, drawn on any chart canvas.

---

## Phase 7 — Interactivity, multi-series & scales ✅ DONE
Done after the core chart set, in small increments (see notes). All ride the
existing engine — no new rendering primitives.

- [x] **Hi-DPI** rendering (canvas backed at `devicePixelRatio`).
- [x] **Load + hover animations** (staggered reveal, neighbour highlighting;
      `animation: false` to disable).
- [x] **Tooltips** on every chart (`label` + colour key; `tooltip: false`).
- [x] **Responsive** auto-resize (`width: '100%'` / `responsive: true` + `aspect`).
- [x] **Accessibility** — `role="img"` + `aria-label` data summary (`ariaLabel`).
- [x] **Multi-series line** and **grouped bars** (`data.series` / nested arrays,
      auto legend, per-series tooltips).
- [x] **Configurable axes & legend** — hide/move spines, drop arrows/grid, hide
      or reposition the legend (with reserved spacing so it clears the labels).
- [x] **Log & time scales** + **number tick formatting** via the shared
      `buildScale` helper (`yScale`/`xScale`, `xFormat`/`yFormat`, `timeFormat`).

Demos: `examples/more-charts.html`, `examples/bars.html`, `examples/config.html`.

---

## Phase 5 — Release polish (remaining)
- [x] Demo page showcasing the visualizations (`examples/showcase.html` + per-family demos).
- [x] README with live examples (CDN importmap + class list + options).
- [x] Accessibility pass (real labels, ARIA, tooltips).
- [ ] npm install path / publish (`version` is still `0.0.0`).
- [ ] Recommended/bundled watercolor-friendly font (demos load Caveat from Google Fonts).
- [ ] `v1.0` tag (vanilla JS core only).

---

## Deferred (deliberate v-next, not scope for v1)
- **Brushstroke engine** → line, connected scatter, network, Sankey, flow.
- SVG output + PNG/SVG export.
- React / Vue / Python wrappers.
- Themes, palette generators.
- File/URL data loading.
- WebGL/shader rendering — only if Canvas is measurably too slow.

---

## Guardrails against scope creep
1. **Count primitives, not charts.** A new chart is cheap if it reuses A/B/C/D; expensive if it
   needs a new shape or engine.
2. **One engine for v1.** Anything stroke-based waits. If line is needed early, fake it as a thin
   filled ribbon (Primitive B).
3. **Don't build wrappers before the core is loved.** Vanilla JS first.
4. **Measure before optimizing rendering.** No WebGL until Canvas is proven too slow.
