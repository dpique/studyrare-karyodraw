'use strict';
// SEO invariants for the served static HTML. The homepage used to spend its only
// <h1> on the brand wordmark ("KaryoDraw"), leaving no keyword-bearing heading for
// the page's actual topic. These tests lock in: the brand is a <span> (as on every
// generated sub-page), the homepage carries a real keyword <h1>, and the <title>
// front-loads the search term rather than the brand.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const titleOf = (html) => (html.match(/<title>([^<]+)<\/title>/) || [])[1];

test('homepage brand wordmark is a span, not an h1', () => {
  const html = read('index.html');
  assert.ok(!/<h1[^>]*class="sitebar-word"/.test(html),
    'brand wordmark should not be an <h1> (it is the site name, not the page heading)');
  assert.ok(/<span class="sitebar-word">KaryoDraw<\/span>/.test(html),
    'brand wordmark should be a <span>, matching every generated sub-page');
});

test('homepage has a real keyword-bearing content h1', () => {
  const html = read('index.html');
  const hero = html.match(/<h1 class="hero-title">([^<]+)<\/h1>/);
  assert.ok(hero, 'homepage should have a hero <h1 class="hero-title">');
  assert.match(hero[1], /karyotype/i, 'hero h1 should contain the primary keyword');
});

test('homepage title front-loads the keyword, not the brand, and does not truncate', () => {
  const title = titleOf(read('index.html'));
  assert.ok(title, 'homepage should have a <title>');
  assert.doesNotMatch(title, /^KaryoDraw/i, 'title should start with a search term, not the brand');
  assert.match(title.slice(0, 32), /karyotype/i, 'the primary keyword should be front-loaded');
  // Google truncated the 67-character predecessor in the live SERP, so it stays short.
  assert.ok(title.length <= 60, `homepage title is ${title.length} chars; Google cuts near 60`);
});

// Google's site-name guidance lists four sources and asks that they agree: the WebSite
// node, og:site_name, the <title>, and the headings. Declaring the node alone is not
// enough. It shipped on 2026-08-18 with the brand simultaneously stripped from the title,
// and six days later the result still read "karyodraw.com" while already showing the new
// title, which is what proves the markup was crawled and passed over rather than missed.
// So this checks the sources agree, not merely that the node exists.
test('every source Google reads for the site name spells the brand the same way', () => {
  const html = read('index.html');
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((m) => JSON.parse(m[1]));
  const site = blocks.find((b) => b['@type'] === 'WebSite');
  assert.ok(site, 'homepage should carry a WebSite JSON-LD node (Google reads it for the site name)');
  assert.equal(site.name, 'KaryoDraw');
  assert.equal(site.url, 'https://karyodraw.com/');
  // alternateName is what Google falls back to when it declines the preferred name, so a
  // description parked in that field is worse in the result than the domain it replaces.
  assert.ok(!('alternateName' in site) || /^KaryoDraw\S*$/.test(site.alternateName),
    `alternateName must be a name, not a description (got ${JSON.stringify(site.alternateName)})`);
  assert.match(html, /<meta property="og:site_name" content="KaryoDraw"/,
    'og:site_name must spell the brand the same way as the WebSite node');
  assert.match(titleOf(html), /KaryoDraw/,
    'the <title> is one of the four sources; leaving the brand out of it silenced a signal once already');
  assert.match(html, /<span class="sitebar-word">KaryoDraw<\/span>/,
    'and the brand must appear as visible text on the page, not only in metadata');
});

test('generated karyotype sub-pages keep the brand as a span and a topic h1', () => {
  const dir = path.join(root, 'karyotype');
  const slugs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  assert.ok(slugs.length >= 20, 'expected the generated karyotype pages to be present');
  for (const slug of slugs) {
    const html = read(path.join('karyotype', slug, 'index.html'));
    assert.ok(!/<h1[^>]*class="sitebar-word"/.test(html),
      `sub-page ${slug} brand wordmark should not be an <h1>`);
    assert.ok(/<span class="sitebar-word">KaryoDraw<\/span>/.test(html),
      `sub-page ${slug} brand wordmark should be a <span>`);
  }
});

