// ---------- stick figure character ----------
const HEAD = '#f6f2ea', HEAD_SH = '#dcd5ca';
const PAL = {
  red: ['#e0392f', '#f6f1e8'], blue: ['#2f63c9', '#f6f1e8'], yellow: ['#f2b52a', '#f2b52a'],
  green: ['#3fa35b', '#3fa35b'], navy: ['#2a3f8f', '#f6f1e8'], purple: ['#7a4bc4', '#7a4bc4'],
};
function limbPts(ox, oy, side, a1, a2, l1, l2) {
  const ex = ox + side * Math.sin(a1) * l1, ey = oy + Math.cos(a1) * l1;
  const b = a1 + a2; const hx = ex + side * Math.sin(b) * l2, hy = ey + Math.cos(b) * l2;
  return [[ox, oy], [ex, ey], [hx, hy], b];
}
function drawStick(ctx, o) {
  const s = o.s || 400, flip = o.flip || 1;
  const sil = o.sil; // silhouette colour or undefined
  const lw = .017, limbW = .028;
  // StickSolid: legW / armW make the legs and arms thicker (the mascot uses legW 2, armW 1.35)
  const legW = limbW * (o.legW || 1), armW = limbW * (o.armW || 1), footK = Math.sqrt(o.legW || 1), handK = Math.sqrt(o.armW || 1);
  const ink = sil || INK;
  const bounce = o.bob || 0;
  ctx.save();
  ctx.translate(o.x, o.y);
  if (o.alpha != null) ctx.globalAlpha = o.alpha;
  // contact shadow
  if (o.shadow !== false && !sil) {
    ctx.save(); ctx.scale(s, s); ellipse(ctx, 0, 0, .2 * (o.shadowScale || 1), .035 * (o.shadowScale || 1)); ctx.fillStyle = 'rgba(40,20,30,.22)'; ctx.fill(); ctx.restore();
  }
  ctx.scale(s * flip, s * (o.squash || 1)); ctx.scale(1, 1);
  ctx.rotate(o.lean || 0);
  ctx.translate(0, bounce);
  const legs = o.legs || { L: [.12, -.05], R: [.12, -.05] };
  const arms = o.arms || { L: [.35, -.15], R: [.35, -.15] };
  const hipY = -.3, shY = -.535;
  // legs
  const legP = {};
  for (const [k, side] of [['L', -1], ['R', 1]]) {
    const [a1, a2] = legs[k];
    const p = limbPts(side * .055, hipY, side, a1, a2, .155, .155); legP[k] = p;
    ctx.beginPath(); ctx.moveTo(...p[0]); ctx.lineTo(...p[1]); ctx.lineTo(...p[2]);
    ctx.lineWidth = legW; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    ellipse(ctx, p[2][0] + side * .022 * footK, p[2][1] + .004, .042 * footK, .022 * footK, 0); ctx.fillStyle = ink; ctx.fill();
  }
  // torso (bean)
  const tw = .25, tTop = -.62, tBot = -.27;
  const torso = () => { ctx.beginPath(); ctx.roundRect(-tw / 2, tTop, tw, tBot - tTop, [.1, .1, .12, .12]); };
  const cols = o.cols || PAL.red;
  if (sil) { torso(); ctx.fillStyle = sil; ctx.fill(); }
  else {
    torso(); ctx.fillStyle = cols[0]; ctx.fill();
    if (cols[1] !== cols[0]) {
      ctx.save(); torso(); ctx.clip(); ctx.fillStyle = cols[1];
      for (let i = 0; i < 6; i++) ctx.fillRect(-tw, tTop + .035 + i * .07, tw * 2, .035);
      ctx.restore();
    }
    if (o.vest) { ctx.save(); torso(); ctx.clip(); ctx.fillStyle = o.vest; ctx.fillRect(-tw / 2 - .01, tTop, .07, 1); ctx.fillRect(tw / 2 - .06, tTop, .07, 1); ctx.restore(); }
    if (o.belt !== false) { ctx.save(); torso(); ctx.clip(); ctx.fillStyle = '#4a2c1c'; ctx.fillRect(-tw, -.34, tw * 2, .035); ctx.fillStyle = '#e8c04a'; ctx.fillRect(-.022, -.343, .044, .041); ctx.restore(); }
    shadeShape(ctx, torso, 1, .18, .38, [-tw / 2, tTop, tw, tBot - tTop]);
    torso(); fillStroke(ctx, null, lw);
  }
  // arms
  const handP = {};
  for (const [k, side] of [['L', -1], ['R', 1]]) {
    const al = o.armLen || 1;
    let a1, a2;
    if (arms[k].ik) [a1, a2] = ik(side, side * .1, shY, arms[k].ik[0], arms[k].ik[1], .14 * al, .13 * al, arms[k].bend || 1);
    else [a1, a2] = arms[k];
    const p = limbPts(side * .1, shY, side, a1, a2, .14 * al, .13 * al); handP[k] = p;
    if (o.propBehind) o.propBehind(ctx, k, p[2], p[3], side);
    ctx.beginPath(); ctx.moveTo(...p[0]); ctx.lineTo(...p[1]); ctx.lineTo(...p[2]);
    ctx.lineWidth = armW; ctx.strokeStyle = ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
    if (o.prop) o.prop(ctx, k, p[2], p[3], side);
    circle(ctx, p[2][0], p[2][1], .03 * handK); ctx.fillStyle = ink; ctx.fill();
  }
  // head
  const hr = .19, hx = 0, hy = -.765;
  ctx.save();
  // StickSolid: headScale shrinks or grows the head around the neck, so the body can be bigger next to a 3D character
  if (o.headScale && o.headScale !== 1) { ctx.translate(0, hy + hr); ctx.scale(o.headScale, o.headScale); ctx.translate(0, -(hy + hr)); }
  ctx.translate(hx, hy); ctx.rotate(o.headTilt || 0); ctx.translate(-hx, -hy);
  // StickSolid secondary characters: hair behind the head (long, pony, bun)
  const hairCol = o.hairCol || '#4a2c1c';
  if (!sil && o.hair) drawHairBack(ctx, o.hair, hx, hy, hr, hairCol, lw);
  if (sil) { circle(ctx, hx, hy, hr); ctx.fillStyle = sil; ctx.fill(); }
  else {
    circle(ctx, hx, hy, hr); ctx.fillStyle = HEAD; ctx.fill();
    ctx.save(); circle(ctx, hx, hy, hr); ctx.clip(); circle(ctx, hx - .05, hy - .045, hr * 1.02); ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.beginPath(); ctx.arc(hx, hy, hr + .01, 0, TAU); ctx.arc(hx - .045, hy - .04, hr * 1.0, 0, TAU, true); ctx.fillStyle = HEAD_SH; ctx.fill(); ctx.restore();
    if (o.blush) { ellipse(ctx, hx - .1, hy + .06, .035, .02); ellipse(ctx, hx + .1, hy + .06, .035, .02); ctx.fillStyle = 'rgba(240,120,120,.35)'; ctx.fill(); }
    if (o.hair) drawHairTop(ctx, o.hair, hx, hy, hr, hairCol);
    if (o.beard) drawBeard(ctx, hx, hy, hr, o.beardCol || '#e8e4dc');
  }
  // hat
  const hat = o.hat || 'bandana';
  if (!sil) {
    if (hat === 'bandana') drawBandana(ctx, hx, hy, hr, o.hatCol || '#d8312b', o.dotCol || '#fff', lw);
    else if (hat === 'sailor') drawSailorHat(ctx, hx, hy, hr, lw);
    else if (hat === 'captain') drawCaptainHat(ctx, hx, hy, hr, lw);
    else if (hat === 'helmet' || hat === 'cap' || hat === 'tophat') drawExtraHat(ctx, hat, hx, hy, hr, o.hatCol, lw);
    // a hat drawn by the story's own scene files: hat 'tricorn' calls drawTricorn(ctx, hx, hy, hr, lw, hatCol)
    else if (hat !== 'none' && typeof globalThis['draw' + hat[0].toUpperCase() + hat.slice(1)] === 'function') globalThis['draw' + hat[0].toUpperCase() + hat.slice(1)](ctx, hx, hy, hr, lw, o.hatCol);
  }
  if (!sil) { circle(ctx, hx, hy, hr); fillStroke(ctx, null, lw); }
  if (!sil && o.hair === 'tuft') drawTufts(ctx, hx, hy, hr, hairCol, lw);
  // face
  drawFace(ctx, hx, hy, hr, o.face || {}, o, sil);
  if (!sil && o.glasses) drawGlasses(ctx, hx, hy, hr, o.face || {}, lw);
  ctx.restore();
  ctx.restore();
}
// ---------- StickSolid secondary characters: hair, beard, glasses, more hats ----------
// hair: 'short' | 'long' | 'pony' | 'bun' | 'curly' | 'tuft' (an old man's tufts over the ears)
function drawHairBack(ctx, kind, hx, hy, hr, col, lw) {
  if (kind === 'long') { rrect(ctx, hx - hr * 1.12, hy - hr * .55, hr * 2.24, hr * 1.75, [hr * .9, hr * .9, hr * .35, hr * .35]); fillStroke(ctx, col, lw); }
  if (kind === 'pony') { ctx.save(); ctx.translate(hx + hr * .95, hy - hr * .35); ctx.rotate(.5); ellipse(ctx, 0, hr * .45, hr * .26, hr * .62); fillStroke(ctx, col, lw); ctx.restore(); }
  if (kind === 'bun') { circle(ctx, hx, hy - hr * 1.08, hr * .36); fillStroke(ctx, col, lw); }
}
function drawHairTop(ctx, kind, hx, hy, hr, col) {
  if (kind === 'tuft') return;
  ctx.save(); circle(ctx, hx, hy, hr); ctx.clip(); ctx.fillStyle = col;
  if (kind === 'curly') {
    for (let i = -4; i <= 4; i++) { circle(ctx, hx + i * hr * .24, hy - hr * .82 + Math.abs(i) * hr * .05, hr * .2); ctx.fill(); }
  } else {
    // a cap of hair over the top third, with a side parting
    ctx.beginPath(); ctx.moveTo(hx - hr * 1.1, hy - hr * .25);
    ctx.quadraticCurveTo(hx - hr * .4, hy - hr * .62, hx + hr * .15, hy - hr * .45);
    ctx.quadraticCurveTo(hx + hr * .7, hy - hr * .28, hx + hr * 1.1, hy - hr * .1);
    ctx.lineTo(hx + hr * 1.1, hy - hr * 1.2); ctx.lineTo(hx - hr * 1.1, hy - hr * 1.2); ctx.closePath(); ctx.fill();
    if (kind === 'long' || kind === 'pony') { ctx.fillRect(hx - hr * 1.1, hy - hr * .3, hr * .2, hr * 1.2); ctx.fillRect(hx + hr * .9, hy - hr * .3, hr * .2, hr * 1.2); }
  }
  ctx.fillStyle = 'rgba(255,255,255,.18)'; ellipse(ctx, hx - hr * .35, hy - hr * .78, hr * .28, hr * .08, -.3); ctx.fill();
  ctx.restore();
}
function drawTufts(ctx, hx, hy, hr, col, lw) {
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
    ellipse(ctx, hx + s * hr * (1.0 + i * .02), hy - hr * (.15 - i * .18), hr * .13, hr * .09, s * .4); fillStroke(ctx, col, lw * .7);
  }
}
function drawBeard(ctx, hx, hy, hr, col) {
  ctx.save(); circle(ctx, hx, hy, hr); ctx.clip();
  ctx.beginPath(); ctx.moveTo(hx - hr * 1.05, hy + hr * .05); ctx.quadraticCurveTo(hx - hr * .5, hy + hr * .32, hx - hr * .3, hy + hr * .3);
  ctx.quadraticCurveTo(hx, hy + hr * .2, hx + hr * .3, hy + hr * .3); ctx.quadraticCurveTo(hx + hr * .5, hy + hr * .32, hx + hr * 1.05, hy + hr * .05);
  ctx.lineTo(hx + hr * 1.1, hy + hr * 1.1); ctx.lineTo(hx - hr * 1.1, hy + hr * 1.1); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  ctx.restore();
}
function drawGlasses(ctx, hx, hy, hr, f, lw) {
  const turn = f.turn || 0, ex = .072, ey = hy - .005, r = .056;
  for (const s of [-1, 1]) { circle(ctx, hx + s * ex + turn * .06, ey, r); ctx.lineWidth = .011; ctx.strokeStyle = INK; ctx.stroke(); }
  line(ctx, hx - ex + r + turn * .06, ey - .004, hx + ex - r + turn * .06, ey - .004, .011);
}
function drawExtraHat(ctx, kind, hx, hy, hr, col, lw) {
  if (kind === 'helmet') {   // a round army helmet
    col = col || '#5f6b3a';
    ctx.beginPath(); ctx.arc(hx, hy - hr * .18, hr * 1.06, Math.PI, 0); ctx.closePath(); fillStroke(ctx, col, lw);
    rrect(ctx, hx - hr * 1.25, hy - hr * .26, hr * 2.5, hr * .2, hr * .1); fillStroke(ctx, col, lw);
    ctx.save(); ctx.beginPath(); ctx.arc(hx, hy - hr * .18, hr * 1.06, Math.PI, 0); ctx.clip(); ctx.fillStyle = 'rgba(30,20,10,.18)'; ctx.fillRect(hx + hr * .3, hy - hr * 1.4, hr, hr * 1.4); ctx.restore();
  } else if (kind === 'cap') { // a baseball cap, peak to the right
    col = col || '#3fa35b';
    ctx.beginPath(); ctx.arc(hx, hy - hr * .3, hr * .98, Math.PI, 0); ctx.closePath(); fillStroke(ctx, col, lw);
    ctx.beginPath(); ctx.moveTo(hx + hr * .5, hy - hr * .32); ctx.quadraticCurveTo(hx + hr * 1.3, hy - hr * .42, hx + hr * 1.45, hy - hr * .25); ctx.lineTo(hx + hr * .5, hy - hr * .22); ctx.closePath(); fillStroke(ctx, col, lw);
    circle(ctx, hx, hy - hr * 1.28, hr * .08); fillStroke(ctx, col, lw * .7);
  } else if (kind === 'tophat') { // the villain's top hat
    col = col || '#1e1a24';
    rrect(ctx, hx - hr * .62, hy - hr * 1.95, hr * 1.24, hr * 1.2, hr * .08); fillStroke(ctx, col, lw);
    rrect(ctx, hx - hr * .62, hy - hr * 1.0, hr * 1.24, hr * .2, 0); fillStroke(ctx, '#7a2a3a', lw);
    rrect(ctx, hx - hr * 1.05, hy - hr * .86, hr * 2.1, hr * .16, hr * .08); fillStroke(ctx, col, lw);
  }
}
function drawBandana(ctx, hx, hy, hr, col, dot, lw) {
  const cut = hy - hr * .18;
  const shape = () => {
    ctx.beginPath(); ctx.arc(hx, hy, hr + .006, Math.PI + .52, -.52 + 0);
    ctx.quadraticCurveTo(hx + hr * .2, cut + .05, hx, cut + .03);
    ctx.quadraticCurveTo(hx - hr * .5, cut + .02, hx - hr * .86, cut + .02); ctx.closePath();
  };
  // knot tails (left side)
  ctx.beginPath(); ctx.moveTo(hx - hr * .85, cut - .01); ctx.quadraticCurveTo(hx - hr * 1.35, cut + .02, hx - hr * 1.32, cut + .12); ctx.lineTo(hx - hr * 1.12, cut + .05); ctx.closePath(); fillStroke(ctx, col, lw);
  ctx.beginPath(); ctx.moveTo(hx - hr * .85, cut - .01); ctx.quadraticCurveTo(hx - hr * 1.45, cut - .06, hx - hr * 1.5, cut + .03); ctx.lineTo(hx - hr * 1.2, cut + .01); ctx.closePath(); fillStroke(ctx, col, lw);
  shape(); ctx.fillStyle = col; ctx.fill();
  ctx.save(); shape(); ctx.clip();
  ctx.fillStyle = dot; const r = rng(7);
  for (let i = -3; i <= 3; i++) for (let j = 0; j < 3; j++) { circle(ctx, hx + i * .055 + (j % 2) * .027, hy - hr + .03 + j * .045, .012); ctx.fill(); }
  ctx.fillStyle = 'rgba(40,0,30,.18)'; ctx.fillRect(hx + hr * .35, hy - hr - .02, hr, hr);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; ellipse(ctx, hx - hr * .35, hy - hr * .78, hr * .25, hr * .08, -.3); ctx.fill();
  ctx.restore();
  shape(); fillStroke(ctx, null, lw);
  circle(ctx, hx - hr * .9, cut + .0, .03); fillStroke(ctx, col, lw);
}
function drawSailorHat(ctx, hx, hy, hr, lw) {
  const top = hy - hr * .78;
  ctx.beginPath(); ctx.moveTo(hx - hr * .85, top + .02); ctx.quadraticCurveTo(hx - hr * .75, top - .2, hx, top - .21); ctx.quadraticCurveTo(hx + hr * .75, top - .2, hx + hr * .85, top + .02); ctx.closePath(); fillStroke(ctx, '#f8f8f6', lw);
  rrect(ctx, hx - hr * .95, top - .015, hr * 1.9, .05, .02); fillStroke(ctx, '#2a4f9e', lw);
  ctx.save(); ctx.beginPath(); ctx.moveTo(hx - hr * .85, top + .02); ctx.quadraticCurveTo(hx - hr * .7, top - .12, hx, top - .13); ctx.quadraticCurveTo(hx + hr * .7, top - .12, hx + hr * .85, top + .02); ctx.closePath(); ctx.clip(); ctx.fillStyle = 'rgba(30,40,80,.12)'; ctx.fillRect(hx + hr * .3, top - .2, hr, .3); ctx.restore();
}
function drawCaptainHat(ctx, hx, hy, hr, lw) {
  const top = hy - hr * .7;
  ctx.beginPath(); ctx.moveTo(hx - hr * 1.35, top + .02); ctx.quadraticCurveTo(hx - hr * .6, top - .2, hx, top - .07); ctx.quadraticCurveTo(hx + hr * .6, top - .2, hx + hr * 1.35, top + .02); ctx.quadraticCurveTo(hx, top + .06, hx - hr * 1.35, top + .02); fillStroke(ctx, '#2b2230', lw);
  ctx.beginPath(); ctx.moveTo(hx - hr * 1.2, top + .0); ctx.quadraticCurveTo(hx, top + .04, hx + hr * 1.2, top); ctx.lineWidth = .012; ctx.strokeStyle = '#e8c04a'; ctx.stroke();
}
function drawFace(ctx, hx, hy, hr, f, o, sil) {
  const turn = f.turn || 0;
  const ex = .072, ey = hy - .005, er = f.eyeR || .042;
  const look = f.look || [0, 0];
  const patch = o.patch; // {pos:-1..1, lift:0..1}
  const kind = f.eyes || 'normal';
  const glow = sil && o.eyesGlow;
  if (sil && !glow) return;
  for (const side of [-1, 1]) {
    const x = hx + side * ex + turn * .06, y = ey;
    // covered by patch?
    if (patch && Math.abs(patch.pos - side) < .35 && (patch.lift || 0) < .35) continue;
    const blink = f.blink || 0;
    const k = (f.eyesL && side < 0) ? f.eyesL : (f.eyesR && side > 0) ? f.eyesR : kind;
    ctx.lineWidth = .015; ctx.strokeStyle = glow ? '#fff' : INK; ctx.lineCap = 'round';
    if (k === 'squint') {
      ctx.beginPath(); ctx.moveTo(x - side * .035, y - .03); ctx.lineTo(x + side * .03, y); ctx.lineTo(x - side * .035, y + .03); ctx.stroke(); continue;
    }
    if (k === 'happy') { ctx.beginPath(); ctx.arc(x, y + .015, .032, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); continue; }
    if (k === 'spiral') {
      ctx.beginPath(); const rot = (o.t || 0) * 9 * side;
      for (let a = 0; a < 14; a += .3) { const r = .004 + a * .0032; const px = x + Math.cos(a + rot) * r, py = y + Math.sin(a + rot) * r; a ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.lineWidth = .011; ctx.stroke(); continue;
    }
    if (k === 'x') { const xc = glow ? '#fff' : INK; line(ctx, x - .03, y - .03, x + .03, y + .03, .018, xc); line(ctx, x + .03, y - .03, x - .03, y + .03, .018, xc); continue; }
    let r = k === 'wide' ? er * 1.3 : er;
    const pr = k === 'wide' ? r * .3 : (f.pupil || .45) * r;
    ctx.save();
    ellipse(ctx, x, y, r, r * (1 - blink * .92)); ctx.fillStyle = glow ? '#fff' : '#fff'; ctx.fill();
    if (!glow) { ctx.lineWidth = .013; ctx.strokeStyle = INK; ctx.stroke(); }
    ellipse(ctx, x, y, r, r * (1 - blink * .92)); ctx.clip();
    const px = x + look[0] * r * .45, py = y + look[1] * r * .45;
    circle(ctx, px, py, pr); ctx.fillStyle = INK; ctx.fill();
    if (pr > .012) { circle(ctx, px - pr * .35, py - pr * .35, pr * .3); ctx.fillStyle = '#fff'; ctx.fill(); }
    if (k === 'smug' || k === 'half') { ctx.fillStyle = sil || HEAD; ctx.fillRect(x - r - .01, y - r - .01, r * 2 + .02, r * (k === 'half' ? .9 : 1.05)); line(ctx, x - r, y - r * (k === 'half' ? .1 : -.05), x + r, y - r * (k === 'half' ? .1 : -.05), .014); }
    ctx.restore();
  }
  if (glow) return;
  // brows
  if (f.brow !== false) {
    const by = ey - .07 - (f.browUp || 0) * .03; const ba = f.browAng || 0;
    for (const side of [-1, 1]) {
      const x = hx + side * ex + turn * .06; const up = (f.browOne && side === f.browOne) ? .03 : 0;
      ctx.save(); ctx.translate(x, by - up); ctx.rotate(side * ba);
      ctx.beginPath(); ctx.moveTo(-.03, .006); ctx.quadraticCurveTo(0, -.01, .03, .006); ctx.lineWidth = .014; ctx.strokeStyle = INK; ctx.lineCap = 'round'; ctx.stroke(); ctx.restore();
    }
  }
  // mouth
  const mx = hx + turn * .06, my = hy + .085; const m = f.mouth || 'smile';
  ctx.lineWidth = .014; ctx.strokeStyle = INK; ctx.lineCap = 'round';
  if (m === 'smile') { ctx.beginPath(); ctx.arc(mx, my - .04, .045, .5, Math.PI - .5); ctx.stroke(); }
  else if (m === 'flat') { line(ctx, mx - .03, my, mx + .03, my, .014); }
  else if (m === 'frown') { ctx.beginPath(); ctx.arc(mx, my + .04, .04, Math.PI + .6, -.6); ctx.stroke(); }
  else if (m === 'smirk') { ctx.beginPath(); ctx.moveTo(mx - .035, my + .005); ctx.quadraticCurveTo(mx + .01, my + .02, mx + .045, my - .02); ctx.stroke(); }
  else if (m === 'o') { ellipse(ctx, mx, my + .005, .02, .026); fillStroke(ctx, '#5a1e24', .012); }
  else if (m === 'grin' || m === 'teeth') {
    const w = m === 'teeth' ? .06 : .058, h = m === 'teeth' ? .045 : .042;
    const mp = () => { ctx.beginPath(); if (m === 'grin') { ctx.moveTo(mx - w, my - .015); ctx.quadraticCurveTo(mx, my - .005, mx + w, my - .015); ctx.quadraticCurveTo(mx + w * .8, my + h * 1.5, mx, my + h * 1.3); ctx.quadraticCurveTo(mx - w * .8, my + h * 1.5, mx - w, my - .015); ctx.closePath(); } else ctx.roundRect(mx - w / 2 * 1.4, my - h / 2, w * 1.4, h, .012); };
    mp(); ctx.fillStyle = m === 'grin' ? '#7a2630' : '#fff'; ctx.fill(); ctx.save(); mp(); ctx.clip();
    if (m === 'teeth') { line(ctx, mx - w, my, mx + w, my, .008); for (let i = -2; i <= 2; i++) line(ctx, mx + i * .017, my - h, mx + i * .017, my + h, .008); }
    else { ctx.fillStyle = '#fff'; ctx.fillRect(mx - w, my - .03, w * 2, .03); ellipse(ctx, mx, my + h * 1.25, w * .5, h * .45); ctx.fillStyle = '#e8707a'; ctx.fill(); }
    ctx.restore(); mp(); ctx.lineWidth = .013; ctx.strokeStyle = INK; ctx.stroke();
  }
  // patch
  if (patch) {
    const side = patch.pos, lift = patch.lift || 0;
    const px = hx + side * ex + turn * .06, py = ey - lift * .1 - (1 - side * side) * .1;
    // strap
    ctx.beginPath(); ctx.moveTo(hx - hr * .98, hy - hr * .28 - (lift * .02)); ctx.quadraticCurveTo(px, py - .04, hx + hr * .98, hy - hr * .35 - lift * .02);
    ctx.lineWidth = .011; ctx.strokeStyle = INK; ctx.stroke();
    ellipse(ctx, px, py, .052, .046, side * .1); fillStroke(ctx, '#1e1a20', .012);
    ellipse(ctx, px - .015, py - .017, .016, .008, -.4); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  }
}
// common poses (angle pairs)
const POSE = {
  idle: { arms: { L: [.3, -.1], R: [.3, -.1] }, legs: { L: [.1, -.04], R: [.1, -.04] } },
  handsUp: { arms: { L: [2.5, .3], R: [2.5, .3] }, legs: { L: [.2, -.1], R: [.2, -.1] } },
  hips: { arms: { L: [.9, -2.2], R: [.9, -2.2] }, legs: { L: [.14, -.04], R: [.14, -.04] } },
};

function ik(side, sx, sy, tx, ty, l1, l2, bend = 1) {
  let vx = tx - sx, vy = ty - sy; let d = Math.hypot(vx, vy);
  const md = (l1 + l2) * .999; if (d > md) d = md; d = Math.max(d, Math.abs(l1 - l2) + 1e-4);
  const at = Math.atan2(side * vx, vy);
  const al = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const be = Math.acos(clamp((l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2), -1, 1));
  return [at + bend * al, -bend * (Math.PI - be)];
}
function sparkle(ctx, x, y, r, a = 1) {
  if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = r * .08; ctx.strokeStyle = 'rgba(255,230,120,.9)'; ctx.stroke(); ctx.restore();
}
function drawChest(ctx, x, y, s, open = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  // gold pile
  if (open > 0) { ctx.beginPath(); ctx.ellipse(0, -150, 120, 50 * open, 0, Math.PI, 0); fillStroke(ctx, '#f2c230', 5); for (let i = 0; i < 9; i++) { circle(ctx, -90 + i * 22, -152 - (i % 3) * 12 * open, 13); fillStroke(ctx, '#ffd84a', 3); } }
  rrect(ctx, -140, -150, 280, 150, 10); fillStroke(ctx, '#9a5a2a', 6);
  ctx.save(); rrect(ctx, -140, -150, 280, 150, 10); ctx.clip(); ctx.fillStyle = 'rgba(40,10,0,.25)'; ctx.fillRect(40, -160, 200, 200); ctx.restore();
  for (const bx of [-110, 90]) { rrect(ctx, bx, -150, 22, 150, 4); fillStroke(ctx, '#d9a84a', 4); }
  rrect(ctx, -22, -110, 44, 46, 6); fillStroke(ctx, '#e8c04a', 4);
  // lid (open, tilted back)
  ctx.save(); ctx.translate(0, -150); ctx.scale(1, -1 + (1 - open) * 2 * 0 + 1 * 0 + 1);
  ctx.beginPath(); ctx.moveTo(-145, 0); ctx.lineTo(145, 0); ctx.lineTo(150, -70 * open - 8); ctx.quadraticCurveTo(0, -120 * open - 10, -150, -70 * open - 8); ctx.closePath(); fillStroke(ctx, '#8a4f24', 6);
  ctx.restore();
  ctx.restore();
}
