'use strict';
// The gonosomal segregation model (segregation.js): t(X;autosome) for both
// carrier sexes, t(Y;autosome), and t(X;Y). The autosomal table was refused for
// these on purpose while no model existed (the 2026-09-10 why-no-table card);
// this is the model. What it must get right, and what these tests pin:
//
//   - The carrier CLASS is read off the free sex complement (46,X,t(X;4) is a
//     woman, 46,Y,t(X;4) a man, 46,X,t(Y;15) a man, 46,t(X;Y) a man with both
//     sex chromosomes in the exchange), and any other complement falls back to
//     a redirect card instead of a wrong table.
//   - For a female carrier every gamete forks on the sperm (X or Y); for a
//     male carrier the sperm IS the fork, so each gamete has one outcome and
//     the child's sex is written in it.
//   - The two X;autosome models describe the same conceptions. A conceptus
//     does not know which parent carried the translocation, so every outcome
//     of the male model must appear verbatim in the female model.
//   - X-inactivation logic follows the X-inactivation centre (XIST, Xq13):
//     an extra X segment that carries it can be silenced, one that does not
//     stays active, and a der(X) that kept it is preferentially inactivated.
//   - The Y questions follow SRY and Yq12: an inert heterochromatin exchange
//     with an acrocentric short arm is the classic benign familial variant,
//     a euchromatic Yq break costs fertility (AZF), and a Yp break that moves
//     SRY onto the derivative autosome makes the sex letters stop predicting
//     development (46,XX males, XY-complement females).
//   - Every conceptus karyotype the panel offers as a clickable chip parses
//     cleanly at its stated count, because each chip draws a page.
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
const outcomes = (m) => {
  const out = [];
  m.modes.forEach((md) => md.gametes.forEach((g) => (g.outcomes || []).forEach((o) => out.push(o))));
  return out;
};

test('carrier classes are read off the free sex complement', () => {
  assert.equal(model('46,X,t(X;4)(p21;p16)').cls, 'XA-f');
  assert.equal(model('46,Y,t(X;4)(p21;p16)').cls, 'XA-m');
  assert.equal(model('46,X,t(Y;15)(q12;p12)').cls, 'YA-m');
  assert.equal(model('46,t(X;Y)(p22.3;q11.2)').cls, 'XY');
  assert.equal(model('46,XX,t(4;6)(q21;q23)').type, 'reciprocal', 'the autosomal model is untouched');
});

test('a complement the model cannot read gets the redirect card, not a table', () => {
  const c = clone0('46,XX,t(X;4)(p21;p16)');
  assert.equal(Seg.eligible(c), false);
  const note = Seg.gonosomalNote(c);
  assert.match(note, /46,X,t\(X;4\)\(p21;p16\)/, 'points at the female carrier spelling');
  assert.match(note, /46,Y,t\(X;4\)\(p21;p16\)/, 'and at the male one');
  assert.equal(Seg.gonosomalNote(clone0('46,XX,t(4;6)(q21;q23)')), '', 'autosomal carriers have the real table');
  assert.equal(Seg.gonosomalNote(clone0('47,XX,+21')), '', 'nothing to redirect on a non-carrier');
  assert.equal(Seg.gonosomalNote(clone0('46,X,t(X;4)(p21;p16)')), '', 'a modeled carrier gets the model, not the card');
});

test('female carrier gametes fork on the sperm; male carrier gametes do not', () => {
  const f = model('46,X,t(X;4)(p21;p16)');
  assert.equal(f.fork, true);
  f.modes.forEach((md) => md.gametes.forEach((g) => {
    assert.equal(g.outcomes.length, 2, 'every gamete forks in two');
    assert.match(g.outcomes[0].when, /an X/);
    assert.match(g.outcomes[1].when, /a Y/);
  }));
  const m = model('46,Y,t(X;4)(p21;p16)');
  assert.equal(m.fork, false);
  m.modes.forEach((md) => md.gametes.forEach((g) => {
    assert.equal(g.outcomes.length, 1, 'the sperm is the fork');
    assert.equal(g.outcomes[0].when, null);
  }));
});

