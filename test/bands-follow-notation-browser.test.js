'use strict';
// The Bands control follows the notation (Dan, 2026-09-10): typing
// idic(Y)(q11.23) at the ~550 default merged q11.21 through q11.23 into one
// stripe, so the band the karyotype names was nowhere in the drawing and the
// reader had to know the control existed. When the typed karyotype names a
// two-decimal sub-band, the level now follows it up to High, and falls back
// to Std for a karyotype that does not. Explicit choices end the following:
// a bands= in the arriving link (shared links keep their meaning) or a click
// on the control. Driven in a real browser because the behavior IS the
// interplay of URL, control and redraws.
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
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

test('the Bands control follows the notation', { skip: !CHROME && 'no Chrome found' }, async (t) => {
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const state = () => page.evaluate(() => ({
    level: document.querySelector('#levelseg button.on')?.getAttribute('data-level') || null,
    named: !!document.querySelector('#karyo rect[data-band="q11.23"]'),
    urlBands: new URLSearchParams(location.search).get('bands'),
  }));
  const draw = (k) => page.evaluate((kk) => {
    const inp = document.querySelector('#kt') || document.querySelector('input');
    inp.value = kk;
    inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  }, k);

  await t.test('a two-decimal sub-band escalates to High, and a plain karyotype falls back', async () => {
    await page.goto(`http://127.0.0.1:${port}/?k=${encodeURIComponent('46,XY,idic(Y)(q11.23)')}`,
      { waitUntil: 'networkidle0' });
    let s = await state();
    assert.equal(s.level, '99', 'High is selected without a click');
    assert.equal(s.named, true, 'the named band q11.23 is drawn as its own stripe');
    assert.equal(s.urlBands, '850', 'the URL records the effective level');
    await draw('45,X');
    await page.waitForFunction(() => document.querySelector('#levelseg button.on')?.getAttribute('data-level') === '1');
    s = await state();
    assert.equal(s.level, '1', 'a karyotype naming no sub-sub-band returns to Std');
  });

  await t.test('a bands= in the arriving link pins the level', async () => {
    await page.goto(`http://127.0.0.1:${port}/?k=${encodeURIComponent('46,XY,idic(Y)(q11.23)')}&bands=550`,
      { waitUntil: 'networkidle0' });
    const s = await state();
    assert.equal(s.level, '1', 'the shared view stays what its sender saw');
    assert.equal(s.named, false, 'no q11.23 stripe at the pinned Std level');
  });

  await t.test('clicking the control ends the following', async () => {
    await page.goto(`http://127.0.0.1:${port}/?k=${encodeURIComponent('46,XY,idic(Y)(q11.23)')}`,
      { waitUntil: 'networkidle0' });
    assert.equal((await state()).level, '99');
    await page.evaluate(() => document.querySelector('#levelseg button[data-level="1"]').click());
    await page.waitForFunction(() => document.querySelector('#levelseg button.on')?.getAttribute('data-level') === '1');
    // Redraw the same karyotype: the explicit Std must hold.
    await draw('46,XY,idic(Y)(q11.23)');
    await new Promise((r) => setTimeout(r, 400));
    assert.equal((await state()).level, '1', 'the explicit choice survives a redraw');
  });

  await browser.close();
  server.close();
});
