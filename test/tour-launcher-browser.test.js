'use strict';
// The tour launcher died once from a load-time ReferenceError: the wiring block set
// the button label, hit a stale KD_PAGE_COUNT reference, and the enclosing script
// aborted before the click handler attached. The button read "(11 steps)" and did
// nothing. test/tour-launcher.test.js pins that exact regression by grepping
// index.html; this file closes the general case by loading the page in a real
// browser, so any load-time throw that kills the launcher fails the suite, not only
// the one identifier that has already done it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

// The same resolution scripts/stress-report.mjs uses, widened for CI: CHROME_PATH
// wins, then the usual install locations per platform. GitHub's ubuntu runners ship
// Chrome at /usr/bin/google-chrome. No executable means skip, not fail: a laptop
// without Chrome still runs the rest of the suite, and CI always has it.
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

// A static server over the repo root, as in scripts/stress-report.mjs. The app must
// be served over HTTP: the browser refuses to load its <script src> from file://.
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // The page beacons pageviews and draws to /api/collect; answer so the request
    // does not hang in the network log.
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

const tourState = (page) => page.evaluate(() => ({
  display: document.getElementById('tourcard').style.display,
  counter: document.getElementById('tour-counter').textContent,
}));

test('the tour launcher works in a real browser', async (t) => {
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
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('#tour-start');

    await t.test('the page loads with no JS error', () => {
      // A load-time throw is exactly what killed the launcher before: everything
      // below the throw, including addEventListener, never ran.
      assert.deepEqual(errors, [], 'page JS threw during load');
    });

    await t.test('clicking the launcher opens the tour', async () => {
      const before = await page.evaluate(
        () => document.getElementById('tourcard').style.display);
      assert.equal(before, 'none', 'the tour card starts hidden');
      await page.evaluate(() => document.getElementById('tour-start').click());
      const after = await tourState(page);
      assert.notEqual(after.display, 'none', 'the tour card is on screen after the click');
      assert.match(after.counter, /^Step 1 of \d+$/, 'the first step is loaded');
      assert.deepEqual(errors, [], 'the click ran without a JS error');
    });

    await t.test('?tour=1 opens the tour from the deep link', async () => {
      // The deep link is wired in the same block as the button, so the same throw
      // takes both down; the landing pages reach the tour only through this link.
      await page.goto(`http://127.0.0.1:${port}/index.html?tour=1`, { waitUntil: 'load' });
      await page.waitForSelector('#tourcard');
      const state = await tourState(page);
      assert.notEqual(state.display, 'none', 'the deep link opens the tour');
      assert.match(state.counter, /^Step \d+ of \d+$/, 'a step is loaded');
      // The deep link must also scroll the card to the top of the screen; the
      // smooth scroll is asynchronous, so wait for it to settle.
      await page.waitForFunction(() => {
        const r = document.getElementById('tourcard').getBoundingClientRect();
        return r.top >= -8 && r.top < 120;
      }, { timeout: 4000 });
      assert.deepEqual(errors, [], 'the deep-linked load ran without a JS error');
    });

    await t.test('Back leaves the tour instead of stranding its card', async () => {
      // Repro: draw something that pushes a history entry (an example chip),
      // start the tour, press Back. The entry being restored predates the tour,
      // and the card used to stay open, captioning a step over a drawing it no
      // longer describes. Every other draw path already calls leaveTourIfActive;
      // popstate must too.
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('.chip');
      await page.click('.chip');                    // loadKaryotype -> a pushed entry
      await page.evaluate(() => document.getElementById('tour-start').click());
      assert.notEqual((await tourState(page)).display, 'none', 'the tour is open');
      await page.goBack();
      await page.waitForFunction(
        () => document.getElementById('tourcard').style.display === 'none',
        { timeout: 4000 });
      assert.deepEqual(errors, [], 'the Back navigation ran without a JS error');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
