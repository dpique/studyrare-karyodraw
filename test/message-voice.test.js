'use strict';
// Everything the warning box says is teaching copy. The reader is a learner who
// mistyped a karyotype, and what they need is the ISCN rule they missed, not a
// report on what the parser did with their text.
//
// "“+21” in “rob(14;21)(q10;q10)+21” was not read" was the message that prompted
// this: read by whom, and so what? The rule is that changes are comma-separated,
// and that is the entire useful content. This file keeps parser-internal voice out
// of user-facing strings, because it creeps back in one message at a time.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context));
const ISCN = win.ISCN;

// Inputs chosen to reach every warning branch, not to be realistic.
const BAD_INPUTS = [
  '', '46', 'hello', '46,XY,zzz(9)(q34)', '46,XY,foo(9;22)(q34;q11.2)',
  '46,XQ,+21', '46,QQ,+21', '46,XY,21', '46,XY,+99', '46,XY,-99',
  '46,XY,t(9;99)(q34;q11.2)', '46,XY,del(99)(p15.2)', '46,XY,rob(14;21)(q10;q10)+21',
  '46,XY,der(13;14)(q10;q10)+14', '46,XY,t(9;22)(q34;q11.2)ort(1;2)(p10;q10)',
  '46,XY,t(9,22)(q34;q11.2)', '46,XY,t(9;22)(q34;q11.2', 't(9;22)(q34;q11.2)',
  '47,idem,+9', '45,XX,t(13;15)(q10;q10)', '46,XY,+21×99', '46,XY,dmin×99',
  '46,XY,inv(9)(p11q13)zzz', '46XY', '46,XY,del(5)(zz15.2)', '46,XY,t(9;22)(q34;zzz)',
];

const allWarnings = () => {
  const out = [];
  BAD_INPUTS.forEach((k) => ISCN.parse(k).warnings.forEach((w) => out.push({ k: k, w: w })));
  return out;
};

test('the bad inputs really do reach a spread of warnings', () => {
  const ws = allWarnings();
  assert.ok(ws.length >= 20, `only ${ws.length} warnings produced; the corpus stopped covering the branches`);
  assert.ok(new Set(ws.map((x) => x.w)).size >= 12, 'distinct messages, not the same one 20 times');
});

test('no warning reports on the parser instead of teaching the rule', () => {
  // Phrasings that describe the app's internal handling of the text. Each says
  // something true and useless: the reader cannot act on "was not read".
  const PARSER_VOICE = [
    /\bwas(n't| not)? read\b/i,
    /\bcould ?n[o’']?t read\b/i,
    /\bwas ?n[o’']?t understood\b/i,
    /\bfailed to (parse|read)\b/i,
    /\bunable to\b/i,
    /\bparser\b/i,
    /\binvalid input\b/i,
    /^ignored\b/i,
    /\bdon[’']?t recognize\b/i,
    /\berror\b/i,
  ];
  allWarnings().forEach(function (x) {
    PARSER_VOICE.forEach(function (re) {
      assert.ok(!re.test(x.w), `parser voice ${re} in message for "${x.k}":\n    ${x.w}`);
    });
  });
});

test('every warning tells the reader something to do or a rule to follow', () => {
  // A heuristic, deliberately loose: a message must either name the correct form,
  // give an example, or state a rule. One that only reports a problem fails.
  const TEACHES = /\b(needs?|must|has to|use|write|written|should|belongs?|separated?|starts? with|comes? first|add|make sure|for example|e\.g\.|like|look like|is a|are not supported|not an ISCN|takes? one|draws? one|left out of the drawing|capped|Type a karyotype)\b/i;
  allWarnings().forEach(function (x) {
    assert.ok(TEACHES.test(x.w), `message for "${x.k}" reports a problem without teaching anything:\n    ${x.w}`);
  });
});

test('the missing-comma message leads with the rule and shows the fix', () => {
  const w = ISCN.parse('46,XY,rob(14;21)(q10;q10)+21').warnings.join(' ');
  assert.match(w, /^Changes are separated by commas/, 'the rule comes first');
  assert.match(w, /“rob\(14;21\)\(q10;q10\),\+21”/, 'and the corrected form is shown');
  assert.ok(w.length < 130, `keep it short enough to read; got ${w.length} chars`);
});

test('no message uses an em dash', () => {
  // House style, and it reads as machine-generated in short UI copy.
  allWarnings().forEach(function (x) {
    assert.ok(x.w.indexOf('—') < 0, `em dash in message for "${x.k}":\n    ${x.w}`);
  });
});

test('no message states the app\'s own arithmetic as a property of the karyotype', () => {
  // "This karyotype describes 46 chromosomes" claims more authority than the app has
  // earned: the figure is just the sum of the copies it worked out, and if that
  // working is wrong the sentence is wrong with exactly the same confidence. Say
  // whose sum it is and let the reader check it.
  const ORACLE = [
    /\bthis karyotype describes\b/i,
    /\bthis notation describes\b/i,
    /\bthe karyotype (is|has|contains)\b/i,
  ];
  allWarnings().forEach(function (x) {
    ORACLE.forEach(function (re) {
      assert.ok(!re.test(x.w), `states our arithmetic as fact ${re} for "${x.k}":\n    ${x.w}`);
    });
  });
});

test('the count message attributes the total and names the rule', () => {
  const w = ISCN.parse('47,XY,rob(14;21)(q10;q10),+21').warnings.join(' ');
  assert.match(w, /changes listed after it add up to 46/, 'says whose sum it is');
  assert.match(w, /cell's total chromosome count, so either it or the changes needs fixing/,
    'names the rule, and does not presume which side is the error');
  // Deliberately does NOT point at the drawing. 47,XY,del(5)(zz15.2) raises this
  // warning and is also refused a karyogram over the bad band, so "count them below"
  // would sometimes point at nothing.
  assert.doesNotMatch(w, /below|karyogram|drawing|drawn/i, 'no reference to a picture that may not exist');
});

test('the count message does not presume which side is wrong', () => {
  // 45,XX,t(13;15)(q10;q10) is the case that makes this matter: there the count is
  // arguably right and the OPERATION is what should change (the app offers rob()).
  // "so it has to match the changes listed after it" pointed the reader at the one
  // thing that was not the error.
  const w = ISCN.parse('45,XX,t(13;15)(q10;q10)').warnings.join(' ');
  assert.match(w, /either it or the changes/, 'either side may be the one to fix');
  assert.doesNotMatch(w, /has to match the changes listed/, 'no longer prescribes changing the number');
});
