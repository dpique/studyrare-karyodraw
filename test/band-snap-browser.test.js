'use strict';
// A breakpoint below the band map's subdivision, like 5q15.3 where the map does
// not divide q15, used to refuse the whole drawing. Policy decided 2026-08-29
// from the production review pilot: when the typed band is a sub-band of a real
// band (an ancestor exists in the map), the page draws at that ancestor and the
// message teaches the correction, repair-shaped, with the written-out karyotype
// in it. A miss with no real ancestor (12q32, 9p24.4) still refuses with the
// advice, because there the writer's position is a guess the app must not make.
//
// This lives in the page, not the parser (the parser is band-agnostic by
// design), so the test drives index.html in a real browser like the other
// *-browser tests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { res.writeHead(204).end(); return; }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

async function state(page, port, k) {
  await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}`,
    { waitUntil: 'load' });
  await page.waitForFunction(() =>
    document.querySelector('#karyo svg') ||
    (document.getElementById('warnings')?.textContent || '').trim().length > 0,
  { timeout: 20000 });
  return page.evaluate(() => ({
    drew: !!document.querySelector('#karyo svg'),
    warnings: (document.getElementById('warnings')?.textContent || '').replace(/\s+/g, ' ').trim(),
    decode: (document.getElementById('decode')?.textContent || '').replace(/\s+/g, ' ').trim(),
    input: document.getElementById('kinput')?.value || '',
  }));
}

test('a sub-band typo below a real band snaps, draws, and teaches the correction', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();

    // 5q15 is not subdivided, so 5q15.3 names detail the map does not have.
    const snap = await state(page, port, '46,XX,del(5)(q15.3)');
    assert.equal(snap.drew, true, 'the figure draws');
    assert.match(snap.warnings, /5q15\.3/, 'names what was typed');
    assert.match(snap.warnings, /46,XX,del\(5\)\(q15\)/, 'hands back the written-out form drawn');
    assert.ok(snap.decode.length > 0, 'the decode describes the drawn karyotype');
    assert.equal(snap.input, '46,XX,del(5)(q15.3)', 'the input box keeps what was typed');

    // A sub-band beyond where the parent divides (p24 stops at p24.3) snaps to
    // the parent itself, never sideways to a sibling: p24 is the deepest claim
    // the input actually supports.
    const sib = await state(page, port, '46,XX,del(9)(p24.4)');
    assert.equal(sib.drew, true);
    assert.match(sib.warnings, /9p24\.4/);
    assert.match(sib.warnings, /46,XX,del\(9\)\(p24\)/);

    // A band with no real ancestor still refuses with the advice: undotted
    // (12q32 names a band, not a subdivision of one) ...
    const miss = await state(page, port, '46,XX,del(12)(q32)');
    assert.equal(miss.drew, false, 'no ancestor, no drawing');
    assert.match(miss.warnings, /12q32/);

    // ... and dotted below a parent that does not exist either.
    const ghost = await state(page, port, '46,XX,del(5)(q99.1)');
    assert.equal(ghost.drew, false);
    assert.match(ghost.warnings, /5q99\.1/);
  } finally {
    await browser.close();
    server.close();
  }
});
