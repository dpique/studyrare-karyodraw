'use strict';
// Fixes from the 2026-08-29 message-quality audit of the production failure
// tail (381 unique refused inputs rendered through the page, deduped into 204
// message templates, agent-reviewed, high-severity claims re-verified by hand).
// Two kinds of change live here: parser/repair BUGS, and the homologous-t
// policy Dan decided the same day.
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
const Teach = win.Teach;

// ---- homologous t(N;N): accepted with breakpoints ---------------------------
// The refusal said "a translocation is an exchange between two different
// chromosomes", and the standard disagrees: ISCN 2024 prints
// der(1)t(1;1)(p31;q32), 46,XX,+21,der(21;21)(q10;q10), and t(2;7;7). The
// refusal was turning away 46,XY,t(3;3)(q21.3;q26.2), the canonical MECOM
// rearrangement of AML. Policy decided by Dan 2026-08-29: draw it when the
// breakpoints are stated.

test('t(3;3) with breakpoints parses clean and makes two derivative homologs', () => {
  const m = ISCN.parse('46,XY,t(3;3)(q21.3;q26.2)');
  assert.equal(m.ok, true);
  assert.equal(m.warnings.length, 0);
  const c = m.clones[0];
  assert.equal(c.unreadable, false);
  assert.equal(c.countWrong, false);
  const ders = (c.slots['3'] || []).filter((i) => i.kind !== 'normal');
  assert.equal(ders.length, 2, 'both homologs carry the exchange');
});

test('the homolog t decode says homologous, never "names one chromosome where it needs two"', () => {
  const c = ISCN.parse('46,XY,t(3;3)(q21.3;q26.2)').clones[0];
  const d = Teach.decode(c).map((r) => r.text).join(' ');
  assert.match(d, /homolog/i);
  assert.doesNotMatch(d, /needs two/);
});

test('the fused count reads a homolog q10;q10 t as its der(21;21)', () => {
  const m = ISCN.parse('45,XY,t(21;21)(q10;q10)');
  assert.equal(m.ok, true);
  assert.equal(m.clones[0].countWrong, false);
  assert.equal(m.warnings.length, 0);
  assert.ok(m.note, 'the reread is never silent');
  assert.equal(m.note.fix, '45,XY,der(21;21)(q10;q10)');
});

test('a count-consistent homolog whole-arm t draws with the rob note', () => {
  const m = ISCN.parse('46,XX,t(21;21)(q10;q10)');
  assert.equal(m.warnings.length, 0);
  assert.equal(m.clones[0].countWrong, false);
  assert.ok(m.note);
  assert.equal(m.note.fix, '45,XX,rob(21;21)(q10;q10)');
});

test('a homolog t without breakpoints still needs them', () => {
  const m = ISCN.parse('46,XY,t(3;3)');
  assert.equal(m.clones[0].unreadable, true, 'no bands, nothing honest to draw');
});

// ---- the replaced-homolog restore is all-or-nothing -------------------------
// The restore exists for 46,X,i(X)(q10): the i(X) is ADDITIONAL to the lone X
// because the stated 46 says so. It was firing on any deficit it could partly
// close: 46,XY,t(1;5)(q31;q23),del(5)(q22q35),del(12)(p12),-13,-16 tallies 44,
// and the restore pushed it to 45, so the count lecture carried a number that
// was wrong in both directions.

test('the count lecture states the true tally when the restore cannot reconcile', () => {
  const m = ISCN.parse('46,XY,t(1;5)(q31;q23),del(5)(q22q35),del(12)(p12),-13,-16');
  assert.equal(m.clones[0].counts.actual, 44, 'two losses, structural ops count-neutral');
  assert.equal(m.clones[0].countWrong, true);
  assert.match(m.warnings.join(' '), /44 chromosomes/);
});

test('the classic additional-isochromosome reading is untouched', () => {
  const m = ISCN.parse('46,X,i(X)(q10)');
  assert.equal(m.clones[0].counts.actual, 46);
  assert.equal(m.clones[0].countWrong, false);
  assert.equal(m.warnings.length, 0);
});

