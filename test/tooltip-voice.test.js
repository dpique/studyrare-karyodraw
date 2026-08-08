'use strict';
// A tooltip earns its place by saying something the button label cannot. The
// "Copy link to this view" tooltip read "Copy a link that reproduces this exact
// view. It updates as you edit." The first sentence restated the label, and the
// second promised the wrong thing: a reader took it to mean a link they had
// already pasted somewhere would keep updating. It does not. The copied link is a
// snapshot of the address bar, which the app rewrites in place as you edit; the
// only non-obvious fact is that the link carries the Show, Bands, and Style
// settings and not just the karyotype, so that is all the tooltip says now.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

const titleOf = (id) => {
  const m = html.match(new RegExp(`<button[^>]*id="${id}"[^>]*>`));
  assert.ok(m, `#${id} exists`);
  const t = m[0].match(/title="([^"]*)"/);
  assert.ok(t, `#${id} has a title`);
  return t[1];
};

test('no tooltip promises a link that keeps updating after it is copied', () => {
  assert.ok(!/updates as you edit/i.test(html),
    'a copied link is a snapshot, so nothing may say it updates');
});

test('the copy-link tooltip states what the label cannot: the settings ride along', () => {
  const title = titleOf('copyhint');
  assert.match(title, /Show/, 'names the Show setting');
  assert.match(title, /Bands/, 'names the Bands setting');
  assert.match(title, /Style/, 'names the Style setting');
});

test('every action in the karyogram toolbar carries a tooltip', () => {
  // A bare button among annotated ones is the inconsistency this row just lost.
  for (const id of ['flagbtn', 'copyimg', 'dlimg', 'copyhint', 'printbtn']) {
    assert.ok(titleOf(id).trim().length > 0, `#${id} has non-empty helper text`);
  }
});
