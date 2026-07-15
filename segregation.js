/* KaryoDraw — meiotic segregation of a balanced translocation carrier.
 *
 *   window.Segregation.eligible(clone) -> boolean
 *   window.Segregation.compute(clone)  -> Model | null
 *   window.Segregation.render(model)   -> HTML string (panel body)
 *
 * Given a balanced RECIPROCAL translocation carrier the parser produced, this models
 * the pachytene QUADRIVALENT and its segregation modes: 2:2 (alternate / adjacent-1 /
 * adjacent-2), 3:1 (tertiary and interchange), and 4:0. For a ROBERTSONIAN carrier it
 * models the TRIVALENT and its 2:1 segregation. For each mode it lists the gametes, the
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
 * ADJACENT-1 (vertical cut) and ADJACENT-2 (horizontal cut) each take two NEIGHBOURS.
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
      ab.breakpoints && ab.breakpoints.length === 2 &&
      ab.breakpoints[0].length === 1 && ab.breakpoints[1].length === 1 &&
      !(ab.chroms[0] in { X: 1, Y: 1 }) && !(ab.chroms[1] in { X: 1, Y: 1 });
  }
  function isRobertsonian(ab) {
    if (!ab || ab.kind !== "der" || !ab.chroms || ab.chroms.length !== 2) return false;
    if (!ACRO[ab.chroms[0]] || !ACRO[ab.chroms[1]]) return false;
    var robNote = /robertsonian/i.test(ab.note || "");
    var wholeArm = ab.breakpoints && ab.breakpoints.length === 2 &&
      ab.breakpoints.every(function (g) { return g.length && g.every(function (b) { return /(p|q)10/.test(b); }); });
    return robNote || wholeArm;
  }
  function eligible(clone) {
    var ab = soleAberration(clone);
    return !!ab && (isReciprocal(ab) || isRobertsonian(ab));
  }

  // ---- shared helpers -------------------------------------------------------
  function sexOf(clone) {
    var t = clone && clone.sex && clone.sex.tokens;
    return (t && t.length) ? t.join("") : "XX";
  }
  function trisomyViability(chrom) {
    return VIABLE_TRISOMY[chrom]
      ? { tag: "viable", text: "Viable — translocation " + VIABLE_TRISOMY[chrom] }
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

    function g(bodies, zygote, viability, label) {
      return { bodies: bodies, zygote: zygote, imbalance: imbalance(bodies), viability: viability, label: label };
    }
    var recipUnbalanced = { tag: "unbalanced", text: "Unbalanced — whether it is liveborn depends on the size of the duplicated and deleted segments" };
    // t(11;22)(q23;q11.2) is the recurrent reciprocal whose 3:1 +der(22) is liveborn.
    var isEmanuel = (A === "11" && B === "22") || (A === "22" && B === "11");
    var emanuel = { tag: "viable", text: "Can be liveborn — the classic 3:1 outcome (supernumerary der(22), Emanuel syndrome)" };
    var t31 = { tag: "unbalanced", text: "Unbalanced (3:1) — usually liveborn only when the extra derivative is small" };

    var modes = [
      { name: "Alternate", sub: "2:2", balanced: true,
        blurb: "Homologous and derivative centromeres go to opposite poles. The only mode that yields balanced gametes.",
        gametes: [
          g(["A", "B"], "46," + sex, { tag: "viable", text: "Viable — chromosomally normal" }, "normal"),
          g(["dA", "dB"], "46," + sex + "," + T, { tag: "viable", text: "Viable — balanced carrier, like the parent" }, "balanced carrier")
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
        gametes: [
          g(["A", "B", "dA"], "47," + sex + ",+der(" + A + ")" + T, isEmanuel && A === "22" ? emanuel : t31, "tertiary trisomy"),
          g(["A", "B", "dB"], "47," + sex + ",+der(" + B + ")" + T, isEmanuel && B === "22" ? emanuel : t31, "tertiary trisomy"),
          g(["dA"], "45," + sex + ",der(" + A + ")" + T + ",-" + B, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy"),
          g(["dB"], "45," + sex + ",der(" + B + ")" + T + ",-" + A, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy"),
          g(["A", "dA", "dB"], "47," + sex + ",+" + A + "," + T, trisomyViability(A), "interchange trisomy"),
          g(["B", "dA", "dB"], "47," + sex + ",+" + B + "," + T, trisomyViability(B), "interchange trisomy"),
          g(["B"], "45," + sex + ",-" + A, monosomyViability(A), "interchange monosomy"),
          g(["A"], "45," + sex + ",-" + B, monosomyViability(B), "interchange monosomy")
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

    function g(bodies, zygote, imbalance, viability, label) {
      return { bodies: bodies, zygote: zygote, imbalance: imbalance, viability: viability, label: label };
    }

    var modes = [
      { name: "Alternate", sub: "2:1", balanced: true,
        blurb: "The fusion chromosome goes to one pole, the two normal homologues to the other. Both gametes are balanced.",
        gametes: [
          g(["A", "B"], "46," + sex, "balanced", { tag: "viable", text: "Viable — chromosomally normal" }, "normal"),
          g(["dF"], "45," + sex + "," + F, "balanced", { tag: "viable", text: "Viable — balanced carrier, like the parent" }, "balanced carrier")
        ] },
      { name: "Adjacent", sub: "2:1", balanced: false,
        blurb: "The fusion chromosome goes with one normal homologue, or a normal homologue goes alone. Each gamete is nullisomic or disomic for a whole long arm, giving a whole-chromosome trisomy or monosomy.",
        gametes: [
          g(["dF", "B"], "46," + sex + "," + F + ",+" + B, "three copies of " + B + "q", trisomyViability(B), "trisomy " + B),
          g(["dF", "A"], "46," + sex + "," + F + ",+" + A, "three copies of " + A + "q", trisomyViability(A), "trisomy " + A),
          g(["A"], "45," + sex + ",-" + B, "one copy of " + B + "q", monosomyViability(B), "monosomy " + B),
          g(["B"], "45," + sex + ",-" + A, "one copy of " + A + "q", monosomyViability(A), "monosomy " + A)
        ] }
    ];

    return {
      type: "robertsonian", valent: "trivalent", valentN: 3,
      A: A, B: B, bandA: bandA, bandB: bandB, sex: sex, carrier: "45," + sex + "," + F,
      bodies: robertsonianBodies(A, B),
      modes: modes
    };
  }

  function compute(clone) {
    var ab = soleAberration(clone);
    if (!ab) return null;
    if (isReciprocal(ab)) return computeReciprocal(clone, ab);
    if (isRobertsonian(ab)) return computeRobertsonian(clone, ab);
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
    return {
      A: { id: "A", name: A, cen: PERI, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: PERI, h: 34, arm: "q" }] },
      B: { id: "B", name: B, cen: AMBER, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: AMBER, h: 34, arm: "q" }] },
      dF: { id: "dF", name: "der(" + A + ";" + B + ")", cen: INK, blocks: [{ c: PERI, h: 30, arm: "q" }, { cen: true }, { c: AMBER, h: 30, arm: "q" }] }
    };
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
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
    var name = showName ? '<text x="' + cx + '" y="' + (top + H + 10).toFixed(1) + '" text-anchor="middle" font-size="7" fill="' + LINE + '">' + esc(body.name) + '</text>' : "";
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
    return line(p.x1, p.y, p.x2, p.y, "#aeb6d6", 1.4, "4 4");
  }

  // ---- pairing figure (the ring in prophase I) ------------------------------
  // Faint ribbon along a ring edge, tinted by the chromosome material the two bodies
  // share there — this is what physically holds the multivalent together.
  function ribbon(p1, p2, color) {
    return line(p1[0], p1[1], p2[0], p2[1], color, 7, "") ;
  }
  function pairingSvg(model) {
    var b = model.bodies;
    if (model.type === "reciprocal") {
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
    var P = { A: [56, 64], dA: [156, 64], B: [156, 138], dB: [56, 138] };
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
    var CFG = {
      "Alternate": { poles: { t: [106, 18], bo: [106, 182] }, acc: { t: TEAL, bo: ROSE },
        assign: { dF: "t", A: "bo", B: "bo" }, plate: { type: "h", y: 100, x1: 30, x2: 182 }, counts: { t: 1, bo: 2 } },
      "Adjacent": { poles: { l: [16, 96], r: [198, 96] }, acc: { l: TEAL, r: ROSE },
        assign: { dF: "l", A: "l", B: "r" }, plate: { type: "v", x: 126, y1: 34, y2: 170 }, counts: { l: 2, r: 1 } }
    }[modeName];
    return buildScene(b, ["dF", "A", "B"], P, CFG, "trivalent dividing by " + modeName.toLowerCase() + " segregation");
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
    var CFG = model.type === "robertsonian"
      ? { "Alternate": { assign: { dF: "t", A: "bo", B: "bo" }, acc: { t: TEAL, bo: ROSE } },
          "Adjacent": { assign: { dF: "l", A: "l", B: "r" }, acc: { l: TEAL, r: ROSE } } }[modeName]
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
    if (model.type === "robertsonian") {
      if (modeName === "Alternate") return "The fusion travels to one pole and both normal homologues to the other, so each gamete carries one full dose of every long arm. Both are balanced: one is chromosomally normal, the other a balanced carrier like the parent.";
      return "The fusion travels with one normal homologue and the other normal goes alone. One pole then carries two copies of a long arm, the other none, which reads out after fertilisation as a whole-chromosome trisomy or monosomy. Shown here the fusion goes with " + model.A + "; the mirror, the fusion with " + model.B + ", is also adjacent.";
    }
    if (modeName === "Alternate") return "Both chromosomes bound for one pole sit at <b>opposite corners</b> of the ring, so the spindle fibers cross. Taking every other one always pairs a normal with a normal and a derivative with a derivative, so each pole gets a complete set. This is the only balanced pattern.";
    if (modeName === "Adjacent-1") return "The two that travel together are <b>neighbors</b> in the ring, and their centromeres come from different chromosomes. The two matching (homologous) centromeres are therefore pulled apart. Each gamete keeps one normal chromosome and one non-matching derivative: one exchanged segment is duplicated, the other deleted.";
    if (modeName === "Adjacent-2") return "Neighbours again, but here the two <b>matching centromeres</b> (a chromosome and its own derivative) go to the same pole. That is a meiosis I non-disjunction, so it is rarer. The imbalance falls on the proximal, centromere-bearing segments.";
    if (modeName === "4:0") return "All four chromosomes are pulled to the <b>same pole</b>, leaving the other empty. This needs two non-disjunctions at once, so it is the rarest pattern. One gamete is disomic for the whole quadrivalent, the other nullisomic; both conceptions are grossly imbalanced and lost very early.";
    return "Here the quadrivalent splits three-to-one instead of two-and-two: the odd chromosome may be a <b>derivative</b> (tertiary trisomy or monosomy) or a <b>whole normal chromosome</b> (interchange trisomy or monosomy), so all four single-chromosome gametes and their three-chromosome complements occur. The conceptus then has 47 or 45. Interstitial crossing-over adds still more combinations.";
  }

  function viabChip(v) {
    return '<span class="seg-chip seg-' + v.tag + '">' + esc(v.text) + '</span>';
  }
  function glyphRow(bodies, ids) {
    // Resting gamete glyphs (no pole pull, neutral halo) drawn small under each outcome.
    var neutral = { stroke: "#dfe3ee", bg: "#ffffff" };
    return '<span class="seg-row">' + ids.map(function (id) {
      return '<svg class="seg-gglyph" viewBox="0 0 30 64" role="img" aria-label="' + esc(bodies[id].name) + '">' +
        miniGlyph(bodies[id], 15, 26, [15, 26], neutral, true).svg + '</svg>';
    }).join("") + '</span>';
  }

  // Only shown for a constitutional (germline) balanced carrier. The caller suppresses
  // the panel for a recognized acquired/somatic cancer translocation, where meiotic
  // segregation does not apply, so no somatic caveat is needed here.
  function render(model) {
    if (!model) return "";
    var b = model.bodies;
    var typeLabel = model.type === "robertsonian" ? "Robertsonian" : "reciprocal";
    // Prefer the to-scale pachytene figures (real breakpoint geometry) when the ideogram has
    // both chromosomes; otherwise keep the schematic figures below as a second system. The
    // shape word in the lead follows suit: a "cross"/"trivalent" to scale, else a schematic ring.
    var toScale = !!(typeof window !== "undefined" && window.Pachytene && window.Pachytene.available(model));
    var pairingFig = toScale ? window.Pachytene.pairing(model) : pairingSvg(model);
    var sceneOf = toScale
      ? function (n) { return window.Pachytene.scene(model, n); }
      : function (n) { return scene(model, n); };
    var shapeWord = toScale ? (model.type === "robertsonian" ? "trivalent" : "cross") : "ring";
    var head = '<div class="seg-head"><h2>Meiotic segregation</h2>' +
      '<p class="seg-lead">At meiosis, the chromosomes of this <b>constitutional</b> balanced ' + typeLabel + ' translocation carrier pair into a <b>' + model.valent +
      '</b> (' + model.valentN + ' chromosomes) as the homologs line up in <b>prophase I</b>. How that ' + model.valent +
      ' separates at <b>anaphase I</b> (meiosis I) is shown below, one column per pattern. Each panel draws the ' + shapeWord + ' and the plane it divides along, so the reason for the names alternate and adjacent is visible. Only <b>alternate</b> segregation gives balanced gametes. This panel assumes a germline carrier; an acquired, somatic rearrangement does not segregate at meiosis.</p></div>';

    var config = '<div class="seg-config">' +
      '<div class="seg-config-fig"><div class="seg-config-cap">Pairing in prophase I (pachytene)</div>' + pairingFig + '</div>' +
      '<div class="seg-key">' +
      '<div class="seg-key-row"><span class="seg-key-h">Chromosome of origin</span>' +
      '<span><i style="background:' + PERI + '"></i>chromosome ' + esc(model.A) + ' material</span>' +
      '<span><i style="background:' + AMBER + '"></i>chromosome ' + esc(model.B) + ' material</span>' +
      '<span class="seg-key-sub">Centromere dots take the color of the chromosome they belong to, so a chromosome and its own derivative (homologous centromeres) share a dot color.</span></div>' +
      '<div class="seg-key-row"><span class="seg-key-h">Destination at anaphase I</span>' +
      '<span><i class="seg-swatch" style="background:' + TEAL.bg + ';border-color:' + TEAL.stroke + '"></i>travels to pole 1</span>' +
      '<span><i class="seg-swatch" style="background:' + ROSE.bg + ';border-color:' + ROSE.stroke + '"></i>travels to pole 2</span>' +
      '<span class="seg-key-sub">The dashed line is the division plane; the small numbers count the chromosomes each pole receives.</span></div>' +
      '</div></div>';

    // Visually-hidden checkbox drives the anaphase-pull animation for every scene (pure
    // CSS, so the module stays DOM-free). Kept a sibling of .seg-modes for the ~ selector.
    var controls = '<input type="checkbox" id="seg-anim" class="seg-anim-cb">' +
      '<div class="seg-controls"><label for="seg-anim" class="seg-anim-toggle"><span class="seg-switch"></span>Animate the pull to the poles</label></div>';

    var modes = model.modes.map(function (m) {
      // Key gametes to their pole color only for a clean single division (two gametes).
      // 3:1 and Robertsonian adjacent draw one representative split of several, so tinting
      // all their gametes to it would overclaim; leave those neutral.
      var accentOf = m.gametes.length === 2 ? gameteAccent(model, m.name) : function () { return null; };
      var gametes = m.gametes.map(function (gm) {
        var acc = accentOf(gm);
        var lab = gm.label ? '<span class="seg-glabel">' + esc(gm.label) + '</span>' : "";
        var imb = (gm.imbalance && gm.imbalance !== "balanced")
          ? '<div class="seg-imb">' + esc(gm.imbalance) + '</div>' : "";
        return '<div class="seg-gamete' + (acc ? " seg-g-" + acc : "") + '">' +
          '<div class="seg-gpoles">' + glyphRow(b, gm.bodies) + '</div>' +
          '<div class="seg-gout"><code>' + esc(gm.zygote) + '</code>' + lab + imb +
          '<div class="seg-viab">' + viabChip(gm.viability) + '</div></div></div>';
      }).join("");
      return '<div class="seg-mode' + (m.balanced ? " seg-balanced" : "") + '">' +
        '<div class="seg-mode-h"><b>' + esc(m.name) + '</b> <span class="seg-sub">' + esc(m.sub) + '</span>' +
        (m.balanced ? '<span class="seg-ok">balanced</span>' : '<span class="seg-bad">unbalanced</span>') + '</div>' +
        '<div class="seg-scene">' + sceneOf(m.name) + '</div>' +
        '<p class="seg-why">' + whyCaption(model, m.name) + '</p>' +
        '<div class="seg-gametes">' + gametes + '</div></div>';
    }).join("");

    var note = '<p class="seg-note">Segregants follow ISCN 2024, Table 5. The diagrams are schematic: chromosome lengths and pole positions are not to scale, and the fiber paths illustrate which chromosomes co-segregate, not the physical spindle. This is a teaching model of segregation, not a recurrence-risk estimate: real risks depend on the specific chromosomes, segment sizes, and ascertainment, and are set by a genetic counselor.</p>';

    return head + config + controls + '<div class="seg-modes">' + modes + '</div>' + note;
  }

  window.Segregation = { eligible: eligible, compute: compute, render: render };
})();
