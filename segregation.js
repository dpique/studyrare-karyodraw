/* KaryoDraw — meiotic segregation of a balanced translocation carrier.
 *
 * Copyright (C) 2026 StudyRare. KaryoDraw is free software: you may
 * redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License, version 3 or later; see LICENSE. If you run a modified
 * version as a network service you must offer its source to your users (AGPL
 * section 13). Commercial licensing: see LICENSING.md.
 *
 *   window.Segregation.eligible(clone) -> boolean
 *   window.Segregation.compute(clone)  -> Model | null
 *   window.Segregation.render(model)   -> HTML string (panel body)
 *
 * Given a balanced RECIPROCAL translocation carrier the parser produced, this models
 * the pachytene QUADRIVALENT and its segregation modes: 2:2 (alternate / adjacent-1 /
 * adjacent-2), 3:1 (tertiary and interchange), and 4:0. For a ROBERTSONIAN carrier it
 * models the TRIVALENT and its 2:1 segregation. A HOMOLOGOUS fusion (der(21;21)) is a
 * UNIVALENT with no balanced outcome and gets a text panel of its two gametes; the
 * trivalent must never see it, since that would claim a normal child is possible.
 * For each mode it lists the gametes, the
 * conceptus karyotype in ISCN, the resulting imbalance in plain language, and a rough
 * viability. The canonical segregants follow ISCN 2024, Table 5; interstitial crossing-over
 * adds still more 3:1 combinations (noted, not enumerated). This is a teaching visualizer of
 * segregation, not a recurrence-risk calculator. Pure logic + schematic SVG strings; no DOM.
 *
 * The four chromosomes sit at the corners of a square that mirrors the pachytene ring:
 *   NW = A(normal)   NE = der(A)   SE = B(normal)   SW = der(B)
 * Going round the ring, each edge is held together by shared (homologous) material, so
 * the three ways to divide the ring read off geometrically and give the modes their
 * names: ALTERNATE takes the two OPPOSITE corners (its spindle fibers cross), while
 * ADJACENT-1 (vertical cut) and ADJACENT-2 (horizontal cut) each take two NEIGHBORS.
 */
