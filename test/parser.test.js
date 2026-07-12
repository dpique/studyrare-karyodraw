'use strict';
// Validation tests for the ISCN parser (iscn-parser.js). The parser is a browser
// IIFE that attaches window.ISCN; we load it into a minimal window shim with the
// built-in vm module so it can be exercised under `node --test` with no deps.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'iscn-parser.js'), 'utf8'), context);
const ISCN = win.ISCN;

const clone0 = (s) => ISCN.parse(s).clones[0];
const abKinds = (c) => c.aberrations.map((a) => a.kind);
const slotKinds = (c, chrom) => (c.slots[chrom] || []).map((i) => i.kind);

test('module loads', () => {
  assert.equal(typeof ISCN.parse, 'function');
});

test('normal male 46,XY', () => {
  const c = clone0('46,XY');
  assert.equal(c.modalNumber, 46);
  assert.equal(c.sex.label, 'XY');
  assert.equal(c.aberrations.length, 0);
  assert.equal(c.counts.ok, true);
});

test('trisomy 21 — 47,XX,+21', () => {
  const c = clone0('47,XX,+21');
  assert.equal(c.complement['21'], 3);
  assert.ok(abKinds(c).includes('gain'));
  assert.equal(c.counts.ok, true); // 47 = 46 + 1
});

test('monosomy X — 45,X', () => {
  const c = clone0('45,X');
  assert.equal(c.modalNumber, 45);
  assert.equal(c.sex.label, 'X');
});

test('reciprocal translocation — 46,XY,t(9;22)(q34;q11.2)', () => {
  const c = clone0('46,XY,t(9;22)(q34;q11.2)');
  const ab = c.aberrations[0];
  assert.equal(ab.kind, 't');
  assert.equal(ab.chroms.join(','), '9,22'); // value compare (array is from the vm realm)
  assert.ok(ab.breakpoints[0].includes('q34'));
  assert.ok(slotKinds(c, '9').includes('t')); // der(9)
  assert.ok(slotKinds(c, '22').includes('t')); // der(22)
  assert.equal(c.counts.ok, true);
});

test('three-way translocation — 46,XX,t(2;7;5)(p21;q22;q23)', () => {
  const c = clone0('46,XX,t(2;7;5)(p21;q22;q23)');
  const ab = c.aberrations[0];
  assert.equal(ab.kind, 't');
  assert.equal(ab.chroms.length, 3);
  // every involved chromosome gets a derivative
  for (const chrom of ['2', '7', '5']) assert.ok(slotKinds(c, chrom).includes('t'), 'der(' + chrom + ')');
  assert.equal(c.counts.ok, true);
});

test('terminal deletion — 46,XX,del(5)(p15.2)', () => {
  const c = clone0('46,XX,del(5)(p15.2)');
  const ab = c.aberrations[0];
  assert.equal(ab.kind, 'del');
  assert.equal(ab.chroms[0], '5');
  assert.ok(ab.breakpoints[0].some((b) => b.indexOf('p15.2') === 0));
  assert.ok(slotKinds(c, '5').includes('del'));
});

test('isochromosome — 46,X,i(X)(q10)', () => {
  const c = clone0('46,X,i(X)(q10)');
  assert.ok(abKinds(c).includes('iso'));
});

test('inversion — 46,XY,inv(9)(p11q13)', () => {
  const c = clone0('46,XY,inv(9)(p11q13)');
  const ab = c.aberrations[0];
  assert.equal(ab.kind, 'inv');
  assert.equal(ab.breakpoints[0].length, 2); // two breakpoints
});

test('mosaic — mos 45,X[12]/46,XX[18]', () => {
  const r = ISCN.parse('mos 45,X[12]/46,XX[18]');
  assert.equal(r.isMosaic, true);
  assert.equal(r.clones.length, 2);
  assert.equal(r.clones[0].cellCount, 12);
  assert.equal(r.clones[1].cellCount, 18);
});

test('unreadable input fails gracefully', () => {
  const r = ISCN.parse('not a karyotype');
  assert.equal(r.ok, false);
  assert.ok(r.warnings.length > 0);
});

test('Robertsonian der(13;14) counts 45', () => {
  const c = clone0('45,XX,der(13;14)(q10;q10)');
  assert.equal(c.counts.actual, 45);
  assert.equal(c.counts.ok, true);
});

