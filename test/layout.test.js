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

// The app page prints a purpose-built #printsheet, so its print stylesheet hides
// `main`. That stylesheet is inlined verbatim into every generated page, and a landing
// page has no #printsheet to take main's place, so printing one produced a blank sheet.
const styleOf = (f) => read(f).match(/<style>([\s\S]*?)<\/style>/)[1];
const GENERATED = ['about/index.html', 'how-to-read-a-karyotype/index.html',
  'karyotype/index.html', 'karyotype/down-syndrome/index.html'];

test('generated pages print their own article, not a blank sheet', () => {
  for (const f of GENERATED) {
    const css = styleOf(f);
    const print = css.slice(css.indexOf('@media print'));
    assert.ok(/(^|[\s,])main[\s,]/.test(print.slice(0, 400)),
      `${f}: expected the inherited app print rule that hides main`);
    assert.match(print, /main\.lp-wrap\s*\{[^}]*display:\s*block\s*!important/,
      `${f}: a landing page has no #printsheet, so it must re-show its own main in print`);
  }
});

test('the app page still prints its print sheet, not its interface', () => {
  const print = (() => { const c = styleOf('index.html'); return c.slice(c.indexOf('@media print')); })();
  assert.ok(!/main\.lp-wrap\s*\{[^}]*display:\s*block/.test(print),
    'the homepage must keep hiding main in print: it prints the #printsheet it builds');
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

// The heading over the warning box has to agree with what is inside it. A karyotype
// the app has no drawing for is not the reader's problem, and "Let's sort this out"
// over a sentence reading "nothing is wrong with what you typed" contradicts itself in
// three lines. It only softens when EVERY message is one of these: a rec() alongside a
// real typo is still something to sort out.
test('the warning heading follows the messages under it', () => {
  const page = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(page, /var allNotDrawn = w\.every\(/, 'the heading is decided from all the messages');
  assert.match(page, /KaryoDraw cannot draw:/, 'and has its own wording for that case');
  // The marker it keys on is the phrase the parser actually emits. If one moves without
  // the other the heading silently reverts, which is exactly what this pins.
  const parser = fs.readFileSync(path.join(root, 'iscn-parser.js'), 'utf8');
  assert.match(parser, /is correct ISCN, /, 'and the parser still emits that phrase');
});

// ---- where the tour starts ---------------------------------------------------
// The tour used to be a nav item, sitting beside "Guide" and promising the same thing
// in different words. It is a mode of the homepage, not a page, and it can only run
// there. It now starts from a line beside the input, and from the Guide, which is the
// teaching destination that stayed in the nav, so it is still one click from any page.
const navLinks = (html) => {
  const bar = html.match(/<nav class="sitebar-nav"[\s\S]*?<\/nav>/);
  assert.ok(bar, 'every page has the primary nav');
  return [...bar[0].matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[2].trim(), m[1]]);
};

test('the nav names one thing per item, and the tour is not one of them', () => {
  ['index.html', 'about/index.html', 'how-to-read-a-karyotype/index.html',
   'karyotype/index.html', 'karyotype/down-syndrome/index.html'].forEach((f) => {
    const labels = navLinks(read(f)).map((l) => l[0]);
    assert.deepEqual(labels, ['Karyotypes', 'Guide', 'About'], f);
  });
});

test('the homepage starts the tour from beside the input', () => {
  const html = read('index.html');
  assert.match(html, /id="tour-start"/, 'the launcher is there');
  // Before the view options and after the example chips: in the typing path, where
  // someone who does not know the notation is sitting.
  assert.ok(html.indexOf('id="examples"') < html.indexOf('id="tour-start"'), 'after the chips');
  assert.ok(html.indexOf('id="tour-start"') < html.indexOf('class="viewopts"'), 'before the view options');
  // A link, not a second button competing with Draw & explain.
  assert.match(html, /class="linklike" id="tour-start"/, 'styled as a link');
  // The step count comes from the curriculum, so it cannot drift from it.
  assert.ok(!/guided tour \(\d+ steps\)/.test(html), 'the count is not typed into the markup');
  assert.match(html, /TOUR\.length \+ " steps\)"/, 'the count is filled in from TOUR');
  // And the deep link still works.
  assert.match(html, /if \(wantsTour\) startTour\(\);/, '?tour=1 still opens it');
});

test('the guide keeps a way into the tour', () => {
  assert.match(read('how-to-read-a-karyotype/index.html'), /href="\/\?tour=1"/,
    'the guide is the nav item that reaches the tour from every page');
});
