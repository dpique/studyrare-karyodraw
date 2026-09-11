'use strict';
// Hovering a band answers twice: the tooltip names it and an amber outline
// shows exactly which band is meant. The outline builder read the band's
// x/y/width/height attributes, which only the linear rects have; on the ring,
// whose bands are arc-sector paths, that made an invisible NaN rect, so the
// tooltip spoke and the highlight never appeared (Dan, 2026-09-10). Driven in
// a real browser because the affordance is hit-testing plus drawing: the
// pointer must reach a ring band at all, and the mark it earns must have real
// geometry on screen.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

// A viewport point that actually lands on a band of the given figure: walk up
// the figure's vertical midline from the bottom until hit-testing reaches a
// `.band`. The bottom edge is band material on both shapes (the linear q-ter
// cap, the ring's 6-o'clock sector), and starting there dodges the fusion
// clasp at the ring's 12 o'clock.
const hoverPointOn = (page, sel) => page.evaluate((s) => {
  const svg = document.querySelector(s);
  if (!svg) return null;
  svg.scrollIntoView({ block: 'center' });
  const r = svg.getBoundingClientRect();
  const x = r.left + r.width / 2;
  for (let y = r.bottom - 1; y > r.top; y -= 1) {
    const el = document.elementFromPoint(x, y);
    if (el && el.closest && el.closest('.band')) return { x, y };
  }
  return null;
}, sel);

const hiState = (page) => page.evaluate(() => {
  const hi = document.querySelector('#karyo .band-hi');
  if (!hi) return null;
  const b = hi.getBBox();
  return { tag: hi.tagName.toLowerCase(), x: b.x, y: b.y, w: b.width, h: b.height };
});

test('hovering a band draws the amber outline, on the ring as on the linear body', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,r(13)(p11q34)')}&style=highlight&show=involved`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo .ideo-ring');

    const hover = async (sel) => {
      await page.mouse.move(0, 0);   // off the karyogram: mouseleave clears any prior mark
      const pt = await hoverPointOn(page, sel);
      assert.ok(pt, `${sel}: the pointer can reach a band`);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForSelector('#karyo .band-hi');
      return hiState(page);
    };

    await t.test('the ring band earns a drawn sector outline', async () => {
      const hi = await hover('#karyo .ideo-ring');
      assert.ok(hi, 'the highlight element exists');
      assert.ok([hi.x, hi.y, hi.w, hi.h].every(Number.isFinite),
        `the highlight has real geometry, not NaN attributes (${JSON.stringify(hi)})`);
      assert.ok(hi.w > 4 && hi.h > 4, `the highlight is visibly sized (${JSON.stringify(hi)})`);
    });

    await t.test('the linear homolog keeps its amber box', async () => {
      const hi = await hover('#karyo .kchrom[data-chrom="13"][data-kind="normal"] svg');
      assert.ok(hi, 'the highlight element exists');
      assert.equal(hi.tag, 'rect', 'the linear band still gets the rounded box');
      assert.ok([hi.x, hi.y, hi.w, hi.h].every(Number.isFinite) && hi.w > 4,
        `the box has real geometry (${JSON.stringify(hi)})`);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
