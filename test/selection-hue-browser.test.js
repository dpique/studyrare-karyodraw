'use strict';
// The selection ring wears the selected chromosome's own figure color (Dan,
// 2026-09-09): the band map a click opens is drawn in that same hue, and the
// old fixed periwinkle ring around the amber chromosome 5 whispered the wrong
// "which". The hue rides in as --sel-ring/--sel-bg from markSel; chromosomes
// with no identity hue (uninvolved gray, the Realistic theme) keep the neutral
// fallback ring the CSS carries, and deselection clears the properties so a
// ring never wears a hue left over from another chromosome.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

// The legend chip's inline background, as a lowercase hex string, so the ring
// can be checked against the exact hue the legend keys for that chromosome.
const legendHex = (page, label) => page.evaluate((lab) => {
  const item = [...document.querySelectorAll('#legend .item')].find((el) => el.textContent.trim() === lab);
  if (!item || !item.firstElementChild) return null;
  const m = item.firstElementChild.style.background.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('') : null;
}, label);

// Scoped to the on-screen karyogram: the print sheet repeats the same markup.
const selState = (page, chrom) => page.evaluate((c) => {
  const nodes = [...document.querySelectorAll(`#karyo .kchrom[data-chrom="${c}"]`)];
  return nodes.map((n) => ({
    sel: n.classList.contains('sel'),
    ring: n.style.getPropertyValue('--sel-ring'),
    bg: n.style.getPropertyValue('--sel-bg'),
  }));
}, chrom);

test('the selection ring takes the chromosome hue, and only where hues exist', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  const open = async (page, k, extra) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&${extra || 'style=highlight&show=involved'}`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
  };
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await t.test('clicking the amber chromosome rings it amber, both homologs', async () => {
      await open(page, '46,XY,del(5)(p15.2),inv(2)(p13q24)');
      const chr5 = await legendHex(page, 'chr 5');
      assert.ok(chr5, 'the legend keys chromosome 5');
      await page.click('.kchrom[data-chrom="5"]');
      const st = await selState(page, '5');
      assert.equal(st.length, 2, 'the pair');
      st.forEach((n) => {
        assert.ok(n.sel, 'selected');
        assert.ok(n.ring.includes(chr5), `the ring mixes the chromosome's own hue: ${n.ring}`);
        assert.ok(n.bg.includes(chr5), 'and so does the wash');
      });
    });

    await t.test('reselecting hands the hue over and clears the old one', async () => {
      const chr2 = await legendHex(page, 'chr 2');
      await page.click('.kchrom[data-chrom="2"]');
      (await selState(page, '2')).forEach((n) => {
        assert.ok(n.sel && n.ring.includes(chr2), 'chromosome 2 wears its own hue');
      });
      (await selState(page, '5')).forEach((n) => {
        assert.ok(!n.sel, 'chromosome 5 is deselected');
        assert.equal(n.ring, '', 'and carries no leftover hue');
      });
    });

    await t.test('an uninvolved chromosome keeps the neutral fallback ring', async () => {
      await open(page, '46,XY,del(5)(p15.2),inv(2)(p13q24)', 'style=highlight&show=all');
      await page.click('.kchrom[data-chrom="7"]');
      const st = await selState(page, '7');
      assert.ok(st.length && st.every((n) => n.sel && n.ring === ''),
        'selected, with no identity hue to wear');
    });

    await t.test('the Realistic theme rings neutrally even on an involved chromosome', async () => {
      await open(page, '46,XY,del(5)(p15.2),inv(2)(p13q24)', 'style=realistic&show=involved');
      await page.click('.kchrom[data-chrom="5"]');
      const st = await selState(page, '5');
      assert.ok(st.length && st.every((n) => n.sel && n.ring === ''),
        'the bare slide keeps its bare ring');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
