'use strict';
// Render tests for the karyogram renderer (karyo-render.js). Like the parser it
// is a browser IIFE; here it is loaded (after its ideogram-data dependency) into a
// minimal window shim with the vm module so buildInstance can be exercised under
// `node --test` with no dependencies. These pin the duplication geometry: a dup
// lengthens the chromosome, and breakpoint order controls direct vs inverted.
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
const Karyo = win.Karyo;
const ISCN = win.ISCN;
const IDEO = win.IDEOGRAM;

const inst = (kind, chrom, bands, label) => ({ chrom, kind, aberration: { breakpoints: [bands] }, label: label || kind });
const totalBp = (segs) => segs.reduce((s, g) => s + (g.to - g.from), 0);
// The realistic path: parse a karyotype, then pull the derivative instance the
// parser built (with chroms/primary/subOps set) for a given chromosome slot.
const derInst = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal');
const built = (k, chrom) => Karyo.buildInstance(derInst(k, chrom));

test('render module loads', () => {
  assert.equal(typeof Karyo.buildInstance, 'function');
});

test('duplication lengthens the chromosome and splices in a copy', () => {
  const normal = IDEO.data['1'].length;
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'], 'dup(1)(q22q25)'));
  assert.ok(built.segments.length > 1, 'segments are spliced, not a single full chromosome');
  assert.ok(totalBp(built.segments) > normal, 'total length grows beyond the normal chromosome');
});

test('direct duplication keeps the copy in the same orientation', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 0, 'no reversed segment for a direct dup');
});

test('inverted duplication (distal-first) mirrors the copy', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q25', 'q22']));
  assert.equal(built.segments.filter((g) => g.reversed).length, 1, 'exactly one reversed (mirrored) copy');
  assert.ok(totalBp(built.segments) > IDEO.data['1'].length, 'still lengthens the chromosome');
});

test('triplication adds two copies (grows more than a duplication)', () => {
  const normal = IDEO.data['1'].length;
  const dupGrew = totalBp(Karyo.buildInstance(inst('dup', '1', ['q22', 'q25'])).segments) - normal;
  const trpGrew = totalBp(Karyo.buildInstance(inst('trp', '1', ['q22', 'q25'])).segments) - normal;
  assert.ok(trpGrew > dupGrew * 1.5, 'triplication adds about twice the material of a duplication');
});

test('dup overlay shades the appended copy (by segment index)', () => {
  const built = Karyo.buildInstance(inst('dup', '1', ['q22', 'q25']));
  assert.ok(built.overlays.length >= 1);
  assert.ok(built.overlays.every((o) => o.type === 'dup' && o.segIndex != null), 'overlay targets a copy segment');
});

test('a dup renders to SVG without error', () => {
  const out = Karyo.drawInstance(inst('dup', '1', ['q22', 'q25']), { theme: 'detailed', level: 1, affected: {} });
  assert.match(JSON.stringify(out), /<svg/);
});

// --- Insertions: the recipient grows with donor material, the donor shrinks ---
test('interchromosomal insertion puts donor material on the recipient', () => {
  const recip = built('46,XY,ins(5;2)(p14;q22q32)', '5');
  assert.ok(recip.segments.some((s) => s.chrom === '2'), 'der(5) carries a piece of chromosome 2');
  assert.ok(totalBp(recip.segments) > IDEO.data['5'].length, 'recipient chromosome is longer');
});

test('interchromosomal insertion shortens the donor chromosome', () => {
  const donor = built('46,XY,ins(5;2)(p14;q22q32)', '2');
  assert.ok(donor.segments.every((s) => s.chrom === '2'), 'donor is still made only of its own material');
  assert.ok(totalBp(donor.segments) < IDEO.data['2'].length, 'donor lost the excised segment');
});

test('intrachromosomal insertion is length-preserving but rearranged', () => {
  const b = built('46,XX,ins(2)(p13q21q31)', '2');
  assert.ok(b.segments.length >= 3, 'chromosome is split into several pieces');
  const delta = Math.abs(totalBp(b.segments) - IDEO.data['2'].length);
  assert.ok(delta < 2e6, 'total length is essentially unchanged (balanced move)');
});

test('an insertion no longer draws as an untouched normal chromosome', () => {
  const b = built('46,XY,ins(5;2)(p14;q22q32)', '5');
  const isPlainFull = b.segments.length === 1 && b.segments[0].from === 0 && b.segments[0].to === IDEO.data['5'].length;
  assert.ok(!isPlainFull, 'insertion recipient is not a single full-length chromosome');
});

// --- Isodicentric: a single chromosome mirrored about its breakpoint ---------
test('isodicentric idic(X) draws two centric mirror halves', () => {
  const b = built('46,X,idic(X)(q13)', 'X');
  assert.equal(b.segments.length, 2, 'two arms');
  assert.ok(b.segments.every((s) => s.chrom === 'X' && s.hasCen), 'both halves keep an X centromere');
  assert.equal(b.segments.filter((s) => s.reversed).length, 1, 'one half is the mirror image');
});

// --- Dicentric of two chromosomes: one fused body with two centromeres -------
test('dicentric dic(13;14) is a single fused chromosome with two centromeres', () => {
  const b = built('45,XY,dic(13;14)(q13;q22)', '13');
  assert.equal(b.segments.length, 2, 'two fused pieces');
  const chroms = b.segments.map((s) => s.chrom).sort();
  assert.equal(chroms.join(','), '13,14', 'one piece from each chromosome');
  assert.ok(b.segments.every((s) => s.hasCen), 'both centromeres are retained (dicentric)');
});

// --- Robertsonian / whole-arm fusion: joins the two LONG arms ---------------
// rob(13;14)(q10;q10) fuses 13q + 14q and loses both short arms. The bug it
// replaces glued a p-arm on (14p), which is biologically wrong.
const qArmOnly = (seg, IDEO) => seg.from >= IDEO.data[seg.chrom].centromere - 1e6 && seg.to >= IDEO.data[seg.chrom].length - 1e6;

test('Robertsonian rob(13;14) joins the two q arms, not a p arm', () => {
  const b = built('45,XX,rob(13;14)(q10;q10)', '13');
  assert.equal(b.segments.length, 2, 'two fused arms');
  const s13 = b.segments.find((s) => s.chrom === '13');
  const s14 = b.segments.find((s) => s.chrom === '14');
  assert.ok(s13 && s14, 'one piece from each chromosome');
  assert.ok(qArmOnly(s13, IDEO), 'chr13 contributes its long (q) arm');
  assert.ok(qArmOnly(s14, IDEO), 'chr14 contributes its long (q) arm, NOT its short (p) arm');
});

