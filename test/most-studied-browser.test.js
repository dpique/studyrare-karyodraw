'use strict';
// The Most-studied panel, driven in a real browser against a stubbed
// /api/top. The board's data is client-asserted at collection time, so the
// panel's safety property is the one under test: every rendered item passed
// the app's own parser and went in as textContent, and anything else — junk,
// markup, an unparseable string — simply never appears. Fails closed: an
// empty or thin board leaves the block hidden.
//
// The quick flag rides in this file too: it posts category null now, so the
// feedback table's category column only ever carries a category a person
// actually chose (39 of 40 rows used to say "banding" because the client
// hardcoded it).
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

function serveWithTop(items, apiLog) {
  return serveSite({ api: (req, res, url) => {
    if (url.pathname === '/api/top') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ items }));
      return true;
    }
    if (apiLog) {
      let body = '';
      req.on('data', (c) => { body += c; });
      req.on('end', () => { apiLog.push({ path: url.pathname, body }); res.writeHead(204).end(); });
      return true;
    }
    return false;
  } });
}

test('the most-studied panel renders only what the parser accepts', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const items = [
    '46,XY,t(9;22)(q34;q11.2)', '47,XX,+21', '45,X', '46,XX,inv(2)(p13p23)',
    '<img src=x onerror=alert(1)>',   // hostile junk: must never render
    'zz,42',                          // unparseable: must never render
  ];
  const server = await serveWithTop(items);
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction('!document.getElementById("mostudied").hidden', { timeout: 10000 });
    const m = await page.evaluate(() => ({
      links: [...document.querySelectorAll('#msdlist a')].map((a) => ({
        href: a.getAttribute('href'), text: a.textContent })),
      html: document.getElementById('msdlist').innerHTML,
      imgs: document.querySelectorAll('#msdlist img').length,
    }));
    assert.equal(m.links.length, 4, 'the four parseable items, nothing else');
    assert.ok(m.links.every((l) => l.href.startsWith('/k/')), 'each links through the /k/ shortlink');
    assert.equal(m.links[0].text, '46,XY,t(9;22)(q34;q11.2)', 'server rank order kept');
    assert.equal(m.imgs, 0, 'the hostile item never became markup');
    assert.ok(!m.html.includes('onerror'), 'not even as text');
    assert.ok(!m.html.includes('zz,42'), 'the unparseable item is dropped');
  } finally {
    await browser.close();
    server.close();
  }
});

test('a thin or empty board stays hidden', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveWithTop(['47,XX,+21', '45,X']);   // two: under the floor
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 1200));   // past the idle fallback
    assert.equal(await page.evaluate(() => document.getElementById('mostudied').hidden), true,
      'under three items the section never appears');
  } finally {
    await browser.close();
    server.close();
  }
});

test('the quick flag posts no category until a person picks one', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const apiLog = [];
  const server = await serveWithTop([], apiLog);
  const port = server.address().port;
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,t(9;22)(q34;q11.2)')}`,
      { waitUntil: 'load' });
    await page.waitForSelector('#flagbtn');
    await page.click('#flagbtn');
    // The POST is fire-and-forget, so poll the server's log for its arrival.
    for (let i = 0; i < 40 && !apiLog.some((e) => e.path === '/api/feedback'); i++) {
      await new Promise((r) => setTimeout(r, 100));
    }
    const hit = apiLog.find((e) => e.path === '/api/feedback');
    assert.ok(hit, 'the click alone logged a flag');
    const body = JSON.parse(hit.body);
    assert.equal(body.quick, true);
    assert.equal(body.category, null, 'no category asserted by a bare click');
  } finally {
    await browser.close();
    server.close();
  }
});
