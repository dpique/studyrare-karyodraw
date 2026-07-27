'use strict';
// The system for catching silently dropped input.
//
// 47~49,XY,+8,, has two commas. It produced no warning of any kind and drew a full
// karyogram, because the field list is filtered for length and the blanks vanished
// before anything could object. Finding that class one member at a time is a losing
// game, so the parser now reassembles each clone from everything it kept and compares
// it against what it was handed. Whatever does not come back was dropped without
// being understood, and the drawing that would follow is of a karyotype nobody typed.
//
// The comparison is on the fields AS WRITTEN (modalGiven, sexGiven, ab.raw, cellGiven)
// rather than on re-serialised values, which is what lets case, range spelling, "<2n>",
// multiplier style, qualifiers and cell counts survive it untouched.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context));
const ISCN = win.ISCN;

const anyUnaccounted = (k) => ISCN.parse(k).clones.some((c) => c.unaccounted);

// Deliberately wide, and deliberately including the awkward spellings. A guard that
// refuses valid ISCN is a worse bug than the one it was added for, so the value of
// this file is almost entirely in this list.
const VALID = [
  '46,XY', '46,XX', '45,X', '47,XXY', '47,XX,+21', '69,XXY', '92,XXYY',
  '46,XY,t(9;22)(q34;q11.2)', '46,XY,del(5)(p15.2)', '45,XY,rob(14;21)(q10;q10)',
  '46,XY,inv(9)(p11q13)', '46,X,i(X)(q10)', '46,XX,r(13)(p11q34)', '46,XX,dup(1)(q22q25)',
  '46,XY,add(19)(p13.3)', '46,XY,trp(1)(q22q25)', '46,XX,ins(5;2)(p14;q22q32)',
  '46,XY,t(2;7;5)(q21;p13;q31)', '46,X,idic(X)(q13)', '45,XY,dic(13;14)(q13;q22)',
  '46,XY,fra(X)(q27.3)', '46,XY,hsr(9)(q34)', '46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)',
  '47,XY,+mar', '46,XY,2mar', '46,XY,1~3mar', '46,XY,dmin', '46,XY,3dmin',
  '46,XY,+21c', '46,XY,del(22)(q11.2)mat', '46,XY,+8×2', '46,XY,+8x2', '46,XY,−21',
  '48,XY,+8,inc', '46,XY,inc', '47~49,XY,+8', '47-49,XY,+8',
  '46,XY,t(9;22)(q34;q11.2)[20]', '47,XY,+8[cp10]', '45<2n>,XY,der(14;21)(q10;q10)',
  'mos 45,X[12]/46,XX[18]', '47,XY,+8/46,XY', '47,XX,+8[cp10]/48,idem,+9', '47,XX,+8/48,sl,+9',
];

test('every valid karyotype round-trips exactly', () => {
  VALID.forEach((k) => assert.equal(anyUnaccounted(k), false, `valid input flagged: ${k}`));
});

test('every karyotype the app ships round-trips exactly', () => {
  const content = fs.readFileSync(path.join(root, 'content', 'karyotypes.js'), 'utf8');
  const curated = [...content.matchAll(/\bk:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  assert.ok(curated.length >= 20, `expected the curated set, found ${curated.length}`);
  curated.forEach((k) => assert.equal(anyUnaccounted(k), false, `curated: ${k}`));
});

test('the corpus is wide enough to be worth trusting', () => {
  // A guard validated on five inputs is not a guard. If this list shrinks, the claim
  // that a mismatch means something shrinks with it.
  assert.ok(VALID.length >= 40, `only ${VALID.length} valid inputs checked`);
  const kinds = new Set(VALID.flatMap((k) => (ISCN.parse(k).clones[0] || { aberrations: [] }).aberrations.map((a) => a.kind)));
  assert.ok(kinds.size >= 14, `only ${kinds.size} aberration kinds exercised: ${[...kinds].join(',')}`);
});

test('a dropped empty field is caught', () => {
  ['47~49,XY,+8,,', '46,XY,,', '46,XY,+8,', '46,,XY,+8']
    .forEach((k) => assert.equal(anyUnaccounted(k), true, k));
});

test('an empty field is repaired, not only refused', () => {
  // A bare refusal on a stray comma would be a poor trade for the viewer.
  const m = ISCN.parse('47~49,XY,+8,,');
  assert.equal(m.suggestion, '47~49,XY,+8');
  assert.match(m.warnings.join(' '), /own item between commas.*Remove the extra comma/);
});

test('commas inside parentheses are untouched by the repair', () => {
  // splitTop only reaches depth 0, and the in-paren comma has its own message.
  const m = ISCN.parse('46,XY,t(9,22)(q34;q11.2)');
  assert.equal(m.suggestion, '46,XY,t(9;22)(q34;q11.2)', 'still the semicolon repair');
});

test('the draw gate consults the backstop', () => {
  const gate = html.match(/ {4}var invalid = [\s\S]*?;\n {4}beacon/)[0];
  assert.match(gate, /unaccounted/);
});