test('whole-arm der(13;14)(q10;q10) also joins the two q arms', () => {
  const b = built('45,XX,der(13;14)(q10;q10)', '13');
  const s14 = b.segments.find((s) => s.chrom === '14');
  assert.ok(s14 && qArmOnly(s14, IDEO), 'chr14 contributes its q arm');
});

// --- der() sub-op chains: the extra del/dup is applied, not dropped ----------
test('der(9)del(9)(p12)t(9;22) applies the deletion to the derivative', () => {
  const b = built('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)', '9');
  const nine = b.segments.find((s) => s.chrom === '9');
  assert.ok(nine, 'der(9) still carries chromosome 9 material');
  assert.ok(nine.from > 0, 'the p12 terminal deletion trimmed the 9p end (segment no longer starts at pter)');
  assert.ok(b.segments.some((s) => s.chrom === '22'), 'the t(9;22) junction is still present');
});

// --- Amplification: hsr marks the chromosome; dmin draws tiny fragments -------
test('hsr(11)(q13) renders chromosome 11 with an amplification overlay', () => {
  const b = built('46,XX,hsr(11)(q13)', '11');
  assert.ok(b.segments.some((s) => s.chrom === '11'), 'still a chromosome 11');
  assert.ok((b.overlays || []).some((o) => o.type === 'hsr'), 'an hsr overlay marks the amplified region');
  const out = Karyo.drawInstance(derInst('46,XX,hsr(11)(q13)', '11'), { theme: 'detailed', level: 99, affected: {} });
  assert.match(JSON.stringify(out), /<svg/);
});

test('dmin draws a small acentric fragment that renders without error', () => {
  const inst = (ISCN.parse('46,XX,dmin').clones[0].slots['dmin'] || [])[0];
  assert.ok(inst, 'a dmin instance exists in its own slot');
  const b = Karyo.buildInstance(inst);
  assert.ok(b.segments.length >= 1, 'the fragment has geometry');
  const out = Karyo.drawInstance(inst, { theme: 'detailed', level: 99, affected: {} });
  assert.match(JSON.stringify(out), /<svg/);
});

// --- Cell alignment ---------------------------------------------------------
// A mirror/whole-arm derivative (isochromosome, Robertsonian der) meets its arms
// at the seam between its two segments, and the renderer now reports that seam as
// the centromere y — so those cells centromere-align on the seam like every other
// cell, rather than falling back to top/bottom alignment.
const marginTopOf = (html, chrom, kind) => {
  const re = new RegExp('data-chrom="' + chrom + '" data-kind="' + kind + '"[^>]*?(?:style="margin-top:([\\d.]+)px")?>');
  const m = html.match(re);
  return m && m[1] ? parseFloat(m[1]) : 0;
};
// Shift the shortest/off copy gets under centromere- vs bottom-alignment, for a cell.
const shifts = (kar, chrom, kindPred) => {
  const c = ISCN.parse(kar).clones[0];
  const insts = c.slots[chrom];
  const drawn = insts.map((i) => Karyo.drawInstance(i, { theme: 'detailed', level: 99, affected: {} }));
  const maxCen = Math.max(...drawn.map((d) => d.cenY));
  const maxH = Math.max(...drawn.map((d) => d.height));
  const idx = insts.findIndex(kindPred);
  return { allCen: drawn.every((d) => d.cenY != null), cenShift: maxCen - drawn[idx].cenY, botShift: maxH - drawn[idx].height };
};

test('a whole-arm derivative reports a fusion-seam centromere y and centromere-aligns', () => {
  const s = shifts('45,XX,rob(14;21)(q10;q10)', '14', (i) => i.kind === 'normal');
  assert.ok(s.allCen, 'both copies now have a centromere y (the der on its fusion seam)');
  const c = ISCN.parse('45,XX,rob(14;21)(q10;q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 99, affected: Karyo.computeAffected([c]), only: ['14', '21'] });
  const normal14 = marginTopOf(cont.innerHTML, '14', 'normal');
  assert.ok(Math.abs(normal14 - s.cenShift) < 1, 'normal 14 is shifted to line its centromere up with the seam');
  // This case can no longer tell centromere-alignment from bottom-alignment, and that
  // is a property of the orientation rule rather than a gap: the derivative is filed
  // under 14, and 14q is the longer arm, so 14q is drawn at the BOTTOM in its natural
  // orientation. The derivative and the normal 14 therefore end on the same arm and
  // the two schemes agree exactly. Asserted rather than worked around, because a
  // regression in the orientation rule would break the equality. The test that
  // discriminates the two alignment paths is the del(1)(q42) one below, where a
  // q-arm deletion moves the bottom without moving the centromere.
  assert.ok(Math.abs(s.cenShift - s.botShift) < 1e-6, 'der and normal 14 share a bottom arm, so both schemes coincide');
});

test('an isochromosome reports a mirror-seam centromere y and centromere-aligns', () => {
  // NOTE: for any isochromosome the centromere shift equals the bottom shift
  // (iso height = 2x the arm, seam at the middle), so the two schemes coincide —
  // the meaningful assertion is that the iso now reports a centromere y at all,
  // which forces the centromere-align code path (allCen).
  const s = shifts('46,XX,i(13)(q10)', '13', (i) => i.kind === 'normal');
  assert.ok(s.allCen, 'the isochromosome now reports a seam centromere y (was null before)');
  const c = ISCN.parse('46,XX,i(13)(q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 99, affected: Karyo.computeAffected([c]), only: ['13'] });
  const normal13 = marginTopOf(cont.innerHTML, '13', 'normal');
  assert.ok(Math.abs(normal13 - s.cenShift) < 1, 'normal 13 is shifted to line up centromeres');
});

test('a deletion cell still centromere-aligns (not bottom-align)', () => {
  // A q-arm deletion leaves the centromere in place, so centromere-alignment
  // shifts the del copy by 0 while bottom-alignment would shift it down — the two
  // schemes diverge, which lets us confirm the centromere path is taken.
  const c = ISCN.parse('46,XX,del(1)(q42)').clones[0];
  const insts = c.slots['1'];
  const drawn = insts.map((i) => Karyo.drawInstance(i, { theme: 'detailed', level: 99, affected: {} }));
  const maxCen = Math.max(...drawn.map((d) => d.cenY));
  const maxH = Math.max(...drawn.map((d) => d.height));
  const di = insts.findIndex((i) => i.kind !== 'normal');
  const cenShift = maxCen - drawn[di].cenY;      // where centromere-alignment puts the del copy
  const botShift = maxH - drawn[di].height;       // where bottom-alignment would put it
  assert.ok(Math.abs(cenShift - botShift) > 3, 'the two schemes give visibly different shifts here');
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 99, affected: Karyo.computeAffected([c]), only: ['1'] });
  const delMt = marginTopOf(cont.innerHTML, '1', 'del');
  assert.ok(Math.abs(delMt - cenShift) < 1, 'the del copy uses the centromere shift, not the bottom shift');
});

