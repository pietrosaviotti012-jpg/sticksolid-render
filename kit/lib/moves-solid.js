// StickSolid · Solid's ready-made moves (ES module, for three.js shots with lib/human.js).
// solidMove(name, t) -> { pose, face, root: [x, y, z] offset in metres, turn } ; spread pose into man.setPose().
// Joint angles are [x, y, z] in radians ('YXZ'): x on a hip or shoulder swings the limb forward (negative)
// or back (positive); z on a shoulder lifts the arm out to the side (+ for the left arm, - for the right).
const S = Math.sin, PI = Math.PI;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeIO = (t) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const back = (t) => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
const REST = { lSh: [0, 0, 0.12], rSh: [0, 0, -0.12], lEl: [-0.15, 0, 0], rEl: [-0.15, 0, 0] };
const SMILE = { brow: 0.6, tilt: 0.7, lid: 0.8, mouth: 'smile', eyes: 1.35 };

export const SOLID_MOVES = {
  idle: { len: 3, f(t) {
    const b = S(t * PI * 2 / 3);
    return { pose: { ...REST, chest: [0.015 * b, 0, 0], head: [0.02 * b, 0.05 * S(t * 0.9), 0] }, face: { ...SMILE, lid: (t % 3) > 2.85 ? -1 : 0.8 } };
  } },
  walk: { len: 1, f(t) {
    const p = t * PI * 2, s = S(p), c = Math.cos(p);
    return { pose: { lHip: [-0.45 * s, 0, 0], rHip: [0.45 * s, 0, 0], lKn: [Math.max(0, 0.7 * c), 0, 0], rKn: [Math.max(0, -0.7 * c), 0, 0],
      lSh: [0.4 * s, 0, 0.1], rSh: [-0.4 * s, 0, -0.1], lEl: [-0.35, 0, 0], rEl: [-0.35, 0, 0], spine: [0.04, 0.06 * s, 0], drop: -0.02 * Math.abs(c) },
      face: SMILE };
  } },
  run: { len: 0.6, f(t) {
    const p = t * PI * 2 / 0.6, s = S(p), c = Math.cos(p);
    return { pose: { lHip: [-0.9 * s, 0, 0], rHip: [0.9 * s, 0, 0], lKn: [Math.max(0.2, 1.3 * c), 0, 0], rKn: [Math.max(0.2, -1.3 * c), 0, 0],
      lSh: [0.9 * s, 0, 0.15], rSh: [-0.9 * s, 0, -0.15], lEl: [-1.4, 0, 0], rEl: [-1.4, 0, 0], spine: [0.18, 0.1 * s, 0], drop: -0.05 * Math.abs(c) + 0.03 },
      face: { brow: 0.8, tilt: 0.8, lid: 0.9, open: 0.35, eyes: 1.35 } };
  } },
  jump: { len: 1.4, f(t) {
    t = Math.min(t, 1.4);
    const crouch = t < 0.25 ? easeIO(t / 0.25) : t < 0.35 ? 1 - (t - 0.25) / 0.1 : 0;
    const air = t >= 0.3 && t < 0.95 ? S((t - 0.3) / 0.65 * PI) : 0, land = t >= 0.95 && t < 1.2 ? S((t - 0.95) / 0.25 * PI) : 0;
    const bend = Math.max(crouch, land * 0.8);
    return { pose: { lHip: [-0.9 * bend - 0.3 * air, 0, 0.05], rHip: [-0.9 * bend - 0.3 * air, 0, -0.05], lKn: [1.6 * bend + 0.6 * air, 0, 0], rKn: [1.6 * bend + 0.6 * air, 0, 0],
      lAn: [-0.7 * bend, 0, 0], rAn: [-0.7 * bend, 0, 0], lSh: [-0.3 * bend, 0, 0.2 + 2.4 * air], rSh: [-0.3 * bend, 0, -0.2 - 2.4 * air], lEl: [-0.3, 0, 0], rEl: [-0.3, 0, 0],
      spine: [0.25 * bend, 0, 0], drop: -0.3 * bend },
      root: [0, 0.55 * air, 0], face: air > 0.3 ? { ...SMILE, lid: 0.15, grin: 1.2 } : SMILE };
  } },
  wave: { len: 1, f(t) {
    const w = S(t * PI * 4);
    return { pose: { ...REST, lSh: [-0.25, 0, 2.05], lEl: [0, 0, 0.9 + 0.35 * w], head: [0.04, 0.1, -0.06] }, face: { ...SMILE, lid: 0.3, grin: 1.15 } };
  } },
  surprise: { len: 1.4, f(t) {
    t = Math.min(t, 1.4); const k = back(clamp01(t / 0.25)), tr = t > 0.3 ? 0.01 * S(t * 60) : 0;
    return { pose: { lSh: [-1.2 * k, 0, 0.35], rSh: [-1.2 * k, 0, -0.35], lEl: [-0.6 * k, 0, 0], rEl: [-0.6 * k, 0, 0], spine: [-0.12 * k, 0, 0], head: [-0.12 * k + tr, 0, 0],
      lHip: [0.15 * k, 0, 0], rHip: [-0.1 * k, 0, 0] },
      root: [0, 0.06 * S(clamp01(t / 0.35) * PI), -0.15 * k], face: { brow: 1, tilt: 0.8, lid: 1, open: 0.8 * k, eyes: 1.35 } };
  } },
  shrug: { len: 1.6, f(t) {
    const u = t % 1.6, k = S(clamp01(u / 0.5) * PI / 2) * (u < 1.2 ? 1 : 1 - (u - 1.2) / 0.4);
    return { pose: { lSh: [-0.3 * k, 0, 0.12 + 0.4 * k], rSh: [-0.3 * k, 0, -0.12 - 0.4 * k], lEl: [-1.6 * k, 0, -0.5 * k], rEl: [-1.6 * k, 0, 0.5 * k], head: [0, 0, 0.12 * k], chest: [0, 0, 0] },
      face: { brow: 0.6, tilt: 0.4, lid: 0.8, one: 1, mouth: 'smirk', eyes: 1.35 } };
  } },
  point: { len: 1.2, f(t) {
    const k = back(clamp01(t / 0.3));
    return { pose: { ...REST, rSh: [-0.25 * k, 0, -0.12 - 1.33 * k], rEl: [0, 0, -0.15 * k], head: [0, -0.35 * k, 0], spine: [0, -0.1 * k, 0] },
      face: { ...SMILE, look: [-0.8, 0], grin: 1.1 } };
  } },
  think: { len: 2, f(t) {
    const n = S(t * PI);
    return { pose: { lSh: [0.1, 0, 0.2], lEl: [-1.4, 0.6, 0], rSh: [-1.1, 0, -0.35], rEl: [-2.1, 0, 0.3], head: [0.06 + 0.03 * n, 0.15, 0.08] },
      face: { brow: 0.4, tilt: 0.3, lid: 0.5, mouth: 'flat', one: -1, look: [-0.7, -0.8], eyes: 1.35 } };
  } },
  cheer: { len: 0.7, f(t) {
    const u = 0.5 + 0.5 * S(t * PI * 2 / 0.7);
    return { pose: { lSh: [-0.2, 0, 2.3 + 0.35 * u], rSh: [-0.2, 0, -2.3 - 0.35 * u], lEl: [0, 0, 0.6 - 0.5 * u], rEl: [0, 0, -0.6 + 0.5 * u], head: [-0.1, 0, 0] },
      root: [0, 0.05 * u, 0], face: { ...SMILE, lid: 0.15, grin: 1.2 } };
  } },
};
export function solidMove(name, t) { return SOLID_MOVES[name].f(t); }
