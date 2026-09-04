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
load('karyo-render.js');
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

// ---- every conceptus is one click from being drawn --------------------------
// The panel already enumerates the karyotypes related to what the user typed: a
// rob(13;14) carrier lists 46,XY,der(13;14)(q10;q10),+14 as its trisomy 14
// product. Those strings were dead text, so a student reading the panel had to
// retype them (and, as one did, mistype them). They are buttons now, carrying the
// karyotype in data-k like the example chips and the "did you mean" fix.
const loadable = (html) => [...html.matchAll(/data-k="([^"]*)"/g)].map((m) => m[1]);

test('each conceptus karyotype is emitted as a loadable button', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  const ks = loadable(html);
  assert.ok(ks.includes('46,XY,der(13;14)(q10;q10),+14'), 'the trisomy 14 product is loadable');
  assert.ok(ks.includes('46,XY,der(13;14)(q10;q10),+13'), 'the trisomy 13 product is loadable');
  assert.ok(ks.includes('46,XY'), 'the normal outcome is loadable');
  assert.match(html, /class="seg-kt"/);
});
test('the loadable karyotypes are exactly the conceptus karyotypes', () => {
  const m = model('46,XX,t(2;5)(q21;q31)');
  const ks = loadable(Seg.render(m));
  eq([...ks].sort(), native(zygotes(m)).sort());   // no extras, none missed
});
test('every loadable karyotype re-parses to itself', () => {
  ['45,XY,der(13;14)(q10;q10)', '46,XX,t(2;5)(q21;q31)', '45,XX,rob(14;21)(q10;q10)'].forEach((k) => {
    loadable(Seg.render(model(k))).forEach((z) => {
      const p = ISCN.parse(z);
      assert.equal(p.warnings.length, 0, z + ' parses without complaint');
      assert.equal(p.suggestion, null, z + ' needs no repair');
      assert.equal(p.clones[0].counts.ok, true, z + ' is internally consistent');
    });
  });
});
// Chromosome names come out of the input verbatim, so a quote in one must not be
// able to close the attribute early. Escaping is correct exactly when every emitted
// value survives unescaping back to the karyotype it stands for.
test('a quote in a chromosome name is escaped inside data-k, not able to close it', () => {
  // Injected into the parsed clone, upstream of compute(), so the quote travels the
  // whole pipeline exactly as it used to. It is put there rather than typed into the
  // karyotype because the parser now drops characters that are not ISCN, which is why
  // this test stopped reaching the code it guards. The escaping stays and is tested
  // directly: "the parser happens to filter it out" is not a property the renderer
  // should be resting on.
  const c = clone0('46,XX,t(2;5)(q21;q31)');
  c.aberrations[0].chroms[0] = '2"';
  const m = Seg.compute(c);
  assert.ok(m, 'still modeled');
  const html = Seg.render(m);
  assert.match(html, /&quot;/, 'the quote is entity-escaped');
  const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  eq(loadable(html).map(unesc).sort(), native(zygotes(m)).sort());
});
test('the panel states that the conceptus karyotypes are clickable', () => {
  assert.match(Seg.render(model('46,XX,t(2;5)(q21;q31)')), /Click any conceptus karyotype/);
});

