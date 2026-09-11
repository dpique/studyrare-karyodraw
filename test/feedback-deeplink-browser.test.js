'use strict';
// The generated pages' "Send feedback" used to link to GitHub issues, a channel a
// non-technical reader will never use. It now deep-links to the app's own feedback
// dialog (?feedback=1), the same form the footer button opens: the message lands in
// D1 and reaches the maintainer in the daily digest, with no account and no email
// client. These tests drive the deep link in a real browser, because the wiring
// lives in the same init block whose load-time death once killed the tour launcher.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();


test('the feedback deep link opens the dialog in a real browser', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));

    await t.test('?feedback=1 opens the general feedback form', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?feedback=1`, { waitUntil: 'load' });
      await page.waitForSelector('#fbdialog');
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        title: document.getElementById('fbtitle').textContent,
      }));
      assert.equal(state.open, true, 'the feedback dialog is open on load');
      assert.equal(state.title, 'Send feedback', 'general mode, not flag mode');
      assert.deepEqual(errors, [], 'the deep-linked load ran without a JS error');
    });

    await t.test('?k=...&feedback=1 keeps the karyotype context', async () => {
      // A landing page's footer sends its own notation along, so the feedback that
      // arrives says which karyotype the reader was looking at.
      await page.goto(
        `http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('47,XX,+21')}&feedback=1`,
        { waitUntil: 'load' });
      await page.waitForSelector('#fbdialog');
      const state = await page.evaluate(() => ({
        open: document.getElementById('fbdialog').open,
        k: document.getElementById('kinput').value,
      }));
      assert.equal(state.open, true, 'the dialog is open');
      assert.equal(state.k, '47,XX,+21', 'the karyotype from the link is loaded behind it');
      assert.deepEqual(errors, [], 'no JS error');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