test('every offered conceptus karyotype parses cleanly at its stated count', () => {
  for (const k of ['46,X,t(X;4)(p21;p16)', '46,Y,t(X;4)(p21;p16)', '46,X,t(Y;15)(q12;p12)',
    '46,X,t(Y;7)(q11.21;p15)', '46,t(X;Y)(p22.3;q11.2)', '46,X,t(X;21)(q22;q22.1)']) {
    const m = model(k);
    for (const o of outcomes(m)) {
      const r = ISCN.parse(o.zygote);
      const bad = (r.warnings || []).filter((w) => /add up|not a human|unreadable/i.test(w));
      assert.equal(bad.length, 0, o.zygote + ' from ' + k + ': ' + bad.join(' | '));
      assert.equal(r.clones[0].modalNumber, parseInt(o.zygote, 10), o.zygote + ' count matches');
    }
  }
});

// A conceptus does not know which parent carried the translocation. The male
// model's sixteen outcomes must appear verbatim (karyotype, imbalance, chip
// text) among the female model's thirty-two, or the two pages would contradict
// each other about the same child.
test('the male and female X;autosome models agree on every shared conceptus', () => {
  const f = model('46,X,t(X;4)(p21;p16)');
  const m = model('46,Y,t(X;4)(p21;p16)');
  const key = (o) => o.zygote + ' | ' + o.imbalance + ' | ' + o.viability.text;
  const fset = new Set(outcomes(f).map(key));
  for (const o of outcomes(m)) {
    assert.ok(fset.has(key(o)), 'missing from the female model: ' + key(o));
  }
});

test('X-inactivation logic follows the X-inactivation centre', () => {
  // Break at Xp21: the exchanged piece is distal Xp, XIST stays on the der(X).
  const p = model('46,X,t(X;4)(p21;p16)');
  assert.equal(p.flags.xicDist, false);
  const pOut = outcomes(p);
  const extraSeg = pOut.find((o) => o.zygote.startsWith('46,XX,der(4)'));
  assert.match(extraSeg.note, /cannot be silenced/, 'an XIST-less extra segment stays active');
  const derX = pOut.find((o) => o.zygote.startsWith('46,X,der(X)'));
  assert.match(derX.note, /preferentially inactivated/, 'the XIST-bearing der(X) is the inactive X');

  // Break at Xq11, proximal to XIST: now the exchanged piece carries it.
  const q = model('46,X,t(X;4)(q11;p16)');
  assert.equal(q.flags.xicDist, true);
  const qOut = outcomes(q);
  assert.match(qOut.find((o) => o.zygote.startsWith('46,XX,der(4)')).note, /silence it/,
    'the XIST-bearing segment can be silenced, with spread into the autosomal material');
  assert.match(qOut.find((o) => o.zygote.startsWith('46,X,der(X)')).note, /no X-inactivation centre/,
    'and the der(X) without XIST can never be the inactive X');
});

test('the balanced carriers carry the sexed teaching notes', () => {
  const f = model('46,X,t(X;22)(q23;q11.2)');
  const out = outcomes(f);
  const carrierF = out.find((o) => o.zygote === '46,X,t(X;22)(q23;q11.2)');
  assert.match(carrierF.note, /NORMAL X/, 'the normal X is the inactive one in a balanced female');
  assert.match(carrierF.note, /premature ovarian insufficiency/, 'a break in Xq13-q26 carries the POI warning');
  const carrierM = out.find((o) => o.zygote === '46,Y,t(X;22)(q23;q11.2)');
  assert.match(carrierM.note, /MSCI/, 'the balanced son is flagged infertile via the XY body');
  const male = model('46,Y,t(X;22)(q23;q11.2)');
  assert.match(male.fertility.body, /XY body/, 'the male carrier leads with the MSCI story');
  assert.match(male.fertility.body, /sperm that do form/);
});

test('the whole-chromosome 3:1 outcomes are the classic syndromes', () => {
  const out = outcomes(model('46,X,t(X;21)(q22;q22.1)'));
  const turner = out.find((o) => o.zygote === '45,X');
  assert.match(turner.viability.text, /Turner/);
  const noX = out.find((o) => o.zygote === '45,Y');
  assert.match(noX.viability.text, /Never viable/, 'a conceptus with no X is not survivable');
  assert.match(out.find((o) => o.zygote === '47,XX,t(X;21)(q22;q22.1)').viability.text, /triple X/);
  assert.match(out.find((o) => o.zygote === '47,XY,t(X;21)(q22;q22.1)').viability.text, /Klinefelter/);
  const down = out.find((o) => o.zygote === '47,X,+21,t(X;21)(q22;q22.1)');
  assert.match(down.viability.text, /Down syndrome/, 'interchange trisomy 21 is translocation Down syndrome');
});

