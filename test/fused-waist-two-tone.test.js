'use strict';
// A whole-arm fusion's waist is two half-centromeres, one from each source
// chromosome: der(1;7)(q10;p10) says exactly that with its 10s, chromosome 1
// bringing the long-arm face of its centromere and chromosome 7 the short-arm
// face. The figure painted the whole hatch in the derivative's namesake color,
// so the waist of der(1;7) read as all chromosome 1 while the legend promised
// that pieces take the color of the chromosome they came from (Dan,
// 2026-09-10). In the Highlight theme the hatch now splits at the p/q
// boundary, each half in its own source's hue, exactly as the acen band rects
// beneath it already did. The Realistic theme keeps one neutral hatch: a real
// slide's centromere does not disclose its origin.
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
load('teach.js');

const Karyo = win.Karyo;
const ISCN = win.ISCN;

const CEN_H = 9;            // karyo-render's guaranteed hatch height
const HALF = CEN_H / 2;

const cellOf = (html, kind) => {
  const at = html.indexOf(`data-kind="${kind}"`);
  assert.ok(at >= 0, `a ${kind} cell is drawn`);
  const next = html.indexOf('class="kchrom', at);
  return html.slice(at, next < 0 ? html.length : next);
};
// The centromere hatch rects are the only pointer-events-none pattern-filled
// rects at these exact heights (emission order pins the attribute order).
const cenFills = (cell, h) =>
  [...cell.matchAll(new RegExp(`<rect x="3" y="[\\d.]+" width="[\\d.]+" height="${h}" fill="url\\(#([^)]+)\\)" clip-path="[^"]*" pointer-events="none"`, 'g'))]
    .map((m) => m[1]);

const drawn = (k, theme) => {
  const c = ISCN.parse(k).clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme, level: 1, affected: Karyo.computeAffected([c]), only: ['1', '7'] });
  return cont.innerHTML;
};

test('the der(1;7) waist wears both source colors in the Highlight theme', () => {
  const der = cellOf(drawn('46,XX,+1,der(1;7)(q10;p10)', 'simple'), 'der');
  const halves = cenFills(der, HALF);
  assert.equal(halves.length, 2, `two half-height hatches at the waist (got ${halves.length})`);
  assert.notEqual(halves[0], halves[1], 'the two halves use two different hatch patterns, one per source');
  assert.equal(cenFills(der, CEN_H).length, 0, 'the old one-color full-height hatch is gone from the fused waist');
});

test('a normal chromosome keeps its one-piece hatch', () => {
  const n1 = cellOf(drawn('46,XX,+1,der(1;7)(q10;p10)', 'simple'), 'normal');
  assert.equal(cenFills(n1, CEN_H).length, 1, 'one full-height hatch');
  assert.equal(cenFills(n1, HALF).length, 0, 'no split on a single-source centromere');
});

test('the Realistic theme keeps one hatch: a slide does not disclose origin', () => {
  const der = cellOf(drawn('46,XX,+1,der(1;7)(q10;p10)', 'realistic'), 'der');
  assert.equal(cenFills(der, CEN_H).length, 1, 'one full-height hatch');
  assert.equal(cenFills(der, HALF).length, 0, 'no split outside Highlight');
});

test('a homologous fusion stays one color: both halves come from the same chromosome', () => {
  const c = ISCN.parse('46,XX,der(1;1)(p10;q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: Karyo.computeAffected([c]), only: ['1'] });
  const der = cellOf(cont.innerHTML, 'der');
  assert.equal(cenFills(der, CEN_H).length, 1, 'same source on both sides, one hatch');
  assert.equal(cenFills(der, HALF).length, 0);
});
