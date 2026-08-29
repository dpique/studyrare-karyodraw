'use strict';
// The prose side of the decode glossary (teach.js GLOSS_PROSE_TERMS): English
// names in a decode sentence resolve to the same GLOSSARY entries the symbol
// chips use. The app consumes the list as ONE alternation in a single pass
// (index.html glossProse), so the properties that keep that pass honest are
// pinned here: every key points at a real entry, longer phrases win over their
// own tails, and the alternation the app builds wraps a real decode sentence
// the way the browser test expects to find it.
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

test('every prose term points at a real glossary entry', () => {
  assert.ok(Teach.GLOSS_PROSE_TERMS.length >= 15, 'the list covers the glossary');
  for (const [src, key] of Teach.GLOSS_PROSE_TERMS) {
    assert.ok(Teach.GLOSSARY[key], `${src} -> ${key} has an entry behind it`);
    assert.doesNotThrow(() => new RegExp(src), `${src} compiles`);
  }
});

test('English names resolve to their symbols, longest phrase first', () => {
  const term = (w) => (Teach.glossForTerm(w) || {}).term;
  assert.equal(term('derivative chromosome'), 'der');
  assert.equal(term('DERIVATIVE'), 'der', 'the decode CAPS emphasis still resolves');
  assert.equal(term('Robertsonian translocation'), 'rob', 'not t: the longer phrase owns it');
  assert.equal(term('Robertsonian'), 'rob');
  assert.equal(term('translocations'), 't');
  assert.equal(term('isodicentric chromosome'), 'idic', 'not dic');
  assert.equal(term('dicentric'), 'dic');
  assert.equal(term('ring chromosomes'), 'r');
  assert.equal(term('double minutes'), 'dmin');
  assert.equal(term('nonsense'), undefined, 'unknown prose stays unglossed');
});

test('the single-pass alternation wraps a real decode sentence correctly', () => {
  // Build the regex exactly as index.html glossProse does, and run it over the
  // decode text the browser test hovers, so the two suites pin the same claim.
  const re = new RegExp('\\b(?:' + Teach.GLOSS_PROSE_TERMS.map((p) => p[0]).join('|') + ')\\b', 'gi');
  const clone = ISCN.parse('45,XX,der(14;21)(q10;q10)').clones[0];
  const text = Teach.decode(clone).map((r) => r.text).join(' ');
  const hits = [];
  text.replace(re, (word) => { hits.push([word, (Teach.glossForTerm(word) || {}).term]); return word; });
  const byKey = Object.fromEntries(hits.map(([w, k]) => [k, w]));
  assert.match(byKey.rob || '', /Robertsonian translocation/i, 'the whole phrase is one match');
  assert.ok(byKey.der, 'derivative in the same sentence resolves to der');
  assert.ok(!hits.some(([, k]) => !k), 'nothing the alternation matches fails to resolve');
});
