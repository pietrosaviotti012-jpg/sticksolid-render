"""StickSolid · word times guessed from the script, without making the voice.

    python tempi_stimati.py <project folder> [words per second]

Writes <project>/audio/rif.words.json: [{"w", "s", "e", "line"}, ...]. The Copione e Scene routine times the shots on
these guesses (no Kokoro, no Parakeet, nothing heavy in the routine); then the chain on GitHub makes the real voice,
matches its words with these ones and warps the shots onto it (the "tempi" step), so the guesses only need to be in
the right order and roughly the right length. Numbers count as the words the voice will say (normalizza.py).
"""
import json, os, re, sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "voce"))
from normalizza import normalizza                                                   # noqa: E402


def syll(w):
    w = re.sub(r"[^a-z]", "", w.lower())
    if not w: return 1
    n = len(re.findall(r"[aeiouy]+", w)) - (1 if w.endswith("e") and not w.endswith(("le", "ee")) and len(w) > 3 else 0)
    return max(1, n)


def stima(lines, wps=2.9):
    out, t, raw = [], 0.0, []
    for li, line in enumerate(lines):
        text = line if isinstance(line, str) else line["text"]
        for w in text.split():
            spoken = normalizza(w).split() or [w]
            d = sum(0.10 + 0.075 * syll(x) for x in spoken)
            pause = 0.42 if re.search(r"[.?!]$", w) else 0.2 if re.search(r"[,;:]$", w) else 0.0
            raw.append([w, d, pause, li])
    # scale so the whole take runs at about `wps` words per second
    total = sum(d + p for _, d, p, _ in raw); k = (len(raw) / wps) / total if total else 1
    for w, d, p, li in raw:
        out.append({"w": w, "s": round(t, 3), "e": round(t + d * k, 3), "line": li}); t += (d + p) * k
    return out


if __name__ == "__main__":
    proj = sys.argv[1]; wps = float(sys.argv[2]) if len(sys.argv) > 2 else 2.9
    lines = json.load(open(os.path.join(proj, "script.json"), encoding="utf-8"))
    W = stima(lines, wps); os.makedirs(os.path.join(proj, "audio"), exist_ok=True)
    json.dump(W, open(os.path.join(proj, "audio", "rif.words.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    print(f"{len(W)} parole, {W[-1]['e']:.1f} s stimati")
    for li in range(len(lines)):
        ws = [x for x in W if x["line"] == li]
        print(f"  {ws[0]['s']:5.2f}-{ws[-1]['e']:5.2f}  " + " ".join(x["w"] for x in ws)[:70])