// A whole-arm / mirror derivative now draws a real centromere at its seam, so you
// can see where the centromere is (not just an unlabeled fusion line).
test('a whole-arm derivative draws a centromere at its seam', () => {
  const out = Karyo.drawInstance(derInst('45,XX,rob(13;14)(q10;q10)', '13'), { theme: 'detailed', level: 99, affected: {} });
  assert.ok(out.cenY != null, 'reports a centromere y at the seam');
  assert.match(out.svg, /stroke-dasharray="2\.5 2"/, 'draws the centromere p/q line (distinct from a plain fusion line)');
});

// The affected-only view lines every chromosome's centromere up on one horizontal
// line, so the shorter homolog is offset down to meet it.
test('affected-only view lines up centromeres across cells', () => {
  const c = ISCN.parse('45,XX,rob(13;14)(q10;q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 99, affected: Karyo.computeAffected([c]), only: ['13', '14'] });
  assert.match(cont.innerHTML, /affected-only/, 'is the affected-only view');
  assert.match(cont.innerHTML, /kcell-copies" style="margin-top:[\d.]+px"/, 'a cell is offset to bring its centromere onto the shared line');
});

// Regression: an unparseable clone (empty field list) reaches computeAffected on
// the way to the invalid-state message. It must not throw on the missing slots.
test('computeAffected tolerates an empty/unparseable clone without throwing', () => {
  const clones = ISCN.parse(',').clones;
  assert.doesNotThrow(() => Karyo.computeAffected(clones), 'no TypeError on clone.slots');
});

// Sex-chromosome aneuploidy is expressed in the sex field, not as an aberration,
// so computeAffected must still flag it (otherwise the "Affected" view wrongly
// reports nothing to isolate for 48,XXXX, 45,X, 47,XXY, ...).
const affKeys = (k) => Object.keys(Karyo.computeAffected(ISCN.parse(k).clones)).sort();
test('tetrasomy X (48,XXXX) isolates the X chromosomes', () => {
  assert.deepEqual(affKeys('48,XXXX'), ['X']);
});
test('Turner (45,X) and Klinefelter (47,XXY) flag their sex chromosomes', () => {
  assert.deepEqual(affKeys('45,X'), ['X']);
  assert.deepEqual(affKeys('47,XXY'), ['X', 'Y']);
});
test('a normal complement flags nothing; autosomal +21 flags only 21', () => {
  assert.deepEqual(affKeys('46,XX'), []);
  assert.deepEqual(affKeys('46,XY'), []);
  assert.deepEqual(affKeys('47,XX,+21'), ['21']);
});
test('a euploid polyploid sex complement is NOT falsely flagged', () => {
  assert.deepEqual(affKeys('69,XXX'), [], '3n XXX is euploid for triploidy');
  assert.deepEqual(affKeys('92,XXXX'), [], '4n XXXX is euploid for tetraploidy');
});

// The absent-sex-chromosome placeholder shows "missing" but is not labeled "?"
// (the karyogram shows the karyotype, it does not speculate what was lost).
test('the missing sex-chromosome placeholder is not labeled "?"', () => {
  const cont = { innerHTML: '' };
  Karyo.render(cont, ISCN.parse('45,X').clones[0], { theme: 'detailed', level: 1, affected: {} });
  assert.match(cont.innerHTML, /missing/, 'shows the missing placeholder');
  assert.doesNotMatch(cont.innerHTML, /klabel">\?</, 'no "?" label under the placeholder');
});

// The affected/isolated view must agree with the full view: a monosomy shows the
// absent homolog placeholder there too.
const affKaryogram = (k) => {
  const c = ISCN.parse(k).clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 1, affected: Karyo.computeAffected([c]), only: Object.keys(Karyo.computeAffected([c])) });
  return cont.innerHTML;
};
test('the affected view shows the missing homolog for a monosomy (45,X)', () => {
  assert.match(affKaryogram('45,X'), /missing/, 'consistent with the full karyogram');
});
test('the affected view shows no missing homolog when there is no monosomy', () => {
  assert.doesNotMatch(affKaryogram('47,XXX'), /missing/, '47,XXX has three X, none missing');
  assert.doesNotMatch(affKaryogram('46,X,i(X)(q10)'), /missing/, 'X + i(X) is two sex chromosomes');
});

// ---- nearest real band (for the invalid-breakpoint message) -----------------
// A breakpoint that does not exist (Xp31, 5p21, both from a real practice exam)
// suppresses the drawing, so the message has to be enough to fix the karyotype
// on its own: how far the arm actually goes, plus the closest real band.
test('armExtent reports the real span of an arm', () => {
  assert.equal(Karyo.armExtent('X', 'p').first, 'p11.1');
  assert.equal(Karyo.armExtent('X', 'p').last, 'p22.33');
  assert.equal(Karyo.armExtent('5', 'p').first, 'p11');
  assert.equal(Karyo.armExtent('5', 'p').last, 'p15.33');
  assert.equal(Karyo.armExtent('9', 'z'), null);
});
test('nearestBand finds the closest real band on the same arm', () => {
  assert.equal(Karyo.nearestBand('X', 'p31'), 'p22.33');
  assert.equal(Karyo.nearestBand('5', 'p21'), 'p15.33');
  assert.equal(Karyo.nearestBand('12', 'q32'), 'q24.33');
});
test('nearestBand stays on the arm it was given', () => {
  assert.match(Karyo.nearestBand('X', 'q99'), /^q/);
  assert.match(Karyo.nearestBand('X', 'p99'), /^p/);
});
test('nearestBand returns null for a band that is already real', () => {
  assert.equal(Karyo.nearestBand('X', 'p22.31'), null);
  assert.equal(Karyo.nearestBand('9', 'q34'), null);
});

// ---- how copies inside one cell are aligned ---------------------------------
// A whole-arm fusion (Robertsonian der, isochromosome) has its centromere at the
// seam between two whole arms. That y is not comparable to a normal homolog's p/q
// boundary: an acrocentric's centromere sits near its top, the fusion's sits in the
// middle, so centromere-aligning the two shoves the normal homolog most of the way
// down its cell and floats the derivative above the row. Those cells bottom-align.
const cellOf = (k, chrom) => {
  const c = ISCN.parse(k).clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: Karyo.computeAffected([c]) });
  // the cell for `chrom` is the one whose label div holds exactly that text
  const cells = cont.innerHTML.split('<div class="kcell');
  return cells.find((s) => new RegExp('<div class="klabel">' + chrom + '</div>').test(s)) || '';
};
// margin-top of each copy in source order, 0 when absent
const margins = (cellHtml) => [...cellHtml.matchAll(/<div class="kchrom[^"]*"[^>]*?(?:style="margin-top:([\d.]+)px")?>/g)]
  .map((m) => (m[1] ? parseFloat(m[1]) : 0));
const heights = (cellHtml) => [...cellHtml.matchAll(/<svg class="ideo" width="[\d.]+" height="([\d.]+)"/g)]
  .map((m) => parseFloat(m[1]));

test('a Robertsonian cell bottom-aligns its copies instead of centromere-aligning', () => {
  const cell = cellOf('45,XX,rob(14;21)(q10;q10)', '14');
  const [mNormal, mDer] = margins(cell);
  const [hNormal, hDer] = heights(cell);
  assert.ok(hDer > hNormal, 'the fusion is the taller copy');
  assert.equal(mDer, 0, 'the tallest copy sets the baseline');
  assert.ok(Math.abs(mNormal - (hDer - hNormal)) < 1,
    `the shorter homolog drops by exactly the height difference (got ${mNormal}, want ${(hDer - hNormal).toFixed(1)})`);
});
// NOTE: for any isochromosome the centromere shift equals the bottom shift (iso
// height = 2x the arm, seam at the middle), so this assertion holds under either
// scheme. The discriminating test for the iso is the cenSeam one below.
test('an isochromosome cell bottom-aligns too (its centromere is a seam as well)', () => {
  const cell = cellOf('46,XX,i(21)(q10)', '21');
  const [mNormal] = margins(cell);
  const [hNormal, hIso] = heights(cell);
  assert.ok(Math.abs(mNormal - (hIso - hNormal)) < 1, 'bottom-aligned, not centromere-aligned');
});
test('a derivative that keeps its own centromere still centromere-aligns', () => {
  // der(9)t(9;22): the der keeps chromosome 9's real centromere, so comparing it to
  // the normal 9 by centromere is the meaningful read and must not regress.
  const cell = cellOf('46,XX,der(9)t(9;22)(q34;q11.2)', '9');
  const [hNormal, hDer] = heights(cell);
  const [mNormal, mDer] = margins(cell);
  assert.notEqual(hNormal, hDer, 'the copies differ in length, so some alignment applies');
  assert.ok(Math.abs(mNormal - Math.max(0, hDer - hNormal)) > 1 || Math.abs(mDer) > 1,
    'not plain bottom alignment: the centromeres are comparable here');
});
test('drawInstance reports whether its centromere y came from a seam', () => {
  const inst = (k, chrom) => (ISCN.parse(k).clones[0].slots[chrom] || []).find((i) => i.kind !== 'normal');
  const ctx = { theme: 'simple', level: 1, affected: {} };
  assert.equal(Karyo.drawInstance(inst('45,XX,rob(14;21)(q10;q10)', '14'), ctx).cenSeam, true);
  assert.equal(Karyo.drawInstance(inst('46,XX,i(21)(q10)', '21'), ctx).cenSeam, true);
  assert.equal(Karyo.drawInstance(inst('46,XX,der(9)t(9;22)(q34;q11.2)', '9'), ctx).cenSeam, false);
  const normal14 = ISCN.parse('46,XX').clones[0].slots['14'][0];
  assert.equal(Karyo.drawInstance(normal14, ctx).cenSeam, false);
});

// ---- an absent autosomal homolog is drawn, a relocated one is not -----------
// 45,X already shows a placeholder for the missing sex chromosome. An autosomal
// monosomy showed nothing, so 45,XY,-21 drew a single normal-looking 21 and read as
// "chromosome 21 is fine" — most visibly in the segregation panel's preview.
//
// The count alone cannot tell the two cases apart: a balanced rob(13;14) carrier ALSO
// has one drawn 14, because 14q rides on the der. Nothing is missing there, so the
// placeholder must follow the losses the karyotype states, never a copy-number deficit.
const cellFor = (k, chrom, opts) => {
  const c = ISCN.parse(k).clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, Object.assign({ theme: 'simple', level: 1, affected: Karyo.computeAffected([c]) }, opts || {}));
  const cells = cont.innerHTML.split('<div class="kcell');
  return cells.find((s) => new RegExp('<div class="klabel">' + chrom + '</div>').test(s)) || '';
};
const ghosts = (cellHtml) => (cellHtml.match(/kchrom ghost/g) || []).length;

