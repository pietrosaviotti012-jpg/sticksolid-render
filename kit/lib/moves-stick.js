// StickSolid · the stickman's ready-made moves (classic script, loads after lib.js and chars.js).
// stickMove(name, t, extra) -> options to spread into drawStick: { arms, legs, bob, lean, squash, headTilt, face, dx, dy }
// t is seconds; every move loops (the length is in STICK_MOVES[name].len) except jump, surprise and point,
// which play once and hold. dx/dy move the whole figure (in units of the figure's size s).
const _s = Math.sin, _c = Math.cos, PI = Math.PI;
const STICK_MOVES = {
  // breathing, a small sway and a blink every 3 seconds
  idle: { len: 3, f(t) {
    const b = _s(t * PI * 2 / 3);
    return { bob: -.006 * (1 + b), arms: { L: [.3 + .03 * b, -.12], R: [.3 + .03 * b, -.12] }, legs: { L: [.1, -.04], R: [.1, -.04] },
      face: { blink: (t % 3) > 2.85 ? 1 : 0 } };
  } },
  // walking towards the camera's side: legs lift in turn, arms swing against them, the body bobs
  walk: { len: 1, f(t) {
    const p = t * PI * 2, l = _s(p), r = _s(p + PI);
    return { bob: -.018 * Math.abs(_s(p)), lean: .03 * _s(p),
      legs: { L: [.1 + .12 * Math.max(0, l), -.45 * Math.max(0, l)], R: [.1 + .12 * Math.max(0, r), -.45 * Math.max(0, r)] },
      arms: { L: [.35 + .25 * r, -.25], R: [.35 + .25 * l, -.25] } };   // walks on the spot: the shot moves x
  } },
  // running: faster, bigger, leaning forward, arms bent
  run: { len: .55, f(t) {
    const p = t * PI * 2 / .55, l = _s(p), r = _s(p + PI);
    return { bob: -.04 * Math.abs(_s(p)), lean: .12,
      legs: { L: [.15 + .3 * Math.max(0, l), -.9 * Math.max(0, l)], R: [.15 + .3 * Math.max(0, r), -.9 * Math.max(0, r)] },
      arms: { L: [.6 + .5 * r, -1.4], R: [.6 + .5 * l, -1.4] }, face: { eyes: 'normal', mouth: 'o' } };
  } },
  // crouch, jump, land with a squash
  jump: { len: 1.4, f(t) {
    t = Math.min(t, 1.4);
    const crouch = t < .25 ? ease(t / .25) : t < .35 ? 1 - (t - .25) / .1 : 0;
    const air = t >= .3 && t < .95 ? _s((t - .3) / .65 * PI) : 0;
    const land = t >= .95 && t < 1.2 ? _s((t - .95) / .25 * PI) : 0;
    return { dy: -.3 * air, squash: 1 - .12 * crouch - .1 * land + .06 * air, bob: .05 * crouch,
      legs: { L: [.25 * crouch + .15 * air, -.7 * crouch - .4 * air], R: [.25 * crouch + .15 * air, -.7 * crouch - .4 * air] },
      arms: { L: [.3 + 2.2 * air, -.1], R: [.3 + 2.2 * air, -.1] }, face: { eyes: air > .3 ? 'happy' : 'normal', mouth: air > .3 ? 'grin' : 'smile' } };
  } },
  // waving with the right hand
  wave: { len: 1, f(t) {
    const w = _s(t * PI * 2 * 2);
    // upper arm up and out, the forearm swings from side to side above the elbow
    return { headTilt: -.06, arms: { L: [.3, -.1], R: [2.15, -.45 + .4 * w] }, legs: { L: [.1, -.04], R: [.1, -.04] }, face: { eyes: 'happy', mouth: 'grin' } };
  } },
  // the scare: a hop back, hands up, eyes wide, then a tremble
  surprise: { len: 1.4, f(t) {
    t = Math.min(t, 1.4); const k = backOut(Math.min(1, t / .25)), tr = t > .3 ? .012 * _s(t * 70) : 0;
    return { dy: -.12 * _s(Math.min(1, t / .35) * PI), dx: -.08 * k + tr, lean: -.12 * k,
      arms: { L: [2.2 * k, .7 * k], R: [2.2 * k, .7 * k] }, legs: { L: [.18, -.1], R: [.18, -.1] },
      face: { eyes: 'wide', mouth: 'o', browUp: 1 } };
  } },
  // a shrug: elbows out, palms up, head to one side
  shrug: { len: 1.6, f(t) {
    const k = _s(Math.min(1, (t % 1.6) / .5) * PI / 2) * (t % 1.6 < 1.2 ? 1 : 1 - ((t % 1.6) - 1.2) / .4);
    return { headTilt: .15 * k, bob: -.01 * k, arms: { L: [.35 + 1.0 * k, -.12 - 1.3 * k], R: [.35 + 1.0 * k, -.12 - 1.3 * k] },
      legs: { L: [.1, -.04], R: [.1, -.04] }, face: { eyes: 'normal', mouth: 'flat', browOne: 1 } };
  } },
  // pointing to the right, with a small push
  point: { len: 1.2, f(t) {
    const k = backOut(Math.min(1, t / .3));
    return { lean: .04 * k, arms: { L: [.35, -.1], R: [.35 + 1.2 * k, .05] }, legs: { L: [.1, -.04], R: [.14, -.06] }, face: { mouth: 'grin', look: [.8, 0] } };
  } },
  // thinking: hand to the chin, eyes up, a slow nod
  think: { len: 2, f(t) {
    const n = _s(t * PI);
    // the right elbow goes out level with the shoulder and the forearm folds back so the hand sits under the chin
    return { headTilt: .1 + .03 * n, arms: { L: [.3, -.12], R: [1.6, -3.63] }, legs: { L: [.1, -.04], R: [.1, -.04] },
      face: { eyes: 'normal', mouth: 'flat', browOne: -1, look: [-.6, -.8] } };
  } },
  // cheering: both fists up and down
  cheer: { len: .7, f(t) {
    const u = .5 + .5 * _s(t * PI * 2 / .7);
    return { dy: -.04 * u, arms: { L: [2.4 + .4 * u, .5 - .4 * u], R: [2.4 + .4 * u, .5 - .4 * u] }, legs: { L: [.16, -.06], R: [.16, -.06] },
      face: { eyes: 'happy', mouth: 'grin' }, blush: true };
  } },
};
function stickMove(name, t, extra = {}) {
  const m = STICK_MOVES[name]; const o = m.f(t);
  return { ...o, ...extra, face: { ...(o.face || {}), ...(extra.face || {}) } };
}
// draw a stickman doing a move at (x, y) with size s: handles dx/dy and squash
function drawStickMove(ctx, name, t, base) {
  const o = stickMove(name, t, base.extra);
  drawStick(ctx, { ...base, ...o, x: base.x + (o.dx || 0) * base.s, y: base.y + (o.dy || 0) * base.s, squash: o.squash });
}
