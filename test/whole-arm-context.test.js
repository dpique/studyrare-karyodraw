'use strict';
// The whole-arm derivative's cost sentence counted homologues by slot kind
// "normal" alone, so a +1 in the same clone (a gain instance, drawn as a
// normal-shaped homologue) was invisible to it: 46,XX,+1,der(1;7)(q10;p10),
// the classic MDS/AML karyotype, was decoded as "partially monosomic for the
// lost arms (1p and 7q)" while the extra 1 held 1p at two copies and pushed
// 1q to three (Dan, 2026-09-10). The sentence now checks its claim against
// Karyo.computeDosage, which reads the very segment lists the figure draws,
// so the decode cannot disagree with the karyogram or the Involved-segments
// table.
//
// Also pinned here: two curated notes that called two different rearrangements
// "spellings" of one. inv(14)(q11q32) folds a single chromosome 14;
// t(14;14)(q11;q32) exchanges between the two homologues. One consequence,
// two lesions, and the note must not blur that (same review).
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

const derText = (k) => {
  const clone = ISCN.parse(k).clones[0];
  const rows = Teach.decode(clone).filter((r) => r.tag === 'der');
  assert.ok(rows.length, `${k}: a der decode row exists`);
  return rows[0].text;
};

test('the bare whole-arm derivative keeps its partial-monosomy sentence', () => {
  const t = derText('45,XX,der(1;7)(q10;p10)');
  assert.match(t, /With one normal 1 and one normal 7 remaining/);
  assert.match(t, /partially monosomic for the lost arms \(1p and 7q\)/);
});

test('with the +1 in the clone, the sentence counts the whole clone', () => {
  const t = derText('46,XX,+1,der(1;7)(q10;p10)');
  assert.ok(!/partially monosomic/.test(t),
    '1p is at two copies here, so the monosomy claim must not survive: ' + t);
  assert.ok(!/one normal 1/.test(t), 'two normal-shaped 1s remain, not one: ' + t);
  assert.match(t, /1q has three copies/, t);
  assert.match(t, /7q has one copy/, t);
  assert.match(t, /1p and 7p keep the usual two/, t);
});

test('the T-PLL note names two rearrangements, never two spellings', () => {
  const note = Teach.syndromes(ISCN.parse('46,XX,t(14;14)(q11;q32)').clones[0])
    .map((s) => s.note).join(' ');
  assert.ok(!/Either spelling/.test(note), 'inv(14) and t(14;14) are different rearrangements');
  assert.match(note, /Two different rearrangements/);
  assert.match(note, /inv\(14\)\(q11q32\)/);
  assert.match(note, /t\(14;14\)\(q11;q32\)/);
});

test('the CBF note stops calling the translocation a spelling', () => {
  const note = Teach.syndromes(ISCN.parse('46,XY,inv(16)(p13.1q22)').clones[0])
    .map((s) => s.note).join(' ');
  assert.ok(!/commoner spelling/.test(note));
  assert.match(note, /commoner of the two/);
});
