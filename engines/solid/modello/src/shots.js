import * as THREE from 'three';
import { glowSprite, sparks, rippleOverlay } from './props.js';
import { kf, lerp, smooth, easeOut, easeIn, easeInOut, range, clamp, V, cam, place, shake, ikArm } from './anim.js';
import { rng } from './textures.js';
import {
  mesh, std, glowMat, shadow, makeGlobe, arrow3, arcArrow, gauge, person, FACE, lerpFace, tree, house, car, cone, bin, bench,
  mailbox, lamppost, jet, waveMesh, poleMarker, softSprite, streaks,
} from './world.js';

export const DURATION = 39.4;

// [start, text, end?]
export const CAPTIONS = [
  [0.00, 'If Earth'], [0.56, 'stopped spinning'], [1.28, 'for one second'], [2.32, 'what would happen'], [2.88, 'to you?'],
  [3.52, 'Some people think'], [4.40, "you wouldn't notice"], [5.44, "since you can't"], [6.16, 'feel it spinning'], [6.96, 'now'],
  [7.36, "But that's only"], [8.32, 'because everything'], [9.12, 'spins with you'],
  [10.08, 'At the equator'], [11.04, 'the ground'], [12.00, 'the air'], [12.56, 'and the oceans'], [13.36, 'all move east'],
  [14.40, 'at about'], [14.80, '1,670'], [16.72, 'kilometers'], [17.36, 'an hour'],
  [18.00, 'If the planet'], [18.72, 'suddenly stopped'], [19.76, 'nothing else would'],
  [20.64, "You'd keep flying"], [21.60, 'east'], [22.24, 'faster than'], [22.80, 'a jet airliner'],
  [23.92, 'So would anything'], [24.64, 'not bolted down'],
  [25.92, 'The air would'], [26.48, 'keep going too'], [27.44, 'with winds'], [28.08, 'faster than sound'],
  [29.28, 'And the oceans'], [30.00, 'would surge east'], [30.88, 'as giant waves'],
  [32.08, 'Near the poles'], [33.04, 'where the ground'], [33.76, 'barely moves'], [34.80, 'it would be'], [35.20, 'gentler'],
  [35.84, 'Where would you'], [36.24, 'want to be'], [36.72, 'standing?'], [37.36, 'Tell me'], [37.76, 'in the comments', 39.1],
];
// [fadeInStart, fullStart, fullEnd, fadeOutEnd] to black, on the "But" turn
export const FADES = [[7.16, 7.32, 7.4, 7.58]];

// ---------- helpers ----------
function idle(t, k = 1) { return Math.sin(t * 1.6) * 0.012 * k; }
const STAND = {
  lSh: [0.05, 0, 0.16], rSh: [0.05, 0, -0.16], lEl: [-0.25, 0, 0], rEl: [-0.25, 0, 0],
  lHip: [0, 0, 0.07], rHip: [0, 0, -0.07], lAn: [0, 0, -0.07], rAn: [0, 0, 0.07],
};
function standPose(h, t, extra = {}) {
  const p = { ...STAND, ...extra };
  p.chest = [idle(t) + (extra.chest?.[0] || 0), extra.chest?.[1] || 0, extra.chest?.[2] || 0];
  h.setPose(p);
}
const SHRUG = { lSh: [-0.35, 0, 0.5], rSh: [-0.35, 0, -0.5], lEl: [-1.5, 0.6, 0], rEl: [-1.5, -0.6, 0], neck: [0, 0, 0.08], head: [0.05, 0, 0.1] };
function grass(size = 80, color = 0x6cbf4f) {
  const m = mesh(new THREE.CircleGeometry(size, 64), std(color, { roughness: 0.95 }), [0, 0.001, 0], [-Math.PI / 2, 0, 0]);
  m.receiveShadow = true; return m;
}
function setSky(scene, top, mid, horizon, floorC) {
  const u = scene.userData.sky.material.uniforms;
  u.top.value.set(top); u.mid.value.set(mid); u.horizon.value.set(horizon); u.floorC.value.set(floorC);
}
// stand an object on a sphere: local position on radius R at direction dir, facing `fwd` (both in the parent's frame)
function standOn(obj, R, dir, fwd) {
  const up = dir.clone().normalize();
  const z = fwd.clone().addScaledVector(up, -fwd.dot(up)).normalize();
  const x = new THREE.Vector3().crossVectors(up, z);
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
  obj.position.copy(up).multiplyScalar(R);
}
// globe spin angle: steady, then (optionally) a sudden stop with a small recoil
function spinAngle(t, w, stopAt = Infinity) {
  if (t < stopAt) return w * t;
  const it = t - stopAt;
  return w * stopAt + 0.02 * Math.sin(it * 18) * Math.exp(-it * 6);
}
const dofAt = (c, p, ap = 0.002, mb = 0.006) => ({ focus: c.position.distanceTo(p), aperture: ap, maxblur: mb });
const noGround = scene => scene.remove(scene.children.find(c => c.material?.isShadowMaterial));

