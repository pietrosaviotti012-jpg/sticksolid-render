"""Music box score for a production: python tools/score.py <production folder>

A real track of the format's pack (sounds/PACCHETTI.json: "track" in script.json picks another family, "carillon" forces the box), its level following the moods.
Without one, the fables' music box, synthesised in numpy: metal-tine partials, a soft pad and a low bed.
The shape comes from script.json "music": [{"at": "S1", "mood": "calm"}, …] and the shot times in events.json.
Moods: calm (melody + pad), storm (low drone, no tune), hush (a few high notes), rise (an arpeggio climbing every
beat), warm (melody doubled an octave up + pad), end (a last chord left to ring). Writes out/music.wav (48 kHz stereo).
"""
import json, os, sys
from packs import CAT, SOUNDS, choose, number, pack_of
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
prod = sys.argv[1]
script = json.load(open(os.path.join(prod, "script.json"), encoding="utf-8"))
ev = json.load(open(os.path.join(prod, "events.json")))
DUR = ev["dur"]
shots = {e["id"]: e["t"] for e in ev["ev"] if e["type"] == "shot"}
plan = script.get("music") or [{"at": "S1", "mood": "calm"}]
sections = []
for i, m in enumerate(plan):
    t0 = shots.get(m["at"], m.get("t", 0)) + m.get("offset", 0)
    t1 = shots.get(plan[i + 1]["at"], DUR) + plan[i + 1].get("offset", 0) if i + 1 < len(plan) else DUR
    sections.append((t0, t1, m["mood"]))

_, pack = pack_of(prod)
family = script.get("track") or (pack.get("music") or [None])[number(prod) % max(1, len(pack.get("music") or [1]))]
if family in CAT:
    e = choose(prod, family)
    x, sr = sf.read(os.path.join(SOUNDS, e["file"]), dtype="float32", always_2d=True)
    want = int(DUR * SR)
    while len(x) < want:   # a track shorter than the film comes round again, with a 2-second crossfade
        f = 2 * SR; r = np.linspace(0, 1, f, dtype=np.float32)[:, None]
        x = np.concatenate([x[:-f], x[-f:] * (1 - r) + x[:f] * r, x[f:]])
    x = x[:want].copy()
    LEVEL = {"hush": .5, "calm": .65, "warm": .7, "rise": .85, "storm": 1, "end": .9}   # the end holds up: it closes on the choice, not on a fade
    t = np.arange(want) / SR
    points = sorted([(t0, LEVEL.get(mood, .7)) for t0, _, mood in sections] + [(max(t0, t1 - 1.2), LEVEL.get(mood, .7) if mood != "rise" else 1) for t0, t1, mood in sections])
    x *= np.interp(t, [p[0] for p in points], [p[1] for p in points])[:, None].astype(np.float32)
    fade = int(.8 * SR); x[-fade:] *= np.linspace(1, 0, fade, dtype=np.float32)[:, None]
    os.makedirs(os.path.join(prod, "out"), exist_ok=True)
    sf.write(os.path.join(prod, "out", "music.wav"), x / max(1e-6, np.abs(x).max()) * .7, SR)
    print("music", e["file"], round(DUR, 2), "s,", len(sections), "sections:", ", ".join(m for _, _, m in sections))
    sys.exit()

BPM = script.get("bpm", 66); BEAT = 60 / BPM
KEY = 62   # D
SCALE = [0, 2, 4, 7, 9]   # major pentatonic
CHORDS = [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]   # I – V – vi – IV
rng = np.random.default_rng(script.get("seed", 11))
out = np.zeros((int(DUR * SR) + SR * 4, 2), np.float32)

def midi(n): return 440 * 2 ** ((n - 69) / 12)
def lp(x, f): return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)
def add(x, at, gain=1.0, pan=0.0):
    s = int(at * SR)
    if s < 0: x = x[-s:]; s = 0   # a note humanised to just before zero
    e = min(len(out), s + len(x))
    if s >= len(out) or e <= s: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    out[s:e, 0] += x[:e - s] * gain * l; out[s:e, 1] += x[:e - s] * gain * r

