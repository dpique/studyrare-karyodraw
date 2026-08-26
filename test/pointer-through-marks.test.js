'use strict';
// Every pixel a reader points at should answer (#192 set that standard for the
// fragile-site gap). The tooltip pipeline reads `closest('.band')` from the
// element under the pointer, so any decorated element ABOVE the band rects
// that lacks pointer-events="none" is a silent stripe: the centromere hatch
// and its dashed midline swallowed the pointer on every chromosome, and the
// Highlight theme's break carets and fusion seam swallowed it at the exact
// breakpoints a reader most wants to inspect. Dan hit the class on the rec(2)
// dup wash (#196 removed it); these are the survivors of the same class.
//
// The rule: a mark that overlays TRUE content lets the pointer through to the
// band beneath. Marks that REPLACE content must answer for themselves instead:
// the fra gap already does (a `fra` pseudo-stain band rect); add() and hsr
// still draw opaque and silent, a recorded gap rather than an accident,
// because letting the pointer through them would name bands that are not
// really there.
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

const instOf = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal') ||
  { chrom, kind: 'normal', label: chrom, aberration: null, primary: null };
const draw = (k, chrom, theme) => Karyo.drawInstance(instOf(k, chrom), { theme, level: 99, affected: {} }).svg;

// Split an svg string into elements; return those that paint above the band
// group and can intercept the pointer.
const elements = (svg) => svg.match(/<(rect|line|path|circle)\b[^>]*>/g) || [];

test('the centromere hatch and midline let the pointer through to the acen band', () => {
  for (const theme of ['detailed', 'simple']) {
    const svg = draw('46,XX', '2', theme);
    const cen = elements(svg).filter((e) => /stroke-dasharray="2\.5 2"|<rect [^>]*fill="url\(#/.test(e))
      .filter((e) => !/class="band"/.test(e));
    assert.ok(cen.length >= 2, `${theme}: the hatch rect and dashed line are present`);
    for (const e of cen) assert.match(e, /pointer-events="none"/, `${theme}: ${e} swallows the pointer`);
  }
});

test('break carets and the fusion seam let the pointer through in the Highlight theme', () => {
  const carets = draw('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', '2', 'simple');
  for (const e of elements(carets).filter((x) => /stroke-width="1\.1"/.test(x) && /<line/.test(x))) {
    assert.match(e, /pointer-events="none"/, `caret line swallows the pointer: ${e}`);
  }
  for (const e of elements(carets).filter((x) => /<path[^>]*Z" fill="#/.test(x))) {
    assert.match(e, /pointer-events="none"/, `caret triangle swallows the pointer: ${e}`);
  }
  const seam = draw('46,XX,der(9)t(9;22)(q34;q11.2)', '9', 'simple');
  for (const e of elements(seam).filter((x) => /stroke-dasharray="2 1\.5"/.test(x))) {
    assert.match(e, /pointer-events="none"/, `fusion seam swallows the pointer: ${e}`);
  }
});

test('the invariant, over shapes and themes: nothing silent may sit above the bands', () => {
  // Anything that paints after the band group, is not itself a band, and is
  // not the body outline (fill="none", pointer only on its 1px stroke) must
  // declare pointer-events="none". This is the model-level assertion so the
  // next mark added to the renderer cannot reintroduce the class.
  const CASES = [
    ['46,XX', '2'],
    ['46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', '2'],
    ['46,XX,der(9)t(9;22)(q34;q11.2)', '9'],
    ['45,XX,rob(13;14)(q10;q10)', '13'],
    ['46,X,fra(X)(q27.3)', 'X'],
    ['46,XX,del(5)(p15.2)', '5'],
  ];
  for (const [k, chrom] of CASES) {
    for (const theme of ['detailed', 'simple']) {
      const svg = draw(k, chrom, theme);
      const after = svg.split('</g>').pop();            // everything above the band group
      for (const e of elements(after)) {
        if (/class="band[ "]/.test(e)) continue;           // answers for itself
        if (/fill="none"/.test(e)) continue;            // outline: stroke-only hit area
        assert.match(e, /pointer-events="none"/, `${k} (${theme}): silent element above the bands: ${e}`);
      }
    }
  }
});