// ---- parental origin: the forward model, run backwards ----------------------
// Typing an unbalanced product used to get nothing, because eligible() requires a
// balanced carrier. That is backwards from clinic and from the exam, where you are
// handed the abnormal result and reason toward the parents. Implemented per
// docs/PARENTAL_ORIGIN.md: generate the small candidate set of carriers, run the
// EXISTING forward compute() on each, keep the ones whose zygote list contains what
// was typed. So correctness is a round trip, not a second enumeration.
const CARRIERS = [
  '45,XX,rob(13;14)(q10;q10)',
  '45,XX,rob(14;21)(q10;q10)',
  '46,XX,t(2;5)(q21;q31)',
  '46,XY,t(11;22)(q23;q11.2)',
];
// A zygote is in scope when it still carries a derivative. A bare aneuploidy
// (45,XX,-2 from interchange 3:1) is deliberately out: nondisjunction and a carrier
// parent both produce it, so naming a carrier would overclaim. See the spec.
const hasDer = (k) => /der\(|rob\(|t\(/.test(k);
const unbalancedZygotes = (carrier) => {
  const m = model(carrier);
  return m.modes.filter((md) => !md.balanced).flatMap((md) => md.gametes.map((g) => ({ zy: g.zygote, mode: md.name })));
};

test('every derivative-bearing unbalanced product finds its carrier and mode', () => {
  let checked = 0;
  CARRIERS.forEach((carrier) => {
    unbalancedZygotes(carrier).forEach((g) => {
      if (!hasDer(g.zy)) return;
      const org = Seg.origin(clone0(g.zy));
      assert.ok(org, `${g.zy} should trace back to a carrier`);
      const cand = org.candidates[0];
      assert.equal(cand.mode, g.mode, `${g.zy} should name ${g.mode}`);
      const back = native(zygotes(cand.model));
      assert.ok(back.includes(g.zy), `${g.zy} must appear in its carrier's own forward list`);
      checked++;
    });
  });
  assert.ok(checked >= 14, `covered ${checked} products`);
});
test('the carrier is offered in both sexes, and both parse to a balanced carrier', () => {
  const cand = Seg.origin(clone0('46,XX,der(14;21)(q10;q10),+21')).candidates[0];
  assert.equal(cand.carrier.XX, '45,XX,der(14;21)(q10;q10)');
  assert.equal(cand.carrier.XY, '45,XY,der(14;21)(q10;q10)');
  [cand.carrier.XX, cand.carrier.XY].forEach((k) => {
    const p = ISCN.parse(k);
    assert.equal(p.warnings.length, 0, k + ' parses clean');
    assert.equal(p.clones[0].counts.ok, true, k + ' is self-consistent');
    assert.equal(Seg.eligible(p.clones[0]), true, k + ' is a balanced carrier');
  });
});
test('no meiosis is embedded under the child; the chips carry the from thread', () => {
  const org = Seg.origin(clone0('46,XX,der(14;21)(q10;q10),+21'));
  assert.equal(org.candidates[0].model.hereZygote, '46,XX,der(14;21)(q10;q10),+21');
  const card = Seg.renderOriginCard(org);
  // The parent's meiosis stays on the parent page: its figures describe
  // chromosomes this karyotype does not contain (the trivalent pairs a free
  // homologue the child replaced), so embedding it here misattributes them.
  assert.doesNotMatch(card, /seg-mode|seg-scene|seg-gamete/);
  assert.match(card, /data-from="46,XX,der\(14;21\)\(q10;q10\),\+21"/, 'each carrier chip hands the typed karyotype along');
});
test('the carrier page marks the outcome the reader came from', () => {
  const m = Seg.compute(clone0('45,XX,der(14;21)(q10;q10)'));
  const back = Seg.applyFrom(m, '46,XX,der(14;21)(q10;q10),+21');
  assert.ok(back, 'the product is recognised');
  assert.equal(m.hereZygote, '46,XX,der(14;21)(q10;q10),+21');
  assert.match(Seg.render(m), /the karyotype you came from/);
  assert.match(back, /#segregation-card/, 'the return card points at the panel');
  assert.match(back, /data-k="46,XX,der\(14;21\)\(q10;q10\),\+21"/, 'and offers the way back');
  const bogus = Seg.compute(clone0('45,XX,der(14;21)(q10;q10)'));
  assert.equal(Seg.applyFrom(bogus, '46,XY,del(5)(p15.2)'), null, 'a foreign karyotype cannot claim a mark');
  const sexless = Seg.compute(clone0('46,XX,t(11;22)(q23;q11.2)'));
  assert.ok(Seg.applyFrom(sexless, '47,XY,+der(22)t(11;22)(q23;q11.2)mat'),
    'conceptus sex and suffix do not defeat the match on the mother side');
});
test('rob spelling and aberration order do not defeat the match', () => {
  assert.ok(Seg.origin(clone0('46,XX,rob(14;21)(q10;q10),+21')), 'rob() matches a der() candidate');
  assert.ok(Seg.origin(clone0('46,XX,+21,der(14;21)(q10;q10)')), 'order does not matter');
});
test('a balanced carrier gets no origin view (the forward panel serves it)', () => {
  CARRIERS.forEach((k) => assert.equal(Seg.origin(clone0(k)), null, k));
});
test('out-of-scope karyotypes get no origin view', () => {
  ['46,XX', '47,XX,+21', '45,XX,-21', '46,XY,del(5)(p15.2)', '46,XY,t(2;5;7)(q21;q31;q22)']
    .forEach((k) => assert.equal(Seg.origin(clone0(k)), null, k));
});
test('origin() answers per clone; the mosaic gate belongs to the caller', () => {
  // Same layering as eligible(): renderSegregation() in index.html passes a clone only
  // when there is exactly one, so the mosaic rule lives there rather than being
  // duplicated here. A mosaic clone in isolation IS a translocation-Down complement,
  // and origin() correctly says so; it has no way to know a sibling clone exists.
  const m = ISCN.parse('mos 46,XX,der(14;21)(q10;q10),+21[12]/46,XX[18]');
  assert.equal(m.clones.length, 2);
  assert.ok(Seg.origin(m.clones[0]), 'the clone on its own traces to a carrier');
  assert.match(m.clones[0].raw, /\[12\]$/, 'and a trailing cell count does not defeat the match');
});
test('the origin view names de novo as the alternative, and says who to test', () => {
  const html = Seg.renderOriginCard(Seg.origin(clone0('46,XX,der(14;21)(q10;q10),+21')));
  assert.match(html, /de novo/i);
  assert.match(html, /parental karyotypes/i);
});
test('the origin view quotes no recurrence risk', () => {
  // The spec's hard line: this is where "what are the odds again" is most tempting,
  // and the numbers swing on chromosome pair, carrier sex, and ascertainment.
  CARRIERS.forEach((carrier) => {
    unbalancedZygotes(carrier).filter((g) => hasDer(g.zy)).forEach((g) => {
      const html = Seg.renderOriginCard(Seg.origin(clone0(g.zy)));
      assert.doesNotMatch(html, /\d\s*%/, g.zy + ' must not quote a percentage');
      assert.doesNotMatch(html, /\d+\s*in\s*\d/, g.zy + ' must not quote a 1-in-N risk');
    });
  });
});
test('a Robertsonian carrier of 14 or 15 names the UPD risk, without a figure', () => {
  const html = Seg.renderOriginCard(Seg.origin(clone0('46,XX,der(14;21)(q10;q10),+21')));
  assert.match(html, /uniparental disomy|UPD/i, 'named, because it is a reason to test the parents');
  const noUpd = Seg.renderOriginCard(Seg.origin(clone0('46,XX,der(5)t(2;5)(q21;q31)')));
  assert.doesNotMatch(noUpd, /uniparental disomy|UPD/i, 'not relevant to a 2;5 reciprocal');
});

// ---- adjacent divisions: complementary pairs, selectable planes -------------
// One 2:1 adjacent division sends the fusion with one homologue while the other
// homologue travels alone, so its two gametes are complements: the trisomy and
// the monosomy of the SAME chromosome come from the same plane. The panel
// groups them as clickable pairs and draws the plane of the selected pair.
// The division key names the homologue that travels ALONE ("A" or "B"), the
// same names the scenes use (Adjacent-A / Adjacent-B) in both figure systems.
// Before this, the caption said the fusion went with A while the to-scale
// figure drew it with B; tying caption, scene, and pair to one selection
// removes that disagreement by construction.
test('rob adjacent tags each gamete with its division; complements share a key', () => {
  const adj = model('45,XY,der(13;14)(q10;q10)').modes[1];
  const div = {};
  native(adj.gametes).forEach((g) => { div[g.zygote] = g.division; });
  // trisomy 14 and monosomy 14 come from the division where 13 goes alone
  assert.equal(div['46,XY,der(13;14)(q10;q10),+14'], 'A');
  assert.equal(div['45,XY,-14'], 'A');
  assert.equal(div['46,XY,der(13;14)(q10;q10),+13'], 'B');
  assert.equal(div['45,XY,-13'], 'B');
});
test('reciprocal gametes carry no division key (those modes draw one scene each)', () => {
  model('46,XX,t(2;5)(q21;q31)').modes.forEach((md) =>
    md.gametes.forEach((g) => assert.ok(!g.division, g.zygote)));
});
test('the rob panel draws BOTH adjacent planes and radio-selects between them', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  // pairing figure + alternate + two adjacent variants = 4 scene svgs
  assert.equal((html.match(/class="seg-scene-svg"/g) || []).length, 4);
  assert.match(html, /class="seg-scene seg-scene-div" data-div="A"/);
  assert.match(html, /class="seg-scene seg-scene-div" data-div="B"/);
  assert.equal((html.match(/name="seg-div"/g) || []).length, 2);
  assert.equal((html.match(/name="seg-div"[^>]*\schecked/g) || []).length, 1);
  assert.match(html, /id="seg-div-a"[^>]*\schecked/);   // default: the first-listed pair
});
test('a reciprocal panel gets no division radios (nothing for them to select)', () => {
  assert.doesNotMatch(Seg.render(model('46,XX,t(2;5)(q21;q31)')), /name="seg-div"/);
});
test('the caption names both planes, each variant keyed to its scene', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  assert.match(html, /class="seg-why-div" data-div="A">Drawn above: the fusion travels with <b>14<\/b> and <b>13<\/b> goes alone\./);
  assert.match(html, /class="seg-why-div" data-div="B">Drawn above: the fusion travels with <b>13<\/b> and <b>14<\/b> goes alone\./);
  // the one-sided sentence this replaces, which contradicted the to-scale figure
  assert.doesNotMatch(html, /Shown here the fusion goes with/);
});
test('gametes group into pair boxes wired to the radios, affordance stated', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  assert.equal((html.match(/class="seg-pair" data-div=/g) || []).length, 2);
  assert.match(html, /class="seg-pair-hit" for="seg-div-a"/);
  assert.match(html, /class="seg-pair-hit" for="seg-div-b"/);
  assert.match(html, /the fusion travels with <b>14<\/b>/);   // pair header names the division
  assert.match(html, /drawn above/);
  assert.match(html, /click to draw/);
});
test('arriving from an outcome sorts its pair first and preselects its plane', () => {
  const m13 = Seg.compute(clone0('45,XX,der(13;14)(q10;q10)'));
  assert.ok(Seg.applyFrom(m13, '46,XX,der(13;14)(q10;q10),+13'));
  const h13 = Seg.render(m13);
  const a13 = h13.indexOf('class="seg-pair" data-div="A"');
  const b13 = h13.indexOf('class="seg-pair" data-div="B"');
  assert.ok(a13 > 0 && b13 > 0, 'both pairs render');
  assert.ok(b13 < a13, 'the +13 pair (division B) leads');
  assert.match(h13, /id="seg-div-b"[^>]*\schecked/);
  assert.doesNotMatch(h13, /id="seg-div-a"[^>]*\schecked/);
  const m14 = Seg.compute(clone0('45,XX,der(13;14)(q10;q10)'));
  assert.ok(Seg.applyFrom(m14, '46,XX,der(13;14)(q10;q10),+14'));
  const h14 = Seg.render(m14);
  assert.ok(h14.indexOf('class="seg-pair" data-div="A"') < h14.indexOf('class="seg-pair" data-div="B"'),
    'the +14 pair (division A) leads');
  assert.match(h14, /id="seg-div-a"[^>]*\schecked/);
});
test('adjacent pair gametes are keyed to their pole, like the other single divisions', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  // alternate two + adjacent four; the tint no longer overclaims because the
  // selected pair is exactly the division the scene draws
  assert.equal((html.match(/seg-g-(teal|rose)/g) || []).length, 6);
});
test('the closing note stops at what the figure teaches (no ascertainment clause)', () => {
  const html = Seg.render(model('45,XY,der(13;14)(q10;q10)'));
  assert.doesNotMatch(html, /ascertainment/);
  assert.doesNotMatch(html, /genetic counselor/);
  assert.match(html, /the specific chromosomes and segment sizes\./);
});