test('an autosomal monosomy draws the absent homolog', () => {
  const cell = cellFor('45,XY,-21', '21');
  assert.equal(ghosts(cell), 1, 'one placeholder beside the remaining 21');
  assert.match(cell, /missing/, 'labelled like the sex-chromosome placeholder');
});
test('each stated loss gets its own placeholder', () => {
  assert.equal(ghosts(cellFor('44,XX,-2,-5', '2')), 1);
  assert.equal(ghosts(cellFor('44,XX,-2,-5', '5')), 1);
});
test('a balanced Robertsonian carrier draws NO placeholder', () => {
  // The single drawn 14 is not a loss: 14q is on the der(13;14).
  assert.equal(ghosts(cellFor('45,XY,der(13;14)(q10;q10)', '14')), 0);
  assert.equal(ghosts(cellFor('45,XY,rob(14;21)(q10;q10)', '21')), 0);
  assert.equal(ghosts(cellFor('45,XY,der(13;14)(q10;q10)', '13')), 0);
});
test('a tertiary monosomy marks the absent partner, not the derivative', () => {
  assert.equal(ghosts(cellFor('45,XY,der(2)t(2;5)(q21;q31),-5', '5')), 1, '5 is genuinely one short');
  assert.equal(ghosts(cellFor('45,XY,der(2)t(2;5)(q21;q31),-5', '2')), 0, '2 carries the derivative');
});
test('a trisomy draws no placeholder', () => {
  assert.equal(ghosts(cellFor('47,XX,+21', '21')), 0);
});
test('the affected-only view shows the absent autosomal homolog too', () => {
  const cell = cellFor('45,XY,-21', '21', { only: ['21'] });
  assert.equal(ghosts(cell), 1, 'consistent with the full karyogram');
});
test('the sex chromosomes keep their own placeholder path (no doubling)', () => {
  // 45,X,-Y states a loss AND leaves a sex-chromosome gap; only one placeholder.
  const c = ISCN.parse('45,X,-Y').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: Karyo.computeAffected([c]) });
  assert.equal((cont.innerHTML.match(/kchrom ghost/g) || []).length, 1, 'exactly one, from the sex-chromosome gap in cellSpecs');
});

