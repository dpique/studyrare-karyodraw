'use strict';
// Karyo.detailedForm renders a built chromosome in ISCN's detailed system (5.4.2.2),
// from the SAME segment list the figure is drawn from. That is the point of it: the
// notation and the picture cannot disagree, because they are the same data, and ISCN
// prints the expected answer for a hundred-odd karyotypes, so the picture can be
// checked against the standard rather than against our own reasoning about it.
//
// It has already paid for itself. Writing it found a translocation graft drawn
// end-for-end whenever the derivative's own break was on the p arm (#220), and an
// isodicentric with a p-arm breakpoint fused at the long-arm telomeres instead of at
// the breakpoint, which is the one join an isodicentric is defined by.
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
load('teach.js');
const ISCN = win.ISCN;
const Karyo = win.Karyo;
const CORPUS = require('./iscn-2024-detailed.js');

// Every abnormal chromosome the app builds for a karyotype, as detailed forms.
function forms(k) {
  const out = [];
  let model;
  try { model = ISCN.parse(k); } catch { return out; }
  if (!model.clones || !model.clones.length) return out;
  if (model.suggestion || model.clones.some((c) => c.unreadable)) return out;
  for (const clone of model.clones) {
    for (const ch of Object.keys(clone.slots || {})) {
      for (const inst of clone.slots[ch] || []) {
        if (inst.kind === 'normal') continue;
        let d;
        try { d = Karyo.detailedForm(inst); } catch { continue; }
        if (d) out.push({ label: inst.label, detail: d });
      }
    }
  }
  return out;
}

test('detailedForm is exported and produces ISCN notation', () => {
  assert.equal(typeof Karyo.detailedForm, 'function');
  const [f] = forms('46,XX,idic(15)(q11.2)');
  assert.equal(f.detail, 'pter→q11.2::q11.2→pter');
});

// The oracle. Each generated pair must serialise to exactly the substring ISCN printed,
// with no allowance for near-misses: an endpoint off by one band, a segment in the wrong
// order or a graft the wrong way up all read as a mismatch, which is the whole value.
test('every generated karyotype matches the detailed form ISCN printed', () => {
  const wrong = [];
  for (const row of CORPUS) {
    if (!row.generated) continue;
    const built = forms(row.short);
    assert.ok(built.length, `${row.short}: marked generated but the app builds nothing`);
    for (const f of built) {
      if (row.detailed.indexOf(f.detail) < 0) {
        wrong.push(`${row.short}\n    ISCN  ${row.detailed}\n    ours  ${f.label}(${f.detail})`);
      }
    }
  }
  assert.deepEqual(wrong, [], `\n${wrong.join('\n')}\n`);
});

// The other half of a ledger: a gap must stay a gap until someone closes it on purpose.
// Without this the file would rot into a list of claims nobody re-checks, and a fix that
// happened to close one would land unnoticed and undocumented.
test('the recorded gaps are still gaps, so closing one is a deliberate act', () => {
  const surprises = [];
  for (const row of CORPUS) {
    if (row.generated) continue;
    assert.ok(row.needs, `${row.short}: a gap needs a stated reason`);
    const built = forms(row.short);
    if (built.length && built.every((f) => row.detailed.indexOf(f.detail) >= 0)) {
      surprises.push(`${row.short} now matches: flip it to generated:true and drop its "needs"`);
    }
  }
  assert.deepEqual(surprises, [], `\n${surprises.join('\n')}\n`);
});

// The two bugs this file found, pinned directly so they cannot come back quietly even
// if the corpus were edited. Both are ISCN's own printed strings.
test('an isodicentric fuses at its breakpoint, whichever arm it is on', () => {
  // ISCN 5.5.11 iv: 46,XX,idic(17)(p11.2) = (qter→p11.2::p11.2→qter). The two copies
  // meet at 17p11.2, the point the sister chromatids fused, and the long-arm telomeres
  // are the outer tips. Drawn the other way it joined qter to qter and put the
  // breakpoints out at the ends.
  assert.equal(forms('46,XX,idic(17)(p11.2)')[0].detail, 'qter→p11.2::p11.2→qter');
  // ISCN 5.5.4 f vii, the q-arm case, which was already right and must stay right.
  assert.equal(forms('46,XX,idic(21)(q22.3)')[0].detail, 'pter→q22.3::q22.3→pter');
});

