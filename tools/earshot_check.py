"""The film heard by earshot: python tools/earshot_check.py <production folder>   (in earshot's own environment; render.yml runs it)

earshot (https://github.com/Leonxlnx/earshot, MIT) listens to out/film.mp4 and scores the sound against professional films:
loudness, music under the voice, sound on the cuts, the ending, stereo. Writes out/earshot.json, which quality.py turns into
one check in Approva. Its references are launch films, not short stories: it is advice, never a gate.
"""
import json, os, sys
from earshot import api

P = sys.argv[1]
c = api.critique(os.path.join(P, "out", "film.mp4"))
NAMES = {   # the measures worth showing, in Italian; the others stay in the JSON
    "lufs_i": "volume generale", "true_peak": "picchi", "p_real": "suoni veri", "music_frac": "musica presente",
    "cuts_with_sound": "cambi di scena con un suono", "first_sound_s": "primo suono", "max_gap_s": "silenzio più lungo",
    "final_lu": "volume del finale", "end_silence_s": "silenzio alla fine", "side_to_mid_db": "ampiezza stereo", "band_sub": "bassi profondi",
}
SHOW = lambda v, u: f"{v * 100:.0f}%" if u == "share" else f"{v:.1f} {u}".replace(".", ",")
bad = [m for m in c["metrics"] if m["metric"] in NAMES and m["status"] not in ("ok", "info") and m["weight"] in ("critical", "major")]
detail = ("; ".join(f"{NAMES[m['metric']]}: {SHOW(m['value'], m.get('unit', ''))}, fuori dai film di riferimento" for m in bad)
          or f"tutto nei valori dei film di riferimento ({sum(m['status'] == 'ok' for m in c['metrics'])} misure)")
json.dump({"ok": not bad, "detail": detail, "score": c.get("score"), "verdict": c.get("verdict"),
           "metrics": {m["metric"]: [m["value"], m["status"]] for m in c["metrics"]}, "actions": [a["action"] for a in c.get("actions", [])]},
          open(os.path.join(P, "out", "earshot.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(detail)
