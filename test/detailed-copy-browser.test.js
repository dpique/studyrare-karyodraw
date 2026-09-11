'use strict';
// The ISCN detailed form renders as label/form rows, which reads well but
// selects badly: a reader who wants the text (for a report, a slide, a
// question stem) had to drag-select across a CSS grid and hope. A small copy
// button beside the block's title now hands over every line as plain text,
// label and form separated by two spaces, one line per row (Dan, 2026-09-10).
// Driven in a real browser because the button, the flash, and the clipboard
// call all live where the block renders.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

test('the detailed form copies as plain text lines', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XX,+1,der(1;7)(q10;p10)')}&style=highlight`,
      { waitUntil: 'load' });
    await page.waitForSelector('#detailed .dline');

    await t.test('the button exists, titled, inside the block it copies', async () => {
      const btn = await page.evaluate(() => {
        const b = document.querySelector('#detailed #copydetail');
        return b && { title: b.getAttribute('title') || '', text: b.textContent };
      });
      assert.ok(btn, 'a copy button renders with the detailed form');
      assert.ok(btn.title.trim().length > 0, 'the button carries helper text');
    });

    await t.test('clicking hands over every line, label and form', async () => {
      await page.evaluate(() => {
        window.__copied = null;
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: (s) => { window.__copied = s; return Promise.resolve(); } },
          configurable: true,
        });
      });
      await page.click('#detailed #copydetail');
      const copied = await page.evaluate(() => window.__copied);
      assert.ok(copied, 'the clipboard received text');
      // One line, proper ISCN: the karyotype with every structural change written
      // in the detailed system, in the shell the standard prints (5.5.3 c).
      assert.equal(copied, '46,XX,+1,der(1;7)(1qter→1q10::7p10→7pter)');
      const shown = await page.$eval('#detailed #dfull', (e) => e.textContent);
      assert.equal(shown, copied, 'what is copied is the last row on screen');
    });

    await t.test('the copied line pastes back and draws', async () => {
      // The whole point (Dan, 2026-09-11): the app's own copy must be notation the
      // app reads. der(1;7) is a whole-arm derivative, which the reader converts.
      const copied = await page.evaluate(() => window.__copied);
      await page.evaluate((v) => { document.querySelector('#kinput').value = v; }, copied);
      await page.focus('#kinput');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => /Read as the detailed system, and drawn/.test(document.querySelector('#warnings').textContent));
      await page.waitForSelector('[data-drawing] svg');
      const drawn = await page.$$eval('[data-drawing] svg', (a) => a.length);
      assert.ok(drawn > 0, 'the pasted line draws');
      const header = await page.$eval('#warnings', (e) => e.textContent);
      assert.match(header, /45,XX,\+1,der\(1;7\)\(q10;p10\)|46,XX,\+1,der\(1;7\)\(q10;p10\)/, 'read back to the short form it came from');
    });

    await t.test('the button survives a redraw', async () => {
      // The block is rebuilt on every draw; the handler must not die with it.
      await page.focus('#kinput');
      await page.evaluate(() => { document.querySelector('#kinput').value = '46,XY,t(9;22)(q34;q11.2)'; });
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => {
        const el = document.querySelector('#detailed');
        return el && /der\(9\)|9pter/.test(el.textContent);
      });
      await page.evaluate(() => { window.__copied = null; });
      await page.click('#detailed #copydetail');
      const copied = await page.evaluate(() => window.__copied);
      assert.equal(copied, '46,XY,t(9;22)(9pter→9q34::22q11.2→22qter;22pter→22q11.2::9q34→9qter)', 'copies the new karyotype as one line');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
