'use strict';
// Segregation model tests (segregation.js). Like the parser/renderer it is a browser
// IIFE loaded into a window shim via vm. These pin the enumerated gametes and
// conceptus karyotypes against ISCN 2024 Table 5 (reciprocal t(2;5)(q21;q31)) and the
// classic Robertsonian outcomes, and assert every emitted karyotype re-parses cleanly.
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
load('segregation.js');
const ISCN = win.ISCN;
const Seg = win.Segregation;

const clone0 = (k) => ISCN.parse(k).clones[0];
const model = (k) => Seg.compute(clone0(k));
const zygotes = (m) => m.modes.flatMap((md) => md.gametes.map((g) => g.zygote));
const gameteBy = (m, zy) => m.modes.flatMap((md) => md.gametes).find((g) => g.zygote === zy);
// Arrays built inside the vm realm have a foreign Array.prototype, so deepStrictEqual
// rejects them against native arrays; normalise through JSON before comparing.
const native = (x) => JSON.parse(JSON.stringify(x));
const eq = (actual, expected) => assert.deepEqual(native(actual), expected);

test('segregation module loads', () => {
  assert.equal(typeof Seg.compute, 'function');
  assert.equal(typeof Seg.eligible, 'function');
  assert.equal(typeof Seg.render, 'function');
});

// ---- eligibility ------------------------------------------------------------
test('a balanced reciprocal translocation carrier is eligible', () => {
  assert.equal(Seg.eligible(clone0('46,XX,t(2;5)(q21;q31)')), true);
});
test('a Robertsonian carrier is eligible (rob and der spellings)', () => {
  assert.equal(Seg.eligible(clone0('45,XX,der(14;21)(q10;q10)')), true);
  assert.equal(Seg.eligible(clone0('45,XY,rob(13;14)')), true);
});
test('normal, aneuploid, and deleted karyotypes are NOT eligible', () => {
  assert.equal(Seg.eligible(clone0('46,XX')), false);
  assert.equal(Seg.eligible(clone0('47,XX,+21')), false);
  assert.equal(Seg.eligible(clone0('46,XY,del(5)(p15.2)')), false);
});
test('a three-way translocation is out of scope (not eligible)', () => {
  assert.equal(Seg.eligible(clone0('46,XY,t(2;5;7)(q21;q31;q22)')), false);
});
test('an unbalanced translocation (with a +/- partner) is not treated as a carrier', () => {
  assert.equal(Seg.eligible(clone0('47,XX,t(2;5)(q21;q31),+21')), false);
});

