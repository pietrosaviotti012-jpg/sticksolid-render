// node render.mjs <jobs.json>
// jobs: [{ page: "man" | "compose", out: "out/x.png", cfg: {...} }]
// Serves this folder plus the kit's node_modules, renders each job in headless Chromium and saves a PNG.
import { createRequire } from 'node:module';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// the kit (node_modules with playwright and three, the voice models): $STICKSOLID_KIT, else skills/kit in this
// repository, else the copy installed on the PC in ~/tools
const HERE_KIT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const KIT = process.env.STICKSOLID_KIT || [path.join(HERE_KIT, '..', 'skills', 'kit'), path.join(os.homedir(), 'tools', 'claude-animation-skills', 'kit')]
  .find((k) => fs.existsSync(path.join(k, 'node_modules', 'playwright'))) || path.join(HERE_KIT, '..', 'skills', 'kit');
const { chromium } = createRequire(path.join(KIT, 'package.json'))('playwright');
const ROOT = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.ttf': 'font/ttf', '.png': 'image/png', '.woff2': 'font/woff2' };
const server = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const p = u.startsWith('/node_modules/') ? path.join(KIT, u) : path.join(ROOT, u);
  fs.readFile(p, (e, d) => { if (e) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); res.end(d); });
}).listen(0);
const port = server.address().port;

const jobs = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const CHROME = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1234', 'chrome-win64', 'chrome.exe');
const browser = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined, args: ['--enable-gpu', '--ignore-gpu-blocklist'] });
const pages = {};
async function page(name) {
  if (pages[name]) return pages[name];
  const p = await browser.newPage({ viewport: { width: 1600, height: 1600 } });
  p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:${port}/${name}.html`);
  await p.waitForFunction(n => window[n + 'Ready'], name, { timeout: 60000 });
  return (pages[name] = p);
}
for (const j of jobs) {
  const t0 = Date.now();
  const p = await page(j.page);
  const url = await p.evaluate(async ([n, cfg]) => await window[n](cfg), [j.fn || ('render' + j.page[0].toUpperCase() + j.page.slice(1)), j.cfg || {}]);
  fs.mkdirSync(path.dirname(path.join(ROOT, j.out)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, j.out), Buffer.from(url.split(',')[1], 'base64'));
  console.log('ok', j.out, Date.now() - t0, 'ms');
}
await browser.close();
server.close();
