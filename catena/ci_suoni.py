"""StickSolid · the Real SFX skill on a machine that is not the PC (GitHub Actions).

    python ci_suoni.py <real-sfx folder> <render repo folder>      write config.json and library_index.json there
    python ci_suoni.py --portabile <real-sfx folder> <out.json>     (on the PC) make the portable index from the PC's one

Real SFX finds its sounds through absolute paths in config.json and library_index.json, and the index also holds what
the skill learned by listening (roles, tags), which a fresh build_index.py would lose. So the PC's index is kept with
the two library folders replaced by placeholders ({LANTERNFOX}, {EARSHOT}); on the runner they become the sounds of
the public repo: render/sounds (the CC0 library of the old channel) and render/sounds/earshot.
"""
import json, os, sys

PC = {"{LANTERNFOX}": "C:/Users/pietr/Claude Code/Lantern Fox (old)/sounds",
      "{EARSHOT}": "C:/Users/pietr/Claude Code/StickSolid/render/sounds/earshot"}


def slash(p): return p.replace("\\", "/")


def portabile(rs, out):
    d = json.load(open(os.path.join(rs, "library_index.json"), encoding="utf-8"))
    for x in d["sounds"] + d["libraries"]:
        p = slash(x["path"])
        for k, v in sorted(PC.items(), key=lambda kv: -len(kv[1])):
            if p.startswith(v): x["path"] = k + p[len(v):]; break
        else: sys.exit(f"percorso sconosciuto: {p}")
    json.dump(d, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    print("indice portabile:", out, len(d["sounds"]), "suoni")


def installa(rs, render):
    render = slash(os.path.abspath(render))
    real = {"{LANTERNFOX}": render + "/sounds", "{EARSHOT}": render + "/sounds/earshot"}
    src = os.path.join(rs, "library_index.portable.json")
    d = json.load(open(src, encoding="utf-8"))
    for x in d["sounds"] + d["libraries"]:
        for k, v in real.items():
            if x["path"].startswith(k): x["path"] = v + x["path"][len(k):]
    miss = [x["path"] for x in d["sounds"] if not os.path.exists(x["path"])]
    if miss: sys.exit(f"{len(miss)} suoni mancanti, per esempio {miss[:3]}")
    json.dump(d, open(os.path.join(rs, "library_index.json"), "w", encoding="utf-8"), ensure_ascii=False)
    cfg = {"libraries": [{"name": "lanternfox", "path": real["{LANTERNFOX}"], "tier": "main"},
                         {"name": "earshot", "path": real["{EARSHOT}"], "tier": "main"}],
           "uisfx": {"path": "vendor/node_modules/uisfx", "default_pack": "studio"},
           "skip_dir_names": ["_mister horse previews", "earshot"], "index_path": "library_index.json"}
    json.dump(cfg, open(os.path.join(rs, "config.json"), "w", encoding="utf-8"), indent=2)
    print("Real SFX pronta:", len(d["sounds"]), "suoni da", render + "/sounds")


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[0] == "--portabile": portabile(a[1], a[2])
    else: installa(a[0], a[1])
