// Tell the Office what a department is doing: node tools/office.mjs '<event json>' ['<event json>' …]
//   node tools/office.mjs '{"dept":"voce","status":"working","task":"Registro il narratore"}'
// Reads OFFICE_URL and STUDIO_SECRET from the environment (GitHub secrets) or from Studio/.env. Never prints them.
// Never fails the caller: the office is a window on the work, not part of it (prints a warning and exits 0).
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const envFile = join(dirname(fileURLToPath(import.meta.url)), '..', '.env');
const local = existsSync(envFile) ? Object.fromEntries(readFileSync(envFile, 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])) : {};
const URL_ = process.env.OFFICE_URL || local.OFFICE_URL, SECRET = process.env.STUDIO_SECRET || local.STUDIO_SECRET;
// in a render, VIDEO_ID says for which video the house is working: two renders can run at the same time
const events = process.argv.slice(2).map(a => JSON.parse(a)).map(e => e.dept && process.env.VIDEO_ID ? { ...e, video_id: process.env.VIDEO_ID } : e);
if (!URL_ || !SECRET) { console.warn('office: OFFICE_URL / STUDIO_SECRET not set, event not sent'); process.exit(0); }
try {
  const r = await fetch(URL_ + '/events', { method: 'POST', body: JSON.stringify(events),
    headers: { Authorization: `Bearer ${SECRET}`, 'Content-Type': 'application/json', 'User-Agent': 'lanternfox-studio' } });
  console.log(`office: ${events.map(e => e.dept ? `${e.dept}=${e.status}` : Object.keys(e).join('+')).join(', ')} → ${r.status}`);
} catch (err) { console.warn('office: not reachable,', err.message); }
