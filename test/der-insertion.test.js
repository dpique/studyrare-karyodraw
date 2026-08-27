'use strict';
// der(N) carrying an ins(...) sub-operation (ISCN 5.5.2, and the der+ins
// examples printed throughout ISCN 2024, e.g. 46,XY,der(3)ins(16;3)(p12;p21p13)dmat).
//
// Found by a visitor: 46,XY,der(15)ins(15)(p11;q23q26) parsed with zero
// warnings, passed the draw gate, and drew an untouched full-length chromosome
// 15 labeled der(15). applyDerSubOps only knew del/dup/inv, so the ins was
// dropped in silence, and the decode said nothing about it either. The one
// anonymous "Not right?" click, with no message attached, carried the URL that
// exposed it, which is exactly what the quick-flag exists to do.
//
// The rule these tests pin: a derivative draws its insertion (intrachromosomal
// moves, and both the recipient and donor sides of an interchromosomal one),
// and any der sub-operation the renderer cannot apply refuses the whole
// drawing with a teaching message. A silent no-op is the worst failure this
// app can produce, because the figure looks authoritative and is false.
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
const IDEO = win.IDEOGRAM;

const clone0 = (k) => ISCN.parse(k).clones[0];
const warns = (k) => ISCN.parse(k).warnings;
// The same hard gate index.html applies (and iscn-conformance.test.js mirrors).
const refused = (k) => {
  const m = ISCN.parse(k);
  return !m.clones.length || m.clones.every((c) => c.modalNumber == null) ||
    !!m.suggestion || m.clones.some((c) => c.unreadable || c.countWrong || c.unaccounted);
};
const derInst = (k, chrom) => (clone0(k).slots[chrom] || []).find((i) => i.kind !== 'normal');
const built = (k, chrom) => Karyo.buildInstance(derInst(k, chrom));
const totalBp = (segs) => segs.reduce((s, g) => s + (g.to - g.from), 0);
const decodeText = (k) => Teach.decode(clone0(k)).map((r) => r.text).join(' ');

// ---- parsing -------------------------------------------------------------

test('a same-chromosome ins sub-op with a semicolon is repaired with the same lesson as the standalone form', () => {
  const w = warns('46,XY,der(15)ins(15)(p11;q23q26)').join(' ');
  assert.match(w, /5\.5\.9\.1/, 'the insertion cites its own rule, not the generic two-breakpoint one');
  assert.match(w, /insertion site first/, 'and teaches why p11 leads');
  const sub = clone0('46,XY,der(15)ins(15)(p11;q23q26)').aberrations[0].subOps[0];
  assert.equal(sub.breakpoints.length, 1, 'the two groups merge into one');
  assert.equal(sub.breakpoints[0].join(','), 'p11,q23,q26');
});

test('the no-semicolon form parses clean and is not refused', () => {
  assert.equal(warns('46,XY,der(15)ins(15)(p11q23q26)').join(' '), '');
  assert.equal(refused('46,XY,der(15)ins(15)(p11q23q26)'), false);
});

// ---- geometry ------------------------------------------------------------

test('der(15) with an intrachromosomal ins draws the move, identically to the plain ins', () => {
  const der = built('46,XY,der(15)ins(15)(p11q23q26)', '15');
  const plain = built('46,XY,ins(15)(p11q23q26)', '15');
  const key = (b) => b.segments.map((s) => `${s.chrom}:${s.from}-${s.to}${s.reversed ? 'R' : ''}`).join('|');
  assert.equal(key(der), key(plain), 'same segments as the standalone insertion');
  assert.ok(der.segments.length >= 3, 'the chromosome is split, not drawn untouched');
  assert.equal(totalBp(der.segments), IDEO.data['15'].length, 'an internal move preserves length');
  assert.equal(der.segments.filter((s) => s.hasCen).length, 1, 'monocentric');
});

test('the recipient derivative grows by the donated segment', () => {
  const b = built('46,XY,der(5)ins(5;2)(q31;p23p13)dmat', '5');
  assert.ok(b.segments.some((s) => s.chrom === '2'), 'a piece of chromosome 2 is in the der(5)');
  assert.ok(totalBp(b.segments) > IDEO.data['5'].length, 'the recipient is longer than a normal 5');
  assert.equal(b.segments.filter((s) => s.hasCen).length, 1, 'monocentric');
});

test('the donor derivative shrinks by the excised segment (ISCN prints this exact karyotype)', () => {
  const b = built('46,XY,der(3)ins(16;3)(p12;p21p13)dmat', '3');
  assert.ok(b.segments.every((s) => s.chrom === '3'), 'still made only of chromosome 3');
  assert.ok(totalBp(b.segments) < IDEO.data['3'].length, 'the donated segment is gone');
});

test('an ins sub-op composes with a del on the same derivative', () => {
  const b = built('46,XX,der(1)del(1)(p34p22)ins(1;17)(p34;q25q11.2)', '1');
  assert.ok(b.segments.some((s) => s.chrom === '17'), 'the 17 segment is spliced in');
  const ownBp = b.segments.filter((s) => s.chrom === '1').reduce((s, g) => s + (g.to - g.from), 0);
  assert.ok(ownBp < IDEO.data['1'].length, 'and the deletion still removed chromosome 1 material');
});

