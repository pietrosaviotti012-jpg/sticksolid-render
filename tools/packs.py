"""The sound packs (sounds/PACCHETTI.json), shared by score.py and mix.py: which family of sounds a format uses, and which file of the family plays.
The choice depends on the production's name: two videos of the same format start from different files, and a sound that comes back in a video changes file."""
import hashlib, json, os

SOUNDS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "sounds")
CAT = json.load(open(os.path.join(SOUNDS, "CATALOGO.json"), encoding="utf8")) if os.path.exists(os.path.join(SOUNDS, "CATALOGO.json")) else {}
PACKS = json.load(open(os.path.join(SOUNDS, "PACCHETTI.json"), encoding="utf8")) if os.path.exists(os.path.join(SOUNDS, "PACCHETTI.json")) else {"formats": {}, "alias": {}}

def pack_of(prod):
    meta = os.path.join(prod, "meta.json")
    fmt = json.load(open(meta, encoding="utf8")).get("format", "") if os.path.exists(meta) else ""
    fmt = PACKS["alias"].get(fmt, fmt)
    return fmt, PACKS["formats"].get(fmt) or PACKS["formats"].get("fable", {})

def number(*parts):
    return int(hashlib.md5("|".join(map(str, parts)).encode()).hexdigest(), 16)

# what earshot heard (tools/sounds_listen.py): a file that does not sound like its family (z below 0) is left out, if the family has others
HEARD = json.load(open(os.path.join(SOUNDS, "ASCOLTO.json"), encoding="utf8")) if os.path.exists(os.path.join(SOUNDS, "ASCOLTO.json")) else {}

def choose(prod, family, n=0):
    """The file of a family for this production, the n-th time it plays."""
    files = [e for e in CAT[family]["files"] if HEARD.get(e["file"], {}).get("z", 1) >= 0] or CAT[family]["files"]
    pid = os.path.basename(os.path.normpath(prod))
    return files[(number(pid, family) + n) % len(files)]