// ============ SHOT 1: the Earth spinning in the sky, then it stops ============
function shotGlobeStop({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-4, 3, 5] });
  noGround(scene);
  const G = makeGlobe(1); scene.add(G.root);
  const ring = mesh(new THREE.TorusGeometry(1.0, 0.012, 8, 160), glowMat(0xffffff, 0));
  scene.add(ring);
  const c = cam(34);
  const TS = 1.62;
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 2.4 + spinAngle(t, 1.6, TS);
      G.clouds.rotation.y = 2.4 + t * 1.6 * 1.05;
      const it = t - TS;
      const jolt = it > 0 ? Math.exp(-it * 5) : 0;
      ring.material.opacity = it > 0 ? 0.9 * Math.exp(-it * 3.5) : 0;
      ring.scale.setScalar(1.05 + (it > 0 ? easeOut(range(it, 0, 0.6)) * 0.4 : 0));
      ring.lookAt(c.position);
      const k = easeInOut(range(t, 0, 2.4));
      const s = shake(t * 2, 25 * jolt + 1, 4);
      place(c, [s[0], 0.25 + s[1], lerp(6.2, 5.2, k)], [0, 0.05, 0], s[2] * 2);
      return { dof: { focus: 6, aperture: 0, maxblur: 0 }, bloom: 0.4 };
    },
  };
}

// ============ SHOT 2: close-up, he realises: "what would happen to you?" ============
function shotSurprised({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-3, 6, 5] });
  scene.add(grass());
  const tr = tree(3.4, 3); tr.position.set(1.6, 0, -3.5); scene.add(tr);
  const hs = house(); hs.position.set(-2.8, 0, -6); hs.rotation.y = 0.4; scene.add(hs);
  const man = person(); scene.add(man.root);
  const c = cam(30);
  return {
    scene, camera: c,
    update(t) {
      const k = smooth(range(t, 0.0, 0.35));
      standPose(man, t, { neck: [-0.05 * k, 0, 0], head: [-0.08 * k, 0.05, 0.04 * k], lSh: [0.05, 0, 0.16 + 0.2 * k], rSh: [0.05, 0, -0.16 - 0.2 * k], lEl: [-0.25 - 0.4 * k, 0, 0], rEl: [-0.25 - 0.4 * k, 0, 0] });
      man.setFace(lerpFace(FACE.calm, FACE.surprised, k));
      const kk = easeOut(range(t, 0, 1.2));
      place(c, [lerp(0.12, 0.08, kk), 1.66, lerp(1.35, 1.1, kk)], [0, 1.6, 0]);
      return { dof: dofAt(c, V(0, 1.65, 0.1), 0.006, 0.012), bloom: 0.3 };
    },
  };
}

// ============ SHOT 3: "you wouldn't notice": relaxed and smug, then a shrug ============
function shotSmug({ makeStage }) {
  const scene = makeStage({ shadowSize: 3, sunDir: [-3, 6, 5] });
  scene.add(grass());
  const tr = tree(3.4, 3); tr.position.set(1.6, 0, -3.5); scene.add(tr);
  const tr2 = tree(2.6, 8); tr2.position.set(-1.9, 0, -2.6); scene.add(tr2);
  const hs = house(); hs.position.set(-2.8, 0, -6); hs.rotation.y = 0.4; scene.add(hs);
  const man = person(); man.root.rotation.y = -0.15; scene.add(man.root);
  const c = cam(34);
  const TS = 1.9; // shrug on "since you can't feel it"
  return {
    scene, camera: c,
    update(t) {
      const sh = smooth(range(t, TS, TS + 0.4)) * (1 - smooth(range(t, 3.3, 3.7)));
      const pose = {
        lSh: [0.05, 0, 0.16], rSh: [0.05, 0, -0.16], lEl: [-0.25, 0, 0], rEl: [-0.25, 0, 0],
        neck: [0, -0.05, 0.03], head: [0, 0.05, 0.05],
      };
      const p = {};
      for (const key of Object.keys(pose)) p[key] = pose[key].map((v, i) => v + ((SHRUG[key] || pose[key])[i] - v) * sh);
      standPose(man, t, { ...p, lHip: [0, 0, 0.1], rHip: [0, 0, -0.1], lAn: [0, 0, -0.1], rAn: [0, 0, 0.1] });
      man.setFace(lerpFace(FACE.smug, { ...FACE.smug, brow: 0.6, asym: 0.9, smile: 0.7 }, sh));
      const k = easeInOut(range(t, 0, 3.7));
      place(c, [lerp(0.5, 0.35, k), lerp(1.3, 1.35, k), lerp(4.0, 3.2, k)], [0, lerp(1.08, 1.18, k), 0]);
      return { dof: dofAt(c, V(0, 1.2, 0), 0.002, 0.006), bloom: 0.3 };
    },
  };
}

