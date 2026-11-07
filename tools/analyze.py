"""Study a short video the way the user does: python tools/analyze.py <link or .mp4> [out folder]

Downloads it (yt-dlp: Instagram, TikTok, YouTube) or takes a local file, then writes into
research/analisi/<slug>/ (or the given folder):
  info.json      who posted it, caption, duration, numbers (views, likes, comments) when the platform gives them
  transcript.md  what is said, with times; the first 3 seconds are the hook
  hook.jpg       frames at 0, 0.5, 1, 1.5, 2 and 3 s: what the eye gets before deciding to stay
  sheet.jpg      one frame every 1.5 s: the whole video at a glance
  cuts.json      when the picture changes (scene cuts) and how fast: cuts per 10 seconds
  voice.json     where the voice changes (louder, quieter, brighter, darker: a filter, a whisper, another voice)
  analysis.md    the measurable summary; the Research department adds below it what it sees and what to copy
The video file itself stays out of git (video.mp4 is ignored).
Needs ffmpeg; Python with yt-dlp, faster-whisper, numpy, soundfile.
"""
import json, os, re, subprocess, sys

import numpy as np
import soundfile as sf

src = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def slug_of(s):
    m = re.search(r"instagram\.com/(?:reel|p)/([\w-]+)|tiktok\.com/.*/video/(\d+)|(?:youtu\.be/|v=|shorts/)([\w-]{6,})", s)
    if m:
        return next(g for g in m.groups() if g)
    return re.sub(r"[^\w-]+", "-", os.path.splitext(os.path.basename(s))[0]).strip("-")[:60] or "video"


out = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, "research", "analisi", slug_of(src))
os.makedirs(out, exist_ok=True)
video = os.path.join(out, "video.mp4")
run = lambda *a: subprocess.run(a, check=True, capture_output=True, text=True)

# 1. the video and what the platform says about it
info = {"source": src}
if os.path.exists(src):
    if os.path.abspath(src) != os.path.abspath(video):
        run("ffmpeg", "-v", "error", "-y", "-i", src, "-c", "copy", video)
else:
    from yt_dlp import YoutubeDL
    with YoutubeDL({"outtmpl": video, "format": "mp4/best", "quiet": True, "no_warnings": True, "noprogress": True, "overwrites": True}) as y:
        d = y.extract_info(src, download=True)
    for k in ("uploader", "channel", "title", "description", "duration", "view_count", "like_count", "comment_count", "upload_date", "webpage_url"):
        if d.get(k) is not None:
            info[k] = d[k]
