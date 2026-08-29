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
  } finally {
    await browser.close();
    server.close();
  }
});
