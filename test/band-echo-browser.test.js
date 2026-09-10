'use strict';
// Hovering a band answered "what is this called" and nothing else. The skill a
// karyogram actually teaches is dosage and provenance: where else does this
// material live, and how many copies of it does this cell carry. The renderer
// already stamps every band rect with its SOURCE chromosome, so the same hover
// can light a dashed twin on every other place the band is drawn and put the
// count of places on the tooltip. 46,XX,+1,der(1;7)(q10;p10), the classic
// +1q/-7q of myeloid disease, exercises all three readings at once: a 1q band
// lives in three places (both normal-shaped 1s and the derivative), a 7p band
// in two, and a 7q band in one, because the derivative carries no 7q and the
// lone normal 7 is all there is. Driven in a real browser because the feature
// is hit-testing plus drawing across sibling SVGs.
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

const K = '46,XX,+1,der(1;7)(q10;p10)';

test('a hovered band lights every other place its material is drawn', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(K)}&style=highlight`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo .kchrom[data-kind="der"] .band');

    // Hover the first band on a NORMAL-kind cell whose name starts with the
    // given prefix, then read the marks. The echoes are asserted without a
    // wait of their own: highlight() draws them in the same synchronous
    // handler as .band-hi, so once the solid mark exists the dashed ones
    // either exist or the feature is broken.
    const hover = async (chrom, prefix) => {
      await page.mouse.move(0, 0);   // off the karyogram: mouseleave clears any prior mark
      const pt = await page.evaluate((c, pre) => {
        const el = [...document.querySelectorAll(`#karyo .kchrom[data-kind="normal"] .band[data-chrom="${c}"]`)]
          .find((n) => (n.getAttribute('data-band') || '').startsWith(pre));
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, chrom, prefix);
      assert.ok(pt, `${chrom}${prefix}: a band on a normal homolog exists to hover`);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForSelector('#karyo .band-hi');
      return page.evaluate(() => ({
        echoes: [...document.querySelectorAll('#karyo .band-echo')].map((e) => ({
          pointerEvents: e.getAttribute('pointer-events'),
          dashed: !!e.getAttribute('stroke-dasharray'),
          cellKind: (e.ownerSVGElement.closest('.kchrom') || {}).getAttribute
            ? e.ownerSVGElement.closest('.kchrom').getAttribute('data-kind') : null,
        })),
        tip: (document.querySelector('#tooltip') || { textContent: '' }).textContent,
      }));
    };

    await t.test('a 1q band is in three places: both normal-shaped 1s and the der', async () => {
      const s = await hover('1', 'q25');
      assert.equal(s.echoes.length, 2, `two dashed twins (got ${JSON.stringify(s.echoes)})`);
      assert.deepEqual(s.echoes.map((e) => e.cellKind).sort(), ['der', 'gain'],
        'the twins sit on the extra 1 and on the derivative, not on the hovered cell');
      assert.match(s.tip, /in 3 places/, `the tooltip counts the places (got "${s.tip}")`);
    });

    await t.test('a 7p band is in two places: the lone 7 and the der graft', async () => {
      const s = await hover('7', 'p15');
      assert.equal(s.echoes.length, 1, `one dashed twin (got ${JSON.stringify(s.echoes)})`);
      assert.equal(s.echoes[0].cellKind, 'der', 'the twin is the graft on the derivative');
      assert.match(s.tip, /in 2 places/, `the tooltip counts the places (got "${s.tip}")`);
    });

    await t.test('a 7q band is in one place, and absence is the signal', async () => {
      const s = await hover('7', 'q22');
      assert.equal(s.echoes.length, 0, 'nothing echoes: no other copy of 7q exists');
      assert.match(s.tip, /in 1 place\b/, `the tooltip states the single place (got "${s.tip}")`);
    });

    await t.test('echoes are annotations: dashed, and no echo may swallow the pointer', async () => {
      const s = await hover('1', 'q25');
      for (const e of s.echoes) {
        assert.equal(e.pointerEvents, 'none', 'the tooltip invariant (#197) holds for echoes');
        assert.ok(e.dashed, 'an echo is dashed; solid means the cursor is here');
      }
    });
  } finally {
    await browser.close();
    server.close();
  }
});
