// Short-system / detailed-system pairs printed side by side in ISCN 2024
// (Cytogenet Genome Res 2024;164(suppl 1):1-224), where the standard gives the same
// karyotype both ways, joined by the word "or".
//
// The detailed system (5.4.2.2) states the band composition of the chromosome that came
// out: ":" is a break, "::" a break and reunion, and the arrow means "from - to"
// (5.4.2.2 c; both the arrow and the double colon are in ISCN's symbol list). Because it
// names every retained segment and its orientation, it is the unambiguous statement of
// what a karyotype IS, which makes it the natural oracle for what this app DRAWS:
// Karyo.detailedForm serialises the very segment list the figure is drawn from, so if it
// disagrees with the string ISCN printed for the same karyotype, one of them is wrong
// and it is not the standard.
//
// It earned that on the day it was written, catching a graft drawn end-for-end (#220)
// and an isodicentric fused at the wrong end.
//
// Extracted mechanically rather than transcribed, after test/iscn-2024-examples.js was
// found to have a hand-transcription gap (#190): every pair was checked to appear
// verbatim in the source with whitespace removed, which is why the strings carry no
// spaces. The source PDF is not in this repo.
//
// `generated: true` means every abnormal chromosome the app builds for that karyotype
// serialises to exactly the substring ISCN printed. `false` carries `needs`, the reason,
// in the tradition of iscn-2024-examples.js: a gap here is a coverage gap, not a
// judgment, and the test asserts the false ones still fail so that closing one has to be
// a deliberate act rather than a silent drift.
module.exports = [
  {
    short: "46,XX,add(19)(p13.3)",
    detailed: "46,XX,add(19)(?::p13.3→qter)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XY,add(12)(q13)",
    detailed: "46,XY,add(12)(pter→q13::?)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XX,der(5)add(5)(p15.3)add(5)(q23)",
    detailed: "46,XX,der(5)(?::p15.3→q23::?)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XX,der(5)ins(5;?)(q13;?)",
    detailed: "46,XX,der(5)(pter→q13::?::q13→qter)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XX,del(5)(q13)",
    detailed: "46,XX,del(5)(pter→q13:)",
    generated: true,
  },
  {
    short: "46,XX,del(4)(p15.2)",
    detailed: "46,XX,del(4)(:p15.2→qter)",
    generated: true,
  },
  {
    short: "46,XX,del(5)(q13q33)[20]",
    detailed: "46,XX,del(5)(pter→q13::q33→qter)[20]",
    generated: true,
  },
  {
    short: "46,XX,del(5)(q13q13)",
    detailed: "46,XX,del(5)(pter→q13::q13→qter)",
    generated: false,
    needs: "breakpoints written in the reverse or degenerate order",
  },
  {
    short: "46,XY,der(9)del(9)(p12)del(9)(q31)",
    detailed: "46,XY,der(9)(:p12→q31:)",
    generated: true,
  },
  {
    short: "46,XY,der(9)inv(9)(p23p13)del(9)(q22q33)",
    detailed: "46,XY,der(9)(pter→p23::p13→p23::p13→q22::q33→qter)",
    generated: true,
  },
  {
    short: "46,Y,der(X)t(X;8)(p22.3;q24.1)",
    detailed: "46,Y,der(X)(8qter→8q24.1::Xp22.3→Xqter)",
    generated: true,
  },
  {
    short: "46,XX,der(1)t(1;3)(p22;q13.1)",
    detailed: "46,XX,der(1)(3qter→3q13.1::1p22→1qter)",
    generated: true,
  },
  {
    short: "46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)",
    detailed: "46,XX,der(1)(3qter→3q21::1p32→1q25::11q13→11qter)",
    generated: false,
    needs: "a der() chain with more than one t sub-op keeps only the first join, so the derivative is missing a grafted piece",
  },
  {
    short: "46,XY,der(1)t(1;3)(p32;q21)t(3;7)(q28;q11.2)",
    detailed: "46,XY,der(1)(7qter→7q11.2::3q28→3q21::1p32→1qter)",
    generated: false,
    needs: "a der() chain with more than one t sub-op keeps only the first join, so the derivative is missing a grafted piece",
  },
  {
    short: "46,XY,der(1)t(1;3)(p32;q21)dup(1)(q25q42)",
    detailed: "46,XY,der(1)(3qter→3q21::1p32→1q42::1q25→1qter)",
    generated: true,
  },
  {
    short: "46,XY,der(9)del(9)(p12)t(9;13)(q34;q11)",
    detailed: "46,XY,der(9)(:9p12→9q34::13q11→13qter)",
    generated: true,
  },
  {
    short: "46,XX,der(1)t(1;11)(p32;q13)t(1;3)(q25;q21)",
    detailed: "46,XX,der(1)(11qter→11q13::1p32→1q25::3q21→3qter)",
    generated: false,
    needs: "a der() chain with more than one t sub-op keeps only the first join, so the derivative is missing a grafted piece",
  },
  {
    short: "47,XY,+der(8)r(8;17;1)(p23q13;q12q25;p36.3p32)",
    detailed: "47,XY,+der(8)(::8p23→8q13::17q12→17q25::1p36.3→1p32::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,der(1)del(1)(p34p22)ins(1;17)(p34;q25q11.2)",
    detailed: "46,XX,der(1)(1pter→1p34::17q25→17q11.2::1p22→1qter)",
    generated: true,
  },
  {
    short: "46,XY,der(7)ins(7;?)(q22;?)t(2;7)(q21;q22)",
    detailed: "46,XY,der(7)(7pter→7q22::?::2q21→2qter)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XX,der(8)t(8;17)(p23;q21)inv(8)(p22q13)t(8;22)(q22;q12)",
    detailed: "46,XX,der(8)(17qter→17q21::8p23→8p22::8q13→8p22::8q13→8q22::22q12→22qter)",
    generated: false,
    needs: "a der() chain with more than one t sub-op keeps only the first join, so the derivative is missing a grafted piece",
  },
  {
    short: "46,XY,der(5)t(5;11)(p10;p10)t(5;8)(q31;q23),der(8)t(5;8),der(11)t(5;11)",
    detailed: "\u000746,XY,der(5)(11pter→11p10::5p10→5q31::8q23→8qter),der(8)(8pter→8q23::5q31→5qter),",
    generated: false,
    needs: "a der() chain with more than one t sub-op keeps only the first join, so the derivative is missing a grafted piece",
  },
  {
    short: "46,XX,ider(22)(q10)t(9;22)(q34;q11.2)[20]",
    detailed: "46,XX,ider(22)(9qter→9q34::22q11.2→22q10::22q10→22q11.2::9q34→9qter)[20]",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XY,ider(9)(p10)ins(9;12)(p13;q22q13)[12]",
    detailed: "\u000746,XY,ider(9)(9pter→9p13::12q22→12q13::9p13→9p10::9p10→9p13::12q13→12q22::9p13→9pter)[12]",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "45,XX,der(5;7)t(5;7)(q22;p13)t(3;7)(q21;q21)",
    detailed: "45,XX,der(5;7)(5pter→5q22::7p13→7q21::3q21→3qter)",
    generated: false,
    needs: "a der() named across two chromosomes with t sub-ops is modelled as a der of the first one, so the fused body is described under the wrong name",
  },
  {
    short: "45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)",
    detailed: "45,XY,der(5;7)(5pter→5q22::3q21→3q29::7p13→7qter)",
    generated: false,
    needs: "a der() named across two chromosomes with t sub-ops is modelled as a der of the first one, so the fused body is described under the wrong name",
  },
  {
    short: "45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)del(7)(q32)",
    detailed: "45,XY,der(5;7)(5pter→5q22::3q21→3q29::7p13→7q32:)",
    generated: false,
    needs: "a der() named across two chromosomes with t sub-ops is modelled as a der of the first one, so the fused body is described under the wrong name",
  },
  {
    short: "45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)",
    detailed: "45,XX,der(8;8)(:8q22→8q10::8q10→8q24.1::9q12→9qter)",
    generated: false,
    needs: "a der() named across two chromosomes with t sub-ops is modelled as a der of the first one, so the fused body is described under the wrong name",
  },
  {
    short: "47,XY,+der(?)t(?;9)(?;q22)",
    detailed: "47,XY,+der(?)(?→cen→?::9q22→9qter)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "47,XX,+der(?)t(?;9)(?;p13)ins(?;7)(?;q11.2q32)[20]",
    detailed: "47,XX,+der(?)(9pter→9p13::?→cen→?::7q11.2→7q32::?)[20]",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "47,XX,+der(?)t(?;9)(?;p13)hsr(?)[20]",
    detailed: "47,XX,+der(?)(9pter→9p13::?→cen→?::hsr→?)[20]",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "47,XY,+der(8)ins(8;?)(p22;?)t(8;9)(q24;q22)[10]",
    detailed: "47,XY,+der(8)(8pter→8p22::?::8p22→8q24::9q22→9qter)[10]",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,XX,der(1)t(1;1)(p31;q32)",
    detailed: "46,XX,der(1)(1pter→1q32::1p31→1pter)",
    generated: false,
    needs: "a t between two homologues of one chromosome",
  },
  {
    short: "46,XX,der(1)t(1;1)(p31;q32)",
    detailed: "46,XX,der(1)(1qter→1q32::1p31→1qter)",
    generated: false,
    needs: "a t between two homologues of one chromosome",
  },
  {
    short: "47,XY,der(9)t(9;22)(q34;q11.2),+22,ider(22)(q10)t(9;22)[20]",
    detailed: "\u000747,XY,der(9)(9pter→9q34::22q11.2→22qter),+22,ider(22)(9qter→9q34::22q11.2→22q10::22q10→22q11.2::9q34→9qter)[20]",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "45,XX,dic(13;13)(q14;q32)",
    detailed: "45,XX,dic(13;13)(13pter→13q14::13q32→13pter)",
    generated: true,
  },
  {
    short: "45,XX,dic(13;15)(q22;q24)",
    detailed: "45,XX,dic(13;15)(13pter→13q22::15q24→15pter)",
    generated: true,
  },
  {
    short: "45,XY,dic(14;21)(p11.2;p11.2)",
    detailed: "45,XY,dic(14;21)(14qter→14p11.2::21p11.2→21qter)",
    generated: true,
  },
  {
    short: "47,XY,+dic(17;?)(q22;?)",
    detailed: "47,XY,+dic(17;?)(17pter→17q22::?)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "46,X,idic(Y)(q12)",
    detailed: "46,X,idic(Y)(pter→q12::q12→pter)",
    generated: true,
  },
  {
    short: "46,XX,idic(21)(q22.3)",
    detailed: "46,XX,idic(21)(pter→q22.3::q22.3→pter)",
    generated: true,
  },
  {
    short: "47,XX,+idic(13)(q22)",
    detailed: "47,XX,+idic(13)(pter→q22::q22→pter)",
    generated: true,
  },
  {
    short: "47,XY,+dic(15;15)(q12;q12)",
    detailed: "47,XY,+dic(15;15)(15pter→15q12::15q12→15pter)",
    generated: true,
  },
  {
    short: "45,XX,psudic(15;13)(q12;q12)",
    detailed: "45,XX,psudic(15;13)(15pter→15q12::13q12→13pter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,psuidic(20)(q11.2)",
    detailed: "46,XX,psuidic(20)(pter→q11.2::q11.2→pter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,dup(1)(p34p31)",
    detailed: "46,XX,dup(1)(pter→p31::p34→qter)",
    generated: true,
  },
  {
    short: "46,XX,dup(1)(p31p34)",
    detailed: "46,XX,dup(1)(pter→p31::p31→p34::p31→qter)ordup(1)(pter→p34::p31→p34::p34→qter)",
    generated: true,
  },
  {
    short: "46,XX,dup(1)(q22q25)",
    detailed: "46,XX,dup(1)(pter→q25::q22→qter)",
    generated: true,
  },
  {
    short: "46,XY,dup(1)(q25q22)",
    detailed: "46,XY,dup(1)(pter→q25::q25→q22::q25→qter)ordup(1)(pter→q22::q25→q22::q22→qter)",
    generated: true,
  },
  {
    short: "47,XY,–10,+fis(10)(p10),+fis(10)(q10)",
    detailed: "47,XY,–10,+fis(10)(pter→p10:),+fis(10)(:q10→qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,hsr(1)(p22)[10]",
    detailed: "46,XX,hsr(1)(pter→p22::hsr::p22→qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XY,hsr(21)(q22)[10]",
    detailed: "46,XY,hsr(21)(pter→q22::hsr::q22→qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XX,der(1)hsr(1)(p22)hsr(1)(q31)[10]",
    detailed: "46,XX,der(1)(pter→p22::hsr::p22→q31::hsr::q31→qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XY,der(1)del(1)(p33p21)hsr(1)(p33)[10]",
    detailed: "46,XY,der(1)(pter→p33::hsr::p21→qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XX,der(2)del(2)(q21q31)hsr(2)(q21)[10]",
    detailed: "46,XX,der(2)(pter→q21::hsr::q31→qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XX,der(1)ins(1;7)(q21;p21p11.2)hsr(1;7)(q21;p11.2)[10]",
    detailed: "46,XX,der(1)(1pter→1q21::7p21→7p11.2::hsr::1q21→1qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XX,der(1)ins(1;7)(q21;p11.2p21)hsr(1;7)(q21;p11.2)[10]",
    detailed: "46,XX,der(1)(1pter→1q21::hsr::7p11.2→7p21::1q21→1qter)[10]",
    generated: false,
    needs: "hsr is modelled as an overlay, not a segment, so the amplified block does not appear in the band composition (ISCN writes it inline: pter->p22::hsr::p22->qter)",
  },
  {
    short: "46,XX,ins(2)(p13q31q21)",
    detailed: "46,XX,ins(2)(pter→p13::q31→q21::p13→q21::q31→qter)",
    generated: true,
  },
  {
    short: "46,XY,ins(2)(p13q21q31)",
    detailed: "46,XY,ins(2)(pter→p13::q21→q31::p13→q21::q31→qter)",
    generated: true,
  },
  {
    short: "46,X,ins(5;X)(p14;q21q25)",
    detailed: "46,X,ins(5;X)(5pter→5p14::Xq21→Xq25::5p14→5qter;Xpter→Xq21::Xq25→Xqter)",
    generated: true,
  },
  {
    short: "46,XX,ins(5;2)(p14;q32q22)",
    detailed: "46,XX,ins(5;2)(5pter→5p14::2q32→2q22::5p14→5qter;2pter→2q22::2q32→2qter)",
    generated: true,
  },
  {
    short: "46,XY,ins(5;2)(p14;q22q32)",
    detailed: "46,XY,ins(5;2)(5pter→5p14::2q22→2q32::5p14→5qter;2pter→2q22::2q32→2qter)",
    generated: true,
  },
  {
    short: "46,XX,ins(5;2)(q31;p13p23)",
    detailed: "46,XX,ins(5;2)(5pter→5q31::2p13→2p23::5q31→5qter;2pter→2p23::2p13→2qter)",
    generated: true,
  },
  {
    short: "46,XX,ins(5;2)(q31;p23p13)",
    detailed: "46,XX,ins(5;2)(5pter→5q31::2p23→2p13::5q31→5qter;2pter→2p23::2p13→2qter)",
    generated: true,
  },
  {
    short: "46,XY,ins(5;6)(q13q23;q15q23)",
    detailed: "46,XY,ins(5;6)(5pter→5q13::6q15→6q23::5q23→5qter;6pter→6q15::5q13→5q23::6q23→6qter)",
    generated: false,
    needs: "a multi-chromosome or reciprocal insertion",
  },
  {
    short: "46,XX,ins(5;14;9)(q13q23;q24q21;p12p23)",
    detailed: "\u000746,XX,ins(5;14;9)(5pter→5q13::9p12→9p23::5q23→5qter;14pter→14q21::5q13→5q23::14q24→14qter;9pter→9p23::14q24→14q21::9p12→9qter)",
    generated: false,
    needs: "a multi-chromosome or reciprocal insertion",
  },
  {
    short: "46,XX,inv(2)(p23p13)",
    detailed: "46,XX,inv(2)(pter→p23::p13→p23::p13→qter)",
    generated: true,
  },
  {
    short: "46,XX,inv(3)(q21q26.2)",
    detailed: "46,XX,inv(3)(pter→q21::q26.2→q21::q26.2→qter)",
    generated: true,
  },
  {
    short: "46,XY,inv(3)(p13q21)",
    detailed: "46,XY,inv(3)(pter→p13::q21→p13::q21→qter)",
    generated: true,
  },
  {
    short: "46,Y,inv(X)(p21q24)",
    detailed: "46,Y,inv(X)(pter→p21::q24→p21::q24→qter)",
    generated: true,
  },
  {
    short: "46,XX,i(17)(q10)",
    detailed: "46,XX,i(17)(qter→q10::q10→qter)",
    generated: true,
  },
  {
    short: "46,X,i(X)(q10)",
    detailed: "46,X,i(X)(qter→q10::q10→qter)",
    generated: true,
  },
  {
    short: "46,XX,idic(17)(p11.2)",
    detailed: "46,XX,idic(17)(qter→p11.2::p11.2→qter)",
    generated: true,
  },
  {
    short: "47,XX,+der(3)(:q28→qter)",
    detailed: "47,XX,+neo(3)(:q28→qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "47,XX,+neo(10)(qter→q25::q25→qter)",
    detailed: "47,XX,+neo(10)(qter→q25::q25→q26→neo→q26→qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "47,XX,+neo(10)(qter→q25::q25→q26→neo→q26→qter)",
    detailed: "47,XX,+der(10)(qter→q25::q25→q26→neo→q26→qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,qdp(1)(q23q32)",
    detailed: "46,XX,qdp(1)(pter→q32::q23→q32::q23→q32::q23→qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat",
    detailed: "46,XX,rec(6)(pter→q25.2::p22.2→pter)dmat",
    generated: true,
  },
  {
    short: "46,XX,rec(21)del(21)ins(21)(p13q22.2q22.3)dpat",
    detailed: "46,XX,rec(21)(pter→q22.2::p22.3→qter)dpat",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,r(7)(p15q31)",
    detailed: "46,XX,r(7)(::p15→q31::)",
    generated: true,
  },
  {
    short: "46,XX,r(20)(p13q13.3)",
    detailed: "46,XX,r(20)(::p13→q13.3::)",
    generated: true,
  },
  {
    short: "46,XX,der(1)r(1;3)(p36.1q23;q21q27)",
    detailed: "46,XX,der(1)(::1p36.1→1q23::3q21→3q27::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,der(1)r(1;3)(p36.1q23;q27q21)",
    detailed: "46,XX,der(1)(::1p36.1→1q23::3q27→3q21::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XY,der(8)r(8;2)(p21.3q24.1;q23q33)",
    detailed: "46,XY,der(8)(::8p21.3→8q24.1::2q23→2q33::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,der(1)r(1;?)(p36.1q23;?)",
    detailed: "46,XX,der(1)(::1p36.1→1q23::?::)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "47,XX,+der(?)r(?;3;5)(?;q21q26.2;q13q33)",
    detailed: "47,XX,+der(?)(::?→cen?→?::3q21→3q26.2::5q13→5q33::)",
    generated: false,
    needs: "a \"?\" records something the laboratory did not determine (ISCN 4.2.1 k), so there is nothing to generate",
  },
  {
    short: "47,XX,+dicr(1;3)(p36.1q32;p24q26.2)",
    detailed: "47,XX,+dicr(1;3)(::1p36.1→1q32::3p24→3q26.2::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "47,XX,+trcr(1;3;12)(p36.1q32;q26.3p24;p12q23)",
    detailed: "47,XX,+trcr(1;3;12)(::1p36.1→1q32::3q26.3→3p24::12p12→12q23::)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,tas(12;13)(q24.3;q34)",
    detailed: "46,XX,tas(12;13)(12pter→12qter→13qter→13pter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,Y,tas(X;12;3)(q28;p13q24.3;q29)",
    detailed: "46,Y,tas(X;12;3)(Xpter→Xqter→12pter→12qter→3qter→3pter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,X,tas(1;X;12;7)(p36.3;q28p22.3;p13q24.3;p22)",
    detailed: "46,X,tas(1;X;12;7)(1qter→1pter→Xqter→Xpter→12pter→12qter→7pter→7qter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XY,t(2;5)(q21;q31)",
    detailed: "46,XY,t(2;5)(2pter→2q21::5q31→5qter;5pter→5q31::2q21→2qter)",
    generated: true,
  },
  {
    short: "46,XY,t(2;5)(p12;q31)",
    detailed: "46,XY,t(2;5)(5qter→5q31::2p12→2qter;5pter→5q31::2p12→2pter)",
    generated: true,
  },
  {
    short: "46,X,t(X;13)(q27;q12)",
    detailed: "46,X,t(X;13)(Xpter→Xq27::13q12→13qter;13pter→13q12::Xq27→Xqter)",
    generated: true,
  },
  {
    short: "46,t(X;Y)(q22;q11.23)",
    detailed: "46,t(X;Y)(Xpter→Xq22::Yq11.23→Yqter;Ypter→Yq11.23::Xq22→Xqter)",
    generated: true,
  },
  {
    short: "46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31)",
    detailed: "\u000746,t(X;18)(18qter→18q11.2::Xp11.2→Xqter;18pter→18q11.2::Xp11.2→Xpter),t(Y;1)(Ypter→Yq11.23::1p31→1pter;Yqter→Yq11.23::1p31→1qter)",
    generated: true,
  },
  {
    short: "46,XX,t(2;7;5)(p21;q22;q23)",
    detailed: "46,XX,t(2;7;5)(5qter→5q23::2p21→2qter;7pter→7q22::2p21→2pter;5pter→5q23::7q22→7qter)",
    generated: true,
  },
  {
    short: "46,X,t(X;22;1)(q24;q11.2;p33)",
    detailed: "\u000746,X,t(X;22;1)(Xpter→Xq24::1p33→1pter;22pter→22q11.2::Xq24→Xqter;22qter→22q11.2::1p33→1qter)",
    generated: true,
  },
  {
    short: "46,XX,t(2;7;7)(q21;q22;p13)",
    detailed: "46,XX,t(2;7;7)(2pter→2q21::7p13→7pter;7pter→7q22::2q21→2qter;7qter→7q22::7p13→7qter)",
    generated: true,
  },
  {
    short: "46,XX,t(9;22;17)(q34;q11.2;q22)[10]",
    detailed: "\u000746,XX,t(9;22;17)(9pter→9q34::17q22→17qter;22pter→22q11.2::9q34→9qter;17pter→17q22::22q11.2→22qter)[10]",
    generated: true,
  },
  {
    short: "46,Y,t(X;15;18)(p11.1;p11.1;q11.1)",
    detailed: "\u000746,Y,t(X;15;18)(18qter→18q11.1::Xp11.1→Xqter;Xpter→Xp11.1::15p11.1→15qter;18pter→18q11.1::15p11.1→15pter)",
    generated: true,
  },
  {
    short: "46,XX,t(3;9;22;21)(p13;q34;q11.2;q21)[10]",
    detailed: "\u000746,XX,t(3;9;22;21)(21qter→21q21::3p13→3qter;9pter→9q34::3p13→3pter;22pter→22q11.2::9q34→9qter;21pter→21q21::22q11.2→22qter)[10]",
    generated: true,
  },
  {
    short: "46,XX,t(3;9;9;22)(p13;q22;q34;q11.2)[10]",
    detailed: "\u000746,XX,t(3;9;9;22)(22qter→22q11.2::3p13→3qter;9pter→9q22::3p13→3pter;9pter→9q34::9q22→9qter;22pter→22q11.2::9q34→9qter)[10]",
    generated: true,
  },
  {
    short: "46,XY,t(1;3)(p10;q10)",
    detailed: "46,XY,t(1;3)(1pter→1p10::3q10→3qter;3pter→3p10::1q10→1qter)",
    generated: false,
    needs: "a whole-arm t at p10/q10 names each derivative from the breakpoint as written; ISCN names each arm from the derivative it ends up on",
  },
  {
    short: "46,XY,t(1;3)(p10;p10)",
    detailed: "46,XY,t(1;3)(1pter→1p10::3p10→3pter;1qter→1q10::3q10→3qter)",
    generated: false,
    needs: "a whole-arm t at p10/q10 names each derivative from the breakpoint as written; ISCN names each arm from the derivative it ends up on",
  },
  {
    short: "45,XX,der(1;3)(p10;q10)",
    detailed: "45,XX,der(1;3)(1pter→1p10::3q10→3qter)",
    generated: true,
  },
  {
    short: "44,XX,trc(4;12;9)(q31.2;q22p13;q34)",
    detailed: "44,XX,trc(4;12;9)(4pter→4q31.2::12q22→12p13::9q34→9pter)",
    generated: false,
    needs: "the app does not draw this karyotype yet, so there is no model to serialise",
  },
  {
    short: "46,XX,trp(1)(q21q32)",
    detailed: "46,XX,trp(1)(pter→q32::q21→q32::q21→qter)",
    generated: true,
  },
  {
    short: "46,XX,trp(1)(q32q21)",
    detailed: "46,XX,trp(1)(pter→q32::q32→q21::q21→qter)",
    generated: false,
    needs: "breakpoints written in the reverse or degenerate order",
  },
  {
    short: "46,XX,t(9;22)(q34;q11.2)[18]/45,XX,der(7;9)(q10;q10)t(9;22),der(22)t(9;22)[2]",
    detailed: "\u000746,XX,t(9;22)(q34;q11.2)[18]/45,XX,der(7;9)(7qter→7q10::9q10→9q34::22q11.2→22qter),",
    generated: false,
    needs: "a der() named across two chromosomes with t sub-ops is modelled as a der of the first one, so the fused body is described under the wrong name",
  },
];
