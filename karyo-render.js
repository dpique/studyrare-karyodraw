/* KaryoDraw — SVG karyogram renderer.
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
  var OP_COLORS = { del: "#e0554f", dup: "#ec9b27", inv: "#5e72e4", add: "#808ba8", break: "#242a45", hsr: "#d6409f" };

  // Affected-chromosome hues. Leads with the brand pair — periwinkle "field"
  // then amber "signal" — so a 2-way rearrangement echoes StudyRare's motif.
  var AFFECTED_PALETTE = ["#5e72e4", "#ec9b27", "#6b8f55", "#e0554f", "#7c8ae9",
    "#d17f18", "#4a6b3a", "#4a5375", "#c53d38", "#37428a"];

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
    var out = groups.map(function (g) { return [g.name, g.start, g.end, mergeStain(g.subs)]; });
    _bandCache[key] = out;
    return out;
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
  function splitAtBreak(chrom, band) {
    var d = IDEO.data[chrom];
    var r = resolveBand(chrom, band);
    var bp = r ? r.mid : d.centromere;
    if (bp <= d.centromere) return { centric: [bp, d.length], acentric: [0, bp], bp: bp, side: "p" };
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

  // ----- composite ideogram renderer ----------------------------------------
  function renderComposite(segments, opts) {
    opts = opts || {};
    var ctx = opts.ctx || { theme: "detailed", level: 99, affected: {} };
    var simple = ctx.theme === "simple";
    var overlays = opts.overlays || [];
    var totalBp = segments.reduce(function (s, g) { return s + (g.to - g.from); }, 0);
    var H = h(totalBp);
    var pad = 3, cap = W * CAP_RATIO, CEN_H = 9;
    var svgW = W + pad * 2, svgH = H + pad * 2;
    var uid = "c" + (renderComposite._n = (renderComposite._n || 0) + 1);

    // dynamic diagonal-hatch patterns (heterochromatin texture), de-duped by color
    var defs = ['<clipPath id="' + uid + '"><rect x="' + pad + '" y="' + pad + '" width="' + W +
      '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"/></clipPath>'];
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

    var yOff = pad, cenList = [], junctionYs = [], firstBoundaryY = null;
    segments.forEach(function (g, gi) {
      var d = IDEO.data[g.chrom], segTop = yOff, segH = h(g.to - g.from);
      if (gi === 1) firstBoundaryY = segTop;   // the seam between the first two segments
      getBands(g.chrom, ctx.level).forEach(function (b) {
        var bs = Math.max(b[1], g.from), be = Math.min(b[2], g.to);
        if (be <= bs) return;
        var y0, y1;
        if (!g.reversed) { y0 = segTop + (bs - g.from) * PX; y1 = segTop + (be - g.from) * PX; }
        else { y0 = segTop + (g.to - be) * PX; y1 = segTop + (g.to - bs) * PX; }
        var st = b[3], fill;
        // heterochromatin renders as a hatched texture, not a solid band
        if (st === "acen") fill = "url(#" + hatch(heteroColor(g.chrom, st), g.reversed ? mirrorHatch(CEN_HATCH) : CEN_HATCH) + ")";
        else if (st === "gvar" || st === "stalk") fill = "url(#" + hatch(heteroColor(g.chrom, st), g.reversed ? mirrorHatch(HET_HATCH) : HET_HATCH) + ")";
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
    if (!cenList.length && segments.length >= 2 && firstBoundaryY != null) {
      cenList.push({ y: firstBoundaryY, chrom: segments[0].chrom, reversed: false });
      junctionYs = junctionYs.filter(function (jy) { return Math.abs(jy - firstBoundaryY) > 0.5; });
    }

    // centromere: hatched constriction with a guaranteed-visible height + a thin
    // dashed line at the exact p/q boundary. A texture, so it never reads as a
    // breakpoint marker.
    cenList.forEach(function (c) {
      var col = heteroColor(c.chrom, "acen");
      body.push('<rect x="' + pad + '" y="' + (c.y - CEN_H / 2).toFixed(2) + '" width="' + W + '" height="' + CEN_H +
        '" fill="url(#' + hatch(col, c.reversed ? mirrorHatch(CEN_HATCH) : CEN_HATCH) + ')" clip-path="url(#' + uid + ')"/>');
      body.push('<line x1="' + pad + '" y1="' + c.y.toFixed(2) + '" x2="' + (pad + W) + '" y2="' + c.y.toFixed(2) +
        '" stroke="' + col + '" stroke-width="1" stroke-dasharray="2.5 2"/>');
    });

    // overlays (del / dup / inv / add)
    overlays.forEach(function (ov) {
      if (ov.type === "cut") {                        // deletion break / repair join
        var cutY = pointY(segments, ov.chrom, ov.at, pad);
        if (cutY != null) breakMark(cutY, OP_COLORS.del);
        return;
      }
      var span = ov.segIndex != null ? segSpan(segments, ov.segIndex, pad) : mapRange(segments, ov.chrom, ov.from, ov.to, pad);
      if (!span) return;
      var hh = (span.y1 - span.y0).toFixed(2);
      if (ov.type === "del") {
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="url(#' + hatch(simple ? "#64748b" : OP_COLORS.del) + ')" clip-path="url(#' + uid + ')"/>');
        if (!simple) body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="' + OP_COLORS.del + '" fill-opacity="0.14" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "dup" && !simple) {
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="' + OP_COLORS.dup + '" fill-opacity="0.3" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "inv" && !simple) {
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="' + OP_COLORS.inv + '" fill-opacity="0.12" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "add") {
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="url(#' + hatch(OP_COLORS.add) + ')" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "hsr") {
        // Amplified block: a solid vivid band (the homogeneously staining region).
        body.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' + hh +
          '" fill="' + OP_COLORS.hsr + '" clip-path="url(#' + uid + ')"/>');
      }
      var mk = simple ? "#1e293b" : OP_COLORS.break;
      [span.y0, span.y1].forEach(function (yy) { if (yy > pad + 0.5 && yy < pad + H - 0.5) breakMark(yy, mk); });
    });
    // A breakpoint: thin SOLID line + inward carets. Distinct from the centromere.
    function breakMark(yy, color) {
      body.push('<line x1="' + pad + '" y1="' + yy.toFixed(2) + '" x2="' + (pad + W) + '" y2="' + yy.toFixed(2) + '" stroke="' + color + '" stroke-width="1.1"/>');
      body.push('<path d="M' + (pad - 3.2) + ' ' + (yy - 2.6) + ' L' + (pad + 0.6) + ' ' + yy + ' L' + (pad - 3.2) + ' ' + (yy + 2.6) + ' Z" fill="' + color + '"/>');
      body.push('<path d="M' + (pad + W + 3.2) + ' ' + (yy - 2.6) + ' L' + (pad + W - 0.6) + ' ' + yy + ' L' + (pad + W + 3.2) + ' ' + (yy + 2.6) + ' Z" fill="' + color + '"/>');
    }

    // fusion junctions between different chromosome pieces
    junctionYs.forEach(function (jy) {
      body.push('<line x1="' + (pad - 1) + '" y1="' + jy.toFixed(2) + '" x2="' + (pad + W + 1) + '" y2="' + jy.toFixed(2) +
        '" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="2 1.5"/>');
    });

    // Outline color follows the centromere-donor (the chromosome the derivative is
    // named for), not whichever piece happens to be drawn on top.
    var idChrom = (segments.filter(function (s) { return s.hasCen; })[0] || segments[0]).chrom;
    body.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" rx="' + cap + '" ry="' + cap +
      '" fill="none" stroke="' + outlineFor(ctx, idChrom) + '" stroke-width="1.1"/>');

    return {
      svg: '<svg class="ideo" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '"><defs>' +
        defs.join("") + '</defs>' + body.join("") + '</svg>',
      width: svgW, height: svgH,
      cenY: cenList.length ? cenList[0].y : null   // centromere y (for aligning homologs)
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
    if (kind === "mar") return { segments: [{ chrom: (chrom in IDEO.data ? chrom : "21"), from: 0, to: 24000000, hasCen: true, reversed: false }], overlays: [], caption: "mar", marker: true };
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
    if (kind === "ring") {
      var rb = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean), from = 0, to = d0.length;
      if (rb.length >= 2) { from = Math.min(rb[0].mid, rb[1].mid); to = Math.max(rb[0].mid, rb[1].mid); }
      return { segments: [{ chrom: chrom, from: from, to: to, hasCen: (from < d0.centromere && to > d0.centromere), reversed: false }], overlays: [], caption: inst.label, ring: true };
    }
    if (kind === "iso") {
      var arm = (ab.breakpoints[0] || [])[0] || "q10", isQ = /^q/.test(arm);
      var af = isQ ? d0.centromere : 0, at = isQ ? d0.length : d0.centromere;
      return { segments: [{ chrom: chrom, from: af, to: at, hasCen: false, reversed: isQ }, { chrom: chrom, from: af, to: at, hasCen: false, reversed: !isQ }], overlays: [], caption: inst.label };
    }
    if (kind === "ins") {
      var isb = buildInsertion(inst);
      if (isb) return { segments: isb.segments, overlays: isb.overlays || [], caption: inst.label, composite: true };
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
    if (kind === "dic") {
      // A two-chromosome dic fuses into one body with two centromeres; a single-
      // chromosome idic mirrors itself about the breakpoint (also dicentric).
      var dsegs = twoChrom ? dicentricSegments(inst) : isodicentricSegments(inst);
      if (dsegs) return { segments: dsegs, overlays: [], caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    if (kind === "t" || kind === "der") {
      var segs = translocationSegments(inst);
      // A der(N) chain can carry more than the join — a del/dup/inv on its own
      // chromosome (e.g. der(9)del(9)(p12)t(9;22)). Start from the join (or the
      // whole chromosome if there is no join) and apply those extra ops in turn.
      if (kind === "der" && ab && ab.subOps) {
        if (!segs) segs = [fullSeg(chrom)];
        segs = applyDerSubOps(inst, segs);
      }
      if (segs) return { segments: segs, overlays: [], caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
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
      var d = IDEO.data[chrom], lo = Math.min(a.mid, b.mid), hi = Math.max(a.mid, b.mid), inv = a.mid > b.mid, sp = site.mid, out = [];
      if (sp <= lo) {                              // insertion site proximal to the moved segment
        if (sp > 0) out.push(insSeg(chrom, 0, sp));
        out.push(insSeg(chrom, lo, hi, inv));      // the moved segment, in its new home
        out.push(insSeg(chrom, sp, lo));           // backbone between the site and the old location
        if (hi < d.length) out.push(insSeg(chrom, hi, d.length));
      } else {                                     // insertion site distal to the moved segment
        if (lo > 0) out.push(insSeg(chrom, 0, lo));
        out.push(insSeg(chrom, hi, sp));
        out.push(insSeg(chrom, lo, hi, inv));      // the moved segment
        if (sp < d.length) out.push(insSeg(chrom, sp, d.length));
      }
      return { segments: out.filter(function (s) { return s.to > s.from; }), overlays: [] };
    }
    var recip = String(chroms[0]), donor = String(chroms[1]);
    var site2 = resolveBand(recip, (bps[0] || [])[0]);
    var sg = bps[1] || [], s1 = resolveBand(donor, sg[0]), s2 = resolveBand(donor, sg[1]);
    if (!site2 || !s1 || !s2 || !IDEO.data[recip] || !IDEO.data[donor]) return null;
    var dlo = Math.min(s1.mid, s2.mid), dhi = Math.max(s1.mid, s2.mid), dinv = s1.mid > s2.mid;
    if (chrom === recip) {                         // der(recipient): grows by the donor segment
      var dr = IDEO.data[recip], rs = [];
      if (site2.mid > 0) rs.push(insSeg(recip, 0, site2.mid));
      rs.push(insSeg(donor, dlo, dhi, dinv));
      if (site2.mid < dr.length) rs.push(insSeg(recip, site2.mid, dr.length));
      return { segments: rs, overlays: [] };
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
  function wholeArmSegments(inst) {
    var ab = inst.aberration, chroms = ab.chroms, bps = ab.breakpoints;
    var a = String(chroms[0]), b = String(chroms[1]);
    if (!IDEO.data[a] || !IDEO.data[b]) return null;
    var arma = armOf((bps[0] || [])[0]), armb = armOf((bps[1] || [])[0]);
    var da = IDEO.data[a], db = IDEO.data[b];
    var segA = arma === "q" ? { chrom: a, from: da.centromere, to: da.length } : { chrom: a, from: 0, to: da.centromere };
    var segB = armb === "q" ? { chrom: b, from: db.centromere, to: db.length } : { chrom: b, from: 0, to: db.centromere };
    // Top arm: centromere at its bottom (a q arm must be flipped so qter is up);
    // bottom arm: centromere at its top (a p arm must be flipped so pter is down).
    segA.hasCen = true; segA.reversed = (arma === "q");
    segB.hasCen = true; segB.reversed = (armb === "p");
    return [segA, segB];
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
    return [
      { chrom: chrom, from: p[0], to: p[1], hasCen: true, reversed: false },
      { chrom: chrom, from: p[0], to: p[1], hasCen: true, reversed: true }
    ];
  }

  // Apply the trailing del/dup/inv sub-operations of a der() chain to the pieces
  // that belong to the der's own chromosome, leaving the joined-in material alone.
  function applyDerSubOps(inst, segs) {
    var ab = inst.aberration, primary = String(inst.primary);
    (ab.subOps || []).forEach(function (s) {
      if (["del", "dup", "inv"].indexOf(s.op) < 0) return;   // t/dic joins are already in segs
      if (String((s.chroms || [])[0]) !== primary) return;   // only ops on this der's chromosome
      var bands = (s.breakpoints || [])[0] || [], out = [];
      segs.forEach(function (seg) {
        if (String(seg.chrom) !== primary) { out.push(seg); return; }
        out = out.concat(applyOpToSeg(seg, primary, s.op, bands));
      });
      segs = out;
    });
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
    // 2-way this is exactly the reciprocal swap; for 3+ way it's the cyclic
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
    var fcol = "#ec9b27";
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
      return { svg: dout.svg, width: dout.width, height: dout.height, cenY: null, built: built };
    }
    if (built.ring && built.segments && built.segments[0]) {
      var rout = renderRing(built.segments[0], ctx);
      return { svg: rout.svg, width: rout.width, height: rout.height, cenY: null, built: built };
    }
    var out = renderComposite(built.segments, { overlays: built.overlays, ctx: ctx });
    return { svg: out.svg, width: out.width, height: out.height, cenY: out.cenY, built: built };
  }

  // ----- karyogram (one clone) ----------------------------------------------
  // 3 even rows of 8 (numeric order; groups not preserved, per request):
  //   1-8 · 9-16 · 17-22 + X,Y + markers
  var GROUPS = [
    { name: "r1", chroms: ["1", "2", "3", "4", "5", "6", "7", "8"] },
    { name: "r2", chroms: ["9", "10", "11", "12", "13", "14", "15", "16"] },
    { name: "r3", chroms: ["17", "18", "19", "20", "21", "22"], sex: true }
  ];

  // The within-cell layout metrics of a chromosome cell: the y of its aligned
  // centromere line (from the top of the copies), and the cell's drawn height.
  // Used to line every affected chromosome's centromere up on one horizontal line.
  function cellMetrics(insts, ctx) {
    var drawn = insts.map(function (i) { return drawInstance(i, ctx); });
    var sameLength = drawn.every(function (d) { return Math.abs(d.height - drawn[0].height) < 0.5; });
    var everyCen = drawn.every(function (d) { return d.cenY != null; });
    var maxCen = 0, maxH = 0;
    drawn.forEach(function (d) { if (d.cenY != null && d.cenY > maxCen) maxCen = d.cenY; if (d.height > maxH) maxH = d.height; });
    var cenLine = !everyCen ? null : (sameLength ? drawn[0].cenY : maxCen);
    return { cenLine: cenLine, height: maxH };
  }

  function cellHtml(labelText, insts, opts, ctx) {
    opts = opts || {};
    var copiesStyle = (opts.cenOffset && opts.cenOffset > 0.5) ? ' style="margin-top:' + opts.cenOffset.toFixed(1) + 'px"' : "";
    var h2 = ['<div class="kcell' + (opts.sexcell ? " sexcell" : "") + '"><div class="kcell-copies"' + copiesStyle + '>'];
    if (insts.length === 0 && opts.ghost) {
      h2.push(ghost(opts.ghostChrom || labelText, opts.ghostText || "absent"));
    } else {
      // Align the copies (normal homolog, derivative, del…) by their centromere,
      // so a shortened p-arm reads as a p-arm loss and a shortened q-arm as a
      // q-arm loss — matching how a real karyogram is compared side by side.
      // Three cases, in order:
      //  · SAME overall length (e.g. an inversion) → flush top/bottom, no shift.
      //  · every copy has a centromere y → centromere-align (the meaningful compare
      //    for del/dup/most translocations, which leave a copy shorter or longer).
      //  · a copy has NO centromere y (a whole-arm/Robertsonian derivative, an
      //    isochromosome — its centromere sits at a segment edge) → we can't
      //    centromere-align, so BOTTOM-align to the group's baseline (align-items:
      //    flex-end) instead of letting the short copy float at the top.
      var drawn = insts.map(function (inst) { return { inst: inst, d: drawInstance(inst, ctx) }; });
      var sameLength = drawn.every(function (x) { return Math.abs(x.d.height - drawn[0].d.height) < 0.5; });
      var allCen = !sameLength && drawn.every(function (x) { return x.d.cenY != null; });
      var maxCen = 0, maxH = 0;
      drawn.forEach(function (x) { if (x.d.cenY != null && x.d.cenY > maxCen) maxCen = x.d.cenY; if (x.d.height > maxH) maxH = x.d.height; });
      drawn.forEach(function (x) {
        var inst = x.inst, d = x.d;
        var mt = 0;
        if (!sameLength) mt = allCen ? Math.max(0, maxCen - d.cenY) : Math.max(0, maxH - d.height);
        var cls = "kchrom" + (inst.kind !== "normal" ? " abn" : "");
        var sub = (inst.kind !== "normal") ? '<div class="ksub">' + esc(d.built.caption) + '</div>' : "";
        var style = mt > 0.5 ? ' style="margin-top:' + mt.toFixed(1) + 'px"' : "";
        h2.push('<div class="' + cls + '" data-chrom="' + inst.chrom + '" data-kind="' + inst.kind + '"' + style + '>' + d.svg + sub + '</div>');
      });
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
    var map = {};
    order.forEach(function (c, i) { map[c] = AFFECTED_PALETTE[i % AFFECTED_PALETTE.length]; });
    return map;
  }

  function render(container, clone, opts) {
    opts = opts || {};
    var ctx = { theme: opts.theme || "detailed", level: opts.level == null ? 99 : opts.level, affected: opts.affected || computeAffected(clone) };

    // "Affected only" view (CyDAS AlteredChromosomesOnly): a single focused row of
    // just the involved chromosomes (each with its normal homolog + derivative).
    if (opts.only != null) {
      var order = window.ISCN.ALL;
      var list = opts.only.slice().sort(function (a, b) { return order.indexOf(a) - order.indexOf(b); });
      // Build the focused row, then line every chromosome's centromere up on one
      // horizontal line — the classic karyogram look (acrocentrics hang from the
      // line, a metacentric Robertsonian sits centered on it). Cells with no
      // centromere on any copy (a dmin fragment) bottom-align to the baseline.
      var cells = [];
      list.forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        if (insts.length) cells.push({ chrom: chrom, insts: insts, sexcell: (chrom === "X" || chrom === "Y"), m: cellMetrics(insts, ctx) });
      });
      if ((clone.slots["mar"] || []).length) cells.push({ chrom: "mar", insts: clone.slots["mar"], m: cellMetrics(clone.slots["mar"], ctx) });
      if ((clone.slots["dmin"] || []).length) cells.push({ chrom: "dmin", insts: clone.slots["dmin"], m: cellMetrics(clone.slots["dmin"], ctx) });
      var withCen = cells.filter(function (c) { return c.m.cenLine != null; });
      var above = withCen.length ? Math.max.apply(null, withCen.map(function (c) { return c.m.cenLine; })) : 0;
      var below = withCen.length ? Math.max.apply(null, withCen.map(function (c) { return c.m.height - c.m.cenLine; })) : 0;
      var totalH = above + below;
      var oh = ['<div class="karyogram affected-only"><div class="kgroup">'];
      cells.forEach(function (c) {
        var off = c.m.cenLine != null ? (above - c.m.cenLine) : Math.max(0, totalH - c.m.height);
        oh.push(cellHtml(c.chrom, c.insts, { sexcell: c.sexcell, cenOffset: off }, ctx));
      });
      oh.push('</div></div>');
      container.innerHTML = oh.join("");
      return;
    }

    var html = ['<div class="karyogram">'];
    GROUPS.forEach(function (grp) {
      html.push('<div class="kgroup" data-group="' + grp.name + '">');
      grp.chroms.forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        html.push(cellHtml(chrom, insts, { ghost: insts.length === 0, ghostChrom: chrom, ghostText: "nullisomy" }, ctx));
      });
      if (grp.sex) {   // 21, 22, then X, Y, then any markers — group G + sex chromosomes
        var xN = (clone.slots["X"] || []).length, yN = (clone.slots["Y"] || []).length;
        if (xN) html.push(cellHtml("X", clone.slots["X"], { sexcell: true }, ctx));
        if (yN) html.push(cellHtml("Y", clone.slots["Y"], { sexcell: true }, ctx));
        var missing = 2 - (xN + yN);
        for (var mi = 0; mi < missing; mi++) html.push(cellHtml("?", [], { ghost: true, ghostChrom: "X", ghostText: "missing", sexcell: true }, ctx));
        if ((clone.slots["mar"] || []).length) html.push(cellHtml("mar", clone.slots["mar"], {}, ctx));
        if ((clone.slots["dmin"] || []).length) html.push(cellHtml("dmin", clone.slots["dmin"], {}, ctx));
      }
      html.push('</div>');
    });
    html.push('</div>');
    container.innerHTML = html.join("");
  }

  function ghost(chrom, label) {
    var d = IDEO.data[chrom] || IDEO.data["X"];
    var H = h(d.length), pad = 3, cap = W * CAP_RATIO;
    return '<div class="kchrom ghost"><svg class="ideo" width="' + (W + pad * 2) + '" height="' + (H + pad * 2) +
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
    var defs = ['<clipPath id="' + uid + '"><rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"/></clipPath>'];
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
    var cy = pad + d.centromere * scale, CEN_DH = 13, ccol = heteroColor("acen");
    body.push('<rect x="' + pad + '" y="' + (cy - CEN_DH / 2).toFixed(2) + '" width="' + w + '" height="' + CEN_DH + '" fill="url(#' + hatch(ccol, CEN_HD) + ')" clip-path="url(#' + uid + ')"/>');
    body.push('<line x1="' + pad + '" y1="' + cy.toFixed(2) + '" x2="' + (pad + w) + '" y2="' + cy.toFixed(2) + '" stroke="' + ccol + '" stroke-width="1.2" stroke-dasharray="3 2"/>');
    body.push('<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '" fill="none" stroke="' + (simple && hue ? hexMix(hue, "#000", 0.12) : OUTLINE) + '" stroke-width="1.4"/>');
    return '<svg class="ideo-detail" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '"><defs>' + defs.join("") + '</defs>' + body.join("") + '</svg>';
  }

  window.Karyo = {
    render: render, drawInstance: drawInstance, drawDetail: drawDetail, buildInstance: buildInstance,
    computeAffected: computeAffected, resolveBand: resolveBand, getBands: getBands,
    STAIN: STAIN, OP_COLORS: OP_COLORS, AFFECTED_PALETTE: AFFECTED_PALETTE, tintRamp: tintRamp, BASELINE: BASELINE
  };
})();
