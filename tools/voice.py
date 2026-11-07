"""Narration for a production: python tools/voice.py <production folder>

Reads script.json; for every line runs Chatterbox (MIT) with that line's acting:
  act.intensity → exaggeration (0.3 calm … 0.8 intense), act.pace → cfg_weight (lower = slower, more deliberate),
  act.speed → tempo change after synthesis (ffmpeg atempo, pitch kept), act.gain_db → level (whisper / normal / climax).
Writes vo/<id>.wav (48 kHz mono, silence trimmed), vo/dur.json, then checks every line with faster-whisper and writes
vo/words.json ({id: [[word, start, end], …]}) for the picture to land actions on spoken words.
Lines whose text and acting did not change are not generated again (vo/hash.json).
Exit code 1 if a line still does not transcribe back after 3 tries.
"""
import hashlib, json, os, re, subprocess, sys, tempfile

import numpy as np
import soundfile as sf

SR = 48000
prod = sys.argv[1]
script = json.load(open(os.path.join(prod, "script.json"), encoding="utf-8"))
vo = os.path.join(prod, "vo"); os.makedirs(vo, exist_ok=True)
hash_file = os.path.join(vo, "hash.json")
hashes = json.load(open(hash_file)) if os.path.exists(hash_file) else {}
voice = dict(script.get("voice", {}))
# the narrator's timbre: a ~9 s reference clip in voices/ (synthetic Kokoro voices, see voices/make_refs.py).
# script.voice.preset picks one (cupo, professore, fiaba, pov); without it the format in meta.json decides.
VOICES = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "voices")
BY_FORMAT = {"your-call": "pov", "money": "pov", "what-if": "professore", "mystery": "cupo", "legend": "cupo", "fable": "fiaba", "tale": "fiaba"}
if not voice.get("prompt"):
    meta_path = os.path.join(prod, "meta.json")
    fmt = json.load(open(meta_path, encoding="utf-8")).get("format", "") if os.path.exists(meta_path) else ""
    preset = voice.get("preset") or BY_FORMAT.get(fmt) or next((v for k, v in BY_FORMAT.items() if k in fmt), None)
    if preset:
        if not os.path.exists(os.path.join(VOICES, preset + ".wav")):
            sys.exit(f"voice: the narrator '{preset}' is missing (voices/{preset}.wav)")   # never fall back silently
        voice["prompt"] = os.path.join(VOICES, preset + ".wav")
        print(f"voice: narrator '{preset}'", flush=True)

def key(L):
    return hashlib.sha1(json.dumps([L["text"], L.get("say"), L.get("act", {}), L.get("vfx"), L.get("speaker"), voice, 2], sort_keys=True).encode()).hexdigest()[:12]

# Whisper writes small numbers as digits ("One millionth" heard as "1 millionth"): both sides become digits
NUMBERS = {w: str(i) for i, w in enumerate("zero one two three four five six seven eight nine ten eleven twelve".split())}

# and decimals and units too ("Three point eight centimeters" heard as "3 .8 cm")
UNITS = {"cm": "centimeters", "mm": "millimeters", "km": "kilometers", "kg": "kilograms", "mph": "miles per hour"}

def norm_words(s):
    s = re.sub(r"(\d)\s*\.\s*(\d)", r"\1 point \2", s.lower().replace("—", " ")).replace("%", " percent")
    words = " ".join(UNITS.get(w, w) for w in re.sub(r"[^a-z0-9' ]", " ", s).split()).split()
    return [NUMBERS.get(w, w) for w in words]

todo = [L for L in script["lines"] if hashes.get(L["id"]) != key(L) or not os.path.exists(os.path.join(vo, L["id"] + ".wav"))]
model = None
if todo:
    import torch, torchaudio
    from chatterbox.tts import ChatterboxTTS
    print(f"voice: {len(todo)} line(s) to generate", flush=True)
    model = ChatterboxTTS.from_pretrained(device="cpu")

# a line can have its own voice from the directory (voices/RUBRICA.json): "speaker": "mostro", for dialogue and characters
def prompt_for(L):
    who = L.get("speaker")
    if not who:
        return voice.get("prompt")
    path = os.path.join(VOICES, who + ".wav")
    if not os.path.exists(path):
        sys.exit(f"voice: the speaker '{who}' of {L['id']} is missing (voices/{who}.wav)")
    return path

