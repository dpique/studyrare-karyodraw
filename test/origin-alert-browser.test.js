'use strict';
// The parental-origin alert in a real browser: the amber card at the top of the
// tool column appears exactly when an unbalanced karyotype traces to a
// balanced-carrier parent, names the parent when the notation does, jumps to
// the full panel, and is swept away with everything else by the draw gate.
// Driven through the page, not the module, because the unit tests bypass the
// draw gate (see karyodraw-tests-bypass-the-draw-gate): a green Segregation
// test proves nothing about what a typed karyotype shows.
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

test('the parental-origin alert appears, names the parent, and obeys the gate', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const open = async (page, k) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}`, { waitUntil: 'load' });
    await page.waitForSelector('#kinput');
  };
  const alertState = (page) => page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('origin-alert-card')).display,
    head: (document.querySelector('#origin-alert .oal-head') || {}).textContent || '',
    body: (document.querySelector('#origin-alert .oal-body') || {}).textContent || '',
    jump: !!document.querySelector('#origin-alert a[href="#segregation-card"]'),
    panel: getComputedStyle(document.getElementById('segregation-card')).display,
    panelText: document.getElementById('segregation').textContent,
  }));
  try {
    const page = await browser.newPage();

    await t.test('a lone derivative raises the alert beside the figure', async () => {
      await open(page, '46,XX,der(4)t(4;11)(p15;q23)');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display !== 'none');
      const st = await alertState(page);
      assert.match(st.head, /A parent may be a balanced carrier/);
      assert.match(st.body, /Adjacent-1/);
      assert.ok(st.jump, 'the alert links down to the panel');
      assert.notEqual(st.panel, 'none', 'and the panel it points to is rendered');
      assert.match(st.panelText, /Where this came from/);
    });

    await t.test('the textbook Emanuel spelling, mat included, names the mother', async () => {
      await open(page, '47,XY,+der(22)t(11;22)(q23;q11.2)mat');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display !== 'none');
      const st = await alertState(page);
      assert.match(st.head, /names the mother/);
      assert.match(st.panelText, /the mother/);
    });

    await t.test('a homologous fusion product states the no-normal-child fact', async () => {
      await open(page, '46,XX,+21,der(21;21)(q10;q10)');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display !== 'none');
      const st = await alertState(page);
      assert.match(st.head, /Could a parent carry this fusion\?/);
      assert.match(st.panelText, /univalent/);
      assert.doesNotMatch(st.panelText, /Viable: chromosomally normal/,
        'the false trivalent claim (a normal gamete on offer) stays gone at the entry point');
      assert.match(st.panelText, /chromosomally normal child is not possible/,
        'and the negation is stated instead');
    });

    await t.test('a balanced carrier and a normal karyotype raise no alert', async () => {
      await open(page, '46,XX,t(11;22)(q23;q11.2)');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('segregation-card')).display !== 'none');
      let st = await alertState(page);
      assert.equal(st.display, 'none', 'the forward panel needs no alert');
      await open(page, '46,XX');
      await page.waitForFunction(() => document.querySelector('#karyo svg'));
      st = await alertState(page);
      assert.equal(st.display, 'none');
    });

    await t.test('a refusal sweeps the alert with the rest of the drawing', async () => {
      await open(page, '46,XX,der(4)t(4;11)(p15;q23)');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display !== 'none');
      await page.evaluate(() => {
        const input = document.getElementById('kinput');
        input.value = '45,XX,der(4)t(4;11)(p15;q23)';   // count contradicts the changes
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('draw').click();
      });
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display === 'none');
      const st = await alertState(page);
      assert.equal(st.panel, 'none', 'the panel goes with it');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