def tine(n, v=1.0, d=2.4):
    """A music-box tine: bright attack, inharmonic partials, long ring."""
    f = midi(n); t = np.arange(int(d * SR)) / SR
    x = sum(a * np.sin(2 * np.pi * f * k * t + p) * np.exp(-t / tau) for k, a, tau, p in
            [(1, 1, .9, 0), (2.0, .25, .5, .3), (5.4, .2, .12, 1), (11.3, .08, .04, 2)])
    x[:96] *= np.linspace(0, 1, 96)
    return (x * v * .22).astype(np.float32)

def pad(notes, d, v=1.0):
    t = np.arange(int(d * SR)) / SR
    x = sum(np.sin(2 * np.pi * midi(n) * t) + .3 * np.sin(2 * np.pi * midi(n) * 2.003 * t) for n in notes)
    env = np.minimum(1, t / 1.6) * np.minimum(1, (d - t) / 1.8)
    return (lp(x, 1400) * env * v * .035).astype(np.float32)

def drone(d, v=1.0):
    t = np.arange(int(d * SR)) / SR
    noise = lp(rng.standard_normal(len(t)), 160) * .6
    x = noise + .5 * np.sin(2 * np.pi * midi(KEY - 24) * t) + .25 * np.sin(2 * np.pi * midi(KEY - 23) * t)   # a rub of a semitone
    env = np.minimum(1, t / 2.5) * np.minimum(1, (d - t) / 2) * (1 + .3 * np.sin(2 * np.pi * t / 5.3))
    return (x * env * v * .05).astype(np.float32)

def phrase(n_notes, lo=0, span=8):
    """A gentle random walk on the pentatonic scale, ending on the tonic."""
    idx = [rng.integers(lo, lo + 3)]
    for _ in range(n_notes - 2): idx.append(int(np.clip(idx[-1] + rng.choice([-2, -1, -1, 1, 1, 2, 0]), lo, lo + span)))
    idx.append(lo + 5 if rng.random() < .5 else lo)
    return [KEY + 12 * (i // 5) + SCALE[i % 5] for i in idx]

for t0, t1, mood in sections:
    d = t1 - t0
    if mood in ("calm", "warm"):
        bar = 4 * BEAT; nb = max(1, int(d / bar))
        for b in range(nb):
            ch = CHORDS[b % 4]; tb = t0 + b * bar
            add(pad([KEY - 12 + c for c in ch], bar + 1.8, 1.0 if mood == "warm" else .7), tb, pan=0)
            add(tine(KEY - 12 + ch[0], .5), tb, pan=-.2)
            mel = phrase(6 if mood == "calm" else 8, lo=5)
            for k, n in enumerate(mel):
                tt = tb + k * bar / len(mel) + (rng.random() - .5) * .015
                add(tine(n, .8 + .2 * rng.random()), tt, pan=.25)
                if mood == "warm" and k % 2 == 0: add(tine(n + 12, .35), tt + .01, pan=-.3)
    elif mood == "storm":
        add(drone(d + 1.5), t0)
    elif mood == "hush":
        for k, tt in enumerate(np.arange(t0 + .8, t1 - .4, 2.3)):
            add(tine(KEY + 12 + SCALE[[0, 3, 4, 2][k % 4]], .45), tt, pan=(-1) ** k * .3)
        add(pad([KEY - 12, KEY - 5], d + 1.5, .35), t0)
    elif mood == "rise":
        n = max(4, int(d / (BEAT / 2)))
        for k in range(n):
            i = k % 12; add(tine(KEY + 12 * (i // 5) + SCALE[i % 5], .5 + .4 * k / n), t0 + k * BEAT / 2, pan=-.4 + .8 * (k / n))
        add(pad([KEY - 12, KEY - 5, KEY + 4], d + 1.5, .5), t0)
    elif mood == "end":
        for k, n in enumerate([KEY - 12, KEY - 5, KEY, KEY + 4, KEY + 7, KEY + 12]):
            add(tine(n, .7, d=5), t0 + k * .09, pan=-.5 + k * .2)
        add(pad([KEY - 12, KEY - 5, KEY + 4], min(d + 2, 8), .9), t0)

out = out[:int(DUR * SR)]
fade = int(1.5 * SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= max(1e-6, np.abs(out).max()) / .7
os.makedirs(os.path.join(prod, "out"), exist_ok=True)
sf.write(os.path.join(prod, "out", "music.wav"), out, SR)
print("music", round(DUR, 2), "s,", len(sections), "sections:", ", ".join(m for _, _, m in sections))
