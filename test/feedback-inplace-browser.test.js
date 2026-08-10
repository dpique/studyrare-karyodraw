'use strict';
// The generated pages inline the feedback dialog and post to /api/feedback
// themselves, so "Send feedback" opens in place: no navigation to the app, which
// is what the owner asked for ("should not redirect back to the main page").
// These tests drive the built pages in a real browser: the About page's inline
// link and a landing page's footer button must open the dialog without leaving
// the page, and a submission must post and show the success state.
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

function serve(apiLog) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { apiLog.push({ path: url.pathname, method: req.method, body }); res.writeHead(204).end(); });
      return;
    }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

test('generated-page feedback opens and submits in place', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const apiLog = [];
  const server = await serve(apiLog);
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    await t.test('the About link opens the dialog without leaving the page', async () => {
      await page.goto(`http://127.0.0.1:${port}/about/`, { waitUntil: 'load' });
      await page.waitForSelector('[data-fb-open]');
      await page.evaluate(() => document.querySelector('[data-fb-open]').click());
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        path: location.pathname,
      }));
      assert.equal(state.open, true, 'the dialog is open');
      assert.equal(state.path, '/about/', 'no navigation happened');
      assert.deepEqual(errors, [], 'no JS error');
    });

    await t.test('a submission posts the message with the page context', async () => {
      await page.type('#fbmsg', 'The banding on 21 looks off to me.');
      await page.evaluate(() => document.getElementById('fbform').requestSubmit());
      await page.waitForFunction(
        () => document.getElementById('fbstatus').textContent.includes('Thank you'));
      const sent = apiLog.filter((r) => r.path === '/api/feedback');
      assert.equal(sent.length, 1, 'one post to /api/feedback');
      const body = JSON.parse(sent[0].body);
      assert.equal(body.message, 'The banding on 21 looks off to me.');
      assert.match(body.url, /\/about\//, 'the page URL rides along');
      assert.deepEqual(errors, [], 'no JS error');
    });

    await t.test('a landing page footer button opens the dialog with its karyotype', async () => {
      await page.goto(`http://127.0.0.1:${port}/karyotype/down-syndrome/`, { waitUntil: 'load' });
      await page.waitForSelector('#fbopen');
      await page.evaluate(() => document.getElementById('fbopen').click());
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        path: location.pathname,
      }));
      assert.equal(state.open, true, 'the dialog is open');
      assert.equal(state.path, '/karyotype/down-syndrome/', 'no navigation happened');
      await page.evaluate(() => document.querySelector('#fbcats .fb-cat').click());
      await page.evaluate(() => document.getElementById('fbform').requestSubmit());
      await page.waitForFunction(
        () => document.getElementById('fbstatus').textContent.includes('Thank you'));
      const sent = apiLog.filter((r) => r.path === '/api/feedback');
      const body = JSON.parse(sent[sent.length - 1].body);
      assert.equal(body.karyotype, '47,XX,+21', 'the page karyotype rides along');
      assert.deepEqual(errors, [], 'no JS error');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
