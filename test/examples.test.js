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
  // Showing a subset is only acceptable because the deck is re-dealt on every page
  // load. Without that, trimming the row would silently delete examples.
  assert.ok(EXAMPLES_SHOWN < EXAMPLES.length, 'a subset is shown, so re-dealing must happen');
  assert.match(html, /function dealExamples/, 'the deal-without-repeats helper exists');
  assert.match(html, /sessionStorage/, 'the deck survives a reload so refreshing walks the list');
});

test('dealing walks the whole list across reloads without repeating', () => {
  // The reason for a deck rather than picking N at random each load: independent
  // sampling would show the same two or three by chance and bury the rest. Run the
  // real dealExamples against a sessionStorage stub, one call per simulated reload.
  const src = html.match(/var DECK_KEY = [\s\S]*?\n  }\n\n  function paintExamples/)[0]
    .replace(/\n\n  function paintExamples$/, '');
  const store = {};
  const sandbox = {
    EXAMPLES,
    sessionStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
    },
    Math, JSON, Array,
  };
  vm.createContext(sandbox);
  vm.runInContext(src + '\nglobalThis.deal = dealExamples;', sandbox);

  for (let trial = 0; trial < 40; trial += 1) {
    for (const k of Object.keys(store)) delete store[k];
    sandbox.exDeck = null;
    const seen = new Set();
    // ceil(7 / 3) = 3 reloads is the most it can take to exhaust a 7-card deck.
    for (let reload = 0; reload < 3; reload += 1) {
      const dealt = sandbox.deal(EXAMPLES_SHOWN);
      assert.equal(dealt.length, EXAMPLES_SHOWN, 'always deals a full row');
      assert.equal(new Set(dealt.map((e) => e[0])).size, EXAMPLES_SHOWN, 'no repeat within one row');
      dealt.forEach((e) => seen.add(e[0]));
      // exDeck is module state in the browser; a reload clears it but not the store.
      sandbox.exDeck = null;
    }
    assert.equal(seen.size, EXAMPLES.length, `trial ${trial}: 3 reloads should surface all ${EXAMPLES.length}`);
  }
});

test('a deck saved before the example list changed is discarded', () => {
  // Indices are stored, not karyotypes, so a stale deck would deal the wrong chips
  // or undefined. The saved length is checked against the current list.
  assert.match(html, /saved\.n === EXAMPLES\.length/, 'stale decks are rejected on read');
});
