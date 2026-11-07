"""StickSolid · bring a stick-figure project into the chain (once per project).

    python adatta_stick.py <project folder> [--stick NAME]

The project is a reel folder of the stick-figure skill (script.json, web/, audio/words_ref.json). What it changes:
- web/ becomes src/ (like Solid's projects); the skill's lib.js and chars.js, words.js and warp.js, audio.py and the
  old audio files go to originale/ (kept, not deleted): the shots now use the kit's lib.js and chars.js (/kit/lib/),
  which draw the same things plus StickSolid's thick limbs, hair, glasses and hats.
- index.html loads /kit/lib/catena-stick.js before main.js: catena.json (captions in the StickSolid style, duration,
  the time warp onto the new voice) and thick limbs for everyone.
- main.js draws the StickSolid captions instead of the skill's.
- the walk: walkLegs / walkArms in the scenes become the channel's walk and run (kit/lib/moves-stick.js).
- audio/words_ref.json (the voice the shots were timed on) is copied to audio/rif.words.json for the warp.
- --stick NAME: the character NAME (a const in the scene files, e.g. FARMER) becomes Stick: red, no hat, no belt.
Every change is checked: if a piece of text is not found the script stops and says which.
"""
import os, re, shutil, sys

STICK = "{ cols: ['#e0392f', '#e0392f'], hat: 'none', belt: false }"


def sub(s, old, new, what):
    if old not in s: sys.exit(f"non trovato in {what}: {old[:70]}")
    return s.replace(old, new)


def keep(proj, rel):
    """move a file of the skill out of the way, into originale/ (never deleted)"""
    src = os.path.join(proj, rel)
    if not os.path.exists(src): return
    dst = os.path.join(proj, "originale", rel); os.makedirs(os.path.dirname(dst), exist_ok=True); shutil.move(src, dst)


def camminata(src):
    """the skill's walk (walkLegs / walkArms in the scene files) becomes the channel's walk and run, the ones chosen
    in the moves videos (kit/lib/moves-stick.js, identita/movimenti): legs lifting in turn, arms swinging against them"""
    for f in sorted(os.listdir(src)):
        if not f.endswith(".js"): continue
        p = os.path.join(src, f); s = open(p, encoding="utf-8").read(); n = s
        n = re.sub(r"const walkLegs = [^\n]*;", "const walkLegs = (t, sp = 9) => stickStride(t, sp).legs;   // StickSolid: kit/lib/moves-stick.js", n)
        n = re.sub(r"const walkArms = [^\n]*;", "const walkArms = (t, sp = 9) => stickStride(t, sp).arms;   // StickSolid: kit/lib/moves-stick.js", n)
        if n != s: open(p, "w", encoding="utf-8").write(n); print("  camminata del canale in", f)


def main(proj, stick):
    if os.path.isdir(os.path.join(proj, "web")): os.rename(os.path.join(proj, "web"), os.path.join(proj, "src"))
    src = os.path.join(proj, "src")
    for f in ("lib.js", "chars.js", "words.js", "warp.js"): keep(proj, os.path.join("src", f))
    for f in ("audio.py", "captions.json", os.path.join("audio", "lines.json"), os.path.join("audio", "warp.json"),
              os.path.join("audio", "words_new.json"), os.path.join("audio", "vo.wav"), os.path.join("audio", "mix.wav")): keep(proj, f)
    ref = os.path.join(proj, "audio", "words_ref.json")
    if os.path.exists(ref): shutil.copy(ref, os.path.join(proj, "audio", "rif.words.json"))

    # ---- index.html: the kit's library and characters, the chain before main.js
    p = os.path.join(src, "index.html"); s = open(p, encoding="utf-8").read()
    s = sub(s, '<script src="lib.js"></script><script src="chars.js"></script>',
            '<script src="/kit/lib/lib.js"></script><script src="/kit/lib/chars.js"></script><script src="/kit/lib/moves-stick.js"></script>', "index.html (kit)")
    s = sub(s, '<script src="words.js"></script><script src="warp.js"></script>', '', "index.html (words, warp)")
    s = sub(s, '<script src="main.js"></script>', '<script src="/kit/lib/catena-stick.js"></script><script src="main.js"></script>', "index.html (catena)")
    open(p, "w", encoding="utf-8").write(s)

    # ---- main.js: the StickSolid captions
    p = os.path.join(src, "main.js"); s = open(p, encoding="utf-8").read()
    s = sub(s, "  drawCaption(out, tNew);", "  (window.drawCaptionSS || drawCaption)(out, tNew);   // StickSolid: kit/lib/catena-stick.js", "main.js (captions)")
    open(p, "w", encoding="utf-8").write(s)

    camminata(src)

    # ---- the story's main character becomes Stick
    if stick:
        done = False
        for f in sorted(os.listdir(src)):
            if not f.endswith(".js"): continue
            p = os.path.join(src, f); s = open(p, encoding="utf-8").read()
            m = re.search(rf"const {stick} = \{{[^}}]*\}};", s)
            if m:
                s = s.replace(m.group(0), f"const {stick} = {STICK};   // StickSolid: Stick (red, no hat, no belt)")
                open(p, "w", encoding="utf-8").write(s); done = True
        if not done: sys.exit(f"const {stick} non trovato nelle scene")
    print("progetto adattato:", proj)


if __name__ == "__main__":
    args = sys.argv[1:]; stick = None
    if "--stick" in args: i = args.index("--stick"); stick = args[i + 1]; del args[i:i + 2]
    main(args[0], stick)
