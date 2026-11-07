"""StickSolid voice direction ("regia"): Kokoro reads every line in the same flat way. The direction decides, line by
line, HOW it is said (fast or slow, higher or lower, which words get the accent, where a beat of silence goes) and then
really changes the audio with Praat (PSOLA): wider melody, accents on the key words, speed changes inside the line.

    python regia.py <script.json> [regia.json]      -> prints the direction it would use (nothing is synthesised)

The direction comes from three places, the later ones winning:
  1. the automatic director, dirigi(): rules on the text (the hook, a "But" turn, numbers, lists, comparisons, a
     calm line, a question, the call to action);
  2. project/regia.json, written by the Copione routine or by hand: one object per line (or null), with any of
        "tono":   gancio | normale | svolta | fatto | elenco | climax | calmo | domanda | cta | cupo
        "enfasi": ["1,670", "east"]    words to stress (higher, a bit longer and louder)
        "veloci": ["the ground, the air and the oceans"]   parts to say faster
        "lenti":  ["nothing else would"]                   parts to say slower
        "beat":   "sound"              a short dramatic silence just before this word
        "pausa_prima" / "pausa_dopo": seconds of silence around the line
        "velocita", "tono_st" (semitones up/down), "melodia" (1 = as Kokoro, 1.5 = much livelier)
  3. nothing else: the voice, its blend and the base speed stay those of meta.json.
Needs praat-parselmouth in the kit's Python (installed in ~/tools/claude-animation-skills/kit/.venv).
"""
import json, os, re, sys, tempfile
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from normalizza import normalizza

# how each kind of line is said: speed factor, pitch shift (semitones), melody range (1 = Kokoro's own, flat),
# loudness (dB), accent height (semitones), silence before/after (s)
TONI = {
    "gancio":  dict(vel=1.02, st=+0.8, mel=1.50, db=+1.0, acc=3.0, prima=0.00, dopo=0.24),
    "normale": dict(vel=1.03, st=0.0,  mel=1.35, db=0.0,  acc=2.4, prima=0.00, dopo=0.08),
    "svolta":  dict(vel=0.95, st=-0.6, mel=1.40, db=+0.5, acc=2.8, prima=0.22, dopo=0.10),
    "fatto":   dict(vel=1.00, st=+0.2, mel=1.35, db=0.0,  acc=2.6, prima=0.00, dopo=0.12),
    "elenco":  dict(vel=1.07, st=+0.2, mel=1.35, db=0.0,  acc=2.2, prima=0.00, dopo=0.08),
    "climax":  dict(vel=1.00, st=+1.0, mel=1.55, db=+1.5, acc=3.4, prima=0.00, dopo=0.16),
    "calmo":   dict(vel=0.94, st=-0.5, mel=1.20, db=-1.0, acc=1.8, prima=0.12, dopo=0.14),
    "domanda": dict(vel=1.00, st=+0.4, mel=1.45, db=+0.5, acc=2.6, prima=0.00, dopo=0.20),
    "cta":     dict(vel=0.97, st=+0.3, mel=1.35, db=0.0,  acc=2.2, prima=0.18, dopo=0.00),
    "cupo":    dict(vel=0.93, st=-1.0, mel=1.20, db=0.0,  acc=2.0, prima=0.10, dopo=0.14),
}
TURN = re.compile(r"^(but|however|yet|except|instead|turns out|still|and then)\b", re.I)
STRONG = {"nothing", "everything", "everyone", "anything", "never", "always", "all", "every", "instantly", "suddenly",
          "giant", "huge", "massive", "biggest", "fastest", "deadliest", "only", "keep", "faster", "bigger", "louder",
          "hotter", "colder", "stronger", "impossible", "zero", "billions", "millions", "thousands", "forever", "dead"}
CALM = {"barely", "gentle", "gentler", "calm", "calmer", "safe", "safer", "slowly", "quiet", "softly", "fine"}
CTA = re.compile(r"\b(comments?|follow|subscribe|tell me|let me know|your call)\b", re.I)
nw = lambda w: re.sub(r"[^a-z0-9]", "", w.lower())


