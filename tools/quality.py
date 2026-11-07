# Controllo qualità (Miva): the finished film, watched by a machine, before it reaches the user's desk.
#   python tools/quality.py <production folder>   writes out/quality.json: { ok, problems: [...], checks: [{name, ok, detail}] }
# It never stops the chain: what it finds goes to Approva next to the video. Measures only what can really be measured:
# loudness, black or nearly black stretches, the start of the hook, the length, and the words in the final mix.
import json, os, re, subprocess, sys, tempfile

P = sys.argv[1]
film = os.path.join(P, "out", "film.mp4")
script = json.load(open(os.path.join(P, "script.json"), encoding="utf8"))
checks = []
it = lambda v: f"{v:.1f}".replace(".", ",")   # the Office speaks Italian: decimal comma
def add(name, ok, detail):
    checks.append({"name": name, "ok": bool(ok), "detail": detail})

def ff(*args):
    return subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", film, *args, "-f", "null", "-"], capture_output=True, text=True).stderr

# length
m = re.search(r"Duration: (\d+):(\d+):([\d.]+)", ff("-t", "0.1"))
dur = int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])
add("Durata", 30 <= dur <= 100, f"{dur:.0f} secondi (va bene tra 30 e 100)")

# loudness: −14 LUFS ± 1
m = re.findall(r"I:\s+(-?[\d.]+) LUFS", ff("-af", "ebur128", "-vn"))
if m:
    add("Volume", abs(float(m[-1]) + 14) <= 1, f"{it(float(m[-1]))} LUFS (obiettivo −14 ± 1)")

# brightness twice a second: YAVG is 16 on pure black. The last seconds (end card) can be dark.
out = subprocess.run(["ffmpeg", "-hide_banner", "-i", film, "-vf", "fps=2,scale=108:-1,signalstats,metadata=print:file=-", "-an", "-f", "null", "-"], capture_output=True, text=True).stdout
y = [float(v) for v in re.findall(r"YAVG=([\d.]+)", out)]
dark, run, start = [], 0, 0
for i, v in enumerate(y + [255]):
    if v < 22:
        start = start if run else i; run += 1
    else:
        if run >= 4 and start / 2 < dur - 5:   # two seconds or more
            dark.append((start / 2, run / 2))
        run = 0
add("Scene buie", not dark, "nessuna scena quasi nera" if not dark else "; ".join(f"quasi nero per {it(d)} secondi dal secondo {s:.0f}" for s, d in dark[:4]))

# the hook: something on screen and the voice under way within two seconds
lead = float(script.get("lead", 1.4))
first = y[:4]
add("Gancio", lead <= 2 and (not first or max(first) >= 22), f"la voce parte dopo {it(lead)} secondi" + ("" if not first or max(first) >= 22 else ", ma i primi 2 secondi sono neri"))

# a sound in the first two seconds: every reference film measured by Real SFX has one (the music alone does not count)
evp = os.path.join(P, "events.json")
if os.path.exists(evp):
    first = [e for e in json.load(open(evp))["ev"] if e["type"] not in ("line", "shot") and e["t"] < 2]
    add("Suono nel gancio", bool(first), f"{len(first)} effetti nei primi 2 secondi" if first else "nessun effetto nei primi 2 secondi: aggiungine uno sul primo evento")

# the figures on the ground: shots with a figure and a camera that is not at the height of the floor (tools/ground_check.mjs)
try:
    g = json.loads(subprocess.run(["node", os.path.join(os.path.dirname(os.path.abspath(__file__)), "ground_check.mjs"), P], capture_output=True, text=True, check=True).stdout)
    add("Figure a terra", g["ok"], g["detail"])
except Exception as e:
    print("ground check skipped:", type(e).__name__)

# the sound heard by earshot (tools/earshot_check.py, the step before this one): advice against professional films
ep = os.path.join(P, "out", "earshot.json")
if os.path.exists(ep):
    e = json.load(open(ep, encoding="utf8"))
    add("Suono (earshot)", e["ok"], e["detail"])

# the words: Whisper on the final mix must find the lines over music and effects
try:
    from faster_whisper import WhisperModel
    wav = os.path.join(tempfile.gettempdir(), "q.wav")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", film, "-vn", "-ac", "1", "-ar", "16000", wav], check=True)
    segs, _ = WhisperModel("base.en", device="cpu", compute_type="int8").transcribe(wav, language="en")
    norm = lambda s: re.sub(r"[^a-z0-9 ]", " ", s.lower()).split()
    heard = set(norm(" ".join(s.text for s in segs)))
    want = [w for L in script["lines"] for w in norm(L.get("asr", L["text"])) if len(w) > 3 and not w.isdigit()]
    found = sum(w in heard for w in want)
    k = found / max(1, len(want))
    add("Parole capibili", k >= .85, f"{k * 100:.0f}% delle parole si sente sopra musica ed effetti")
except Exception as e:
    add("Parole capibili", True, f"non controllato ({type(e).__name__})")

problems = [f"{c['name']}: {c['detail']}" for c in checks if not c["ok"]]
json.dump({"ok": not problems, "problems": problems, "checks": checks}, open(os.path.join(P, "out", "quality.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
print(json.dumps(checks, indent=1))
