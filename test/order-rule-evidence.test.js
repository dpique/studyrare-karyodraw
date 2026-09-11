'use strict';
// Expected versus actual, row by row, each with its source. Written 2026-09-11
// after the same-arm breakpoint-order rule had flipped three times; Dan asked
// for plain tests that say what should be seen and what is seen, validated
// against the evidence, so the question is settled here and not re-argued.
//
// The rule (ISCN 2024, Cytogenet Genome Res 2024;164(suppl 1):1-224):
//   5.5.2 b   interstitial deletion breakpoints "are specified from pter to qter"
//   5.5.10 a  "the breakpoint closer to pter of the inverted chromosome is
//             specified first"
//   Table 3   "Breakpoint band designations from pter to qter of the rearranged
//             chromosome"
//   Independently: Current Protocols in Human Genetics, Appendix 4C, "ISCN Rules
//   for Listing Chromosomal Rearrangements": "Multiple breakpoints in one
//   chromosome are listed in order of occurrence from pter to qter."
//   The string inv(2)(p13p23), once cited in this repo as "the standard's own
//   example", occurs nowhere in ISCN 2024 and nowhere in the literature searched.
//
// The literature's habit on the short arm runs the other way:
//   EML4::ALK is printed inv(2)(p21p23) by Soda et al., Nature 2007, the Atlas
//   of Genetics and Cytogenetics in Oncology (solid-tumor/6846), LOINC 79206-9
//   and 88744-8 ("inv(2)(p21;p23)"); a web search for inv(2)(p23p21) returns no
//   use of that spelling. A 2020 case report writes inv(6)(p21.3p23) where ISCN
//   2024's own example for the same arm is inv(6)(p22.3p21.2). ISCN itself slips
//   once: 4.2.1 h's "e.g." list has del(4)(p15.3p16.1).
//
// So the app: draws every one of these; says nothing about spellings ISCN
// prints; for a short-arm pair written centromere-first, names ISCN's order AND
// says that published karyotypes often write it that way, so the familiar
// spelling is familiar rather than wrong; and never reorders dup or ins, whose
// band order is orientation.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'teach.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context));
const ISCN = win.ISCN;
const Teach = win.Teach;

const ORDER = /is written first/;
const LITERATURE = /Published karyotypes often write short-arm pairs the other way round/;
const notesOf = (k) => Array.from(ISCN.parse(k).warnings || [], (w) => w.text || w).filter((w) => ORDER.test(w));

// [input, expected, ISCN spelling named in the note (if any), why]
const ROWS = [
  ['46,XX,inv(2)(p23p13)', 'silent', null, 'ISCN 2024 5.5.10 b i, printed'],
  ['46,Y,del(X)(p21p11.4)', 'silent', null, 'ISCN 2024 5.5.2 b vi, printed'],
  ['46,XY,inv(9)(p23p13)', 'silent', null, 'ISCN 2024 5.5.3, printed inside der(9)'],
  ['46,XX,inv(6)(p22.3p21.2)', 'silent', null, 'ISCN 2024 seq example iv, printed'],
  ['46,XY,del(1)(p34p22)', 'silent', null, 'ISCN 2024 5.5.3, printed'],
  ['46,XX,inv(3)(q21q26.2)', 'silent', null, 'ISCN 2024 5.5.10 b ii, printed'],
  ['46,XY,inv(16)(p13.1q22)', 'silent', null, 'pericentric: short arm first, no disagreement anywhere'],
  ['46,XY,inv(2)(p21p23)', 'note+literature', 'inv(2)(p23p21)', 'the literature spelling of EML4::ALK; ISCN 5.5.10 a puts p23 first'],
  ['46,XX,inv(6)(p21.3p23)', 'note+literature', 'inv(6)(p23p21.3)', 'published spelling (2020 case report); ISCN prints p22.3p21.2 for this arm'],
  ['46,XX,del(5)(p15.2p15.3)', 'note+literature', 'del(5)(p15.3p15.2)', 'centromere-first on the p arm; ISCN 5.5.2 b'],
  ['46,XX,inv(3)(q26.2q21)', 'note', 'inv(3)(q21q26.2)', 'reversed on the q arm; ISCN and the literature agree on q21q26.2'],
  ['46,XY,inv(16)(q22p13.1)', 'note', 'inv(16)(p13.1q22)', 'pericentric written long arm first'],
  ['46,XY,dup(1)(p34p22)', 'silent', null, 'dup: order is orientation (ISCN 4.2.1 j iii), direct copy'],
  ['46,XY,dup(1)(p22p34)', 'silent', null, 'dup: the inverted copy, also correct'],
];

function actualOf(k) {
  const n = notesOf(k);
  if (!n.length) return 'silent';
  return LITERATURE.test(n.join(' ')) ? 'note+literature' : 'note';
}

ROWS.forEach(([k, expected, iscnForm, why]) => {
  test(`${k}: ${expected} (${why})`, () => {
    assert.equal(ISCN.parse(k).clones[0].unreadable, false, 'draws');
    assert.equal(actualOf(k), expected);
    const n = notesOf(k);
    if (expected !== 'silent') {
      assert.equal(n.length, 1, 'exactly one order note');
      assert.ok(n[0].indexOf('” is “' + iscnForm + '”') >= 0, `names ISCN's spelling ${iscnForm}: ${n[0]}`);
    }
  });
});

test('the EML4::ALK note fires for the literature spelling and for ISCN\'s', () => {
  const hit = (k) => Teach.syndromes(ISCN.parse(k).clones[0]).some((s) => /EML4::ALK/.test(s.name));
  assert.equal(hit('46,XY,inv(2)(p21p23)'), true, 'literature spelling');
  assert.equal(hit('46,XY,inv(2)(p23p21)'), true, 'ISCN spelling');
});

test('the detailed system converts to the short form ISCN prints beside it', () => {
  // 5.5.10 b i, both lines verbatim, joined in the book by "or".
  const w = ISCN.parse('46,XX,inv(2)(pter→p23::p13→p23::p13→qter)').warnings.join(' ');
  assert.match(w, /“46,XX,inv\(2\)\(p23p13\)”/);
});

test('expected versus actual, printed for the reader of this run', () => {
  const lines = ['', '| input | expected | actual | why |', '| --- | --- | --- | --- |'];
  ROWS.forEach(([k, expected, , why]) => lines.push(`| ${k} | ${expected} | ${actualOf(k)} | ${why} |`));
  console.log(lines.join('\n'));
});
