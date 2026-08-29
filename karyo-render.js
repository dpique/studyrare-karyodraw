/* KaryoDraw — SVG karyogram renderer.
 *
 * Copyright (C) 2026 StudyRare. KaryoDraw is free software: you may
 * redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License, version 3 or later; see LICENSE. If you run a modified
 * version as a network service you must offer its source to your users (AGPL
 * section 13). Commercial licensing: see LICENSING.md.
 *
 * Turns a parsed ISCN clone (from window.ISCN) + the IDEOGRAM band data into
 * crisp SVG chromosome ideograms, including reshaped derivative chromosomes for
 * structural rearrangements.
 *
 * Two independent, user-facing knobs live here:
 *   theme:  "detailed"  full Giemsa banding (realistic, dense)
 *           "simple"    light neutral baseline; ONLY chromosomes involved in an
 *                       aberration get color, keyed by chromosome identity, and
 *                       translocation/derivative pieces are colored by ORIGIN so
 *                       the rearrangement pops. Everything else stays quiet gray.
 *   level:  band resolution. 99 = full (~850). 1 = ~550. 0 = ~400. Lower merges
 *           sub-bands into their parent band → fewer, wider, easier-to-read bands.
 *
 * Public API:
 *   render(container, clone, {theme, level, affected})
 *   computeAffected(clones)   -> { chrom: hexColor } stable across clones
 *   drawDetail(chrom, {theme, level, hue})
 *   resolveBand(chrom, band)  -> {start,end,mid,arm}   (always full resolution)
 *   STAIN, AFFECTED_PALETTE
 */
