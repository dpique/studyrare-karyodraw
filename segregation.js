/* KaryoDraw — meiotic segregation of a balanced translocation carrier.
 *
 *   window.Segregation.eligible(clone) -> boolean
 *   window.Segregation.compute(clone)  -> Model | null
 *   window.Segregation.render(model)   -> HTML string (panel body)
 *
 * Given a balanced RECIPROCAL translocation carrier the parser produced, this models
 * the pachytene QUADRIVALENT and its 2:2 segregation (alternate / adjacent-1 /
 * adjacent-2) plus 3:1, and for a ROBERTSONIAN carrier the TRIVALENT and its 2:1
 * segregation. For each mode it lists the gametes, the conceptus karyotype in ISCN,
 * the resulting imbalance in plain language, and a rough viability. The canonical
 * segregants follow ISCN 2024, Table 5; interstitial crossing-over expands the 3:1
 * set (noted, not enumerated). This is a teaching visualizer of segregation, not a
 * recurrence-risk calculator. Pure logic + schematic SVG strings; no DOM, no deps.
 *
 * Layout convention that makes the modes read positionally in the cross:
 *   top = A(normal)   right = der(A)   bottom = B(normal)   left = der(B)
 * so alternate takes opposite corners, adjacent-1/-2 take neighbours.
 */
