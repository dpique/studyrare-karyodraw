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
  assert.ok(r.warnings.some((w) => /one karyotype at a time|not supported/i.test(w)));
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
  assert.match(warnOf('45,XX,t(13;15)(q10;q10)'), /number at the start says 45, but this karyotype describes 46/);
  assert.match(warnOf('47,XY,rob(14;21)(q10;q10),+21'), /number at the start says 47/);
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
    /number at the start says 46, but this karyotype describes 44/);
  assert.equal(ISCN.parse('44,XY,rob(14;21)(q10;q10),-21').warnings.length, 0, 'and stays quiet when it adds up');
});