// ============ SHOT 4: "everything spins with you": tiny world on top of the globe, carried east ============
function shotTiny({ makeStage }) {
  const scene = makeStage({ shadowSize: 0.8, sunDir: [-2, 5, 4] });
  noGround(scene);
  const G = makeGlobe(1, { tilt: 0, clouds: false });
  G.root.rotation.x = -Math.PI / 2; // pole points away from the camera: the top of the frame is the equator
  scene.add(G.root);
  G.earth.rotation.y = -1.72;
  const W = 0.12; // world scale of the little people and things
  const out = (a) => V(Math.sin(a), 0, Math.cos(a));
  const fwd = V(0, -1, 0); // local -y = world +z (toward the camera)
  const add = (obj, a, s, h = 0) => { const g = new THREE.Group(); g.add(obj); obj.scale.setScalar(s); standOn(g, 1 + h, out(a), fwd); G.spin.add(g); return g; };
  const man = person(); add(man.root, 0.0, W * 0.6);
  add(tree(3, 4), -0.11, W * 0.55);
  add(house(), 0.13, W * 0.42);
  add(tree(2.4, 9), 0.21, W * 0.5);
  add(car(0xe0443a), -0.2, W * 0.36);
  // a cloud (the air) above them, and arrows
  const cloud = new THREE.Group(); const cm = std(0xffffff, { roughness: 1 });
  for (const [x, y, r] of [[0, 0, 0.5], [0.45, -0.1, 0.38], [-0.45, -0.12, 0.36], [0.2, 0.25, 0.32]]) cloud.add(mesh(new THREE.SphereGeometry(r, 20, 14), cm, [x, y, 0]));
  shadow(cloud); add(cloud, -0.04, 0.045, 0.16);
  const arrows = [];
  for (const [a, h, col] of [[-0.06, 0.175, 0xffd23a], [-0.04, 0.25, 0xffffff]]) {
    const ar = arrow3(col, 0.09, 0.006); const g = new THREE.Group(); g.add(ar);
    standOn(g, 1 + h, out(a), fwd); G.spin.add(g); arrows.push(ar);
  }
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = -0.2 + t * 0.12;
      standPose(man, t, { neck: [0, 0, 0], head: [0, 0, 0] });
      man.setFace({ smile: 0.4 });
      arrows.forEach((a, i) => a.set(easeOut(range(t, 0.3 + i * 0.25, 0.9 + i * 0.25))));
      const k = easeInOut(range(t, 0, 2.8));
      place(c, [0.0, lerp(1.2, 1.17, k), lerp(0.95, 0.8, k)], [0.0, 1.05, 0]);
      return { dof: dofAt(c, V(0, 1.06, 0), 0.0006, 0.004), bloom: 0.35 };
    },
  };
}

// ============ SHOT 5: the equator, the ground, the air and the oceans all moving east ============
function shotLayers({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-4, 3, 5] });
  noGround(scene);
  const G = makeGlobe(1, { tilt: 0.2 }); scene.add(G.root);
  const eq = mesh(new THREE.TorusGeometry(1.004, 0.007, 8, 200), glowMat(0xffd23a, 0), [0, 0, 0], [Math.PI / 2, 0, 0]); G.tilt.add(eq);
  // three arrows: ground (green), oceans (cyan), air (white, higher up)
  const A = [
    { ar: arcArrow(1.03 * Math.cos(-0.16), Math.sin(-0.16) * 1.03, -0.75, 0.55, 0x7be04a, 0.022), t0: 0.96 },
    { ar: arcArrow(1.06, 0.0, -0.75, 0.55, 0x3fd8ff, 0.022), t0: 2.48 },
    { ar: arcArrow(1.14 * Math.cos(0.17), Math.sin(0.17) * 1.14, -0.75, 0.55, 0xffffff, 0.022), t0: 1.92 },
  ];
  A.forEach(a => G.tilt.add(a.ar));
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 1.2 + t * 0.35;
      G.clouds.rotation.y = 1.2 + t * 0.35;
      eq.material.opacity = 0.9 * smooth(range(t, 0.1, 0.6)) * (1 - 0.5 * smooth(range(t, 1.2, 2)));
      const pulse = t > 3.28 ? 1 + 0.12 * Math.sin(clamp((t - 3.28) / 0.45) * Math.PI) : 1;
      A.forEach(a => { a.ar.set(easeOut(range(t, a.t0, a.t0 + 0.5))); a.ar.scale.setScalar(pulse); });
      const k = easeInOut(range(t, 0, 4.4));
      place(c, [lerp(-0.3, 0.1, k), lerp(1.4, 1.1, k), lerp(5.6, 4.9, k)], [0, 0.0, 0]);
      return { dof: { focus: 5, aperture: 0, maxblur: 0 }, bloom: 0.45 };
    },
  };
}

// ============ SHOT 6: the speed gauge climbing to 1,670 km/h ============
function shotGauge({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-3, 4, 6] });
  noGround(scene);
  const G = makeGlobe(3, { tilt: 0.41 }); G.root.position.set(0.6, -3.4, -6); scene.add(G.root);
  const gg = gauge(); gg.position.set(0, 0.22, 0); gg.scale.setScalar(0.55); scene.add(gg);
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 0.5 + t * 0.3; G.clouds.rotation.y = 0.5 + t * 0.31;
      // climbs on "1,670" (14.80), with a small overshoot
      const v = 1670 * easeOut(range(t, 0.4, 2.2));
      gg.set(v);
      gg.rotation.set(-0.05 + 0.03 * Math.sin(t * 0.8), 0.18 - 0.1 * easeInOut(range(t, 0, 3.6)), 0);
      const k = easeInOut(range(t, 0, 3.6));
      place(c, [lerp(0.15, 0.0, k), 0.12, lerp(4.4, 3.9, k)], [0, 0.0, 0]);
      return { dof: dofAt(c, V(0, 0.22, 0), 0.004, 0.01), bloom: 0.35 };
    },
  };
}