// ---- reciprocal: matches ISCN 2024 Table 5 (t(2;5)(q21;q31)) ----------------
test('reciprocal forms a quadrivalent with five segregation modes', () => {
  const m = model('46,XX,t(2;5)(q21;q31)');
  assert.equal(m.type, 'reciprocal');
  assert.equal(m.valent, 'quadrivalent');
  eq(m.modes.map((x) => x.name), ['Alternate', 'Adjacent-1', 'Adjacent-2', '3:1', '4:0']);
});
test('alternate yields the normal and the balanced-carrier conceptions', () => {
  const alt = model('46,XX,t(2;5)(q21;q31)').modes[0];
  assert.equal(alt.balanced, true);
  eq(alt.gametes.map((g) => g.zygote), ['46,XX', '46,XX,t(2;5)(q21;q31)']);
});
test('adjacent-1 gives der(5) and der(2) conceptions (Table 5)', () => {
  const adj1 = model('46,XX,t(2;5)(q21;q31)').modes[1];
  eq(adj1.gametes.map((g) => g.zygote),
    ['46,XX,der(5)t(2;5)(q21;q31)', '46,XX,der(2)t(2;5)(q21;q31)']);
});
test('adjacent-2 gives +der,-partner conceptions (Table 5)', () => {
  const adj2 = model('46,XX,t(2;5)(q21;q31)').modes[2];
  eq(adj2.gametes.map((g) => g.zygote),
    ['46,XX,+der(2)t(2;5)(q21;q31),-5', '46,XX,+der(5)t(2;5)(q21;q31),-2']);
});
test('3:1 gives the tertiary and interchange conceptions (all four ways to split three-to-one)', () => {
  const t31 = model('46,XX,t(2;5)(q21;q31)').modes[3];
  // tertiary (extra/missing derivative): +der(A), +der(B), der(A)-B, der(B)-A
  // then interchange (extra/missing whole normal chromosome): +2, +5, -2, -5
  eq(t31.gametes.map((g) => g.zygote), [
    '47,XX,+der(2)t(2;5)(q21;q31)',
    '47,XX,+der(5)t(2;5)(q21;q31)',
    '45,XX,der(2)t(2;5)(q21;q31),-5',
    '45,XX,der(5)t(2;5)(q21;q31),-2',
    '47,XX,+2,t(2;5)(q21;q31)',
    '47,XX,+5,t(2;5)(q21;q31)',
    '45,XX,-2',
    '45,XX,-5'
  ]);
});
test('4:0 gives the disomic (48) and nullisomic (44) conceptions, both lethal', () => {
  const four = model('46,XX,t(2;5)(q21;q31)').modes[4];
  assert.equal(four.name, '4:0');
  eq(four.gametes.map((g) => g.zygote), [
    '48,XX,+der(2)t(2;5)(q21;q31),+der(5)t(2;5)(q21;q31)',
    '44,XX,-2,-5'
  ]);
  eq(four.gametes.map((g) => g.viability.tag), ['lethal', 'lethal']);
});
test('interchange 3:1 reads out as a whole-chromosome trisomy/monosomy (lethal for chr 2 and 5)', () => {
  const m = model('46,XX,t(2;5)(q21;q31)');
  const triA = gameteBy(m, '47,XX,+2,t(2;5)(q21;q31)');
  assert.equal(triA.label, 'interchange trisomy');
  assert.equal(triA.viability.tag, 'lethal');
  // the extra chromosome is a whole normal 2, so the conceptus is fully trisomic for chromosome 2
  assert.equal(triA.imbalance, 'partial trisomy 2pter→q21, partial trisomy 2q21→qter');
  const monoA = gameteBy(m, '45,XX,-2');
  assert.equal(monoA.label, 'interchange monosomy');
  assert.equal(monoA.viability.tag, 'lethal');
  assert.equal(monoA.imbalance, 'partial monosomy 2pter→q21, partial monosomy 2q21→qter');
});
test('adjacent-1 imbalance names the duplicated and deleted segments', () => {
  const g = gameteBy(model('46,XX,t(2;5)(q21;q31)'), '46,XX,der(5)t(2;5)(q21;q31)');
  assert.equal(g.imbalance, 'partial trisomy 2q21→qter, partial monosomy 5q31→qter');
});
test('only alternate is flagged balanced; the rest unbalanced', () => {
  const m = model('46,XX,t(2;5)(q21;q31)');
  eq(m.modes.map((x) => x.balanced), [true, false, false, false, false]);
});

// ---- Robertsonian: translocation Down syndrome ------------------------------
test('Robertsonian forms a trivalent with alternate + adjacent modes', () => {
  const m = model('45,XX,der(14;21)(q10;q10)');
  assert.equal(m.type, 'robertsonian');
  assert.equal(m.valent, 'trivalent');
  eq(m.modes.map((x) => x.name), ['Alternate', 'Adjacent']);
});
test('rob(14;21) adjacent segregation produces translocation Down syndrome, flagged viable', () => {
  const m = model('45,XX,der(14;21)(q10;q10)');
  const down = gameteBy(m, '46,XX,der(14;21)(q10;q10),+21');
  assert.ok(down, 'the +21 conception is enumerated');
  assert.equal(down.viability.tag, 'viable');
  assert.match(down.viability.text, /Down syndrome/);
});
test('rob(14;21) also enumerates the lethal trisomy 14 and the two monosomies', () => {
  const zys = zygotes(model('45,XX,der(14;21)(q10;q10)'));
  assert.ok(zys.includes('46,XX,der(14;21)(q10;q10),+14'));
  assert.ok(zys.includes('45,XX,-21'));
  assert.ok(zys.includes('45,XX,-14'));
});
test('the balanced carrier conception restates the parent karyotype', () => {
  const zys = zygotes(model('45,XX,der(14;21)(q10;q10)'));
  assert.ok(zys.includes('45,XX,der(14;21)(q10;q10)'));
  assert.ok(zys.includes('46,XX'));
});

