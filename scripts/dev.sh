#!/usr/bin/env bash
# Static dev server for watercolorviz.
#
# Serves the repo so the demos run as ES modules (which can't be opened from
# file://). Works from the Conductor Run button or directly from a terminal.
#
#   - Honors CONDUCTOR_PORT so parallel Conductor workspaces don't collide;
#     falls back to 8000 when run by hand.
#   - `exec` replaces the shell with python so Conductor's stop signal
#     (SIGHUP) reaches the server directly instead of an orphaned child.
set -euo pipefail

PORT="${CONDUCTOR_PORT:-8000}"

# Run from the repo root regardless of where the script is invoked.
cd "$(dirname "$0")/.."

echo "🎨 watercolorviz dev server"
echo "   Showcase  : http://localhost:${PORT}/examples/showcase.html"
echo "   Blob demo : http://localhost:${PORT}/examples/blob.html"
echo "   Bar chart : http://localhost:${PORT}/examples/bars.html"
echo "   Charts    : http://localhost:${PORT}/examples/charts.html"
echo "   Areas     : http://localhost:${PORT}/examples/areas.html"
echo "   More      : http://localhost:${PORT}/examples/more-charts.html"
echo "   Repo root : http://localhost:${PORT}/"
echo

exec python3 -m http.server "$PORT"