// ---- which arm each derivative keeps at a centromeric breakpoint -------------
// p10 and q10 both resolve to exactly the centromere, so a positional test
// ("is the breakpoint at or above the centromere?") cannot tell which side the break
// is on and sent both down the p-side path. Every whole-arm RECIPROCAL translocation
// therefore came out with its arms swapped: t(13;15)(q10;q10) drew der(13) as
// 15p+13q, which is der(15)'s content. Ordinary breakpoints were never affected,
// because there the position and the band's arm letter agree.
//
// The rule for a reciprocal is ISCN's derivative formula, the one this renderer
// already implements everywhere else and the one segregation.js states in its
// imbalance text: der(A) = A pter→bandA :: B bandB→B qter. For q10 that means A keeps
// its p arm and receives B's q arm.
const armsOf = (k, chrom) => {
  const c = ISCN.parse(k).clones[0];
  const i = (c.slots[chrom] || []).find((x) => x.kind !== 'normal');
  if (!i) return null;
  return Karyo.buildInstance(i).segments.map((s) => {
    const cen = IDEO.data[s.chrom].centromere;
    return s.chrom + (s.to <= cen ? 'p' : s.from >= cen ? 'q' : 'p+q');
  }).join('+');
};

test('a whole-arm reciprocal keeps its own p arm and takes the partner q arm', () => {
  assert.equal(armsOf('46,XX,t(13;15)(q10;q10)', '13'), '13p+15q');
  assert.equal(armsOf('46,XX,t(13;15)(q10;q10)', '15'), '15p+13q');
});
test('a whole-arm reciprocal with mixed p10/q10 breakpoints follows the same formula', () => {
  // der(1) = 1pter→1p10 :: 3q10→3qter
  assert.equal(armsOf('46,XY,t(1;3)(p10;q10)', '1'), '1p+3q');
  assert.equal(armsOf('46,XY,t(1;3)(p10;q10)', '3'), '3p+1q');
});
test('the der(A)t(A;B) product form agrees with the plain t form', () => {
  assert.equal(armsOf('46,XX,der(13)t(13;15)(q10;q10)', '13'), '13p+15q');
  assert.equal(armsOf('46,XX,der(15)t(13;15)(q10;q10)', '15'), '15p+13q');
});
test('the drawing agrees with what segregation.js says the imbalance is', () => {
  // The two halves of the app must not disagree about the same string. segregation.js
  // calls der(13)t(13;15)(q10;q10) a partial trisomy for 15q and a partial monosomy
  // for 13q, so the drawn chromosome must carry 15q and must NOT carry 13q.
  const Seg = win.Segregation;
  const m = Seg.compute(ISCN.parse('46,XX,t(13;15)(q10;q10)').clones[0]);
  const adj1 = m.modes.find((x) => x.name === 'Adjacent-1');
  adj1.gametes.forEach((g) => {
    const named = /der\((\d+)\)/.exec(g.zygote)[1];
    const arms = armsOf(g.zygote, named);
    const gained = /partial trisomy (\d+)q/.exec(g.imbalance)[1];
    const lost = /partial monosomy (\d+)q/.exec(g.imbalance)[1];
    assert.ok(arms.includes(gained + 'q'), `${g.zygote}: drawing must carry the gained ${gained}q (got ${arms})`);
    assert.ok(!arms.includes(lost + 'q'), `${g.zygote}: drawing must not carry the lost ${lost}q (got ${arms})`);
  });
});
test('Robertsonian fusions keep the arm each breakpoint names', () => {
  // Content only. armsOf() returns the arms in DRAWING order, which is decided by
  // arm length (see the orientation tests below), so compare as a set.
  const armSet = (k, chrom) => armsOf(k, chrom).split('+').sort().join('+');
  assert.equal(armSet('45,XY,rob(13;14)(q10;q10)', '13'), '13q+14q');
  assert.equal(armSet('45,XX,der(14;21)(q10;q10)', '14'), '14q+21q');
});
test('ordinary translocations are unchanged', () => {
  assert.equal(armsOf('46,XY,t(9;22)(q34;q11.2)', '9'), '9p+q+22q');
  assert.equal(armsOf('46,XY,t(9;22)(q34;q11.2)', '22'), '22p+q+9q');
  assert.equal(armsOf('46,XX,t(2;5)(q21;q31)', '2'), '2p+q+5q');
});

// ---- which arm of a whole-arm fusion is drawn on top ------------------------
// ISCN says how to WRITE der(14;21)(q10;q10), including that partners are listed
// lowest-number-first, and says nothing about the drawing. Taking that nomenclature
// order as a drawing order put the LONG arm on top of every Robertsonian, and a q
// arm in the top position has to be flipped so qter points up: der(14;21) came out
// as 90 Mb of inverted 14q above 35 Mb of 21q, so the derivative's banding ran
// backwards next to the normal 14 beside it. The rule that applies is the one every
// other chromosome in the karyogram already obeys and the one a cytogeneticist uses
// on a chromosome cut from a metaphase spread, where no name is available: orient by
// morphology, short arm up.
const topArmOf = (k, chrom) => {
  const c = ISCN.parse(k).clones[0];
  const i = (c.slots[chrom] || []).find((x) => x.kind !== 'normal');
  return Karyo.buildInstance(i).segments.map((s) => {
    const cen = IDEO.data[s.chrom].centromere;
    return { id: s.chrom + (s.to <= cen ? 'p' : 'q'), bp: s.to - s.from, reversed: !!s.reversed };
  });
};

