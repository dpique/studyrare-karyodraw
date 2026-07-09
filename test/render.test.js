'use strict';
// Render tests for the karyogram renderer (karyo-render.js). Like the parser it
// is a browser IIFE; here it is loaded (after its ideogram-data dependency) into a
// minimal window shim with the vm module so buildInstance can be exercised under
// `node --test` with no dependencies. These pin the duplication geometry: a dup
// lengthens the chromosome, and breakpoint order controls direct vs inverted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
load('ideogram-data.js');
load('iscn-parser.js');
load('karyo-render.js');
const Karyo = win.Karyo;
const ISCN = win.ISCN;
const IDEO = win.IDEOGRAM;

const inst = (kind, chrom, bands, label) => ({ chrom, kind, aberration: { breakpoints: [bands] }, label: label || kind });
const totalBp = (segs) => segs.reduce((s, g) => s + (g.to - g.from), 0);
// The realistic path: parse a karyotype, then pull the derivative instance the
// parser built (with chroms/primary/subOps set) for a given chromosome slot.
const derInst = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal');
const built = (k, chrom) => Karyo.buildInstance(derInst(k, chrom));

test('render module loads', () => {
  assert.equal(typeof Karyo.buildInstance, 'function');
});

test('duplication lengthens the chromosome and splices in a copy', () => {
  const normal = IDEO.data['1'].length;
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'], 'dup(1)(q22q25)'));
  assert.ok(built.segments.length > 1, 'segments are spliced, not a single full chromosome');
  assert.ok(totalBp(built.segments) > normal, 'total length grows beyond the normal chromosome');
});

test('direct duplication keeps the copy in the same orientation', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 0, 'no reversed segment for a direct dup');
});

test('inverted duplication (distal-first) mirrors the copy', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q25', 'q22']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 1, 'exactly one reversed (mirrored) copy');
  assert.ok(totalBp(built.segments) > IDEO.data['1'].length, 'still lengthens the chromosome');
});

test('triplication adds two copies (grows more than a duplication)', () => {
  const normal = IDEO.data['1'].length;
  const dupGrew = totalBp(Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'])).segments) - normal;
  const trpGrew = totalBp(Karyo.buildInstance(inst('trp', '1', ['q22', 'q25'])).segments) - normal;
  assert.ok(trpGrew > dupGrew * 1.5, 'triplication adds about twice the material of a duplication');
});

test('dup overlay shades the appended copy (by segment index)', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.ok(built.overlays.length >= 1);
  assert.ok(built.overlays.every((o) => o.type === 'dup' && o.segIndex != null), 'overlay targets a copy segment');
});

test('a dup renders to SVG without error', () => {
  const out = Karyo.drawInstance(inst('dup', '1', ['q22', 'q25']), { theme: 'detailed', level: 1, affected: {} });
  assert.match(JSON.stringify(out), /<svg/);
});

// --- Insertions: the recipient grows with donor material, the donor shrinks ---
test('interchromosomal insertion puts donor material on the recipient', () => {
  const recip = built('46,XY,ins(5;2)(p14;q22q32)', '5');
  assert.ok(recip.segments.some((s) => s.chrom === '2'), 'der(5) carries a piece of chromosome 2');
  assert.ok(totalBp(recip.segments) > IDEO.data['5'].length, 'recipient chromosome is longer');
});

test('interchromosomal insertion shortens the donor chromosome', () => {
  const donor = built('46,XY,ins(5;2)(p14;q22q32)', '2');
  assert.ok(donor.segments.every((s) => s.chrom === '2'), 'donor is still made only of its own material');
  assert.ok(totalBp(donor.segments) < IDEO.data['2'].length, 'donor lost the excised segment');
});

test('intrachromosomal insertion is length-preserving but rearranged', () => {
  const b = built('46,XX,ins(2)(p13q21q31)', '2');
  assert.ok(b.segments.length >= 3, 'chromosome is split into several pieces');
  const delta = Math.abs(totalBp(b.segments) - IDEO.data['2'].length);
  assert.ok(delta < 2e6, 'total length is essentially unchanged (balanced move)');
});

test('an insertion no longer draws as an untouched normal chromosome', () => {
  const b = built('46,XY,ins(5;2)(p14;q22q32)', '5');
  const isPlainFull = b.segments.length === 1 && b.segments[0].from === 0 && b.segments[0].to === IDEO.data['5'].length;
  assert.ok(!isPlainFull, 'insertion recipient is not a single full-length chromosome');
});

// --- Isodicentric: a single chromosome mirrored about its breakpoint ---------
test('isodicentric idic(X) draws two centric mirror halves', () => {
  const b = built('46,X,idic(X)(q13)', 'X');
  assert.equal(b.segments.length, 2, 'two arms');
  assert.ok(b.segments.every((s) => s.chrom === 'X' && s.hasCen), 'both halves keep an X centromere');
  assert.equal(b.segments.filter((s) => s.reversed).length, 1, 'one half is the mirror image');
});

// --- Dicentric of two chromosomes: one fused body with two centromeres -------
test('dicentric dic(13;14) is a single fused chromosome with two centromeres', () => {
  const b = built('45,XY,dic(13;14)(q13;q22)', '13');
  assert.equal(b.segments.length, 2, 'two fused pieces');
  const chroms = b.segments.map((s) => s.chrom).sort();
  assert.equal(chroms.join(','), '13,14', 'one piece from each chromosome');
  assert.ok(b.segments.every((s) => s.hasCen), 'both centromeres are retained (dicentric)');
});

// --- der() sub-op chains: the extra del/dup is applied, not dropped ----------
test('der(9)del(9)(p12)t(9;22) applies the deletion to the derivative', () => {
  const b = built('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)', '9');
  const nine = b.segments.find((s) => s.chrom === '9');
  assert.ok(nine, 'der(9) still carries chromosome 9 material');
  assert.ok(nine.from > 0, 'the p12 terminal deletion trimmed the 9p end (segment no longer starts at pter)');
  assert.ok(b.segments.some((s) => s.chrom === '22'), 'the t(9;22) junction is still present');
});
