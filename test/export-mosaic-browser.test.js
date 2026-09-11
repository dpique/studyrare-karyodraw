'use strict';
// The exported PNG must show every cell line, the way the screen and the print
// sheet do. buildExportSVG took model.clones[0] and stopped, so exporting the
// shipped example mos 45,X[12]/46,XX[18] produced an image of one clone
// captioned with the full mosaic notation: the same bug renderPrintSheet had
// and fixed (its comment survives at the forEach), rediscovered on the PNG
// path in the 2026-09-10 audit.
//
// Driven through the real ↓ PNG button. The rasterizer loads the stitched SVG
// through a data: image, so the test wraps Image.src, captures that URL, and
// reads the exact SVG the PNG is made from, with no test hooks in the app.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

test('the exported PNG carries every clone of a mosaic', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    const k = 'mos 45,X[12]/46,XX[18]';
    // show=all pins the full complement (the app defaults to the involved-only
    // view), so the ideogram count below is deterministic: 45 + 46 = 91.
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&show=all`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg.ideo');

    // Capture the SVG the rasterizer feeds to its data: image, and keep the
    // image from ever loading so nothing downloads in headless.
    await page.evaluate(() => {
      window.__exportSvg = null;
      const desc = Object.getOwnPropertyDescriptor(Image.prototype, 'src');
      Object.defineProperty(Image.prototype, 'src', {
        set(v) {
          if (typeof v === 'string' && v.startsWith('data:image/svg+xml')) {
            window.__exportSvg = decodeURIComponent(v.slice(v.indexOf(',') + 1));
          }
        },
        get() { return desc.get.call(this); },
      });
    });
    await page.click('#dlimg');
    await page.waitForFunction('window.__exportSvg !== null', { timeout: 10000 });
    const svg = await page.evaluate(() => window.__exportSvg);

    await t.test('both cell lines are drawn', () => {
      // 45,X + 46,XX = 91 chromosome ideograms. One clone alone is at most 46.
      const ideos = (svg.match(/<svg[^>]*class="[^"]*ideo/g) || []).length;
      assert.ok(ideos >= 91, `expected at least 91 ideograms across both clones, found ${ideos}`);
    });

    await t.test('each clone is captioned with its own line and cell count', () => {
      assert.match(svg, /45,X\b[^<]*12 cells/, 'clone 1 header');
      assert.match(svg, /46,XX\b[^<]*18 cells/, 'clone 2 header');
    });

    await t.test('the title is still the single full notation', () => {
      assert.ok(svg.includes('mos 45,X[12]/46,XX[18]'), 'one title, the notation as typed');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