test('tetraploid 92,XXYY counts 92', () => {
  const c = clone0('92,XXYY');
  assert.equal(c.counts.actual, 92);
  assert.equal(c.counts.ok, true);
});

test('triploid 69,XXX counts 69', () => {
  const c = clone0('69,XXX');
  assert.equal(c.counts.actual, 69);
  assert.equal(c.counts.ok, true);
});

test('idic(Y) counts as a chromosome — 46,X,idic(Y)(q11)', () => {
  const c = clone0('46,X,idic(Y)(q11)');
  assert.equal(c.counts.actual, 46);
  assert.equal(c.counts.ok, true);
});

test('"or" alternative warns instead of silently dropping', () => {
  const r = ISCN.parse('46,XY,del(5)(q13q33) or del(5)(q14q34)');
  assert.ok(r.warnings.some((w) => /only the first|not understood|wasn.t understood|extra text/i.test(w)));
});

// The renderer distinguishes a direct (tandem) duplication from an inverted one
// by the ORDER of the two breakpoints, so the parser must preserve that order.
test('direct duplication preserves proximal-first breakpoint order', () => {
  const c = clone0('46,XY,dup(1)(q22q25)');
  const dup = c.aberrations.find((a) => a.kind === 'dup');
  assert.equal(dup.breakpoints[0].join(','), 'q22,q25');
});

test('inverted duplication preserves distal-first breakpoint order', () => {
  const c = clone0('46,XY,dup(1)(q25q22)');
  const dup = c.aberrations.find((a) => a.kind === 'dup');
  assert.equal(dup.breakpoints[0].join(','), 'q25,q22');
});

// --- Robertsonian "rob" keyword (the preferred ISCN spelling) ---------------
// rob(13;14)(q10;q10) is the standard way to write a Robertsonian translocation;
// it must behave exactly like the whole-arm der(13;14)(q10;q10): a single fused
// derivative that drops the count by one, with both chromosomes involved.
test('rob(13;14) is recognized (not an unknown token)', () => {
  const r = ISCN.parse('45,XX,rob(13;14)(q10;q10)');
  assert.ok(!r.warnings.some((w) => /recognize .rob/i.test(w)), 'no "don\'t recognize rob" warning');
  const ab = r.clones[0].aberrations[0];
  assert.equal(ab.chroms.join(','), '13,14');
});

test('balanced Robertsonian rob(13;14) counts 45', () => {
  const c = clone0('45,XX,rob(13;14)(q10;q10)');
  assert.equal(c.counts.actual, 45);
  assert.equal(c.counts.ok, true);
});

test('translocation Down rob(14;21)+21 counts 46', () => {
  const c = clone0('46,XX,rob(14;21)(q10;q10),+21');
  assert.equal(c.counts.actual, 46);
  assert.equal(c.counts.ok, true);
  assert.equal(c.complement['21'], 2); // one free 21 + one on the derivative
});

// --- Constitutional / inheritance qualifiers (c, mat, pat, dn) --------------
// These are suffixes, not aberrations. They must be stripped and remembered, not
// treated as garbage that breaks the aberration they trail.
test('constitutional +21c stays a gain (suffix stripped, no unreadable warning)', () => {
  const r = ISCN.parse('47,XY,+21c');
  assert.ok(!r.warnings.some((w) => /couldn.t read|wasn.t understood/i.test(w)), 'no unreadable warning');
  const c = r.clones[0];
  assert.equal(c.complement['21'], 3);
  assert.equal(c.counts.ok, true);
});

test('inheritance suffix on a del is stripped, del still drawn', () => {
  const r = ISCN.parse('46,XY,del(22)(q11.2)mat');
  assert.ok(!r.warnings.some((w) => /wasn.t understood|only the first/i.test(w)), 'suffix does not warn');
  const ab = r.clones[0].aberrations.find((a) => a.kind === 'del');
  assert.ok(ab, 'del is parsed');
  assert.equal(ab.chroms[0], '22');
});

// --- Dicentric of two chromosomes fuses into ONE (count drops by one) --------
test('dicentric dic(13;14) fuses to a single chromosome — counts 45', () => {
  const c = clone0('45,XY,dic(13;14)(q13;q22)');
  assert.equal(c.counts.actual, 45);
  assert.equal(c.counts.ok, true);
});

