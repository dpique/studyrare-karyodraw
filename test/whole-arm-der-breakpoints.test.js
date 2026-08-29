'use strict';
// der(A;B) with its own breakpoint group has exactly one meaning in the standard:
// a whole-arm translocation, breakpoints at the centromeric bands p10 or q10
// (ISCN 2024 5.5.18.2 a; proven dicentrics move to dic, 5.5.18.3 d). Written
// der(22;11)(q13;p13) it has no reading, but it used to draw silently: a
// monocentric body, 22pter to 22q13 joined to the 11p13 to 11pter tip, under a
// one-clause decode. That composition is what ISCN spells der(22)t(11;22)
// (p13;q13); a writer who meant both centromeres wanted dic(11;22)(p13;q13),
// which keeps 11p13 to 11qter instead. The two readings differ in real material,
// so the app must not pick one in silence. Found by the 2026-08 production
// review (rank 11, "questionable acceptance").
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'iscn-parser.js'), 'utf8'), context);
const ISCN = win.ISCN;

test('der(A;B) with non-centromeric breakpoints is refused, and the message teaches both readings', () => {
  const m = ISCN.parse('45,XX,der(22;11)(q13;p13)');
  assert.equal(m.clones[0].unreadable, true, 'the gate refuses it');
  const w = m.warnings.join(' ');
  assert.match(w, /p10.*q10|q10.*p10/, 'names the centromeric-band rule');
  assert.match(w, /der\(22\)t\(11;22\)\(p13;q13\)/, 'the one-centromere reading, spelled out');
  assert.match(w, /dic\(11;22\)\(p13;q13\)/, 'the two-centromere reading, spelled out');
});

test('each offered reading is re-validated at its own count', () => {
  // The monocentric der replaces one chromosome (count 46); the dic replaces two
  // (count 45). A repair that refuses when pasted is not a repair.
  const m = ISCN.parse('45,XX,der(22;11)(q13;p13)');
  assert.ok((m.fixes || []).length >= 2, 'both readings on offer');
  for (const f of m.fixes) {
    const re = ISCN.parse(f);
    assert.equal(re.ok, true, f);
    assert.equal(re.warnings.length, 0, f + ' must paste back clean');
    assert.equal(re.clones[0].countWrong, false, f);
    assert.equal(re.clones[0].unreadable, false, f);
  }
});

test('a mixed group, one centromeric band and one not, is refused the same way', () => {
  const m = ISCN.parse('45,XX,der(13;14)(q10;q13)');
  assert.equal(m.clones[0].unreadable, true);
});

test('whole-arm der(A;B) at p10/q10 still draws, warning-free', () => {
  ['45,XX,der(14;21)(q10;q10)', '45,XX,der(1;3)(p10;q10)', '45,XX,rob(13;14)(q10;q10)']
    .forEach((k) => {
      const m = ISCN.parse(k);
      assert.equal(m.clones[0].unreadable, false, k);
      assert.equal(m.warnings.length, 0, k);
    });
});

test('a der(A;B) chain with no breakpoint group of its own is untouched', () => {
  // ISCN 5.5.3 c ii: the joins live in the t() sub-ops; there is no own group to
  // hold to the p10/q10 rule.
  const m = ISCN.parse('45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)');
  assert.equal(m.clones[0].unreadable, false);
});

test('whole-arm der(A;B) with trailing sub-ops keeps drawing', () => {
  // ISCN 5.5.3 c iv territory: the own group is centromeric, so the new rule
  // must not catch it.
  const m = ISCN.parse('45,XY,der(13;14)(q10;q10)del(13)(q22)');
  assert.equal(m.clones[0].unreadable, false);
});