test('nothing the segregation model emits is called out of order', () => {
  // The listing-order check is deliberately narrow because a broader one flagged
  // 46,XX,+der(5)t(2;5)(q21;q31),-2, which this model emits and which follows ISCN
  // 2024 Table 5. This pins the two halves of the app to the same position.
  const CARRIERS = ['46,XX,t(2;5)(q21;q31)', '45,XY,rob(14;21)(q10;q10)', '46,XY,t(11;22)(q23;q11.2)'];
  let seen = 0;
  CARRIERS.forEach((k) => {
    const model = Seg.compute(ISCN.parse(k).clones[0]);
    (model.modes || []).forEach((mode) => (mode.gametes || []).forEach((g) => {
      if (!g.zygote) return;
      seen += 1;
      const c = ISCN.parse(g.zygote).clones[0];
      assert.ok(c, `${g.zygote} parses`);
      assert.equal(c.outOfOrder, null, `${g.zygote} should not be called out of order`);
    }));
  });
  assert.ok(seen >= 20, `only ${seen} conceptus karyotypes checked`);
});

// ---- inheritance qualifiers reach the origin view ---------------------------
// ISCN 2024 Table 5 writes every segregant with dmat, so the standard's own
// spellings must fire; 4.2.1 g defines the suffix family (mat/pat name the
// parent, the d- forms mark one product of a parental rearrangement, inh leaves
// the parent unstated) and 4.2.1 h makes dn mean both parents karyotyped
// normal, which is why dn stands the inference down.
test('ISCN 2024 Table 5 spellings, dmat included, trace to carrier and mother', () => {
  const t5 = [
    ['46,XX,der(5)t(2;5)(q21;q31)dmat', 'Adjacent-1'],
    ['46,XX,der(2)t(2;5)(q21;q31)dmat', 'Adjacent-1'],
    ['46,XX,+der(2)t(2;5)(q21;q31)dmat,-5', 'Adjacent-2'],
    ['47,XX,+der(5)t(2;5)(q21;q31)dmat', '3:1'],
  ];
  t5.forEach(([k, mode]) => {
    const org = Seg.origin(clone0(k));
    assert.ok(org, `${k} should trace back to a carrier`);
    assert.equal(org.candidates[0].mode, mode, k);
    assert.equal(org.candidates[0].parent, 'mother', `${k} names the mother`);
    assert.equal(org.deNovoPossible, false, `${k}: an inherited suffix rules out de novo`);
  });
});
test('the classic Emanuel spelling with mat fires 3:1 and offers only the mother', () => {
  const org = Seg.origin(clone0('47,XY,+der(22)t(11;22)(q23;q11.2)mat'));
  assert.ok(org, 'the textbook +der(22)mat must fire');
  assert.equal(org.candidates[0].mode, '3:1');
  assert.equal(org.candidates[0].parent, 'mother');
  const card = Seg.renderOriginCard(org);
  assert.match(card, /the mother/);
  assert.match(card, /46,XX,t\(11;22\)\(q23;q11\.2\)/, 'her balanced karyotype is the chip');
  assert.equal((card.match(/class="seg-kt"/g) || []).length, 1, 'one chip, not an either/or pair');
});
test('pat and inh branch the copy; dn stands the inference down', () => {
  const pat = Seg.origin(clone0('46,XX,der(4)t(4;11)(p15;q23)pat'));
  assert.equal(pat.candidates[0].parent, 'father');
  assert.match(Seg.renderOriginCard(pat), /the father/);
  const inh = Seg.origin(clone0('46,XX,der(4)t(4;11)(p15;q23)inh'));
  assert.equal(inh.candidates[0].parent, 'inherited');
  assert.equal(inh.deNovoPossible, false);
  assert.match(Seg.renderOriginCard(inh), /without saying which/);
  assert.equal(Seg.origin(clone0('46,XX,der(4)t(4;11)(p15;q23)dn')), null,
    'dn documents normal parents, so no carrier view');
  const bare = Seg.origin(clone0('46,XX,der(4)t(4;11)(p15;q23)'));
  assert.equal(bare.deNovoPossible, true, 'no suffix keeps de novo on the table');
});

