// StickSolid · what turns a stick-figure project into a StickSolid video. Loaded by src/index.html after the shots and
// before the skill's main.js (catena/adatta_stick.py puts it there).
// - catena.json (written by catena/produci.py): the time warp of the shots onto the new voice, the duration and the
//   captions. The skill's own words.js / warp.js are no longer used.
// - Everyone in Stick's world has thick legs and arms (identita/PERSONAGGI-SECONDARI.md: legW 2.2, armW 1.4).
// - The captions in the StickSolid style (identita/testi/TESTI.md): Poppins Bold, lowercase, white with an ink outline
//   20% of the letter, 1-2 words, numbers in yellow (at most one yellow word on screen), centre at y 1335.
(function () {
  let CAT = null;
  try {
    const x = new XMLHttpRequest(); x.open('GET', '../catena.json?' + Date.now(), false); x.send();
    if (x.status === 200) CAT = JSON.parse(x.responseText);
  } catch (e) { CAT = null; }
  window.CATENA = CAT;
  // the skill's warp: anchors [old s, new s]; catena.json has [new s, old s]
  if (CAT && CAT.warp) window.WARP = { anchors: CAT.warp.map(([n, o]) => [o, n]), new_end: CAT.duration - 0.6 };
  else if (CAT) window.WARP = { anchors: [[0, 0], [1, 1]], new_end: CAT.duration - 0.6 };
  if (typeof WORDS === 'undefined') window.WORDS = [];                       // the skill's own caption chunks stay empty

  // thick limbs for every stick person, unless a shot asks otherwise
  const base = drawStick;
  window.drawStick = drawStick = function (ctx, o) { return base(ctx, Object.assign({ legW: 2.2, armW: 1.4 }, o)); };

  const YEL = '#ffc93c';
  const capText = (s) => s.toLowerCase().replace(/[-–—]/g, ' ').replace(/[^\p{L}\p{N}%,.:' ]/gu, '').replace(/[.,:](?!\d)/g, '').replace(/\s+/g, ' ').trim();
  window.drawCaptionSS = function (ctx, t) {
    if (!CAT || !CAT.captions) return;
    let c = null;
    for (const x of CAT.captions) if (t >= x[0]) c = x; else break;
    if (!c || (c[2] != null && t >= c[2])) return;
    const words = capText(c[1]).split(' ').filter(Boolean); if (!words.length) return;
    const keys = new Set((c[3] || []).map((w) => w.toLowerCase()));
    const key = words.findIndex((w) => /\d/.test(w) || keys.has(w.replace(/[^a-z0-9']/g, '')));
    const size = 92, sp = size * 0.28;
    const k = Math.max(0, Math.min(1, (t - c[0]) / 0.1)), sc = 0.82 + 0.18 * backOut(k);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.translate(540, 1335); ctx.scale(sc, sc);
    ctx.font = `700 ${size}px Poppins`;
    const widths = words.map((w) => ctx.measureText(w).width), total = widths.reduce((a, b) => a + b, 0) + sp * (words.length - 1);
    const fit = Math.min(1, 860 / total); ctx.scale(fit, fit);              // never wider than the safe area
    const xs = words.map((w, i) => -total / 2 + sum(widths, i) + sp * i + widths[i] / 2);
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 5;     // outline with a soft shadow, then the clean letters
    words.forEach((w, i) => text(ctx, w, xs[i], 0, size, i === key ? YEL : '#fff', INK, size * 0.2, 'Poppins', 700));
    ctx.shadowColor = 'transparent';
    words.forEach((w, i) => text(ctx, w, xs[i], 0, size, i === key ? YEL : '#fff', null, 0, 'Poppins', 700));
    ctx.restore();
  };
  function sum(a, n) { let s = 0; for (let i = 0; i < n; i++) s += a[i]; return s; }
})();