// ---- signs inside parentheses are not new changes ---------------------------
// The change-splitter fired on the "-" inside "-4(pter-p15.1)", the parens
// lesson then swapped its comma for a semicolon, and the offered repair
// re-parsed into itself with one more semicolon, forever. The honest reading
// of sign+chromosome+parens is a segment loss, which ISCN writes as a deletion.

test('a sign inside parentheses never splits, and the repair never grows', () => {
  const m = ISCN.parse('46,XY,-4(pter-p15.1)');
  for (const f of m.fixes) {
    assert.doesNotMatch(f, /;;/, f);
    const re = ISCN.parse(f);
    for (const f2 of re.fixes) assert.doesNotMatch(f2, /;;/, f + ' -> ' + f2);
  }
  assert.match(m.warnings.join(' '), /del\(4\)\(p15\.1\)/, 'taught as the terminal deletion it means');
  assert.ok(m.fixes.indexOf('46,XY,del(4)(p15.1)') >= 0, 'and offered');
});

// ---- an uncertain-chromosome derivative still counts as a body --------------
// 46,XY,-5,+der(?)t(?;5)(?;q13) is self-consistent: minus a 5, plus a
// derivative. The tally skipped the der it could not place and then blamed the
// count that was right.

test('a +der(?) is not dropped from the tally', () => {
  const m = ISCN.parse('46,XY,-5,+der(?)t(?;5)(?;q13)');
  assert.equal(m.clones[0].countWrong, false);
  assert.doesNotMatch(m.warnings.join(' '), /number at the start says/);
});

// ---- the ploidy trial keeps the nearest base, not the diploid fallback ------
// 96,xxxxxx reconciles with nothing exactly; the old fallback rebuilt diploid
// (44 autosomes + 6 X = 50) and suggested HALVING the typed count. Tetraploid
// is 4 away; diploid is 46 away.

test('an unreconciled high count lands on the nearest ploidy, not diploid', () => {
  const m = ISCN.parse('96,xxxxxx');
  assert.equal(m.clones[0].ploidy, 4, 'scaffold at the nearest base');
  assert.equal(m.countFix, '94,xxxxxx');
  const m2 = ISCN.parse('96,xxxx');
  assert.equal(m2.countFix, '92,xxxx');
});

test('exact ploidy matches still reconcile silently', () => {
  assert.equal(ISCN.parse('96,xxxxxxxx').warnings.length, 0, 'tetraploid, 88+8');
  assert.equal(ISCN.parse('69,XXX').warnings.length, 0, 'triploid, 66+3');
});

// ---- a glued change after the sex field is a missing comma, not junk --------
// 47,XX+mar had its marker amputated: the sex-field cleanup dropped "+mar" and
// offered plain 47,XX, chaining Down syndrome typed 47,XY+21 down to 46,XY.

test('a change glued to the sex field gets the comma back, content kept', () => {
  const a = ISCN.parse('47,XX+mar');
  assert.equal(a.suggestion, '47,XX,+mar');
  assert.equal(ISCN.parse(a.suggestion).warnings.length, 0);
  const b = ISCN.parse('47,XY+21');
  assert.equal(b.suggestion, '47,XY,+21');
  assert.equal(ISCN.parse(b.suggestion).warnings.length, 0);
});

test('a glued op is taught, and the amputating chip is withheld', () => {
  const m = ISCN.parse('46,XXdel2q');
  assert.match(m.warnings.join(' '), /del\(2\)/, 'the deletion form is taught');
  assert.equal(m.fixes.indexOf('46,XX'), -1, 'no chip that deletes the abnormality');
});

// ---- an empty item between semicolons is named, not swallowed ---------------
// t(7;;21)(q11;q11) parsed silently clean and drew: the splitter dropped the
// empty chromosome slot without a word.

