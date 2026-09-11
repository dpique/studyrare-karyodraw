'use strict';
// Two spellings straight from the live failing-inputs stream (the usage
// table's parsed=0 rows): ALL-CAPS breakpoints pasted from lab reports
// (ADD(X)(P22.1), 2 recent hits) and the pseudodicentric (psu dic, 5 recent
// hits). Both used to gate: the first with "P22.1 is not a breakpoint", the
// second with "psudic is not an ISCN abbreviation", which for real ISCN is
// the worst kind of error this app can make (the parser's own words).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context));
const ISCN = win.ISCN;
const Karyo = win.Karyo;
const Teach = win.Teach;

const warningsOf = (p) => Array.from(p.warnings || [], (w) => w.text || w);

test('uppercase arm letters are read, lowered, and noted once', () => {
  const p = ISCN.parse('46,X,ADD(X)(P22.1)');
  const w = warningsOf(p);
  assert.ok(!w.some((x) => /is not a breakpoint/.test(x)), 'P22.1 is a breakpoint, spelled loudly');
  const notes = w.filter((x) => /lowercase/.test(x));
  assert.equal(notes.length, 1, 'one note: ' + JSON.stringify(w));
  assert.match(notes[0], /” is “/, 'so-X-is-Y shape, applied like the other repairs');
  assert.match(notes[0], /p22\.1/, 'shows the lowered spelling');
  assert.equal(p.clones[0].unreadable, false, 'and it draws');
});

test('a fully uppercase designation lowers every arm letter', () => {
  const p = ISCN.parse('46,XX,DEL(5)(Q13Q33)');
  const w = warningsOf(p);
  assert.equal(w.filter((x) => /lowercase/.test(x)).length, 1);
  assert.ok(!w.some((x) => /written first/.test(x)), 'q13q33 is in order; no false order note');
  assert.equal(p.clones[0].unreadable, false);
});

test('chromosome names stay uppercase; X and Y are not arm letters', () => {
  const p = ISCN.parse('46,X,i(X)(q10)');
  assert.deepEqual(warningsOf(p), [], 'nothing to lower in a correct spelling');
});

test('psu dic parses as a dicentric with one active centromere', () => {
  const p = ISCN.parse('45,XY,psu dic(5;4)(q15;q11)');
  const w = warningsOf(p);
  assert.ok(!w.some((x) => /not an ISCN abbreviation/.test(x)), 'psu dic is ISCN: ' + JSON.stringify(w));
  assert.equal(p.clones[0].unreadable, false, 'and the correctly counted spelling draws');
  const ab = p.clones[0].aberrations[0];
  assert.equal(ab.kind, 'dic', 'drawn as a dicentric, which it physically is');
  assert.equal(ab.psu, true, 'flagged pseudodicentric');
  // Both primary constrictions exist on the chromosome and both are drawn.
  const inst = (p.clones[0].slots['5'] || []).find((i) => i.kind !== 'normal');
  assert.ok(inst, 'the derivative is filed');
  const cens = Karyo.buildInstance(inst).segments.filter((s) => s.hasCen).length;
  assert.equal(cens, 2, 'two centromeres drawn; activity is the decode\'s job');
});

test('the psu dic decode explains the inactive centromere', () => {
  const p = ISCN.parse('45,XY,psu dic(5;4)(q15;q11)');
  const text = Teach.decode(p.clones[0]).map((r) => r.text).join(' ');
  assert.match(text, /only one of the two centromeres is active/);
  assert.match(text, /first-listed/, 'names the convention: the first-listed chromosome keeps the active one');
});

test('psu idic parses, draws its mirror, and explains itself', () => {
  const p = ISCN.parse('46,XX,psu idic(15)(q12)');
  const w = warningsOf(p);
  assert.ok(!w.some((x) => /not an ISCN abbreviation/.test(x)), JSON.stringify(w));
  const ab = p.clones[0].aberrations[0];
  assert.equal(ab.kind, 'dic');
  assert.equal(ab.psu, true);
  const text = Teach.decode(p.clones[0]).map((r) => r.text).join(' ');
  assert.match(text, /only one of the two centromeres is active/);
});

test('bare psu on anything else keeps the honest not-drawn message', () => {
  const w = warningsOf(ISCN.parse('46,XX,psu t(3;5)(q21;q31)'));
  assert.ok(w.some((x) => /correct ISCN/.test(x) || /not an ISCN abbreviation/.test(x)),
    'an unmodelled psu spelling is refused with a reason, not drawn wrong: ' + JSON.stringify(w));
});
