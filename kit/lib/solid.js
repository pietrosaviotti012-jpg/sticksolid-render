// StickSolid · Solid (and the 3D secondary characters), ready to drop into any three.js scene.
//   const solid = makeSolid();                       // the mascot: blue T-shirt to the hips, dark jeans, white shoes
//   const nonno = makeSolid(CAST.nonno);             // a secondary character (personaggi-secondari.json, "solid" cfg)
//   setExpression(solid, 'whoa');                    // one of the 12 expressions (espressioni.json)
//   setExpression(solid, blendExpr('sorriso', 'whoa', k));   // in between two expressions
// cfg: shirt, pants, shoes, sleeves 'long', hem (-0.075 T-shirt .. -0.42 lab coat), look {hair, hairColor, beard,
//      beardColor, fullBeard, glasses}, hat 'helmet' | 'cap', hatColor, size (0.62 a child), headBig, uniform (default true)
import * as THREE from 'three';
import { makeHuman, torsoShell, torsoR, TORSO_SX, TORSO_SZ } from './human.js';

const base = new URL('..', import.meta.url);
export const EXPR = await (await fetch(new URL('espressioni.json', base))).json();
export const CAST = Object.fromEntries((await (await fetch(new URL('personaggi-secondari.json', base))).json()).solid.map(c => [c.id, c.cfg]));
delete EXPR._;

export function makeSolid(cfg = {}) {
  const man = makeHuman('tee', { uniform: cfg.uniform !== false, look: cfg.look || {} });
  const M = man.M;
  const shirt = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.shirt || '#2f63c9'), roughness: 0.85, bumpMap: M.cloth.bumpMap, bumpScale: 0.15 });
  const pants = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.pants || '#2a2f3d'), roughness: 0.9, bumpMap: M.cloth.bumpMap, bumpScale: 1.0 });
  // the lower torso (hips) is trousers
  const legs = new Set(['lHip', 'rHip', 'lKn', 'rKn', 'lAn', 'rAn'].map(k => man.j[k]));
  for (const o of man.j.spine.children) if (o.isMesh && o.material === M.cloth) o.material = '__pants';
  const forearm = new Set(['lEl', 'rEl'].map(k => man.j[k]));
  man.root.traverse(o => {
    if (o.isMesh && o.material === '__pants') { o.material = pants; return; }
    if (!o.isMesh || o.material !== M.cloth) return;
    let p = o.parent, leg = false, fore = false;
    while (p) { if (legs.has(p)) leg = true; if (forearm.has(p)) fore = true; p = p.parent; }
    // short sleeves: forearms are bare skin, the rest of the arm and the body take the shirt
    o.material = leg ? pants : (fore && cfg.sleeves !== 'long' ? M.skin : shirt);
  });
  // a wrist so the fist joins the forearm
  for (const k of ['lEl', 'rEl']) {
    const w = new THREE.Mesh(new THREE.SphereGeometry(cfg.uniform !== false ? 0.054 : 0.04, 24, 16), M.skin); w.position.y = -0.255; w.castShadow = true; man.j[k].add(w);
  }
  // the T-shirt goes down to the hips, loose over the trousers, with a soft rolled hem; its offset fades to 0 at the
  // top so it meets the chest without a step
  {
    const HEM = cfg.hem ?? -0.075, long = HEM < -0.2;
    const tee = new THREE.Mesh(torsoShell(HEM, 0.205, (y) => (0.012 + (long ? 0.03 : 0.006) * Math.max(0, (0.02 - y) / (long ? 0.4 : 0.1))) * Math.min(1, (0.205 - y) / 0.09)), shirt);
    tee.castShadow = tee.receiveShadow = true; man.j.spine.add(tee);
    const r = torsoR(HEM) + 0.019 + (long ? 0.03 : 0);
    const hem = new THREE.Mesh(new THREE.TorusGeometry(r, 0.008, 8, 72), shirt);
    hem.rotation.x = Math.PI / 2; hem.scale.set(TORSO_SX, TORSO_SZ, 1); hem.position.y = HEM; hem.castShadow = true; man.j.spine.add(hem);
  }
  // shoes instead of bare toes
  const shoe = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.shoes || '#f4f1ea'), roughness: 0.6 });
  for (const k of ['lAn', 'rAn']) man.j[k].traverse(o => { if (o.isMesh && o.material === M.skin) o.material = shoe; });
  if (cfg.hat) {
    const hatM = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.hatColor || '#5f6b3a'), roughness: 0.7 });
    const g = new THREE.Group(); g.position.set(0, 0.1, -0.005); man.j.head.add(g);
    if (cfg.hat === 'helmet') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.128, 40, 20, 0, Math.PI * 2, 0, 1.55), hatM); dome.scale.set(0.95, 1.05, 1.08); dome.position.y = 0.02; g.add(dome);
      const brim = new THREE.Mesh(new THREE.TorusGeometry(0.122, 0.012, 8, 40), hatM); brim.rotation.x = Math.PI / 2; brim.scale.set(0.98, 1.12, 1); brim.position.y = 0.02; g.add(brim);
    } else if (cfg.hat === 'cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.112, 40, 20, 0, Math.PI * 2, 0, 1.5), hatM); dome.scale.set(0.95, 0.95, 1.05); dome.position.y = 0.035; g.add(dome);
      const bill = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.008, 32, 1, false, -Math.PI / 2, Math.PI), hatM); bill.position.set(0, 0.04, 0.1); bill.scale.set(1, 1, 0.9); g.add(bill);
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  }
  if (cfg.size) man.root.scale.setScalar(cfg.size);
  if (cfg.headBig) man.j.head.scale.setScalar(cfg.headBig);
  setExpression(man, 'sorriso');
  return man;
}

// an expression by name, or a setFace object; eyes are always 1.35 (the mascot's big friendly eyes)
export function setExpression(man, e, extra = {}) {
  const f = typeof e === 'string' ? EXPR[e].solid : e;
  man.setFace({ ...f, eyes: 1.35, ...extra });
}
// halfway between two expressions: numbers are mixed, words (the mouth shape) switch at the middle
export function blendExpr(a, b, k) {
  const A = typeof a === 'string' ? EXPR[a].solid : a, B = typeof b === 'string' ? EXPR[b].solid : b, o = {};
  const DEF = { brow: 0.5, tilt: 0.6, lid: 0.7, open: 0, grin: 1, one: 0, look: [0, 0] };
  for (const key of new Set([...Object.keys(A), ...Object.keys(B), 'brow', 'tilt', 'lid', 'open'])) {
    const va = A[key] ?? DEF[key], vb = B[key] ?? DEF[key];
    if (Array.isArray(va) || Array.isArray(vb)) { const x = va || [0, 0], y = vb || [0, 0]; o[key] = x.map((v, i) => v + (y[i] - v) * k); }
    else if (typeof va === 'number' && typeof vb === 'number') o[key] = va + (vb - va) * k;
    else o[key] = k < 0.5 ? va : vb;
  }
  return o;
}
