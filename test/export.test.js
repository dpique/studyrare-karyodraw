'use strict';
// What leaves the app has to be as honest as what is on screen.
//
// The `invalid` gate refuses to draw anything it cannot read: nothing parsed, no
// modal number, a syntax repair on offer, a band that does not exist on that
// chromosome. It DOES draw the one remaining case, where the notation is unambiguous
// and only the writer's own count disagrees with it, because there the picture is the
// explanation: 45,XX,t(13;15)(q10;q10) says 45 and the drawing shows the 46
// chromosomes a t() actually describes. That policy is deliberate and stays.
//
// The hole it left was the exports. The PNG carried the karyotype as typed, the
// karyogram, and nothing else; the print sheet the same. Those are the copies that
// end up in slides and question banks, in front of people who never typed the input,
// so a caption saying 45 over a drawing of 46 travels with no way to tell.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context));
const ISCN = win.ISCN;
const Teach = win.Teach;

// Run the page's own countMismatchNote rather than a copy of it, so this cannot
// pass while the shipped function says something else.
const noteSrc = html.match(/ {2}function countMismatchNote\(model\) \{[\s\S]*?\n {2}\}/)[0];
const sandbox = { Array };
vm.createContext(sandbox);
vm.runInContext(noteSrc + '\nglobalThis.note = countMismatchNote;', sandbox);
const noteFor = (k) => sandbox.note(ISCN.parse(k));

test('the note names both numbers for a count that does not add up', () => {
  // Pinned on the two numbers and their order, not the prose around them, so
  // rewording the copy does not churn this file. The wording itself is owned by
  // test/message-voice.test.js.
  assert.match(noteFor('45,XX,t(13;15)(q10;q10)'), /\b45\b[\s\S]*\b46 chromosomes\b/);
});

test('no note when the karyotype agrees with itself', () => {
  ['46,XX,t(13;15)(q10;q10)', '45,XY,rob(14;21)(q10;q10)', '46,XY', '47,XX,+21', 'mos 45,X[12]/46,XX[18]']
    .forEach((k) => assert.equal(noteFor(k), '', k));
});

test('a mosaic names which clone is off', () => {
  // Clone 2 says 45 and describes 46. countFix is single-clone only, so a mosaic
  // never gets the "did you mean" button and this note is the only thing that
  // travels with the image.
  const n = noteFor('mos 45,X[12]/45,XX,t(13;15)(q10;q10)[18]');
  assert.match(n, /clone 2/, 'says which clone, since the drawing shows both');
  assert.match(n, /\b45\b[\s\S]*\b46 chromosomes\b/);
  assert.doesNotMatch(n, /clone 1/, 'the clone that agrees with itself is not named');
});

test('the exported PNG and the print sheet both carry the note', () => {
  // Regexes over the page because both builders are module-scoped. They pin the call,
  // not the wording, which the tests above own.
  const exportSvg = html.slice(html.indexOf('function buildExportSVG'));
  assert.match(exportSvg.slice(0, 4000), /countMismatchNote\(model\)/, 'the PNG builder asks for it');
  const printSheet = html.slice(html.indexOf('function renderPrintSheet'));
  assert.match(printSheet.slice(0, 3000), /countMismatchNote\(model\)/, 'the print sheet asks for it');
});

test('the export canvas grows to fit the note instead of clipping it', () => {
  // The note is a second line under the title; if titleBlockH stayed at its one-line
  // value the karyogram would be drawn over it.
  const src = html.slice(html.indexOf('function buildExportSVG'));
  assert.match(src.slice(0, 4000), /titleBlockH = note \? \d+ : \d+/, 'title block is taller when a note is present');
});

test('the plain-language summary does not assert the wrong count as fact', () => {
  // It sits inches from a drawing of the other number in the same print sheet.
  const off = Teach.plainSummary(ISCN.parse('45,XX,t(13;15)(q10;q10)').clones[0]).join(' ');
  assert.match(off, /45 chromosomes/, 'still reports the count as written');
  assert.match(off, /count as written/, 'and says that is what it is');
  assert.match(off, /add up to 46 chromosomes/, 'and names what the changes actually describe');

  const ok = Teach.plainSummary(ISCN.parse('46,XX,t(13;15)(q10;q10)').clones[0]).join(' ');
  assert.doesNotMatch(ok, /count as written/, 'no hedging when the karyotype agrees with itself');
});

