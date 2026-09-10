'use strict';
// The ring figure's marks, pinned after Dan read one closely (2026-09-09).
// One centromere device, the hatched acen sector: the dashed radial line that
// used to echo the linear ideogram's midline drew a second radial across the
// annulus, unkeyed in the legend, in the dash vocabulary the app reserves for
// junctions, so it read as a second closure point competing with the clasp.
// The clasp itself (solid amber seam, two arrowheads meeting at 12 o'clock)
// stays, in both themes: a real ring closed somewhere, and its legend row is
// gated on the figure (see the legend browser test).
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
const ring = (theme) => Karyo.drawInstance(instOf('46,XY,r(13)(p11q34)', '13'), { theme, level: 99, affected: {} }).svg;

test('the ring marks its centromere with the hatch alone, in both themes', () => {
  for (const theme of ['simple', 'detailed']) {
    const svg = ring(theme);
    assert.match(svg, /class="ideo ideo-ring"/, `${theme}: the ring svg`);
    assert.match(svg, /data-stain="acen"/, `${theme}: the hatched centromere sector is a real band`);
    assert.ok(!/stroke-dasharray="3 2"/.test(svg), `${theme}: no dashed radial beside the hatch`);
  }
});

test('the clasp is the only radial device crossing the annulus', () => {
  const svg = ring('simple');
  assert.match(svg, /Ring fusion point/, 'the clasp carries its tooltip');
  assert.equal((svg.match(/stroke-dasharray/g) || []).length, 0,
    'nothing on the ring is dashed, so the clasp cannot be mistaken for one junction among several');
});
