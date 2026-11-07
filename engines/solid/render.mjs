// StickSolid · Solid's engine (zach-d-films projects, three.js) rendered in headless Chromium.
//   node render.mjs <project> stills 1.5,6.8 <out_dir>      -> PNG stills at those seconds
//   node render.mjs <project> video <out.mp4> [fps]          -> the whole project, frames piped to ffmpeg (no audio)
//   FRAME_FROM=300 FRAME_TO=600 node render.mjs ...          -> only those frames (one slice on GitHub)
// The project folder is served at /, the StickSolid kit (render/kit) at /kit/, the kit's node_modules at /node_modules/.
// The project's main.js reads catena.json (written by catena/produci.py): the new captions, the duration and the time
// warp that fits the shots, timed on an older voice, onto the new one.
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
const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.m4a': 'audio/mp4' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/node_modules/') ? path.join(KIT, u) : u.startsWith('/kit/') ? path.join(REPO, u) : path.join(PROJ, u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);

// GL=swiftshader forces software WebGL (machines without a usable GPU, like the GitHub runners)
const GL = (process.env.GL === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : ['--enable-gpu', '--ignore-gpu-blocklist'])
  .concat((process.env.GL_EXTRA || '').split(' ').filter(Boolean));
const CHROME = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: GL });
const page = await browser.newPage({ viewport: { width: 720, height: 1280 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('[page]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${server.address().port}/index.html?render=1`);
await page.waitForFunction(() => window.renderAt && window.ready, null, { timeout: 120000 });
await page.evaluate(() => window.ready);
const shot = () => page.screenshot({ clip: { x: 0, y: 0, width: 720, height: 1280 }, type: 'png' });

if (mode === 'stills') {
  fs.mkdirSync(b, { recursive: true });
  for (const t of a.split(',').map(Number)) {
    await page.evaluate((t) => window.renderAt(t), t);
    fs.writeFileSync(path.join(b, `t_${t.toFixed(2)}.png`), await shot());
  }
  console.log('stills', a);
} else {
  const fps = Number(b || 30), dur = Math.min(await page.evaluate(() => window.DURATION), Number(process.env.DUR_MAX || 1e9));
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p', a], { stdio: ['pipe', 'inherit', 'inherit'] });
  // FRAME_FROM / FRAME_TO: only a slice of the video (GitHub splits a video across machines, then joins the slices)
  const T0 = Date.now(), n0 = Number(process.env.FRAME_FROM || 0), n1 = Math.min(Math.round(dur * fps), Number(process.env.FRAME_TO || 1e9));
  for (let n = n0; n < n1; n++) {
    await page.evaluate((t) => window.renderAt(t), n / fps);
    const buf = await shot();
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (n % 150 === 0) console.log(`fotogramma ${n}/${n1} · ${((Date.now() - T0) / (n + 1)).toFixed(0)} ms l'uno`);
  }
  ff.stdin.end(); await new Promise((r) => ff.on('close', r));
  console.log('video', a, n1 - n0, 'fotogrammi in', ((Date.now() - T0) / 1000).toFixed(0), 's');
}
await browser.close(); server.close();
