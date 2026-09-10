'use strict';
// The gonosomal segregation panel, driven in a real browser: the compute layer
// is covered in gonosomal-segregation.test.js, so what belongs here is the
// wiring a DOM can get wrong. The female carrier's cards must show BOTH sperm
// lanes; the male carriers must keep the schematic CHAIN pairing figure (the
// to-scale pachytene cross would draw a normal homolog of the exchange where
// the free gonosome actually sits); the conceptus chips must navigate; and the
// t(X;Y) page must draw its two derivatives in the karyogram even though the
// sex field is legitimately omitted from the notation.
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

test('gonosomal segregation panel in the browser', { skip: !CHROME && 'no Chrome found' }, async (t) => {
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1000 });
  const goto = (k) => page.goto(`http://127.0.0.1:${port}/?k=${encodeURIComponent(k)}`,
    { waitUntil: 'networkidle0' });

  await t.test('female X;autosome carrier: forked lanes, to-scale cross, panel visible', async () => {
    await goto('46,X,t(X;4)(p21;p16)');
    await page.waitForSelector('#segregation .seg-fork');
    const info = await page.evaluate(() => ({
      visible: document.querySelector('#segregation-card').style.display !== 'none',
      lanes: document.querySelectorAll('#segregation .seg-fork-when').length,
      whenX: [...document.querySelectorAll('#segregation .seg-fork-when')].filter((e) => /an X/.test(e.textContent)).length,
      pairingAria: document.querySelector('#segregation .seg-config-fig svg')?.getAttribute('aria-label') || '',
      note: !!document.querySelector('#segregation .seg-gnote'),
      oldCard: /Why there is no outcomes table/.test(document.querySelector('#segregation').textContent),
    }));
    assert.equal(info.visible, true);
    assert.equal(info.lanes, 32, 'sixteen gametes, two sperm lanes each');
    assert.equal(info.whenX, 16, 'half the lanes are the X-sperm fork');
    assert.match(info.pairingAria, /cross for 46,X,t\(X;4\)/, 'the true ring gets the to-scale pachytene cross');
    assert.equal(info.note, true, 'the X-inactivation reasoning renders');
    assert.equal(info.oldCard, false, 'the why-no-table card is gone for a modeled carrier');
  });

  await t.test('male carriers keep the schematic chain figure with pseudoautosomal contacts', async () => {
    for (const k of ['46,Y,t(X;4)(p21;p16)', '46,X,t(Y;15)(q12;p12)']) {
      await goto(k);
      await page.waitForSelector('#segregation .seg-config-fig svg');
      const info = await page.evaluate(() => ({
        aria: document.querySelector('#segregation .seg-config-fig svg').getAttribute('aria-label'),
        fert: document.querySelector('#segregation .seg-fert')?.textContent || '',
      }));
      assert.match(info.aria, /chain quadrivalent/, k + ' pairing figure is the chain, not the cross');
      assert.match(info.aria, /pseudoautosomal/, 'and says what holds it together');
      assert.ok(info.fert.length > 40, k + ' carries the fertility card');
    }
  });

  await t.test('a conceptus chip draws that karyotype', async () => {
    await goto('46,X,t(X;4)(p21;p16)');
    await page.waitForSelector('#segregation .seg-kt');
    await page.evaluate(() => {
      const chip = [...document.querySelectorAll('#segregation .seg-kt')]
        .find((b) => b.dataset.k === '45,X');
      chip.click();
    });
    await page.waitForFunction(() => document.querySelector('#kt-input, #karyotype, input[type="text"]')?.value === '45,X'
      || /45,X\b/.test(document.querySelector('h1,#result-title,#decoded h2')?.textContent || '')
      || new URLSearchParams(location.search).get('k') === '45,X');
    const k = await page.evaluate(() => new URLSearchParams(location.search).get('k'));
    assert.equal(k, '45,X', 'the Turner outcome chip loads its own page');
  });

  await t.test('the t(X;Y) page draws both derivatives and the entity card', async () => {
    await goto('46,t(X;Y)(p22.3;q11.2)');
    await page.waitForSelector('#segregation-card');
    const info = await page.evaluate(() => ({
      figures: document.querySelector('#karyo').textContent,
      entity: document.querySelector('#segregation').textContent,
      chips: [...document.querySelectorAll('#segregation .seg-kt')].map((b) => b.dataset.k),
    }));
    assert.match(info.figures, /der\(X\)/, 'the karyogram shows the der(X)');
    assert.match(info.figures, /der\(Y\)/, 'and the der(Y)');
    assert.match(info.entity, /recurrent X;Y translocation/);
    assert.ok(info.chips.includes('46,X,der(X)t(X;Y)(p22.3;q11.2)'), 'the familial unbalanced form is one click away');
  });

  await t.test('a typed gonosomal product gets the origin card, and its chip threads from=', async () => {
    await goto('46,XX,der(4)t(X;4)(p21;p16)');
    await page.waitForSelector('#origin-alert-card');
    const card = await page.evaluate(() => ({
      shown: document.querySelector('#origin-alert-card').style.display !== 'none',
      warn: document.querySelector('#origin-alert-card').classList.contains('oal-warn'),
      text: document.querySelector('#origin-alert').textContent,
      chipK: document.querySelector('#origin-alert .seg-kt')?.getAttribute('data-k') || null,
      chipFrom: document.querySelector('#origin-alert .seg-kt')?.getAttribute('data-from') || null,
    }));
    assert.equal(card.shown, true);
    assert.equal(card.warn, true, 'the amber caution mood, like the autosomal origin card');
    assert.match(card.text, /Only the mother could carry the balanced form/);
    assert.equal(card.chipK, '46,X,t(X;4)(p21;p16)');
    assert.equal(card.chipFrom, '46,XX,der(4)t(X;4)(p21;p16)', 'the chip threads the typed karyotype along');
    // Click through: the carrier page must mark the traced outcome.
    await page.evaluate(() => document.querySelector('#origin-alert .seg-kt').click());
    await page.waitForFunction(() => /the karyotype you traced/.test(document.querySelector('#segregation')?.textContent || ''));
    const marked = await page.evaluate(() => {
      const lane = [...document.querySelectorAll('#segregation .seg-here')][0];
      return lane ? lane.closest('.seg-fork-one').textContent : '';
    });
    assert.match(marked, /46,XX,der\(4\)t\(X;4\)\(p21;p16\)/, 'the traced conceptus lane wears the marker');
  });

  await t.test('the unmodelable spelling gets the redirect card with carrier chips', async () => {
    await goto('46,XX,t(X;4)(p21;p16)');
    await page.waitForSelector('#segregation-card');
    const info = await page.evaluate(() => ({
      text: document.querySelector('#segregation').textContent,
      chips: [...document.querySelectorAll('#segregation .seg-kt')].map((b) => b.dataset.k),
    }));
    assert.match(info.text, /No outcomes table for this spelling/);
    assert.ok(info.chips.includes('46,X,t(X;4)(p21;p16)'));
    assert.ok(info.chips.includes('46,Y,t(X;4)(p21;p16)'));
  });

  await browser.close();
  server.close();
});
