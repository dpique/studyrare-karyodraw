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

// The linear body does not trust the acen bands to paint the constriction: it
// lays a CEN_H hatch rect over them, because the acen bands can be far
// narrower than the waist and are rarely symmetric about the p/q boundary.
// #296 left the ring leaning on the bare band sectors, and Dan read the pinch
// as underhatched, worst on the q side of the line (2026-09-10). The ring owes
// the waist the same guarantee: one hatched wedge, the exact waist window,
// symmetric about the dashed boundary line.
test('the waist wears a guaranteed hatch window, symmetric about the boundary line', () => {
  for (const theme of ['simple', 'detailed']) {
    const svg = ring(theme);
    const size = +/<svg[^>]* width="([\d.]+)"/.exec(svg)[1];
    const cx = size / 2, cy = size / 2;
    const ang = (x, y) => Math.atan2(x - cx, cy - y);   // clockwise from 12 o'clock, the ring's own convention
    const line = /<line x1="(-?[\d.]+)" y1="(-?[\d.]+)"[^>]*stroke-dasharray="2\.5 2"/.exec(svg);
    assert.ok(line, `${theme}: the dashed boundary line`);
    const cen = ang(+line[1], +line[2]);
    const overlays = (svg.match(/<path\b[^>]*>/g) || []).filter((e) =>
      /fill="url\(#/.test(e) && /pointer-events="none"/.test(e) && !/class=/.test(e));
    assert.equal(overlays.length, 1, `${theme}: exactly one hatched waist overlay above the bands`);
    const ov = overlays[0];
    assert.match(ov, /clip-path="url\(#/, `${theme}: the overlay hugs the constriction`);
    const d = /d="M(-?[\d.]+) (-?[\d.]+) A\S+ \S+ 0 [01] 1 (-?[\d.]+) (-?[\d.]+) L/.exec(ov);
    assert.ok(d, `${theme}: the overlay is an annulus sector: ${ov}`);
    const norm = (a) => Math.atan2(Math.sin(a), Math.cos(a));
    const before = Math.abs(norm(cen - ang(+d[1], +d[2])));
    const after = Math.abs(norm(ang(+d[3], +d[4]) - cen));
    assert.ok(Math.abs(before - after) < 0.02,
      `${theme}: hatch reaches equally far on both sides of the line (${before.toFixed(3)} vs ${after.toFixed(3)})`);
    assert.ok(before > 0.1 && after > 0.1,
      `${theme}: at least the waist half-window of hatch on each side (${before.toFixed(3)}, ${after.toFixed(3)})`);
  }
});