// ---- invariant: every emitted conceptus karyotype re-parses cleanly ---------
test('every conceptus karyotype the model emits parses back with no warnings', () => {
  ['46,XX,t(2;5)(q21;q31)', '45,XX,der(14;21)(q10;q10)', '46,XY,t(11;22)(q23;q11.2)'].forEach((k) => {
    zygotes(model(k)).forEach((zy) => {
      const p = ISCN.parse(zy);
      assert.equal(p.ok, true, `${zy} should parse ok`);
      assert.equal(p.warnings.length, 0, `${zy} should have no warnings: ${p.warnings.join("; ")}`);
    });
  });
});

// ---- the recurrent t(11;22): 3:1 der(22) is the liveborn (Emanuel) outcome --
test('t(11;22) flags its 3:1 +der(22) conception as potentially liveborn (Emanuel)', () => {
  const g = gameteBy(model('46,XY,t(11;22)(q23;q11.2)'), '47,XY,+der(22)t(11;22)(q23;q11.2)');
  assert.ok(g, 'the +der(22) conception is enumerated');
  assert.match(g.viability.text, /Emanuel/);
});

// ---- render smoke test ------------------------------------------------------
test('render returns HTML containing the mode names and an SVG', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  assert.match(html, /Adjacent-1/);
  assert.match(html, /Alternate/);
  assert.match(html, /<svg/);
  assert.match(html, /Meiotic segregation/);
});
test('render states the meiosis I timing (prophase I pairing, anaphase I separation)', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  assert.match(html, /prophase I/);
  assert.match(html, /anaphase I/);
});
test('render carries no caveat paragraph (the panel is suppressed for somatic cases upstream)', () => {
  // Suppression for acquired/cancer translocations is an app-level decision (index.html),
  // so the panel that does render is always the constitutional case and needs no caveat.
  assert.doesNotMatch(Seg.render(model('46,XX,t(2;5)(q21;q31)')), /seg-caveat/);
});

// ---- the segregation scenes: the reason for the names is drawn --------------
test('each mode draws its own division scene (an svg per mode)', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  // pairing figure + one scene per mode (5) = 6 scene svgs
  assert.equal((html.match(/class="seg-scene-svg"/g) || []).length, 6);
  assert.match(html, /class="seg-scene"/);
});
test('the captions spell out why the modes are named alternate vs adjacent', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  assert.match(html, /opposite corners/);       // alternate: crossing, every other one
  assert.match(html, /neighbors/);              // adjacent: side-by-side
  assert.match(html, /matching centromeres/);    // adjacent-2: homologous centromeres together
});
test('the reading key names both encodings (chromosome of origin and pole destination)', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  assert.match(html, /Chromosome of origin/);
  assert.match(html, /travels to pole 1/);
  assert.match(html, /travels to pole 2/);
});
test('an anaphase-pull animation toggle is offered', () => {
  assert.match(Seg.render(model('46,XX,t(2;5)(q21;q31)')), /id="seg-anim"/);
});
test('centromere dots are colored by the chromosome the centromere belongs to', () => {
  // A and its own der share a centromere color (homologous centromeres); B differs.
  const b = model('46,XX,t(2;5)(q21;q31)').bodies;
  assert.equal(b.A.cen, b.dA.cen);
  assert.equal(b.B.cen, b.dB.cen);
  assert.notEqual(b.A.cen, b.B.cen);
});
test('2:2 and the 4:0 disomic gamete are keyed to their pole; the 3:1 gametes stay neutral', () => {
  const html = Seg.render(model('46,XX,t(2;5)(q21;q31)'));
  assert.match(html, /seg-g-teal/);   // one pole
  assert.match(html, /seg-g-rose/);   // the other
  // A single-division outcome (two gametes) is tinted to its pole; a 3:1 gamete spans both poles
  // (eight gametes, left neutral). Tinted cards: three 2:2 modes give two each (6), plus the 4:0
  // disomic gamete (1) whose four chromosomes all leave one pole = 7. The empty 4:0 gamete has none.
  assert.equal((html.match(/seg-g-(teal|rose)/g) || []).length, 7);
});
