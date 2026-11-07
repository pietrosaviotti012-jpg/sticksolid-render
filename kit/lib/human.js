import * as THREE from 'three';
import { materials } from './materials.js';

// ---------- torso profile (radius by height in spine space) ----------
const KEYS = [
  [-0.16, 0.150], [-0.08, 0.165], [0.0, 0.160], [0.10, 0.148], [0.20, 0.160],
  [0.30, 0.178], [0.40, 0.188], [0.46, 0.180], [0.51, 0.150], [0.55, 0.100], [0.58, 0.055],
];
// StickSolid: Catmull-Rom through the keys. The original smoothstep went flat at every key, and each flat ring
// caught the light as a horizontal stripe across the shirt.
export function torsoR(y) {
  if (y <= KEYS[0][0]) return KEYS[0][1];
  const n = KEYS.length;
  for (let i = 0; i < n - 1; i++) {
    const [y0, r0] = KEYS[i], [y1, r1] = KEYS[i + 1];
    if (y <= y1) {
      const t = (y - y0) / (y1 - y0);
      const rm = i > 0 ? KEYS[i - 1][1] : r0, rp = i + 2 < n ? KEYS[i + 2][1] : r1;
      const m0 = (r1 - rm) / 2, m1 = (rp - r0) / 2;
      const t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * r0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * r1 + (t3 - t2) * m1;
    }
  }
  return KEYS[n - 1][1];
}
export const TORSO_SX = 1.13, TORSO_SZ = 0.66;

// Lathe shell following the torso. offset(y) can be number or function.
export function torsoShell(y0, y1, offset, { ridge = 0, segs = 72, rows = 40, flare = 0 } = {}) {
  const pts = [];
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * (i / rows);
    const off = typeof offset === 'function' ? offset(y) : offset;
    const f = flare ? flare * Math.max(0, (y0 + 0.12 - y) / 0.12) ** 2 : 0;
    pts.push(new THREE.Vector2(torsoR(y) + off + f, y));
  }
  const g = new THREE.LatheGeometry(pts, segs, Math.PI, Math.PI * 2);
  g.scale(TORSO_SX, 1, TORSO_SZ);
  if (ridge) {
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i), y = p.getY(i);
      if (z > 0) {
        const k = Math.exp(-((x / 0.045) ** 2)) * Math.min(1, z / 0.08);
        const yk = Math.min(1, Math.max(0, (y - y0) / 0.1)) * Math.min(1, Math.max(0, (y1 - y) / 0.08));
        p.setZ(i, z + ridge * k * yk);
      }
    }
  }
  g.computeVertexNormals();
  return g;
}

// thick rim along the edge of a shell at height y
function rim(y, offset, tube, mat) {
  const r = torsoR(y) + offset;
  const g = new THREE.TorusGeometry(r, tube, 8, 72);
  g.rotateX(Math.PI / 2);
  g.scale(TORSO_SX, 1, TORSO_SZ);
  const m = new THREE.Mesh(g, mat);
  m.position.y = y;
  return m;
}

function cap(r, len, mat, seg = 20) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, seg), mat);
  m.position.y = -len / 2;
  m.castShadow = m.receiveShadow = true;
  return m;
}
function sph(r, mat, pos = [0, 0, 0], scl = [1, 1, 1], seg = 32) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.75)), mat);
  m.position.set(...pos); m.scale.set(...scl);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function shadowAll(o) { o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } }); }

