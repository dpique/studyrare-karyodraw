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