test('a duplication is written as the two stretches it actually has', () => {
  // ISCN 5.5.5: dup(1)(q22q25) = (pter→q25::q22→qter). The model splits at every
  // operation boundary because the drawing needs the duplicated span separately to mark
  // it; the notation breaks only where the chromosome broke, so contiguous same-sense
  // pieces are one stretch.
  assert.equal(forms('46,XX,dup(1)(q22q25)')[0].detail, 'pter→q25::q22→qter');
});

test('a dicentric of two homologues repeats the chromosome number', () => {
  // ISCN 5.5.4 f i: dic(13;13)(q14;q32) = (13pter→13q14::13q32→13pter). Every segment
  // says 13, and the number is still written on every band, because two chromosomes
  // went into it. Keyed on how many chromosomes the aberration names, not on how many
  // distinct numbers appear in the segments.
  assert.equal(forms('45,XX,dic(13;13)(q14;q32)')[0].detail, '13pter→13q14::13q32→13pter');
});

// A der() built from a chain of joins. translocationSegments consumes one t and only
// one, so every join past the first was dropped and the derivative was drawn missing
// whole grafted pieces, with nothing said: der(1)t(1;3)(p32;q21)t(1;11)(q25;q13) came
// out as 3qter->3q21::1p32->1qter, chromosome 11 nowhere on it.
//
// The two shapes a chain takes are both here, because they cut on different sides.
// In the first, both joins name the derivative's OWN chromosome, so chromosome 1 is
// trimmed to the stretch between its two breaks and a partner hangs off each end. In
// the second, the later join names the GRAFT (t(3;7) after t(1;3)), so the chromosome 3
// piece is itself cut and chromosome 7 hangs off that. Getting the second right needs
// the surviving side read off the drawn orientation rather than the coordinate order:
// a reversed graft has its low coordinate at the bottom, and reading the attachment off
// the segment index alone kept the half that had been handed away.
test('a der() chain keeps every join, not just the first', () => {
  // ISCN 5.5.3 c: both joins on the derivative's own chromosome.
  assert.equal(forms('46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)')[0].detail,
    '3qter→3q21::1p32→1q25::11q13→11qter');
  // The partners the other way round, so the fix cannot be an accident of ordering.
  assert.equal(forms('46,XX,der(1)t(1;11)(p32;q13)t(1;3)(q25;q21)')[0].detail,
    '11qter→11q13::1p32→1q25::3q21→3qter');
  // ISCN 5.5.3 c: the second join names the graft, not the derivative.
  assert.equal(forms('46,XY,der(1)t(1;3)(p32;q21)t(3;7)(q28;q11.2)')[0].detail,
    '7qter→7q11.2::3q28→3q21::1p32→1qter');
  // A chain with an inversion in the middle: three joins and a flip, and the whole
  // sequence has to survive in order.
  assert.equal(forms('46,XX,der(8)t(8;17)(p23;q21)inv(8)(p22q13)t(8;22)(q22;q12)')[0].detail,
    '17qter→17q21::8p23→8p22::8q13→8p22::8q13→8q22::22q12→22qter');
});

test('a single join is untouched by the chain walk', () => {
  // The regression guard: the overwhelmingly common case has exactly one t, and the
  // walk must not reach it.
  assert.equal(forms('46,XY,t(9;22)(q34;q11.2)').map((f) => f.detail).join(' '),
    '9pter→9q34::22q11.2→22qter 22pter→22q11.2::9q34→9qter');
  assert.equal(forms('46,XX,der(1)t(1;3)(p22;q13.1)')[0].detail, '3qter→3q13.1::1p22→1qter');
});

