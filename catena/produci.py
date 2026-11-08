"""StickSolid · the chain: from a production folder to a finished, checked video.

    python produci.py <production folder> [--da passo] [--fino passo] [--solo passo]

The production folder (in sticksolid-studio/productions/<id>/) has:
  meta.json       format, who (solid | stick), number, title, cover words, voice, closing, caption, hashtags
  copione.md      the script with its sources (checked by a person)
  project/        the scene project: script.json (the lines), src/shots.js ... (zach-d-films engine for Solid,
                  stick-figure engine for Stick: see adatta_solid.py and adatta_stick.py)
  project/audio/rif.words.json   (optional) the word times the shots were drawn on: the shots are warped onto the new voice
Steps (each one writes into <production>/out/ and can be re-run alone with --solo):
  voce      the voice (voce/voce.py: normalised text, Kokoro, creator or dark master)
  parole    word times (Parakeet, skills/kit/words.py)
  didascalie captions of 1-3 words, numbers in yellow (testi/TESTI.md)
  tempi     catena.json: captions, duration, the time warp of the shots
  render    the frames: engines/solid/render.mjs (three.js, 720x1280) or engines/stick/render.mjs (2D, 1080x1920)
  mix       picture to 1080x1920 + voice (corpo.mp4)
  suoni     sound effects: project/suoni.json (each sound tied to a word of the script) + a light whoosh on every cut,
            turned into real sounds and mixed under the voice by the Real SFX skill (corpo_sfx.mp4)
  finale    the closing card with the signature sound is added at the end
  copertina the cover (kit/cover.html)
  provini   a contact sheet of 12 frames, to look at before Approva
  controllo the voice check (voce/controllo.py) and the numbers of the finished file
"""
import difflib, glob, json, os, re, shutil, subprocess, sys, time

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(REPO, "voce"))
import voce as V                                                             # noqa: E402
PASSI = ["voce", "parole", "didascalie", "tempi", "render", "mix", "suoni", "finale", "copertina", "provini", "controllo"]
STUDIO_ID = os.path.join(REPO, "..", "studio", "identita")                    # the identity assets (closing card)


def run(cmd, **kw):
    print("  $", " ".join(str(c) for c in cmd)[:160]); t = time.time()
    subprocess.run([str(c) for c in cmd], check=True, **kw); print(f"    ({time.time() - t:.0f} s)")


def norm(w): return re.sub(r"[^a-z0-9]", "", w.lower())


