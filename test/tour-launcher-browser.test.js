'use strict';
// The tour launcher died once from a load-time ReferenceError: the wiring block set
// the button label, hit a stale KD_PAGE_COUNT reference, and the enclosing script
// aborted before the click handler attached. The button read "(11 steps)" and did
// nothing. test/tour-launcher.test.js pins that exact regression by grepping
// index.html; this file closes the general case by loading the page in a real
// browser, so any load-time throw that kills the launcher fails the suite, not only
// the one identifier that has already done it.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();


const tourState = (page) => page.evaluate(() => ({
  display: document.getElementById('tourcard').style.display,
  counter: document.getElementById('tour-counter').textContent,
}));

test('the tour launcher works in a real browser', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('#tour-start');

    await t.test('the page loads with no JS error', () => {
      // A load-time throw is exactly what killed the launcher before: everything
      // below the throw, including addEventListener, never ran.
      assert.deepEqual(errors, [], 'page JS threw during load');
    });

    await t.test('clicking the launcher opens the tour', async () => {
      const before = await page.evaluate(
        () => document.getElementById('tourcard').style.display);
      assert.equal(before, 'none', 'the tour card starts hidden');
      await page.evaluate(() => document.getElementById('tour-start').click());
      const after = await tourState(page);
      assert.notEqual(after.display, 'none', 'the tour card is on screen after the click');
      assert.match(after.counter, /^Step 1 of \d+$/, 'the first step is loaded');
      assert.deepEqual(errors, [], 'the click ran without a JS error');
    });

    await t.test('?tour=1 opens the tour from the deep link', async () => {
      // The deep link is wired in the same block as the button, so the same throw
      // takes both down; the landing pages reach the tour only through this link.
      await page.goto(`http://127.0.0.1:${port}/index.html?tour=1`, { waitUntil: 'load' });
      await page.waitForSelector('#tourcard');
      const state = await tourState(page);
      assert.notEqual(state.display, 'none', 'the deep link opens the tour');
      assert.match(state.counter, /^Step \d+ of \d+$/, 'a step is loaded');
      // The deep link must also scroll the card to the top of the screen; the
      // smooth scroll is asynchronous, so wait for it to settle.
      await page.waitForFunction(() => {
        const r = document.getElementById('tourcard').getBoundingClientRect();
        return r.top >= -8 && r.top < 120;
      }, { timeout: 4000 });
      assert.deepEqual(errors, [], 'the deep-linked load ran without a JS error');
    });

    await t.test('Back leaves the tour instead of stranding its card', async () => {
      // Repro: draw something that pushes a history entry (an example chip),
      // start the tour, press Back. The entry being restored predates the tour,
      // and the card used to stay open, captioning a step over a drawing it no
      // longer describes. Every other draw path already calls leaveTourIfActive;
      // popstate must too.
      await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
      await page.waitForSelector('.chip');
      await page.click('.chip');                    // loadKaryotype -> a pushed entry
      await page.evaluate(() => document.getElementById('tour-start').click());
      assert.notEqual((await tourState(page)).display, 'none', 'the tour is open');
      await page.goBack();
      await page.waitForFunction(
        () => document.getElementById('tourcard').style.display === 'none',
        { timeout: 4000 });
      assert.deepEqual(errors, [], 'the Back navigation ran without a JS error');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
