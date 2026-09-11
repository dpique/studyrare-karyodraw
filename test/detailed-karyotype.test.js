'use strict';
// The copy button hands over the karyotype in ISCN's detailed system as ONE
// pasteable line, in the shell the standard prints beside its own examples.
// ISCN 2024 prints a hundred-odd karyotypes both ways joined by "or", and
// test/iscn-2024-detailed.js holds them verbatim, so the whole line can be
// checked against the standard rather than against our own reasoning about it.
// Before this, the copy was the block's rows as "label  composition" lines,
// which is not notation: pasted back, the app itself refused it (Dan's
// inv(16) screenshot, 2026-09-11).
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
const CORPUS = require('./iscn-2024-detailed.js');

const line = (k) => Karyo.detailedKaryotype(ISCN.parse(k));

test('the shell is op(chroms)(composition), sub-operations dropped, suffixes kept', () => {
  assert.equal(line('46,XX,inv(2)(p23p13)mat'), '46,XX,inv(2)(pter→p23::p13→p23::p13→qter)mat');
  assert.equal(line('46,XY,der(9)t(9;22)(q34;q11.2)'), '46,XY,der(9)(9pter→9q34::22q11.2→22qter)');
  assert.equal(line('47,XY,+der(22)t(9;22)(q34;q11.2)'), '47,XY,+der(22)(22pter→22q11.2::9q34→9qter)');
  assert.equal(line('46,XY,del(5)(p15.2)x2'), '46,XY,del(5)(:p15.2→qter)x2', 'a multiplied change is written once');
  assert.equal(line('46,XY,t(9;22)(q34;q11.2)[12]/46,XY[8]'),
    '46,XY,t(9;22)(9pter→9q34::22q11.2→22qter;22pter→22q11.2::9q34→9qter)[12]/46,XY[8]');
  assert.equal(line('mos 45,X[10]/46,XX[20]'), 'mos 45,X[10]/46,XX[20]', 'nothing structural: the short form is the line');
  assert.equal(line('47,XX,+21,inv(9)(p11q13)'), '47,XX,+21,inv(9)(pter→p11::q13→p11::q13→qter)');
});

test('whitespace in the typed karyotype does not reach the line', () => {
  assert.equal(line('46,XY,r(13)  (p11q34)'), '46,XY,r(13)(::p11→q34::)');
});

// The oracle: every pair ISCN prints both ways, where every chromosome the app builds
// serialises (generated: true), must come out as the standard's whole line. Entries
// printing two alternatives joined by "or" are the reader's choice, not a line.
test('every generated corpus karyotype assembles to the whole line ISCN printed', () => {
  const wrong = [];
  let checked = 0;
  for (const row of CORPUS) {
    if (!row.generated) continue;
    const want = row.detailed.replace(/\x07/g, '');
    if (/\)or[a-z]/.test(want)) continue;
    checked++;
    const got = line(row.short);
    if (got !== want) wrong.push(`  ${row.short}\n    want ${want}\n    got  ${got}`);
  }
  assert.ok(checked >= 55, `only ${checked} pairs checked`);
  assert.deepEqual(wrong, [], `${wrong.length} of ${checked} whole lines differ from ISCN:\n${wrong.join('\n')}`);
});

// The round trip: the copied line, pasted back, must draw the same karyotype for
// every operation the detailed-system reader converts. der(), ider() and rec()
// are the reader's known gap (their short form names an operation the
// composition alone does not fix), listed here so closing it is deliberate.
// The reader's known gap, by name: derivatives with more than one junction, a
// homologous der, and rec. Their short form names operations the composition alone
// does not fix (ISCN 5.5.3), so the app explains them rather than guessing. Closing
// any of these has to be a deliberate act: remove it from this list.
const KNOWN_GAP = new Set([
  '46,XY,der(9)inv(9)(p23p13)del(9)(q22q33)',
  '46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)',
  '46,XY,der(1)t(1;3)(p32;q21)t(3;7)(q28;q11.2)',
  '46,XY,der(1)t(1;3)(p32;q21)dup(1)(q25q42)',
  '46,XY,der(9)del(9)(p12)t(9;13)(q34;q11)',
  '46,XX,der(1)t(1;11)(p32;q13)t(1;3)(q25;q21)',
  '46,XX,der(1)del(1)(p34p22)ins(1;17)(p34;q25q11.2)',
  '46,XX,der(8)t(8;17)(p23;q21)inv(8)(p22q13)t(8;22)(q22;q12)',
  '45,XX,der(5;7)t(5;7)(q22;p13)t(3;7)(q21;q21)',
  '45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)',
  '45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)del(7)(q32)',
  '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)',
  '46,XX,der(1)t(1;1)(p31;q32)',
  '46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat',
]);

test('the copied line pastes back and reads as the very short form it came from', () => {
  const wrong = [], refused = [], closed = [];
  let checked = 0;
  for (const row of CORPUS) {
    if (!row.generated || /\)or[a-z]/.test(row.detailed)) continue;
    checked++;
    const copied = line(row.short);
    const back = ISCN.parse(copied);
    const drew = back.clones.length && back.clones.every((c) => !c.unreadable) && !back.suggestion;
    if (!drew) { if (!KNOWN_GAP.has(row.short)) refused.push(`  ${row.short}\n    copied ${copied}\n    ${back.warnings[0] || ''}`); continue; }
    if (KNOWN_GAP.has(row.short)) closed.push(row.short);
    const readAs = (/“([^”]*)”\.$/.exec(back.warnings.find((w) => /DETAILED/.test(w)) || '') || [])[1];
    if (readAs !== row.short) wrong.push(`  ${row.short}\n    copied  ${copied}\n    read as ${readAs}`);
  }
  assert.ok(checked >= 55, `only ${checked} pairs checked`);
  assert.deepEqual(refused, [], `refused outside the known gap:\n${refused.join('\n')}`);
  assert.deepEqual(wrong, [], `read back as a DIFFERENT karyotype:\n${wrong.join('\n')}`);
  assert.deepEqual(closed, [], `these now round-trip; take them off KNOWN_GAP: ${closed.join(', ')}`);
});
