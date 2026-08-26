'use strict';
// rec, a recombinant chromosome (ISCN 2024 §5.4.3.2, §5.5.15).
//
// This is the chromosome a carrier of a PERICENTRIC inversion passes on when a
// crossover falls inside the inversion loop at meiosis I. ISCN states only the
// duplication and leaves the deletion to be inferred (§5.4.3.2 c: "In a
// recombinant chromosome (rec) there is a duplication and deletion of material.
// In the ISCN description the duplication (dup) is explicitly stated, and the
// deletion is inferred."). A reader who is only told what the string says is
// therefore told half the imbalance, and it is the half that does not cause the
// miscarriage. So the decode must name both, and the figure must draw both.
//
// The geometry is fixed by ISCN's own detailed form, §5.5.15 d i:
//   46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat
//   = 46,XX,rec(6)(pter→q25.2::p22.2→pter)dmat
// Read that literally: one piece runs 6pter through the centromere to 6q25.2,
// and a second piece runs 6p22.2 back out to 6pter. So the p-distal segment is
// present TWICE (the second copy end-for-end) and everything distal to the q
// breakpoint is gone. Thompson & Thompson 9th ed, Fig 5.12B, draws the same
// chromosome as A-B-C-A.
//
// A PARACENTRIC inversion does not make this chromosome. A crossover inside a
// paracentric loop yields an acentric fragment and a dicentric (T&T Fig 5.12A),
// which is why rec is refused there rather than drawn with a guessed shape.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
for (const f of ['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
}
const { ISCN, Karyo, Teach } = win;

const clone0 = (s) => ISCN.parse(s).clones[0];
const warns = (s) => ISCN.parse(s).warnings;
// The rec instance the complement built, as the renderer will receive it.
function recInstance(k) {
  const c = clone0(k);
  for (const chrom of Object.keys(c.slots)) {
    const hit = (c.slots[chrom] || []).find((i) => i.kind === 'rec');
    if (hit) return hit;
  }
  return null;
}
const mid = (chrom, band) => Karyo.resolveBand(chrom, band).mid;
const decodeText = (k) => Teach.decode(clone0(k)).map((r) => r.text).join(' ');

// ---- parsing -------------------------------------------------------------

test('rec parses as its own kind, keeping the inversion it came from', () => {
  const c = clone0('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat');
  assert.equal(c.aberrations.map((a) => a.kind).join(), 'rec');
  const ab = c.aberrations[0];
  assert.equal(ab.chroms.join(), '2', 'rec(2) names the chromosome whose centromere it carries');
  assert.equal(ab.recDupArm, 'p', 'dup(2p) says the SHORT arm is the duplicated one');
  assert.equal(ab.recInvBands.join(), 'p21,q31', 'the parental inversion breakpoints are kept');
});

// ISCN 4.2.1 g: dmat / dpat / dinh mark a PART of a parental rearrangement, the
// recombinant, not the balanced inversion the parent carries. Every rec example
// in ISCN carries one, so refusing them refuses every rec in the standard.
test('dmat, dpat, dinh and inh are read as qualifiers (ISCN 4.2.1 g)', () => {
  for (const [k, q] of [
    ['46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', 'dmat'],
    ['46,XX,rec(2)dup(2p)inv(2)(p21q31)dpat', 'dpat'],
    ['46,XX,rec(2)dup(2p)inv(2)(p21q31)dinh', 'dinh'],
    ['46,XX,t(5;6)(q34;q23)inh', 'inh'],
  ]) {
    const c = clone0(k);
    assert.equal(c.aberrations[0].qualifier, q, k);
    assert.equal(warns(k).join(' '), '', `${k} is correct ISCN and must not warn`);
  }
});

// The bare mat/pat/dn forms must keep working: dmat ends in "mat", so a regex
// that reaches for the shorter alternative first would swallow the d and leave
// an unparsed "…)d" behind.
test('the plain mat, pat, dn and c qualifiers still parse', () => {
  assert.equal(clone0('46,XX,t(5;6)(q34;q23)mat').aberrations[0].qualifier, 'mat');
  assert.equal(clone0('46,XX,inv(14)(q12q31)pat').aberrations[0].qualifier, 'pat');
  assert.equal(clone0('46,XY,t(5;6)(q34;q23)dn').aberrations[0].qualifier, 'dn');
  assert.equal(clone0('48,XX,+8,+21c').aberrations[1].qualifier, 'c');
});

// A rec replaces one homolog. It is not signed and does not change the count,
// so 46 must stay 46, the same accounting del/dup/inv already get.
test('a rec keeps the chromosome count and draws with zero warnings', () => {
  for (const k of [
    '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat',
    '46,XX,rec(2)dup(2q)inv(2)(p21q31)dmat',
    '46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat',
    '46,XY,rec(4)dup(4p)inv(4)(p16.1q34)dmat',
    '46,XY,rec(18)dup(18q)inv(18)(p11.32q21)dpat',
  ]) {
    const c = clone0(k);
    assert.equal(warns(k).join(' '), '', `${k} is verbatim ISCN and must draw clean`);
    const total = Object.keys(c.complement).reduce((s, x) => s + c.complement[x], 0);
    assert.equal(total, 46, `${k} still describes 46 chromosomes`);
    const recs = Object.keys(c.slots)
      .reduce((n, x) => n + c.slots[x].filter((i) => i.kind === 'rec').length, 0);
    assert.equal(recs, 1, `${k} builds exactly one rec`);
  }
});

// ---- geometry ------------------------------------------------------------

// ISCN §5.5.15 d i, spelled out: pter→q25.2 :: p22.2→pter.
test('rec(6)dup(6p) draws pter→q25.2 joined to an inverted p22.2→pter', () => {
  const built = Karyo.buildInstance(recInstance('46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat'));
  const s = built.segments;
  assert.equal(s.length, 2, 'two pieces, as the detailed form has two');
  assert.deepEqual(
    { from: s[0].from, to: s[0].to, reversed: s[0].reversed, hasCen: s[0].hasCen },
    { from: 0, to: mid('6', 'q25.2'), reversed: false, hasCen: true },
    'first piece: 6pter through the centromere to 6q25.2');
  assert.deepEqual(
    { from: s[1].from, to: s[1].to, reversed: s[1].reversed, hasCen: s[1].hasCen },
    { from: 0, to: mid('6', 'p22.2'), reversed: true, hasCen: false },
    'second piece: the p-distal segment again, end-for-end');
  assert.ok(s.every((g) => g.chrom === '6'), 'all material is chromosome 6');
});

// The mirror case. ISCN §5.4.3.2 d ii states the meaning outright: "duplication
// from 2q31 to 2qter and deletion from 2pter to 2p21".
test('rec(2)dup(2q) duplicates the q-distal segment and deletes the p-distal one', () => {
  const built = Karyo.buildInstance(recInstance('46,XX,rec(2)dup(2q)inv(2)(p21q31)dmat'));
  const s = built.segments;
  const qter = win.IDEOGRAM.data['2'].length;
  assert.equal(s.length, 2);
  // Top piece: the extra copy of the q-distal segment, flipped so qter leads.
  assert.deepEqual(
    { from: s[0].from, to: s[0].to, reversed: s[0].reversed, hasCen: s[0].hasCen },
    { from: mid('2', 'q31'), to: qter, reversed: true, hasCen: false },
    'the extra copy of 2q31→2qter, end-for-end and carrying no centromere');
  // Bottom piece: p21 through the centromere out to qter, with the p-distal segment gone.
  assert.deepEqual(
    { from: s[1].from, to: s[1].to, reversed: s[1].reversed, hasCen: s[1].hasCen },
    { from: mid('2', 'p21'), to: qter, reversed: false, hasCen: true },
    'the backbone begins at 2p21, so 2pter→2p21 is deleted');
});

// The land-mine invariant, asserted against the model rather than one case:
// a rec is monocentric, so no matter which arm is duplicated exactly one piece
// may claim the centromere. Two centromeres here would be the #160/#181 bug.
test('every rec is monocentric', () => {
  for (const k of [
    '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat',
    '46,XX,rec(2)dup(2q)inv(2)(p21q31)dmat',
    '46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat',
    '46,XY,rec(4)dup(4p)inv(4)(p16.1q34)dmat',
    '46,XY,rec(18)dup(18q)inv(18)(p11.32q21)dpat',
  ]) {
    const built = Karyo.buildInstance(recInstance(k));
    assert.equal(built.segments.filter((g) => g.hasCen).length, 1, `${k} has one centromere`);
  }
});

// The whole point of the chromosome: it is unbalanced. Duplicated length is the
// segment distal to one breakpoint, deleted length the segment distal to the other.
test('the drawn length equals normal, plus the duplication, minus the deletion', () => {
  const built = Karyo.buildInstance(recInstance('46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat'));
  const drawn = built.segments.reduce((s, g) => s + (g.to - g.from), 0);
  const normal = win.IDEOGRAM.data['6'].length;
  const dup = mid('6', 'p22.2');            // 6pter→6p22.2, present twice
  const del = normal - mid('6', 'q25.2');   // 6q25.2→6qter, gone
  assert.equal(drawn, normal + dup - del, 'one extra p-distal copy, one missing q-distal segment');
});

// ---- what the reader is told ---------------------------------------------

test('the decode names the inferred deletion, not only the stated duplication', () => {
  const t = decodeText('46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat');
  assert.match(t, /RECOMBINANT/i, 'the word is introduced');
  assert.match(t, /6pter.{0,4}6p22\.2|6p22\.2.{0,10}6pter/, 'the duplicated segment is named');
  assert.match(t, /6q25\.2.{0,10}6qter/, 'the deleted segment is named');
  assert.match(t, /deleti|lost|missing/i, 'the deletion is called a deletion');
  assert.match(t, /inversion/i, 'the parental inversion is named as the origin');
  assert.match(t, /inferred|not stated|only the dup/i,
    'the reader is told the deletion is inferred rather than written');
  // dmat decodes on a row of its own, so the literal suffix is the row's code chip and
  // the explanation is its text. Both still have to be there; only the shape moved.
  const q = Teach.decode(clone0('46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat')).find((r) => r.tag === 'qual');
  assert.equal(q.code, 'dmat', 'the inheritance qualifier gets its own row');
  assert.match(q.text, /maternal/i, 'and is spelled out there');
});

test('the decode says which parent carried the inversion', () => {
  assert.match(decodeText('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat'), /mother|maternal/i);
  assert.match(decodeText('46,XY,rec(18)dup(18q)inv(18)(p11.32q21)dpat'), /father|paternal/i);
});

// Dan read "this chromosome is not the parent's chromosome" as denying the
// inheritance the dmat row asserts two lines below it, and asked which was
// right. Both were, and that is the problem: a sentence a careful reader
// parses as a contradiction is wrong even when every clause is true. The
// teaching has to hold both facts in one breath: the recombinant IS inherited
// from the carrier parent, AND no body cell of that parent contains it,
// because it first exists in the gamete the crossover made (ISCN 4.2.1 g is
// the d- suffix carrying exactly this distinction).
test('the decode affirms inheritance while explaining why the parent lacks the chromosome', () => {
  const t = decodeText('46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat');
  assert.match(t, /inherited/i, 'the recombinant is stated to be inherited');
  assert.match(t, /egg or sperm|gamete/i, 'and where it first exists is stated');
  assert.ok(!/is not the parent(’|')s chromosome/i.test(t),
    'the phrasing that reads as denying inheritance is gone');
  assert.ok(!/\bhealthy\b/i.test(t), 'no absolute health claim about the carrier');
});

// ---- what is deliberately refused ----------------------------------------

// A paracentric inversion cannot give this chromosome, so drawing one would be
// inventing a shape. Refuse, and teach the reason (T&T 9th ed, Fig 5.12A).
test('a rec from a paracentric inversion is refused, and says why', () => {
  const k = '46,XX,rec(2)dup(2q)inv(2)(q21q31)dmat';
  assert.ok(warns(k).length, 'a paracentric rec is not drawn');
  assert.equal(clone0(k).aberrations[0].kind, 'unknown', 'and no shape is invented for it');
  const w = warns(k).join(' ');
  assert.match(w, /paracentric/i, 'the reason is named');
  assert.match(w, /pericentric/i, 'alongside the inversion that does produce one');
  assert.match(w, /acentric|dicentric/i, 'and what a paracentric crossover actually yields');
  assert.ok(!/not an ISCN abbreviation/.test(w), 'rec is correct ISCN and must never be called otherwise');
});

// Insertion-derived rec is real ISCN (§5.5.15 d ii, iii) and a different shape.
// It stays undrawn, but the message must say that is a gap in this app, not an
// error in the notation.
test('an insertion-derived rec is not drawn, and the message blames the app', () => {
  for (const k of [
    '46,XX,rec(21)del(21)ins(21)(p13q22.2q22.3)dpat',
    '46,XY,rec(1)dup(5q)ins(1;5)(q32;q11.2q22)dinh,der(5)ins(1;5)dinh',
  ]) {
    const w = warns(k).join(' ');
    assert.match(w, /correct ISCN/, `${k}: the notation is right`);
    assert.match(w, /insertion/i, 'and the message names the shape it cannot draw');
    assert.ok(!/not an ISCN abbreviation/.test(w));
  }
});
