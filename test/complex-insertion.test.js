'use strict';
// A complex reciprocal insertion (ISCN 5.5.9.3): every chromosome named donates the
// segment its pair bounds to the NEXT chromosome listed, and the last donates to the
// first, so ins(5;6)(q13q23;q15q23) swaps two segments and ins(5;14;9)(q13q23;
// q24q21;p12p23) is a balanced six-break cycle. A pair's written order is the order
// its bands read from pter to qter of the recipient (5.5.9 b).
//
// The app drew both with the ordinary two-chromosome builder: der(5) took 14's
// segment instead of 9's, der(14) lost its segment and gained nothing, and der(9)
// was drawn as a chromosome 14 with a deletion under a der(9) label, with the
// net-imbalance table reporting losses and gains in a balanced karyotype. Found by
// the copy-line sweep on 2026-09-14, when Dan asked for the three-chromosome
// insertion to read back.
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
const Karyo = win.Karyo;
const Teach = win.Teach;

function detailedForms(k) {
  const out = [];
  const model = ISCN.parse(k);
  for (const clone of model.clones) {
    for (const ch of Object.keys(clone.slots || {})) {
      for (const inst of clone.slots[ch] || []) {
        if (inst.kind === 'normal') continue;
        out.push(Karyo.detailedForm(inst));
      }
    }
  }
  return out.sort();
}
function imbalancedRuns(k) {
  const bad = [];
  Karyo.computeDosage(ISCN.parse(k).clones[0]).chroms.forEach((c) => {
    if (c.baseline == null) return;
    c.runs.forEach((r) => { if (r.copies !== c.baseline) bad.push(c.chrom + ' ' + r.fromLabel + '→' + r.toLabel + ' ' + r.copies + ' copies'); });
  });
  return bad;
}
const draws = (m) => !!(m.ok && m.clones.length && m.clones.every((c) => !c.unreadable) && !m.suggestion);
const shortOf = (k) => (/“([^”]*)”\.$/.exec(ISCN.parse(k).warnings.find((w) => /DETAILED/.test(w)) || '') || [])[1];

test('the six-break cycle draws the three derivatives ISCN prints (5.5.9.3 ii)', () => {
  assert.deepEqual(detailedForms('46,XX,ins(5;14;9)(q13q23;q24q21;p12p23)'), [
    '14pter→14q21::5q13→5q23::14q24→14qter',
    '5pter→5q13::9p12→9p23::5q23→5qter',
    '9pter→9p23::14q24→14q21::9p12→9qter',
  ]);
  assert.deepEqual(imbalancedRuns('46,XX,ins(5;14;9)(q13q23;q24q21;p12p23)'), [], 'balanced: every segment is present once');
});

test('the two-chromosome swap draws both derivatives ISCN prints (5.5.9.3 i)', () => {
  assert.deepEqual(detailedForms('46,XY,ins(5;6)(q13q23;q15q23)'), [
    '5pter→5q13::6q15→6q23::5q23→5qter',
    '6pter→6q15::5q13→5q23::6q23→6qter',
  ]);
  assert.deepEqual(imbalancedRuns('46,XY,ins(5;6)(q13q23;q15q23)'), []);
});

test('the ordinary two-chromosome insertion is untouched', () => {
  assert.deepEqual(detailedForms('46,XY,der(5)ins(5;2)(q31;p23p13)dmat'), ['5pter→5q31::2p23→2p13::5q31→5qter']);
  assert.deepEqual(detailedForms('46,XX,ins(5;2)(q31;p23p13)'), [
    '2pter→2p23::2p13→2qter',
    '5pter→5q31::2p23→2p13::5q31→5qter',
  ]);
});

test('the decode says the segments change places, and names every chromosome', () => {
  const model = ISCN.parse('46,XX,ins(5;14;9)(q13q23;q24q21;p12p23)');
  const text = Teach.decode(model.clones[0]).map((e) => e.text || '').join(' ');
  assert.match(text, /5q13 and 5q23/);
  assert.match(text, /14q21 and 14q24|14q24 and 14q21/);
  assert.match(text, /9p12 and 9p23|9p23 and 9p12/);
  assert.match(text, /nothing is gained or lost/i);
  assert.ok(!/is moved into chromosome 5 at/.test(text), 'not the one-way sentence');
  const swap = Teach.decode(ISCN.parse('46,XY,ins(5;6)(q13q23;q15q23)').clones[0]).map((e) => e.text || '').join(' ');
  assert.match(swap, /change places/i);
  const plain = Teach.decode(ISCN.parse('46,XX,ins(5;2)(q31;p23p13)').clones[0]).map((e) => e.text || '').join(' ');
  assert.match(plain, /moved into chromosome 5 at 5q31/);
});

test('a three-chromosome insertion that does not pair every chromosome is refused and taught the cycle', () => {
  const m = ISCN.parse('46,XX,ins(5;14;9)(q13;q24q21;p12p23)');
  assert.ok(!draws(m), 'a shape the cycle does not define must not draw');
  assert.match(m.warnings.join(' '), /ins\(5;14;9\)\(q13q23;q24q21;p12p23\)/, 'the message shows the standard’s own shape');
  const m2 = ISCN.parse('46,XY,ins(5;2)(q31;p23)');
  assert.ok(!draws(m2), 'a donor with one band has no segment to move');
});

test('the copied line of a complex insertion pastes back and reads as itself', () => {
  assert.equal(shortOf('46,XX,ins(5;14;9)(5pter→5q13::9p12→9p23::5q23→5qter;14pter→14q21::5q13→5q23::14q24→14qter;9pter→9p23::14q24→14q21::9p12→9qter)'),
    '46,XX,ins(5;14;9)(q13q23;q24q21;p12p23)');
  assert.equal(shortOf('46,XY,ins(5;6)(5pter→5q13::6q15→6q23::5q23→5qter;6pter→6q15::5q13→5q23::6q23→6qter)'),
    '46,XY,ins(5;6)(q13q23;q15q23)');
  assert.equal(shortOf('46,XY,ins(5;2)(5pter→5q31::2p23→2p13::5q31→5qter;2pter→2p23::2p13→2qter)'),
    '46,XY,ins(5;2)(q31;p23p13)', 'the ordinary insertion still reads as before');
});
