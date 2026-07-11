'use strict';
// Decode tests for the teaching layer (teach.js). Like the other modules it is a
// browser IIFE; loaded (with its ideogram/parser/render dependencies) into a
// minimal window shim so window.Teach can be exercised under `node --test`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
load('ideogram-data.js');
load('iscn-parser.js');
load('karyo-render.js');
load('teach.js');
const ISCN = win.ISCN;
const Teach = win.Teach;

// The prose that decodes an aberration token, for a single-aberration karyotype.
const decodeText = (k) => {
  const clone = ISCN.parse(k).clones[0];
  return Teach.decode(clone).filter((r) => r.tag !== 'count' && r.tag !== 'sex').map((r) => r.text).join(' ');
};

test('teach module loads', () => {
  assert.equal(typeof Teach.decode, 'function');
});

// A der() chain draws the extra del/dup/inv, so the decode prose must name them
// too — otherwise the picture and the words disagree.
test('der chain decode names the deletion, not just the translocation', () => {
  const txt = decodeText('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)');
  assert.match(txt, /translocation|22/, 'still describes the t(9;22) junction');
  assert.match(txt, /delet/i, 'also mentions the deletion');
  assert.match(txt, /9p12/, 'references the deletion breakpoint');
});

test('der chain decode names a duplication sub-op', () => {
  const txt = decodeText('46,XY,der(1)t(1;3)(p36;q21)dup(1)(q22q25)');
  assert.match(txt, /duplicat/i, 'mentions the duplication');
  assert.match(txt, /1q22|1q25/, 'references the duplicated segment');
});

// A der() with no translocation, only del/dup, must still narrate them.
test('der chain with no translocation still names its sub-ops', () => {
  const txt = decodeText('46,XY,der(1)del(1)(p13)del(1)(q32)');
  assert.match(txt, /delet/i, 'mentions the deletions');
  assert.match(txt, /1p13/, 'references the first deletion');
  assert.match(txt, /1q32/, 'references the second deletion');
});

// A Robertsonian der(13;14) lists the two chromosomes lowest-number-first by
// convention; the notation does NOT tell us whose centromere is retained (these
// whole-arm fusions are usually dicentric). So the decode must not claim it "has
// chromosome 13's centromere" — it must describe the fusion of both chromosomes.
test('Robertsonian decode does not claim a single chromosome centromere', () => {
  const txt = decodeText('45,XX,rob(13;14)(q10;q10)');
  assert.match(txt, /robertsonian/i, 'names it a Robertsonian translocation');
  assert.match(txt, /13/, 'names chromosome 13');
  assert.match(txt, /14/, 'names chromosome 14');
  assert.doesNotMatch(txt, /chromosome 13[’']s centromere/, 'does not claim it has chromosome 13 centromere');
});