// --- Clonal evolution: idem / sl / sdl --------------------------------------
// idem = "the same as the stemline" (the first clone). The second clone inherits
// all of the stemline's aberrations plus whatever it lists.
test('idem inherits the stemline aberrations', () => {
  const r = ISCN.parse('46,XX,t(8;21)(q22;q22)/47,XX,idem,+8');
  const sub = r.clones[1];
  assert.ok(sub.aberrations.some((a) => a.kind === 't' && a.chroms.join(';') === '8;21'), 'inherited t(8;21)');
  assert.ok(sub.aberrations.some((a) => a.kind === 'gain' && a.chroms[0] === '8'), 'plus its own +8');
  assert.equal(sub.complement['8'], 3, 'trisomy 8 in the subclone');
  assert.equal(sub.counts.ok, true, 'count reconciles to 47 after inheriting');
});

test('idem does not raise a count-mismatch warning', () => {
  const r = ISCN.parse('46,XX,t(8;21)(q22;q22)/47,XX,idem,+8');
  assert.ok(!r.warnings.some((w) => /number at the start/i.test(w)), 'no spurious count warning');
  assert.ok(!r.warnings.some((w) => /couldn.t read .idem/i.test(w)), 'idem is recognized');
});

test('sdl inherits the previous sideline, not the stemline', () => {
  const r = ISCN.parse('46,XY,t(9;22)(q34;q11.2)/47,XY,idem,+8/48,XY,sdl,+der(22)t(9;22)(q34;q11.2)');
  const third = r.clones[2];
  // the sideline already carries +8 from clone 2, so the third should too
  assert.ok(third.aberrations.some((a) => a.kind === 'gain' && a.chroms[0] === '8'), 'inherited +8 from the sideline');
  assert.ok(third.aberrations.some((a) => a.kind === 't' && a.chroms.join(';') === '9;22'), 'inherited t(9;22)');
});

// The STANDARD ISCN form omits the repeated sex field: 47,idem,+8 (idem stands
// in the sex-field position and means "same as the stemline, sex included").
test('idem with no repeated sex field (standard form) inherits sex + aberrations', () => {
  const r = ISCN.parse('46,XY,t(9;22)(q34;q11.2)[15]/47,idem,+8[5]');
  const sub = r.clones[1];
  assert.ok(!r.warnings.some((w) => /2nd field should be the sex/i.test(w)), 'no spurious sex-field warning');
  assert.equal(sub.sex.label, 'XY', 'sex inherited from the stemline');
  assert.ok(sub.aberrations.some((a) => a.kind === 't' && a.chroms.join(';') === '9;22'), 'inherited t(9;22)');
  assert.ok(sub.aberrations.some((a) => a.kind === 'gain' && a.chroms[0] === '8'), 'plus +8');
  assert.equal(sub.counts.actual, 47);
  assert.equal(sub.counts.ok, true);
});

test('sl in the sex-field position also works', () => {
  const r = ISCN.parse('46,XX,del(5)(q13)/47,sl,+21');
  const sub = r.clones[1];
  assert.equal(sub.sex.label, 'XX', 'sex inherited');
  assert.ok(sub.aberrations.some((a) => a.kind === 'del' && a.chroms[0] === '5'), 'inherited del(5)');
  assert.equal(sub.counts.ok, true);
});

// A bare chromosome number is not a valid aberration; coach toward +N / -N.
test('a bare chromosome number is coached toward +N / -N', () => {
  const r = ISCN.parse('47,XY,8');
  assert.ok(r.warnings.some((w) => /\+8|−8|-8|a sign|gain or loss/i.test(w)), 'suggests +8 or -8');
});

// --- Range modal numbers (47~49) --------------------------------------------
test('range modal number accepts a count within the range', () => {
  const c = clone0('47~49,XY,+8,+21');
  assert.equal(c.counts.actual, 48);
  assert.equal(c.counts.ok, true, '48 is within 47–49');
});

test('range modal number does not warn when the count is in range', () => {
  const r = ISCN.parse('47~49,XY,+8,+21');
  assert.ok(!r.warnings.some((w) => /number at the start/i.test(w)), 'no mismatch warning for an in-range count');
});

