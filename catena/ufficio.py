"""StickSolid · news for the Office (the StickSolid Studio Worker), sent by render.yml.

    python ufficio.py <production> inizio            the video starts: the chain lights up, Voce at work
    python ufficio.py <production> reparto <id> <working|done|error> [text]
    python ufficio.py <production> fetta <n>         one of the six frame machines has finished
    python ufficio.py <production> pronto <tag>      the video is finished: it goes to Approva (the files are in the draft release <tag>)
    python ufficio.py <production> fermo <step> <url> the chain stopped at a step (a red card and a notification)

It needs OFFICE_URL and STUDIO_SECRET in the environment (GitHub secrets of this repository). Without them it says so and
does nothing: the render never fails because the Office cannot be reached. No key is ever printed.
"""
import json, os, re, subprocess, sys, urllib.request

OFFICE, SECRET = os.environ.get("OFFICE_URL", "").rstrip("/"), os.environ.get("STUDIO_SECRET", "")


def send(event):
    if not OFFICE or not SECRET:
        print("ufficio: OFFICE_URL o STUDIO_SECRET mancano, non mando niente"); return
    req = urllib.request.Request(OFFICE + "/events", data=json.dumps(event).encode(), method="POST",
                                 headers={"Content-Type": "application/json", "Authorization": "Bearer " + SECRET, "User-Agent": "sticksolid-render"})
    try:
        with urllib.request.urlopen(req, timeout=20) as r: print("ufficio:", r.status, list(event))
    except Exception as e:                                                       # never stop the render for this
        print("ufficio: non raggiungibile:", str(e)[:120])


def meta(prod):
    return json.load(open(os.path.join(prod, "meta.json"), encoding="utf-8"))


def video(m):
    return {"id": m["id"], "title": m.get("title", m["id"]), "series": m.get("etichetta", "")}


def assets(tag):
    """the API addresses of the files of a draft release (only readable with a token: the video stays private until Approva)"""
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    out = subprocess.run(["gh", "api", f"repos/{repo}/releases", "--jq", f'.[] | select(.tag_name=="{tag}") | .assets[] | [.name, .url] | @tsv'],
                         capture_output=True, text=True).stdout
    return dict(line.split("\t") for line in out.strip().splitlines() if "\t" in line)


if __name__ == "__main__":
    prod, what, *rest = sys.argv[1:]
    m = meta(prod)
    if what == "inizio":
        send({"reset": True, "video": video(m), "dept": "voce", "status": "working", "task": "La voce con la regia, poi le parole e le didascalie",
              "render": {"video": m["id"], "slices": 6, "done": 0, "slices_done": []}})
    elif what == "reparto":
        dept, status, *text = rest
        send({"dept": dept, "status": status, "task": " ".join(text)[:280], "video_id": m["id"]})
    elif what == "fetta":
        send({"render": {"video": m["id"], "slice_done": int(rest[0])}})
    elif what == "pronto":
        tag = rest[0]; out = os.path.join(prod, "out"); a = assets(tag)
        ctrl = json.load(open(os.path.join(out, "controllo.json"), encoding="utf-8"))
        ctrl.get("voce", {}).pop("heard", None)                                   # the whole transcript is not needed
        hashtags = m.get("hashtags", [])
        item = {"id": m["id"], "title": m.get("title", m["id"]), "caption": (m.get("caption", "") + "\n\n" + " ".join(hashtags)).strip(),
                "hashtags": hashtags, "platforms": ["YouTube", "Instagram", "TikTok"], "formato": m.get("formato"), "numero": m.get("numero"),
                "who": m.get("who"), "part": m.get("parte"), "controllo": ctrl, "ai_label": m.get("ai_label", True),
                "preview_url": a.get(f"{m['id']}.mp4", ""), "cover_url": a.get("copertina.png", ""), "release": tag}
        passa = re.search(r"CONTROLLO: passa", open(os.path.join(out, "..", "..", "..", "..", "controllo.log"), encoding="utf-8", errors="ignore").read()) \
            if os.path.exists(os.path.join(out, "..", "..", "..", "..", "controllo.log")) else None
        send({"dept": "controllo", "status": "done", "video_id": m["id"],
              "task": "Controllo: passa" if passa else "Controllo: da guardare (vedi Approva)"})
        send({"queue": item, "dept": "approva", "status": "waiting", "task": f"{item['title']} ti aspetta", "chain": {"ok": True, "id": m["id"]},
              "render": {"video": m["id"], "done": 6}})
    elif what == "fermo":
        step, url = rest[0], rest[1] if len(rest) > 1 else ""
        send({"chain": {"ok": False, "id": m["id"], "step": step, "url": url}, "dept": "render" if step == "frames" else "voce" if step == "voce" else "controllo",
              "status": "error", "task": f"Si è fermato a {step}", "video_id": m["id"]})