// ---- homologous Robertsonian: univalent, never the trivalent ----------------
// Gardner (5th ed, rob(21q21q)): a carrier of a homologous fusion has no normal
// homologue to pass on, so every conception is trisomic or monosomic and a
// chromosomally normal child is not possible. The trivalent model claimed
// otherwise for 45,XX,der(21;21)(q10;q10) until this split.
test('a homologous fusion carrier gets the univalent model, not the trivalent', () => {
  const m = model('45,XX,der(21;21)(q10;q10)');
  assert.equal(m.type, 'homologous');
  assert.equal(Seg.eligible(clone0('45,XX,rob(21;21)')), true, 'rob spelling too');
  assert.equal(model('45,XX,der(13;14)(q10;q10)').type, 'robertsonian', 'two different acros keep the trivalent');
  assert.equal(m.modes.length, 1);
  assert.equal(m.modes[0].balanced, false, 'no balanced mode exists');
  const zys = native(zygotes(m));
  assert.deepEqual(zys, ['46,XX,+21,der(21;21)(q10;q10)', '45,XX,-21'],
    'both gametes, trisomic spelled in ISCN 2024 printed order');
  zys.forEach((z) => {
    const p = ISCN.parse(z);
    assert.equal(p.warnings.length, 0, `${z} parses clean`);
    assert.equal(p.clones[0].counts.ok, true, `${z} is self-consistent`);
  });
});
test('the univalent panel never claims a normal or balanced outcome', () => {
  const html = Seg.render(model('45,XX,der(21;21)(q10;q10)'));
  assert.match(html, /univalent/);
  assert.match(html, /no alternate mode/i);
  assert.doesNotMatch(html, /chromosomally normal/);
  assert.doesNotMatch(html, /balanced carrier, like the parent/);
  assert.doesNotMatch(html, /seg-scene/, 'no division scene: there is no valent to draw');
});
test('the unbalanced homologous product traces back, in either written order', () => {
  ['46,XX,+21,der(21;21)(q10;q10)', '46,XX,der(21;21)(q10;q10),+21'].forEach((k) => {
    const org = Seg.origin(clone0(k));
    assert.ok(org, `${k} should trace back`);
    assert.equal(org.candidates[0].type, 'homologous');
    assert.equal(org.candidates[0].model.hereZygote, '46,XX,+21,der(21;21)(q10;q10)');
    const card = Seg.renderOriginCard(org);
    assert.match(card, /trisomic or monosomic/);
    assert.match(card, /i\(21\)\(q10\)/, 'the de novo isochromosome differential is named');
  });
  const m = Seg.compute(clone0('45,XX,der(21;21)(q10;q10)'));
  assert.ok(Seg.applyFrom(m, '46,XX,der(21;21)(q10;q10),+21'), 'either written order matches on the carrier page');
  assert.match(Seg.render(m), /the karyotype you came from/);
});
test('a homologous 15 fusion carries the UPD warning through origin', () => {
  const org = Seg.origin(clone0('46,XX,+15,der(15;15)(q10;q10)'));
  assert.ok(org);
  assert.deepEqual(native(org.candidates[0].upd), ['15']);
  assert.match(Seg.renderOriginCard(org), /Prader-Willi and Angelman/);
});

