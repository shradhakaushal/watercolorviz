# watercolorviz skills

Two Agent Skills that let anyone turn data, an existing chart, or a shape into a
**watercolor-style visualization** — without first installing the library.

| Skill | What it does | Needs |
|-------|--------------|-------|
| [`watercolor-charts`](./watercolor-charts) | Zero-install. Picks the right chart, builds the config, and emits a **self-contained HTML file** (or paste-in snippet) that loads watercolorviz from a CDN. Also converts charts from Chart.js / Vega-Lite / matplotlib / D3 / ECharts / CSV / screenshots, and watercolifies shapes in the browser. | Nothing — runs anywhere Claude runs. |
| [`watercolor-render`](./watercolor-render) | Bakes **PNG image files** headlessly via Node (`node-canvas`). Renders any chart from a JSON config, and watercolifies shapes (built-ins, SVG paths, point arrays). | A Node sandbox where `npm install` can build the `canvas` native module. |

They're complementary: `watercolor-charts` is the everywhere, zero-friction path
(an HTML file you open); `watercolor-render` is for when you specifically want an
image file. The charts skill hands off to the render skill when a user asks for a
PNG and a sandbox is available.

## How it stays zero-install

`watercolorviz` is published on npm and mirrored by jsDelivr. The HTML output
imports it from jsDelivr's `+esm` bundle, which **auto-resolves the `d3`
dependency** — so the end user needs no npm install, no bundler, and no import map:

```js
import { Bar } from 'https://cdn.jsdelivr.net/npm/watercolorviz@0.1.0/+esm';
```

The version is pinned (`@0.1.0`) for reproducibility. To ship a new library
version, bump the pin in `watercolor-charts/SKILL.md` + `templates/*.html` and the
`watercolorviz` version in `watercolor-render/scripts/package.json`.

## Layout

```
skills/
├── watercolor-charts/
│   ├── SKILL.md
│   ├── reference/
│   │   ├── chart-api.md        # data shapes + options for every chart
│   │   ├── annotations.md      # annotations (6 types) + chrome: axes/title/labels
│   │   └── convert-from.md     # map other libs/CSV/screenshots → watercolorviz
│   └── templates/
│       ├── chart.html          # zero-install chart page scaffold
│       └── shape.html          # zero-install "watercolify a shape" scaffold
└── watercolor-render/
    ├── SKILL.md
    ├── reference/config-schema.md
    └── scripts/
        ├── render-chart.mjs    # chart config JSON → PNG
        ├── watercolify-shape.mjs
        ├── wcv-node.mjs        # Node DOM shim + render helpers
        └── package.json
```

## Publishing to a skill marketplace

Each subfolder is a standalone skill (a `SKILL.md` with YAML frontmatter plus its
bundled resources). To publish:

- **As individual skills:** zip or point the marketplace at each subfolder
  (`watercolor-charts/`, `watercolor-render/`) on its own.
- **As a plugin bundle:** include this `skills/` directory in a plugin and add the
  two skills to the plugin's marketplace manifest.

Both skills are MIT-licensed (matching the library). No secrets or build step are
required to install `watercolor-charts`; `watercolor-render` runs `npm install` in
its `scripts/` folder on first use.
