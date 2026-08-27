'use strict';
// Highlight-mode span marks, designed with Dan over five preview rounds
// (2026-08-26, preview-dup-mark.html; see docs/INTERFACE.md "A span mark is a
// frame on the margin"). The grammar:
//
//   frame  = a DUPLICATED span, wrapped from OUTSIDE the body so no band
//            loses width, in the dup amber. One device, one meaning: a box
//            appears exactly when something is extra (Dan's call, round 6);
//   hooks  = opposed quarter-turn arrows at the top-right and bottom-left of
//            the span, ALWAYS teal: the span is drawn end-for-end.
//
// The devices compose by shape, not color: a plain inversion is hooks alone
// (balanced, nothing gained, so no box); a direct duplication is a box alone;
// the rec graft and any inverted duplication are box plus hooks, which is the
// whole point, because "an extra copy, and it is flipped" is what dup(2p)
// from an inversion carrier means. Reversal is read off the MODEL (the segment's
// reversed flag), not off the notation, so the rule cannot drift from the
// geometry. The Realistic theme stays bare (#196), and every mark lets the
// pointer through (#197's invariant test enforces that part).
//
// Teal is #1f9e8f, reused from the segregation figures rather than minted,
// because the old inv blue #5e72e4 was the SAME hex as the first affected-
// palette hue and vanished against its own chromosome.
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
const { Karyo, ISCN } = win;

const instOf = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal');
const drawOut = (k, chrom, theme) => Karyo.drawInstance(instOf(k, chrom), { theme, level: 99, affected: {} });

const AMBER = Karyo.OP_COLORS.dup;
const TEAL = Karyo.OP_COLORS.inv;
const frameRe = (col) => new RegExp('<rect[^>]*rx="2\\.5"[^>]*stroke="' + col + '"');
const hookRe = (col) => new RegExp('A3\\.6 3\\.6[^"]*"[^>]*stroke="' + col + '"', 'g');

test('the inversion mark color is the app teal, not the palette blue', () => {
  assert.equal(TEAL, '#1f9e8f', 'segregation pole teal, reused rather than minted');
  assert.ok(Karyo.AFFECTED_PALETTE.indexOf(TEAL) < 0, 'and it appears nowhere in the affected palette');
});

test('a direct duplication gets an amber frame and no hooks', () => {
  const svg = drawOut('46,XX,dup(2)(p23p21)', '2', 'simple').svg;
  assert.match(svg, frameRe(AMBER), 'the outset frame, in the dup amber');
  assert.equal((svg.match(hookRe(TEAL)) || []).length, 0, 'nothing is flipped, so no hooks');
});

test('an inversion gets the hooks alone: balanced, so no box', () => {
  const svg = drawOut('46,XX,inv(2)(p21q31)', '2', 'simple').svg;
  assert.ok(!/rx="2\.5"/.test(svg), 'no frame of any color: a box means an extra copy');
  assert.equal((svg.match(hookRe(TEAL)) || []).length, 2, 'top-right and bottom-left hooks');
});

test('the rec graft composes the devices: amber box, teal hooks', () => {
  const svg = drawOut('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', '2', 'simple').svg;
  assert.match(svg, frameRe(AMBER), 'the extra copy is framed as a duplication');
  assert.equal((svg.match(hookRe(TEAL)) || []).length, 2, 'and hooked as flipped');
});

test('an inverted duplication earns the hooks from the model, not the notation', () => {
  // p21 before p23 is proximal-first on the p arm, so the copy is inverted.
  const svg = drawOut('46,XX,dup(2)(p21p23)', '2', 'simple').svg;
  assert.match(svg, frameRe(AMBER));
  assert.equal((svg.match(hookRe(TEAL)) || []).length, 2);
});

test('marked figures widen symmetrically; unmarked and Realistic figures do not', () => {
  const marked = drawOut('46,XX,inv(2)(p21q31)', '2', 'simple');
  assert.equal(marked.width, 52, 'nine margin units each side for the marks');
  assert.match(marked.svg, /viewBox="-9 0 52 /, 'centered: the body keeps its visual center');
  const real = drawOut('46,XX,inv(2)(p21q31)', '2', 'detailed');
  assert.equal(real.width, 34, 'the Realistic theme is unchanged');
  const plain = drawOut('46,XX,del(5)(p15.2)', '5', 'simple');
  assert.equal(plain.width, 34, 'a figure with no span mark is unchanged');
});

test('the Realistic theme draws no frames and no hooks', () => {
  for (const k of ['46,XX,inv(2)(p21q31)', '46,XX,dup(2)(p21p23)', '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat']) {
    const svg = drawOut(k, '2', 'detailed').svg;
    assert.ok(!/rx="2\.5"/.test(svg), `${k}: no frame in Realistic`);
    assert.ok(!/A3\.6 3\.6/.test(svg), `${k}: no hooks in Realistic`);
  }
});

// The moved-segment box, added after Dan drew the visitor's der(15)ins and
// said "there is no mention of an insertion here!": an intrachromosomal
// insertion drew with NO mark at all (both pieces are the same chromosome, so
// not even a fusion seam appears), leaving the move invisible unless you
// compare banding by eye. The grammar extends without bending: a box in the
// neutral slate means "this span moved here, nothing gained or lost", the
// hooks still mean end-for-end (so an INVERTED insertion earns them from the
// model automatically), and red carets mark the excision point the segment
// left behind.
test('an insertion boxes the moved span in slate and carets its excision point', () => {
  const out = drawOut('46,XY,ins(15)(p11q23q26)', '15', 'simple');
  assert.match(out.svg, frameRe(Karyo.OP_COLORS.mov), 'the moved span wears the neutral box');
  assert.equal((out.svg.match(hookRe(TEAL)) || []).length, 0, 'orientation kept, so no hooks');
  assert.ok(/fill="#e0554f"/.test(out.svg), 'the excision point is careted');
  assert.equal(out.width, 52, 'the box rides the margin, so the canvas widens');
});

test('an inverted insertion earns the hooks from the model', () => {
  const svg = drawOut('46,XX,ins(2)(p13q31q21)', '2', 'simple').svg;
  assert.match(svg, frameRe(Karyo.OP_COLORS.mov));
  assert.equal((svg.match(hookRe(TEAL)) || []).length, 2, 'the segment is drawn end-for-end (ISCN 5.5.9.1 i)');
});

test('the der-wrapped insertion wears the same marks, and Realistic stays bare', () => {
  const svg = drawOut('46,XY,der(15)ins(15)(p11q23q26)', '15', 'simple').svg;
  assert.match(svg, frameRe(Karyo.OP_COLORS.mov));
  const real = drawOut('46,XY,ins(15)(p11q23q26)', '15', 'detailed');
  assert.ok(!/rx="2\.5"/.test(real.svg), 'no box in Realistic');
  assert.equal(real.width, 34, 'and no widening');
});
