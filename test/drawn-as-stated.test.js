'use strict';
// Two policy decisions from the 2026-08 production review, both the same shape:
// when the input already states its own reading, draw that reading and say so,
// instead of refusing and asking for a click-through.
//
//   1. 45,XX,t(14;21)(q10;q10): a whole-arm exchange spelled t() keeps both
//      products and tallies 46, so the stated 45 asserts the fusion outcome, one
//      derivative replacing both normals (ISCN 2024 5.5.18.2 c; for acrocentrics
//      that fusion is the Robertsonian, 5.5.18.3 a). Six production visitors
//      typed exactly this and were refused. Drawn as the fusion, with the
//      preferred der() spelling one click away (5.5.18.3 b: der is preferred;
//      rob describes constitutional cases only).
//   2. t(2;5)(q21;q31) bare: only the rearrangement, no count or sex field. Six
//      production visitors. Drawn on an assumed normal complement (XX unless the
//      rearrangement names a Y), the assumption stated beside the figure, the
//      written-out karyotype one click away.
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
const Teach = win.Teach;

// ---- the t()-spelled whole-arm fusion at the fused count --------------------

test('45,XX,t(14;21)(q10;q10) draws as the Robertsonian fusion', () => {
  const m = ISCN.parse('45,XX,t(14;21)(q10;q10)');
  assert.equal(m.ok, true);
  const c = m.clones[0];
  assert.equal(c.countWrong, false, 'the stated 45 is the fusion count, not an error');
  assert.equal(c.counts.actual, 45);
  assert.equal(c.unreadable, false);
  const der = (c.slots['14'] || []).filter((i) => i.kind !== 'normal')[0];
  assert.ok(der, 'one fused body sits in the 14 slot');
  assert.match(der.label, /der\(14;21\)/);
});

test('the drawn fusion carries the teaching note with the der() respelling', () => {
  const m = ISCN.parse('45,XX,t(14;21)(q10;q10)');
  assert.equal(m.warnings.length, 0, 'a note never shares the box with a warning');
  assert.ok(m.note, 'note present');
  assert.match(m.note.text, /Robertsonian/);
  assert.match(m.note.text, /der\(14;21\)\(q10;q10\)/);
  assert.equal(m.note.fix, '45,XX,der(14;21)(q10;q10)');
  assert.equal(m.countFix, null, 'no count repair on offer; the count was right');
});

test('a non-acrocentric whole-arm t() at the fused count keeps the refusal', () => {
  // t(1;3)(p10;q10) at 45 says one product survived, but not WHICH: 1p+3q is
  // der(1;3)(p10;q10) and 3p+1q is der(1;3)(q10;p10), and they are different
  // karyotypes (ISCN 5.5.18.2 b-c). Only the acrocentric q10;q10 fusion is
  // unambiguous (the p arms carry only satellite material and are lost,
  // 5.5.18.3 a), so only that one is reinterpreted.
  const na = ISCN.parse('45,XX,t(1;3)(p10;q10)');
  assert.equal(na.clones[0].countWrong, true);
  assert.ok(na.countFix, 'the count repair stays on offer');
});

test('the reinterpretation needs the exact fusion count and a whole-arm t()', () => {
  // One short of the tally but not whole-arm: the count-repair path, as before.
  const ph = ISCN.parse('45,XX,t(9;22)(q34;q11.2)');
  assert.equal(ph.clones[0].countWrong, true);
  assert.equal(ph.countFix, '46,XX,t(9;22)(q34;q11.2)');
  // Two short: no fusion reading exists, the count repair stands.
  const two = ISCN.parse('44,XX,t(14;21)(q10;q10)');
  assert.equal(two.clones[0].countWrong, true);
});

