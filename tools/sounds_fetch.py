"""Build the sound library: python tools/sounds_fetch.py   (needs ffmpeg; run it by hand, the renders only read sounds/)

Downloads every sound listed in tools/sounds_list.json into sounds/<family>/<n>.ogg, then writes sounds/CATALOGO.json and sounds/LICENZE.md.
Only sources that allow it: Wikimedia Commons (its API, licence read file by file: CC0 or public domain, or the file is refused),
Internet Archive (items published as CC0 by their own author) and the FreePD archive (CC0 music).
BigSoundBank, OpenGameArt and Kenney are CC0 too, but they ask robots not to download: only a person can take sounds from them.
"""
import json, os, re, subprocess, sys, tempfile, time, urllib.error, urllib.parse, urllib.request
import numpy as np
import soundfile as sf

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
OUT = os.path.join(ROOT, "sounds")
LIST = json.load(open(os.path.join(ROOT, "tools", "sounds_list.json"), encoding="utf8"))
UA = "StickSolidRender/1.0 (https://github.com/pietrosaviotti012-jpg/sticksolid-render)"
PAUSE = 10   # seconds between downloads: Wikimedia answers 429 to anything faster
ARCHIVE = {"various": "various-sound-effects", "general": "auldhame-general-sounds", "amb": "auldhame-ambiances", "book": "book-sound-effects"}
MAX = {"oneshot": 12, "bed": 45, "music": 110}   # seconds kept

def fetch(url, path):
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=90) as r, open(path, "wb") as f: f.write(r.read())
            return
        except urllib.error.HTTPError as e:
            if e.code != 429 or attempt == 3: raise
            time.sleep(int(e.headers.get("Retry-After") or 0) or 120)   # told to slow down: wait as long as they ask

def commons(title):
    p = {"action": "query", "format": "json", "titles": "File:" + title, "prop": "imageinfo", "iiprop": "url|extmetadata", "iiextmetadatafilter": "LicenseShortName|Artist"}
    r = urllib.request.Request("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p), headers={"User-Agent": UA})
    pg = next(iter(json.load(urllib.request.urlopen(r, timeout=40))["query"]["pages"].values()))
    ii = pg["imageinfo"][0]; m = ii["extmetadata"]
    lic = m.get("LicenseShortName", {}).get("value", "")
    if not re.search(r"(?i)cc0|public domain", lic): raise ValueError("licence " + lic)
    return ii["url"], ii.get("descriptionurl"), lic, re.sub(r"<[^>]+>", "", m.get("Artist", {}).get("value", ""))[:80].strip()

def source(s):
    """'c:<Commons title>', 'a:<archive key>/<file>' or 'm:<freepd folder>/<file>' → (download url, page, licence, author)"""
    k, v = s.split(":", 1)
    if k == "c": return commons(v)
    if k == "a":
        item, f = v.split("/", 1)
        return f"https://archive.org/download/{ARCHIVE[item]}/{urllib.parse.quote(f)}", f"https://archive.org/details/{ARCHIVE[item]}", "CC0 1.0", "Patrick Lauser"
    if k == "m":
        return "https://a.ocv.me/pub/stuff/music/freepd/" + urllib.parse.quote(v), "https://freepd.com/", "CC0 1.0", "Kevin MacLeod / FreePD"
    raise ValueError(s)

def convert(src, dst, kind, start, dur):
    stereo = kind != "oneshot"
    af = [] if start or kind != "oneshot" else ["silenceremove=start_periods=1:start_threshold=-45dB"]
    args = ["ffmpeg", "-y", "-v", "error", "-ss", str(start), "-t", str(dur or MAX[kind]), "-i", src, "-vn", "-ar", "48000", "-ac", "2" if stereo else "1"]
    if af: args += ["-af", ",".join(af)]
    wav = dst + ".wav"
    subprocess.run(args + [wav], check=True)
    x, sr = sf.read(wav, dtype="float32", always_2d=True)
    os.remove(wav)
    active = x[np.abs(x).max(1) > .01] if (np.abs(x).max(1) > .01).any() else x
    x /= max(1e-6, np.abs(x).max()) / .89
    n = min(int(.02 * sr), len(x) // 4)
    x[-n:] *= np.linspace(1, 0, n)[:, None]
    tmp = dst + ".tmp.wav"
    sf.write(tmp, x, sr)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "3" if kind == "music" else "4", dst], check=True)
    os.remove(tmp)
    active = x[np.abs(x).max(1) > .02] if (np.abs(x).max(1) > .02).any() else x
    return len(x) / sr, float(20 * np.log10(np.sqrt(np.mean(active ** 2)) + 1e-9))

cat, errors, tmp = {}, [], tempfile.mkdtemp()
for fam, spec in LIST.items():
    kind = spec["kind"]; os.makedirs(os.path.join(OUT, fam), exist_ok=True)
    for i, item in enumerate(spec["items"], 1):
        if isinstance(item, dict) and item.get("skip"): continue   # refused after listening: the numbering of the others stays
        s, start, dur = (item, 0, 0) if isinstance(item, str) else (item["s"], item.get("start", 0), item.get("dur", 0))
        name = f"{fam}/{i}.ogg"; dst = os.path.join(OUT, name)
        try:
            url, page, lic, author = source(s)
            if os.path.exists(dst):   # already here from an earlier run: only the licence is read again
                x, sr = sf.read(dst, dtype="float32", always_2d=True)
                d = len(x) / sr; a = x[np.abs(x).max(1) > .02]; rms = float(20 * np.log10(np.sqrt(np.mean((a if len(a) else x) ** 2)) + 1e-9))
            else:
                src = os.path.join(tmp, "src" + os.path.splitext(url)[1])
                fetch(url, src)
                d, rms = convert(src, dst, kind, start, dur)
                time.sleep(PAUSE)
            cat.setdefault(fam, {"kind": kind, "files": []})["files"].append({"file": name, "dur": round(d, 2), "rms": round(rms, 1), "source": s[2:], "url": page, "license": lic, "author": author})
            print("ok", name, s[2:60], round(d, 1), flush=True)
        except Exception as e:
            errors.append(f"{fam}: {s}: {e}"); print("NO", fam, s, e, flush=True)
json.dump(cat, open(os.path.join(OUT, "CATALOGO.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
with open(os.path.join(OUT, "LICENZE.md"), "w", encoding="utf8") as f:
    f.write("# Licenze dei suoni\n\nTutti in CC0 o pubblico dominio: niente attribuzione obbligatoria. Rifai l'elenco con `python tools/sounds_fetch.py`.\n\n| File | Origine | Licenza | Autore |\n|---|---|---|---|\n")
    for fam in cat.values():
        for e in fam["files"]: f.write(f"| {e['file']} | [{e['source']}]({e['url']}) | {e['license']} | {e['author'].replace('|', ' ')} |\n")
print(sum(len(v["files"]) for v in cat.values()), "sounds,", len(errors), "refused")
for e in errors: print(" -", e)
