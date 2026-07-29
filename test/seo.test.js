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
