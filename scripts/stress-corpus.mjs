// The stress corpus: karyotypes a student actually types, correct and incorrect.
//
// Half of this list comes from board-exam practice questions and from the mistakes
// students make transcribing them; the other half is the notation KaryoDraw claims to
// support. `npm run stress` runs every entry through the real page and builds a review
// sheet (see scripts/stress-report.mjs), so this file is the single place to add a case.
//
// Fields
//   k       the karyotype exactly as it would be typed, including the mistake
//   group   review section, in the order the sections appear in the sheet
//   why     one line on what the karyotype is, for a reader who is not holding the
//           question paper — this is what makes the sheet scannable
//   expect  'draw'   valid ISCN: a karyogram must appear
//           'refuse' not valid ISCN: the app must decline and say why
//           A mismatch between this and what the app did is flagged at the top of the
//           sheet. `expect` is a claim about the NOTATION, not about the phenotype:
//           45,XY,der(21;21)(q10;q10) is a devastating karyotype and perfect ISCN.
//   watch   what to look at on this card beyond draw/refuse — the wording of the
//           message, the orientation of a derivative, whether the count pill is right
//
// A note on 'refuse' entries marked "known hole": docs/VALIDATION.md lists inputs that
// are not correct ISCN and still draw. They are in here on purpose, marked, so the sheet
// measures the gap rather than hiding it.

export const GROUPS = [
  ['email', 'From the student email (July 2026 practice questions)'],
  ['rob', 'Robertsonian and whole-arm translocations'],
  ['aneu', 'Aneuploidies and ploidy'],
  ['mosaic', 'Mosaics, clones and cell counts'],
  ['deldup', 'Deletions and duplications'],
  ['struct', 'Inversions, insertions, rings, isochromosomes, markers'],
  ['cancer', 'Acquired / cancer cytogenetics'],
  ['unusual', 'Correct ISCN, unusual spelling'],
  ['typo', 'Typing mistakes a student makes'],
  ['hole', 'Not correct ISCN, known to still draw'],
];

