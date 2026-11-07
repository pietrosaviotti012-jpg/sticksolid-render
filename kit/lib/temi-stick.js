// StickSolid · the colour themes for Stick's 2D world (classic script, after lib.js).
// drawThemeBack(ctx, theme, x, y, w, h, groundY, lightAt)  -> sky, ground, the light behind Stick, stars/rain/snow/paper
// drawThemeFront(ctx, theme, x, y, w, h, t)                -> what goes over the characters: rain, snow, vignette, red tint
// theme is one entry of temi.json (its "stick" part). In the dark themes the light (moon, lamp, planet) must sit
// behind Stick: his ink-black arms and legs disappear on a dark sky otherwise.
function drawThemeBack(ctx, th, x, y, w, h, groundY, lightAt) {
  const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
  if (th.stars) { const R = rng(11); for (let i = 0; i < 70; i++) { circle(ctx, x + R() * w, y + R() * (groundY - y), 1 + R() * 2.4); ctx.fillStyle = `rgba(255,255,255,${0.4 + R() * 0.6})`; ctx.fill(); } }
  if (th.light) {
    const [lx, ly, lr] = lightAt;
    const glow = ctx.createRadialGradient(lx, ly, lr * 0.2, lx, ly, lr * 2.6);
    glow.addColorStop(0, th.light.color + 'cc'); glow.addColorStop(1, th.light.color + '00');
    ctx.fillStyle = glow; ctx.fillRect(x, y, w, h);
    if (th.light.kind === 'moon' || th.light.kind === 'sun' || th.light.kind === 'planet') { circle(ctx, lx, ly, lr); ctx.fillStyle = th.light.color; ctx.fill(); }
    if (th.light.kind === 'planet') { ctx.save(); ctx.translate(lx, ly); ctx.rotate(-0.35); ellipse(ctx, 0, 0, lr * 1.6, lr * 0.32); ctx.lineWidth = lr * 0.08; ctx.strokeStyle = '#ffffffaa'; ctx.stroke(); ctx.restore(); }
    if (th.light.kind === 'moon') { circle(ctx, lx + lr * 0.3, ly - lr * 0.2, lr * 0.18); ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fill(); }
  }
  ctx.fillStyle = th.ground; ctx.fillRect(x, groundY, w, y + h - groundY);
  if (th.paper) { const R = rng(5); for (let i = 0; i < 900; i++) { ctx.fillStyle = `rgba(90,60,20,${R() * 0.06})`; ctx.fillRect(x + R() * w, y + R() * h, 2, 2); } }
}
function drawThemeFront(ctx, th, x, y, w, h, t = 0) {
  if (th.rain) { const R = rng(3); ctx.strokeStyle = 'rgba(230,236,245,.55)'; ctx.lineWidth = 2; for (let i = 0; i < 90; i++) { const px = x + R() * w, py = y + ((R() * h + t * 900) % h); line(ctx, px, py, px - 6, py + 26, 2, 'rgba(230,236,245,.55)'); } }
  if (th.snow) { const R = rng(4); for (let i = 0; i < 80; i++) { const px = x + R() * w + Math.sin(t * 2 + i) * 6, py = y + ((R() * h + t * 120) % h); circle(ctx, px, py, 2 + R() * 3); ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill(); } }
  if (th.tint) { ctx.fillStyle = th.tint + '22'; ctx.fillRect(x, y, w, h); }
  if (th.vignette) {
    const v = ctx.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${th.vignette})`); ctx.fillStyle = v; ctx.fillRect(x, y, w, h);
  }
}
