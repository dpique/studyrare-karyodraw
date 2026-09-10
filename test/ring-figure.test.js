'use strict';
// The ring's centromere wears the SAME three-part device as the linear body
// (Dan, 2026-09-09, comparing the two figures side by side): the waist in the
// outline, the hatched acen texture, and a thin dashed line at the exact p/q
// boundary in the linear midline's own dash. History in two steps that day:
// #295 removed a dashed radial that sat at the last acen band's midpoint
// (wrong place, unkeyed), and this test then pinned a hatch-only ring; Dan
// pointed out the linear figure draws a constriction plus a dashed boundary
// line, so hatch-only was the inconsistency, not the fix. The clasp stays the
// only SOLID radial mark, so the two devices cannot be confused.
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

test('the ring wears the linear centromere device: waist, hatch, dashed boundary', () => {
  for (const theme of ['simple', 'detailed']) {
    const svg = ring(theme);
    assert.match(svg, /class="ideo ideo-ring"/, `${theme}: the ring svg`);
    assert.match(svg, /data-stain="acen"/, `${theme}: the hatched centromere sector is a real band`);
    const dashes = svg.match(/stroke-dasharray="2\.5 2"/g) || [];
    assert.equal(dashes.length, 1,
      `${theme}: exactly one dashed mark, the p/q boundary line, in the linear midline's own dash`);
    assert.ok(!/stroke-dasharray="3 2"/.test(svg), `${theme}: the old mid-band radial stays gone`);
    assert.ok(!/<circle/.test(svg), `${theme}: the outline is the waisted path, not a circle`);
    assert.match(svg, /clip-rule="evenodd"/, `${theme}: bands clip to the waisted annulus`);
  }
});

test('the clasp is the only solid radial device, and it carries its tooltip', () => {
  const svg = ring('simple');
  assert.match(svg, /Ring fusion point/, 'the clasp names itself');
  // One dasharray total (asserted above), so the clasp line stays solid and
  // cannot be read as one junction among several.
});
