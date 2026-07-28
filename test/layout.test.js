'use strict';
// Layout invariants for the served static HTML.
//
// The homepage footer was nested inside main. `main { padding: 18px 0 60px }` then
// painted its 60px of bottom padding *below* the footer, so the footer sat on a band
// of empty page with nothing under it. A page-level footer is not main content: it
// belongs after the closing main tag, where main's bottom padding is the space above
// the footer instead of dead space beneath it.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// lastIndexOf, not indexOf: the stylesheet's comments mention main by name, and only
// the final occurrence is the closing tag itself.
const mainCloseOf = (html) => html.lastIndexOf('</main>');
const footOpenOf = (html) => html.indexOf('<footer');

test('the homepage footer sits after the closing main tag, not inside it', () => {
  const html = read('index.html');
  assert.ok(mainCloseOf(html) !== -1, 'homepage should have a closing main tag');
  assert.ok(footOpenOf(html) !== -1, 'homepage should have a footer');
  assert.ok(footOpenOf(html) > mainCloseOf(html),
    'the page footer must follow main; nested inside it, main\'s bottom padding '
    + 'renders below the footer as empty page');
});

test('the print sheet hides the footer by name, not by hiding main', () => {
  const html = read('index.html');
  const printRule = html.match(/@media print \{\s*(?:\/\*[\s\S]*?\*\/\s*)*([^{]+)\{\s*display: none/);
  assert.ok(printRule, 'the print stylesheet should start by hiding the screen chrome');
  const hidden = printRule[1].split(',').map((s) => s.trim());
  assert.ok(hidden.includes('footer'),
    'the printable summary must hide the site footer; outside main it is no longer '
    + `covered by hiding main (hides: ${hidden.join(', ')})`);
});

test('the homepage footer is a top-level element, not wrapped in a container', () => {
  const html = read('index.html');
  const mainClose = mainCloseOf(html);
  const footOpen = footOpenOf(html);
  // Guard the slice: with the footer still inside main the range is empty and the
  // assertion below would pass without checking anything.
  assert.ok(footOpen > mainClose, 'the footer should follow main');
  const between = html.slice(mainClose + '</main>'.length, footOpen).trim();
  assert.deepEqual(between.length, 0,
    'nothing should sit between main and the footer: a wrapper there can reintroduce '
    + `padding under the footer (found ${JSON.stringify(between.slice(0, 120))})`);
});
