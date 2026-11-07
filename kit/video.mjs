// node video.mjs <job.json>   job: { page, fn, cfg, from, to, fps, out, size: [w, h] }
// Calls window[fn]({ ...cfg, t }) frame by frame and pipes the PNGs to ffmpeg (H.264, yuv420p).
// For the 3D pages (man), cfg.t also drives the move; for canvas pages the fn draws the frame at t.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';

// the kit (node_modules with playwright and three, the voice models): $STICKSOLID_KIT, else skills/kit in this
// repository, else the copy installed on the PC in ~/tools
const HERE_KIT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const KIT = process.env.STICKSOLID_KIT || [path.join(HERE_KIT, '..', 'skills', 'kit'), path.join(os.homedir(), 'tools', 'claude-animation-skills', 'kit')]
  .find((k) => fs.existsSync(path.join(k, 'node_modules', 'playwright'))) || path.join(HERE_KIT, '..', 'skills', 'kit');
const { chromium } = createRequire(path.join(KIT, 'package.json'))('playwright');
const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/node_modules/') ? path.join(KIT, u) : path.join(ROOT, u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const CHROME = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const jobs = [].concat(JSON.parse(fs.readFileSync(process.argv[2], 'utf8')));
for (const j of jobs) {
  const p = await browser.newPage({ viewport: { width: 1600, height: 1600 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:${server.address().port}/${j.page}.html`);
  await p.waitForFunction(n => window[n + 'Ready'], j.page, { timeout: 60000 });
  const fps = j.fps || 30, n0 = Math.round((j.from || 0) * fps), n1 = Math.round(j.to * fps);
  const out = path.join(ROOT, j.out); fs.mkdirSync(path.dirname(out), { recursive: true });
  const vf = j.size ? ['-vf', `scale=${j.size[0]}:${j.size[1]}:flags=lanczos`] : [];
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-', ...vf, '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const T0 = Date.now();
  for (let n = n0; n < n1; n++) {
    const url = await p.evaluate(async ([fn, cfg]) => await window[fn](cfg), [j.fn, { ...(j.cfg || {}), t: n / fps }]);
    if (!ff.stdin.write(Buffer.from(url.split(',')[1], 'base64'))) await new Promise(r => ff.stdin.once('drain', r));
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r));
  console.log('ok', j.out, n1 - n0, 'fotogrammi', Date.now() - T0, 'ms');
  await p.close();
}
await browser.close(); server.close();
