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
  assert.ok(r.warnings.some((w) => /one karyotype at a time/i.test(w)), 'says only one can be drawn');
  assert.ok(r.warnings.some((w) => /del\(5\)\(q14q34\)/.test(w)), 'and names the alternative to enter on its own');
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

// --- Marker chromosomes: numbered and ranged counts (common in Mitelman data) ---
test('a numbered marker +2mar draws two marker chromosomes', () => {
  const c = clone0('48,XX,+2mar');
  assert.equal(c.complement.mar, 2, 'two markers');
  assert.equal(slotKinds(c, 'mar').filter((k) => k === 'mar').length, 2, 'two mar slots drawn');
  assert.equal(c.counts.ok, true, '46 + 2 markers = 48');
});

test('a ranged marker count +1~3mar is recognized, not rejected as unreadable', () => {
  const r = ISCN.parse('47~49,XX,+1~3mar');
  assert.ok(!r.warnings.some((w) => /not a change KaryoDraw recognizes/i.test(w)), 'ranged marker parses');
  assert.ok((r.clones[0].slots.mar || []).length >= 1, 'draws at least one marker');
});

// --- Supernumerary rings ------------------------------------------------------
// +r is the ring counterpart of +mar: an extra chromosome banding cannot identify,
// whose shape happens to be known. It was refused as "not a change KaryoDraw
// recognizes" while +mar worked, which is the worse direction of error for this app
// (docs/VALIDATION.md): refusing valid ISCN, not tolerating invalid ISCN.
test('a supernumerary ring +r is a marker whose shape is known', () => {
  const c = clone0('47,XX,+r');
  assert.equal(c.unreadable, false, '+r is valid ISCN and must draw');
  assert.equal(c.complement.mar, 1, 'it occupies the marker slot: origin unidentified');
  assert.equal(c.slots.mar[0].ring, true, 'and carries the ring shape into the drawing');
  assert.equal(c.slots.mar[0].label, 'r', 'labelled r, not mar');
  assert.equal(c.counts.ok, true, '46 + 1 ring = 47');
});

test('the ring marker is counted and labelled like any other marker', () => {
  assert.equal(clone0('48,XX,+2r').complement.mar, 2, 'a count works, as with 2mar');
  assert.equal(clone0('47,XX,+r1').unreadable, false, 'a numbered ring r1 is one ring');
  // r(13) names the chromosome and is a different thing: it replaces a 13 rather
  // than adding an unidentified chromosome, so it must not land in the marker slot.
  const named = clone0('46,XX,r(13)(p11q34)');
  assert.equal(named.complement.mar || 0, 0, 'r(13) is not a supernumerary marker');
});

test('a labeled marker +mar1 is still a single marker, not a count', () => {
  const c = clone0('47,XX,+mar1');
  assert.equal(c.complement.mar, 1, 'mar1 is one (labeled) marker, not "1 marker via count"');
});

// --- inc: the ISCN "incomplete karyotype" flag (frequent in cancer karyotypes) ---
test('inc is recognized and does not read as an unknown token', () => {
  const r = ISCN.parse('46,XX,inc');
  assert.ok(!r.warnings.some((w) => /not a change KaryoDraw recognizes/i.test(w)), 'inc is recognized');
  assert.equal(r.clones[0].counts.ok, true, '46,XX with only inc still counts as 46');
});

test('inc flags the clone incomplete and suppresses the count-mismatch warning', () => {
  const r = ISCN.parse('40,XX,inc');
  assert.equal(r.clones[0].incomplete, true, 'clone flagged incomplete');
  assert.ok(!r.warnings.some((w) => /number at the start says/i.test(w)),
    'no count-mismatch warning for an explicitly incomplete karyotype');
});

// --- Whitespace is insignificant (copy-paste and human typing add spaces) -----
test('a qualifier after a space is still recognized (de novo, dn)', () => {
  const c = clone0('46,XY,r(13)(p11q34) dn');
  assert.equal(abKinds(c)[0], 'ring');
  assert.equal(c.aberrations[0].qualifier, 'dn', 'the space before dn does not drop the qualifier');
  assert.ok(!ISCN.parse('46,XY,r(13)(p11q34) dn').warnings.some((w) => /cannot be included|not a change KaryoDraw recognizes/i.test(w)),
    'no "not understood" warning');
});

test('a stray space inside an aberration is ignored (r(13) (p11q34))', () => {
  const c = clone0('46,XY,r(13) (p11q34)');
  assert.equal(abKinds(c)[0], 'ring');
  assert.ok((c.aberrations[0].breakpoints[0] || []).length > 0, 'the breakpoint is still parsed');
});

test('spaces after commas and around fields are tolerated', () => {
  const c = clone0('47, XX, +21');
  assert.equal(c.modalNumber, 47);
  assert.equal(c.complement['21'], 3);
});

test('the meaningful mos-prefix space is preserved (still mosaic)', () => {
  const r = ISCN.parse('mos 45,X[12]/46,XX[18]');
  assert.equal(r.isMosaic, true);
  assert.equal(r.clones.length, 2);
});

test('result.normalized gives the canonical, whitespace-free designation', () => {
  assert.equal(ISCN.parse('46,XY,r(13)(p11q34) dn').normalized, '46,XY,r(13)(p11q34)dn');
  assert.equal(ISCN.parse('46,XY,r(13)  (p11q34)').normalized, '46,XY,r(13)(p11q34)');
  assert.equal(ISCN.parse('47, XX, +21').normalized, '47,XX,+21');
  assert.equal(ISCN.parse('mos 45,X[12]/46,XX[18]').normalized, 'mos 45,X[12]/46,XX[18]', 'the mos space stays');
});

// A bare rearrangement (no leading count + sex) gets a "did you mean" fix that
// prepends a normal constitution, with the correct count for the aberration.
test('a bare balanced translocation suggests the 46,XX, prefix', () => {
  assert.equal(ISCN.parse('t(2;5)(q21;q31)').suggestion, '46,XX,t(2;5)(q21;q31)');
});
test('a bare deletion keeps the 46 count', () => {
  assert.equal(ISCN.parse('del(5)(p15.2)').suggestion, '46,XX,del(5)(p15.2)');
});
test('a bare gain corrects the count to 47', () => {
  assert.equal(ISCN.parse('+21').suggestion, '47,XX,+21');
});
test('a bare loss corrects the count to 45', () => {
  assert.equal(ISCN.parse('-7').suggestion, '45,XX,-7');
});
test('a bare Robertsonian corrects the count to 45', () => {
  assert.equal(ISCN.parse('rob(13;14)(q10;q10)').suggestion, '45,XX,rob(13;14)(q10;q10)');
});
test('a bare Y-involving rearrangement guesses XY, not XX', () => {
  assert.equal(ISCN.parse('idic(Y)(q11.2)').suggestion, '46,XY,idic(Y)(q11.2)');
});
test('the "starts with a number" note is replaced by a clearer one when a fix is offered', () => {
  const m = ISCN.parse('t(9;22)(q34;q11.2)');
  assert.equal(m.suggestion, '46,XX,t(9;22)(q34;q11.2)');
  assert.ok(m.warnings.some((w) => /typed only the rearrangement/.test(w)), 'friendly note present');
  assert.ok(!m.warnings.some((w) => /isn’t a number/.test(w)), 'raw "isn\'t a number" note removed');
});
test('genuine garbage does NOT get a bare-aberration suggestion', () => {
  assert.equal(ISCN.parse('hello there').suggestion, null);
  assert.equal(ISCN.parse('banana(9;22)').suggestion, null);
});
test('a complete karyotype is untouched (no bare-aberration suggestion)', () => {
  assert.equal(ISCN.parse('46,XX,t(2;5)(q21;q31)').suggestion, null);
  assert.equal(ISCN.parse('46,XY').suggestion, null);
});

