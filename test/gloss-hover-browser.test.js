'use strict';
// The decode panel's symbol chips hover to their glossary entry: the row
// explains this karyotype's change, the hover answers what the SYMBOL means
// (what IS a derivative chromosome). Driven in a real browser because the
// affordance is the point: the chip must advertise the hover and the tooltip
// must appear and disappear.
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

test('hovering a decode symbol chip shows its glossary definition', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,t(9;22)(q34;q11.2)')}`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg', { timeout: 20000 });

    const chips = await page.evaluate(() => ({
      glossed: [...document.querySelectorAll('.decode-code[data-gloss]')].map((c) => c.getAttribute('data-gloss')),
      unglossed: [...document.querySelectorAll('.decode-code:not([data-gloss])')].map((c) => c.textContent.trim()),
    }));
    assert.ok(chips.glossed.indexOf('t') >= 0, 'the t chip carries the glossary: ' + JSON.stringify(chips.glossed));
    assert.ok(chips.unglossed.indexOf('46') >= 0, 'the count row does not: ' + JSON.stringify(chips.unglossed));

    const chip = await page.$('.decode-code[data-gloss="t"]');
    await chip.scrollIntoView();
    const box = await chip.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => {
      const tip = document.getElementById('tooltip');
      return tip && tip.style.display === 'block' && /TRANSLOCATION/.test(tip.textContent);
    }, { timeout: 5000 });
    const tip = await page.evaluate(() => document.getElementById('tooltip').textContent);
    assert.match(tip, /exchange segments/, 'the definition, not this karyotype: ' + tip.slice(0, 80));

    // Moving off the chip hides it.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height + 60);
    await page.waitForFunction(() => document.getElementById('tooltip').style.display !== 'block', { timeout: 5000 });

    // The affordance must be visible enough to read as one: the first cut was a
    // 1px dotted border and Dan could not tell it was there (2026-08-29).
    const deco = await page.evaluate(() => {
      const cs = getComputedStyle(document.querySelector('.decode-code[data-gloss]'));
      return { line: cs.textDecorationLine, style: cs.textDecorationStyle };
    });
    assert.match(deco.line, /underline/, 'the chip is underlined');
    assert.equal(deco.style, 'dotted', 'in the dotted definition-lives-here idiom');
  } finally {
    await browser.close();
    server.close();
  }
});

// The glossary's other two carriers (Dan, 2026-08-29): the figure caption under
// the drawn derivative, and the English terms inside the decode prose. Driven in
// a browser for the same reason as the chip: the hover appearing is the feature.
test('figure captions and decode prose hover to the glossary too', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('45,XX,der(14;21)(q10;q10)')}`,
      { waitUntil: 'load' });
    await page.waitForSelector('#karyo svg', { timeout: 20000 });

    // The caption under the fused chromosome carries the der entry.
    const cap = await page.$('#karyo .ksub[data-gloss="der"]');
    assert.ok(cap, 'the der(14;21) caption is glossed');
    await cap.scrollIntoView();   // below the fold, mouse.move would miss it (#246)
    const cbox = await cap.boundingBox();
    await page.mouse.move(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    await page.waitForFunction(() => {
      const tip = document.getElementById('tooltip');
      return tip && tip.style.display === 'block' && /DERIVATIVE/.test(tip.textContent);
    }, { timeout: 5000 });

    // The prose names other concepts in passing, and each hovers: the row about
    // this der() says "ROBERTSONIAN translocation", glossed as rob, the WHOLE
    // phrase in one wrap (never re-matched inside as "translocation"), and says
    // "dicentric", glossed as dic.
    const terms = await page.evaluate(() => ({
      rob: (document.querySelector('#decode .gterm[data-gloss="rob"]') || {}).textContent || null,
      dic: !!document.querySelector('#decode .gterm[data-gloss="dic"]'),
      nested: !!document.querySelector('#decode .gterm .gterm'),
    }));
    assert.match(terms.rob || '', /Robertsonian translocation/i, 'the full phrase is one wrap: ' + terms.rob);
    assert.ok(terms.dic, 'dicentric in the same sentence is glossed as dic');
    assert.ok(!terms.nested, 'no wrap ever lands inside another wrap');

    const term = await page.$('#decode .gterm[data-gloss="rob"]');
    await term.scrollIntoView();
    const tbox = await term.boundingBox();
    await page.mouse.move(tbox.x + tbox.width / 2, tbox.y + tbox.height / 2);
    await page.waitForFunction(() => {
      const tip = document.getElementById('tooltip');
      return tip && tip.style.display === 'block' && /acrocentric/.test(tip.textContent);
    }, { timeout: 5000 });
  } finally {
    await browser.close();
    server.close();
  }
});