def dirigi(lines, cupo=False):
    """the automatic director: one plan per line"""
    plans = []
    for i, text in enumerate(lines):
        words = text.split(); low = [nw(w) for w in words]
        if i == 0: tono = "gancio"
        elif CTA.search(text) and i == len(lines) - 1: tono = "cta"
        elif text.rstrip().endswith("?"): tono = "domanda"
        elif TURN.match(text): tono = "svolta"
        elif any(w in CALM for w in low): tono = "calmo"
        elif len(re.split(r",\s", text)) >= 3 and min(len(c.split()) for c in re.split(r",\s", text)[1:-1]) <= 3: tono = "elenco"
        elif re.search(r"\d", text): tono = "fatto"
        elif "!" in text or any(w in STRONG for w in low): tono = "climax"
        else: tono = "normale"
        if tono == "climax" and plans and plans[-1]["tono"] == "climax": tono = "normale"   # two peaks in a row flatten
        if cupo and tono in ("normale", "fatto", "elenco"): tono = "cupo"
        enf = [w.strip(",.?!;:") for w in words if re.search(r"\d", w)]                    # numbers first
        enf += [w.strip(",.?!;:") for w, l in zip(words, low) if l in STRONG and w.strip(",.?!;:") not in enf]
        m = re.search(r"\bthan (?:a |an |the )?(\w+)", text)                                # "faster than SOUND"
        if m and tono in ("climax", "fatto", "normale"): enf.append(m.group(1))
        if tono == "svolta": enf.insert(0, words[0].strip(",.?!;:"))
        if tono in ("gancio", "domanda") and not enf:                                     # a question: its key verb/noun
            content = [w.strip(",.?!;:") for w in words if len(nw(w)) > 4]
            enf = content[:1]
        p = {"tono": tono, "enfasi": enf[:2]}
        if tono == "elenco":                                                              # the list goes faster
            parts = [c.strip() for c in re.split(r",\s", text)]
            p["veloci"] = [", ".join(parts[1:-1] + [parts[-1].split(" all ")[0]])] if len(parts) > 2 else []
        if tono == "climax" and m: p["beat"] = m.group(1)                                 # "faster than ... sound"
        plans.append(p)
    return plans


def piano(lines, extra=None, cupo=False):
    """the automatic plan, with project/regia.json on top"""
    auto = dirigi(lines, cupo)
    for i, e in enumerate(extra or []):
        if i < len(auto) and e: auto[i] = {**auto[i], **e, "auto": False}
    for p in auto:
        t = TONI[p["tono"]]
        p.setdefault("velocita", t["vel"]); p.setdefault("tono_st", t["st"]); p.setdefault("melodia", t["mel"])
        p.setdefault("pausa_prima", t["prima"]); p.setdefault("pausa_dopo", t["dopo"])
        p["db"] = t["db"]; p["accento"] = t["acc"]
    return auto


# ---------------------------------------------------------------- the audio side
_wk = None
def _words_kit():
    global _wk
    if _wk is None:
        from voce import KIT
        sys.path.insert(0, KIT); import words as wk; _wk = wk
    return _wk


def tempi(samples, sr, spoken):
    """word timings of one line, [{"w","s","e"}], from Parakeet"""
    import soundfile as sf
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, "l.wav"); sf.write(p, samples, sr)
        return _words_kit().timings(p, spoken)


def spans(phrase, W):
    """time spans [s, e] of a phrase of the script (in its spoken form) inside the line's words"""
    target = [nw(x) for x in normalizza(phrase).split() if nw(x)]
    ws = [nw(w["w"]) for w in W]; out = []
    for i in range(len(ws) - len(target) + 1):
        if target and ws[i:i + len(target)] == target:
            j = i + len(target) - 1
            out.append((W[i]["s"], min(W[j]["e"], W[j]["s"] + 0.9)))
    return out


