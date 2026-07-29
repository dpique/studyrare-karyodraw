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

// ---- the first screen on a phone ---------------------------------------------
// At 390x844 the karyogram started 888px down: the input, three example chips, the
// prompt line and three rows of segmented buttons filled the whole first screen, so
// someone arriving from a search saw a form and no drawing. Measured after these
// changes it starts at 627. The pieces that bought that are pinned here.
test('the view options fold away on a phone, and are open everywhere else', () => {
  const html = read('index.html');
  // Collapsed by script, never by CSS alone: a page whose script failed must show the
  // options rather than hide them behind a control that cannot open them.
  assert.match(html, /\.viewtoggle \{ display: none; \}/, 'the toggle is hidden by default');
  assert.match(html, /@media \(max-width: 700px\) \{[\s\S]*?\.viewtoggle \{/, 'and shown on a narrow screen');
  // Every rule that hides the body has to be the collapsed one. Written as a sweep
  // rather than a match for the rule as authored, so a second, unqualified
  // "display: none" added later cannot slip past by sitting somewhere else.
  const hides = [...html.matchAll(/([^\n]*)\.viewbody \{[^}]*display: none/g)].map((m) => m[1]);
  assert.ok(hides.length, 'the collapsed rule is there');
  hides.forEach((prefix) => assert.match(prefix, /\.viewwrap\.collapsed $/,
    `.viewbody is hidden by a rule that is not the collapsed one: "${prefix}"`));
  // The folded row still says what is on screen.
  assert.match(html, /id="viewstate"/, 'the collapsed row carries the current setting');
  assert.match(html, /aria-expanded/, 'and reports its state to a screen reader');
  assert.match(html, /aria-controls="viewbody"/, 'and names what it controls');
});

test('a phone gets fewer example chips, and everyone gets a way back to them', () => {
  const html = read('index.html');
  assert.match(html, /max-width: 560px[^]*?matches;\s*\n\s*return Math\.min\(narrow \? 2 : EXAMPLES_SHOWN/,
    'two chips under 560px, three above');
  // The chips are re-dealt every load on purpose, so the row needs a door to all of them.
  assert.match(html, /id="all-examples" href="\/karyotype\/"/, 'the link to the full list');
  assert.ok(!/See all \d+ examples<\/a>/.test(html), 'the count is not typed into the markup');
  assert.match(html, /"See all " \+ pages \+ " examples"/, 'it comes from the curriculum');
});

// ---- what is on screen when nothing is drawn ----------------------------------
// A refused karyotype used to sit beside a "Karyotype decoded" card showing "…", a band
// map of a chromosome from the last karyotype that DID draw, and a legend for a drawing
// that was not there.
test('a refusal puts away the cards that describe a drawing', () => {
  const html = read('index.html');
  ['decode-card', 'detail-card', 'legend-card'].forEach((id) =>
    assert.match(html, new RegExp(`id="${id}"`), `${id} has to be addressable`));
  const invalid = html.match(/if \(invalid\) \{[\s\S]*?\n {6}return;/)[0];
  assert.match(invalid, /showAsideCards\(false\)/, 'the refusal hides them');
  assert.ok(!/\$\("#decode"\)\.innerHTML = '<div class="muted">…<\/div>'/.test(html),
    'and does not leave an ellipsis standing in for an explanation');
  // And a later valid karyotype brings them back.
  const valid = html.match(/currentModel = model;[\s\S]*?renderDetail\(focus\);/)[0];
  assert.match(valid, /showAsideCards\(true\)/, 'a drawing brings them back');
  // With the cards gone, the 360px column would hold a third of the page open for
  // nothing, so the grid drops to one column while there is nothing to put in it.
  assert.match(html, /\.grid\.solo \{ grid-template-columns: minmax\(0, 1fr\); \}/, 'the empty column collapses');
  assert.match(html, /classList\.toggle\("solo", !on\)/, 'and only while the cards are away');
});

test('the About page does not repeat itself in the footer', () => {
  // Every clause of the site footer restates a section of that page: what the app is,
  // that it is not diagnostic, who makes it, and the Ko-fi line.
  assert.ok(!/<div class="lp-foot">/.test(read('about/index.html')), 'no site footer on About');
  // It is the only place those things are said on every other page, so it stays there.
  ['how-to-read-a-karyotype/index.html', 'karyotype/down-syndrome/index.html', 'karyotype/index.html']
    .forEach((f) => assert.match(read(f), /<div class="lp-foot">/, `${f} keeps the footer`));
});
