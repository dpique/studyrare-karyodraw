'use strict';
// Decode tests for the teaching layer (teach.js). Like the other modules it is a
// browser IIFE; loaded (with its ideogram/parser/render dependencies) into a
// minimal window shim so window.Teach can be exercised under `node --test`.
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
load('teach.js');
const ISCN = win.ISCN;
const Teach = win.Teach;

// The prose that decodes an aberration token, for a single-aberration karyotype.
const decodeText = (k) => {
  const clone = ISCN.parse(k).clones[0];
  return Teach.decode(clone).filter((r) => r.tag !== 'count' && r.tag !== 'sex').map((r) => r.text).join(' ');
};

test('teach module loads', () => {
  assert.equal(typeof Teach.decode, 'function');
});

// A der() chain draws the extra del/dup/inv, so the decode prose must name them
// too — otherwise the picture and the words disagree.
test('der chain decode names the deletion, not just the translocation', () => {
  const txt = decodeText('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)');
  assert.match(txt, /translocation|22/, 'still describes the t(9;22) junction');
  assert.match(txt, /delet/i, 'also mentions the deletion');
  assert.match(txt, /9p12/, 'references the deletion breakpoint');
});

test('der chain decode names a duplication sub-op', () => {
  const txt = decodeText('46,XY,der(1)t(1;3)(p36;q21)dup(1)(q22q25)');
  assert.match(txt, /duplicat/i, 'mentions the duplication');
  assert.match(txt, /1q22|1q25/, 'references the duplicated segment');
});

// A der() with no translocation, only del/dup, must still narrate them.
test('der chain with no translocation still names its sub-ops', () => {
  const txt = decodeText('46,XY,der(1)del(1)(p13)del(1)(q32)');
  assert.match(txt, /delet/i, 'mentions the deletions');
  assert.match(txt, /1p13/, 'references the first deletion');
  assert.match(txt, /1q32/, 'references the second deletion');
});

