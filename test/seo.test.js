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

test('homepage title front-loads the keyword, not the brand', () => {
  const title = titleOf(read('index.html'));
  assert.ok(title, 'homepage should have a <title>');
  assert.match(title, /^Karyotype/i, 'title should start with the keyword, not "KaryoDraw"');
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

// The site serves the repo tree as static assets, minus `.assetsignore`. Internal
// engineering files must be on that list. `NEXT_SESSION_HANDOFF.md` was not, so it was
// live at karyodraw.com/NEXT_SESSION_HANDOFF.md carrying working notes and absolute paths
// under the author's home directory. That file is gone from the repo entirely now, since
// a session handoff primes a session rather than serving the product, and it is
// gitignored so it cannot come back; `.assetsignore` keeps its entry as a second guard in
// case one ever does. The rest of the list is what a reader should not be served.
test('internal engineering files are excluded from the served assets', () => {
  const ignore = read('.assetsignore').split('\n').map((l) => l.trim());
  for (const f of ['NEXT_SESSION_HANDOFF.md', 'README.md', 'CHANGELOG.md', 'docs/', 'test/']) {
    assert.ok(ignore.includes(f), `${f} must be in .assetsignore, not served publicly`);
  }
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
