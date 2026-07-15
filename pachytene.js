/* KaryoDraw — to-scale pachytene figures for meiotic segregation.
 *
 *   window.Pachytene.available(model) -> boolean
 *   window.Pachytene.geometry(model)  -> Geometry | null   (exposed for tests)
 *   window.Pachytene.pairing(model)   -> SVG string        (resting configuration)
 *   window.Pachytene.scene(model, modeName) -> SVG string  (one segregation mode)
 *
 * This is the second segregation figure system. Where segregation.js draws every
 * translocation as the same schematic square, this draws the ACTUAL shape: a balanced
 * reciprocal carrier pairs four chromosomes into a cross at pachytene, and each arm is
 * sized from the real hg38 band positions (window.IDEOGRAM) of the rearrangement the
 * parser produced, so a different t() makes a visibly different cross. A Robertsonian
 * fusion has no cross; it folds 90 degrees at its centromere into a trivalent.
 *
 * It consumes the model segregation.js already computes (chromosomes, breakpoints, the
 * enumerated modes) and only draws figures. All gamete karyotypes, viability, and prose
 * stay in segregation.js. Pure geometry plus SVG strings; no DOM, no dependencies. If the
 * ideogram lacks a chromosome, available() returns false and the caller keeps its schematic.
 *
 * The cross arms and the four segregation units:
 *   North (up)    = A-proximal, carries the two chromosome-A centromeres
 *   West (left)   = A-distal (the exchanged A tip)
 *   South (down)  = B-proximal, carries the two chromosome-B centromeres
 *   East (right)  = B-distal (the exchanged B tip)
 * The four units sit at the corners: NW = normal A, NE = der(A), SE = normal B, SW = der(B).
 * A division plane sorts them; the rule enforced everywhere is that a chromosome travels to
 * the pole on ITS OWN side of the plane, so no fiber ever crosses a plane it is sorted by.
 */
