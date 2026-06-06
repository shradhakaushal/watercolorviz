# watercolorviz — audit & long-term gaps

A snapshot of what exists, the axes/keys/titles consistency pass, and the gaps
that matter for taking this from "gorgeous demo" to "a library people depend on."

## What's built
- **Paint engine** (`src/watercolor.js`) — flat saturated washes, granulation,
  configurable everything, opt-in per-mark cache; **paper** + **ink chrome**
  (`axes.js`: wobbly lines, arrowheads, ticks, `inkPath`).
- **18 chart types** as thin classes on a shared `Chart` base: bar, horizontal
  bar, histogram, heatmap, area, stacked area, streamgraph, ridgeline, scatter/
  bubble, pie/donut, radar, line, network, sankey, confidence interval, forest,
  likert, calendar, chord, sparkline. Plus an **annotation layer**.
- **Colour system** — `color` (mono), `colors` (palette), `ink`, `paper`,
  `shades()`, `diverging()`.
- **Demos** — `showcase`, `charts`, `areas`, `more-charts`, `uncertainty`, `blob`.

## Axes / keys / titles pass (done)
- **Axes** — present and correct on every cartesian chart (bar, hbar, histogram,
  area, stacked, line, scatter, interval, forest); radial/flow charts (pie,
  radar, chord, network, sankey, calendar) intentionally have none. `xLabel` /
  `yLabel` supported via the `Chart` base.
- **Keys** — unified through `Chart.drawLegend(items, opts)`. Added: heatmap
  colour bar, radar series legend, pie percentages, scatter optional legend;
  migrated stacked + likert to the shared helper.
- **Titles** — consistent `config.title` on all; handwriting font.

## Gaps (prioritised for long-term planning)

### Tier 1 — needed before anyone can really use it
1. **Hi-DPI / responsive rendering.** Canvas is rendered at CSS pixels, so it's
   blurry on retina. Scale the backing store by `devicePixelRatio`; support
   `width: '100%'` / resize. *(Biggest visible-quality + usability win.)*
2. **Interactivity — tooltips & hover.** The #1 expectation of a charting lib;
   currently fully static. Needs a hit-test layer over the marks.
3. **Packaging & distribution.** No npm publish, no bundled/min build, no CDN
   artifact, no TypeScript types or JSDoc typedefs, no semver/changelog. Today
   you must import `src/` directly.
4. **Accessibility.** No ARIA roles, no `alt`/`aria-label`, no data-table
   fallback, no contrast guidance. Blocks institutional adoption.

### Tier 2 — make the charts truly general
5. **Scales & axes features.** Log/sqrt scales, time/date axes, tick formatting
   (`d3.format`), negative-value handling, optional gridlines per chart, axis
   titles everywhere.
6. **Missing chart variants.** Multi-series line, grouped bars, true vertical
   stacked bar, error bars on bars, donut centre label, pie/scatter auto
   category legends, calendar value legend + month gaps.
7. **Data handling.** File/URL loading, missing/`null` values, input validation
   with clear errors.
8. **Testing.** No automated tests. Add visual-regression snapshots (the
   node-canvas harness is already the basis) + unit tests for scales/layout.

### Tier 3 — polish & reach
9. **Animation** — washes blooming/growing in on load (deferred since Phase 0).
10. **Theming** — named themes, dark mode, **bundled handwriting font** (today
    relies on Caveat via Google Fonts; offline = system fallback).
11. **Export** — PNG/SVG download.
12. **Performance at scale** — validate 1k–10k marks; incremental re-render
    instead of full repaint on every change.
13. **Framework wrappers** — React/Vue/Svelte, Observable, Python. (Vanilla core
    first, per the spec.)

## Suggested phase order
- **Phase 7 — "real library" basics:** hi-DPI/responsive + tooltips + a11y basics.
- **Phase 8 — distribution:** npm build, types, CDN, bundled font, dist + README install.
- **Phase 9 — general charts:** log/time scales + tick formats + multi-series line / grouped & stacked bars.
- **Phase 10 — confidence:** visual-regression tests + performance pass.
- **Later:** animation, theming/dark mode, export, wrappers.
