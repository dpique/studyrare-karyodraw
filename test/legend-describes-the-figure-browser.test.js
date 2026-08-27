'use strict';
// The legend describes the figure it sits under, not the renderer's whole
// vocabulary. Dan drew 46,XY,t(9;22)(q34;q11.2) and the legend taught him a
// duplication frame, inversion hooks and red breakpoint carets, none of which
// were on screen, while the dashed fusion seam, the one mark the figure DOES
// carry, had no entry at all. A legend row now appears exactly when its mark
// is in the drawn karyogram, read off the DOM after render, so the two can
// never disagree. This runs in a real browser because buildLegend queries the
// live karyogram; no unit harness renders that pipeline end to end.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean).find((p) => fs.existsSync(p));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) { res.writeHead(204).end(); return; }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

const legendText = (page) => page.evaluate(() => document.getElementById('legend').textContent);

test('the legend lists exactly the marks the figure draws', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  const open = async (page, k) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight&show=affected`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
  };
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await t.test('a plain translocation teaches the seam and nothing it does not draw', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)');
      const leg = await legendText(page);
      assert.match(leg, /fused/i, 'the dashed fusion junction, the mark actually on screen');
      assert.ok(!/duplicated segment/.test(leg), 'no dup frame drawn, no dup row');
      assert.ok(!/inversion/i.test(leg), 'no hooks drawn, no inversion row');
      assert.ok(!/breakpoint/.test(leg), 'no carets drawn, no caret row');
    });

    await t.test('the rec teaches box, hooks and carets, and no seam', async () => {
      await open(page, '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat');
      const leg = await legendText(page);
      assert.match(leg, /duplicated segment/, 'the amber box is on screen');
      assert.match(leg, /inversion/i, 'the teal hooks are on screen');
      assert.match(leg, /breakpoint/, 'the junction carets are on screen');
      assert.ok(!/fused/i.test(leg), 'one chromosome, no fusion seam');
    });

    await t.test('an inversion teaches hooks without any box row', async () => {
      await open(page, '46,XX,inv(2)(p21q31)');
      const leg = await legendText(page);
      assert.match(leg, /inversion/i, 'hooks alone mean inverted');
      assert.ok(!/duplicated segment/.test(leg), 'nothing is duplicated');
    });

    await t.test('a normal karyotype keeps the quiet fallback line', async () => {
      await open(page, '46,XX');
      const leg = await legendText(page);
      assert.match(leg, /nothing to highlight/i);
      assert.ok(!/duplicated segment|inversion|breakpoint|fused/i.test(leg));
    });
  } finally {
    await browser.close();
    server.close();
  }
});

// A mark row draws its mark. These arrived as the same filled block whatever they
// meant, so the swatch carried only the color and the words carried the rest. The
// block also contradicted its own label: the dup frame is an outline, drawn
// fill="none". The hatch rows had always reproduced their hatch, at the render's own
// angle; these rows now reproduce their mark. Rows where the COLOR is the meaning
// (gray = uninvolved, "chr 2") keep the block.
//
// And because the swatch shows the shape, the label stopped naming it: "hooks:
// inverted, drawn end-for-end" is now "inversion", "carets: a breakpoint" is now
// "breakpoint". A row that both draws a mark and spells the mark out says it twice.
test('the mark rows draw their mark, not a colored block', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  // Every legend row as { label, sw } where sw is the swatch's outerHTML, so a test
  // can ask what a given row actually drew rather than trusting the label alone.
  const rows = (page) => page.evaluate(() =>
    [...document.querySelectorAll('#legend .item')].map((el) => ({
      label: el.textContent.trim(),
      sw: (el.firstElementChild && el.firstElementChild.outerHTML) || '',
    })));
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat')}&style=highlight&show=affected`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
    const got = await rows(page);
    const find = (re) => got.find((r) => re.test(r.label));

    const box = find(/^box: duplicated/), hooks = find(/^inversion$/i), carets = find(/^breakpoint$/i);
    assert.ok(box && hooks && carets, 'the rec draws all three marks');
    [box, hooks, carets].forEach((r) =>
      assert.match(r.sw, /^<svg class="sw-mk"/, `"${r.label}" should draw its mark, not a block`));

    // Each swatch is the mark the label names, not three recolorings of one shape.
    assert.match(box.sw, /<rect[^>]*fill="none"[^>]*stroke=/, 'the dup box is an outline, as the figure draws it');
    assert.equal((hooks.sw.match(/<path/g) || []).length, 4, 'two lead-in arcs and two arrowheads');
    assert.match(hooks.sw, /A[\d.]+ [\d.]+ 0 0 1/, 'the quarter turn, same sweep as drawSpanMark');
    assert.match(carets.sw, /<line[^>]*stroke-width="1\.2"/, 'the breakpoint rule');
    assert.equal((carets.sw.match(/<path/g) || []).length, 2, 'and two inward heads');
    const shapeOf = (s) => s.replace(/(stroke|fill)="#[0-9a-f]{3,8}"/gi, '');
    assert.notEqual(shapeOf(box.sw), shapeOf(hooks.sw), 'box and hooks differ by more than color');
    assert.notEqual(shapeOf(hooks.sw), shapeOf(carets.sw), 'hooks and carets differ by more than color');

    // Each mark keeps the operator color it is drawn in on the karyogram.
    const OP = await page.evaluate(() => window.Karyo.OP_COLORS);
    assert.ok(box.sw.includes(OP.dup), 'the dup box stays amber');
    assert.ok(hooks.sw.includes(OP.inv), 'the hooks stay teal');

    // A color-only row is still a block: there the color IS the meaning.
    const chr = find(/^chr \d/);
    assert.ok(chr, 'the involved-chromosome key is present');
    assert.match(chr.sw, /^<span class="sw"/, 'a color key stays a filled block');
  } finally {
    await browser.close();
    server.close();
  }
});