// ---------- head ----------
// StickSolid look (for the secondary characters): { hair: 'quiff' | 'short' | 'long' | 'pony' | 'bun' | 'bald',
//   hairColor, beard (default true), beardColor, glasses }. Materials are cloned when recoloured, so one
//   character never repaints the others.
function buildHead(M, { helmet = false, hood = false, look = {} } = {}) {
  const head = new THREE.Group();
  const hairStyle = look.hair || 'quiff';
  const hairM = look.hairColor ? Object.assign(M.hair.clone(), {}) : M.hair;
  if (look.hairColor) hairM.color = new THREE.Color(look.hairColor);
  const beardM = (look.beardColor || look.hairColor) ? M.beard.clone() : M.beard;
  if (look.beardColor || look.hairColor) beardM.color = new THREE.Color(look.beardColor || look.hairColor);
  const jaw = new THREE.Group(); jaw.position.set(0, 0.06, 0.0); head.add(jaw);
  const parts = {};
  if (helmet) {
    const h = sph(0.128, M.steel, [0, 0.1, 0], [0.92, 1.12, 1.02], 48);
    head.add(h);
    // visor slit + face plate
    const plate = new THREE.Mesh(new THREE.SphereGeometry(0.131, 48, 24, -0.9, 1.8, 0.9, 1.3), M.steelDark);
    plate.scale.set(0.92, 1.12, 1.04); plate.position.y = 0.1; head.add(plate);
    const slit = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.012, 0.03), M.mouth);
    slit.position.set(0, 0.12, 0.128); head.add(slit);
    const crest = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.26), M.steel);
    crest.position.set(0, 0.235, -0.01); head.add(crest);
    for (let i = 0; i < 7; i++) { // breaths holes
      const d = sph(0.005, M.mouth, [-0.04 + i * 0.013, 0.06, 0.135]); head.add(d);
    }
    shadowAll(head);
    return { head, jaw, setMouth() {} };
  }
  const skull = sph(0.1, M.skin, [0, 0.095, 0], [0.88, 1.1, 1.0], 48); head.add(skull);
  const cheeks = sph(0.08, M.skin, [0, 0.06, 0.022], [1.05, 0.85, 1.0], 40); head.add(cheeks);
  const chin = sph(0.05, M.skin, [0, -0.04, 0.06], [1.0, 0.9, 0.85], 32); jaw.add(chin);
  const jawM = sph(0.07, M.skin, [0, -0.02, 0.02], [1.08, 0.75, 1.0], 32); jaw.add(jawM);
  // nose
  head.add(sph(0.018, M.skin, [0, 0.083, 0.104], [0.85, 2.0, 1.15]));
  head.add(sph(0.019, M.skin, [0, 0.064, 0.111], [1.25, 0.95, 1.1]));
  head.add(sph(0.009, M.skin, [-0.012, 0.064, 0.1], [1, 0.8, 1]));
  head.add(sph(0.009, M.skin, [0.012, 0.064, 0.1], [1, 0.8, 1]));
  // eyes
  parts.eyes = [];
  for (const s of [-1, 1]) {
    const ew = sph(0.0158, M.eyeWhite, [s * 0.035, 0.11, 0.079]); head.add(ew);
    const ir = sph(0.0085, M.iris, [s * 0.035, 0.11, 0.0915], [1, 1, 0.5]); head.add(ir);
    const pu = sph(0.0042, M.mouth, [s * 0.035, 0.11, 0.0948], [1, 1, 0.4]); head.add(pu);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.0168, 24, 12, 0, Math.PI * 2, 0, 1.25), M.skin);
    lid.position.set(s * 0.035, 0.11, 0.079); lid.rotation.x = 0.25; head.add(lid);
    for (const m of [ew, ir, pu, lid]) parts.eyes.push({ m, c: new THREE.Vector3(s * 0.035, 0.11, 0.079), p0: m.position.clone(), s0: m.scale.clone() });
    parts['lid' + s] = lid;
    const brow = new THREE.Mesh(new THREE.CapsuleGeometry(0.0042, 0.032, 4, 8), hairM);
    brow.scale.z = 0.6; brow.rotation.z = Math.PI / 2 + s * 0.12; brow.position.set(s * 0.036, 0.134, 0.093); head.add(brow);
    parts['brow' + s] = brow;
    head.add(sph(0.024, M.skin, [s * 0.087, 0.098, -0.005], [0.38, 1, 0.7]));
  }
  // hair (cap) + sideburns
  if (hairStyle === 'bald') {
    // only a fringe around the back and over the ears
    const fr = new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 10, 40, Math.PI * 1.25), hairM);
    fr.rotation.set(Math.PI / 2 - 0.25, 0, Math.PI * 0.625 + Math.PI); fr.position.set(0, 0.1, -0.01); fr.scale.set(1, 1.15, 1); head.add(fr);
  } else {
    const hairG = new THREE.SphereGeometry(0.106, 48, 24, 0, Math.PI * 2, 0, 1.45);
    const hair = new THREE.Mesh(hairG, hairM);
    hair.scale.set(0.9, 1.1, 1.02); hair.position.set(0, 0.103, -0.006); hair.rotation.x = -0.42; head.add(hair);
  }
  if (hairStyle === 'quiff') { const quiff = sph(0.07, hairM, [0.01, 0.19, 0.035], [1.1, 0.55, 0.9]); quiff.rotation.z = -0.2; head.add(quiff); }
  if (['long', 'pony', 'bun'].includes(hairStyle)) {
    const bangs = sph(0.07, hairM, [-0.012, 0.172, 0.05], [1.3, 0.42, 0.85]); bangs.rotation.z = 0.25; head.add(bangs);
  }
  if (hairStyle === 'long') {
    head.add(sph(0.108, hairM, [0, 0.04, -0.04], [0.98, 1.55, 0.72]));                       // the fall at the back
    for (const s of [-1, 1]) head.add(sph(0.032, hairM, [s * 0.088, 0.04, 0.005], [0.6, 2.1, 0.9]));   // locks by the face
  }
  if (hairStyle === 'pony') { const p = sph(0.036, hairM, [0.1, 0.07, -0.06], [0.85, 2.2, 0.85]); p.rotation.set(0.2, 0, 0.35); head.add(p); head.add(sph(0.028, hairM, [0.085, 0.15, -0.065])); }
  if (hairStyle === 'bun') head.add(sph(0.046, hairM, [0, 0.215, -0.055]));
  for (const s of [-1, 1]) head.add(sph(0.02, hairM, [s * 0.083, 0.118, -0.002], [0.32, 1.3, 0.9]));
  // goatee + moustache (none for women and children: look.beard = false)
  const beard = look.beard !== false;
  if (beard) jaw.add(sph(0.02, beardM, [0, -0.055, 0.088], [1.0, 1.1, 0.45]));
  const mst = new THREE.Mesh(new THREE.CapsuleGeometry(0.0055, 0.042, 4, 8), beardM);
  mst.scale.z = 0.6; mst.rotation.z = Math.PI / 2; mst.position.set(0, 0.043, 0.104); head.add(mst);
  mst.visible = beard; parts.mst = mst;
  // stubble shell on jaw
  if (beard) {
    const stub = sph(0.071, beardM, [0, -0.02, 0.022], [1.09, 0.76, 1.01], 32);
    stub.material = beardM.clone(); stub.material.transparent = true; stub.material.opacity = look.fullBeard ? 0.85 : 0.2;
    jaw.add(stub);
  }
  // glasses: two round rims and a bridge, wide enough for the mascot's bigger eyes
  if (look.glasses) {
    const rimM = new THREE.MeshStandardMaterial({ color: look.glassesColor || 0x222026, roughness: 0.4, metalness: 0.3 });
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.003, 8, 32), rimM); r.position.set(s * 0.036, 0.11, 0.1); head.add(r); }
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.018, 8), rimM); br.rotation.z = Math.PI / 2; br.position.set(0, 0.113, 0.106); head.add(br);
  }
  // mouth
  const mouth = sph(0.02, M.mouth, [0, 0.026, 0.097], [1.1, 0.1, 0.45]); head.add(mouth);
  const lipU = sph(0.02, M.lip, [0, 0.031, 0.099], [1.1, 0.16, 0.42]); head.add(lipU);
  const lipL = sph(0.019, M.lip, [0, 0.019, 0.096], [1.0, 0.2, 0.42]); jaw.add(lipL); lipL.position.y -= 0.06;
  const teeth = sph(0.016, M.teeth, [0, 0.03, 0.093], [1.2, 0.3, 0.4]); head.add(teeth);
  if (hood) {
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.135, 48, 24, 0, Math.PI * 2, 0, 2.0), M.cloth);
    hd.scale.set(0.95, 1.12, 1.08); hd.position.set(0, 0.095, -0.025); hd.rotation.x = -0.75; head.add(hd);
  }
  // StickSolid: a friendly smile (a thin arc), hidden until setFace asks for it
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0048, 10, 32, Math.PI), M.mouth);
  smile.rotation.z = Math.PI; smile.position.set(0, 0.056, 0.098); smile.scale.set(1, 0.85, 1.6); smile.visible = false;
  // the half smile: a shorter arc that rises on one side only
  const smirk = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.0048, 10, 32, Math.PI), M.mouth);
  smirk.rotation.z = Math.PI + 0.24; smirk.position.set(0.008, 0.04, 0.099); smirk.scale.set(0.82, 0.42, 1.6); smirk.visible = false;
  head.add(smirk); parts.smirk = smirk;
  head.add(smile); parts.smile = smile; parts.mouth = mouth; parts.lipU = lipU; parts.lipL = lipL; parts.teeth = teeth;
  shadowAll(head);
  function setMouth(v) {
    jaw.rotation.x = v * 0.22;
    mouth.scale.set(1.1 + v * 0.4, 0.1 + v * 1.7, 0.45);
    mouth.position.y = 0.026 - v * 0.012;
    teeth.visible = v > 0.15; teeth.position.y = 0.03 + v * 0.002;
    lipU.position.y = 0.032 + v * 0.004;
    parts.mst.position.y = 0.043 + v * 0.004;
    parts['brow-1'].position.y = parts['brow1'].position.y = 0.136 - v * 0.006;
    parts['brow-1'].rotation.z = Math.PI / 2 - 0.18 - v * 0.25;
    parts['brow1'].rotation.z = Math.PI / 2 + 0.18 + v * 0.25;
    for (const s of [-1, 1]) parts['lid' + s].rotation.x = 0.25 + v * 0.9;
  }
  // StickSolid setFace: the default face reads as angry (brows pinched, lids low).
  // brow: how high the brows sit (0 rest, 1 surprised); tilt: >0 friendly (inner ends up), <0 angry;
  // lid: 0 rest, 1 eyes wide open; smile: show the arc smile instead of the flat mouth; open: mouth open 0..1
  // eyes: size of the eyes (1 = as built; the mascot uses about 1.3 so it reads friendly when small)
  // one: -1 or 1 raises just that brow (doubt, "hmm"); 0 none
  // grin: size of the smile arc (1 normal, about 1.5 for a laugh)
  // mouth: 'smile' | 'frown' (sad arc) | 'smirk' (half smile to one side) | 'flat' (closed lips); default from `smile`
  // look: [x, y] where the pupils point, -1..1 (y > 0 looks down, like the stickman)
  // lid below 0 closes the eyes part way (tired, sly, sad)
  function setFace({ brow = 0.5, tilt = 0.6, lid = 0.7, smile = true, open = 0, eyes = 1, one = 0, grin = 1, mouth, look = [0, 0] } = {}) {
    setMouth(open);
    const m = open >= 0.15 ? 'open' : (mouth || (smile ? 'smile' : 'flat'));
    const arc = parts.smile;
    arc.rotation.z = Math.PI; arc.position.set(0, 0.056 - (grin - 1) * 0.01, 0.098); arc.scale.set(grin, 0.85 * grin, 1.6);
    if (m === 'frown') { arc.rotation.z = 0; arc.position.set(0, 0.006, 0.097); arc.scale.set(0.85, 0.6, 1.6); }
    parts.smirk.visible = m === 'smirk';
    eyesAt(eyes, look);
    for (const s of [-1, 1]) {
      parts['brow' + s].position.y = 0.134 + brow * 0.014 + (one === s ? 0.016 : 0);
      parts['brow' + s].rotation.z = Math.PI / 2 - s * 0.12 * tilt * 2;
      parts['lid' + s].rotation.x = 0.25 - lid * 0.75 + open * 0.2;
    }
    const sm = m === 'smile' || m === 'frown' || m === 'smirk';
    arc.visible = m === 'smile' || m === 'frown';
    for (const k of ['mouth', 'lipU', 'lipL']) parts[k].visible = !sm;
    if (sm) parts.teeth.visible = false;
  }
  function eyesAt(k, look) {
    parts.eyes.forEach((e, i) => {
      e.m.position.copy(e.p0).sub(e.c).multiplyScalar(k).add(e.c); e.m.scale.copy(e.s0).multiplyScalar(k);
      if (i % 4 === 1 || i % 4 === 2) { e.m.position.x += look[0] * 0.0062 * k; e.m.position.y -= look[1] * 0.0058 * k; }
    });
  }
  return { head, jaw, setMouth, setFace, parts };
}