// The round trip closes. The app reads the detailed system, converts it to the short
// form, draws it, and its own serialiser prints back the string that was typed. Neither
// half can drift without this failing, which is the strongest statement available that
// the reader and the writer agree.
test('what is typed in the detailed system comes back out of the renderer', () => {
  [['47,XX,+idic(15)(pter→q13::q13→pter)', 'pter→q13::q13→pter'],
    ['46,XX,del(5)(pter→q13::q33→qter)', 'pter→q13::q33→qter'],
    ['45,XX,dic(13;15)(13pter→13q22::15q24→15pter)', '13pter→13q22::15q24→15pter'],
  ].forEach(([typed, expected]) => {
    const built = forms(typed);
    assert.equal(built.length, 1, `${typed} draws one abnormal chromosome`);
    assert.equal(built[0].detail, expected, typed);
  });
});

// der(A;B): a derivative NAMED across two chromosomes. ISCN 5.4.3.1 b, "der refers to
// the chromosome(s) that has an intact centromere", so naming two means it carries two.
// 5.5.3 c ii describes 45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13) as "a dicentric
// derivative chromosome with centromeres of chromosomes 5 and 7. An acentric chromosome
// 3 segment (3q21→3q29) is inserted between the long arm of chromosome 5 and the short
// arm of chromosome 7."
//
// It was reaching the single-join builder, which keeps ONE centromere and grafts an
// acentric tip, so the figure was a monocentric der(5) with a piece of 7 hanging off it:
// the wrong number of centromeres, the wrong pieces, and the wrong caption.
test('a der() named across two chromosomes is built as the dicentric it is', () => {
  const built = (k) => {
    const clone = ISCN.parse(k).clones[0];
    let inst = null;
    Object.keys(clone.slots).forEach((ch) =>
      (clone.slots[ch] || []).forEach((i) => { if (i.kind !== 'normal') inst = i; }));
    return { label: inst.label, segs: Karyo.buildInstance(inst).segments, detail: Karyo.detailedForm(inst) };
  };

  // The joins chain 5 to 3 to 7, so the chromosome 3 piece sits between them.
  const a = built('45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)');
  assert.equal(a.detail, '5pter→5q22::3q21→3q29::7p13→7qter');
  assert.equal(a.segs.filter((s) => s.hasCen).length, 2, 'two centromeres, as ISCN says');
  assert.equal(a.label, 'der(5;7)', 'and named for both of them');

  // The same name with the joins chained the other way, 5 to 7 to 3, which leaves the
  // acentric chromosome 3 fragment trailing off the end instead of sandwiched.
  const b = built('45,XX,der(5;7)t(5;7)(q22;p13)t(3;7)(q21;q21)');
  assert.equal(b.detail, '5pter→5q22::7p13→7q21::3q21→3qter');
  assert.equal(b.segs.filter((s) => s.hasCen).length, 2);
});

// The chain is as long as the notation writes it. ISCN 5.5.3 puts no ceiling on how
// many rearrangements build one derivative, and a real CK case reads like the
// four-join chain below. The walk used to stop after eight steps (a fixed guard), and
// past that the build fell to the single-centromere path: a nine-join der(5;7) drew
// ONE centromere and 7pter→7p13, the acentric piece of chromosome 7, under a caption
// that names a dicentric. The decode beside it kept saying "dicentric ... built from
// nine joins", the same words-against-picture split as #227.
test('a der(5;7) chain keeps both centromeres at any length', () => {
  const built = (k) => {
    const clone = ISCN.parse(k).clones[0];
    let inst = null;
    Object.keys(clone.slots).forEach((ch) =>
      (clone.slots[ch] || []).forEach((i) => { if (i.kind !== 'normal') inst = i; }));
    return { segs: Karyo.buildInstance(inst).segments, detail: Karyo.detailedForm(inst) };
  };

  // Four joins: 5 to 3 to 11 to 12 to 7. This is the shape a complex-karyotype
  // report actually prints, and the detailed form is checkable against 5.4.3.2.
  const four = built('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)t(7;12)(p13;q24.1)');
  assert.equal(four.detail, '5pter→5q22::3q21→3q29::11q13→11q23::12q13→12q24.1::7p13→7qter');
  assert.equal(four.segs.filter((s) => s.hasCen).length, 2);

  // Nine joins, past the old eight-step guard.
  const nine = built('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)'
    + 't(12;14)(q24;q11.2)t(14;16)(q31;q11.2)t(16;18)(q22;q11.2)t(2;18)(q21;q21)'
    + 't(2;4)(q31;q21)t(4;7)(q31;p13)');
  assert.equal(nine.segs.map((s) => String(s.chrom)).join(','), '5,3,11,12,14,16,18,2,4,7');
  assert.equal(nine.segs.filter((s) => s.hasCen).length, 2, 'both named centromeres survive nine joins');
  const last = nine.segs[nine.segs.length - 1];
  assert.ok(last.hasCen, 'the chromosome 7 piece is the centric one, 7p13→7qter');
});