// ---- the parental-origin card -----------------------------------------------
test('the card is chips-first and mechanism-free', () => {
  const bare = Seg.renderOriginCard(Seg.origin(clone0('46,XX,der(4)t(4;11)(p15;q23)')));
  assert.match(bare, /A parent may be a balanced carrier/);
  assert.match(bare, /de novo/);
  // Chips lead (Dan, 2026-09-04): headline, then the carrier karyotypes, then
  // one caveat line. Mode names and mechanism live on the carrier page the
  // chips load, beside figures that are true of that page's karyotype.
  assert.ok(bare.indexOf('oal-chips') < bare.indexOf('oal-body'), 'chips come before the caveat');
  assert.doesNotMatch(bare, /Adjacent|3:1|segregation of/, 'no mechanism talk in the card');
  assert.doesNotMatch(bare, /#segregation-card/, 'nothing to jump to: no panel renders under the child');
  const mat = Seg.renderOriginCard(Seg.origin(clone0('47,XY,+der(22)t(11;22)(q23;q11.2)mat')));
  assert.match(mat, /names the mother/);
  const hom = Seg.renderOriginCard(Seg.origin(clone0('46,XX,+21,der(21;21)(q10;q10)')));
  assert.match(hom, /Could a parent carry this fusion\?/);
  assert.match(hom, /trisomic or monosomic/);
  assert.equal(Seg.renderOriginCard(null), '');
});
