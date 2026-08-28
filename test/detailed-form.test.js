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
