'use strict';
// A genetic counselor wrote in (2026-09-10) asking how to print "the
// quadrivalent pics and information" for patients, and the honest answer was
// that they printed nowhere: the print stylesheet hides the live page, and
// the print sheet stopped at the clinical notes. The sheet now embeds the
// segregation panel through the same gate and the same renderer as the
// screen, so what the page teaches a carrier is what the paper says. No
// print-options dialog on purpose: one click prints what is on screen.
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

test('the print sheet carries the segregation panel exactly when the screen does', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });

    // The section materializes only between beforeprint and afterprint, so a
    // second live copy of the panel never doubles the scenes the on-screen
    // interactions (and their tests) count. The test drives both events, the
    // way the print dialog does.
    const sheet = async (k) => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight`,
        { waitUntil: 'load' });
      await page.waitForSelector('#printsheet .ps-pic');
      return page.evaluate(() => {
        const idle = document.querySelectorAll('.seg-scene-svg').length;
        window.dispatchEvent(new Event('beforeprint'));
        const seg = document.querySelector('#printsheet .ps-seg');
        const out = {
          idle,
          filled: !!(seg && seg.innerHTML.trim()),
          scene: document.querySelectorAll('#printsheet .ps-seg .seg-scene-svg').length,
          text: seg ? seg.textContent : '',
        };
        window.dispatchEvent(new Event('afterprint'));
        out.cleared = !seg || !seg.innerHTML.trim();
        return out;
      });
    };

    await t.test('a reciprocal-translocation carrier prints the quadrivalent and its outcomes', async () => {
      // A constitutional exchange with no cancer record: the acquired
      // lesions (the DSRCT t(11;22), the Philadelphia t(9;22)) suppress the
      // segregation panel on screen, and the sheet mirrors the screen.
      const s = await sheet('46,XX,t(4;6)(q21;q23)');
      assert.ok(s.filled, 'the segregation section fills for the print snapshot');
      assert.ok(s.scene >= 1, 'the pairing figure prints');
      assert.match(s.text, /Meiotic segregation/, 'under its own heading');
      assert.match(s.text, /Alternate/, 'the outcomes print with their names');
      assert.ok(s.cleared, 'and empties again after printing');
    });

    await t.test('a Robertsonian carrier prints the trivalent the same way', async () => {
      const s = await sheet('45,XY,rob(14;21)(q10;q10)');
      assert.ok(s.filled && s.scene >= 1, 'the trivalent figure prints');
    });

    await t.test('a non-carrier sheet stays as it was', async () => {
      const s = await sheet('47,XX,+21');
      assert.ok(!s.filled, 'no segregation section where the screen shows none');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
