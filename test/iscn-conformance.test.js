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
  ['45<2n>,XY,-21'].forEach((k) => assert.equal(refused(k), false, k));
  // The stated level is now BELIEVED rather than inferred from the count, which is
  // what fixed the polyploid examples above: 81<3n> allocates three of each autosome
  // and its tally comes out right. The consequence is that 46<3n>,XY, which states a
  // triploid baseline and then lists nothing, is answered by the ordinary count check
  // ("you wrote 46; 66 autosomes and 2 sex chromosomes come to 68") rather than by a
  // hand-rolled rule about ploidy. That is the honest way to reach it.
  assert.match(ISCN.parse('46<3n>,XY').warnings.join(' '), /says 46, but 66 autosomes/);
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

test('an acquired sex chromosome loss is not counted twice', () => {
  // ISCN 5.3.1.2, all ten examples. The governing sentence is in ix: "an acquired
  // abnormality is presented in relation to the constitutional karyotype". So when the
  // sex field carries c it IS the constitutional complement and the change applies on
  // top of it; without the c the field is what was actually seen, and a stated LOSS has
  // already happened to it. A gain is additive either way.
  //
  // 45,X,-Y is acquired loss of the Y, among the commonest karyotypes in myeloid
  // disease, and it was being called a count error.
  [['46,Xc,+X', 46], ['45,X,-X', 45], ['44,Xc,-X', 44], ['45,X,-Y', 45], ['45,Y,-X', 45],
    ['47,XX,+X', 47], ['48,XY,+X,+Y', 48], ['48,XXYc,+X', 48], ['46,XXYc,-X', 46],
    ['46,Xc,+21', 46]].forEach(([k, n]) => {
    const c = ISCN.parse(k).clones[0];
    assert.equal(c.counts.actual, n, `${k}: the changes come to ${n}`);
    assert.equal(c.countWrong, false, `${k} is printed in ISCN 5.3.1.2`);
  });
});

test('the sex field is the baseline when it is not this clone\'s own', () => {
  // A subclone written 45,idem,-X states no sex field and inherits the stemline's,
  // which is a baseline rather than an observation of this clone, so there the loss
  // does apply. Scoping the rule to clones that state their own field is what keeps
  // both readings right.
  assert.equal(refused('46,XX,t(8;21)(q22;q22)[12]/45,idem,-X[19]/46,idem,-X,+8[5]'), false);
  assert.equal(ISCN.parse('45,X,-X').clones[0].sexGiven, 'X', 'this one states its own');
  assert.equal(ISCN.parse('46,XX,t(8;21)(q22;q22)[12]/45,idem,-X[19]').clones[1].sexGiven, '',
    'and this one does not');
});

test('c on the sex complement marks the whole complement', () => {
  // ISCN 4.2.1 e and 5.3.1.2 viii: "the letter c for the constitutional anomaly refers
  // to the whole sex complement". It was being refused as a stray letter in the field.
  const c = ISCN.parse('48,XXYc,+X').clones[0];
  assert.equal(c.sex.label, 'XXY', 'the c is not part of the complement');
  assert.equal(c.sex.constitutional, true, 'but it is remembered, because it changes the arithmetic');
  assert.equal(c.sex.dropped.length, 0, 'and nothing was silently discarded from the field');
  // 5.3.1.2 x: a question mark where it is unclear whether the complement is
  // constitutional or acquired.
  assert.equal(refused('47,XXX?c'), false);
  // A stray letter that is NOT this is still refused.
  assert.equal(refused('46,XZY'), true);
  assert.equal(refused('46,QQ'), true);
});

test('notation the app cannot draw is not called a mistake', () => {
  // The worst error this app can make, and it was making it: rec, ider, tas, trc, fis
  // and qdp are all in ISCN's symbol list (Chapter 3), and the app said each was "not
  // an ISCN abbreviation" — asserting something false about the standard, in the one
  // place a student came to check themselves against it.
  [['46,XX,rec(2)dup(2p)inv(2)(p21q31)', /recombinant chromosome/],
    ['46,XX,ider(22)(q10)t(9;22)(q34;q11.2)', /isoderivative/],
    ['46,XX,tas(12;13)(q24.3;q34)', /telomeric association/],
    ['44,XX,trc(4;12;9)(q31.2;q22p13;q34)', /tricentric/],
    ['47,XY,-10,+fis(10)(p10),+fis(10)(q10)', /fission at the centromere/],
    ['46,XX,qdp(1)(q23q32)', /quadruplication/]].forEach(([k, re]) => {
    const w = ISCN.parse(k).warnings.join(' ');
    assert.match(w, /is correct ISCN/, `${k}: says so plainly`);
    assert.match(w, re, `${k}: names what it is`);
    assert.match(w, /ISCN 5\.5\./, `${k}: cites the section so it can be looked up`);
    assert.doesNotMatch(w, /is not an ISCN abbreviation/, `${k}: and never the opposite`);
  });
  // Something that really is not ISCN still gets told so.
  const junk = ISCN.parse('46,XY,zzz(9)(q34)').warnings.join(' ');
  assert.match(junk, /is not an ISCN abbreviation/);
  assert.doesNotMatch(junk, /is correct ISCN/);
});

test('a repeated gain is how ISCN writes two extra copies', () => {
  // 6.3.7 f prints a triploid clone carrying +X five times and +14 three times. The
  // "written once with a multiplier" rule was accusing it of a mistake. That rule is
  // about a STRUCTURAL change repeated instead of written x2, which is a different
  // thing, so gains and losses are exempt.
  ['81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21', '48,XX,+21,+21', '44,XY,-7,-7']
    .forEach((k) => assert.equal(
      ISCN.parse(k).warnings.filter((w) => /multiplier/.test(w)).length, 0, k));
  assert.match(ISCN.parse('46,XY,del(5)(p15.2),del(5)(p15.2)').warnings.join(' '), /multiplier/,
    'a structural change repeated is still worth saying');
});

test('a composite karyotype is not held to its own count', () => {
  // ISCN 6.3.5: in a cp karyotype the changes listed are the union across cells and no
  // single cell carried all of them, so the modal number and the tally describe
  // different things. 48,XX,+7,+9,+11,+13[cp5] is ISCN's own example and the app was
  // announcing that it came to 50. The same exemption inc has, for the same reason.
  ['48,XX,+7,+9,+11,+13[cp5]', '43~46,XX,-7,+8[cp4]', '47,XY,+8[cp10]']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].countWrong, false, k));
  // A plain clone is still checked.
  assert.equal(ISCN.parse('47,XX,+21,+21').clones[0].countWrong, true);
});

test('near-haploid and polyploid clones are counted against the right baseline', () => {
  // 26,X,+4,+6,+21 is near-haploid ALL, printed in ISCN. Read as diploid it produced
  // "you wrote 26 but the changes add up to 48", which is the app stating its own
  // wrong arithmetic as the reader's error.
  [['26,X,+4,+6,+21', 1], ['46,XY', 2], ['69,XXX', 3], ['92,XXYY', 4],
    ['81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21', 3],
    ['58<2n>,XY,+X,+4,+6,+8,+9,+10,+14,+14,+17,+18,+21,+21', 2]].forEach(([k, n]) => {
    const c = ISCN.parse(k).clones[0];
    assert.equal(c.ploidy, n, `${k} is ${n}n`);
    assert.equal(c.countWrong, false, `${k} counts up against that baseline`);
  });
});