def prosodia(samples, sr, p, spoken):
    """apply one line's direction to its audio: beat, melody, accents, speed changes, loudness"""
    import parselmouth
    from parselmouth.praat import call
    W = tempi(samples, sr, spoken)
    if p.get("beat"):                                                    # a short silence just before a word
        sp = spans(p["beat"], W)
        if sp:
            t0 = sp[-1][0] - 0.02; k = int(t0 * sr); gap = 0.16
            samples = np.concatenate([samples[:k], np.zeros(int(gap * sr), np.float32), samples[k:]])
            for w in W:
                if w["s"] >= t0: w["s"] += gap; w["e"] += gap
    dur = len(samples) / sr
    snd = parselmouth.Sound(samples.astype(np.float64), sampling_frequency=sr)
    man = call(snd, "To Manipulation", 0.01, 60, 320)
    pt = call(man, "Extract pitch tier"); n = call(pt, "Get number of points")
    if n < 3: return samples
    T = np.array([call(pt, "Get time from index", i) for i in range(1, n + 1)])
    F = np.array([call(pt, "Get value at index", i) for i in range(1, n + 1)])
    med = np.median(F); st = 12 * np.log2(F / med)
    st = np.clip(st, -6, 6)                                              # pitch-tracking slips (octave jumps) stay out
    st = st * p["melodia"] + p["tono_st"]                                # a wider melody, shifted up or down
    acc = [s for e in p.get("enfasi", []) for s in spans(e, W)]
    for s, e in acc:                                                     # the accent: a smooth bump on the word
        c = s + 0.35 * (e - s); w = max(0.12, (e - s) * 0.75)
        st += p["accento"] * np.exp(-0.5 * ((T - c) / (w / 2)) ** 2)
    if p["tono"] in ("domanda", "gancio") and spoken.rstrip().endswith("?") and W:      # a question goes up at the end
        s = W[-1]["s"]; st += np.clip((T - s) / max(0.1, dur - s), 0, 1) * 2.0
    st = np.clip(st, -8, 10)
    new = call("Create PitchTier", "p", 0, dur)
    for t, v in zip(T, med * 2 ** (st / 12)): call(new, "Add point", float(t), float(v))
    call([new, man], "Replace pitch tier")
    # speed inside the line: stressed words a bit longer, "veloci" parts faster, "lenti" parts slower
    dt = call("Create DurationTier", "d", 0, dur); pts = {0.0: 1.0, dur: 1.0}
    def zone(s, e, f):
        for t, v in ((s - 0.006, 1.0), (s, f), (e, f), (e + 0.006, 1.0)):
            if 0 < t < dur: pts[round(t, 4)] = v
    for ph in p.get("veloci", []):
        for s, e in spans(ph, W): zone(s, e, 0.88)
    for ph in p.get("lenti", []):
        for s, e in spans(ph, W): zone(s, e, 1.12)
    for s, e in acc: zone(s, e, 1.10)
    for t in sorted(pts): call(dt, "Add point", t, pts[t])
    call([man, dt], "Replace duration tier")
    out = call(man, "Get resynthesis (overlap-add)").values[0].astype(np.float32)
    # loudness: the whole line, plus +2 dB on the accents (mapped through the new durations)
    g = np.full(len(out), 10 ** (p["db"] / 20), np.float32)
    tmap = lambda t: call(dt, "Get target duration", 0, t)
    for s, e in acc:
        a, b = int(tmap(s) * sr), min(int(tmap(e) * sr), len(g))      # an accent on the last word can end past the take
        if b > a + 10:
            env = np.sin(np.linspace(0, np.pi, b - a)) ** 2
            g[a:b] *= (1 + (10 ** (2 / 20) - 1) * env).astype(np.float32)
    out = out * g
    pk = np.max(np.abs(out)); return out / pk * 0.95 if pk > 0.99 else out


if __name__ == "__main__":
    lines = json.load(open(sys.argv[1], encoding="utf-8"))
    extra = json.load(open(sys.argv[2], encoding="utf-8")) if len(sys.argv) > 2 else None
    for l, p in zip(lines, piano(lines, extra)):
        print(f"{p['tono']:8} v{p['velocita']:.2f} {p['tono_st']:+.1f}st mel{p['melodia']:.2f} "
              f"enfasi={p.get('enfasi')} veloci={p.get('veloci', [])} beat={p.get('beat')} | {l}")