(function () {
  "use strict";

  var IDEO = window.IDEOGRAM;

  // ----- palettes (StudyRare brand tokens) -----------------------------------
  // Detailed Giemsa ramp — navy family (the brand neutral).
  var STAIN = {
    gneg: "#f0f2f7", gpos25: "#cdd2e1", gpos50: "#808ba8", gpos75: "#5f698a",
    gpos100: "#2e3550", gvar: "#c2caf6", stalk: "#c2caf6", acen: "#3c4463"
  };
  // Figure-level encodings (not UI chrome): error / amber / periwinkle / navy.
  // The brand amber (the CTA accent) is single-sourced so its three uses stay in step.
  var AMBER = "#ec9b27";
  // inv is the segregation figures' teal, reused rather than minted: the old
  // inv blue #5e72e4 was the SAME hex as AFFECTED_PALETTE[0], so an inversion
  // mark vanished against the very chromosome it sat on (found 2026-08-26).
  // mov is the moved-span box (an insertion's segment in its new home): a
  // neutral slate, because the move is balanced, nothing gained or lost.
  var OP_COLORS = { del: "#e0554f", dup: AMBER, inv: "#1f9e8f", mov: "#64748b", add: "#808ba8", break: "#242a45", hsr: "#d6409f" };

  // Affected-chromosome hues. Leads with the brand pair — periwinkle "field"
  // then amber "signal" — so a 2-way rearrangement echoes StudyRare's motif.
  // The first four are stable on purpose: the common one- to four-chromosome
  // figures (and the committed landing-page PNGs) keep their colors. Past that
  // the entries are chosen for mutual distinctness at a glance, because a
  // nine-join derivative assigns ten of these and the old list recycled
  // near-identical periwinkles (#5e72e4 next to #7c8ae9) and reds (#e0554f next
  // to #c53d38), so color stopped identifying the pieces the legend promised it
  // would.
  var AFFECTED_PALETTE = ["#5e72e4", AMBER, "#6b8f55", "#e0554f",
    "#2e8f83", "#d17f18", "#8d4fa8", "#4a5375", "#c2497f", "#37428a",
    "#8a6642", "#4a6b3a"];

  // color math
  function parseHex(h) { h = h.replace("#", ""); if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join(""); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  function toHex(rgb) { return "#" + rgb.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return ("0" + v.toString(16)).slice(-2); }).join(""); }
  function hexMix(a, b, t) { var A = parseHex(a), B = parseHex(b); return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); }
  function tintRamp(hue) {
    return {
      gneg: hexMix(hue, "#ffffff", 0.85), gpos25: hexMix(hue, "#ffffff", 0.58), gpos50: hexMix(hue, "#ffffff", 0.34),
      gpos75: hexMix(hue, "#ffffff", 0.15), gpos100: hue, gvar: hexMix(hue, "#ffffff", 0.4),
      stalk: hexMix(hue, "#ffffff", 0.5), acen: hexMix(hue, "#ffffff", 0.2)
    };
  }
  var BASELINE = tintRamp("#5f698a"); // navy-gray for unaffected chromosomes
  var CEN_COLOR = "#3c4463";
  var OUTLINE = "#4a5375";

  // Hatch textures follow the ideogram convention: the centromere is a tight
  // forward hatch; variable heterochromatin / stalks are a sparser, opposite hatch
  // so the two never read the same.
  var CEN_HATCH = { angle: 45, gap: 3.2, w: 1.8 };
  var HET_HATCH = { angle: -45, gap: 7, w: 1.4 };
  // Same texture with the diagonal mirrored. Used inside an inverted segment so the
  // hatch leans the opposite way and the flipped region reads as rotated end-for-end.
  function mirrorHatch(o) { return { angle: -(o.angle == null ? 45 : o.angle), gap: o.gap, w: o.w }; }

  // ----- geometry ------------------------------------------------------------
  var MAXH = 280, W = 28, maxLen = 0;
  IDEO.chromosomes.forEach(function (c) { maxLen = Math.max(maxLen, IDEO.data[c].length); });
  var PX = MAXH / maxLen;
  function h(bp) { return Math.max(1, bp * PX); }

  // End roundness as a fraction of chromosome width (0.5 = full stadium caps).
  // Blunter than a half-round so terminal bands and terminal deletions stay visible.
  var CAP_RATIO = 0.25;

  // ----- band resolution -----------------------------------------------------
  // Merge sub-bands to a target decimal depth. level 99 = full; 1 = one decimal;
  // 0 = whole band (no decimals). Cached per (chrom, level).
  var _bandCache = {};
  function truncName(name, level) {
    if (level >= 99) return name;
    var m = /^([pq]\d+)(?:\.(\d+))?/.exec(name);
    if (!m) return name;
    if (!m[2] || level === 0) return m[1];
    return m[1] + "." + m[2].slice(0, level);
  }
  var GV = { gneg: 0, gpos25: 25, gpos50: 50, gpos75: 75, gpos100: 100 };
  function mergeStain(subs) {
    if (subs.some(function (s) { return s[3] === "acen"; })) return "acen";
    var tot = 0, wsum = 0, hasG = false;
    subs.forEach(function (s) { if (s[3] in GV) { var w = s[2] - s[1]; tot += GV[s[3]] * w; wsum += w; hasG = true; } });
    if (!hasG) return subs[0][3]; // all gvar/stalk
    var avg = tot / wsum;
    return avg < 12 ? "gneg" : avg < 37 ? "gpos25" : avg < 62 ? "gpos50" : avg < 87 ? "gpos75" : "gpos100";
  }
  function getBands(chrom, level) {
    if (level == null) level = 99;
    var key = chrom + "@" + level;
    if (_bandCache[key]) return _bandCache[key];
    var src = IDEO.data[chrom].bands;
    if (level >= 99) { _bandCache[key] = src; return src; }
    var groups = [];
    src.forEach(function (b) {
      var nm = truncName(b[0], level);
      var last = groups[groups.length - 1];
      if (last && last.name === nm) { last.end = b[2]; last.subs.push(b); }
      else groups.push({ name: nm, start: b[1], end: b[2], subs: [b] });
    });
    // Element 4 keeps the full-resolution sub-bands so a consumer that CLIPS a
    // merged band (a derivative junction landing inside it) can re-derive the
    // stain from what the kept interval actually contains. Without it, the
    // any-sub-band-is-acen rule leaks: at level 0 the remainder of 22q11 grafted
    // onto der(9) of t(9;22) inherited "acen" from a centromere it does not
    // contain, and the figure showed a dicentric derivative at ~400 bands only.
    var out = groups.map(function (g) { return [g.name, g.start, g.end, mergeStain(g.subs), g.subs]; });
    _bandCache[key] = out;
    return out;
  }
  // Stain for the part of a merged band that survives clipping to [from, to]:
  // mergeStain over the sub-bands clamped to that interval, so the weights are
  // the widths actually kept.
  function clippedStain(band, from, to) {
    if (!band[4] || (from <= band[1] && to >= band[2])) return band[3];
    var kept = [];
    band[4].forEach(function (s) {
      if (s[2] <= from || s[1] >= to) return;
      kept.push([s[0], Math.max(s[1], from), Math.min(s[2], to), s[3]]);
    });
    return kept.length ? mergeStain(kept) : band[3];
  }

  // ----- band-name → position (always full resolution) -----------------------
  function resolveBand(chrom, name) {
    var d = IDEO.data[chrom];
    if (!d || !name) return null;
    name = String(name).trim();
    if (name === "pter") return { start: 0, end: 0, mid: 0, arm: "p" };
    if (name === "qter") return { start: d.length, end: d.length, mid: d.length, arm: "q" };
    if (name === "cen") return { start: d.centromere, end: d.centromere, mid: d.centromere, arm: "cen" };
    var m10 = /^([pq])10$/.exec(name);
    if (m10) return { start: d.centromere, end: d.centromere, mid: d.centromere, arm: m10[1] };
    var cands = d.bands.filter(function (b) { return b[0] === name || b[0].indexOf(name + ".") === 0; });
    if (!cands.length) cands = d.bands.filter(function (b) { return b[0].indexOf(name) === 0; });
    if (!cands.length) return null;
    var start = Math.min.apply(null, cands.map(function (b) { return b[1]; }));
    var end = Math.max.apply(null, cands.map(function (b) { return b[2]; }));
    return { start: start, end: end, mid: (start + end) / 2, arm: name[0] };
  }
  // ----- help for a breakpoint that does not exist ---------------------------
  // A band name sorts by its digits, not as text: p22.33 is further out than p21,
  // and "22.33" > "21" only if the region+band digits are read as one number and
  // the sub-bands as its decimals. Returns null for anything but a band name.
  function bandValue(name) {
    var m = /^[pq](\d+)(?:\.(\d+))?$/.exec(String(name || ""));
    if (!m) return null;
    return parseFloat(m[1] + "." + (m[2] || "0"));
  }
  // First and last real band on an arm, so a message can say how far it goes.
  function armExtent(chrom, arm) {
    var d = IDEO.data[chrom];
    if (!d || (arm !== "p" && arm !== "q")) return null;
    var on = d.bands.filter(function (b) { return b[0][0] === arm && bandValue(b[0]) != null; });
    if (!on.length) return null;
    on.sort(function (a, b) { return bandValue(a[0]) - bandValue(b[0]); });
    return { first: on[0][0], last: on[on.length - 1][0] };
  }
  // The closest real band to one that does not exist, staying on the arm asked
  // for. Null when the band already resolves, so callers cannot suggest a
  // "correction" to something that was never wrong.
  function nearestBand(chrom, name) {
    if (resolveBand(chrom, name)) return null;
    var d = IDEO.data[chrom], want = bandValue(name);
    if (!d || want == null) return null;
    var arm = String(name)[0], best = null, bestGap = Infinity;
    d.bands.forEach(function (b) {
      if (b[0][0] !== arm) return;
      var v = bandValue(b[0]);
      if (v == null) return;
      var gap = Math.abs(v - want);
      if (gap < bestGap) { bestGap = gap; best = b[0]; }
    });
    return best;
  }
  // The deepest real band a mistyped SUB-band designation sits inside: q15.32 is
  // q15.3 where the map divides q15 that far, else q15; 9p24.4 is 9p24. Sub-band
  // names nest by prefix (a band q15 divides into q15.1..., and q15.3 into
  // q15.31...), so stripping one trailing character at a time walks the ancestor
  // chain. Dotted names only: an undotted miss (12q32) names a band, not a
  // subdivision of one, and has no ancestor to stand on. The existence test is
  // strict (an exact band, or the named parent of dotted children), NOT
  // resolveBand's loose prefix fallback, so a garbled "q1.5" cannot be blessed
  // as the region "q1". Null when the band resolves or no ancestor exists.
  function bandAncestor(chrom, name) {
    var d = IDEO.data[chrom];
    name = String(name || "").trim();
    if (!d || name.indexOf(".") < 0 || resolveBand(chrom, name)) return null;
    var band = name;
    while (band.length > 2) {
      band = band.slice(0, -1);
      if (band.charAt(band.length - 1) === ".") band = band.slice(0, -1);
      var real = d.bands.some(function (b) { return b[0] === band || b[0].indexOf(band + ".") === 0; });
      if (real) return band;
    }
    return null;
  }

  // Breakpoint bands that do not exist on their chromosome (e.g. 12q32), which
  // the segment builders would otherwise drop in silence. Walks every aberration
  // and sub-op of a parsed model. The page gates the drawing on this, and the
  // review capture records it beside model.json, so a reviewer can see why a
  // figure and its input may differ by one band (the page draws sub-band typos
  // at their bandAncestor and says so).
  function invalidBands(model) {
    var bad = [], seen = {};
    function check(chrom, bands) {
      (bands || []).forEach(function (band) {
        if (!chrom || !band || resolveBand(chrom, band)) return;
        var key = chrom + band;
        if (!seen[key]) { seen[key] = 1; bad.push({ label: key, chrom: chrom, band: band }); }
      });
    }
    (model.clones || []).forEach(function (clone) {
      (clone.aberrations || []).forEach(function (ab) {
        (ab.chroms || []).forEach(function (chrom, i) { check(chrom, (ab.breakpoints || [])[i]); });
        (ab.subOps || []).forEach(function (s) {
          (s.chroms || []).forEach(function (chrom, i) { check(chrom, (s.breakpoints || [])[i]); });
        });
      });
    });
    return bad;
  }

  // The band-snap decision, shared between the page and the review capture so
  // the model the capture exports is built from the SAME karyotype the page
  // draws. The second-pass review caught the split: for t(5;19)(q15.3;q13.3)
  // the page drew the chr5 junction at 5q15 while model.json, built from the
  // unsnapped parse, defaulted the emptied band to the centromere. parse comes
  // in as an argument because Karyo does not depend on the parser. Returns
  // null unless every invalid band is a sub-band typo with a real ancestor,
  // each appears exactly once as a delimited token, and the snapped string
  // parses back with nothing left to refuse; the caller then owns the message.
  function bandSnap(k, model, parse) {
    var bad = invalidBands(model);
    if (!bad.length || bad.length > 3) return null;
    var ancestors = bad.map(function (b) { return bandAncestor(b.chrom, b.band); });
    if (!ancestors.every(Boolean)) return null;
    var snapK = String(k);
    for (var i = 0; i < bad.length; i++) {
      var re = new RegExp("([(;,])" + String(bad[i].band).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?=[);,])", "g");
      if ((snapK.match(re) || []).length !== 1) return null;
      snapK = snapK.replace(re, "$1" + ancestors[i]);
    }
    if (snapK === String(k)) return null;
    var snapModel = parse(snapK);
    var refused = !snapModel.clones.length ||
      snapModel.clones.every(function (c) { return c.modalNumber == null; }) ||
      !!snapModel.suggestion ||
      snapModel.clones.some(function (c) { return c.unreadable || c.countWrong || c.unaccounted; });
    if (refused || invalidBands(snapModel).length) return null;
    return { k: snapK, model: snapModel, bad: bad, ancestors: ancestors };
  }

  // Split a chromosome at a breakpoint into the piece the derivative keeps and the
  // piece it exchanges away. Away from the centromere the kept piece is the centric
  // one, which is what the position test finds.
  //
  // A CENTROMERIC breakpoint (p10, q10, cen) needs its own rule, because both pieces
  // are then centric: each carries half the centromere, so "which side is centric?"
  // has no answer and the position test is degenerate (bp === centromere makes
  // "bp <= centromere" true, which sent q10 down the p-side path). ISCN settles it by
  // formula: der(A) = A pter→bandA :: B bandB→B qter. At the centromere pter→band is
  // the p arm whichever letter is written, so a whole-arm derivative keeps its own p
  // arm and receives the partner's q arm — and the p10/q10 choice records which half
  // of the centromere it carries, not which arms join. Without this, every whole-arm
  // reciprocal came out swapped: t(13;15)(q10;q10) drew der(13) as 15p+13q, which is
  // der(15)'s content, contradicting the imbalance segregation.js states for the very
  // same string. Robertsonian fusions are unaffected: der/rob go to wholeArmSegments,
  // where the breakpoint letters DO name the arms kept.
  function splitAtBreak(chrom, band) {
    var d = IDEO.data[chrom];
    var r = resolveBand(chrom, band);
    var bp = r ? r.mid : d.centromere;
    var atCen = /^[pq]10$/.test(String(band)) || String(band) === "cen";
    var side = atCen ? "q" : (bp <= d.centromere ? "p" : "q");
    if (side === "p") return { centric: [bp, d.length], acentric: [0, bp], bp: bp, side: "p" };
    return { centric: [0, bp], acentric: [bp, d.length], bp: bp, side: "q" };
  }

  // ----- theme-aware color resolvers ---------------------------------------
  function fillFor(ctx, chrom, stain) {
    if (!ctx || ctx.theme === "detailed") return STAIN[stain] || STAIN.gneg;
    var hue = ctx.affected && ctx.affected[chrom];
    var ramp = hue ? tintRamp(hue) : BASELINE;
    return ramp[stain] || ramp.gneg;
  }
  function outlineFor(ctx, chrom) {
    if (!ctx || ctx.theme === "detailed") return OUTLINE;
    var hue = ctx.affected && ctx.affected[chrom];
    return hue ? hexMix(hue, "#000000", 0.12) : "#9aa7b4";
  }

  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // Roughly how wide a label will draw, in the same units as the font size.
  //
  // Every figure in this app builds its SVG as a string, so there is no text metric
  // to ask: a label is positioned before anything has been laid out. The labels that
  // matter are drawn at the edge of a frame and grow outward, so a frame sized by a
  // constant fits a short label and cuts a long one. It did, in two places at once,
  // and neither is visible in the code: pachytene.js drew "rob(13;14)" as "b(13;14)"
  // on every whole-arm translocation, and segregation.js clipped 2.6px off each end
  // of "der(13;14)" in its gamete glyphs.
  //
  // Sans-serif digits and lowercase run about 0.55 em; "(", ")" and ";", which is
  // most of what else appears in a chromosome label, run about 0.32. Checked against
  // Chrome's own getBBox on the strings this app actually draws: der(13;14) at
  // font-size 7 measures 35.2px and this returns 33.7, close enough for a margin
  // that adds its own gap on top. It is one function so that a correction lands
  // everywhere, and so the two callers cannot drift apart.
  function textWidth(s, size) {
    var wide = 0, narrow = 0;
    String(s).split("").forEach(function (ch) { if ("();:.,".indexOf(ch) >= 0) narrow++; else wide++; });
    return (wide * 0.55 + narrow * 0.32) * (size || 9);
  }

  // The body capsule with an inward constriction at each pinch: a rounded rect
  // whose vertical edges pinch symmetrically to a waist at each pinch y.
  // Used for BOTH the clip and the outline, which must be the same shape or the
  // band paint and the border disagree about where the body is.
  //
  // Each pinch carries its OWN half-height and depth, because the two things that
  // pinch a chromosome are not the same size: a centromere is a shallow waist the
  // width of its hatched block, a fragile site a deeper one. They also have to
  // coexist on one body (a fra on a chromosome still has a centromere), and one
  // shared halfH/depth for the whole path could not draw both.
  function waistPath(x, y, w, hh, r, pinches) {
    var xr = x + w, d = ["M" + (x + r) + " " + y, "H" + (xr - r), "A" + r + " " + r + " 0 0 1 " + xr + " " + (y + r)];
    pinches.forEach(function (p) {
      d.push("L" + xr + " " + (p.y - p.half).toFixed(2));
      d.push("C" + (xr - p.depth).toFixed(2) + " " + (p.y - p.half * 0.25).toFixed(2) + " " +
        (xr - p.depth).toFixed(2) + " " + (p.y + p.half * 0.25).toFixed(2) + " " + xr + " " + (p.y + p.half).toFixed(2));
    });
    d.push("L" + xr + " " + (y + hh - r), "A" + r + " " + r + " 0 0 1 " + (xr - r) + " " + (y + hh),
      "H" + (x + r), "A" + r + " " + r + " 0 0 1 " + x + " " + (y + hh - r));
    pinches.slice().reverse().forEach(function (p) {
      d.push("L" + x + " " + (p.y + p.half).toFixed(2));
      d.push("C" + (x + p.depth).toFixed(2) + " " + (p.y + p.half * 0.25).toFixed(2) + " " +
        (x + p.depth).toFixed(2) + " " + (p.y - p.half * 0.25).toFixed(2) + " " + x + " " + (p.y - p.half).toFixed(2));
    });
    d.push("L" + x + " " + (y + r), "A" + r + " " + r + " 0 0 1 " + (x + r) + " " + y, "Z");
    return d.join(" ");
  }

  // Fit every pinch onto a body running from `top` to `bottom` (the flat part,
  // inside both end caps). Each keeps its TRUE y and gives up HEIGHT when it runs
  // out of room, never position: the dashed midline marks the same y, so a waist
  // moved off it would contradict the line drawn beside it.
  //
  // Two things squeeze a pinch. The end cap, when the centromere sits near the tip
  // (an acrocentric, or a derivative left with almost no short arm) — pinch inside
  // the cap and the path folds back through the arc that rounds it. And the
  // NEIGHBOURING pinch: an idic(15)(q11.2) puts its two centromeres about nine
  // units apart, so each takes half the gap and they meet, rather than the second
  // being dropped for crowding — which would have drawn one waist on the very
  // chromosome whose whole point is that it has two.
  //
  // Depth shrinks with height, so a squeezed waist stays a curve and does not
  // spike into a notch. Below MIN_HALF there is no room to pinch at all, and the
  // hatch and the midline mark the spot on their own.
  var MIN_HALF = 2.2;
  function layoutPinches(list, top, bottom) {
    var sorted = list.slice().sort(function (a, b) { return a.y - b.y; });
    return sorted.map(function (p, i) {
      var prev = sorted[i - 1], next = sorted[i + 1];
      var room = Math.min(p.y - top, bottom - p.y);
      if (prev) room = Math.min(room, (p.y - prev.y) / 2);
      if (next) room = Math.min(room, (next.y - p.y) / 2);
      var half = Math.min(p.half, room);
      return half < MIN_HALF ? null : { y: p.y, half: half, depth: p.depth * (half / p.half) };
    }).filter(Boolean);
  }

  // ----- composite ideogram renderer ----------------------------------------
  function renderComposite(segments, opts) {
    opts = opts || {};
    var ctx = opts.ctx || { theme: "detailed", level: 99, affected: {} };
    var simple = ctx.theme === "simple";
    var overlays = opts.overlays || [];
    // The chromosome this composite is filed and labelled as, used for the outline
    // colour and for a seam centromere. drawInstance passes it; the fallback is the
    // old positional guess, kept for the direct renderComposite calls in tests.
    var idChrom = opts.idChrom != null ? String(opts.idChrom)
      : ((segments.filter(function (s) { return s.hasCen; })[0] || segments[0] || {}).chrom);
    var totalBp = segments.reduce(function (s, g) { return s + (g.to - g.from); }, 0);
    var H = h(totalBp);
    var pad = 3, cap = W * CAP_RATIO, CEN_H = 9;
    var svgW = W + pad * 2, svgH = H + pad * 2;
    // Span marks (dup/inv frames and hooks, Highlight theme) ride the margin
    // OUTSIDE the body, so a marked figure widens by nine units each side.
    // Symmetric on purpose: -9 to svgW+9 keeps the body's visual center, so a
    // marked chromosome still lines up with its unmarked homolog in a pair.
    var padX = (simple && overlays.some(function (o) { return o.type === "dup" || o.type === "inv" || o.type === "mov"; })) ? 9 : 0;
    var uid = "c" + (renderComposite._n = (renderComposite._n || 0) + 1);

    // A fragile site is a constriction the whole body has, not paint on top of it,
    // so the waist lives in the body SHAPE: clip and outline both follow the
    // pinched path and the bands end at the waist the way they do under the
    // microscope. Deep enough to read at karyogram scale (the flat gap alone was
    // not), shallow enough that the body plainly continues past it. Centers are
    // clamped clear of the end caps, and pinches too close together collapse into
    // one so the path cannot fold back on itself.
    var FRA_HALF = 5, FRA_DEPTH = 8;
    var pinchTop = pad + cap, pinchBot = pad + H - cap, rawPinches = [];
    overlays.filter(function (o) { return o.type === "fra"; })
      .map(function (o) { return pointY(segments, o.chrom, o.at, pad); })
      .filter(function (v) { return v != null; })
      .forEach(function (v) {
        // A fragile site keeps the old clamp: its own gap rect is clamped the same
        // way, so the two stay together, and there is no midline to contradict.
        rawPinches.push({ y: Math.max(pinchTop + FRA_HALF, Math.min(pinchBot - FRA_HALF, v)), half: FRA_HALF, depth: FRA_DEPTH });
      });
    // The centromere pinches too, and for the same reason: a chromosome IS narrower
    // there, and the app was saying so with paint alone (a hatched block and a dashed
    // midline) on a body of constant width. That reads as one more band on a stack of
    // bands. Two readers arrived at it from opposite ends on 2026-08-28 — one asking
    // why idic(15) showed a single centromere, one asking for a thinner centromere
    // region — and they are the same request: give the primary constriction a shape,
    // and a chromosome carrying two of them is obvious at a glance instead of
    // needing the hatch counted.
    //
    // Filled after the segment loop below, which is what settles cenList (and the
    // seam centromere an isochromosome or a Robertsonian gets). Hence the clip path
    // is pushed into defs down there rather than here; defs is emitted as one block
    // at the end and its internal order does not matter.
    var CEN_HALF = CEN_H / 2, CEN_DEPTH = 5.4;   // deepened 2026-08-28: a visitor found the waist too subtle to spot under the hatch, and the constriction is the teaching point of a pericentric inversion figure
    var bodyShape = null;

    // dynamic diagonal-hatch patterns (heterochromatin texture), de-duped by color
    var defs = [];
    var patCache = {};
    function hatch(color, o) {
      o = o || {};
      var angle = o.angle == null ? 45 : o.angle, gap = o.gap || 4.6, w = o.w || 1.5;
      var key = color + "|" + angle + "|" + gap;
      if (patCache[key]) return patCache[key];
      var id = uid + "p" + Object.keys(patCache).length;
      patCache[key] = id;
      defs.push('<pattern id="' + id + '" width="' + gap + '" height="' + gap + '" patternTransform="rotate(' + angle + ')" patternUnits="userSpaceOnUse">' +
        '<rect width="' + gap + '" height="' + gap + '" fill="#ffffff"/>' +
        '<line x1="0" y1="0" x2="0" y2="' + gap + '" stroke="' + color + '" stroke-width="' + w + '"/></pattern>');
      return id;
    }
    // Heterochromatin (centromere / variable / stalk) color: distinct, on-theme.
    function heteroColor(chrom, stain) {
      if (simple) {
        var hue = ctx.affected && ctx.affected[chrom];
        if (hue) return stain === "acen" ? hexMix(hue, "#1a1f36", 0.22) : hexMix(hue, "#ffffff", 0.28);
        return stain === "acen" ? "#3c4463" : "#808ba8";
      }
      return stain === "acen" ? "#3c4463" : "#7c8ae9";
    }

    var body = [];
    body.push('<g clip-path="url(#' + uid + ')">');
    body.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" fill="#fff"/>');

    var yOff = pad, cenList = [], junctionYs = [], firstBoundaryY = null, boundaryYs = [];
    segments.forEach(function (g, gi) {
      var d = IDEO.data[g.chrom], segTop = yOff, segH = h(g.to - g.from);
      if (gi >= 1) boundaryYs[gi] = segTop;
      if (gi === 1) firstBoundaryY = segTop;   // the seam between the first two segments
      getBands(g.chrom, ctx.level).forEach(function (b) {
        var bs = Math.max(b[1], g.from), be = Math.min(b[2], g.to);
        if (be <= bs) return;
        var y0, y1;
        if (!g.reversed) { y0 = segTop + (bs - g.from) * PX; y1 = segTop + (be - g.from) * PX; }
        else { y0 = segTop + (g.to - be) * PX; y1 = segTop + (g.to - bs) * PX; }
        var st = clippedStain(b, bs, be), fill;
        // A segment flagged hasCen:false has no functional centromere, yet it can still
        // carry acen-stained material across the junction when the breakpoint sits INSIDE
        // the centromere band: Xq11.1 spans 61.0-63.8 Mb, and a break "at Xq11.1" resolves
        // to its midpoint, so der(19)t(X;19)(q11.1;p13.3) grafts 1.4 Mb of real acen onto
        // an acentric segment. Drawn with the centromere hatch that made a monocentric
        // derivative read as dicentric and tooltipped the graft "Centromere" — the same
        // false claim clippedStain fixed for merged bands, arriving by a different route.
        // The waist below is already gated on hasCen; the band paint has to agree with it.
        if (st === "acen" && !g.hasCen) st = "acen_carried";
        // heterochromatin renders as a hatched texture, not a solid band
        if (st === "acen") fill = "url(#" + hatch(heteroColor(g.chrom, st), g.reversed ? mirrorHatch(CEN_HATCH) : CEN_HATCH) + ")";
        else if (st === "gvar" || st === "stalk" || st === "acen_carried") fill = "url(#" + hatch(heteroColor(g.chrom, st), g.reversed ? mirrorHatch(HET_HATCH) : HET_HATCH) + ")";
        else fill = fillFor(ctx, g.chrom, st);
        body.push('<rect class="band" x="' + pad + '" y="' + y0.toFixed(2) + '" width="' + W +
          '" height="' + Math.max(0.6, y1 - y0).toFixed(2) + '" fill="' + fill + '"' +
          ' data-chrom="' + esc(g.chrom) + '" data-band="' + esc(b[0]) + '" data-stain="' + st +
          '" data-arm="' + b[0][0] + '"/>');
      });
      if (g.hasCen && d.centromere > g.from && d.centromere < g.to) {
        cenList.push({ y: g.reversed ? segTop + (g.to - d.centromere) * PX : segTop + (d.centromere - g.from) * PX, chrom: g.chrom, reversed: g.reversed });
      }
      if (gi > 0 && segments[gi - 1].chrom !== g.chrom) junctionYs.push(segTop);
      yOff += segH;
    });
    body.push('</g>');

    // A whole-arm or mirror derivative (a Robertsonian der, an isochromosome) meets
    // its arms at the seam, where the centromere(s) sit — but no centromere fell
    // strictly inside a segment, so cenList is empty. Mark that seam as the
    // centromere so it draws a real constriction (you can see where the centromere
    // is) and provides the alignment y. Drop the plain fusion line there, since the
    // centromere marker now shows the join.
    var cenIsSeam = false;
    if (!cenList.length && segments.length >= 2 && firstBoundaryY != null) {
      // The seam is where the two centromere-bearing arms MEET. For a plain
      // Robertsonian body that is the first boundary, but a whole-arm body carrying
      // a graft is [graft][arm][arm], and the waist drawn at the first boundary sat
      // on the graft junction: der(13;14)(q10;q10)t(9;14)(q22;q24) showed a
      // constriction at the chromosome 9 join, a centromere the model does not
      // claim there, with a plain fusion line where the real seam is.
      var seamY = firstBoundaryY;
      for (var sbi = 1; sbi < segments.length; sbi++) {
        if (segments[sbi - 1].hasCen && segments[sbi].hasCen) { seamY = boundaryYs[sbi]; break; }
      }
      // Coloured as the chromosome the derivative is named for, not as whichever arm
      // is drawn on top. A Robertsonian's seam centromere belongs to neither partner
      // in particular (the notation is lowest-number-first and does not record whose
      // centromere is kept, as the decode says), so the label is the honest tiebreak.
      cenList.push({ y: seamY, chrom: idChrom, reversed: false });
      junctionYs = junctionYs.filter(function (jy) { return Math.abs(jy - seamY) > 0.5; });
      // Flagged, because this y is NOT comparable to a normal homolog's p/q boundary:
      // an acrocentric's centromere sits near its top, a whole-arm fusion's sits
      // between two long arms. Aligning the two would shove the normal homolog down
      // its cell and float the derivative above the row. See alignMode().
      cenIsSeam = true;
    }

    // The body shape, now that every centromere is known.
    cenList.forEach(function (c) { rawPinches.push({ y: c.y, half: CEN_HALF, depth: CEN_DEPTH }); });
    var pinches = layoutPinches(rawPinches, pinchTop, pinchBot);
    bodyShape = pinches.length
      ? '<path d="' + waistPath(pad, pad, W, H, cap, pinches) + '"'
      : '<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"';
    defs.push('<clipPath id="' + uid + '">' + bodyShape + '/></clipPath>');

    // centromere: hatched constriction with a guaranteed-visible height + a thin
    // dashed line at the exact p/q boundary. A texture, so it never reads as a
    // breakpoint marker.
    // pointer-events none, or the hatch and midline swallow the pointer and
    // the tooltip goes silent over the centromere: the acen band rects beneath
    // are the honest answer, so the decoration must let the pointer reach them.
    cenList.forEach(function (c) {
      var col = heteroColor(c.chrom, "acen");
      body.push('<rect x="' + pad + '" y="' + (c.y - CEN_H / 2).toFixed(2) + '" width="' + W + '" height="' + CEN_H +
        '" fill="url(#' + hatch(col, c.reversed ? mirrorHatch(CEN_HATCH) : CEN_HATCH) + ')" clip-path="url(#' + uid + ')" pointer-events="none"/>');
      // Clipped to the body, like the fra hairlines and for the same reason: the
      // midline used to end exactly at the body edge because the body was a rect,
      // and on a waisted body an unclipped line overhangs the constriction it is
      // supposed to sit inside.
      body.push('<line x1="' + pad + '" y1="' + c.y.toFixed(2) + '" x2="' + (pad + W) + '" y2="' + c.y.toFixed(2) +
        '" stroke="' + col + '" stroke-width="1" stroke-dasharray="2.5 2" clip-path="url(#' + uid + ')" pointer-events="none"/>');
    });

    // Overlays are of two kinds, and the Style toggle is the split. Marks that
    // COMMENT on the figure (break carets, the dashed fusion seam below) exist
    // to point at the abnormality, so they draw only in the Highlight (simple)
    // theme. The Realistic theme's own caption promises "nothing highlighted.
    // Try to spot the abnormality yourself", and from the toggle rename
    // (2601e2e) until #196 the renderer broke that promise on every dup, inv
    // and breakpoint. Overlays that ARE material stay in both themes, because
    // a real slide shows them too: add()'s unknown-material hatch, an hsr's
    // homogeneously staining block, and a fragile site's gap.
    overlays.forEach(function (ov) {
      if (ov.type === "cut") {                        // deletion break / repair join
        if (!simple) return;
        var cutY = pointY(segments, ov.chrom, ov.at, pad);
        if (cutY != null) breakMark(cutY, OP_COLORS.del);
        return;
      }
      if (ov.type === "fra") {                        // fragile site: an unstained gap
        // Deliberately NOT a breakMark. The carets say "the chromosome was cut here",
        // and a fragile site is the opposite claim: the material beyond the gap is
        // still attached. A narrow unstained gap with the outline running past it is
        // what the microscopist sees, and it cannot be confused with a deletion.
        var fy = pointY(segments, ov.chrom, ov.at, pad);
        if (fy == null) return;
        var gh = 3.4, gy = Math.max(pad + 0.5, Math.min(pad + H - gh - 0.5, fy - gh / 2));
        // The gap presents itself as a band (class + data attributes) because the
        // hover pipeline keys on those, and this rect covers the exact pixels a
        // reader points at to ask what the constriction is. The stain is the fra
        // pseudo-stain Teach.stainInfo names; the band is the one as written.
        var hover = ov.band ? ' data-chrom="' + esc(ov.chrom) + '" data-band="' + esc(ov.band) + '" data-stain="fra"' : "";
        body.push('<rect class="band fra-gap"' + hover + ' x="' + pad + '" y="' + gy.toFixed(2) + '" width="' + W + '" height="' + gh +
          '" fill="#fff" clip-path="url(#' + uid + ')"/>');
        // Clipped to the body: a rect body happened to end exactly where these
        // lines do, the waisted body does not, and unclipped lines overhang it.
        // pointer-events none, or the hairlines shadow the gap rect they border.
        [gy, gy + gh].forEach(function (yy) {
          body.push('<line x1="' + pad + '" y1="' + yy.toFixed(2) + '" x2="' + (pad + W) + '" y2="' + yy.toFixed(2) +
            '" stroke="' + (simple ? "#64748b" : OP_COLORS.break) + '" stroke-width="0.9" clip-path="url(#' + uid + ')" pointer-events="none"/>');
        });
        return;
      }
      // del, dup and inv are already geometry: the segment list has the piece
      // removed, repeated or reversed, so in the Realistic theme they need no
      // mark at all. (The del wash this branch used to carry had no emitter
      // left and is gone; a del arrives as a "cut" or as reshaped segments.)
      if (!simple && ov.type !== "add" && ov.type !== "hsr") return;
      var span = ov.segIndex != null ? segSpan(segments, ov.segIndex, pad) : mapRange(segments, ov.chrom, ov.from, ov.to, pad);
      if (!span) return;
      var hh = (span.y1 - span.y0).toFixed(2);
      if (ov.type === "add") {
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="url(#' + hatch(OP_COLORS.add) + ')" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "hsr") {
        // Amplified block: a solid vivid band (the homogeneously staining region).
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="' + OP_COLORS.hsr + '" clip-path="url(#' + uid + ')"/>');
      } else if (simple && (ov.type === "dup" || ov.type === "inv" || ov.type === "mov")) {
        drawSpanMark(ov, span);
      }
      if (simple) [span.y0, span.y1].forEach(function (yy) { if (yy > pad + 0.5 && yy < pad + H - 0.5) breakMark(yy, "#1e293b"); });
    });
    // A dup/inv span mark, Highlight theme only (Realistic promises a bare
    // slide, #196). Designed with Dan over six preview rounds, 2026-08-26.
    // One device, one meaning, distinguished by shape rather than color:
    //  - the FRAME means a DUPLICATED span, and nothing else. It wraps the
    //    span from OUTSIDE the body, riding the white margin, so no band
    //    loses width. A box appears exactly when something is extra; a plain
    //    inversion is balanced, so it gets no box (Dan's call, round 6).
    //  - the HOOKS mean drawn END-FOR-END: opposed quarter-turn arrows at
    //    the top-right and bottom-left of the span, lead-ins collinear with
    //    the span-edge line so the line itself appears to swing around.
    //    Always teal. Every inv gets them; a dup gets them exactly when its
    //    copy is inverted (the rec graft, or a proximal-first dup).
    // The devices compose: amber box + teal hooks on the rec graft reads "an
    // extra copy, and it is flipped". Reversal is read off the segment's
    // reversed flag, never re-derived from notation, so the glyph cannot
    // disagree with the drawn geometry. All of it pointer-events none: the
    // tooltip invariant (#197) owns that rule.
    function drawSpanMark(ov, span) {
      // The box means a span with a dosage-or-place story: amber = an extra
      // copy (dup), slate = moved here with nothing gained or lost (mov, an
      // insertion's segment in its new home). An inversion gets no box at all.
      var boxCol = ov.type === "dup" ? OP_COLORS.dup : ov.type === "mov" ? OP_COLORS.mov : null;
      if (boxCol) body.push('<rect x="' + (pad - 2) + '" y="' + span.y0.toFixed(2) + '" width="' + (W + 4) +
        '" height="' + (span.y1 - span.y0).toFixed(2) + '" rx="2.5" fill="none" stroke="' + boxCol +
        '" stroke-width="1.8" pointer-events="none"/>');
      var rev = ov.type === "inv" || (ov.segIndex != null && segments[ov.segIndex] && segments[ov.segIndex].reversed);
      if (!rev) return;
      // Hooks clear the frame when there is one, else the body edge.
      var hk = OP_COLORS.inv, r = 3.6, lead = 2.8, gap = 1.3, edge = boxCol ? 2 : 0;
      var head = function (ex, ey, dir) {
        return '<path d="M' + (ex - 2.1).toFixed(2) + ' ' + ey.toFixed(2) + ' L' + (ex + 2.1).toFixed(2) + ' ' + ey.toFixed(2) +
          ' L' + ex.toFixed(2) + ' ' + (ey + dir * 3.6).toFixed(2) + ' Z" fill="' + hk + '" pointer-events="none"/>';
      };
      var bx1 = pad + W + edge + gap + lead;
      body.push('<path d="M' + (pad + W + edge + gap).toFixed(2) + ' ' + span.y0.toFixed(2) + ' H' + bx1.toFixed(2) +
        ' A' + r + ' ' + r + ' 0 0 1 ' + (bx1 + r).toFixed(2) + ' ' + (span.y0 + r).toFixed(2) +
        '" fill="none" stroke="' + hk + '" stroke-width="1.5" pointer-events="none"/>');
      body.push(head(bx1 + r, span.y0 + r, 1));
      var bx0 = pad - edge - gap - lead;
      body.push('<path d="M' + (pad - edge - gap).toFixed(2) + ' ' + span.y1.toFixed(2) + ' H' + bx0.toFixed(2) +
        ' A' + r + ' ' + r + ' 0 0 1 ' + (bx0 - r).toFixed(2) + ' ' + (span.y1 - r).toFixed(2) +
        '" fill="none" stroke="' + hk + '" stroke-width="1.5" pointer-events="none"/>');
      body.push(head(bx0 - r, span.y1 - r, -1));
    }
    // A breakpoint: thin SOLID line + inward carets. Distinct from the centromere.
    // pointer-events none on all three pieces, or the mark sits exactly on the
    // breakpoint band, the pixels a reader most wants to inspect, and mutes it.
    function breakMark(yy, color) {
      body.push('<line x1="' + pad + '" y1="' + yy.toFixed(2) + '" x2="' + (pad + W) + '" y2="' + yy.toFixed(2) + '" stroke="' + color + '" stroke-width="1.1" pointer-events="none"/>');
      body.push('<path d="M' + (pad - 3.2) + ' ' + (yy - 2.6) + ' L' + (pad + 0.6) + ' ' + yy + ' L' + (pad - 3.2) + ' ' + (yy + 2.6) + ' Z" fill="' + color + '" pointer-events="none"/>');
      body.push('<path d="M' + (pad + W + 3.2) + ' ' + (yy - 2.6) + ' L' + (pad + W - 0.6) + ' ' + yy + ' L' + (pad + W + 3.2) + ' ' + (yy + 2.6) + ' Z" fill="' + color + '" pointer-events="none"/>');
    }

    // Fusion junctions between different chromosome pieces. Highlight theme
    // only: the dashed seam is an annotation, and a real derivative shows one
    // continuous body with no seam, which is what the Realistic theme draws.
    if (simple) junctionYs.forEach(function (jy) {
      body.push('<line x1="' + (pad - 1) + '" y1="' + jy.toFixed(2) + '" x2="' + (pad + W + 1) + '" y2="' + jy.toFixed(2) +
        '" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="2 1.5" pointer-events="none"/>');
    });

    // Outline color follows the chromosome the derivative is named for, not
    // whichever piece happens to be drawn on top (idChrom, resolved above).
    body.push(bodyShape + ' fill="none" stroke="' + outlineFor(ctx, idChrom) + '" stroke-width="1.1"/>');

    return {
      svg: '<svg class="ideo" width="' + (svgW + padX * 2) + '" height="' + svgH + '" viewBox="' + (-padX) + ' 0 ' + (svgW + padX * 2) + ' ' + svgH + '"><defs>' +
        defs.join("") + '</defs>' + body.join("") + '</svg>',
      width: svgW + padX * 2, height: svgH,
      cenY: cenList.length ? cenList[0].y : null,  // centromere y (for aligning homologs)
      cenSeam: cenIsSeam                            // ...but only comparable when false
    };
  }

  function mapRange(segments, chrom, from, to, pad) {
    var yOff = pad;
    for (var i = 0; i < segments.length; i++) {
      var g = segments[i];
      if (g.chrom === chrom) {
        var a = Math.max(from, g.from), b = Math.min(to, g.to);
        if (b > a) {
          if (!g.reversed) return { y0: yOff + (a - g.from) * PX, y1: yOff + (b - g.from) * PX };
          return { y0: yOff + (g.to - b) * PX, y1: yOff + (g.to - a) * PX };
        }
      }
      yOff += h(g.to - g.from);
    }
    return null;
  }
  // y-span (composite space) of a specific segment by its index. Used to shade the
  // appended duplicate copy, which shares its coordinate range with the original
  // and so cannot be located by coordinate alone.
  function segSpan(segments, idx, pad) {
    var y = pad;
    for (var i = 0; i < idx; i++) y += h(segments[i].to - segments[i].from);
    var g = segments[idx];
    return g ? { y0: y, y1: y + h(g.to - g.from) } : null;
  }
  // y (in composite space) of a single bp position on a segment.
  function pointY(segments, chrom, at, pad) {
    var yOff = pad;
    for (var i = 0; i < segments.length; i++) {
      var g = segments[i];
      if (g.chrom === chrom && at >= g.from && at <= g.to) {
        return g.reversed ? yOff + (g.to - at) * PX : yOff + (at - g.from) * PX;
      }
      yOff += h(g.to - g.from);
    }
    return null;
  }

  // ----- instance → segments + overlays -------------------------------------
  function fullSeg(chrom) { return { chrom: chrom, from: 0, to: IDEO.data[chrom].length, hasCen: true, reversed: false }; }

  function buildInstance(inst) {
    var chrom = inst.chrom, ab = inst.aberration, kind = inst.kind;
    if (kind === "normal" || kind === "gain") return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
    if (kind === "mar") {
      var mseg = { chrom: (chrom in IDEO.data ? chrom : "21"), from: 0, to: 24000000, hasCen: true, reversed: false };
      // +r is a marker whose shape is known: draw the ring rather than the generic
      // marker bar, so it is not confused with +mar on the page it appears on.
      if (inst.ring) return { segments: [mseg], overlays: [], caption: "r", marker: true, ring: true };
      return { segments: [mseg], overlays: [], caption: "mar", marker: true };
    }
    if (kind === "dmin") return { segments: [{ chrom: "21", from: 0, to: 6000000, hasCen: false, reversed: false }], overlays: [], caption: "dmin", dmin: true };
    var d0 = IDEO.data[chrom];

    if (kind === "del") {
      // Draw the SHORTENED chromosome (retained material), the way a deletion
      // actually looks on a karyogram — not the full length with a shaded arm.
      var dbnds = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      if (dbnds.length >= 2) {                       // interstitial: remove the middle
        var lo = Math.min(dbnds[0].mid, dbnds[1].mid), hi = Math.max(dbnds[0].mid, dbnds[1].mid);
        var dsegs = [];
        if (lo > 0) dsegs.push({ chrom: chrom, from: 0, to: lo, hasCen: d0.centromere < lo, reversed: false });
        if (hi < d0.length) dsegs.push({ chrom: chrom, from: hi, to: d0.length, hasCen: d0.centromere > hi, reversed: false });
        if (!dsegs.length) dsegs = [fullSeg(chrom)];
        return { segments: dsegs, overlays: [{ type: "cut", chrom: chrom, at: lo }], caption: inst.label };
      }
      if (dbnds.length === 1) {                      // terminal: keep the centromere side
        var db = dbnds[0], dbp = db.mid;
        if (db.arm === "p") return { segments: [{ chrom: chrom, from: dbp, to: d0.length, hasCen: d0.centromere > dbp, reversed: false }], overlays: [{ type: "cut", chrom: chrom, at: dbp }], caption: inst.label };
        return { segments: [{ chrom: chrom, from: 0, to: dbp, hasCen: d0.centromere < dbp, reversed: false }], overlays: [{ type: "cut", chrom: chrom, at: dbp }], caption: inst.label };
      }
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
    }
    if (kind === "dup" || kind === "trp") {
      // A duplication adds a copy of the segment, so the chromosome is drawn
      // LONGER, with the copy spliced in tandem right after the original. ISCN
      // encodes orientation by breakpoint order: proximal-first (lower coordinate)
      // is a direct/tandem dup; distal-first means the copy is inverted (the inv
      // dup mirror). A triplication (trp) adds two copies.
      var db = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      if (db.length) {
        var dlo, dhi, dinv = false;
        if (db.length >= 2) {
          dlo = Math.min(db[0].mid, db[1].mid); dhi = Math.max(db[0].mid, db[1].mid);
          dinv = db[0].mid > db[1].mid;
        } else { dlo = db[0].start; dhi = db[0].end; }
        var dlen = d0.length, dcen = d0.centromere;
        var dseg = function (from, to, rev) { return { chrom: chrom, from: from, to: to, hasCen: (dcen > from && dcen < to), reversed: rev }; };
        var dsegs = [dseg(0, dhi, false)], dov = [], nCopies = (kind === "trp") ? 2 : 1;
        for (var dci = 0; dci < nCopies; dci++) {
          dsegs.push(dseg(dlo, dhi, dinv));
          dov.push({ type: "dup", chrom: chrom, segIndex: dsegs.length - 1 });
        }
        if (dhi < dlen) dsegs.push(dseg(dhi, dlen, false));
        return { segments: dsegs, overlays: dov, caption: inst.label };
      }
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
    }
    if (kind === "inv") {
      var ib = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      if (ib.length >= 2) {
        // Physically flip the inverted segment: draw it as three pieces, the
        // middle one reversed, so the banding actually reads end-for-end.
        var ip1 = Math.min(ib[0].mid, ib[1].mid), ip2 = Math.max(ib[0].mid, ib[1].mid), ilen = d0.length, icen = d0.centromere;
        var iseg = function (from, to, rev) { return { chrom: chrom, from: from, to: to, hasCen: (icen > from && icen < to), reversed: rev }; };
        var isegs = [];
        if (ip1 > 0) isegs.push(iseg(0, ip1, false));
        isegs.push(iseg(ip1, ip2, true));
        if (ip2 < ilen) isegs.push(iseg(ip2, ilen, false));
        return { segments: isegs, overlays: [{ type: "inv", chrom: chrom, from: ip1, to: ip2 }], caption: inst.label };
      }
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
    }
    if (kind === "add") {
      var abnd = resolveBand(chrom, (ab.breakpoints[0] || [])[0]), ov4 = [];
      if (abnd) ov4.push(abnd.arm === "p" ? { type: "add", chrom: chrom, from: 0, to: abnd.mid } : { type: "add", chrom: chrom, from: abnd.mid, to: d0.length });
      return { segments: [fullSeg(chrom)], overlays: ov4, caption: inst.label };
    }
    if (kind === "hsr") {
      // An amplified block riding on the chromosome: mark the band as an hsr.
      var hbnd = resolveBand(chrom, (ab.breakpoints[0] || [])[0]), ov5 = [];
      if (hbnd) ov5.push({ type: "hsr", chrom: chrom, from: hbnd.start, to: hbnd.end });
      return { segments: [fullSeg(chrom)], overlays: ov5, caption: inst.label };
    }
    if (kind === "fra") {
      // A fragile site is a GAP, not a break: one unbroken chromosome of normal
      // length with an unstained gap at the band, and the fragment beyond it still
      // attached. Drawn as a point rather than a band span because the gap is
      // narrow and fixed-width on the page; the band it sits in can be several Mb.
      // Without this branch fra fell through to the generic full-chromosome return,
      // so 46,X,fra(X)(q27.3) drew an X indistinguishable from a normal X.
      var fraBand = (ab.breakpoints[0] || [])[0];
      var fbnd = resolveBand(chrom, fraBand), ov6 = [];
      if (fbnd) ov6.push({ type: "fra", chrom: chrom, at: fbnd.mid, band: fraBand });
      return { segments: [fullSeg(chrom)], overlays: ov6, caption: inst.label };
    }
    if (kind === "ring") {
      var rb = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean), from = 0, to = d0.length;
      if (rb.length >= 2) { from = Math.min(rb[0].mid, rb[1].mid); to = Math.max(rb[0].mid, rb[1].mid); }
      return { segments: [{ chrom: chrom, from: from, to: to, hasCen: (from < d0.centromere && to > d0.centromere), reversed: false }], overlays: [], caption: inst.label, ring: true };
    }
    if (kind === "iso") {
      var arm = (ab.breakpoints[0] || [])[0] || "q10", isQ = /^q/.test(arm);
      var af = isQ ? d0.centromere : 0, at = isQ ? d0.length : d0.centromere;
      // hasCen true on both arms, the whole-arm (rob) convention: each arm's
      // centromeric edge material is the working centromere's OWN, so its acen
      // bands must paint and answer as a centromere rather than take the #181
      // "carried across a junction" downgrade, which is for der grafts whose
      // working centromere lies elsewhere. hasCen:false here made hovering
      // 18q11.1 on i(18) say "Pericentromeric heterochromatin" while the
      // normal homolog said "Centromere". The single waist is unaffected: a
      // centromere at a segment's EDGE never enters cenList, so the seam
      // still provides it, exactly as on a Robertsonian.
      return { segments: [{ chrom: chrom, from: af, to: at, hasCen: true, reversed: isQ }, { chrom: chrom, from: af, to: at, hasCen: true, reversed: !isQ }], overlays: [], caption: inst.label };
    }
    if (kind === "ins") {
      var isb = buildInsertion(inst);
      if (isb) return { segments: isb.segments, overlays: isb.overlays || [], caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    if (kind === "rec") {
      var rcb = buildRecombinant(inst);
      if (rcb) return { segments: rcb.segments, overlays: rcb.overlays, caption: inst.label };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    var twoChrom = ab && ab.chroms && ab.chroms.length >= 2;
    // A whole-arm fusion (breaks at the centromere, q10/p10/cen) joins two arms —
    // a Robertsonian rob(13;14)(q10;q10), der(13;14)(q10;q10), or dic(…)(q10;q10).
    // These keep the WHOLE arm named by each breakpoint (13q + 14q), not a distal
    // fragment, so they need their own geometry rather than the reciprocal path.
    if ((kind === "der" || kind === "dic") && twoChrom && !(ab.subOps && ab.subOps.length) && isWholeArmBps(ab.breakpoints)) {
      var wsegs = wholeArmSegments(inst);
      if (wsegs) return { segments: wsegs, overlays: [], caption: inst.label, composite: true };
    }
    // The same whole-arm body WITH trailing sub-ops (ISCN 5.5.3 c iv, and the
    // 4.2.1 f mosaic's der(7;9)(q10;q10)t(9;22)). It used to fall past the whole-arm
    // path, which demanded no sub-ops, into the reciprocal single-join builder,
    // which drew a monocentric derivative of the WRONG chromosome:
    // der(13;14)(q10;q10)t(9;14)(q22;q24) came out as a der(9) figure with the 13
    // nowhere on it. A failed build must not fall through for the same reason as
    // the pure chain below; the parser gate stands in front for the mistakes it can
    // name.
    if (kind === "der" && twoChrom && (ab.subOps && ab.subOps.length) && isWholeArmBps(ab.breakpoints)) {
      var wsub = wholeArmDerSubOps(inst);
      if (wsub) return { segments: wsub.segments, overlays: wsub.overlays, caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    if (kind === "dic") {
      // A two-chromosome dic fuses into one body with two centromeres; a single-
      // chromosome idic mirrors itself about the breakpoint (also dicentric).
      var dsegs = twoChrom ? dicentricSegments(inst) : isodicentricSegments(inst);
      if (dsegs) return { segments: dsegs, overlays: [], caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    // der(A;B) built from joins, before the single-join path below can mis-handle it.
    if (kind === "der" && twoChrom && (ab.subOps || []).some(function (x) { return x.op === "t"; })) {
      var tcd = twoChromDerSegments(inst);
      if (tcd) {
        var tcdSegs = applyDerSubOps(inst, tcd, true);
        return { segments: tcdSegs, overlays: [], caption: inst.label, composite: true };
      }
      // A pure chain the walk refused must not fall through: the single-join path
      // below would fabricate a DIFFERENT wrong figure out of part of the chain.
      // The parser gate (classifyDerSubOps) refuses these ahead of the page, so
      // this return is its backstop, not a path a user reaches. The whole-arm
      // composition (der carrying its own breakpoints plus a t) keeps the
      // fall-through it has always had.
      if (!(ab.breakpoints || []).some(function (g) { return g && g.length; })) {
        return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
      }
    }
    if (kind === "t" || kind === "der") {
      // A der can be built by an insertion instead of a translocation join:
      // der(15)ins(15)(p11q23q26) is the internal move, der(5)ins(5;2)(...) the
      // recipient side, der(3)ins(16;3)(...) the donor side (all printed in
      // ISCN 2024). The parser's classifyDerSubOps guarantees at most one ins,
      // never combined with a t, and always involving this derivative's own
      // chromosome, so the standalone insertion geometry applies verbatim.
      var insOp = (kind === "der" && ab && ab.subOps) ? ab.subOps.filter(function (s) { return s.op === "ins"; })[0] : null;
      var segs = null, derOv = [];
      if (insOp) {
        var insB = buildInsertion({ chrom: chrom, aberration: { chroms: insOp.chroms, breakpoints: insOp.breakpoints } });
        if (insB) { segs = insB.segments; derOv = insB.overlays || []; }
      } else {
        segs = translocationSegments(inst);
      }
      // A der(N) chain can carry more than the join — a del/dup/inv on its own
      // chromosome (e.g. der(9)del(9)(p12)t(9;22)). Start from the join (or the
      // whole chromosome if there is no join) and apply those extra ops in turn.
      if (kind === "der" && ab && ab.subOps) {
        if (!segs) segs = [fullSeg(chrom)];
        segs = applyDerSubOps(inst, segs);
        // add and hsr sub-ops are overlays rather than segment edits: unknown
        // material hatched beyond its terminal band, an amplified block at its
        // band, the same vocabulary as the standalone kinds, mapped through
        // the composite's own segments. Before this loop they were dropped in
        // silence and der(5)add(5)(p15.3)add(5)(q23) drew an untouched 5.
        ab.subOps.forEach(function (s) {
          if (s.op !== "add" && s.op !== "hsr") return;
          var sc = String((s.chroms || [])[0] || chrom), sb = (s.breakpoints[0] || [])[0];
          var bnd = resolveBand(sc, sb), dsc = IDEO.data[sc];
          if (!bnd || !dsc) return;
          if (s.op === "add") derOv.push(bnd.arm === "p" ? { type: "add", chrom: sc, from: 0, to: bnd.mid } : { type: "add", chrom: sc, from: bnd.mid, to: dsc.length });
          else derOv.push({ type: "hsr", chrom: sc, from: bnd.start, to: bnd.end });
        });
      }
      if (segs) return { segments: segs, overlays: derOv, caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
  }

  // A recombinant chromosome: what a PERICENTRIC inversion carrier passes on when a
  // crossover falls inside the inversion loop. ISCN 5.5.15 d i gives the shape in its
  // own detailed form, and this function is that string turned into segments:
  //
  //   46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2) = rec(6)(pter→q25.2::p22.2→pter)
  //
  // One piece runs 6pter through the centromere to the q breakpoint; a second runs
  // the p breakpoint back out to 6pter, so the p-distal segment is present twice with
  // the extra copy end-for-end, and everything distal to the q breakpoint is gone.
  // Thompson & Thompson 9th ed, Fig 5.12B draws the same chromosome as A-B-C-A.
  //
  // dup(Nq) is the mirror image: the recombinant keeps the q-distal segment twice and
  // loses the p-distal one. Which arm is duplicated is the ONLY thing that differs, so
  // the two cases are written as one reflection rather than two geometries that could
  // drift apart.
  //
  // The centromere lives on exactly one piece either way, which is what makes a
  // recombinant monocentric. It is asserted rather than inferred from coordinates:
  // a break inside the centromere band resolves to that band's midpoint, and #181 was
  // a phantom second centromere that came from letting a grafted piece keep acen paint
  // its own hasCen flag denied.
  function buildRecombinant(inst) {
    var ab = inst.aberration, chrom = String(inst.chrom), d = IDEO.data[chrom];
    if (!ab || !ab.recDupArm || !d) return null;
    var pB = resolveBand(chrom, ab.recInvBands[0]), qB = resolveBand(chrom, ab.recInvBands[1]);
    if (!pB || !qB) return null;
    var seg = function (from, to, rev, cen) { return { chrom: chrom, from: from, to: to, hasCen: !!cen, reversed: !!rev }; };
    var segs, ov;
    if (ab.recDupArm === "p") {
      // pter→qBreak, then the p-distal segment again, flipped.
      segs = [seg(0, qB.mid, false, true), seg(0, pB.mid, true, false)];
      ov = [{ type: "dup", chrom: chrom, segIndex: 1 }, { type: "cut", chrom: chrom, at: qB.mid }];
    } else {
      // The extra copy of the q-distal segment leads, flipped so qter is outermost;
      // then pBreak→qter, which is the backbone with the p-distal segment gone.
      segs = [seg(qB.mid, d.length, true, false), seg(pB.mid, d.length, false, true)];
      ov = [{ type: "dup", chrom: chrom, segIndex: 0 }, { type: "cut", chrom: chrom, at: pB.mid }];
    }
    return { segments: segs.filter(function (s) { return s.to > s.from; }), overlays: ov };
  }

  // An insertion moves a segment to a new site: the recipient grows, the donor
  // shrinks. Interchromosomal ins(A;B)(siteA;segB1 segB2) makes der(A) (with B's
  // segment spliced in) and der(B) (that segment excised); intrachromosomal
  // ins(N)(site seg1 seg2) is a length-preserving internal move.
  function insSeg(c, from, to, rev) { var dd = IDEO.data[c]; return { chrom: c, from: from, to: to, hasCen: (dd.centromere > from && dd.centromere < to), reversed: !!rev }; }
  function buildInsertion(inst) {
    var ab = inst.aberration, chroms = ab.chroms, bps = ab.breakpoints, chrom = String(inst.chrom);
    if (!chroms || !chroms.length) return null;
    if (chroms.length === 1) {
      var g = bps[0] || [];
      var site = resolveBand(chrom, g[0]), a = resolveBand(chrom, g[1]), b = resolveBand(chrom, g[2]);
      if (!site || !a || !b) return null;
      var d = IDEO.data[chrom], lo = Math.min(a.mid, b.mid), hi = Math.max(a.mid, b.mid), inv = a.mid > b.mid, sp = site.mid, out = [], moved;
      if (sp <= lo) {                              // insertion site proximal to the moved segment
        if (sp > 0) out.push(insSeg(chrom, 0, sp));
        out.push(moved = insSeg(chrom, lo, hi, inv)); // the moved segment, in its new home
        out.push(insSeg(chrom, sp, lo));           // backbone between the site and the old location
        if (hi < d.length) out.push(insSeg(chrom, hi, d.length));
      } else {                                     // insertion site distal to the moved segment
        if (lo > 0) out.push(insSeg(chrom, 0, lo));
        out.push(insSeg(chrom, hi, sp));
        out.push(moved = insSeg(chrom, lo, hi, inv)); // the moved segment
        if (sp < d.length) out.push(insSeg(chrom, sp, d.length));
      }
      // The move gets marks, or the figure keeps the secret: both pieces are the
      // same chromosome, so not even a fusion seam betrays an internal insertion,
      // and 46,XY,ins(15)(p11q23q26) drew indistinguishable-at-a-glance from a
      // normal 15. The moved span wears the mov box; the excision point it left
      // is careted like any other repair join (same as an interstitial del).
      var kept = out.filter(function (s) { return s.to > s.from; });
      // The excision caret anchors at hi + 1, one base INSIDE the distal
      // remnant, not at lo: pointY takes the first segment containing the
      // coordinate, and the moved segment itself starts at lo, so an anchor of
      // lo drew the carets on the box up at the insertion site instead of down
      // at the join the segment left behind.
      return { segments: kept, overlays: [
        { type: "mov", chrom: chrom, segIndex: kept.indexOf(moved) },
        { type: "cut", chrom: chrom, at: hi + 1 }
      ] };
    }
    var recip = String(chroms[0]), donor = String(chroms[1]);
    var site2 = resolveBand(recip, (bps[0] || [])[0]);
    var sg = bps[1] || [], s1 = resolveBand(donor, sg[0]), s2 = resolveBand(donor, sg[1]);
    if (!site2 || !s1 || !s2 || !IDEO.data[recip] || !IDEO.data[donor]) return null;
    var dlo = Math.min(s1.mid, s2.mid), dhi = Math.max(s1.mid, s2.mid), dinv = s1.mid > s2.mid;
    if (chrom === recip) {                         // der(recipient): grows by the donor segment
      var dr = IDEO.data[recip], rs = [], movedIn;
      if (site2.mid > 0) rs.push(insSeg(recip, 0, site2.mid));
      rs.push(movedIn = insSeg(donor, dlo, dhi, dinv));
      if (site2.mid < dr.length) rs.push(insSeg(recip, site2.mid, dr.length));
      return { segments: rs, overlays: [{ type: "mov", chrom: donor, segIndex: rs.indexOf(movedIn) }] };
    }
    var dd2 = IDEO.data[donor], ds = [];           // der(donor): loses the excised segment
    if (dlo > 0) ds.push(insSeg(donor, 0, dlo));
    if (dhi < dd2.length) ds.push(insSeg(donor, dhi, dd2.length));
    if (!ds.length) ds = [fullSeg(donor)];
    return { segments: ds, overlays: [{ type: "cut", chrom: donor, at: dlo }] };
  }

  // Whole-arm breakpoints are the centromere designations p10 / q10 / cen. When
  // both breaks are whole-arm, the rearrangement fuses two entire arms.
  function armOf(band) { return /^p/.test(String(band || "")) ? "p" : "q"; }
  function isCenBand(b) { return /^[pq]10$/.test(String(b || "")) || String(b) === "cen"; }
  function isWholeArmBps(bps) {
    return isCenBand((bps && bps[0] || [])[0]) && isCenBand((bps && bps[1] || [])[0]);
  }

  // A whole-arm fusion (Robertsonian and other centromeric fusions): keep the
  // ENTIRE arm named by each breakpoint (q arm for q10, p arm for p10) and orient
  // both so their centromeres meet at the join in the middle — the two long arms
  // of a rob(13;14)(q10;q10), with both short arms lost.
  //
  // Which retained arm goes on TOP is a drawing question, and ISCN does not answer
  // it: ISCN says how to WRITE der(14;21)(q10;q10), including that the partners are
  // listed lowest-number-first, and that ordering says nothing about the picture
  // (teach.js already tells the reader as much). The rule that does apply is the
  // one every other chromosome in the karyogram already obeys, and the one a
  // cytogeneticist uses on a chromosome cut out of a metaphase spread, where no name
  // is available: orient by morphology, SHORT ARM UP.
  //
  // Taking the nomenclature order as a drawing order put the LONG arm on top of
  // every Robertsonian, upside down (a q arm in the top position must be flipped so
  // qter points up). der(14;21) came out with 90 Mb of 14q inverted above 35 Mb of
  // 21q, so the derivative's 14q banding ran backwards next to the normal 14 beside
  // it, which is the exact comparison the picture exists to support.
  //
  // Ordering by arm length instead fixes that and costs nothing, because exactly one
  // arm must be flipped whenever both retained pieces are the same arm letter, and
  // putting the SHORTER one up means the flipped one is the shorter one. When the
  // letters differ (der(1;3)(p10;q10) keeps 1p and 3q) the p arm goes up and NEITHER
  // arm is flipped, so that case is decided by reversal count, not length: a length
  // rule would put 3q (107 Mb) above 1p (123 Mb) and invert both arms to do it.
  function wholeArmSegments(inst) {
    var ab = inst.aberration, chroms = ab.chroms, bps = ab.breakpoints;
    var a = String(chroms[0]), b = String(chroms[1]);
    if (!IDEO.data[a] || !IDEO.data[b]) return null;
    var arma = armOf((bps[0] || [])[0]), armb = armOf((bps[1] || [])[0]);
    var da = IDEO.data[a], db = IDEO.data[b];
    var segA = arma === "q" ? { chrom: a, from: da.centromere, to: da.length } : { chrom: a, from: 0, to: da.centromere };
    var segB = armb === "q" ? { chrom: b, from: db.centromere, to: db.length } : { chrom: b, from: 0, to: db.centromere };
    segA.arm = arma; segB.arm = armb;

    // One p and one q: the p arm on top is the only arrangement that flips neither.
    // Same letter on both sides: one flip is unavoidable, so put the shorter arm up
    // and spend the flip on it. Arm lengths come from the single bp-coordinate table,
    // not from the band level, so the Bands toggle never re-orders a derivative.
    var top = segA, bottom = segB;
    if (arma !== armb) {
      if (armb === "p") { top = segB; bottom = segA; }
    } else if ((segB.to - segB.from) < (segA.to - segA.from)) {
      top = segB; bottom = segA;
    }
    // Top arm: centromere at its bottom (a q arm must be flipped so qter is up);
    // bottom arm: centromere at its top (a p arm must be flipped so pter is down).
    top.hasCen = true; top.reversed = (top.arm === "q");
    bottom.hasCen = true; bottom.reversed = (bottom.arm === "p");
    return [top, bottom];
  }

  // applyExtraJoin and applyOpToSeg recompute the kept piece's centromere flag with
  // a strict containment test, and a whole-arm piece MEETS the centromere at its
  // seam end rather than containing it, so an arm that took a graft or a deletion
  // lost its half of the seam and the derivative drew one constriction where the
  // model says two. Restore the flag on the kept piece when the arm it came from
  // carried it and the piece still reaches the seam.
  function restoreSeamCen(before, after) {
    for (var i = 0; i < before.length; i++) {
      if (before[i] === after[i]) continue;
      var old = before[i];
      if (!old.hasCen) return;
      var d = IDEO.data[String(old.chrom)];
      if (!d) return;
      for (var j = i; j <= i + 1 && j < after.length; j++) {
        var p = after[j];
        if (String(p.chrom) === String(old.chrom) && p.from >= old.from && p.to <= old.to &&
            p.from <= d.centromere && d.centromere <= p.to) { p.hasCen = true; return; }
      }
      return;
    }
  }

  // The whole-arm body WITH trailing sub-ops. ISCN 5.5.3 c iv:
  // der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12) is the two long arms of 8 fused
  // at the centromeres, one truncated at q22, material of 9 on the other at q24.1.
  // Sub-ops are applied in notation order, each to the FIRST piece whose span holds
  // its band, which is what lets one chromosome's two arms take one op each: the
  // deletion shortens the first arm past q24.1's reach, so the join lands on the
  // second.
  //
  // Strict on purpose: a sub-op that lands nowhere is a dropped op, and this family
  // of fixes (#231) exists because a partial figure under a full caption reads as
  // authoritative. classifyDerSubOps gates the mistakes it can name (a join touching
  // nothing on the body, a band on an arm the derivative does not keep); a band that
  // misses a grafted piece by position alone still reaches the nulls here and falls
  // to the refusal fallback in buildInstance.
  function wholeArmDerSubOps(inst) {
    var ab = inst.aberration;
    var segs = wholeArmSegments(inst);
    if (!segs) return null;
    var overlays = [];
    for (var i = 0; i < (ab.subOps || []).length; i++) {
      var s = ab.subOps[i];
      if (s.op === "t") {
        var joined = applyExtraJoin(segs, s);
        if (joined === segs) return null;              // nothing consumed the join
        restoreSeamCen(segs, joined);
        segs = joined;
      } else if (s.op === "del" || s.op === "dup" || s.op === "inv") {
        var sc = String((s.chroms || [])[0]);
        var bands = (s.breakpoints || [])[0] || [];
        var applied = false;
        for (var k = 0; k < segs.length && !applied; k++) {
          var seg = segs[k];
          if (String(seg.chrom) !== sc) continue;
          var pts = bands.map(function (x) { return resolveBand(sc, x); }).filter(Boolean);
          if (!pts.length || !pts.every(function (p) { return p.mid > seg.from && p.mid < seg.to; })) continue;
          var pieces = applyOpToSeg(seg, sc, s.op, bands);
          var d = IDEO.data[sc];
          pieces.forEach(function (p) {
            if (seg.hasCen && p.from <= d.centromere && d.centromere <= p.to) p.hasCen = true;
          });
          segs = segs.slice(0, k).concat(pieces, segs.slice(k + 1));
          applied = true;
        }
        if (!applied) return null;
      } else if (s.op === "add" || s.op === "hsr") {
        var oc = String((s.chroms || [])[0] || ""), ob = ((s.breakpoints || [])[0] || [])[0];
        var bnd = ob && resolveBand(oc, ob), od = IDEO.data[oc];
        if (bnd && od) {
          if (s.op === "add") overlays.push(bnd.arm === "p" ? { type: "add", chrom: oc, from: 0, to: bnd.mid } : { type: "add", chrom: oc, from: bnd.mid, to: od.length });
          else overlays.push({ type: "hsr", chrom: oc, from: bnd.start, to: bnd.end });
        }
      } else {
        return null;                                    // ins and anything newer: no geometry here yet
      }
    }
    return { segments: segs, overlays: overlays };
  }


  // der(A;B): a derivative named across TWO chromosomes and built from t sub-ops. ISCN
  // 5.4.3.1 b, "der refers to the chromosome(s) that has an intact centromere", so
  // naming two means the derivative carries two: 45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)
  // is described by the standard as "a dicentric derivative chromosome with centromeres
  // of chromosomes 5 and 7. An acentric chromosome 3 segment (3q21→3q29) is inserted
  // between the long arm of chromosome 5 and the short arm of chromosome 7."
  //
  // It was reaching translocationSegments, which keeps ONE centromere and grafts an
  // acentric tip, so the figure was a monocentric der(5) with a piece of 7 hanging off
  // it: the wrong number of centromeres, the wrong pieces, and the wrong caption.
  //
  // The joins form a path rather than a star. Each t names two chromosomes and a band on
  // each, so the sub-ops chain the named chromosomes together, and the derivative is that
  // path walked from the first named chromosome to the last. A chromosome in the MIDDLE
  // of the path is bounded by both of its breaks; one at an END keeps the centric side
  // when it is one of the chromosomes the der is named for (its centromere is the reason
  // the name includes it) and the acentric side otherwise, which is how a trailing
  // fragment like 3q21→3qter arrives.
  function twoChromDerSegments(inst) {
    var ab = inst.aberration, named = (ab.chroms || []).map(String);
    var joins = (ab.subOps || []).filter(function (s) {
      return s.op === "t" && (s.chroms || []).length === 2 && (s.breakpoints || []).length === 2;
    });
    if (named.length !== 2 || !joins.length) return null;
    // Breaks per chromosome, in the order the joins name them.
    var breaks = {}, adj = {};
    var ok = true;
    joins.forEach(function (j, idx) {
      var a = String(j.chroms[0]), b = String(j.chroms[1]);
      var ba = (j.breakpoints[0] || [])[0], bb = (j.breakpoints[1] || [])[0];
      if (!ba || !bb || !IDEO.data[a] || !IDEO.data[b]) { ok = false; return; }
      (breaks[a] = breaks[a] || []).push(ba);
      (breaks[b] = breaks[b] || []).push(bb);
      (adj[a] = adj[a] || []).push({ to: b, idx: idx });
      (adj[b] = adj[b] || []).push({ to: a, idx: idx });
    });
    if (!ok) return null;
    // Walk from the first named chromosome, consuming one join per step. Every step
    // must be a fresh chromosome, so a cycle or a repeat stops the build rather than
    // looping, and the bound is the join count itself: the chain is as long as the
    // notation writes it. A fixed eight-step guard here once cut a nine-join chain
    // short, and the failed build fell through to the single-centromere path.
    var path = [named[0]], seen = {}, used = {};
    seen[named[0]] = 1;
    for (var guard = 0; guard < joins.length; guard++) {
      var here = path[path.length - 1];
      var step = (adj[here] || []).filter(function (e) { return !seen[e.to]; })[0];
      if (!step) break;
      seen[step.to] = 1; used[step.idx] = 1;
      path.push(step.to);
    }
    if (path.length < 2 || path.indexOf(named[1]) < 0) return null;
    // A join the walk did not consume names material with no place on the body, and
    // drawing the rest would be a figure with pieces silently missing. The parser
    // gates the same condition (classifyDerSubOps), so for accepted input this
    // return is unreachable.
    for (var ju = 0; ju < joins.length; ju++) if (!used[ju]) return null;
    var segs = [];
    for (var i = 0; i < path.length; i++) {
      var c = path[i], bs = (breaks[c] || []), d = IDEO.data[c];
      if (!d) return null;
      if (i > 0 && i < path.length - 1) {
        // Bounded by both of its breaks.
        if (bs.length < 2) return null;
        var m1 = resolveBand(c, bs[0]), m2 = resolveBand(c, bs[1]);
        if (!m1 || !m2) return null;
        var lo = Math.min(m1.mid, m2.mid), hi = Math.max(m1.mid, m2.mid);
        segs.push({ chrom: c, from: lo, to: hi, hasCen: (d.centromere > lo && d.centromere < hi), reversed: false });
      } else {
        if (!bs.length) return null;
        var sp = splitAtBreak(c, bs[0]);
        var keep = named.indexOf(c) >= 0 ? sp.centric : sp.acentric;
        segs.push({
          chrom: c, from: keep[0], to: keep[1],
          hasCen: (d.centromere > keep[0] && d.centromere < keep[1]), reversed: false
        });
      }
    }
    // Each junction has to meet broken end to broken end. Orient every piece after the
    // first so its break with the PREVIOUS chromosome faces upward, which is the same
    // rule the single join and the chain walk follow.
    for (var k = 1; k < segs.length; k++) {
      var cur = segs[k], prevChrom = path[k - 1];
      var jb = null;
      joins.forEach(function (j) {
        var a = String(j.chroms[0]), b = String(j.chroms[1]);
        if (a === cur.chrom && b === prevChrom) jb = (j.breakpoints[0] || [])[0];
        else if (b === cur.chrom && a === prevChrom) jb = (j.breakpoints[1] || [])[0];
      });
      var r = jb && resolveBand(cur.chrom, jb);
      if (r) cur.reversed = Math.abs(r.mid - cur.to) < Math.abs(r.mid - cur.from);
    }
    // And the first piece hands its own break DOWN to the second.
    var f = segs[0], fb = null, second = path[1];
    joins.forEach(function (j) {
      var a = String(j.chroms[0]), b = String(j.chroms[1]);
      if (a === f.chrom && b === second) fb = (j.breakpoints[0] || [])[0];
      else if (b === f.chrom && a === second) fb = (j.breakpoints[1] || [])[0];
    });
    var fr = fb && resolveBand(f.chrom, fb);
    if (fr) f.reversed = Math.abs(fr.mid - f.from) < Math.abs(fr.mid - f.to);
    return segs;
  }

  // A dicentric of two chromosomes: keep each one's centric piece and orient them
  // so the two broken ends meet in the middle, giving one body with two centromeres.
  function dicentricSegments(inst) {
    var ab = inst.aberration, chroms = ab.chroms, bps = ab.breakpoints;
    var a = String(chroms[0]), b = String(chroms[1]), ba = (bps[0] || [])[0], bb = (bps[1] || [])[0];
    if (!IDEO.data[a] || !IDEO.data[b] || !ba || !bb) return null;
    var sa = splitAtBreak(a, ba), sb = splitAtBreak(b, bb);
    return [
      { chrom: a, from: sa.centric[0], to: sa.centric[1], hasCen: true, reversed: sa.side === "p" },
      { chrom: b, from: sb.centric[0], to: sb.centric[1], hasCen: true, reversed: sb.side === "q" }
    ];
  }

  // An isodicentric: the centric piece mirrored about the breakpoint, so it reads
  // as a symmetric chromosome with two copies of the retained arm and two centromeres.
  function isodicentricSegments(inst) {
    var ab = inst.aberration, chrom = String(inst.chrom), br = (ab.breakpoints[0] || [])[0];
    if (!IDEO.data[chrom] || !br) return null;
    var s = splitAtBreak(chrom, br), p = s.centric;
    // The two copies meet AT THE BREAKPOINT, which is the whole point of an
    // isodicentric: that is where the sister chromatids fused. So the breakpoint end of
    // each copy has to face the middle and the telomere ends have to be the outer tips.
    //
    // For a break on q the centric piece is [pter, bp] and its breakpoint end is its
    // HIGH coordinate, so running it forward then reversed puts bp::bp in the middle.
    // For a break on p the piece is [bp, qter] and its breakpoint end is its LOW
    // coordinate, so the same order joins qter to qter instead: idic(17)(p11.2) was
    // drawn fused at the long-arm telomeres, with the two 17p11.2 breakpoints out at
    // the tips. ISCN prints it as (qter→p11.2::p11.2→qter), telomeres outside and the
    // breakpoints meeting, which is what found this.
    var flip = s.side === "p";
    return [
      { chrom: chrom, from: p[0], to: p[1], hasCen: true, reversed: flip },
      { chrom: chrom, from: p[0], to: p[1], hasCen: true, reversed: !flip }
    ];
  }

  // Apply the trailing del/dup/inv sub-operations of a der() chain to the pieces
  // that belong to the der's own chromosome, leaving the joined-in material alone.
  function applyDerSubOps(inst, segs, skipJoins) {
    var ab = inst.aberration, primary = String(inst.primary);
    (ab.subOps || []).forEach(function (s) {
      if (["del", "dup", "inv"].indexOf(s.op) < 0) return;   // t/dic joins are handled below
      // Ops on any chromosome the der is NAMED for, not only its primary. A der(5;7)
      // carries two named chromosomes and ISCN puts a del on either: 5.5.3 c iii is
      // der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)del(7)(q32), where the deletion truncates
      // the chromosome 7 arm and the standard writes the open end as "7p13→7q32:". The
      // primary-only test dropped it silently. Unchanged for a der naming ONE
      // chromosome, where ab.chroms is just the primary anyway.
      var owned = [primary].concat((ab.chroms || []).map(String));
      var sc = String((s.chroms || [])[0]);
      if (owned.indexOf(sc) < 0) return;
      // Applied to the piece the sub-op NAMES, and resolved against that chromosome's
      // bands. Both were hard-wired to the primary, which is the same thing for a der
      // naming one chromosome and wrong for a der(5;7): del(7)(q32) has to reach the
      // chromosome 7 arm and be measured in chromosome 7 coordinates.
      var bands = (s.breakpoints || [])[0] || [], out = [];
      segs.forEach(function (seg) {
        if (String(seg.chrom) !== sc) { out.push(seg); return; }
        out = out.concat(applyOpToSeg(seg, sc, s.op, bands));
      });
      segs = out;
    });
    // Every t after the first. translocationSegments consumes one join and only one, so
    // a der() built from a chain lost every join past it and drew a chromosome that was
    // missing whole grafted pieces in silence: der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)
    // came out as 3qter->3q21::1p32->1qter, with chromosome 11 nowhere on it, against
    // ISCN's 3qter->3q21::1p32->1q25::11q13->11qter (5.5.3 c).
    //
    // A chain is walked outward rather than reasoned about: each further join names a
    // chromosome that is ALREADY on the derivative, cuts that piece at the named band,
    // and hangs the partner off the cut. Which side of the cut survives is decided by
    // geometry, not by arm letters: the piece that stays is the one still joined to the
    // rest of the body, so a graft keeps the side facing its existing junction and the
    // derivative's own arm keeps the side carrying the centromere.
    // twoChromDerSegments already walks every join for a der(A;B), so re-running the
    // chain there would try to apply each one twice. It happened to be harmless only
    // because a second application lands exactly on a segment boundary and is refused;
    // that is luck, not a guarantee.
    if (!skipJoins) {
      var joins = (ab.subOps || []).filter(function (x) { return x.op === "t"; });
      joins.slice(1).forEach(function (s) { segs = applyExtraJoin(segs, s); });
    }
    return segs;
  }

  // One further join, applied to the segment list built so far. Returns segs unchanged
  // when the join names nothing already on the derivative, or when the breakpoint does
  // not fall inside the piece it names: silently drawing a guess is what this whole
  // family of fixes exists to stop.
  function applyExtraJoin(segs, s) {
    var chroms = (s.chroms || []).map(String), bps = s.breakpoints || [];
    if (chroms.length < 2 || bps.length < 2) return segs;
    for (var i = 0; i < segs.length; i++) {
      for (var h = 0; h < 2; h++) {
        var host = chroms[h], partner = chroms[1 - h];
        if (String(segs[i].chrom) !== host) continue;
        var hostBand = (bps[h] || [])[0], partnerBand = (bps[1 - h] || [])[0];
        if (!hostBand || !partnerBand || !IDEO.data[host] || !IDEO.data[partner]) continue;
        var r = resolveBand(host, hostBand);
        var seg = segs[i];
        if (!r || !(r.mid > seg.from && r.mid < seg.to)) continue;   // not this piece
        // Which end of this piece is already attached to the rest of the derivative.
        // A piece at the top of the body hangs by its bottom edge and vice versa; the
        // one exception is the derivative's own centric arm, which is held by its
        // centromere and keeps whichever side that sits on.
        var d = IDEO.data[host];
        var centric = seg.hasCen && d.centromere > seg.from && d.centromere < seg.to;
        // "Attached at the bottom" is a fact about the DRAWN body, and which coordinate
        // that is depends on the piece's orientation: a reversed segment has its low
        // coordinate at the bottom. Reading the attachment straight off the index put
        // the cut on the wrong side of a reversed graft, so der(1)t(1;3)t(3;7) kept
        // 3q28->3qter (the part that had been handed away) instead of 3q21->3q28.
        var keepLow = centric ? (d.centromere < r.mid)
          : (i === 0 ? !!seg.reversed : !seg.reversed);
        var kept = keepLow ? { from: seg.from, to: r.mid } : { from: r.mid, to: seg.to };
        var below = keepLow !== !!seg.reversed;   // does the graft hang off the bottom?
        var sd = splitAtBreak(partner, partnerBand);
        var graft = {
          chrom: partner, from: sd.acentric[0], to: sd.acentric[1], hasCen: false,
          // Broken end faces the junction, the same rule the first join follows.
          reversed: below ? (sd.side === "p") : (sd.side === "q")
        };
        var host2 = { chrom: host, from: kept.from, to: kept.to, hasCen: centric, reversed: seg.reversed };
        var out = segs.slice(0, i).concat(below ? [host2, graft] : [graft, host2], segs.slice(i + 1));
        return out;
      }
    }
    return segs;
  }

  // Apply one del/dup/inv, confined to a single segment's coordinate span.
  function applyOpToSeg(seg, chrom, op, bands) {
    var pts = bands.map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
    var d = IDEO.data[chrom];
    function mk(from, to, rev) { return { chrom: chrom, from: from, to: to, hasCen: (d.centromere > from && d.centromere < to), reversed: rev == null ? seg.reversed : rev }; }
    if (!pts.length) return [seg];
    if (op === "del") {
      if (pts.length >= 2) {                       // interstitial: drop the middle
        var lo = Math.min(pts[0].mid, pts[1].mid), hi = Math.max(pts[0].mid, pts[1].mid), o = [];
        if (lo > seg.from) o.push(mk(seg.from, Math.min(lo, seg.to)));
        if (hi < seg.to) o.push(mk(Math.max(hi, seg.from), seg.to));
        return o.length ? o : [seg];
      }
      return pts[0].arm === "p" ? [mk(Math.max(seg.from, pts[0].mid), seg.to)] : [mk(seg.from, Math.min(seg.to, pts[0].mid))];
    }
    if (op === "dup") {
      var dlo, dhi, dinv = false;
      if (pts.length >= 2) { dlo = Math.min(pts[0].mid, pts[1].mid); dhi = Math.max(pts[0].mid, pts[1].mid); dinv = pts[0].mid > pts[1].mid; }
      else { dlo = pts[0].start; dhi = pts[0].end; }
      if (dhi <= seg.from || dlo >= seg.to) return [seg];
      var a = Math.max(dlo, seg.from), c = Math.min(dhi, seg.to);
      return [mk(seg.from, c), mk(a, c, dinv ? !seg.reversed : seg.reversed), mk(c, seg.to)].filter(function (x) { return x.to > x.from; });
    }
    if (op === "inv") {
      if (pts.length < 2) return [seg];
      var i0 = Math.max(Math.min(pts[0].mid, pts[1].mid), seg.from), i1 = Math.min(Math.max(pts[0].mid, pts[1].mid), seg.to);
      if (i1 <= i0) return [seg];
      var oo = [];
      if (i0 > seg.from) oo.push(mk(seg.from, i0));
      oo.push(mk(i0, i1, !seg.reversed));
      if (i1 < seg.to) oo.push(mk(i1, seg.to));
      return oo;
    }
    return [seg];
  }

  function translocationSegments(inst) {
    var ab = inst.aberration, primary = inst.primary, chroms = ab.chroms, bps = ab.breakpoints;
    if (ab.kind === "der" && ab.subOps) {
      var t = ab.subOps.filter(function (s) { return s.op === "t"; })[0];
      if (t) { chroms = t.chroms; bps = t.breakpoints; } else return null;
    }
    var n = chroms.length;
    if (n < 2 || bps.length < n) return null;
    // Each der(Xi) keeps Xi's own centromere and receives the distal (acentric)
    // segment of the PREVIOUS chromosome in the cycle (ISCN convention). For a
    // 2-way this is exactly the reciprocal swap; for 3+ way it is the cyclic
    // exchange, so every derivative shows real material from its own chromosome.
    var pi = chroms.map(String).indexOf(String(primary));
    if (pi < 0) pi = 0;
    var di = (pi - 1 + n) % n;                     // donor = previous in the cycle
    var keepChrom = chroms[pi], keepBand = (bps[pi] || [])[0];
    var addChrom = chroms[di], addBand = (bps[di] || [])[0];
    if (!IDEO.data[keepChrom] || !IDEO.data[addChrom] || !keepBand || !addBand) return null;
    var sk = splitAtBreak(keepChrom, keepBand), sd = splitAtBreak(addChrom, addBand);
    var keep = { chrom: keepChrom, from: sk.centric[0], to: sk.centric[1], hasCen: true, reversed: false };
    var add = { chrom: addChrom, from: sd.acentric[0], to: sd.acentric[1], hasCen: false, reversed: false };
    // The graft's BROKEN end has to face the junction, and which end of the segment
    // that is depends on two independent things: which side of the derivative's own
    // break the graft sits on, and which arm the DONOR broke on.
    //
    // A segment drawn unreversed runs low coordinate at the top. The donor's acentric
    // piece is [bp, qter] when the donor broke on q, so its broken end is its LOW
    // coordinate; it is [pter, bp] when the donor broke on p, so its broken end is its
    // HIGH coordinate. The graft goes BELOW the kept piece when the derivative broke on
    // q (broken end at the graft's top) and ABOVE it when the derivative broke on p
    // (broken end at the graft's bottom).
    //
    // Both flags were hard-coded false, which is right only for the q;q case. The
    // Philadelphia is q;q, so the one figure everyone checks was correct and the rest
    // were not: der(1) of t(1;3)(p22;q13.1) drew the chromosome 3 graft end-for-end,
    // running 3q13.1 down to 3qter and so joining 3qter to 1p22 when the break was at
    // 3q13.1. ISCN prints the answer for that exact karyotype,
    // der(1)(3qter→3q13.1::1p22→1qter), and 5.4.2.2 b makes the printed order the
    // physical one: the bands are listed "in the order in which they occur in the
    // rearranged chromosome".
    add.reversed = (sk.side === "q") ? (sd.side === "p") : (sd.side === "q");
    return (sk.side === "q") ? [keep, add] : [add, keep];
  }

  // Draw a ring chromosome as an actual ring: the retained material (from..to)
  // wraps 360 degrees around an annulus, each band an arc sector. Loses the tips.
  function renderRing(seg, ctx) {
    ctx = ctx || { theme: "detailed", level: 99, affected: {} };
    var simple = ctx.theme === "simple";
    var chrom = seg.chrom, d = IDEO.data[chrom];
    var from = seg.from, to = seg.to, total = to - from;
    if (!(total > 0)) { from = 0; to = d.length; total = d.length; }
    var uid = "ring" + (renderRing._n = (renderRing._n || 0) + 1);
    // Size by circumference, not radius: the ring's mid-line circumference equals
    // the retained DNA length (in the linear px scale), so a ring, which always
    // loses the tips, reads as more compact than its linear homolog rather than
    // larger. A floor keeps small rings legible.
    var Rm = Math.max(17, h(total) / (2 * Math.PI) * 1.25);   // mid-line radius
    var thick = Math.max(10, Math.min(W, Rm * 0.62));
    var R = Rm + thick / 2, r0 = Math.max(6, Rm - thick / 2);
    var pad = 11, size = (R + pad) * 2, cx = size / 2, cy = size / 2, TAU = Math.PI * 2;   // room for the fusion arrowhead above the ring

    function heteroColor(stain) {
      if (simple) {
        var hue = ctx.affected && ctx.affected[chrom];
        if (hue) return stain === "acen" ? hexMix(hue, "#1a1f36", 0.22) : hexMix(hue, "#ffffff", 0.28);
        return stain === "acen" ? "#3c4463" : "#808ba8";
      }
      return stain === "acen" ? "#3c4463" : "#7c8ae9";
    }
    var defs = [], patCache = {};
    function hatch(color, angle) {
      var key = color + "|" + angle;
      if (patCache[key]) return patCache[key];
      var id = uid + "h" + Object.keys(patCache).length; patCache[key] = id;
      defs.push('<pattern id="' + id + '" width="4.6" height="4.6" patternTransform="rotate(' + angle + ')" patternUnits="userSpaceOnUse"><rect width="4.6" height="4.6" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="4.6" stroke="' + color + '" stroke-width="1.5"/></pattern>');
      return id;
    }
    var DEG = 180 / Math.PI;
    function px(a, rad) { return cx + rad * Math.sin(a); }
    function py(a, rad) { return cy - rad * Math.cos(a); }
    function pt(a, rad) { return px(a, rad).toFixed(2) + " " + py(a, rad).toFixed(2); }
    function sector(a0, a1, fill, attr) {
      if (a1 - a0 < 0.001) return "";
      var large = (a1 - a0) > Math.PI ? 1 : 0;
      return '<path d="M' + pt(a0, R) + ' A' + R + ' ' + R + ' 0 ' + large + ' 1 ' + pt(a1, R) +
        ' L' + pt(a1, r0) + ' A' + r0 + ' ' + r0 + ' 0 ' + large + ' 0 ' + pt(a0, r0) + ' Z" fill="' + fill + '"' + (attr || "") + '/>';
    }
    // Hatched sector whose texture follows the ring: rotate the pattern by the
    // sector's angular position (minus 90, so at 3 o'clock, where the band is
    // locally vertical like the linear ideogram, the hatch matches the linear).
    function hatchSector(a0, a1, stain, base, attr) {
      return sector(a0, a1, "url(#" + hatch(heteroColor(stain), base + (a0 + a1) / 2 * DEG - 90) + ")", attr);
    }

    var body = [], cenAngle = null;
    getBands(chrom, ctx.level == null ? 99 : ctx.level).forEach(function (b) {
      var bs = Math.max(b[1], from), be = Math.min(b[2], to);
      if (be <= bs) return;
      var st = b[3];
      var a0 = (bs - from) / total * TAU, a1 = (be - from) / total * TAU;
      if (st === "acen") cenAngle = (a0 + a1) / 2;
      var attr = ' class="band" data-chrom="' + esc(chrom) + '" data-band="' + esc(b[0]) + '" data-stain="' + st + '"';
      var parts = (a1 - a0 > Math.PI) ? [[a0, (a0 + a1) / 2], [(a0 + a1) / 2, a1]] : [[a0, a1]];
      parts.forEach(function (p) {
        if (st === "acen") body.push(hatchSector(p[0], p[1], "acen", 45, attr));
        else if (st === "gvar" || st === "stalk") body.push(hatchSector(p[0], p[1], st, -45, attr));
        else body.push(sector(p[0], p[1], fillFor(ctx, chrom, st), attr));
      });
    });
    var ocol = outlineFor(ctx, chrom);
    body.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + R.toFixed(2) + '" fill="none" stroke="' + ocol + '" stroke-width="1.4"/>');
    body.push('<circle cx="' + cx + '" cy="' + cy + '" r="' + r0.toFixed(2) + '" fill="none" stroke="' + ocol + '" stroke-width="1.1"/>');
    // Mark the centromere with a dashed radial line across the ring, echoing the
    // dashed centromere line on the linear ideogram.
    if (cenAngle != null) {
      var ccol = heteroColor("acen");
      body.push('<line x1="' + px(cenAngle, r0 - 2).toFixed(2) + '" y1="' + py(cenAngle, r0 - 2).toFixed(2) +
        '" x2="' + px(cenAngle, R + 2).toFixed(2) + '" y2="' + py(cenAngle, R + 2).toFixed(2) +
        '" stroke="' + ccol + '" stroke-width="1.6" stroke-dasharray="3 2"/>');
    }
    // Fusion point: the two broken ends meet at 12 o'clock (angle 0, the seam of
    // the wrap). Mark it like a clasp — a short seam plus a haloed node — so it
    // reads as the join where the ends fused into a ring.
    var fcol = AMBER;
    var yO = py(0, R), yI = py(0, r0);   // outer-top and inner-top at 12 o'clock (x = cx)
    body.push('<g style="cursor:default"><title>Ring fusion point: the broken chromosome ends joined here</title>' +
      '<line x1="' + cx.toFixed(2) + '" y1="' + yO.toFixed(2) + '" x2="' + cx.toFixed(2) + '" y2="' + yI.toFixed(2) +
      '" stroke="' + fcol + '" stroke-width="1.7"/>' +
      // arrowhead just outside the ring, pointing down at the seam
      '<path d="M' + (cx - 3.8).toFixed(2) + ' ' + (yO - 7.5).toFixed(2) + ' L' + (cx + 3.8).toFixed(2) + ' ' + (yO - 7.5).toFixed(2) + ' L' + cx.toFixed(2) + ' ' + (yO - 1.5).toFixed(2) + ' Z" fill="' + fcol + '" stroke="#ffffff" stroke-width="0.9"/>' +
      // arrowhead inside the hole, pointing up at the seam
      '<path d="M' + (cx - 3.8).toFixed(2) + ' ' + (yI + 7.5).toFixed(2) + ' L' + (cx + 3.8).toFixed(2) + ' ' + (yI + 7.5).toFixed(2) + ' L' + cx.toFixed(2) + ' ' + (yI + 1.5).toFixed(2) + ' Z" fill="' + fcol + '" stroke="#ffffff" stroke-width="0.9"/></g>');
    return {
      svg: '<svg class="ideo ideo-ring" width="' + size.toFixed(1) + '" height="' + size.toFixed(1) +
        '" viewBox="0 0 ' + size.toFixed(1) + ' ' + size.toFixed(1) + '"><defs>' + defs.join("") + '</defs>' + body.join("") + '</svg>',
      width: size, height: size, cenY: null
    };
  }

  // Double minutes: a pair of tiny acentric circles (the classic dmin look).
  function renderDmin(ctx) {
    var simple = ctx && ctx.theme === "simple";
    var col = simple ? "#64748b" : "#3c4463";
    var w = 30, ht = 26, r = 4.6, cy = 11;
    var body = [
      '<circle cx="10" cy="' + cy + '" r="' + r + '" fill="' + col + '"/>',
      '<circle cx="20" cy="' + cy + '" r="' + r + '" fill="' + col + '"/>'
    ];
    return {
      svg: '<svg class="ideo ideo-dmin" width="' + w + '" height="' + ht + '" viewBox="0 0 ' + w + ' ' + ht + '">' + body.join("") + '</svg>',
      width: w, height: ht, cenY: null
    };
  }

  function drawInstance(inst, ctx) {
    var built = buildInstance(inst);
    if (built.dmin) {
      var dout = renderDmin(ctx);
      return { svg: dout.svg, width: dout.width, height: dout.height, cenY: null, cenSeam: false, built: built };
    }
    if (built.ring && built.segments && built.segments[0]) {
      var rout = renderRing(built.segments[0], ctx);
      return { svg: rout.svg, width: rout.width, height: rout.height, cenY: null, cenSeam: false, built: built };
    }
    // idChrom is the chromosome this derivative is filed and labelled as. Passed
    // explicitly rather than read off segments[0] or the first centric segment,
    // because segment order is a DRAWING decision (see wholeArmSegments, which puts
    // the shorter arm on top) and must not be able to change what the derivative
    // looks like it IS. For every other kind the two agree; for a Robertsonian they
    // no longer do.
    var out = renderComposite(built.segments, { overlays: built.overlays, ctx: ctx, idChrom: inst.chrom });
    return { svg: out.svg, width: out.width, height: out.height, cenY: out.cenY, cenSeam: !!out.cenSeam, built: built };
  }

  // ----- karyogram (one clone) ----------------------------------------------
  // 3 even rows of 8 (numeric order; groups not preserved, per request):
  //   1-8 · 9-16 · 17-22 + X,Y + markers
  var GROUPS = [
    { name: "r1", chroms: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    { name: "r2", chroms: ["9", "10", "11", "12", "13", "14", "15", "16"] },
    { name: "r3", chroms: ["17", "18", "19", "20", "21", "22"], sex: true }
  ];

  // How the copies in one cell (normal homolog, derivative, del...) line up. One
  // decision, shared by the layout (cellHtml) and by the cross-cell metrics
  // (cellMetrics), so the two can never disagree about what a cell looks like.
  //
  //  · "flush"  same overall length (an inversion): no shift, tops and bottoms meet.
  //  · "cen"    every copy has a COMPARABLE centromere: align on it, so a shortened
  //             p-arm reads as a p-arm loss and a shortened q-arm as a q-arm loss,
  //             the way a real karyogram is compared side by side.
  //  · "bottom" some copy's centromere is a seam between whole arms (a Robertsonian
  //             der, an isochromosome), and this cell is read on its own. A seam y is
  //             not the same kind of thing as a p/q boundary: an acrocentric's
  //             centromere sits near its top, the fusion's between two long arms, so
  //             aligning them drops the normal homolog most of the way down the cell
  //             and floats the derivative above the row baseline its neighbours sit on.
  //
  // seamCen distinguishes the two views. In "affected only" every cell is deliberately
  // hung off ONE shared horizontal centromere line (cellMetrics + cenOffset), which is
  // the classic karyogram look and is why the fusion seam is worth aligning on there:
  // it is the best centromere proxy that derivative has. The full 24-chromosome view
  // has no shared line — cells just sit on a common baseline — so there a seam cell
  // bottom-aligns instead.
  function alignMode(drawn, seamCen) {
    if (drawn.every(function (d) { return Math.abs(d.height - drawn[0].height) < 0.5; })) return "flush";
    var haveCen = drawn.every(function (d) { return d.cenY != null; });
    if (!haveCen) return "bottom";
    return (seamCen || drawn.every(function (d) { return !d.cenSeam; })) ? "cen" : "bottom";
  }
  function tallest(drawn) {
    return drawn.reduce(function (a, b) { return b.height > a.height ? b : a; }, drawn[0]);
  }

  // The within-cell layout metrics of a chromosome cell: the y of its aligned
  // centromere line (from the top of the copies), and the cell's drawn height.
  // Used to line every affected chromosome's centromere up on one horizontal line.
  function cellMetrics(insts, ctx) {
    var drawn = insts.map(function (i) { return drawInstance(i, ctx); });
    var mode = alignMode(drawn, true);   // only the shared-centromere-line view uses this
    var maxCen = 0, maxH = 0;
    drawn.forEach(function (d) { if (d.cenY != null && d.cenY > maxCen) maxCen = d.cenY; if (d.height > maxH) maxH = d.height; });
    // The line has to be where the cell will actually put a centromere. Under
    // "bottom" the tallest copy is the one flush with the cell top, so its own
    // centromere is the only y that stays true after layout.
    var cenLine = mode === "flush" ? drawn[0].cenY
      : mode === "cen" ? maxCen
      : tallest(drawn).cenY;
    return { cenLine: cenLine == null ? null : cenLine, height: maxH };
  }

  // Absent homologs to draw as a placeholder: exactly the losses the karyotype states
  // (the "-21" in 45,XY,-21), never a copy-number deficit. The two look identical by
  // count — a balanced rob(13;14) carrier also has a single drawn 14 — but there 14q
  // rides on the der and nothing is missing, so a placeholder would misstate it.
  // Sex chromosomes are left to cellSpecs, which owns their pairing and the gap.
  function lostCount(clone, chrom) {
    if (chrom === "X" || chrom === "Y") return 0;
    var n = 0;
    (clone.aberrations || []).forEach(function (ab) {
      if (ab.kind === "loss" && ab.chroms && ab.chroms.indexOf(chrom) >= 0) n += (ab.multiplier || 1);
    });
    return n;
  }

  // A plain normal copy of a chromosome, with no aberration. Used as the reference
  // for a gap's size and position when the real copies cannot supply one.
  function normalInst(chrom) {
    return { chrom: chrom, kind: "normal", label: chrom, aberration: null, primary: null };
  }

  function cellHtml(labelText, insts, opts, ctx) {
    opts = opts || {};
    var copiesStyle = (opts.cenOffset && opts.cenOffset > 0.5) ? ' style="margin-top:' + opts.cenOffset.toFixed(1) + 'px"' : "";
    var h2 = ['<div class="kcell' + (opts.sexcell ? " sexcell" : "") + '"><div class="kcell-copies"' + copiesStyle + '>'];
    if (insts.length === 0 && opts.ghost) {
      h2.push(ghost(opts.ghostChrom || labelText, opts.ghostText || "absent"));
    } else {
      // Align the copies (normal homolog, derivative, del…) by alignMode(), which
      // documents the three cases and is shared with cellMetrics.
      var drawn = insts.map(function (inst) { return { inst: inst, d: drawInstance(inst, ctx) }; });
      var mode = alignMode(drawn.map(function (x) { return x.d; }), !!opts.seamCen);
      var maxCen = 0, maxH = 0;
      drawn.forEach(function (x) { if (x.d.cenY != null && x.d.cenY > maxCen) maxCen = x.d.cenY; if (x.d.height > maxH) maxH = x.d.height; });
      drawn.forEach(function (x) {
        var inst = x.inst, d = x.d;
        var mt = 0;
        if (mode === "cen") mt = Math.max(0, maxCen - d.cenY);
        else if (mode === "bottom") mt = Math.max(0, maxH - d.height);
        var cls = "kchrom" + (inst.kind !== "normal" ? " abn" : "");
        var sub = (inst.kind !== "normal") ? '<div class="ksub">' + esc(d.built.caption) + '</div>' : "";
        var style = mt > 0.5 ? ' style="margin-top:' + mt.toFixed(1) + 'px"' : "";
        h2.push('<div class="' + cls + '" data-chrom="' + inst.chrom + '" data-kind="' + inst.kind + '"' + style + '>' + d.svg + sub + '</div>');
      });
      // The gap where a lost homolog was. Aligned as a normal copy of that chromosome
      // would be, so it sits with its surviving partner rather than at the cell top.
      if (opts.missing > 0) {
        // insts can be EMPTY here: 44,XY,rob(14;21)(q10;q10),-21 leaves no free 21 at
        // all, one fused into the derivative and one lost, and the cell is then
        // nothing but its gap. Fall back to the cell's own chromosome.
        var refChrom = insts.length ? insts[0].chrom : (opts.ghostChrom || labelText);
        var ref = drawInstance(normalInst(refChrom), ctx);
        var gmt = mode === "cen" ? Math.max(0, maxCen - ref.cenY)
          : mode === "bottom" ? Math.max(0, maxH - ref.height) : 0;
        for (var gi = 0; gi < opts.missing; gi++) h2.push(ghost(refChrom, "missing", gmt));
      }
    }
    h2.push('</div><div class="klabel">' + esc(labelText) + '</div></div>');
    return h2.join("");
  }

  function computeAffected(clones) {
    if (!Array.isArray(clones)) clones = [clones];
    var order = [];
    function add(c) { if (c && IDEO.data[c] && order.indexOf(c) < 0) order.push(c); }
    clones.forEach(function (clone) {
      clone.aberrations.forEach(function (ab) {
        ab.chroms.forEach(add);
        (ab.subOps || []).forEach(function (s) { s.chroms.forEach(add); });
      });
      window.ISCN.ALL.forEach(function (c) {
        if ((clone.slots[c] || []).some(function (x) { return x.kind !== "normal"; })) add(c);
      });
      // Sex-chromosome aneuploidy lives in the sex field (45,X, 47,XXY, 48,XXXX),
      // not in an aberration, so it must be flagged here or the "affected" view
      // wrongly reports nothing to isolate. A euploid complement has one sex
      // chromosome per ploidy (XX/XY at 2n, XXX/XXY at 3n, ...); a different sex
      // count means the sex chromosomes are the (or an) abnormality.
      var sexTokens = (clone.sex && clone.sex.tokens) || [];
      if (sexTokens.length && sexTokens.length !== (clone.ploidy || 2)) {
        if (clone.sex.label.indexOf("X") >= 0) add("X");
        if (clone.sex.label.indexOf("Y") >= 0) add("Y");
      }
    });
    // A Y flagged as affected reads against the X beside it. The involved view
    // hides unaffected groups, and for a mosaic whose only sex change was -Y that
    // drew an XY clone showing a lone Y in its sex box, no X anywhere. When the Y
    // is in the set and any clone's complement carries an X, the X joins it.
    if (order.indexOf("Y") >= 0 && order.indexOf("X") < 0 &&
        clones.some(function (c) { return c.sex && (c.sex.label || "").indexOf("X") >= 0; })) {
      add("X");
    }
    var map = {};
    order.forEach(function (c, i) { map[c] = AFFECTED_PALETTE[i % AFFECTED_PALETTE.length]; });
    return map;
  }

  // Every cell a karyogram is made of, in order, for BOTH views. One list, because a
  // cell kind added to one view used to be able to go missing from the other, and did:
  // the absent-homolog placeholder for a monosomy shipped in the full karyogram and
  // had to be back-ported to the affected view afterwards. The two also disagreed
  // about where the placeholder sat, before markers in one and after them in the
  // other. Anything that decides WHICH cells exist belongs here.
  //
  // `only` selects the affected/isolated view. It filters to the listed chromosomes
  // and drops empty slots instead of drawing the full view's nullisomy ghost, since an
  // empty slot has nothing to isolate. Markers, double minutes and the sex placeholder
  // are not filtered: they are what the karyotype says is there or missing regardless
  // of which chromosomes were asked for.
  //
  // Everything past this point is layout, and the two views deliberately keep their
  // own. The affected row hangs every cell off one shared centromere line; doing that
  // across 24 chromosomes would put chromosome 1's centromere (about 123 Mb down) on
  // the same line as chromosome 21's (about 12 Mb down) and leave a chromosome-length
  // of blank space above every small one.
  function cellSpecs(clone, only) {
    var specs = [];
    var wanted = function (chrom) { return !only || only.indexOf(chrom) >= 0; };
    GROUPS.forEach(function (grp) {
      grp.chroms.forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        var lost = lostCount(clone, chrom);
        // An empty slot is normally nothing to isolate, so the affected view skips
        // it. Not when the karyotype STATES a loss for that chromosome: then the gap
        // is the finding. 44,XY,rob(14;21)(q10;q10),-21 leaves no free 21 at all (one
        // fused into the der, one lost) and used to draw no chromosome 21 whatsoever
        // in the focused view, so the -21 was invisible.
        if (!wanted(chrom) || (only && !insts.length && !lost)) return;
        specs.push({ row: grp.name, chrom: chrom, insts: insts, opts: {
          // A slot only empties two ways, and neither is nullisomy. With a stated
          // loss the gaps below say it (after rob(14;21) plus -21, 21q is still
          // present on the derivative, so that is a monosomy for 21q and not an
          // absence of it). Otherwise every copy was consumed by a derivative, as in
          // 43,XY,rob(13;14)(q10;q10),rob(13;14)(q10;q10), where both 13q and both
          // 14q are present on the two fusions and nothing is missing at all. The
          // label says what is true of the SLOT, which is that no free copy is left.
          ghost: !only && insts.length === 0 && !lost,
          ghostChrom: chrom, ghostText: "none free",
          missing: lost } });
      });
      if (!grp.sex) return;
      // 21, 22, then X, Y, then the gap where a lost sex chromosome was, then markers
      // and double minutes.
      ["X", "Y"].forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        if (!insts.length || !wanted(chrom)) return;
        specs.push({ row: grp.name, chrom: chrom, insts: insts, sexcell: true, opts: {
          sexcell: true, missing: lostCount(clone, chrom) } });
      });
      // An explicit sex-chromosome loss is a statement the figure must show, and
      // its identity is not a guess: the notation names it. 76~77,XX,-Y drew no
      // trace of the -Y at all (the written XX already filled the row), and
      // 45,X,-Y drew its gap without a label a reader could attribute. Each
      // explicitly lost sex chromosome with no free copy left gets a ghost slot
      // labeled with its own letter.
      var labeledGhosts = 0;
      ["X", "Y"].forEach(function (chrom) {
        var lostExplicit = clone.aberrations.some(function (ab) {
          return ab.kind === "loss" && String((ab.chroms || [])[0]) === chrom;
        });
        if (!lostExplicit || (clone.slots[chrom] || []).length) return;
        specs.push({ row: grp.name, chrom: chrom, insts: [], sexcell: true, opts: {
          ghost: true, ghostChrom: chrom, ghostText: "missing", sexcell: true } });
        labeledGhosts++;
      });
      // The karyogram shows the karyotype: when nothing names the lost chromosome
      // it does not label the gap "?" or guess whether an X or a Y was lost.
      var xN = (clone.slots["X"] || []).length, yN = (clone.slots["Y"] || []).length;
      for (var i = 0, n = 2 - (xN + yN) - labeledGhosts; i < n; i++) {
        specs.push({ row: grp.name, chrom: "", insts: [], sexcell: true, opts: {
          ghost: true, ghostChrom: "X", ghostText: "missing", sexcell: true } });
      }
      ["mar", "dmin"].forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        if (!insts.length) return;
        specs.push({ row: grp.name, chrom: chrom, insts: insts, opts: {
          missing: lostCount(clone, chrom) } });
      });
    });
    return specs;
  }

  // Merge a spec's own cellHtml options with the ones the layout adds (cenOffset,
  // seamCen). Kept explicit so a layout cannot silently drop a spec option.
  function cellOpts(spec, extra) {
    var out = {};
    for (var k in spec.opts) if (Object.prototype.hasOwnProperty.call(spec.opts, k)) out[k] = spec.opts[k];
    for (var j in extra) if (Object.prototype.hasOwnProperty.call(extra, j)) out[j] = extra[j];
    return out;
  }

  function render(container, clone, opts) {
    opts = opts || {};
    var ctx = { theme: opts.theme || "detailed", level: opts.level == null ? 99 : opts.level, affected: opts.affected || computeAffected(clone) };
    var specs = cellSpecs(clone, opts.only != null ? opts.only : null);

    // "Affected only" view (CyDAS AlteredChromosomesOnly): a single focused row of
    // just the involved chromosomes (each with its normal homolog + derivative), with
    // every centromere on one horizontal line — the classic karyogram look
    // (acrocentrics hang from the line, a metacentric Robertsonian sits centred on
    // it). Cells with no centromere on any copy (a dmin fragment) bottom-align.
    if (opts.only != null) {
      // Only cells with copies can be measured; cellMetrics reads drawn[0] and would
      // throw on the absent-homolog placeholder, which has none by definition.
      // A cell that is nothing but gaps still has to line up on the shared centromere
      // line, so measure a normal copy of its chromosome instead of its (empty) list.
      // Only the sex-chromosome placeholder, which has no chromosome of its own, is
      // left unmeasured.
      specs.forEach(function (s) {
        if (s.insts.length) s.m = cellMetrics(s.insts, ctx);
        else if (s.chrom && s.opts.missing > 0) s.m = cellMetrics([normalInst(s.chrom)], ctx);
      });
      // Cells sit on a common baseline, the same as the full 24-chromosome view.
      //
      // They used to hang off one shared horizontal centromere line, which is the
      // classic karyogram convention and is what ISCN's own plates show. Two things
      // were wrong with it here. It disagreed with the other view, so toggling Show
      // moved every chromosome for a reason the reader has no way to infer; and with
      // only two or three cells on screen there is no row of neighbours to read the
      // shared line against, so a shorter chromosome simply reads as floating above
      // the others rather than as aligned with them.
      //
      // Within a cell, a derivative is still aligned to its homolog on the centromere
      // (alignMode), which is where that comparison is actually made and where the
      // shared line does earn its keep. seamCen stays for the same reason.
      var maxH = specs.reduce(function (h, s) { return s.m && s.m.height > h ? s.m.height : h; }, 0);
      var oh = ['<div class="karyogram affected-only"><div class="kgroup">'];
      var sexOffset = 0;
      specs.forEach(function (s) {
        var off;
        if (!s.m) {
          // The placeholder inherits the offset of the sex cell it stands beside, so
          // the gap lines up with its surviving partner. It is always emitted after
          // X/Y, so sexOffset is already set.
          off = sexOffset;
        } else {
          off = Math.max(0, maxH - s.m.height);
          if (s.sexcell) sexOffset = off;
        }
        oh.push(cellHtml(s.chrom, s.insts, cellOpts(s, { cenOffset: off, seamCen: true }), ctx));
      });
      oh.push('</div></div>');
      container.innerHTML = oh.join("");
      return;
    }

    var html = ['<div class="karyogram">'];
    GROUPS.forEach(function (grp) {
      html.push('<div class="kgroup" data-group="' + grp.name + '">');
      specs.forEach(function (s) {
        if (s.row === grp.name) html.push(cellHtml(s.chrom, s.insts, cellOpts(s, {}), ctx));
      });
      html.push('</div>');
    });
    html.push('</div>');
    container.innerHTML = html.join("");
  }

  function ghost(chrom, label, mt) {
    var d = IDEO.data[chrom] || IDEO.data["X"];
    var H = h(d.length), pad = 3, cap = W * CAP_RATIO;
    var style = (mt && mt > 0.5) ? ' style="margin-top:' + mt.toFixed(1) + 'px"' : "";
    return '<div class="kchrom ghost"' + style + '><svg class="ideo" width="' + (W + pad * 2) + '" height="' + (H + pad * 2) +
      '"><rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" rx="' + cap + '" ry="' + cap +
      '" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/></svg><div class="ksub muted">' + esc(label || "absent") + '</div></div>';
  }

  // ----- large labeled detail (anatomy / zoom) ------------------------------
  function drawDetail(chrom, opts) {
    opts = opts || {};
    var d = IDEO.data[chrom]; if (!d) return "";
    var simple = opts.theme === "simple";
    var hue = opts.hue || null;
    var ramp = simple ? (hue ? tintRamp(hue) : BASELINE) : STAIN;
    var scale = (opts.height || 460) / d.length;
    var pad = 8, w = 34, cap = w * CAP_RATIO, labelX = pad + w + 12, H = d.length * scale;
    var svgW = 128, svgH = H + pad * 2 + 4, uid = "detail" + chrom;
    // The band map is the same chromosome as the karyogram beside it, drawn larger,
    // so it wears the same centromere constriction. Sizes scale with this figure's
    // own width and its taller hatched block (CEN_DH below), not the karyogram's.
    var CEN_DH = 13;
    var cy = pad + d.centromere * scale;
    var detailPinches = layoutPinches([{ y: cy, half: CEN_DH / 2, depth: 5.1 }], pad + cap, pad + H - cap);
    var detailShape = detailPinches.length
      ? '<path d="' + waistPath(pad, pad, w, H, cap, detailPinches) + '"'
      : '<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"';
    var defs = ['<clipPath id="' + uid + '">' + detailShape + '/></clipPath>'];
    var patCache = {};
    var CEN_HD = { angle: 45, gap: 4, w: 2 }, HET_HD = { angle: -45, gap: 9, w: 1.7 };
    function hatch(color, o) {
      o = o || {};
      var angle = o.angle == null ? 45 : o.angle, gap = o.gap || 5.2, w = o.w || 1.6;
      var key = color + "|" + angle + "|" + gap;
      if (patCache[key]) return patCache[key];
      var id = uid + "p" + Object.keys(patCache).length;
      patCache[key] = id;
      defs.push('<pattern id="' + id + '" width="' + gap + '" height="' + gap + '" patternTransform="rotate(' + angle + ')" patternUnits="userSpaceOnUse"><rect width="' + gap + '" height="' + gap + '" fill="#ffffff"/><line x1="0" y1="0" x2="0" y2="' + gap + '" stroke="' + color + '" stroke-width="' + w + '"/></pattern>');
      return id;
    }
    function heteroColor(stain) {
      if (simple) return hue ? (stain === "acen" ? hexMix(hue, "#1a1f36", 0.22) : hexMix(hue, "#ffffff", 0.28)) : (stain === "acen" ? "#3c4463" : "#808ba8");
      return stain === "acen" ? "#3c4463" : "#7c8ae9";
    }
    var body = ['<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" fill="#fff" clip-path="url(#' + uid + ')"/>'];
    body.push('<g clip-path="url(#' + uid + ')">');
    var bands = getBands(chrom, opts.level == null ? 99 : opts.level);
    bands.forEach(function (b) {
      var y0 = pad + b[1] * scale, y1 = pad + b[2] * scale, st = b[3];
      var fill = st === "acen" ? "url(#" + hatch(heteroColor(st), CEN_HD) + ")"
        : (st === "gvar" || st === "stalk") ? "url(#" + hatch(heteroColor(st), HET_HD) + ")"
          : (ramp[st] || ramp.gneg);
      body.push('<rect class="band" x="' + pad + '" y="' + y0.toFixed(2) + '" width="' + w + '" height="' + Math.max(0.8, y1 - y0).toFixed(2) +
        '" fill="' + fill + '" data-chrom="' + chrom + '" data-band="' + esc(b[0]) + '" data-stain="' + st + '" data-arm="' + b[0][0] + '"/>');
    });
    body.push('</g>');
    var lastY = -100;
    bands.forEach(function (b) {
      var ymid = pad + (b[1] + b[2]) / 2 * scale;
      if (ymid - lastY < 11) return;
      lastY = ymid;
      body.push('<line x1="' + (pad + w) + '" y1="' + ymid.toFixed(2) + '" x2="' + (labelX - 3) + '" y2="' + ymid.toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.6"/>');
      body.push('<text class="bandlabel" x="' + labelX + '" y="' + (ymid + 3).toFixed(2) + '" data-chrom="' + chrom + '" data-band="' + esc(b[0]) + '">' + esc(b[0]) + '</text>');
    });
    var ccol = heteroColor("acen");
    body.push('<rect x="' + pad + '" y="' + (cy - CEN_DH / 2).toFixed(2) + '" width="' + w + '" height="' + CEN_DH + '" fill="url(#' + hatch(ccol, CEN_HD) + ')" clip-path="url(#' + uid + ')"/>');
    body.push('<line x1="' + pad + '" y1="' + cy.toFixed(2) + '" x2="' + (pad + w) + '" y2="' + cy.toFixed(2) + '" stroke="' + ccol + '" stroke-width="1.2" stroke-dasharray="3 2" clip-path="url(#' + uid + ')"/>');
    body.push(detailShape + ' fill="none" stroke="' + (simple && hue ? hexMix(hue, "#000", 0.12) : OUTLINE) + '" stroke-width="1.4"/>');
    return '<svg class="ideo-detail" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '"><defs>' + defs.join("") + '</defs>' + body.join("") + '</svg>';
  }


  // ----- the detailed system (ISCN 5.4.2.2) ---------------------------------
  // The short system names the breakpoints; the detailed system names the band
  // composition of the chromosome that came out. ":" is a break, "::" a break and
  // reunion, and the arrow means "from - to" (5.4.2.2 c; both the arrow and the double
  // colon are in ISCN's symbol list). 5.4.2.2 b fixes the order: the description "starts
  // at the end of the short arm and proceeds to the end of the long arm (pter to qter),
  // with the bands being identified in the order in which they occur in the rearranged
  // chromosome", and the chromosome number is repeated on each band only when more than
  // one chromosome is involved.
  //
  // Generated from the SAME segment list the figure is drawn from, deliberately. That is
  // what makes it worth having twice over: it states in ISCN's own notation what the
  // picture claims, and because ISCN prints both forms for a hundred-odd karyotypes, it
  // can be checked against the standard (test/iscn-2024-detailed.js). It found a real
  // bug the day it was written, a graft drawn end-for-end (#220).
  //
  // Endpoint names come from the breakpoints AS WRITTEN wherever one lines up, not from
  // inverting the coordinate back into a band: resolveBand maps a band to its midpoint,
  // so the written band is the honest name for that coordinate and re-deriving it would
  // answer "8q24.12" where the karyotype said "8q24.1".
  function writtenBands(ab) {
    var out = {};
    if (!ab) return out;
    var add = function (chroms, groups) {
      (groups || []).forEach(function (g, i) {
        var c = String((chroms || [])[i] != null ? chroms[i] : (chroms || [])[0]);
        (g || []).forEach(function (b) {
          var r = IDEO.data[c] && resolveBand(c, b);
          if (r) out[c + "@" + r.mid] = c + b;
        });
      });
    };
    add(ab.chroms, ab.breakpoints);
    (ab.subOps || []).forEach(function (s) { add(s.chroms || ab.chroms, s.breakpoints); });
    return out;
  }

  // One endpoint: a telomere, a written band, or (last resort) the nearest band name.
  function endpointName(chrom, coord, names, prefix) {
    var d = IDEO.data[chrom], tag = prefix ? String(chrom) : "";
    if (!d) return tag;
    if (coord <= 0) return tag + "pter";
    if (coord >= d.length) return tag + "qter";
    var written = names[chrom + "@" + coord];
    if (written) return prefix ? written : written.slice(String(chrom).length);
    var nb = nearestBand(chrom, coord);
    return tag + (nb || "");
  }

  // The detailed form for one drawn instance, or "" when there is nothing to say.
  function detailedForm(inst) {
    var built = buildInstance(inst);
    var segs = built && built.segments;
    if (!segs || !segs.length || built.dmin || built.marker) return "";
    var ab = inst.aberration;
    var names = writtenBands(ab);
    // 5.4.2.2 b: the chromosome number rides on every band only when the rearrangement
    // involves more than one chromosome. An isodicentric from a single chromosome is
    // explicitly exempt (5.5.4 d), and it falls out of the same test.
    // Whether more than one CHROMOSOME is involved, not whether more than one distinct
    // number appears in the segments. ISCN 5.5.4 f i spells the difference out on
    // dic(13;13): "the chromosome number is given before pter and the breakpoint ... as
    // different chromosome 15 homologues are involved". A dicentric of two homologues
    // draws segments that all say 13 and still prefixes every band, because two
    // chromosomes went into it.
    var prefix = (ab && ab.chroms && ab.chroms.length > 1) ||
      Object.keys(segs.reduce(function (m, g) { m[String(g.chrom)] = 1; return m; }, {})).length > 1;
    // Adjacent pieces of the same chromosome that run on from one another are ONE
    // stretch, and ISCN writes them as one: dup(1)(q22q25) is (pter->q25::q22->qter),
    // not (pter->q25::q22->q25::q25->qter). The model splits at every operation
    // boundary because the drawing needs the pieces separately (a duplicated span wears
    // its own mark); the notation only breaks where the chromosome broke.
    var merged = [];
    segs.forEach(function (g) {
      var prev = merged[merged.length - 1];
      if (prev && String(prev.chrom) === String(g.chrom) && !prev.reversed && !g.reversed && prev.to === g.from) {
        merged[merged.length - 1] = { chrom: g.chrom, from: prev.from, to: g.to, reversed: false };
        return;
      }
      if (prev && String(prev.chrom) === String(g.chrom) && prev.reversed && g.reversed && prev.from === g.to) {
        merged[merged.length - 1] = { chrom: g.chrom, from: g.from, to: prev.to, reversed: true };
        return;
      }
      merged.push({ chrom: g.chrom, from: g.from, to: g.to, reversed: g.reversed });
    });
    // 5.4.2.2 e fixes the READING direction of a derivative, and for a whole-arm
    // der(A;B) the standard's own examples read the first-named chromosome's
    // material first: der(7;9)(7qter→7q10::9q10→9q34::22q11.2→22qter). Drawing
    // order is a morphology decision (short arm up; see wholeArmSegments) and may
    // disagree, so the body is serialised in whichever direction puts chromosome A
    // first. The same body read the other way is the same chromosome.
    var wholeArmAB = ab && (ab.op === "der" || ab.op === "rob") && (ab.chroms || []).length === 2 &&
      ab.breakpoints && isWholeArmBps(ab.breakpoints);
    if (wholeArmAB && merged.length > 1) {
      var wa0 = String(ab.chroms[0]);
      if (String(merged[0].chrom) !== wa0 && String(merged[merged.length - 1].chrom) === wa0) {
        merged.reverse();
        merged.forEach(function (g) { g.reversed = !g.reversed; });
      }
    }
    var parts = merged.map(function (g) {
      var top = g.reversed ? g.to : g.from, bot = g.reversed ? g.from : g.to;
      return endpointName(g.chrom, top, names, prefix) + "\u2192" + endpointName(g.chrom, bot, names, prefix);
    });
    // A broken end that was never rejoined takes a single colon on that side: ISCN
    // writes del(5)(q13) as (pter->q13:) and del(4)(p15.2) as (:p15.2->qter). Only the
    // OUTER ends can be unjoined; every internal boundary is a reunion by construction.
    var first = merged[0], last = merged[merged.length - 1];
    var openTop = (first.reversed ? first.to : first.from) > 0 &&
      (first.reversed ? first.to : first.from) < IDEO.data[first.chrom].length;
    var openBot = (last.reversed ? last.from : last.to) < IDEO.data[last.chrom].length &&
      (last.reversed ? last.from : last.to) > 0;
    return (openTop ? ":" : "") + parts.join("::") + (openBot ? ":" : "");
  }

  window.Karyo = {
    render: render, drawInstance: drawInstance, drawDetail: drawDetail, buildInstance: buildInstance,
    computeAffected: computeAffected, resolveBand: resolveBand, getBands: getBands, textWidth: textWidth,
    armExtent: armExtent, nearestBand: nearestBand, bandAncestor: bandAncestor, invalidBands: invalidBands, bandSnap: bandSnap, detailedForm: detailedForm,
    STAIN: STAIN, OP_COLORS: OP_COLORS, AFFECTED_PALETTE: AFFECTED_PALETTE, tintRamp: tintRamp, BASELINE: BASELINE
  };
})();