test('the Y;autosome model reads Yq12, AZF and the acrocentric short arm', () => {
  // The classic benign familial variant: inert Yq12 onto an acrocentric p arm.
  const benign = model('46,X,t(Y;15)(q12;p12)');
  assert.equal(benign.flags.inert, true);
  assert.equal(benign.flags.acroP, true);
  const bOut = outcomes(benign);
  assert.match(bOut.find((o) => o.zygote.startsWith('46,XX,der(15)')).viability.text, /Essentially normal daughter/);
  assert.match(bOut.find((o) => o.zygote.startsWith('46,X,der(Y)')).viability.text, /Essentially normal son/);
  assert.match(benign.fertility.body, /usually fertile/);

  // A euchromatic Yq break sits in AZF.
  const azf = model('46,X,t(Y;7)(q11.21;p15)');
  assert.equal(azf.flags.inert, false);
  assert.equal(azf.flags.azf, true);
  assert.match(azf.fertility.body, /AZF/);

  // A Yp break beyond SRY moves SRY onto the derivative autosome.
  const sry = model('46,X,t(Y;7)(p11.2;q22)');
  assert.equal(sry.flags.sryDist, true);
  const sOut = outcomes(sry);
  assert.match(sOut.find((o) => o.zygote.startsWith('46,XX,der(7)')).viability.text, /develops as male/,
    'the SRY-bearing der(7) makes a 46,XX male');
  assert.match(sOut.find((o) => o.zygote.startsWith('46,X,der(Y)')).viability.text, /female/,
    'and the SRY-less der(Y) child develops as female');
  assert.match(sOut.find((o) => o.zygote.startsWith('46,X,der(Y)')).note, /gonadoblastoma/);
});

test('t(X;Y) reads the pseudoautosomal geometry and the recurrent entity', () => {
  const rec = model('46,t(X;Y)(p22.3;q11.2)');
  assert.equal(rec.flags.recurrent, true);
  assert.equal(rec.flags.parShared, false, 'the Xp;Yq exchange separates the PAR tips');
  assert.match(rec.fertility.body, /azoospermic/);
  assert.match(rec.fertility.body, /der\(X\), carried and transmitted by women/);
  const rOut = outcomes(rec);
  const dX = rOut.find((o) => o.zygote.startsWith('46,X,der(X)'));
  assert.match(dX.note, /SHOX/i, 'the escape-gene short stature story is named');
  assert.match(dX.note, /ichthyosis/, 'and the STS contiguous possibility');
  const dY = rOut.find((o) => o.zygote.startsWith('46,X,der(Y)'));
  assert.match(dY.viability.text, /son/, 'SRY stays on the der(Y) in the recurrent form');

  // Same-arm breakpoints keep a shared PAR and a workable bivalent.
  const same = model('46,t(X;Y)(q28;q12)');
  assert.equal(same.flags.parShared, true);
  assert.match(same.fertility.body, /some carriers father children/);
});

test('scenes and pachytene serve the female model; male carriers stay schematic-honest', () => {
  // The female X;A carrier is a true ring of X, der(X), autosome, der(autosome),
  // so the to-scale pachytene cross applies to it exactly as to an autosomal
  // carrier. Male carriers hold the free gonosome in the fourth corner, which
  // the cross cannot draw; the render layer keeps them schematic (asserted in
  // the browser test), but the bodies must exist for the schematic scenes.
  const f = model('46,X,t(X;4)(p21;p16)');
  assert.equal(f.bodies.A.name, 'X');
  assert.equal(f.bodies.dA.name, 'der(X)');
  const m = model('46,Y,t(X;4)(p21;p16)');
  assert.equal(m.bodies.A.name, 'Y', 'the free Y holds the fourth corner');
  assert.equal(m.bodies.dA.name, 'der(X)');
  const y = model('46,X,t(Y;15)(q12;p12)');
  assert.equal(y.bodies.A.name, 'X', 'the free X holds the fourth corner');
  assert.equal(y.bodies.dA.name, 'der(Y)');
});