test('the decode of the reread fusion never appends the t() reading', () => {
  // The standing failure shape from the land-mine list: fixing the model leaves
  // the DECODE contradicting it. On the first cut of this feature the decode
  // said "Both whole-arm products are kept here, so the count stays 45 ... rob
  // gives a count of 44" beside a figure drawing one fused chromosome, because
  // teach.js robNote keys on wholeArmAcro and the flip had left it set.
  const c = ISCN.parse('45,XX,t(14;21)(q10;q10)').clones[0];
  const d = Teach.decode(c).map((r) => r.text).join(' ');
  assert.match(d, /Robertsonian/i);
  assert.doesNotMatch(d, /products are kept/, 'the t() paragraph belongs to the t() reading');
});

test('a mosaic clone reinterprets too, and the note still states the reading', () => {
  const m = ISCN.parse('45,XX,t(14;21)(q10;q10)[3]/46,XX[7]');
  assert.equal(m.ok, true);
  assert.equal(m.clones[0].countWrong, false);
  assert.ok(m.note, 'never a silent reinterpretation');
  assert.match(m.note.fix, /der\(14;21\)\(q10;q10\)\[3\]/);
});

// ---- the bare rearrangement -------------------------------------------------

test('a bare balanced translocation draws on an assumed 46,XX', () => {
  const m = ISCN.parse('t(2;5)(q21;q31)');
  assert.equal(m.ok, true);
  assert.equal(m.suggestion, null, 'drawn, not suggested');
  assert.equal(m.warnings.length, 0);
  const c = m.clones[0];
  assert.equal(c.modalNumber, 46);
  assert.equal(c.sex.label, 'XX');
  assert.equal(c.unreadable, false);
  assert.ok(m.note);
  assert.match(m.note.text, /46,XX/);
  assert.equal(m.note.fix, '46,XX,t(2;5)(q21;q31)');
  assert.equal(m.assumedNormal, '46,XX,t(2;5)(q21;q31)', 'the assumption is recorded');
});

test('a bare gain draws at the corrected count', () => {
  const m = ISCN.parse('+21');
  assert.equal(m.ok, true);
  assert.equal(m.warnings.length, 0);
  assert.equal(m.clones[0].modalNumber, 47);
  assert.equal(m.clones[0].complement['21'], 3);
  assert.equal(m.note.fix, '47,XX,+21');
});

test('a bare loss draws at the corrected count', () => {
  const m = ISCN.parse('-7');
  assert.equal(m.ok, true);
  assert.equal(m.clones[0].modalNumber, 45);
  assert.equal(m.note.fix, '45,XX,-7');
});

test('a bare Y-involving rearrangement assumes XY, not XX', () => {
  const m = ISCN.parse('idic(Y)(q11.2)');
  assert.equal(m.ok, true);
  assert.equal(m.clones[0].sex.label, 'XY');
  assert.match(m.note.text, /46,XY/);
});

test('a bare whole-arm fusion composes with the count repair and draws', () => {
  const m = ISCN.parse('rob(13;14)(q10;q10)');
  assert.equal(m.ok, true);
  assert.equal(m.clones[0].modalNumber, 45);
  assert.equal(m.note.fix, '45,XX,rob(13;14)(q10;q10)');
});

test('the assumption never adopts input whose completed form has more to say', () => {
  // 46,XX,t(13;15)(q10;q10) draws with its own rob() note; two notes cannot
  // render, so this stays the click-through suggestion it was.
  const m = ISCN.parse('t(13;15)(q10;q10)');
  assert.equal(m.ok, false);
  assert.equal(m.suggestion, '46,XX,t(13;15)(q10;q10)');
  assert.ok(m.warnings.some((w) => /typed only the rearrangement/.test(w)));
});

test('genuine garbage is still refused with no assumption', () => {
  const g = ISCN.parse('hello there');
  assert.equal(g.ok, false);
  assert.equal(g.suggestion, null);
  assert.equal(g.assumedNormal, undefined);
});

test('a complete karyotype is untouched by the assumption path', () => {
  const m = ISCN.parse('46,XX,t(2;5)(q21;q31)');
  assert.equal(m.note, null);
  assert.equal(m.assumedNormal, undefined);
});
