// Check the LIVE site's search-appearance signals.
//
//   npm run seo-check                    # https://karyodraw.com/
//   npm run seo-check -- https://...     # any origin, e.g. a preview deploy
//
// LOCAL, on-demand; NOT run in CI (it makes real network requests). test/seo.test.js
// covers the same invariants against the files in the repo; this one answers the
// different question of what the deployed site is actually serving, which is where the
// two bugs below were found and where a stale CDN copy would show up.
//
// Why this exists: both site-appearance bugs so far were invisible to the unit tests.
//   1. www.karyodraw.com and http:// each answered 200, so Google indexed four spellings
//      of every page (fixed in #187 via assets.run_worker_first + a Worker 301).
//   2. The WebSite node shipped while the brand was stripped from <title>, leaving two of
//      the four sources Google reads for a site name saying nothing, so the result kept
//      printing the bare domain.
// Both are one command to see and were not seen for days. This is that command.
//
// Google's site-name sources, in the order its documentation lists them:
//   WebSite structured data, og:site_name, <title>, headings, other homepage text.
// https://developers.google.com/search/docs/appearance/site-names
import process from 'node:process';

const ORIGIN = (process.argv[2] || 'https://karyodraw.com').replace(/\/+$/, '');
const BRAND = 'KaryoDraw';
// Google truncates on pixel width, not characters, so this is a guide rather than a limit.
const TITLE_MAX = 60;

const bust = (u) => u + (u.includes('?') ? '&' : '?') + 'cb=' + process.pid + Date.now();
const pick = (re, s) => ((s.match(re) || [])[1] || '').trim();

let failures = 0;
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}${detail ? ': ' + detail : ''}`);
  if (!ok) failures++;
};

async function get(url, redirect = 'follow') {
  const res = await fetch(bust(url), { redirect });
  return { status: res.status, location: res.headers.get('location'), body: redirect === 'follow' ? await res.text() : '' };
}

const home = await get(ORIGIN + '/');
if (home.status !== 200) {
  console.error(`${ORIGIN}/ returned ${home.status}; cannot check signals.`);
  process.exit(1);
}
const html = home.body;

const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
  .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
  .filter(Boolean);
const site = ld.find((b) => b['@type'] === 'WebSite');

const title = pick(/<title>([^<]*)<\/title>/, html);
const ogSite = pick(/<meta property="og:site_name" content="([^"]*)"/, html);
const h1 = pick(/<h1[^>]*class="hero-title"[^>]*>([^<]*)<\/h1>/, html);
const canonical = pick(/<link rel="canonical" href="([^"]*)"/, html);

console.log(`\n${ORIGIN}\n`);
console.log('site name, the four sources Google reads');
check(!!site, 'WebSite JSON-LD present', site ? `name=${JSON.stringify(site.name)}` : 'MISSING');
check(site && site.name === BRAND, 'WebSite name matches the brand', site && site.name);
check(!site || !('alternateName' in site) || /^KaryoDraw\S*$/.test(site.alternateName),
  'alternateName is a name, not a description', site && site.alternateName);
check(ogSite === BRAND, 'og:site_name matches the brand', ogSite || 'MISSING');
check(title.includes(BRAND), '<title> carries the brand', title);
check(html.includes(`<span class="sitebar-word">${BRAND}</span>`), 'brand is visible text on the page');
console.log(`  note  <h1> is ${JSON.stringify(h1)} (keyword heading by design; the brand lives in the sitebar)`);

console.log('\ntitle and canonical');
check(title.length <= TITLE_MAX, `<title> is ${title.length} chars (guide: ${TITLE_MAX})`);
check(canonical === ORIGIN + '/', 'canonical points at the apex', canonical);

console.log('\none origin');
for (const [label, url] of [
  ['www -> apex', ORIGIN.replace('https://', 'https://www.') + '/karyotype/down-syndrome/'],
  ['http -> https', ORIGIN.replace('https://', 'http://') + '/how-to-read-a-karyotype/'],
]) {
  const r = await get(url, 'manual');
  check(r.status === 301 && (r.location || '').startsWith(ORIGIN + '/'), label, `${r.status} -> ${r.location || 'no location'}`);
}

console.log(failures ? `\n${failures} signal(s) need attention.\n` : '\nAll signals agree.\n');
process.exit(failures ? 1 : 0);
