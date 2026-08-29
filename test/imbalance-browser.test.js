'use strict';
// The net-imbalance panel in a real browser: the table appears exactly when a
// run deviates from its baseline, the cancer-gene checkbox adds italic gene
// symbols to gained and lost rows only, and the draw gate sweeps the panel
// away with everything else when a karyotype is refused.
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

test('the net-imbalance table appears, toggles genes, and obeys the gate', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const puppeteer = require('puppeteer-core');
  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--no-sandbox'] });
  const open = async (page, k) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight&show=involved`,
      { waitUntil: 'load' });
    await page.waitForSelector('#kinput');
  };
  try {
    const page = await browser.newPage();

    await t.test('the worked example shows its partition, sizes included', async () => {
      await open(page, '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
      await page.waitForSelector('#imbalance table');
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('#imbalance tbody tr')].map((r) =>
          [...r.cells].map((c) => c.textContent.trim()).join(' | ')));
      assert.equal(rows.length, 6, 'four runs of 8 and two of 9: ' + JSON.stringify(rows));
      assert.match(rows[0], /8pter→8q10 \| 0 \| nullisomy \| ~\d+ Mb/);
      assert.match(rows[2], /8q22→8q24\.1 \| 1 \| monosomy/);
      assert.match(rows[5], /9q12→9qter \| 3 \| trisomy/);
    });

    await t.test('the gene checkbox adds italic symbols to imbalanced rows only', async () => {
      assert.equal(await page.evaluate(() => document.querySelectorAll('#imbalance i').length), 0,
        'off by default');
      await page.click('#imbgenes');
      await page.waitForSelector('#imbalance td.call i');
      const withGenes = await page.evaluate(() => ({
        myc: [...document.querySelectorAll('#imbalance td.call')].some((c) => /includes.*MYC/.test(c.textContent)),
        balancedRowHasGene: [...document.querySelectorAll('#imbalance tr.even td.call')].some((c) => /includes/.test(c.textContent)),
        italic: !!document.querySelector('#imbalance td.call i'),
      }));
      assert.ok(withGenes.myc, 'the nullisomic distal 8q names MYC');
      assert.ok(withGenes.italic, 'gene symbols are italicized');
      assert.ok(!withGenes.balancedRowHasGene, 'balanced context rows stay unannotated');
    });

    await t.test('a balanced rearrangement measures without claiming imbalance', async () => {
      // Dan, 2026-08-30: balanced rearrangements join the table so their
      // segments keep a size somewhere after the prose lost its
      // parentheticals. The title must say "none" and the gene checkbox
      // hides, since genes annotate gained and lost rows only.
      await open(page, '46,XY,t(9;22)(q34;q11.2)');
      await page.waitForSelector('#imbalance table');
      const st = await page.evaluate(() => ({
        title: document.querySelector('#imbalance .dtitle').textContent,
        rows: document.querySelectorAll('#imbalance tbody tr').length,
        allBalanced: [...document.querySelectorAll('#imbalance td.call')].every((c) => c.textContent === 'balanced'),
        checkbox: !!document.querySelector('#imbgenes'),
      }));
      assert.match(st.title, /none/i, 'the title says no net imbalance');
      assert.equal(st.rows, 4, 'both exchange partners split at their breakpoints');
      assert.ok(st.allBalanced, 'every row is balanced');
      assert.ok(!st.checkbox, 'no gene checkbox with nothing to mark');
    });

    await t.test('a normal karyotype shows no table at all', async () => {
      await open(page, '46,XX');
      await page.waitForFunction(() => document.querySelector('#karyo svg'));
      const html = await page.evaluate(() => document.getElementById('imbalance').innerHTML);
      assert.equal(html, '', 'nothing structural, nothing measured');
    });

    await t.test('a refusal sweeps the panel with the rest of the drawing', async () => {
      await open(page, '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
      await page.waitForSelector('#imbalance table');
      await page.click('#kinput');
      await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
      await page.keyboard.type('46,XX,xyzzy(8)');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('imbalance')).display === 'none' ||
        document.getElementById('imbalance').innerHTML === '');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