// ============ SHOT 7: the Earth slams to a stop, red ripple; the air keeps going ============
function shotSlam({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-4, 3, 5] });
  noGround(scene);
  const G = makeGlobe(1, { tilt: 0.3 }); scene.add(G.root);
  const rp = rippleOverlay(G.earth);
  // wind lines that race around after the stop
  const lines = [];
  const r = rng(5);
  for (let i = 0; i < 14; i++) {
    const lat = (r() - 0.5) * 1.4, rr = 1.08 + r() * 0.06;
    const m = mesh(new THREE.TorusGeometry(rr * Math.cos(lat), 0.006, 6, 64, 0.5 + r() * 0.6), glowMat(0xffffff, 0), [0, rr * Math.sin(lat), 0], [Math.PI / 2, 0, 0]);
    const g = new THREE.Group(); g.add(m); G.tilt.add(g); lines.push({ g, m, ph: r() * 6.28, sp: 2.2 + r() * 1.2 });
  }
  const c = cam(34);
  const TS = 1.12; // "stopped"
  const W0 = 1.4;
  // where the ripple starts: the point facing the camera once the Earth has stopped
  G.spin.rotation.y = 0.3 + W0 * TS; G.root.updateMatrixWorld(true);
  const hitLocal = G.earth.worldToLocal(V(0.15, 0.25, 1).normalize());
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 0.3 + spinAngle(t, W0, TS);
      G.clouds.rotation.y = 0.3 + t * W0 + (t > TS ? (t - TS) * 0.6 : 0);
      const it = t - TS;
      const u = rp.material.uniforms;
      u.uCenter.value.copy(hitLocal);
      u.uAmp.value = it > 0 ? Math.min(1, it * 8) * (1 - 0.6 * smooth(range(it, 0.8, 1.5))) : 0;
      u.uRadius.value = it > 0 ? 0.05 + easeOut(range(it, 0, 1.3)) * 1.2 : 0;
      u.uRings.value = 60; u.uSpot.value = 0.12; u.uSpotAmp.value = 0.9; u.uTime.value = t * 0.5;
      // lines appear on "nothing else would" (19.76 -> local 1.76)
      for (const L of lines) {
        L.g.rotation.y = L.ph + t * L.sp;
        L.m.material.opacity = 0.75 * smooth(range(t, 1.5, 1.9));
      }
      const jolt = it > 0 ? Math.exp(-it * 4) : 0;
      const s = shake(t * 2, 30 * jolt + 1, 2);
      const k = easeInOut(range(t, 0, 2.64));
      place(c, [lerp(0.4, 0.2, k) + s[0], 0.35 + s[1], lerp(4.9, 4.4, k)], [0.05, 0.08, 0], s[2] * 3);
      return { dof: { focus: 4, aperture: 0, maxblur: 0 }, bloom: 0.5 };
    },
  };
}

// ============ SHOT 8: you keep flying east, faster than a jet ============
function shotFly({ makeStage }) {
  const scene = makeStage({ shadowSize: 4, sunDir: [-3, 6, 4] });
  scene.add(grass(200));
  const road = mesh(new THREE.PlaneGeometry(400, 5), std(0x55585e, { roughness: 0.9 }), [100, 0.005, -1.0], [-Math.PI / 2, 0, 0]); road.receiveShadow = true; scene.add(road);
  for (let i = 0; i < 90; i++) { const d = mesh(new THREE.PlaneGeometry(1.4, 0.14), std(0xf2f2f2), [-6 + i * 3, 0.01, -1.0], [-Math.PI / 2, 0, 0]); d.receiveShadow = true; scene.add(d); }
  const r = rng(12);
  for (let i = 0; i < 40; i++) {
    const x = -10 + i * 6 + r() * 2;
    if (i % 3 === 0) { const h = house([0xf1e3c8, 0xe8d0d8, 0xd8e6f0][i % 3], [0xc0533a, 0x5a6a8a, 0x8a4a3a][i % 3]); h.position.set(x, 0, -9 - r() * 3); h.rotation.y = (r() - 0.5) * 0.5; scene.add(h); }
    else { const tr = tree(2.6 + r() * 1.4, i); tr.position.set(x, 0, -5 - r() * 6); scene.add(tr); }
  }
  const man = person(); scene.add(man.root);
  const jt = jet(); jt.scale.setScalar(1.1); scene.add(jt);
  const lines = streaks(24); scene.add(lines);
  const c = cam(40);
  const T0 = 0.38; // takes off
  const X = t => (t < T0 ? 0 : 7.5 * (t - T0) * easeIn(range(t, T0, T0 + 0.6)) ** 0.3);
  return {
    scene, camera: c,
    update(t) {
      const up = easeOut(range(t, T0, T0 + 0.7));
      const x = X(t);
      man.root.position.set(x, 0.0 + up * 2.3 + Math.sin(t * 5) * 0.04 * up, 0.6);
      man.root.rotation.set(0, -0.1, -1.3 * up);
      const f = t * 11;
      const flail = up;
      man.setPose({
        pelvis: [0, 0, 0], spine: [-0.1 * up, 0, 0], chest: [0, 0, 0.1 * up],
        neck: [0, 0, 0.45 * up], head: [0.05, -0.1 * up, 0.5 * up],
        lSh: [lerp(0.05, -2.6, up) + Math.sin(f) * 0.5 * flail, 0, lerp(0.16, 0.7, up)], lEl: [-0.3 - 0.5 * flail * (0.5 + 0.5 * Math.sin(f + 1)), 0, 0],
        rSh: [lerp(0.05, -2.3, up) + Math.sin(f + 2) * 0.5 * flail, 0, lerp(-0.16, -0.8, up)], rEl: [-0.3 - 0.5 * flail * (0.5 + 0.5 * Math.sin(f + 3)), 0, 0],
        lHip: [lerp(0, -0.6, up) + Math.sin(f + 0.5) * 0.4 * flail, 0, 0.12], lKn: [0.4 * up + 0.3 * flail * (0.5 + 0.5 * Math.sin(f)), 0, 0],
        rHip: [lerp(0, 0.3, up) + Math.sin(f + 2.5) * 0.4 * flail, 0, -0.12], rKn: [0.7 * up, 0, 0],
      });
      man.setFace(lerpFace(FACE.surprised, FACE.scared, smooth(range(t, T0, T0 + 0.4))));
      // the jet: appears behind on "faster than" (local 1.6) and falls back
      const tj = t - 1.45;
      jt.position.set(x + 5.5 - tj * 3.4, 5.6 + Math.sin(t) * 0.05, -9);
      jt.visible = tj > -0.5;
      // speed lines streaming past (relative to him)
      lines.list.forEach((m, i) => {
        const rr = (i * 0.618) % 1, ph = (i * 0.377) % 1;
        const span = 9, u = ((ph * span - t * 14) % span + span) % span;
        m.position.set(x + 4.5 - u, 0.5 + rr * 3.6, -0.5 + ((i * 0.29) % 1) * 2.5);
        m.scale.x = 0.8 + rr * 1.2; m.material.opacity = 0.55 * up;
      });
      const s = shake(t, 2 + 3 * up, 6);
      const cx = x + 0.55 * up;
      place(c, [cx + s[0], lerp(1.5, 2.3, up) + s[1], lerp(5.4, 6.2, up)], [cx + 0.1, lerp(1.1, 2.0, up), 0]);
      return { dof: dofAt(c, man.root.position.clone().add(V(0, 0.8, 0)), 0.0015, 0.006), bloom: 0.35 };
    },
  };
}

