'use strict';
// What HAPPENED to a segment, beside how many copies of it there are.
//
// On a balanced rearrangement the copies column reads two on every row, so it
// tells a reader only that the arithmetic was checked. Dan, looking at the middle
// row of t(16;16)(p13.2;q22) on 2026-09-08: "this row is that neccessary? cause it
// is not involved in the translocation, this translocation i tihnk only involves
// terminal ends???"
//
// He is right about the biology and the row still has to stay, because the same
// row carries the whole finding for an interstitial deletion or duplication
// (del(5)(q13q33) is one copy there, dup(1)(q22q25) is three). What was missing is
// not fewer rows but the distinction between them: which segments moved.
//
// computeDosage now carries that through from the segment lists the figure is
// drawn from. exchanged is a piece that crossed to the other chromosome, the same
// graft flag the dashed junction seam reads. inverted is a span turned end for
// end. A segment that merely sat between two breakpoints gets neither, which is
// the honest answer and the one that makes a marked row mean something.
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

// Every structural chromosome's runs as "chrom from→to copies flags".
function runs(k) {
  const d = Karyo.computeDosage(ISCN.parse(k).clones[0]);
  const out = [];
  d.chroms.filter((c) => c.structural).forEach((c) => c.runs.forEach((r) => {
    out.push([c.chrom + r.fromLabel + '→' + c.chrom + r.toLabel, r.copies,
      r.exchanged ? 'exchanged' : (r.inverted ? 'inverted' : '-')].join(' '));
  }));
  return out;
}

test('a translocation exchanges its tips and leaves the middle alone', () => {
  // Exactly the reading Dan gave: only the terminal ends take part. The middle
  // segment is cut on both sides and stays on its own homolog, so it is measured
  // and not marked.
  assert.deepEqual(runs('46,XX,t(16;16)(p13.1;q22)'), [
    '16pter→16p13.1 2 exchanged',
    '16p13.1→16q22 2 -',
    '16q22→16qter 2 exchanged',
  ]);
});

test('an inversion turns the middle over and leaves the tips alone', () => {
  // The mirror image of the translocation, on the same two breakpoints. Same
  // notation distance apart, opposite answer, which is the reason to say it.
  assert.deepEqual(runs('46,XY,inv(16)(p13.1q22)'), [
    '16pter→16p13.1 2 -',
    '16p13.1→16q22 2 inverted',
    '16q22→16qter 2 -',
  ]);
  assert.deepEqual(runs('46,XY,inv(9)(p11q13)'), [
    '9pter→9p11 2 -',
    '9p11→9q13 2 inverted',
    '9q13→9qter 2 -',
  ]);
});

test('a translocation between two DIFFERENT chromosomes marks the same way', () => {
  assert.deepEqual(runs('46,XY,t(9;22)(q34;q11.2)'), [
    '9pter→9q34 2 -',
    '9q34→9qter 2 exchanged',
    '22pter→22q11.2 2 -',
    '22q11.2→22qter 2 exchanged',
  ]);
});

test('a grafted piece drawn end-for-end is not called inverted', () => {
  // translocationSegments turns a donated piece so its broken end faces the
  // junction. That is how the join is drawn, not a second rearrangement, and
  // reading it as an inversion labelled both exchanged tips of t(16;16) inverted,
  // which teaches a reciprocal translocation as an inversion.
  const d = Karyo.computeDosage(ISCN.parse('46,XX,t(16;16)(p13.1;q22)').clones[0]);
  const c16 = d.chroms.find((x) => x.chrom === '16');
  assert.equal(c16.runs.some((r) => r.inverted), false, 'nothing here is inverted');
  assert.equal(c16.runs.filter((r) => r.exchanged).length, 2, 'both tips are exchanged');
});

test('an unbalanced rearrangement keeps its copy numbers exactly as before', () => {
  // The flags are additive. Nothing about the existing partition may shift.
  assert.deepEqual(runs('46,XX,del(5)(q13q33)'),
    ['5pter→5q13 2 -', '5q13→5q33 1 -', '5q33→5qter 2 -']);
  assert.deepEqual(runs('46,XX,dup(1)(q22q25)'),
    ['1pter→1q22 2 -', '1q22→1q25 3 -', '1q25→1qter 2 -']);
});

test('the typed breakpoints come back with the dosage, in order', () => {
  // What the gene layer needs in order to answer "what sits AT the break".
  // .join, not deepEqual: the modules run in a vm realm, so their arrays fail
  // deepStrictEqual's prototype check (the same note imbalance.test.js carries).
  const bands = (k, c) => Karyo.computeDosage(ISCN.parse(k).clones[0])
    .chroms.find((x) => x.chrom === c).breakpoints.map((b) => b.band).join(',');
  assert.equal(bands('46,XX,t(16;16)(p13.1;q22)', '16'), 'p13.1,q22');
  assert.equal(bands('46,XY,t(9;22)(q34;q11.2)', '9'), 'q34');
  assert.equal(bands('46,XY,t(9;22)(q34;q11.2)', '22'), 'q11.2');
});

test('the genes behind the breakpoint layer are on the map', () => {
  // The band each one resolves to has to overlap the band the break is written at,
  // which is what the table's lookup tests. MYH11 sits at p13.11, inside the p13.1
  // a break is written at, so a midpoint test would have missed it.
  const byName = {};
  win.Teach.CANCER_GENES.forEach((g) => { byName[g.g] = g; });
  for (const [gene, chrom] of [['CBFB', '16'], ['MYH11', '16'], ['MECOM', '3'], ['GATA2', '3']]) {
    assert.ok(byName[gene], gene + ' is in the cancer-gene list');
    assert.equal(byName[gene].c, chrom);
    assert.ok(Karyo.resolveBand(chrom, byName[gene].b), gene + ' resolves to a real band');
  }
  const bp = Karyo.resolveBand('16', 'p13.1');
  const myh11 = Karyo.resolveBand('16', byName.MYH11.b);
  assert.ok(myh11.start < bp.end && myh11.end > bp.start, 'MYH11 overlaps the p13.1 break');
});
