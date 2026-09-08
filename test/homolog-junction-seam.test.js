'use strict';
// The dashed seam marks where a derivative was broken and rejoined. It was drawn
// by comparing the chromosome NAMES on either side of a boundary:
//
//   if (gi > 0 && segments[gi - 1].chrom !== g.chrom) junctionYs.push(segTop);
//
// which is the same mistake that made both derivatives of a t(N;N) identical and
// left der(1)t(1;1) without its chromosome numbers. On t(9;22) the graft says 22
// and the host says 9, so the seam appeared. On t(16;16) both say 16, so the one
// figure whose breakpoint is hardest to see by eye was the one that did not mark
// it. Reported by Dan on 2026-09-08, looking at the fixed t(16;16) and asking why
// it had no breakpoint when the other translocations do.
//
// The seam now follows the graft rather than the name: translocationSegments marks
// the segment it grafts on, and that flag is what the boundary test reads. Names
// still count, so nothing about a translocation between two different chromosomes
// changes. An inversion or a duplication boundary is not a graft and is left
// exactly as it was, marked by its own vocabulary rather than by this seam.
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
const Karyo = win.Karyo;

// The Highlight style is theme "simple" internally (index.html: MODE = "simple",
// and style=highlight maps to it). The seam is a Highlight-only annotation, so a
// test that asks for theme "highlight" measures a path the app never takes.
function seams(k) {
  const model = ISCN.parse(k);
  const affected = Karyo.computeAffected(model.clones);
  const container = {};
  Karyo.render(container, model.clones[0], {
    theme: 'simple', level: 1, affected, only: Object.keys(affected),
  });
  return (container.innerHTML.match(/stroke-dasharray="2 1\.5"/g) || []).length;
}

test('a translocation between two homologs marks its junctions', () => {
  // Two derivatives, one junction each. This is the case that drew none.
  assert.equal(seams('46,XX,t(16;16)(p13;q22)'), 2);
  assert.equal(seams('46,XY,t(3;3)(q21.3;q26.2)'), 2);
  assert.equal(seams('46,XY,t(9;9)(q34;q11)'), 2);
});

test('a derivative of two homologs written as a der marks its junction', () => {
  // One derivative named, so one seam.
  assert.equal(seams('46,XX,der(1)t(1;1)(p31;q32)'), 1);
});

test('a translocation between two different chromosomes is unchanged', () => {
  // The case that always worked, pinned so the new rule cannot double-count it:
  // the graft flag and the name test are both true at the same boundary, and a
  // boundary contributes one seam or none.
  assert.equal(seams('46,XY,t(9;22)(q34;q11.2)'), 2);
  assert.equal(seams('46,XX,t(2;7;5)(p21;q22;q23)'), 3);
});

test('an inversion and a duplication keep their own vocabulary', () => {
  // Their boundaries are not grafts. Whatever marks them, it is not this seam,
  // and widening the seam to every break-and-rejoin would restyle figures nobody
  // reported. Left alone on purpose.
  assert.equal(seams('46,XY,inv(9)(p11q13)'), 0);
  assert.equal(seams('46,XX,dup(1)(q22q25)'), 0);
  assert.equal(seams('46,XX,del(5)(p15.2)'), 0);
});

test('a der carrying a dup beside its graft seams the graft only', () => {
  // ISCN 2024 prints der(1)t(1;3)(p32;q21)dup(1)(q25q42) as
  // 3qter→3q21::1p32→1q42::1q25→1qter. Two boundaries: the 3-to-1 graft, and the
  // internal dup boundary between two stretches of chromosome 1. Only the graft
  // is a junction between two chromosomes, so only the graft gets a seam.
  assert.equal(seams('46,XY,der(1)t(1;3)(p32;q21)dup(1)(q25q42)'), 1);
});
