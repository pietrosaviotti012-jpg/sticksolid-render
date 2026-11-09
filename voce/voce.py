"""StickSolid voice maker (Kokoro, free, local).

    python voce.py <script.json> <out.mp3> [voice] [speed] [--raw] [--cupo]

script.json: a list of lines. A line is a string, or {"text", "voice", "speed", "fx", "gap"}:
  voice  a Kokoro voice ("am_puck") or a blend ("am_puck+am_michael:0.7")
  fx     "radio" (alert, walkie-talkie), "phone" (call), "whisper" (close, breathy, quieter)
  gap    seconds of silence after the line (default: tight, a bit more after the hook and questions)
Every line goes through normalizza() first (numbers, years, times, units...), unless --raw.
The whole take then gets the "creator" sound: more body, more presence, compression, -14 LUFS.
"""
import json, os, re, shutil, subprocess, sys, tempfile
import numpy as np, soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
from normalizza import normalizza

def _kit():
    """the kit: $STICKSOLID_KIT, else skills/kit in this repository, else the copy installed on the PC"""
    here = os.path.dirname(os.path.abspath(__file__))
    for k in (os.environ.get("STICKSOLID_KIT"), os.path.join(here, "..", "skills", "kit"),
              os.path.expanduser("~/tools/claude-animation-skills/kit")):
        if k and os.path.exists(os.path.join(k, "models", "kokoro-v1.0.onnx")): return os.path.realpath(k)
    return os.path.join(here, "..", "skills", "kit")


KIT = _kit()
CREATOR = ("highpass=f=70,equalizer=f=120:t=q:w=1:g=3,equalizer=f=3200:t=q:w=1.2:g=2.5,"
           "acompressor=threshold=-20dB:ratio=3:attack=15:release=90:makeup=2,loudnorm=I=-14:TP=-1.5")
# a darker master for tense stories (Your call): more chest, less shine, a touch of room
CUPO = ("highpass=f=60,equalizer=f=110:t=q:w=1:g=4.5,equalizer=f=450:t=q:w=1.5:g=-2,equalizer=f=3000:t=q:w=1.2:g=1,"
        "lowpass=f=9500,aecho=0.8:0.5:45:0.12,acompressor=threshold=-22dB:ratio=3.5:attack=15:release=110:makeup=2,loudnorm=I=-14:TP=-1.5")
MASTERS = {"creator": None, "cupo": CUPO}
FX = {
    "radio": "highpass=f=450,lowpass=f=3000,acrusher=bits=10:mix=0.25,equalizer=f=1800:t=q:w=1:g=6,volume=0.9",
    "phone": "highpass=f=300,lowpass=f=3400,equalizer=f=1500:t=q:w=1:g=4",
    "whisper": "highpass=f=180,equalizer=f=6000:t=q:w=1:g=4,volume=0.6",
}
_k = None


def kokoro():
    global _k
    if _k: return _k
    from kokoro_onnx import Kokoro, EspeakConfig
    import espeakng_loader
    data = espeakng_loader.get_data_path()
    if len(data) > 100:                                  # espeak-ng fails on a long data path
        short = os.path.join(tempfile.gettempdir(), "kokoro-espeak-ng-data")
        if not os.path.exists(os.path.join(short, "phontab")):
            shutil.rmtree(short, ignore_errors=True); shutil.copytree(data, short)
        data = short
    _k = Kokoro(os.path.join(KIT, "models/kokoro-v1.0.onnx"), os.path.join(KIT, "models/voices-v1.0.bin"),
                espeak_config=EspeakConfig(lib_path=espeakng_loader.get_library_path(), data_path=data))
    return _k


def style(voice):
    if "+" not in voice: return voice, ("en-gb" if voice[:1] == "b" else "en-us")
    a, rest = voice.split("+"); b, w = rest.split(":"); w = float(w)
    k = kokoro()
    return k.get_voice_style(a) * w + k.get_voice_style(b) * (1 - w), ("en-gb" if a[:1] == "b" else "en-us")


def say(text, voice="am_puck", speed=1.15, raw=False):
    st, lang = style(voice)
    s, sr = kokoro().create(text if raw else normalizza(text), voice=st, speed=speed, lang=lang)
    idx = np.where(np.abs(s) > 0.01)[0]
    return s[max(0, idx[0] - int(.02 * sr)): idx[-1] + int(.04 * sr)], sr


def ffx(samples, sr, chain):
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, samples, sr)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a, "-af", chain, "-ar", str(sr), b], check=True)
        return sf.read(b, dtype="float32")[0]


# ---- ElevenLabs (9 November): the user chose Brian (Your Call, What if) and Lily (True story).
# Used only for the narrator's lines, and only when ELEVENLABS_API_KEY is set (GitHub secret). Any error -> Kokoro, the video still comes out.
ELEVEN = {"brian": "nPczCjzI2devNBz1zQrb", "lily": "pFZP5JQG7iQjIQuC4Bku", "adam": "pNInz6obpgDQGcFmaJgB", "george": "JBFqnCBsd6RMkjVDRZzb",
          "callum": "N2lVS1w4EtoT3dr4eOWO", "matilda": "XrExE9yKIg1WjnnlVkGX"}
