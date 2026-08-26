'use strict';
// The Style toggle makes a promise the renderer has to keep. Its own caption
// (index.html) reads: "Realistic: true-to-life Giemsa banding on every
// chromosome, nothing highlighted. Try to spot the abnormality yourself."
// Since the rename in 2601e2e (2026-07-01) that promise was false: the detailed
// (Realistic) theme still drew the annotation overlays. A dup carried an amber
// wash, an inv a blue one, and every breakpoint red carets, so the figure that
// says "spot it yourself" pointed at the answer. Dan caught it on
// 46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat, whose grafted p-distal copy drew as a
// solid amber block under a pair of red carets.
//
// The rule these tests pin: in the detailed theme an overlay draws only if it
// IS material, not commentary about material. add()'s unknown-material hatch,
// an hsr's homogeneously staining block and a fragile site's gap all appear on
// a real slide, so they stay. Break carets, washes and the dashed fusion seam
// are teaching marks, so they belong to the Highlight (simple) theme alone.
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
const { Karyo, ISCN } = win;

const instOf = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal');
const draw = (k, chrom, theme) => Karyo.drawInstance(instOf(k, chrom), { theme, level: 99, affected: {} }).svg;

// The annotation fingerprints, exactly as the renderer emits them. A breakMark
// is a stroke-width 1.1 LINE plus caret triangles (the body outline is a rect
// or path at the same width, so the tag matters); the washes are the only
// fill-opacity rects in any figure; the fusion seam is the only "2 1.5" dash.
const CARET = /<line[^>]*stroke-width="1\.1"/;
const MARKS = [
  ['a break caret', CARET],
  ['a wash', /fill-opacity/],
  ['a fusion seam', /stroke-dasharray="2 1\.5"/],
];

// One case per annotation-bearing shape, the rec that surfaced the bug first.
const CASES = [
  ['46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', '2'],
  ['46,XX,dup(2)(p21p23)', '2'],
  ['46,XX,inv(2)(p21q31)', '2'],
  ['46,XX,del(5)(p15.2)', '5'],
  ['46,XX,del(5)(p14p15.1)', '5'],
  ['46,XX,der(9)t(9;22)(q34;q11.2)', '9'],
  ['46,XX,add(4)(q31)', '4'],
];

test('the Realistic theme draws no annotation marks, on any shape', () => {
  for (const [k, chrom] of CASES) {
    const svg = draw(k, chrom, 'detailed');
    for (const [what, re] of MARKS) {
      assert.ok(!re.test(svg), `${k} draws ${what} in the Realistic theme`);
    }
  }
});

test('the Highlight theme keeps its marks, which are its whole job', () => {
  // Every overlay-caret case keeps its carets. A plain translocation der never
  // had carets; its mark is the fusion seam, asserted separately below.
  for (const [k, chrom] of CASES) {
    if (k.indexOf('der(9)') === 0 || k.indexOf('46,XX,der(9)') === 0) continue;
    const svg = draw(k, chrom, 'simple');
    assert.match(svg, CARET, `${k} lost its Highlight-theme marks`);
  }
  assert.match(draw('46,XX,der(9)t(9;22)(q34;q11.2)', '9', 'simple'), /stroke-dasharray="2 1\.5"/,
    'the fusion seam still draws in the Highlight theme');
});

test('material overlays still draw realistically: they are on the slide too', () => {
  // add(): material of unknown origin has no bands to paint, so its hatch is
  // the material, in the add colour (#808ba8), not a highlight of it.
  assert.match(draw('46,XX,add(4)(q31)', '4', 'detailed'), /808ba8/,
    'the unknown-material hatch survives in the Realistic theme');
  // hsr: a homogeneously staining region is a real staining appearance.
  assert.match(draw('46,XX,hsr(11)(q13)', '11', 'detailed'), /d6409f/,
    'the hsr block survives in the Realistic theme');
  // fra: the unstained gap is the observation itself (see #191/#192).
  assert.match(draw('46,X,fra(X)(q27.3)', 'X', 'detailed'), /fra-gap/,
    'the fragile-site gap survives in the Realistic theme');
});
