'use strict';
// A lone derivative from a reciprocal translocation implies an imbalance the
// notation never spells out, exactly like the rec's inferred deletion
// (ISCN 5.4.3.2 c is the rec's version of this lesson). Dan looked at
// 46,XX,der(8)t(4;8)(p16.1;p23.1) and asked "where is the swap?": the figure
// was right (two intact 4s, one normal 8, the der(8) with its 4p sliver), but
// nothing on the page said WHY there is no swap partner, or what the dosage
// consequence is. The decode now states it: only this derivative is present,
// the reciprocal der is not, so the segment it carries is trisomic and the
// segment it replaced is monosomic. The note appears only in the textbook
// count situation and never on a balanced der pair.
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
const { ISCN, Teach } = win;
const decodeText = (k) => Teach.decode(ISCN.parse(k).clones[0]).map((r) => r.text).join(' ');

test('a lone derivative names the imbalance the notation implies', () => {
  const t = decodeText('46,XX,der(8)t(4;8)(p16.1;p23.1)');
  assert.match(t, /Only this derivative is present/, 'the missing reciprocal is addressed head-on');
  assert.match(t, /der\(4\)/, 'the absent partner is named');
  assert.match(t, /4p16\.1→4pter/, 'the trisomic segment is spelled out');
  assert.match(t, /three copies/, 'with its copy number');
  assert.match(t, /8p23\.1→8pter/, 'the monosomic segment is spelled out');
  assert.match(t, /partial (trisomy|monosomy)/, 'and the clinical vocabulary is used');
  assert.match(t, /balanced t\(4;8\)/, 'the usual parental origin is taught');
});

test('a balanced derivative pair gets no imbalance note', () => {
  const t = decodeText('46,XX,der(4)t(4;8)(p16.1;p23.1),der(8)t(4;8)(p16.1;p23.1)');
  assert.ok(!/Only this derivative is present/.test(t), 'both products are present, nothing is lone');
  assert.ok(!/three copies/.test(t), 'and no trisomy is claimed');
});

test('a de novo lone derivative drops the parental-carrier sentence', () => {
  const t = decodeText('46,XX,der(8)t(4;8)(p16.1;p23.1)dn');
  assert.match(t, /Only this derivative is present/, 'the imbalance is still named');
  assert.ok(!/parent carries/.test(t), 'but no parent is presumed for a de novo change');
});

test('the note stays silent outside the textbook count situation', () => {
  // The extra copy of the derivative changes the arithmetic entirely (this is
  // the +der pattern); claiming the simple trisomy sentence here would be false.
  const t = decodeText('47,XX,der(8)t(4;8)(p16.1;p23.1),+der(8)t(4;8)(p16.1;p23.1)');
  assert.ok(!/three copies/.test(t), 'no simple-case sentence when the counts are not the simple case');
});
