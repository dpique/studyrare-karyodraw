/* KaryoScope — SVG karyogram renderer.
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
  var OP_COLORS = { del: "#e0554f", dup: "#ec9b27", inv: "#5e72e4", add: "#808ba8", break: "#242a45" };

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
      gneg: "#ffffff", gpos25: hexMix(hue, "#ffffff", 0.76), gpos50: hexMix(hue, "#ffffff", 0.52),
      gpos75: hexMix(hue, "#ffffff", 0.26), gpos100: hue, gvar: hexMix(hue, "#ffffff", 0.55),
      stalk: hexMix(hue, "#ffffff", 0.62), acen: hexMix(hue, "#ffffff", 0.32)
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

  // ----- geometry ------------------------------------------------------------
  var MAXH = 280, W = 28, maxLen = 0;
  IDEO.chromosomes.forEach(function (c) { maxLen = Math.max(maxLen, IDEO.data[c].length); });
  var PX = MAXH / maxLen;
  function h(bp) { return Math.max(1, bp * PX); }

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
    var pad = 3, cap = W / 2, CEN_H = 9;
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

    var yOff = pad, cenList = [], junctionYs = [];
    segments.forEach(function (g, gi) {
      var d = IDEO.data[g.chrom], segTop = yOff, segH = h(g.to - g.from);
      getBands(g.chrom, ctx.level).forEach(function (b) {
        var bs = Math.max(b[1], g.from), be = Math.min(b[2], g.to);
        if (be <= bs) return;
        var y0, y1;
        if (!g.reversed) { y0 = segTop + (bs - g.from) * PX; y1 = segTop + (be - g.from) * PX; }
        else { y0 = segTop + (g.to - be) * PX; y1 = segTop + (g.to - bs) * PX; }
        var st = b[3], fill;
        // heterochromatin renders as a hatched texture, not a solid band
        if (st === "acen") fill = "url(#" + hatch(heteroColor(g.chrom, st), CEN_HATCH) + ")";
        else if (st === "gvar" || st === "stalk") fill = "url(#" + hatch(heteroColor(g.chrom, st), HET_HATCH) + ")";
        else fill = fillFor(ctx, g.chrom, st);
        body.push('<rect class="band" x="' + pad + '" y="' + y0.toFixed(2) + '" width="' + W +
          '" height="' + Math.max(0.6, y1 - y0).toFixed(2) + '" fill="' + fill + '"' +
          ' data-chrom="' + esc(g.chrom) + '" data-band="' + esc(b[0]) + '" data-stain="' + st +
          '" data-arm="' + b[0][0] + '"/>');
      });
      if (g.hasCen && d.centromere > g.from && d.centromere < g.to) {
        cenList.push({ y: g.reversed ? segTop + (g.to - d.centromere) * PX : segTop + (d.centromere - g.from) * PX, chrom: g.chrom });
      }
      if (gi > 0 && segments[gi - 1].chrom !== g.chrom) junctionYs.push(segTop);
      yOff += segH;
    });
    body.push('</g>');

    // centromere: hatched constriction with a guaranteed-visible height + a thin
    // dashed line at the exact p/q boundary. A texture, so it never reads as a
    // breakpoint marker.
    cenList.forEach(function (c) {
      var col = heteroColor(c.chrom, "acen");
      body.push('<rect x="' + pad + '" y="' + (c.y - CEN_H / 2).toFixed(2) + '" width="' + W + '" height="' + CEN_H +
        '" fill="url(#' + hatch(col, CEN_HATCH) + ')" clip-path="url(#' + uid + ')"/>');
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
      var span = mapRange(segments, ov.chrom, ov.from, ov.to, pad);
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

    body.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" rx="' + cap + '" ry="' + cap +
      '" fill="none" stroke="' + outlineFor(ctx, segments[0].chrom) + '" stroke-width="1.1"/>');

    return {
      svg: '<svg class="ideo" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '"><defs>' +
        defs.join("") + '</defs>' + body.join("") + '</svg>',
      width: svgW, height: svgH
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
      var db = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean), ov2 = [];
      if (db.length >= 2) ov2.push({ type: "dup", chrom: chrom, from: Math.min(db[0].mid, db[1].mid), to: Math.max(db[0].mid, db[1].mid) });
      else if (db.length === 1) ov2.push({ type: "dup", chrom: chrom, from: db[0].start, to: db[0].end });
      return { segments: [fullSeg(chrom)], overlays: ov2, caption: inst.label };
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
    if (kind === "t" || kind === "dic" || kind === "der") {
      var segs = translocationSegments(inst);
      if (segs) return { segments: segs, overlays: [], caption: inst.label, composite: true };
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }
    return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
  }

  function translocationSegments(inst) {
    var ab = inst.aberration, primary = inst.primary, chroms = ab.chroms, bps = ab.breakpoints;
    if (ab.kind === "der" && ab.subOps) {
      var t = ab.subOps.filter(function (s) { return s.op === "t"; })[0];
      if (t) { chroms = t.chroms; bps = t.breakpoints; } else return null;
    }
    if (chroms.length < 2 || bps.length < 2) return null;
    var a = chroms[0], b = chroms[1], ba = (bps[0] || [])[0], bb = (bps[1] || [])[0];
    if (!IDEO.data[a] || !IDEO.data[b] || !ba || !bb) return null;
    var sa = splitAtBreak(a, ba), sb = splitAtBreak(b, bb);
    function centricSeg(c, s) { return { chrom: c, from: s.centric[0], to: s.centric[1], hasCen: true, reversed: false }; }
    function acentricSeg(c, s) { return { chrom: c, from: s.acentric[0], to: s.acentric[1], hasCen: false, reversed: false }; }
    var isA = String(primary) === String(a);
    var keep = isA ? centricSeg(a, sa) : centricSeg(b, sb);
    var add = isA ? acentricSeg(b, sb) : acentricSeg(a, sa);
    var keepSide = isA ? sa.side : sb.side;
    return (keepSide === "q") ? [keep, add] : [add, keep];
  }

  function drawInstance(inst, ctx) {
    var built = buildInstance(inst);
    var out = renderComposite(built.segments, { overlays: built.overlays, ctx: ctx });
    return { svg: out.svg, width: out.width, height: out.height, built: built };
  }

  // ----- karyogram (one clone) ----------------------------------------------
  // 3-row karyogram (wide, not a tall column), Denver groups kept intact:
  //   row 1: groups A+B (1-5)  ·  row 2: group C (6-12)
  //   row 3: groups D+E+F+G (13-22) + sex (X,Y) + markers
  var GROUPS = [
    { name: "AB", chroms: ["1", "2", "3", "4", "5"] },
    { name: "C", chroms: ["6", "7", "8", "9", "10", "11", "12"] },
    { name: "DEFG", chroms: ["13", "14", "15", "16", "17", "18", "19", "20", "21", "22"], sex: true }
  ];

  function cellHtml(labelText, insts, opts, ctx) {
    opts = opts || {};
    var h2 = ['<div class="kcell' + (opts.sexcell ? " sexcell" : "") + '"><div class="kcell-copies">'];
    if (insts.length === 0 && opts.ghost) h2.push(ghost(opts.ghostChrom || labelText, opts.ghostText || "absent"));
    else insts.forEach(function (inst) {
      var d = drawInstance(inst, ctx);
      var cls = "kchrom" + (inst.kind !== "normal" ? " abn" : "");
      var sub = (inst.kind !== "normal") ? '<div class="ksub">' + esc(d.built.caption) + '</div>' : "";
      var badge = inst.kind === "gain" ? '<div class="kbadge gain">+1</div>' : "";
      h2.push('<div class="' + cls + '" data-chrom="' + inst.chrom + '" data-kind="' + inst.kind + '">' + badge + d.svg + sub + '</div>');
    });
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
      var oh = ['<div class="karyogram affected-only"><div class="kgroup">'];
      list.forEach(function (chrom) {
        var insts = clone.slots[chrom] || [];
        if (insts.length) oh.push(cellHtml(chrom, insts, { sexcell: (chrom === "X" || chrom === "Y") }, ctx));
      });
      if ((clone.slots["mar"] || []).length) oh.push(cellHtml("mar", clone.slots["mar"], {}, ctx));
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
      }
      html.push('</div>');
    });
    html.push('</div>');
    container.innerHTML = html.join("");
  }

  function ghost(chrom, label) {
    var d = IDEO.data[chrom] || IDEO.data["X"];
    var H = h(d.length), pad = 3, cap = W / 2;
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
    var pad = 8, w = 34, cap = w / 2, labelX = pad + w + 12, H = d.length * scale;
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