test('a Robertsonian draws its shorter arm on top', () => {
  // .join(), not deepEqual: the renderer builds its arrays inside the vm realm, so
  // a strict deep compare fails on the Array prototype rather than the contents.
  const order = (k, c) => topArmOf(k, c).map((s) => s.id).join(' over ');
  assert.equal(order('45,XY,rob(14;21)(q10;q10)', '14'), '21q over 14q');
  assert.equal(order('45,XY,rob(13;14)(q10;q10)', '13'), '14q over 13q');
  assert.equal(order('45,XX,der(14;21)(q10;q10)', '14'), '21q over 14q');
});

test('the long arm of a Robertsonian reads the same way up as its normal homolog', () => {
  // The whole point of drawing the derivative beside the normal 14 is comparing the
  // two, which is impossible if one of them is upside down. Exactly one arm must be
  // flipped when both retained pieces are q arms; it has to be the short one.
  const segs = topArmOf('45,XY,rob(14;21)(q10;q10)', '14');
  assert.equal(segs[1].id, '14q');
  assert.equal(segs[1].reversed, false, '14q is drawn in its natural orientation');
  assert.equal(segs[0].reversed, true, 'the short arm on top is the flipped one');
  assert.equal(segs.filter((s) => s.reversed).length, 1, 'never more than one flip');
});

test('a mixed p/q whole-arm der is ordered by reversal count, not by length', () => {
  // der(1;3)(p10;q10) keeps 1p (123 Mb) and 3q (107 Mb). Putting the p arm up is the
  // only arrangement that flips neither arm; a pure length rule would hoist 3q above
  // 1p and invert both to do it, which is strictly worse to read.
  const segs = topArmOf('45,XY,der(1;3)(p10;q10)', '1');
  assert.equal(segs.map((s) => s.id).join(' over '), '1p over 3q');
  assert.equal(segs.filter((s) => s.reversed).length, 0, 'neither arm needs flipping');
});

test('the drawing order does not change what the derivative is named for', () => {
  // The outline colour and the seam centromere follow the label, not segments[0], so
  // reordering the arms cannot make der(14) look like a chromosome 21.
  const c = ISCN.parse('45,XY,rob(14;21)(q10;q10)').clones[0];
  const aff = Karyo.computeAffected([c]);
  const inst = c.slots['14'].find((x) => x.kind !== 'normal');
  const out = Karyo.drawInstance(inst, { theme: 'simple', level: 99, affected: aff });
  assert.ok(out.svg.includes(aff['14']), 'the derivative is outlined in chromosome 14 colour');
});

test('the Bands toggle cannot re-order a derivative', () => {
  // Arm ordering is decided from bp coordinates in IDEO.data, one table with no
  // per-level variants, and buildInstance takes no band level at all. rob(21;22) is
  // the case that would expose a level-dependent length: 21q (34.7 Mb) and 22q
  // (35.8 Mb) are 3% apart, so any drift would flip which one is on top. The seam y
  // is the observable, since it is the length of whichever arm was drawn first.
  const c = ISCN.parse('45,XX,rob(21;22)(q10;q10)').clones[0];
  const der = c.slots['21'].find((x) => x.kind !== 'normal');
  const cenYs = [0, 1, 99].map((level) => Karyo.drawInstance(der, { theme: 'detailed', level, affected: {} }).cenY);
  assert.equal(new Set(cenYs).size, 1, `seam moved across band levels: ${cenYs.join(', ')}`);
  assert.equal(topArmOf('45,XX,rob(21;22)(q10;q10)', '21').map((s) => s.id).join(' over '), '21q over 22q');
});

// ---- the two views are built from one cell list ----------------------------
// They used to assemble their own, and drifted: the absent-homolog placeholder for a
// monosomy shipped in the full karyogram and had to be back-ported to the affected
// view afterwards, and the two disagreed about where that placeholder sat (before
// markers in one, after them in the other). cellSpecs now decides WHICH cells exist
// for both; the views differ only in grouping and vertical alignment, which is
// deliberate and is asserted separately below.
const cellsOf = (k, view) => {
  const c = ISCN.parse(k).clones[0];
  const aff = Karyo.computeAffected([c]);
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: aff, only: view === 'affected' ? Object.keys(aff) : null });
  // Split on the cell wrapper only. `kcell-copies` shares the prefix, so an
  // unanchored split cuts every cell in two and the labels come out nonsense.
  return cont.innerHTML.split(/(?=<div class="kcell[ "])/).slice(1).map((cell) => {
    // A cell can hold a real chromosome AND a placeholder for its lost homolog
    // (45,XY,-21 draws one 21 beside a gap), so a named chromosome wins the label.
    const m = /data-chrom="([^"]+)"/.exec(cell);
    if (m) return m[1];
    if (/kchrom ghost/.test(cell)) return /nullisomy/.test(cell) ? 'nullisomy' : 'gap';
    return '?';
  });
};

test('the sex-chromosome gap sits with the sex chromosomes in BOTH views', () => {
  // 45,X,+mar: one X, one lost sex chromosome, one marker. The affected view used to
  // emit the gap last, after the marker; the full karyogram put it before. Same order
  // now, and it is the full karyogram's, because the gap belongs to the sex pair.
  ['all', 'affected'].forEach((view) => {
    const cells = cellsOf('45,X,+mar', view);
    assert.ok(cells.indexOf('gap') > cells.indexOf('X'), `${view}: gap follows X`);
    assert.ok(cells.indexOf('gap') < cells.indexOf('mar'), `${view}: gap precedes the marker`);
  });
});

test('every cell kind in the affected view also exists in the full view', () => {
  // The drift guard. A cell kind can legitimately be dropped by the affected filter,
  // but one must never appear there and be missing from the full karyogram.
  ['45,X', '45,X,+mar', '47,XY,+mar', '46,XY,dmin', '45,XY,-21', '45,XY,rob(14;21)(q10;q10)',
   'mos 45,X[12]/46,XX[18]', '48,XY,+mar,+mar'].forEach((k) => {
    const all = new Set(cellsOf(k, 'all'));
    cellsOf(k, 'affected').forEach((c) => assert.ok(all.has(c), `${k}: "${c}" is in the affected view but not the full one`));
  });
});

test('an empty slot is a nullisomy ghost in the full view and absent from the affected one', () => {
  // The one intended asymmetry: an empty slot has nothing to isolate.
  assert.ok(cellsOf('45,XY,-21', 'all').includes('21'), 'the surviving 21 is drawn');
  assert.ok(!cellsOf('45,XY,-21', 'affected').includes('nullisomy'), 'no nullisomy ghost in the focused row');
});

