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

// WCAG contrast against white, computed independently of the app's own color
// math so the assertion cannot be satisfied by a broken Karyo.textInk.
function contrastOnWhite(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(hex.slice(1 + i, 3 + i), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 1.05 / (0.2126 * r + 0.7152 * g + 0.0722 * b + 0.05);
}

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

    await t.test('highlight: each piece wears readable ink derived from its figure color', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)', 'highlight');
      const got = await page.evaluate(() => ({
        inks: window.Karyo.AFFECTED_PALETTE.map((p) => window.Karyo.textInk(p)),
        colors: [...document.querySelectorAll('#detailed code span[style]')]
          .map((s) => (s.getAttribute('style').match(/color:\s*([^;]+)/) || [])[1]),
        junctions: document.querySelectorAll('#detailed .dj').length,
      }));
      assert.ok(got.colors.length >= 4, 'both derivatives carry colored pieces');
      // textInk of the palette, not the palette raw: the raw entries are tuned for
      // filled shapes and the light ones (periwinkle, amber) were unreadable as
      // 12px text (Dan, 2026-08-29). The independent contrast check below keeps
      // this from ever regressing to "matches whatever textInk returns".
      got.colors.forEach((c) => assert.ok(got.inks.includes(c), `${c} is a figure ink`));
      got.colors.forEach((c) => assert.ok(contrastOnWhite(c) >= 4.5,
        `${c} reads as text on white (${contrastOnWhite(c).toFixed(2)}:1)`));
      assert.ok(new Set(got.colors).size >= 2, 'chromosome 9 and 22 pieces differ');
      assert.ok(got.junctions >= 2, 'the :: junctions are marked to recede');
    });

    await t.test('the label column hugs its content, no hand-tuned gulf', async () => {
      // Dan, 2026-08-30: der(8;8) sat a fixed 76px min-width away from its
      // string. The grid sizes the column by the longest label instead.
      await open(page, '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)', 'highlight');
      const gap = await page.evaluate(() => {
        const lab = document.querySelector('#detailed .dlab');
        const code = document.querySelector('#detailed code');
        return code.getBoundingClientRect().left - lab.getBoundingClientRect().right;
      });
      assert.ok(gap <= 14, `label-to-string gap is the grid gap, not a min-width (${gap}px)`);
    });

    await t.test('the colons explain themselves on hover (ISCN 4.4.4)', async () => {
      // The same der(8;8) string opens with a lone ":" (a break without
      // reunion, from the terminal del) and joins pieces with "::".
      const titles = await page.evaluate(() =>
        [...document.querySelectorAll('#detailed .dj[title]')].map((d) => [d.textContent, d.title]));
      const single = titles.find(([t2]) => t2 === ':');
      const dbl = titles.find(([t2]) => t2 === '::');
      assert.ok(single && /break without reunion/.test(single[1]), 'the broken end says what it is');
      assert.ok(dbl && /break and reunion/.test(dbl[1]), 'the junction does too');
    });

    await t.test('the block sits on the card gutter, not against the card border', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)', 'highlight');
      const gap = await page.evaluate(() => {
        const d = document.getElementById('detailed').getBoundingClientRect().left;
        const row = document.querySelector('.kactions');
        const a = row.getBoundingClientRect().left + parseFloat(getComputedStyle(row).paddingLeft);
        return Math.abs(d - a);
      });
      assert.ok(gap <= 1, `aligned with the actions row above it (off by ${gap}px)`);
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
