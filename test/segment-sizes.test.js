'use strict';
// Segment sizes in the decode, requested by a user on LinkedIn (Luis Valiño
// Castrillón): "Would it be possible that it could also provide an estimate of
// the size (Mb) of the involved segments?" Everything needed was already in
// the model: the ideogram is UCSC hg38 with band boundaries in bp, and every
// drawn segment's length is an arithmetic fact the renderer computes and never
// says. The decode now says it.
//
// The honesty rule: a breakpoint written at a band can sit anywhere within
// that band, so sizes are ESTIMATES measured from band midpoints, always
// prefixed "about", with the method stated once on the how-to-read card.
// These tests assert numeric sanity, not exact strings: the stated Mb must
// fall within the bounds the band edges allow.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
for (const f of ['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
}
const { ISCN, Karyo, Teach } = win;
const IDEO = win.IDEOGRAM;

const decodeText = (k) => Teach.decode(ISCN.parse(k).clones[0]).map((r) => r.text).join(' ');
// A named band's full extent, covering its sub-bands: p21 spans p21.1..p21.3.
const bandSpan = (c, b) => {
  const rows = IDEO.data[c].bands.filter((x) => x[0] === b || x[0].indexOf(b + '.') === 0);
  return [Math.min(...rows.map((x) => x[1])), Math.max(...rows.map((x) => x[2]))];
};

// Every "about N Mb" / "about N kb" in a text, as bp numbers.
const statedBp = (t) => [...t.matchAll(/about ([\d.]+) (Mb|kb)/g)]
  .map((m) => parseFloat(m[1]) * (m[2] === 'Mb' ? 1e6 : 1e3));

test('a terminal deletion states the size of what is lost, within band bounds', () => {
  const t = decodeText('46,XX,del(5)(p15.2)');
  const sizes = statedBp(t);
  assert.equal(sizes.length, 1, `one size in: ${t}`);
  const b = bandSpan('5', 'p15.2');
  assert.ok(sizes[0] >= b[0] && sizes[0] <= b[1],
    `distal-to-p15.2 size ${sizes[0]} should sit between the band edges ${b[0]}..${b[1]}`);
});

test('dup, inv, and ins state the span they act on', () => {
  for (const [k, b1, b2, c] of [
    ['46,XX,dup(2)(p23p21)', 'p23', 'p21', '2'],
    ['46,XX,inv(2)(p21q31)', 'p21', 'q31', '2'],
    ['46,XY,ins(15)(p11q23q26)', 'q23', 'q26', '15'],
  ]) {
    const sizes = statedBp(decodeText(k));
    assert.ok(sizes.length >= 1, `${k} states a size`);
    const s1 = bandSpan(c, b1), s2 = bandSpan(c, b2);
    const lo = Math.max(0, Math.min(Math.abs(s2[0] - s1[1]), Math.abs(s1[0] - s2[1])));
    const hi = Math.max(Math.abs(s2[1] - s1[0]), Math.abs(s1[1] - s2[0]));
    assert.ok(sizes[0] >= lo && sizes[0] <= hi,
      `${k}: stated ${sizes[0]} outside the ${lo}..${hi} the band edges allow`);
  }
});

test('the recombinant sizes both halves of its imbalance', () => {
  const t = decodeText('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat');
  assert.ok(statedBp(t).length >= 2, `both the duplicated and the deleted segment carry a size: ${t}`);
});

test('the lone derivative sizes its trisomy and its monosomy', () => {
  const t = decodeText('46,XX,der(8)t(4;8)(p16.1;p23.1)');
  const sizes = statedBp(t);
  assert.ok(sizes.length >= 2, `the attached piece and both imbalance segments carry sizes: ${t}`);
});

test('the band map states each band span on the named assembly', () => {
  const info = Teach.bandInfo('5', 'p15.2');
  assert.match(info.position, /GRCh38/, 'the assembly is named');
  assert.match(info.position, /about [\d.]+ (Mb|kb)/, 'and the band width is stated');
});

test('the method is stated once, on the how-to-read card', () => {
  const arm = JSON.stringify(Teach.ARM_INFO);
  assert.match(arm, /band midpoints/, 'sizes are estimates from band midpoints');
  assert.match(arm, /GRCh38/, 'on the named assembly');
});