test('a sub-op on the second named chromosome is applied', () => {
  // ISCN 5.5.3 c iii is the same derivative plus del(7)(q32), and writes the truncated
  // end as an open break: "7p13→7q32:". Both the target segment and the coordinates
  // were hard-wired to the der's primary chromosome, so a deletion on chromosome 7 was
  // dropped in silence.
  const clone = ISCN.parse('45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)del(7)(q32)').clones[0];
  let inst = null;
  Object.keys(clone.slots).forEach((ch) =>
    (clone.slots[ch] || []).forEach((i) => { if (i.kind !== 'normal') inst = i; }));
  assert.equal(Karyo.detailedForm(inst), '5pter→5q22::3q21→3q29::7p13→7q32:');
});

test('a der() naming one chromosome is untouched by any of it', () => {
  // The regression guard. der(9)t(9;22) names ONE chromosome, so it keeps the
  // single-join geometry, one centromere and its own caption.
  const clone = ISCN.parse('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)').clones[0];
  let inst = null;
  Object.keys(clone.slots).forEach((ch) =>
    (clone.slots[ch] || []).forEach((i) => { if (i.kind !== 'normal') inst = i; }));
  assert.equal(inst.label, 'der(9)');
  assert.equal(Karyo.detailedForm(inst), ':9p12→9q34::22q11.2→22qter');
  assert.equal(Karyo.buildInstance(inst).segments.filter((s) => s.hasCen).length, 1);
});

// The whole-arm der(A;B) with trailing sub-ops, ISCN 5.5.3 c iv and the 4.2.1 f
// mosaic. The body is the two whole arms fused at the centromeres; del/dup/inv and
// t() sub-ops then modify one arm each. It used to bypass the whole-arm path (which
// demanded no sub-ops) and fall to the single-join builder, which drew a monocentric
// derivative of the WRONG chromosome: der(13;14)(q10;q10)t(9;14)(q22;q24) came out
// as a der(9) figure with the 13 nowhere on it. The detailed strings below are
// transcribed from the standard, so the geometry, the endpoint names, and the
// 5.4.2.2 e reading direction (the first-named chromosome's material first) are all
// checked against print rather than against our own reasoning.
test('a whole-arm der(A;B) carries its deletion and its graft', () => {
  const built = (k) => {
    const clone = ISCN.parse(k).clones[0];
    let inst = null;
    Object.keys(clone.slots).forEach((ch) =>
      (clone.slots[ch] || []).forEach((i) => { if (i.kind !== 'normal') inst = i; }));
    return { label: inst.label, segs: Karyo.buildInstance(inst).segments, detail: Karyo.detailedForm(inst) };
  };

  // 5.5.3 c iv verbatim: one long arm truncated at q22 (open end), material of 9
  // translocated onto the other at q24.1.
  const a = built('45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
  assert.equal(a.detail, ':8q22→8q10::8q10→8q24.1::9q12→9qter');
  assert.equal(a.label, 'der(8;8)');
  assert.equal(a.segs.filter((s) => s.hasCen).length, 2, 'the seam still carries both centromere halves');

  // The 4.2.1 f mosaic's second clone, as a single clone: the Philadelphia der(9)
  // further involved in a whole-arm translocation with 7 (detailed form printed in
  // the standard).
  const b = built('45,XX,der(7;9)(q10;q10)t(9;22)(q34;q11.2)');
  assert.equal(b.detail, '7qter→7q10::9q10→9q34::22q11.2→22qter');

  // A Robertsonian body with a graft, the shape that drew as a der(9) figure.
  const c = built('45,XX,der(13;14)(q10;q10)t(9;14)(q22;q24)');
  assert.equal(c.detail, '13qter→13q10::14q10→14q24::9q22→9qter');
});
