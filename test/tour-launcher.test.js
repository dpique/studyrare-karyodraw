'use strict';
// Clicking "Take the guided tour (11 steps)" did nothing. The launcher wiring set
// the button label, then hit a stale duplicate of the example-count line that
// references KD_PAGE_COUNT, an identifier defined nowhere; the ReferenceError
// aborted the enclosing script before the click handler attached, and took the
// ?tour=1 deep link and the pageview beacon down with it. The label having been
// set is what made the button look wired: the count in the link text came from the
// same block that then died two lines later.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('the tour launcher wiring references no undefined identifier', () => {
  assert.ok(!/KD_PAGE_COUNT/.test(html),
    'KD_PAGE_COUNT is defined nowhere; referencing it throws and kills the launcher');
});

test('the example count is set from the curriculum exactly once', () => {
  const sets = html.match(/all\.textContent = "See all "/g) || [];
  assert.equal(sets.length, 1,
    'one source for the example count: KDContent.CONTENT.length');
});

test('the click handler is attached in the same block that labels the button', () => {
  // The block that sets the label must reach addEventListener: if anything between
  // them throws, the button reads as wired ("(11 steps)") while the click is dead.
  const block = html.match(/var btn = \$\("#tour-start"\);[\s\S]*?\}\)\(\);/);
  assert.ok(block, 'the launcher wiring block exists');
  assert.match(block[0], /btn\.addEventListener\("click"/, 'the launcher attaches its click handler');
});
