'use strict';
// The parental-origin card in a real browser, both moods and the thread between
// them. Under an unbalanced karyotype the amber card leads the tool column with
// the carrier karyotypes as chips and NO meiosis panel below (those figures
// belong to the carrier page). Clicking a chip draws the parent carrying the
// child along as from=; the parent's own panel marks "the karyotype you came
// from" and the card, now plain, offers the way back. Driven through the page,
// not the module, because the unit tests bypass the draw gate.
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

test('the parental-origin card: amber chips out, plain marker back', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const open = async (page, query) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?${query}`, { waitUntil: 'load' });
    await page.waitForSelector('#kinput');
  };
  const state = (page) => page.evaluate(() => ({
    display: getComputedStyle(document.getElementById('origin-alert-card')).display,
    warn: document.getElementById('origin-alert-card').classList.contains('oal-warn'),
    head: (document.querySelector('#origin-alert .oal-head') || {}).textContent || '',
    chips: [...document.querySelectorAll('#origin-alert .seg-kt')].map((b) => ({
      k: b.getAttribute('data-k'), from: b.getAttribute('data-from'),
    })),
    panel: getComputedStyle(document.getElementById('segregation-card')).display,
    panelText: document.getElementById('segregation').textContent,
    input: document.getElementById('kinput').value,
    search: location.search,
  }));
  const waitAlert = (page) => page.waitForFunction(() =>
    getComputedStyle(document.getElementById('origin-alert-card')).display !== 'none');
  try {
    const page = await browser.newPage();

    await t.test('the unbalanced karyotype gets chips, and no meiosis panel', async () => {
      await open(page, 'k=' + encodeURIComponent('46,XX,der(4)t(4;11)(p15;q23)'));
      await waitAlert(page);
      const st = await state(page);
      assert.ok(st.warn, 'amber mood');
      assert.match(st.head, /A parent may be a balanced carrier/);
      assert.equal(st.chips.length, 2, 'either parent, as chips');
      assert.equal(st.chips[0].from, '46,XX,der(4)t(4;11)(p15;q23)', 'chips carry the from thread');
      assert.equal(st.panel, 'none', 'no meiosis figures under the child');
    });

    await t.test('a carrier chip draws the parent with the outcome marked', async () => {
      await page.evaluate(() => document.querySelector('#origin-alert .seg-kt').click());
      await page.waitForFunction(() =>
        document.getElementById('kinput').value === '46,XX,t(4;11)(p15;q23)');
      await waitAlert(page);
      const st = await state(page);
      assert.ok(!st.warn, 'plain mood on the carrier page');
      assert.match(st.head, /A possible carrier parent/);
      const label = await page.evaluate(() =>
        document.querySelector('#origin-alert .orig-who').textContent);
      assert.equal(label, 'could give rise to', 'the chip label speaks genetics, forward');
      assert.notEqual(st.panel, 'none', 'the forward panel renders here, where it is true');
      assert.match(st.panelText, /the karyotype you traced/, 'the traced outcome is marked');
      assert.match(st.search, /from=46,XX,der\(4\)/, 'the thread rides the URL');
    });

    await t.test('a view toggle keeps the marker; the return chip goes back clean', async () => {
      await page.evaluate(() => document.querySelector('#levelseg button[data-level]:not(.on)').click());
      await new Promise((r) => setTimeout(r, 150));
      let st = await state(page);
      assert.match(st.panelText, /the karyotype you traced/, 'same karyotype redrawn, thread kept');
      await page.evaluate(() => document.querySelector('#origin-alert .seg-kt').click());
      await page.waitForFunction(() =>
        /der\(4\)/.test(document.getElementById('kinput').value));
      await waitAlert(page);
      st = await state(page);
      assert.ok(st.warn, 'back on the child, amber again');
      assert.doesNotMatch(st.search, /from=/, 'the thread does not linger');
    });

    await t.test('a shared carrier link with from= restores the marker', async () => {
      await open(page, 'k=' + encodeURIComponent('46,XX,t(4;11)(p15;q23)') +
        '&from=' + encodeURIComponent('46,XX,der(4)t(4;11)(p15;q23)'));
      await waitAlert(page);
      const st = await state(page);
      assert.ok(!st.warn);
      assert.match(st.panelText, /the karyotype you traced/);
    });

    await t.test('a bogus from= is scrubbed, never rendered', async () => {
      await open(page, 'k=' + encodeURIComponent('46,XX,t(4;11)(p15;q23)') +
        '&from=' + encodeURIComponent('46,XY,del(5)(p15.2)'));
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('segregation-card')).display !== 'none');
      const st = await state(page);
      assert.equal(st.display, 'none', 'no card claims an outcome the panel does not produce');
      assert.doesNotMatch(st.panelText, /you traced/);
      assert.doesNotMatch(st.search, /from=/, 'and the URL is scrubbed');
    });

    await t.test('the textbook Emanuel spelling names the mother, one chip', async () => {
      await open(page, 'k=' + encodeURIComponent('47,XY,+der(22)t(11;22)(q23;q11.2)mat'));
      await waitAlert(page);
      const st = await state(page);
      assert.match(st.head, /names the mother/);
      assert.equal(st.chips.length, 1);
      assert.equal(st.chips[0].k, '46,XX,t(11;22)(q23;q11.2)');
    });

    await t.test('a subset hover inherits the page colors, in one popover only', async () => {
      // On 45,XX,der(14;21) the page hands 14 the first color and 21 the
      // second; the hovered 45,XX,-21 involves only 21 and must show it in the
      // page's amber, never in the first color it would earn on its own page.
      // And one hover means one popover: chips carry no title attribute, so no
      // native tooltip races the drawn preview.
      await open(page, 'k=' + encodeURIComponent('45,XX,der(14;21)(q10;q10)'));
      await page.waitForSelector('#segregation .seg-kt');
      assert.equal(await page.evaluate(() =>
        document.querySelectorAll('.seg-kt[title]').length), 0, 'no native tooltip on any chip');
      const chip = await page.$('#segregation .seg-kt[data-k="45,XX,-21"]');
      await chip.scrollIntoView();
      const box = await chip.boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForSelector('.ktpeek.on');
      const colors = await page.evaluate(() => ({
        fills: [...document.querySelectorAll('.ktpeek [fill]')].map((e) => e.getAttribute('fill')),
        below: document.querySelector('.ktpeek').getBoundingClientRect().top >
          document.querySelector('#segregation .seg-kt[data-k="45,XX,-21"]').getBoundingClientRect().top,
      }));
      assert.ok(colors.fills.includes('#ec9b27'), '21 wears the page amber in the preview');
      assert.ok(!colors.fills.includes('#5e72e4'), 'and never the first color the page gave to 14');
      assert.ok(colors.below, 'the popover opens below the chip, the one consistent side');
    });

    await t.test('a refusal sweeps the card with the rest of the drawing', async () => {
      await page.evaluate(() => {
        const input = document.getElementById('kinput');
        input.value = '45,XX,der(4)t(4;11)(p15;q23)';   // count contradicts the changes
        input.dispatchEvent(new Event('input', { bubbles: true }));
        document.getElementById('draw').click();
      });
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('origin-alert-card')).display === 'none');
      const st = await state(page);
      assert.equal(st.panel, 'none', 'the panel goes with it');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
