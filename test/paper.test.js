'use strict';
// The JOSS paper states numbers about this repository, and they were wrong.
//
// Before this file, paper/paper.md claimed 40 curated examples when there were 41,
// "over 450" tests when there were 492, and listed as a limitation ("a derivative
// carrying more than a single embedded rearrangement falls back to the base
// chromosome") something the renderer had since learned to do. Nothing catches that,
// because a paper is prose: it does not run. Meanwhile the figure it shipped was a
// screenshot of an interface 101 commits out of date.
//
// A submitted paper is the one artifact where a stale number is not a documentation
// problem but a correctness claim a reviewer will check. So the counts it quotes are
// pinned to the arrays they describe, and the figures it references have to exist. A
// failure here means the paper and the software disagree; fix whichever is wrong.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PAPER_DIR = path.join(__dirname, '..', 'paper');
const paper = fs.readFileSync(path.join(PAPER_DIR, 'paper.md'), 'utf8');

test('every figure the paper references is present', () => {
  const refs = [...paper.matchAll(/\]\((fig[^)]+\.png)\)/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, `expected at least three figures, found ${refs.length}`);
  refs.forEach((f) => {
    assert.ok(fs.existsSync(path.join(PAPER_DIR, f)), `${f} is referenced but not in paper/`);
    assert.ok(fs.statSync(path.join(PAPER_DIR, f)).size > 10000, `${f} is suspiciously small`);
  });
});

// A \autoref with no \label renders as a broken cross-reference in the built PDF,
// which is the kind of thing that gets a submission bounced before review.
test('every figure cross-reference resolves', () => {
  const labels = new Set([...paper.matchAll(/\\label\{([^}]+)\}/g)].map((m) => m[1]));
  const refs = [...paper.matchAll(/\\autoref\{([^}]+)\}/g)].map((m) => m[1]);
  assert.ok(refs.length >= 3, 'the figures should be referred to from the text');
  refs.forEach((r) => assert.ok(labels.has(r), `\\autoref{${r}} has no matching \\label`));
  labels.forEach((l) => assert.ok(refs.includes(l), `\\label{${l}} is never referenced`));
});

test('the ISCN conformance numbers match the corpus', () => {
  const examples = require('./iscn-2024-examples.js');
  const supported = examples.filter((e) => e.supported !== false).length;
  const m = /corpus of (\d+) karyotype-format\s+examples[\s\S]{0,80}?of which (\d+) are currently drawn/.exec(paper);
  assert.ok(m, 'the paper should state the conformance corpus size and how much of it draws');
  assert.equal(Number(m[1]), examples.length, 'total ISCN 2024 examples');
  assert.equal(Number(m[2]), supported, 'examples the app currently draws');
});

test('the stress corpus number matches the corpus', async () => {
  const { CORPUS } = await import('../scripts/stress-corpus.mjs');
  const m = /stress\s+corpus of (\d+) designations/.exec(paper);
  assert.ok(m, 'the paper should state the stress corpus size');
  assert.equal(Number(m[1]), CORPUS.length);
});

test('the curated-example count matches content/karyotypes.js', () => {
  const { CONTENT } = require('../content/karyotypes.js');
  const m = /\((\d+) karyotypes at this writing/.exec(paper);
  assert.ok(m, 'the paper should state how many worked examples are published');
  assert.equal(Number(m[1]), CONTENT.length);
});

// "nearly 500" has to stay true in both directions: it is a claim a reviewer can run
// `npm test` to check, and it reads badly either as an overstatement or as a number
// the project has long outgrown.
test('the stated test-suite size is still honest', () => {
  const m = /suite of ([a-z ]+) (\d+) behavioral tests/.exec(paper);
  assert.ok(m, 'the paper should state the size of the test suite');
  const claimed = Number(m[2]);
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js'));
  const actual = files.reduce((n, f) => n +
    (fs.readFileSync(path.join(__dirname, f), 'utf8').match(/^\s*(?:await )?(?:it|test)\(/gm) || []).length, 0);
  assert.ok(actual >= claimed * 0.9 && actual <= claimed * 1.25,
    `the paper says "${m[1].trim()} ${claimed}" but there are about ${actual} tests; restate it`);
});

// House style, and the same rule the warning copy is held to in message-voice.test.js.
test('the paper uses no em dashes', () => {
  assert.ok(paper.indexOf('—') < 0, 'em dash in paper.md');
});

// docs/VALIDATION.md states the same two numbers as the paper and nothing was
// checking them: it still said 302 accepted long after the corpus reached 337.
// A count in prose goes stale silently, which is the one failure mode a reader
// cannot detect, so pin it the way the paper's copy is pinned.
test('the VALIDATION.md conformance numbers match the corpus', () => {
  const doc = fs.readFileSync(path.join(__dirname, '..', 'docs', 'VALIDATION.md'), 'utf8');
  const examples = require('./iscn-2024-examples.js');
  const m = /holds (\d+) karyotype-format examples[\s\S]{0,200}?(\d+) are accepted/.exec(doc);
  assert.ok(m, 'VALIDATION.md should state the corpus size and how much of it is accepted');
  assert.equal(Number(m[1]), examples.length, 'total ISCN 2024 examples');
  assert.equal(Number(m[2]), examples.filter((e) => e.supported !== false).length, 'examples accepted');
});