export const CORPUS = [
  // ---------------------------------------------------------------- email --
  // Question 1: which pregnancy has a >25% risk of an unbalanced liveborn.
  {
    k: '46,XY,der(13;14)(q10;q10) +14',
    group: 'email',
    expect: 'refuse',
    why: 'Q1 answer A exactly as the question printed it, with a space instead of a comma before +14.',
    watch: 'The student read "The number at the start says 46, but this karyotype describes 45 chromosomes" and concluded the app would not accept the answer at all. The message must point at the missing comma, not at the count, because the count is only wrong as a consequence.',
  },
  {
    k: '46,XY,der(13;14)(q10;q10),+14',
    group: 'email',
    expect: 'draw',
    why: 'Q1 answer A written correctly: a der(13;14) carrier who also has a whole extra 14. This is translocation trisomy 14, and it is the answer to the question.',
    watch: 'Three copies of 14q must be visible: the free 14, the extra free 14, and the 14q on the derivative. The count is 46 and must not be flagged.',
  },
  {
    k: '45,XX,der(14;21)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'Q1 answer B: a balanced der(14;21) carrier. Risk of an unbalanced liveborn is roughly 10-15% when the mother carries it, below the 25% the question asks for.',
    watch: 'Short arm up on the derivative. Both 14 and 21 slots must show one free homolog each plus the shared derivative.',
  },
  {
    k: '45,XY,der(21;21)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'Q1 answer C: a der(21;21). Every viable gamete carries the derivative, so 100% of liveborns have translocation Down syndrome — but the question asks about UNBALANCED offspring, and this is the distractor most students pick.',
    watch: 'Both 21 slots collapse into one derivative. Does the clinical card say anything about the 100% recurrence?',
  },
  {
    k: '45,XY,der(13;14)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'Q1 answer D: the most common Robertsonian in humans, balanced. Unbalanced liveborn risk is under 1%, since trisomy 13 conceptions are rarely liveborn and trisomy 14 is never.',
    watch: 'Same drawing as answer B but with chromosomes 13 and 14. Compare the two cards side by side.',
  },
  {
    k: '45,XY,der(13;14)(q10;q10) +14',
    group: 'email',
    expect: 'refuse',
    why: 'What the student typed to test whether +14 changed anything. She reported the drawing did not change at all, which means the +14 was silently discarded.',
    watch: 'This is the specific complaint in the email. Anything silently dropped is the worst failure mode here: the picture looked like an answer.',
  },
  // Question 2: which karyotype is most consistent with a normal phenotype.
  {
    k: '45,X',
    group: 'email',
    expect: 'draw',
    why: 'Q2 answer A: Turner syndrome. Valid notation, abnormal phenotype.',
    watch: 'One X, an empty second sex slot. The empty slot must read as a missing chromosome, not as a rendering gap.',
  },
  {
    k: '45,XX,t(13;15)(q10;q10)',
    group: 'email',
    expect: 'refuse',
    why: 'Q2 answer B as the question printed it. t() keeps both derivatives, so the count is 46, not 45.',
    watch: 'The student saw only "says 45, but describes 46". Both readings need offering: change the number to 46, or change t() to rob()/der() and keep 45. She worked this out herself in her second email, which the app should not have made her do.',
  },
  {
    k: '46,XX,t(13;15)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'Q2 answer B repaired by fixing the count. Legal ISCN, and the answer to the question: a balanced carrier with a normal phenotype.',
    watch: 'Should draw AND carry the note explaining that the fusion actually seen in people is a Robertsonian with 45 chromosomes. The note must not read as a warning: nothing here is a mistake.',
  },
  {
    k: '45,XX,der(13;15)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'Q2 answer B repaired the other way, which is what the student proposed in her second email. Also correct.',
    watch: 'Confirm the app accepts both repairs without preferring one silently.',
  },
  {
    k: '45,XX,rob(13;15)(q10;q10)',
    group: 'email',
    expect: 'draw',
    why: 'The same karyotype spelled rob(), which is what the app offers as its one-click fix.',
    watch: 'Clicking the fix on the 45,XX,t(13;15) card should land exactly here. Drawing must be identical to the der() spelling.',
  },
  {
    k: '46,X,der(X),t(X;5)(p31;p21)',
    group: 'email',
    expect: 'refuse',
    why: 'Q2 answer C exactly as printed. Xp31 and 5p21 do not exist, and der(X) and t(X;5) are written as two changes when they are one.',
    watch: 'The band message is right and the student understood it. Does anything mention that a derivative and the rearrangement that produced it are written together, der(X)t(X;5)(...), with no comma?',
  },
  {
    k: '46,X,der(X)t(X;5)(p31;p21)',
    group: 'email',
    expect: 'refuse',
    why: 'Q2 answer C with the comma removed, so only the bands are wrong.',
    watch: 'Same band message, and nothing else should now be complained about.',
  },
  {
    k: '46,X,der(X)t(X;5)(p22.1;p15.2)',
    group: 'email',
    expect: 'draw',
    why: 'Q2 answer C with real bands: an unbalanced X;5 derivative. Abnormal phenotype, which is what makes it a distractor.',
    watch: 'The derivative replaces one X. Does the drawing show 5p material attached to the X?',
  },
  {
    k: '46,XX,t(14;21)(q10;q10)+21',
    group: 'email',
    expect: 'refuse',
    why: 'Q2 answer D exactly as printed, missing the comma before +21.',
    watch: 'The message she saw named the parser, not the rule: "Only the first part was read; +21 was not understood". Confirm it now names the comma.',
  },
  {
    k: '46,XX,t(14;21)(q10;q10),+21',
    group: 'email',
    expect: 'refuse',
    why: 'Q2 answer D with the comma added. Still wrong: t() keeps both derivatives so the count is 47, and the intended karyotype is a Robertsonian.',
    watch: 'The important case. Adding the comma fixes the syntax and exposes the real error, so the second message has to be as clear as the first.',
  },
  {
    k: '46,XX,rob(14;21)(q10;q10),+21',
    group: 'email',
    expect: 'draw',
    why: 'What Q2 answer D was reaching for: translocation Down syndrome, the commonest Robertsonian result asked about on boards.',
    watch: 'Three copies of 21q. The clinical card should name Down syndrome and should distinguish this from free trisomy 21.',
  },
  {
    k: '46,XY,der(14;21)(q10;q10),+21',
    group: 'email',
    expect: 'draw',
    why: 'The same translocation Down syndrome spelled der() rather than rob().',
    watch: 'Identical drawing and identical clinical text to the rob() spelling.',
  },
  {
    k: '46,XY,del(15)(q11.2q13)',
    group: 'email',
    expect: 'draw',
    why: 'The deletion behind Q3. FISH for this was negative in that question, which is what sends the workup to methylation and UPD.',
    watch: 'Does the clinical card name both Angelman and Prader-Willi and say the phenotype depends on the parent of origin? Naming only one would be wrong.',
  },
  {
    k: '46,XX,del(15)(q11q13)',
    group: 'email',
    expect: 'draw',
    why: 'The same deletion at the band resolution most textbooks print.',
    watch: 'Should behave identically to the q11.2q13 spelling.',
  },
  {
    k: '46,XY,dup(11)(p15.5p15.4)',
    group: 'email',
    expect: 'draw',
    why: 'The 11p15 region behind Q4. Beckwith-Wiedemann is usually epigenetic and invisible on a karyotype, which is itself worth teaching.',
    watch: 'Does anything say that a normal karyotype does not exclude Beckwith-Wiedemann? If the card is silent, that is a gap rather than an error.',
  },

  // ------------------------------------------------------------------ rob --
  {
    k: '45,XX,rob(14;21)(q10;q10)',
    group: 'rob',
    expect: 'draw',
    why: 'The balanced carrier mother in every translocation Down syndrome pedigree.',
    watch: 'Short arm up. This was drawn upside down in production until PR #103. Then open the segregation panel: the left-hand label in the pachytene diagram ("rob(14;21)") is anchored outside the drawing area and its first characters are cut off. Same on every whole-arm card.',
  },
  {
    k: '45,XY,rob(13;14)(q10;q10)',
    group: 'rob',
    expect: 'draw',
    why: 'The commonest Robertsonian, rob() spelling.',
    watch: 'Compare with the der(13;14) card: same picture.',
  },
  {
    k: '46,XY,rob(13;14)(q10;q10)',
    group: 'rob',
    expect: 'refuse',
    why: 'A Robertsonian carrier has 45 chromosomes. Writing 46 contradicts the change listed.',
    watch: 'The count message should offer both readings: 45 with the rob, or 46 with something added.',
  },
  {
    k: '46,XX,rob(13;14)(q10;q10),+13',
    group: 'rob',
    expect: 'draw',
    why: 'Translocation trisomy 13, the Patau counterpart of the Down syndrome case.',
    watch: 'Three copies of 13q, count 46, no warning.',
  },
  {
    k: '45,XX,rob(21;21)(q10;q10)',
    group: 'rob',
    expect: 'draw',
    why: 'The isochromosome-like 21;21 carrier. Every conceptus is either trisomic or monosomic for 21.',
    watch: 'Both 21 slots collapse to one derivative and no free 21 remains.',
  },
  {
    k: '46,XY,rob(21;21)(q10;q10),+21',
    group: 'rob',
    expect: 'draw',
    why: 'The offspring of the previous carrier: translocation Down syndrome with a 100% recurrence risk.',
    watch: 'Three 21q. The clinical card should separate this from the 14;21 case, where recurrence is 10-15%.',
  },
  {
    k: '45,XX,der(13;21)(q10;q10)',
    group: 'rob',
    expect: 'draw',
    why: 'A less common but real acrocentric pairing.',
    watch: 'Both partners are acrocentric, so both arms drawn should be q.',
  },
  {
    k: '45,XY,der(14;15)(q10;q10)',
    group: 'rob',
    expect: 'draw',
    why: 'Two acrocentrics of near-identical size, which is where an orientation bug hides.',
    watch: 'Orientation and which chromosome the derivative is filed under.',
  },
  {
    k: '46,XX,t(11;22)(q23;q11.2)',
    group: 'rob',
    expect: 'draw',
    why: 'The one recurrent constitutional reciprocal translocation, and the standard 3:1 segregation question (Emanuel syndrome).',
    watch: 'Both derivatives drawn. Does the segregation panel offer the supernumerary der(22) conceptus?',
  },
  {
    k: '47,XX,+der(22)t(11;22)(q23;q11.2)',
    group: 'rob',
    expect: 'draw',
    why: 'Emanuel syndrome: the 3:1 product of the translocation above.',
    watch: 'A supernumerary derivative in addition to two normal 11s and two normal 22s. Count 47.',
  },

  // ----------------------------------------------------------------- aneu --
  { k: '47,XX,+21', group: 'aneu', expect: 'draw', why: 'Free trisomy 21, the reference case.', watch: 'Three 21s and nothing else disturbed.' },
  { k: '47,XY,+18', group: 'aneu', expect: 'draw', why: 'Trisomy 18, Edwards syndrome.', watch: 'Clinical card names the syndrome.' },
  { k: '47,XX,+13', group: 'aneu', expect: 'draw', why: 'Trisomy 13, Patau syndrome.', watch: 'Compare the clinical text with the translocation trisomy 13 card.' },
  { k: '47,XXY', group: 'aneu', expect: 'draw', why: 'Klinefelter syndrome.', watch: 'Three sex chromosomes in the sex slots, count 47, no warning.' },
  { k: '47,XYY', group: 'aneu', expect: 'draw', why: 'XYY.', watch: 'Two Ys drawn, not one Y and a marker.' },
  { k: '47,XXX', group: 'aneu', expect: 'draw', why: 'Trisomy X.', watch: 'Three Xs.' },
  { k: '48,XXYY', group: 'aneu', expect: 'draw', why: 'Four sex chromosomes.', watch: 'The sex slot has to hold four; this is where a fixed two-slot layout breaks.' },
  { k: '49,XXXXY', group: 'aneu', expect: 'draw', why: 'Five sex chromosomes, the extreme of the same layout problem.', watch: 'Layout and count.' },
  { k: '69,XXY', group: 'aneu', expect: 'draw', why: 'Triploidy, the partial mole karyotype.', watch: 'Three of every autosome. Does the clinical card mention partial hydatidiform mole?' },
  { k: '92,XXYY', group: 'aneu', expect: 'draw', why: 'Tetraploidy.', watch: 'Four of everything, and whether the page can lay it out.' },
  { k: '45,XX,-22', group: 'aneu', expect: 'draw', why: 'Monosomy 22, stated as a loss.', watch: 'The 22 slot should show one chromosome and a visible gap, not a silently narrowed row.' },
  { k: '47,XX,+16', group: 'aneu', expect: 'draw', why: 'Trisomy 16, the commonest trisomy in first-trimester loss.', watch: 'Nothing special; a control.' },

  // --------------------------------------------------------------- mosaic --
  { k: 'mos 47,XX,+21[12]/46,XX[18]', group: 'mosaic', expect: 'draw', why: 'Mosaic Down syndrome with the mos prefix and cell counts.', watch: 'Two clones listed, both drawn or switchable, and the cell counts echoed as written.' },
  { k: '47,XY,+21[12]/46,XY[8]', group: 'mosaic', expect: 'draw', why: 'The same without the mos prefix, which is how most reports still write it.', watch: 'Identical handling to the mos form.' },
  { k: 'mos 45,X[10]/46,XX[20]', group: 'mosaic', expect: 'draw', why: 'Mosaic Turner syndrome.', watch: 'The 45,X clone must show the empty sex slot.' },
  { k: 'mos 45,X[5]/47,XXX[3]/46,XX[12]', group: 'mosaic', expect: 'draw', why: 'Three clones, which is where a two-clone assumption shows up.', watch: 'All three clones listed in order with their counts.' },
  { k: '46,XX/46,XY', group: 'mosaic', expect: 'draw', why: 'A chimera or a specimen mix-up; either way legal notation.', watch: 'Both sex complements accepted without the app calling one of them wrong.' },
  { k: '47,XY,+8[cp10]', group: 'mosaic', expect: 'draw', why: 'A composite karyotype, cp for composite.', watch: 'cp10 must survive to the decode chip as written.' },
  { k: '48,XY,+8,inc', group: 'mosaic', expect: 'draw', why: 'An incomplete karyotype: the tally is deliberately short and this is still valid ISCN.', watch: 'Must NOT be flagged as a count mismatch. This is the case that separates countWrong from a failed tally.' },
  { k: '47~49,XY,+8', group: 'mosaic', expect: 'draw', why: 'A modal range in ISCN tilde spelling.', watch: 'The range survives to the count chip as written.' },
  { k: '47-49,XY,+8', group: 'mosaic', expect: 'draw', why: 'The same range in Mitelman dash spelling: accepted, non-canonical.', watch: 'Draws, and the note offers the tilde form. The chip must echo the dash the reader typed, not silently show a tilde.' },
  { k: '47,XY,+8[10]/48,idem,+21[5]', group: 'mosaic', expect: 'draw', why: 'A subclone written idem, standard in cancer reporting.', watch: 'The second clone must inherit +8 from the stemline and add +21, giving 48.' },
  { k: '46,XX,t(9;22)(q34;q11.2)[20]', group: 'mosaic', expect: 'draw', why: 'A single clone with a cell count.', watch: '[20] echoed, not treated as an aberration.' },

  // --------------------------------------------------------------- deldup --
  { k: '46,XX,del(5)(p15.2)', group: 'deldup', expect: 'draw', why: 'Cri du chat, terminal deletion written with one breakpoint.', watch: 'The 5p tip is missing on one homolog only.' },
  { k: '46,XY,del(4)(p16.3)', group: 'deldup', expect: 'draw', why: 'Wolf-Hirschhorn.', watch: 'Clinical card names it.' },
  { k: '46,XX,del(22)(q11.2q11.2)', group: 'deldup', expect: 'draw', why: '22q11.2 deletion syndrome, interstitial, written with two identical breakpoints.', watch: 'An interstitial gap, not a shortened chromosome. At 550 bands this deletion is submicroscopic, so the drawing is a schematic; does anything say so?' },
  { k: '46,XY,del(7)(q11.23q11.23)', group: 'deldup', expect: 'draw', why: 'Williams syndrome, also submicroscopic.', watch: 'Same question about drawing something a karyotype cannot resolve.' },
  { k: '46,XY,del(17)(p11.2p11.2)', group: 'deldup', expect: 'draw', why: 'Smith-Magenis.', watch: 'Compare with the reciprocal duplication below.' },
  { k: '46,XX,dup(17)(p11.2p11.2)', group: 'deldup', expect: 'draw', why: 'Potocki-Lupski, the reciprocal of Smith-Magenis.', watch: 'The duplicated segment must be visibly added, and the two cards must be visibly different.' },
  { k: '46,XX,del(5)(q13q33)', group: 'deldup', expect: 'draw', why: 'The 5q- of myelodysplastic syndrome, a large interstitial deletion.', watch: 'A wide interstitial gap in the middle of 5q.' },
  { k: '46,XY,del(1)(p36.3)', group: 'deldup', expect: 'draw', why: '1p36 deletion, the commonest terminal deletion syndrome.', watch: 'The deleted tip on the largest chromosome.' },
  { k: '46,XX,del(18)(q21.3)', group: 'deldup', expect: 'draw', why: '18q deletion.', watch: 'Terminal loss on a q arm rather than a p arm.' },
  { k: '46,XY,dup(1)(q21q31)', group: 'deldup', expect: 'draw', why: 'An interstitial duplication with two distinct breakpoints.', watch: 'The chromosome is longer than its homolog and the duplicated band block is visible.' },
  { k: '46,XX,del(X)(q13q26)', group: 'deldup', expect: 'draw', why: 'The X critical region deletion behind premature ovarian insufficiency.', watch: 'A deletion on a sex chromosome rather than an autosome.' },
  { k: '46,XY,del(13)(q14q14)', group: 'deldup', expect: 'draw', why: 'The retinoblastoma region.', watch: 'Interstitial deletion on an acrocentric q arm.' },

  // --------------------------------------------------------------- struct --
  { k: '46,XX,inv(9)(p12q13)', group: 'struct', expect: 'draw', why: 'The pericentric inversion of 9, a normal population variant found in about 1-3% of people.', watch: 'Does anything say this is a benign heteromorphism? Reporting it as an abnormality is the error students inherit.' },
  { k: '46,XY,inv(2)(p21q31)', group: 'struct', expect: 'draw', why: 'A pericentric inversion spanning the centromere.', watch: 'The inverted segment must cross the centromere and the band order within it must reverse.' },
  { k: '46,XX,inv(11)(q21q23)', group: 'struct', expect: 'draw', why: 'A paracentric inversion, both breakpoints on one arm.', watch: 'The centromere must stay put. Paracentric and pericentric must not look the same.' },
  { k: '46,XY,t(9;22)(q34;q11.2)', group: 'struct', expect: 'draw', why: 'The reciprocal translocation everyone knows. Typed bare it is read as the acquired CML rearrangement, so the meiotic segregation panel is deliberately suppressed: segregation is a germline event and a tumour clone does not have one.', watch: 'Two derivatives drawn and labelled der(9) and der(22). No segregation panel, on purpose — the constitutional t(2;5) card is where to review that panel.' },
  { k: '46,XX,t(4;8)(p16;p23)', group: 'struct', expect: 'draw', why: 'A recurrent translocation mediated by olfactory receptor repeats.', watch: 'Both breakpoints on short arms, which is where an arm-content bug appears.' },
  { k: '46,XX,t(2;7;5)(q21;p13;q31)', group: 'struct', expect: 'draw', why: 'A three-way translocation with the right number of breakpoints. Legal and rare.', watch: 'Three derivatives, each carrying material from the correct donor. This is the hardest drawing in the set.' },
  { k: '46,XY,ins(5;2)(p14;q22q32)', group: 'struct', expect: 'draw', why: 'An insertion: three breakpoints, one in the recipient and two bounding the inserted segment.', watch: 'The 2q22-q32 block must appear inside 5p and be missing from 2.' },
  { k: '46,X,i(X)(q10)', group: 'struct', expect: 'draw', why: 'Isochromosome Xq, a common Turner variant.', watch: 'Two identical q arms and no p arm. It must not be drawn as a normal X.' },
  { k: '45,X/46,X,i(X)(q10)', group: 'struct', expect: 'draw', why: 'The mosaic form, which is how the isochromosome usually presents.', watch: 'Both clones handled, and the second clone written with only one stated sex chromosome.' },
  { k: '46,X,idic(Y)(q11.2)', group: 'struct', expect: 'draw', why: 'An isodicentric Y, a cause of mixed gonadal dysgenesis.', watch: 'Two centromeres drawn on one chromosome. A single-centromere renderer will get this wrong.' },
  { k: '46,XX,r(13)(p11q34)', group: 'struct', expect: 'draw', why: 'A ring chromosome 13.', watch: 'Drawn as a ring, or at least visibly distinguished from a normal 13.' },
  { k: '47,XY,+mar', group: 'struct', expect: 'draw', why: 'A supernumerary marker of unknown origin.', watch: 'An extra unidentified chromosome, and text saying its origin is unknown without further testing.' },
  { k: '47,XX,+r', group: 'struct', expect: 'draw', why: 'A supernumerary ring of unknown origin. Valid ISCN, and a real finding on prenatal reports.', watch: 'The app does not recognize +r and refuses. That is a gap in coverage rather than a wrong message: +mar works, +r does not.' },
  { k: '46,XY,add(19)(p13.3)', group: 'struct', expect: 'draw', why: 'Additional material of unknown origin attached at 19p13.3.', watch: 'The added segment must be drawn as unknown, not invented from a specific donor.' },
  { k: '46,XX,fra(X)(q27.3)', group: 'struct', expect: 'draw', why: 'The cytogenetic fragile site, the historical fragile X test.', watch: 'A gap at Xq27.3. Does anything say cytogenetics has been replaced by molecular testing for this?' },
  { k: '46,XY,der(9)t(9;22)(q34;q11.2)', group: 'struct', expect: 'draw', why: 'The adjacent-1 offspring of a t(9;22) carrier: the derivative 9 replaces one normal 9, so the count stays 46 and nothing needs to be stated as lost. Unbalanced karyotype, correct notation.', watch: 'One normal 9, one der(9), and TWO normal 22s. Drawing a missing 22 here would be wrong: the count 46 is right and must not be flagged.' },
  { k: '46,XY,der(22)t(9;22)(q34;q11.2)', group: 'struct', expect: 'draw', why: 'The mirror product of the same segregation, and the karyotype of Emanuel-type unbalanced offspring in general.', watch: 'Two normal 9s and one der(22). Compare with the der(9) card: the two must be visibly different drawings.' },
  { k: '46,XX,i(21)(q10)', group: 'struct', expect: 'draw', why: 'Isochromosome 21q, indistinguishable in effect from rob(21;21).', watch: 'Compare with the rob(21;21) card and check they are not silently the same drawing under two names.' },

  // --------------------------------------------------------------- cancer --
  { k: '46,XX,t(9;22)(q34.1;q11.2)', group: 'cancer', expect: 'draw', why: 'Chronic myeloid leukemia, the Philadelphia chromosome, at sub-band resolution.', watch: 'The der(22) is the Philadelphia chromosome. Does anything name it?' },
  { k: '46,XY,t(15;17)(q24.1;q21.2)', group: 'cancer', expect: 'draw', why: 'Acute promyelocytic leukemia, the one leukemia karyotype that changes treatment the same day.', watch: 'Clinical text should reach PML-RARA and ATRA if it reaches anything.' },
  { k: '46,XX,t(8;21)(q22;q22)', group: 'cancer', expect: 'draw', why: 'Core binding factor AML, a favorable-risk finding.', watch: 'Identical band labels on both partners, which is a formatting trap.' },
  { k: '46,XY,inv(16)(p13.1q22)', group: 'cancer', expect: 'draw', why: 'The other core binding factor AML.', watch: 'A pericentric inversion in a cancer context; same drawing rules as the constitutional ones.' },
  { k: '46,XX,t(8;14)(q24.1;q32)', group: 'cancer', expect: 'draw', why: 'Burkitt lymphoma, MYC to the IGH locus.', watch: 'Nothing structural; a control for the clinical text.' },
  { k: '46,XY,t(14;18)(q32;q21)', group: 'cancer', expect: 'draw', why: 'Follicular lymphoma, BCL2 to IGH.', watch: 'Same.' },
  { k: '46,XX,t(12;21)(p13;q22)', group: 'cancer', expect: 'draw', why: 'Childhood B-ALL. Cryptic by karyotype and found only by FISH or molecular testing, which is worth saying.', watch: 'Does anything note that this is not visible on a real karyotype?' },
  { k: '45,XY,-7', group: 'cancer', expect: 'draw', why: 'Monosomy 7, an adverse-risk myeloid finding.', watch: 'The 7 slot shows a gap.' },
  { k: '45,X,-Y', group: 'cancer', expect: 'draw', why: 'Acquired loss of the Y, one of the commonest findings in myeloid disease and in age-related clonal haematopoiesis.', watch: 'Count 45, no warning. This was called a count error until the sex-field rule was read properly (ISCN 5.3.1.2): the sex field states what remains, so subtracting the loss again lands on 44.' },
  { k: '45,X,-X', group: 'cancer', expect: 'draw', why: 'Acquired loss of an X in a female, ISCN 5.3.1.2 ii.', watch: 'Count 45. The mirror of the -Y case.' },
  { k: '45,X,-Y,t(8;21)(q22;q22)', group: 'cancer', expect: 'draw', why: 'Loss of Y alongside core binding factor AML, which is how it usually turns up.', watch: 'Both changes drawn, count 45.' },
  { k: '46,XXYc,-X', group: 'cancer', expect: 'draw', why: 'ISCN 5.3.1.2 ix: acquired loss of an X in someone with Klinefelter syndrome. The c marks XXY as the constitutional complement, so here the loss DOES apply on top of it.', watch: 'Count 46, and the drawing shows XY. The c is the whole reason this counts differently from 45,X,-X.' },
  { k: '48,XXYc,+X', group: 'cancer', expect: 'draw', why: 'The gain counterpart, ISCN 5.3.1.2 viii.', watch: 'Three X and one Y, count 48.' },
  { k: '44,Xc,-X', group: 'cancer', expect: 'draw', why: 'Acquired loss of the X in someone with Turner syndrome, ISCN 5.3.1.2 iii.', watch: 'Count 44, and no sex chromosome left at all.' },
  { k: '47,XX,+8,t(9;22)(q34;q11.2)', group: 'cancer', expect: 'draw', why: 'Clonal evolution in CML: trisomy 8 on top of the Philadelphia chromosome.', watch: 'Both changes drawn, count 47, listed in ISCN order.' },
  { k: '46,XX,t(4;11)(q21;q23)', group: 'cancer', expect: 'draw', why: 'KMT2A-rearranged infant ALL.', watch: 'A control.' },
  { k: '46,XY,del(20)(q11.2q13.3)', group: 'cancer', expect: 'draw', why: 'del(20q) in myelodysplastic syndrome.', watch: 'A large interstitial deletion near a telomere.' },
  { k: '50,XY,+8,+9,+19,+21,t(9;22)(q34;q11.2)', group: 'cancer', expect: 'draw', why: 'A complex hyperdiploid clone: five changes, count 50.', watch: 'The count must add up and the layout must survive four extra chromosomes.' },

  // -------------------------------------------------------------- unusual --
  { k: '47, XX, +21', group: 'unusual', expect: 'draw', why: 'Spaces after the commas, which is what copy-paste from a Word document produces.', watch: 'Draws silently. Spaces are not an ISCN error worth a warning.' },
  { k: '47,XX,+21.', group: 'unusual', expect: 'refuse', why: 'A trailing period picked up from a sentence. Nothing legal ends in a period, so the app names it and offers the string without it.', watch: 'A judgment call worth your opinion: the reading is unambiguous, so this could equally just draw. It must at minimum not report the period as an unrecognized CHANGE, which named +21 instead of the period until PR #125.' },
  { k: '46,XY,t(9;22)(q34;q11.2)dn', group: 'unusual', expect: 'draw', why: 'The de novo qualifier, which changes the counseling completely.', watch: 'dn preserved in the decode and ideally explained.' },
  { k: '46,XX,inv(9)(p12q13)mat', group: 'unusual', expect: 'draw', why: 'The maternal-inheritance qualifier.', watch: 'mat preserved and explained.' },
  { k: '45<2n>,XY,-21', group: 'unusual', expect: 'draw', why: 'An explicit ploidy note.', watch: '<2n> must survive to the count chip; it was being dropped before.' },
  { k: '46,XX,del(5)(p15.2)[20]', group: 'unusual', expect: 'draw', why: 'A cell count on a constitutional karyotype.', watch: 'Accepted without comment.' },
  { k: '46,XY,t(2;5)(q21;q31)', group: 'unusual', expect: 'draw', why: 'A plain balanced reciprocal translocation, the segregation-panel workhorse.', watch: 'The segregation panel: alternate, adjacent-1, adjacent-2, 3:1. Spot-check that the unbalanced products are written correctly.' },

  // ----------------------------------------------------------------- typo --
  { k: '47,XX+21', group: 'typo', expect: 'refuse', why: 'No comma before +21, the single commonest typing mistake.', watch: 'The message must name the comma rule and show the corrected string.' },
  { k: '47XX,+21', group: 'typo', expect: 'refuse', why: 'No comma after the count.', watch: 'Same rule, different position. The message should be as specific.' },
  { k: '46,XX,21+', group: 'typo', expect: 'refuse', why: 'Sign written after the number instead of before it.', watch: 'The message should say the sign goes first and show +21.' },
  { k: '46,XX,+21', group: 'typo', expect: 'refuse', why: 'A gain listed but the count left at 46.', watch: 'Both readings offered: 47 with the gain, or 46 with nothing added.' },
  { k: '46,XY,-21', group: 'typo', expect: 'refuse', why: 'A loss listed but the count left at 46.', watch: 'Same, in the other direction: 45 with the loss.' },
  { k: '47,XX,+21,+21', group: 'typo', expect: 'refuse', why: 'Two gains listed, count left at 47.', watch: 'The message should point at 48.' },
  { k: '46,XX,t(9,22)(q34;q11.2)', group: 'typo', expect: 'refuse', why: 'A comma instead of a semicolon between the two chromosomes.', watch: 'The message should name the semicolon and offer the repair, because this looks correct at a glance.' },
  { k: '46,XX,t(9;22)(q34,q11.2)', group: 'typo', expect: 'refuse', why: 'The same mistake in the breakpoint group.', watch: 'Same expectation.' },
  { k: '46,XX,del(5)(p99)', group: 'typo', expect: 'refuse', why: 'A band that does not exist on chromosome 5.', watch: 'The band message should say which bands are real near there, not just that this one is not.' },
  { k: '46,XY,del(5)(zzqewdf2315.2)', group: 'typo', expect: 'refuse', why: 'Gibberish where a breakpoint goes.', watch: 'Refused without the app inventing a nearest band.' },
  { k: '46,XY,zzz(9)(q34)', group: 'typo', expect: 'refuse', why: 'An operation that does not exist.', watch: 'The message should list what the app does understand.' },
  { k: '46,XY,inv(9)(p11q13)zzz', group: 'typo', expect: 'refuse', why: 'Trailing junk after a valid change.', watch: 'The valid part must not be drawn as if the junk were absent.' },
  { k: '69.XX', group: 'typo', expect: 'refuse', why: 'A period instead of a comma between the count and the sex chromosomes. This drew 69 chromosomes with both sex slots empty and said nothing until PR #122.', watch: 'Refused, with the comma repair offered.' },
  { k: '46', group: 'typo', expect: 'refuse', why: 'A count with no sex field.', watch: 'The message should say ISCN always states the count then the sex chromosomes. It must not guess XX.' },
  { k: '46,XZY', group: 'typo', expect: 'refuse', why: 'A stray letter in the sex field.', watch: 'Refused. Silently reading it as XY is what PR #117 stopped.' },
  { k: '46,QQ', group: 'typo', expect: 'refuse', why: 'A sex field that is not a sex field.', watch: 'Same.' },
  { k: '46,xx,t(9;22)(q34;q11.2)', group: 'typo', expect: 'draw', why: 'Lowercase sex chromosomes. ISCN capitalizes them, but this is a shift-key slip and not an error of understanding.', watch: 'Should draw. Refusing this would be refusing valid intent over typography; if it refuses, say so.' },
  { k: 'hello', group: 'typo', expect: 'refuse', why: 'Not a karyotype at all, which is what an empty-state message has to handle.', watch: 'The message should show the shape of a karyotype rather than saying nothing was understood.' },
  { k: '', group: 'typo', expect: 'refuse', why: 'Empty input.', watch: 'The empty state must invite typing, not report a failure.' },
  { k: '46,XX,del(5)', group: 'typo', expect: 'refuse', why: 'A deletion with no breakpoints stated. ISCN never writes del() without saying what was deleted.', watch: 'Currently draws. Found by this sheet, not previously on the known-holes list, and it belongs to the same family: an operation drawn from breakpoints it was never given.' },
  { k: '46,XX,t(9;22)', group: 'typo', expect: 'refuse', why: 'A translocation with no breakpoint group at all, which is how an exam question written from memory usually reads.', watch: 'Currently draws. Also new, also the arity family. The breakpoints in the drawing are invented.' },
  { k: '43,XY,rob(14;21)(q10;q10),-21,-20', group: 'typo', expect: 'draw', why: 'Losses listed out of chromosome order. ISCN orders them, but the order changes only how it is written, never what is drawn.', watch: 'Draws, with a warning offering the reordered string. A refusal here would be wrong.' },

  // ----------------------------------------------------------------- hole --
  { k: '46,XY,t(9;22)(q34)', group: 'hole', expect: 'refuse', why: 'Known hole. Two chromosomes, one breakpoint. The second breakpoint is invented by the drawing.', watch: 'Currently draws. The drawn der(22) breakpoint is a guess presented as an answer.' },
  { k: '46,XY,inv(9)(p11)', group: 'hole', expect: 'refuse', why: 'Known hole. An inversion needs two breakpoints; one cannot define an inverted segment.', watch: 'Currently draws.' },
  { k: '46,XY,t(2;7;5)(q21;p13)', group: 'hole', expect: 'refuse', why: 'Known hole. Three chromosomes, two breakpoints.', watch: 'Currently draws. Compare with the correct three-way card above.' },
  { k: '46,XY,del(5)(p15.3p15.2)', group: 'unusual', expect: 'draw', why: 'Correct ISCN, and the case that proves the point of reading the standard. Breakpoints run pter to qter (Table 3, 5.5.2 b), so on the SHORT arm the distal band is written first. 4.2.1 j.iii says it in words on dup(1)(p34~32p22).', watch: 'Draws silently. For one day it drew with a warning telling the reader to reverse it, which is the opposite of the rule; the order check had been written from memory as "centromere outward", which is right on q and backwards on p.' },
  { k: '46,XY,del(5)(p15.2p15.3)', group: 'typo', expect: 'draw', why: 'The same deletion written the wrong way round: on the short arm the distal band comes first.', watch: 'Draws, with the rule and the corrected spelling. The order changes nothing about what is drawn, so it warns rather than refusing.' },
  { k: '46,XY,del(5)(q33q13)', group: 'typo', expect: 'draw', why: 'Reversed on the long arm, where pter-to-qter means the proximal band comes first.', watch: 'Same message as the p-arm case, pointing the other way. Check the two read consistently.' },
  { k: '46,XY,t(9;9)(q34;q11)', group: 'hole', expect: 'refuse', why: 'Known hole. A reciprocal translocation between the two homologs of one chromosome is not what t() describes.', watch: 'Currently draws.' },
  { k: '45,XY,rob(1;2)(q10;q10)', group: 'hole', expect: 'refuse', why: 'Known hole. A Robertsonian happens between acrocentrics; 1 and 2 are metacentric, and the fusion would not lose a negligible short arm.', watch: 'Currently draws, which teaches the opposite of the rule.' },
  { k: '46,XY,+0', group: 'hole', expect: 'refuse', why: 'Known hole. There is no chromosome 0.', watch: 'Currently draws.' },
  { k: '46,XY,del(5)(p15.2),del(5)(p15.2)', group: 'hole', expect: 'draw', why: 'The same deletion listed twice. ISCN writes del(5)(p15.2)x2 for a change on both homologs, which is exactly what listing it twice produces, so the drawing is right and the notation is not.', watch: 'Draws both deletions, with the multiplier offered. Check that the picture really is one deletion per homolog, since that is the claim the warning rests on.' },
  { k: '47,idem,+8', group: 'hole', expect: 'refuse', why: 'Known hole. idem refers to a stemline, and there is no preceding clone here.', watch: 'Currently draws, from a stemline that does not exist.' },
  { k: '46<3n>,XY', group: 'hole', expect: 'draw', why: 'The angle brackets state the ploidy level the gains and losses are expressed against, not a claim about the count. ISCN 6.3.7 f prints 81<3n> and 58<2n> as correct and says exceptions are made where biologically significant.', watch: 'Draws, with nothing said about the ploidy. A rule that refused this was added here and removed once the standard was actually read: it was checking arithmetic that ISCN does not require to hold.' },
  { k: '46c,XY', group: 'hole', expect: 'draw', why: 'c marks a change as constitutional rather than acquired, and it belongs on the change it describes, not on the count.', watch: 'Draws, with the rule stated. Refused elsewhere would be defensible; confidence in exactly where ISCN permits c is lower than for the rest of this section, and the rule is to warn rather than refuse when that is true.' },
  { k: '46,XY,t(9;22)(q34;q11.2)[0]', group: 'hole', expect: 'refuse', why: 'Known hole. Zero cells means the clone was not seen.', watch: 'Currently draws a clone that was observed in no cells.' },
  { k: '46,YX', group: 'hole', expect: 'refuse', why: 'Known hole. ISCN writes X first.', watch: 'Currently draws. Arguably a repair rather than a refusal, like the comma cases.' },
];
