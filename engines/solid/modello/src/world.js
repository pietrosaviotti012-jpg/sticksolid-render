// Props for "What if Earth stopped spinning for one second?": the globe, arrows, a speed gauge,
// a casual person, trees, a car, street things, a jet, a giant wave, snow and a pole marker.
import * as THREE from 'three';
import { makeSolid, EXPR, blendExpr } from '/kit/lib/solid.js';
import { rng, glowTexture } from './textures.js';
import { clamp } from './anim.js';

export const shadow = o => { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); return o; };
export const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });
export const glowMat = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
export function mesh(geo, mat, p = [0, 0, 0], r = [0, 0, 0], s = null) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...p); m.rotation.set(...r); if (s) m.scale.set(...s); return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------- the Earth ----------------
const LAND = [
  // North America
  [[-165, 65], [-140, 70], [-110, 72], [-85, 72], [-78, 66], [-70, 62], [-62, 56], [-60, 50], [-67, 45], [-71, 41], [-75, 38], [-80, 32], [-81, 25], [-84, 30], [-90, 29], [-97, 27], [-97, 20], [-91, 19], [-88, 16], [-83, 10], [-79, 8], [-85, 12], [-92, 15], [-105, 20], [-110, 24], [-112, 30], [-118, 34], [-124, 40], [-125, 48], [-133, 56], [-140, 60], [-150, 60], [-158, 57], [-165, 60]],
  // Hudson Bay is water: drawn later
  // Greenland
  [[-50, 60], [-42, 60], [-30, 66], [-20, 72], [-18, 80], [-35, 83], [-60, 82], [-72, 78], [-58, 72], [-54, 66]],
  // South America
  [[-79, 8], [-72, 12], [-62, 10], [-52, 4], [-50, 0], [-44, -2], [-35, -6], [-38, -13], [-40, -20], [-44, -23], [-48, -27], [-53, -33], [-58, -38], [-63, -40], [-65, -45], [-68, -52], [-72, -53], [-74, -46], [-73, -38], [-71, -30], [-70, -20], [-76, -14], [-81, -6], [-80, -1]],
  // Europe + Asia
  [[-9, 37], [-9, 43], [-2, 44], [-4, 48], [2, 51], [5, 53], [8, 57], [5, 62], [12, 66], [16, 69], [24, 71], [30, 70], [41, 67], [45, 68], [55, 68], [60, 70], [70, 73], [80, 73], [90, 76], [104, 78], [113, 74], [128, 72], [140, 72], [152, 71], [162, 70], [178, 69], [180, 66], [178, 63], [170, 60], [163, 60], [157, 51], [155, 57], [143, 59], [137, 54], [141, 48], [135, 43], [129, 41], [129, 35], [126, 35], [126, 38], [121, 40], [118, 38], [122, 31], [120, 26], [116, 23], [110, 21], [106, 18], [109, 12], [105, 9], [101, 13], [100, 7], [103, 1], [98, 8], [98, 16], [94, 17], [92, 22], [88, 22], [84, 18], [80, 13], [77, 8], [73, 17], [72, 21], [67, 25], [62, 25], [57, 25], [56, 27], [51, 27], [48, 30], [50, 25], [56, 25], [59, 22], [55, 17], [52, 16], [44, 12], [42, 16], [39, 21], [35, 28], [34, 31], [35, 36], [30, 36], [27, 37], [26, 40], [23, 38], [22, 37], [20, 40], [19, 42], [13, 45], [16, 42], [18, 40], [16, 38], [12, 42], [10, 44], [7, 44], [3, 43], [0, 39], [-1, 37], [-5, 36]],
  // Africa
  [[-17, 21], [-17, 15], [-15, 11], [-12, 7], [-8, 4], [-3, 5], [3, 6], [9, 4], [9, 1], [12, -5], [13, -12], [12, -17], [15, -27], [17, -31], [18, -34], [22, -34], [27, -33], [32, -29], [33, -26], [35, -22], [35, -18], [40, -15], [40, -10], [39, -5], [42, 0], [46, 3], [51, 11], [44, 11], [43, 13], [39, 16], [37, 21], [34, 27], [32, 31], [25, 32], [20, 31], [16, 31], [11, 33], [10, 37], [2, 37], [-2, 35], [-6, 35], [-10, 30], [-13, 27]],
  // Australia
  [[114, -22], [116, -20], [122, -17], [126, -14], [130, -12], [136, -12], [137, -15], [140, -17], [142, -11], [146, -18], [150, -22], [153, -26], [153, -30], [150, -36], [146, -39], [141, -38], [138, -35], [135, -34], [131, -31], [124, -33], [118, -35], [115, -34], [113, -26]],
  // islands
  [[-5, 50], [1, 51], [0, 53], [-2, 56], [-5, 58], [-6, 55], [-3, 54]],
  [[-10, 52], [-6, 52], [-6, 55], [-10, 54]],
  [[130, 31], [133, 34], [136, 34], [140, 36], [141, 39], [142, 43], [145, 44], [141, 45], [140, 41], [137, 37], [133, 35], [130, 34]],
  [[95, 5], [98, 3], [104, -2], [106, -6], [102, -5], [98, -1], [95, 3]],
  [[106, -6], [112, -7], [115, -8], [114, -9], [108, -8]],
  [[109, 2], [113, 3], [117, 7], [119, 5], [118, 1], [116, -4], [110, -3]],
  [[119, 0], [125, 1], [121, -2], [122, -5], [120, -5]],
  [[131, -1], [138, -2], [144, -4], [150, -10], [143, -9], [138, -8], [132, -4]],
  [[44, -25], [47, -25], [50, -16], [49, -12], [44, -16]],
  [[172, -34], [178, -38], [175, -41], [171, -44], [167, -46], [172, -41]],
  [[-24, 64], [-14, 64], [-14, 66], [-22, 66]],
  [[120, 18], [122, 18], [125, 12], [126, 7], [122, 7], [120, 14]],
  [[-85, 22], [-74, 20], [-78, 22], [-84, 23]],
];
let _earth = null, _clouds = null;
function earthTexture() {
  if (_earth) return _earth;
  const W = 2048, H = 1024, r = rng(17);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = lon => (lon + 180) / 360 * W, Y = lat => (90 - lat) / 180 * H;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, '#2c6fbf'); gr.addColorStop(0.5, '#2f86d8'); gr.addColorStop(1, '#2c6fbf');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '20,70,150' : '80,160,235'},0.06)`; g.beginPath(); g.ellipse(r() * W, r() * H, 20 + r() * 90, 10 + r() * 40, 0, 0, Math.PI * 2); g.fill(); }
  const path = poly => { g.beginPath(); poly.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); };
  g.lineJoin = 'round';
  // shallow water halo
  g.strokeStyle = 'rgba(110,200,240,0.55)'; g.lineWidth = 22; for (const p of LAND) { path(p); g.stroke(); }
  g.fillStyle = '#5aa846'; g.strokeStyle = '#3f8a36'; g.lineWidth = 5;
  for (const p of LAND) { path(p); g.fill(); g.stroke(); }
  // Hudson Bay, Black Sea, Caspian, Red Sea gulf hints
  g.fillStyle = '#2f86d8';
  for (const [lo, la, rx, ry] of [[-85, 59, 7, 5], [34, 43, 6, 2], [51, 41, 3, 5]]) { g.beginPath(); g.ellipse(X(lo), Y(la), rx / 360 * W, ry / 180 * H, 0, 0, Math.PI * 2); g.fill(); }
  // deserts and forests (clipped to land)
  g.save(); g.beginPath(); for (const p of LAND) { p.forEach(([lo, la], i) => i ? g.lineTo(X(lo), Y(la)) : g.moveTo(X(lo), Y(la))); g.closePath(); } g.clip();
  for (const [lo, la, rx, ry, col] of [[12, 24, 26, 9, '#d8c178'], [45, 23, 9, 7, '#d8c178'], [133, -25, 13, 8, '#d3a96a'], [-112, 34, 7, 6, '#c9b06b'], [90, 40, 20, 7, '#c4b07a'], [-65, -5, 14, 9, '#3f9a3a'], [20, 0, 10, 6, '#3c943a'], [100, 60, 40, 8, '#4f9a48']]) {
    const rg = g.createRadialGradient(X(lo), Y(la), 0, X(lo), Y(la), rx / 360 * W);
    rg.addColorStop(0, col); rg.addColorStop(1, col + '00');
    g.fillStyle = rg; g.beginPath(); g.ellipse(X(lo), Y(la), rx / 360 * W, ry / 180 * H, 0, 0, Math.PI * 2); g.fill();
  }
  for (let i = 0; i < 600; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,110,40' : '140,190,90'},0.12)`; g.beginPath(); g.arc(r() * W, r() * H, 4 + r() * 18, 0, Math.PI * 2); g.fill(); }
  g.restore();
  // ice
  g.fillStyle = '#f2f7fb';
  g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 32) g.lineTo(x, Y(-69 + Math.sin(x * 0.02) * 2 + Math.sin(x * 0.007) * 3)); g.lineTo(W, H); g.fill();
  g.globalAlpha = 0.9; path(LAND[1]); g.fill(); g.globalAlpha = 1;
  g.beginPath(); g.moveTo(0, 0); for (let x = 0; x <= W; x += 32) g.lineTo(x, Y(80 + Math.sin(x * 0.018) * 2)); g.lineTo(W, 0); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (_earth = t);
}
function cloudTexture() {
  if (_clouds) return _clouds;
  const W = 2048, H = 1024, r = rng(29);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const a = document.createElement('canvas'); a.width = W; a.height = H;
  const g = a.getContext('2d');
  for (let i = 0; i < 80; i++) {
    const x = r() * W, y = H * (0.12 + r() * 0.76), n = 3 + Math.floor(r() * 6), s = 8 + r() * 26;
    for (let k = 0; k < n; k++) { g.fillStyle = `rgba(255,255,255,${0.55 + r() * 0.35})`; g.beginPath(); g.ellipse(x + (r() - 0.5) * s * 5, y + (r() - 0.5) * s, s * (1 + r()), s * (0.5 + r() * 0.5), 0, 0, Math.PI * 2); g.fill(); }
  }
  const g2 = c.getContext('2d'); g2.filter = 'blur(5px)'; g2.drawImage(a, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return (_clouds = t);
}
// soft blue rim around the planet
function atmosphere(R) {
  const m = new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(0x9fd6ff) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 2.6); gl_FragColor = vec4(c*f*1.3, f); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(R * 1.045, 96, 48), m);
}
// root > tilt > spin > earth. clouds sit in tilt and turn on their own (the air).
export function makeGlobe(R = 1, { clouds = true, atmo = true, tilt = 0.41 } = {}) {
  const root = new THREE.Group(), tiltG = new THREE.Group(), spin = new THREE.Group();
  root.add(tiltG); tiltG.add(spin); tiltG.rotation.z = -tilt;
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), new THREE.MeshStandardMaterial({ map: earthTexture(), roughness: 0.55, metalness: 0 }));
  earth.castShadow = earth.receiveShadow = true;
  spin.add(earth);
  let cl = null;
  if (clouds) {
    cl = new THREE.Mesh(new THREE.SphereGeometry(R * 1.018, 128, 64), new THREE.MeshStandardMaterial({ map: cloudTexture(), transparent: true, depthWrite: false, roughness: 1 }));
    tiltG.add(cl);
  }
  if (atmo) root.add(atmosphere(R));
  return { root, tilt: tiltG, spin, earth, clouds: cl, R };
}

