"""StickSolid voice check: listen back to a take and measure the common voice problems.

    python controllo.py <take.mp3> [...]      (each take needs its <take>.lines.json from voce.py)

For every take:
  - words: the take is transcribed with Parakeet (kit) and compared with what should be said;
    every word that differs is listed (misread numbers, swallowed words, wrong abbreviations)
  - speed in words per second, length
  - loudness (LUFS, target -14) and true peak (must stay under -1 dB)
  - the longest silence inside the take (a pause over 0.6 s feels like a mistake in a short)
"""
import difflib, glob, json, os, re, subprocess, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from normalizza import normalizza
from voce import KIT; sys.path.insert(0, KIT)
import words as kitwords                                          # the kit's Parakeet helpers

_rec = None


def heard(path):
    global _rec
    import sherpa_onnx  # noqa
    if _rec is None: _rec = kitwords.recognizer()
    a = kitwords.load(path)
    s = _rec.create_stream(); s.accept_waveform(kitwords.SR, a); _rec.decode_stream(s)
    return s.result.text, a


def toks(t):
    # the recogniser writes "World War II", "the 80s", "$3.5" glued to the word before: undo that first
    t = re.sub(r"\bII\b", "two", t); t = re.sub(r"\b(?<!')([2-9])0s\b", lambda m: "'" + m[1] + "0s", t)
    t = re.sub(r"(?<=[a-z])(?=[$\d])", " ", t)
    t = re.sub(r"(\d)\s*([aApP])\.?\s?[mM]\b\.?", lambda m: m[1] + " " + m[2].lower() + "m", t)
    t = re.sub(r"\b([ap])m\b", r"\1 m", t, flags=re.I)                 # always compare "a m" with "a m"
    t = normalizza(t).lower().replace("-", " ")
    t = re.sub(r"\b([a-z]) (?=[a-z]\b)", r"\1", t)                 # "f b i" -> "fbi", "a m" -> "am"
    return re.findall(r"[a-z']+", t)


def loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "ebur128=peak=true", "-f", "null", "-"], capture_output=True, text=True).stderr
    lufs = re.findall(r"I:\s+(-?[\d.]+) LUFS", r); peak = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r)
    return float(lufs[-1]) if lufs else None, float(peak[-1]) if peak else None


def longest_silence(a, sr=16000):
    fr = int(0.02 * sr); n = len(a) // fr
    rms = np.sqrt((a[: n * fr].reshape(n, fr) ** 2).mean(1) + 1e-12); quiet = 20 * np.log10(rms) < -45
    best = cur = 0
    for i, q in enumerate(quiet):
        cur = cur + 1 if q else 0
        if q and 5 < i < n - 5: best = max(best, cur)
    return best * 0.02


def check(path):
    meta = json.load(open(path.rsplit(".", 1)[0] + ".lines.json", encoding="utf-8"))
    want = toks(" ".join(m["spoken"] for m in meta))
    text, a = heard(path)
    got = toks(text)
    sm = difflib.SequenceMatcher(a=want, b=got, autojunk=False)
    # which line every expected word belongs to, to listen to a doubtful line again on its own
    line_of = [m["i"] for m in meta for _ in toks(m["spoken"])]
    errs, doubts, bad = [], [], 0
    for op, i1, i2, j1, j2 in sm.get_opcodes():
        if op == "equal": continue
        e = (" ".join(want[i1:i2]) or "—", " ".join(got[j1:j2]) or "—")
        # Parakeet hears the whole take at once, and its language model sometimes "corrects" a clear word from the
        # sentence before ("nothing else would. You would..." -> "It would"). If the line, heard alone, is exactly
        # right, the audio is fine: it is listed as a doubt, not as an error.
        li = line_of[min(i1, len(line_of) - 1)] if line_of else None
        if li is not None and "start" in meta[li] and line_alone_ok(a, meta[li]): doubts.append(e); continue
        errs.append(e); bad += max(i2 - i1, j2 - j1)
    wer = bad / max(1, len(want))
    dur = len(a) / kitwords.SR; lufs, peak = loudness(path)
    return {"file": os.path.basename(path), "dur": round(dur, 1), "wps": round(len(want) / dur, 2), "wer": round(wer * 100, 1),
            "lufs": lufs, "peak": peak, "silence": round(longest_silence(a), 2), "errors": errs, "dubbi_contesto": doubts, "heard": text}


def line_alone_ok(a, m):
    """transcribe one line of the take on its own and compare it with what it should say"""
    sr = kitwords.SR; s0 = max(0, int((m["start"] - 0.05) * sr)); s1 = int((m["start"] + m["dur"] + 0.08) * sr)
    s = _rec.create_stream(); s.accept_waveform(sr, a[s0:s1]); _rec.decode_stream(s)
    return toks(s.result.text) == toks(m["spoken"])


if __name__ == "__main__":
    files = [f for p in sys.argv[1:] for f in sorted(glob.glob(p))]
    rows = [check(f) for f in files]
    for r in rows:
        print(f"{r['file']:44s} {r['dur']:5.1f}s {r['wps']:4.2f} w/s  parole sbagliate {r['wer']:4.1f}%  {r['lufs']} LUFS  picco {r['peak']} dB  pausa max {r['silence']}s")
        for w, g in r["errors"][:12]: print(f"      voleva «{w}»  sentito «{g}»")
    out = os.environ.get("REPORT")
    if out: json.dump(rows, open(out, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
