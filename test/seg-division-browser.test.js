'use strict';
// The Robertsonian adjacent card boxes its four outcomes into two complementary
// pairs, one per division plane, and clicking a pair redraws the plane above
// (hidden radios + CSS, no JS). What a unit test cannot see is the layering
// that makes this work: an overlay label turns the whole pair into the click
// target while the conceptus buttons sit ABOVE the overlay and keep their own
// click. Both halves are exercised here on the served page: a click on the pair
// switches the plane, and a click on a button inside the pair still loads that
// karyotype instead of merely selecting the pair.
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

const state = () => ({
  aChecked: document.getElementById('seg-div-a').checked,
  bChecked: document.getElementById('seg-div-b').checked,
  sceneA: getComputedStyle(document.querySelector('.seg-scene-div[data-div="A"]')).display,
  sceneB: getComputedStyle(document.querySelector('.seg-scene-div[data-div="B"]')).display,
  firstPair: document.querySelector('#segregation .seg-pair').getAttribute('data-div'),
});

test('clicking a pair switches the drawn division plane; its buttons still load', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html?k=46,XY,der(13;14)(q10;q10),+14`,
      { waitUntil: 'load' });
    await page.waitForSelector('#segregation .seg-pair');

    await t.test('the typed pair leads, is preselected, and its plane is the one drawn', async () => {
      const s = await page.evaluate(state);
      assert.equal(s.firstPair, 'A', 'the +14 pair (13 alone) leads');
      assert.equal(s.aChecked, true);
      assert.equal(s.bChecked, false);
      assert.notEqual(s.sceneA, 'none', 'the selected plane is visible');
      assert.equal(s.sceneB, 'none', 'the other plane is hidden');
    });

    await t.test('a click anywhere on the other pair redraws that division', async () => {
      // The header is ordinary text under the overlay label, so this click must
      // land on the overlay and check the radio. scrollIntoView first: the panel
      // sits far below the fold, and an off-screen click dispatches nothing.
      const header = await page.$('#segregation .seg-pair[data-div="B"] .seg-pair-h');
      await header.scrollIntoView();
      await header.click();
      const s = await page.evaluate(state);
      assert.equal(s.bChecked, true, 'the pair click checked its radio');
      assert.equal(s.sceneA, 'none', 'the old plane is hidden');
      assert.notEqual(s.sceneB, 'none', 'the clicked pair’s plane is drawn');
    });

    await t.test('a conceptus button inside a pair keeps its own click (loads, not selects)', async () => {
      const btn = await page.$('#segregation .seg-pair[data-div="B"] .seg-kt[data-k="45,XY,-13"]');
      assert.ok(btn, 'the monosomy 13 button sits inside the division-B pair');
      await btn.scrollIntoView();
      await btn.click();
      await page.waitForFunction(() =>
        document.getElementById('kinput').value === '45,XY,-13');
      // The re-rendered panel serves the new karyotype; nothing more to assert
      // here beyond the load itself, which proves the button won the layering.
    });
  } finally {
    await browser.close();
    server.close();
  }
});