// ---- backward parental origin ----------------------------------------------
// The scoped follow-up from the model PR: an unbalanced gonosomal product
// typed directly should trace to its carrier parent the way autosomal
// products do. The carrier spellings are sexed (46,X,t(X;4) is a mother,
// 46,Y,t(X;4) a father, and a balanced Y;autosome or X;Y carrier can only be
// a father), so candidateCarriers emits one candidate per possible parent and
// the forward round-trip DISCOVERS who can produce the typed complement. That
// yields inferences no suffix supplies: 46,XX,der(4)t(X;4) needs an egg
// carrying a free X beside the der(4), which no paternal meiosis can make.
test('origin: a 46,XX der(4) child traces to the mother alone', () => {
  const o = Seg.origin(clone0('46,XX,der(4)t(X;4)(p21;p16)'));
  assert.ok(o, 'the round-trip finds a carrier');
  const whos = [...new Set(o.candidates.filter((c) => c.who).map((c) => c.who))];
  assert.deepEqual(whos, ['mother']);
  const card = Seg.renderOriginCard(o);
  assert.match(card, /Only the mother could carry the balanced form/);
  assert.match(card, /46,X,t\(X;4\)\(p21;p16\)/);
  assert.doesNotMatch(card, /46,Y,t\(X;4\)/, 'no paternal spelling is offered');
});

test('origin: a 46,XY der(4) child can come from either carrier, spelled per parent', () => {
  const o = Seg.origin(clone0('46,XY,der(4)t(X;4)(p21;p16)'));
  const whos = [...new Set(o.candidates.filter((c) => c.who).map((c) => c.who))].sort();
  assert.deepEqual(whos, ['father', 'mother']);
  const card = Seg.renderOriginCard(o);
  assert.match(card, /the mother/);
  assert.match(card, /the father/);
  assert.match(card, /46,X,t\(X;4\)\(p21;p16\)/);
  assert.match(card, /46,Y,t\(X;4\)\(p21;p16\)/);
  assert.doesNotMatch(card, /46,XX,t\(X;4\)/, 'the old sex-token splice never appears');
});

test('origin: Y;autosome products name the father, X;Y products add the familial route', () => {
  const y = Seg.origin(clone0('46,XX,der(7)t(Y;7)(q11.21;p15)'));
  assert.ok(y);
  const yCard = Seg.renderOriginCard(y);
  assert.match(yCard, /Only the father could carry the balanced form/);
  assert.match(yCard, /46,X,t\(Y;7\)\(q11.21;p15\)/);

  const xy = Seg.origin(clone0('46,X,der(X)t(X;Y)(p22.3;q11.2)'));
  assert.ok(xy);
  const xyCard = Seg.renderOriginCard(xy);
  assert.match(xyCard, /Only the father could carry the balanced form/);
  assert.match(xyCard, /carry this same derivative unbalanced/, 'the usual familial route is named');
});

test('origin: an inheritance suffix keeps the plain grammar when it agrees, and is flagged when it cannot', () => {
  const ok = Seg.renderOriginCard(Seg.origin(clone0('46,XY,der(4)t(X;4)(p21;p16)dmat')));
  assert.match(ok, /notation names the mother/);
  assert.match(ok, /46,X,t\(X;4\)\(p21;p16\)/);

  const clash = Seg.renderOriginCard(Seg.origin(clone0('46,XX,der(4)t(X;4)(p21;p16)dpat')));
  assert.match(clash, /suffix and the chromosomes disagree/);
  assert.match(clash, /maternal/);
  assert.match(clash, /re-check/);
});

test('origin: interchange products trace too, and autosomal cards are untouched', () => {
  const down = Seg.origin(clone0('47,X,+21,t(X;21)(q22;q22.1)'));
  assert.ok(down, 'the translocation Down conceptus of an X;21 carrier traces');
  assert.match(Seg.renderOriginCard(down), /the mother/);

  const emanuel = Seg.origin(clone0('47,XX,+der(22)t(11;22)(q23;q11.2)'));
  assert.ok(emanuel, 'the Emanuel child still traces');
  assert.equal(emanuel.candidates[0].who, null);
  assert.match(Seg.renderOriginCard(emanuel), /either/, 'the autosomal grammar is unchanged');
});