// The dashed fusion seam is a mark too, and joins the same grammar: the seam row
// draws a dashed rule over the body instead of a block striped by CSS gradient.
test('the fusion seam row draws the seam', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,t(9;22)(q34;q11.2)')}&style=highlight&show=affected`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
    const seam = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#legend .item')].find((e) => /fused/i.test(e.textContent));
      return el && el.firstElementChild ? el.firstElementChild.outerHTML : '';
    });
    assert.match(seam, /^<svg class="sw-mk"/, 'the seam row draws a mark');
    assert.match(seam, /stroke-dasharray="2 1\.5"/, 'the same dash the renderer emits');
  } finally {
    await browser.close();
    server.close();
  }
});

// The visitor's der(15)ins URL, end to end: the spelling is repaired and the
// page DRAWS, so the message about it is a note, not an alarm ("Let us sort
// this out" over a finished drawing contradicts itself), the moved span is
// boxed in slate with its legend row, and the repair cites the insertion's
// own rule (ISCN 5.5.9.1) rather than the generic two-breakpoint lesson.
test('a repaired insertion reads as a note, and the figure shows the move', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,der(15)ins(15)(p11;q23q26)')}&style=highlight&show=affected`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
    const warn = await page.evaluate(() => document.getElementById('warnings').textContent);
    assert.match(warn, /already applied/, 'the repair presents as a done deed');
    assert.match(warn, /5\.5\.9\.1/, 'and cites the insertion rule');
    assert.ok(!/sort this out/i.test(warn), 'no alarm over a drawing that succeeded');
    const noteStyled = await page.evaluate(() => !!document.querySelector('#warnings .notebox'));
    assert.ok(noteStyled, 'neutral note styling, not the amber warnbox');
    const leg = await page.evaluate(() => document.getElementById('legend').textContent);
    assert.match(leg, /moved segment/, 'the legend names the box the figure now draws');
  } finally {
    await browser.close();
    server.close();
  }
});
