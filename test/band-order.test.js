'use strict';
// The same-arm breakpoint-order rule, now fixed THREE times, pinned against the
// standard's own text so that the next flip has to argue with ISCN rather than
// with a previous session.
//
// ISCN 2024 (Cytogenet Genome Res 2024;164(suppl 1):1-224; the searchable copy
// is ~/Desktop/colorado/books/core_resources_abgc/2024_ISCN.pdf):
//   5.5.2 b   "With an interstitial deletion where the two breaks occur within the
//             same arm, the breakpoints are specified from pter to qter."
//   5.5.10 a  "In all cases, the breakpoint closer to pter of the inverted
//             chromosome is specified first."
//   Table 3   "Breakpoint band designations from pter to qter of the rearranged
//             chromosome"
//   printed:  del(X)(p21p11.4) (5.5.2 b vi), inv(2)(p23p13) (5.5.10 b i),
//             der(9)inv(9)(p23p13)del(9)(q22q33) (5.5.3), del(1)(p34p22),
//             del(3)(p21p13), del(12)(p13p11.2), del(17)(p13p11.2), inv(9)(p23p13),
//             inv(6)(p22.3p21.2): all thirteen del and inv p-arm pairs with two
//             distinct bands put the distal band first. One stray
//             del(4)(p15.3p16.1) in 4.2.1 h's "e.g." list about semicolons runs
//             the other way; against two rule sentences, a table row and thirteen
//             examples it is a typo, not a rule.
//
// So: pter to qter in both arms. On the q arm that is ascending band number; on
// the p arm it is DESCENDING, and that is the only place the rule bites.
// History: the app first enforced centromere-first (wrong), was corrected to
// pter-to-qter in 2026-08 from the text (right), and on 2026-09-10 (#327) was
// flipped back to centromere-first on the claim that "inv(2)(p13p23) is the
// standard's own example". That string does not occur in ISCN 2024, and #327
// edited the two verbatim corpus entries to fit the rule; they are restored and
// pinned below. The EML4::ALK literature's inv(2)(p21p23) is the literature's
// habit, not the standard's: ISCN's order is inv(2)(p23p21), and the app says so
// as a spelling note beside a drawing that is the same either way. dup and ins
// are never reordered: their band order encodes orientation (direct versus
// inverted), so it is not spelling.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context));
const ISCN = win.ISCN;

// Array.from in THIS realm: the parser's arrays come from the vm context,
// whose Array.prototype is a different object, and deepEqual compares
// prototypes, so a cross-realm empty array never equals a host [].
const warningsOf = (k) => Array.from(ISCN.parse(k).warnings || [], (w) => w.text || w);
const orderNotes = (k) => warningsOf(k).filter((w) => /is written first|” is “/.test(w));

test("ISCN's own printed p-arm pairs draw without comment", () => {
  ['46,Y,del(X)(p21p11.4)', '46,XX,inv(2)(p23p13)', '46,XY,inv(9)(p23p13)',
   '46,XY,del(1)(p34p22)', '46,XX,del(3)(p21p13)', '46,XY,del(12)(p13p11.2)',
   '46,XY,der(9)inv(9)(p23p13)del(9)(q22q33)', '46,XX,del(5)(p15.3p15.2)']
    .forEach((k) => assert.deepEqual(orderNotes(k), [], k + ' is the standard\'s spelling'));
});

test('a centromere-first p-arm pair gets the pter-first respelling', () => {
  // The EML4::ALK literature's habit. The figure is identical either way, so
  // this is a note beside a drawing, not a refusal.
  const w = orderNotes('46,XY,inv(2)(p21p23)');
  assert.equal(w.length, 1, 'exactly one note');
  assert.match(w[0], /closer to pter is written first/, 'states the rule in ISCN\'s words');
  assert.match(w[0], /“inv\(2\)\(p21p23\)” is “inv\(2\)\(p23p21\)”/, 'so-X-is-Y shape, corrected pair');
  const d = orderNotes('46,XX,del(5)(p15.2p15.3)');
  assert.equal(d.length, 1);
  assert.match(d[0], /is “del\(5\)\(p15.3p15.2\)”/);
  assert.equal(ISCN.parse('46,XY,inv(2)(p21p23)').clones[0].unreadable, false, 'and it still draws');
});

test('q-arm pairs: ascending band number is pter to qter', () => {
  assert.deepEqual(orderNotes('46,XX,inv(3)(q21q26.2)'), [], 'ISCN 5.5.10 b ii, verbatim');
  const w = orderNotes('46,XX,inv(3)(q26.2q21)');
  assert.equal(w.length, 1);
  assert.match(w[0], /is “inv\(3\)\(q21q26.2\)”/);
});

test('a pericentric pair writes its short-arm breakpoint first', () => {
  assert.deepEqual(orderNotes('46,XY,inv(2)(p13q24)'), []);
  const w = orderNotes('46,XY,inv(2)(q24p13)');
  assert.equal(w.length, 1);
  assert.match(w[0], /is “inv\(2\)\(p13q24\)”/);
});

test('dup and ins are never reordered: their band order is orientation', () => {
  // ISCN 4.2.1 j.iii's dup(1)(p34~32p22) is a direct duplication; the reverse
  // order is an inverted one. Both orders of a dup or an ins are different
  // rearrangements and both are correct.
  ['46,XY,dup(1)(p34p22)', '46,XY,dup(1)(p22p34)',
   '46,XX,ins(5;2)(q31;p13p23)', '46,XX,ins(5;2)(q31;p23p13)']
    .forEach((k) => assert.deepEqual(orderNotes(k), [], k + ' must not be reordered'));
});

test('the detailed system converts to the spelling ISCN prints beside it', () => {
  // 5.5.10 b i prints the two forms joined by "or". The composition reads pter
  // to qter, which is the short system's order too, so nothing is reordered.
  const shortOf = (k) => (ISCN.parse(k).warnings.find((w) => /DETAILED/.test(w)) || '');
  assert.match(shortOf('46,XX,inv(2)(pter→p23::p13→p23::p13→qter)'), /“46,XX,inv\(2\)\(p23p13\)”/);
  assert.doesNotMatch(shortOf('46,XX,inv(2)(pter→p23::p13→p23::p13→qter)'), /p13p23/);
  assert.match(shortOf('46,XX,del(5)(pter→p15.3::p15.1→qter)'), /“46,XX,del\(5\)\(p15.3p15.1\)”/);
});

test('the verbatim corpora carry the strings ISCN prints, not a rule\'s respelling', () => {
  // #327 edited these two entries to fit its rule and called them mis-transcribed.
  // A corpus that is edited to match the code cannot catch the code.
  // Data lines only: the file headers tell the history and name the bad string.
  const data = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8')
    .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
  [data('iscn-2024-examples.js'), data('iscn-2024-detailed.js')].forEach((src) => {
    assert.match(src, /46,XX,inv\(2\)\(p23p13\)/, '5.5.10 b i');
    assert.match(src, /der\(9\)inv\(9\)\(p23p13\)del\(9\)\(q22q33\)/, '5.5.3');
    assert.doesNotMatch(src, /inv\(2\)\(p13p23\)/, 'a string the standard does not print');
  });
});

test('the spelling banner does not claim an order note was applied', () => {
  // The figure is identical either way (the same segment is bounded), and the
  // header, chips and notes keep the typed spelling, so "already applied"
  // was a lie for this class of note. The classifier in index.html gives
  // order notes their own honest title.
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /written first/, 'the classifier keys on the rule phrase both variants share');
  assert.match(html, /same figure either way/, 'and titles the note truthfully');
});
