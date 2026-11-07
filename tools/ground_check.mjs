// Do the figures touch the ground? node tools/ground_check.mjs <production folder>   prints JSON: { ok, shots: [...], detail }
// Figures are drawn on paper sheets at different depths. Their feet and the floor meet on screen only when the camera sits at the
// height of the floor and looks level: everywhere else perspective opens a gap between them, and the figure floats.
// This reads shots.js and flags the shots with a figure and a camera above or below the floor, or tilted.
// It reads the numbers written in cam: a camera built from variables is not checked, and looking at the frames is still needed.
import { readFileSync } from 'fs';
import { join } from 'path';

const FIGURE = /\b(person|neighbor|foxCameo|foxAt|fox|wolf|deer|cat|raven|owl|youLayers|copySheet)\s*\(/;
const NUM = '-?(?:\\d*\\.)?\\d+';
const KEY = new RegExp(`\\[\\s*${NUM}\\s*,\\s*\\[\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*,\\s*(${NUM})\\s*\\]\\s*\\]`, 'g');
const src = readFileSync(join(process.argv[2], 'shots.js'), 'utf8');
const parts = src.split(/(?=\{\s*id:\s*'S\d+')/).slice(1);
const shots = [];
for (const part of parts) {
  if (!FIGURE.test(part)) continue;
  const id = /id:\s*'(S\d+)'/.exec(part)[1];
  const by = [...part.matchAll(/\bby:\s*(-?(?:\d*\.)?\d+)/g)].map((m) => +m[1]);
  const floor = by.length ? by.sort((a, b) => a - b)[Math.floor(by.length / 2)] : 0;   // the height most figures stand on in this shot
  const keys = [...(/\bcam:\s*\[[\s\S]*?\]\s*\]\s*\]/.exec(part)?.[0] || '').matchAll(KEY)].map((m) => m.slice(1).map(Number));
  for (const [, py, , , ty] of keys) {
    const tilt = Math.abs(py - ty), off = Math.abs(py - floor);
    if (tilt > .004 || off > .004) { shots.push({ id, py, ty, floor, why: tilt > .004 ? 'camera inclinata' : 'camera non alla quota del pavimento' }); break; }
  }
}
console.log(JSON.stringify({ ok: !shots.length, shots,
  detail: shots.length ? `da guardare nelle inquadrature ${shots.map((s) => s.id).join(", ")}: ${shots[0].why}. Metti la camera alla quota del pavimento e dritta (pipeline/FIGURE.md)` : 'camera alla quota del pavimento in tutte le inquadrature con figure' }));
