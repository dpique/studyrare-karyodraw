'use strict';
// A translocation between the two HOMOLOGS of one pair produces two derivatives
// that are complements of each other, never twins. One keeps the centromere of
// the homolog that broke on p and carries the other's distal q; the other keeps
// the centromere of the homolog that broke on q and carries the first's distal
// p. ISCN 2024 prints exactly that pair for 46,XX,der(1)t(1;1)(p31;q32), listing
// both readings side by side, 1pter→1q32::1p31→1pter and 1qter→1q32::1p31→1qter
// (both are in test/iscn-2024-detailed.js).
//
// The app drew ONE of them twice. translocationSegments located the derivative's
// own chromosome with chroms.indexOf(primary), and indexOf returns the FIRST
// match, so for t(N;N) both instances resolved to the same index, took the same
// keep band and the same donor band, and serialised identically. Reported from
// the banding page on 2026-09-08 against 46,XX,t(16;16)(p13;q22): "the derivative
// 16s are the same but should look different".
//
// The figure was the visible half. computeDosage reads the same segment lists, so
// the net-imbalance table turned a balanced exchange into a claim of nullisomy:
// t(16;16)(p13;q22) read 0 copies of 16pter→p13 and 4 copies of 16q22→qter, and
// t(3;3)(q21.3;q26.2) read 0 copies of a 30 Mb interval of 3q. A wrong picture
// invites a second look; a wrong copy number states a finding.
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

// The detailed form (ISCN 5.4.2.2) of every abnormal chromosome the app builds,
// sorted, because the pair is a set: which derivative is drawn first is a layout
// decision, and that the two differ is the claim under test.
function detailedForms(k) {
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
  return out.sort();
}

const dosage = (k) => Karyo.computeDosage(ISCN.parse(k).clones[0]);

// Every run on every chromosome sits at its own baseline, which is what balanced
// means. Reported as a list so a failure names the offending segment.
function imbalancedRuns(k) {
  const bad = [];
  dosage(k).chroms.forEach((c) => {
    if (c.baseline == null) return;
    c.runs.forEach((r) => {
      if (r.copies !== c.baseline) {
        bad.push(c.chrom + ' ' + r.fromLabel + '→' + r.toLabel + ' ' + r.copies + ' copies');
      }
    });
  });
  return bad;
}

test('t(16;16)(p13;q22) builds two complementary derivatives, not one drawn twice', () => {
  // The CBFB::MYH11 rearrangement of AML M4Eo, the karyotype the report came in on.
  // Breaks on opposite arms, so one derivative gains distal 16q against a lost 16p
  // tip and the other is its mirror.
  assert.deepEqual(detailedForms('46,XX,t(16;16)(p13;q22)'), [
    '16pter→16q22::16p13→16pter',
    '16qter→16q22::16p13→16qter',
  ]);
});

test('t(3;3)(q21.3;q26.2) builds two complementary derivatives when both breaks are on q', () => {
  // The MECOM rearrangement of AML. Both breaks on the long arm, so one derivative
  // deletes the interval between them and the other duplicates it. Drawing the
  // deleting one twice is what produced the false nullisomy.
  assert.deepEqual(detailedForms('46,XY,t(3;3)(q21.3;q26.2)'), [
    '3pter→3q21.3::3q26.2→3qter',
    '3pter→3q26.2::3q21.3→3qter',
  ]);
});

test('t(9;9)(q34;q11) builds two complementary derivatives across a pericentromeric break', () => {
  // The stress corpus has carried this one since the homologous exchange was
  // accepted (2026-08-29), with "two different derivative 9s" written in its watch
  // note. The note was prose; nothing asserted it.
  assert.deepEqual(detailedForms('46,XY,t(9;9)(q34;q11)'), [
    '9pter→9q11::9q34→9qter',
    '9pter→9q34::9q11→9qter',
  ]);
});

test('a homologous translocation is balanced, so no segment leaves its baseline', () => {
  // The reciprocal exchange moves material between homologs and creates none and
  // destroys none. Every band stays at two copies, exactly as for t(9;22).
  for (const k of ['46,XX,t(16;16)(p13;q22)', '46,XY,t(3;3)(q21.3;q26.2)', '46,XY,t(9;9)(q34;q11)']) {
    assert.deepEqual(imbalancedRuns(k), [], k + ' is balanced');
  }
});

test('the imbalance table still segments 16 at both breakpoints, at two copies each', () => {
  // The table lists every segment of an involved chromosome with its dosage,
  // balanced or not (index.html), so the breakpoint boundaries survive even where
  // the copy number does not change across them, exactly as t(9;22) reads
  // "pter q34 2 | q34 qter 2". The claim under test is that the three segments the
  // two breaks create all sit at two copies: the row that used to read 0 and the
  // row that used to read 4 are still rows, and they are now correct.
  const c16 = dosage('46,XX,t(16;16)(p13;q22)').chroms.find((x) => x.chrom === '16');
  assert.equal(c16.baseline, 2);
  assert.equal(c16.runs.map((r) => [r.fromLabel, r.toLabel, r.copies].join(' ')).join(' | '),
    'pter p13 2 | p13 q22 2 | q22 qter 2');
});