test('each karyotype page serves an indexable karyogram image with descriptive alt', () => {
  const dir = path.join(root, 'karyotype');
  const slugs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  for (const slug of slugs) {
    const html = read(path.join('karyotype', slug, 'index.html'));
    // A raster <img> (not just inline SVG) is what lets the page rank in Google
    // Images for "karyotype of <condition>".
    const img = html.match(/<img class="lp-karyo-img"[^>]*>/);
    assert.ok(img, `sub-page ${slug} should embed a karyogram <img>`);
    assert.match(img[0], /alt="Karyotype of [^"]+"/, `sub-page ${slug} img needs descriptive alt`);
    assert.match(img[0], /width="\d+" height="\d+"/, `sub-page ${slug} img needs intrinsic dimensions`);
    // The rendered PNG the img points to must actually exist and be committed.
    assert.ok(fs.existsSync(path.join(dir, slug, 'karyogram.png')),
      `sub-page ${slug} is missing karyogram.png (run "npm run images")`);
  }
});

test('each karyotype page has its own condition-specific social card, not the shared preview', () => {
  const dir = path.join(root, 'karyotype');
  const slugs = fs.readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory()).map((d) => d.name);
  for (const slug of slugs) {
    const html = read(path.join('karyotype', slug, 'index.html'));
    const og = (html.match(/<meta property="og:image" content="([^"]+)"/) || [])[1];
    assert.equal(og, `https://karyodraw.com/karyotype/${slug}/card.png`,
      `sub-page ${slug} og:image should be its own card, not preview.png`);
    assert.ok(fs.existsSync(path.join(dir, slug, 'card.png')),
      `sub-page ${slug} is missing card.png (run "npm run images")`);
  }
});

test('the hub page targets "karyotype examples"', () => {
  const html = read(path.join('karyotype', 'index.html'));
  assert.match(titleOf(html), /^Karyotype examples/i, 'hub title should lead with "Karyotype examples"');
  assert.match(html, /<h1>Karyotype examples[^<]*<\/h1>/, 'hub h1 should contain "Karyotype examples"');
});

// The resolution note. KaryoDraw draws every deletion at the same crispness whatever
// its size, so a page for a submicroscopic deletion shows a picture no microscope would
// produce. Where that is true the page says so, directly under the drawing.
test('a submicroscopic deletion page says what banding actually sees', () => {
  const CONTENT = require('../content/karyotypes.js').CONTENT || require('../content/karyotypes.js');
  const withNote = CONTENT.filter((e) => e.resolution).map((e) => e.slug);
  assert.ok(withNote.includes('chromosome-1p36-deletion'), '1p36 is mostly submicroscopic');
  assert.ok(withNote.includes('wolf-hirschhorn-syndrome'), 'many 4p16.3 deletions are too');
  withNote.forEach((slug) => {
    const html = read(`karyotype/${slug}/index.html`);
    assert.match(html, /<p class="lp-res">/, `${slug} should carry the note`);
    // Under the karyogram, not above it: the note qualifies the picture.
    assert.ok(html.indexOf('</figure>') < html.indexOf('<p class="lp-res">'), `${slug}: note goes below the figure`);
    assert.match(html, /not what would be visible down a microscope/, `${slug}: the shared sentence`);
  });
  // And a deletion a karyotype does show is left alone.
  ['cri-du-chat-syndrome', 'jacobsen-syndrome', 'mds-5q-deletion'].forEach((slug) =>
    assert.ok(!/<p class="lp-res">/.test(read(`karyotype/${slug}/index.html`)), `${slug} needs no caveat`));
});