// ============ SHOT 9: anything not bolted down: car, bench, bin, cones, mailbox tumbling east ============
function shotTumble({ makeStage }) {
  const scene = makeStage({ shadowSize: 8, sunDir: [-3, 7, 4] });
  scene.add(grass(200));
  const road = mesh(new THREE.PlaneGeometry(400, 6), std(0x55585e, { roughness: 0.9 }), [0, 0.005, -3], [-Math.PI / 2, 0, 0]); road.receiveShadow = true; scene.add(road);
  for (let i = 0; i < 40; i++) scene.add(mesh(new THREE.PlaneGeometry(1.4, 0.14), std(0xf2f2f2), [-40 + i * 3, 0.01, -3], [-Math.PI / 2, 0, 0]));
  for (let i = 0; i < 8; i++) { const tr = tree(3 + (i % 3) * 0.5, 30 + i); tr.position.set(-14 + i * 4, 0, -11 - (i % 2) * 2); tr.rotation.z = -0.25; scene.add(tr); }
  const things = [
    { o: car(0xe0443a), p0: [-9, 0.0, -4.5], v: [5.6, 2.4], spin: [0.25, 0.4, -0.9], t0: 0.0 },
    { o: bench(), p0: [-6, 0, -0.5], v: [4.6, 2.2], spin: [1.4, 0.6, -1.6], t0: 0.15 },
    { o: bin(), p0: [-5, 0, 1.2], v: [4.2, 1.6], spin: [0.6, 1.2, -2.2], t0: 0.35 },
    { o: cone(), p0: [-4.2, 0, 2.2], v: [3.8, 2.0], spin: [2.2, 1.0, -2.8], t0: 0.25 },
    { o: cone(), p0: [-5.6, 0, 0.6], v: [4.4, 2.6], spin: [-1.4, 2.0, -2.0], t0: 0.45 },
    { o: mailbox(), p0: [-7.5, 0, -1.8], v: [4.9, 1.9], spin: [0.8, -0.5, -1.4], t0: 0.05 },
    { o: car(0x2f8ad6), p0: [-14, 0, -6.5], v: [6.0, 1.8], spin: [-0.2, 0.3, -0.6], t0: 0.0 },
  ];
  for (const th of things) scene.add(th.o);
  const debris = [];
  const r = rng(77);
  for (let i = 0; i < 40; i++) {
    const m = mesh(new THREE.BoxGeometry(0.12 + r() * 0.15, 0.04, 0.1 + r() * 0.12), std([0x7a5232, 0x4f9a3c, 0xd8d0c0, 0x8a8f96][i % 4]), [0, 0, 0]);
    m.castShadow = true; scene.add(m); debris.push({ m, p: [-8 + r() * 6, 0.2 + r() * 3, -5 + r() * 7], v: 3 + r() * 3, s: r() * 6 });
  }
  const c = cam(50);
  return {
    scene, camera: c,
    update(t) {
      for (const th of things) {
        const tt = Math.max(0, t - th.t0) * 0.9;
        th.o.position.set(th.p0[0] + th.v[0] * tt, th.p0[1] + Math.max(0, th.v[1] * tt - 0.6 * tt * tt) + 0.3 * smooth(tt * 3), th.p0[2]);
        th.o.rotation.set(th.spin[0] * tt, th.spin[1] * tt, th.spin[2] * tt);
      }
      debris.forEach((d, i) => { d.m.position.set(d.p[0] + d.v * t, d.p[1] + Math.sin(t * 2 + i) * 0.2, d.p[2]); d.m.rotation.set(t * d.s, t * d.s * 0.7, t * 2); });
      const k = easeInOut(range(t, 0, 2.0));
      const s = shake(t, 3, 9);
      place(c, [lerp(-1.2, 0.2, k) + s[0], 1.2 + s[1], 8.5], [lerp(-1.6, 0.4, k), 2.1, 0]);
      return { dof: { focus: 8.5, aperture: 0.0006, maxblur: 0.004 }, bloom: 0.3 };
    },
  };
}

