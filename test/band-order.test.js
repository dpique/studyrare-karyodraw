'use strict';
// The same-arm breakpoint-order rule, fixed twice and now pinned so it cannot
// flip again.
//
// ISCN's short system lists the breakpoint CLOSER TO THE CENTROMERE first when
// two breaks share an arm; inv(2)(p13p23) is the standard's own example. On
// the q arm that coincides with pter-to-qter order, which is why the backwards
// rule survived: it only misfires on p-arm pairs. The app originally enforced
// proximal-first, was "corrected" to pter-to-qter by a session that generalized
// from ISCN's dup(1)(p34~32p22) worked example, and dup is precisely the type
// where band order is not spelling at all: it encodes the orientation of the
// segment (direct versus inverted), as does ins. So dup and ins must never be
// reordered, del and inv normalize proximal-first, and cross-arm (pericentric)
// pairs stay short-arm-first. Dan re-derived the rule from the ISCN text on
// 2026-09-10; the EML4::ALK literature's inv(2)(p21p23) was conformant all
// along.
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
const orderNotes = (k) => warningsOf(k).filter((w) => /centromere.*first|” is “/.test(w));

test('proximal-first p-arm pairs are correct and draw without comment', () => {
  // The exact strings students bring in from the literature.
  ['46,XY,inv(2)(p21p23)', '46,XX,inv(2)(p13p23)', '46,XX,del(5)(p15.2p15.3)',
   '46,XY,del(1)(p13p31)']
    .forEach((k) => assert.deepEqual(orderNotes(k), [], k + ' needs no spelling note'));
});

test('a distal-first p-arm pair gets the proximal-first respelling', () => {
  const w = orderNotes('46,XY,inv(2)(p23p21)');
  assert.equal(w.length, 1, 'exactly one note');
  assert.match(w[0], /closer to the centromere/, 'states the actual rule');
  assert.match(w[0], /“inv\(2\)\(p23p21\)” is “inv\(2\)\(p21p23\)”/, 'so-X-is-Y shape, corrected pair');
  const d = orderNotes('46,XX,del(5)(p15.3p15.2)');
  assert.equal(d.length, 1);
  assert.match(d[0], /is “del\(5\)\(p15.2p15.3\)”/);
});

test('q-arm pairs keep the behavior both rules agree on', () => {
  assert.deepEqual(orderNotes('46,XX,inv(3)(q21q26.2)'), [], 'proximal-first q pair is right');
  const w = orderNotes('46,XX,inv(3)(q26.2q21)');
  assert.equal(w.length, 1);
  assert.match(w[0], /is “inv\(3\)\(q21q26.2\)”/);
});

test('a pericentric pair still writes its short-arm breakpoint first', () => {
  assert.deepEqual(orderNotes('46,XY,inv(2)(p13q24)'), []);
  const w = orderNotes('46,XY,inv(2)(q24p13)');
  assert.equal(w.length, 1);
  assert.match(w[0], /is “inv\(2\)\(p13q24\)”/);
});

test('dup and ins are never reordered: their band order is orientation', () => {
  // ISCN 4.2.1 j.iii's dup(1)(p34~32p22) is DISTAL first because it is a
  // direct duplication, not because of any general ordering rule. Both orders
  // of a dup or an ins are different rearrangements and both are correct.
  ['46,XY,dup(1)(p34p22)', '46,XY,dup(1)(p22p34)',
   '46,XX,ins(5;2)(q31;p13p23)', '46,XX,ins(5;2)(q31;p23p13)']
    .forEach((k) => assert.deepEqual(orderNotes(k), [], k + ' must not be reordered'));
});

test('the detailed system converts to the proximal-first short spelling', () => {
  // shortFromDetailed reads bands in encounter order, and the detailed system
  // genuinely runs pter to qter, so without canonical ordering the p-arm
  // inversion converts to the backwards short form.
  const p = ISCN.parse('46,XX,inv(2)(pter→p23::p13→p23::p13→qter)');
  const all = (p.warnings || []).map((w) => w.text || w).join(' ');
  assert.match(all, /inv\(2\)\(p13p23\)/, 'the announced short form is proximal-first');
  assert.doesNotMatch(all, /inv\(2\)\(p23p13\)/, 'never the backwards one');
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