// The site serves the repo tree as static assets, minus `.assetsignore`. Serving is
// therefore opt-OUT: a new file at the root is public the moment it is committed.
// `NEXT_SESSION_HANDOFF.md` was live at karyodraw.com carrying working notes and absolute
// paths under the author's home directory. That file is gone from the repo entirely now,
// since a session handoff primes a session rather than serving the product, and it is
// gitignored so it cannot come back; `.assetsignore` keeps its entry as a second guard.
//
// This test used to name five files and assert they were on the list, which by
// construction cannot catch a file nobody thought of, and it did not: the AGPL relicense
// added `LICENSING.md` and `LICENSE-CC-BY-SA-4.0.txt` and both were live within the hour,
// while `LICENSE` sitting beside them was correctly hidden. So the assertion is inverted.
// Enumerate what MAY be served and fail on everything else, and the next internal file
// trips this test instead of shipping. Adding a genuinely public file means adding it
// here, once, on purpose.
const PUBLIC_ASSETS = new Set([
  'index.html', '404.html', 'robots.txt',
  'favicon.ico', 'favicon.svg', 'favicon-96x96.png', 'apple-touch-icon.png', 'preview.png',
  // Runtime modules, loaded by <script src> from index.html.
  'ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js',
  'segregation.js', 'pachytene.js',
  // The homepage loads the curriculum at runtime (index.html `<script src>`), so unlike
  // every other build input under content/ this one has to stay public.
  'content/karyotypes.js',
]);
// Bing verifies domain ownership for IndexNow by fetching a hex-named key file at the root.
const isIndexNowKey = (f) => /^[0-9a-f]{32}\.txt$/.test(f);
// The landing pages themselves are generated and gitignored, but their two rendered PNGs
// are committed (rendering them needs a browser, which the deploy does not have) and are
// served as the page image and the social card.
const isLandingImage = (f) => /^karyotype\/[a-z0-9-]+\/(karyogram|card)\.png$/.test(f);

test('no tracked file is served publicly unless it is meant to be', () => {
  const ignore = read('.assetsignore').split('\n').map((l) => l.trim()).filter(Boolean);
  const ignoredDirs = ignore.filter((l) => l.endsWith('/'));
  const isIgnored = (f) => ignore.includes(f) || ignoredDirs.some((d) => f.startsWith(d));

  const tracked = require('node:child_process')
    .execSync('git ls-files', { cwd: root, encoding: 'utf8' })
    .split('\n').filter(Boolean);

  const leaked = tracked
    .filter((f) => !isIgnored(f))
    .filter((f) => !PUBLIC_ASSETS.has(f) && !isIndexNowKey(f) && !isLandingImage(f));

  assert.deepEqual(leaked, [], 'these tracked files would be served at karyodraw.com; '
    + 'add each to .assetsignore, or to PUBLIC_ASSETS above if it is meant to be public');
});

// A handoff is working state for a session, not part of an open-source product, and this
// repo is public. Keeping it out is a property of the repo, not a habit to remember.
test('no session handoff is tracked in the repo', () => {
  assert.ok(!fs.existsSync(path.join(root, 'NEXT_SESSION_HANDOFF.md')),
    'the handoff belongs in Claude memory, not in a public repo');
  assert.match(read('.gitignore'), /^NEXT_SESSION_HANDOFF\.md$/m,
    'and it is gitignored so it cannot be re-added by accident');
});

// The guide FAQ used to restate the page: six items, three of them near-verbatim
// copies of body sections, one of them the page's own H1 as a question. Google Trends
// co-search data around "karyotype" (US, 12 months) settled the rework: the largest
// cluster is "what is a karyotype", the fastest-rising is the lab test itself
// ("karyotype analysis" +80%, "karyotype testing" +40%), and the three dropped items
// match no distinct demand. Four items now, each owning a query and each saying
// something the body does not: the karyotype / karyogram / ideogram distinction and
// the wet-lab test process appear nowhere else on the page.
test('the guide FAQ carries four items, none echoing the body', () => {
  const html = read('how-to-read-a-karyotype/index.html');
  const qs = [...html.matchAll(/<h3 class="faq-q">([\s\S]*?)<\/h3>/g)].map((m) => m[1].trim());
  assert.deepEqual(qs, [
    'What is a karyotype?',
    'What is a karyotype test and how is it done?',
    'What is ISCN 2024?',
    'Is KaryoDraw free, and is it a diagnostic tool?',
  ], 'exactly these four questions, in this order');
  // The two additions the demand data asked for, absent from the body sections.
  assert.match(html, /ideogram/, 'the karyotype vs karyogram vs ideogram distinction');
  assert.match(html, /arrested in metaphase/, 'the test answer covers the wet lab');
  // And the FAQPage schema regenerates from what is authored, so it followed along.
  const ld = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.ok(ld, 'the guide page carries JSON-LD');
  const faq = JSON.parse(ld[1])['@graph'].find((g) => g['@type'] === 'FAQPage');
  assert.ok(faq, 'the graph includes a FAQPage node');
  assert.deepEqual(faq.mainEntity.map((q) => q.name), qs, 'schema questions match the visible ones');
  // The intro's first mention of ISCN links to the FAQ item that defines it; the
  // anchor sits on the item div because the schema regex matches the bare h3 tag.
  assert.match(html, /<a href="#faq-iscn">ISCN<\/a>/, 'the intro links ISCN to its FAQ item');
  assert.match(html, /<div class="faq-item" id="faq-iscn">/, 'and the anchor exists');
});

