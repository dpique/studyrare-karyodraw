'use strict';
// Site chrome that must not drift between the app page and the generated pages.
//
// The brand mark did drift: index.html carried the banded dotmark (clip paths,
// three band stripes, the amber tip clipped inside the rounded capsule, matching
// favicon.svg), while build-pages.mjs siteHeader() still emitted an older flat
// version whose amber block painted over the rounded corner. Crossing from the
// app to /karyotype/ visibly changed the logo. The mark now lives in one string
// in build-pages.mjs and is injected into index.html between KD:BRAND markers,
// the same arrangement that keeps the nav and footer from drifting.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

const markOf = (html, file) => {
  const m = html.match(/<svg class="dotmark"[\s\S]*?<\/svg>/);
  assert.ok(m, `${file} has a sitebar dotmark`);
  return m[0].replace(/\s+/g, ' ').replace(/> </g, '><').trim();
};

test('the sitebar brand mark is identical on the app and every generated page', () => {
  const home = markOf(read('index.html'), 'index.html');
  for (const f of ['karyotype/index.html', 'karyotype/mosaic-turner-syndrome/index.html',
    'how-to-read-a-karyotype/index.html', 'about/index.html']) {
    assert.equal(markOf(read(f), f), home, `${f} sitebar mark matches the homepage`);
  }
});

test('the app brand mark is injected between KD:BRAND markers', () => {
  const html = read('index.html');
  const block = html.match(/<!-- KD:BRAND:START -->[\s\S]*?<!-- KD:BRAND:END -->/);
  assert.ok(block, 'KD:BRAND markers exist so the build can re-inject the mark');
  assert.match(block[0], /<svg class="dotmark"/, 'the mark sits inside the markers');
});

// The karyogram toolbar groups by purpose: the export actions (copy image, PNG,
// copy link, print) sit together right-aligned above the figure, and the "Not
// right?" flag sits alone under the figure, where doubt about a drawing actually
// arrives. It used to sit between the export buttons, dressed as one of them.
test('export actions group together and the flag sits below the karyogram', () => {
  const html = read('index.html');
  const actions = html.match(/<div class="kactions"[\s\S]*?<\/div>/)[0];
  for (const id of ['copyimg', 'dlimg', 'copyhint', 'printbtn']) {
    assert.match(actions, new RegExp(`id="${id}"`), `${id} is in the export group`);
  }
  assert.ok(!/id="flagbtn"/.test(actions), 'the flag is not dressed as an export action');
  const after = html.split(/<div id="karyo"/)[1];
  assert.match(after, /id="flagbtn"/, 'the flag follows the karyogram');
});
