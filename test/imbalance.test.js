'use strict';
// The net-imbalance table (Dan, 2026-08-30): per-segment copy number computed
// from the very segment lists the figure is drawn from (buildInstance), so the
// table and the karyogram cannot disagree. Runs are maximal intervals of
// constant copy number; edges carry the TYPED band names (a break "at 8q22"
// resolves to the band midpoint internally, and the table must speak the
// notation's language, not expose the resolution). The mock this encodes is
// Dan's: for 45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12) the table
// reads 8p nullisomic, proximal 8q balanced, 8q22-q24.1 monosomic, distal 8q
// nullisomic (MYC territory), distal 9q trisomic.
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

const dosage = (k, ci) => Karyo.computeDosage(ISCN.parse(k).clones[ci || 0]);
const chromOf = (d, c) => d.chroms.find((x) => x.chrom === c);
const runRows = (d, c) => chromOf(d, c).runs.map((r) => [r.fromLabel, r.toLabel, r.copies].join(' '));

test('the der(8;8) worked example partitions exactly as the mock says', () => {
  const d = dosage('45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
  // .join, not deepEqual: the modules run in a vm realm, so their arrays fail
  // deepStrictEqual's prototype check (see parser.test.js's note on this).
  assert.equal(runRows(d, '8').join(' | '),
    'pter q10 0 | q10 q22 2 | q22 q24.1 1 | q24.1 qter 0');
  assert.equal(runRows(d, '9').join(' | '), 'pter q12 2 | q12 qter 3');
  assert.equal(chromOf(d, '8').baseline, 2);
  // Sizes come out of the same positions the figure uses.
  const distal8 = chromOf(d, '8').runs[3];
  assert.ok((distal8.to - distal8.from) / 1e6 > 20, 'distal 8q is a real segment, not a sliver');
});

test('a balanced translocation has no imbalanced run anywhere', () => {
  const d = dosage('46,XY,t(9;22)(q34;q11.2)');
  d.chroms.forEach((c) => {
    if (c.baseline == null) return;
    c.runs.forEach((r) => assert.equal(r.copies, c.baseline, c.chrom + ' stays balanced'));
  });
});

test('a whole-chromosome gain is one run at three copies', () => {
  const d = dosage('47,XX,+21');
  assert.equal(runRows(d, '21').join(' | '), 'pter qter 3');
});

test('i(X) states the imbalance ISCN states: one Xp, three Xq', () => {
  // ISCN 2024 5.5.11 ii: 46,X,i(X)(q10) "is unbalanced as there is a single
  // copy of the short arm of the X chromosome and three copies of the long arm".
  const d = dosage('46,X,i(X)(q10)');
  assert.equal(chromOf(d, 'X').baseline, 2, 'no Y material, so the X baseline is two');
  assert.equal(runRows(d, 'X').join(' | '), 'pter q10 1 | q10 qter 3');
});

test('a male X keeps its baseline of one', () => {
  const d = dosage('46,XY,del(5)(p15.2)');
  assert.equal(chromOf(d, 'X').baseline, 1);
  assert.equal(chromOf(d, 'X').runs[0].copies, 1, 'one X is balanced in this cell');
});

test('marker material of unknown origin is excluded, and says so', () => {
  const d = dosage('47,XX,+mar');
  assert.equal(d.unknownExcluded, true);
  // The dmin stand-in body must never leak into a real chromosome's count.
  const d2 = dosage('46,XY,3dmin');
  assert.equal(d2.unknownExcluded, true);
  const c21 = chromOf(d2, '21');
  assert.ok(c21.runs.every((r) => r.copies === 2), 'the dmin stand-in never counts as chromosome 21');
});

test('each clone of a mosaic gets its own dosage', () => {
  const k = '45,X[12]/46,XX[18]';
  const d0 = dosage(k, 0), d1 = dosage(k, 1);
  assert.equal(runRows(d0, 'X').join(' | '), 'pter qter 1');
  assert.equal(runRows(d1, 'X').join(' | '), 'pter qter 2');
});

// ---- the cancer-gene layer --------------------------------------------------

test('every curated cancer gene resolves to a real band', () => {
  assert.ok(Teach.CANCER_GENES.length >= 35, 'the list covers the classic cytogenetics genes');
  for (const g of Teach.CANCER_GENES) {
    const r = Karyo.resolveBand(g.c, g.b);
    assert.ok(r && r.mid > 0, `${g.g} at ${g.c}${g.b} resolves`);
  }
});

test('MYC sits in the nullisomic distal 8q run, ABL1 in the trisomic 9q run', () => {
  const d = dosage('45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
  const inRun = (run, chrom) => Teach.CANCER_GENES.filter((g) => {
    if (g.c !== chrom) return false;
    const r = Karyo.resolveBand(g.c, g.b);
    return r && r.mid >= run.from && r.mid < run.to;
  }).map((g) => g.g);
  assert.ok(inRun(chromOf(d, '8').runs[3], '8').includes('MYC'));
  assert.ok(inRun(chromOf(d, '9').runs[1], '9').includes('ABL1'));
});
