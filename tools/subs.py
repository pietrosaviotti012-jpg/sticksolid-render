"""Subtitles file for a production: python tools/subs.py <production folder>  →  out/film.srt
Times come from events.json (line starts and durations), text from script.json."""
import json, os, sys

prod = sys.argv[1]
ev = json.load(open(os.path.join(prod, "events.json")))
text = {L["id"]: L["text"] for L in json.load(open(os.path.join(prod, "script.json"), encoding="utf-8"))["lines"]}
def ts(s): h, s = divmod(s, 3600); m, s = divmod(s, 60); return f"{int(h):02}:{int(m):02}:{int(s):02},{int(round((s % 1) * 1000)) % 1000:03}"
rows = [e for e in ev["ev"] if e["type"] == "line"]
with open(os.path.join(prod, "out", "film.srt"), "w", encoding="utf-8") as f:
    for i, e in enumerate(rows, 1):
        f.write(f"{i}\n{ts(e['t'])} --> {ts(e['t'] + e['dur'] + .3)}\n{text[e['id']]}\n\n")
print("subtitles", len(rows), "lines")
