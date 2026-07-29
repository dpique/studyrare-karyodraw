'use strict';
// The app checked against the standard it claims to implement.
//
// Every string in test/iscn-2024-examples.js is a karyotype-format example printed in
// ISCN 2024. They are the one corpus where "correct" is not a judgment call, which is
// what makes them the right guard for a draw gate: the gate's whole job is to accept
// correct ISCN and refuse the rest, and refusing correct ISCN is the worse of the two
// errors (docs/VALIDATION.md).
//
// This file was written after a gate was built from memory and shipped a rule that was
// backwards. It told students del(5)(p15.3p15.2) was wrong and offered the reverse,
// when Table 3 and 5.5.2 b say breakpoints run pter to qter, so on the short arm the
// distal band comes first and the original was right. Nothing in the test suite could
// have caught it, because every test in it had been written from the same memory.
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
const EXAMPLES = require('./iscn-2024-examples.js');

// What the page's gate asks of the parser. Kept in the same shape as index.html's
// `invalid` so this measures the drawing decision and not some private flag.
const refused = (k) => {
  const m = ISCN.parse(k);
  return !m.clones.length || m.clones.every((c) => c.modalNumber == null) ||
    !!m.suggestion || m.clones.some((c) => c.unreadable || c.countWrong || c.unaccounted);
};

test('the corpus is real and has not quietly shrunk', () => {
  assert.ok(EXAMPLES.length >= 380, `only ${EXAMPLES.length} examples; the extraction lost some`);
  const supported = EXAMPLES.filter((e) => e.supported);
  assert.ok(supported.length >= 300, `only ${supported.length} supported; coverage went backwards`);
  EXAMPLES.filter((e) => !e.supported).forEach((e) =>
    assert.ok(e.needs, `${e.k}: an unsupported example must name the ISCN feature it needs`));
});

test('every ISCN 2024 example the app supports is accepted', () => {
  // The one that matters. A failure here means the app is telling someone that
  // notation printed in the standard is wrong.
  const broken = EXAMPLES.filter((e) => e.supported && refused(e.k));
  assert.deepEqual(broken.map((e) => e.k), [],
    `these are printed in ISCN 2024 and the app refuses them:\n  ${broken.map((e) => e.k).join('\n  ')}`);
});

test('the unsupported list is a coverage gap, and is reported when it closes', () => {
  // Not an assertion that they stay refused: accepting one is progress. It has to be
  // deliberate, so flipping the flag is a code change rather than a silent drift.
  const nowOk = EXAMPLES.filter((e) => !e.supported && !refused(e.k));
  assert.deepEqual(nowOk.map((e) => e.k), [],
    'these are now accepted; set supported: true in test/iscn-2024-examples.js:\n  ' +
    nowOk.map((e) => `${e.k}   (${e.needs})`).join('\n  '));
});

// ---- the rules that were got wrong, pinned against their citations ------------
test('breakpoints are ordered pter to qter, not centromere-outward', () => {
  // ISCN Table 3: "Breakpoint band designations from pter to qter of the rearranged
  // chromosome". 5.5.2 b repeats it for interstitial deletions. Travelling pter to
  // qter, p-arm band numbers DESCEND and then q-arm numbers ASCEND, so the short arm
  // reads the opposite way round from the long arm. This was shipped backwards.
  const warns = (k) => ISCN.parse(k).warnings.join(' ');
  assert.doesNotMatch(warns('46,XX,del(4)(p15.3p15.2)'), /along the chromosome/,
    'distal band first on the p arm is correct');
  assert.match(warns('46,XX,del(4)(p15.2p15.3)'), /along the chromosome/,
    'proximal band first on the p arm is not');
  assert.doesNotMatch(warns('46,XX,del(5)(q13q33)'), /along the chromosome/,
    'proximal band first on the q arm is correct');
  assert.match(warns('46,XX,del(5)(q33q13)'), /along the chromosome/,
    'distal band first on the q arm is not');
  // 4.2.1 j.iii, verbatim, with the book's own gloss: "the distal breakpoint is in
  // 1p34 ... and the proximal breakpoint is in band 1p22".
  assert.doesNotMatch(warns('46,XY,dup(1)(p34~32p22)'), /along the chromosome/);
});

