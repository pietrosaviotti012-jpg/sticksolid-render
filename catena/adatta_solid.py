"""StickSolid · bring a zach-d-films project into the chain (once per project).

    python adatta_solid.py <project folder> [--cieli '{"0x4f7fae": "cupo", ...}']

What it changes:
- index.html: captions in Poppins Bold, white with an ink outline, lowercase, numbers in yellow (testi/TESTI.md);
  three.js from /node_modules/ (served by engines/solid/render.mjs).
- src/main.js: reads catena.json (new captions, duration, time warp onto the new voice); the default sky and the
  stage lights become the "giorno" theme (peach): the zach-d blue sky hides Solid's blue T-shirt.
- src/world.js: person() is Solid from /kit/lib/solid.js; FACE presets become the 12 named expressions.
- --cieli: a scene that sets its own sky (setSky with that first colour) gets a theme from kit/temi.json instead.
Every change is checked: if a piece of text is not found the script stops and says which.
"""
import json, os, re, sys

TEMI = json.load(open(os.path.join(os.path.dirname(__file__), "..", "kit", "temi.json"), encoding="utf-8"))


def sub(s, old, new, what):
    if old not in s: sys.exit(f"non trovato in {what}: {old[:70]}")
    return s.replace(old, new)


def hexs(c): return "0x" + c.lstrip("#")


