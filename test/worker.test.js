'use strict';
// Worker behavior: the parts of worker.js that only show up under the wrong
// input or the wrong day. Each test calls worker.fetch directly with stubbed
// bindings, the same harness style test/seo.test.js uses for the redirects.
//
// Why these exist: /k/%C3 returned a live HTTP 500 on 2026-09-10 (an uncaught
// URIError in decodeURIComponent); HTML responses carried no security headers
// at all; a quick flag submitted while D1 was down claimed ok with nothing
// stored anywhere; and a D1 error on /api/top was cached at the edge for a
// day, so the board stayed empty long after the database recovered.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const ctx = { waitUntil() {} };
const load = async () => (await import('../worker.js')).default;

// A D1 stub whose every statement fails: the shape of "D1 is down".
const downDB = {
  prepare: () => ({
    bind: () => ({ run: async () => { throw new Error('d1 down'); },
                   all: async () => { throw new Error('d1 down'); },
                   first: async () => { throw new Error('d1 down'); } }),
    all: async () => { throw new Error('d1 down'); },
    run: async () => { throw new Error('d1 down'); },
  }),
};
// A D1 stub that accepts everything and returns nothing.
const okDB = {
  prepare: () => ({
    bind: () => ({ run: async () => ({ meta: { last_row_id: 7 } }),
                   all: async () => ({ results: [] }),
                   first: async () => ({}) }),
    all: async () => ({ results: [] }),
  }),
};
const htmlAssets = {
  fetch: async () => new Response('<!doctype html><title>x</title>', {
    headers: { 'content-type': 'text/html' },
  }),
};

// worker.js reads caches.default inside /api/top; Node has no Cache API, so
// stub one that records puts.
function stubCaches() {
  const puts = [];
  globalThis.caches = {
    default: { match: async () => undefined, put: async (k, v) => { puts.push(v); } },
  };
  return puts;
}

test('a mangled /k/ link redirects instead of crashing', async () => {
  const worker = await load();
  // %C3 is valid percent-encoding but invalid UTF-8, which is exactly what a
  // link mangler produces. decodeURIComponent throws on it; the worker must not.
  const res = await worker.fetch(new Request('https://karyodraw.com/k/%C3'), {}, ctx);
  assert.ok(res.status === 301 || res.status === 302, 'still a redirect, status ' + res.status);
  assert.ok(res.headers.get('location'), 'with a destination');
});

test('every HTML response carries the security headers', async () => {
  const worker = await load();
  const res = await worker.fetch(
    new Request('https://karyodraw.com/', { headers: { accept: 'text/html' } }),
    { ASSETS: htmlAssets }, ctx);
  const h = res.headers;
  assert.match(h.get('content-security-policy') || '', /default-src 'self'/, 'a CSP');
  assert.match(h.get('content-security-policy') || '', /frame-ancestors/, 'framing policy lives in the CSP');
  assert.match(h.get('strict-transport-security') || '', /max-age=\d{7,}/, 'HSTS for at least months');
  assert.equal(h.get('x-content-type-options'), 'nosniff');
  assert.ok(h.get('referrer-policy'), 'a referrer policy');
  assert.ok(h.get('permissions-policy'), 'a permissions policy');
  assert.match(h.get('content-type') || '', /charset=utf-8/i, 'HTML declares its charset');
});

