"""The look of our videos against the viral ones: python tools/look.py   (needs numpy and pillow; look.yml runs it every evening)

Reads the contact sheets of research/analisi/<id> (the viral videos) and research/nostri/<id> (ours) with their cuts.json,
and writes research/confronto.json and research/confronto.md: rhythm, light and colour, measured the same way on both.
What numbers cannot see (characters, framing, captions) stays to the Analisi department, which opens the sheets.
"""
import colorsys, json, os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "research")

def changes(path):
    """How often the picture really changes: the sheet holds a frame every 1.5 s, so the same measure works on every video,
    also on dissolves and dark scenes, which the scene detector of cuts.json does not see."""
    im = np.asarray(Image.open(path).convert("L"), dtype=np.float32) / 255
    fw = 180; cols = max(1, im.shape[1] // fw)
    fh = next((h for h in (320, 319, 321, 318, 180, 225, 240, 270, 360) if im.shape[0] % h == 0), im.shape[0])
    frames = [im[r * fh:(r + 1) * fh, c * fw:(c + 1) * fw] for r in range(im.shape[0] // fh) for c in range(cols)]
    frames = [f[::4, ::4] for f in frames if f.max() > .08 or f.std() > .01]   # the empty tiles at the end of the sheet
    if len(frames) < 3: return None
    d = np.array([np.abs(a - b).mean() for a, b in zip(frames, frames[1:])])
    return {"cambi_10s": round(float((d > .035).sum()) / (len(frames) * 1.5) * 10, 1), "movimento": round(float(np.median(d)) * 100, 1)}

def measure(folder):
    sheet = os.path.join(folder, "sheet.jpg")
    if not os.path.exists(sheet): return None
    im = np.asarray(Image.open(sheet).convert("RGB").resize((360, 640)), dtype=np.float32) / 255
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    y = .299 * r + .587 * g + .114 * b
    hi, lo = im.max(2), im.min(2)
    sat = np.where(hi > .05, (hi - lo) / np.maximum(hi, 1e-3), 0)
    hues = np.histogram([colorsys.rgb_to_hsv(*p)[0] for p in im[::16, ::16][sat[::16, ::16] > .25]], bins=12, range=(0, 1))[0]
    out = {"luce": round(float(y.mean()) * 100), "contrasto": round(float(y.std()) * 100), "saturazione": round(float(sat.mean()) * 100),
           "buio": round(float((y < .12).mean()) * 100), "colori": int((hues > .08 * max(1, hues.sum())).sum())}
    out.update(changes(sheet) or {})
    return out

def group(name):
    base = os.path.join(ROOT, name)
    if not os.path.isdir(base): return {}
    return {d: m for d in sorted(os.listdir(base)) if (m := measure(os.path.join(base, d)))}

viral, ours = group("analisi"), group("nostri")
KEYS = ["cambi_10s", "movimento", "luce", "contrasto", "saturazione", "buio", "colori"]
NAMES = {"cambi_10s": "Cambi d'immagine ogni 10 secondi", "movimento": "Quanto cambia l'immagine ogni 1,5 secondi", "luce": "Luce media (0-100)",
         "contrasto": "Contrasto", "saturazione": "Saturazione", "buio": "Parte quasi nera dell'immagine (%)", "colori": "Colori forti diversi"}
def median(group_, k):
    v = [m[k] for m in group_.values() if m.get(k) is not None]
    return round(float(np.median(v)), 1) if v else None
table = [{"misura": NAMES[k], "virali": median(viral, k), "nostri": median(ours, k)} for k in KEYS]
json.dump({"virali": viral, "nostri": ours, "tabella": table}, open(os.path.join(ROOT, "confronto.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
with open(os.path.join(ROOT, "confronto.md"), "w", encoding="utf8") as f:
    f.write(f"# I nostri video e quelli virali\n\nMediane su {len(viral)} video virali e {len(ours)} nostri. Le rifà `tools/look.py` ogni sera.\n\n| Misura | Virali | Nostri |\n|---|---|---|\n")
    for row in table: f.write(f"| {row['misura']} | {row['virali'] if row['virali'] is not None else '–'} | {row['nostri'] if row['nostri'] is not None else '–'} |\n")
print(len(viral), "virali,", len(ours), "nostri")