// ---------------- arrows ----------------
export function arrowMat(color) { return new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, roughness: 0.4 }); }
// straight arrow pointing +x, origin at the tail. set(k) grows it (0..1)
export function arrow3(color = 0xffd23a, len = 1, r = 0.04) {
  const g = new THREE.Group(), mat = arrowMat(color);
  const shaft = mesh(new THREE.CylinderGeometry(r, r, 1, 16), mat, [0, 0, 0], [0, 0, -Math.PI / 2]);
  const head = mesh(new THREE.ConeGeometry(r * 2.4, r * 5, 20), mat, [0, 0, 0], [0, 0, -Math.PI / 2]);
  g.add(shaft, head); shadow(g);
  g.set = (k) => {
    const L = Math.max(0.0001, len * k), hl = Math.min(r * 5, L);
    shaft.scale.set(1, Math.max(0.0001, L - hl), 1); shaft.position.x = (L - hl) / 2;
    head.scale.setScalar(Math.max(0.0001, Math.min(1, k * 3))); head.position.x = L - hl / 2;
    g.visible = k > 0.001;
  };
  g.set(1);
  return g;
}
// curved arrow along a circle of latitude: radius rr, height y, from angle a0 growing to a1 (east = increasing angle)
export function arcArrow(rr, y, a0, a1, color, r = 0.025) {
  const N = 64, pts = [];
  for (let i = 0; i <= N; i++) { const a = a0 + (a1 - a0) * i / N; pts.push(V(rr * Math.sin(a), y, rr * Math.cos(a))); }
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.TubeGeometry(curve, N, r, 10, false);
  const mat = arrowMat(color);
  const tube = new THREE.Mesh(geo, mat);
  const head = new THREE.Mesh(new THREE.ConeGeometry(r * 2.6, r * 6, 20), mat);
  const g = new THREE.Group(); g.add(tube, head); shadow(g);
  const perSeg = 10 * 6;
  g.set = (k) => {
    k = clamp(k);
    g.visible = k > 0.01;
    const segs = Math.max(1, Math.floor(N * k));
    geo.setDrawRange(0, segs * perSeg);
    const a = a0 + (a1 - a0) * (segs / N);
    head.position.set(rr * Math.sin(a), y, rr * Math.cos(a));
    const tan = V(Math.cos(a), 0, -Math.sin(a)).multiplyScalar(Math.sign(a1 - a0));
    head.quaternion.setFromUnitVectors(V(0, 1, 0), tan);
    head.position.addScaledVector(tan, r * 2.5);
  };
  g.set(1);
  return g;
}

