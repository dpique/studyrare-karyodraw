'use strict';
// Back and Forward walk every step the reader took. Chips, toggles and conceptus
// clicks already pushed an entry each; the Draw button and Enter did not, they
// replaced the current one, so the karyotype on screen BEFORE typing was
// overwritten. Dan saw it as Back "skipping a step" after clicking a did-you-mean
// chip (2026-09-11): type B over A, submit, click the chip for C, press Back
// twice, and A was gone. Driven in a real browser because it is history.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

const A = '46,XY,t(9;22)(q34;q11.2)';
const B = '5,XY,rob(14;21)(q10;q10)';          // refused, offers the 45 chip
const C = '45,XY,rob(14;21)(q10;q10)';

test('a submitted karyotype earns a history entry, so Back returns to what was on screen', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    const kNow = () => page.evaluate(() => new URL(location.href).searchParams.get('k'));
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(A)}`, { waitUntil: 'load' });
    await page.waitForSelector('[data-drawing] svg');
    const len0 = await page.evaluate(() => history.length);

    await page.evaluate((v) => { document.querySelector('#kinput').value = v; }, B);
    await page.focus('#kinput');
    await page.keyboard.press('Enter');
    await page.waitForSelector('#warnings .dym');
    assert.equal(await kNow(), B, 'the submit is in the URL');
    assert.equal(await page.evaluate(() => history.length), len0 + 1, 'and it is a new entry, not a replacement');

    await page.click('#warnings .dym');
    await page.waitForFunction((c) => new URL(location.href).searchParams.get('k') === c, {}, C);

    await page.goBack();
    await page.waitForFunction((b) => new URL(location.href).searchParams.get('k') === b, {}, B);
    await page.goBack();
    await page.waitForFunction((a) => new URL(location.href).searchParams.get('k') === a, {}, A);
    assert.equal(await page.$eval('#kinput', (e) => e.value), A, 'Back twice lands on the karyotype that was on screen before typing');
    await page.goForward();
    await page.waitForFunction((b) => new URL(location.href).searchParams.get('k') === b, {}, B);

    await t.test('submitting the same karyotype again does not add an entry', async () => {
      const len = await page.evaluate(() => history.length);
      await page.focus('#kinput');
      await page.keyboard.press('Enter');
      await page.waitForSelector('#warnings .dym');
      assert.equal(await page.evaluate(() => history.length), len);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
