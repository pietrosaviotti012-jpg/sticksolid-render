#!/bin/sh
# Check before a push: sh tools/check.sh <production folder>
# The engine and the shots are ES modules: plain `node --check` reads .js as CommonJS and misses broken modules,
# so every file is checked as .mjs. Also checks that script.json and meta.json are valid JSON.
STUDIO=$(cd "$(dirname "$0")/.." && pwd)
T=$(mktemp -d)
fail=0
for f in "$STUDIO"/engine/*.js "$STUDIO"/engine/kit/*.js "$1/shots.js"; do
  cp "$f" "$T/x.mjs"
  node --check "$T/x.mjs" 2>"$T/err" || { echo "ERRORE in $f:"; head -5 "$T/err"; fail=1; }
done
for j in script.json meta.json; do
  node -e "JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'))" "$1/$j" || { echo "ERRORE: $1/$j non è JSON valido"; fail=1; }
done
rm -rf "$T"
node "$STUDIO/tools/themes_check.mjs" >/dev/null || { echo "ERRORE: un tema di colore non si legge (node tools/themes_check.mjs)"; fail=1; }
node -e "const j=JSON.parse(require('child_process').execFileSync('node',[process.argv[1],process.argv[2]]));if(!j.ok)console.log('ATTENZIONE, figure a terra: '+j.detail)" "$STUDIO/tools/ground_check.mjs" "$1" || true
[ $fail = 0 ] && echo "check: tutto a posto"
exit $fail