// ---- refusals: no der sub-op may be dropped in silence --------------------

test('add and hsr sub-ops draw as overlays instead of vanishing', () => {
  // der(5)add(5)(p15.3)add(5)(q23) and the hsr forms are printed in ISCN 2024
  // and used to draw as untouched chromosomes, silently.
  const b1 = built('46,XX,der(5)add(5)(p15.3)add(5)(q23)', '5');
  assert.equal((b1.overlays || []).filter((o) => o.type === 'add').length, 2, 'both unknown blocks are hatched');
  const b2 = built('46,XX,der(1)ins(1;7)(q21;p21p11.2)hsr(1;7)(q21;p11.2)', '1');
  assert.ok(b2.segments.some((s) => s.chrom === '7'), 'the inserted 7 segment is drawn');
  assert.equal((b2.overlays || []).filter((o) => o.type === 'hsr').length, 1, 'and the hsr block rides the junction band');
});

test('a der carrying a sub-op the renderer cannot apply refuses, and says why', () => {
  const k = '46,XX,der(1)r(1;3)(p36.1q23;q21q27)';
  assert.equal(refused(k), true, 'refused rather than drawn as an untouched chromosome 1');
  const w = warns(k).join(' ');
  assert.match(w, /correct ISCN/, 'the notation is never blamed');
  assert.match(w, /5\.5\.16/, 'the ring-derivative rule is cited');
});

test('an ins plus a t on one derivative refuses rather than drawing half', () => {
  const k = '46,XY,der(7)ins(7;3)(q22;q11q21)t(2;7)(q21;q36)';
  assert.equal(refused(k), true);
  assert.match(warns(k).join(' '), /correct ISCN/);
});

test('an ins from an undetermined donor refuses with the ? lesson', () => {
  const k = '46,XY,der(5)ins(5;?)(q32;?)';
  assert.equal(refused(k), true);
  const w = warns(k).join(' ');
  assert.match(w, /4\.2\.1 k/, 'the ? rule is cited');
  assert.match(w, /nothing to draw/, 'and the reason there is no figure is stated');
});

// ---- decode ---------------------------------------------------------------

test('the decode explains the insertion instead of stopping at the centromere sentence', () => {
  const t = decodeText('46,XY,der(15)ins(15)(p11q23q26)');
  assert.match(t, /15q23/, 'the moved segment is named');
  assert.match(t, /15q26/);
  assert.match(t, /15p11/, 'and where it went');
  const t2 = decodeText('46,XY,der(5)ins(5;2)(q31;p23p13)dmat');
  assert.match(t2, /chromosome 2/, 'the donor chromosome is named');
  assert.match(t2, /5q31/, 'and the site on the derivative');
});

// ---- the der() wrapper, and what the band order says ----------------------
// From auditing an outside answer against the app: ISCN 5.5.3 a defines a
// derivative as rebuilt either by a rearrangement involving two or more
// chromosomes or by MORE THAN ONE change within a single chromosome. So
// der(15)ins(15)(p11q23q26), one single-chromosome change in a wrapper,
// is redundant spelling; the app accepted it without a word. It stays
// accepted and drawn (warning on interpretable input is how the box loses
// authority) and the plain form is offered as a neutral note. The same
// audit showed the decode never named what the band order encodes: q23q26
// keeps the segment's own orientation, q26q23 would turn it end-for-end.

test('a der wrapping a single one-chromosome change is offered the plain spelling as a note', () => {
  const m = ISCN.parse('46,XY,der(15)ins(15)(p11q23q26)');
  assert.equal(m.warnings.join(' '), '', 'nothing to warn about');
  assert.ok(m.note, 'a note beside the drawing, never a warning');
  assert.match(m.note.text, /5\.5\.3/, 'the derivative definition is cited');
  assert.equal(m.note.fix, '46,XY,ins(15)(p11q23q26)');
  const md = ISCN.parse('46,XY,der(9)del(9)(p12)');
  assert.ok(md.note && md.note.fix === '46,XY,del(9)(p12)', 'a lone del in the wrapper is the same redundancy');
});

test('the note stays away from true derivatives and from repaired spellings', () => {
  assert.equal(ISCN.parse('46,XY,der(9)del(9)(p12)del(9)(q31)').note, null,
    'two changes make a true derivative (ISCN 5.5.3 c i prints this one)');
  assert.equal(ISCN.parse('46,XY,der(5)ins(5;2)(q31;p23p13)dmat').note, null,
    'two chromosomes make a true derivative');
  assert.equal(ISCN.parse('46,XY,der(15)ins(15)(p11;q23q26)').note, null,
    'the semicolon form already carries its spelling note, and a note never shares the box');
});

test('the decode names the orientation the band order encodes', () => {
  assert.match(decodeText('46,XY,ins(15)(p11q23q26)'), /keeps its own orientation/,
    'proximal band first: the segment reads the same way in its new place');
  assert.match(decodeText('46,XX,ins(2)(p13q31q21)'), /end-for-end/,
    'distal band first: an inverted insertion (ISCN 5.5.9.1 i)');
  assert.match(decodeText('46,XY,der(5)ins(5;2)(q31;p13p23)dmat'), /end-for-end/,
    'the der-carried inter form names it too when inverted');
});
