#!/bin/sh
# Build a production's film: sh tools/build.sh <production folder>
# Needs the narration already made (tools/voice.py), the Lemo-Opuscar library in $LIB (default ~/lemo-opuscar)
# and a Python with numpy, scipy and soundfile in $PY (default python3).
# Quality knobs: Q (page query; the default looks the same as full quality at a quarter of the cost without a GPU), WORKERS (default 3).
# Output in <production>/out: film.mp4 (1080×1920, 30 fps, −14 LUFS), poster.jpg, sheet.jpg (contact sheet), film.srt.
set -e
STUDIO=$(cd "$(dirname "$0")/.." && pwd)
P=$(cd "$1" && pwd)
LIB=${LIB:-$HOME/lemo-opuscar}; export LIB
PY=${PY:-python3}
Q=${Q:-ssaa=1&dof=12&msaa=0&shadowmap=512&bloomres=.5}; WORKERS=${WORKERS:-3}
office() { node "$STUDIO/tools/office.mjs" "$@" || true; }

[ -f "$P/vo/dur.json" ] || { echo "build: no narration yet, run tools/voice.py first"; exit 1; }
rm -rf "$P/engine"; cp -r "$STUDIO/engine" "$P/engine"; cp "$STUDIO/engine/index.html" "$P/index.html"
mkdir -p "$P/out"
cd "$LIB"

node core/render/events.mjs "$P" --size 1080x1920 --out "$P/events.json"
office '{"dept":"musica","status":"working","task":"Preparo la musica sulle scene"}'
$PY "$STUDIO/tools/score.py" "$P"
office '{"dept":"musica","status":"done","task":"Musica pronta"}' '{"dept":"animazione","status":"working","task":"Disegno i fotogrammi del film"}'
if [ -n "$SEGMENTS" ]; then   # slices already rendered elsewhere (tools/segment.mjs): join them losslessly
  ls "$SEGMENTS"/seg_*.mp4 | sort -V | sed "s/.*/file '&'/" > "$P/out/segments.txt"
  ffmpeg -v error -y -f concat -safe 0 -i "$P/out/segments.txt" -c copy "$P/out/video.mp4"
else
  node core/render/video.mjs "$P" --fps 30 --workers "$WORKERS" --size 1080x1920 --q "$Q" --out "$P/out/video.mp4"
fi
office '{"dept":"animazione","status":"done","task":"Fotogrammi pronti"}' '{"dept":"montaggio","status":"working","task":"Unisco voce, musica e suoni e aggiungo i sottotitoli"}'
$PY "$STUDIO/tools/mix.py" "$P"
$PY "$STUDIO/tools/subs.py" "$P"
sh core/render/mux.sh "$P/out/video.mp4" "$P/out/mix.wav" "$P/out/film.mp4" 30 1

# poster (the hook frame) and a contact sheet for the quality check
POSTER_T=$(node -e "const e=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); const l=e.ev.find(x=>x.type==='line'); console.log((l.t+l.dur*.8).toFixed(2))" "$P/events.json")
ffmpeg -v error -y -ss "$POSTER_T" -i "$P/out/film.mp4" -frames:v 1 -q:v 2 "$P/out/poster.jpg"
ffmpeg -v error -y -i "$P/out/film.mp4" -vf "fps=1/3,scale=270:-1,tile=6x3" -frames:v 1 "$P/out/sheet.jpg"
# cover: the frame at meta.cover.t (or the poster time) with meta.cover's big promise on it; the Reel cover
COVER_T=$(node -e "const m=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')); console.log(m.cover?.t ?? process.argv[2])" "$P/meta.json" "$POSTER_T")
rm -rf "$P/out/cover"
node core/render/still.mjs "$P" "$COVER_T" --size 1080x1920 --q "$Q&cover=1" --prefix c_ --out "$P/out/cover" 2>&1 | grep -v "optional file missing" || true
ffmpeg -v error -y -i "$(ls "$P"/out/cover/c_* | head -1)" -q:v 2 "$P/out/cover.jpg" || cp "$P/out/poster.jpg" "$P/out/cover.jpg"
office '{"dept":"montaggio","status":"done","task":"Film montato"}'
echo "film: $P/out/film.mp4"
