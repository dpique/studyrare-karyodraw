'use strict';
// The legend describes the figure it sits under, not the renderer's whole
// vocabulary. Dan drew 46,XY,t(9;22)(q34;q11.2) and the legend taught him a
// duplication frame, inversion hooks and red breakpoint carets, none of which
// were on screen, while the dashed fusion seam, the one mark the figure DOES
// carry, had no entry at all. A legend row now appears exactly when its mark
// is in the drawn karyogram, read off the DOM after render, so the two can
// never disagree. This runs in a real browser because buildLegend queries the
// live karyogram; no unit harness renders that pipeline end to end.
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
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

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

const legendText = (page) => page.evaluate(() => document.getElementById('legend').textContent);

test('the legend lists exactly the marks the figure draws', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  const open = async (page, k) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight&show=affected`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
  };
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await t.test('a plain translocation teaches the seam and nothing it does not draw', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)');
      const leg = await legendText(page);
      assert.match(leg, /fused/i, 'the dashed fusion junction, the mark actually on screen');
      assert.ok(!/duplicated segment/.test(leg), 'no dup frame drawn, no dup row');
      assert.ok(!/end-for-end/.test(leg), 'no hooks drawn, no hook row');
      assert.ok(!/breakpoint/.test(leg), 'no carets drawn, no caret row');
    });

    await t.test('the rec teaches box, hooks and carets, and no seam', async () => {
      await open(page, '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat');
      const leg = await legendText(page);
      assert.match(leg, /duplicated segment/, 'the amber box is on screen');
      assert.match(leg, /end-for-end/, 'the teal hooks are on screen');
      assert.match(leg, /breakpoint/, 'the junction carets are on screen');
      assert.ok(!/fused/i.test(leg), 'one chromosome, no fusion seam');
    });

    await t.test('an inversion teaches hooks without any box row', async () => {
      await open(page, '46,XX,inv(2)(p21q31)');
      const leg = await legendText(page);
      assert.match(leg, /end-for-end/, 'hooks alone mean inverted');
      assert.ok(!/duplicated segment/.test(leg), 'nothing is duplicated');
    });

    await t.test('a normal karyotype keeps the quiet fallback line', async () => {
      await open(page, '46,XX');
      const leg = await legendText(page);
      assert.match(leg, /nothing to highlight/i);
      assert.ok(!/duplicated segment|end-for-end|breakpoint|fused/i.test(leg));
    });
  } finally {
    await browser.close();
    server.close();
  }
});