(function () {
  "use strict";

  // Figure-level colours, by chromosome of origin (mirror the renderer's encodings:
  // periwinkle "field", amber "signal"). Not UI chrome, so kept local to this module.
  var PERI = "#5e72e4";   // chromosome A material
  var AMBER = "#ec9b27";  // chromosome B material
  var INK = "#1a1f36", LINE = "#3c4463", STALK = "#c2caf6";

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
        blurb: "Three chromosomes go to one pole, one to the other, giving 47- or 45-chromosome conceptions (tertiary trisomy / monosomy). Interstitial crossing-over expands this set further.",
        gametes: [
          g(["A", "B", "dA"], "47," + sex + ",+der(" + A + ")" + T, isEmanuel && A === "22" ? emanuel : t31, "tertiary trisomy"),
          g(["A", "B", "dB"], "47," + sex + ",+der(" + B + ")" + T, isEmanuel && B === "22" ? emanuel : t31, "tertiary trisomy"),
          g(["dA"], "45," + sex + ",der(" + A + ")" + T + ",-" + B, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy"),
          g(["dB"], "45," + sex + ",der(" + B + ")" + T + ",-" + A, { tag: "lethal", text: "Usually lost in early pregnancy (tertiary monosomy)" }, "tertiary monosomy")
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

  // ---- schematic glyphs -----------------------------------------------------
  // A body is a stack of coloured blocks (pter at top). The centromere is a pinch.
  // Blocks are schematic lengths, not to scale; colour = chromosome of origin.
  function reciprocalBodies(A, B, bandA, bandB) {
    // p short, then centromere, then q (proximal + distal). q-arm breakpoints are the
    // common teaching case; a p-arm break still reads as a two-tone exchange.
    return {
      A: { id: "A", name: A, blocks: [{ c: PERI, h: 10, arm: "p" }, { cen: true }, { c: PERI, h: 30, arm: "q" }] },
      B: { id: "B", name: B, blocks: [{ c: AMBER, h: 10, arm: "p" }, { cen: true }, { c: AMBER, h: 30, arm: "q" }] },
      dA: { id: "dA", name: "der(" + A + ")", blocks: [{ c: PERI, h: 10, arm: "p" }, { cen: true }, { c: PERI, h: 18, arm: "q" }, { c: AMBER, h: 16, arm: "q" }] },
      dB: { id: "dB", name: "der(" + B + ")", blocks: [{ c: AMBER, h: 10, arm: "p" }, { cen: true }, { c: AMBER, h: 18, arm: "q" }, { c: PERI, h: 16, arm: "q" }] }
    };
  }
  function robertsonianBodies(A, B) {
    return {
      A: { id: "A", name: A, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: PERI, h: 34, arm: "q" }] },
      B: { id: "B", name: B, blocks: [{ c: STALK, h: 5, arm: "p" }, { cen: true }, { c: AMBER, h: 34, arm: "q" }] },
      dF: { id: "dF", name: "der(" + A + ";" + B + ")", blocks: [{ c: PERI, h: 30, arm: "q" }, { cen: true }, { c: AMBER, h: 30, arm: "q" }] }
    };
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  // One chromosome glyph as an <svg>: a slim stacked bar with a centromere pinch,
  // coloured by origin. The svg widens to fit the label (a fixed width clips names
  // like "der(14;21)"); the bar stays slim and centred.
  function glyphSvg(body, opts) {
    opts = opts || {};
    var barW = 14, pad = 3, showLabel = opts.label !== false, name = body.name;
    var W = Math.max(barW + pad * 2, showLabel ? name.length * 4.3 + 4 : 0);
    var bx = (W - barW) / 2;
    var y = 4, parts = [], cenY = null;
    body.blocks.forEach(function (bk) {
      if (bk.cen) { cenY = y; return; }
      parts.push('<rect x="' + bx.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW + '" height="' + bk.h +
        '" rx="3" fill="' + bk.c + '"/>');
      y += bk.h;
    });
    var H = y + 4;
    var cen = cenY == null ? "" :
      '<rect x="' + (bx + 2).toFixed(1) + '" y="' + (cenY - 2) + '" width="' + (barW - 4) + '" height="4" fill="#fff"/>' +
      '<circle cx="' + (bx + barW / 2).toFixed(1) + '" cy="' + cenY + '" r="2.4" fill="' + INK + '"/>';
    var label = !showLabel ? "" :
      '<text x="' + (W / 2).toFixed(1) + '" y="' + (H + 9) + '" text-anchor="middle" font-size="7.5" fill="' + LINE + '">' + esc(name) + '</text>';
    var totalH = showLabel ? H + 13 : H + 2;
    return '<svg class="seg-glyph" width="' + W.toFixed(1) + '" height="' + totalH + '" viewBox="0 0 ' + W.toFixed(1) + ' ' + totalH +
      '" role="img" aria-label="' + esc(name) + '">' + parts.join("") + cen + label + '</svg>';
  }

  function glyphRow(bodies, ids) {
    return '<span class="seg-row">' + ids.map(function (id) { return glyphSvg(bodies[id]); }).join("") + '</span>';
  }

  // The pairing configuration: cross (quadrivalent) or trivalent, labelled.
  function configSvg(model) {
    var b = model.bodies;
    if (model.type === "reciprocal") {
      // top A, right der(A), bottom B, left der(B).
      return '<div class="seg-cross" aria-label="quadrivalent pairing cross">' +
        '<div class="seg-cross-cell seg-top">' + glyphSvg(b.A) + '</div>' +
        '<div class="seg-cross-cell seg-left">' + glyphSvg(b.dB) + '</div>' +
        '<div class="seg-cross-hub">✚</div>' +
        '<div class="seg-cross-cell seg-right">' + glyphSvg(b.dA) + '</div>' +
        '<div class="seg-cross-cell seg-bottom">' + glyphSvg(b.B) + '</div>' +
        '</div>';
    }
    return '<div class="seg-trivalent" aria-label="trivalent pairing">' +
      glyphSvg(b.A) + glyphSvg(b.dF) + glyphSvg(b.B) + '</div>';
  }

  function viabChip(v) {
    return '<span class="seg-chip seg-' + v.tag + '">' + esc(v.text) + '</span>';
  }

  function render(model, opts) {
    if (!model) return "";
    opts = opts || {};
    var b = model.bodies;
    var typeLabel = model.type === "robertsonian" ? "Robertsonian" : "reciprocal";
    // When the drawn karyotype is a known acquired (cancer) translocation, swap the
    // generic constitutional note for one that flags it as somatic and points to the
    // clinical notes (which name it), rather than inserting the name here (the names
    // are inconsistent, e.g. "Philadelphia chromosome" vs "AML").
    var caveat = opts.acquired
      ? '<p class="seg-caveat">Here this translocation is an <b>acquired</b>, somatic change that arises in the tumour cells (see the clinical notes), not an inherited one. A somatic rearrangement is not passed to eggs or sperm, so it does not segregate. The patterns below are the germline case: what a <b>constitutional</b> carrier of the same translocation would transmit.</p>'
      : '<p class="seg-caveat">This assumes a <b>constitutional</b> (inherited) carrier. An acquired translocation in a tumour is somatic and is not passed to gametes, so segregation does not apply to it.</p>';
    var head = '<div class="seg-head"><h2>Meiotic segregation</h2>' +
      '<p class="seg-lead">At meiosis, the chromosomes of this balanced ' + typeLabel + ' translocation carrier pair into a <b>' + model.valent +
      '</b> (' + model.valentN + ' chromosomes) as the homologs line up in <b>prophase I</b>. How that ' + model.valent +
      ' separates at <b>anaphase I</b> (meiosis I) is shown below, one column per pattern. Only <b>alternate</b> segregation gives balanced gametes.</p>' +
      caveat + '</div>';

    var config = '<div class="seg-config"><div class="seg-config-fig">' +
      '<div class="seg-config-cap">Pairing in prophase I (pachytene)</div>' + configSvg(model) + '</div>' +
      '<div class="seg-legend"><span><i style="background:' + PERI + '"></i>chromosome ' + esc(model.A) + ' material</span>' +
      '<span><i style="background:' + AMBER + '"></i>chromosome ' + esc(model.B) + ' material</span></div></div>';

    var modes = model.modes.map(function (m) {
      var gametes = m.gametes.map(function (gm) {
        var lab = gm.label ? '<span class="seg-glabel">' + esc(gm.label) + '</span>' : "";
        var imb = (gm.imbalance && gm.imbalance !== "balanced")
          ? '<div class="seg-imb">' + esc(gm.imbalance) + '</div>' : "";
        return '<div class="seg-gamete">' +
          '<div class="seg-gpoles">' + glyphRow(b, gm.bodies) + '</div>' +
          '<div class="seg-gout"><code>' + esc(gm.zygote) + '</code>' + lab + imb +
          '<div class="seg-viab">' + viabChip(gm.viability) + '</div></div></div>';
      }).join("");
      return '<div class="seg-mode' + (m.balanced ? " seg-balanced" : "") + '">' +
        '<div class="seg-mode-h"><b>' + esc(m.name) + '</b> <span class="seg-sub">' + esc(m.sub) + '</span>' +
        (m.balanced ? '<span class="seg-ok">balanced</span>' : '<span class="seg-bad">unbalanced</span>') + '</div>' +
        '<p class="seg-blurb">' + esc(m.blurb) + '</p>' +
        '<div class="seg-gametes">' + gametes + '</div></div>';
    }).join("");

    var note = '<p class="seg-note">Segregants follow ISCN 2024, Table 5. This is a teaching model of segregation, not a recurrence-risk estimate: real risks depend on the specific chromosomes, segment sizes, and ascertainment, and are set by a genetic counsellor.</p>';

    return head + config + '<div class="seg-modes">' + modes + '</div>' + note;
  }

  window.Segregation = { eligible: eligible, compute: compute, render: render };
})();
