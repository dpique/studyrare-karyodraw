'use strict';
// The karyogram's scale bar (Dan's pick, 2026-08-30: the 50 Mb ruler with
// 10 Mb ticks, lower right). The claim that matters is metric honesty: the
// ruler's 50 Mb must span exactly 50e6 times the renderer's own px-per-bp, in
// the same coordinate space the chromosomes are drawn in, so the CSS fit
// transform scales both together and the bar can never lie about length.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHROME = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
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
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

test('the karyogram carries one honest 50 Mb ruler', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const open = async (page, k, style) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=${style}&show=involved`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo .scalebar');
  };
  try {
    const page = await browser.newPage();

    await t.test('the ruler spans 50 Mb at the renderer’s own scale, ticks included', async () => {
      await open(page, '46,XY,t(9;22)(q34;q11.2)', 'highlight');
      const got = await page.evaluate(() => {
        const svg = document.querySelector('#karyo .scalebar');
        const axis = svg.querySelector('line');
        const ticks = [...svg.querySelectorAll('line')].length - 1;
        return {
          span: parseFloat(axis.getAttribute('y2')) - parseFloat(axis.getAttribute('y1')),
          expected: 50e6 * window.Karyo.PX_PER_BP,
          ticks,
          label: svg.textContent,
          bars: document.querySelectorAll('#karyo .scalebar').length,
        };
      });
      assert.ok(Math.abs(got.span - got.expected) < 0.5,
        `ruler ${got.span}px vs ${got.expected}px at the renderer's scale`);
      assert.equal(got.ticks, 6, 'six tick marks, every 10 Mb from 0 to 50');
      assert.match(got.label, /50 Mb/);
      assert.equal(got.bars, 1, 'one ruler per figure');
    });

    await t.test('the ruler ends on the deepest chromosome bottom, not the lettering', async () => {
      // Dan, 2026-08-30: the bar measures the chromosomes, so its 50 Mb tick
      // aligns with the chromosome bottoms rather than the labels below them.
      // Both bar and bodies wear the same fit transform, so the client-rect
      // comparison holds at any width.
      const gap = await page.evaluate(() => {
        const svg = document.querySelector('#karyo .scalebar');
        const r = svg.getBoundingClientRect();
        const sf = r.height / parseFloat(svg.getAttribute('height'));
        const rulerEnd = r.top + (4 + 50e6 * window.Karyo.PX_PER_BP) * sf;
        const maxIdeo = Math.max(...[...document.querySelectorAll('#karyo svg.ideo')]
          .map((e) => e.getBoundingClientRect().bottom));
        return Math.abs(rulerEnd - maxIdeo);
      });
      assert.ok(gap < 1.5, `ruler end sits ${gap}px off the chromosome bottom line`);
    });

    await t.test('the Scale toggle turns it off, and the URL carries the choice', async () => {
      await page.click('#scaleseg button[data-scale="off"]');
      await page.waitForFunction(() => !document.querySelector('#karyo .scalebar'));
      const search = await page.evaluate(() => location.search);
      assert.ok(search.includes('scale=off'), 'the off state rides in the URL: ' + search);
      await page.click('#scaleseg button[data-scale="on"]');
      await page.waitForSelector('#karyo .scalebar');
      const search2 = await page.evaluate(() => location.search);
      assert.ok(!search2.includes('scale='), 'the default state keeps the URL clean: ' + search2);
    });

    await t.test('a scale=off deep link opens without the ruler', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=46,XX&style=highlight&scale=off`,
        { waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('#karyo svg'));
      const st = await page.evaluate(() => ({
        bar: !!document.querySelector('#karyo .scalebar'),
        segOff: document.querySelector('#scaleseg button[data-scale="off"]').classList.contains('on'),
      }));
      assert.ok(!st.bar, 'no ruler');
      assert.ok(st.segOff, 'and the toggle shows Off');
    });

    await t.test('realistic style keeps the ruler, and a mosaic still gets one', async () => {
      await open(page, 'mos 45,X[12]/46,XX[18]', 'realistic');
      const bars = await page.evaluate(() => document.querySelectorAll('#karyo .scalebar').length);
      assert.equal(bars, 1);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
