"""Sharper word times: python tools/align.py <production folder>   (runs in its own environment with whisperx, see render.yml)

Whisper hears the words of each line; WhisperX then places them on the sound, and the ends of lines land about three times closer.
Only the times change: the words stay those of vo/words.json, one for one, so captions and E.word() keep their numbering.
A word WhisperX cannot place (a number, for example) keeps its old times. If anything goes wrong vo/words.json stays as it was.
"""
import json, os, sys
import whisperx

prod = sys.argv[1]
path = os.path.join(prod, "vo", "words.json")
words = json.load(open(path))
model, meta = whisperx.load_align_model(language_code="en", device="cpu")
sharper = {}; moved = 0
for line, old in words.items():
    sharper[line] = old
    if not old: continue
    wav = os.path.join(prod, "vo", line + ".wav")
    audio = whisperx.load_audio(wav)
    r = whisperx.align([{"text": " ".join(w[0] for w in old), "start": 0.0, "end": len(audio) / 16000}], model, meta, audio, "cpu", return_char_alignments=False)
    new = r["word_segments"]
    if len(new) != len(old):
        print(f"{line}: {len(new)} words against {len(old)}, times kept", flush=True); continue
    out, last = [], 0.0
    for w, n in zip(old, new):
        start, end = (n["start"], n["end"]) if "start" in n and "end" in n else (w[1], w[2])
        start = max(start, last); end = max(end, start + .01); last = end
        out.append([w[0], round(start, 3), round(end, 3)])
    moved += abs(out[-1][2] - old[-1][2])
    sharper[line] = out
json.dump(sharper, open(path, "w"), indent=0)
print(f"align: {len(words)} lines, ends moved {moved / max(1, len(words)) * 1000:.0f} ms on average")
