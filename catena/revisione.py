"""StickSolid · the review pack: what the Revisione routine looks at before a video reaches Approva.

    python revisione.py <production folder>

Writes <production>/revisione/:
  fogli-1.jpg, fogli-2.jpg, ...  sheets of 8 frames (4 x 2), one every 1.5 s of the finished video, each with its time
                                 and the words the voice says at that moment, so the routine can judge whether every
                                 picture makes sense for its line and whether the story goes forward in the right order
  scheda.json                    the frames (time, sheet, cell, words), the lines with their times, the automatic
                                 check (controllo.json) in short, and where the video comes from

No Claude here: frames and sheets are made with ffmpeg and Pillow. The judging is the routine's (routines/REVISIONE.md).
"""
import json, os, subprocess, sys, tempfile

from PIL import Image, ImageDraw, ImageFont

STEP, COLS, ROWS, W, H, CAP = 1.5, 4, 2, 360, 640, 92


def font(size):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/arial.ttf"):
        if os.path.exists(f): return ImageFont.truetype(f, size)
    return ImageFont.load_default()


def duration(f):
    return float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).strip())


def wrap(draw, text, fnt, width):
    lines, cur = [], ""
    for w in text.split():
        t = (cur + " " + w).strip()
        if draw.textlength(t, font=fnt) <= width: cur = t
        else: lines.append(cur); cur = w
    if cur: lines.append(cur)
    return lines


def main(prod):
    prod = os.path.abspath(prod)
    meta = json.load(open(os.path.join(prod, "meta.json"), encoding="utf-8"))
    vid, out = meta["id"], os.path.join(prod, "out")
    film = os.path.join(out, f"{vid}.mp4")
    dur = duration(film)
    words = json.load(open(os.path.join(out, "voce.words.json"), encoding="utf-8")) if os.path.exists(os.path.join(out, "voce.words.json")) else []
    lines = json.load(open(os.path.join(out, "voce.lines.json"), encoding="utf-8")) if os.path.exists(os.path.join(out, "voce.lines.json")) else []
    dst = os.path.join(prod, "revisione"); os.makedirs(dst, exist_ok=True)
    for f in os.listdir(dst):                                                  # a new render replaces the old sheets
        if f.startswith("fogli-") or f == "scheda.json": os.remove(os.path.join(dst, f))
    times = [round(0.5 + i * STEP, 2) for i in range(int((dur - 0.6) / STEP) + 1)]
    frames, per = [], COLS * ROWS
    f_small, f_time = font(22), font(26)
    with tempfile.TemporaryDirectory() as tmp:
        for k in range(0, len(times), per):
            sheet = Image.new("RGB", (COLS * W, ROWS * (H + CAP)), "white"); d = ImageDraw.Draw(sheet)
            n = k // per + 1
            for j, t in enumerate(times[k:k + per]):
                png = os.path.join(tmp, f"{t}.png")
                subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{t}", "-i", film, "-frames:v", "1", "-vf", f"scale={W}:{H}", png],
                               check=True, timeout=60)
                x, y = (j % COLS) * W, (j // COLS) * (H + CAP)
                sheet.paste(Image.open(png).convert("RGB"), (x, y))
                said = " ".join(w["w"] for w in words if w["e"] > t - STEP / 2 and w["s"] < t + STEP / 2)
                d.rectangle([x, y + H, x + W - 1, y + H + CAP - 1], fill="#fff6dc", outline="#221c22")
                d.text((x + 8, y + H + 6), f"{t:.1f} s", font=f_time, fill="#e0392f")
                for i, ln in enumerate(wrap(d, f"«{said}»" if said else "(nessuna parola: chiusura o pausa)", f_small, W - 16)[:2]):
                    d.text((x + 8, y + H + 36 + i * 26), ln, font=f_small, fill="#221c22")
                frames.append({"t": t, "foglio": f"fogli-{n}.jpg", "cella": j + 1, "parole": said})
            sheet.save(os.path.join(dst, f"fogli-{n}.jpg"), quality=78)
    ctrl = {}
    cj = os.path.join(out, "controllo.json")
    if os.path.exists(cj):
        c = json.load(open(cj, encoding="utf-8"))
        ctrl = {k: c[k] for k in ("passa", "voce", "video", "audio", "suoni", "ritmo", "fatti", "problemi") if k in c}
        if isinstance(ctrl.get("voce"), dict): ctrl["voce"].pop("heard", None)
    scheda = {"id": vid, "titolo": meta.get("title", vid), "formato": meta.get("formato"), "who": meta.get("who"),
              "durata": round(dur, 2), "passo_fotogrammi_s": STEP, "fotogrammi": frames,
              "battute": [{"n": i + 1, "testo": (l.get("text") if isinstance(l, dict) else str(l)),
                           "da": l.get("start") if isinstance(l, dict) else None,
                           "a": round(l["start"] + l["dur"], 2) if isinstance(l, dict) and "start" in l and "dur" in l else None} for i, l in enumerate(lines)],
              "controllo_automatico": ctrl, "render": os.environ.get("RUN_URL", "")}
    json.dump(scheda, open(os.path.join(dst, "scheda.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"revisione: {len(frames)} fotogrammi in {(len(frames) + per - 1) // per} fogli -> {dst}")


if __name__ == "__main__":
    main(sys.argv[1])
