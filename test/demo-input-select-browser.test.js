'use strict';
// The demo karyotype pre-fills the input so the page never opens blank, but typing
// your own karyotype used to cost a manual select-and-delete. Focusing the untouched
// demo now selects it all, the URL-bar pattern, so one keystroke starts fresh. This
// runs in a real browser because the fix's one hazard is browser-specific: the
// mouseup that follows a click's focus would silently collapse the selection without
// the guard, and no grep of index.html can see whether it did.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// The same resolution the other browser tests use: CHROME_PATH wins, then the usual
// install locations. No executable means skip, not fail.
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

const selection = (page) => page.evaluate(() => {
  const i = document.getElementById('kinput');
  return { start: i.selectionStart, end: i.selectionEnd, len: i.value.length, value: i.value };
});

test('the untouched demo karyotype selects on focus', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('#kinput');

    await t.test('a click selects the whole demo', async () => {
      // A real click, so the post-focus mouseup fires: that is the event the guard
      // exists for, and the assertion fails without it.
      await page.click('#kinput');
      const sel = await selection(page);
      assert.ok(sel.len > 0, 'the demo is pre-filled');
      assert.equal(sel.start, 0, 'selection starts at the first character');
      assert.equal(sel.end, sel.len, 'selection reaches the last character');
    });

    await t.test('one keystroke replaces the demo', async () => {
      await page.keyboard.type('4');
      const sel = await selection(page);
      assert.equal(sel.value, '4', 'typing replaced the selected demo');
    });

    await t.test('a deep-linked karyotype is not selected on focus', async () => {
      // ?k= is a deliberate karyotype, not the demo; auto-selecting it would put
      // a shared link one keystroke from destruction.
      await page.goto(`http://127.0.0.1:${port}/index.html?k=47%2CXX%2C%2B21`, { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      await page.click('#kinput');
      const sel = await selection(page);
      assert.equal(sel.value, '47,XX,+21', 'the deep link filled the input');
      assert.ok(!(sel.start === 0 && sel.end === sel.len), 'no select-all on a deliberate karyotype');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
