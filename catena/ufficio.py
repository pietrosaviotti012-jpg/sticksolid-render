"""StickSolid · news for the Office (the StickSolid Studio Worker), sent by render.yml.

    python ufficio.py <production> inizio            the video starts: the chain lights up, Voce at work
    python ufficio.py <production> reparto <id> <working|done|error> [text]
    python ufficio.py <production> fetta <n>         one of the six frame machines has finished
    python ufficio.py <production> pronto <tag>      the video is finished: it goes to Approva (the files are in the draft release <tag>)
    python ufficio.py <production> fermo <step> <url> [log] the chain stopped at a step: the Regista restarts it, or explains why

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


PASSI = {"voce": "la voce e i tempi delle parole", "frames": "i fotogrammi (le 6 macchine)", "finale": "suoni, chiusura, copertina e controllo"}
# what an error in the log means, in plain Italian, and what to do: the first rule that matches wins
REGOLE = [
    (r"No space left on device", "La macchina di GitHub ha finito lo spazio sul disco: di solito un file che cresce senza fermarsi (era successo con l'audio del mix).",
     "Va cercato il passo che scrive troppo: rifarlo partire così non basta."),
    (r"Bad credentials|HTTP 401|HTTP 403|Resource not accessible|could not read Username|Repository not found",
     "GitHub ha rifiutato una chiave: un token è scaduto o non ha il permesso giusto.", "Va rinnovato il token (STUDIO_READ_TOKEN o simili): lo fai tu, nelle impostazioni di GitHub."),
    (r"Chromium: tentativo 3", "Il browser che disegna i fotogrammi non si è installato sulla macchina di GitHub.", "È un problema passeggero: basta riprovare."),
    (r"timed out|TimeoutExpired|The operation was canceled|exceeded the maximum execution time|The job running on runner .* has exceeded",
     "Ci ha messo troppo e ha superato il tempo massimo della macchina.", "Spesso basta riprovare; se succede ancora, il video è troppo lungo o una scena è troppo pesante."),
    (r"\[pageerror\]", "Le scene del video hanno un errore: il disegno si è fermato dentro il browser.",
     "Va corretto il file delle scene (shots.js) del video: è un lavoro per la routine Copione e Scene."),
    (r"(KeyError|AttributeError|TypeError|NameError|IndexError|ValueError|SyntaxError)[:(]",
     "Si è fermato per un errore nel codice della catena: il video ha qualcosa che la catena non sa ancora gestire.",
     "Va corretta la catena (sticksolid-render): riprovare uguale darebbe lo stesso errore."),
    (r"FileNotFoundError|No such file|ENOENT", "Mancava un file che la catena si aspettava (per esempio meta.json o il copione).",
     "Va controllata la cartella del video nel repository privato."),
    (r"tar: Error is not recoverable|Unexpected EOF in archive|xz: .*(corrupt|truncated)|gzip: stdin",
     "Un file scaricato da internet non è arrivato intero (di solito il programma video ffmpeg).", "È un problema passeggero: basta riprovare."),
    (r"Could not resolve|ENOTFOUND|ECONNRESET|HTTP 50[0-9]|rate limit|Temporary failure",
     "Un servizio esterno non ha risposto (GitHub o un download).", "Di solito basta riprovare."),
]


def spiega(log, step):
    """the reason of a stop, in plain words, and the last lines of the error (for whoever wants to look)"""
    lines = [re.sub(r"^[^\t]*\t[^\t]*\t\S+Z ", "", l) for l in log.splitlines()]   # "job<TAB>step<TAB>time text" -> "text"
    err = [l for l in lines if re.search(r"Error|Traceback|error:|##\[error\]|Errno|exit code", l) and not re.search(r"DeprecationWarning|Failed to load resource", l)]
    tail = "\n".join((err[-8:] if err else lines[-8:]))[-1500:]
    for rx, cosa, fare in REGOLE:
        if re.search(rx, log): return f"Si è fermato a: {PASSI.get(step, step)}. {cosa} {fare}", tail
    return f"Si è fermato a: {PASSI.get(step, step)}. Non conosco questo errore: le ultime righe del registro sono qui sotto.", tail


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
                "commenti": m.get("commenti", []),   # the vote and clue comments: the Office writes them when the video is out
                "preview_url": a.get(f"{m['id']}.mp4", ""), "cover_url": a.get("copertina.png", ""), "release": tag,
                # the studio's review (routines/REVISIONE.md) looks at the frames before the user does; without its pack it cannot
                "revisione": {"stato": "in attesa" if os.environ.get("REVISIONE_PACCO") == "ok" else "senza pacchetto"}}
        passa = re.search(r"CONTROLLO: passa", open(os.path.join(out, "..", "..", "..", "..", "controllo.log"), encoding="utf-8", errors="ignore").read()) \
            if os.path.exists(os.path.join(out, "..", "..", "..", "..", "controllo.log")) else None
        send({"dept": "controllo", "status": "done", "video_id": m["id"],
              "task": "Controllo: passa" if passa else "Controllo: da guardare (vedi Approva)"})
        send({"queue": item, "dept": "approva", "status": "waiting", "task": f"{item['title']} ti aspetta", "chain": {"ok": True, "id": m["id"]},
              "render": {"video": m["id"], "done": 6}})
    elif what == "fermo":
        step, url = rest[0], rest[1] if len(rest) > 1 else ""
        log = open(rest[2], encoding="utf-8", errors="ignore").read() if len(rest) > 2 and os.path.exists(rest[2]) else ""
        spiegazione, righe = spiega(log, step)
        dept = "render" if step == "frames" else "voce" if step == "voce" else "controllo"
        send({"chain": {"ok": False, "id": m["id"], "step": step, "url": url}, "dept": dept, "status": "error", "video_id": m["id"],
              "task": f"Si è fermato: {PASSI.get(step, step)}", "why": {"spiegazione": spiegazione, "righe": righe, "url": url, "passo": step}})
