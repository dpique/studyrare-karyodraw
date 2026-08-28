'use strict';
// The detailed form points back at the figure: each segment's ink is the color its
// piece wears in the karyogram (the computeAffected palette), junctions and
// unjoined ends in gray. Highlight style only, because that is when the figure
// itself is colored; Realistic keeps plain ink, so the words never claim a color
// the picture does not show. Picked from a four-variant preview on 2026-08-28.
//
// The second half pins the decoded-token chip: a long ISCN token scrolls inside
// its chip, and the scrollbar has its own lane under the text. It used to ride ON
// the 13px token, which read as a rendering glitch rather than a control.
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
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

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

test('the detailed form wears the figure colors and the token chip scrolls', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
  });
  const open = async (page, k, style) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=${style}&show=involved`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg');
  };
  try {
    const page = await browser.newPage();
    await page.setCacheEnabled(false);

    await t.test('highlight: each piece takes its chromosome color from the palette', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)', 'highlight');
      const got = await page.evaluate(() => ({
        palette: window.Karyo.AFFECTED_PALETTE,
        colors: [...document.querySelectorAll('#detailed code span[style]')]
          .map((s) => (s.getAttribute('style').match(/color:\s*([^;]+)/) || [])[1]),
        junctions: document.querySelectorAll('#detailed .dj').length,
      }));
      assert.ok(got.colors.length >= 4, 'both derivatives carry colored pieces');
      got.colors.forEach((c) => assert.ok(got.palette.includes(c), `${c} is a figure color`));
      assert.ok(new Set(got.colors).size >= 2, 'chromosome 9 and 22 pieces differ');
      assert.ok(got.junctions >= 2, 'the :: junctions are marked to recede');
    });

    await t.test('realistic: plain ink, because the figure is not colored either', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)', 'realistic');
      const colored = await page.evaluate(() =>
        document.querySelectorAll('#detailed code span[style]').length);
      assert.equal(colored, 0);
    });

    await t.test('a long token scrolls inside its chip, scrollbar in its own lane', async () => {
      await open(page, '45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)'
        + 't(12;17)(q24.1;q11.2)t(7;17)(p13;q21)', 'highlight');
      const chip = await page.evaluate(() => {
        const chips = [...document.querySelectorAll('#decode .decode-code')];
        const long = chips.find((c) => c.scrollWidth > c.clientWidth);
        if (!long) return null;
        const cs = getComputedStyle(long);
        return { padBottom: cs.paddingBottom, padTop: cs.paddingTop, canScroll: true };
      });
      assert.ok(chip, 'the five-join der token overflows its chip and can scroll');
      assert.ok(parseFloat(chip.padBottom) > parseFloat(chip.padTop),
        'the scrollbar has its own lane below the text');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
