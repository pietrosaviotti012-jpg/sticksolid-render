// Render one slice of a production's frames: node tools/segment.mjs <production> <k> <n> <fps> <out.mp4>
// Slice k of n (0-based). Several machines can render slices at the same time; tools/build.sh joins them (SEGMENTS=dir).
// Uses the Lemo-Opuscar page loader ($LIB, default ~/lemo-opuscar) and the page query in $Q.
import path from 'path'; import os from 'os'; import fs from 'fs';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';

const LIB = process.env.LIB || path.join(os.homedir(), 'lemo-opuscar');
const { openDemo, closeServer } = await import(pathToFileURL(path.join(LIB, 'core', 'render', 'page.mjs')).href);
const [dir, k, n, fps, out] = process.argv.slice(2);
const K = +k, N = +n, FPS = +fps;
if (!dir || !(N > 0) || !(K >= 0 && K < N) || !(FPS > 0) || !out) { console.error('usage: node tools/segment.mjs <production> <k> <n> <fps> <out.mp4>'); process.exit(2); }

const { browser, page } = await openDemo(path.resolve(dir), { w: 1080, h: 1920, q: process.env.Q || '' });
page.setDefaultTimeout(120000);
const DUR = await page.evaluate(() => window.DUR);
const TOTAL = Math.round(DUR * FPS), per = Math.ceil(TOTAL / N), a = K * per, b = Math.min(TOTAL, a + per);
fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
console.log(`slice ${K + 1}/${N}: frames ${a}–${b - 1} of ${TOTAL}`);

// same encoding as Lemo's video.mjs, so the slices join losslessly
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', path.resolve(out)], { stdio: ['pipe', 'inherit', 'inherit'] });
const closed = new Promise(r => ff.on('close', r));
const t0 = Date.now();
for (let f = a; f < b; f++) {
  await page.evaluate(t => window.render(t), f / FPS);
  const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if ((f - a) % 60 === 0) console.log(`${f - a}/${b - a}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
const code = await closed;
await browser.close(); closeServer();
if (code !== 0) { console.error('ffmpeg failed'); process.exit(1); }
console.log(`slice done: ${b - a} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s → ${out}`);
