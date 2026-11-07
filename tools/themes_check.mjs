// Are the colour themes readable? node tools/themes_check.mjs
// WCAG contrast: the caption highlight (em) on the theme's darkest and on its near sheet ≥ 4.5; the fox against the near sheet
// ≥ 3 (she must always stand out); the glow against the far sheet ≥ 2 (a hole of light must look lit).
import { THEMES, FOX } from '../engine/kit/themes.js';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4));
  return .2126 * c[0] + .7152 * c[1] + .0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

let bad = 0, n = 0;
for (const [fmt, moods] of Object.entries(THEMES)) for (const [mood, T] of Object.entries(moods)) {
  n++;
  const tests = [['em/sky', ratio(T.em, T.sky[0][1]), 4.5], ['em/near', ratio(T.em, T.near), 4.5], ['volpe/near', ratio(FOX, T.near), 3], ['luce/far', ratio(T.glow, T.far), 2]];
  for (const [name, r, min] of tests) if (r < min) { bad++; console.log(`${fmt}/${mood}: ${name} ${r.toFixed(2)} < ${min}`); }
}
console.log(`${n} temi controllati, ${bad} problemi`);
process.exit(bad ? 1 : 0);
