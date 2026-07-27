'use strict';
// The example chips under the input box are the first ISCN most visitors ever read,
// so they are curriculum, not decoration. These tests pull the list straight out of
// index.html and hold it to the app's own parser and renderer: a chip that the app
// would warn about, or that draws nothing, teaches the wrong lesson on the way in.
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

// Read the list from the page rather than duplicating it here, so the single source
// of truth stays index.html and this file cannot drift from what ships.
const EXAMPLES = vm.runInNewContext((html.match(/var EXAMPLES = (\[[\s\S]*?\n {2}\]);/) || [])[1]);
const EXAMPLES_SHOWN = Number((html.match(/var EXAMPLES_SHOWN = (\d+);/) || [])[1]);

test('the example list and its display count are readable from index.html', () => {
  assert.ok(Array.isArray(EXAMPLES) && EXAMPLES.length, 'EXAMPLES parsed');
  assert.ok(Number.isInteger(EXAMPLES_SHOWN) && EXAMPLES_SHOWN > 0, 'EXAMPLES_SHOWN parsed');
});

test('every example is input the app itself would not complain about', () => {
  EXAMPLES.forEach(([k, label]) => {
    const m = ISCN.parse(k);
    assert.ok(m.ok, `${k} should parse`);
    // .length, not deepEqual: the parser builds its arrays inside the vm realm, so
    // a strict deep compare fails on the Array prototype rather than the contents.
    assert.equal(m.warnings.length, 0, `${k} (${label}) should raise no warning, got ${m.warnings.join(' | ')}`);
    assert.equal(m.suggestion, null, `${k} should need no suggestion`);
    assert.equal(m.countFix, null, `${k} should need no count fix`);
    assert.equal(m.note, null, `${k} should need no note`);
  });
});

test('every example draws a visible change', () => {
  // A chip whose karyogram looks normal is worse than no chip: the viewer concludes
  // the tool did nothing. Marker chromosomes count, since they are drawn in their
  // own slot rather than colouring an existing one.
  EXAMPLES.forEach(([k, label]) => {
    const clones = ISCN.parse(k).clones;
    const affected = Object.keys(Karyo.computeAffected(clones)).length;
    const markers = clones.some((c) => (c.slots.mar || []).length);
    assert.ok(affected > 0 || markers, `${k} (${label}) should highlight something`);
  });
});

test('no example is an abnormality a karyotype cannot actually resolve', () => {
  // del(22)(q11.2) (DiGeorge) was a chip. The deletion is about 3 Mb, well under the
  // 5-10 Mb a ~550-band karyotype resolves, so it is found by FISH or microarray and
  // not by banding, which is what the guide page tells the reader. Drawing it as a
  // visibly missing band contradicted that. Keep submicroscopic syndromes off the
  // chips; the guide is where they get explained.
  const submicroscopic = [/del\(22\)\(q11\.2\)/, /del\(15\)\(q11/, /del\(7\)\(q11\.23\)/, /del\(17\)\(p11\.2\)/];
  EXAMPLES.forEach(([k]) => {
    submicroscopic.forEach((re) => assert.ok(!re.test(k), `${k} is below banding resolution`));
  });
});

test('examples are unique', () => {
  const ks = EXAMPLES.map((e) => e[0]);
  assert.equal(new Set(ks).size, ks.length);
});

test('the trimmed row keeps every example reachable', () => {
  // Showing a subset is only acceptable because Shuffle deals the rest. Without it,
  // trimming the row would silently delete examples.
  assert.ok(EXAMPLES_SHOWN < EXAMPLES.length, 'a subset is shown, so shuffling must be possible');
  assert.match(html, /id="ex-shuffle"/, 'the shuffle control exists');
  assert.match(html, /function dealExamples/, 'the deal-without-repeats helper exists');
});
