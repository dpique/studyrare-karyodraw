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
  // A derivative carrying a "?" or an hsr: the composition now states them, and
  // the der reader refuses any piece that is not two band names.
  '46,XX,der(5)add(5)(p15.3)add(5)(q23)',
  '46,XX,der(1)hsr(1)(p22)hsr(1)(q31)[10]',
  '46,XY,der(1)del(1)(p33p21)hsr(1)(p33)[10]',
  '46,XX,der(2)del(2)(q21q31)hsr(2)(q21)[10]',
  '46,XX,der(1)ins(1;7)(q21;p21p11.2)hsr(1;7)(q21;p11.2)[10]',
  '46,XX,der(1)ins(1;7)(q21;p11.2p21)hsr(1;7)(q21;p11.2)[10]',
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

// A translocation between the two homologues of one pair puts BOTH breakpoint bands at
// the one junction of EACH derivative (t(9;9)(p21.2;q22.33) copies as
// 9qter→9q22.33::9p21.2→9qter beside 9pter→9q22.33::9p21.2→9pter), so the chromosome
// number cannot say which band is a derivative's own; the piece that carries the
// centromere can. Dan pasted the app's own copied line for this t(9;9) back into the
// box and was told the app "cannot work back to it" (2026-09-14). Both orders of the
// short form, and both arms, since a rule with a p/q axis gets every corner tested.
test('the copied line of a translocation between homologues pastes back and reads as itself', () => {
  for (const k of [
    '46,XY,t(9;9)(p21.2;q22.33)',
    '46,XY,t(9;9)(q22.33;p21.2)',
    '46,XX,t(16;16)(p13;q22)',
    '46,XY,t(3;3)(q21.3;q26.2)',
    '46,XX,t(1;1)(p31;q32)',
  ]) {
    const copied = line(k);
    assert.match(copied, /::/, `${k} did not copy as a composition: ${copied}`);
    const back = ISCN.parse(copied);
    assert.ok(back.ok && back.clones.length && back.clones.every((c) => !c.unreadable) && !back.suggestion,
      `${copied}\n  refused: ${back.warnings[0] || ''}`);
    const readAs = (/“([^”]*)”\.$/.exec(back.warnings.find((w) => /DETAILED/.test(w)) || '') || [])[1];
    assert.equal(readAs, k, `${copied} read back as a different karyotype`);
  }
});

// ISCN 2024 prints one such exchange itself, sequencing example v:
//   seq[GRCh38] t(9;9)(9qter→9q31.1::9p21.2→9qter;9pter→9q31.1::9p21.2→9qter)
// with the prose "a translocation between homologous chromosomes with breakpoints at
// 9p21.2 and 9q31.1". As printed, the second composition ends in 9qter, which would
// give that derivative two centromeres; the HGVS line beside it
// ([102425452_qterdelinspter_26393001inv]) and the prose end the grafted piece at
// pter. The reader takes the line as printed and still lands on the stated
// breakpoints: the first derivative claims p21.2, so the second keeps q31.1.
test('ISCN 2024 sequencing example v, a translocation between homologues, reads as its stated breakpoints', () => {
  const back = ISCN.parse('46,XY,t(9;9)(9qter→9q31.1::9p21.2→9qter;9pter→9q31.1::9p21.2→9qter)');
  assert.ok(back.ok && back.clones.every((c) => !c.unreadable), back.warnings[0] || '');
  const readAs = (/“([^”]*)”\.$/.exec(back.warnings.find((w) => /DETAILED/.test(w)) || '') || [])[1];
  assert.equal(readAs, '46,XY,t(9;9)(p21.2;q31.1)');
});

// The segments a figure is drawn from do not carry everything ISCN writes into a
// composition: an add's unknown material, an hsr's amplified block, and a break the
// model could give no length (a deletion within one band). The copied line used to
// state a whole, untouched chromosome for each: 46,XX,add(19)(pter→qter), which
// pasted back as a normal 19 and read "add" over a picture that claimed nothing was
// added (corpus sweep, 2026-09-14). ISCN prints every one of these forms itself
// (add 5.5.1, hsr 5.5.8, del 5.5.2), and they are in the corpus as the oracle; this
// pins the shell and the paste-back for the plain cases, and that a fragile site,
// for which the standard prints no composition, keeps its short form.
test('add, hsr and a within-band deletion copy as ISCN writes them and paste back', () => {
  const cases = {
    '46,XX,add(19)(p13.3)': '46,XX,add(19)(?::p13.3→qter)',
    '46,XY,add(12)(q13)': '46,XY,add(12)(pter→q13::?)',
    '46,XX,hsr(1)(p22)[10]': '46,XX,hsr(1)(pter→p22::hsr::p22→qter)[10]',
    '46,XY,hsr(21)(q22)[10]': '46,XY,hsr(21)(pter→q22::hsr::q22→qter)[10]',
    '46,XX,del(5)(q13q13)': '46,XX,del(5)(pter→q13::q13→qter)',
  };
  for (const k of Object.keys(cases)) {
    const copied = line(k);
    assert.equal(copied, cases[k]);
    const back = ISCN.parse(copied);
    assert.ok(back.ok && back.clones.length && back.clones.every((c) => !c.unreadable) && !back.suggestion,
      `${copied}\n  refused: ${back.warnings[0] || ''}`);
    const readAs = (/“([^”]*)”\.$/.exec(back.warnings.find((w) => /DETAILED/.test(w)) || '') || [])[1];
    assert.equal(readAs, k, `${copied} read back as a different karyotype`);
  }
});

test('a fragile site has no composition to state, so the line keeps its short form', () => {
  const model = ISCN.parse('46,X,fra(X)(q27.3)');
  const forms = [];
  for (const clone of model.clones) for (const ch of Object.keys(clone.slots || {})) for (const inst of clone.slots[ch] || []) {
    if (inst.kind !== 'normal') forms.push(Karyo.detailedForm(inst));
  }
  assert.deepEqual(forms, [''], 'the fra(X) row must be silent, not "pter→qter"');
  assert.equal(line('46,X,fra(X)(q27.3)'), '46,X,fra(X)(q27.3)');
});