(function () {
  "use strict";

  // Figure-level colors, by chromosome of origin (mirror the renderer's encodings:
  // periwinkle "field", amber "signal"). Not UI chrome, so kept local to this module.
  var PERI = "#5e72e4";   // chromosome A material
  var AMBER = "#ec9b27";  // chromosome B material
  var INK = "#1a1f36", LINE = "#3c4463", STALK = "#c2caf6";
  // Destination accents: which pole a chromosome travels to. Deliberately NOT peri/amber
  // (those already encode chromosome of origin) so "where it goes" reads apart from
  // "what it is". Teal = pole 1, rose = pole 2.
  var TEAL = { stroke: "#1f9e8f", bg: "#e2f3f0", ink: "#116d62" };
  var ROSE = { stroke: "#c0568a", bg: "#f8e7ef", ink: "#8f3466" };

  var ACRO = { "13": 1, "14": 1, "15": 1, "21": 1, "22": 1 };
  // Autosomal whole-chromosome trisomies compatible with live birth (syndromic).
  var VIABLE_TRISOMY = { "13": "Patau syndrome", "18": "Edwards syndrome", "21": "Down syndrome" };

  function armOf(band) { return (band && String(band)[0] === "p") ? "p" : "q"; }
  // Distal = the segment farther from the centromere (the piece that is exchanged);
  // proximal = the centromere side. Written as readable region strings.
  function distal(chrom, band) { return armOf(band) === "q" ? chrom + band + "→qter" : chrom + "pter→" + band; }
  function proximal(chrom, band) { return armOf(band) === "q" ? chrom + "pter→" + band : chrom + band + "→qter"; }

  // ---- eligibility ----------------------------------------------------------
  function soleAberration(clone) {
    if (!clone || !clone.aberrations) return null;
    var real = clone.aberrations.filter(function (a) { return a && a.kind && a.kind !== "idem"; });
    return real.length === 1 ? real[0] : null;
  }
  function isReciprocal(ab) {
    return !!ab && ab.kind === "t" && ab.chroms && ab.chroms.length === 2 &&
      // Two DIFFERENT chromosomes. A homologous t (t(3;3)(q21.3;q26.2)) draws,
      // but its meiosis is not the quadrivalent this model computes: the two
      // derivatives pair with each other and with nothing else, so the
      // adjacent-1/adjacent-2/3:1 story does not apply. Better no panel than a
      // wrong one.
      String(ab.chroms[0]) !== String(ab.chroms[1]) &&
      ab.breakpoints && ab.breakpoints.length === 2 &&
      ab.breakpoints[0].length === 1 && ab.breakpoints[1].length === 1 &&
      !(ab.chroms[0] in { X: 1, Y: 1 }) && !(ab.chroms[1] in { X: 1, Y: 1 });
  }
  function wholeArmAcroFusion(ab) {
    if (!ab || ab.kind !== "der" || !ab.chroms || ab.chroms.length !== 2) return false;
    if (!ACRO[ab.chroms[0]] || !ACRO[ab.chroms[1]]) return false;
    var robNote = /robertsonian/i.test(ab.note || "");
    var wholeArm = ab.breakpoints && ab.breakpoints.length === 2 &&
      ab.breakpoints.every(function (g) { return g.length && g.every(function (b) { return /(p|q)10/.test(b); }); });
    return robNote || wholeArm;
  }
  function isRobertsonian(ab) {
    // Two DIFFERENT acrocentrics. A homologous fusion (der(21;21)) is not a
    // trivalent carrier: that parent keeps no free homologue, so nothing pairs,
    // no alternate mode exists, and no gamete is balanced. Feeding it this
    // model claimed a chromosomally normal child was possible, which Gardner
    // (5th ed, rob(21q21q)) flatly denies. computeHomologous owns that case.
    return wholeArmAcroFusion(ab) && String(ab.chroms[0]) !== String(ab.chroms[1]);
  }
  function isHomologousRob(ab) {
    return wholeArmAcroFusion(ab) && String(ab.chroms[0]) === String(ab.chroms[1]);
  }
  function eligible(clone) {
    var ab = soleAberration(clone);
    if (!ab) return false;
    if (isReciprocal(ab) || isRobertsonian(ab) || isHomologousRob(ab)) return true;
    // Gonosomal reciprocal carriers have their own model, gated on a sex
    // complement the model can read as a carrier (see gonoClass).
    return !!gonoClass(clone, ab);
  }

  // The gonosomal model reads a balanced carrier off the sex complement
  // (gonoClass): one free X for a female X;autosome carrier, one free Y for a
  // male one, one free X for a Y;autosome carrier, and no free gonosome at all
  // for t(X;Y). Any OTHER complement beside a gonosomal t is a spelling the
  // model cannot mean anything for, and this card says so and points at the
  // carriers it does model, as clickable karyotypes. It replaces the old
  // why-no-table card (2026-09-10), which existed only while the model did
  // not.
  function gonosomalNote(clone) {
    var ab = soleAberration(clone);
    if (!gonosomalShape(ab) || gonoClass(clone, ab)) return "";
    var a = String(ab.chroms[0]), b = String(ab.chroms[1]);
    var T = "t(" + a + ";" + b + ")(" + ab.breakpoints[0][0] + ";" + ab.breakpoints[1][0] + ")";
    var chips;
    if (isGonoChrom(a) && isGonoChrom(b)) {
      chips = ktButton("46," + T);
    } else if ((isGonoChrom(a) ? a : b) === "X") {
      chips = ktButton("46,X," + T) + '<span class="orig-who">or</span>' + ktButton("46,Y," + T);
    } else {
      chips = ktButton("46,X," + T);
    }
    return '<div class="seg-head"><h2>Meiotic segregation</h2></div>' +
      '<p class="oal-head">No outcomes table for this spelling of ' + esc(T) + '</p>' +
      '<p class="oal-body">The meiotic model needs a balanced carrier, and the sex chromosomes ' +
      'written here do not leave the free complement such a carrier has: the translocation itself ' +
      'supplies the derivative, and the letters before it list only the free, normal sex ' +
      'chromosomes. The carriers the model draws:</p>' +
      '<div class="oal-chips">' + chips + '</div>';
  }

  // ---- shared helpers -------------------------------------------------------
  function sexOf(clone) {
    var t = clone && clone.sex && clone.sex.tokens;
    return (t && t.length) ? t.join("") : "XX";
  }
  function trisomyViability(chrom) {
    return VIABLE_TRISOMY[chrom]
      ? { tag: "viable", text: "Viable: translocation " + VIABLE_TRISOMY[chrom] }
      : { tag: "lethal", text: "Usually lost in early pregnancy (trisomy " + chrom + ")" };
  }
  function monosomyViability(chrom) {
    return { tag: "lethal", text: "Usually lost in early pregnancy (monosomy " + chrom + ")" };
  }

  // ---- reciprocal: quadrivalent, 2:2 + 3:1 ----------------------------------
  function computeReciprocal(clone, ab) {
    var A = ab.chroms[0], B = ab.chroms[1];
    var bandA = ab.breakpoints[0][0], bandB = ab.breakpoints[1][0];
    var sex = sexOf(clone);
    var T = "t(" + A + ";" + B + ")(" + bandA + ";" + bandB + ")";

    // Four segments and each body's content, for the copy-number engine.
    var Ap = proximal(A, bandA), Ad = distal(A, bandA);
    var Bp = proximal(B, bandB), Bd = distal(B, bandB);
    var content = {
      A: [Ap, Ad], B: [Bp, Bd],       // normal homologues
      dA: [Ap, Bd], dB: [Bp, Ad]      // der(A) = A-proximal + B-distal; der(B) = mirror
    };
    var order = [Ap, Ad, Bp, Bd];

    // Imbalance of a gamete = copy count of each segment vs the disomic conceptus
    // (gamete + a normal A,B gamete from the partner), reported as partial tri/mono.
    function imbalance(bodies) {
      var count = {}; order.forEach(function (s) { count[s] = 1; });   // partner's normal A,B
      bodies.forEach(function (b) { content[b].forEach(function (s) { count[s] += 1; }); });
      var up = [], down = [];
      order.forEach(function (s) {
        var d = count[s] - 2;
        if (d > 0) up.push("partial trisomy " + s);
        else if (d < 0) down.push("partial monosomy " + s);
      });
      var parts = up.concat(down);
      return parts.length ? parts.join(", ") : "balanced";
    }

    function g(bodies, zygote, viability, label, division) {
      return { bodies: bodies, zygote: zygote, imbalance: imbalance(bodies), viability: viability, label: label, division: division || null };
    }
    var recipUnbalanced = { tag: "unbalanced", text: "Unbalanced: whether it is liveborn depends on the size of the duplicated and deleted segments" };
    // t(11;22)(q23;q11.2) is the recurrent reciprocal whose 3:1 +der(22) is liveborn.
    var isEmanuel = (A === "11" && B === "22") || (A === "22" && B === "11");
    var emanuel = { tag: "viable", text: "Can be liveborn: the classic 3:1 outcome (supernumerary der(22), Emanuel syndrome)" };
    var t31 = { tag: "unbalanced", text: "Unbalanced (3:1): usually liveborn only when the extra derivative is small" };

    var modes = [
      { name: "Alternate", sub: "2:2", balanced: true,
        blurb: "Homologous and derivative centromeres go to opposite poles. The only mode that yields balanced gametes.",
        gametes: [
          g(["A", "B"], "46," + sex, { tag: "viable", text: "Viable: chromosomally normal" }, "normal"),
          g(["dA", "dB"], "46," + sex + "," + T, { tag: "viable", text: "Viable: balanced carrier, like the parent" }, "balanced carrier")
        ] },
      { name: "Adjacent-1", sub: "2:2", balanced: false,
        blurb: "Homologous centromeres separate; each gamete keeps one normal chromosome and the non-homologous derivative. Duplication of one exchanged segment, deletion of the other.",
        gametes: [
          g(["A", "dB"], "46," + sex + ",der(" + B + ")" + T, recipUnbalanced, ""),
          g(["B", "dA"], "46," + sex + ",der(" + A + ")" + T, recipUnbalanced, "")
        ] },
      { name: "Adjacent-2", sub: "2:2", balanced: false,
        blurb: "Homologous centromeres travel to the same pole, a meiosis I nondisjunction (rarer). Duplication and deletion of the proximal, centromere-bearing segments.",
        gametes: [
          g(["A", "dA"], "46," + sex + ",+der(" + A + ")" + T + ",-" + B, recipUnbalanced, ""),
          g(["B", "dB"], "46," + sex + ",+der(" + B + ")" + T + ",-" + A, recipUnbalanced, "")
        ] },
      { name: "3:1", sub: "3:1", balanced: false,
        blurb: "Three chromosomes go to one pole, one to the other, giving 47- or 45-chromosome conceptions. The odd chromosome may be a derivative (tertiary trisomy / monosomy) or a whole normal chromosome (interchange trisomy / monosomy). Interstitial crossing-over expands the set further.",
        // division: the single chromosome that travels ALONE to the far pole, so
        // the two gametes sharing a division are complements (the 3-chromosome
        // trisomy and the 1-chromosome monosomy of one plane). Four planes: each
        // corner of the quadrivalent can be the lone one. Same key the scenes and
        // the pair boxes use, mirroring the Robertsonian adjacent pairs (#256).
        gametes: [
          g(["A", "B", "dA"], "47," + sex + ",+der(" + A + ")" + T, isEmanuel && A === "22" ? emanuel : t31, "tertiary trisomy", "dB"),
          g(["dB"], "45," + sex + ",der(" + B + ")" + T + ",-" + A, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy", "dB"),
          g(["A", "B", "dB"], "47," + sex + ",+der(" + B + ")" + T, isEmanuel && B === "22" ? emanuel : t31, "tertiary trisomy", "dA"),
          g(["dA"], "45," + sex + ",der(" + A + ")" + T + ",-" + B, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy", "dA"),
          g(["A", "dA", "dB"], "47," + sex + ",+" + A + "," + T, trisomyViability(A), "interchange trisomy", "B"),
          g(["B"], "45," + sex + ",-" + A, monosomyViability(A), "interchange monosomy", "B"),
          g(["B", "dA", "dB"], "47," + sex + ",+" + B + "," + T, trisomyViability(B), "interchange trisomy", "A"),
          g(["A"], "45," + sex + ",-" + B, monosomyViability(B), "interchange monosomy", "A")
        ] },
      { name: "4:0", sub: "4:0", balanced: false,
        blurb: "All four chromosomes travel to one pole and none to the other, the rarest outcome (two nondisjunctions at once). One gamete is disomic for the whole quadrivalent, the other nullisomic; both conceptions are grossly imbalanced.",
        gametes: [
          g(["A", "B", "dA", "dB"], "48," + sex + ",+der(" + A + ")" + T + ",+der(" + B + ")" + T, { tag: "lethal", text: "Usually lost in early pregnancy (trisomy for both chromosomes)" }, "double trisomy"),
          g([], "44," + sex + ",-" + A + ",-" + B, { tag: "lethal", text: "Usually lost in early pregnancy (monosomy for both chromosomes)" }, "double monosomy")
        ] }
    ];

    return {
      type: "reciprocal", valent: "quadrivalent", valentN: 4,
      A: A, B: B, bandA: bandA, bandB: bandB, sex: sex, carrier: "46," + sex + "," + T,
      bodies: reciprocalBodies(A, B, bandA, bandB),
      modes: modes
    };
  }

  // ---- Robertsonian: trivalent, 2:1 -----------------------------------------
  function computeRobertsonian(clone, ab) {
    var A = ab.chroms[0], B = ab.chroms[1];
    var bandA = (ab.breakpoints[0] && ab.breakpoints[0][0]) || "q10";
    var bandB = (ab.breakpoints[1] && ab.breakpoints[1][0]) || "q10";
    var sex = sexOf(clone);
    var F = "der(" + A + ";" + B + ")(" + bandA + ";" + bandB + ")";

    // division: the homologue that travels ALONE in the plane that yields this
    // gamete ("A"/"B"), the same key the scenes use (Adjacent-A = A alone). One
    // plane reads out twice, so the gametes sharing a key are complements: the
    // trisomy and the monosomy of the same chromosome. Alternate has one plane
    // only and carries no key.
    function g(bodies, zygote, imbalance, viability, label, division) {
      return { bodies: bodies, zygote: zygote, imbalance: imbalance, viability: viability, label: label, division: division || null };
    }

    var modes = [
      { name: "Alternate", sub: "2:1", balanced: true,
        blurb: "The fusion chromosome goes to one pole, the two normal homologues to the other. Both gametes are balanced.",
        gametes: [
          g(["A", "B"], "46," + sex, "balanced", { tag: "viable", text: "Viable: chromosomally normal" }, "normal"),
          g(["dF"], "45," + sex + "," + F, "balanced", { tag: "viable", text: "Viable: balanced carrier, like the parent" }, "balanced carrier")
        ] },
      { name: "Adjacent", sub: "2:1", balanced: false,
        blurb: "The fusion chromosome goes with one normal homologue, or a normal homologue goes alone. Each gamete is nullisomic or disomic for a whole long arm, giving a whole-chromosome trisomy or monosomy.",
        gametes: [
          g(["dF", "B"], "46," + sex + "," + F + ",+" + B, "three copies of " + B + "q", trisomyViability(B), "trisomy " + B, "A"),
          g(["dF", "A"], "46," + sex + "," + F + ",+" + A, "three copies of " + A + "q", trisomyViability(A), "trisomy " + A, "B"),
          g(["A"], "45," + sex + ",-" + B, "one copy of " + B + "q", monosomyViability(B), "monosomy " + B, "A"),
          g(["B"], "45," + sex + ",-" + A, "one copy of " + A + "q", monosomyViability(A), "monosomy " + A, "B")
        ] }
    ];

    return {
      type: "robertsonian", valent: "trivalent", valentN: 3,
      A: A, B: B, bandA: bandA, bandB: bandB, sex: sex, carrier: "45," + sex + "," + F,
      bodies: robertsonianBodies(A, B),
      modes: modes
    };
  }

  // ---- homologous Robertsonian: univalent, no balanced outcome --------------
  // der(21;21) and its kin. The carrier's only chromosome-A material is the
  // fusion itself, so at meiosis it pairs with nothing (a univalent) and
  // travels whole to one pole or the other: one gamete carries both copies of
  // Aq, the other carries no A at all. There is no alternate mode and no
  // balanced gamete; every conception is trisomic or monosomic for A (Gardner,
  // 5th ed: for rob(21q21q) a normal child is not possible from any gamete).
  // Shaped like the other models (modes/gametes) so origin() can round-trip
  // through it unchanged, but rendered as text: there is no valent to draw.
  function computeHomologous(clone, ab) {
    var A = ab.chroms[0];
    var bandA = (ab.breakpoints[0] && ab.breakpoints[0][0]) || "q10";
    var bandB = (ab.breakpoints[1] && ab.breakpoints[1][0]) || "q10";
    var sex = sexOf(clone);
    var F = "der(" + A + ";" + A + ")(" + bandA + ";" + bandB + ")";
    function g(bodies, zygote, imbalance, viability, label) {
      return { bodies: bodies, zygote: zygote, imbalance: imbalance, viability: viability, label: label };
    }
    var modes = [
      { name: "Univalent", sub: "1:0", balanced: false,
        blurb: "The fusion has no partner to pair with, so it travels whole to one pole or the other. One gamete carries both copies of " + A + "q, the other carries no chromosome " + A + " at all; no balanced gamete exists.",
        gametes: [
          // ISCN 2024 prints this order for the trisomic conceptus:
          // 46,XX,+21,der(21;21)(q10;q10) (numerical change listed first).
          g(["dF"], "46," + sex + ",+" + A + "," + F, "three copies of " + A + "q", trisomyViability(A), "translocation trisomy " + A),
          g([], "45," + sex + ",-" + A, "one copy of " + A + "q", monosomyViability(A), "monosomy " + A)
        ] }
    ];
    return {
      type: "homologous", valent: "univalent", valentN: 1,
      A: A, B: A, bandA: bandA, bandB: bandB, sex: sex, carrier: "45," + sex + "," + F,
      bodies: robertsonianBodies(A, A),
      modes: modes
    };
  }

  // ---- gonosomal reciprocal: the same quadrivalent, sexed --------------------
  // A reciprocal translocation touching a sex chromosome forms the same
  // quadrivalent and divides by the same modes; what the autosomal table cannot
  // carry is everything downstream of the division. Which conceptus arises
  // depends on the sex chromosomes in play (for a female carrier every gamete
  // forks on whether the sperm brings an X or a Y), the fate of the unbalanced
  // products is governed by X-inactivation rather than by the raw
  // partial-trisomy rules (an extra X segment is a different thing with and
  // without the X-inactivation centre on board), and a male carrier's meiosis
  // is dominated by the XY body, which the rearrangement disrupts. So the
  // gonosomal carriers get their own compute path, reusing the mode and scene
  // machinery, with the sex logic written into every outcome.
  //
  // Locus positions in hg38, the ideogram's own coordinate system. XIST marks
  // the X-inactivation centre: an X segment that carries it can be silenced,
  // one that does not stays active forever. SRY decides gonadal sex, so which
  // piece of a broken Y it rides on decides who develops as male. The
  // pseudoautosomal regions sit at the Xp/Yp tips (PAR1) and Xq/Yq tips
  // (PAR2), the only stretches where X and Y can pair at male meiosis.
  var XIST_BP = 73820000;   // chrX q13.2
  var SRY_BP = 2787000;     // chrY p11.31
  var SLATE = "#7d88ad";    // the free gonosome: present at the meiosis, no exchanged material

  function isGonoChrom(c) { return c === "X" || c === "Y"; }

  // Shape gate shared by the model and the fallback card: a two-chromosome,
  // one-breakpoint-each reciprocal t naming at least one sex chromosome.
  function gonosomalShape(ab) {
    return !!ab && ab.kind === "t" && ab.chroms && ab.chroms.length === 2 &&
      String(ab.chroms[0]) !== String(ab.chroms[1]) &&
      ab.breakpoints && ab.breakpoints.length === 2 &&
      ab.breakpoints[0].length === 1 && ab.breakpoints[1].length === 1 &&
      (isGonoChrom(String(ab.chroms[0])) || isGonoChrom(String(ab.chroms[1])));
  }

  // Which carrier this clone is. The sex tokens are the FREE sex chromosomes
  // (the derivative is named by the t), so they pick the class: 46,X,t(X;4) is
  // a woman, 46,Y,t(X;4) a man, 46,X,t(Y;7) a man, and 46,t(X;Y)(p22.3;q11.2)
  // a man both of whose sex chromosomes are in the exchange (ISCN omits the
  // sex field there because the rearrangement names them). Any other
  // complement is not a balanced carrier this model can speak for, and falls
  // through to the redirect card in gonosomalNote.
  function gonoClass(clone, ab) {
    if (!gonosomalShape(ab)) return null;
    var a = String(ab.chroms[0]), b = String(ab.chroms[1]);
    var toks = ((clone && clone.sex && clone.sex.tokens) || []).join("");
    if (isGonoChrom(a) && isGonoChrom(b)) return toks === "" ? "XY" : null;
    var g = isGonoChrom(a) ? a : b;
    if (g === "X" && toks === "X") return "XA-f";
    if (g === "X" && toks === "Y") return "XA-m";
    if (g === "Y" && toks === "X") return "YA-m";
    return null;
  }

  // Where the break falls on a gonosome, in the figure's own arithmetic (band
  // midpoint; p10/q10 is the centromere). Returns null when the band cannot be
  // resolved, and every claim built from it degrades to hedged wording.
  function gonoBreak(chrom, band) {
    var IDE = (typeof window !== "undefined") && window.IDEOGRAM;
    var d = IDE && IDE.data && IDE.data[chrom];
    if (!d) return null;
    var mid = null;
    if (/^[pq]10$/.test(String(band))) mid = d.centromere;
    else {
      var K = (typeof window !== "undefined") && window.Karyo;
      var r = K && K.resolveBand && K.resolveBand(chrom, band);
      if (r) mid = r.mid;
    }
    if (mid == null) return null;
    var arm = armOf(band);
    var lo = arm === "p" ? 0 : mid, hi = arm === "p" ? mid : d.length;
    return { arm: arm, mid: mid, len: d.length,
      // Is this locus on the DISTAL (exchanged) piece?
      distHas: function (pos) { return pos >= lo && pos <= hi; } };
  }

  // Start of Yq12, the heterochromatin block: a break at or beyond it means
  // the exchanged piece of the Y carries no genes.
  function yq12Start() {
    var IDE = (typeof window !== "undefined") && window.IDEOGRAM;
    var bands = IDE && IDE.data && IDE.data.Y && IDE.data.Y.bands;
    if (!bands) return null;
    for (var i = 0; i < bands.length; i++) if (bands[i][0] === "q12") return bands[i][1];
    return null;
  }

  // Three-way text pick for a flag that may be unresolvable (null).
  function pick3(flag, yes, no, unsure) { return flag === true ? yes : (flag === false ? no : unsure); }

  function vb(text) { return { tag: "viable", text: text }; }
  function vu(text) { return { tag: "unbalanced", text: text }; }
  function vl(text) { return { tag: "lethal", text: text }; }

  // One conceptus outcome. `when` is stamped on at attach time: the same
  // outcome object serves the female carrier's sperm-fork and the male
  // carrier's single lane, which is what keeps the two models incapable of
  // disagreeing about a conceptus they share.
  function gOut(zygote, imbalance, viability, note) {
    return { zygote: zygote, imbalance: imbalance, viability: viability, note: note || null };
  }
  function withWhen(o, when) {
    return { zygote: o.zygote, imbalance: o.imbalance, viability: o.viability, note: o.note, when: when || null };
  }

  // Schematic bodies for a MALE gonosomal carrier: the corner the female model
  // gives to the normal X is held by the FREE gonosome, which contributed no
  // material to the exchange. It draws in its own muted slate so the key can
  // say exactly that; peri stays the exchanged gonosome's material and amber
  // the autosome's, matching the female model and the autosomal panel.
  function gonosomalMaleBodies(cls, AUT) {
    var b = reciprocalBodies(cls === "YA-m" ? "Y" : "X", AUT, null, null);
    if (cls === "XA-m") {
      b.A = { id: "A", name: "Y", cen: SLATE, blocks: [{ c: SLATE, h: 5, arm: "p" }, { cen: true }, { c: SLATE, h: 11, arm: "q" }] };
    } else {
      b.A = { id: "A", name: "X", cen: SLATE, blocks: [{ c: SLATE, h: 12, arm: "p" }, { cen: true }, { c: SLATE, h: 22, arm: "q" }] };
      b.dA.blocks = [{ c: PERI, h: 5, arm: "p" }, { cen: true }, { c: PERI, h: 7, arm: "q" }, { c: AMBER, h: 14, arm: "q" }];
    }
    return b;
  }
  function gonosomalXYBodies() {
    return {
      dX: { id: "dX", name: "der(X)", cen: PERI, blocks: [{ c: PERI, h: 9, arm: "p" }, { cen: true }, { c: PERI, h: 20, arm: "q" }, { c: AMBER, h: 7, arm: "q" }] },
      dY: { id: "dY", name: "der(Y)", cen: AMBER, blocks: [{ c: AMBER, h: 4, arm: "p" }, { cen: true }, { c: AMBER, h: 6, arm: "q" }, { c: PERI, h: 7, arm: "q" }] }
    };
  }

  function computeGonosomal(clone, ab) {
    var cls = gonoClass(clone, ab);
    if (!cls) return null;
    var A0 = String(ab.chroms[0]), B0 = String(ab.chroms[1]);
    var T = "t(" + A0 + ";" + B0 + ")(" + ab.breakpoints[0][0] + ";" + ab.breakpoints[1][0] + ")";
    if (cls === "XY") return computeGonosomalXY(ab, T);
    var gi = isGonoChrom(A0) ? 0 : 1;
    var AUT = gi === 0 ? B0 : A0;
    var bandG = ab.breakpoints[gi][0], bandAut = ab.breakpoints[1 - gi][0];
    if (cls === "YA-m") return computeYA(AUT, bandG, bandAut, T);
    return computeXA(cls, AUT, bandG, bandAut, T);
  }

  // ---- X;autosome, both carrier sexes ---------------------------------------
  // One outcome table serves both: a conceptus does not know which parent
  // carried the translocation, so the female carrier's fork outcomes and the
  // male carrier's single-lane outcomes are drawn from the same objects.
  function computeXA(cls, AUT, bandX, bandAut, T) {
    var male = cls === "XA-m";
    var free = male ? "Y" : "X";
    var carrier = "46," + free + "," + T;
    var Xd = distal("X", bandX), Xp = proximal("X", bandX);
    var Ad = distal(AUT, bandAut), Ap = proximal(AUT, bandAut);
    var DA = "der(" + AUT + ")";
    var bi = gonoBreak("X", bandX);
    var xicDist = bi ? bi.distHas(XIST_BP) : null;   // XIST travels with the exchanged piece
    var xicProx = bi ? !bi.distHas(XIST_BP) : null;  // XIST stays on the der(X)
    var poi = /^q(13|2[1-6])/.test(String(bandX));

    var VU = vu("Unbalanced: survival depends on the segments and on what X-inactivation can silence");
    var V31 = vu("Unbalanced (3:1): usually liveborn only when the extra derivative is small or can be silenced");

    var noteBalF = "A balanced daughter usually keeps the NORMAL X as her inactive X: cells that silence the der(X) spread the silencing into its chromosome " + AUT +
      " material and are selected against. The translocated X therefore stays active everywhere, so a gene disrupted at X" + bandX + " is expressed, the way X-linked conditions have surfaced in balanced carrier females" +
      (poi ? "; and a break between Xq13 and Xq26 carries a risk of premature ovarian insufficiency" : "") + ".";
    var noteBalM = "A balanced son is usually infertile: the quadrivalent ties chromosome " + AUT + " into the XY body at meiosis, the unsynapsed chromatin is silenced (MSCI), and spermatogenesis stalls.";
    var noteXd = pick3(xicDist,
      "The extra " + Xd + " on the " + DA + " carries the X-inactivation centre, so most cells silence it, and the silencing can spread into the attached chromosome " + AUT + " material; the result is milder and more variable than the raw imbalance suggests.",
      "The extra " + Xd + " on the " + DA + " has no X-inactivation centre, so it cannot be silenced and stays active in every cell.",
      "Whether the extra " + Xd + " can be silenced depends on whether it carries the X-inactivation centre (Xq13).");
    var noteDerXF = pick3(xicProx,
      "Beside a normal X, the der(X) is preferentially inactivated; that silences its X material and part of the attached " + Ad + ". This partial rescue is why these are the unbalanced conceptions most often carried to term, with a variable phenotype.",
      "This der(X) has no X-inactivation centre, so it can never be the inactive X; with only one silencing centre in the cell, no X is inactivated at all and the imbalance is fully expressed.",
      "How much is rescued depends on whether the der(X) kept the X-inactivation centre (Xq13) and can be the inactive X.");
    var noteSupX = pick3(xicProx,
      "A supernumerary der(X) that carries the X-inactivation centre is usually silenced, which is why some of these conceptions survive, with a variable phenotype.",
      "A supernumerary der(X) without the X-inactivation centre cannot be silenced and stays fully active: the severe pattern of XIST-negative extra X material.",
      "The fate of a supernumerary der(X) turns on whether it carries the X-inactivation centre and can be silenced.");

    var O = {
      girl: gOut("46,XX", "balanced", vb("Viable: chromosomally normal daughter"), null),
      boy: gOut("46,XY", "balanced", vb("Viable: chromosomally normal son"), null),
      carrierF: gOut("46,X," + T, "balanced", vb("Viable: balanced carrier daughter"), noteBalF),
      carrierM: gOut("46,Y," + T, "balanced", vb("Viable: balanced carrier son, usually infertile"), noteBalM),
      derAutXX: gOut("46,XX,der(" + AUT + ")" + T, "partial trisomy " + Xd + ", partial monosomy " + Ad, VU, noteXd),
      derAutXY: gOut("46,XY,der(" + AUT + ")" + T, "partial trisomy " + Xd + ", partial monosomy " + Ad, VU, noteXd),
      derXF: gOut("46,X,der(X)" + T, "partial monosomy " + Xd + ", partial trisomy " + Ad, VU, noteDerXF),
      derXM: gOut("46,Y,der(X)" + T, "no copy of " + Xd + " at all, partial trisomy " + Ad,
        vl("Usually lost very early: part of the only X is missing outright"),
        "With a Y instead of a second X, the der(X) is the only X material, so " + Xd + " is missing from every cell."),
      a2xXX: gOut("46,XX,+der(X)" + T + ",-" + AUT, "partial trisomy " + Xp + ", partial monosomy " + Ap, VU,
        "Cells keep one X active and silence the rest, so the extra " + Xp + " material is largely quieted, the way a whole extra X is; the missing " + Ap + " has no such rescue and drives the outcome."),
      a2xXY: gOut("46,XY,+der(X)" + T + ",-" + AUT, "partial trisomy " + Xp + ", partial monosomy " + Ap, VU,
        "With two X-inactivation centres in a male cell, one X is silenced, usually the der(X); the missing " + Ap + " has no rescue and drives the outcome."),
      a2aX: gOut("46,X,+der(" + AUT + ")" + T, "a single free X; partial trisomy " + Ap, VU,
        "One sex-chromosome slot holds a normal X and the other is empty; the " + Xd + " on the " + DA + " stands in for part of the missing second X. The proximal chromosome " + AUT + " trisomy has no inactivation rescue."),
      a2aY: gOut("46,Y,+der(" + AUT + ")" + T, "no free X; partial trisomy " + Ap,
        vl("Never viable: no proper X, only the X segment on the " + DA), null),
      supXXX: gOut("47,XX,+der(X)" + T, "an extra der(X): partial trisomy " + Xp + " and " + Ad, V31, noteSupX),
      supXXY: gOut("47,XY,+der(X)" + T, "an extra der(X): partial trisomy " + Xp + " and " + Ad, V31, noteSupX),
      supAXX: gOut("47,XX,+der(" + AUT + ")" + T, "an extra " + DA + ": partial trisomy " + Ap + " and " + Xd, V31, noteXd),
      supAXY: gOut("47,XY,+der(" + AUT + ")" + T, "an extra " + DA + ": partial trisomy " + Ap + " and " + Xd, V31, noteXd),
      tmDerAX: gOut("45,X,der(" + AUT + ")" + T, "a single free X; partial monosomy " + Ad,
        vl("Usually lost in early pregnancy (tertiary monosomy)"), null),
      tmDerAY: gOut("45,Y,der(" + AUT + ")" + T, "no proper X, only the " + Xd + " on the " + DA,
        vl("Never viable: no proper X"), null),
      tmDerXX: gOut("45,X,der(X)" + T + ",-" + AUT, "partial monosomy " + Xd + ", partial monosomy " + Ap,
        vl("Usually lost in early pregnancy (tertiary monosomy)"), null),
      tmDerXY: gOut("45,Y,der(X)" + T + ",-" + AUT, "no copy of " + Xd + "; partial monosomy " + Ap,
        vl("Usually lost very early: part of the only X is missing"), null),
      intXXX: gOut("47,XX," + T, "a whole extra X beside the balanced translocation",
        vb("Usually mild: the extra X is silenced, the pattern of triple X"),
        "Cells keep the der(X) active, because silencing it would spread into its chromosome " + AUT + " material, and silence the two free X chromosomes."),
      intXXY: gOut("47,XY," + T, "a whole extra X beside the balanced translocation and the Y",
        vb("Usually mild: the Klinefelter pattern, an extra silenced X beside the Y"),
        "The two derivatives supply a complete X between them; with the free X and the Y this is the 47,XXY pattern riding on the parental translocation."),
      turner: gOut("45,X", "a single X and no second sex chromosome",
        vu("Turner syndrome (45,X): most are lost in pregnancy, some are liveborn"),
        "Interchange monosomy: the carrier gamete brought no sex chromosome at all, so the partner's X stands alone."),
      no45Y: gOut("45,Y", "a Y and no X at all", vl("Never viable: a conceptus without any X is lost"), null),
      intAX: gOut("47,X,+" + AUT + "," + T, "three full copies of chromosome " + AUT, trisomyViability(AUT),
        "Interchange trisomy: the two derivatives travel together as a balanced pair, and the free chromosome " + AUT + " rides along as a third copy."),
      intAY: gOut("47,Y,+" + AUT + "," + T, "three full copies of chromosome " + AUT + "; the only X material is on the derivatives", trisomyViability(AUT),
        "The two derivatives supply a complete X between them, so with the Y this is a balanced-carrier-like male on top of the trisomy."),
      imAX: gOut("45,XX,-" + AUT, "monosomy " + AUT, monosomyViability(AUT), null),
      imAY: gOut("45,XY,-" + AUT, "monosomy " + AUT, monosomyViability(AUT), null),
      d40XX: gOut("48,XX,+der(X)" + T + ",+der(" + AUT + ")" + T, "trisomy for the exchanged X and chromosome " + AUT + " material",
        vl("Usually lost in early pregnancy (trisomy for both chromosomes of the exchange)"), null),
      d40XY: gOut("48,XY,+der(X)" + T + ",+der(" + AUT + ")" + T, "trisomy for the exchanged X and chromosome " + AUT + " material",
        vl("Usually lost in early pregnancy (trisomy for both chromosomes of the exchange)"), null),
      d40nX: gOut("44,X,-" + AUT, "a single X; monosomy " + AUT, vl("Usually lost in early pregnancy (monosomy for both)"), null),
      d40nY: gOut("44,Y,-" + AUT, "no X at all; monosomy " + AUT, vl("Never viable: no X at all"), null)
    };

    var WX = "if the sperm brings an X", WY = "if the sperm brings a Y";
    // A female carrier's gamete forks on the sperm; a male carrier's gamete IS
    // the sperm, the egg always brings an X, and each lane lands on one of the
    // same outcomes.
    function gf(bodies, label, oX, oY, division) {
      return { bodies: bodies, label: label, division: division || null,
        outcomes: [withWhen(oX, WX), withWhen(oY, WY)] };
    }
    function gm(bodies, label, o, division) {
      return { bodies: bodies, label: label, division: division || null, outcomes: [withWhen(o, null)] };
    }

    var modes;
    if (!male) {
      modes = [
        { name: "Alternate", sub: "2:2", balanced: true,
          blurb: "Homologous and derivative centromeres go to opposite poles. The only mode that yields balanced gametes.",
          gametes: [gf(["A", "B"], "normal", O.girl, O.boy), gf(["dA", "dB"], "balanced carrier", O.carrierF, O.carrierM)] },
        { name: "Adjacent-1", sub: "2:2", balanced: false,
          blurb: "Homologous centromeres separate; each gamete keeps one normal chromosome and the non-homologous derivative. One exchanged segment is duplicated, the other deleted, and X-inactivation decides how much of that is felt.",
          gametes: [gf(["A", "dB"], "", O.derAutXX, O.derAutXY), gf(["B", "dA"], "", O.derXF, O.derXM)] },
        { name: "Adjacent-2", sub: "2:2", balanced: false,
          blurb: "Homologous centromeres travel to the same pole, a meiosis I nondisjunction (rarer). The imbalance falls on the proximal, centromere-bearing segments.",
          gametes: [gf(["A", "dA"], "", O.a2xXX, O.a2xXY), gf(["B", "dB"], "", O.a2aX, O.a2aY)] },
        { name: "3:1", sub: "3:1", balanced: false,
          blurb: "Three chromosomes to one pole, one to the other: 47- or 45-chromosome conceptions. This is where the classic whole-chromosome outcomes live: interchange loss of the X is Turner syndrome, interchange gain is the triple X or Klinefelter pattern, and a 45,Y conception without any X is never viable.",
          gametes: [
            gf(["A", "B", "dA"], "tertiary trisomy", O.supXXX, O.supXXY, "dB"),
            gf(["dB"], "tertiary monosomy", O.tmDerAX, O.tmDerAY, "dB"),
            gf(["A", "B", "dB"], "tertiary trisomy", O.supAXX, O.supAXY, "dA"),
            gf(["dA"], "tertiary monosomy", O.tmDerXX, O.tmDerXY, "dA"),
            gf(["A", "dA", "dB"], "interchange trisomy", O.intXXX, O.intXXY, "B"),
            gf(["B"], "interchange monosomy", O.turner, O.no45Y, "B"),
            gf(["B", "dA", "dB"], "interchange trisomy", O.intAX, O.intAY, "A"),
            gf(["A"], "interchange monosomy", O.imAX, O.imAY, "A")] },
        { name: "4:0", sub: "4:0", balanced: false,
          blurb: "All four chromosomes to one pole, the rarest pattern. One gamete is disomic for the whole quadrivalent, the other nullisomic; both conceptions are grossly imbalanced.",
          gametes: [gf(["A", "dA", "B", "dB"], "double trisomy", O.d40XX, O.d40XY), gf([], "double monosomy", O.d40nX, O.d40nY)] }
      ];
    } else {
      modes = [
        { name: "Alternate", sub: "2:2", balanced: true,
          blurb: "The Y and the normal autosome to one pole, the two derivatives to the other. The only balanced pattern: a normal son, or a balanced carrier daughter.",
          gametes: [gm(["A", "B"], "normal son", O.boy), gm(["dA", "dB"], "balanced carrier daughter", O.carrierF)] },
        { name: "Adjacent-1", sub: "2:2", balanced: false,
          blurb: "Neighbouring chromosomes with non-matching centromeres travel together. Because each sperm carries its own sex chromosome, the sperm decides the child's sex here, not a fork on the partner.",
          gametes: [gm(["A", "dB"], "", O.derAutXY), gm(["B", "dA"], "", O.derXF)] },
        { name: "Adjacent-2", sub: "2:2", balanced: false,
          blurb: "Matching centromeres to the same pole, a meiosis I nondisjunction (rarer). The imbalance falls on the proximal segments.",
          gametes: [gm(["A", "dA"], "", O.a2xXY), gm(["B", "dB"], "", O.a2aX)] },
        { name: "3:1", sub: "3:1", balanced: false,
          blurb: "Three chromosomes to one pole, one to the other. The whole-chromosome outcomes surface here: a sperm with no sex chromosome gives Turner syndrome, and the crowded gametes give the Klinefelter pattern or a full translocation trisomy.",
          gametes: [
            gm(["A", "B", "dA"], "tertiary trisomy", O.supXXY, "dB"),
            gm(["dB"], "tertiary monosomy", O.tmDerAX, "dB"),
            gm(["A", "B", "dB"], "tertiary trisomy", O.supAXY, "dA"),
            gm(["dA"], "tertiary monosomy", O.tmDerXX, "dA"),
            gm(["A", "dA", "dB"], "interchange trisomy", O.intXXY, "B"),
            gm(["B"], "interchange monosomy", O.turner, "B"),
            gm(["B", "dA", "dB"], "interchange trisomy", O.intAX, "A"),
            gm(["A"], "interchange monosomy", O.imAY, "A")] },
        { name: "4:0", sub: "4:0", balanced: false,
          blurb: "All four to one pole, the rarest pattern; both conceptions are grossly imbalanced.",
          gametes: [gm(["A", "dA", "B", "dB"], "double trisomy", O.d40XY), gm([], "double monosomy", O.d40nX)] }
      ];
    }

    var fertility = male
      ? { head: "Fertility of this carrier",
          body: "A balanced X;autosome male is usually infertile (azoospermia or severe oligospermia). At meiosis the X and Y condense into the XY body and silence themselves (MSCI); this quadrivalent drags chromosome " + AUT +
            " material into that body, and the " + Xd + " on the " + DA + " has no pairing partner at all. Unsynapsed chromatin at pachytene triggers silencing and arrest, so most spermatocytes never finish. The outcomes below describe the sperm that do form." }
      : (poi ? { head: "Fertility of this carrier",
          body: "Most balanced X;autosome women are healthy and fertile, but this break falls between Xq13 and Xq26, the region where interrupting the X carries a recognised risk of premature ovarian insufficiency." } : null);

    return {
      type: "gonosomal", cls: cls, valent: "quadrivalent", valentN: 4,
      A: "X", B: AUT, bandA: bandX, bandB: bandAut, free: free, fork: !male,
      sex: free, carrier: carrier,
      bodies: male ? gonosomalMaleBodies(cls, AUT) : reciprocalBodies("X", AUT, bandX, bandAut),
      flags: { xicDist: xicDist, xicProx: xicProx, poi: poi },
      fertility: fertility,
      modes: modes
    };
  }

  // ---- Y;autosome, male carrier ---------------------------------------------
  // The Y question is WHERE the break falls: a break in the Yq12
  // heterochromatin block exchanges inert material (the classic familial
  // Y;acrocentric variants), a break in euchromatic Yq sits in the AZF
  // spermatogenesis region, and a break on Yp can put SRY on the derivative
  // autosome, after which the karyotype's sex letters stop predicting the
  // gonads.
  function computeYA(AUT, bandY, bandAut, T) {
    var carrier = "46,X," + T;
    var Yd = distal("Y", bandY), Yp = proximal("Y", bandY);
    var Ad = distal(AUT, bandAut), Ap = proximal(AUT, bandAut);
    var DA = "der(" + AUT + ")", DY = "der(Y)";
    var bi = gonoBreak("Y", bandY);
    var q12 = yq12Start();
    var sryDist = bi ? bi.distHas(SRY_BP) : null;                       // SRY moved to the der(AUT)
    var inert = (bi && q12 != null) ? (bi.arm === "q" && bi.mid >= q12) : null;   // exchanged piece is Yq12 heterochromatin
    var azf = bi ? (bi.arm === "q" && inert === false) : null;          // euchromatic Yq break
    var acroP = !!ACRO[AUT] && armOf(bandAut) === "p";

    var VU = vu("Unbalanced: survival depends on the segments involved");
    var inertLine = pick3(inert,
      "The exchanged piece of the Y is the inert Yq12 heterochromatin block, which adds nothing to a phenotype on its own.",
      "",
      "");
    var benignDaughter = inert === true && acroP && sryDist !== true;
    var benignSon = inert === true && acroP;

    var noteCarrier = pick3(inert,
      "With the break in the inert Yq12 block" + (acroP ? " and the autosomal break in an acrocentric short arm" : "") + ", carriers of this familial type are usually healthy and fertile, and the variant can ride through generations unnoticed.",
      (bi && bi.arm === "q"
        ? "The break falls in euchromatic Yq, the AZF spermatogenesis region, so carrier sons are often infertile even though they are otherwise well."
        : "The break falls on Yp" + pick3(sryDist, ", and it separates SRY from the Y centromere: SRY now rides on the " + DA + ", so sex follows that derivative, not the Y letters.", ".", ".")),
      "Carrier fertility depends on where the Y break falls: inert Yq12 variants transmit freely, euchromatic Yq breaks often cost fertility (AZF).");

    var O = {
      girl: gOut("46,XX", "balanced", vb("Viable: chromosomally normal daughter"), null),
      carrier: gOut("46,X," + T, "balanced",
        vb(inert === true ? "Viable: balanced carrier son, usually fertile" : "Viable: balanced carrier son"), noteCarrier),
      derAut: gOut("46,XX,der(" + AUT + ")" + T,
        "partial monosomy " + Ad + "; the " + Yd + " rides on the " + DA,
        sryDist === true
          ? vb("Viable: a 46,XX conceptus that develops as male, because SRY rides on the " + DA)
          : (benignDaughter ? vb("Essentially normal daughter: the " + DA + " trades a satellite short arm for inert Yq heterochromatin") : VU),
        sryDist === true
          ? "SRY travelled with the exchanged Y piece, so this XX conceptus develops as male (46,XX testicular difference of sex development); such males are infertile."
          : (benignDaughter
            ? "This is how the familial Y;acrocentric variants pass through mothers and daughters unnoticed: the lost " + Ad + " is satellite material and the gained piece is inert."
            : inertLine || null)),
      derY: gOut("46,X,der(Y)" + T,
        "partial trisomy " + Ad + "; " + Yd + " is missing",
        benignSon ? vb("Essentially normal son: extra satellite material and a missing inert Yq block")
          : (sryDist === true
            ? vu("A conceptus with Y material but no SRY: develops as female, with a gonadal tumour risk")
            : (azf === true ? vu("Viable son, but the missing euchromatic Yq (AZF) costs fertility") : VU)),
        sryDist === true
          ? "The der(Y) here has lost SRY to the other derivative, so this conceptus develops as female despite the Y material; Y sequences in a female gonad carry a gonadoblastoma risk, which is why such gonads are usually removed."
          : (benignSon ? "The familial variant transmitted whole: the extra piece is an acrocentric satellite arm and the missing piece is inert heterochromatin." : (inertLine || null))),
      a2y: gOut("46,XX,+der(Y)" + T + ",-" + AUT,
        "partial monosomy " + Ap + "; two X chromosomes plus the " + DY, VU,
        "The proximal chromosome " + AUT + " monosomy drives the outcome" + (sryDist === true ? "; with SRY on the other derivative absent here, the " + DY + " keeps SRY and this XX-plus-der(Y) conceptus develops as male." : ".")),
      a2a: gOut("46,X,+der(" + AUT + ")" + T,
        "a single free X; partial trisomy " + Ap, VU,
        "The proximal trisomy has no rescue, and only one free X is present" + (sryDist === true ? "; SRY on the " + DA + " makes the gonads testicular despite the single X." : ".")),
      supY: gOut("47,XX,+der(Y)" + T, "an extra " + DY + ": " + Yp + " and " + Ad + " in an extra copy",
        vu("Unbalanced (3:1): the Klinefelter-like pattern plus the extra autosomal segment"),
        "Two X chromosomes plus the " + DY + (sryDist === true ? " (SRY is on the exchanged piece, not here)" : ", which carries SRY") + "; the extra " + Ad + " decides how much this costs."),
      supA: gOut("47,XX,+der(" + AUT + ")" + T, "an extra " + DA + ": partial trisomy " + Ap + "; the " + Yd + " rides along",
        vu("Unbalanced (3:1): usually liveborn only when the extra derivative is small"),
        sryDist === true ? "SRY rides on the extra " + DA + ", so this otherwise XX conceptus develops as male." : (inertLine || null)),
      tmA: gOut("45,X,der(" + AUT + ")" + T, "a single free X; partial monosomy " + Ad + "; the " + Yd + " rides on the " + DA,
        (inert === true && acroP) ? vu("Effectively 45,X (Turner): the derivative only trades inert material") : vl("Usually lost in early pregnancy (tertiary monosomy)"),
        sryDist === true ? "With SRY on the " + DA + " beside a single X, gonadal development is testicular or mixed: the 45,X/46,XY family of outcomes without the mosaicism." : null),
      tmY: gOut("45,X,der(Y)" + T + ",-" + AUT, "partial monosomy " + Ap + "; the sex slot holds the " + DY,
        vl("Usually lost in early pregnancy (tertiary monosomy)"), null),
      intY: gOut("47,XX," + T, "a whole extra Y-worth of material beside the balanced exchange",
        vb("Usually mild: the Klinefelter pattern (47,XXY) riding on the parental translocation"),
        "The two derivatives supply a complete Y between them, on top of two X chromosomes."),
      turner: gOut("45,X", "a single X and no second sex chromosome",
        vu("Turner syndrome (45,X): most are lost in pregnancy, some are liveborn"),
        "Interchange monosomy: the sperm brought no sex chromosome, so the egg's X stands alone."),
      intA: gOut("47,X,+" + AUT + "," + T, "three full copies of chromosome " + AUT, trisomyViability(AUT),
        "Interchange trisomy: the derivatives travel as a balanced pair and the free chromosome " + AUT + " rides along; the derivatives make this a son."),
      imA: gOut("45,XX,-" + AUT, "monosomy " + AUT, monosomyViability(AUT), null),
      d40: gOut("48,XX,+der(Y)" + T + ",+der(" + AUT + ")" + T, "an extra Y-worth and an extra chromosome " + AUT + "-worth of material",
        vl("Usually lost in early pregnancy (trisomy for both chromosomes of the exchange)"), null),
      d40n: gOut("44,X,-" + AUT, "a single X; monosomy " + AUT, vl("Usually lost in early pregnancy (monosomy for both)"), null)
    };

    function gm(bodies, label, o, division) {
      return { bodies: bodies, label: label, division: division || null, outcomes: [withWhen(o, null)] };
    }
    var modes = [
      { name: "Alternate", sub: "2:2", balanced: true,
        blurb: "The X and the normal autosome to one pole, the two derivatives to the other. The only balanced pattern: a normal daughter, or a carrier son like his father.",
        gametes: [gm(["A", "B"], "normal daughter", O.girl), gm(["dA", "dB"], "balanced carrier son", O.carrier)] },
      { name: "Adjacent-1", sub: "2:2", balanced: false,
        blurb: "Neighbours with non-matching centromeres travel together. These are the outcomes that carry the familial Y;acrocentric story: when the exchanged pieces are inert, both are compatible with a normal life.",
        gametes: [gm(["A", "dB"], "", O.derAut), gm(["B", "dA"], "", O.derY)] },
      { name: "Adjacent-2", sub: "2:2", balanced: false,
        blurb: "Matching centromeres to the same pole, a meiosis I nondisjunction (rarer). The imbalance falls on the proximal segments.",
        gametes: [gm(["A", "dA"], "", O.a2y), gm(["B", "dB"], "", O.a2a)] },
      { name: "3:1", sub: "3:1", balanced: false,
        blurb: "Three chromosomes to one pole, one to the other. A sperm with no sex chromosome gives Turner syndrome; the crowded gametes give the Klinefelter pattern or a full translocation trisomy.",
        gametes: [
          gm(["A", "B", "dA"], "tertiary trisomy", O.supY, "dB"),
          gm(["dB"], "tertiary monosomy", O.tmA, "dB"),
          gm(["A", "B", "dB"], "tertiary trisomy", O.supA, "dA"),
          gm(["dA"], "tertiary monosomy", O.tmY, "dA"),
          gm(["A", "dA", "dB"], "interchange trisomy", O.intY, "B"),
          gm(["B"], "interchange monosomy", O.turner, "B"),
          gm(["B", "dA", "dB"], "interchange trisomy", O.intA, "A"),
          gm(["A"], "interchange monosomy", O.imA, "A")] },
      { name: "4:0", sub: "4:0", balanced: false,
        blurb: "All four to one pole, the rarest pattern; both conceptions are grossly imbalanced.",
        gametes: [gm(["A", "dA", "B", "dB"], "double trisomy", O.d40), gm([], "double monosomy", O.d40n)] }
    ];

    var euOrP = (bi && bi.arm === "q")
      ? "The break interrupts euchromatic Yq, where the AZF spermatogenesis genes live, so many carriers have impaired sperm production from the breakpoint alone, on top of the autosomal material tethered into the XY body."
      : "A break on Yp disturbs the region the X uses to pair with the Y" +
        pick3(sryDist, ", and it moves SRY onto the " + DA + ", so the derivatives, not the sex letters, decide each child's development.", ".", ".");
    var fertility = {
      head: "Fertility of this carrier",
      body: pick3(inert,
        "With the break in the inert Yq12 block the meiotic disturbance is small: the X still pairs with the der(Y) at the pseudoautosomal tip, and carriers of the classic Y;acrocentric variants are usually fertile. These variants are found by accident and run in families.",
        euOrP,
        "Where the Y break falls decides most of this carrier's story: inert Yq12 variants transmit freely, euchromatic Yq breaks often cost fertility (AZF).")
    };

    return {
      type: "gonosomal", cls: "YA-m", valent: "quadrivalent", valentN: 4,
      A: "Y", B: AUT, bandA: bandY, bandB: bandAut, free: "X", fork: false,
      sex: "X", carrier: carrier,
      bodies: gonosomalMaleBodies("YA-m", AUT),
      flags: { sryDist: sryDist, inert: inert, azf: azf, acroP: acroP },
      fertility: fertility,
      modes: modes
    };
  }

  // ---- X;Y: the failed bivalent ---------------------------------------------
  // A balanced t(X;Y) male has no free sex chromosome: both are derivatives.
  // What his meiosis can do is set by the pseudoautosomal tips. In the
  // recurrent form, t(X;Y)(p22.3;q11.2), the exchange puts BOTH PAR1 copies on
  // the der(Y) and BOTH PAR2 copies on the der(X), so the two derivatives
  // share no region at all, the sex body cannot form, and carriers are usually
  // azoospermic; the entity persists in families as the unbalanced der(X)
  // instead, transmitted by women. Other breakpoint pairs leave a shared PAR
  // and a working, ring-shaped sex bivalent.
  function computeGonosomalXY(ab, T) {
    var xi = String(ab.chroms[0]) === "X" ? 0 : 1;
    var bandX = ab.breakpoints[xi][0], bandY = ab.breakpoints[1 - xi][0];
    var Xd = distal("X", bandX), Yd = distal("Y", bandY);
    var bx = gonoBreak("X", bandX), by = gonoBreak("Y", bandY);
    var q12 = yq12Start();
    var sryDist = by ? by.distHas(SRY_BP) : null;      // SRY moved to the der(X)
    var inert = (by && q12 != null) ? (by.arm === "q" && by.mid >= q12) : null;
    // Do the derivatives still share a pseudoautosomal class? Work it through
    // the telomeres: each derivative ends in its own chromosome's telomere
    // OPPOSITE the break plus the exchanged partner tip. Breaks on the SAME
    // arm (both p, or both q) leave each derivative with one PAR1 and one
    // PAR2, so a class is shared on both and a sex bivalent can still form.
    // Breaks on OPPOSITE arms (the recurrent Xp;Yq form) stack both PAR2
    // copies on the der(X) and both PAR1 copies on the der(Y): nothing is
    // shared, and pairing fails.
    var parShared = (bx && by) ? (bx.arm === by.arm) : null;
    var recurrent = /^p22\.?3/.test(String(bandX)) && /^q11/.test(String(bandY));

    var derXChild = sryDist === true;   // SRY rides the der(X): that child develops as male
    var noteDerX = recurrent
      ? "The der(X) daughter is the form these families are found by: the missing " + Xd + " holds genes that ESCAPE X-inactivation, among them <i>SHOX</i>, so losing one copy shows even though the der(X) is preferentially silenced; short stature is the common finding, and when the break also removes <i>STS</i>, her sons with the der(X) have X-linked ichthyosis. The attached Yq heterochromatin is inert."
      : "In a daughter the der(X) is preferentially inactivated, but any missing distal X genes that escape inactivation are felt with one copy" + pick3(inert, "; the attached Yq12 material is inert.", ".", ".");
    var noteDerY = pick3(sryDist,
      "This der(Y) has LOST SRY to the der(X), so despite the Y material the conceptus develops as female, and the Y sequences in her gonads carry a gonadoblastoma risk.",
      "SRY stays on the der(Y), so this conceptus develops as male, carrying an extra copy of the exchanged " + Xd + pick3(inert, " and missing only the inert Yq12 block.", " and missing " + Yd + ".", "."),
      "Which way this conceptus develops depends on whether SRY stayed with the Y centromere.");

    var outDerX = withWhen(gOut("46,X,der(X)" + T,
      "partial monosomy " + Xd + "; the " + Yd + " rides on the der(X)",
      derXChild ? vb("Viable: develops as male despite the X plus der(X) complement (SRY on the der(X))")
        : vb("Viable: daughter carrying the der(X)" + (recurrent ? ", short stature is typical" : "")),
      noteDerX), null);
    var outDerY = withWhen(gOut("46,X,der(Y)" + T,
      "an extra copy of " + Xd + "; " + Yd + " is missing",
      sryDist === true ? vu("Develops as female with Y material present: gonadal surveillance matters")
        : vb("Viable: son carrying the der(Y)"),
      noteDerY), null);

    var modes = [
      { name: "1:1", sub: "1:1", balanced: false,
        blurb: "The two derivatives separate, one to each sperm, so every child inherits exactly one of them: no gamete is normal and none is balanced in the parental sense. Pairing failure also raises the rate of sperm with both derivatives or neither, giving 47- and 45-chromosome conceptions on top of these two.",
        gametes: [
          { bodies: ["dX"], label: "the der(X) sperm", division: null, outcomes: [outDerX] },
          { bodies: ["dY"], label: "the der(Y) sperm", division: null, outcomes: [outDerY] }] }
    ];

    var fertility = {
      head: "Fertility of this carrier",
      body: pick3(parShared,
        "These breakpoints leave the two derivatives with a shared pseudoautosomal tip, so a sex bivalent can still form and some carriers father children.",
        "The exchange separates the pseudoautosomal tips: both PAR1 copies end up on one derivative and both PAR2 copies on the other, so the derivatives have no region left to pair with each other. The sex body fails, unsynapsed chromatin is silenced (MSCI), and most balanced X;Y males are azoospermic. The recurrent clinical entity therefore travels through families as the unbalanced der(X), carried and transmitted by women.",
        "Whether this carrier can pair his two derivatives, and so make sperm, depends on which pseudoautosomal tips the exchange left together.")
    };

    return {
      type: "gonosomal", cls: "XY", valent: "bivalent", valentN: 2,
      A: "X", B: "Y", bandA: bandX, bandB: bandY, free: null, fork: false,
      sex: "", carrier: "46," + T,
      bodies: gonosomalXYBodies(),
      flags: { sryDist: sryDist, inert: inert, parShared: parShared, recurrent: recurrent },
      fertility: fertility,
      modes: modes
    };
  }

  // ---- parental origin: the forward model, run backwards ---------------------
  // Typing an unbalanced product is how clinic and the boards actually work: you are
  // handed the abnormal result and reason toward the parents. Rather than enumerate
  // segregation a second time (and risk the two disagreeing), generate the small
  // candidate set of parental carriers, run the SAME compute() forward on each, and
  // keep the ones whose zygote list contains what was typed. Correctness is then a
  // round trip. See docs/PARENTAL_ORIGIN.md.

  // Comparison key: two designations for the same complement must match even when the
  // spelling (rob/der) or the order of aberrations differs, since ISCN fixes neither.
  function canonParts(c) {
    return (c.aberrations || []).map(function (ab) {
      var raw = String(ab.raw || "");
      // An inheritance qualifier (mat, dmat, dn, ...) says where the aberration
      // came from, not what it is, and ISCN 2024 Table 5 writes every segregant
      // with dmat. Matching sees through the suffix; origin() reads it
      // separately to name the parent or to stand down.
      if (ab.qualifier) raw = raw.slice(0, raw.length - ab.qualifier.length);
      return raw.toLowerCase().replace(/\s+/g, "").replace(/^([+\-\u2212\u2013]?)rob\(/, "$1der(");
    }).sort().join(",");
  }
  function canonKey(k) {
    var m = window.ISCN.parse(k), c = m.clones && m.clones[0];
    if (!c || c.modalNumber == null) return null;
    return c.modalNumber + "|" + (c.sex.label || "") + "|" + canonParts(c);
  }
  // Sexless variant for the from= thread: the panel's zygotes wear the CARRIER
  // page's sex tokens, and which parent carries a translocation says nothing
  // about whether the conception was XX or XY, so a reader arriving from
  // 47,XY,+der(22)... must still match the mother's 47,XX,... spelling.
  function canonKeyNoSex(k) {
    var m = window.ISCN.parse(k), c = m.clones && m.clones[0];
    if (!c || c.modalNumber == null) return null;
    return c.modalNumber + "|" + canonParts(c);
  }

  // The carriers that could have produced this, as ISCN strings. Small and
  // enumerable, no search: a two-chromosome der means a whole-arm carrier (count one
  // lower), and a t — free-standing, or as the sub-op of a der — means a reciprocal
  // carrier at the same count.
  function candidateCarriers(clone) {
    var sex = sexOf(clone), out = [], seen = {};
    // The qualifier rides along with each candidate: it belongs to the
    // aberration the candidate was built from (for a sub-op t, to the der that
    // carries it), and it decides who the panel may name as the carrier. `who`
    // is set only on the sexed gonosomal spellings below.
    function add(k, ab, who) {
      if (!k || seen[k]) return;
      seen[k] = 1;
      out.push({ k: k, qual: (ab && ab.qualifier) || null, who: who || null });
    }
    // A t naming a sex chromosome has SEXED carrier spellings: the free
    // complement decides who can carry it. 46,X,t(X;4) is a mother and
    // 46,Y,t(X;4) a father; a balanced t(Y;autosome) or t(X;Y) carrier can
    // only be a father. So instead of splicing the CHILD'S sex tokens into
    // one candidate string (which for a gonosomal t is not a carrier at
    // all), the candidates are emitted one per possible parent. Which
    // parents' models actually produce the typed complement is then a fact
    // the forward round-trip discovers, and the card can say "only the
    // mother" when only hers does: 46,XX,der(4)t(X;4) needs an egg carrying
    // a free X beside the der(4), which no paternal meiosis can make.
    function addT(chroms, bpsStr, ab) {
      var a = String(chroms[0]), b = String(chroms[1]);
      var t = "t(" + a + ";" + b + ")(" + bpsStr + ")";
      var gA = isGonoChrom(a), gB = isGonoChrom(b);
      if (!gA && !gB) { add("46," + sex + "," + t, ab); return; }
      if (gA && gB) { add("46," + t, ab, "father"); return; }
      if ((gA ? a : b) === "X") {
        add("46,X," + t, ab, "mother");
        add("46,Y," + t, ab, "father");
      } else {
        add("46,X," + t, ab, "father");
      }
    }
    function bps(ab) {
      return (ab.breakpoints || []).map(function (g) { return (g || []).join(""); }).join(";");
    }
    (clone.aberrations || []).forEach(function (ab) {
      if (!ab || !ab.chroms) return;
      if (ab.kind === "der" && ab.chroms.length === 2) {
        add((clone.modalNumber - 1) + "," + sex + ",der(" + ab.chroms.join(";") + ")(" + bps(ab) + ")", ab);
      }
      if (ab.kind === "t" && ab.chroms.length === 2) {
        addT(ab.chroms, bps(ab), ab);
      }
      (ab.subOps || []).forEach(function (sub) {
        if (sub.op === "t" && sub.chroms && sub.chroms.length === 2) {
          addT(sub.chroms,
            (sub.breakpoints || []).map(function (g) { return (g || []).join(""); }).join(";"), ab);
        }
      });
    });
    return out;
  }

  // Chromosomes whose uniparental disomy is a recognised syndrome, and therefore a
  // reason to karyotype the parents that a segregation diagram cannot show. Named
  // only: the magnitude is a counselor's to give, not a drawing's.
  var UPD_RISK = {
    "14": "chromosome 14 (Temple and Kagami-Ogata syndromes)",
    "15": "chromosome 15 (Prader-Willi and Angelman syndromes)"
  };

  // Which parent an inheritance qualifier names (ISCN 4.2.1 g). dn is absent on
  // purpose: it records that both parents were karyotyped and are normal
  // (4.2.1 h), so there is no carrier to point at and the candidate is dropped.
  var QUAL_PARENT = { mat: "mother", dmat: "mother", pat: "father", dpat: "father", inh: "inherited", dinh: "inherited" };

  function origin(clone) {
    if (!clone || clone.modalNumber == null) return null;
    if (eligible(clone)) return null;         // a balanced carrier: the forward panel serves it
    var typedKey = canonKey(clone.raw || "");
    if (!typedKey) return null;
    var candidates = [];
    candidateCarriers(clone).forEach(function (cand) {
      if (cand.qual === "dn") return;         // parents documented normal: nothing to infer
      var ck = cand.k;
      var cc = window.ISCN.parse(ck).clones[0];
      if (!cc || !eligible(cc)) return;
      var m = compute(cc);
      if (!m) return;
      var updChroms = m.type === "robertsonian" ? [m.A, m.B] : (m.type === "homologous" ? [m.A] : []);
      for (var i = 0; i < m.modes.length; i++) {
        for (var j = 0; j < m.modes[i].gametes.length; j++) {
          var g = m.modes[i].gametes[j];
          // A gonosomal gamete carries a list of outcomes (the sperm fork);
          // the autosomal shape is a single zygote.
          var zys = g.outcomes ? g.outcomes.map(function (o) { return o.zygote; }) : [g.zygote];
          var hit = null;
          for (var z = 0; z < zys.length; z++) if (canonKey(zys[z]) === typedKey) { hit = zys[z]; break; }
          if (hit == null) continue;
          m.hereZygote = hit;                 // marked "you typed this" when the panel renders
          candidates.push({
            carrier: { XX: ck.replace(/,X[XY],/, ",XX,"), XY: ck.replace(/,X[XY],/, ",XY,") },
            carrierK: ck, who: cand.who || null,
            mode: m.modes[i].name, sub: m.modes[i].sub, label: g.label || "",
            type: m.type, model: m,
            qual: cand.qual || null, parent: QUAL_PARENT[cand.qual] || null,
            upd: updChroms.filter(function (c) { return UPD_RISK[c]; })
          });
          return;
        }
      }
    });
    if (!candidates.length) return null;
    var q = candidates[0].qual;
    return { typed: clone.raw || "", candidates: candidates, deNovoPossible: !q || q === "c" };
  }

  // One line per inheritance suffix: what it lets the card claim (ISCN 2024,
  // 4.2.1 g: mat/pat name the parent; the d- forms say only PART of a parental
  // rearrangement was inherited, which for a derivative means the parent
  // carries the balanced complement).
  var QUAL_LINE = {
    mat: "The mat suffix records maternal origin; a balanced parental form is written dmat (ISCN 4.2.1 g).",
    pat: "The pat suffix records paternal origin; a balanced parental form is written dpat (ISCN 4.2.1 g).",
    dmat: "The dmat suffix marks this chromosome as one product of her balanced rearrangement (ISCN 4.2.1 g).",
    dpat: "The dpat suffix marks this chromosome as one product of his balanced rearrangement (ISCN 4.2.1 g).",
    inh: "The inh suffix says a parent carries it without saying which.",
    dinh: "The dinh suffix marks one product of a parental rearrangement without naming the parent (ISCN 4.2.1 g)."
  };

  // The compact parental-origin card (the card leads the tool column; see
  // docs/INTERFACE.md). Headline first, carrier karyotypes right after: the
  // chips are the payload (Dan, 2026-09-04), and mechanism talk stays out of
  // the card entirely. The meiosis itself lives on the CARRIER page the chips
  // load, where the figures are true of the karyotype drawn above them; each
  // chip carries the typed karyotype as data-from so that page can mark this
  // outcome (see applyFrom).
  function renderOriginCard(m) {
    if (!m || !m.candidates.length) return "";
    var c = m.candidates[0];
    var parent = c.parent, named = parent === "mother" || parent === "father";
    var A = esc(c.model.A);
    var head, caveat, chips = null;
    // Gonosomal candidates come one per POSSIBLE parent (the carrier
    // spellings are sexed), and only the parents whose forward model produced
    // the typed complement survive the round-trip. That makes "who" a
    // discovered fact rather than a suffix: a 46,XX child with a der(4) from
    // t(X;4) can only have come through an egg, so the card names the mother
    // outright, with no mat in the notation.
    if (c.who) {
      var momC = null, dadC = null;
      m.candidates.forEach(function (x) {
        if (x.who === "mother") momC = momC || x;
        if (x.who === "father") dadC = dadC || x;
      });
      var soloC = momC || dadC, soloWho = momC ? "mother" : "father";
      if (named) {
        var qc = parent === "mother" ? momC : dadC;
        if (qc) {
          head = "The notation names the " + parent + " as the carrier";
          caveat = QUAL_LINE[c.qual] || "";
          chips = '<span class="orig-who">the ' + parent + '</span>' + ktButton(qc.carrierK, m.typed);
        } else {
          // The suffix and the meiosis disagree: dpat on a complement only an
          // egg can deliver. Say both facts and let the reader re-check.
          head = "The suffix and the chromosomes disagree";
          caveat = "The " + esc(c.qual) + " suffix names the " + parent + ", but only a " +
            (momC ? "maternal" : "paternal") + " carrier's meiosis can produce this complement, so the report is worth re-checking. " +
            (QUAL_LINE[c.qual] || "");
          chips = '<span class="orig-who">the ' + soloWho + '</span>' + ktButton(soloC.carrierK, m.typed);
        }
      } else if (momC && dadC) {
        head = parent === "inherited" ? "A parent carries the balanced form" : "A parent may be a balanced carrier";
        caveat = QUAL_LINE[c.qual] || "";
        chips = '<span class="orig-who">the mother</span>' + ktButton(momC.carrierK, m.typed) +
          '<span class="orig-who">or the father</span>' + ktButton(dadC.carrierK, m.typed);
      } else {
        head = "Only the " + soloWho + " could carry the balanced form";
        caveat = "Of the two possible carriers, only the " + soloWho + "'s meiosis can produce this chromosome complement." +
          (parent === "inherited" ? " " + (QUAL_LINE[c.qual] || "") : "");
        chips = '<span class="orig-who">the ' + soloWho + '</span>' + ktButton(soloC.carrierK, m.typed);
      }
      // The balanced X;Y man is usually infertile, so the same derivative
      // more often arrives from a parent who carries it UNBALANCED, the
      // familial pattern the carrier page's entity card describes.
      if (c.model && c.model.cls === "XY") {
        caveat += (caveat ? " " : "") +
          "A parent can also carry this same derivative unbalanced, the usual familial route, because balanced X;Y men are mostly infertile.";
      }
    } else if (c.type === "homologous") {
      var fact = "no normal " + A + " to pass on: every conception is trisomic or monosomic for chromosome " + A + ".";
      if (named) {
        head = "The " + parent + " carries this fusion";
        caveat = (parent === "mother" ? "She has " : "He has ") + fact + " " + (QUAL_LINE[c.qual] || "");
      } else if (parent === "inherited") {
        head = "A parent carries this fusion";
        caveat = "That parent has " + fact + " " + (QUAL_LINE[c.qual] || "");
      } else {
        head = "Could a parent carry this fusion?";
        caveat = "A carrier has " + fact + " More often the fusion arises de novo, indistinguishable on a karyotype from the isochromosome i(" + A + ")(q10).";
      }
    } else if (named) {
      head = "The notation names the " + parent + " as the carrier";
      caveat = QUAL_LINE[c.qual] || "";
    } else if (parent === "inherited") {
      head = "A parent carries the balanced form";
      caveat = QUAL_LINE[c.qual] || "";
    } else {
      // No de novo caveat line (Dan, 2026-09-04): "may" in the headline carries
      // the alternative, and the decode's origin sentence hedges the same way.
      head = "A parent may be a balanced carrier";
      caveat = "";
    }
    if (chips == null) chips = named
      ? '<span class="orig-who">the ' + parent + '</span>' + ktButton(parent === "mother" ? c.carrier.XX : c.carrier.XY, m.typed)
      : '<span class="orig-who">either</span>' + ktButton(c.carrier.XX, m.typed) +
        '<span class="orig-who">or</span>' + ktButton(c.carrier.XY, m.typed);
    var upd = c.upd.length ? '<p class="oal-body">A carrier also passes a risk of <b>uniparental disomy</b> for ' +
      c.upd.map(function (x) { return UPD_RISK[x]; }).join(" and ") + '.</p>' : "";
    // No "click a parent" hint: the carrier karyotypes are self-evidently clickable
    // chips, and what the click does needs no narration (Dan, 2026-09-05).
    return '<p class="oal-head">' + head + '</p>' +
      '<div class="oal-chips">' + chips + '</div>' +
      (caveat ? '<p class="oal-body">' + caveat + '</p>' : "") + upd;
  }

  // Called on the CARRIER page when the reader arrived through that card (the
  // from= thread). Marks the matching gamete "the karyotype you traced" and
  // returns the small return-card; null when nothing matches, so a hand-edited
  // URL cannot make the panel claim an outcome it does not produce.
  function applyFrom(model, k) {
    if (!model || !model.modes || !k) return null;
    var want = canonKeyNoSex(k);
    if (!want) return null;
    for (var i = 0; i < model.modes.length; i++) {
      for (var j = 0; j < model.modes[i].gametes.length; j++) {
        var g = model.modes[i].gametes[j];
        // Gonosomal gametes carry a list of outcomes (the sperm fork); the
        // autosomal shape is a single zygote. Match against whichever exists.
        var zys = g.outcomes ? g.outcomes.map(function (o) { return o.zygote; }) : [g.zygote];
        var hit = null;
        for (var z = 0; z < zys.length; z++) if (canonKeyNoSex(zys[z]) === want) { hit = zys[z]; break; }
        if (hit == null) continue;
        model.hereZygote = hit;
        model.hereLabel = "the karyotype you traced";
        // Domain words, not navigation words ("the karyotype you came from"
        // narrated the click, not the genetics; Dan, 2026-09-04): the page IS
        // the carrier parent (the drawn karyotype is unambiguously a balanced
        // carrier), and they could give rise to the product, in the same
        // who-plus-chip grammar as the amber card. The de novo hedge stays on
        // the child page; here the karyotype is a carrier, full stop.
        return '<p class="oal-head">This is a carrier parent</p>' +
          '<div class="oal-chips"><span class="orig-who">They could give rise to</span>' + ktButton(k) + '</div>' +
          '<p class="oal-hint">See the <a href="#segregation-card">meiotic segregation</a> below.</p>';
      }
    }
    return null;
  }

  function compute(clone) {
    var ab = soleAberration(clone);
    if (!ab) return null;
    if (isReciprocal(ab)) return computeReciprocal(clone, ab);
    if (isRobertsonian(ab)) return computeRobertsonian(clone, ab);
    if (isHomologousRob(ab)) return computeHomologous(clone, ab);
    if (gonoClass(clone, ab)) return computeGonosomal(clone, ab);
    return null;
  }

  // ---- schematic bodies -----------------------------------------------------
  // A body is a stack of colored blocks (pter at top). The centromere is a pinch whose
  // dot is colored by the chromosome the centromere belongs to (cen), so "homologous
  // centromeres" (a chromosome and its own derivative share one color) are trackable.
  // Blocks are schematic lengths, not to scale.
  function reciprocalBodies(A, B, bandA, bandB) {
    return {
      A: { id: "A", name: A, cen: PERI, blocks: [{ c: PERI, h: 10, arm: "p" }, { cen: true }, { c: PERI, h: 30, arm: "q" }] },
      B: { id: "B", name: B, cen: AMBER, blocks: [{ c: AMBER, h: 10, arm: "p" }, { cen: true }, { c: AMBER, h: 30, arm: "q" }] },
      dA: { id: "dA", name: "der(" + A + ")", cen: PERI, blocks: [{ c: PERI, h: 10, arm: "p" }, { cen: true }, { c: PERI, h: 18, arm: "q" }, { c: AMBER, h: 16, arm: "q" }] },
      dB: { id: "dB", name: "der(" + B + ")", cen: AMBER, blocks: [{ c: AMBER, h: 10, arm: "p" }, { cen: true }, { c: AMBER, h: 18, arm: "q" }, { c: PERI, h: 16, arm: "q" }] }
    };
  }
  function robertsonianBodies(A, B) {
    // Peri/amber encode chromosome of origin, so a HOMOLOGOUS fusion (A === B)
    // paints both long arms peri: amber there would claim second-chromosome
    // material that does not exist.
    var second = String(A) === String(B) ? PERI : AMBER;
    return {
      A: { id: "A", name: A, cen: PERI, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: PERI, h: 34, arm: "q" }] },
      B: { id: "B", name: B, cen: second, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: second, h: 34, arm: "q" }] },
      dF: { id: "dF", name: "der(" + A + ";" + B + ")", cen: INK, blocks: [{ c: PERI, h: 30, arm: "q" }, { cen: true }, { c: second, h: 30, arm: "q" }] }
    };
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  // For a double-quoted attribute value. The karyotypes here are built by this
  // module, but from chromosome names the parser took verbatim out of the input,
  // so a stray quote must not be able to close the attribute early.
  function escAttr(s) { return esc(s).replace(/"/g, "&quot;"); }
  // A conceptus karyotype the reader can load: same data-k contract as the example
  // chips and the "did you mean" fix, so one delegated listener serves all three.
  // fromK rides along as data-from on the carrier chips of the origin card: the
  // click hands it to the next draw, and the carrier page marks that outcome.
  // No title attribute on purpose (Dan, 2026-09-04): the hover already opens the
  // drawn preview, and a second, native tooltip saying "Draw ..." beside it was
  // one hover too many for a click whose meaning the hint lines state.
  function ktButton(k, fromK) {
    var from = fromK ? '" data-from="' + escAttr(fromK) : "";
    return '<button type="button" class="seg-kt" data-k="' + escAttr(k) + from +
      '">' + esc(k) + '</button>';
  }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  // ---- SVG primitives -------------------------------------------------------
  function rect(x, y, w, h, r, fill) {
    return '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="' + r + '" fill="' + fill + '"/>';
  }
  function line(x1, y1, x2, y2, stroke, w, dash) {
    return '<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) +
      '" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  // A spindle pole: a small aster with a few short radiating microtubules.
  function aster(x, y, color) {
    var s = '<g class="seg-pole">';
    for (var i = 0; i < 6; i++) {
      var a = (Math.PI / 3) * i, r0 = 3.2, r1 = 7.5;
      s += line(x + Math.cos(a) * r0, y + Math.sin(a) * r0, x + Math.cos(a) * r1, y + Math.sin(a) * r1, color, 1, "");
    }
    return s + '<circle cx="' + x + '" cy="' + y + '" r="3.1" fill="' + color + '"/></g>';
  }
  // Ratio badge next to a pole (how many chromosomes it receives): reinforces 2:2 / 3:1 / 2:1.
  function poleCount(x, y, n, color) {
    return '<circle cx="' + x + '" cy="' + y + '" r="6.6" fill="#fff" stroke="' + color + '" stroke-width="1.3"/>' +
      '<text x="' + x + '" y="' + (y + 3.2) + '" text-anchor="middle" font-size="9" font-weight="700" fill="' + color + '">' + n + '</text>';
  }

  // One chromosome as a compact vertical glyph centered at (cx,cy), wrapped in a group that
  // can slide toward its pole (the --tx/--ty animation vector). Returns the group markup
  // plus the resting centromere point, so a spindle fiber can be anchored to it.
  function bodyHeight(body) { var h = 0; body.blocks.forEach(function (bk) { if (!bk.cen) h += bk.h; }); return h; }
  function miniGlyph(body, cx, cy, pole, acc, showName) {
    var barW = 12, H = bodyHeight(body), top = cy - H / 2;
    var y = top, blocks = "", cenY = null;
    body.blocks.forEach(function (bk) {
      if (bk.cen) { cenY = y; return; }
      blocks += rect(cx - barW / 2, y, barW, bk.h, 3, bk.c);
      y += bk.h;
    });
    if (cenY == null) cenY = cy;
    var halo = '<rect x="' + (cx - barW / 2 - 5).toFixed(1) + '" y="' + (top - 5).toFixed(1) + '" width="' + (barW + 10) +
      '" height="' + (H + 10) + '" rx="6" fill="' + acc.bg + '" stroke="' + acc.stroke + '" stroke-width="1.3"/>';
    var cen = rect(cx - barW / 2 + 1.5, cenY - 1.8, barW - 3, 3.6, 0, "#fff") +
      '<circle cx="' + cx + '" cy="' + cenY.toFixed(1) + '" r="2.7" fill="' + (body.cen || INK) + '" stroke="#fff" stroke-width="0.9"/>';
    var name = showName ? '<text x="' + cx + '" y="' + (top + H + 10).toFixed(1) +
      '" text-anchor="middle" font-size="' + nameSize(body.name, cx * 2) + '" fill="' + LINE + '">' +
      esc(body.name) + '</text>' : "";
    var tx = clamp((pole[0] - cx) * 0.34, -22, 22), ty = clamp((pole[1] - cy) * 0.34, -22, 22);
    var svg = '<g class="seg-chrom" style="--tx:' + tx.toFixed(1) + 'px;--ty:' + ty.toFixed(1) + 'px">' +
      halo + blocks + cen + name + '</g>';
    return { svg: svg, cenX: cx, cenY: cenY };
  }

  function svgScene(inner, w, h, label) {
    return '<svg class="seg-scene-svg" viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="' + esc(label) + '">' + inner + '</svg>';
  }

  // Dashed division plane (metaphase plate). Adjacent modes cut cleanly with one line;
  // alternate cannot (its pairs are diagonal), so it passes plate=null.
  function plateSvg(p) {
    if (!p) return "";
    if (p.type === "v") return line(p.x, p.y1, p.x, p.y2, "#aeb6d6", 1.4, "4 4");
    if (p.type === "seg") return line(p.x1, p.y1, p.x2, p.y2, "#aeb6d6", 1.4, "4 4");
    return line(p.x1, p.y, p.x2, p.y, "#aeb6d6", 1.4, "4 4");
  }

  // The 3:1 division that pulls one corner of the quadrivalent off alone. Unlike
  // a 2:2 cut (a single straight plane), a 3-versus-1 split is a diagonal that
  // fences off one corner: the lone chromosome to its own pole (count 1), the
  // other three to the opposite pole (count 3). Geometry is derived, not tabled,
  // so all four planes stay consistent: the plate is the perpendicular bisector
  // of the corner-to-centre line, and the poles sit outward from the corner and
  // opposite it. lone is one of A/dA/B/dB.
  var QUAD_P = { A: [56, 64], dA: [156, 64], B: [156, 138], dB: [56, 138] };
  var QUAD_C = [106, 101];
  function cfg31(lone) {
    var c = QUAD_P[lone], dx = c[0] - QUAD_C[0], dy = c[1] - QUAD_C[1];
    var len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;   // corner-outward unit
    var px = -uy, py = ux;                                                   // perpendicular unit
    var mx = (c[0] + QUAD_C[0]) / 2, my = (c[1] + QUAD_C[1]) / 2;            // midpoint corner..centre
    var lonePole = [Math.round(c[0] + ux * 44), Math.round(c[1] + uy * 44)];
    // The three stay-together chromosomes leave from a pole diametrically
    // opposite the lone one, so its aster sits clear of the cluster rather than
    // among it (the corner opposite the lone corner is where the three lean).
    var crowdPole = [2 * QUAD_C[0] - lonePole[0], 2 * QUAD_C[1] - lonePole[1]];
    var assign = {};
    ["A", "dA", "B", "dB"].forEach(function (id) { assign[id] = id === lone ? "lo" : "cr"; });
    return {
      poles: { lo: lonePole, cr: crowdPole }, acc: { lo: ROSE, cr: TEAL },
      assign: assign, counts: { lo: 1, cr: 3 },
      plate: { type: "seg", x1: Math.round(mx + px * 40), y1: Math.round(my + py * 40),
        x2: Math.round(mx - px * 40), y2: Math.round(my - py * 40) }
    };
  }

  // ---- pairing figure (the ring in prophase I) ------------------------------
  // Faint ribbon along a ring edge, tinted by the chromosome material the two bodies
  // share there — this is what physically holds the multivalent together.
  function ribbon(p1, p2, color) {
    return line(p1[0], p1[1], p2[0], p2[1], color, 7, "") ;
  }
  function pairingSvg(model) {
    var b = model.bodies;
    // Anything with four A/dA/B/dB corners takes the ring; only the
    // Robertsonian trivalent is the three-body figure below. The gonosomal
    // female carrier lands here when the to-scale cross is unavailable.
    if (model.type !== "robertsonian") {
      var P = { A: [56, 62], dA: [156, 62], B: [156, 138], dB: [56, 138] };
      var ribbons = '<g opacity="0.28">' +
        ribbon(P.A, P.dA, PERI) +   // top edge: shared A-proximal
        ribbon(P.dA, P.B, AMBER) +  // right edge: shared B-distal
        ribbon(P.B, P.dB, AMBER) +  // bottom edge: shared B-proximal
        ribbon(P.dB, P.A, PERI) +   // left edge: shared A-distal
        '</g>';
      var acc = { stroke: "#c7ccdd", bg: "#fbfbfe" };
      var glyphs = ["A", "dA", "B", "dB"].map(function (id) {
        return miniGlyph(b[id], P[id][0], P[id][1], P[id], acc, true).svg;
      }).join("");
      return svgScene(ribbons + glyphs, 212, 196, "quadrivalent ring: four chromosomes paired at pachytene");
    }
    var Q = { dF: [106, 52], A: [56, 140], B: [156, 140] };
    var rib = '<g opacity="0.28">' + ribbon(Q.dF, Q.A, PERI) + ribbon(Q.dF, Q.B, AMBER) + '</g>';
    var accT = { stroke: "#c7ccdd", bg: "#fbfbfe" };
    var gl = ["dF", "A", "B"].map(function (id) { return miniGlyph(b[id], Q[id][0], Q[id][1], Q[id], accT, true).svg; }).join("");
    return svgScene(rib + gl, 212, 190, "trivalent: fusion chromosome paired with two normal homologues");
  }

  // ---- per-mode segregation scenes ------------------------------------------
  // Layout + pole assignment for the reciprocal quadrivalent. accByPole names each pole's
  // destination accent so gametes below can be keyed to the pole they leave from.
  function recipScene(model, modeName) {
    var b = model.bodies;
    var P = QUAD_P;
    // "3:1-dB" and its siblings each draw one of the four 3:1 division planes.
    if (modeName.indexOf("3:1-") === 0) {
      var lone = modeName.slice(4);
      var loneName = b[lone] ? b[lone].name : lone;
      return buildScene(b, ["A", "dA", "B", "dB"], P, cfg31(lone),
        "quadrivalent dividing 3:1 with " + loneName + " travelling alone");
    }
    var CFG = {
      "Alternate": { poles: { t: [106, 18], bo: [106, 180] }, acc: { t: TEAL, bo: ROSE },
        assign: { A: "t", B: "t", dA: "bo", dB: "bo" }, plate: null, counts: { t: 2, bo: 2 } },
      "Adjacent-1": { poles: { l: [16, 101], r: [196, 101] }, acc: { l: TEAL, r: ROSE },
        assign: { A: "l", dB: "l", B: "r", dA: "r" }, plate: { type: "v", x: 106, y1: 34, y2: 168 }, counts: { l: 2, r: 2 } },
      "Adjacent-2": { poles: { t: [106, 18], bo: [106, 180] }, acc: { t: TEAL, bo: ROSE },
        assign: { A: "t", dA: "t", B: "bo", dB: "bo" }, plate: { type: "h", y: 101, x1: 30, x2: 182 }, counts: { t: 2, bo: 2 } },
      "3:1": { poles: { t: [106, 18], bo: [106, 182] }, acc: { t: ROSE, bo: TEAL },
        assign: { A: "bo", B: "bo", dA: "bo", dB: "t" }, plate: null, counts: { t: 1, bo: 3 } },
      "4:0": { poles: { bo: [106, 182], t: [106, 18] }, acc: { bo: TEAL, t: ROSE },
        assign: { A: "bo", B: "bo", dA: "bo", dB: "bo" }, plate: null, counts: { bo: 4, t: 0 } }
    }[modeName];
    return buildScene(b, ["A", "dA", "B", "dB"], P, CFG, "quadrivalent dividing by " + modeName + " segregation");
  }

  function robScene(model, modeName) {
    var b = model.bodies;
    var P = { dF: [106, 54], A: [56, 140], B: [156, 140] };
    if (modeName === "Adjacent") modeName = "Adjacent-A";   // legacy callers get the same default as pachytene
    // The adjacent suffix names the homologue that travels ALONE (matching
    // pachytene.js). The chromosomes hold their places; only the plane and the
    // pole assignments move, so switching variants reads as a different cut
    // through the same trivalent.
    var CFG = {
      "Alternate": { poles: { t: [106, 18], bo: [106, 182] }, acc: { t: TEAL, bo: ROSE },
        assign: { dF: "t", A: "bo", B: "bo" }, plate: { type: "h", y: 100, x1: 30, x2: 182 }, counts: { t: 1, bo: 2 } },
      "Adjacent-A": { poles: { l: [16, 96], r: [198, 96] }, acc: { l: TEAL, r: ROSE },
        assign: { A: "l", dF: "r", B: "r" }, plate: { type: "v", x: 86, y1: 34, y2: 170 }, counts: { l: 1, r: 2 } },
      "Adjacent-B": { poles: { l: [16, 96], r: [198, 96] }, acc: { l: TEAL, r: ROSE },
        assign: { dF: "l", A: "l", B: "r" }, plate: { type: "v", x: 126, y1: 34, y2: 170 }, counts: { l: 2, r: 1 } }
    }[modeName];
    var label = modeName === "Alternate" ? "trivalent dividing by alternate segregation"
      : "trivalent dividing by adjacent segregation (" + (modeName === "Adjacent-A" ? model.A : model.B) + " alone)";
    return buildScene(b, ["dF", "A", "B"], P, CFG, label);
  }

  function buildScene(bodies, ids, P, CFG, label) {
    var fibers = "", glyphs = "";
    ids.forEach(function (id) {
      var poleKey = CFG.assign[id], pole = CFG.poles[poleKey], acc = CFG.acc[poleKey];
      var m = miniGlyph(bodies[id], P[id][0], P[id][1], pole, acc, true);
      fibers += line(m.cenX, m.cenY, pole[0], pole[1], acc.stroke, 1.4, "");
      glyphs += m.svg;
    });
    var poles = "";
    Object.keys(CFG.poles).forEach(function (k) {
      var p = CFG.poles[k], acc = CFG.acc[k];
      poles += aster(p[0], p[1], acc.stroke);
      // ratio badge tucked toward the frame edge
      var bx = p[0] < 40 ? p[0] + 13 : (p[0] > 172 ? p[0] - 13 : p[0] + 15);
      var by = p[1] < 40 ? p[1] + 1 : (p[1] > 160 ? p[1] - 1 : p[1] - 12);
      poles += poleCount(bx, by, CFG.counts[k], acc.ink);
    });
    return svgScene('<g class="seg-fibers">' + fibers + '</g>' + plateSvg(CFG.plate) + glyphs + poles, 212, 200, label);
  }

  function scene(model, modeName) {
    return model.type === "robertsonian" ? robScene(model, modeName) : recipScene(model, modeName);
  }

  // Which pole a gamete leaves from, if all its chromosomes share one — used to tint the
  // gamete card to match the scene. Mixed-pole gametes (3:1 combinations) get no accent.
  function gameteAccent(model, modeName) {
    // A 3:1 plane sends the lone chromosome to the rose pole and its three-chromosome
    // complement to the teal pole, so each gamete is single-pole and takes a tint.
    if (modeName.indexOf("3:1-") === 0) {
      var lone31 = modeName.slice(4);
      return function (gm) {
        return (gm.bodies.length === 1 && gm.bodies[0] === lone31) ? "rose" : "teal";
      };
    }
    var CFG = model.type === "robertsonian"
      ? { "Alternate": { assign: { dF: "t", A: "bo", B: "bo" }, acc: { t: TEAL, bo: ROSE } },
          "Adjacent-A": { assign: { A: "l", dF: "r", B: "r" }, acc: { l: TEAL, r: ROSE } },
          "Adjacent-B": { assign: { dF: "l", A: "l", B: "r" }, acc: { l: TEAL, r: ROSE } } }[modeName]
      : { "Alternate": { assign: { A: "t", B: "t", dA: "bo", dB: "bo" }, acc: { t: TEAL, bo: ROSE } },
          "Adjacent-1": { assign: { A: "l", dB: "l", B: "r", dA: "r" }, acc: { l: TEAL, r: ROSE } },
          "Adjacent-2": { assign: { A: "t", dA: "t", B: "bo", dB: "bo" }, acc: { t: TEAL, bo: ROSE } },
          "3:1": { assign: { A: "bo", B: "bo", dA: "bo", dB: "t" }, acc: { t: ROSE, bo: TEAL } },
          "4:0": { assign: { A: "bo", B: "bo", dA: "bo", dB: "bo" }, acc: { bo: TEAL, t: ROSE } } }[modeName];
    return function (gm) {
      var poleKey = null;
      for (var i = 0; i < gm.bodies.length; i++) {
        var k = CFG.assign[gm.bodies[i]];
        if (poleKey == null) poleKey = k;
        else if (poleKey !== k) return null;   // gamete spans both poles (3:1): no single origin
      }
      if (poleKey == null) return null;
      return CFG.acc[poleKey] === TEAL ? "teal" : "rose";
    };
  }

  // The plain-language reason each mode carries its name (this is the teaching point).
  function whyCaption(model, modeName) {
    if (model.type === "gonosomal") return gonoWhy(model, modeName);
    if (model.type === "robertsonian") {
      if (modeName === "Alternate") return "The fusion travels to one pole and both normal homologues to the other, so each gamete carries one full dose of every long arm. Both are balanced: one is chromosomally normal, the other a balanced carrier like the parent.";
      // Two ways to fold one mode: the reader picks which plane is drawn, and
      // the sentence naming it swaps with the scene (same data-div key, same
      // radios). The old fixed sentence named the plane the SCHEMATIC drew
      // while the to-scale figure drew the other one; keyed variants cannot
      // disagree with the drawing.
      return "The fusion travels with one normal homologue and the other normal goes alone. One pole then carries two copies of a long arm, the other none, which reads out after fertilisation as a whole-chromosome trisomy or monosomy. " +
        '<span class="seg-why-div" data-div="A">Drawn above: the fusion travels with <b>' + esc(model.B) + "</b> and <b>" + esc(model.A) + "</b> goes alone.</span>" +
        '<span class="seg-why-div" data-div="B">Drawn above: the fusion travels with <b>' + esc(model.A) + "</b> and <b>" + esc(model.B) + "</b> goes alone.</span>" +
        " Each boxed pair below comes from one division plane, and its two gametes are complements: the trisomy and the monosomy of the same chromosome. Click the other pair to change the plane.";
    }
    if (modeName === "Alternate") return "Both chromosomes bound for one pole sit at <b>opposite corners</b> of the ring, so the spindle fibers cross. Taking every other one always pairs a normal with a normal and a derivative with a derivative, so each pole gets a complete set. This is the only balanced pattern.";
    if (modeName === "Adjacent-1") return "The two that travel together are <b>neighbors</b> in the ring, and their centromeres come from different chromosomes. The two matching (homologous) centromeres are therefore pulled apart. Each gamete keeps one normal chromosome and one non-matching derivative: one exchanged segment is duplicated, the other deleted.";
    if (modeName === "Adjacent-2") return "Neighbors again, but here the two <b>matching centromeres</b> (a chromosome and its own derivative) go to the same pole. That is a meiosis I non-disjunction, so it is rarer. The imbalance falls on the proximal, centromere-bearing segments.";
    if (modeName === "4:0") return "All four chromosomes are pulled to the <b>same pole</b>, leaving the other empty. This needs two non-disjunctions at once, so it is the rarest pattern. One gamete is disomic for the whole quadrivalent, the other nullisomic; both conceptions are grossly imbalanced and lost very early.";
    // 3:1 folds four ways, one per corner of the cross that can travel alone. The
    // sentence naming the drawn plane swaps with the scene and the highlighted pair
    // (same data-div key, same radios), so they cannot disagree.
    return "Here the quadrivalent splits three-to-one instead of two-and-two: the odd chromosome may be a <b>derivative</b> (tertiary trisomy or monosomy) or a <b>whole normal chromosome</b> (interchange trisomy or monosomy). " +
      ["dB", "dA", "B", "A"].map(function (d) {
        return '<span class="seg-why-div" data-div="' + d + '">Drawn above: <b>' + esc(model.bodies[d].name) +
          "</b> travels alone to the far pole, the other three together.</span>";
      }).join("") +
      " Each boxed pair below is one division plane: its two gametes are complements, the 47-chromosome trisomy and the 45-chromosome monosomy. Click another pair to change the plane. Interstitial crossing-over adds still more combinations.";
  }

  function viabChip(v) {
    return '<span class="seg-chip seg-' + v.tag + '">' + esc(v.text) + '</span>';
  }
  // The glyph name is centred in a frame whose width is fixed by the drawing, not by
  // the label, so a long name overran it at both ends: "der(13;14)" measures 35.2px
  // at font-size 7 in a 30-wide box and lost 2.6px off each end. Shrink the type
  // instead of widening the box, because the box width is what scales the chromosome
  // beside it, and the name is the secondary thing here. Floor at 5.2 so the longest
  // name in the model, "der(13;14)", stays legible rather than shrinking without
  // limit; below that the label would be doing nobody any good and the aria-label
  // carries the full name regardless.
  function nameSize(s, boxW) {
    var tw = (window.Karyo && window.Karyo.textWidth) ||
      function (t, size) { return String(t).length * 0.55 * size; };
    var natural = 7, w = tw(s, natural), avail = boxW - 2;
    if (w <= avail) return natural;
    return Math.max(5.2, Math.round(natural * (avail / w) * 10) / 10);
  }

  function glyphRow(bodies, ids) {
    // Resting gamete glyphs (no pole pull, neutral halo) drawn small under each outcome.
    var neutral = { stroke: "#dfe3ee", bg: "#ffffff" };
    return '<span class="seg-row">' + ids.map(function (id) {
      return '<svg class="seg-gglyph" viewBox="0 0 30 64" role="img" aria-label="' + esc(bodies[id].name) + '">' +
        miniGlyph(bodies[id], 15, 26, [15, 26], neutral, true).svg + '</svg>';
    }).join("") + '</span>';
  }

  // The homologous fusion panel is text-first: nothing pairs at meiosis (the
  // fusion is a univalent), so there is no valent figure, no division plane,
  // and no animation. The two outcomes and the reason they exhaust the list
  // are the whole lesson. hereZygote still marks the typed outcome when
  // origin() embeds this panel under "Where this came from".
  function renderHomologous(model) {
    var A = esc(model.A), md = model.modes[0];
    var head = '<div class="seg-head"><h2>Meiotic segregation</h2>' +
      '<p class="seg-lead">This carrier’s two chromosome ' + A + 's are fused into one: <b>der(' + A + ';' + A +
      ')</b> is the only chromosome ' + A + ' material in the cell. At meiosis it has <b>nothing to pair with</b>, so it sits as a <b>univalent</b> and travels whole to one pole or the other. ' +
      'Both possible gametes are unbalanced: one carries both copies of ' + A + 'q, the other carries no chromosome ' + A +
      ' at all. Unlike a carrier of two different fused chromosomes, this parent has <b>no alternate mode</b>, so no gamete is balanced and every conception is trisomic or monosomic for chromosome ' + A + '.</p></div>';
    var upd = UPD_RISK[model.A] ? '<p class="orig-upd">If an unbalanced conception is rescued by losing or duplicating a chromosome after fertilisation, both remaining copies can come from one parent: a risk of <b>uniparental disomy</b> for ' +
      UPD_RISK[model.A] + ', which parental testing is needed to address.</p>' : "";
    var hint = '<div class="seg-controls"><span class="seg-hint">Click either conceptus karyotype below to draw and decode that outcome.</span></div>';
    var cards = md.gametes.map(function (gm) {
      var here = (model.hereZygote && gm.zygote === model.hereZygote)
        ? '<span class="seg-here">' + esc(model.hereLabel || "the karyotype you typed") + '</span>' : "";
      return '<div class="seg-gamete' + (here ? " seg-is-here" : "") + '">' +
        '<div class="seg-gpoles">' + glyphRow(model.bodies, gm.bodies) + '</div>' +
        '<div class="seg-gout">' + ktButton(gm.zygote) +
        '<span class="seg-glabel">' + esc(gm.label) + '</span>' + here +
        '<div class="seg-imb">' + esc(gm.imbalance) + '</div>' +
        '<div class="seg-viab">' + viabChip(gm.viability) + '</div></div></div>';
    }).join("");
    var mode = '<div class="seg-mode">' +
      '<div class="seg-mode-h"><b>' + esc(md.name) + '</b> <span class="seg-sub">' + esc(md.sub) + '</span>' +
      '<span class="seg-bad">unbalanced</span></div>' +
      '<p class="seg-why">' + md.blurb + '</p>' +
      '<div class="seg-gametes">' + cards + '</div></div>';
    var note = '<p class="seg-note">The trisomic conceptus follows the spelling ISCN 2024 prints for a homologous fusion, 46,XX,+21,der(21;21)(q10;q10). This is a teaching model of segregation, not a recurrence-risk estimate.</p>';
    return head + upd + hint + '<div class="seg-modes seg-modes-one">' + mode + '</div>' + note;
  }

  // ---- gonosomal rendering ---------------------------------------------------
  // The fertility card wears the app's notice amber (the .oal-warn palette:
  // important information, not an action item).
  function fertilityCard(model) {
    if (!model.fertility) return "";
    return '<div class="seg-fert"><p class="oal-head">' + esc(model.fertility.head) + '</p>' +
      '<p class="oal-body">' + model.fertility.body + '</p></div>';
  }

  // Class-specific head. The female X;autosome carrier is a true ring
  // quadrivalent, so her lead reads like the autosomal one plus the fork; the
  // male carriers pair as a CHAIN held at the pseudoautosomal tips, and their
  // leads say so, because that geometry is the fertility story.
  function gonoHead(model) {
    var A = esc(model.A), B = esc(model.B);
    var lead;
    if (model.cls === "XA-f") {
      lead = "At meiosis, this balanced X;" + B + " carrier pairs her normal X, the der(X), chromosome " + B +
        " and the der(" + B + ") into a <b>quadrivalent</b>, and the same alternate, adjacent and 3:1 modes divide it as for any reciprocal translocation. Two things change downstream: every gamete <b>forks on the sperm</b> (an X makes each outcome a daughter, a Y a son), and the fate of the unbalanced products is set by <b>X-inactivation</b>, not by segment size alone.";
    } else if (model.cls === "XA-m") {
      lead = "At meiosis this carrier's chromosomes pair into a <b>chain</b> rather than a ring: the Y holds on to the quadrivalent only at its <b>pseudoautosomal tips</b>, chromosome " + B +
        " and the derivatives pair along their shared material, and the exchanged X segment on the der(" + B + ") has <b>no partner at all</b>. That unsynapsed chromatin is why spermatogenesis usually fails (the note below); the outcomes describe the sperm that do form. Each sperm carries its own sex chromosome, so <b>the sperm decides each child's sex</b>.";
    } else {
      lead = "At meiosis this carrier's free X holds on to the der(Y) at the <b>pseudoautosomal tip</b>, and chromosome " + B +
        " pairs with the derivatives along the exchanged material, a <b>chain</b> quadrivalent. Where the Y break falls decides most of what follows: an inert Yq12 exchange is the classic harmless familial variant, a euchromatic Yq break sits in the AZF spermatogenesis region, and a break beyond <i>SRY</i> makes the sex letters stop predicting development. Each sperm carries its own sex-chromosome content, so <b>the sperm decides each child's sex</b>.";
    }
    return '<div class="seg-head"><h2>Meiotic segregation</h2><p class="seg-lead">' + lead + '</p></div>' + fertilityCard(model);
  }

  // Pairing figure for the male carriers: the same square, but the free
  // gonosome's two edges are pseudoautosomal contacts, drawn as thin dashed
  // slate instead of full synapsis ribbons. The autosomal edges pair fully.
  function pairingGonosomal(model) {
    var b = model.bodies;
    var P = { A: [56, 62], dA: [156, 62], B: [156, 138], dB: [56, 138] };
    var full = '<g opacity="0.28">' +
      ribbon(P.dA, P.B, AMBER) +   // der(gonosome) with the normal autosome: exchanged autosomal material
      ribbon(P.B, P.dB, AMBER) +   // autosome with its own derivative
      '</g>';
    var par = '<g opacity="0.6">' +
      line(P.A[0], P.A[1], P.dA[0], P.dA[1], SLATE, 2.2, "3 5") +
      line(P.dB[0], P.dB[1], P.A[0], P.A[1], SLATE, 2.2, "3 5") +
      '</g>';
    var acc = { stroke: "#c7ccdd", bg: "#fbfbfe" };
    var glyphs = ["A", "dA", "B", "dB"].map(function (id) {
      return miniGlyph(b[id], P[id][0], P[id][1], P[id], acc, true).svg;
    }).join("");
    return svgScene(full + par + glyphs, 212, 196,
      "chain quadrivalent: the free " + (model.free || "gonosome") + " held only by pseudoautosomal contact (dashed)");
  }

  // Mode captions for the gonosomal quadrivalents. The geometry sentences stay
  // close to the autosomal ones; what is added is who decides the child's sex,
  // and the ring word is dropped for the male carriers' chain.
  function gonoWhy(model, modeName) {
    var male = model.cls !== "XA-f";
    var B = esc(model.B);
    if (modeName === "Alternate") {
      var base = "Both chromosomes bound for one pole sit at <b>opposite corners</b>, so the spindle fibers cross and each pole receives a complete set. This is the only balanced pattern. ";
      if (model.cls === "XA-f") return base + "Whether each balanced gamete becomes a normal or a carrier child, and of which sex, is decided by the sperm.";
      if (model.cls === "XA-m") return base + "The pole with the <b>Y</b> makes the chromosomally normal son; the pole with the <b>two derivatives</b> makes the balanced carrier daughter.";
      return base + "The pole with the <b>free X</b> makes the chromosomally normal daughter; the pole with the <b>two derivatives</b> makes the balanced carrier son.";
    }
    if (modeName === "Adjacent-1") {
      return "The two that travel together are <b>neighbors</b> whose centromeres come from different pairs, so the matching centromeres are pulled apart. Each gamete keeps one intact chromosome and one derivative: one exchanged segment is duplicated and the other deleted" +
        (male ? ", and the sperm's own sex-chromosome content decides the child's sex." : ", and the sperm then decides which sex chromosome joins the imbalance.");
    }
    if (modeName === "Adjacent-2") return whyCaption({ type: "reciprocal", bodies: model.bodies }, modeName);
    if (modeName === "4:0") return whyCaption({ type: "reciprocal", bodies: model.bodies }, modeName);
    // 3:1 keeps the plane-picking machinery and its swap-with-the-scene spans.
    return "Here the quadrivalent splits three-to-one: the odd chromosome may be a <b>derivative</b> (tertiary trisomy or monosomy) or a <b>whole chromosome</b> (interchange trisomy or monosomy). This is where the whole-chromosome sex outcomes live: losing the gonosome gives <b>Turner syndrome</b>, gaining one gives the <b>triple X or Klinefelter</b> pattern, and a conceptus with no X at all is never viable. " +
      ["dB", "dA", "B", "A"].map(function (d) {
        return '<span class="seg-why-div" data-div="' + d + '">Drawn above: <b>' + esc(model.bodies[d].name) +
          "</b> travels alone to the far pole, the other three together.</span>";
      }).join("") +
      " Each boxed pair below is one division plane: its two gametes are complements. Click another pair to change the plane.";
  }

  // The t(X;Y) carrier: a two-derivative sex complement with no free gonosome.
  // There is no quadrivalent to draw and the panel is text-first, like the
  // homologous fusion: the pseudoautosomal geometry, the two sperm, and (for
  // the recurrent form) the unbalanced der(X) family the entity is usually
  // found as.
  function renderGonosomalXY(model) {
    var T = model.carrier.replace(/^46,/, "");
    var head = '<div class="seg-head"><h2>Meiotic segregation</h2>' +
      '<p class="seg-lead">This carrier has <b>no free sex chromosome</b>: his X and Y are both derivatives of the exchange. ' +
      'At male meiosis the X and Y normally pair only at their <b>pseudoautosomal tips</b> and fold into the silenced XY body; whether these two derivatives can still do that is set by which tips the exchange left together, and it decides his fertility before any segregation table applies.</p></div>' +
      fertilityCard(model);
    var entity = "";
    if (model.flags && model.flags.recurrent) {
      entity = '<div class="seg-fert"><p class="oal-head">The recurrent X;Y translocation</p>' +
        '<p class="oal-body">t(X;Y)(p22.3;q11.2) is the most common X;Y translocation, born of exchange near the pseudoautosomal region. Because the balanced male is usually infertile, families carry it as the <b>unbalanced der(X)</b> instead, passed by women: daughters carry it the way their mothers do, and sons who inherit it lose the distal Xp genes outright (short stature, and X-linked ichthyosis when <i>STS</i> is in the deleted span).</p>' +
        '<div class="oal-chips"><span class="orig-who">the familial forms</span>' +
        ktButton("46,X,der(X)" + T) + ktButton("46,Y,der(X)" + T) + '</div>' +
        '<p class="oal-body">The other recurrent X;Y event, exchange between Xp and Yp that moves <i>SRY</i> onto the X, arises de novo in paternal meiosis (46,XX testicular DSD, 46,XY gonadal dysgenesis); it is a mispairing accident, not something a balanced carrier transmits.</p></div>';
    }
    var hint = '<div class="seg-controls"><span class="seg-hint">Click either conceptus karyotype below to draw and decode that outcome.</span></div>';
    var md = model.modes[0];
    var cards = md.gametes.map(function (gm) {
      var o = gm.outcomes[0];
      var here = (model.hereZygote && o.zygote === model.hereZygote)
        ? '<span class="seg-here">' + esc(model.hereLabel || "the karyotype you typed") + '</span>' : "";
      return '<div class="seg-gamete' + (here ? " seg-is-here" : "") + '">' +
        '<div class="seg-gpoles">' + glyphRow(model.bodies, gm.bodies) + '</div>' +
        '<div class="seg-gout">' + ktButton(o.zygote) + '<span class="seg-glabel">' + esc(gm.label) + '</span>' + here +
        '<div class="seg-imb">' + esc(o.imbalance) + '</div>' +
        '<div class="seg-viab">' + viabChip(o.viability) + '</div>' +
        (o.note ? '<p class="seg-gnote">' + o.note + '</p>' : '') + '</div></div>';
    }).join("");
    var mode = '<div class="seg-mode">' +
      '<div class="seg-mode-h"><b>' + esc(md.name) + '</b> <span class="seg-sub">' + esc(md.sub) + '</span>' +
      '<span class="seg-bad">unbalanced</span></div>' +
      '<p class="seg-why">' + md.blurb + '</p>' +
      '<div class="seg-gametes">' + cards + '</div></div>';
    var note = '<p class="seg-note">This is a teaching model of segregation, not a recurrence-risk estimate. The conceptus karyotypes assume the partner contributes a normal X-bearing egg.</p>';
    return head + entity + hint + '<div class="seg-modes seg-modes-one">' + mode + '</div>' + note;
  }

  // Only shown for a constitutional (germline) balanced carrier. The caller suppresses
  // the panel for a recognized acquired/somatic cancer translocation, where meiotic
  // segregation does not apply, so no somatic caveat is needed here.
  function render(model) {
    if (!model) return "";
    if (model.type === "homologous") return renderHomologous(model);
    if (model.type === "gonosomal" && model.cls === "XY") return renderGonosomalXY(model);
    var gono = model.type === "gonosomal";
    var b = model.bodies;
    var typeLabel = model.type === "robertsonian" ? "Robertsonian" : "reciprocal";
    // Prefer the to-scale pachytene figures (real breakpoint geometry) when the ideogram has
    // both chromosomes; otherwise keep the schematic figures below as a second system. The
    // shape word in the lead follows suit: a "cross"/"trivalent" to scale, else a schematic ring.
    //
    // A gonosomal model is drawn to scale only for the FEMALE X;autosome
    // carrier, whose quadrivalent is a true ring of X, der(X), autosome and
    // der(autosome), exactly what the cross draws. The male carriers hold the
    // FREE gonosome in that corner, a chromosome the cross would misdraw as a
    // normal homolog of the exchange, so they keep the schematic chain figure.
    var toScale = !!(typeof window !== "undefined" && window.Pachytene && window.Pachytene.available(model)) &&
      (!gono || model.cls === "XA-f");
    var pairingFig = toScale ? window.Pachytene.pairing(model)
      : (gono && model.cls !== "XA-f" ? pairingGonosomal(model) : pairingSvg(model));
    var sceneOf = toScale
      ? function (n) { return window.Pachytene.scene(model, n); }
      : function (n) { return scene(model, n); };
    var shapeWord = toScale ? (model.type === "robertsonian" ? "trivalent" : "cross") : "ring";
    var head;
    if (gono) head = gonoHead(model);
    else head = '<div class="seg-head"><h2>Meiotic segregation</h2>' +
      '<p class="seg-lead">At meiosis, the chromosomes of this <b>constitutional</b> balanced ' + typeLabel + ' translocation carrier pair into a <b>' + model.valent +
      '</b> (' + model.valentN + ' chromosomes) as the homologs line up in <b>prophase I</b>. How that ' + model.valent +
      ' separates at <b>anaphase I</b> (meiosis I) is shown below, one column per pattern. Each panel draws the ' + shapeWord + ' and the plane it divides along, so the reason for the names alternate and adjacent is visible. Only <b>alternate</b> segregation gives balanced gametes. This panel assumes a germline carrier; an acquired, somatic rearrangement does not segregate at meiosis.</p></div>';

    var config = '<div class="seg-config">' +
      '<div class="seg-config-fig"><div class="seg-config-cap">Pairing in prophase I (pachytene)</div>' + pairingFig + '</div>' +
      '<div class="seg-key">' +
      '<div class="seg-key-row"><span class="seg-key-h">Chromosome of origin</span>' +
      '<span><i style="background:' + PERI + '"></i>chromosome ' + esc(model.A) + ' material</span>' +
      '<span><i style="background:' + AMBER + '"></i>chromosome ' + esc(model.B) + ' material</span>' +
      (gono && model.free && model.cls !== "XA-f"
        ? '<span><i style="background:' + SLATE + '"></i>the free ' + esc(model.free) + ', outside the exchange (dashed pseudoautosomal contact)</span>'
        : '') +
      '<span class="seg-key-sub">Centromere dots take the color of the chromosome they belong to, so a chromosome and its own derivative (homologous centromeres) share a dot color.</span></div>' +
      '<div class="seg-key-row"><span class="seg-key-h">Destination at anaphase I</span>' +
      '<span><i class="seg-swatch" style="background:' + TEAL.bg + ';border-color:' + TEAL.stroke + '"></i>travels to pole 1</span>' +
      '<span><i class="seg-swatch" style="background:' + ROSE.bg + ';border-color:' + ROSE.stroke + '"></i>travels to pole 2</span>' +
      '<span class="seg-key-sub">The dashed line is the division plane; the small numbers count the chromosomes each pole receives.</span></div>' +
      '</div></div>';

    // Visually-hidden checkbox drives the anaphase-pull animation for every scene (pure
    // CSS, so the module stays DOM-free). Kept a sibling of .seg-modes for the ~ selector.
    // The conceptus karyotypes are clickable, but a dotted underline alone is too
    // quiet to be found, so the affordance is stated once here, directly above them.
    // The Robertsonian division radios sit beside the checkbox for the same ~ reason:
    // the checked one shows its adjacent scene, its caption sentence, and its pair.
    // The mode that splits into selectable division-pairs: the Robertsonian Adjacent
    // (two folds) or the reciprocal 3:1 (four planes, one per corner of the cross that
    // can travel alone). Both drive the same radios/scenes/pairs machinery, generalised
    // from two divisions to N. Division order matches the model's gamete order so a
    // pair's two cards sit together.
    var pairedMode = null, divisions = [], sceneNameFor = null;
    model.modes.forEach(function (m) {
      if (model.type === "robertsonian" && m.name === "Adjacent") { pairedMode = m; divisions = ["A", "B"]; sceneNameFor = function (d) { return "Adjacent-" + d; }; }
      if ((model.type === "reciprocal" || gono) && m.name === "3:1") { pairedMode = m; divisions = ["dB", "dA", "B", "A"]; sceneNameFor = function (d) { return "3:1-" + d; }; }
    });
    var hereDiv = divisions[0] || null;
    if (pairedMode && model.hereZygote) {
      pairedMode.gametes.forEach(function (gm) {
        var zys = gm.outcomes ? gm.outcomes.map(function (o) { return o.zygote; }) : [gm.zygote];
        if (zys.indexOf(model.hereZygote) >= 0 && gm.division) hereDiv = gm.division;
      });
    }
    var radios = !pairedMode ? "" : divisions.map(function (d) {
      var aria = model.type === "robertsonian"
        ? "Draw the adjacent division where the fusion travels with " + escAttr(d === "A" ? model.B : model.A) + " and " + escAttr(d === "A" ? model.A : model.B) + " goes alone"
        : "Draw the 3:1 division where " + escAttr(model.bodies[d].name) + " travels alone";
      return '<input type="radio" name="seg-div" id="seg-div-' + d.toLowerCase() + '" class="seg-div-rb"' +
        (d === hereDiv ? " checked" : "") + ' aria-label="' + aria + '">';
    }).join("");
    var controls = '<input type="checkbox" id="seg-anim" class="seg-anim-cb">' + radios +
      '<div class="seg-controls"><label for="seg-anim" class="seg-anim-toggle"><span class="seg-switch"></span>Animate the pull to the poles</label>' +
      '<span class="seg-hint">Click any conceptus karyotype below to draw and decode that outcome.</span></div>';

    function gameteCard(gm, acc) {
      var lab = gm.label ? '<span class="seg-glabel">' + esc(gm.label) + '</span>' : "";
      // A gonosomal gamete carries one or two OUTCOMES instead of a single
      // zygote: the female carrier's fork on the sperm renders as two lanes
      // side by side, the male carrier's single lane fills the card. The
      // autosomal and Robertsonian gametes keep their original one-zygote
      // shape below, untouched.
      if (gm.outcomes) {
        var hereAny = false;
        var lanes = gm.outcomes.map(function (o) {
          var here = (model.hereZygote && o.zygote === model.hereZygote)
            ? '<span class="seg-here">' + esc(model.hereLabel || "the karyotype you typed") + '</span>' : "";
          if (here) hereAny = true;
          var when = o.when ? '<span class="seg-fork-when">' + esc(o.when) + '</span>' : "";
          var imb0 = (o.imbalance && o.imbalance !== "balanced")
            ? '<div class="seg-imb">' + esc(o.imbalance) + '</div>' : "";
          var note = o.note ? '<p class="seg-gnote">' + o.note + '</p>' : "";
          return '<div class="seg-fork-one">' + when + ktButton(o.zygote) + here + imb0 +
            '<div class="seg-viab">' + viabChip(o.viability) + '</div>' + note + '</div>';
        }).join("");
        return '<div class="seg-gamete' + (acc ? " seg-g-" + acc : "") + (hereAny ? " seg-is-here" : "") + '">' +
          '<div class="seg-gpoles">' + glyphRow(b, gm.bodies) + '</div>' +
          '<div class="seg-gout">' + lab +
          '<div class="seg-fork' + (gm.outcomes.length === 1 ? " seg-fork-one-lane" : "") + '">' + lanes + '</div></div></div>';
      }
      var here = (model.hereZygote && gm.zygote === model.hereZygote)
        ? '<span class="seg-here">' + esc(model.hereLabel || "the karyotype you typed") + '</span>' : "";
      var imb = (gm.imbalance && gm.imbalance !== "balanced")
        ? '<div class="seg-imb">' + esc(gm.imbalance) + '</div>' : "";
      return '<div class="seg-gamete' + (acc ? " seg-g-" + acc : "") + (here ? " seg-is-here" : "") + '">' +
        '<div class="seg-gpoles">' + glyphRow(b, gm.bodies) + '</div>' +
        '<div class="seg-gout">' + ktButton(gm.zygote) + lab + here + imb +
        '<div class="seg-viab">' + viabChip(gm.viability) + '</div></div></div>';
    }

    var modes = model.modes.map(function (m) {
      var scenes, gametes;
      if (m === pairedMode) {
        // Every plane renders; the checked radio picks the visible one, so caption,
        // scene, and the highlighted pair cannot disagree. Each pair is one division:
        // complements boxed together, the typed/traced outcome's pair leading and
        // preselected. The whole box is a click target through the overlay label; the
        // conceptus buttons stay above it (z-index) with their own click.
        scenes = divisions.map(function (d) {
          return '<div class="seg-scene seg-scene-div" data-div="' + d + '">' + sceneOf(sceneNameFor(d)) + "</div>";
        }).join("");
        var order = hereDiv ? [hereDiv].concat(divisions.filter(function (d) { return d !== hereDiv; })) : divisions.slice();
        gametes = order.map(function (d) {
          var accentOf = gameteAccent(model, sceneNameFor(d));
          var cards = m.gametes.filter(function (gm) { return gm.division === d; })
            .map(function (gm) { return gameteCard(gm, accentOf(gm)); }).join("");
          var header = model.type === "robertsonian"
            ? "One division: the fusion travels with <b>" + esc(d === "A" ? model.B : model.A) + "</b>"
            : "One division: <b>" + esc(model.bodies[d].name) + "</b> travels alone";
          return '<div class="seg-pair" data-div="' + d + '">' +
            '<label class="seg-pair-hit" for="seg-div-' + d.toLowerCase() + '" aria-hidden="true"></label>' +
            '<div class="seg-pair-h">' + header +
            '<span class="seg-pair-on">drawn above</span><span class="seg-pair-off">click to draw</span></div>' +
            cards + "</div>";
        }).join("");
      } else {
        // Key gametes to their pole color only for a clean single division (two
        // gametes); a 3:1 gamete spans both poles, so those stay neutral.
        var accentOf2 = m.gametes.length === 2 ? gameteAccent(model, m.name) : function () { return null; };
        scenes = '<div class="seg-scene">' + sceneOf(m.name) + "</div>";
        gametes = m.gametes.map(function (gm) { return gameteCard(gm, accentOf2(gm)); }).join("");
      }
      return '<div class="seg-mode' + (m.balanced ? " seg-balanced" : "") + '">' +
        '<div class="seg-mode-h"><b>' + esc(m.name) + '</b> <span class="seg-sub">' + esc(m.sub) + '</span>' +
        (m.balanced ? '<span class="seg-ok">balanced</span>' : '<span class="seg-bad">unbalanced</span>') + '</div>' +
        scenes +
        '<p class="seg-why">' + whyCaption(model, m.name) + '</p>' +
        '<div class="seg-gametes">' + gametes + '</div></div>';
    }).join("");

    var note = '<p class="seg-note">The diagrams are schematic, and the fiber paths illustrate which chromosomes co-segregate, not the physical spindle. This is a teaching model of segregation, not a recurrence-risk estimate: real risks depend on the specific chromosomes and segment sizes.' +
      (gono ? ' The conceptus karyotypes assume the partner contributes a chromosomally normal gamete.' : '') + '</p>';

    return head + config + controls +
      '<div class="seg-modes' + (gono ? ' seg-modes-gono' : '') + '">' + modes + '</div>' + note;
  }

  window.Segregation = {
    eligible: eligible, compute: compute, render: render,
    origin: origin, renderOriginCard: renderOriginCard, applyFrom: applyFrom,
    gonosomalNote: gonosomalNote
  };
})();