NARRATORI = {"am_puck+am_onyx:0.7": "brian", "af_heart": "lily"}          # U01 -> Brian, D01 -> Lily
TAG = re.compile(r"\[[a-z][a-z ]*\]\s*", re.I)


def pulisci(text):
    """the text without the direction tags ([whispers], [tense]...): what Kokoro reads and what the captions show"""
    return re.sub(r"\s{2,}", " ", TAG.sub("", text)).strip()


def eleven(text, name, prev="", nxt="", sr=24000):
    import urllib.request
    key = os.environ["ELEVENLABS_API_KEY"]
    body = {"text": text, "model_id": os.environ.get("ELEVEN_MODEL", "eleven_v4"),
            "voice_settings": {"stability": 0.4, "similarity_boost": 0.8}}
    if prev: body["previous_text"] = prev                           # the lines around keep the melody of the whole story, not line by line
    if nxt: body["next_text"] = nxt
    vid = ELEVEN.get(name.lower(), name)
    last = None
    for b in (body, {k: v for k, v in body.items() if k not in ("previous_text", "next_text")}):
        try:
            req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{vid}?output_format=mp3_44100_128",
                                         data=json.dumps(b).encode(), method="POST",
                                         headers={"xi-api-key": key, "Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=120) as r: mp3 = r.read()
            break
        except Exception as e: last = e
    else: raise last
    with tempfile.TemporaryDirectory() as d:
        a, w = os.path.join(d, "a.mp3"), os.path.join(d, "a.wav")
        open(a, "wb").write(mp3)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", a, "-ac", "1", "-ar", str(sr), w], check=True)
        s = sf.read(w, dtype="float32")[0]
    idx = np.where(np.abs(s) > 0.01)[0]
    return s[max(0, idx[0] - int(.02 * sr)): idx[-1] + int(.04 * sr)], sr


def make(lines, out, voice="am_puck", speed=1.15, raw=False, master="creator", regia=None, eleven_voice=None):
    """regia: None = flat reading as before; a list of line plans from regia.piano() = directed reading"""
    parts, meta, t, sr, used = [], [], 0.0, 24000, set()
    for i, ln in enumerate(lines):
        ln = {"text": ln} if isinstance(ln, str) else ln
        p = regia[i] if regia else None
        sp = ln.get("speed", speed) * (p["velocita"] if p else 1)
        if p: sp = min(sp, 1.2)                                          # faster than 1.2 Kokoro starts to swallow words
        s = None
        name = eleven_voice or NARRATORI.get(voice)
        if name and os.environ.get("ELEVENLABS_API_KEY") and "voice" not in ln:    # narrator only; characters keep Kokoro
            txt = ln["text"] if raw else normalizza(ln["text"])
            near = lambda j: (lambda x: x if isinstance(x, str) else x.get("text", ""))(lines[j]) if 0 <= j < len(lines) else ""
            try: s, sr = eleven(txt, name, near(i - 1), near(i + 1)); used.add("elevenlabs:" + name)
            except Exception as e: print(f"  ElevenLabs non risponde ({str(e)[:80]}): questa battuta la legge Kokoro")
        if s is None: s, sr = say(pulisci(ln["text"]), ln.get("voice", voice), sp, raw); used.add("kokoro")
        if p and not p.get("personaggio"):                               # a character's line (radio, whisper) keeps its own voice
            from regia import prosodia
            s = prosodia(s, sr, p, ln["text"] if raw else normalizza(ln["text"]))
            if p["pausa_prima"] and parts: parts.append(np.zeros(int(p["pausa_prima"] * sr), dtype=np.float32)); t += p["pausa_prima"]
        if ln.get("fx"): s = ffx(s, sr, FX[ln["fx"]])
        gap = ln.get("gap", (0.06 + p["pausa_dopo"]) if p else 0.07 + (0.12 if i == 0 or ln["text"].rstrip().endswith(("?", "!")) else 0))
        meta.append({"i": i, "text": ln["text"], "spoken": pulisci(ln["text"] if raw else normalizza(ln["text"])),
                     "voice": ln.get("voice", voice), "fx": ln.get("fx"), "start": round(t, 3), "dur": round(len(s) / sr, 3),
                     **({"regia": {k: v for k, v in p.items() if k != "perche"}} if p else {})})
        parts += [s, np.zeros(int(gap * sr), dtype=np.float32)]; t += len(s) / sr + gap
    vo = np.concatenate(parts)
    tmp = out.rsplit(".", 1)[0] + ".raw.wav"; sf.write(tmp, vo, sr)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-af", MASTERS.get(master) or CREATOR, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", out], check=True)
    json.dump(meta, open(out.rsplit(".", 1)[0] + ".lines.json", "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print("  motore voce:", ", ".join(sorted(used)))
    return out, len(vo) / sr


if __name__ == "__main__":
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    lines = json.load(open(a[0], encoding="utf-8"))
    o, d = make(lines, a[1], a[2] if len(a) > 2 else "am_puck", float(a[3]) if len(a) > 3 else 1.15, "--raw" in sys.argv,
                "cupo" if "--cupo" in sys.argv else "creator")
    print(o, f"{d:.1f}s")