test('the CSP is one Cloudflare and the app can both live with', async () => {
  const worker = await load();
  const res = await worker.fetch(
    new Request('https://karyodraw.com/', { headers: { accept: 'text/html' } }),
    { ASSETS: htmlAssets }, ctx);
  const csp = res.headers.get('content-security-policy') || '';
  // Cloudflare injects an anonymous inline bootstrap into served HTML (visible
  // in the live page), so script hashes/nonces would break the zone's own bot
  // detection. 'unsafe-inline' is the ceiling on this stack; the value of this
  // CSP is everything else, and remote script injection stays blocked.
  assert.match(csp, /script-src 'self' 'unsafe-inline' https:\/\/static\.cloudflareinsights\.com/);
  // The zone's Web Analytics beacon and its collector: both edge-injected,
  // both broken by the first CSP deploy until this pin.
  assert.match(csp, /connect-src[^;]*https:\/\/cloudflareinsights\.com/);
  // The PNG export loads the stitched SVG through a data: image.
  assert.match(csp, /img-src[^;]*data:/);
  // The committed head loads Google Fonts (Cloudflare Fonts rewrites it to
  // same-origin in production, but the CSP must not depend on that toggle).
  assert.match(csp, /style-src[^;]*https:\/\/fonts\.googleapis\.com/);
  assert.match(csp, /font-src[^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /base-uri 'self'/);
});

test('binary assets pass through without a CSP', async () => {
  const worker = await load();
  const png = { fetch: async () => new Response('x', { headers: { 'content-type': 'image/png' } }) };
  const res = await worker.fetch(new Request('https://karyodraw.com/preview.png'), { ASSETS: png }, ctx);
  assert.equal(res.headers.get('content-security-policy'), null);
});

test('a HEAD request for a missing page gets the branded 404 status, no body', async () => {
  const worker = await load();
  const assets = {
    fetch: async (req) => new URL(req.url ?? req).pathname === '/404.html'
      ? new Response('<!doctype html>branded', { headers: { 'content-type': 'text/html' } })
      : new Response('not found', { status: 404 }),
  };
  const res = await worker.fetch(
    new Request('https://karyodraw.com/nope/', { method: 'HEAD', headers: { accept: 'text/html' } }),
    { ASSETS: assets }, ctx);
  assert.equal(res.status, 404);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.equal(await res.text(), '', 'HEAD carries no body');
});

test('/api/version names the deployed commit', async () => {
  const worker = await load();
  const res = await worker.fetch(new Request('https://karyodraw.com/api/version'),
    { DEPLOY_SHA: 'abc1234' }, ctx);
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { sha: 'abc1234' });
  const dev = await worker.fetch(new Request('https://karyodraw.com/api/version'), {}, ctx);
  assert.deepEqual(await dev.json(), { sha: 'dev' }, 'local dev still answers');
});

test('a D1 error on /api/top is not cached for a day', async () => {
  const worker = await load();
  const puts = stubCaches();
  const res = await worker.fetch(new Request('https://karyodraw.com/api/top'), { DB: downDB }, ctx);
  assert.equal(res.status, 200, 'the board degrades to empty, never errors');
  assert.deepEqual(await res.json(), { items: [] });
  assert.match(res.headers.get('cache-control') || '', /no-store/, 'an error result must not stick');
  assert.equal(puts.length, 0, 'and must not be written to the edge cache');
});

test('a healthy empty /api/top still caches (the early-days board)', async () => {
  const worker = await load();
  const puts = stubCaches();
  const res = await worker.fetch(new Request('https://karyodraw.com/api/top'), { DB: okDB }, ctx);
  assert.match(res.headers.get('cache-control') || '', /max-age=86400/);
  assert.equal(puts.length, 1);
});

test('a quick flag that could not be stored anywhere says so', async () => {
  const worker = await load();
  // D1 down, webhook configured, but a bare flag has no message, and the
  // webhook only fires for messages, so nothing was persisted anywhere.
  const req = () => new Request('https://karyodraw.com/api/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ quick: true, category: null, karyotype: '46,XY' }),
  });
  const res = await (await load()).fetch(req(), { DB: downDB, FEEDBACK_WEBHOOK: 'https://example.invalid/hook' }, ctx);
  assert.equal(res.status, 500, 'ok would be a lie: no row, no webhook, nothing kept');
  // With D1 healthy the same flag stores and returns its enrichment token.
  const ok = await worker.fetch(req(), { DB: okDB }, ctx);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.ok(body.token, 'the client can still enrich the flag');
});

test('an oversized body is refused before it is read', async () => {
  const worker = await load();
  const big = JSON.stringify({ message: 'x'.repeat(70000) });
  // Node's Request does not surface its computed content-length the way the
  // Workers runtime does for real clients, so state it, as every browser will.
  const req = (path) => new Request('https://karyodraw.com' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'content-length': String(big.length) },
    body: big,
  });
  assert.equal((await worker.fetch(req('/api/feedback'), { DB: okDB }, ctx)).status, 413);
  assert.equal((await worker.fetch(req('/api/collect'), { DB: okDB }, ctx)).status, 413);
});

