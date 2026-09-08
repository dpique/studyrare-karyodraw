'use strict';
// Two recurrent leukemia rearrangements of chromosomes 16 and 3, added 2026-09-08.
//
// The curated notes covered t(8;21) and not inv(16), which is odd, because they are
// the two core-binding-factor AMLs and are taught as a pair: RUNX1 and CBFB are the
// two halves of one transcription factor, and the two lesions share a risk category.
// t(3;3) was missing for the same reason nobody noticed, which is that until
// 2026-08-29 the app refused homologous exchanges outright.
//
// Both lesions have TWO spellings for one event: an inversion and a translocation
// between the two homologs. inv(16)(p13.1q22) and t(16;16)(p13.1;q22) make the same
// CBFB::MYH11; inv(3)(q21.3q26.2) and t(3;3)(q21.3;q26.2) do the same thing to
// MECOM. A matcher that saw only one spelling would answer for one reader and not
// the next, so both entries match either.
//
// Unlike the existing entries these are pinned to their breakpoints. hasT ignores
// bands, which is safe for t(9;22) because no other t(9;22) is a recognised entity.
// It is not safe for an inversion: inv(16) at other breakpoints is not CBFB::MYH11,
// and naming a leukemia over a constitutional rearrangement is the expensive error.
// Same reasoning ISCN forced on fra(), where Xq27.3 carries the meaning and the
// notation alone does not.
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
const Teach = win.Teach;

const names = (k) => Teach.syndromes(ISCN.parse(k).clones[0]).map((s) => s.name);
const noteFor = (k, frag) =>
  (Teach.syndromes(ISCN.parse(k).clones[0]).find((s) => s.name.indexOf(frag) >= 0) || {}).note || '';

const CBF = 'inv(16) / t(16;16)';
const MECOM = 'inv(3) / t(3;3)';

test('CBFB::MYH11 is named for every spelling of the same lesion', () => {
  // The inversion is the common spelling; the translocation between homologs is the
  // same fusion and the reason this whole thread started.
  for (const k of ['46,XY,inv(16)(p13.1q22)', '46,XX,t(16;16)(p13.1;q22)', '46,XX,t(16;16)(p13;q22)']) {
    assert.ok(names(k).some((n) => n.indexOf(CBF) >= 0), k + ' should name the CBF AML');
  }
});

test('MECOM is named for every spelling of the same lesion', () => {
  for (const k of ['46,XY,inv(3)(q21.3q26.2)', '46,XY,t(3;3)(q21.3;q26.2)', '46,XY,t(3;3)(q21;q26)']) {
    assert.ok(names(k).some((n) => n.indexOf(MECOM) >= 0), k + ' should name the MECOM AML');
  }
});

test('a rearrangement of the same chromosome at other breakpoints is not named', () => {
  // The whole reason these two are pinned to bands. inv(16)(p11q13) is not
  // CBFB::MYH11, and calling it a leukemia would be worse than saying nothing.
  assert.equal(names('46,XY,inv(16)(p11q13)').some((n) => n.indexOf(CBF) >= 0), false);
  assert.equal(names('46,XY,inv(3)(p13q21)').some((n) => n.indexOf(MECOM) >= 0), false);
  assert.equal(names('46,XY,inv(9)(p11q13)').some((n) => n.indexOf(CBF) >= 0), false);
});

test('both notes are marked acquired, since neither is constitutional', () => {
  for (const k of ['46,XY,inv(16)(p13.1q22)', '46,XY,inv(3)(q21.3q26.2)']) {
    const hit = Teach.syndromes(ISCN.parse(k).clones[0])
      .find((s) => s.name.indexOf('inv(') >= 0);
    assert.equal(hit.acquired, true, k);
  }
});

test('the notes name their genes, italicised like every other entry', () => {
  const cbf = noteFor('46,XY,inv(16)(p13.1q22)', CBF);
  assert.match(cbf, /<i>CBFB<\/i>/);
  assert.match(cbf, /<i>MYH11<\/i>/);
  const mecom = noteFor('46,XY,inv(3)(q21.3q26.2)', MECOM);
  assert.match(mecom, /<i>MECOM<\/i>/);
  assert.match(mecom, /<i>GATA2<\/i>/);
});

test('the entries that were already there still answer', () => {
  // t(8;21) is the sibling of the new chromosome 16 entry and shares its page.
  assert.ok(names('46,XY,t(8;21)(q22;q22)').some((n) => n.indexOf('t(8;21)') >= 0));
  assert.ok(names('46,XY,t(9;22)(q34;q11.2)').some((n) => n.indexOf('Philadelphia') >= 0));
});

test('house style holds: no em dashes and no contractions in the new notes', () => {
  // Dan's rule for every artifact, and these strings are shipped prose.
  for (const [k, frag] of [['46,XY,inv(16)(p13.1q22)', CBF], ['46,XY,inv(3)(q21.3q26.2)', MECOM]]) {
    const note = noteFor(k, frag);
    assert.equal(note.indexOf('—'), -1, frag + ' note has an em dash');
    assert.doesNotMatch(note, /\b(it|that|there|is|does|do|was|are|we|they|you)'(s|t|re|ve|ll|d)\b/i,
      frag + ' note has a contraction');
  }
});
