'use strict';
// The shared URL mirrors the input box, and the ISCN plus is part of that
// promise: ?k=46,XY,der(13;14)(q10;q10),+14 must read as the karyotype it is,
// not as %2B soup (Dan, 2026-08-30). The reader half has been true since #143
// (a literal + in ?k= is the ISCN sign, never a form-encoded space, with the
// one mos/chi space put back); this pins the writer half (prettyEncode leaves
// the plus literal) and the round trip, plus the legacy %2B links that are
// already in the wild.
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

test('the URL the app writes keeps the ISCN plus literal, and both spellings read back', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();

    await t.test('typing a +14 writes ,+14 into the URL, not %2B14', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      await page.click('#kinput');
      await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
      await page.keyboard.type('46,XY,der(13;14)(q10;q10),+14');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document.getElementById('summary').textContent.includes('der(13;14)'));
      const search = await page.evaluate(() => location.search);
      assert.ok(search.includes(',+14'), 'the plus is literal: ' + search);
      assert.ok(!search.includes('%2B'), 'never %2B: ' + search);
    });

    await t.test('the literal-plus URL reads back as the same karyotype', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=46,XY,der(13;14)(q10;q10),+14`,
        { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      const val = await page.evaluate(() => document.getElementById('kinput').value);
      assert.equal(val, '46,XY,der(13;14)(q10;q10),+14');
      const warn = await page.evaluate(() => document.getElementById('warnings').textContent);
      assert.ok(!/needs a sign/.test(warn), 'the plus survives the round trip');
    });

    await t.test('legacy %2B links already in the wild keep working', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=46,XY,der(13;14)(q10;q10),%2B14`,
        { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      const val = await page.evaluate(() => document.getElementById('kinput').value);
      assert.equal(val, '46,XY,der(13;14)(q10;q10),+14');
    });

    await t.test('the mos prefix keeps its one legal space in the written URL', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      await page.click('#kinput');
      await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
      await page.keyboard.type('mos 45,X[12]/46,XX[18]');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        document.getElementById('summary').textContent.includes('45,X'));
      const search = await page.evaluate(() => location.search);
      assert.ok(search.includes('mos%2045'), 'the space stays %20, never a form plus: ' + search);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