// The homepage "Common karyotypes, explained" section lists the guided-tour
// curriculum, not every landing page: the full set lives on the visual hub, which
// the section links with a live count. Curation stays in content/karyotypes.js
// (the tour flag), so adding a landing page grows the hub and the count, never
// the homepage.
test('the homepage list is the tour curriculum, and the hub link carries the rest', () => {
  const home = read('index.html');
  const C = require('../content/karyotypes.js').CONTENT || require('../content/karyotypes.js');
  const block = home.match(/<!-- KD:PAGES:START -->([\s\S]*?)<!-- KD:PAGES:END -->/)[1];
  const slugs = [...block.matchAll(/href="\/karyotype\/([a-z0-9-]+)\/"/g)].map((m) => m[1]);
  const tourSlugs = C.filter((e) => e.tour).map((e) => e.slug);
  assert.ok(tourSlugs.length >= 8, 'the curriculum is a real list, not an accident of an empty flag');
  assert.deepEqual(slugs, tourSlugs, 'the homepage lists exactly the tour curriculum, in tour order');
  assert.match(block, new RegExp(`See all ${C.length} karyotypes`),
    'the hub link count is computed, not typed');
  assert.match(block, /<a href="\/karyotype\/">/, 'and it points at the visual hub');
});

// One origin. Until 2026-08-18 the Worker answered 200 on www.karyodraw.com and on
// plain http, so Search Console reported four spellings of the same pages competing
// as separate URLs (https://www.karyodraw.com/karyotype/isochromosome-xq/ ranked at
// position 17 while its apex twin drew no impressions at all). These exercise the
// handler rather than grep the source, so a refactor that moves the branch still counts.
const workerFetch = async (rawUrl) => {
  const { default: worker } = await import('../worker.js');
  return worker.fetch(new Request(rawUrl), {}, { waitUntil() {} });
};

test('www redirects to the apex host with a 301, preserving path and query', async () => {
  const res = await workerFetch('https://www.karyodraw.com/karyotype/marker-chromosome/?a=1');
  assert.equal(res.status, 301, 'a canonical tag is a hint; consolidating link equity needs a 301');
  assert.equal(res.headers.get('location'), 'https://karyodraw.com/karyotype/marker-chromosome/?a=1');
});

test('plain http on the apex host redirects to https', async () => {
  const res = await workerFetch('http://karyodraw.com/how-to-read-a-karyotype/');
  assert.equal(res.status, 301);
  assert.equal(res.headers.get('location'), 'https://karyodraw.com/how-to-read-a-karyotype/');
});

test('the redirect is scoped to production, so local dev is served directly', async () => {
  // No env.ASSETS here: reaching past the redirect branch is what this asserts, and
  // the throw proves the request was not short-circuited into a 301.
  await assert.rejects(() => workerFetch('http://localhost:8787/'),
    'localhost should fall through to the asset handler, not bounce to karyodraw.com');
});