function fist(M, mat, side) {
  const g = new THREE.Group();
  g.add(sph(0.045, mat, [0, -0.055, 0.005], [0.85, 1.05, 0.62]));
  for (let i = 0; i < 4; i++) g.add(sph(0.014, mat, [-0.027 + i * 0.018, -0.1, 0.022], [1, 1, 1.2]));
  const th = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8), mat);
  th.position.set(side * -0.03, -0.06, 0.03); th.rotation.set(0.6, 0, side * 0.5); g.add(th);
  shadowAll(g);
  return g;
}

// ---------- full character ----------
// outfit: 'vest' | 'chainmail' | 'plate' | 'knight' | 'archer'
export function makeHuman(outfit = 'plate', opts = {}) {
  const M = materials();
  const knight = outfit === 'knight';
  const limbMat = knight ? M.steel : (outfit === 'archer' ? M.clothGrey : M.cloth);
  const legMat = knight ? M.steel : M.cloth;
  const handMat = knight ? M.steelDark : M.skin;
  const thick = knight ? 0.014 : 0;

  const root = new THREE.Group();
  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; root.add(pelvis);
  const spine = new THREE.Group(); pelvis.add(spine);
  const chest = new THREE.Group(); chest.position.y = 0.2; spine.add(chest); // upper spine pivot
  const j = { root, pelvis, spine, chest };

  // body: lower torso on spine, upper torso on chest (both lathe pieces)
  const bodyMat = knight ? M.steel : (outfit === 'archer' ? M.cloth : M.cloth);
  const lower = new THREE.Mesh(torsoShell(-0.18, 0.2, 0), bodyMat); spine.add(lower);
  const upperG = torsoShell(0.18, 0.58, 0); upperG.translate(0, -0.2, 0);
  const upper = new THREE.Mesh(upperG, bodyMat); chest.add(upper);

  // neck + head
  const neck = new THREE.Group(); neck.position.y = 0.36; chest.add(neck);
  const neckM = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.12, 24), knight ? M.steelDark : M.skin);
  neckM.position.y = 0.04; neck.add(neckM);
  const H = buildHead(M, { helmet: knight, hood: outfit === 'archer', look: opts.look || {} });
  H.head.position.y = 0.085; neck.add(H.head);
  j.neck = neck; j.head = H.head;

  // StickSolid opts.uniform: thicker arms and legs, joints the same width as the limbs (no balls at the
  // shoulders, no bumps at knees and elbows), bigger hands and feet, so the body reads as one shape
  const U = opts.uniform ? { arm: 1.32, leg: 1.22, hand: 1.25, foot: 1.2 } : { arm: 1, leg: 1, hand: 1, foot: 1 };
  const uni = Boolean(opts.uniform);
  // arms
  for (const s of [1, -1]) {
    const k = s > 0 ? 'l' : 'r';
    const sh = new THREE.Group(); sh.position.set(s * (uni ? 0.2 : 0.205), uni ? 0.25 : 0.26, -0.005); chest.add(sh);
    const rUp = 0.052 * U.arm + thick, rFo = 0.043 * U.arm + thick;
    sh.add(sph(uni ? rUp * 1.04 : 0.062 + thick, limbMat, [0, -0.01, 0]));
    sh.add(cap(rUp, 0.24, limbMat));
    const el = new THREE.Group(); el.position.y = -0.3; sh.add(el);
    el.add(sph(uni ? (rUp + rFo) / 2 : 0.046 + thick, limbMat));
    el.add(cap(rFo, 0.21, limbMat));
    const wr = new THREE.Group(); wr.position.y = -0.27; el.add(wr);
    const fs = fist(M, handMat, s); fs.scale.setScalar(U.hand); wr.add(fs);
    if (uni) { const w = sph(rFo * 0.95, handMat, [0, 0.01, 0]); wr.add(w); }
    j[k + 'Sh'] = sh; j[k + 'El'] = el; j[k + 'Wr'] = wr;
    // legs
    const hip = new THREE.Group(); hip.position.set(s * (uni ? 0.082 : 0.095), uni ? -0.085 : -0.06, 0); pelvis.add(hip);
    const rTh = 0.078 * U.leg + thick, rSn = (uni ? 0.07 : 0.056) * U.leg + thick;
    hip.add(cap(rTh, 0.34, legMat));
    const kn = new THREE.Group(); kn.position.y = -0.44; hip.add(kn);
    kn.add(sph(uni ? (rTh + rSn) / 2 : 0.06 + thick, legMat));
    kn.add(cap(rSn, 0.36, legMat));
    const an = new THREE.Group(); an.position.y = -0.45; kn.add(an);
    const footMat = knight ? M.steel : (outfit === 'archer' ? M.cloth : M.skin);
    const ank = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * U.leg, 0.045 * U.leg, 0.11, 20), footMat); ank.position.y = 0.0; an.add(ank);
    if (!knight) { const cuff = new THREE.Mesh(new THREE.CylinderGeometry(uni ? rSn + 0.006 : 0.06, uni ? rSn + 0.006 : 0.06, 0.05, 20), legMat); cuff.position.y = 0.045; an.add(cuff); }
    const foot = sph(0.05 * U.foot, footMat, [0, -0.035, 0.05 * U.foot], [0.95, 0.62, 2.3]); an.add(foot);
    if (!knight && outfit !== 'archer') for (let t = 0; t < 5; t++) an.add(sph(0.011 - t * 0.0008, M.skin, [s * (-0.03 + t * 0.014), -0.055, 0.155 - t * 0.008]));
    j[k + 'Hip'] = hip; j[k + 'Kn'] = kn; j[k + 'An'] = an;
  }

  const armor = {};
  // ----- outfits -----
  if (outfit === 'vest') {
    const g = torsoShell(0.02, 0.5, (y) => 0.022 + 0.01 * Math.max(0, (0.1 - y) / 0.1), { ridge: 0.006 });
    g.translate(0, -0.2, 0);
    const v = new THREE.Mesh(g, M.steel); chest.add(v); armor.plate = v;
    const lo = torsoShell(-0.14, 0.2, 0.026); spine.add(new THREE.Mesh(lo, M.steel));
    spine.add(rim(-0.14, 0.026, 0.006, M.leather));
    // buckle straps down the front
    for (let i = 0; i < 4; i++) {
      const y = 0.0 + i * 0.1;
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.016, 0.01), M.leather);
      st.position.set(0.018, y - 0.2 + 0.05, torsoR(y + 0.05) * TORSO_SZ + 0.022);
      if (y + 0.05 <= 0.2) { st.position.y = y + 0.05; spine.add(st); } else chest.add(st);
      const bk = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0035, 6, 16), M.rivet);
      bk.position.copy(st.position); bk.position.x = -0.025; bk.position.z += 0.006; (st.parent).add(bk);
    }
    // center split line
    const split = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.62, 0.006), M.mouth);
    split.position.set(0, 0.12, 0.128); spine.add(split);
    // spiky leather shoulder trim
    for (const s of [1, -1]) for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.055, 4), M.leather);
      const a = i / 5;
      c.position.set(s * (0.08 + a * 0.13), 0.3 - a * 0.04, 0.02 - a * 0.03);
      c.rotation.set(-0.3, 0, -s * (0.2 + a * 0.9)); chest.add(c);
    }
    const vr = rim(0.5, 0.022, 0.008, M.leather); vr.position.y = 0.3; chest.add(vr);
  }
  if (outfit === 'chainmail') {
    const g = torsoShell(-0.26, 0.54, (y) => 0.028 + Math.max(0, (0.0 - y)) * 0.12, {});
    const cm = new THREE.Mesh(g, M.chainmail); spine.add(cm); armor.plate = cm;
    for (const s of [1, -1]) {
      const k = s > 0 ? 'l' : 'r';
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.092, 0.24, 40, 1, true), M.chainmail);
      sl.material = M.chainmail; sl.position.y = -0.08; j[k + 'Sh'].add(sl);
      j[k + 'Sh'].add(sph(0.083, M.chainmail, [0, -0.0, 0], [1, 0.9, 1]));
    }
  }
  if (outfit === 'plate' || knight) {
    const g = torsoShell(-0.02, 0.52, (y) => 0.034 + 0.015 * Math.sin(Math.max(0, Math.min(1, (y - 0.02) / 0.45)) * Math.PI), { ridge: 0.022 });
    g.translate(0, -0.2, 0);
    const bp = new THREE.Mesh(g, M.steel); chest.add(bp); armor.plate = bp;
    const r1 = rim(0.52, 0.036, 0.01, M.steel); r1.position.y = 0.32; chest.add(r1);
    // faulds (stepped bands)
    for (let i = 0; i < 3; i++) {
      const y0 = 0.08 - i * 0.075;
      const f = new THREE.Mesh(torsoShell(y0 - 0.085, y0 + 0.02, 0.05 + i * 0.008, { rows: 6 }), M.steel);
      spine.add(f);
      spine.add(rim(y0 - 0.085, 0.05 + i * 0.008, 0.005, M.steelDark));
    }
    // gorget
    const gor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.12, 0.07, 40, 1, true), M.steel);
    gor.position.y = 0.355; gor.scale.z = 0.85; chest.add(gor);
    // pauldrons (layered caps)
    for (const s of [1, -1]) {
      const k = s > 0 ? 'l' : 'r';
      for (let i = 0; i < 4; i++) {
        const pg = new THREE.SphereGeometry(0.098 + i * 0.005, 40, 10, 0, Math.PI * 2, i * 0.34, 0.5);
        const p = new THREE.Mesh(pg, i % 2 ? M.steelDark : M.steel);
        p.material = p.material.clone(); p.material.side = THREE.DoubleSide;
        p.position.set(s * 0.012, 0.0, 0); p.scale.set(1.08, 0.95, 1.05); p.rotation.z = -s * 0.42;
        j[k + 'Sh'].add(p);
      }
      // rerebrace + vambrace + couter
      const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.058, 0.16, 32), M.steel); rb.position.y = -0.17; j[k + 'Sh'].add(rb);
      const vb = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.05, 0.18, 32), M.steel); vb.position.y = -0.13; j[k + 'El'].add(vb);
      const cp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 12, 0, Math.PI * 2, 0, 1.4), M.steel);
      cp.rotation.x = Math.PI / 2 + 0.6; cp.position.set(0, 0, -0.01); j[k + 'El'].add(cp);
    }
    if (knight) for (const s of [1, -1]) {
      const k = s > 0 ? 'l' : 'r';
      const kc = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 12, 0, Math.PI * 2, 0, 1.3), M.steelDark);
      kc.rotation.x = Math.PI / 2 - 0.4; kc.position.z = 0.02; j[k + 'Kn'].add(kc);
      const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.3, 32), M.steelBright); gr.position.y = -0.2; j[k + 'Kn'].add(gr);
    }
  }
  if (outfit === 'archer') {
    const g = torsoShell(-0.3, 0.5, (y) => 0.025 + Math.max(0, -y) * 0.15);
    spine.add(new THREE.Mesh(g, M.cloth));
    spine.add(rim(0.0, 0.03, 0.02, M.leather));
    for (const s of [1, -1]) { const k = s > 0 ? 'l' : 'r'; const b = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.047, 0.14, 24), M.leather); b.position.y = -0.17; j[k + 'El'].add(b); }
  }
  shadowAll(root);

  const human = {
    root, j, armor, setMouth: H.setMouth, setFace: H.setFace || (() => {}), face: H.parts, M,
    // pose: { joint: [x,y,z] }, all others reset to rest
    setPose(p = {}) {
      for (const k of ['pelvis', 'spine', 'chest', 'neck', 'head', 'lSh', 'lEl', 'lWr', 'rSh', 'rEl', 'rWr', 'lHip', 'lKn', 'lAn', 'rHip', 'rKn', 'rAn']) {
        const v = p[k] || [0, 0, 0];
        j[k].rotation.set(v[0], v[1], v[2], 'YXZ');
      }
      j.pelvis.position.y = 0.95 + (uni ? 0.025 : 0) + (p.drop || 0);
    },
  };
  human.setPose({});
  H.setMouth(0);
  return human;
}

