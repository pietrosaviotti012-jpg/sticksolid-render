#!/bin/sh
# Review stills of a production: sh tools/stills.sh <production folder> <out folder> <t> [<t> …]
# Copies the engine into the production, then renders with the Lemo-Opuscar library ($LIB, default ~/lemo-opuscar).
set -e
STUDIO=$(cd "$(dirname "$0")/.." && pwd)
P=$(cd "$1" && pwd); OUT="$2"; shift 2
LIB=${LIB:-$HOME/lemo-opuscar}
rm -rf "$P/engine"; cp -r "$STUDIO/engine" "$P/engine"; cp "$STUDIO/engine/index.html" "$P/index.html"
cd "$LIB"
node core/render/still.mjs "$P" "$@" --size 1080x1920 --q "${Q:-ssaa=1}" --out "$OUT" 2>&1 | grep -v "optional file missing" || true