probe = json.loads(run("ffprobe", "-v", "error", "-show_entries", "format=duration:stream=width,height,r_frame_rate", "-of", "json", video).stdout)
dur = float(probe["format"]["duration"]); info["duration"] = round(dur, 1)
vs = next((s for s in probe["streams"] if s.get("width")), {})
info["size"] = f'{vs.get("width")}x{vs.get("height")}'
json.dump(info, open(os.path.join(out, "info.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# 2. pictures: the hook frames and the contact sheet
hook_t = [t for t in (0, .5, 1, 1.5, 2, 3) if t < dur]
sel = "+".join(f"lt(prev_t\\,{t})*gte(t\\,{t})" for t in hook_t)
run("ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"select='{sel}',scale=240:-1,tile={len(hook_t)}x1", "-frames:v", "1", os.path.join(out, "hook.jpg"))
n = max(1, int(dur / 1.5)); cols = 8; rows = (n + cols - 1) // cols
run("ffmpeg", "-v", "error", "-y", "-i", video, "-vf", f"fps=1/1.5,scale=180:-1,tile={cols}x{rows}", "-frames:v", "1", os.path.join(out, "sheet.jpg"))

# 3. scene cuts
sc = subprocess.run(["ffmpeg", "-hide_banner", "-i", video, "-vf", "select='gt(scene,0.28)',showinfo", "-f", "null", "-"], capture_output=True, text=True).stderr
cuts = [round(float(x), 2) for x in re.findall(r"pts_time:([\d.]+)", sc)]
gaps = np.diff([0] + cuts + [dur]) if cuts else np.array([dur])
cut_info = {"cuts": cuts, "per_10s": round(10 * len(cuts) / dur, 1), "longest_shot": round(float(gaps.max()), 1), "median_shot": round(float(np.median(gaps)), 1)}
json.dump(cut_info, open(os.path.join(out, "cuts.json"), "w"), indent=1)

# 4. words, with times
wav = os.path.join(out, "audio.wav")
run("ffmpeg", "-v", "error", "-y", "-i", video, "-ac", "1", "-ar", "16000", wav)
from faster_whisper import WhisperModel
segs, lang = WhisperModel("small", device="cpu", compute_type="int8").transcribe(wav, vad_filter=True)
segs = [(s.start, s.end, s.text.strip()) for s in segs]
words = sum(len(t.split()) for _, _, t in segs)

# 5. the voice: loudness and brightness of each spoken segment; the ones far from the rest are a different voice
y, sr = sf.read(wav, dtype="float32")
feat = []
for a, b, t in segs:
    x = y[int(a * sr): int(b * sr)]
    if len(x) < sr // 5:
        feat.append(None); continue
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), 1 / sr)
    feat.append((20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9), float((spec * freqs).sum() / (spec.sum() + 1e-9))))
ok = [f for f in feat if f]
voice = []
if ok:
    db, br = np.array([f[0] for f in ok]), np.array([f[1] for f in ok])
    for (a, b, t), f in zip(segs, feat):
        if not f:
            continue
        tags = []
        if f[0] > db.mean() + 1.3 * db.std() + .5: tags.append("louder")
        if f[0] < db.mean() - 1.3 * db.std() - .5: tags.append("quieter (whisper?)")
        if f[1] > br.mean() + 1.3 * br.std(): tags.append("brighter (phone, radio, another voice?)")
        if f[1] < br.mean() - 1.3 * br.std(): tags.append("darker (deep, muffled, another voice?)")
        if tags:
            voice.append({"t": round(a, 1), "text": t, "change": tags})
json.dump(voice, open(os.path.join(out, "voice.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

with open(os.path.join(out, "transcript.md"), "w", encoding="utf-8") as f:
    f.write(f"# Transcript ({lang.language})\n\n")
    for a, b, t in segs:
        f.write(f"- `{a:5.1f}` {'**[HOOK]** ' if a < 3 else ''}{t}\n")

# 6. the measurable summary
hook = " ".join(t for a, _, t in segs if a < 3.5)
with open(os.path.join(out, "analysis.md"), "w", encoding="utf-8") as f:
    f.write(f"# Analisi: {info.get('uploader') or info.get('channel') or ''} · {slug_of(src)}\n\n")
    f.write(f"Fonte: {info.get('webpage_url', src)}\n\n")
    f.write("## Numeri\n")
    f.write(f"- Durata: {info['duration']} s, formato {info['size']}\n")
    for k, lbl in (("view_count", "Visualizzazioni"), ("like_count", "Mi piace"), ("comment_count", "Commenti")):
        if k in info: f.write(f"- {lbl}: {info[k]:,}\n".replace(",", "."))
    f.write(f"- Parole al minuto: {round(60 * words / dur)}\n")
    f.write(f"- Tagli: {len(cuts)} ({cut_info['per_10s']} ogni 10 s), inquadratura media {cut_info['median_shot']} s, la più lunga {cut_info['longest_shot']} s\n")
    f.write(f"- Cambi di voce: {len(voice)}" + (": " + "; ".join(f"{v['t']} s {', '.join(v['change'])}" for v in voice[:6]) if voice else "") + "\n\n")
    f.write(f"## Il gancio (primi 3 secondi)\n> {hook}\n\nFotogrammi: `hook.jpg`. Tutto il video: `sheet.jpg`. Testo completo: `transcript.md`.\n\n")
    if info.get("description"):
        f.write(f"## Didascalia\n{info['description'][:600]}\n\n")
    f.write("## Cosa vede la Ricerca (da scrivere guardando hook.jpg e sheet.jpg)\n- Gancio:\n- Grafica e personaggi:\n- Voce e suono:\n- Ritmo e scene:\n- Cosa copiare (e in quale formato):\n")
os.remove(wav)
print(out)
