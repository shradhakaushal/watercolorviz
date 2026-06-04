# watercolorviz — Specification

> A library for **watercolor-style data visualizations**. Think [roughViz](https://github.com/jwilber/roughViz)
> (sketchy/hand-drawn charts), but the medium is layered watercolor washes instead of ink strokes.

## 1. Vision & positioning

Watercolorviz renders charts as if painted in watercolor: soft bleeding edges, translucent
layered washes, paper-grain texture, gentle color blending. It is **not** a precision dashboard
tool — it is for **qualitative, humanistic, uncertainty-friendly** storytelling, where the goal is
to communicate intent, mood, and generality rather than exact read-off values.

There is currently **no dedicated programmatic watercolor charting library**. The technique exists
only in the generative-art world (notably
[Tyler Hobbs' watercolor algorithm](https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art)).
That gap is the opportunity.

**End goal:** publish on GitHub as a drop-in library so anyone (data-science folks especially) can
swap bland charts for artistic, watercolor-looking ones.

## 0. v0 — locked decisions

v0 is a **thin proof**, not the product. Its only job: confirm that programmatic watercolor on a
canvas looks genuinely beautiful, on real charts, fast enough.

- **Scope:** the paint engine + **bar** and **area** charts (one trivial primitive, one arbitrary
  polygon — together they validate the whole engine). The other 8 visualizations are v1.
- **Language:** **vanilla JS**, no TypeScript, no build step required — a single file exposing a
  global (`wcviz`) usable via `<script>` / CDN, drop-in anywhere.
- **Dependency: D3.** Included from the start (loaded via CDN/ESM, no build step) since it's needed
  for future add-ins (axes, stacking, bins, arcs, scales). In v0 we use `d3-random` (seedable
  Gaussian for the deform) and `d3-scale`/`d3-shape` for the bar/area scaffolding.
- **Render target:** Canvas only. No SVG, no PNG/SVG export.
- **Look:** a watercolor painting *on a watercolor-paper sheet* — render onto a textured
  paper-grain background, not just painted marks.
- **Colors:** a **fixed default vivid palette** — blue, violet, yellow, orange, green. User-
  configurable colors are deferred to v1.
- **Interactivity:** static for v0 (animation is wanted later, deferred).
- **Accessibility/chrome:** crisp axes + labels on top; tooltip optional, can slip to v1.

### Design principles (learned from roughViz / chart.xkcd / Excalidraw / Rough.js)
1. **Separate the paint engine from the chart logic.** The watercolor renderer is a standalone
   module; charts only decide *what shape* to hand it. (Rough.js → roughViz is the model.)
2. **Lean on D3 for the math, not the look.** Use `d3-scale`, `d3-shape`, `d3-axis`, `d3-bin`,
   `d3-stack`. Replace only the *rendering* of marks.
3. **Randomness must be seedable.** Watercolor is RNG-heavy; without a seed, every reflow repaints
   differently and feels broken. `seed` is a first-class option.
4. **Imprecision is the message.** Market for uncertainty/qualitative stories, not exact values.
5. **Small, predictable API.** A config-object API in the roughViz vocabulary so it feels familiar.
6. **Fonts carry half the aesthetic.** Ship/recommend a soft humanist or brush font as default.
7. **Keep data accessible.** Crisp axes, real text labels, and tooltips on top of the painterly fill.

## 2. Architecture

```
data ──▶ [ D3 scales / layout ] ──▶ shape (polygon | path | point | arc)
                                          │
                                          ▼
                              [ Watercolor Paint Engine ]  ◀── the novel, hard core
                                          │
                                          ▼
                              offscreen canvas (cached per mark)
                                          │
                                          ▼
              main <canvas>  +  crisp axes/labels/tooltip layer on top
```

- **Paint engine** = the make-or-break component. Standalone, chart-agnostic.
- **Render target = Canvas** (not SVG) for v1. Opacity stacking + hundreds of texture circles per
  mark would destroy an SVG DOM. SVG/export is explicitly deferred.
- **Charts** are thin: they compute a shape with D3 and call the engine.

### 2.1 The paint engine (Tyler Hobbs algorithm)
Public surface (illustrative):

```js
paintPolygon(ctx, points, {
  color,          // base hex hue
  intensity,      // light→dark fill (scales pigment density; 1 = default)
  layers,         // independently-deformed translucent washes (default 46)
  layerOpacity,   // per-wash alpha (default ~0.02; washes accumulate)
  bleed,          // edge feather: how far wash edges wander (× mean radius)
  wobble,         // per-wash size variation → interior mottling
  blooms,         // interior pigment-pool patches (count)
  bloomStrength,  // bloom opacity multiplier
  edgeDarkening,  // strength of the dark rim deposit (default ~0.8)
  variegation,    // per-wash color jitter for mottled pigment (default ~0.09)
  granulation,    // pigment pulled off paper-tooth peaks → grain (default ~0.35)
  shading,        // directional value gradient for depth (default ~0.7)
  lightAngle,     // light direction in radians (default upper-right)
  paperSeed,      // MUST match paintPaper so grain aligns to the paper
  paperScale,     // MUST match paintPaper
  outline,        // bool — thin tight hand-drawn ink boundary (default false)
  outlineColor,   // ink color (default near-black #2b2b2b)
  outlineWidth,   // ink line width px
  outlineOpacity, // ink line alpha
  texture,        // bool — granulation speckles
  speckles,       // specks per wash when texture on
  seed,           // seedable RNG
})
```

The two "elite" controls: **`intensity`** (light wash ↔ dark saturated fill) and **`outline`**
(optional tight ink contour vs. the soft color-only edge).

Algorithm (see `src/watercolor.js`; the comments below are load-bearing —
ignoring them produced a "blurry disc" on the first attempt):
1. Start from the mark's **few-sided** base polygon (rectangle, area path, wedge, or ~7–9-gon blob).
2. **Recursive edge deformation** (`deform`): split each edge at its midpoint, displace the midpoint
   along the edge normal by a Gaussian × `variance`; `variance /= vdiv` each level so big coherent
   moves on long edges give way to fine detail.
3. For **each** of the ~60 layers: jitter the base vertices, then run an **independent** coarse-to-fine
   deform of that base. Layers must be independent deformations, **never scaled/concentric copies** —
   concentric copies = smooth radial gradient = blurry disc. Uneven overlap of independent layers is
   what reads as pigment.
4. Fill each layer at low opacity; they accumulate to full color in the center and feather at edges.
5. **Edge darkening:** faint darker stroke along each layer's wandering outline → soft dark rim.
6. **Variegation:** jitter each layer's RGB (~±10%) so the wash looks mottled.

**Top-tier pass (what separates "fine" from "real"):** the mark is painted to an **offscreen
canvas**, then two pigment-only effects are applied before compositing onto the paper:
7. **Granulation** — a shared seedable noise field (`src/noise.js`, fractal value noise) defines the
   cold-press paper tooth. Both `paintPaper` AND the pigment sample it with the *same* seed/scale, so
   pigment alpha is pulled off the tooth *peaks* and settles in the *valleys* — granulation coherent
   with the actual paper (not random speckle).
8. **Directional shading** — `source-atop` radial gradients brighten toward `lightAngle` and darken
   away from it, giving the wash luminous, near-spherical depth instead of a flat disc.
9. Composite the finished mark onto the paper (this offscreen is also the per-mark cache point for charts).

### 2.1b Chart chrome (the rest of the "hand-painted" look)
Matching the reference dashboard needs more than the fill. Three craft layers together:
1. **Watercolor fills** — the wash engine above. ✅
2. **Hand-drawn axes & gridlines** — slightly wobbly ink lines with small arrowheads and tick marks,
   not crisp SVG rules. Implement with a light per-point jitter on the stroke path (own code; avoids
   adding rough.js as a dependency). Kept dark/legible on top of the paint.
3. **Handwriting / script font** — titles and labels in a hand-lettered font (à la roughViz's
   Gaegu / Indie Flower). Bundle or @font-face a suitable font; make it the default.

Palette note: the vivid palette hexes already read as soft, muted watercolor tones because the fill
is translucent — so the existing palette likely needs no change to match the muted reference.

**Animation** (washes blooming/growing in on load, staggered per mark) is wanted but **deferred**
until the static look is elite — it layers on top of the engine without changing it.

### 2.2 Two engines, one at a time
- **Wash / fill engine** (this spec) — fills polygons. Powers every v1 visualization.
- **Brushstroke engine** (deferred) — wet *strokes* for line/edge/link charts. A genuinely
  different model. **Do not build it in v1.** A line chart would quietly force a second engine.

## 3. Scope — the 10 visualizations

All 10 ride the single **wash/fill engine** via **4 shared shape primitives**. The cost is the
number of primitives, not the number of charts.

| # | Visualization | Primitive | D3 helper |
|---|---|---|---|
| 1 | Vertical bar | A — rectangular wash | d3-scale |
| 2 | Horizontal bar | A | d3-scale |
| 3 | Histogram | A | d3-bin |
| 4 | Heatmap | A | d3-scale |
| 5 | Area | B — arbitrary filled polygon | d3-shape (area) |
| 6 | Stacked area / streamgraph | B | d3-stack |
| 7 | Ridgeline / joyplot | B | d3-shape |
| 8 | Pie / donut | C — radial arc→polygon | d3-shape (arc/pie) |
| 9 | Radar / spider | C | d3-scale (radial) |
| 10 | Scatter / bubble | D — point blob | d3-scale |

**Primitive A** = trivial rectangle; **B** = arbitrary polygon (the watercolor sweet spot);
**C** = arc-as-polygon (the one new geometry bit); **D** = many small independent blobs.

## 4. Public API (sketch)

Config-object style, roughViz-familiar:

```js
new wcviz.Bar('#el', {
  data: { labels: [...], values: [...] },   // or { x:[...], y:[...] } for scatter/area
  // styling
  colors, width, height, margin, font, title, xLabel, yLabel,
  // watercolor
  bleed, layers, layerOpacity, texture, seed,
  // chrome
  tooltip,
});
```

- Data: inline `{labels, values}` / `{x, y}`; (file loading deferred).
- Every chart accepts the same watercolor params so the look is consistent.
- Axes/labels rendered crisply on a layer above the painterly fill.

## 5. Non-goals (explicitly OUT)

**Out of v1:**
- SVG output / export (PNG/SVG download)
- Animation / transitions, interactivity beyond a hover tooltip
- React / Vue / Python wrappers (ship vanilla JS core first)
- Themes, palette generators, responsive auto-resize
- File/URL data loading
- WebGL/shader rendering (only if Canvas is measurably too slow — measure first)

**Out entirely until a deliberate v-next:**
- The **brushstroke engine** and anything that needs it: **line, connected scatter, network,
  Sankey, flow.** If line is wanted sooner, fake it as a thin filled ribbon (Primitive B).

## 6. Key risks
- **Performance.** layers × deformed vertices × texture masks per mark, recomputed on resize, will
  stutter. Mitigate: pre-render each blob to an offscreen canvas; cache; recompute only on data
  change, not on redraw; cap layers.
- **Legibility vs. beauty.** Bleed destroys precise read-off. Keep axes/gridlines/labels crisp and
  high-contrast on top, and market for qualitative/uncertainty use.

## References
- Tyler Hobbs — Simulating Watercolor: https://www.tylerxhobbs.com/words/a-guide-to-simulating-watercolor-paint-with-generative-art
- Sighack — Generative Watercolor: https://sighack.com/post/generative-watercolor-in-processing
- roughViz: https://github.com/jwilber/roughViz
- Rough.js: https://github.com/rough-stuff/rough
- chart.xkcd: https://github.com/timqian/chart.xkcd
- rough-charts (composable React): https://github.com/beizhedenglong/rough-charts
- Sketchy Rendering for InfoVis (Wood et al., IEEE TVCG 2012): https://dl.acm.org/doi/10.1109/TVCG.2012.262