(function () {
  "use strict";

  // Colours mirror segregation.js (periwinkle = chromosome A, amber = chromosome B; teal /
  // rose = the two spindle poles). Kept local so the two modules stay independent.
  var PERI = "#5e72e4", AMBER = "#ec9b27", INK = "#1a1f36", LINE = "#3c4463", STALK = "#c2caf6";
  var TEAL = { stroke: "#1f9e8f", bg: "#e2f3f0", ink: "#116d62" };
  var ROSE = { stroke: "#c0568a", bg: "#f8e7ef", ink: "#8f3466" };
  var PLATE = "#aeb6d6";
  var BAR = 8;          // chromosome bar width (px)
  var O = 5;            // half-gap between the two synapsed bars sharing an arm

  function ideo() { return typeof window !== "undefined" ? window.IDEOGRAM : null; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(x) { return (Math.round(x * 10) / 10); }

  // ---- geometry from ideogram band positions -------------------------------
  // A breakpoint band -> its base-pair midpoint, then the proximal (centromere-bearing) and
  // distal (exchanged) segment lengths in Mb. Sub-bands collapse to their enclosing band.
  function segmentOf(chrom, band) {
    var IDE = ideo();
    var c = IDE && IDE.data && IDE.data[chrom];
    if (!c || !c.bands) return null;
    var m = c.bands.filter(function (b) { return b[0] === band; });
    if (!m.length) m = c.bands.filter(function (b) { return b[0].indexOf(band + ".") === 0; });
    if (!m.length) m = c.bands.filter(function (b) { return b[0].indexOf(band) === 0; });
    if (!m.length) return null;
    var lo = Math.min.apply(null, m.map(function (b) { return b[1]; }));
    var hi = Math.max.apply(null, m.map(function (b) { return b[2]; }));
    var bp = (lo + hi) / 2, L = c.length, cen = c.centromere;
    var arm = bp < cen ? "p" : "q";
    var prox = arm === "q" ? bp : (L - bp);   // segment that keeps the centromere
    var dist = L - prox;                       // segment that is exchanged
    return { mbProx: prox / 1e6, mbDist: dist / 1e6, mbCenOff: Math.abs(cen - bp) / 1e6, arm: arm };
  }

  function reciprocalGeom(model) {
    var a = segmentOf(model.A, model.bandA), b = segmentOf(model.B, model.bandB);
    if (!a || !b) return null;
    return {
      type: "cross",
      N: a.mbProx, W: a.mbDist, S: b.mbProx, E: b.mbDist,   // arm lengths, Mb
      cenA: a.mbCenOff, cenB: b.mbCenOff                     // centromere offset from center, Mb
    };
  }
  function robertsonianGeom(model) {
    var IDE = ideo(), ca = IDE && IDE.data && IDE.data[model.A], cb = IDE && IDE.data && IDE.data[model.B];
    if (!ca || !cb) return null;
    return { type: "tri", qA: (ca.length - ca.centromere) / 1e6, qB: (cb.length - cb.centromere) / 1e6 };
  }
  function geometry(model) {
    if (!model) return null;
    return model.type === "robertsonian" ? robertsonianGeom(model) : reciprocalGeom(model);
  }
  function available(model) { return !!geometry(model); }

  // Fit-to-box scale: each figure is sized to its own box (there is only ever one karyotype
  // on screen, so a shared scale buys nothing and only shrinks small chromosomes). The longer
  // of the two spans maps to a target; a floor keeps a tiny exchanged tip visible.
  function crossScale(g) {
    var vSpan = g.N + g.S, hSpan = g.W + g.E;
    var s = 150 / Math.max(vSpan, hSpan);
    // keep the smallest nonzero arm at least ~13px so exchanged tips read
    var minArm = Math.min(g.N, g.W, g.S, g.E);
    if (minArm > 0) s = Math.max(s, 13 / minArm);
    return clamp(s, 0.35, 2.4);
  }

  // ---- svg primitives -------------------------------------------------------
  function line(x1, y1, x2, y2, stroke, w, dash) {
    return '<line x1="' + num(x1) + '" y1="' + num(y1) + '" x2="' + num(x2) + '" y2="' + num(y2) +
      '" stroke="' + stroke + '" stroke-width="' + w + '" stroke-linecap="round"' +
      (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function bar(x1, y1, x2, y2, color) { return line(x1, y1, x2, y2, color, BAR); }
  function txt(x, y, s, anchor, size, color, weight) {
    return '<text x="' + num(x) + '" y="' + num(y) + '" text-anchor="' + (anchor || "middle") +
      '" font-size="' + (size || 8) + '" font-family="ui-sans-serif,system-ui,sans-serif"' +
      (weight ? ' font-weight="' + weight + '"' : '') + ' fill="' + (color || LINE) + '">' + esc(s) + '</text>';
  }
  // Centromere marker: matches segregation.js (white bead, colored core = its own chromosome).
  function cenDot(x, y, color) {
    return '<circle cx="' + num(x) + '" cy="' + num(y) + '" r="3.5" fill="#fff"/>' +
      '<circle cx="' + num(x) + '" cy="' + num(y) + '" r="2.6" fill="' + color + '"/>';
  }
  function aster(x, y, color) {
    var s = "<g>";
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 3 * i;
      s += line(x + Math.cos(a) * 3.4, y + Math.sin(a) * 3.4, x + Math.cos(a) * 7.6, y + Math.sin(a) * 7.6, color, 1.2);
    }
    return s + '<circle cx="' + num(x) + '" cy="' + num(y) + '" r="3" fill="' + color + '"/></g>';
  }
  function badge(x, y, n, color) {
    return '<circle cx="' + num(x) + '" cy="' + num(y) + '" r="7" fill="#fff" stroke="' + color + '" stroke-width="1.3"/>' +
      txt(x, y + 3.2, n, "middle", 9.5, color, "700");
  }
  function plate(x1, y1, x2, y2) { return line(x1, y1, x2, y2, PLATE, 1.4, "4 4"); }
  function svg(inner, w, h, label) {
    return '<svg class="seg-scene-svg" viewBox="0 0 ' + num(w) + ' ' + num(h) + '" role="img" aria-label="' +
      esc(label) + '">' + inner + '</svg>';
  }
  // A segregation unit wrapped so the existing anaphase-pull animation (--tx/--ty on .seg-chrom)
  // can slide it toward its pole. pole is null in the resting pairing figure (no pull). Cap the
  // travel by scaling the whole vector, so the chromosome slides ALONG its spindle fiber. Clamping
  // tx and ty independently would bend the slide off the fiber for a steep diagonal pull (e.g.
  // der(22) heading to the upper-right pole), which reads as the chromosome coming off its track.
  function unit(inner, cenX, cenY, pole, idx) {
    var style = "";
    if (pole) {
      // Slide 0.30 of the way from the centromere to the pole, straight along the fiber (the pole
      // sits inside the frame, so a fraction under 1 never overflows). Give each chromosome a
      // slightly different animation duration (--seg-dur) so the four drift out of lockstep and
      // the two heading to the same pole never move as one blob.
      var dx = (pole[0] - cenX) * 0.30, dy = (pole[1] - cenY) * 0.30;
      var dur = (2.4 + (idx || 0) * 0.07).toFixed(2);
      style = ' style="--tx:' + num(dx) + 'px;--ty:' + num(dy) + 'px;--seg-dur:' + dur + 's"';
    }
    return '<g class="seg-chrom"' + style + '>' + inner + "</g>";
  }

  // ---- reciprocal cross -----------------------------------------------------
  // Build the cross body plus the four units' centromere anchor points. modeName null draws the
  // resting cross (pairing figure); otherwise a plane + poles for that segregation mode.
  function crossFigure(model, modeName) {
    var g = reciprocalGeom(model);
    if (!g) return "";
    var s = crossScale(g), N = g.N * s, W = g.W * s, S = g.S * s, E = g.E * s, cenA = g.cenA * s, cenB = g.cenB * s;
    var mL = 46, mR = 46, mT = 26, mB = 26;
    var cx = mL + W, cy = mT + N, w = cx + E + mR, h = cy + S + mB;
    var A = model.A, B = model.B;

    // Each unit is one L-shaped chromosome: a vertical (proximal) bar carrying its centromere
    // and a horizontal (distal) bar. Offset O from center so the two chromosomes sharing an arm
    // sit side by side; the four interlock into the cross. Each is its own group so the
    // anaphase-pull animation slides it whole toward its pole. Tip labels are drawn only in the
    // resting pairing figure (the key); the mode scenes stay clean, so poles never collide with a
    // label, and identity is read from the pairing figure, the caption, and the gamete cards.
    // Seat each centromere fully on its proximal shaft. The distal bar crosses the elbow row and
    // reaches O + BAR/2 from center, so a bead nearer than that (plus its own radius) overlaps the
    // distal bar and looks off its track — most visible once the animation pulls the chromosomes
    // apart. Clamp the drawn offset so the whole bead clears the distal bar onto the vertical arm;
    // the shift only touches a centromere sitting right at the breakpoint.
    var CENR = 3.5;                          // centromere bead radius (matches cenDot)
    var seat = O + BAR / 2 + CENR + 1.5;     // clear the gap, the distal bar, and the bead radius
    var cenAy = Math.max(cenA, seat), cenBy = Math.max(cenB, seat);
    var cenNW = [cx - O, cy - cenAy], cenNE = [cx + O, cy - cenAy];
    var cenSE = [cx + O, cy + cenBy], cenSW = [cx - O, cy + cenBy];
    var U = {
      NW: { cen: cenNW, body: bar(cx - O, cy - O, cx - O, cy - O - N, PERI) + bar(cx - O, cy - O, cx - O - W, cy - O, PERI) + cenDot(cenNW[0], cenNW[1], PERI),
        label: txt(cx - O - W - 5, cy - O - 3, A, "end", 9.5, INK, "650") },
      NE: { cen: cenNE, body: bar(cx + O, cy - O, cx + O, cy - O - N, PERI) + bar(cx + O, cy - O, cx + O + E, cy - O, AMBER) + cenDot(cenNE[0], cenNE[1], PERI),
        label: txt(cx + O + E + 5, cy - O - 3, "der(" + A + ")", "start", 9, LINE) },
      SE: { cen: cenSE, body: bar(cx + O, cy + O, cx + O, cy + O + S, AMBER) + bar(cx + O, cy + O, cx + O + E, cy + O, AMBER) + cenDot(cenSE[0], cenSE[1], AMBER),
        label: txt(cx + O + E + 5, cy + O + 11, B, "start", 9.5, INK, "650") },
      SW: { cen: cenSW, body: bar(cx - O, cy + O, cx - O, cy + O + S, AMBER) + bar(cx - O, cy + O, cx - O - W, cy + O, PERI) + cenDot(cenSW[0], cenSW[1], AMBER),
        label: txt(cx - O - W - 5, cy + O + 11, "der(" + B + ")", "end", 9, LINE) }
    };

    if (!modeName) {   // resting pairing figure: interlocking labeled cross, no plane or poles
      var rest = ["NW", "NE", "SE", "SW"].map(function (k) { return unit(U[k].body + U[k].label, U[k].cen[0], U[k].cen[1], null); }).join("");
      return svg('<g class="stage">' + rest + "</g>", w, h, "quadrivalent cross for " + model.carrier);
    }

    // ---- mode: plane + poles, honouring the no-fiber-crosses-a-plane rule -----
    var pTop = [cx, Math.max(mT - 8, 6)], pBot = [cx, h - 6];
    var pLeft = [Math.max(mL - W - 8, 7), cy], pRight = [w - 7, cy];
    var planeSvg = "", assign, badges;

    if (modeName === "Alternate") {
      // The two balanced pairs sit at opposite corners (NW+SE, NE+SW), so the poles go on a
      // diagonal and the fibers cross through the center. Same poles as 3:1 (lower-left teal,
      // upper-right rose) so the two diagonal cards line up. No straight plane.
      var pUR = [w - 7, Math.max(mT - 6, 6)], pLL = [pLeft[0], h - 6];
      assign = { NW: [pLL, TEAL], SE: [pLL, TEAL], NE: [pUR, ROSE], SW: [pUR, ROSE] };
      badges = badge(pLL[0] + 14, pLL[1] - 1, "2", TEAL.ink) + badge(pUR[0] - 14, pUR[1] + 1, "2", ROSE.ink);
    } else if (modeName === "Adjacent-1") {
      // left {NW, SW} vs right {NE, SE}: vertical plane at center.
      planeSvg = plate(cx, Math.max(cy - N - 4, 6), cx, Math.min(cy + S + 4, h - 6));
      assign = { NW: [pLeft, TEAL], SW: [pLeft, TEAL], NE: [pRight, ROSE], SE: [pRight, ROSE] };
      badges = badge(pLeft[0], pLeft[1] - 14, "2", TEAL.ink) + badge(pRight[0], pRight[1] - 14, "2", ROSE.ink);
    } else if (modeName === "Adjacent-2") {
      // top {NW, NE} vs bottom {SE, SW}: horizontal plane at center.
      planeSvg = plate(Math.max(cx - W - 4, 6), cy, Math.min(cx + E + 4, w - 6), cy);
      assign = { NW: [pTop, TEAL], NE: [pTop, TEAL], SE: [pBot, ROSE], SW: [pBot, ROSE] };
      badges = badge(pTop[0] + 15, pTop[1] + 1, "2", TEAL.ink) + badge(pBot[0] + 15, pBot[1] - 1, "2", ROSE.ink);
    } else {
      // 3:1 — isolate der(A) (NE) with an L-plane bracketing the upper-right; its pole sits inside
      // the L (upper-right), the other three go to the lower-left pole. No fiber crosses the L.
      planeSvg = plate(cx, Math.max(cy - N - 4, 6), cx, cy) + plate(cx, cy, Math.min(w - 6, cx + E + 6), cy);
      var pOne = [w - 7, Math.max(mT - 6, 6)], pThree = [pLeft[0], h - 6];
      assign = { NE: [pOne, ROSE], NW: [pThree, TEAL], SE: [pThree, TEAL], SW: [pThree, TEAL] };
      badges = badge(pOne[0] - 14, pOne[1] + 1, "1", ROSE.ink) + badge(pThree[0] + 14, pThree[1] - 1, "3", TEAL.ink);
    }

    var fibers = "", units = "", poleSet = {};
    ["NW", "NE", "SE", "SW"].forEach(function (k, i) {
      var pole = assign[k][0], acc = assign[k][1];
      fibers += line(U[k].cen[0], U[k].cen[1], pole[0], pole[1], acc.stroke, 1.4);
      units += unit(U[k].body, U[k].cen[0], U[k].cen[1], pole, i);
      poleSet[pole[0] + "," + pole[1]] = acc;
    });
    var poles = Object.keys(poleSet).map(function (key) {
      var p = key.split(","); return aster(+p[0], +p[1], poleSet[key].stroke);
    }).join("");

    return svg('<g class="seg-fibers">' + fibers + "</g>" + planeSvg + '<g class="stage">' + units + "</g>" + poles + badges,
      w, h, "quadrivalent dividing by " + modeName + " segregation");
  }

  // ---- Robertsonian trivalent, folded 90 degrees ---------------------------
  function triFigure(model, modeName) {
    var g = robertsonianGeom(model);
    if (!g) return "";
    var s = clamp(150 / Math.max(g.qA, g.qB), 0.5, 2.4), qA = g.qA * s, qB = g.qB * s;
    var A = model.A, B = model.B;
    var mT = 34, mB = 30, mL = 40, mR = 40;
    var Cx = mL + qA, Cy = mT + 2 * O, w = Cx + 2 * O + mR, h = Cy + qB + mB;

    var cF = [Cx, Cy], cA = [Cx - 5, Cy - 2 * O], cB = [Cx + 2 * O, Cy + 5];
    // Faint synapsis ribbons stay fixed while the three chromosomes are pulled apart.
    var rib = '<g opacity="0.24">' + line(Cx - 4, Cy - O, Cx - qA + 4, Cy - O, PERI, 6) +
      line(Cx + O, Cy + 4, Cx + O, Cy + qB - 4, AMBER, 6) + "</g>";
    var U = {
      A: { cen: cA, body: bar(Cx, Cy - 2 * O, Cx - qA, Cy - 2 * O, PERI) + cenDot(cA[0], cA[1], PERI),
        label: txt(Cx - qA - 6, Cy - 2 * O + 3.5, A, "end", 9.5, INK, "650") },
      F: { cen: cF, body: bar(Cx, Cy, Cx - qA, Cy, PERI) + bar(Cx, Cy, Cx, Cy + qB, AMBER) + cenDot(cF[0], cF[1], INK),
        label: txt(Cx - qA - 6, Cy + 3.5, "rob(" + A + ";" + B + ")", "end", 9, LINE) },
      B: { cen: cB, body: bar(Cx + 2 * O, Cy, Cx + 2 * O, Cy + qB, AMBER) + cenDot(cB[0], cB[1], AMBER),
        label: txt(Cx + 2 * O, Cy + qB + 12, B, "middle", 9.5, INK, "650") }
    };

    if (!modeName) {   // resting pairing figure carries the labels; mode scenes stay clean
      var rest = ["A", "F", "B"].map(function (k) { return unit(U[k].body + U[k].label, U[k].cen[0], U[k].cen[1], null); }).join("");
      return svg('<g class="stage">' + rib + rest + "</g>", w, h, "trivalent for " + model.carrier);
    }

    var planeSvg = "", assign, badges;
    if (modeName === "Alternate") {
      // fusion isolated by the L (only an L can pick the middle chromosome); fusion pole inside
      // the L (lower-left), both normals outside (upper-right). No fiber crosses the L.
      planeSvg = plate(6, Cy - O, Cx + O, Cy - O) + plate(Cx + O, Cy - O, Cx + O, h - 6);
      var pF = [Math.max(mL * 0.32, 9), h - 10], pN = [w - 9, mT - 2];
      assign = { F: [pF, ROSE], A: [pN, TEAL], B: [pN, TEAL] };
      badges = badge(pF[0] + 14, pF[1] - 1, "1", ROSE.ink) + badge(pN[0] - 14, pN[1] + 1, "2", TEAL.ink);
    } else if (modeName === "Adjacent-A") {
      // normal A alone (horizontal plane): A -> top, fusion + normal B -> bottom.
      planeSvg = plate(6, Cy - O, w - 6, Cy - O);
      var top = [Cx - qA * 0.15, mT - 8], bot = [Cx, h - 10];
      assign = { A: [top, TEAL], F: [bot, ROSE], B: [bot, ROSE] };
      badges = badge(top[0] - 14, top[1] + 1, "1", TEAL.ink) + badge(bot[0] + 15, bot[1] - 1, "2", ROSE.ink);
    } else if (modeName === "Adjacent-B") {
      // normal B alone (vertical plane): B -> right, fusion + normal A -> left.
      planeSvg = plate(Cx + O, 6, Cx + O, h - 6);
      var left = [Math.max(mL * 0.3, 7), Cy], right = [w - 8, Cy + qB * 0.35];
      assign = { B: [right, ROSE], F: [left, TEAL], A: [left, TEAL] };
      badges = badge(left[0], left[1] - 14, "2", TEAL.ink) + badge(right[0] - 14, right[1] - 1, "1", ROSE.ink);
    } else {
      // 3:0 — a single 45-degree plane above all three centromeres; all three travel lower-left,
      // the upper-right pole gets nothing. Clipped to the frame.
      var ax = Cx, ay = Cy - 16, tlo = Math.max(2 - ax, 2 - ay), thi = Math.min((w - 2) - ax, (h - 2) - ay);
      planeSvg = plate(ax + tlo, ay + tlo, ax + thi, ay + thi);
      var p3 = [Math.max(mL * 0.3, 9), h - 9], p0 = [w - 9, mT - 2];
      assign = { A: [p3, TEAL], F: [p3, TEAL], B: [p3, TEAL] };
      badges = badge(p3[0] + 15, p3[1] - 1, "3", TEAL.ink) + badge(p0[0] - 14, p0[1] + 1, "0", ROSE.ink) +
        aster(p0[0], p0[1], ROSE.stroke);
    }

    var fibers = "", units = "", poleSet = {};
    ["A", "F", "B"].forEach(function (k, i) {
      var pole = assign[k][0], acc = assign[k][1];
      fibers += line(U[k].cen[0], U[k].cen[1], pole[0], pole[1], acc.stroke, 1.4);
      units += unit(U[k].body, U[k].cen[0], U[k].cen[1], pole, i);
      poleSet[pole[0] + "," + pole[1]] = acc;
    });
    var poles = Object.keys(poleSet).map(function (key) {
      var p = key.split(","); return aster(+p[0], +p[1], poleSet[key].stroke);
    }).join("");

    return svg('<g class="seg-fibers">' + fibers + "</g>" + planeSvg + '<g class="stage">' + rib + units + "</g>" + poles + badges,
      w, h, "trivalent dividing by " + modeName.toLowerCase() + " segregation");
  }

  // ---- public entry points --------------------------------------------------
  // segregation.js names reciprocal modes Alternate / Adjacent-1 / Adjacent-2 / 3:1 and
  // Robertsonian modes Alternate / Adjacent. The single Robertsonian "Adjacent" mode is drawn
  // as one representative fold (fusion with A); segregation.js's caption already says so, and its
  // four gametes below enumerate both directions.
  function pairing(model) {
    return model.type === "robertsonian" ? triFigure(model, null) : crossFigure(model, null);
  }
  function scene(model, modeName) {
    if (model.type === "robertsonian") {
      return triFigure(model, modeName === "Alternate" ? "Alternate" : "Adjacent-A");
    }
    return crossFigure(model, modeName);
  }

  window.Pachytene = { available: available, geometry: geometry, pairing: pairing, scene: scene };
})();