// The routing gate the three tests above do not cross. They call worker.fetch directly,
// so they passed while the 301 was unreachable in production for every page Google has
// indexed: with `assets` configured and `run_worker_first` unset, Cloudflare serves any
// path that matches a static asset from the asset layer and never invokes the Worker.
// The redirect fired on /api/* and on 404s, which is exactly the set of URLs no one
// searches for. So the invariant worth locking is not "the handler redirects" but "every
// URL we ask Google to index actually reaches the handler".
//
// Cloudflare's rule (workers/static-assets/routing): the Worker runs first when some
// non-negative pattern matches and no negative pattern matches. Negatives win, and the
// order they are listed in does not matter. `*` matches across path segments.
const runsWorkerFirst = (patterns, pathname) => {
  const toRe = (p) => new RegExp('^' + p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  const negative = patterns.filter((p) => p.startsWith('!')).map((p) => toRe(p.slice(1)));
  const positive = patterns.filter((p) => !p.startsWith('!')).map(toRe);
  return positive.some((re) => re.test(pathname)) && !negative.some((re) => re.test(pathname));
};

test('every URL in the sitemap reaches the Worker, so the 301 is not bypassed', () => {
  const cfg = JSON.parse(read('wrangler.jsonc')
    .replace(/^\s*\/\/.*$/gm, '')          // whole-line // comments
    .replace(/\/\*[\s\S]*?\*\//g, ''));    // block comments
  const first = cfg.assets && cfg.assets.run_worker_first;
  assert.ok(Array.isArray(first) || first === true,
    'assets.run_worker_first must be set, or the asset layer answers before worker.js runs');
  if (first === true) return;

  const paths = [...read('sitemap.xml').matchAll(/<loc>https:\/\/karyodraw\.com([^<]*)<\/loc>/g)]
    .map((m) => m[1] || '/');
  assert.ok(paths.length >= 40, `expected the full sitemap, got ${paths.length} urls`);
  paths.forEach((p) => assert.ok(runsWorkerFirst(first, p),
    `${p} is in the sitemap but would be served by the asset layer, never reaching the redirect`));
});

test('binary assets stay on the free path, and the app still loads its own scripts', () => {
  const cfg = JSON.parse(read('wrangler.jsonc')
    .replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''));
  const first = cfg.assets.run_worker_first;
  if (first === true) {
    assert.fail('run_worker_first: true bills every PNG and script as a Worker invocation');
  }
  // The karyogram rasters live three segments deep, which is what makes the deep-matching
  // behaviour of `*` load-bearing rather than incidental.
  ['/karyotype/down-syndrome/karyogram.png', '/karyotype/down-syndrome/card.png',
   '/preview.png', '/favicon.svg', '/favicon.ico', '/iscn-parser.js', '/karyo-render.js',
   '/ideogram-data.js', '/robots.txt'].forEach((p) =>
    assert.ok(!runsWorkerFirst(first, p), `${p} should be served by the asset layer, not the Worker`));
});

// The figure caption states what the figure shows, and the figures differ by
// class. Dan caught the marker page claiming "the involved chromosomes with
// their normal homolog" under a figure that draws only the mar glyph, which
// HAS no homolog: banding cannot even say which chromosome it came from. The
// same fixed phrase was quietly wrong for pure count changes. These read the
// GENERATED pages, which pretest regenerates, so the assertions hold the
// template and its output together.
test('each landing-page caption describes its own figure class', () => {
  const cap = (slug) => {
    const m = read(`karyotype/${slug}/index.html`).match(/<figcaption class="lp-figcap">([^<]+)<\/figcaption>/);
    assert.ok(m, `${slug} has a figure caption`);
    return m[1];
  };
  const marker = cap('marker-chromosome');
  assert.match(marker, /only the marker itself/, 'a mar figure is the marker alone');
  assert.doesNotMatch(marker, /normal homolog/, 'nothing in it has a homolog to show');
  assert.match(cap('down-syndrome'), /all copies of the gained chromosome/,
    'a whole-chromosome gain shows three ordinary copies, none abnormal');
  assert.match(cap('turner-syndrome'), /count changed/,
    'a bare count change shows the chromosomes that remain');
  assert.match(cap('cri-du-chat-syndrome'), /normal homolog/,
    'a structural change keeps the homolog comparison caption');
  assert.match(cap('mosaic-turner-syndrome'), /cell lines/,
    'a mosaic keeps its every-cell-line caption');
});
