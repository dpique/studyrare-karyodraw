'use strict';
// The ISCN detailed form renders as label/form rows, which reads well but
// selects badly: a reader who wants the text (for a report, a slide, a
// question stem) had to drag-select across a CSS grid and hope. A small copy
// button beside the block's title now hands over every line as plain text,
// label and form separated by two spaces, one line per row (Dan, 2026-09-10).
// Driven in a real browser because the button, the flash, and the clipboard
// call all live where the block renders.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
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
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

test('the detailed form copies as plain text lines', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XX,+1,der(1;7)(q10;p10)')}&style=highlight`,
      { waitUntil: 'load' });
    await page.waitForSelector('#detailed .dline');

    await t.test('the button exists, titled, inside the block it copies', async () => {
      const btn = await page.evaluate(() => {
        const b = document.querySelector('#detailed #copydetail');
        return b && { title: b.getAttribute('title') || '', text: b.textContent };
      });
      assert.ok(btn, 'a copy button renders with the detailed form');
      assert.ok(btn.title.trim().length > 0, 'the button carries helper text');
    });

    await t.test('clicking hands over every line, label and form', async () => {
      await page.evaluate(() => {
        window.__copied = null;
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: (s) => { window.__copied = s; return Promise.resolve(); } },
          configurable: true,
        });
      });
      await page.click('#detailed #copydetail');
      const copied = await page.evaluate(() => window.__copied);
      assert.ok(copied, 'the clipboard received text');
      const lines = copied.split('\n');
      assert.ok(lines.some((l) => /^\+1 {2}pter→qter$/.test(l)), `the gained 1 has its line, named +1 (got ${JSON.stringify(copied)})`);
      assert.ok(lines.some((l) => /^der\(1;7\) {2}1qter→1q10::7p10→7pter$/.test(l)), `the derivative has its line (got ${JSON.stringify(copied)})`);
    });

    await t.test('the button survives a redraw', async () => {
      // The block is rebuilt on every draw; the handler must not die with it.
      await page.focus('#kinput');
      await page.evaluate(() => { document.querySelector('#kinput').value = '46,XY,t(9;22)(q34;q11.2)'; });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => {
        const el = document.querySelector('#detailed');
        return el && /der\(9\)|9pter/.test(el.textContent);
      });
      await page.evaluate(() => { window.__copied = null; });
      await page.click('#detailed #copydetail');
      const copied = await page.evaluate(() => window.__copied);
      assert.ok(copied && copied.indexOf('9') >= 0, `copies the new karyotype's rows (got ${JSON.stringify(copied)})`);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
