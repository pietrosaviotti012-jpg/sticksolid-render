"""Listen to the sound library with earshot: <earshot python> -I tools/sounds_listen.py   (writes sounds/ASCOLTO.json and sounds/ASCOLTO.md)

We cannot hear: earshot can. For every family of sounds/CATALOGO.json it checks each file against what the family should
sound like (a calibrated z score: above +2 is a clear match, below 0 the file is probably something else), and whether the
recording is real or synthesized. The files to replace end up at the top of sounds/ASCOLTO.md.
Needs earshot installed (https://github.com/Leonxlnx/earshot, MIT), its models download once (~1.1 GB) and then work offline.
"""
import json, os, re
from earshot import api

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sounds")
CAT = json.load(open(os.path.join(ROOT, "CATALOGO.json"), encoding="utf8"))
WHAT = {   # what a family should sound like, in the words earshot understands
    "wind": "wind blowing at night", "rain": "rain falling", "thunder": "thunder rumbling in a storm", "waves": "sea waves on the shore",
    "steps": "footsteps walking", "floor-creak": "a creaking wooden floor", "door-creak": "a creaking door opening", "door-metal": "a heavy metal door or gate",
    "door-slide": "a sliding door", "knock": "knocking on a wooden door", "clock": "a clock ticking", "elevator": "an elevator moving",
    "typing": "typing on a keyboard", "phone-ring": "a telephone ringing", "phone-dial": "telephone dial tones", "phone-dead": "a telephone busy signal",
    "modem": "a dial-up modem", "static": "radio static noise", "radio": "a strange radio signal", "morse": "morse code beeps",
    "alarm": "a loud alarm", "alarm-home": "a smoke alarm beeping", "siren": "a siren wailing", "monitor": "an electronic beep",
    "breath": "heavy breathing", "whisper": "a person whispering", "raven": "a raven or crow cawing", "wolf": "a wolf howling", "dog": "a dog barking",
    "cat": "a cat meowing", "horses": "horses galloping", "whale": "whale song underwater", "creature": "a monster growling",
    "space": "eerie electronic space sounds", "mars-wind": "wind on another planet", "cosmic-hit": "a deep impact", "rumble": "a deep earth rumble",
    "crowd": "a crowd of people talking", "bell": "a bell ringing", "foghorn": "a foghorn", "glass": "glass breaking", "fire": "a fire crackling",
    "water": "water flowing", "train": "a train moving", "car": "a car", "boom": "an explosion", "page": "turning a book page",
    "chimes": "magical chimes", "forest": "a forest at night with birds and insects", "cave": "a dark cave with dripping water",
    "room": "a quiet room ambience", "dream": "a dreamy strange ambience",
}
out, rows = {}, []
for fam, spec in CAT.items():
    if fam.startswith("m-") or fam not in WHAT: continue
    for e in spec["files"]:
        path = os.path.join(ROOT, e["file"])
        m = api.match(path, WHAT[fam])
        r = api.realness(path)
        g = re.search(r"-> (\w+) \(z ([+-]?[\d.]+)", m.get("summary", ""))   # "'…' -> strong (z +4.4; …"
        verdict, z = (g[1], float(g[2])) if g else (m.get("verdict"), float(m.get("z") or 0))
        real = r.get("verdict")
        out[e["file"]] = {"family": fam, "want": WHAT[fam], "z": z, "verdict": verdict, "real": real, "p_real": r.get("p_real")}
        rows.append((z, e["file"], fam, verdict, real))
        print(e["file"], z, verdict, real, flush=True)
json.dump(out, open(os.path.join(ROOT, "ASCOLTO.json"), "w", encoding="utf8"), ensure_ascii=False, indent=1)
with open(os.path.join(ROOT, "ASCOLTO.md"), "w", encoding="utf8") as f:
    f.write("# Ascolto della libreria (earshot)\n\nPer ogni file: quanto somiglia a quello che la famiglia dovrebbe essere (z: sopra +2 corrisponde, sotto 0 probabilmente è altro) e se è una registrazione vera. In cima i file da sostituire. Rifallo con `tools/sounds_listen.py`.\n\n| z | File | Famiglia | Giudizio | Registrazione |\n|---|---|---|---|---|\n")
    for z, file, fam, verdict, real in sorted(rows):
        f.write(f"| {z:+.1f} | {file} | {fam} | {verdict} | {real} |\n")
print(len(rows), "files")