// A Robertsonian der(13;14) lists the two chromosomes lowest-number-first by
// convention; the notation does NOT tell us whose centromere is retained (these
// whole-arm fusions are usually dicentric). So the decode must not claim it "has
// chromosome 13's centromere" — it must describe the fusion of both chromosomes.
test('Robertsonian decode does not claim a single chromosome centromere', () => {
  const txt = decodeText('45,XX,rob(13;14)(q10;q10)');
  assert.match(txt, /robertsonian/i, 'names it a Robertsonian translocation');
  assert.match(txt, /13/, 'names chromosome 13');
  assert.match(txt, /14/, 'names chromosome 14');
  assert.doesNotMatch(txt, /chromosome 13[’']s centromere/, 'does not claim it has chromosome 13 centromere');
});

// The Klinefelter matcher also fires for 48,XXXY; its label must frame 47,XXY as
// the classic form among variants, not assert "47,XXY" as this karyotype's count.
test('Klinefelter label frames 47,XXY as a variant family, not the exact count', () => {
  const kf = Teach.syndromes(ISCN.parse('48,XXXY').clones[0]).find((s) => /Klinefelter/.test(s.name));
  assert.ok(kf, 'still recognized as Klinefelter');
  assert.match(kf.name, /variant/i, 'acknowledges variants rather than labeling a 48-count as 47,XXY');
  assert.doesNotMatch(kf.name, /^47,XXY,/, 'does not lead with 47,XXY as the definitive karyotype');
});

// The Turner matcher fires for any single-X complement, including 46-count variants
// (46,X,i(X)(q10), 46,X,idic(Y)); its label and note must not assert 45,X / monosomy.
test('Turner label frames 45,X as a variant family, not the exact count', () => {
  const t = Teach.syndromes(ISCN.parse('46,X,i(X)(q10)').clones[0]).find((s) => /Turner/.test(s.name));
  assert.ok(t, 'still recognized as Turner');
  assert.match(t.name, /variant/i, 'acknowledges variants rather than labeling a 46-count as 45,X');
  assert.doesNotMatch(t.name, /^45,X,/, 'does not lead with 45,X for a 46-count variant');
  assert.doesNotMatch(t.note, /no second sex chromosome/i, 'note does not claim monosomy for a structural variant');
});

// Gene fusions in the clinical notes use the current ISCN double-colon form.
test('gene fusions in clinical notes use the :: nomenclature', () => {
  const ph = Teach.syndromes(ISCN.parse('46,XY,t(9;22)(q34;q11.2)').clones[0]).find((s) => /Philadelphia/.test(s.name));
  assert.ok(ph, 'recognizes the Philadelphia chromosome');
  assert.match(ph.note, /BCR::ABL1/, 'writes BCR::ABL1, not the legacy hyphen form');
});

// Inheritance/origin qualifiers (c/mat/pat/dn) are spelled out in the decode.
test('inheritance qualifiers are explained, not just shown in the code', () => {
  assert.match(decodeText('46,XX,del(7)(q22)mat'), /mat = maternal in origin/i);
  assert.match(decodeText('47,XX,+21c'), /c = constitutional/i);
  assert.match(decodeText('46,XY,r(13)(p11q34) dn'), /dn = de novo/i);
  assert.match(decodeText('46,XX,del(5)(q31)pat'), /pat = paternal in origin/i);
});

// A numbered marker decodes with its count; a single marker stays singular.
test('a numbered marker decodes as the right count', () => {
  assert.match(decodeText('48,XX,+2mar'), /2 MARKER chromosomes/);
  assert.match(decodeText('47,XY,+mar'), /a MARKER chromosome/);
});

// A cancer translocation is flagged acquired (somatic) so the segregation panel can
// say it is not transmitted; a constitutional rearrangement is not flagged.
test('cancer translocations are flagged acquired; constitutional carriers are not', () => {
  const acq = (k) => Teach.syndromes(ISCN.parse(k).clones[0]).some((s) => s.acquired);
  assert.equal(acq('46,XY,t(9;22)(q34;q11.2)'), true, 't(9;22) Philadelphia');
  assert.equal(acq('46,XY,t(11;14)(q13;q32)'), true, 't(11;14) mantle cell');
  assert.equal(acq('46,XX,t(12;21)(p13;q22)'), true, 't(12;21) childhood ALL');
  assert.equal(acq('46,XX,t(2;5)(q21;q31)'), false, 'a generic reciprocal is not acquired');
  assert.equal(acq('45,XX,der(14;21)(q10;q10)'), false, 'a Robertsonian carrier is not acquired');
});

// The spoken text includes the cell count (the proportions matter for a mosaic).
test('pronounce speaks the cell count when present', () => {
  assert.match(Teach.pronounce(ISCN.parse('45,X[12]').clones[0]), /in 12 cells/);
  assert.match(Teach.pronounce(ISCN.parse('46,XX[cp20]').clones[0]), /composite of 20 cells/);
  assert.doesNotMatch(Teach.pronounce(ISCN.parse('46,XX').clones[0]), /cell/);
});

// ---- a whole-arm acrocentric t() at a self-consistent count -----------------
// 45,XX,t(13;15)(q10;q10) contradicts itself and gets a warning plus a rob() fix.
// 46,XX,t(13;15)(q10;q10) does not: it is legal, and for two non-acrocentrics it is
// genuinely what you would write. But for two acrocentrics it is almost never what
// the writer meant, and the drawing (46 chromosomes, both products present) is the
// picture that convinces a student a Robertsonian carrier has 46. That belongs in the
// decode panel, which explains what you typed, not in the warning box, which is for
// what is wrong: warning on correct input is how a warning box loses its authority.
test('a 46-count whole-arm acrocentric t is explained, and points at rob', () => {
  const t = decodeText('46,XX,t(13;15)(q10;q10)');
  assert.match(t, /count stays 46/);
  assert.match(t, /rob\(13;15\)\(q10;q10\)/);
  assert.match(t, /45/, 'names the count a Robertsonian would give');
});
test('the same note is absent when the count already contradicts the t', () => {
  // 45,XX,t(13;15)(q10;q10): the warning box and the rob() fix already handle it, so
  // the decode panel must not repeat the lesson.
  assert.doesNotMatch(decodeText('45,XX,t(13;15)(q10;q10)'), /count stays 46/);
});
test('a whole-arm t between non-acrocentrics gets no rob note', () => {
  assert.doesNotMatch(decodeText('46,XY,t(1;3)(p10;q10)'), /Robertsonian|rob\(/);
});
test('an ordinary reciprocal translocation gets no rob note', () => {
  assert.doesNotMatch(decodeText('46,XY,t(9;22)(q34;q11.2)'), /Robertsonian|rob\(/);
});
test('a real Robertsonian is not told to use rob (it already does)', () => {
  assert.doesNotMatch(decodeText('45,XX,rob(13;15)(q10;q10)'), /count stays 46/);
});

// ---- why (p10;q10) and (q10;q10) draw the same thing ------------------------
// Reported: the two spellings render identically, which reads as the app ignoring
// the input. It is correct. ISCN's derivative formula is der(A) = A pter->bandA ::
// B bandB->B qter, and at the centromere "pter->band" is the whole p arm whichever
// letter is written, so every spelling gives der(A) = Ap+Bq. The letters record
// which half of the split centromere each derivative carries. The decode has to say
// so, or the identical drawings look like a bug.
test('a whole-arm reciprocal is decoded as a whole-arm exchange, with the arms named', () => {
  const t = decodeText('46,XX,t(13;15)(q10;q10)');
  assert.match(t, /WHOLE-ARM/);
  assert.match(t, /der\(13\) is 13p carrying 15q/);
  assert.match(t, /der\(15\) is 15p carrying 13q/);
});
test('the decode says the p10\/q10 letters do not choose the arms', () => {
  assert.match(decodeText('46,XX,t(13;15)(p10;q10)'),
    /halves of a centromere[\s\S]*same two chromosomes/);
});
test('every whole-arm spelling decodes to the same arms', () => {
  // Only the echoed breakpoints may differ between spellings; the sentence naming
  // what each derivative carries must not.
  ['(p10;q10)', '(q10;q10)', '(p10;p10)', '(q10;p10)'].forEach((bp) => {
    const t = decodeText('46,XX,t(13;15)' + bp);
    assert.match(t, /der\(13\) is 13p carrying 15q/, bp);
    assert.match(t, /der\(15\) is 15p carrying 13q/, bp);
  });
});
test('the prose and the drawing cannot disagree about a whole-arm derivative', () => {
  // The decode names the arms in words; the renderer builds them as segments. Pin
  // them to each other so a change to either one fails here.
  const Karyo = win.Karyo, IDEO = win.IDEOGRAM;
  const armsOf = (k, chrom) => {
    const c = ISCN.parse(k).clones[0];
    const i = (c.slots[chrom] || []).find((x) => x.kind !== 'normal');
    return Karyo.buildInstance(i).segments.map((s) => {
      const cen = IDEO.data[s.chrom].centromere;
      return s.chrom + (s.to <= cen ? 'p' : s.from >= cen ? 'q' : 'p+q');
    }).join('+');
  };
  ['46,XX,t(13;15)(p10;q10)', '46,XY,t(1;3)(p10;q10)'].forEach((k) => {
    const t = decodeText(k);
    const said = /der\((\d+)\) is (\d+)p carrying (\d+)q/.exec(t);
    assert.ok(said, k);
    assert.equal(armsOf(k, said[1]), said[2] + 'p+' + said[3] + 'q', k);
  });
});
test('an ordinary reciprocal keeps the plain wording', () => {
  const t = decodeText('46,XY,t(9;22)(q34;q11.2)');
  assert.doesNotMatch(t, /WHOLE-ARM/);
  assert.match(t, /a reciprocal TRANSLOCATION/);
});
test('the rob note says why losing the acrocentric short arms is harmless', () => {
  // "45 chromosomes" reads as a monosomy until you know what is on those short arms.
  assert.match(decodeText('46,XX,t(13;15)(q10;q10)'), /ribosomal RNA gene repeats/);
});

test('the decoded count echoes the range separator that was typed', () => {
  // The decode rebuilt the code as N~M whatever was written, so typing 47-49 showed
  // 47~49 and read as if the app had silently edited the input.
  const codeOf = (k) => Teach.decode(ISCN.parse(k).clones[0]).filter((r) => r.tag === 'count')[0];
  assert.equal(codeOf('47-49,XY,+8').code, '47-49');
  assert.equal(codeOf('47~49,XY,+8').code, '47~49');
  assert.equal(codeOf('46,XY').code, '46');
  assert.equal(codeOf('45<2n>,XY,der(14;21)(q10;q10)').code, '45<2n>');
});


test('the decode states the range once, and the tilde advice is not repeated there', () => {
  const textOf = (k) => Teach.decode(ISCN.parse(k).clones[0]).filter((r) => r.tag === 'count')[0].text;
  // The chip still echoes what was typed...
  assert.equal(Teach.decode(ISCN.parse('46-49,XY').clones[0]).filter((r) => r.tag === 'count')[0].code, '46-49');
  // ...but the tilde advice lives in the note box with a one-click fix, not twice on screen.
  assert.ok(!/tilde/.test(textOf('46-49,XY')), textOf('46-49,XY'));
  assert.match(textOf('46-49,XY'), /varies from 46 to 49/);
});

// A supernumerary ring is the same finding as a marker plus one fact: the shape.
// The chromosome of origin is still unknown, which is what separates +r from r(13),
// and the two are easy to confuse written down, so the decode has to say it.
test('the ring marker says what is known and what is not', () => {
  const text = decodeText('47,XX,+r');
  assert.match(text, /RING/, 'names the shape');
  assert.match(text, /cannot identify/, 'and that the chromosome of origin is unknown');
  assert.match(text, /r\(13\)/, 'and points at the notation used once it is known');
  assert.match(decodeText('48,XX,+2r'), /2 supernumerary RING chromosomes .* that have formed/,
    'the plural agrees');
});