// ============ SHOT 10: the air keeps going: winds faster than sound, he hangs on to a lamppost ============
function shotWind({ makeStage }) {
  const scene = makeStage({ shadowSize: 5, sunDir: [-3, 6, 5] });
  setSky(scene, 0x140a0c, 0x3b1418, 0x3b1418, 0x64262a); // tema cupo
  scene.add(grass(200, 0x62ad48));
  const lp = lamppost(); scene.add(lp);
  const trees = [];
  for (let i = 0; i < 7; i++) { const tr = tree(3.2 + (i % 3) * 0.6, 50 + i); tr.position.set(-7 + i * 2.6, 0, -5 - (i % 2) * 3); scene.add(tr); trees.push({ tr, ph: i * 1.3 }); }
  const man = person(); scene.add(man.root);
  const lines = streaks(40, 0xffffff, 0.016); scene.add(lines);
  const leaves = [];
  const r = rng(91), lm = std(0x4f9a3c, { side: THREE.DoubleSide });
  for (let i = 0; i < 50; i++) { const m = mesh(new THREE.PlaneGeometry(0.08, 0.05), lm); scene.add(m); leaves.push({ m, y: 0.3 + r() * 4, z: -4 + r() * 6, ph: r(), sp: 5 + r() * 4 }); }
  // the "boom": a white ring that bursts on "faster than sound"
  const boom = mesh(new THREE.TorusGeometry(1, 0.04, 8, 96), glowMat(0xffffff, 0)); boom.position.set(1.0, 2.7, -2.5); scene.add(boom);
  const flash = glowSprite(0xffffff, 1); flash.position.copy(boom.position); scene.add(flash);
  const c = cam(40);
  const TB = 2.16;
  return {
    scene, camera: c,
    update(t) {
      const gust = 0.85 + 0.15 * Math.sin(t * 7) + (t > TB ? 0.25 * Math.exp(-(t - TB) * 3) : 0);
      for (const { tr, ph } of trees) {
        tr.rotation.z = -0.35 * gust - 0.05 * Math.sin(t * 9 + ph);
        tr.top.rotation.z = -0.4 * gust - 0.08 * Math.sin(t * 11 + ph);
        tr.top.scale.set(1.15, 0.8, 1);
      }
      // body streams out to the right (east), hands on the post
      const flap = Math.sin(t * 13) * 0.07 + Math.sin(t * 7.3) * 0.05;
      man.root.position.set(1.72, 1.8 + flap * 0.4, 0.1);
      man.root.rotation.set(0.35, 0, Math.PI / 2 - 0.12 + flap, 'ZXY');
      man.setPose({
        spine: [0, 0, 0], chest: [0, 0, flap * 0.5], neck: [0.1, -0.3, -0.25], head: [0.1, -0.35, -0.2],
        lHip: [0.15 + Math.sin(t * 12) * 0.25, 0, 0.18], lKn: [0.35 + Math.sin(t * 12 + 1) * 0.25, 0, 0],
        rHip: [-0.1 + Math.sin(t * 12 + 2) * 0.25, 0, -0.18], rKn: [0.5 + Math.sin(t * 12 + 3) * 0.25, 0, 0],
      });
      man.root.updateMatrixWorld(true);
      for (const [k, dy] of [['l', 0.05], ['r', -0.06]]) {
        const T = V(0.02, 2.05 + dy + flap * 0.1, k === 'l' ? 0.07 : 0.0);
        ikArm(man, k, T, man.root.localToWorld(V(k === 'l' ? 0.7 : -0.7, 1.4, -0.4)), V(0, 0, 1));
      }
      man.setFace({ ...FACE.scared, mouth: 0.8 + 0.15 * Math.sin(t * 9) });
      lines.list.forEach((m, i) => {
        const rr = (i * 0.618) % 1, ph = (i * 0.377) % 1;
        const span = 16, u = ((ph * span + t * 26) % span + span) % span;
        m.position.set(-8 + u, 0.3 + rr * 4.4, -3.5 + ((i * 0.29) % 1) * 5);
        m.scale.x = 1.2 + rr * 2; m.material.opacity = 0.5;
      });
      for (const L of leaves) { const u = ((L.ph * 14 + t * L.sp) % 14); L.m.position.set(-7 + u, L.y + Math.sin(t * 6 + L.ph * 9) * 0.15, L.z); L.m.rotation.set(t * 8 + L.ph, t * 5, t * 9); }
      const it = t - TB;
      boom.scale.setScalar(it > 0 ? 0.2 + easeOut(range(it, 0, 0.7)) * 3.4 : 0.001);
      boom.material.opacity = it > 0 ? 0.85 * (1 - range(it, 0.1, 0.8)) : 0;
      boom.lookAt(V(0.6, 1.8, 5));
      flash.scale.setScalar(it > 0 ? 1.5 + it * 4 : 0.001); flash.material.opacity = it > 0 ? 0.8 * Math.exp(-it * 5) : 0;
      const s = shake(t * 1.5, 4 + (it > 0 ? 18 * Math.exp(-it * 4) : 0), 13);
      const k = easeInOut(range(t, 0, 3.36));
      place(c, [lerp(0.9, 1.1, k) + s[0], 1.95 + s[1], lerp(5.6, 5.0, k)], [0.9, 1.85, 0], s[2] * 2);
      return { dof: dofAt(c, V(0.9, 1.8, 0), 0.0015, 0.006), bloom: 0.4 };
    },
  };
}

