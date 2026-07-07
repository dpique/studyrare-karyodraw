'use strict';
// Render tests for the karyogram renderer (karyo-render.js). Like the parser it
// is a browser IIFE; here it is loaded (after its ideogram-data dependency) into a
// minimal window shim with the vm module so buildInstance can be exercised under
// `node --test` with no dependencies. These pin the duplication geometry: a dup
// lengthens the chromosome, and breakpoint order controls direct vs inverted.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
load('ideogram-data.js');
load('karyo-render.js');
const Karyo = win.Karyo;
const IDEO = win.IDEOGRAM;

const inst = (kind, chrom, bands, label) => ({ chrom, kind, aberration: { breakpoints: [bands] }, label: label || kind });
const totalBp = (segs) => segs.reduce((s, g) => s + (g.to - g.from), 0);

test('render module loads', () => {
  assert.equal(typeof Karyo.buildInstance, 'function');
});

test('duplication lengthens the chromosome and splices in a copy', () => {
  const normal = IDEO.data['1'].length;
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'], 'dup(1)(q22q25)'));
  assert.ok(built.segments.length > 1, 'segments are spliced, not a single full chromosome');
  assert.ok(totalBp(built.segments) > normal, 'total length grows beyond the normal chromosome');
});

test('direct duplication keeps the copy in the same orientation', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 0, 'no reversed segment for a direct dup');
});

test('inverted duplication (distal-first) mirrors the copy', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q25', 'q22']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 1, 'exactly one reversed (mirrored) copy');
  assert.ok(totalBp(built.segments) > IDEO.data['1'].length, 'still lengthens the chromosome');
});

test('triplication adds two copies (grows more than a duplication)', () => {
  const normal = IDEO.data['1'].length;
  const dupGrew = totalBp(Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'])).segments) - normal;
  const trpGrew = totalBp(Karyo.buildInstance(inst('trp', '1', ['q22', 'q25'])).segments) - normal;
  assert.ok(trpGrew > dupGrew * 1.5, 'triplication adds about twice the material of a duplication');
});

test('dup overlay shades the appended copy (by segment index)', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.ok(built.overlays.length >= 1);
  assert.ok(built.overlays.every((o) => o.type === 'dup' && o.segIndex != null), 'overlay targets a copy segment');
});

test('a dup renders to SVG without error', () => {
  const out = Karyo.drawInstance(inst('dup', '1', ['q22', 'q25']), { theme: 'detailed', level: 1, affected: {} });
  assert.match(JSON.stringify(out), /<svg/);
});