class Prod:
    def __init__(self, d):
        self.d = os.path.abspath(d); self.meta = json.load(open(os.path.join(self.d, "meta.json"), encoding="utf-8"))
        self.proj = os.path.join(self.d, "project"); self.out = os.path.join(self.d, "out"); os.makedirs(self.out, exist_ok=True)
        self.id = self.meta["id"]; self.vo = os.path.join(self.out, "voce.mp3")

    # ---- 1. the voice
    def voce(self):
        lines = json.load(open(os.path.join(self.proj, "script.json"), encoding="utf-8"))
        v = self.meta.get("voce", {})
        # the direction (voce/regia.py): the automatic director, with project/regia.json on top; "regia": false in meta.voce = flat
        plan = None
        if v.get("regia", True):
            import regia as R                                                          # noqa: E402
            rj = os.path.join(self.proj, "regia.json")
            plan = R.piano(lines, json.load(open(rj, encoding="utf-8")) if os.path.exists(rj) else None, cupo=v.get("master") == "cupo")
            json.dump(plan, open(os.path.join(self.out, "regia.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            for ln, p in zip(lines, plan): print(f"  {p['tono']:8} v{p['velocita']:.2f} {p['tono_st']:+.1f}st enfasi={p.get('enfasi')} | {(ln if isinstance(ln, str) else ln.get('text', ''))[:50]}")
        _, dur = V.make(lines, self.vo, v.get("voice", "am_puck+am_onyx:0.7"), v.get("speed", 1.15), master=v.get("master", "creator"), regia=plan)
        for f in glob.glob(os.path.join(self.out, "*.raw.wav")): os.remove(f)
        print(f"  voce {dur:.1f} s")

    # ---- 2. word times
    def parole(self):
        # the kit's words.py wants the lines as plain text: the characters' lines of a Your Call ({"text", "voice", "fx"}) are flattened
        lines = json.load(open(os.path.join(self.proj, "script.json"), encoding="utf-8"))
        flat = os.path.join(self.out, "script-testo.json")
        json.dump([ln if isinstance(ln, str) else ln.get("text", "") for ln in lines], open(flat, "w", encoding="utf-8"), ensure_ascii=False)
        run([sys.executable, os.path.join(V.KIT, "words.py"), self.vo, flat])

    def words(self): return json.load(open(os.path.join(self.out, "voce.words.json"), encoding="utf-8"))

    # ---- 3. captions: 1-3 words that carry meaning (2 for Stick), a break on punctuation, on a pause, or past 18 letters
    def didascalie(self):
        W = self.words(); groups, cur = [], []
        maxw = 3 if self.meta.get("who") == "solid" else 2
        # the little words that lean on the next one ("in the", "of the", "and the") do not count, and a caption never
        # ends on one: they ride with the word after them. Two capitalised words in a row are a name ("New England",
        # "Abraham Davenport") and stay together.
        LEAN = {norm(x) for x in ("a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "at", "for", "with", "from", "by", "as",
                                  "than", "my", "your", "his", "her", "its", "their", "our", "so", "if", "that")}
        PUNCT = r"[,.?!;:]$"
        lean = lambda w: norm(w["w"]) in LEAN                                                        # noqa: E731
        for i, w in enumerate(W):
            cur.append(w)
            nxt = W[i + 1] if i + 1 < len(W) else None
            if nxt is None or re.search(PUNCT, w["w"]) or nxt["s"] - w["e"] > 0.25: groups.append(cur); cur = []; continue
            if lean(w): continue
            ahead = []                                                                               # up to the next word that counts
            for x in W[i + 1:]:
                ahead.append(x)
                if not lean(x) or re.search(PUNCT, x["w"]): break
            text = " ".join(x["w"] for x in cur); more = " ".join(x["w"] for x in ahead)
            name = len(ahead) == 1 and w["w"][:1].isupper() and ahead[0]["w"][:1].isupper() and len(text) + 1 + len(more) <= 24
            tail = len(ahead) == 1 and lean(ahead[0]) and len(text) + 1 + len(more) <= 22           # "and the work went on."
            if not name and not tail and (sum(not lean(x) for x in cur) >= maxw or len(text) + 1 + len(more) > 18):
                groups.append(cur); cur = []
        for i in range(len(groups) - 1):
            g, h = groups[i], groups[i + 1]
            while len(g) > 2 and norm(g[-1]["w"]) in LEAN and not re.search(r"[,.?!;:]$", g[-1]["w"]) and h[0]["s"] - g[-1]["e"] < 0.25:
                h.insert(0, g.pop())
        caps = [[round(g[0]["s"], 2), re.sub(r"[,.;:!]+$", "", " ".join(x["w"] for x in g)).replace("—", ""), None] for g in groups if g]
        caps[-1][2] = round(W[-1]["e"] + 0.6, 2)
        json.dump(caps, open(os.path.join(self.out, "didascalie.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
        print(f"  {len(caps)} didascalie")

    # ---- 4. catena.json: the new captions, the duration, and the warp new -> old voice for the shots
    def tempi(self):
        W = self.words(); caps = json.load(open(os.path.join(self.out, "didascalie.json"), encoding="utf-8"))
        cat = {"captions": caps, "duration": round(W[-1]["e"] + 0.9, 2)}
        ref = os.path.join(self.proj, "audio", "rif.words.json")
        if os.path.exists(ref):
            R = json.load(open(ref, encoding="utf-8"))
            sm = difflib.SequenceMatcher(a=[norm(x["w"]) for x in W], b=[norm(x["w"]) for x in R], autojunk=False)
            pairs, match = [(0.0, 0.0)], {}
            for blk in sm.get_matching_blocks():
                for k in range(blk.size):
                    match[blk.a + k] = blk.b + k
                    n, o = W[blk.a + k]["s"], R[blk.b + k]["s"]
                    if n > pairs[-1][0] + 0.05 and o > pairs[-1][1] + 0.05: pairs.append((round(n, 3), round(o, 3)))
            # the end: the old word that matches the new last word, if any. A script that lost its last words ("Strange
            # Days, part one") must not make the last shot race through the old ending in a fraction of a second.
            pairs.append((round(W[-1]["e"], 3), round(R[match.get(len(W) - 1, len(R) - 1)]["e"], 3)))
            cat["warp"] = pairs
            print(f"  tempi: {len(pairs)} punti, voce nuova {W[-1]['e']:.1f} s contro {R[-1]['e']:.1f} s della vecchia")
        json.dump(cat, open(os.path.join(self.proj, "catena.json"), "w", encoding="utf-8"), ensure_ascii=False)

    # ---- 5. the frames
    def render(self):
        engine = "stick" if self.meta.get("who") == "stick" else "solid"
        run(["node", os.path.join(REPO, "engines", engine, "render.mjs"), self.proj, "video", os.path.join(self.out, "muto.mp4"), 30])

    # ---- 6. the mix: picture + voice, then the closing card with the signature sound
    def mix(self):
        body = os.path.join(self.out, "corpo.mp4"); muto = os.path.join(self.out, "muto.mp4")
        # the length is the picture's, given explicitly: with an older ffmpeg (GitHub's Ubuntu) "apad" + "-shortest"
        # never stopped and padded silence until the disk was full
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", muto]).strip())
        run(["ffmpeg", "-y", "-v", "error", "-i", muto, "-i", self.vo,
             "-filter_complex", f"[0:v]scale=1080:1920:flags=lanczos,fps=30,format=yuv420p[v];[1:a]aresample=48000,apad=whole_dur={dur:.3f}[a]",
             "-map", "[v]", "-map", "[a]", "-t", f"{dur:.3f}", "-c:v", "libx264", "-crf", "18", "-c:a", "aac", "-b:a", "192k", body])

    # ---- 7. the sound effects (Real SFX): sounds tied to words, plus a light whoosh on every cut of the shots
    def suoni(self):
        W = self.words(); events = []
        cues = os.path.join(self.proj, "suoni.json")
        for c in (json.load(open(cues, encoding="utf-8")) if os.path.exists(cues) else []):
            hits = [w for w in W if norm(w["w"]) == norm(c["parola"])]
            if len(hits) < c.get("n", 1): print(f"  attenzione: «{c['parola']}» n.{c.get('n', 1)} non c'è nella voce"); continue
            # deep thumps and sub drops pile onto the voice, which already has a lot of body (Puck + Onyx, +3 dB at 120 Hz):
            # they go in only when the sound list asks for it on purpose ("bassi": true)
            if c["type"] in ("drop", "thump", "sub_drop") and not c.get("bassi"):
                print(f"  tolto «{c['type']}» su «{c['parola']}»: la voce fa già da basso (\"bassi\": true per tenerlo)"); continue
            e = {k: v for k, v in c.items() if k in ("type", "len", "g")}; e["t"] = round(hits[c.get("n", 1) - 1]["s"] + c.get("dopo", 0), 3)
            if e["type"] == "riser": e["t"] = round(max(0, e["t"] - e.get("len", 1)), 3)     # a riser ends on its word
            events.append(e)
        cat = json.load(open(os.path.join(self.proj, "catena.json"), encoding="utf-8"))
        for t in self.tagli(cat):
            if all(abs(t - e["t"]) > 0.35 for e in events): events.append({"t": round(t, 3), "type": "wipe", "g": 0.55})
        events.sort(key=lambda e: e["t"])
        sfx = os.path.join(self.out, "sfx"); os.makedirs(sfx, exist_ok=True)
        json.dump(events, open(os.path.join(sfx, "eventi.json"), "w"), indent=0)
        print(f"  {len(events)} suoni da mettere ({sum(e['type'] == 'wipe' for e in events)} sui tagli)")
        rs = os.environ.get("REAL_SFX") or os.path.join(os.path.expanduser("~"), ".claude", "skills", "real-sfx")   # GitHub: catena/ci_suoni.py
        py = shutil.which("python") or sys.executable
        run([py, os.path.join(rs, "scripts", "from_cues.py"), os.path.join(sfx, "eventi.json"), "--video", os.path.join(self.out, "corpo.mp4"),
             "--out", os.path.join(sfx, "cues.json"), "--ui", "library", "--no-check"], cwd=rs, stdin=subprocess.DEVNULL)
        # what the Real SFX critique taught on whatif-1 (4 rounds): the hits lose their lows under 180 Hz (they piled
        # onto the bass of the voice), and every effect sits 6 dB above the starting level (balance under the voice)
        sheet = json.load(open(os.path.join(sfx, "cues.json"), encoding="utf-8"))
        lst = sheet["cues"] if isinstance(sheet, dict) else sheet
        for c in lst:
            role = (c.get("pick") or {}).get("role") if isinstance(c.get("pick"), dict) else None
            if role == "hit" or str(c.get("label", "")).startswith(("hit", "thump")): c["highpass"] = 180
            c["gain_db"] = round(c.get("gain_db", 0) + 6, 1)
        json.dump(sheet, open(os.path.join(sfx, "cues.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        sheet_py = os.path.join(rs, "scripts", "sheet.py"); cj = os.path.join(sfx, "cues.json")
        q = lambda *a: subprocess.run([py, sheet_py, *[str(x) for x in a]], cwd=rs, stdin=subprocess.DEVNULL, capture_output=True)  # noqa: E731

        def mix_and_judge(rnd):
            subprocess.run([py, os.path.join(rs, "scripts", "mix.py"), cj, "--out", os.path.join(self.out, "corpo_sfx.mp4"), "--voice-safe", "--no-match-layer"],
                           cwd=rs, stdin=subprocess.DEVNULL, capture_output=True, check=True)
            subprocess.run([py, os.path.join(rs, "scripts", "critique.py"), os.path.join(self.out, "corpo_sfx_resolved_cues.json"),
                            os.path.join(self.out, "corpo_sfx_sfx_track.wav"), "--voice", "--rounds", str(rnd), "--out", os.path.join(sfx, "critica.md")],
                           cwd=rs, stdin=subprocess.DEVNULL, capture_output=True)
            rep = open(os.path.join(sfx, "critica.md"), encoding="utf-8").read()
            return {k: float(v) for k, v in re.findall(r"^\| ([a-z_]+) \| ([0-9.]+) \|", rep, re.M)}, rep

        # the self-critique loop of the Real SFX skill: up to 4 rounds, each applies what the critique asks
        # ("lower it N dB", "arrives -M ms", headroom, balance) and the best round is kept
        best = None
        for rnd in range(5):
            sc, rep = mix_and_judge(rnd)
            worst = min(sc.values()) if sc else 0
            print(f"  giro {rnd}: " + ", ".join(f"{k} {v:g}" for k, v in sc.items() if v < 9.5) + f"  (il più basso {worst:g})")
            if best is None or worst > best[0]: best = (worst, open(cj, encoding="utf-8").read())
            if worst >= 8 or rnd == 4: break
            for lab, t, db in re.findall(r"'([^']+)' at ([0-9.]+)s piles onto the bass[^;]*; lower it ([0-9.]+) dB", rep):
                q("gain", cj, "--db", f"-{db}", "--at", t); q("set", cj, "--at", t, "highpass=200")
            for lab, t, ms in re.findall(r"sync: '([^']+)' at ([0-9.]+)s arrives (-?[0-9]+) ms", rep):
                q("shift", cj, "--by", f"{-int(ms) / 1000:.3f}", "--at", t)
            if sc.get("headroom", 10) < 8: q("gain", cj, "--db", "-1.5", "--between", "0", "999")
            if sc.get("balance", 10) < 8 and sc.get("headroom", 10) >= 8: q("gain", cj, "--db", "2", "--between", "0", "999")
            if sc.get("speech", 10) < 8: q("gain", cj, "--db", "-1.5", "--between", "0", "999")
        open(cj, "w", encoding="utf-8").write(best[1]); sc, rep = mix_and_judge(9)
        low = [k for k, v in sc.items() if v < 8]
        print("  critica dei suoni:", ", ".join(f"{k} {v:g}" for k, v in sc.items()), "->", ("da sistemare: " + ", ".join(low)) if low else "tutto sopra 8")

    def tagli(self, cat):
        """the cuts between shots, on the new timeline: the shot starts of shots.js, through the inverse of the warp"""
        src = open(os.path.join(self.proj, "src", "shots.js"), encoding="utf-8").read()
        starts = [float(x) for x in re.findall(r"\{\s*start:\s*([0-9.]+)", src)][1:]
        W = cat.get("warp")
        if not W: return starts
        out = []
        for o in starts:
            for (n0, o0), (n1, o1) in zip(W, W[1:]):
                if o0 <= o <= o1: out.append(n0 + (o - o0) / max(1e-6, o1 - o0) * (n1 - n0)); break
        return out

    # ---- 8. the closing card with the signature sound
    def finale(self):
        body = os.path.join(self.out, "corpo_sfx.mp4")
        if not os.path.exists(body): body = os.path.join(self.out, "corpo.mp4")
        clos = os.path.join(STUDIO_ID, "chiusura", f"chiusura-{self.meta.get('chiusura', 'follow')}.mp4")
        final = os.path.join(self.out, f"{self.id}.mp4")
        # every audio cut to its own video's length (8 November: on GitHub this join once waited 37 minutes for audio that did not end),
        # and a time limit, so a stop reaches the Regista in minutes instead of at the job's 40-minute limit
        vdur = lambda f: float(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "format=duration",
                                                        "-of", "csv=p=0", f]).strip())
        db, dc = vdur(body), vdur(clos)
        run(["ffmpeg", "-y", "-v", "error", "-i", body, "-i", clos, "-filter_complex",
             "[0:v]fps=30,format=yuv420p,setsar=1[v0];[1:v]scale=1080:1920,fps=30,format=yuv420p,setsar=1[v1];"
             f"[0:a]aresample=48000,aformat=channel_layouts=stereo,atrim=end={db:.3f},apad=whole_dur={db:.3f}[a0];"
             f"[1:a]aresample=48000,aformat=channel_layouts=stereo,atrim=end={dc:.3f},apad=whole_dur={dc:.3f}[a1];"
             "[v0][a0][v1][a1]concat=n=2:v=1:a=1[v][a]", "-map", "[v]", "-map", "[a]", "-t", f"{db + dc + 0.5:.3f}",
             "-c:v", "libx264", "-crf", "20", "-preset", "medium", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final], timeout=600)

    # ---- 7. the cover (kit/cover.html), with the character in the face of the cover
    def copertina(self):
        m = self.meta; c = m["copertina"]; kit = os.path.join(REPO, "kit"); rel = f"out/catena/{self.id}"
        os.makedirs(os.path.join(kit, rel), exist_ok=True)
        jobs = []
        if m["who"] == "solid":
            jobs.append({"page": "man", "out": f"{rel}/solid.png", "cfg": {"pose": c.get("posa", "whoa"), "ground": False, "shirt": "#2f63c9", "fov": 13,
                         "camPos": [0, 1.6, 4.6], "camLook": [0, 1.5, 0], "turn": 0, "face": {**V_EXPR(c.get("faccia", "whoa")), "eyes": 1.35}}})
            cover = {"who": "solid", "label": m["etichetta"], "number": m["numero"], "words": c["parole"], "man": {"src": f"{rel}/solid.png", "x": -360, "y": 640, "w": 1800}}
        else:
            # Stick's place and pose on the cover (the identity covers, phase 1): big, from the bottom, arms up, "whoa".
            # meta.copertina.stick only changes what it lists (a face, the arms)
            st = {"x": 540, "y": 2050, "s": 1250, "headScale": 0.85, "legs": {"L": [0.12, -0.05], "R": [0.12, -0.05]},
                  "arms": {"L": [2.3, 0.7], "R": [2.3, 0.7]}, "face": {"eyes": "wide", "mouth": "o", "browUp": 1, "look": [0, -0.6]}, **c.get("stick", {})}
            cover = {"who": "stick", "label": m["etichetta"], "number": m["numero"], "words": c["parole"], "stick": st}
        jobs.append({"page": "cover", "out": f"{rel}/copertina.png", "cfg": cover})
        jf = os.path.join(kit, rel, "copertina.json"); json.dump(jobs, open(jf, "w"))
        run(["node", "render.mjs", os.path.relpath(jf, kit)], cwd=kit, stdin=subprocess.DEVNULL)
        shutil.copy(os.path.join(kit, rel, "copertina.png"), os.path.join(self.out, "copertina.png"))

    # ---- 8. the contact sheet: 12 frames across the video
    def provini(self):
        final = os.path.join(self.out, f"{self.id}.mp4")
        dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", final]).strip())
        times = [dur * (i + 0.5) / 12 for i in range(12)]
        expr = "+".join(f"lt(prev_pts*TB\\,{t:.2f})*gte(pts*TB\\,{t:.2f})" for t in times)
        run(["ffmpeg", "-y", "-v", "error", "-i", final, "-vf", f"select='{expr}',scale=270:480,tile=6x2:padding=6:color=white", "-frames:v", "1",
             os.path.join(self.out, "provini.jpg")])

    # ---- 9. the checks
    def controllo(self):
        sys.argv = ["controllo.py"]; import controllo as C                        # noqa: E402
        r = C.check(self.vo)
        try:                                                                            # QC-02: how much the voice moves
            import parselmouth, numpy as np                                             # noqa: E402
            f0 = parselmouth.Sound(self.vo).to_pitch(0.01, 60, 320).selected_array["frequency"]; f0 = f0[f0 > 0]
            r["melodia"] = round(float(np.std(12 * np.log2(f0 / np.median(f0)))), 2)
        except ImportError: r["melodia"] = None
        final = os.path.join(self.out, f"{self.id}.mp4")
        info = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=width,height,r_frame_rate,codec_type",
                                                   "-of", "json", final]))
        lufs, peak = C.loudness(final)
        rep = {"voce": r, "video": {"durata": round(float(info["format"]["duration"]), 2), "mb": round(int(info["format"]["size"]) / 1048576, 1),
                                    "formato": [f"{s.get('width')}x{s.get('height')} {s.get('r_frame_rate')}" for s in info["streams"] if s["codec_type"] == "video"][0],
                                    "lufs": lufs, "picco": peak, "flash": self.flash(final)}}
        json.dump(rep, open(os.path.join(self.out, "controllo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print(f"  voce: {r['wer']}% parole sbagliate, {r['wps']} parole/s, pausa max {r['silence']} s; video {rep['video']}")
        for w, g in r["errors"][:10]: print(f"    voleva «{w}» sentito «{g}»")
        for w, g in r.get("dubbi_contesto", []): print(f"    dubbio di contesto (da sola la frase è giusta): «{w}» sentito «{g}» nel file intero")
        ko = []
        if r["wer"] > 0: ko.append(f"{r['wer']}% di parole sbagliate")
        if r.get("melodia") is not None and r["melodia"] < 4.2 and self.meta.get("voce", {}).get("regia", True):
            ko.append(f"voce piatta (melodia {r['melodia']} < 4.2)")
        if rep["video"]["flash"]: ko.append(f"flash in {len(rep['video']['flash'])} fotogrammi: {rep['video']['flash'][:8]}")
        if not -16.5 <= lufs <= -13: ko.append(f"volume {lufs} LUFS")
        if peak > -1: ko.append(f"picco {peak} dBTP")
        # "Fatti": a true story or a what if has its sources in copione.md (a "## ... fonti" or "## ... sources" section,
        # one list item per fact). Fewer than 2 stops the video; items without a link are only flagged, to look at.
        if self.meta.get("formato") in ("storia-vera", "what-if"):
            f = self.fatti(); rep["fatti"] = f
            if f["voci"] < 2: ko.append(f"fonti: {f['voci']} in copione.md (ne servono almeno 2)")
            elif f["senza_link"]: print(f"  fatti: {f['voci']} fonti, {f['senza_link']} senza link (da aggiungere prima di pubblicare)")
        # "Ritmo" (phase 4): on our 20 old videos, the hold at 3 s on TikTok went with the pace of the picture, not with
        # the words of the hook (studio/research/predictor/RISULTATO.md). Measured on every video, given as advice
        # (it never stops a video); the weekly Analisi compares it with the real numbers until there is data for a
        # predictor of our own.
        rep["ritmo"] = rt = self.ritmo()
        print(f"  ritmo: {rt['tagli_10s']} tagli ogni 10 s, primo taglio a {rt['primo_taglio']} s, inquadratura mediana {rt['inq_mediana']} s, "
              f"movimento nei primi 3 s {rt['movimento_3s']} (nel resto {rt['movimento']})")
        for c in rt["consigli"]: print(f"    consiglio: {c}")
        json.dump(rep, open(os.path.join(self.out, "controllo.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        print("  CONTROLLO:", "NON PASSA · " + "; ".join(ko) if ko else "passa")

    # what the 5 old videos in the new style did (45-52% still there at 3 s on TikTok); see RISULTATO.md
    RITMO = {"tagli_10s": 2.5, "primo_taglio": 3.0, "inq_mediana": 4.0}

    def ritmo(self):
        """the pace of the body (closing card excluded): the cuts come from the shots (shots.js through the time warp),
        the movement is how much the picture changes from one frame to the next (0-255, frames at 90x160 in grey)"""
        cat = json.load(open(os.path.join(self.proj, "catena.json"), encoding="utf-8"))
        dur = cat["duration"]; cuts = sorted(t for t in self.tagli(cat) if 0 < t < dur)
        edges = [0.0] + cuts + [dur]; shots = sorted(b - a for a, b in zip(edges, edges[1:]))
        body = os.path.join(self.out, "corpo.mp4")
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", body, "-t", f"{dur:.2f}", "-vf", "scale=90:160,fps=30,format=gray", "-f", "rawvideo", "-"],
                             capture_output=True, check=True).stdout
        import numpy as np                                                              # noqa: E402
        f = np.frombuffer(raw, np.uint8).reshape(-1, 160 * 90).astype(np.int16)
        d = np.abs(np.diff(f, axis=0)).mean(1) if len(f) > 1 else np.zeros(1)
        rt = {"tagli_10s": round(len(cuts) / dur * 10, 2), "primo_taglio": round(cuts[0], 2) if cuts else None,
              "inq_mediana": round(shots[len(shots) // 2], 2), "movimento_3s": round(float(d[:90].mean()), 2), "movimento": round(float(d[90:].mean()), 2)}
        R, cons = self.RITMO, []
        if rt["tagli_10s"] < R["tagli_10s"]: cons.append(f"pochi tagli: {rt['tagli_10s']} ogni 10 s, i video nuovi migliori ne hanno almeno {R['tagli_10s']}")
        if rt["primo_taglio"] is None or rt["primo_taglio"] > R["primo_taglio"]: cons.append(f"il primo taglio arriva tardi ({rt['primo_taglio']} s): meglio entro {R['primo_taglio']} s")
        if rt["inq_mediana"] > R["inq_mediana"]: cons.append(f"inquadrature lunghe: la mediana è {rt['inq_mediana']} s, meglio sotto {R['inq_mediana']} s")
        if rt["movimento_3s"] < rt["movimento"] * 0.8: cons.append("nei primi 3 secondi l'immagine si muove meno che nel resto del video: il gancio deve essere già in azione")
        rt["consigli"] = cons
        return rt

    def fatti(self):
        """the sources section of copione.md: how many facts are listed and how many have no link"""
        p = os.path.join(self.d, "copione.md")
        txt = open(p, encoding="utf-8").read() if os.path.exists(p) else ""
        m = re.search(r"^##[^\n]*(fonti|sources)[^\n]*\n(.*?)(?=^## |\Z)", txt, re.I | re.M | re.S)
        items = re.findall(r"^\s*[-*] (.+)$", m.group(2), re.M) if m else []
        return {"voci": len(items), "senza_link": sum("http" not in x for x in items)}

    @staticmethod
    def flash(path):
        """frames where the picture jumps for one or two frames: a block of black (or white) that its neighbours do not
        have (the bloom on a broken pixel, a frame captured too early). A fade to black is gradual, so it is not a flash."""
        raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", "scale=90:160,format=gray", "-f", "rawvideo", "-"],
                             capture_output=True, check=True).stdout
        import numpy as np                                                              # noqa: E402
        f = np.frombuffer(raw, np.uint8).reshape(-1, 160 * 90).astype(np.int16)
        dark = (f < 8).mean(1); light = (f > 248).mean(1); out = []
        for i in range(1, len(f) - 1):
            for x in (dark, light):
                if x[i] - max(x[i - 1], x[i + 1]) > 0.15 or (i + 2 < len(f) and min(x[i], x[i + 1]) - max(x[i - 1], x[i + 2]) > 0.15):
                    out.append(round(i / 30, 2)); break
        return out


def V_EXPR(name):
    e = json.load(open(os.path.join(REPO, "kit", "espressioni.json"), encoding="utf-8"))
    return e[name]["solid"]


if __name__ == "__main__":
    a = sys.argv[1:]; d = a[0]
    solo = a[a.index("--solo") + 1] if "--solo" in a else None
    da = a[a.index("--da") + 1] if "--da" in a else PASSI[0]
    fino = a[a.index("--fino") + 1] if "--fino" in a else PASSI[-1]                 # GitHub: voice up to "tempi", then the frames
    p = Prod(d)
    for passo in PASSI[PASSI.index(da):PASSI.index(fino) + 1]:
        if solo and passo != solo: continue
        print(f"== {passo}"); getattr(p, passo)()
    print("fatto:", os.path.join(p.out, f"{p.id}.mp4"))