// ============ SHOT 11: the oceans surge east as a giant wave ============
function shotWave({ makeStage }) {
  const scene = makeStage({ shadowSize: 12, sunDir: [-2, 6, 6] });
  setSky(scene, 0x6fcfff, 0xc4ecff, 0xc4ecff, 0xf2fbff); // tema freddo
  const sand = mesh(new THREE.CircleGeometry(200, 64), std(0xe6cf94, { roughness: 0.95 }), [0, 0.0, 0], [-Math.PI / 2, 0, 0]); sand.receiveShadow = true; scene.add(sand);
  const wv = waveMesh(80); scene.add(wv);
  const sea = mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhysicalMaterial({ color: 0x15609f, roughness: 0.15, clearcoat: 1 }), [0, 0.15, 0], [-Math.PI / 2, 0, 0]); scene.add(sea);
  const hs = house(0xf4ead2, 0x3e7fb8); hs.position.set(0.5, 0, -4.5); hs.rotation.y = 1.2; scene.add(hs);
  const pal = tree(3.6, 61); pal.position.set(-0.6, 0, -6); scene.add(pal);
  const man = person(); man.root.position.set(2.0, 0, 1.0); man.root.rotation.y = 1.15; scene.add(man.root);
  // foam on the crest
  const foam = new THREE.Group(); const fm = std(0xffffff, { roughness: 0.6 });
  const r = rng(33);
  for (let i = 0; i < 90; i++) { const z = -30 + r() * 60; foam.add(mesh(new THREE.SphereGeometry(0.35 + r() * 0.5, 12, 8), fm, [0.6 + r() * 2.0, 6.6 + r() * 1.9, z])); }
  shadow(foam); scene.add(foam);
  const spray = sparks(260, { speed: 3.2, spread: 0.9, gravity: -3.2, life: 1.6, size: 0.22, seed: 7, dir: V(1, 0.6, 0), color: [0.8, 0.9, 1] });
  scene.add(spray);
  const c = cam(52);
  return {
    scene, camera: c,
    update(t) {
      const X = lerp(-8, -3.2, easeIn(range(t, 0, 2.8)) * 0.5 + range(t, 0, 2.8) * 0.5);
      const grow = lerp(0.82, 1.0, smooth(range(t, 0, 2.8)));
      wv.position.set(X, 0, 0); wv.scale.set(1, grow, 1);
      foam.position.set(X, 0, 0); foam.scale.set(1, grow, 1);
      sea.position.x = X - 100;
      spray.position.set(X + 2.2, 7.6 * grow, 0); spray.update((t * 0.9) % 1.6);
      const look = smooth(range(t, 0.2, 0.9));
      standPose(man, t, {
        neck: [-0.2 * look, -0.25 * look, 0], head: [-0.2 * look, -0.2 * look, 0],
        spine: [0.05 * look, 0, 0], lSh: [0.05 - 0.3 * look, 0, 0.3 * look + 0.16], rSh: [0.05 - 0.3 * look, 0, -0.3 * look - 0.16],
        lEl: [-0.25 - 1.1 * look, 0, 0], rEl: [-0.25 - 1.1 * look, 0, 0], drop: -0.02 * look,
      });
      man.setFace(lerpFace(FACE.worried, FACE.scared, look));
      const s = shake(t, 3 + 4 * range(t, 1, 2.8), 21);
      const k = easeInOut(range(t, 0, 2.8));
      place(c, [lerp(5.0, 4.7, k) + s[0], 0.55 + s[1], lerp(2.7, 2.5, k)], [-3, lerp(3.4, 3.8, k), -0.4]);
      return { dof: dofAt(c, V(2.0, 1.6, 1.0), 0.0012, 0.006), bloom: 0.35 };
    },
  };
}

// ============ SHOT 12: speed by latitude: big arrows at the equator, tiny near the pole ============
function shotPoles({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-4, 4, 5] });
  noGround(scene);
  const G = makeGlobe(1, { tilt: 0 }); scene.add(G.root);
  const lats = [0, 0.52, 0.96, 1.32];
  const A = lats.map((la, i) => {
    const L = 0.75 * Math.cos(la) + 0.04;
    const ar = arrow3(0xffd23a, L, 0.02 + 0.012 * Math.cos(la));
    const g = new THREE.Group(); g.add(ar); ar.position.x = -L / 2;
    g.position.set(0, Math.sin(la) * 1.04, Math.cos(la) * 1.04); g.rotation.x = -la;
    G.tilt.add(g); return ar;
  });
  const pg = glowSprite(0x9fe0ff, 0.5); pg.position.set(0, 1.04, 0); G.tilt.add(pg);
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 2.0 + t * 0.25; G.clouds.rotation.y = 2.0 + t * 0.26;
      A.forEach((a, i) => a.set(easeOut(range(t, 0.15 + i * 0.22, 0.65 + i * 0.22))));
      pg.material.opacity = 0.8 * smooth(range(t, 1.0, 1.6)) * (0.8 + 0.2 * Math.sin(t * 6));
      const k = easeInOut(range(t, 0, 2.72));
      const tilt = lerp(0.35, 0.62, k);
      const R = lerp(5.2, 4.6, k);
      place(c, [0.1, Math.sin(tilt) * R, Math.cos(tilt) * R], [0, lerp(0.15, 0.35, k), 0]);
      return { dof: { focus: 4, aperture: 0, maxblur: 0 }, bloom: 0.45 };
    },
  };
}

