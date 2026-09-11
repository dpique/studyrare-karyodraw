'use strict';
// The input follows the URL-bar rule: focusing it while it holds exactly what is
// drawn (the demo, a chip, a tour step, a deep link, or anything after Draw)
// selects it all, so one keystroke starts the next karyotype; mid-edit focus never
// selects, so tweaking one breakpoint stays cheap. This runs in a real browser
// because the rule's one hazard is browser-specific: the mouseup that follows a
// click's focus would silently collapse the selection without the guard, and no
// grep of index.html can see whether it did. The same session also exercises the
// Show control gating, which needs a drawn normal karyotype to observe.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();


const selection = (page) => page.evaluate(() => {
  const i = document.getElementById('kinput');
  return { start: i.selectionStart, end: i.selectionEnd, len: i.value.length, value: i.value };
});

const fullySelected = (sel) => sel.len > 0 && sel.start === 0 && sel.end === sel.len;

// The Show (All/Affected) option row: hidden when the drawn karyotype has nothing
// to isolate, present when it does.
const showOptVisible = (page) => page.evaluate(() =>
  document.getElementById('showseg').parentNode.style.display !== 'none');

test('the drawn karyotype selects on focus, mid-edit does not', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('#kinput');

    await t.test('a click selects the whole drawn demo', async () => {
      // A real click, so the post-focus mouseup fires: that is the event the guard
      // exists for, and the assertion fails without it.
      await page.click('#kinput');
      const sel = await selection(page);
      assert.ok(sel.len > 0, 'the demo is pre-filled');
      assert.ok(fullySelected(sel), 'the drawn demo is fully selected');
    });

    await t.test('typing replaces the selection, and mid-edit refocus does not select', async () => {
      await page.keyboard.type('46,XX');
      const typed = await selection(page);
      assert.equal(typed.value, '46,XX', 'typing replaced the selected demo');
      // Blur, then refocus: the box holds an undrawn edit, which must survive.
      await page.click('h1');
      await page.click('#kinput');
      const sel = await selection(page);
      assert.ok(!fullySelected(sel), 'an undrawn edit is not auto-selected');
    });

    await t.test('drawing a normal karyotype hides the Show control', async () => {
      assert.equal(await showOptVisible(page), true, 'the demo translocation offers Affected');
      await page.keyboard.press('Enter');   // draws 46,XX
      await page.waitForFunction(() =>
        document.getElementById('summary').textContent.includes('46,XX'));
      assert.equal(await showOptVisible(page), false,
        'nothing to isolate in 46,XX, so the control is gone');
    });

    await t.test('once drawn, refocus selects all again', async () => {
      await page.click('h1');
      await page.click('#kinput');
      const sel = await selection(page);
      assert.equal(sel.value, '46,XX');
      assert.ok(fullySelected(sel), 'the drawn karyotype follows the URL-bar rule');
    });

    await t.test('a drawn deep link selects on focus too, and offers Affected', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=47%2CXX%2C%2B21`, { waitUntil: 'load' });
      await page.waitForSelector('#kinput');
      assert.equal(await showOptVisible(page), true, 'a trisomy has something to isolate');
      await page.click('#kinput');
      const sel = await selection(page);
      assert.equal(sel.value, '47,XX,+21', 'the deep link filled the input');
      // Safe to select: the drawing stays until the next Draw, and the notation
      // is recoverable from the drawing summary and the URL.
      assert.ok(fullySelected(sel), 'a drawn deep link is one keystroke from the next karyotype');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
