'use strict';
// The document title names the drawn karyotype, so browser history, tabs, and
// bookmarks are navigable instead of every one reading the same generic string
// (Dan, 2026-09-05). The gate is load-bearing for SEO: the bare homepage and the
// auto-loaded demo keep the generic, keyword-bearing title (the one that ranks
// and that every ?k= view canonicalises back to); only a karyotype carried in
// the URL gets its own title. Driven through the real page, since the whole
// point is the title the browser records for each history entry.
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

test('the document title names the drawn karyotype, and the homepage stays generic', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const titleOf = (page) => page.evaluate(() => document.title);
  try {
    const page = await browser.newPage();

    await t.test('a deep-linked karyotype titles the page after itself', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,del(5)(p15.2)')}`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#karyo svg'));
      assert.equal(await titleOf(page), '46,XY,del(5)(p15.2) | KaryoDraw');
    });

    await t.test('the bare homepage keeps the generic, keyword-bearing title', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#karyo svg'));   // demo drew
      const title = await titleOf(page);
      assert.match(title, /Draw Any ISCN Karyotype/, 'the demo does not steal the homepage title');
      assert.doesNotMatch(title, /46,XX|46,XY|mos /, 'no karyotype leaked into the homepage title');
    });

    await t.test('drawing from the box updates the title', async () => {
      await page.evaluate(() => {
        const inp = document.getElementById('kinput');
        inp.value = '47,XXY';
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('draw').click();
      });
      await page.waitForFunction(() => document.title.indexOf('47,XXY') === 0);
      assert.equal(await titleOf(page), '47,XXY | KaryoDraw');
    });

    await t.test('Back and Forward carry the title, on the SPA popstate path', async () => {
      // A fresh homepage (generic), then an example chip, which pushes a real
      // history entry the way in-app navigation does (the draw button replaces,
      // so it does not). Back returns to the generic homepage, Forward to the chip.
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#karyo svg') && document.querySelector('.chip[data-k]'));
      const chipK = await page.evaluate(() => {
        const c = document.querySelector('.chip[data-k]');
        c.click();
        return c.getAttribute('data-k');
      });
      await page.waitForFunction((k) => document.title === k + ' | KaryoDraw', {}, chipK);
      await page.goBack();
      await page.waitForFunction(() => /Draw Any ISCN Karyotype/.test(document.title));
      assert.match(await titleOf(page), /Draw Any ISCN Karyotype/, 'Back restores the generic homepage title');
      await page.goForward();
      await page.waitForFunction((k) => document.title === k + ' | KaryoDraw', {}, chipK);
      assert.equal(await titleOf(page), chipK + ' | KaryoDraw', 'Forward restores the chip karyotype title');
    });

    await t.test('a refused karyotype does not take over the title', async () => {
      await page.evaluate(() => {
        const inp = document.getElementById('kinput');
        inp.value = '45,XY,der(4)t(4;11)(p15;q23)';   // count contradicts the changes: refused
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('draw').click();
      });
      await page.waitForFunction(() =>
        /Fix the karyotype/.test(document.getElementById('karyo').textContent));
      assert.match(await titleOf(page), /Draw Any ISCN Karyotype/, 'a refusal keeps the generic title');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