// ---- a trailing aberration that is missing its comma ------------------------
// Reported by a student: "45,XY,der(13;14)(q10;q10) +14" drew the plain
// Robertsonian carrier with no warning at all, because der() accepts trailing
// sub-ops (der(9)t(9;22)…) and anything that was not a sub-op was dropped on the
// floor. A silently ignored +14 is worse than a rejection: the drawing looks
// authoritative and is wrong.
test('a trailing +14 after a der is never dropped silently', () => {
  const m = ISCN.parse('45,XY,der(13;14)(q10;q10) +14');
  assert.ok(m.warnings.length, 'the ignored +14 is reported');
  assert.ok(m.warnings.some((w) => /\+14/.test(w)), 'the warning names the fragment');
});
test('a sign after a closing parenthesis is repaired with a comma', () => {
  assert.equal(ISCN.parse('46,XY,der(13;14)(q10;q10)+14').suggestion, '46,XY,der(13;14)(q10;q10),+14');
  assert.equal(ISCN.parse('46,XY,der(13;14)(q10;q10) +14').suggestion, '46,XY,der(13;14)(q10;q10),+14');
  assert.equal(ISCN.parse('46,XX,t(14;21)(q10;q10)+21').suggestion, '46,XX,t(14;21)(q10;q10),+21');
});
test('the comma repair leaves a modal-number range alone', () => {
  assert.equal(ISCN.parse('45-48,XY,+8').suggestion, null);
  assert.equal(ISCN.parse('45~48,XY,+8').suggestion, null);
  assert.equal(ISCN.parse('46,XX,1~3mar').suggestion, null);
});
test('a missing-comma sign gets a comma hint, not the "or"/uncertainty note', () => {
  const w = ISCN.parse('46,XX,t(14;21)(q10;q10)+21').warnings.join(' ');
  assert.match(w, /comma/, 'says what is actually wrong');
  assert.doesNotMatch(w, /uncertainty/, 'no irrelevant "or"/uncertainty boilerplate');
});
test('genuine unreadable trailing text still gets the "only the first part" note', () => {
  const w = ISCN.parse('46,XY,t(9;22)(q34;q11.2)ort(1;2)(p10;q10)').warnings.join(' ');
  assert.match(w, /one karyotype at a time/);
});
// Each leftover gets the message that fits it. The catch-all used to name two ISCN
// features, "or" alternatives and uncertainty markers, whatever the leftover was: a
// student who typed a stray "%" before "14" was answered with a paragraph about
// notation she had never used, and no mention of the comma or the sign she was missing.
test('the leftover message names what is missing from that leftover', () => {
  const w = (k) => ISCN.parse(k).warnings.join(' ');
  // A chromosome with neither a comma nor a sign needs both, and naming one sends the
  // reader round again for the other.
  const bare = w('46,XY,der(13;14)(q10;q10)14');
  assert.match(bare, /gained or lost/, 'names the sign');
  assert.match(bare, /separated by commas/, 'and the comma');
  assert.match(bare, /“,\+14”/, 'and shows both corrections');
  assert.match(bare, /“,-14”/);
  assert.doesNotMatch(bare, /uncertainty|alternative/i, 'and nothing about features it does not involve');
  // A sign but no comma is the narrower case and keeps its narrower message.
  assert.match(w('46,XY,rob(14;21)(q10;q10)+21'), /^Changes are separated by commas/);
  // Genuine gibberish claims no diagnosis it does not have.
  const junk = w('46,XY,inv(9)(p11q13)zzz');
  assert.match(junk, /Changes look like/, 'shows the shape of a change');
  assert.doesNotMatch(junk, /uncertainty|“or”/i, 'without blaming a feature at random');
});

test('a stray character is answered once, and then on its own terms', () => {
  // The whole chain: "%" is named and removed, and what is left ("14") is then
  // diagnosed as a chromosome missing its comma and its sign. Two messages, each
  // about something the reader actually typed.
  const w = ISCN.parse('46,XY,der(13;14)(q10;q10) %14').warnings.join(' ');
  assert.match(w, /“%” is not a character ISCN uses/);
  assert.match(w, /“,\+14”/);
  assert.doesNotMatch(w, /uncertainty markers/, 'the message that sent a student to the wrong page');
});

test('a legitimate der sub-op chain warns about nothing', () => {
  assert.equal(ISCN.parse('46,XX,der(9)t(9;22)(q34;q11.2)').warnings.length, 0);
  assert.equal(ISCN.parse('46,X,der(X)t(X;5)(p22.1;p13)').warnings.length, 0);
});

// ---- a whole-arm acrocentric fusion written as t(...) -----------------------
// The classic teaching error, and the one in the student's practice exam:
// "45,XX,t(13;15)(q10;q10)". A t keeps both derivatives, so the count stays 46;
// the 45 count means a Robertsonian was intended. Offering the rob form teaches
// the distinction, where bumping the stated count to 46 would bury it.
test('t(13;15)(q10;q10) at a 45 count suggests the rob form', () => {
  const m = ISCN.parse('45,XX,t(13;15)(q10;q10)');
  assert.equal(m.countFix, '45,XX,rob(13;15)(q10;q10)');
  assert.ok(m.warnings.some((w) => /Robertsonian/.test(w)), 'explains why');
});
test('a whole-arm t at a consistent count is left alone', () => {
  const m = ISCN.parse('46,XX,t(13;15)(q10;q10)');
  assert.equal(m.countFix, null);
  assert.equal(m.warnings.length, 0);
});
test('a non-acrocentric whole-arm t is not called Robertsonian', () => {
  const m = ISCN.parse('45,XY,t(1;3)(p10;q10)');
  assert.ok(!/Robertsonian/.test(m.warnings.join(' ')), '1 and 3 are not acrocentric');
});
test('an ordinary translocation with a wrong count still gets the count fix', () => {
  assert.equal(ISCN.parse('45,XX,t(9;22)(q34;q11.2)').countFix, '46,XX,t(9;22)(q34;q11.2)');
});

// ---- the same fusion at a count that agrees with itself ---------------------
// 46,XX,t(13;15)(q10;q10) is legal ISCN and the renderer draws it correctly, so it
// is not a warning. It is still almost never what a learner meant, and its picture
// (46 chromosomes, both whole-arm products present) is the one that convinces a
// reader a Robertsonian carrier has 46. It gets result.note: neutral prose plus the
// rob() reading to draw beside it, never the amber warning box.
test('a whole-arm acrocentric t at a consistent count gets a note, not a warning', () => {
  const m = ISCN.parse('46,XX,t(13;15)(q10;q10)');
  assert.equal(m.warnings.length, 0, 'correct input must not raise a warning');
  assert.equal(m.countFix, null);
  assert.ok(m.note, 'note is set');
  assert.equal(m.note.fix, '45,XX,rob(13;15)(q10;q10)', 'rob spelling AND the decremented count');
  assert.match(m.note.text, /Robertsonian/);
});
test('the note is identical for every whole-arm spelling of the same fusion', () => {
  // p10/q10 name centromere halves, not the arms that join, so these are the same
  // rearrangement and must not get different advice.
  const fixes = ['(p10;q10)', '(q10;q10)', '(p10;p10)', '(q10;p10)']
    .map((bp) => ISCN.parse('46,XX,t(13;15)' + bp).note.fix);
  assert.deepEqual(fixes, Array(4).fill('45,XX,rob(13;15)(q10;q10)'));
});
test('the note and the warning box never both fire', () => {
  // 45,XX,t(13;15)(q10;q10) is the count-mismatch case: the warning box and its
  // countFix own it, so a note here would say the same thing twice.
  const m = ISCN.parse('45,XX,t(13;15)(q10;q10)');
  assert.ok(m.warnings.length && m.countFix, 'still the warning path');
  assert.equal(m.note, null);
});
test('the note decrements the count rather than assuming 46 -> 45', () => {
  // Replacing two derivatives with one fused chromosome always removes exactly one,
  // whatever else the karyotype carries.
  assert.equal(ISCN.parse('47,XX,t(13;15)(q10;q10),+21').note.fix, '46,XX,rob(13;15)(q10;q10),+21');
});
test('no note for input the rob() reading does not apply to', () => {
  assert.equal(ISCN.parse('46,XY,t(1;3)(p10;q10)').note, null, '1 and 3 are not acrocentric');
  assert.equal(ISCN.parse('46,XY,t(9;22)(q34;q11.2)').note, null, 'not a whole-arm break');
  assert.equal(ISCN.parse('45,XX,rob(13;15)(q10;q10)').note, null, 'already written as rob');
  assert.equal(ISCN.parse('46,XY').note, null);
});