test('a ploidy level is a reporting baseline, never checked against the count', () => {
  // ISCN 6.3.7 f, with both examples: 81<3n> "even though the count is in the
  // near-tetraploid range", and 58<2n> "in the hypotriploid range ... reported
  // relative to a diploid chromosome number". A check that <Nn> must agree with the
  // number in front of it was added here and refused both.
  //
  // Asserted on the message, not on acceptance: these are polyploid clones and the
  // count model still reads them against a diploid baseline, which is a separate and
  // still-open gap (see the ploidy entries in iscn-2024-examples.js). What must be
  // true is that nothing complains about the ploidy NOTE.
  ['81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21',
    '58<2n>,XY,+X,+4,+6,+8,+9,+10,+14,+14,+17,+18,+21,+21',
    '69<3n>,XXY,-5,-7,+10,+17', '46<3n>,XY', '45<2n>,XY,-21', '92<4n>,XXYY']
    .forEach((k) => assert.equal(
      ISCN.parse(k).warnings.filter((w) => /\bn is 23 chromosomes|ploidy/i.test(w)).length, 0,
      `${k}: the ploidy level is not the app's to check`));
  // The ones that are diploid-baselined do have to draw.
  ['45<2n>,XY,-21', '46<3n>,XY'].forEach((k) => assert.equal(refused(k), false, k));
});

test('an insertion takes at least three breaks, and four is a real form', () => {
  // 5.5.9 a: "Insertions are three-break rearrangements". 5.5.9.3 then writes the
  // reciprocal insertional event with four, ins(5;6)(q13q23;q15q23). Requiring
  // exactly three refused that verbatim example.
  assert.equal(refused('46,XY,ins(5;2)(p14;q22q32)'), false, 'three, between chromosomes');
  assert.equal(refused('46,XX,ins(2)(p13q31q21)'), false, 'three, within one');
  assert.equal(refused('46,XY,ins(5;6)(q13q23;q15q23)'), false, 'four, reciprocal');
  assert.equal(refused('46,XY,ins(5;2)(p14;q22)'), true, 'two cannot bound a segment');
});

test('breakpoints need not be repeated once stated', () => {
  // ISCN 4.2.1 f, with its own example. The bare t(9;22) is a back-reference, and an
  // arity rule that did not know this refused the standard's own text.
  assert.equal(refused('46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10]'), false);
  assert.equal(refused('47,XXX,t(11;22)(q23;q11.2)[10]/46,XX,t(11;22)[10]'), false);
  // With no earlier full form anywhere in the string there is nothing to refer back
  // to, and the breakpoints in the drawing would be invented.
  assert.equal(refused('46,XX,t(9;22)'), true);
});

test('characters outside the ISCN symbol list are named and removed', () => {
  // ISCN Chapter 3 lists every symbol the nomenclature uses, and it is a closed list.
  // "%" is not on it, so there is no rule to teach beyond that, and the useful move is
  // to take it out and offer what is left. It used to be reported as an unsupported
  // "or" alternative, which sent a student reading about an ISCN feature she had never
  // used, over a character she had not meant to type.
  const m = ISCN.parse('46,XY,der(13;14)(q10;q10) %14');
  assert.match(m.warnings.join(' '), /“%” is not a character ISCN uses/);
  assert.ok(m.suggestion && m.suggestion.indexOf('%') < 0, 'and the repair drops it');
  // Every mark that IS on the list survives, including the ones that look unusual.
  ['46,XY,+21×2', '45~48,XX,+8[cp10]', '46,XX,del(1)(q21~24)', '45<2n>,XY,-21',
    '46,XX,t(9;22)(q34;q11.2)', '47,XX,+21[20]', '46,XY,del(5)(p15.2)']
    .forEach((k) => assert.equal(ISCN.parse(k).warnings.filter(
      (w) => /is not a character ISCN uses/.test(w)).length, 0, k));
});
