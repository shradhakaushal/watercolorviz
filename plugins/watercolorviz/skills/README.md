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

## How this is packaged (plugin + marketplace)

These two skills are bundled into **one Claude Code plugin** named `watercolor`,
listed by the `watercolorviz` marketplace at the repo root:

```
watercolorviz/                          (this repo = the marketplace)
├── .claude-plugin/marketplace.json     # catalog → lists the "watercolor" plugin
└── plugins/watercolorviz/              (the plugin)
    ├── .claude-plugin/plugin.json      # name: "watercolor"
    └── skills/                         # ← these skills (auto-discovered)
        ├── watercolor-charts/
        └── watercolor-render/
```

Both skills are **model-invoked** (no `disable-model-invocation`), so "watercolor
this chart" / "watercolify this shape" triggers them automatically.

### Install (end users)
```
/plugin marketplace add shradhakaushal/watercolorviz
/plugin install watercolor@watercolorviz
```

### Test locally (maintainers)
```
claude plugin validate .                         # validate marketplace + plugin
claude --plugin-dir ./plugins/watercolorviz      # load the plugin directly
# or: /plugin marketplace add ./  then  /plugin install watercolor@watercolorviz
```

### Wider discoverability
Submit the plugin for review to Anthropic's community marketplace at
<https://claude.ai/settings/plugins/submit> (run `claude plugin validate` first).
Approved plugins are installable via `@claude-community`.

Both skills are MIT-licensed (matching the library). `watercolor-charts` needs no
install or build; `watercolor-render` runs `npm install` in its `scripts/` folder
on first use (locate it via `${CLAUDE_PLUGIN_ROOT}` when installed as a plugin).

### Versioning
Bump `version` in `plugins/watercolorviz/.claude-plugin/plugin.json` on each
release (don't also set it in the marketplace entry — `plugin.json` wins). To ship
a new library version, bump the `@0.1.0` CDN pin in `watercolor-charts/SKILL.md` +
`templates/*.html` and the `watercolorviz` version in
`watercolor-render/scripts/package.json`.