def synth(L, attempt):
    import torch
    act = L.get("act", {})
    torch.manual_seed(1000 * attempt + int(L["id"].strip("L") or 0))
    # words in capitals ("Comment GO or STAY") are read letter by letter: the narrator gets them in lower case
    spoken = L.get("say") or re.sub(r"\b[A-Z]{2,}\b", lambda m: m.group(0).lower(), L["text"])
    wav = model.generate(spoken, exaggeration=float(act.get("intensity", .5)), cfg_weight=float(act.get("pace", .45)),
                         **({"audio_prompt_path": prompt_for(L)} if prompt_for(L) else {}))
    x = wav.squeeze().cpu().numpy().astype(np.float32)
    with tempfile.TemporaryDirectory() as d:
        a, b = os.path.join(d, "a.wav"), os.path.join(d, "b.wav")
        sf.write(a, x, model.sr)
        speed = float(act.get("speed", .9)); gain = float(act.get("gain_db", 0))
        # another voice for the same narrator (pipeline/formati/): a radio, a phone, a whisper, a child, a machine
        vfx = {
            "radio": "highpass=f=450,lowpass=f=2800,acompressor=threshold=-20dB:ratio=6,volume=3dB",
            "phone": "highpass=f=320,lowpass=f=3300,volume=2dB",
            "whisper": "highpass=f=260,treble=g=6,volume=-5dB",
            "child": f"asetrate={model.sr}*1.28,aresample={model.sr},atempo=0.82",
            "robot": "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75,highpass=f=200,volume=4dB",
        }.get(L.get("vfx", ""), "")
        af = ",".join(x for x in (vfx, f"atempo={speed}", f"volume={gain}dB") if x)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-af", af, "-ar", str(SR), "-ac", "1", b], check=True)
        y, _ = sf.read(b, dtype="float32")
    nz = np.where(np.abs(y) > np.abs(y).max() * .02)[0]
    return y[max(0, nz[0] - int(.03 * SR)): nz[-1] + int(.12 * SR)] if len(nz) else y

def check(path):
    segs, _ = asr.transcribe(path, language="en", word_timestamps=True, beam_size=5)
    words = [[w.word.strip(), round(w.start, 3), round(w.end, 3)] for s in segs for w in (s.words or [])]
    return words, " ".join(w[0] for w in words)

from faster_whisper import WhisperModel
asr = WhisperModel("base.en", device="cpu", compute_type="int8")
dur = {}; words_all = {}; failed = []
for L in script["lines"]:
    path = os.path.join(vo, L["id"] + ".wav")
    want = norm_words(L.get("asr", L["text"]))
    for attempt in range(3):
        if L in todo:
            sf.write(path, synth(L, attempt), SR)
        words, heard = check(path)
        got = norm_words(heard)
        # a word also counts when Whisper splits or joins it ("Streetlamps" heard as "street lamps")
        joined = "".join(got).replace("'", "")
        missing = [w for w in want if w not in got and w.replace("'", "") not in joined]
        # whisper may drop one short word in a long line; a filtered voice (radio, child…) is harder to hear, so more slack
        ok = len(missing) <= max(0, len(want) // (3 if L.get("vfx") else 8))
        if ok or L not in todo:
            break
        print(f"  {L['id']} retry ({attempt + 1}): heard “{heard}”", flush=True)
    if not ok:
        failed.append(L["id"])
    hashes[L["id"]] = key(L)
    dur[L["id"]] = round(sf.info(path).duration, 3)
    words_all[L["id"]] = words
    print(f"{L['id']} {dur[L['id']]:5.2f}s {'OK  ' if ok else 'DIFF'} {heard}", flush=True)

json.dump(dur, open(os.path.join(vo, "dur.json"), "w"), indent=1)
json.dump(words_all, open(os.path.join(vo, "words.json"), "w"), indent=0)
json.dump(hashes, open(hash_file, "w"), indent=1)
if failed:
    print("lines that do not transcribe back:", ", ".join(failed)); sys.exit(1)