// ---- Back walks the view toggles ------------------------------------------
// Style / Bands / Show rewrite the URL and the drawing, so each is a state Back
// should be able to return to. They were left on replaceState when Back was fixed for
// the example chips and the fix button, so three toggle clicks added zero history
// entries and one Back left the site. Typing stays on replaceState on purpose: one
// entry per keystroke would fill history with half-typed karyotypes.
test('the view toggles push a history entry; typing still replaces', () => {
  const seg = html.match(/ {2}function wireSeg\(sel, take\) \{[\s\S]*?\n {2}\}/)[0];
  assert.match(seg, /run\.pushNext = true/, 'a toggle earns its own history entry');
  assert.match(seg, /!take\(b\)\) return/, 're-clicking the active button does nothing at all');
  // The input listener must NOT set pushNext.
  const typing = html.match(/input\.addEventListener\("input"[\s\S]{0,400}/);
  if (typing) assert.doesNotMatch(typing[0], /pushNext/, 'typing must not push');
});

test('all three toggles are wired through the pushing helper', () => {
  ['#modeseg', '#levelseg', '#showseg'].forEach((id) => {
    assert.match(html, new RegExp('wireSeg\\("' + id + '"'), `${id} pushes`);
    assert.doesNotMatch(html, new RegExp('\\$\\("' + id + '"\\)\\.addEventListener'), `${id} has no bypassing handler`);
  });
});

test('an incompletely read karyotype carries no count note into the image', () => {
  // 46,XY,rob(14;21)(q10;q10),21 draws, because it parses. Its tally is short only
  // because the signless 21 was never interpreted, so "you wrote 46; this notation
  // describes 45 chromosomes" would travel a claim the app cannot stand behind.
  assert.equal(noteFor('46,XY,rob(14;21)(q10;q10),21'), '');
  assert.match(noteFor('46,XY,rob(14;21)(q10;q10),-21'), /\b46\b[\s\S]*\b44 chromosomes\b/,
    'a real mismatch still travels');
});

test('the summary pill and the image note gate on the same flag', () => {
  // countWrong, the flag the parser sets at exactly the point it pushes the count
  // warning. Not !counts.ok, which is true for valid ISCN such as 48,XY,+8,inc.
  const pill = html.match(/var off = model\.clones\.filter\([\s\S]*?\);/)[0];
  assert.match(pill, /c\.countWrong/, 'the pill respects it');
  const note = html.match(/function countMismatchNote\(model\)[\s\S]*?\n  \}/)[0];
  assert.match(note, /c\.countWrong/, 'the exported note respects it');
});

test('an incomplete karyotype is never captioned as a count mismatch', () => {
  // 48,XY,+8,inc is valid: "inc" says there are further, unidentified changes, so the
  // tally is short by design. It drew AND carried "you wrote 48; the changes listed
  // add up to 47" into the PNG.
  const c = ISCN.parse('48,XY,+8,inc').clones[0];
  assert.equal(c.counts.ok, false, 'the tally really is short');
  assert.equal(c.countWrong, false, 'but the app does not call that an error');
  assert.equal(noteFor('48,XY,+8,inc'), '', 'so nothing travels with the image');
  assert.doesNotMatch(Teach.plainSummary(c).join(' '), /count as written/, 'and the summary does not hedge');
});

test('the plain-language summary hedges only on a real mismatch', () => {
  const uncounted = Teach.plainSummary(ISCN.parse('46,XY,rob(14;21)(q10;q10),21').clones[0]).join(' ');
  assert.doesNotMatch(uncounted, /count as written/, 'no hedge when the tally is just incomplete');
});

test('an unreadable breakpoint blocks the karyogram', () => {
  // The renderer would draw chromosome 5 with no cut point, which reads as a real
  // answer. invalidBands cannot catch it: by then there is no band left to check.
  // Anchored on the statement's own indentation, not on the first ";" — there is a
  // ";" inside the callback on the same statement.
  const gate = html.match(/ {4}var invalid = [\s\S]*?\n {4}beacon/)[0];
  assert.match(gate, /unreadable/, 'the draw gate consults the flag');
  assert.match(html, /c\.unreadable/, 'and reads it off the clone');
});
