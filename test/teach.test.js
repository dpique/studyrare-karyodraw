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
