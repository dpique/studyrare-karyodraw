'use strict';
// The Involved segments row states its size as a range, because a break is
// located to a band and the figure cuts at the band's midpoint (Dan,
// 2026-09-11: figure unchanged, the range on the row). Driven in a browser
// because the text is composed where the table renders.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

test('the lost segment of del(5)(q13q33) reads as a size with its range', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XX,del(5)(q13q33)')}`, { waitUntil: 'load' });
    await page.waitForSelector('#imbalance table');
    const cells = await page.$$eval('#imbalance td.size', (tds) => tds.map((td) => ({ text: td.textContent.trim(), title: td.getAttribute('title') || '' })));
    const ranged = cells.filter((c) => /\(\d+(\.\d)? to \d+(\.\d)?\)/.test(c.text));
    assert.ok(ranged.length >= 1, 'at least one row states a range: ' + JSON.stringify(cells));
    assert.match(ranged[0].text, /^~\d+ Mb \(\d+ to \d+\)$/, 'shape: ~83 Mb (73 to 93)');
    assert.match(ranged[0].title, /located to a band/, 'the cell explains the range on hover');
    // A whole-chromosome gain has no range anywhere.
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('47,XX,+21')}`, { waitUntil: 'load' });
    await page.waitForSelector('#imbalance table');
    const plain = await page.$$eval('#imbalance td.size', (tds) => tds.map((td) => td.textContent.trim()));
    assert.ok(plain.every((tx) => !/ to /.test(tx)), 'no range without a breakpoint: ' + JSON.stringify(plain));
  } finally {
    await browser.close();
    server.close();
  }
});