// ---- rob() lost its leftover, and that broke the count warning --------------
// 46,XY,rob(14;21)(q10;q10)+21 (missing comma) announced "the number at the start
// says 46, but this karyotype describes 45 chromosomes" directly above a "did you
// mean" whose own count is 46. The stated 46 was right; the +21 had been swallowed
// into the rob token and the tally, not the karyotype, was short by one.
//
// The count warning already guards against exactly this: it stays quiet when part of
// the designation went unread, because "says 46 but describes 45" reads as a claim
// about the karyotype and sends people hunting an imbalance that is not there. The
// guard did not fire because rob() never recorded its leftover. rob() sets kind
// "der" but does not run der()'s sub-op parsing, so a kind-based exemption excused it
// from both leftover reporters. der(13;14)(q10;q10)+14, the same rearrangement spelled
// the other way, always reported it correctly.
const warnOf = (k) => ISCN.parse(k).warnings.join(' | ');

test('a missing comma after rob() is reported, like it always was after der()', () => {
  assert.match(warnOf('46,XY,rob(14;21)(q10;q10)+21'), /separated by commas.*“\+21” needs one before it/);
  assert.match(warnOf('46,XY,rob(14;21)(q10;q10)-21'), /separated by commas.*“-21” needs one before it/);
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10)+21').clones[0].aberrations[0].unread, '+21',
    'the fragment is recorded, which is what the count guard reads');
});

test('rob() and der() spell the same karyotype and now warn identically', () => {
  const rob = warnOf('46,XY,rob(14;21)(q10;q10)+21').replace(/rob/g, 'der');
  const der = warnOf('46,XY,der(14;21)(q10;q10)+21');
  assert.equal(rob, der, 'the two spellings must not disagree about the same mistake');
});

test('no count argument while part of the designation is unread', () => {
  // The stated count is probably right and our tally is the thing that is short.
  ['46,XY,rob(14;21)(q10;q10)+21', '45,XY,rob(14;21)(q10;q10)+21', '46,XX,der(13;14)(q10;q10)+14']
    .forEach((k) => assert.doesNotMatch(warnOf(k), /number at the start says/, k));
});

test('the offered fix is the karyotype the writer meant', () => {
  const m = ISCN.parse('46,XY,rob(14;21)(q10;q10)+21');
  assert.equal(m.suggestion, '46,XY,rob(14;21)(q10;q10),+21');
  // And that fix is self-consistent at 46: translocation Down syndrome. The warning
  // the old build showed contradicted this.
  const fixed = ISCN.parse(m.suggestion);
  assert.equal(fixed.clones[0].counts.ok, true, 'the suggestion adds up, so nothing should have claimed otherwise');
  assert.equal(fixed.warnings.length, 0);
});

test('a genuine count mismatch is still reported', () => {
  // The guard is about unread text, not about counts in general.
  // Numbers and order, not prose; message-voice.test.js owns the wording.
  assert.match(warnOf('45,XX,t(13;15)(q10;q10)'), /number at the start says 45\b[\s\S]*\b46 chromosomes\b/);
  assert.match(warnOf('47,XY,rob(14;21)(q10;q10),+21'), /number at the start says 47\b[\s\S]*\b46 chromosomes\b/);
});

// ---- a token that never became an aberration is not a count argument --------
// 46,XY,rob(14;21)(q10;q10),21 (no sign) reported "the number at the start says 46,
// but this karyotype describes 45 chromosomes" underneath the message that actually
// diagnoses it. The signless 21 contributed nothing to the tally, so the tally was
// short, not the karyotype. Read as +21 the stated 46 is exactly right.
test('a signless token gets the sign hint, not a count argument', () => {
  const w = ISCN.parse('46,XY,rob(14;21)(q10;q10),21').warnings.join(' | ');
  assert.match(w, /needs a sign/, 'the diagnosis is the missing sign');
  assert.doesNotMatch(w, /number at the start says/, 'and the count is not second-guessed');
});

test('the count guard covers both ways a token goes uncounted', () => {
  // Leftover hanging off an aberration that was read, and a whole token that never
  // became one. Both leave the tally short for the same reason.
  ['46,XY,rob(14;21)(q10;q10)+21', '46,XY,rob(14;21)(q10;q10),21']
    .forEach((k) => assert.doesNotMatch(ISCN.parse(k).warnings.join(' '), /number at the start says/, k));
});

test('a fully interpreted karyotype still gets its count checked', () => {
  // The guard is about uninterpreted tokens, not about counts.
  assert.match(ISCN.parse('46,XY,rob(14;21)(q10;q10),-21').warnings.join(' '),
    /number at the start says 46\b[\s\S]*\b44 chromosomes\b/);
  assert.equal(ISCN.parse('44,XY,rob(14;21)(q10;q10),-21').warnings.length, 0, 'and stays quiet when it adds up');
});

test('an uncounted token blocks the count FIX, not just the count warning', () => {
  // Suppressing the warning while still offering "did you mean 45,XY,rob(14;21)
  // (q10;q10),21" would be worse than saying nothing: that fix keeps the signless 21
  // and changes the number that was right.
  const m = ISCN.parse('46,XY,rob(14;21)(q10;q10),21');
  assert.equal(m.countFix, null, 'no count fix offered');
  assert.equal(m.suggestion, null);
  assert.match(m.warnings.join(' '), /needs a sign/, 'the sign is still the diagnosis');
});

test('legitimate count fixes are untouched', () => {
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10),-21').countFix, '44,XY,rob(14;21)(q10;q10),-21');
  assert.equal(ISCN.parse('40,XY,rob(14;21)(q10;q10),-21').countFix, '44,XY,rob(14;21)(q10;q10),-21');
  assert.equal(ISCN.parse('45,XX,t(13;15)(q10;q10)').countFix, '45,XX,rob(13;15)(q10;q10)');
});

test('clone.uncounted is the single flag every count claim reads', () => {
  // The pill, the export note, the print summary and the count fix all gate on it,
  // so they cannot drift into disagreeing about the same karyotype.
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10),21').clones[0].uncounted, true);
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10)+21').clones[0].uncounted, true);
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10),-21').clones[0].uncounted, false);
});

// ---- breakpoint text that is not a breakpoint ------------------------------
// del(5)(zzqewdf2315.2) drew a chromosome 5, offered "did you mean
// 46,XY,del(5)(zzqewdf2315.2)?" (the same gibberish with the count changed), and
// explained itself as "everything distal to 5? is lost". splitBands found no band and
// dropped the group, which left it identical to del(5) with no breakpoint at all, so
// index.html's band check had nothing to look at either.
test('breakpoint text that yields no band is recorded, not discarded', () => {
  assert.deepEqual(ISCN.parse('47,XY,del(5)(zzqewdf2315.2)').clones[0].aberrations[0].badBands.join(), 'zzqewdf2315.2');
  assert.deepEqual(ISCN.parse('46,XY,t(9;22)(q34;zzz)').clones[0].aberrations[0].badBands.join(), 'zzz');
});

