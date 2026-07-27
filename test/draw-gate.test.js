'use strict';
// A karyogram is drawn only for input that IS valid ISCN. Drawing the nearest
// plausible thing is not teaching: it lets a wrong designation look answered, and it
// destroys the app's use as a check, which is what someone writing an exam question
// needs from it. If it draws, the notation was accepted.
//
// The risk this file exists for is the other direction. Refusing valid ISCN is far
// worse than tolerating invalid ISCN, so every karyotype the app itself ships has to
// keep drawing, and so does everything ISCN legitimately permits with a tally that
// cannot be pinned.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context));
const ISCN = win.ISCN;
const Karyo = win.Karyo;

// Mirrors the gate in index.html: parser-side reasons only. The band check
// (invalidBands) lives in the page and is covered by its own tests.
const refused = (k) => {
  const m = ISCN.parse(k);
  return !m.clones.length
    || m.clones.every((c) => c.modalNumber == null)
    || !!m.suggestion
    || m.clones.some((c) => c.unreadable || c.countWrong);
};

test('the page gate and this file check the same things', () => {
  // Two separate assertions on purpose. Checking only that the flags are READ passes
  // even if the gate stops USING them, since the reads sit on their own lines above.
  const reads = html.match(/ {4}var unreadable = [\s\S]*?\n {4}var invalid/)[0];
  ['c.unreadable', 'c.countWrong'].forEach((n) =>
    assert.ok(reads.includes(n), `page should read ${n} off the clone`));

  const gate = html.match(/ {4}var invalid = [\s\S]*?;\n {4}beacon/)[0];
  ['unreadable', 'countWrong', 'model.suggestion', 'bad.length', 'modalNumber == null']
    .forEach((n) => assert.ok(gate.includes(n), `the invalid gate should consult ${n}`));
});

// ---- refused: not valid ISCN ------------------------------------------------
test('a made-up operation is refused', () => {
  // Drew a full, normal-looking karyogram: the count added up, the band was real, and
  // nothing else objected.
  assert.equal(refused('46,XY,zzz(9)(q34)'), true);
});

test('a chromosome with no sign is refused', () => {
  assert.equal(refused('46,XY,rob(14;21)(q10;q10),21'), true);
});

test('text an operation could not consume is refused', () => {
  assert.equal(refused('46,XY,inv(9)(p11q13)zzz'), true);
  assert.equal(refused('46,XY,t(9;22)(q34;q11.2)ort(1;2)(p10;q10)'), true);
});

test('a breakpoint that is not a breakpoint is refused', () => {
  assert.equal(refused('47,XY,del(5)(zzqewdf2315.2)'), true);
});

test('a count the app is willing to call wrong is refused', () => {
  ['46,XY,rob(14;21)(q10;q10),-21', '40,XY,rob(14;21)(q10;q10),-21', '45,XX,t(13;15)(q10;q10)',
   '47,XY,rob(14;21)(q10;q10),+21'].forEach((k) => assert.equal(refused(k), true, k));
});

// ---- drawn: valid ISCN, including the parts that cannot be tallied ----------
test('valid ISCN whose tally cannot be pinned still draws', () => {
  // Refusing any of these would be a worse bug than the one this change fixes.
  [
    '48,XY,+8,inc',                   // inc: further unidentified changes, tally short by design
    '46,XY,inc',
    '47~49,XY,+8',                    // a modal range
    '46~48,XX,+21',
    'mos 45,X[12]/46,XX[18]',         // mosaic, one count per clone
    '45,X[12]/46,XX[18]',
    '47,XY,+8[cp10]',                 // composite
    '46,XX,t(9;22)(q34;q11.2)[cp10]',
    '45<2n>,XY,der(14;21)(q10;q10)',  // explicit ploidy annotation
  ].forEach((k) => assert.equal(refused(k), false, k));
});

test('legal but unusual still draws', () => {
  // 46,XX,t(13;15)(q10;q10) is legal ISCN and gets a note offering the rob() reading.
  // "Unusual" is not "invalid", and refusing it would be a different, worse rule.
  assert.equal(refused('46,XX,t(13;15)(q10;q10)'), false);
  assert.equal(refused('46,XY,t(1;3)(p10;q10)'), false);
});

test('every karyotype the app itself ships still draws', () => {
  // The guided tour, the landing pages, and the example chips. If the gate ever
  // refuses one of these, the app is refusing its own curriculum.
  const content = fs.readFileSync(path.join(root, 'content', 'karyotypes.js'), 'utf8');
  const curated = [...content.matchAll(/\bk:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  assert.ok(curated.length >= 20, `expected the curated set, found ${curated.length}`);
  curated.forEach((k) => assert.equal(refused(k), false, `curated: ${k}`));

  const examples = vm.runInNewContext((html.match(/var EXAMPLES = (\[[\s\S]*?\n {2}\]);/) || [])[1]);
  examples.forEach((e) => assert.equal(refused(e[0]), false, `chip: ${e[0]}`));
});

test('what draws, renders', () => {
  // A gate that lets something through only to have the renderer throw would be no
  // better than drawing nonsense.
  const content = fs.readFileSync(path.join(root, 'content', 'karyotypes.js'), 'utf8');
  [...content.matchAll(/\bk:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]).forEach((k) => {
    const clone = ISCN.parse(k).clones[0];
    const cont = { innerHTML: '' };
    assert.doesNotThrow(() => Karyo.render(cont, clone, {
      theme: 'simple', level: 1, affected: Karyo.computeAffected([clone]),
    }), k);
    assert.ok(cont.innerHTML.includes('kcell'), `${k} drew cells`);
  });
});