// blend two pose objects
export function lerpPose(a, b, t) {
  const o = {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === 'drop') { o.drop = (a.drop || 0) + ((b.drop || 0) - (a.drop || 0)) * t; continue; }
    const va = a[k] || [0, 0, 0], vb = b[k] || [0, 0, 0];
    o[k] = [0, 1, 2].map(i => va[i] + (vb[i] - va[i]) * t);
  }
  return o;
}

// standalone armor pieces for the stands in the last shot
export function standArmor(kind) {
  const M = materials();
  const g = new THREE.Group();
  let target;
  if (kind === 'plate') {
    const bp = new THREE.Mesh(torsoShell(-0.02, 0.52, (y) => 0.034 + 0.015 * Math.sin(Math.max(0, Math.min(1, (y - 0.02) / 0.45)) * Math.PI), { ridge: 0.022 }), M.steel);
    bp.material = M.steel.clone(); bp.material.side = THREE.DoubleSide;
    g.add(bp); target = bp;
    const r1 = rim(0.52, 0.036, 0.01, M.steel); g.add(r1);
    const r0 = rim(-0.02, 0.034, 0.012, M.steelDark); g.add(r0);
    for (let i = 0; i < 2; i++) {
      const y0 = -0.02 - i * 0.07;
      const f = new THREE.Mesh(torsoShell(y0 - 0.08, y0 + 0.01, 0.05 + i * 0.008, { rows: 6 }), M.steel);
      f.material = M.steel.clone(); f.material.side = THREE.DoubleSide; g.add(f);
      g.add(rim(y0 - 0.08, 0.05 + i * 0.008, 0.006, M.leather));
    }
    for (const s of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(s * 0.215, 0.46, 0); g.add(sh);
      for (let i = 0; i < 4; i++) {
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.1 + i * 0.005, 40, 10, 0, Math.PI * 2, i * 0.34, 0.5), i % 2 ? M.steelDark : M.steel);
        p.material = p.material.clone(); p.material.side = THREE.DoubleSide;
        p.position.set(s * 0.012, 0, 0); p.scale.set(1.08, 0.95, 1.05); p.rotation.z = -s * 0.42; sh.add(p);
      }
    }
    // rivets
    for (let i = 0; i < 10; i++) {
      const a = (i / 9 - 0.5) * 2.0;
      const r = sph(0.007, M.steelDark, [Math.sin(a) * torsoR(0.5) * TORSO_SX * 1.12, 0.5, Math.cos(a) * torsoR(0.5) * TORSO_SZ * 1.25]);
      g.add(r);
    }
  } else {
    const cm = new THREE.Mesh(torsoShell(-0.26, 0.54, (y) => 0.028 + Math.max(0, (0.0 - y)) * 0.12), M.chainmail);
    cm.material = M.chainmail.clone(); cm.material.side = THREE.DoubleSide;
    g.add(cm); target = cm;
    for (const s of [1, -1]) {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.24, 40, 1, true), cm.material);
      sl.position.set(s * 0.25, 0.36, 0); sl.rotation.z = s * 0.35; g.add(sl);
      g.add(sph(0.085, cm.material, [s * 0.215, 0.46, 0], [1, 0.9, 1]));
    }
  }
  shadowAll(g);
  return { group: g, target };
}
