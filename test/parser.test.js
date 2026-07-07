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
