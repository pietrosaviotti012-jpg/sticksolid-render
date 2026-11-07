#!/usr/bin/env bash
# StickSolid · the "earshot" sound library: short effects made in code by Earshot's bank (MIT), so they belong to us.
# The folder names tell Real SFX the role of each sound (whoosh, hit impact, riser, sub drop, pop, chime shimmer ...).
#   bash genera.sh        (needs earshot: ~/tools/earshot/.venv/Scripts/earshot.exe on Windows, or `earshot` in PATH)
set -e
cd "$(dirname "$0")"
E="${EARSHOT:-$HOME/tools/earshot/.venv/Scripts/earshot.exe}"; [ -x "$E" ] || E=earshot
TMP="$(mktemp -d)"
declare -A FOLDER=(
  [whoosh_fast]="whoosh fast" [swish]="whoosh swish" [whoosh_big]="whoosh big" [pro_whoosh_big]="whoosh big pro"
  [impact]="hit impact" [pro_impact]="hit impact pro" [riser]="riser" [pro_riser]="riser pro" [downlifter]="riser reverse downlifter"
  [sub_drop]="sub drop" [pro_sub_drop]="sub drop pro" [pop]="pop" [pro_pop]="pop pro" [pro_pop_in]="pop in"
  [knock]="foley knock" [shimmer]="chime shimmer" [pro_shimmer]="chime shimmer pro" [reverse_swell]="riser reverse swell" [glitch]="glitch"
)
"$E" sfx list 2>/dev/null | awk '{print $1}' | while read -r id; do
  fam="${id%%/*}"; dir="${FOLDER[$fam]}"; [ -n "$dir" ] || continue
  mkdir -p "$dir"; name="${id#*/}"; name="${name//\//_}"
  "$E" sfx render "$id" -o "$TMP/x.wav" >/dev/null 2>&1 && ffmpeg -y -v error -i "$TMP/x.wav" -c:a libvorbis -q:a 6 "$dir/$name.ogg" && echo "$dir/$name.ogg"
done
rm -rf "$TMP"
