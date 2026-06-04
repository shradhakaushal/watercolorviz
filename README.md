# watercolorviz

A library for **watercolor-style data visualizations** — soft bleeding edges, translucent layered
washes, and paper-grain texture. Like [roughViz](https://github.com/jwilber/roughViz) for
hand-drawn charts, but the medium is watercolor. Built for **qualitative, uncertainty-friendly**
storytelling rather than precision dashboards.

> Status: design phase.

## Running the demos

The demos load as ES modules, so they need to be served over HTTP (not opened from `file://`).

- **In Conductor:** click **Run**. It executes `scripts/dev.sh`, which serves the repo on the
  workspace's `CONDUCTOR_PORT` (so parallel workspaces don't collide). Open the printed
  `…/examples/blob.html` URL.
- **From a terminal:** `npm run dev` (or `./scripts/dev.sh`) → http://localhost:8000/examples/blob.html

## Docs
- [Specification](./docs/SPEC.md) — vision, architecture, the paint engine, API, the 10 visualizations, non-goals.
- [Roadmap](./docs/ROADMAP.md) — phased build order.

## The 10 visualizations (v1)
All ride a single **wash/fill engine** via 4 shared shape primitives:

- **Rectangular:** vertical bar, horizontal bar, histogram, heatmap
- **Area paths:** area, stacked area/streamgraph, ridgeline/joyplot
- **Radial:** pie/donut, radar/spider
- **Points:** scatter/bubble

Line/network/flow (stroke-based) need a separate brushstroke engine and are deliberately deferred.