// ---------------- speed gauge ----------------
export function gauge() {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const ang = v => (225 - 270 * v / 2000) * Math.PI / 180;
  function draw(v) {
    const cx = S / 2, cy = S / 2;
    const bg = g.createRadialGradient(cx, cy * 0.8, 50, cx, cy, S / 2);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(1, '#dfe6ee');
    g.fillStyle = bg; g.fillRect(0, 0, S, S);
    // red zone
    g.lineWidth = 46; g.strokeStyle = '#ff4a3d'; g.beginPath(); g.arc(cx, cy, 400, -ang(1500), -ang(2000)); g.stroke();
    g.strokeStyle = '#1e2a3a'; g.fillStyle = '#1e2a3a'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = 0; k <= 40; k++) {
      const vv = k * 50, a = ang(vv), big = k % 10 === 0, mid = k % 5 === 0;
      const r0 = big ? 350 : mid ? 372 : 388, r1 = 424;
      g.lineWidth = big ? 12 : mid ? 7 : 4;
      g.beginPath(); g.moveTo(cx + r0 * Math.cos(a), cy - r0 * Math.sin(a)); g.lineTo(cx + r1 * Math.cos(a), cy - r1 * Math.sin(a)); g.stroke();
      if (big) { g.font = '700 64px Cap, sans-serif'; g.fillText(String(vv), cx + 280 * Math.cos(a), cy - 280 * Math.sin(a)); }
    }
    g.font = '700 50px Cap, sans-serif'; g.fillStyle = '#5a6878'; g.fillText('km/h', cx, cy + 150);
    g.fillStyle = '#1e2a3a'; g.beginPath(); g.roundRect(cx - 230, cy + 210, 460, 140, 28); g.fill();
    g.font = '700 104px Cap, sans-serif'; g.fillStyle = '#ffd23a';
    g.fillText(Math.round(v).toLocaleString('en-US'), cx, cy + 284);
    tex.needsUpdate = true;
  }
  const root = new THREE.Group();
  const face = mesh(new THREE.CircleGeometry(1, 128), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }), [0, 0, 0.04]);
  const bez = mesh(new THREE.TorusGeometry(1.0, 0.075, 24, 128), new THREE.MeshPhysicalMaterial({ color: 0xc8ccd2, metalness: 1, roughness: 0.25, clearcoat: 0.5 }), [0, 0, 0.05]);
  const back = mesh(new THREE.CylinderGeometry(1.06, 1.1, 0.16, 96), std(0x2a2f38, { roughness: 0.4 }), [0, 0, -0.06], [Math.PI / 2, 0, 0]);
  const needleP = new THREE.Group(); needleP.position.z = 0.08;
  const nmat = new THREE.MeshStandardMaterial({ color: 0xff2e2e, emissive: 0xff2e2e, emissiveIntensity: 0.4, roughness: 0.3 });
  const nshape = new THREE.Shape(); nshape.moveTo(-0.14, -0.035); nshape.lineTo(0.86, -0.008); nshape.lineTo(0.86, 0.008); nshape.lineTo(-0.14, 0.035); nshape.closePath();
  needleP.add(mesh(new THREE.ExtrudeGeometry(nshape, { depth: 0.02, bevelEnabled: false }), nmat));
  const capm = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 32), std(0x1e2a3a, { metalness: 0.6, roughness: 0.3 }), [0, 0, 0.12], [Math.PI / 2, 0, 0]);
  root.add(face, bez, back, needleP, capm); shadow(root);
  // glass
  root.add(mesh(new THREE.CircleGeometry(1, 96), new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.05, clearcoat: 1, depthWrite: false }), [0, 0, 0.16]));
  root.set = (v) => { needleP.rotation.z = ang(v); draw(v); };
  root.set(0);
  return root;
}

