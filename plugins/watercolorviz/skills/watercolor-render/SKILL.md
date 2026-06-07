---
name: watercolor-render
description: >-
  Render watercolor-style charts and shapes to PNG image files headlessly (no
  browser), using the watercolorviz engine via Node. Use when the user wants an
  actual image file — "export/save this as a PNG", "give me an image of...",
  "watercolify this logo/shape into a picture" — and a Node sandbox is available.
  Companion to the watercolor-charts skill (which produces zero-install HTML);
  this one bakes pixels. Includes scripts to render any chart from a JSON config
  and to "watercolify" any shape (built-in shapes, an SVG path, or raw points).
license: MIT
---

# watercolor-render

Bakes **PNG image files** of watercolorviz charts and shapes by running the
library headlessly in Node (backed by `node-canvas`). Use this when the user
wants a **file/image artifact**, not a web page. If they just want something to
look at or embed in a page, prefer the **`watercolor-charts`** skill (zero install,
runs from CDN in the browser).

Requires a Node environment where you can install npm packages (the `canvas`
native module compiles on install). If that's not available, fall back to
`watercolor-charts` and have the user export from the browser.

## Locating the scripts

This skill's scripts live in a `scripts/` folder **next to this SKILL.md**. When
the skill is installed as a plugin, that folder is inside the plugin's install
directory, exposed via the `${CLAUDE_PLUGIN_ROOT}` environment variable:

```sh
SCRIPTS="${CLAUDE_PLUGIN_ROOT}/skills/watercolor-render/scripts"
```

Use `$SCRIPTS` (or the absolute path you resolved this SKILL.md from) for every
`node …` and `npm install` command below — don't assume the current working
directory is the scripts folder.

## Setup (once per sandbox)

```sh
cd "$SCRIPTS"
npm install        # installs watercolorviz, d3, and canvas (native build)
```

`canvas` needs system libs to build on some platforms (Cairo/Pango/libjpeg). On
macOS: `brew install pkg-config cairo pango libpng jpeg giflib librsvg`. On
Debian/Ubuntu: `apt-get install build-essential libcairo2-dev libpango1.0-dev
libjpeg-dev libgif-dev librsvg2-dev`. If install fails, say so and fall back to
the HTML path.

## Render a chart → PNG

1. Build a config JSON (chart class + data + options). The exact `data` shape
   and options per chart are in `reference/config-schema.md`. For the full chart
   catalogue and conversion-from-other-libraries tables, the `watercolor-charts`
   skill's `reference/` is the source of truth.
2. Run:
   ```sh
   node render-chart.mjs config.json out.png
   # or pipe the config in:
   echo '{"chart":"Bar","data":{"labels":["A","B"],"values":[3,7]}}' | node render-chart.mjs - bar.png
   ```
3. Output is a PNG at `width*scale × height*scale` px (default 720×480 logical,
   `scale: 2` → retina-crisp). Tell the user the path.

Config fields: `chart` (class name), `data` (the chart's data), `options` (any
shared/chart options — `title`, `colors`, `color`, `ink`, `paper`, `seed`,
`annotations`, …), `width`, `height`, `scale`. Animation is forced off for a
clean static frame.

## Watercolify a shape → PNG

`watercolify-shape.mjs` turns an outline into a painted watercolor blob.

**Quick single shape:**
```sh
node watercolify-shape.mjs --shape flame --color "#d6452f" --out fire.png
node watercolify-shape.mjs --shape star --color "#e8b94f" --outline --out star.png
node watercolify-shape.mjs --svg "M10 10 C 20 0 40 0 50 10 ..." --color "#6f93c2"
node watercolify-shape.mjs --svg-file logo.svg --color "#7c4dbd" --scale 2
node watercolify-shape.mjs --points pts.json --color "#94a854"
```
Built-in shapes: `star`, `flame`, `heart`, `hexagon`, `triangle`, `circle`, `blob`.
Flags: `--color --seed --width --height --paper --outline --scale --dx --dy --out`.

**Layered composition (richer)** — a JSON spec, painted bottom-to-top:
```sh
node watercolify-shape.mjs --spec art.json out.png
```
```json
{
  "width": 640, "height": 640, "paper": "#f7efe1", "scale": 2,
  "layers": [
    { "shape": "flame", "color": "#d6452f", "seed": 11, "args": { "w": 320, "h": 470 } },
    { "shape": "flame", "color": "#f0a23a", "seed": 23, "args": { "w": 200, "h": 360 } }
  ]
}
```
Each layer's extra keys (`color`, `seed`, `intensity`, `bleed`, `granulation`,
`mottle`, `shading`, `edgeDarkening`, `outline`, `outlineColor`, …) pass straight
to `paintPolygon`. A layer is one of: `shape` (+optional `args`), `svg` (a path
`d` string, +optional `scale`/`dx`/`dy`), or `points` (an `[[x,y],…]` array).

**For "watercolor fire", "watercolor a star", a custom subject:** you generate
the outline — either pick a built-in shape, or author an SVG path / point array
for the subject — then run the script. Layer 2–3 blobs (e.g. a deep red flame
under a bright orange one) for depth.

### SVG path support
The flattener handles `M L H V C S Q T Z` (absolute + relative). **Arcs (`A`) are
skipped with a warning** — convert arcs to cubics first if a shape relies on them.
Multiple subpaths each become their own painted blob (good enough for the
watercolor look; true cut-out holes aren't rendered).

## Files in this skill

- `scripts/render-chart.mjs` — chart config JSON → PNG.
- `scripts/watercolify-shape.mjs` — shape (built-in / SVG path / points / spec) → PNG.
- `scripts/wcv-node.mjs` — shared Node helpers (DOM shim, `renderChart`, `renderShapes`).
- `scripts/package.json` — dependencies (`npm install` in `scripts/`).
- `reference/config-schema.md` — the render-chart config contract + per-chart data shapes.
