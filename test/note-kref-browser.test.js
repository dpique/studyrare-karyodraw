'use strict';
// A clinical note that names ANOTHER drawable rearrangement now links to it,
// so the reader of t(14;14)(q11;q32) can jump straight to inv(14)(q11q32) and
// back (Dan, 2026-09-10). The mention of the lesion already on screen stays
// plain text, because a card linking to itself answers nothing. The link
// carries the reader's current Style/Bands/Show settings and the drawn
// karyotype's own sex, and chooses the count the bare lesion needs (46 for a
// balanced exchange, 45 for a lone whole-arm derivative). Driven in a real
// browser because the linkifier runs where the card renders.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

test('clinical notes link the other rearrangement they name, never themselves', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });

    const cardState = async (k) => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight&bands=550`,
        { waitUntil: 'load' });
      await page.waitForSelector('#clinical-card .note');
      return page.evaluate(() => ({
        links: [...document.querySelectorAll('#clinical .note a.kref')]
          .map((a) => ({ text: a.textContent, href: a.getAttribute('href') })),
        noteText: [...document.querySelectorAll('#clinical .note')].map((n) => n.textContent).join(' '),
      }));
    };

    await t.test('the t(14;14) page links inv(14) and keeps its own mention plain', async () => {
      const s = await cardState('46,XY,t(14;14)(q11;q32)');
      const inv = s.links.find((l) => l.text === 'inv(14)(q11q32)');
      assert.ok(inv, `an inv(14) link exists (links: ${JSON.stringify(s.links)})`);
      assert.ok(inv.href.indexOf('k=46%2CXY%2Cinv(14)(q11q32)') >= 0,
        `the link draws the lesion in this page's own sex (${inv.href})`);
      assert.ok(inv.href.indexOf('style=highlight') >= 0 && inv.href.indexOf('bands=550') >= 0,
        `the reader's settings ride along (${inv.href})`);
      assert.ok(!s.links.some((l) => l.text.indexOf('t(14;14)') >= 0),
        'the rearrangement on screen is not a link to itself');
    });

    await t.test('the inv(16) page links t(16;16), and the reverse page links back', async () => {
      const a = await cardState('46,XY,inv(16)(p13.1q22)');
      assert.ok(a.links.some((l) => l.text === 't(16;16)(p13.1;q22)'),
        `t(16;16) is linked (links: ${JSON.stringify(a.links)})`);
      const b = await cardState('46,XX,t(16;16)(p13.1;q22)');
      const back = b.links.find((l) => l.text === 'inv(16)(p13.1q22)');
      assert.ok(back, `inv(16) is linked back (links: ${JSON.stringify(b.links)})`);
      assert.ok(back.href.indexOf('k=46%2CXX%2C') >= 0, `sex follows the page (${back.href})`);
    });

    await t.test('a lone whole-arm derivative mention links with the 45 count it needs', async () => {
      // The -7/del(7q) dosage card names der(1;7)(q10;p10); as a lone lesion
      // that derivative replaces two chromosomes, so its link must say 45.
      const s = await cardState('45,XY,-7');
      const der = s.links.find((l) => l.text === 'der(1;7)(q10;p10)');
      if (der) assert.ok(der.href.indexOf('k=45%2CXY%2Cder(1%3B7)(q10%3Bp10)') >= 0, der.href);
      else assert.ok(!/der\(1;7\)/.test(s.noteText), 'no der(1;7) mention on this page, nothing to link');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
