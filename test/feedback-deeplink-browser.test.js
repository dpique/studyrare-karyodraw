'use strict';
// The generated pages' "Send feedback" used to link to GitHub issues, a channel a
// non-technical reader will never use. It now deep-links to the app's own feedback
// dialog (?feedback=1), the same form the footer button opens: the message lands in
// D1 and reaches the maintainer in the daily digest, with no account and no email
// client. These tests drive the deep link in a real browser, because the wiring
// lives in the same init block whose load-time death once killed the tour launcher.
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

test('the feedback deep link opens the dialog in a real browser', async (t) => {
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

    await t.test('?feedback=1 opens the general feedback form', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?feedback=1`, { waitUntil: 'load' });
      await page.waitForSelector('#fbdialog');
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        title: document.getElementById('fbtitle').textContent,
      }));
      assert.equal(state.open, true, 'the feedback dialog is open on load');
      assert.equal(state.title, 'Send feedback', 'general mode, not flag mode');
      assert.deepEqual(errors, [], 'the deep-linked load ran without a JS error');
    });

    await t.test('?k=...&feedback=1 keeps the karyotype context', async () => {
      // A landing page's footer sends its own notation along, so the feedback that
      // arrives says which karyotype the reader was looking at.
      await page.goto(
        `http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('47,XX,+21')}&feedback=1`,
        { waitUntil: 'load' });
      await page.waitForSelector('#fbdialog');
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        k: document.getElementById('kinput').value,
      }));
      assert.equal(state.open, true, 'the dialog is open');
      assert.equal(state.k, '47,XX,+21', 'the karyotype from the link is loaded behind it');
      assert.deepEqual(errors, [], 'no JS error');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
