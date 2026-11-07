# one short take per voice (name + the same line), its pitch, and one long file with all of them in a row
import json, os, sys, subprocess, numpy as np, soundfile as sf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import voce
OUT = sys.argv[1]
LINE = "What if the Moon disappeared tonight? You wouldn't notice a thing, at first. But by 6:00 am, the oceans would start to change."
V = json.load(open(sys.argv[2], encoding="utf-8"))
allp = []
for v in V:
    name, speed = v["id"], v.get("speed", 1.12)
    intro, sr = voce.say(v["name"] + ".", name, speed)
    body, sr = voce.say(LINE, name, speed)
    take = np.concatenate([intro, np.zeros(int(.35 * sr), np.float32), body])
    f0 = []
    for i in range(0, len(body) - 1024, 512):
        fr = body[i:i + 1024] * np.hanning(1024)
        if np.sqrt((fr ** 2).mean()) < 0.02: continue
        ac = np.correlate(fr, fr, "full")[1023:]; lo, hi = int(sr / 400), int(sr / 60)
        f0.append(sr / (lo + np.argmax(ac[lo:hi])))
    v["pitch"] = int(np.median(f0)); v["dur"] = round(len(body) / sr, 1)
    fn = os.path.join(OUT, name.replace("+", "_").replace(":", "_") + ".mp3")
    sf.write("tmp.wav", take, sr)
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "tmp.wav", "-af", voce.CREATOR, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", fn], check=True)
    json.dump([{"i": 0, "spoken": voce.normalizza(v["name"] + ". " + LINE)}], open(fn[:-4] + ".lines.json", "w"))
    allp += [take, np.zeros(int(1.0 * sr), np.float32)]
    print(f'{name:24s} {v["pitch"]:4d} Hz {v["dur"]:4.1f}s')
sf.write("tmp.wav", np.concatenate(allp), sr)
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "tmp.wav", "-af", voce.CREATOR, "-ar", "44100", "-c:a", "libmp3lame", "-b:a", "160k", os.path.join(OUT, "TUTTE-IN-FILA.mp3")], check=True)
os.remove("tmp.wav"); json.dump(V, open(os.path.join(OUT, "catalogo.json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
