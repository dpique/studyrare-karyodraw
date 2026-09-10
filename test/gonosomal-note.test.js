'use strict';
// A balanced X;autosome translocation carrier drew with no segregation panel
// and no explanation (Dan, 2026-09-10, on 46,X,t(X;4)(p21;p16)). The
// exclusion itself is right: the quadrivalent forms, but one outcomes table
// would be wrong twice over, because every conceptus depends on whether the
// partner's gamete brings an X or a Y, and the fate of the unbalanced
// products is set by X-inactivation rather than the autosomal
// partial-trisomy rules. Wrong to fix by modeling it badly; wrong to stay
// silent. The panel slot now carries a card that says exactly this, on
// screen and on the printed sheet.
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

test('a gonosomal reciprocal carrier gets the why-no-table card', () => {
  const c = clone0('46,X,t(X;4)(p21;p16)');
  assert.equal(Seg.eligible(c), false, 'the autosomal table still refuses it');
  const note = Seg.gonosomalNote(c);
  assert.match(note, /quadrivalent/, 'grants that the quadrivalent forms');
  assert.match(note, /X or a Y/, 'names the partner-gamete fork');
  assert.match(note, /X-inactivation/, 'names what governs the unbalanced products');
  assert.match(note, /spermatogenesis/, 'covers the male carrier');
});

test('a Y;autosome carrier gets the same card', () => {
  assert.match(Seg.gonosomalNote(clone0('46,X,t(Y;7)(q11.2;p15)')), /quadrivalent/);
});

test('autosomal carriers and non-carriers get no card', () => {
  assert.equal(Seg.gonosomalNote(clone0('46,XX,t(4;6)(q21;q23)')), '', 'the eligible carrier has the real table');
  assert.equal(Seg.gonosomalNote(clone0('47,XX,+21')), '', 'nothing to explain on a non-carrier');
});