test('a legitimately absent breakpoint is not flagged', () => {
  // Only non-empty text that yields no band is a bad band. Whether an operation may
  // leave the group empty at all is a separate question, answered by the arity rule
  // below: r(13) and +mar are legal with no breakpoint, del(5) is not.
  ['46,XY,r(13)', '47,XY,+mar', '46,XY,dmin', '46,XY,del(5)(p15.2)', '46,XY,inv(9)(p11q13)']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].unreadable, false, k));
  ['46,XY,del(5)', '46,XY,r(13)'].forEach((k) =>
    assert.equal((ISCN.parse(k).clones[0].aberrations[0].badBands || []).length, 0,
      `${k}: an empty group is not gibberish, whatever else is wrong with it`));
});

// ---- breakpoint arity ------------------------------------------------------
// An operation knows how many breakpoints it takes. Given fewer, the renderer drew
// anyway and filled the gap from whatever the code did with an absent band, which
// the explanations exposed: inv(9)(p11) came out "the segment between 9p11 is
// flipped end-for-end (paracentric)", inventing a second endpoint and a
// classification; dup(1) as "the segment  is present twice". One rule covers the
// whole family, including the two cases the known-holes survey never had in it
// (del(5) and t(9;22), which state no breakpoint at all).
test('an operation given fewer breakpoints than it takes does not draw', () => {
  [
    ['46,XY,inv(9)(p11)', /two bands that bound that segment/],
    ['46,XY,t(9;22)(q34)', /one breakpoint on each chromosome/],
    ['46,XY,t(2;7;5)(q21;p13)', /involves three chromosomes, so it needs three breakpoints/],
    ['46,XX,del(5)', /so it needs a band/],
    ['46,XX,t(9;22)', /one breakpoint on each chromosome/],
    ['46,XY,dup(1)', /which segment is doubled/],
    ['46,XY,ins(5;2)(p14;q22)', /two bands that bound the piece/],
    ['46,XY,ins(5;2)(p14)', /two bands that bound the piece/],
  ].forEach(([k, re]) => {
    const m = ISCN.parse(k);
    assert.equal(m.clones[0].unreadable, true, `${k} should not draw`);
    assert.match(m.warnings.join(' '), re, `${k} should say which breakpoints it needs`);
  });
});

test('every correct spelling of those operations still draws', () => {
  // The whole point of the rule is the notation it must NOT refuse. Both deletion
  // forms, both insertion forms, whole-arm t at q10, and the three-way that is the
  // valid twin of the flagged one.
  ['46,XY,del(5)(p15.2)', '46,XY,del(5)(q13q33)', '46,XY,dup(1)(q22q25)',
    '46,XY,inv(9)(p12q13)', '46,XY,inv(11)(q21q23)', '46,XY,t(9;22)(q34;q11.2)',
    '46,XX,t(2;7;5)(q21;p13;q31)', '46,XX,t(13;15)(q10;q10)',
    '46,XY,ins(5;2)(p14;q22q32)', '46,XY,ins(2)(q13p23p13)', '46,XX,trp(1)(q22q25)']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].unreadable, false, k));
});

test('operations that are legal without a breakpoint are left alone', () => {
  // Deliberately outside the table. Each reads sensibly with the breakpoints left
  // off and real reports write them that way, and refusing valid ISCN is the worse
  // failure. Adding one of these to ARITY needs a reason better than symmetry.
  ['46,XX,r(13)', '46,X,der(X)', '46,XY,i(X)', '46,XY,add(19)', '45,XY,rob(13;14)',
    '47,XY,+mar', '46,XY,dmin']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].unreadable, false, k));
});

test('an unreadable breakpoint is named once, not twice', () => {
  // del(5)(zzqewdf2315.2) fails both checks: the text is not a band, and what is
  // left is a deletion with no breakpoint. The bad band is the reader's actual
  // mistake and the arity is downstream of it, so only the first is said.
  const w = ISCN.parse('46,XY,del(5)(zzqewdf2315.2)').warnings;
  assert.match(w.join(' '), /is not a breakpoint/);
  assert.equal(w.filter((x) => /says where the chromosome broke/.test(x)).length, 0,
    'the arity message would name the same mistake a second time');
});

test('an unreadable breakpoint is explained, and gets no count fix', () => {
  const m = ISCN.parse('47,XY,del(5)(zzqewdf2315.2)');
  assert.match(m.warnings.join(' '), /is not a breakpoint.*arm letter.*band number/);
  assert.equal(m.countFix, null, 'a fix that keeps the gibberish is not a fix');
  assert.equal(m.clones[0].unreadable, true, 'and the flag that blocks the drawing is set');
});

test('a band that is well formed but does not exist is a different case', () => {
  // p99 parses as a band, so it reaches index.html's band check, which knows the real
  // extent of the arm and can name the nearest real band. It is not "unreadable".
  const m = ISCN.parse('46,XY,del(5)(p99)');
  assert.equal(m.clones[0].unreadable, false);
  assert.deepEqual(m.clones[0].aberrations[0].breakpoints[0].join(), 'p99');
});

test('a valid incomplete karyotype is offered no count fix', () => {
  // 48,XY,+8,inc says there are further, unidentified changes, so its tally is short
  // by design. It used to be offered "did you mean 47,XY,+8,inc?".
  const m = ISCN.parse('48,XY,+8,inc');
  assert.equal(m.clones[0].counts.ok, false, 'the tally really is short');
  assert.equal(m.clones[0].countWrong, false, 'but that is not an error');
  assert.equal(m.countFix, null);
  assert.equal(m.suggestion, null);
  assert.equal(m.warnings.length, 0, 'and nothing to complain about at all');
});

test('the count fix follows countWrong, like every other count claim', () => {
  assert.equal(ISCN.parse('46,XY,rob(14;21)(q10;q10),-21').countFix, '44,XY,rob(14;21)(q10;q10),-21');
  assert.equal(ISCN.parse('47,XY,del(5)(zzqewdf2315.2)').countFix, null, 'not while a breakpoint is unreadable');
});

// ---- whole-chromosome gains and losses are listed in chromosome order -------
// 43,XY,rob(14;21)(q10;q10),-21,-20 lists 21 before 20 and drew silently.
//
// Scoped hard, on purpose. ISCN's full listing order also covers structural
// abnormalities, and a broader version of this check accused this app's own
// segregation output of being wrong. Only +N against -N is checked.
test('gains and losses out of chromosome order are flagged, with a fix', () => {
  const m = ISCN.parse('43,XY,rob(14;21)(q10;q10),-21,-20');
  assert.match(m.warnings.join(' '), /chromosome order, so “-20” comes before “-21”/);
  assert.equal(m.orderFix, '43,XY,rob(14;21)(q10;q10),-20,-21', 'only the two losses move');
});

test('the fix moves nothing it was not asked to move', () => {
  // The rob stays exactly where it was written; only the gains and losses sort.
  assert.equal(ISCN.parse('44,XY,-21,-20').orderFix, '44,XY,-20,-21');
  assert.ok(ISCN.parse('43,XY,rob(14;21)(q10;q10),-21,-20').orderFix.startsWith('43,XY,rob(14;21)(q10;q10),'),
    'the rob keeps the position it was written in');
});

test('correctly ordered karyotypes are left alone', () => {
  ['45,XY,-20,-21', '47,XY,+8,+21', '48,XY,+8,+8', '46,XY,rob(14;21)(q10;q10),+21',
   '48,XY,+8,inc', '47,XX,+mar', '49,XY,+8,+der(22)t(9;22)(q34;q11.2)']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].outOfOrder, null, k));
});

test('structural abnormalities are not ordered against anything', () => {
  // 46,XX,+der(5)t(2;5)(q21;q31),-2 is what this app's own segregation model emits for
  // a 3:1 product, and that model was checked against ISCN 2024 Table 5. A rule that
  // called it an error would be the app contradicting itself on a point it has
  // already reasoned about (see canonKey in segregation.js).
  assert.equal(ISCN.parse('46,XX,+der(5)t(2;5)(q21;q31),-2').clones[0].outOfOrder, null);
  assert.equal(ISCN.parse('46,XY,+8,t(X;18)(p11;q11)').clones[0].outOfOrder, null);
});

