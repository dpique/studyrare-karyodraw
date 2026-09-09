'use strict';
// The dosage lesions and whole-clone patterns.
//
// FUSIONS answers "what is fused". These cards answer the other questions a
// marrow or tumour karyotype gets asked: what is gained or lost (del(5q), -7,
// +8, i(17q), the CLL panel, MYCN amplification, -Y) and what the whole clone
// looks like (hyperdiploid and hypodiploid ALL, complex and monosomal
// karyotypes). Dan, 2026-09-08: "any other karyotypes that we should add,
// especially on the cancer side? ... just as a teaching tool".
//
// The matchers are deliberately narrow, and half of this file exists to prove
// the narrowness: Williams syndrome at 7q11.23 must never collect a leukemia
// note, a hyperdiploid ALL clone must never be called Down syndrome, and a
// constitutional multi-anomaly report must never be called a complex karyotype.
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

const cards = (k) => [...Teach.syndromes(ISCN.parse(k).clones[0])];
const named = (k, frag) => cards(k).filter((s) => s.name.indexOf(frag) >= 0);
const one = (k, frag) => {
  const h = named(k, frag);
  assert.equal(h.length, 1, k + ' should carry one "' + frag + '" card, got ' +
    JSON.stringify(cards(k).map((s) => s.name)));
  return h[0];
};
const none = (k, frag, why) =>
  assert.equal(named(k, frag).length, 0, k + ' must not carry "' + frag + '": ' + why);

test('the acquired dosage classics are recognised', () => {
  one('46,XX,del(5)(q13q33)', 'del(5q)');
  one('45,XX,-7', 'monosomy 7');
  one('46,XY,del(7)(q22q34)', 'monosomy 7 / del(7q)');
  one('47,XY,+8', 'trisomy 8');
  one('46,XX,i(17)(q10)', 'isochromosome 17q');
  one('46,XX,del(20)(q11.2q13.3)', 'del(20q)');
  one('46,XX,del(11)(q22.3)', 'ATM');
  one('47,XX,+12', 'trisomy 12');
  one('46,XY,hsr(2)(p24)', 'MYCN');
  one('46,XY,dmin', 'double minutes');
});

test('the two existing cancer landing pages finally have a card behind them', () => {
  // karyotype/mds-5q-deletion/ and karyotype/monosomy-7-mds/ have shipped since
  // the catalog began, with intros but no clinical card, because nothing in the
  // teach layer matched them. These are their exact page karyotypes.
  one('46,XX,del(5)(q13q33)', 'del(5q)');
  one('45,XX,-7', 'monosomy 7');
});

test('a deletion at a constitutional-syndrome band never collects a leukemia note', () => {
  none('46,XX,del(5)(q35)', 'del(5q)', 'a terminal 5q35 deletion is the Sotos region, not MDS');
  none('46,XY,del(7)(q11.23)', 'monosomy 7', '7q11.23 is Williams syndrome territory');
  none('46,XY,del(11)(q24.1)', 'ATM', 'terminal 11q24 is Jacobsen, not the CLL deletion');
});

test('the dual-context bands present both readings on one card', () => {
  const rb = one('46,XY,del(13)(q14)', 'retinoblastoma / CLL');
  assert.ok(!rb.acquired, '13q14 keeps its constitutional reading available');
  assert.match(rb.note, /two-hit/);
  const tp = one('46,XX,del(17)(p13.1)', 'TP53 loss / Miller-Dieker');
  assert.ok(!tp.acquired, '17p keeps its constitutional reading available');
  const pk = one('mos 47,XX,+i(12)(p10)/46,XX', 'Pallister-Killian / germ cell');
  assert.ok(!pk.acquired, 'i(12p) is the PKS chromosome as well as the GCT marker');
  // A supernumerary i(12p) raises the chromosome 12 complement to three, but it
  // is tetrasomy 12p, not trisomy 12, and the CLL card reads the notation.
  none('mos 47,XX,+i(12)(p10)/46,XX', 'trisomy 12', 'an isochromosome gain is not a +12');
  one('47,XX,+12', 'trisomy 12');
});

test('loss of Y is read as the acquired change, beside the Turner reading', () => {
  const k = '45,X,-Y';
  one(k, 'loss of Y');
  one(k, 'Turner');
  none('45,X', 'loss of Y', 'without an explicit -Y there is nothing acquired to read');
});

test('a hyperdiploid ALL clone is a pattern, not a stack of syndromes', () => {
  const k = '54,XY,+4,+6,+10,+14,+17,+18,+21,+21';
  one(k, 'high hyperdiploidy');
  none(k, 'Down syndrome', '+21 inside the pattern is part of the pattern');
  none(k, 'Complex karyotype', 'the high abnormality count IS the pattern');
  // The pattern gate does not leak into ordinary constitutional reads.
  one('47,XY,+21', 'Down syndrome');
});

test('a hypodiploid clone is named, and its single X is not Turner syndrome', () => {
  const k = '27,X,+10,+14,+18,+21';
  const h = one(k, 'hypodiploidy');
  assert.match(h.note, /Li-Fraumeni/);
  none(k, 'Turner', 'a near-haploid clone that kept one X is not a Turner conceptus');
  none(k, 'Down syndrome', 'a +21 against the haploid base is a disomy, not a trisomy');
  // A stated count off by one still reads near-haploid and still fires the
  // card; the count warning speaks to the arithmetic separately.
  one('26,X,+10,+14,+18,+21', 'hypodiploidy');
});

test('complex karyotype needs three abnormalities AND an acquired anchor', () => {
  const c = one('45,XX,-7,del(5)(q13q33),i(17)(q10)', 'Complex karyotype');
  assert.match(c.note, /monosomal/, 'one autosomal monosomy plus structural change is monosomal');
  none('45,XX,-7,del(20)(q11.2)', 'Complex karyotype', 'two abnormalities are not three');
  none('47,XY,+21,inv(9)(p12q13),del(4)(p16)', 'Complex karyotype',
    'three abnormalities with no recognised acquired lesion stay constitutional');
});

test('the constitutional deletions with a cancer thread are recognised', () => {
  one('46,XX,del(1)(p36)', '1p36');
  const wagr = one('46,XX,del(11)(p13)', 'WAGR');
  assert.match(wagr.note, /surveillance/);
  one('46,XY,del(11)(q24.1)', 'Jacobsen');
  one('mos 47,XX,+i(12)(p10)/46,XX', 'Pallister-Killian');
});

test('house style holds across every syndrome and dosage card', () => {
  // The FUSIONS table has this check already; the SYNDROMES side, which now
  // carries as much shipped prose, gets the same one.
  Teach.SYNDROMES.forEach((s) => {
    const text = s.name + ' ' + s.note;
    assert.equal(text.indexOf('—'), -1, s.name + ' has an em dash');
    assert.doesNotMatch(text, /\b(it|that|there|is|does|do|was|are|we|they|you|what)'(s|t|re|ve|ll|d)\b/i,
      s.name + ' has a contraction');
  });
  // The complex-karyotype note is built in syndromes() rather than stored, so
  // it is checked on a fired instance.
  const c = one('45,XX,-7,del(5)(q13q33),i(17)(q10)', 'Complex karyotype');
  assert.equal(c.note.indexOf('—'), -1);
});
