'use strict';
// A mosaic karyotype IS its cell lines. The landing-page figure used to render only
// clones[0], which drew mos 45,X[12]/46,XX[18] as plain monosomy X: the majority
// 46,XX line (18 of the 30 counted cells) never appeared, under a caption claiming
// the involved chromosome was shown "with its normal homolog". On the one page whose
// whole teaching point is mosaic versus non-mosaic, the picture showed non-mosaic.
// The figure must carry every cell line, each labeled with its own notation and cell
// count, so the drawing states what the designation states.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const MOSAIC = 'mos 45,X[12]/46,XX[18]';

test('the page figure draws every cell line of a mosaic', async () => {
  const { renderKaryogram } = await import('../scripts/lib/render.mjs');
  const { html } = renderKaryogram(MOSAIC);
  assert.equal((html.match(/class="karyogram/g) || []).length, 2,
    'one karyogram per cell line');
  assert.match(html, /45,X\[12\]/, 'first cell line labeled with its notation');
  assert.match(html, /46,XX\[18\]/, 'second cell line labeled with its notation');
  assert.match(html, /12 cells \(40%\)/, 'cell count and share for the 45,X line');
  assert.match(html, /18 cells \(60%\)/, 'cell count and share for the 46,XX line');
});

test('a single-clone karyotype keeps its plain figure, with no clone chrome', async () => {
  const { renderKaryogram } = await import('../scripts/lib/render.mjs');
  const { html } = renderKaryogram('45,X');
  assert.equal((html.match(/class="karyogram/g) || []).length, 1);
  assert.ok(!/clone-head/.test(html), 'no clone header when there is only one cell line');
});

test('the built mosaic page shows both cell lines and captions them honestly', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const html = fs.readFileSync(
    path.join(__dirname, '..', 'karyotype', 'mosaic-turner-syndrome', 'index.html'), 'utf8');
  assert.match(html, /46,XX\[18\]/, 'the 46,XX cell line appears on the page');
  assert.ok(!/with their normal homolog/.test(html),
    'the single-clone caption must not describe a mosaic figure');
  // The decode section must explain every clone, not just the first: the [18] of
  // the second cell line is part of the notation the page promises to decode.
  assert.match(html, /seen in 18 cells/, 'the second clone’s cell count is decoded');
});

// An explicit sex-chromosome loss labels its ghost: the notation names the lost
// chromosome, so the gap is not a guess. 45,X,-Y drew its gap unlabeled, and
// 76~77,XX,-Y (the written XX already filling the row) drew no trace of the -Y.
test('an explicit -Y gets a ghost slot labeled Y', async () => {
  const { renderKaryogram } = await import('../scripts/lib/render.mjs');
  const html = renderKaryogram('45,X,-Y').html;
  assert.match(html, /<div class="klabel">Y<\/div>/);
  const xx = renderKaryogram('46,XX,-Y').html;
  assert.match(xx, /<div class="klabel">Y<\/div>/, 'a -Y beside a written XX still shows');
});