// ============ SHOT 13: at the pole: a light breeze, he's relieved ============
function shotPoleMan({ makeStage }) {
  const scene = makeStage({ shadowSize: 3, sunDir: [-3, 5, 5] });
  setSky(scene, 0x6fcfff, 0xc4ecff, 0xc4ecff, 0xf2fbff); // tema freddo
  const snow = mesh(new THREE.CircleGeometry(120, 64), std(0xf2f6fb, { roughness: 0.9 }), [0, 0.0, 0], [-Math.PI / 2, 0, 0]); snow.receiveShadow = true; scene.add(snow);
  const r = rng(44);
  for (let i = 0; i < 14; i++) { const m = mesh(new THREE.SphereGeometry(1, 20, 12), std(0xeaf1f8, { roughness: 0.9 }), [(r() - 0.5) * 20, 0, -3 - r() * 14], [0, 0, 0], [1 + r() * 2, 0.3 + r() * 0.5, 1 + r() * 1.5]); m.receiveShadow = m.castShadow = true; scene.add(m); }
  const pm = poleMarker(); pm.position.set(-0.9, 0, -0.6); scene.add(pm);
  const man = person(); man.root.rotation.y = -0.15; scene.add(man.root);
  const flakes = [];
  for (let i = 0; i < 60; i++) { const s = softSprite(0xffffff, 0.035, 0.9); scene.add(s); flakes.push({ s, x: r() * 6, y: r() * 3, z: -2 + r() * 3.5, ph: r() * 6 }); }
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      const k = smooth(range(t, 0.05, 0.6));
      standPose(man, t, { neck: [0.05, 0, 0], head: [0.05 - 0.1 * k, 0, 0.06 * k], chest: [-0.03 * k, 0, 0] });
      man.setFace(lerpFace(FACE.worried, FACE.relieved, k));
      for (const f of flakes) { const u = (f.x + t * 0.6) % 6; f.s.position.set(-3 + u, (f.y - t * 0.25 + 3) % 3, f.z + Math.sin(t + f.ph) * 0.1); }
      const kk = easeInOut(range(t, 0, 1.1));
      place(c, [lerp(0.25, 0.18, kk), 1.45, lerp(3.0, 2.7, kk)], [0, 1.25, 0]);
      return { dof: dofAt(c, V(0, 1.4, 0), 0.003, 0.008), bloom: 0.3 };
    },
  };
}

// ============ SHOT 14: on top of the world: "Where would you want to be standing?" ============
function shotAsk({ makeStage }) {
  const scene = makeStage({ shadowSize: 2, sunDir: [-3, 5, 5] });
  noGround(scene);
  const G = makeGlobe(1.4, { tilt: 0 }); scene.add(G.root);
  const man = person(); man.root.scale.setScalar(0.33); man.root.position.set(0, 1.395, 0.0); scene.add(man.root);
  const c = cam(34);
  return {
    scene, camera: c,
    update(t) {
      G.spin.rotation.y = 1.0 + t * 0.2; G.clouds.rotation.y = 1.0 + t * 0.21;
      const sh = smooth(range(t, 0.1, 0.5)) * (1 - smooth(range(t, 1.3, 1.6)));
      const point = smooth(range(t, 1.52, 1.85));
      const p = {};
      const base = { lSh: [0.05, 0, 0.16], rSh: [0.05, 0, -0.16], lEl: [-0.25, 0, 0], rEl: [-0.25, 0, 0], neck: [0, 0, 0], head: [0, 0, 0] };
      for (const key of Object.keys(base)) p[key] = base[key].map((v, i) => v + ((SHRUG[key] || base[key])[i] - v) * sh);
      p.rSh = p.rSh.map((v, i) => v + ([-1.45, 0.25, -0.15][i] - v) * point);
      p.rEl = p.rEl.map((v, i) => v + ([-0.15, 0, 0][i] - v) * point);
      standPose(man, t, p);
      man.setFace(lerpFace(FACE.curious, { ...FACE.curious, smile: 0.9, asym: 0.4 }, point));
      const k = easeInOut(range(t, 0, 3.4));
      const s = shake(t, 1.0, 17);
      place(c, [lerp(0.08, 0.15, k) + s[0] * 0.3, lerp(1.95, 2.0, k) + s[1] * 0.3, lerp(0.9, 3.3, k)], [0, lerp(1.92, 1.55, k), 0]);
      return { dof: dofAt(c, V(0, 1.9, 0), lerp(0.004, 0.0012, k), 0.008), bloom: 0.35 };
    },
  };
}

export const SHOTS = [
  { start: 0.0, end: 2.32, build: shotGlobeStop },
  { start: 2.32, end: 3.52, build: shotSurprised },
  { start: 3.52, end: 7.32, build: shotSmug },
  { start: 7.32, end: 10.08, build: shotTiny },
  { start: 10.08, end: 14.4, build: shotLayers },
  { start: 14.4, end: 18.0, build: shotGauge },
  { start: 18.0, end: 20.64, build: shotSlam },
  { start: 20.64, end: 23.92, build: shotFly },
  { start: 23.92, end: 25.92, build: shotTumble },
  { start: 25.92, end: 29.28, build: shotWind },
  { start: 29.28, end: 32.08, build: shotWave },
  { start: 32.08, end: 34.8, build: shotPoles },
  { start: 34.8, end: 35.84, build: shotPoleMan },
  { start: 35.84, end: DURATION + 1, build: shotAsk },
];
