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
  const s = shifts('45,XX,rob(13;14)(q10;q10)', '13', (i) => i.kind === 'normal');
  assert.ok(s.allCen, 'both copies now have a centromere y (the der on its fusion seam)');
  assert.ok(Math.abs(s.cenShift - s.botShift) > 3, 'centromere and bottom shifts differ here');
  const c = ISCN.parse('45,XX,rob(13;14)(q10;q10)').clones[0];
  const cont = { innerHTML: '' };
  Karyo.render(cont, c, { theme: 'detailed', level: 99, affected: Karyo.computeAffected([c]), only: ['13', '14'] });
  const normal13 = marginTopOf(cont.innerHTML, '13', 'normal');
  assert.ok(Math.abs(normal13 - s.cenShift) < 1, 'normal 13 uses the centromere shift, not the bottom shift');
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
  assert.equal((cont.innerHTML.match(/kchrom ghost/g) || []).length, 1, 'exactly one, from missingSexCells');
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
test('Robertsonian fusions are untouched (they keep the arm each breakpoint names)', () => {
  assert.equal(armsOf('45,XY,rob(13;14)(q10;q10)', '13'), '13q+14q');
  assert.equal(armsOf('45,XX,der(14;21)(q10;q10)', '14'), '14q+21q');
});
test('ordinary translocations are unchanged', () => {
  assert.equal(armsOf('46,XY,t(9;22)(q34;q11.2)', '9'), '9p+q+22q');
  assert.equal(armsOf('46,XY,t(9;22)(q34;q11.2)', '22'), '22p+q+9q');
  assert.equal(armsOf('46,XX,t(2;5)(q21;q31)', '2'), '2p+q+5q');
});
