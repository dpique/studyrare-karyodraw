'use strict';
// Segment sizes, requested by a user on LinkedIn (Luis Valiño Castrillón):
// "Would it be possible that it could also provide an estimate of the size
// (Mb) of the involved segments?" They first shipped as "(about N Mb)"
// parentheticals woven into the decode prose; on 2026-08-30 Dan moved them
// into the net-imbalance table's own column (the parentheticals interrupted
// the sentences), computed from the same positions by Karyo.computeDosage.
// One deliberate loss: a BALANCED span (an inversion's segment, an insertion's
// moved piece) no longer carries a size anywhere, because the table only
// exists when something is imbalanced; the band map still sizes every band.
//
// The honesty rule is unchanged: a breakpoint written at a band can sit
// anywhere within that band, so sizes are estimates measured from band
// midpoints, with the method stated once on the how-to-read card. These tests
// assert numeric sanity: the run's extent must fall within the bounds the
// band edges allow.
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
const dosage = (k) => Karyo.computeDosage(ISCN.parse(k).clones[0]);
const runsOf = (k, c) => dosage(k).chroms.find((x) => x.chrom === c).runs;
// A named band's full extent, covering its sub-bands: p21 spans p21.1..p21.3.
const bandSpan = (c, b) => {
  const rows = IDEO.data[c].bands.filter((x) => x[0] === b || x[0].indexOf(b + '.') === 0);
  return [Math.min(...rows.map((x) => x[1])), Math.max(...rows.map((x) => x[2]))];
};

test('the decode prose carries no size parentheticals any more', () => {
  for (const k of [
    '46,XX,del(5)(p15.2)',
    '46,XX,dup(2)(p23p21)',
    '46,XX,inv(2)(p21q31)',
    '46,XY,ins(15)(p11q23q26)',
    '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat',
    '46,XX,der(8)t(4;8)(p16.1;p23.1)',
    '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)',
  ]) {
    assert.ok(!/about [\d.]+ (Mb|kb)/.test(decodeText(k)),
      `${k}: sizes live in the net-imbalance table now, not in the prose`);
  }
});

test('a terminal deletion sizes its lost segment in the table, within band bounds', () => {
  const runs = runsOf('46,XX,del(5)(p15.2)', '5');
  const lost = runs.find((r) => r.copies === 1);
  assert.ok(lost, 'the monosomic run exists');
  assert.equal(lost.fromLabel, 'pter');
  assert.equal(lost.toLabel, 'p15.2');
  const b = bandSpan('5', 'p15.2');
  const size = lost.to - lost.from;
  assert.ok(size >= b[0] && size <= b[1],
    `distal-to-p15.2 size ${size} should sit between the band edges ${b[0]}..${b[1]}`);
});

test('a duplication sizes its gained span in the table', () => {
  const runs = runsOf('46,XX,dup(2)(p23p21)', '2');
  const gained = runs.find((r) => r.copies === 3);
  assert.ok(gained, 'the trisomic run exists');
  const s1 = bandSpan('2', 'p23'), s2 = bandSpan('2', 'p21');
  const size = gained.to - gained.from;
  const lo = Math.max(0, Math.min(Math.abs(s2[0] - s1[1]), Math.abs(s1[0] - s2[1])));
  const hi = Math.max(Math.abs(s2[1] - s1[0]), Math.abs(s1[1] - s2[0]));
  assert.ok(size >= lo && size <= hi, `gained span ${size} outside the ${lo}..${hi} the band edges allow`);
});

test('the recombinant shows both halves of its imbalance as runs', () => {
  const runs = runsOf('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', '2');
  assert.ok(runs.some((r) => r.copies === 3 && r.fromLabel === 'pter'), 'the duplicated 2p end');
  assert.ok(runs.some((r) => r.copies === 1 && r.toLabel === 'qter'), 'the deleted 2q end');
});

test('the lone derivative shows its trisomy and its monosomy as runs', () => {
  const k = '46,XX,der(8)t(4;8)(p16.1;p23.1)';
  assert.ok(runsOf(k, '4').some((r) => r.copies === 3 && r.fromLabel === 'pter'), 'partial trisomy 4p');
  assert.ok(runsOf(k, '8').some((r) => r.copies === 1 && r.fromLabel === 'pter'), 'partial monosomy 8p');
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