def main(proj, cieli):
    # ---- index.html: captions and the module paths
    p = os.path.join(proj, "index.html"); s = open(p, encoding="utf-8").read()
    s = re.sub(r"@font-face \{ font-family: 'Cap';[^}]*\}", "@font-face { font-family: 'Cap'; src: url('/kit/lib/Poppins-Bold.ttf'); font-weight: 700; }", s)
    s = re.sub(r"#cap \{[^}]*\}", "#cap {\n    position: absolute; left: 30px; right: 30px; top: 950px; text-align: center; text-transform: lowercase;\n"
               "    font: 700 54px/1.1 'Cap', sans-serif; color: #fff; letter-spacing: 0;\n"
               "    -webkit-text-stroke: 11px #221c22; paint-order: stroke fill;\n  }\n  #cap .key { color: #ffc93c; }", s)
    s = s.replace('"./node_modules/three/', '"/node_modules/three/')
    open(p, "w", encoding="utf-8").write(s)

    # ---- main.js: catena.json, warp, captions, the giorno theme
    g = TEMI["giorno"]["solid"]
    p = os.path.join(proj, "src", "main.js"); s = open(p, encoding="utf-8").read()
    s = sub(s, "import { SHOTS, CAPTIONS, DURATION, FADES } from './shots.js';",
            "import { SHOTS, CAPTIONS, DURATION, FADES } from './shots.js';\n"
            "// StickSolid: catena.json comes from catena/produci.py: captions on the new voice, its duration, and the time warp\n"
            "// [[new s, old s], ...] that plays the shots (timed on the old voice) in step with the new one\n"
            "const CAT = await fetch('catena.json?' + Date.now()).then((r) => (r.ok ? r.json() : null)).catch(() => null);\n"
            "function warpT(t) {\n  const W = CAT.warp; if (t <= W[0][0]) return W[0][1];\n"
            "  for (let i = 1; i < W.length; i++) if (t <= W[i][0]) { const k = (t - W[i - 1][0]) / (W[i][0] - W[i - 1][0]); return W[i - 1][1] + k * (W[i][1] - W[i - 1][1]); }\n"
            "  return W[W.length - 1][1] + (t - W[W.length - 1][0]);\n}\n"
            "const esc = (x) => x.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));\n"
            "// a caption: [start, text, end?, key words?]; numbers and the listed key words are yellow\n"
            "function capHTML(c) { const keys = new Set((c[3] || []).map((w) => w.toLowerCase()));\n"
            "  return c[1].split(' ').map((w) => (/\\d/.test(w) || keys.has(w.toLowerCase().replace(/[^a-z0-9']/g, '')) ? `<span class=\"key\">${esc(w)}</span>` : esc(w))).join(' '); }",
            "main.js (import)")
    s = sub(s, "top: { value: new THREE.Color(0x2b78d6) }, mid: { value: new THREE.Color(0x5b9fea) },",
            f"top: {{ value: new THREE.Color({hexs(g['sky'][0])}) }}, mid: {{ value: new THREE.Color({hexs(g['sky'][1])}) }},", "main.js (sky)")
    s = sub(s, "horizon: { value: new THREE.Color(0x92c3f2) }, floorC: { value: new THREE.Color(0xa9cdf1) },",
            f"horizon: {{ value: new THREE.Color({hexs(g['sky'][1])}) }}, floorC: {{ value: new THREE.Color({hexs(g['sky'][2])}) }},", "main.js (sky)")
    s = sub(s, "new THREE.ShadowMaterial({ color: 0x1a3a66, opacity: 0.32 })", "new THREE.ShadowMaterial({ color: 0x5a3020, opacity: 0.3 })", "main.js (shadow)")
    s = sub(s, "new THREE.HemisphereLight(0xcfe4ff, 0x7f93ad, 0.75)", f"new THREE.HemisphereLight({hexs(g['hemi'][0])}, {hexs(g['hemi'][1])}, 0.75)", "main.js (hemi)")
    s = sub(s, "new THREE.DirectionalLight(0xdbe9ff, 1.2)", "new THREE.DirectionalLight(0xffeee0, 1.2)", "main.js (rim)")
    s = sub(s, "window.DURATION = DURATION;\nwindow.renderAt = (t) => {",
            "window.DURATION = CAT?.duration ?? DURATION;\nwindow.renderAt = (tNew) => {\n  const t = CAT?.warp ? warpT(tNew) : tNew;", "main.js (renderAt)")
    s = sub(s, "  const c = CAPTIONS.filter(c => t >= c[0]).pop();\n  capEl.textContent = c && (c[2] == null || t < c[2]) ? c[1] : '';",
            "  const CAPS = CAT?.captions || CAPTIONS, tc = CAT ? tNew : t;\n  const c = CAPS.filter(c => tc >= c[0]).pop();\n"
            "  capEl.innerHTML = c && (c[2] == null || tc < c[2]) ? capHTML(c) : '';", "main.js (captions)")
    s = sub(s, 'composer.addPass(renderPass);\ncomposer.addPass(bokeh);',
            "// StickSolid: a pixel that comes out of the 3D render as NaN or infinite (one is enough, e.g. on the globe's shader)\n// is spread by the bloom into a big black rectangle that flashes for one frame. This pass replaces every such pixel\n// with the average of its good neighbours, and clamps negative colours, before bokeh and bloom see them.\nconst clean = new ShaderPass({\n  uniforms: { tDiffuse: { value: null }, px: { value: new THREE.Vector2(1 / W, 1 / H) } },\n  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,\n  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 px; varying vec2 vUv;\n    bool ok(vec4 c){ return abs(c.r) < 1e4 && abs(c.g) < 1e4 && abs(c.b) < 1e4 && abs(c.a) < 1e4; }\n    void main(){ vec4 c = texture2D(tDiffuse, vUv);\n      if (ok(c)) { gl_FragColor = max(c, vec4(0.0)); return; }\n      vec4 s = vec4(0.0); float n = 0.0;\n      for (int dx = -2; dx <= 2; dx++) for (int dy = -2; dy <= 2; dy++) {\n        vec4 q = texture2D(tDiffuse, vUv + vec2(float(dx), float(dy)) * px);\n        if (ok(q)) { s += max(q, vec4(0.0)); n += 1.0; } }\n      gl_FragColor = n > 0.0 ? s / n : vec4(0.0, 0.0, 0.0, 1.0); }`,\n});\ncomposer.addPass(renderPass);\ncomposer.addPass(clean);\ncomposer.addPass(bokeh);", "main.js (clean pass)")
    open(p, "w", encoding="utf-8").write(s)

    # ---- world.js: Solid and the named expressions
    p = os.path.join(proj, "src", "world.js"); s = open(p, encoding="utf-8").read()
    s = sub(s, "import { makeHuman } from './human.js';",
            "import { makeSolid, EXPR, blendExpr } from '/kit/lib/solid.js';", "world.js (import)")
    a = s.index("export function person() {"); b = s.index("export const FACE = {"); e = s.index("};", b) + 2
    s = s[:a] + ("// StickSolid: the person is Solid (blue T-shirt to the hips, jeans, white shoes, big friendly eyes)\n"
                 "export function person() { const h = makeSolid(); const sf = h.setFace; h.setFace = (f) => sf({ ...f, eyes: 1.35 }); return h; }\n"
                 "export function lerpFace(a, b, k) { return blendExpr(a, b, k); }\n"
                 "// the old face presets, mapped to the 12 StickSolid expressions\n"
                 "export const FACE = {\n  calm: EXPR.sorriso.solid, surprised: EXPR.whoa.solid, smug: EXPR.furbo.solid, scared: EXPR.paura.solid,\n"
                 "  worried: EXPR.preoccupato.solid, relieved: { ...EXPR.sorriso.solid, lid: 0.4 }, curious: EXPR.dubbio.solid,\n};") + s[e:]
    open(p, "w", encoding="utf-8").write(s)

    # ---- scenes that set their own sky: a theme instead
    if cieli:
        p = os.path.join(proj, "src", "shots.js"); s = open(p, encoding="utf-8").read()
        for first, tema in cieli.items():
            m = re.search(rf"setSky\(scene, {first}, [^)]*\);", s)
            if not m: sys.exit(f"setSky con {first} non trovato in shots.js")
            sky = TEMI[tema]["solid"]["sky"]
            s = s.replace(m.group(0), f"setSky(scene, {hexs(sky[0])}, {hexs(sky[1])}, {hexs(sky[1])}, {hexs(sky[2])}); // tema {tema}")
        open(p, "w", encoding="utf-8").write(s)
    print("progetto adattato:", proj)


if __name__ == "__main__":
    args = sys.argv[1:]; cieli = {}
    if "--cieli" in args: i = args.index("--cieli"); cieli = json.loads(args[i + 1]); del args[i:i + 2]
    main(args[0], cieli)
