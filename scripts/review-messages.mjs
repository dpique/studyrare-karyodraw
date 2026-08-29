// The message-quality audit: render every production parse FAILURE through the
// real page, dedupe what the message box says into templates, and emit slice
// files sized for agent review. The refusal message is teaching copy, and the
// tail of rare failures is where its quality decays unseen; the first run of
// this audit (2026-08-29, 381 unique failures, 204 templates) found two parser
// bugs, one false ISCN rule, and a dozen missed repairs.
//
//   node scripts/review-messages.mjs failures.json [--slices 3]
//
// failures.json is the wrangler D1 export documented in docs/VALIDATION.md
// ("Reviewing the live corpus"). Output, under review/messages/ (gitignored):
//   audit.jsonl      one line per failure: {k, n, drew, box, chips}
//   templates.json   refusal messages deduped by shape, examples attached
//   slice-N.json     the templates split for N parallel review agents
//
// The agent rubric lives in docs/VALIDATION.md ("The agent review pipeline",
// stage 3a) — hand each agent one slice file and that rubric, nothing else.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');
const CHROME = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no Chrome found; set CHROME_PATH'); process.exit(1); }

const args = process.argv.slice(2);
const failuresPath = args.filter((a) => !a.startsWith('--'))[0];
const slices = Number((args.find((a) => a.startsWith('--slices=')) || '--slices=3').split('=')[1]);
if (!failuresPath) { console.error('usage: node scripts/review-messages.mjs failures.json [--slices=3]'); process.exit(1); }

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { res.writeHead(204).end(); return; }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

// Message shape: quoted tokens, numbers, and lone sex letters normalized away,
// so one lesson worded around ten different inputs is ONE template.
const template = (box) => box
  .replace(/“[^”]*”/g, 'Q')
  .replace(/[0-9]+(~[0-9]+)?/g, 'N')
  .replace(/\b[XY]\b/g, 'S')
  .slice(0, 400);

const rows = JSON.parse(fs.readFileSync(failuresPath, 'utf8'))[0].results;
const norm = (k) => String(k || '').replace(/\s+/g, ' ').trim();
const outDir = path.join(ROOT, 'review', 'messages');
fs.mkdirSync(outDir, { recursive: true });

const server = await serve();
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 800 });

const audit = fs.createWriteStream(path.join(outDir, 'audit.jsonl'));
const recs = [];
let i = 0;
for (const row of rows) {
  const k = norm(row.karyotype);
  if (!k) continue;
  i++;
  const rec = { k, n: row.n };
  try {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}`, { waitUntil: 'load', timeout: 15000 });
    await page.waitForFunction(() =>
      document.querySelector('#karyo svg') ||
      (document.getElementById('warnings')?.textContent || '').trim().length > 0,
    { timeout: 12000 });
    Object.assign(rec, await page.evaluate(() => ({
      drew: !!document.querySelector('#karyo svg'),
      box: (document.getElementById('warnings')?.textContent || '').replace(/\s+/g, ' ').trim(),
      chips: [...document.querySelectorAll('#warnings button.dym')].map((b) => b.getAttribute('data-k')),
    })));
  } catch (e) { rec.error = String(e).slice(0, 120); }
  audit.write(JSON.stringify(rec) + '\n');
  recs.push(rec);
  if (i % 40 === 0) console.log(i + '/' + rows.length);
}
audit.end();
await browser.close();
server.close();

const groups = new Map();
for (const r of recs) {
  if (r.drew || r.error) continue;
  const t = template(r.box);
  if (!groups.has(t)) groups.set(t, []);
  groups.get(t).push(r);
}
const items = [...groups.values()]
  .sort((a, b) => b.length - a.length)
  .map((rs) => {
    rs.sort((a, b) => b.n - a.n);
    return { count: rs.length, examples: rs.slice(0, 3).map((r) => ({ k: r.k, n: r.n })), box: rs[0].box, chips: rs[0].chips };
  });
fs.writeFileSync(path.join(outDir, 'templates.json'), JSON.stringify(items, null, 1));
const per = Math.ceil(items.length / slices);
for (let s = 0; s < slices; s++) {
  fs.writeFileSync(path.join(outDir, `slice-${s + 1}.json`),
    JSON.stringify({ templates: items.slice(s * per, (s + 1) * per) }, null, 1));
}
const drew = recs.filter((r) => r.drew).length;
const silent = recs.filter((r) => r.drew && !r.box).length;
console.log(`${recs.length} failures: ${drew} now draw (${silent} silently), ${recs.length - drew} refuse across ${items.length} templates`);
console.log(`review/messages/: audit.jsonl, templates.json, slice-1..${slices}.json`);
console.log('agent rubric: docs/VALIDATION.md, "The agent review pipeline", stage 3a');
