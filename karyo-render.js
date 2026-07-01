/* KaryoScope — SVG karyogram renderer.
 *
 * Turns a parsed ISCN clone (from window.ISCN) + the IDEOGRAM band data into
 * crisp SVG chromosome ideograms, including reshaped derivative chromosomes for
 * structural rearrangements. Pure string-building; the host sets innerHTML and
 * uses event delegation for hover.
 *
 * window.Karyo:
 *   render(container, clone, opts)      -> draw a full karyogram for one clone
 *   drawInstance(instance, opts)        -> {svg, width, height} for one chromosome copy
 *   drawDetail(chrom, opts)             -> large labeled ideogram (anatomy / zoom)
 *   resolveBand(chrom, band)            -> {start,end,mid,arm}
 *   STAIN, ORIGIN_COLORS, OP_COLORS
 */
(function () {
  "use strict";

  var IDEO = window.IDEOGRAM;

  // ----- palette -------------------------------------------------------------
  // Refined slate Giemsa ramp (modern, readable) instead of the classic muddy gray.
  var STAIN = {
    gneg:   "#f1f5f9",
    gpos25: "#cbd5e1",
    gpos50: "#94a3b8",
    gpos75: "#64748b",
    gpos100:"#334155",
    gvar:   "#c7d2fe",  // variable region (indigo tint)
    stalk:  "#c7d2fe",  // acrocentric stalk
    acen:   "#fb7185"   // centromere (rose)
  };
  var OUTLINE = "#475569";
  var CEN_COLOR = "#e11d48";
  var OP_COLORS = {
    del: "#ef4444",   // red — lost material
    dup: "#f59e0b",   // amber — gained material
    inv: "#8b5cf6",   // violet — flipped
    add: "#78716c",   // stone — unknown added material
    ring:"#0ea5e9",   // sky
    break:"#e11d48"
  };
  // Distinct accents per chromosome, so translocation pieces are colour-coded.
  var ORIGIN_COLORS = ["#0d9488","#7c3aed","#db2777","#ea580c","#0284c7",
    "#65a30d","#c026d3","#0891b2","#d97706","#4f46e5"];
  function originColor(chrom) {
    var idx = IDEO.chromosomes.indexOf(String(chrom));
    if (idx < 0) idx = 0;
    return ORIGIN_COLORS[idx % ORIGIN_COLORS.length];
  }

  // ----- geometry ------------------------------------------------------------
  var MAXH = 232;          // pixel height of the longest chromosome (chr1)
  var W = 22;              // ideogram width
  var maxLen = 0;
  IDEO.chromosomes.forEach(function (c) { maxLen = Math.max(maxLen, IDEO.data[c].length); });
  var PX = MAXH / maxLen;  // pixels per base pair (shared scale => real relative sizes)
  function h(bp) { return Math.max(1, bp * PX); }

  function resolveBand(chrom, name) {
    var d = IDEO.data[chrom];
    if (!d || !name) return null;
    name = String(name).trim();
    if (name === "pter") return { start: 0, end: 0, mid: 0, arm: "p" };
    if (name === "qter") return { start: d.length, end: d.length, mid: d.length, arm: "q" };
    if (name === "cen") return { start: d.centromere, end: d.centromere, mid: d.centromere, arm: "cen" };
    var m10 = /^([pq])10$/.exec(name); // whole-arm / centromeric breakpoint
    if (m10) return { start: d.centromere, end: d.centromere, mid: d.centromere, arm: m10[1] };
    var cands = d.bands.filter(function (b) { return b[0] === name || b[0].indexOf(name + ".") === 0; });
    if (!cands.length) cands = d.bands.filter(function (b) { return b[0].indexOf(name) === 0; });
    if (!cands.length) return null;
    var start = Math.min.apply(null, cands.map(function (b) { return b[1]; }));
    var end = Math.max.apply(null, cands.map(function (b) { return b[2]; }));
    return { start: start, end: end, mid: (start + end) / 2, arm: name[0] };
  }

  // Split a chromosome at a breakpoint into its centromere-bearing (centric)
  // part and the acentric fragment.
  function splitAtBreak(chrom, band) {
    var d = IDEO.data[chrom];
    var r = resolveBand(chrom, band);
    var bp = r ? r.mid : d.centromere;
    if (bp <= d.centromere) return { centric: [bp, d.length], acentric: [0, bp], bp: bp, side: "p" };
    return { centric: [0, bp], acentric: [bp, d.length], bp: bp, side: "q" };
  }

  // ----- low-level SVG builders ---------------------------------------------
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }

  // A "segment" = a contiguous piece of one chromosome to draw: {chrom, from, to,
  // hasCen, reversed}. A normal chromosome is one full segment.
  // Render a stack of segments into an SVG capsule with band shading + overlays.
  function renderComposite(segments, opts) {
    opts = opts || {};
    var overlays = opts.overlays || [];
    var totalBp = segments.reduce(function (s, g) { return s + (g.to - g.from); }, 0);
    var H = h(totalBp);
    var pad = 3, cap = W / 2;
    var svgW = W + pad * 2, svgH = H + pad * 2;
    var uid = "c" + (renderComposite._n = (renderComposite._n || 0) + 1);

    var parts = [];
    parts.push('<svg class="ideo" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">');
    // clip capsule
    parts.push('<defs><clipPath id="' + uid + '"><rect x="' + pad + '" y="' + pad + '" width="' + W +
      '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"/></clipPath>');
    parts.push('<pattern id="' + uid + 'h" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<rect width="5" height="5" fill="#fff" fill-opacity="0"/><line x1="0" y1="0" x2="0" y2="5" stroke="' +
      OP_COLORS.del + '" stroke-width="2"/></pattern>');
    parts.push('<pattern id="' + uid + 'a" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">' +
      '<rect width="5" height="5" fill="' + OP_COLORS.add + '" fill-opacity="0.25"/><line x1="0" y1="0" x2="0" y2="5" stroke="' +
      OP_COLORS.add + '" stroke-width="1.5"/></pattern></defs>');

    parts.push('<g clip-path="url(#' + uid + ')">');
    // background (so gneg reads as off-white on any page bg)
    parts.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" fill="#fff"/>');

    var yOff = pad;
    var cenYs = [];       // centromere y positions (for notch)
    var junctionYs = [];  // between-origin joins
    segments.forEach(function (g, gi) {
      var d = IDEO.data[g.chrom];
      var segTop = yOff;
      var segH = h(g.to - g.from);
      // bands intersecting [from,to]
      d.bands.forEach(function (b) {
        var bs = Math.max(b[1], g.from), be = Math.min(b[2], g.to);
        if (be <= bs) return;
        var y0, y1;
        if (!g.reversed) { y0 = segTop + (bs - g.from) * PX; y1 = segTop + (be - g.from) * PX; }
        else { y0 = segTop + (g.to - be) * PX; y1 = segTop + (g.to - bs) * PX; }
        var fill = STAIN[b[3]] || STAIN.gneg;
        parts.push('<rect class="band" x="' + pad + '" y="' + y0.toFixed(2) + '" width="' + W +
          '" height="' + Math.max(0.6, y1 - y0).toFixed(2) + '" fill="' + fill + '"' +
          ' data-chrom="' + esc(g.chrom) + '" data-band="' + esc(b[0]) + '" data-stain="' + b[3] +
          '" data-arm="' + b[0][0] + '"/>');
      });
      // centromere marker inside this segment
      if (g.hasCen && d.centromere > g.from && d.centromere < g.to) {
        var cy = g.reversed ? segTop + (g.to - d.centromere) * PX : segTop + (d.centromere - g.from) * PX;
        cenYs.push(cy);
      }
      if (gi > 0 && segments[gi - 1].chrom !== g.chrom) junctionYs.push(segTop);
      yOff += segH;
    });
    parts.push('</g>');

    // overlays (del/dup/inv/add) — mapped through the segment coordinate space
    overlays.forEach(function (ov) {
      var span = mapRange(segments, ov.chrom, ov.from, ov.to, pad);
      if (!span) return;
      if (ov.type === "del") {
        parts.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' +
          (span.y1 - span.y0).toFixed(2) + '" fill="url(#' + uid + 'h)" clip-path="url(#' + uid + ')"/>');
        parts.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' +
          (span.y1 - span.y0).toFixed(2) + '" fill="' + OP_COLORS.del + '" fill-opacity="0.18" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "dup") {
        parts.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' +
          (span.y1 - span.y0).toFixed(2) + '" fill="' + OP_COLORS.dup + '" fill-opacity="0.3" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "inv") {
        parts.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' +
          (span.y1 - span.y0).toFixed(2) + '" fill="' + OP_COLORS.inv + '" fill-opacity="0.28" clip-path="url(#' + uid + ')"/>');
      } else if (ov.type === "add") {
        parts.push('<rect x="' + pad + '" y="' + span.y0.toFixed(2) + '" width="' + W + '" height="' +
          (span.y1 - span.y0).toFixed(2) + '" fill="url(#' + uid + 'a)" clip-path="url(#' + uid + ')"/>');
      }
      // break markers at overlay edges
      [span.y0, span.y1].forEach(function (yy) {
        if (yy > pad + 1 && yy < pad + H - 1)
          parts.push('<line x1="' + (pad - 2) + '" y1="' + yy.toFixed(2) + '" x2="' + (pad + W + 2) +
            '" y2="' + yy.toFixed(2) + '" stroke="' + OP_COLORS.break + '" stroke-width="1.4"/>');
      });
    });

    // centromere notches (visual constriction)
    cenYs.forEach(function (cy) {
      var n = 4;
      parts.push('<path d="M' + pad + ' ' + (cy - n) + ' L' + (pad + n) + ' ' + cy + ' L' + pad + ' ' + (cy + n) + ' Z" fill="' + CEN_COLOR + '"/>');
      parts.push('<path d="M' + (pad + W) + ' ' + (cy - n) + ' L' + (pad + W - n) + ' ' + cy + ' L' + (pad + W) + ' ' + (cy + n) + ' Z" fill="' + CEN_COLOR + '"/>');
    });
    // junction lines between fused chromosome pieces
    junctionYs.forEach(function (jy) {
      parts.push('<line x1="' + (pad - 1) + '" y1="' + jy.toFixed(2) + '" x2="' + (pad + W + 1) + '" y2="' + jy.toFixed(2) +
        '" stroke="#0f172a" stroke-width="1.6" stroke-dasharray="2 1.5"/>');
    });

    // outline
    parts.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H + '" rx="' + cap + '" ry="' + cap +
      '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.1"/>');
    parts.push('</svg>');
    return { svg: parts.join(""), width: svgW, height: svgH };
  }

  // Map a bp range on a given chromosome into composite y-space (first matching segment).
  function mapRange(segments, chrom, from, to, pad) {
    var yOff = pad;
    for (var i = 0; i < segments.length; i++) {
      var g = segments[i];
      if (g.chrom === chrom) {
        var a = Math.max(from, g.from), b = Math.min(to, g.to);
        if (b > a) {
          var y0, y1;
          if (!g.reversed) { y0 = yOff + (a - g.from) * PX; y1 = yOff + (b - g.from) * PX; }
          else { y0 = yOff + (g.to - b) * PX; y1 = yOff + (g.to - a) * PX; }
          return { y0: y0, y1: y1 };
        }
      }
      yOff += h(g.to - g.from);
    }
    return null;
  }

  // ----- interpret an instance into segments + overlays ----------------------
  function fullSeg(chrom) {
    return { chrom: chrom, from: 0, to: IDEO.data[chrom].length, hasCen: true, reversed: false };
  }

  function buildInstance(inst) {
    var chrom = inst.chrom, ab = inst.aberration, kind = inst.kind;
    if (kind === "normal" || kind === "gain") {
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
    }
    if (kind === "mar") {
      // small generic marker: draw a stubby centric fragment
      var d = IDEO.data[chrom] || { length: 30000000, centromere: 15000000 };
      return { segments: [{ chrom: chrom in IDEO.data ? chrom : "21", from: 0, to: 24000000, hasCen: true, reversed: false }], overlays: [], caption: "mar", marker: true };
    }
    var d0 = IDEO.data[chrom];

    if (kind === "del") {
      var bps = (ab.breakpoints[0] || []);
      var seg = fullSeg(chrom), ovs = [];
      if (bps.length >= 2) { // interstitial
        var b1 = resolveBand(chrom, bps[0]), b2 = resolveBand(chrom, bps[1]);
        if (b1 && b2) ovs.push({ type: "del", chrom: chrom, from: Math.min(b1.mid, b2.mid), to: Math.max(b1.mid, b2.mid) });
      } else if (bps.length === 1) { // terminal
        var b = resolveBand(chrom, bps[0]);
        if (b) {
          if (b.arm === "p") ovs.push({ type: "del", chrom: chrom, from: 0, to: b.mid });
          else ovs.push({ type: "del", chrom: chrom, from: b.mid, to: d0.length });
        }
      }
      return { segments: [seg], overlays: ovs, caption: inst.label };
    }

    if (kind === "dup" || kind === "trp") {
      var db = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      var ov2 = [];
      if (db.length >= 2) ov2.push({ type: "dup", chrom: chrom, from: Math.min(db[0].mid, db[1].mid), to: Math.max(db[0].mid, db[1].mid) });
      else if (db.length === 1) ov2.push({ type: "dup", chrom: chrom, from: db[0].start, to: db[0].end });
      return { segments: [fullSeg(chrom)], overlays: ov2, caption: inst.label };
    }

    if (kind === "inv") {
      var ib = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      var ov3 = [];
      if (ib.length >= 2) ov3.push({ type: "inv", chrom: chrom, from: Math.min(ib[0].mid, ib[1].mid), to: Math.max(ib[0].mid, ib[1].mid) });
      return { segments: [fullSeg(chrom)], overlays: ov3, caption: inst.label };
    }

    if (kind === "add") {
      var abnd = resolveBand(chrom, (ab.breakpoints[0] || [])[0]);
      var ov4 = [];
      if (abnd) {
        if (abnd.arm === "p") ov4.push({ type: "add", chrom: chrom, from: 0, to: abnd.mid });
        else ov4.push({ type: "add", chrom: chrom, from: abnd.mid, to: d0.length });
      }
      return { segments: [fullSeg(chrom)], overlays: ov4, caption: inst.label };
    }

    if (kind === "ring") {
      var rb = (ab.breakpoints[0] || []).map(function (x) { return resolveBand(chrom, x); }).filter(Boolean);
      var from = 0, to = d0.length;
      if (rb.length >= 2) { from = Math.min(rb[0].mid, rb[1].mid); to = Math.max(rb[0].mid, rb[1].mid); }
      return { segments: [{ chrom: chrom, from: from, to: to, hasCen: (from < d0.centromere && to > d0.centromere), reversed: false }], overlays: [], caption: inst.label, ring: true };
    }

    if (kind === "iso") {
      // isochromosome: two mirrored copies of one arm about the centromere
      var arm = (ab.breakpoints[0] || [])[0] || "q10";
      var isQ = /^q/.test(arm);
      var armFrom = isQ ? d0.centromere : 0;
      var armTo = isQ ? d0.length : d0.centromere;
      // top = arm reversed, bottom = arm forward; centromere in the middle
      var s1 = { chrom: chrom, from: armFrom, to: armTo, hasCen: false, reversed: isQ ? true : false };
      var s2 = { chrom: chrom, from: armFrom, to: armTo, hasCen: false, reversed: isQ ? false : true };
      return { segments: [s1, s2], overlays: [], caption: inst.label, isoCenterY: true };
    }

    if (kind === "t" || kind === "dic" || kind === "der") {
      var segs = translocationSegments(inst);
      if (segs) return { segments: segs, overlays: [], caption: inst.label, composite: true };
      // fallback: draw base chromosome with a note
      return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label, note: "complex" };
    }

    return { segments: [fullSeg(chrom)], overlays: [], caption: inst.label };
  }

  // Build der(primary) segments for a reciprocal translocation t(a;b)(ba;bb).
  function translocationSegments(inst) {
    var ab = inst.aberration, primary = inst.primary;
    // der chromosomes derived via der(N)t(...): pull the t sub-op if present
    var chroms = ab.chroms, bps = ab.breakpoints;
    if (ab.kind === "der" && ab.subOps) {
      var t = ab.subOps.filter(function (s) { return s.op === "t"; })[0];
      if (t) { chroms = t.chroms; bps = t.breakpoints; }
      else return null;
    }
    if (chroms.length < 2 || bps.length < 2) return null;
    var a = chroms[0], b = chroms[1];
    var ba = (bps[0] || [])[0], bb = (bps[1] || [])[0];
    if (!IDEO.data[a] || !IDEO.data[b] || !ba || !bb) return null;
    var sa = splitAtBreak(a, ba), sb = splitAtBreak(b, bb);

    function centricSeg(chrom, split) {
      return { chrom: chrom, from: split.centric[0], to: split.centric[1], hasCen: true, reversed: false };
    }
    function acentricSeg(chrom, split) {
      return { chrom: chrom, from: split.acentric[0], to: split.acentric[1], hasCen: false, reversed: false };
    }
    // der(primary) = centric part of `primary` + acentric part of the partner.
    var isA = String(primary) === String(a);
    var keep = isA ? centricSeg(a, sa) : centricSeg(b, sb);
    var add = isA ? acentricSeg(b, sb) : acentricSeg(a, sa);
    var keepSide = isA ? sa.side : sb.side;
    // order: if the kept chromosome broke on its q arm, the join is at the bottom
    var segs = (keepSide === "q") ? [keep, add] : [add, keep];
    return segs;
  }

  // ----- public: draw one chromosome copy -----------------------------------
  function drawInstance(inst, opts) {
    var built = buildInstance(inst);
    var out = renderComposite(built.segments, { overlays: built.overlays });
    return { svg: out.svg, width: out.width, height: out.height, built: built };
  }

  // ----- public: draw a full karyogram for one clone ------------------------
  // Classic Denver group layout.
  var GROUPS = [
    { name: "A", chroms: ["1", "2", "3"] },
    { name: "B", chroms: ["4", "5"] },
    { name: "C", chroms: ["6", "7", "8", "9", "10", "11", "12"] },
    { name: "D", chroms: ["13", "14", "15"] },
    { name: "E", chroms: ["16", "17", "18"] },
    { name: "F", chroms: ["19", "20"] },
    { name: "G", chroms: ["21", "22"] },
    { name: "sex", chroms: ["X", "Y"] }
  ];

  // One karyogram cell: a stack of chromosome copies under a number label.
  function cellHtml(labelText, insts, opts) {
    opts = opts || {};
    var h2 = ['<div class="kcell"><div class="kcell-copies">'];
    if (insts.length === 0 && opts.ghost) {
      h2.push(ghost(opts.ghostChrom || labelText, opts.ghostText || "absent"));
    } else {
      insts.forEach(function (inst) {
        var d = drawInstance(inst);
        var cls = "kchrom" + (inst.kind !== "normal" ? " abn" : "");
        var sub = (inst.kind !== "normal") ? '<div class="ksub">' + esc(d.built.caption) + '</div>' : "";
        var badge = inst.kind === "gain" ? '<div class="kbadge gain">+1</div>' : "";
        h2.push('<div class="' + cls + '" data-chrom="' + inst.chrom + '" data-kind="' + inst.kind + '">' + badge + d.svg + sub + '</div>');
      });
    }
    h2.push('</div><div class="klabel">' + esc(labelText) + '</div></div>');
    return h2.join("");
  }

  function render(container, clone, opts) {
    opts = opts || {};
    var html = ['<div class="karyogram">'];
    GROUPS.forEach(function (grp) {
      html.push('<div class="kgroup" data-group="' + grp.name + '">');
      if (grp.name === "sex") {
        // Show the sex chromosomes actually present. Only add a "missing"
        // placeholder for a genuinely absent sex chromosome (monosomy / Turner),
        // never for the normal absence of a Y in a female.
        var xN = (clone.slots["X"] || []).length, yN = (clone.slots["Y"] || []).length;
        if (xN) html.push(cellHtml("X", clone.slots["X"]));
        if (yN) html.push(cellHtml("Y", clone.slots["Y"]));
        var missing = 2 - (xN + yN);
        for (var mi = 0; mi < missing; mi++) {
          html.push(cellHtml("?", [], { ghost: true, ghostChrom: "X", ghostText: "missing" }));
        }
        if ((clone.slots["mar"] || []).length) html.push(cellHtml("mar", clone.slots["mar"]));
      } else {
        grp.chroms.forEach(function (chrom) {
          var insts = clone.slots[chrom] || [];
          html.push(cellHtml(chrom, insts, { ghost: insts.length === 0, ghostChrom: chrom, ghostText: "nullisomy" }));
        });
      }
      html.push('</div>');
    });
    html.push('</div>');
    container.innerHTML = html.join("");
  }

  function ghost(chrom, label) {
    var d = IDEO.data[chrom] || IDEO.data["X"];
    var H = h(d.length), pad = 3, cap = W / 2;
    return '<div class="kchrom ghost"><svg class="ideo" width="' + (W + pad * 2) +
      '" height="' + (H + pad * 2) + '"><rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + H +
      '" rx="' + cap + '" ry="' + cap + '" fill="none" stroke="#cbd5e1" stroke-width="1" stroke-dasharray="3 3"/></svg>' +
      '<div class="ksub muted">' + esc(label || "absent") + '</div></div>';
  }

  // ----- public: large labeled detail ideogram (anatomy / zoom) -------------
  function drawDetail(chrom, opts) {
    opts = opts || {};
    var d = IDEO.data[chrom];
    if (!d) return "";
    var scale = (opts.height || 460) / d.length;
    var pad = 8, w = 34, cap = w / 2, labelX = pad + w + 12;
    var H = d.length * scale;
    var svgW = 128, svgH = H + pad * 2 + 4;
    var uid = "detail" + chrom;
    var p = ['<svg class="ideo-detail" width="' + svgW + '" height="' + svgH + '" viewBox="0 0 ' + svgW + ' ' + svgH + '">'];
    p.push('<defs><clipPath id="' + uid + '"><rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '"/></clipPath></defs>');
    p.push('<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" fill="#fff" clip-path="url(#' + uid + ')"/>');
    p.push('<g clip-path="url(#' + uid + ')">');
    d.bands.forEach(function (b) {
      var y0 = pad + b[1] * scale, y1 = pad + b[2] * scale;
      p.push('<rect class="band" x="' + pad + '" y="' + y0.toFixed(2) + '" width="' + w + '" height="' + Math.max(0.8, y1 - y0).toFixed(2) +
        '" fill="' + (STAIN[b[3]] || STAIN.gneg) + '" data-chrom="' + chrom + '" data-band="' + esc(b[0]) + '" data-stain="' + b[3] + '" data-arm="' + b[0][0] + '"/>');
    });
    p.push('</g>');
    // band name labels (thinned to avoid crowding)
    var lastY = -100;
    d.bands.forEach(function (b) {
      var ymid = pad + (b[1] + b[2]) / 2 * scale;
      if (ymid - lastY < 11) return;
      lastY = ymid;
      p.push('<line x1="' + (pad + w) + '" y1="' + ymid.toFixed(2) + '" x2="' + (labelX - 3) + '" y2="' + ymid.toFixed(2) + '" stroke="#cbd5e1" stroke-width="0.6"/>');
      p.push('<text class="bandlabel" x="' + labelX + '" y="' + (ymid + 3).toFixed(2) + '" data-chrom="' + chrom + '" data-band="' + esc(b[0]) + '">' + esc(b[0]) + '</text>');
    });
    // centromere marker + arm brackets
    var cy = pad + d.centromere * scale, n = 6;
    p.push('<path d="M' + pad + ' ' + (cy - n) + ' L' + (pad + n) + ' ' + cy + ' L' + pad + ' ' + (cy + n) + ' Z" fill="' + CEN_COLOR + '"/>');
    p.push('<path d="M' + (pad + w) + ' ' + (cy - n) + ' L' + (pad + w - n) + ' ' + cy + ' L' + (pad + w) + ' ' + (cy + n) + ' Z" fill="' + CEN_COLOR + '"/>');
    p.push('<rect x="' + pad + '" y="' + pad + '" width="' + w + '" height="' + H + '" rx="' + cap + '" ry="' + cap + '" fill="none" stroke="' + OUTLINE + '" stroke-width="1.4"/>');
    p.push('</svg>');
    return p.join("");
  }

  window.Karyo = {
    render: render,
    drawInstance: drawInstance,
    drawDetail: drawDetail,
    buildInstance: buildInstance,
    resolveBand: resolveBand,
    STAIN: STAIN, OP_COLORS: OP_COLORS, ORIGIN_COLORS: ORIGIN_COLORS, originColor: originColor
  };
})();
