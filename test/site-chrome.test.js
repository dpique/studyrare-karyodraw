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

// The karyogram toolbar: one row, one button style, two groups. The four export
// actions group on the left; the "Not right?" flag anchors the right edge, alone
// and in amber (owner decision 2026-08-09, swapping the groups; the flag
// previously led on the left). What stays load-bearing: the flag lives IN this
// top row with its amber identity, isolated from the export cluster by the
// spacer. An earlier pass that parked it under the figure was too quiet to
// invite a report, and that placement stays reverted. Every action is the same
// bordered .pbtn; the row used to mix bordered buttons with borderless text
// links, which read as two half-finished designs.
test('one button style, exports grouped left, flag anchoring right', () => {
  const html = read('index.html');
  const actions = html.match(/<div class="kactions"[\s\S]*?<\/div>/)[0];
  const buttons = [...actions.matchAll(/<button class="([^"]*)" id="([a-z]+)"/g)]
    .map((m) => ({ classes: m[1].split(' '), id: m[2] }));
  assert.deepEqual(buttons.map((b) => b.id), ['copyimg', 'dlimg', 'copyhint', 'printbtn', 'flagbtn'],
    'the four export actions lead, the flag anchors the end');
  for (const b of buttons) {
    assert.ok(b.classes.includes('pbtn'), `${b.id} shares the one bordered button style`);
    assert.ok(!b.classes.includes('sharelink'), `${b.id} is not a borderless text link`);
  }
  assert.ok(buttons[4].classes.includes('flagbtn'), 'the flag keeps its amber identity');
  assert.match(actions, /printbtn"[\s\S]*?<span class="spacer"><\/span>[\s\S]*?flagbtn/,
    'a spacer separates the export group from the flag');
  assert.ok(!/class="kfoot"/.test(html), 'the under-figure flag row is gone');
});