// ---------------- people ----------------
const MAT = {};
function mats() {
  if (MAT.shirt) return MAT;
  MAT.shirt = new THREE.MeshStandardMaterial({ color: 0x2f6fd6, roughness: 0.85 });
  MAT.jeans = new THREE.MeshStandardMaterial({ color: 0x3a4a66, roughness: 0.9 });
  MAT.shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  MAT.sole = new THREE.MeshStandardMaterial({ color: 0x30343a, roughness: 0.7 });
  return MAT;
}
// a person in a blue t-shirt, jeans and white sneakers
// StickSolid: the person is Solid (blue T-shirt to the hips, jeans, white shoes, big friendly eyes)
export function person() { const h = makeSolid(); const sf = h.setFace; h.setFace = (f) => sf({ ...f, eyes: 1.35 }); return h; }
export function lerpFace(a, b, k) { return blendExpr(a, b, k); }
// the old face presets, mapped to the 12 StickSolid expressions
export const FACE = {
  calm: EXPR.sorriso.solid, surprised: EXPR.whoa.solid, smug: EXPR.furbo.solid, scared: EXPR.paura.solid,
  worried: EXPR.preoccupato.solid, relieved: { ...EXPR.sorriso.solid, lid: 0.4 }, curious: EXPR.dubbio.solid,
};