// Visitor codes (2026-09-11, Dan asked for visitor counts): a one-way daily code
// from the address and the browser with a random per-day salt, so distinct codes
// per day count visitors and neither the address nor the browser is stored.
function memDB() {
  const salts = new Map();
  const inserts = [];
  return {
    inserts,
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          if (/INSERT OR IGNORE INTO salts/.test(sql)) { if (!salts.has(args[0])) salts.set(args[0], args[1]); }
          else if (/INSERT INTO usage/.test(sql)) inserts.push({ sql, args });
          return { meta: {} };
        },
        first: async () => (/FROM salts/.test(sql) && salts.has(args[0]) ? { salt: salts.get(args[0]) } : null),
        all: async () => ({ results: [] }),
      }),
      all: async () => ({ results: [] }),
      run: async () => ({}),
    }),
  };
}
const collect = (worker, env, ip, ua) => {
  const c = { promises: [], waitUntil(p) { this.promises.push(p); } };
  const body = JSON.stringify({ type: 'pageview' });
  const headers = { 'content-type': 'application/json', 'content-length': String(body.length), 'user-agent': ua };
  if (ip) headers['cf-connecting-ip'] = ip;
  return worker.fetch(new Request('https://karyodraw.com/api/collect', { method: 'POST', headers, body }), env, c)
    .then(async (res) => { await Promise.all(c.promises); return res; });
};
const colsOf = (row) => /INSERT INTO usage \(([^)]*)\)/.exec(row.sql)[1].split(',').map((s) => s.trim());

test('a collect row carries a visitor code, never the address', async () => {
  const worker = await load();
  const db = memDB();
  assert.equal((await collect(worker, { DB: db }, '203.0.113.5', 'UA one')).status, 204);
  await collect(worker, { DB: db }, '203.0.113.5', 'UA one');
  await collect(worker, { DB: db }, '203.0.113.9', 'UA one');
  await collect(worker, { DB: db }, '203.0.113.5', 'UA two');
  assert.equal(db.inserts.length, 4);
  const cols = colsOf(db.inserts[0]);
  const vi = cols.indexOf('visitor'), ii = cols.indexOf('ip');
  assert.ok(vi >= 0 && ii >= 0, 'visitor and ip columns are written: ' + cols.join(','));
  const codes = db.inserts.map((r) => r.args[vi]);
  assert.match(codes[0], /^[0-9a-f]{24}$/, 'a 24-hex one-way code');
  assert.equal(codes[0], codes[1], 'same address and browser, same day: one visitor');
  assert.notEqual(codes[0], codes[2], 'another address is another visitor');
  assert.notEqual(codes[0], codes[3], 'another browser on the same address is another visitor');
  assert.ok(db.inserts.every((r) => r.args[ii] === null), 'the raw address is not stored');
  assert.ok(!JSON.stringify(db.inserts).includes('203.0.113'), 'nor does it appear anywhere in the row');
});

test('the raw address is stored only when STORE_RAW_IP is "1"', async () => {
  const worker = await load();
  const db = memDB();
  await collect(worker, { DB: db, STORE_RAW_IP: '1' }, '203.0.113.5', 'UA');
  assert.equal(db.inserts[0].args[colsOf(db.inserts[0]).indexOf('ip')], '203.0.113.5');
});

test('a request with no address still records the event, with no code', async () => {
  const worker = await load();
  const db = memDB();
  await collect(worker, { DB: db }, '', 'UA');
  assert.equal(db.inserts.length, 1);
  assert.equal(db.inserts[0].args[colsOf(db.inserts[0]).indexOf('visitor')], null);
});

test('the deployed config stores the raw address (decided 2026-09-11)', () => {
  // The switch lives in wrangler.jsonc so a deploy carries it; the About page and
  // the privacy notes describe what is kept and must change with it.
  const cfg = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'wrangler.jsonc'), 'utf8');
  assert.match(cfg, /"vars":\s*\{[^}]*"STORE_RAW_IP":\s*"1"/, 'STORE_RAW_IP is "1" in the vars block');
});
