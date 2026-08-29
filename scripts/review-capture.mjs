// Capture the evidence bundle for every manifest entry: what the app actually
// shows a visitor, plus the model's own numbers, side by side in one directory
// per karyotype. An analyst (human or agent) then judges the figure against the
// words against the model without touching a browser, and the model.json is the
// ground truth a verifier refutes hallucinated findings with.
//
// review/<id>/
//   karyo.png      the karyogram as the real page draws it (drawn entries only)
//   decode.txt     the KARYOTYPE DECODED prose
//   detailed.txt   the ISCN detailed form block
//   legend.txt     the band & stain legend rows
//   warnings.txt   everything in the message box (refusals live here)
//   model.json     buildInstance segments per abnormal chromosome + detailedForm
//   entry.json     the manifest entry (source tier, frequency, visitor messages)
//
// Entries whose artifacts are unchanged since the last run keep their directory
// (hash check), so an incremental re-run after a renderer change re-captures and
// re-spends analysis only where the app's output actually moved.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { ISCN, Karyo, ROOT } from './lib/render.mjs';

const require = createRequire(import.meta.url);
const CHROME = [process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean).find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no Chrome found; set CHROME_PATH'); process.exit(1); }

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

// The model's own account of each abnormal chromosome, the refutation oracle.
function modelData(k) {
  const out = { instances: [] };
  let model;
  try { model = ISCN.parse(k); } catch (e) { out.parseError = String(e); return out; }
  out.warnings = model.warnings || [];
  // Bands the model cannot place. The PAGE draws sub-band typos at their real
  // ancestor and says so (index.html); the parser-level instances below still
  // carry the typed band, so without this a reviewer would read the one-band
  // difference between figure and model.json as a silent bug.
  out.invalidBands = Karyo.invalidBands(model).map((b) => ({
    ...b, ancestor: Karyo.bandAncestor(b.chrom, b.band),
  }));
  for (const clone of model.clones || []) {
    for (const ch of Object.keys(clone.slots || {})) {
      for (const inst of clone.slots[ch] || []) {
        if (inst.kind === 'normal') continue;
        const rec = { label: inst.label, chrom: inst.chrom };
        try {
          const b = Karyo.buildInstance(inst);
          rec.segments = b.segments.map((s) => ({
            chrom: String(s.chrom), fromMb: +(s.from / 1e6).toFixed(1), toMb: +(s.to / 1e6).toFixed(1),
            hasCen: !!s.hasCen, reversed: !!s.reversed,
          }));
          rec.note = b.note || null;
        } catch (e) { rec.buildError = String(e); }
        try { rec.detailedForm = Karyo.detailedForm(inst) || null; } catch { rec.detailedForm = null; }
        out.instances.push(rec);
      }
    }
  }
  return out;
}

const manifest = JSON.parse(fs.readFileSync(path.join('review', 'manifest.json'), 'utf8'));
const puppeteer = require('puppeteer-core');
const server = await serve();
const port = server.address().port;
const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 1100, deviceScaleFactor: 2 });

let captured = 0, skipped = 0;
for (const entry of manifest) {
  const id = crypto.createHash('sha1').update(entry.k).digest('hex').slice(0, 12);
  const dir = path.join('review', id);
  const model = modelData(entry.k);
  const stamp = crypto.createHash('sha1')
    .update(JSON.stringify(model) + fs.statSync(path.join(ROOT, 'karyo-render.js')).mtimeMs +
      fs.statSync(path.join(ROOT, 'teach.js')).mtimeMs + fs.statSync(path.join(ROOT, 'index.html')).mtimeMs)
    .digest('hex');
  const stampFile = path.join(dir, 'stamp');
  if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, 'utf8') === stamp) { skipped++; continue; }
  fs.mkdirSync(dir, { recursive: true });

  await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(entry.k)}&style=highlight&show=involved`,
    { waitUntil: 'load' });
  await page.waitForFunction(() =>
    document.querySelector('#karyo svg') || /karyotype/.test(document.getElementById('warnings')?.textContent || ''),
    { timeout: 20000 }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  const texts = await page.evaluate(() => {
    const t = (sel) => (document.querySelector(sel)?.textContent || '').replace(/\s+/g, ' ').trim();
    return { decode: t('#decode'), detailed: t('#detailed'), legend: t('#legend'), warnings: t('#warnings'), drew: !!document.querySelector('#karyo svg') };
  });
  if (texts.drew) {
    const el = await page.$('#karyo');
    if (el) await el.screenshot({ path: path.join(dir, 'karyo.png') });
  } else if (fs.existsSync(path.join(dir, 'karyo.png'))) {
    fs.rmSync(path.join(dir, 'karyo.png'));
  }
  fs.writeFileSync(path.join(dir, 'decode.txt'), texts.decode);
  fs.writeFileSync(path.join(dir, 'detailed.txt'), texts.detailed);
  fs.writeFileSync(path.join(dir, 'legend.txt'), texts.legend);
  fs.writeFileSync(path.join(dir, 'warnings.txt'), texts.warnings);
  fs.writeFileSync(path.join(dir, 'model.json'), JSON.stringify(model, null, 2));
  fs.writeFileSync(path.join(dir, 'entry.json'), JSON.stringify({ ...entry, id, drew: texts.drew }, null, 2));
  fs.writeFileSync(stampFile, stamp);
  captured++;
}
await browser.close();
server.close();
console.log(`captured ${captured}, unchanged ${skipped}, of ${manifest.length}`);