test('the two views keep their own vertical alignment on purpose', () => {
  // Not a candidate for consolidation: the affected row hangs every cell off one
  // shared centromere line, and across 24 chromosomes that would put chromosome 1's
  // centromere on the same line as 21's. Only the affected view offsets its cells.
  const c = ISCN.parse('45,XY,rob(14;21)(q10;q10)').clones[0];
  const aff = Karyo.computeAffected([c]);
  const html = (only) => { const x = { innerHTML: '' }; Karyo.render(x, c, { theme: 'simple', level: 1, affected: aff, only: only }); return x.innerHTML; };
  assert.match(html(Object.keys(aff)), /kcell-copies" style="margin-top:/, 'affected view sets a shared centromere line');
  assert.doesNotMatch(html(null), /kcell-copies" style="margin-top:/, 'the full karyogram does not');
});

// ---- a stated loss is drawn even when it empties the slot -------------------
// 44,XY,rob(14;21)(q10;q10),-21 leaves no free chromosome 21 at all: one fused into
// the derivative, one lost. The affected view drew no 21 cell whatsoever, so the -21
// was invisible, and the full karyogram labelled the empty slot "nullisomy" — wrong
// as well as alarming, since 21q is still present on the der(14). This is a monosomy
// for 21q, not an absence of it.
const gapsIn = (k, view, chrom) => {
  const c = ISCN.parse(k).clones[0];
  const aff = Karyo.computeAffected([c]);
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: aff, only: view === 'affected' ? Object.keys(aff) : null });
  const cell = cont.innerHTML.split(/(?=<div class="kcell[ "])/).slice(1)
    .find((x) => new RegExp('<div class="klabel">' + chrom + '</div>').test(x));
  if (!cell) return null;
  return { gaps: (cell.match(/kchrom ghost/g) || []).length, nullisomy: /nullisomy/.test(cell) };
};

test('an emptied slot shows its gap in BOTH views, and is not called nullisomy', () => {
  ['all', 'affected'].forEach((view) => {
    const c21 = gapsIn('44,XY,rob(14;21)(q10;q10),-21', view, '21');
    assert.ok(c21, `${view}: chromosome 21 has a cell at all`);
    assert.equal(c21.gaps, 1, `${view}: one gap, for the one stated loss`);
    assert.equal(c21.nullisomy, false, `${view}: 21q rides on the der, so this is not nullisomy`);
  });
});

test('each stated loss gets its own gap', () => {
  assert.equal(gapsIn('44,XY,-21,-21', 'all', '21').gaps, 2);
  assert.equal(gapsIn('45,XY,-21', 'all', '21').gaps, 1);
});

test('a balanced carrier gets no gap, because nothing is missing', () => {
  // 45,XY,rob(14;21)(q10;q10) also has a single drawn 21, but 21q rides on the
  // derivative and no loss is stated, so a gap would misstate it.
  assert.equal(gapsIn('45,XY,rob(14;21)(q10;q10)', 'all', '21').gaps, 0);
  assert.equal(gapsIn('45,XY,rob(14;21)(q10;q10)', 'affected', '21').gaps, 0);
});

test('a slot emptied by derivatives says "none free", not "nullisomy"', () => {
  // 43,XY,rob(13;14)(q10;q10) twice consumes both 13s and both 14s. Both 13q and
  // both 14q are present, on the two fusions, so nothing is missing and "nullisomy"
  // was flatly wrong. A probe over the reachable inputs found no case where an
  // autosome slot empties with nothing accounting for it, so the label had no
  // correct use left at all.
  const c = ISCN.parse('43,XY,rob(13;14)(q10;q10),rob(13;14)(q10;q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: Karyo.computeAffected([c]) });
  assert.match(cont.innerHTML, /none free/, 'says what is true of the slot');
  assert.doesNotMatch(cont.innerHTML, /nullisomy/, 'and does not claim material is absent');
});

test('the word nullisomy is gone from the renderer', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'karyo-render.js'), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  assert.ok(!/nullisomy/.test(code), 'no remaining nullisomy label in code');
});