// --- Copy-number multiplier (×N / xN) ---------------------------------------
test('multiplier ×2 applies the gain twice', () => {
  const c = clone0('48,XY,+8×2');
  assert.equal(c.complement['8'], 4, 'two extra copies of 8');
  assert.equal(c.counts.ok, true);
});

test('lowercase x multiplier also works', () => {
  const c = clone0('48,XY,+21x2');
  assert.equal(c.complement['21'], 4);
  assert.equal(c.counts.ok, true);
});

// --- Amplification: hsr / dmin ----------------------------------------------
test('hsr is recognized and does not change the chromosome count', () => {
  const r = ISCN.parse('46,XX,hsr(11)(q13)');
  assert.ok(!r.warnings.some((w) => /recognize .hsr|couldn.t read/i.test(w)), 'hsr is recognized');
  assert.equal(r.clones[0].counts.actual, 46, 'hsr rides on chromosome 11, count unchanged');
  assert.equal(r.clones[0].counts.ok, true);
});

test('dmin is recognized and is not counted in the modal number', () => {
  const r = ISCN.parse('46,XX,dmin');
  assert.ok(!r.warnings.some((w) => /recognize|couldn.t read/i.test(w)), 'dmin is recognized');
  assert.equal(r.clones[0].counts.actual, 46, 'double minutes are extrachromosomal, not counted');
  assert.equal(r.clones[0].counts.ok, true);
});

// --- Hostile / malformed input must degrade gracefully, never crash -----------
// A user typing garbage must get a warning, not a frozen tab. Values here are kept
// modest so they prove the bound cheaply; the real-world crash triggers were much
// larger (a huge multiplier or modal number allocating one object per copy).

test('a copy-number multiplier is capped so a huge xN cannot exhaust memory', () => {
  const c = clone0('46,XX,+8×1000');
  assert.ok(c.complement['8'] <= 52, 'gain multiplier is bounded (2 homologs + at most 50 copies), got ' + c.complement['8']);
  assert.ok(ISCN.parse('46,XX,+8×1000').warnings.some((w) => /50|most|cap/i.test(w)), 'the cap is surfaced as a warning');
});

test('a dmin count is capped so a huge NdmIn cannot exhaust memory', () => {
  const c = clone0('46,XX,1000dmin');
  assert.ok((c.slots.dmin || []).length <= 50, 'double-minute count is bounded, got ' + (c.slots.dmin || []).length);
});

test('an absurd modal number does not create a giant complement', () => {
  // 230 = 10x23; the old code read that as decaploid and allocated 10 copies of
  // every chromosome. Ploidy is only meaningful up to ~octaploid; beyond that,
  // fall back to diploid and let the count-mismatch warning speak.
  const c = clone0('230,XY');
  assert.ok(c.complement['1'] <= 8, 'chromosome 1 copy count stays bounded, got ' + c.complement['1']);
  assert.equal(c.counts.ok, false, 'the impossible count is flagged, not silently drawn');
});

test('empty / comma-only input yields a full clone shape (no undefined slots)', () => {
  // Regression for a TypeError: an empty field list returned a clone with no
  // slots/complement/counts, which crashed computeAffected/teach downstream.
  const c = clone0(',');
  assert.equal(typeof c.slots, 'object', 'slots is always present');
  assert.equal(typeof c.complement, 'object', 'complement is always present');
  assert.ok(c.counts && c.counts.ok === false, 'counts is present and not ok');
  assert.ok((c.slots['1'] || []).length === 0 || Array.isArray(c.slots['1']), 'per-chromosome slot access is safe');
});

test('a first-clone idem with no stemline does not double its own aberrations', () => {
  // 47,XX,idem,+8 is malformed (idem needs a preceding stemline). The old code
  // let the clone reference itself, applying +8 twice -> phantom 48,+8x2.
  const c = clone0('47,XX,idem,+8');
  assert.equal(c.complement['8'], 3, '+8 is applied once, not doubled');
  assert.equal(c.counts.actual, 47, 'count reflects a single +8');
  assert.ok(ISCN.parse('47,XX,idem,+8').warnings.some((w) => /idem|sl|stemline|earlier clone|previous clone/i.test(w)),
    'the missing-stemline problem is surfaced');
});
