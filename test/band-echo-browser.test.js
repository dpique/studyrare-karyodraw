'use strict';
// Hovering a band answered "what is this called" and nothing else. The skill a
// karyogram actually teaches is dosage and provenance: where else does this
// material live, and how many copies of it does this cell carry. The renderer
// already stamps every band rect with its SOURCE chromosome, so the same hover
// lights a twin on every other place the band is drawn and puts the count of
// places on the tooltip. The twins draw the SAME solid amber box as the mark
// under the pointer: a dashed variant shipped for a few hours and read too
// faint at band size (Dan, 2026-09-10), and the cursor position already says
// which copy is being pointed at. 46,XX,+1,der(1;7)(q10;p10), the classic
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

    // Hover the first band on a cell of the given kind whose name starts with
    // the given prefix, then read the marks. The echoes are asserted without
    // a wait of their own: highlight() draws them in the same synchronous
    // handler as .band-hi, so once the solid mark exists the twins either
    // exist or the feature is broken.
    const hover = async (chrom, prefix, kind) => {
      await page.mouse.move(0, 0);   // off the karyogram: mouseleave clears any prior mark
      const pt = await page.evaluate((c, pre, kd) => {
        const el = [...document.querySelectorAll(`#karyo .kchrom[data-kind="${kd}"] .band[data-chrom="${c}"]`)]
          .find((n) => (n.getAttribute('data-band') || '').startsWith(pre));
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, chrom, prefix, kind || 'normal');
      assert.ok(pt, `${chrom}${prefix}: a band to hover exists`);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForSelector('#karyo .band-hi');
      const state = await page.evaluate(() => ({
        hi: { width: document.querySelector('#karyo .band-hi').getAttribute('stroke-width') },
        echoes: [...document.querySelectorAll('#karyo .band-echo')].map((e) => ({
          pointerEvents: e.getAttribute('pointer-events'),
          dash: e.getAttribute('stroke-dasharray'),
          width: e.getAttribute('stroke-width'),
          cellKind: (e.ownerSVGElement.closest('.kchrom') || {}).getAttribute
            ? e.ownerSVGElement.closest('.kchrom').getAttribute('data-kind') : null,
        })),
        tip: (document.querySelector('#tooltip') || { textContent: '' }).textContent,
        tipBox: (() => { const b = document.querySelector('#tooltip').getBoundingClientRect(); return { left: b.left, right: b.right }; })(),
      }));
      state.pt = pt;
      return state;
    };

    await t.test('a 1q band is in three places: both normal-shaped 1s and the der', async () => {
      const s = await hover('1', 'q25');
      assert.equal(s.echoes.length, 2, `two twins (got ${JSON.stringify(s.echoes)})`);
      assert.deepEqual(s.echoes.map((e) => e.cellKind).sort(), ['der', 'gain'],
        'the twins sit on the extra 1 and on the derivative, not on the hovered cell');
      assert.match(s.tip, /in 3 places/, `the tooltip counts the places (got "${s.tip}")`);
    });

    await t.test('a 7p band is in two places: the lone 7 and the der graft', async () => {
      const s = await hover('7', 'p15');
      assert.equal(s.echoes.length, 1, `one twin (got ${JSON.stringify(s.echoes)})`);
      assert.equal(s.echoes[0].cellKind, 'der', 'the twin is the graft on the derivative');
      assert.match(s.tip, /in 2 places/, `the tooltip counts the places (got "${s.tip}")`);
    });

    await t.test('a 7q band is in one place, and absence is the signal', async () => {
      const s = await hover('7', 'q22');
      assert.equal(s.echoes.length, 0, 'nothing echoes: no other copy of 7q exists');
      assert.match(s.tip, /in 1 place\b/, `the tooltip states the single place (got "${s.tip}")`);
    });

    await t.test('every twin is the same solid box as the mark, and none may swallow the pointer', async () => {
      const s = await hover('1', 'q25');
      for (const e of s.echoes) {
        assert.equal(e.pointerEvents, 'none', 'the tooltip invariant (#197) holds for echoes');
        assert.equal(e.dash, null, 'twins are solid; the dashed variant read too faint');
        assert.equal(e.width, s.hi.width, 'twins wear the same stroke weight as the mark under the pointer');
      }
    });

    await t.test('the tip stays quiet about a plain shade, and names a special texture', async () => {
      // A plain Giemsa band's shade is visible under the cursor and narrated
      // in the band map the same hover opens, so the tip no longer repeats
      // it; the centromeric hatch keeps its name, which explains a texture
      // the shade vocabulary cannot.
      const plain = await hover('1', 'q25');
      assert.ok(plain.tip.indexOf('G-negative') < 0 && plain.tip.indexOf('G-positive') < 0,
        `a visible shade is not narrated (got "${plain.tip}")`);
      const cen = await hover('7', 'p11.1');
      assert.match(cen.tip, /Centromeric band/, `the hatch keeps its explanation (got "${cen.tip}")`);
    });

    await t.test('the tip sits on the side away from the middle of the karyogram', async () => {
      // The normal 1 is the leftmost cell, so its tip must open to the LEFT
      // of the cursor and leave the neighbours readable; the lone 7 is the
      // rightmost cell and keeps the tip on the right.
      const l = await hover('1', 'q25');
      assert.ok(l.tipBox.right <= l.pt.x, `left-half cell: tip right edge ${l.tipBox.right} sits left of the cursor ${l.pt.x}`);
      const r = await hover('7', 'p15');
      assert.ok(r.tipBox.left >= r.pt.x, `right-half cell: tip left edge ${r.tipBox.left} sits right of the cursor ${r.pt.x}`);
    });
  } finally {
    await browser.close();
    server.close();
  }
});

test('a band cut through by a breakpoint says so on the tooltip', async (t) => {
  // 46,XX,t(11;22)(p13;q12): the break falls INSIDE band 11p13 (the notation
  // cannot say where, so the drawing uses the band midpoint), which puts p13
  // material in three places: the intact homolog, the proximal piece on
  // der(11), and the distal piece riding the translocated tip on der(22).
  // Three places summing to two copies confused its own author twice (Dan,
  // 2026-09-10, here and on t(14;14)), so the tooltip now names the cause.
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XX,t(11;22)(p13;q12)')}&style=highlight`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo .kchrom[data-kind="t"] .band');

    const tipFor = async (prefix) => {
      await page.mouse.move(0, 0);
      const pt = await page.evaluate((pre) => {
        const el = [...document.querySelectorAll('#karyo .kchrom[data-kind="normal"] .band[data-chrom="11"]')]
          .find((n) => (n.getAttribute('data-band') || '').startsWith(pre));
        if (!el) return null;
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }, prefix);
      assert.ok(pt, `${prefix} exists on the normal 11`);
      await page.mouse.move(pt.x, pt.y);
      await page.waitForSelector('#karyo .band-hi');
      return page.evaluate(() => document.querySelector('#tooltip').textContent);
    };

    await t.test('the split band names the breakpoint', async () => {
      const tip = await tipFor('p13');
      assert.match(tip, /in 3 places/, tip);
      assert.match(tip, /a breakpoint splits this band/, tip);
    });

    await t.test('a neighbouring intact band stays plain', async () => {
      const tip = await tipFor('p15');
      assert.match(tip, /in 2 places/, tip);
      assert.ok(tip.indexOf('splits') < 0, `no split claim on an intact band: ${tip}`);
    });
  } finally {
    await browser.close();
    server.close();
  }
});
