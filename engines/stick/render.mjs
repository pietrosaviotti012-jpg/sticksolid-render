// StickSolid · Stick's engine (stick-figure projects, 2D canvas) rendered in headless Chromium.
//   node render.mjs <project> stills 1.5,6.8 <out_dir>      -> JPEG stills at those seconds (of the new voice)
//   node render.mjs <project> video <out.mp4> [fps]          -> the whole project, frames piped to ffmpeg (no audio)
//   FRAME_FROM=300 FRAME_TO=600 node render.mjs ...          -> only those frames (one slice on GitHub)
// The project folder is served at /, the StickSolid kit (render/kit) at /kit/. The page is <project>/src/index.html:
// the skill's main.js draws the shots; /kit/lib/catena-stick.js (loaded before it) reads catena.json, written by
// catena/produci.py: the captions in the StickSolid style, the duration and the time warp onto the new voice.
// 1080x1920, like the skill. No WebGL: the 2D canvas renders the same on any machine.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

const HERE = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const REPO = path.join(HERE, '..', '..');
const KIT = process.env.STICKSOLID_KIT || [path.join(REPO, 'skills', 'kit'), path.join(os.homedir(), 'tools', 'claude-animation-skills', 'kit')]
  .find((k) => fs.existsSync(path.join(k, 'node_modules', 'playwright'))) || path.join(REPO, 'skills', 'kit');
const { chromium } = createRequire(path.join(KIT, 'package.json'))('playwright');

const [project, mode, a, b] = process.argv.slice(2);
const PROJ = path.resolve(project);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/kit/') ? path.join(REPO, u) : path.join(PROJ, u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);

const CHROME = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${server.address().port}/src/index.html`);
await page.waitForFunction(() => window.renderFrame && window.TOTAL_FRAMES, null, { timeout: 60000 });
await page.evaluate(async () => { await document.fonts.load('700 40px Poppins'); await document.fonts.load('700 40px Lora').catch(() => {}); await document.fonts.load('600 40px Lora').catch(() => {}); });
const FPS = await page.evaluate(() => window.FPS || 30);
const frame = (f, q) => page.evaluate(([f, q]) => { window.renderFrame(f); return window.grab(q); }, [f, q]).then((d) => Buffer.from(d.split(',')[1], 'base64'));

if (mode === 'stills') {
  fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) fs.writeFileSync(path.join(b, `t_${t.toFixed(2)}.jpg`), await frame(Math.round(t * FPS), 0.9));
  console.log('stills', a);
} else {
  const fps = Number(b || 30), total = Math.min(await page.evaluate(() => window.TOTAL_FRAMES), Math.round(Number(process.env.DUR_MAX || 1e9) * fps));
  if (fps !== FPS) console.log(`attenzione: il progetto è a ${FPS} fotogrammi al secondo, il video a ${fps}`);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', a], { stdio: ['pipe', 'inherit', 'inherit'] });
  const T0 = Date.now();
  // FRAME_FROM / FRAME_TO: only a slice of the video (GitHub splits a video across machines, then joins the slices)
  const f0 = Number(process.env.FRAME_FROM || 0), f1 = Math.min(total, Number(process.env.FRAME_TO || total));
  for (let n = f0; n < f1; n++) {
    const buf = await frame(n, 0.95);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (n % 150 === 0) console.log(`fotogramma ${n}/${f1} · ${((Date.now() - T0) / (n + 1)).toFixed(0)} ms l'uno`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('video', a, f1 - f0, 'fotogrammi in', ((Date.now() - T0) / 1000).toFixed(0), 's');
}
await browser.close(); server.close();