test('a double semicolon is taught and repaired, never silently accepted', () => {
  const m = ISCN.parse('46,XY,t(7;;21)(q11;q11)');
  assert.ok(m.warnings.length > 0, 'says something');
  assert.equal(m.suggestion, '46,XY,t(7;21)(q11;q11)');
  assert.equal(ISCN.parse(m.suggestion).warnings.length, 0);
});

// ---- wave 2: missed repairs and recognized-notation classes -----------------

test('a bare known op gets its own lesson, not "not a change"', () => {
  const m = ISCN.parse('46,XY,t');
  const w = m.warnings.join(' ');
  assert.doesNotMatch(w, /is not a change KaryoDraw recognizes/);
  assert.match(w, /t\(9;22\)\(q34;q11\.2\)/, 'the op’s full form, as the example');
});

test('iso and isdic are taught as i and idic, with the respelling offered', () => {
  const m = ISCN.parse('47,XX,+iso(12)(p10)');
  assert.match(m.warnings.join(' '), /written \+?i\(/, 'the one-letter ISCN symbol');
  assert.ok(m.fixes.indexOf('47,XX,+i(12)(p10)') >= 0, JSON.stringify(m.fixes));
});

test('amp is named as ISCN FISH nomenclature, not a made-up word', () => {
  const w = ISCN.parse('46,XY,amp(21)').warnings.join(' ');
  assert.doesNotMatch(w, /is not an ISCN abbreviation/);
  assert.match(w, /amplified signal|FISH/i);
});

test('a supernumerary one short of its count is offered the + reading too', () => {
  // 47,XX,der(22)t(11;22)(q23;q11.2) is Emanuel syndrome missing its +. The
  // count-lowering chip alone steered away from the typed 47.
  const m = ISCN.parse('47,XX,der(22)t(11;22)(q23;q11.2)');
  assert.ok(m.fixes.indexOf('47,XX,+der(22)t(11;22)(q23;q11.2)') >= 0, JSON.stringify(m.fixes));
  assert.ok(m.fixes.indexOf('46,XX,der(22)t(11;22)(q23;q11.2)') >= 0, 'the count reading stays offered');
});

test('one breakpoint group spanning two chromosomes is the semicolon lesson', () => {
  const m = ISCN.parse('47,XX,+der(22)t(11;22)(q23.3q11.2)');
  assert.match(m.warnings.join(' '), /one breakpoint for each/i);
  assert.ok(m.fixes.indexOf('47,XX,+der(22)t(11;22)(q23.3;q11.2)') >= 0, JSON.stringify(m.fixes));
});

test('XO is taught as 45,X and the O dropped in the chip', () => {
  const m = ISCN.parse('45,XO[39]/46,XY[61]');
  assert.match(m.warnings.join(' '), /45,X\b/, 'the modern spelling');
  assert.ok(m.fixes.indexOf('45,X[39]/46,XY[61]') >= 0, JSON.stringify(m.fixes));
});

test('a list label ahead of the count is stripped in the chip', () => {
  const m = ISCN.parse('b.45,XX,der(14;21)(q10;q10)');
  assert.ok(m.fixes.indexOf('45,XX,der(14;21)(q10;q10)') >= 0, JSON.stringify(m.fixes));
});

test('SRY is taught its ish placement, never repaired to XXY', () => {
  const m = ISCN.parse('46,XXSRY+');
  assert.match(m.warnings.join(' '), /SRY/);
  assert.match(m.warnings.join(' '), /ish/i, 'molecular findings belong in ish notation');
  assert.equal(m.fixes.indexOf('46,XXY'), -1, 'no wrong-diagnosis chip');
});

test('array and FISH nomenclature get one respectful message, not a shredding', () => {
  for (const k of ['arr[GRCh37]9p24.3(203862_601901)x3', '47,XY,+mar.ish der(8)(D8Z1+)', 'ish del(22)(q11.2q11.2)']) {
    const m = ISCN.parse(k);
    const w = m.warnings.join(' ');
    assert.match(w, /arr|ish/i, k);
    assert.match(w, /banded karyotype|does not draw/i, k + ': named as a platform KaryoDraw does not draw');
    assert.doesNotMatch(w, /is not a character ISCN uses/, k + ': underscores are valid there');
    assert.ok(m.warnings.length <= 2, k + ': one lesson, not ' + m.warnings.length);
  }
});

test('pstk+ and numbered sidelines are correct ISCN the app does not draw', () => {
  const a = ISCN.parse('47,XY,+mar,15pstk+').warnings.join(' ');
  assert.doesNotMatch(a, /is not a change KaryoDraw recognizes/);
  assert.match(a, /heteromorphism|normal variant/i);
  const b = ISCN.parse('46,XX,t(9;22)(q34;q11.2)[7]/47,sdl1,+21[3]').warnings.join(' ');
  assert.match(b, /sideline|stemline/i);
  assert.doesNotMatch(b, /sex chromosomes may have been skipped/);
});

test('a glued mos prefix is repaired with its space', () => {
  const m = ISCN.parse('mosaic45,X/46,X,idic(Y)(q11.2)/47,X,idic(Y)(q11.2)x2');
  assert.ok(m.fixes.indexOf('mos 45,X/46,X,idic(Y)(q11.2)/47,X,idic(Y)(q11.2)x2') >= 0, JSON.stringify(m.fixes));
});

test('a multiplier after the cell count is taught and dropped in the chip', () => {
  const m = ISCN.parse('46,X,fra(X)(q27.3)[5]/46,XX[45]x4');
  assert.match(m.warnings.join(' '), /cell count|cells/i);
  assert.ok(m.fixes.indexOf('46,X,fra(X)(q27.3)[5]/46,XX[45]') >= 0, JSON.stringify(m.fixes));
});

test('an invisible character is named in words, not quoted invisibly', () => {
  const m = ISCN.parse('46,XX,inv(8)(p21.1q22.3)​');
  assert.match(m.warnings.join(' '), /invisible|zero-width/i);
});

test('a bandless del at a one-short count is taught the whole-chromosome loss', () => {
  const m = ISCN.parse('45,XY,del(7)');
  assert.match(m.warnings.join(' '), /-7/, 'a missing whole chromosome is written -7');
  assert.ok(m.fixes.indexOf('45,XY,-7') >= 0, JSON.stringify(m.fixes));
});

test('a bandless acrocentric t at the fused count is offered the der', () => {
  const m = ISCN.parse('45,XX,t(13;14)');
  assert.ok(m.fixes.indexOf('45,XX,der(13;14)(q10;q10)') >= 0, JSON.stringify(m.fixes));
});

test('rob with one chromosome is taught the two-partner form', () => {
  const m = ISCN.parse('45,XX,rob(22)');
  assert.match(m.warnings.join(' '), /two acrocentric/);
  assert.ok(m.fixes.indexOf('45,XX,rob(22;22)(q10;q10)') >= 0, 'the homolog fusion matches the typed 45: ' + JSON.stringify(m.fixes));
});

test('a semicolon between clones is taught the slash', () => {
  const m = ISCN.parse('46,XY,-13,+mar[13];46,XY[7]');
  assert.match(m.warnings.join(' '), /slash|“\/”/i, 'clones are separated by /');
  assert.ok(m.fixes.indexOf('46,XY,-13,+mar[13]/46,XY[7]') >= 0, JSON.stringify(m.fixes));
});

// ---- a colon between chromosomes is the semicolon lesson --------------------
// t(4:18)(q31;q11.2) used to have its CORRECT breakpoints "repaired" while the
// colon stayed, landing on "4:18 is not a human chromosome".

test('a colon inside parentheses is repaired to the semicolon, one lesson', () => {
  const m = ISCN.parse('46,XX,t(4:18)(q31;q11.2)');
  assert.equal(m.suggestion, '46,XX,t(4;18)(q31;q11.2)');
  assert.equal(ISCN.parse(m.suggestion).warnings.length, 0, 'the repair draws');
  assert.doesNotMatch(m.warnings.join(' '), /not a human chromosome/, 'no phantom bullet from the unrepaired token');
});