// --- Cells sit on a common baseline in the affected view ---------------------
// Two different axes, and they are easy to confuse. WITHIN a cell, a derivative is
// aligned to its homolog on the centromere (the tests above): that is the comparison
// the reader is making, and the shared line earns its keep. ACROSS cells, the affected
// view used to hang every cell off one shared centromere line too, which disagreed
// with the full 24-chromosome view and, with only two or three cells on screen, read
// as a short chromosome floating above the others rather than aligned with them.
test('affected-view cells share a baseline, as the full view does', () => {
  // t(1;21): chromosome 1 is the longest and 21 is nearly the shortest, so a shared
  // centromere line separates their baselines by a wide margin and any regression is
  // obvious rather than a rounding difference.
  const c = ISCN.parse('46,XX,t(1;21)(p36.3;q22)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'simple', level: 1, affected: Karyo.computeAffected([c]), only: ['1', '21'] });

  // The across-cell shift is the margin-top on .kcell-copies; the within-cell shifts
  // are on .kchrom and are a separate mechanism.
  const offsets = [...cont.innerHTML.matchAll(/class="kcell-copies"(?: style="margin-top:([\d.]+)px")?/g)]
    .map((m) => (m[1] ? parseFloat(m[1]) : 0));
  assert.equal(offsets.length, 2, 'one cell per involved chromosome');

  // Each cell's own height, measured the way the renderer measures it.
  const heightOf = (chrom) => Math.max(...c.slots[chrom].map(
    (i) => Karyo.drawInstance(i, { theme: 'simple', level: 1, affected: {} }).height));
  const h1 = heightOf('1'), h21 = heightOf('21');
  const maxH = Math.max(h1, h21);

  assert.ok(Math.abs(offsets[0] - (maxH - h1)) < 1, 'chromosome 1 is pushed down to the baseline');
  assert.ok(Math.abs(offsets[1] - (maxH - h21)) < 1, 'and so is 21');
  // The property that matters, stated directly: both cells end at the same y.
  assert.ok(Math.abs((offsets[0] + h1) - (offsets[1] + h21)) < 1, 'the two cells share a bottom');
  // And it is genuinely a different answer from centromere alignment here, so this
  // cannot pass by coincidence.
  const cenOf = (chrom) => Math.max(...c.slots[chrom].map(
    (i) => Karyo.drawInstance(i, { theme: 'simple', level: 1, affected: {} }).cenY));
  const cenShift = Math.abs((cenOf('1') - h1) - (cenOf('21') - h21));
  assert.ok(cenShift > 5, 'a shared centromere line would put these cells visibly apart');
});

// ---- fragile sites (ISCN 2.6.2, 5.5.7) --------------------------------------
// buildInstance had no fra branch, so a fragile site fell through to the generic
// "draw the whole chromosome" return: 46,X,fra(X)(q27.3) rendered an X identical to
// a normal X, with the caption as the only sign anything had been said. A fragile
// site is a gap in the chromatid at one band, and the distal fragment stays attached.
test('a fragile site marks its band instead of drawing an unmarked chromosome', () => {
  const b = Karyo.buildInstance(derInst('46,X,fra(X)(q27.3)', 'X'));
  assert.equal(b.segments.length, 1, 'one piece: nothing is deleted and nothing is joined');
  assert.equal(totalBp(b.segments), IDEO.data['X'].length, 'full length, distal fragment still attached');
  const gap = b.overlays.filter((o) => o.type === 'fra');
  assert.equal(gap.length, 1, 'exactly one gap overlay');
  const band = Karyo.resolveBand('X', 'q27.3');
  assert.ok(gap[0].at > band.start && gap[0].at < band.end, 'the gap sits inside Xq27.3');
});

test('the fragile-site gap reaches the drawn SVG', () => {
  const draw = (k) => {
    const cont = { innerHTML: '' };
    Karyo.render(cont, ISCN.parse(k).clones[0], { theme: 'detailed', level: 1, affected: {} });
    return cont.innerHTML;
  };
  const fra = draw('46,X,fra(X)(q27.3)');
  assert.match(fra, /fra-gap/, 'the gap is drawn');
  assert.doesNotMatch(draw('46,XX'), /fra-gap/, 'and only when a fragile site was written');
});

// The flat unstained gap plus two hairlines was near-invisible at karyogram scale,
// so the body now pinches into a constricted waist at the site, which is also what
// the microscopist sees (Gardner 5e: an "apparent rupture" with the distal material
// still attached). The clip and the outline both follow the pinched path, and the
// gap hairlines are clipped to the body: a rect body happened to end exactly where
// they do, a waisted one no longer does, so unclipped lines would overhang it.
// Checked at every display level, not the default one (#160's lesson).
test('a fragile site pinches the body into a waist at the band', () => {
  for (const level of [0, 1, 2]) {
    const draw = (k) => {
      const cont = { innerHTML: '' };
      Karyo.render(cont, ISCN.parse(k).clones[0], { theme: 'detailed', level, affected: {} });
      return cont.innerHTML;
    };
    const fra = draw('46,X,fra(X)(q27.3)');
    assert.match(fra, /<clipPath id="[^"]*"><path /, `the clip follows the waist (level ${level})`);
    assert.match(fra, /<path d="[^"]+" fill="none" stroke/, `so does the outline (level ${level})`);
    const clipped = fra.match(/<line [^>]*clip-path[^>]*>/g) || [];
    assert.ok(clipped.length >= 2, `the gap hairlines clip to the pinched body (level ${level})`);
    assert.doesNotMatch(draw('46,XX'), /<clipPath id="[^"]*"><path /,
      `a normal chromosome keeps its plain capsule (level ${level})`);
  }
});

// The karyogram hover pipeline keys on `.band` rects and their data attributes
// (index.html wireInteractions), and the gap rect sat on top of the q27.3 band
// with neither, so the one region of this chromosome a reader would point at was
// the one region the tooltip went silent on. The gap now presents itself as a
// hoverable band with a fra pseudo-stain, and the hairlines pass the pointer
// through so they cannot shadow it.
test('the fragile-site gap is hoverable and names its band', () => {
  const cont = { innerHTML: '' };
  Karyo.render(cont, ISCN.parse('46,X,fra(X)(q27.3)').clones[0], { theme: 'detailed', level: 1, affected: {} });
  const gap = (cont.innerHTML.match(/<rect class="band fra-gap"[^>]*>/) || [])[0];
  assert.ok(gap, 'the gap rect is a band the hover pipeline can see');
  assert.match(gap, /data-chrom="X"/);
  assert.match(gap, /data-band="q27.3"/, 'the band as written, so the tooltip reads Xq27.3');
  assert.match(gap, /data-stain="fra"/, 'the pseudo-stain Teach.stainInfo names');
  const hairlines = cont.innerHTML.match(/<line [^>]*pointer-events="none"[^>]*>/g) || [];
  assert.ok(hairlines.length >= 2, 'the hairlines do not intercept the hover');
});

// --- The isochromosome owns its centromere -----------------------------------
// Dan hovered 18q11.1 on i(18)(q10) and was told "Pericentromeric
// heterochromatin" while the normal homolog's same band answers "Centromere".
// The #181 downgrade (acen on a hasCen:false segment paints as carried
// heterochromatin, so a der graft cannot read as dicentric) was overshooting:
// the iso branch flagged both mirror arms hasCen:false, but the acen flanking
// an isochromosome's seam IS the working centromere's own material, exactly as
// on a Robertsonian, whose whole-arm segments carry hasCen:true and answer
// "Centromere" there. The iso now follows the rob convention; the seam still
// draws the single waist, because a centromere at a segment's EDGE never
// enters cenList, and the true der-graft case must keep its downgrade.
test('i(18)(q10) answers Centromere at its seam acen, like the rob and the homolog', () => {
  const svg = Karyo.drawInstance(derInst('46,XY,i(18)(q10)', '18'), { theme: 'simple', level: 99, affected: {} }).svg;
  const stains = (svg.match(/data-band="q11\.1" data-stain="([a-z_]+)"/g) || []);
  assert.equal(stains.length, 2, 'both mirror arms carry the q11.1 band');
  assert.ok(stains.every((s) => s.indexOf('"acen"') >= 0), `the working centromere's own material is acen, got ${stains}`);
  assert.ok(!/acen_carried/.test(svg), 'nothing on an isochromosome is carried across from elsewhere');
  const waists = (svg.match(/stroke-dasharray="2\.5 2"/g) || []).length;
  assert.equal(waists, 1, 'and still exactly one centromere waist, at the seam');
});

test('the true der graft keeps its acen_carried downgrade (#181 must not regress)', () => {
  const svg = Karyo.drawInstance(derInst('46,XX,der(19)t(X;19)(q11.1;p13.3)', '19'), { theme: 'simple', level: 99, affected: {} }).svg;
  assert.match(svg, /acen_carried/, 'grafted centromere-band material still paints as carried heterochromatin');
  const waists = (svg.match(/stroke-dasharray="2\.5 2"/g) || []).length;
  assert.equal(waists, 1, 'and the derivative stays monocentric');
});