test('listing order does not block the drawing', () => {
  // It changes how the karyotype is written, never what is drawn, and confidence in
  // the exact ISCN rule is lower than for the count and readability checks. A wrong
  // call should cost a suggestion, not a refusal.
  const c = ISCN.parse('43,XY,rob(14;21)(q10;q10),-21,-20').clones[0];
  assert.ok(c.outOfOrder, 'flagged');
  assert.equal(c.unreadable, false);
  assert.equal(c.countWrong, false);
  assert.equal(c.unaccounted, false, 'none of the refusing flags are set');
});

// ---- a sex field the app had to edit to use --------------------------------
// 43,XZY,rob(14;21)(q10;q10),-21,-20 dropped the Z, said so, and drew anyway, which
// is the class we stopped doing. 46,QQ,+21 was worse: it drew a karyogram with NO sex
// chromosomes at all. Neither is caught by the round-trip, which compares each field
// AS WRITTEN, so "XZY" comes back intact while the Z is discarded inside it.
test('a sex field with a character that is not X or Y is refused', () => {
  const m = ISCN.parse('43,XZY,rob(14;21)(q10;q10),-21,-20');
  assert.equal(m.clones[0].unreadable, true, 'blocks the drawing');
  assert.match(m.warnings.join(' '), /written with X and Y only, so “Z”/);
  assert.equal(m.sexFix, '43,XY,rob(14;21)(q10;q10),-21,-20', 'and offers it without the Z');
});

test('a sex field with no X or Y at all is refused', () => {
  const m = ISCN.parse('46,QQ,+21');
  assert.equal(m.clones[0].unreadable, true, 'used to draw with no sex chromosomes');
  assert.equal(m.sexFix, null, 'nothing to keep, so no fix is invented');
  assert.match(m.warnings.join(' '), /written with X and Y/);
});

test('the round-trip cannot see this, which is why it is checked here', () => {
  // The guard compares fields as written, so a character dropped INSIDE a field is
  // invisible to it. Pinned so the limitation stays documented by a failing test if
  // anyone assumes the round-trip covers everything.
  assert.equal(ISCN.parse('43,XZY,rob(14;21)(q10;q10),-20,-21').clones[0].unaccounted, false,
    'round-trips fine, and is still not acceptable input');
});

test('ordinary sex fields are untouched', () => {
  ['46,XY', '46,XX', '45,X', '47,XXY', '47,XXX', '48,XXYY', '69,XXY', '46,xy', 'mos 45,X[12]/46,XX[18]']
    .forEach((k) => {
      const c = ISCN.parse(k).clones[0];
      assert.equal(c.unreadable, false, k);
      assert.equal(ISCN.parse(k).sexFix, null, k);
    });
});

// ---- a missing comma between two signed changes -----------------------------
// "-2-21" was reported as "“-2-21” is not a change KaryoDraw recognizes", which names
// the symptom and not the mistake. The general "sign after a digit" repair is unsafe
// (it would turn the modal range 45-48 into 45,-48), but the subset applied per FIELD
// to a token that ALREADY begins with a sign cannot reach either dangerous case: the
// modal range is field 0 and is never examined, and a marker count does not begin
// with a sign.
test('a missing comma between two signed changes is named and repaired', () => {
  const m = ISCN.parse('43,XY,rob(14;21)(q10;q10),-2-21,-20');
  assert.equal(m.suggestion, '43,XY,rob(14;21)(q10;q10),-2,-21,-20');
  assert.match(m.warnings.join(' '), /separated by commas, so “-2-21” is two of them/);
});

