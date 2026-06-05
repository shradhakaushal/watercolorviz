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

## Phase 2 — Primitive B: arbitrary filled polygons (the sweet spot)
**Goal:** the "wow" visualizations.

- [ ] **Area** (`d3-shape` area generator)
- [ ] **Stacked area / streamgraph** (`d3-stack`)
- [ ] **Ridgeline / joyplot**

**Exit criterion:** ridgeline screenshot is good enough to headline the README.

---

## Phase 3 — Primitive D: point blobs
**Goal:** cheap reuse.

- [ ] **Scatter / bubble** (size = bubble radius)

---

## Phase 4 — Primitive C: radial arcs (the one new geometry)
**Goal:** round out the 10.

- [ ] Arc→polygon conversion in the engine.
- [ ] **Pie / donut**
- [ ] **Radar / spider**

---

## Phase 5 — Release polish
- [ ] Demo page showcasing all 10 visualizations.
- [ ] README with live examples + install (CDN + npm).
- [ ] Recommended/bundled watercolor-friendly font.
- [ ] Accessibility pass (real labels, ARIA, tooltips).
- [ ] `v1.0` (vanilla JS core only).

---

## Deferred (deliberate v-next, not scope for v1)
- **Brushstroke engine** → line, connected scatter, network, Sankey, flow.
- SVG output + PNG/SVG export.
- React / Vue / Python wrappers.
- Animation / transitions, themes, palette generators, responsive auto-resize.
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
