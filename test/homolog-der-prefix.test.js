'use strict';
// ISCN 5.4.2.2 b puts the chromosome number on every band when the rearrangement
// involves more than one chromosome, and 5.5.4 f i says what "more than one" means
// where it is easy to get wrong: dic(13;13) prefixes every band, because two
// chromosome 13 HOMOLOGS went into it, even though every segment says 13. Two
// chromosomes were involved; that there is one number between them is beside the
// point.
//
// detailedForm knew that rule for an aberration that NAMES its two chromosomes
// (dic(13;13), t(16;16)) and lost it for one that names one and carries the second
// in a sub-operation. der(1)t(1;1)(p31;q32) is that shape: ab.chroms is ["1"], the
// segments all say 1, and the two homologs are recorded only inside the t. It
// serialised as qter→q32::p31→qter where ISCN prints 1qter→1q32::1p31→1qter
// (test/iscn-2024-detailed.js carries the printed string).
//
// A der whose sub-op names two DIFFERENT chromosomes was never affected: its
// segments span two numbers, so the segment test caught it and the prefix was
// already there (der(9)del(9)(p12)t(9;13)(q34;q11) prints :9p12→9q34::13q11→13qter
// and always did). The only shape that changes is a sub-op naming one chromosome
// twice, which is to say a translocation between two homologs.
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

function forms(k) {
  const out = [];
  const model = ISCN.parse(k);
  for (const clone of model.clones) {
    for (const ch of Object.keys(clone.slots || {})) {
      for (const inst of clone.slots[ch] || []) {
        if (inst.kind === 'normal') continue;
        out.push(Karyo.detailedForm(inst));
      }
    }
  }
  return out;
}

test('der(1)t(1;1) prefixes every band, because two homologs are involved', () => {
  // ISCN 2024 prints this exact string for this exact karyotype.
  assert.deepEqual(forms('46,XX,der(1)t(1;1)(p31;q32)'), ['1qter→1q32::1p31→1qter']);
});

test('a der carrying a t between two DIFFERENT chromosomes is untouched', () => {
  // Its segments already span two numbers, so the segment test had it. Pinned here
  // because it is the case the new clause must not double-count or reorder.
  assert.deepEqual(forms('46,XY,der(9)del(9)(p12)t(9;13)(q34;q11)'), [':9p12→9q34::13q11→13qter']);
});

test('a der whose sub-ops involve one chromosome stays bare', () => {
  // Nothing about these says two chromosomes, so ISCN omits the number and so do we.
  assert.deepEqual(forms('46,XY,der(9)inv(9)(p23p13)del(9)(q22q33)'),
    ['pter→p23::p13→p23::p13→q22::q33→qter']);
  assert.deepEqual(forms('46,XX,dup(1)(q22q25)'), ['pter→q25::q22→qter']);
  assert.deepEqual(forms('46,X,i(X)(q10)'), ['qter→q10::q10→qter']);
});

test('the homolog dicentric that states the rule still states it', () => {
  // ISCN 5.5.4 f i, the sentence the prefix rule is built on.
  assert.deepEqual(forms('45,XX,dic(13;13)(q14;q32)'), ['13pter→13q14::13q32→13pter']);
});

test('t(1;1) written as the translocation prefixes both derivatives', () => {
  // The same event spelled as the t rather than as one der. Both derivatives come
  // out, and ISCN's two printed readings of der(1)t(1;1)(p31;q32) are exactly this
  // pair, which is what makes them the oracle for the der() spelling.
  assert.deepEqual(forms('46,XX,t(1;1)(p31;q32)').sort(),
    ['1pter→1q32::1p31→1pter', '1qter→1q32::1p31→1qter']);
});
