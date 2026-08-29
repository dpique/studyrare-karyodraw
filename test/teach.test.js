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
const decodeRows = (k) => Teach.decode(ISCN.parse(k).clones[0]);

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

// Inheritance/origin qualifiers (c/mat/pat/dn and the d- forms) are their own decoded
// element, not a parenthesis trailing the aberration's paragraph. ISCN 4.2.1 g makes
// them a suffix that says where the rearrangement came from; they are not part of the
// rearrangement. So each gets a row of its own, the way the count and sex fields do.
test('inheritance qualifiers are explained, not just shown in the code', () => {
  const qual = (k) => decodeRows(k).find((r) => r.tag === 'qual');
  assert.match(qual('46,XX,del(7)(q22)mat').text, /maternal in origin/i);
  assert.match(qual('47,XX,+21c').text, /constitutional/i);
  assert.match(qual('46,XY,r(13)(p11q34) dn').text, /de novo/i);
  assert.match(qual('46,XX,del(5)(q31)pat').text, /paternal in origin/i);
  assert.equal(qual('46,XX,del(7)(q22)mat').code, 'mat', 'the suffix itself is the code chip');
});

// rec() is the case that forced this. Its paragraph runs ten lines before the qualifier
// starts, and dmat carried the one fact a counselor needs from it: the child's
// chromosome is not the balanced parent's chromosome. Read inline at the end of that
// wall it was the easiest thing in the panel to miss.
test('a qualifier splits off the aberration it trails, which keeps its own chip clean', () => {
  const rows = decodeRows('46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat');
  const ab = rows.find((r) => r.tag === 'rec');
  const q = rows.find((r) => r.tag === 'qual');

  assert.equal(ab.code, 'rec(2)dup(2p)inv(2)(p21q31)', 'the aberration chip drops the suffix');
  assert.doesNotMatch(ab.text, /dmat/, 'and its paragraph no longer carries it inline');
  assert.equal(q.code, 'dmat', 'the suffix is a row of its own');
  assert.match(q.text, /her chromosome and this one are not the same/, 'carrying the whole explanation');
  assert.equal(rows.indexOf(q), rows.indexOf(ab) + 1, 'directly under the aberration it qualifies');
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

// ---- expected X-inactivation on rearrangements involving the X ------------
// X-inactivation status is NOT part of ISCN: the standard carries it only as a FISH
// probe in ish nomenclature (ISCN 2024 example xxiii, 46,X,r(X)(p22.3q22).ish
// r(X)(...XIST+,DXZ4-)). So every sentence here is flagged "Expected", and it is
// inference from the rearrangement rather than a reading of the notation.
//
// The governing rule is one principle, not a lookup table (Gardner & Sutherland,
// p. 221): the surviving inactivation pattern is the one leaving the least
// functional imbalance, and the choice exists only where the abnormal chromosome
// retains an X-inactivation center.
test('a balanced X-autosome translocation silences the NORMAL X', () => {
  const text = decodeText('46,X,t(X;22)(q28;q11)');
  assert.match(text, /Expected X inactivation/, 'flags the claim as inference, not notation');
  assert.match(text, /normal X is silenced/, 'names which X goes inactive');
  assert.match(text, /derivatives stay active/, 'and which stay active');
  // The clinically load-bearing half: the intact X being the silenced one is why a
  // balanced female carrier can present with an X-linked recessive disease.
  assert.match(text, /X-linked recessive/, 'names the manifesting-carrier consequence');
});

test('an unbalanced der(X) silences the ABNORMAL X instead', () => {
  const text = decodeText('46,X,der(X)t(X;22)(q28;q11)');
  assert.match(text, /Expected X inactivation/);
  assert.match(text, /der\(X\) is silenced/, 'the derivative is the one silenced here');
  assert.match(text, /least functional imbalance/, 'and says why');
  assert.ok(!/X-linked recessive/.test(text),
    'the manifesting-carrier warning belongs to the BALANCED carrier only');
});

test('a structurally abnormal X is the one silenced, and the XIST caveat rides along', () => {
  for (const k of ['46,X,i(X)(q10)', '46,X,r(X)(p22.1q27)', '46,X,del(X)(q21)']) {
    const text = decodeText(k);
    assert.match(text, /Expected X inactivation/, k);
    assert.match(text, /abnormal X is silenced/, k);
    assert.match(text, /X-inactivation center/, k + ' carries the XIST caveat');
  }
});

test('with only one X there is no choice to make, and the note says so', () => {
  const text = decodeText('46,Y,t(X;22)(q28;q11)');
  assert.match(text, /only one X/, 'a male carrier has no second X to silence');
  assert.ok(!/normal X is silenced/.test(text), 'so it must not assert a skewed pattern');
});

test('X;Y translocations are reported as variable rather than predicted', () => {
  const text = decodeText('46,X,t(X;Y)(p22;q11)');
  assert.match(text, /variable/, 'Gardner flags X;Y as not reliably predicted');
  assert.ok(!/normal X is silenced/.test(text));
});

test('the note stays off rearrangements that do not involve the X', () => {
  assert.ok(!/X inactivation/.test(decodeText('46,XY,t(9;22)(q34;q11.2)')));
  assert.ok(!/X inactivation/.test(decodeText('47,XX,+21')));
  assert.ok(!/X inactivation/.test(decodeText('46,XY,inv(9)(p11q13)')));
});

// Landing pages escape decode text (build-pages.mjs decodeList -> esc(r.text)), so
// markup here would ship as literal &lt;i&gt; on every generated page.
test('the X-inactivation note carries no markup', () => {
  for (const k of ['46,X,t(X;22)(q28;q11)', '46,X,der(X)t(X;22)(q28;q11)', '46,X,i(X)(q10)']) {
    assert.ok(!/[<>]/.test(decodeText(k)), k);
  }
});

// The mirror case: a piece of X landing on an autosome. It has no inactivation center
// of its own and is out of reach of the one on the X, so it CANNOT be silenced. Saying
// "the der is silenced" here would be exactly backwards.
test('X material on a der(autosome) is called out as unsilenceable', () => {
  // Xq28 is distal to the Xq13 center, so the center stays behind on the X.
  const text = decodeText('46,X,der(22)t(X;22)(q28;q11)');
  assert.match(text, /no X-inactivation center of its own/);
  assert.match(text, /cannot be silenced/);
  assert.match(text, /functional disomy/, 'names the consequence');
  assert.ok(!/is silenced/.test(text), 'must not claim the derivative goes inactive');
});

// der() descriptions end in a full stop and the note opens with one, which read as
// "attached.. Expected X inactivation" on every derivative until the join was fixed.
test('the X-inactivation note joins without doubling the full stop', () => {
  for (const k of ['46,X,der(X)t(X;22)(q28;q11)', '46,X,der(22)t(X;22)(q28;q11)',
                   '46,X,t(X;22)(q28;q11)', '46,X,i(X)(q10)', '46,X,del(X)(q21)']) {
    assert.ok(!/\.\./.test(decodeText(k)), k + ' -> ' + decodeText(k));
  }
});

// ISCN lists a REARRANGED sex chromosome inside the rearrangement, not in the sex
// field. ISCN 2024 section 5.5.18.1.1 example iii is explicit: "the correct designation
// is 46,X,t(X;13) and not 46,XX,t(X;13). Similarly, an identical translocation in a male
// is designated 46,Y,t(X;13) and not 46,XY,t(X;13)."
// So a lone X in the field is monosomy X only when no second X is drawn elsewhere.
// Calling 46,X,t(X;13) "monosomy X" told the reader she was missing an X she has.
test('a lone X in the sex field is only monosomy X when no second X is drawn', () => {
  const sexNote = (k) => Teach.decode(ISCN.parse(k).clones[0]).filter((r) => r.tag === 'sex')[0].text;
  for (const k of ['46,X,t(X;13)(q27;q12)', '46,X,i(X)(q10)', '46,X,del(X)(q21)']) {
    // Must not ASSERT monosomy; saying "not monosomy X" out loud is the point.
    assert.ok(!/a single X \(monosomy X\)/.test(sexNote(k)), k + ' -> ' + sexNote(k));
    assert.match(sexNote(k), /not monosomy X/, k + ' names the trap directly');
    assert.match(sexNote(k), /the other X/, k + ' says where the second X went');
  }
  // 45,X genuinely is monosomy X and has to keep saying so.
  assert.match(sexNote('45,X'), /monosomy X/);
  // The male counterpart ISCN names in the same note.
  assert.match(sexNote('46,Y,t(X;13)(q27;q12)'), /the X is named in the rearrangement/);
});

// ---- the XIC is at Xq13, so the answer is breakpoint-dependent ---------------
// Gardner & Sutherland p.214: "Transcriptional silencing is initiated at an
// X-inactivation center (XIC) in Xq13". Figure 6-8 caption: "the der(autosome) has
// the XIC; here, the X breakpoint must be in proximal Xq, above the XIC ... In the
// third column, in which the der(X) has the XIC, X exchanges can occur either in Xp
// or in Xq distal to the XIC."
// So which side of the break keeps the center decides what can be silenced AT ALL,
// and the first cut of this feature asserted the common case unconditionally.
test('X material on a der(autosome) is only unsilenceable when the break spared the XIC', () => {
  // Break in Xp: the der(X) keeps Xq13, so the segment on the autosome has no center.
  const noXic = decodeText('46,X,der(4)t(X;4)(p21;p16)');
  assert.match(noXic, /no X-inactivation center/);
  assert.match(noXic, /functional disomy/);
  // Break in PROXIMAL Xq, above the XIC: the center travels WITH the segment, so it
  // can be silenced, and silencing spreads into the autosome instead.
  const hasXic = decodeText('46,X,der(21)t(X;21)(q11;q22)');
  assert.match(hasXic, /carries the X-inactivation center/, hasXic);
  assert.match(hasXic, /spread/, 'and names spreading into the autosome');
  assert.ok(!/no X-inactivation center/.test(hasXic), 'must not claim the center is absent');
});

test('an isochromosome is silenceable only when it is the q arm that is doubled', () => {
  // i(Xq) carries Xq13 twice, so it can be inactivated: variant Turner syndrome.
  assert.match(decodeText('46,X,i(X)(q10)'), /abnormal X is silenced/);
  // i(Xp) has no Xq at all, so no XIC and no way to silence it.
  const ip = decodeText('46,X,i(X)(p10)');
  assert.match(ip, /no X-inactivation center/, ip);
  assert.ok(!/abnormal X is silenced/.test(ip), 'i(Xp) cannot be silenced');
});

test('a break inside Xq13 itself is reported as uncertain rather than guessed', () => {
  const text = decodeText('46,X,t(X;9)(q13;p22)');
  assert.match(text, /Xq13/, 'names the band the center sits in');
  assert.ok(!/the normal X is silenced, and both derivatives stay active/.test(text),
    'must not assert the usual balanced answer when the break is in the center itself');
});

// ---- sex-chromosome syndromes are decided on DOSAGE, not on the sex field ----
// ISCN 5.5.18.1.1 iii moves a rearranged sex chromosome out of the sex field, so the
// field alone cannot say how many X a clone carries. ISCN 5.5.7 glosses three of its
// own fragile-site examples by name and the matchers disagreed with every one:
// 46,X,fra(X)(q27.3) is "a female" (5.5.7 a i) and was labelled Turner syndrome;
// 45,fra(X)(q27.3) is "an individual with Turner syndrome" (a iii) and got no card;
// 47,XY,fra(X)(q27.3) is "an individual with Klinefelter syndrome" (a iv), likewise.
// clone.complement already counts a rearranged X as an X. sexNote() fixed exactly
// this misreading for the decode row above and left these matchers reading the field.
const called = (k) => Teach.syndromes(ISCN.parse(k).clones[0]).map((s) => s.name).join(' | ');

test('a whole second X is not monosomy, whatever the sex field spells', () => {
  for (const k of ['46,X,fra(X)(q27.3)', '46,X,t(X;13)(q27;q12)', '46,X,t(X;18)(p11.1;q11.2)']) {
    assert.doesNotMatch(called(k), /Turner/, k + ' carries two whole X -> ' + called(k));
  }
});

test('the card names the syndrome ISCN names for its own fragile-site examples', () => {
  assert.match(called('45,fra(X)(q27.3)'), /Turner/, 'ISCN 5.5.7 a iii');
  assert.match(called('47,XY,fra(X)(q27.3)'), /Klinefelter/, 'ISCN 5.5.7 a iv');
  assert.doesNotMatch(called('46,Y,fra(X)(q27.3)'), /Turner|Klinefelter/,
    'ISCN 5.5.7 a ii is an ordinary male sex complement');
});

test('Turner and Klinefelter still fire for the karyotypes they were written for', () => {
  for (const k of ['45,X', '46,X,i(X)(q10)', '46,X,r(X)(p22q28)', '46,X,idic(Y)(q11.2)', '46,X,del(X)(p21)']) {
    assert.match(called(k), /Turner/, k);
  }
  // 48,XXYY is named in the Klinefelter note as a higher-grade variant, but the
  // sex-field matcher only ever listed XXY and XXXY, so the note described a
  // karyotype it could not match.
  for (const k of ['47,XXY', '48,XXXY', '48,XXYY']) assert.match(called(k), /Klinefelter/, k);
  assert.match(called('47,XYY'), /XYY/);
  assert.match(called('47,XXX'), /Triple X/);
  for (const k of ['46,XX', '46,XY', '46,XY,del(X)(p21)']) assert.equal(called(k), '', k);
});

// A euploid polyploid is not aneuploid for anything: 69,XXX was reported as Down
// syndrome, Edwards, Patau AND Triple X at once, because every matcher counted
// copies without asking how many a full set is for this clone.
test('a euploid polyploid gets no aneuploidy card', () => {
  assert.equal(called('69,XXX'), '', 'triploidy is not trisomy 21 and not Triple X');
  assert.equal(called('92,XXXX'), '', 'tetraploidy is not trisomy anything');
  assert.match(called('47,XX,+21'), /Down/, 'a real trisomy 21 still fires');
});

// ---- fragile sites (ISCN 2.6.2, 5.5.7) --------------------------------------
// fra parsed and drew from the start, so it passed the draw gate, but the decode
// row for it was the generic unknown-aberration fallback — on a karyotype whose
// only abnormality IS the fragile site.
test('a fragile site is decoded, not handed to the generic fallback', () => {
  const txt = decodeText('46,X,fra(X)(q27.3)');
  assert.doesNotMatch(txt, /as best it could/, 'not the unknown-aberration fallback');
  assert.match(txt, /fragile site/i, 'names it a fragile site');
  assert.match(txt, /Xq27\.3/, 'names the band');
  const auto = decodeText('46,XX,fra(11)(q23)');
  assert.match(auto, /fragile site/i);
  assert.match(auto, /11q23/, 'names the band on an autosome too');
});

test('the FRAXA site carries the molecular note; another fragile site does not', () => {
  const fx = Teach.syndromes(ISCN.parse('46,X,fra(X)(q27.3)').clones[0]).find((s) => /fragile X/i.test(s.name));
  assert.ok(fx, 'Xq27.3 is FRAXA');
  assert.match(fx.note, /<i>FMR1<\/i>/, 'italicizes the gene symbol like the other clinical notes');
  assert.match(fx.note, /CGG/, 'names the repeat the fragile site reflects');
  assert.match(fx.note, /molecular|repeat analysis/i, 'says where the diagnosis actually comes from');
  assert.doesNotMatch(called('46,XX,fra(11)(q23)'), /fragile X syndrome/i, 'FRA11B is not fragile X syndrome');
  assert.doesNotMatch(called('46,XX'), /fragile/i);
});

// The print sheet is the copy that ends up in a slide deck. It read clone.sex.note
// straight off the parser, which is built from the sex FIELD before any aberration
// is known, so the sheet for 46,X,fra(X)(q27.3) said "a single X (monosomy X)" while
// the decode row beside it said the opposite. One corrected reading, exported once.
test('the corrected sex reading is exported so every surface can use it', () => {
  assert.equal(typeof Teach.sexNote, 'function');
  const fra = ISCN.parse('46,X,fra(X)(q27.3)').clones[0];
  // Saying "not monosomy X" out loud is the point, so match the assertion, not the phrase.
  assert.doesNotMatch(Teach.sexNote(fra), /a single X \(monosomy X\)/, 'the second X is inside the fra');
  assert.match(Teach.sexNote(fra), /not monosomy X/, 'and names the trap directly');
  assert.match(Teach.sexNote(ISCN.parse('45,X').clones[0]), /a single X \(monosomy X\)/, '45,X genuinely is');
  // The decode row and the export must not be able to drift apart.
  const row = Teach.decode(fra).filter((r) => r.tag === 'sex')[0].text;
  assert.ok(row.indexOf(Teach.sexNote(fra)) >= 0, 'the decode row is built from the same reading');
});

// The karyogram tooltip prints Teach.stainInfo(stain).name for whatever rect the
// pointer is on. The fra gap rect now presents data-stain="fra", a pseudo-stain in
// the acen_carried tradition, so the tooltip must name the fragile site rather than
// echo the raw token back. "Unstained" is the load-bearing word: the site is an
// achromatic gap (the chromatin decondenses and fails to take up Giemsa), which is
// why the constriction is drawn paper-white even inside gpos100 Xq27.3.
test('the fra pseudo-stain names the fragile site and its unstained nature', () => {
  const info = Teach.stainInfo('fra');
  assert.match(info.name, /fragile site/i);
  assert.match(info.name + ' ' + info.bio, /unstained|achromatic/i, 'teaches why the gap is white');
  assert.match(info.bio, /attached/, 'and that the distal fragment is not lost');
});

// "15q11.2 to where?" (Dan, 2026-08-28). The isodicentric decode named the breakpoint
// and then said the chromosome "is duplicated as a mirror image", which never said
// which piece was duplicated, in what orientation, or what it cost. One breakpoint IS
// the whole story, but only because a convention fills in the rest, and the decode has
// to state that convention rather than assume it.
//
// The retained piece is the centric one, and ISCN's detailed forms are where that is
// visible: 46,X,idic(Y)(pter→q12::q12→pter) for a break on the long arm and
// 46,XX,idic(17)(qter→p11.2::p11.2→qter) for one on the short arm (5.5.4 f vi,
// 5.5.11 iv). Asserted as segment endpoints rather than as the verbatim detailed
// string, because the decode explains the notation instead of reprinting it.
test('an isodicentric decode names the retained segment, from the right telomere', () => {
  const q = decodeText('46,XX,idic(15)(q11.2)');
  assert.match(q, /15pter→15q11\.2/, 'a break on q keeps the short arm side, so it starts at pter');
  assert.match(q, /15q11\.2→15qter/, 'and names what is past the break');
  // 5.5.11 iv is the case that catches a hard-coded "pter": the break is on p, so the
  // retained piece runs from qter.
  const p = decodeText('46,XX,idic(17)(p11.2)');
  assert.match(p, /17qter→17p11\.2/, 'a break on p keeps the long arm side, so it starts at qter');
  assert.match(p, /17p11\.2→17pter/);
  assert.doesNotMatch(p, /17pter→17p11\.2/, 'and never runs pter to a p band');
});

test('an isodicentric decode says the copies are mirrored, not tandem', () => {
  const t = decodeText('46,XX,idic(15)(q11.2)');
  assert.match(t, /mirror images/, 'the orientation is stated');
  assert.match(t, /rather than one behind the other/, 'and contrasted with a tandem duplication');
  assert.match(t, /each brings its own centromere/, 'which is why there are two centromeres');
});

// The plus sign changes the arithmetic completely, and ISCN prints both cases: without
// it the idic replaces a homologue and the count is unchanged (5.5.4 b), with it the
// idic is supernumerary on top of an intact pair (5.5.4 f viii, "two chromosomes 13
// plus the idic(13)"). That second case is the tetrasomy that makes +idic(15) the
// chromosome it is, and saying "it replaces one copy" there would be flatly wrong.
test('the plus sign decides whether an isodicentric costs anything', () => {
  const replacing = decodeText('46,XX,idic(15)(q11.2)');
  assert.match(replacing, /replaces one copy of chromosome 15/);
  assert.match(replacing, /trading everything past the break/, 'so it is a swap, not a pure gain');

  const extra = decodeText('47,XX,+idic(15)(q13)');
  assert.match(extra, /supernumerary/);
  assert.match(extra, /nothing is lost/, 'an extra chromosome takes nothing away');
  assert.doesNotMatch(extra, /replaces one copy/, 'and does not replace a homologue');
});

// Copy TOTALS are deliberately absent. "Three copies" is right for an autosome and
// wrong for 46,X,idic(Y)(q12), where there is no second Y to count against, which is
// presumably why ISCN words its own statement for that example as gain and loss:
// "loss of the segment Yq12 to Yqter and gain of Ypter to Yq12" (5.5.4 f vi).
test('the isodicentric decode states gain and loss, never a copy total', () => {
  const y = decodeText('46,X,idic(Y)(q12)');
  assert.match(y, /Ypter→Yq12/);
  assert.match(y, /Yq12→Yqter/);
  assert.doesNotMatch(y, /three copies|trisomy|tetrasomy/i,
    'there is no second Y to count against, so no total is claimed');
});

// The same gap on the two-chromosome form: naming both breakpoints never said which
// side of each survives. ISCN states the consequence for this exact karyotype (5.5.4
// f ii): "loss of the segments distal to 13q22 and 15q24".
test('a dicentric of two chromosomes names what each keeps and what is lost', () => {
  const t = decodeText('45,XX,dic(13;15)(q22;q24)');
  assert.match(t, /13pter→13q22/);
  assert.match(t, /15pter→15q24/);
  assert.match(t, /13q22→13qter/);
  assert.match(t, /15q24→15qter/);
  assert.match(t, /is lost/);
  // A break on a short arm keeps the long arm side here too (ISCN 5.5.4 f iv).
  const acro = decodeText('45,XY,dic(14;21)(p11.2;p11.2)');
  assert.match(acro, /14qter→14p11\.2/);
  assert.match(acro, /21qter→21p11\.2/);
});

// dic(15;15) names ONE chromosome twice, because the partners are the two homologues
// of a pair: ISCN 5.5.4 f i calls them "the two homologous chromosomes 13", and f ix
// spells out why the number is repeated. Reading the list straight out produced
// "chromosomes 15 and 15 break (at 15q12 and 15q12)" and then said everything twice.
test('a dicentric of two homologues is not described as two chromosomes', () => {
  const same = decodeText('47,XY,+dic(15;15)(q12;q12)');
  assert.doesNotMatch(same, /chromosomes 15 and 15/, 'a pair is not two different chromosomes');
  assert.match(same, /both homologues of chromosome 15 break at 15q12/);
  assert.equal(same.match(/15pter→15q12/g).length, 1, 'and the identical segment is named once');

  // Different breakpoints on the two homologues is ISCN 5.5.4 f i verbatim, and there
  // the two retained pieces really are different, so both must be named.
  const split = decodeText('45,XX,dic(13;13)(q14;q32)');
  assert.match(split, /the two homologues of chromosome 13/);
  assert.match(split, /13pter→13q14/);
  assert.match(split, /13pter→13q32/);
});

// A breakpoint written at the centromere (p10, q10, cen) does not split the chromosome
// into a centric and an acentric piece, so there is no "past the break" to name. Those
// are whole-arm fusions and are described as such; the segment sentence must stay off
// rather than invent an endpoint.
test('a centromeric breakpoint gets no distal-segment claim', () => {
  const t = decodeText('45,XY,dic(13;14)(q10;q10)');
  assert.doesNotMatch(t, /→13qter|→14qter/, 'nothing is distal to a break at the centromere');
  assert.match(t, /two centromeres/, 'but it is still a dicentric');
});

// The convention has to be NAMED, not just applied. A single breakpoint describes a
// whole isodicentric only because the piece that survives is the one carrying the
// centromere, and a reader who does not already know that cannot get from
// "idic(15)(q11.2)" to a segment at all. ISCN 5.5.3 a states the naming half ("the
// abbreviation always refers to chromosome(s) with the intact centromere"); the reason
// is cytogenetic rather than notational, and Gardner 5e gives it: "An acentric
// chromosome is never viable, since it lacks a point of attachment to the spindle
// fibers."
test('the isodicentric decode states the rule it is applying, not only the result', () => {
  const t = decodeText('46,XX,idic(15)(q11.2)');
  assert.match(t, /piece carrying the centromere/, 'the rule is named');
  assert.match(t, /spindle/, 'and the reason a fragment without one does not survive');
});

// The same rule governs a translocation, which is the half that reads as a paradox: a
// t looks like it moves material away and an idic like it keeps material, so the two
// invite being read as opposites. They are not. Each derivative of a t keeps its OWN
// centric piece and receives the partner's acentric tip, which is exactly why ISCN
// names it der(9) and der(22). Only the fate of the acentric tip differs between the
// two: swapped in a translocation, dropped in an isodicentric.
test('the translocation decode says the swapped pieces are the acentric tips', () => {
  const t = decodeText('46,XY,t(9;22)(q34;q11.2)');
  assert.match(t, /carry no centromere/, 'what moves is the centromere-free material');
  assert.match(t, /keeps the centromere it started with/, 'what stays is the centric piece');
  assert.match(t, /named for/, 'which is what the der() name records');
});

// Both decodes have to be making the SAME claim about which piece survives, because
// the whole point of stating it twice is that a reader meeting one after the other
// draws the right parallel. If a future edit rewords one of them into "the piece that
// moves keeps the centromere", or drops the centromere from one side, this fails.
test('the isodicentric and translocation decodes agree on which piece survives', () => {
  const idic = decodeText('46,XX,idic(15)(q11.2)');
  const t = decodeText('46,XY,t(9;22)(q34;q11.2)');
  [idic, t].forEach((text, i) => {
    assert.match(text, /centromere/, `decode ${i} mentions the centromere at all`);
    assert.doesNotMatch(text, /without a centromere[^.]{0,40}survives|acentric piece is kept/i,
      `decode ${i} never says an acentric piece is the one retained`);
  });
  // The idic keeps a piece running from a telomere to the breakpoint; the t keeps its
  // own centromere and gains a tip. Neither may describe the centromere as moving.
  assert.doesNotMatch(t, /swap.{0,30}centromere/i, 'centromeres are not what a translocation swaps');
});

// The standing explainer carries the rule once, in full, because it is cross-cutting:
// it is why one breakpoint describes an isodicentric AND why a translocation swaps
// tips. The per-aberration decodes state it compactly; this is where it is spelled out.
test('the centromere anatomy copy explains what survives a rearrangement', () => {
  const copy = Teach.ARM_INFO.centromere;
  assert.match(copy, /spindle/);
  assert.match(copy, /lost/, 'an acentric fragment is lost');
  assert.match(copy, /named for it/, 'and the surviving piece is what the name records');
  assert.match(copy, /isodicentric/, 'the rule is tied back to the two cases it explains');
  assert.match(copy, /translocation/);
});

// #223 taught the RENDERER to keep every join in a der() chain. The prose did not
// follow: it described the first join and stopped, so the decode for
// der(1)t(1;3)(p32;q21)t(1;11)(q25;q13) never mentioned chromosome 11 while the figure
// beside it drew chromosome 11 in its own colour. A decode that omits a whole
// chromosome the picture shows is the two contradicting each other, which is the one
// thing this app cannot afford.
//
// A chain is described as its joins, band to band, because that is what the notation
// states and it holds for both shapes: a second join on the derivative's own chromosome
// and a second join on the graft. "The end of chromosome 3's long arm" would be wrong
// in the second, where the chromosome 3 piece is bounded at both ends.
test('a der() chain decode names every join and every chromosome on it', () => {
  const both = decodeText('46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)');
  assert.match(both, /built from two joins/);
  assert.match(both, /1p32 to 3q21/);
  assert.match(both, /1q25 to 11q13/, 'the join the prose used to drop');
  assert.match(both, /chromosomes 1, 3, and 11/, 'and every chromosome it carries');

  // The second join lands on the graft, not on chromosome 1.
  const onGraft = decodeText('46,XY,der(1)t(1;3)(p32;q21)t(3;7)(q28;q11.2)');
  assert.match(onGraft, /3q28 to 7q11\.2/);
  assert.match(onGraft, /chromosomes 1, 3, and 7/);
});

test('a single-join derivative keeps the description it had', () => {
  // The regression guard: one join is the overwhelmingly common case and its wording
  // is unchanged.
  const one = decodeText('46,XX,der(1)t(1;3)(p22;q13.1)');
  assert.match(one, /This is chromosome 1 \(out to 1p22\)/);
  assert.ok(!/built from/.test(one), 'no chain wording for a single join');
});

// The lone-derivative note states one gain and one loss and reads as the WHOLE
// imbalance, so it may only be said when that is true. On a chain it was flatly wrong:
// it announced partial trisomy for 3q21->3qter and partial monosomy for 1p32->1pter
// while ignoring both the 1q25->1qter that is also missing and the chromosome 11 that
// is also present. A confident dosage claim missing half the imbalance is worse than
// saying nothing.
test('the imbalance claim is withheld when it would be incomplete', () => {
  const chain = decodeText('46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)');
  assert.ok(!/partial trisomy|partial monosomy/.test(chain), 'a chain gets no dosage arithmetic');

  // One level down, and live before this: a del sub-op removes material the sentence
  // never counted.
  const withDel = decodeText('46,XY,der(9)del(9)(p12)t(9;22)(q34;q11.2)');
  assert.ok(!/partial trisomy/.test(withDel), 'its own deletion is part of the imbalance too');
  assert.match(withDel, /terminal deletion at 9p12/, 'but the deletion is still described');

  // It must still fire where it is true: one join, nothing else changing dosage.
  assert.match(decodeText('46,XX,der(1)t(1;3)(p22;q13.1)'), /partial trisomy/);
  // An inversion is balanced, so it leaves the arithmetic intact.
  assert.match(decodeText('46,XX,der(9)inv(9)(p13p11)t(9;22)(q34;q11.2)'), /partial trisomy/);
});

// #226 taught the renderer that a der() named across two chromosomes and built from
// joins is dicentric, and draws it with two constrictions under a der(5;7) caption. The
// prose still opened "an abnormal derivative chromosome that has chromosome 5's
// centromere", singular, which is the words contradicting the picture beside them.
// Exactly the same shape as #224: a renderer fix leaving the decode behind.
test('a der() naming two chromosomes says it carries both centromeres', () => {
  const t = decodeText('45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)');
  assert.match(t, /centromeres of BOTH chromosome 5 and chromosome 7/);
  assert.match(t, /dicentric/);
  assert.ok(!/has chromosome 5’s centromere/.test(t), 'the singular reading is gone');
});

test('a whole-arm acrocentric fusion is explained the same however it is spelled', () => {
  // der(13;21)(q10;q10) also names two chromosomes, but the fusion is AT the
  // centromeres, so it is not the join-built dicentric of the test above and must not
  // collect that wording. What it gets instead is the Robertsonian explanation, which
  // states the nuance properly: usually dicentric, with one centromere inactivated.
  //
  // This used to depend on WHICH SPELLING was typed. The note was gated on the parser
  // setting ab.note to "Robertsonian", which only rob() does, so rob(13;14)(q10;q10)
  // was explained and der(13;14)(q10;q10), the identical biological event, got a single
  // clause. Backwards twice over: the same karyotype taught two different amounts, and
  // it was the spelling ISCN PREFERS that got less (5.5.18.3 b, "either rob or der can
  // adequately describe these whole-arm translocations, der is the preferred
  // designation"). It is keyed on the shape now.
  ['45,XX,rob(13;14)(q10;q10)', '45,XX,der(13;14)(q10;q10)', '45,XX,der(13;21)(q10;q10)']
    .forEach((k) => {
      const t = decodeText(k);
      assert.match(t, /ROBERTSONIAN translocation/, k);
      assert.match(t, /usually dicentric, with one centromere inactivated/, k);
      assert.ok(!/carries the centromeres of BOTH/.test(t), `${k}: not the join-built wording`);
    });
  // Written as der, the reader is told both spellings are legal and which ISCN prefers.
  assert.match(decodeText('45,XX,der(13;14)(q10;q10)'), /prefers the der spelling/);
  assert.ok(!/prefers the der spelling/.test(decodeText('45,XX,rob(13;14)(q10;q10)')),
    'and is not told that when they already used it');
});

test('a whole-arm fusion between non-acrocentrics is not called Robertsonian', () => {
  // ISCN 5.5.18.3 a defines rob as a whole-arm translocation of the ACROCENTRICS. A
  // der(1;3)(p10;q10) is the 5.5.18.2 whole-arm case, where real short-arm material is
  // at stake, so it must not collect the "the two short arms are lost" sentence.
  // Since 2026-08-29 it gets the full whole-arm text (composition and cost) rather
  // than the old one-liner that never mentioned chromosome 3 at all.
  //
  // Counted 45, not 46: one derivative stands in for both chromosomes. decodeText goes
  // straight to the decode and would accept either, but the app gates drawing on the
  // count, so at 46 this reads as an assertion about a figure the user never sees.
  const t = decodeText('45,XY,der(1;3)(p10;q10)');
  assert.ok(!/ROBERTSONIAN/.test(t));
  assert.match(t, /WHOLE-ARM/);
  assert.match(t, /short arm of chromosome 1 and the long arm of chromosome 3/);
});

test('a derivative naming one chromosome is unchanged', () => {
  assert.match(decodeText('46,XX,der(1)t(1;3)(p22;q13.1)'), /has chromosome 1’s centromere/);
});

// The join count in the der(A;B) prose comes off the notation, so it already said
// "nine joins" while the guard-capped figure was drawing one centromere (the #227
// split, at length nine instead of two). The model half of the agreement is pinned
// in detailed-form.test.js; this half pins that the prose scales with the chain.
test('a nine-join der(5;7) is still decoded as the dicentric it draws', () => {
  const t = decodeText('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)'
    + 't(12;14)(q24;q11.2)t(14;16)(q31;q11.2)t(16;18)(q22;q11.2)t(2;18)(q21;q21)'
    + 't(2;4)(q31;q21)t(4;7)(q31;p13)');
  assert.match(t, /centromeres of BOTH chromosome 5 and chromosome 7/);
  assert.match(t, /dicentric/);
  assert.match(t, /nine joins/);
  assert.match(t, /chromosomes 2, 3, 4, 5, 7, 11, 12, 14, 16, and 18/);
});

// The whole-arm der(A;B) with sub-ops used to collect the wrong prose on both
// sides of the fork: the Robertsonian text ignored the sub-ops entirely, and the
// general der text read "chromosome 7 (out to 7q34)" off a join whose band is on
// chromosome NINE, the monocentric misreading the renderer no longer draws.
test('a whole-arm der(A;B) with sub-ops decodes the body and each arm change', () => {
  const a = decodeText('45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
  assert.match(a, /two long arms of chromosome 8/);
  assert.match(a, /cut at 8q24\.1/);
  assert.match(a, /terminal deletion at 8q22/);
  assert.ok(!/out to 8q24\.1/.test(a), 'the monocentric misreading is gone');
  const b = decodeText('45,XX,der(7;9)(q10;q10)t(9;22)(q34;q11.2)');
  assert.match(b, /long arm of chromosome 7 and the long arm of chromosome 9/);
  assert.match(b, /chromosome 9 arm is cut at 9q34/);
  assert.match(b, /22q11\.2→qter/);
  const c = decodeText('45,XX,der(13;14)(q10;q10)t(9;14)(q22;q24)');
  assert.match(c, /ROBERTSONIAN translocation with more on it/);
  assert.match(c, /9q22→qter/);
  // The bare Robertsonian keeps its own fuller text, spelling note included.
  assert.match(decodeText('45,XX,der(13;14)(q10;q10)'), /written lowest-number-first/);
});

// The copy-number parentheticals were canned diploid slogans computed per token:
// "three copies = trisomy 1" beside a triploid figure drawing five, "one copy =
// monosomy Y" for a male losing his only Y, "trisomy X" for an XY cell gaining a
// second X. The gloss now states the count the FIGURE draws (from the clone's own
// slots), names trisomy/tetrasomy only when that is what the drawn count is, and
// points at derivatives carrying more material of the chromosome. Found by the
// 2026-08-28 agent review; the words and the picture must move together.
test('copy-number glosses state the drawn count, not a diploid slogan', () => {
  const t81 = decodeText('81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21');
  assert.ok(!/three copies = trisomy 1/.test(t81), 'no diploid slogan on a triploid clone');
  assert.match(t81, /baseline of three/);
  const rows81 = decodeRows('81<3n>,XXX,+X,+X,+X,+X,+X,+1,+1,+3,+3,+14,+14,+14,-15,+21');
  assert.match(rows81.find((r) => r.tag === 'count').text, /69/, 'the count row explains the triploid baseline');
  const y = decodeText('45,X,-Y,+1,der(1;7)(q10;p10),t(5;10)(p15;q24)');
  assert.ok(!/one copy = monosomy Y/.test(y));
  assert.match(y, /no copy of Y remains/);
  assert.match(y, /der\(1;7\)/, 'the +1 gloss points at the derivative carrying 1 material');
  assert.ok(!/three copies = trisomy 1/.test(y));
  const hyper = decodeText('58<2n>,XY,+X,+4,+6,+8,+9,+10,+14,+14,+17,+18,+21,+21');
  assert.ok(!/trisomy X/.test(hyper), 'an XY cell gaining an X is not trisomy X');
  assert.match(hyper, /four copies = tetrasomy 14/);
  // The classic diploid readings are untouched.
  assert.match(decodeText('47,XX,+21'), /three copies = trisomy 21/);
  assert.match(decodeText('45,XX,-7'), /one copy = monosomy 7/);
});

test('the whole-arm derivative decode states what the fusion costs', () => {
  const wa = decodeText('45,XX,der(7;9)(q10;q10)t(9;22)(q34;q11.2)');
  assert.match(wa, /7p and 9p/, 'the lost arms are named');
});

// Dosage was computed per derivative in isolation: der(11)t(11;14) claimed
// 14q32->qter "present in three copies" while der(8)t(8;14) carries the same
// distal 14 material, so the figure draws it four times. When the partner rides
// more than one rearranged chromosome the numeric claim is withheld.
test('dosage claims are withheld when the partner rides more than one derivative', () => {
  const dd = decodeText('46,XY,der(8)t(8;14)(q21.2;q13),der(11)t(11;14)(q13;q32)');
  assert.ok(!/is present in three copies/.test(dd));
  assert.match(dd, /more than one derivative/);
  // A single-derivative karyotype keeps its numeric dosage teaching.
  assert.match(decodeText('46,XX,der(1)t(1;3)(p22;q13.1)'), /partial trisomy/);
});

test('one cell is one cell', () => {
  const rows = decodeRows('46,XX,t(9;22)(q34;q11.2)[1]');
  assert.match(rows.find((r) => r.tag === 'cells').text, /1 cell\b/);
  assert.ok(!/1 cells/.test(rows.find((r) => r.tag === 'cells').text));
});

// The lone-derivative note ended with "The usual origin is a parent who carries
// the balanced t", constitutional counseling pasted into acquired clones: a
// t(9;22) stemline evolving a der(16) is clonal evolution, not inheritance.
test('the parent-carrier origin stays out of acquired clones', () => {
  const m = ISCN.parse('46,XX,t(9;22)(q34;q11.2)[7]/46,sl,der(16)t(1;16)(q21;q22)[7]');
  const sub = Teach.decode(m.clones[1], m.clones).map((r) => r.text).join(' ');
  assert.ok(!/parent who carries/.test(sub), 'no inheritance story inside a stemline subclone');
  assert.match(decodeText('46,XX,der(1)t(1;3)(p22;q13.1)'), /parent who carries/,
    'the constitutional case keeps its counseling');
});

// The second-pass review (2026-08-29) found the whole-arm decode branch gated
// on sub-ops being present, so the BARE non-acrocentric whole-arm der fell to a
// generic one-liner that never mentioned the second chromosome the figure
// paints: 45,X,-Y,+1,der(1;7)(q10;p10) read as "has chromosome 1's centromere"
// with nothing about chromosome 7, the fusion, or the cost.
test('a bare non-acrocentric whole-arm der decodes its composition and its cost', () => {
  const t = decodeText('45,XX,der(1;7)(q10;p10)');
  assert.match(t, /WHOLE-ARM/i);
  assert.match(t, /chromosome 7/, 'the second chromosome the figure paints');
  assert.match(t, /fused at the centromere/);
  assert.match(t, /partially monosomic .*\(1p and 7q\)/, 'the lost arms, stated outright');
});
test('the bare Robertsonian keeps its own sentence, not the with-more-on-it one', () => {
  const t = decodeText('45,XX,der(13;21)(q10;q10)');
  assert.match(t, /ROBERTSONIAN/i);
  assert.ok(!/more on it/.test(t), 'nothing more is on it');
});

// Same review pass: the sex-field hedge fired only when the rearranged element
// was an X. Beside a Y-derived rearrangement (idic(Y), r(Y)) the lone X was
// still glossed "a single X (monosomy X)" under a figure drawing the abnormal Y
// in the second sex slot.
test('a lone X beside a Y-derived rearrangement is not called monosomy X', () => {
  for (const k of ['46,X,idic(Y)(q11.2)', '46,X,r(Y)(p11.2q12)']) {
    const rows = decodeRows(k);
    const sex = rows.find((r) => r.tag === 'sex').text;
    assert.match(sex, /not monosomy X/, k + ': ' + sex);
    assert.ok(!/single X \(monosomy X\)/.test(sex), k);
  }
  const turner = decodeRows('45,X').find((r) => r.tag === 'sex').text;
  assert.ok(!/not monosomy X/.test(turner), 'true monosomy X keeps its reading');
});