// ---------------- scenery ----------------
export function tree(h = 3, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trunk = mesh(new THREE.CylinderGeometry(0.09 * h / 3, 0.14 * h / 3, h * 0.55, 12), std(0x7a5232, { roughness: 0.9 }), [0, h * 0.275, 0]);
  g.add(trunk);
  const top = new THREE.Group(); top.position.y = h * 0.5; g.add(top);
  const leaf = std([0x4f9a3c, 0x5aa846, 0x468c36][Math.floor(r() * 3)], { roughness: 0.8 });
  for (let i = 0; i < 4; i++) top.add(mesh(new THREE.SphereGeometry(h * (0.2 + r() * 0.08), 20, 14), leaf, [(r() - 0.5) * h * 0.3, h * (0.12 + r() * 0.22), (r() - 0.5) * h * 0.25]));
  g.top = top;
  return shadow(g);
}
export function house(color = 0xf1e3c8, roof = 0xc0533a) {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(2.4, 1.8, 2), std(color, { roughness: 0.9 }), [0, 0.9, 0]));
  const rf = mesh(new THREE.ConeGeometry(1.9, 1.1, 4), std(roof, { roughness: 0.8 }), [0, 2.35, 0], [0, Math.PI / 4, 0]); rf.scale.set(1, 1, 0.82); g.add(rf);
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.9, 0.05), std(0x6a4a30), [0.3, 0.45, 1.01]));
  for (const x of [-0.65, 0.95]) g.add(mesh(new THREE.BoxGeometry(0.42, 0.42, 0.05), std(0x9fd0f0, { roughness: 0.2, metalness: 0.2 }), [x, 1.15, 1.01]));
  return shadow(g);
}
export function car(color = 0xe0443a) {
  const g = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1 });
  const glass = std(0x22303f, { roughness: 0.1, metalness: 0.5 });
  const tire = std(0x1d1e21, { roughness: 0.8 }), rim = std(0xc9ccd1, { metalness: 0.9, roughness: 0.3 });
  const body = mesh(new RoundedBox(3.8, 0.7, 1.7, 0.18), paint, [0, 0.6, 0]); g.add(body);
  g.add(mesh(new RoundedBox(2.0, 0.62, 1.5, 0.2), paint, [-0.25, 1.15, 0]));
  g.add(mesh(new THREE.BoxGeometry(1.86, 0.44, 1.52), glass, [-0.25, 1.16, 0]));
  for (const x of [-1.2, 1.2]) for (const z of [-0.82, 0.82]) {
    g.add(mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 24), tire, [x, 0.36, z], [Math.PI / 2, 0, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 16), rim, [x, 0.36, z], [Math.PI / 2, 0, 0]));
  }
  for (const z of [-0.6, 0.6]) g.add(mesh(new THREE.BoxGeometry(0.05, 0.14, 0.3), glowMat(0xfff4c0), [1.91, 0.7, z]));
  return shadow(g);
}
class RoundedBox extends THREE.BoxGeometry {
  constructor(w, h, d, r) {
    super(w, h, d, 8, 8, 8);
    const p = this.attributes.position, v = new THREE.Vector3();
    const hx = w / 2 - r, hy = h / 2 - r, hz = d / 2 - r;
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      const c = V(clamp(v.x, -hx, hx), clamp(v.y, -hy, hy), clamp(v.z, -hz, hz));
      const n = v.clone().sub(c); if (n.lengthSq() > 0) n.normalize().multiplyScalar(r);
      p.setXYZ(i, c.x + n.x, c.y + n.y, c.z + n.z);
    }
    this.computeVertexNormals();
  }
}
export function cone() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(0.2, 0.7, 24), std(0xff6a1a, { roughness: 0.5 }), [0, 0.38, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.115, 0.15, 0.12, 24), std(0xffffff), [0, 0.38, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), std(0xff6a1a), [0, 0.02, 0]));
  return shadow(g);
}
export function bin() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.32, 0.27, 0.95, 24), std(0x2f8a4a, { roughness: 0.5 }), [0, 0.48, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.08, 24), std(0x256e3b), [0, 0.98, 0]));
  return shadow(g);
}
export function bench() {
  const g = new THREE.Group(), w = std(0xb8804a, { roughness: 0.8 }), m = std(0x30343a, { metalness: 0.7, roughness: 0.4 });
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.BoxGeometry(1.6, 0.05, 0.13), w, [0, 0.45, -0.18 + i * 0.16]));
  for (let i = 0; i < 2; i++) g.add(mesh(new THREE.BoxGeometry(1.6, 0.13, 0.05), w, [0, 0.62 + i * 0.17, -0.27]));
  for (const x of [-0.7, 0.7]) { g.add(mesh(new THREE.BoxGeometry(0.06, 0.45, 0.45), m, [x, 0.22, -0.05])); g.add(mesh(new THREE.BoxGeometry(0.06, 0.45, 0.05), m, [x, 0.65, -0.28])); }
  return shadow(g);
}
export function mailbox() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.BoxGeometry(0.55, 0.7, 0.45), std(0x2457b8, { roughness: 0.4 }), [0, 0.75, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.275, 0.275, 0.45, 24, 1, false, 0, Math.PI), std(0x2457b8, { roughness: 0.4 }), [0, 1.1, 0], [Math.PI / 2, Math.PI / 2, 0]));
  for (const x of [-0.22, 0.22]) g.add(mesh(new THREE.BoxGeometry(0.06, 0.4, 0.06), std(0x1b3f86), [x, 0.2, 0]));
  return shadow(g);
}
export function lamppost() {
  const g = new THREE.Group(), m = std(0x3a3f47, { metalness: 0.7, roughness: 0.35 });
  g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 4.2, 16), m, [0, 2.1, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.25, 16), m, [0, 0.12, 0]));
  g.add(mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), m, [-0.42, 4.15, 0]));
  g.add(mesh(new THREE.CylinderGeometry(0.08, 0.22, 0.22, 16), m, [-0.82, 4.05, 0]));
  return shadow(g);
}
export function jet() {
  const g = new THREE.Group();
  const white = new THREE.MeshPhysicalMaterial({ color: 0xf4f6f8, roughness: 0.3, clearcoat: 0.8 });
  const blue = std(0x1f5fbf, { roughness: 0.4 }), dark = std(0x1a2230, { roughness: 0.2 }), grey = std(0xb7bcc4, { metalness: 0.7, roughness: 0.35 });
  const fus = mesh(new THREE.CapsuleGeometry(0.55, 6.5, 12, 32), white, [0, 0, 0], [0, 0, -Math.PI / 2]); g.add(fus);
  g.add(mesh(new THREE.CapsuleGeometry(0.56, 6.0, 4, 32, 1), blue, [-0.2, -0.12, 0], [0, 0, -Math.PI / 2], [1, 1, 1.0]));
  g.children[1].scale.set(0.98, 1, 0.98); g.children[1].position.y = -0.04;
  for (let i = 0; i < 16; i++) for (const z of [-0.5, 0.5]) g.add(mesh(new THREE.BoxGeometry(0.16, 0.18, 0.06), dark, [-2.2 + i * 0.32, 0.2, z]));
  g.add(mesh(new THREE.SphereGeometry(0.3, 16, 12), dark, [3.55, 0.18, 0], [0, 0, 0], [0.8, 0.5, 1.5]));
  const wing = new THREE.Shape(); wing.moveTo(0.8, 0); wing.lineTo(-0.6, 3.6); wing.lineTo(-1.2, 3.6); wing.lineTo(-1.0, 0); wing.closePath();
  for (const s of [-1, 1]) {
    const w = mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.1, bevelEnabled: false }), white, [0.2, -0.25, 0], [s * Math.PI / 2, 0, 0]); w.scale.z = 1; g.add(w);
    g.add(mesh(new THREE.CylinderGeometry(0.28, 0.24, 1.0, 20), grey, [0.6, -0.55, s * 1.3], [0, 0, -Math.PI / 2]));
    g.add(mesh(new THREE.CircleGeometry(0.25, 20), dark, [1.11, -0.55, s * 1.3], [0, Math.PI / 2, 0]));
    const st = mesh(new THREE.ExtrudeGeometry(wing, { depth: 0.06, bevelEnabled: false }), white, [-3.4, 0.2, 0], [s * Math.PI / 2, 0, 0]); st.scale.set(0.5, 0.42, 1); g.add(st);
  }
  const fin = new THREE.Shape(); fin.moveTo(0, 0); fin.lineTo(-1.2, 1.9); fin.lineTo(-1.8, 1.9); fin.lineTo(-1.6, 0); fin.closePath();
  g.add(mesh(new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: false }), blue, [-2.6, 0.3, -0.04]));
  return shadow(g);
}
// giant wave: an extruded crest profile, foam and spray handled by the shot
export function waveMesh(depth = 60) {
  const s = new THREE.Shape();
  const P = [[-40, -0.6], [-40, 0], [-20, 0.2], [-11, 1.0], [-6.5, 3.0], [-3.6, 5.8], [-1.6, 7.6], [0.2, 8.4], [1.7, 8.1], [2.6, 7.2], [2.5, 6.4], [1.9, 6.1], [1.6, 6.6], [0.9, 6.5], [0.2, 5.6], [-0.2, 4.0], [0.1, 2.3], [0.9, 1.0], [2.2, 0.25], [4, 0.0], [4, -0.6]];
  s.moveTo(P[0][0], P[0][1]); s.lineTo(P[1][0], P[1][1]);
  s.splineThru(P.slice(2, -2).map(([x, y]) => new THREE.Vector2(x, y)));
  s.lineTo(P[P.length - 2][0], P[P.length - 2][1]); s.lineTo(P[P.length - 1][0], P[P.length - 1][1]); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 80, steps: 1 });
  geo.translate(0, 0, -depth / 2);
  const p = geo.attributes.position, col = new Float32Array(p.count * 3);
  const deep = new THREE.Color(0x0b4f96), mid = new THREE.Color(0x1f86d0), light = new THREE.Color(0x63d6ee), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), x = p.getX(i);
    const k = clamp(y / 8.4);
    c.copy(deep).lerp(mid, clamp(k * 1.6)).lerp(light, clamp((k - 0.55) * 2.2) * clamp((x + 2) / 3));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.05, emissive: 0x0a3a66, emissiveIntensity: 0.25 }));
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function poleMarker() {
  const c = document.createElement('canvas'); c.width = 64; c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#ffffff' : '#e23a32'; g.save(); g.translate(0, i * 32); g.transform(1, -0.5, 0, 1, 0, 0); g.fillRect(0, 0, 64, 32); g.fillRect(0, 32, 64, 32); g.restore(); }
  g.fillStyle = '#e23a32'; for (let i = 0; i < 16; i += 2) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(64, i * 32 - 32); g.lineTo(64, i * 32); g.lineTo(0, i * 32 + 32); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const gr = new THREE.Group();
  gr.add(mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 24), new THREE.MeshStandardMaterial({ map: t, roughness: 0.4 }), [0, 1.0, 0]));
  gr.add(mesh(new THREE.SphereGeometry(0.15, 24, 16), new THREE.MeshPhysicalMaterial({ color: 0xffd23a, metalness: 0.8, roughness: 0.2 }), [0, 2.1, 0]));
  return shadow(gr);
}
let _soft = null;
export function softSprite(color = 0xffffff, size = 1, opacity = 1) {
  _soft = _soft || glowTexture();
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _soft, color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(size); return s;
}
// white streak lines, for wind and speed: n thin boxes; .update(t, fn) where fn(i, t) -> {p, len, a}
export function streaks(n, color = 0xffffff, thick = 0.012) {
  const g = new THREE.Group(); g.list = [];
  for (let i = 0; i < n; i++) {
    const m = mesh(new THREE.BoxGeometry(1, thick, thick), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
    g.add(m); g.list.push(m);
  }
  return g;
}