test('the sign repair cannot reach a modal range or a marker count', () => {
  // The two cases that made the general rule unsafe.
  ['45-48,XY,+8', '45~48,XY,+8', '46,XY,1~3mar', '46,XY,1-3mar', '46,XY,2mar']
    .forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

test('the sign repair leaves ordinary signed changes alone', () => {
  ['47,XY,+8', '45,XY,-8', '46,XY,+der(22)t(9;22)(q34;q11.2)', '46,XY,+8×2', '47,idem,+8',
   'mos 45,X[12]/46,XX[18]'].forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

test('it works on sex chromosomes too', () => {
  assert.equal(ISCN.parse('44,XY,-X-Y').suggestion, '44,XY,-X,-Y');
});

// ---- the rest of the known holes ---------------------------------------------
// docs/VALIDATION.md carried a table of input that is not correct ISCN and drew
// anyway. Each entry here closes one. The split that matters is refuse vs warn: a
// karyotype that cannot be drawn honestly is refused, one whose only fault is how it
// is written keeps its drawing and is told the rule (see "Adding a check").
test('input that cannot be drawn honestly is refused', () => {
  [
    ['46,XY,+0', /is not a human chromosome/, 'there is no chromosome 0'],
    ['46,XY,+99', /is not a human chromosome/, 'nor a 99'],
    ['46,XY,t(9;9)(q34;q11)', /exchange between two different chromosomes/, 'a t within one chromosome'],
    ['45,XY,rob(1;2)(q10;q10)', /fuses two acrocentric chromosomes/, 'a rob between metacentrics'],
    ['47,idem,+8', /no earlier clone/, 'a subclone with no stemline'],
    ['46,XY,t(9;22)(q34;q11.2)[0]', /seen in none of them/, 'a clone observed in no cells'],
    ['46,XY,t(9;22)(q34;q11.2)[-1]', /not a count of cells/, 'cells cannot be counted backwards'],
  ].forEach(([k, re, why]) => {
    const m = ISCN.parse(k);
    assert.equal(m.clones[0].unreadable, true, `${k}: ${why}`);
    assert.match(m.warnings.join(' '), re, `${k} should say why`);
  });
});

test('the acrocentrics are named, and a real Robertsonian is untouched', () => {
  // The message has to carry the rule, because "1 and 2 are not acrocentric" is the
  // fact the reader is missing, not a verdict on their typing.
  const w = ISCN.parse('45,XY,rob(1;2)(q10;q10)').warnings.join(' ');
  assert.match(w, /13, 14, 15, 21 and 22/, 'names which chromosomes are acrocentric');
  assert.match(w, /der\(1;2\)\(q10;q10\)/, 'and offers the notation that does fit');
  ['45,XY,rob(13;14)(q10;q10)', '45,XX,rob(14;21)(q10;q10)', '45,XY,rob(21;21)(q10;q10)',
    '45,XX,rob(13;15)(q10;q10)', '46,XX,rob(14;21)(q10;q10),+21']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].unreadable, false, k));
});

test('a ploidy level is never checked against the count', () => {
  // A check that <3n> must agree with the number in front of it was added here and was
  // wrong. The angle brackets state the ploidy the gains and losses are expressed
  // AGAINST, not a claim about the count. ISCN 6.3.7 f gives 81<3n> ("even though the
  // count is in the near-tetraploid range") and 58<2n> ("in the hypotriploid range ...
  // reported relative to a diploid chromosome number") as correct, and says outright
  // that exceptions are made where biologically significant. There is no arithmetic
  // here to check, so the rule is gone and these must all pass.
  ['45<2n>,XY,-21', '69<3n>,XXX', '92<4n>,XXYY', '70<3n>,XXY,+8',
    '81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21',
    '58<2n>,XY,+X,+4,+6,+8,+9,+10,+14,+14,+17,+18,+21,+21', '46<3n>,XY']
    .forEach((k) => assert.equal(ISCN.parse(k).clones[0].unreadable, false, k));
});

test('a written-form fault keeps its drawing and is told the rule', () => {
  // Nothing here changes what is drawn, so refusing would withhold a correct picture
  // over a spelling. This is the same call listing order gets.
  [
    ['46,XY,del(5)(p15.2p15.3)', /along the chromosome/, /del\(5\)\(p15.3p15.2\)/],
    ['46,XY,del(5)(q33q13)', /along the chromosome/, /del\(5\)\(q13q33\)/],
    ['46,XY,inv(9)(q13p11)', /along the chromosome/, /inv\(9\)\(p11q13\)/],
    ['46,XY,del(5)(p15.2),del(5)(p15.2)', /written once with a multiplier/, /del\(5\)\(p15.2\)x2/],
    ['46c,XY', /goes on the change it describes/, /46/],
  ].forEach(([k, rule, fix]) => {
    const m = ISCN.parse(k);
    assert.equal(m.clones[0].unreadable, false, `${k} still draws`);
    assert.match(m.warnings.join(' '), rule, `${k} names the rule`);
    assert.match(m.warnings.join(' '), fix, `${k} shows the corrected form`);
  });
});

test('breakpoint order is only corrected where it carries no meaning', () => {
  // dup is excluded on purpose: there the order distinguishes a direct duplication
  // from an inverted one and the renderer reads it, so "correcting" it would change
  // the karyotype. The two dup order tests above are the other half of this.
  assert.equal(ISCN.parse('46,XY,dup(1)(q25q22)').warnings.length, 0,
    'an inverted duplication is not a reversed deletion');
  ['46,XY,del(5)(q13q33)', '46,XY,inv(9)(p12q13)', '46,XX,del(11)(q23.1q23.3)',
    '46,XY,inv(3)(q21.3q26.2)', '46,XX,del(22)(q11.2q11.2)',
    // ISCN 2024 Table 3 and 5.5.2 b: breakpoints run pter to qter, so on the SHORT arm
    // the distal (higher-numbered) band is written first. 4.2.1 j.iii spells it out on
    // dup(1)(p34~32p22): "the distal breakpoint is in 1p34 ... and the proximal
    // breakpoint is in band 1p22". This file first pinned the opposite and shipped it.
    '46,XX,del(4)(p15.3p15.2)', '46,XY,dup(1)(p34p22)', '46,XY,del(5)(p15.2)']
    .forEach((k) => assert.equal(ISCN.parse(k).warnings.length, 0, `${k} is already in order`));
  // Sub-bands compare as decimals: q11.23 sits inside q11.2 and before q11.3, which
  // comparing 23 against 3 as integers gets backwards.
  assert.equal(ISCN.parse('46,XY,del(9)(q11.2q11.23)').warnings.length, 0, 'q11.2 then q11.23 is in order');
  // An uncertain band has no single position on that axis, and ISCN writes plenty of
  // them. Saying nothing beats guessing which end of a range to compare.
  ['46,XX,del(1)(q21~24)', '46,XY,dup(1)(p34~32p22)', '46,XX,t(3;12)(q27~29;q13~15)']
    .forEach((k) => assert.equal(ISCN.parse(k).warnings.length, 0, `${k} is uncertain, not reversed`));
});

test('the sex chromosomes are reordered, never edited', () => {
  const m = ISCN.parse('46,YX');
  assert.equal(m.suggestion, '46,XY', 'offers the canonical order');
  assert.match(m.warnings.join(' '), /written with every X before every Y/, 'and the rule behind it');
  assert.equal(ISCN.parse('48,XYXY').suggestion, '48,XXYY');
  assert.equal(ISCN.parse('mos 46,YX[10]/46,XX[10]').suggestion, 'mos 46,XY[10]/46,XX[10]',
    'a cell count after the sex field does not hide it');
  // Every canonical spelling is left exactly as written. A sort that "fixed" one of
  // these would be editing a correct karyotype.
  ['46,XY', '45,X', '47,XXY', '47,XYY', '49,XXXXY', '48,XXYY', '46,XX', '69,XXY', '47,XXY[20]']
    .forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

// ---- the cell count in square brackets ---------------------------------------
// ISCN 4.4.1 d: "Absolute cell numbers are given in square brackets ([ ])", and in a
// karyotype designation that is the only thing they hold. Anything else in there is
// diagnosable on sight, and before this it was not diagnosed at all: the count pattern
// wants digits, so "[-1]" never registered as the cell count. It stayed stuck to the
// last change, and the reader was told “[-1]” in “t(9;22)(q34;q11.2)[-1]” is not one
// KaryoDraw can place — the wrong field, and a rule about commas they had not broken.
test('brackets that are not a cell count are named as the cell count', () => {
  [
    ['46,XY,t(9;22)(q34;q11.2)[-1]', /how many cells were counted/],
    ['47,XX,+21[-1]', /how many cells were counted/],
    ['47,XX,+21[2.5]', /whole number/],
    ['47,XX,+21[abc]', /how many cells were counted/],
    ['47,XX,+21[]', /how many cells were counted/],
    ['46,XX[10]/47,XX,+21[-1]', /how many cells were counted/],
  ].forEach(([k, re]) => {
    const w = ISCN.parse(k).warnings.join(' ');
    assert.match(w, re, k);
    // The change itself is fine. Blaming it sends the reader to rewrite the one part
    // of the designation that was right.
    assert.ok(!/is not one KaryoDraw can place|is not a change KaryoDraw recognizes/.test(w),
      `${k} should name the count, not the change: ${w}`);
  });
});

test('an unclosed bracket is told to close, and a composite keeps its own rule', () => {
  assert.match(ISCN.parse("47,XX,+21[20").warnings.join(" "), /needs its closing bracket: “\[20\]”/);
  assert.match(ISCN.parse('47,XX,+21[cp-1]').warnings.join(' '), /composite karyotype/);
});

// The missing-comma repair used to split inside the brackets: "+21[-1]" came back as
// "+21[,-1]", a string with no reading at all, offered as the karyotype the reader meant.
test('a sign inside the cell count is not read as a missing comma', () => {
  const m = ISCN.parse('47,XX,+21[-1]');
  assert.ok(!/\[,/.test(m.suggestion || ''), `no repair may split the brackets: ${m.suggestion}`);
  assert.ok(!/is two of them/.test(m.warnings.join(' ')), 'and none may claim two changes');
  // The rule this one guards still works where it belongs.
  assert.equal(ISCN.parse('43,XY,-2-21').suggestion, '43,XY,-2,-21');
});

test('a real cell count is left alone', () => {
  ['46,XY[20]', '47,XY,+8[cp10]', 'mos 45,X[12]/46,XX[18]', '46,XX,t(9;22)(q34;q11.2)[10]/46,XX[10]',
    '48,XX,+8,+21c[20]', '46,XXYc,-X[10]/47,XXYc[2]', '46,XY'].forEach((k) => {
    const m = ISCN.parse(k);
    assert.equal(m.warnings.length, 0, `${k}: ${JSON.stringify(m.warnings)}`);
    assert.ok(m.clones.every((c) => !c.badCells), k);
  });
  assert.equal(ISCN.parse('47,XY,+8[cp10]').clones[0].cellCount, 10);
  assert.equal(ISCN.parse('47,XY,+8[cp10]').clones[0].composite, true);
});

// A genome build and a nuclei-scored fraction are also square brackets, and neither is
// a cell count. They belong to descriptions this app does not draw (ISCN Chapters 7 and
// 8), which carry their own message, so the count rule must not be aimed at them.
test('brackets outside a karyotype designation keep their own message', () => {
  ['arr[GRCh38]', 'nuc ish 21q22(RUNX1x3)[100/200]'].forEach((k) => {
    assert.ok(!/how many cells were counted/.test(ISCN.parse(k).warnings.join(' ')), k);
  });
});

// ---- breakpoints on one chromosome -------------------------------------------
// ISCN 4.2.1 h: "If the rearrangement involves a single chromosome the breakpoints are
// not separated by a semicolon (;), e.g., inv(2)(p23q11.2), del(4)(p15.3p16.1),
// r(18)(p11.2q23)". The semicolon separates different chromosomes (4.2.1 g).
//
// del(15)(q11.2;q13) drew, and drew the wrong deletion: the two sides parse as separate
// breakpoint GROUPS, a deletion takes its bands from the first group alone, and the
// picture came out as a terminal loss from 15q11.2 with the second breakpoint dropped.
// The decode said "the part around 15q11.2", describing a larger deletion than the one
// that was typed, and nothing objected.
test('a semicolon between breakpoints on one chromosome is named and repaired', () => {
  [['46,XX,del(15)(q11.2;q13)', '46,XX,del(15)(q11.2q13)'],
   ['46,XX,inv(2)(p23;p13)', '46,XX,inv(2)(p23p13)'],
   ['46,XY,r(18)(p11.2;q23)', '46,XY,r(18)(p11.2q23)'],
   ['46,XY,dup(1)(q22;q25)', '46,XY,dup(1)(q22q25)'],
   // A comma there is the same mistake. It must NOT be answered with the
   // comma-inside-parentheses rule, which would offer the semicolon form.
   ['46,XX,del(15)(q11.2,q13)', '46,XX,del(15)(q11.2q13)'],
   ['mos 46,XX,del(15)(q11.2;q13)[10]/46,XX[10]', 'mos 46,XX,del(15)(q11.2q13)[10]/46,XX[10]'],
  ].forEach(([bad, want]) => {
    const m = ISCN.parse(bad);
    assert.equal(m.suggestion, want, bad);
    assert.match(m.warnings.join(' '), /same chromosome are written one after the other/, bad);
    assert.ok(!/separate values with a semicolon/.test(m.warnings.join(' ')),
      `${bad} must not be told to use the semicolon it just used`);
  });
  // An insertion is repaired the same way but taught its OWN rule: 5.5.9.1
  // puts the insertion site first, then the segment's breakpoints, in one
  // run. The generic two-breakpoint lesson does not explain why the site
  // leads, and Dan flagged it as dubious on exactly this shape.
  const mi = ISCN.parse('46,XY,ins(2)(q13;p23;p13)');
  assert.equal(mi.suggestion, '46,XY,ins(2)(q13p23p13)');
  assert.match(mi.warnings.join(' '), /5\.5\.9\.1/);
  assert.match(mi.warnings.join(' '), /insertion site first/);
});

test('one mistake, one message', () => {
  // The repair alone leaves the operation to be parsed from the text as typed, where
  // inv(2)(p23;p13) reads as two groups of one band each and is told an inversion needs
  // two bands: a second message, about a rule the reader did not break.
  const w = ISCN.parse('46,XX,inv(2)(p23;p13)').warnings;
  assert.equal(w.length, 1, JSON.stringify(w));
  // Count alone would pass on the old behaviour, where the arity message was the one
  // message. It has to be the message that names the mistake.
  assert.match(w[0], /same chromosome are written one after the other/, w[0]);
});

test('the semicolon is left alone where ISCN puts it', () => {
  // Between chromosomes (4.2.1 g), in a derivative chain whose sub-operations carry
  // their own chromosomes, and in an insertion written between two chromosomes.
  ['46,XY,t(9;22)(q34;q11.2)', '45,XY,rob(13;14)(q10;q10)', '46,XY,ins(5;2)(p14;q22q32)',
   '46,XY,der(9)del(9)(p11)t(9;22)(q34;q11.2)', '46,XX,t(2;7;5)(q21;p13;q31)',
   '46,XY,del(5)(p15.2)', '46,XY,inv(9)(p11q13)', '46,X,i(X)(q10)', '46,XY,r(13)(p11q34)',
   '46,XX,add(19)(p13.3 or q13.3)', '46,XY,del(5)(q13q33)']
    .forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

test('a chromosome pair written with a comma is still the comma rule', () => {
  // t(9,22) names two chromosomes with a typo in the separator, so the repair is the
  // semicolon. The single-chromosome rule must not reach it and join the bands.
  assert.equal(ISCN.parse('46,XY,t(9,22)(q34;q11.2)').suggestion, '46,XY,t(9;22)(q34;q11.2)');
});

// ---- a repair has to be a karyotype you could have typed ----------------------
// Pasting `46,XY,der(13;14)(q10;q10), “+14”` out of a document produced all three of
// these at once: a suggestion with a space in the middle of it, a message naming two
// characters that rendered as “”, “” because they were quoted with the very marks they
// were about, and an input box silently rewritten to the clean karyotype, so the reader
// was told to remove characters that were no longer on screen and offered a fix that
// looked identical to what they already had.
test('a repair carries no whitespace', () => {
  [['46,XY,der(13;14)(q10;q10), “+14”', '46,XY,der(13;14)(q10;q10),+14'],
   ['46,XY, +21.', '46,XY,+21'],
   ['46, XY, der(13;14)(q10;q10) “x”', '46,XY,der(13;14)(q10;q10)x'],
  ].forEach(([bad, want]) => assert.equal(ISCN.parse(bad).suggestion, want, bad));
});

test('the two spaces ISCN does write survive a repair', () => {
  // 4.4.1 m: mos/chi is followed by a space. 4.4.1 i: "or" is written with spaces.
  assert.equal(ISCN.parse('mos 45,X[12]/46,XX[18].').suggestion, 'mos 45,X[12]/46,XX[18]');
  assert.equal(ISCN.parse('46,XX,add(19)(p13.3 or q13.3).').suggestion, '46,XX,add(19)(p13.3 or q13.3)');
});

test('spaces on their own are still not a fault', () => {
  // The normalization is applied only once a repair is warranted for another reason.
  // Applied before that test, every spaced karyotype would become a "did you mean",
  // and a repair on offer refuses the drawing.
  ['47, XX, +21', '46,XY,r(13) (p11q34)', 'mos 45,X[12]/46,XX[18]', '46, XY']
    .forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

test('a character that cannot be quoted is named instead', () => {
  const w = ISCN.parse('46,XY,+21“”').warnings.join(' ');
  assert.match(w, /a curly opening quotation mark/, w);
  assert.match(w, /a curly closing quotation mark/, w);
  assert.ok(!/[“”]{2}/.test(w), `the marks must not be quoted with themselves: ${w}`);
  // One stray, named, still reads as a sentence.
  assert.match(ISCN.parse('46,XY,+21"').warnings.join(' '), /^A straight quotation mark is not a character ISCN uses/);
  // A character that survives being quoted is still shown.
  assert.match(ISCN.parse('46,XY,+21%').warnings.join(' '), /“%” is not a character ISCN uses/);
});

test('the canonical designation fixes whitespace and nothing else', () => {
  // It is what the page puts in the input box, the drawing and the share URL. Anything
  // else it silently removed would be a fault the app is about to name, pointing the
  // reader at characters they can no longer see.
  assert.equal(ISCN.parse('46,XY, +21.').normalized, '46,XY,+21.', 'the period stays to be named');
  assert.equal(ISCN.parse('46,XY,+21“”').normalized, '46,XY,+21“”', 'and so do the quotation marks');
  assert.equal(ISCN.parse('46,XX,del(15)(q11.2;q13)').normalized, '46,XX,del(15)(q11.2;q13)');
  // Whitespace, though, is fixed silently: it is the one thing the app does not object to.
  assert.equal(ISCN.parse('47, XX, +21').normalized, '47,XX,+21');
  assert.equal(ISCN.parse('mos 45,X[12] / 46,XX[18]').normalized, 'mos 45,X[12]/46,XX[18]');
});

test('a stated ploidy marker on the count parses, and junk after the count is refused', () => {
  // 47<2n> states the ploidy level the gains and losses are expressed against
  // (ISCN 6.3.7 f) and must keep parsing cleanly.
  const ok = ISCN.parse('47<2n>,XY,+8');
  assert.equal(!!ok.clones[0].unreadable, false, '47<2n> is valid ISCN');
  assert.equal(ok.clones[0].ploidy, 2);
  assert.equal(ok.warnings.length, 0, 'and warns about nothing');
  // The unclosed marker and outright junk used to sail through: the count regex
  // took the leading digits and nothing ever read the rest of the field, so
  // 47<2n and 47<>2<.>n both drew without a word.
  for (const bad of ['47<2n,XY,+8', '47<>2<.>n,XY,+8', '47banana,XY,+8']) {
    const m = ISCN.parse(bad);
    assert.ok(m.clones[0].unreadable, `${bad} must be flagged unreadable`);
    assert.ok(m.warnings.some((w) => /after the count/.test(w)), `${bad} gets a warning naming the junk`);
  }
  // The one honest guess: an unclosed ploidy marker suggests its closed form.
  const un = ISCN.parse('47<2n,XY,+8');
  assert.ok(un.warnings.some((w) => w.includes('47<2n>')), 'the unclosed marker gets a did-you-mean');
});

// splitBands wants an arm letter before the digits, so "q11.1-11.2" kept q11.1 and
// dropped the rest with nothing said. The figure then showed a single precise cut the
// writer had not asked for, which is the one thing this parser exists not to do.
// ISCN 4.2.1 writes a range with a tilde and repeats the arm letter (1p34~p35), and
// that spelling already parses to both bands, so the message names it.
test('a breakpoint range that loses a band says so, and names the ISCN form', () => {
  for (const k of ['46,XY,t(X;19)(q11.1-11.2;p13.3)',
                   '46,XY,der(19)t(X;19)(q11.1-11.2;p13.3)',   // der() sub-op, same splitBands
                   '46,XX,del(5)(p15.2-15.3)']) {
    const w = ISCN.parse(k).warnings.join(' ');
    assert.match(w, /tilde/, k);
    assert.match(w, /q11\.1~q11\.2/, k + ' shows the correct spelling');
  }
});

// A tilde range is correct ISCN and must stay silent. 4.2.1 allows the repeated arm
// letter, and ISCN 2024 prints the shorthand inside a breakpoint itself:
// der(18)t(18;19)(q21;p11~12). Warning on either would be warning on correct notation.
test('tilde ranges are correct ISCN and are not flagged', () => {
  for (const k of ['46,XY,der(19)t(X;19)(q11.1~q11.2;p13.3)',
                   '46,XY,der(19)t(X;19)(q11.1~11.2;p13.3)',
                   '46,XY,der(18)t(18;19)(q21;p11~12)',
                   '46,XX,del(1)(q21~24)']) {
    assert.ok(!/tilde/.test(ISCN.parse(k).warnings.join(' ')), k + ' must not warn');
  }
  const r = ISCN.parse('46,XY,der(19)t(X;19)(q11.1~q11.2;p13.3)');
  // join, not deepEqual: the parser runs in a vm realm, so its arrays fail a
  // reference-equal prototype check even when the contents match.
  assert.equal(r.clones[0].aberrations[0].subOps[0].breakpoints[0].join(','), 'q11.1,q11.2');
});

test('ordinary breakpoint groups are not flagged as losing a band', () => {
  for (const k of ['46,XY,t(9;22)(q34;q11.2)', '46,XX,del(15)(q11.2q13)', '46,XY,inv(9)(p11q13)',
                   '46,XY,r(13)(p11q34)', '46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)',
                   '45,XX,rob(13;14)(q10;q10)', '46,XX,del(5)(p15.2)']) {
    assert.ok(!/tilde/.test(ISCN.parse(k).warnings.join(' ')), k + ' must not warn');
  }
});

// ISCN omits the sex field entirely when the sex chromosomes are themselves in the
// rearrangement. ISCN 2024 section 5.5.18.1.1 prints both forms:
//   iv. 46,t(X;Y)(q22;q11.23)
//   v.  46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31)
// Read as a sex field, parseSex harvested the X and Y out of the operation and threw
// the rest away one character at a time, so t(X;Y) disappeared from the aberration
// list and the app drew a normal 46,XY. In example v the FIRST translocation was lost
// and the second survived, which is worse: the figure looked complete.
test('an omitted sex field keeps the rearrangement instead of eating it', () => {
  const r = ISCN.parse('46,t(X;Y)(q22;q11.23)');
  assert.equal(r.warnings.length, 0, r.warnings.join(' '));
  assert.equal(r.clones[0].aberrations.length, 1, 'the translocation survives');
  assert.equal(r.clones[0].aberrations[0].raw, 't(X;Y)(q22;q11.23)');
  assert.equal(r.clones[0].complement.X, 1, 'one X, named in the translocation');
  assert.equal(r.clones[0].complement.Y, 1, 'one Y, named in the translocation');
});

test('both translocations survive when the sex field is omitted', () => {
  const r = ISCN.parse('46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31)');
  assert.equal(r.warnings.length, 0, r.warnings.join(' '));
  assert.equal(r.clones[0].aberrations.map((a) => a.raw).join(' '),
    't(X;18)(p11.2;q11.2) t(Y;1)(q11.23;p31)');
  assert.equal(r.clones[0].complement.X, 1);
  assert.equal(r.clones[0].complement.Y, 1);
});

test('the omitted sex field round-trips as written', () => {
  for (const k of ['46,t(X;Y)(q22;q11.23)', '46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31)']) {
    assert.equal(ISCN.parse(k).clones[0].raw, k);
  }
});

// A leading operation that names NO sex chromosome is not the ISCN omission, it is a
// karyotype missing its sex field. That still has to be caught: 46 is as consistent
// with XX as with XY, so there is nothing to draw from.
test('a leading operation with no sex chromosome is still a missing sex field', () => {
  const r = ISCN.parse('46,t(9;22)(q34;q11.2)');
  assert.ok(r.clones[0].sexMissing, 'flagged as missing, not treated as an omission');
});

// A mistyped sex field must keep reading as one, not get promoted to an aberration.
test('a mistyped sex field is still read as a sex field', () => {
  for (const k of ['46,XQ,+21', '46,QQ,+21', '43,XZY,+8']) {
    assert.ok(!ISCN.parse(k).clones[0].sexOmitted, k + ' is a bad sex field, not an omission');
  }
});

// A fragile site is present in every cell — the FMR1 expansion is constitutional —
// and only EXPRESSES cytogenetically in a fraction of metaphases grown under stress.
// Writing that fraction with a slash is legal ISCN (4.5.3 b) and is how the old
// reports were written, but a slash means two cell lines from one zygote (4.5.2 a),
// which is not what a fragile-site count is. A note, never a warning: the notation
// is correct, and warning on correct input is how a warning box loses its authority.
test('a fragile site written as a mosaic gets a note about what the slash means', () => {
  const m = ISCN.parse('46,X,fra(X)(q27.3)[5]/46,XX[45]');
  assert.equal(m.warnings.length, 0, 'correct ISCN must not warn');
  assert.ok(m.note, 'a neutral note beside the drawing');
  assert.match(m.note.text, /express/i, 'names what the count is actually scoring');
  assert.ok(!m.note.fix, 'no rewrite on offer: the notation as written is correct');
});

test('the fragile-site note fires only when the fragile site is in a mosaic', () => {
  assert.ok(!ISCN.parse('46,X,fra(X)(q27.3)').note, 'single clone, nothing to explain');
  assert.ok(!ISCN.parse('mos 45,X[12]/46,XX[18]').note, 'a real two-cell-line mosaic');
  assert.ok(!ISCN.parse('46,XX,fra(11)(q23)').note);
});

// derLabel had no fra case, so the red sub-label under a fragile-site chromosome
// fell through to the bare chromosome name: 46,X,fra(X)(q27.3) drew its second X
// captioned only "X", while every other abnormality names its operation (del(5),
// dup(1), i(X)...). The caption is the same kind(chrom) shorthand the rest get.
test('a fragile-site chromosome is sub-labelled fra(N) like every other abnormality', () => {
  const fraSlot = (k, c) => (ISCN.parse(k).clones[0].slots[c] || []).find((i) => i.kind === 'fra');
  assert.equal(fraSlot('46,X,fra(X)(q27.3)', 'X').label, 'fra(X)');
  assert.equal(fraSlot('46,XX,fra(11)(q23)', '11').label, 'fra(11)');
});
