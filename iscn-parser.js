/* KaryoDraw, ISCN karyotype parser.
 *
 * window.ISCN.parse(str) turns an ISCN karyotype designation into a structured,
 * render-ready model. It is deliberately forgiving: unrecognized tokens produce
 * a warning rather than a hard failure, so a student always gets *something*
 * drawn plus feedback on what wasn't understood.
 *
 * Model returned:
 *   {
 *     raw, ok, warnings:[...], isMosaic,
 *     clones: [ Clone ]
 *   }
 * Clone:
 *   {
 *     raw, cellCount, composite, modalNumber, modalGiven,
 *     sex: { tokens:["X","Y"], label, note },
 *     aberrations: [ Aberration ],
 *     complement: { "1":2, ... "X":1, "Y":1 },   // copies actually drawn
 *     slots: { "9":[Instance,...], ... },         // per-chromosome draw list
 *     counts: { expected, actual, ok }
 *   }
 * Aberration: { raw, kind, sign, chroms:[...], breakpoints:[[band,...],...], note }
 * Instance:   { chrom, kind, label, aberration|null, primary|null }
 *
 * The renderer turns Instances + IDEOGRAM band data into SVG; the parser stays
 * purely about nomenclature semantics.
 */
(function () {
  "use strict";

  var AUTOSOMES = [];
  for (var i = 1; i <= 22; i++) AUTOSOMES.push(String(i));
  var ALL = AUTOSOMES.concat(["X", "Y"]);

  // Upper bound on any drawable copy count (×N multiplier, dmin count). The
  // renderer allocates one object per copy, so an unbounded N (a typo or paste
  // like +8×1000000) would exhaust memory and freeze the tab. No real karyotype
  // needs more than a handful; 50 is far past any legitimate use and still cheap
  // to draw. Counts above this are capped with a warning rather than honored.
  var MAX_COPIES = 50;

  // Split a breakpoint group like "p11q13" or "q34" or "p15.2" into bands.
  function splitBands(s) {
    if (!s) return [];
    var out = [];
    var re = /(?:p|q)(?:ter|[0-9]+(?:\.[0-9]+)?)|cen|ter/g;
    var m;
    while ((m = re.exec(s)) !== null) out.push(m[0]);
    return out;
  }

  // Split on a delimiter but only at parenthesis depth 0.
  function splitTop(s, delim) {
    var out = [], depth = 0, cur = "";
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === "(") depth++;
      else if (ch === ")") depth--;
      if (ch === delim && depth === 0) { out.push(cur); cur = ""; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  }

  var KIND_LABEL = {
    gain: "whole-chromosome gain", loss: "whole-chromosome loss",
    del: "deletion", dup: "duplication", inv: "inversion",
    t: "reciprocal translocation", ins: "insertion", iso: "isochromosome",
    ring: "ring chromosome", der: "derivative chromosome", add: "additional material",
    dic: "dicentric", fra: "fragile site", mar: "marker chromosome",
    trp: "triplication", unknown: "unrecognized"
  };

  // Constitutional / inheritance qualifiers trail an aberration: they say where it
  // came from, they are not part of the rearrangement itself. Strip and remember
  // them so they do not break the token they follow (e.g. +21c, del(22)(q11.2)mat).
  var QUAL = { c: "constitutional", mat: "maternal in origin", pat: "paternal in origin", dn: "de novo" };
  function stripQualifier(tok) {
    // Only after a closing paren, a digit, or a sex letter, so an op name like
    // "inc" or a band is never mistaken for a qualifier.
    var m = /([)\dXY])(c|mat|pat|dn)$/.exec(tok);
    if (!m) return { tok: tok, qual: null };
    return { tok: tok.slice(0, tok.length - m[2].length), qual: m[2] };
  }
  // A copy-number multiplier ×N (or xN) says the aberration is present N times,
  // e.g. +8×2 is two extra copies of chromosome 8.
  function stripMultiplier(tok) {
    var m = /[×x](\d+)$/.exec(tok);
    if (!m) return { tok: tok, mult: 1 };
    var n = parseInt(m[1], 10);
    return { tok: tok.slice(0, m.index), mult: Math.min(n, MAX_COPIES), capped: n > MAX_COPIES };
  }

  function parseAberration(tok, warnings) {
    var raw = tok;
    var ab = { raw: raw, kind: "unknown", sign: null, chroms: [], breakpoints: [], note: "", qualifier: null, multiplier: 1, ref: null };
    var sq = stripQualifier(tok); tok = sq.tok; var qual = sq.qual;
    var smx = stripMultiplier(tok); tok = smx.tok; ab.multiplier = smx.mult;
    if (smx.capped) warnings.push("A copy count above " + MAX_COPIES + " is capped at " + MAX_COPIES + " for drawing (“" + raw + "”).");
    function finish(a) {
      if (qual) { a.qualifier = qual; a.note = (a.note ? a.note + "; " : "") + (QUAL[qual] || qual); }
      return a;
    }

    // Clonal-evolution shorthand: idem / sl = "same as the stemline", sdl = "same
    // as the sideline". Expanded to the referenced clone's aberrations in parse().
    if (/^(idem|sl|sdl)$/i.test(tok)) { ab.kind = "idem"; ab.ref = tok.toLowerCase(); return finish(ab); }
    // Double minutes: small extrachromosomal amplified fragments (may carry a count).
    var dm = /^(\d+)?dmin$/i.exec(tok);
    if (dm) {
      ab.kind = "dmin";
      var dcount = dm[1] ? parseInt(dm[1], 10) : 1;
      if (dcount > MAX_COPIES) { warnings.push("A double-minute count above " + MAX_COPIES + " is capped at " + MAX_COPIES + " for drawing."); dcount = MAX_COPIES; }
      ab.count = dcount;
      return finish(ab);
    }

    // Leading sign (applies to numerical and to +der/+mar/-etc.)
    var signM = /^([+\-−–])/.exec(tok);
    if (signM) { ab.sign = (signM[1] === "+") ? "+" : "-"; tok = tok.slice(1); }

    // Pure numerical: +21, -X, +der(...) handled below.
    if (ab.sign && /^(\d+|X|Y)$/.test(tok)) {
      ab.kind = ab.sign === "+" ? "gain" : "loss";
      ab.chroms = [tok];
      return finish(ab);
    }

    // op(chroms)(breakpoints) , op(chroms), with 1 or 2 paren groups.
    var opM = /^([a-zA-Z]+)\(([^)]*)\)(?:\(([^)]*)\))?/.exec(tok);
    if (!opM) {
      // things like "mar", "mar1", "?", "inc"
      // "inc": the karyotype is explicitly incomplete (additional, unidentified
      // changes exist). Recognized so it is not read as an unknown token.
      if (/^inc$/i.test(tok)) { ab.kind = "inc"; return finish(ab); }
      // Markers. "mar" / "mar1" is one marker (optionally labeled); a leading count
      // — "2mar", or the ranged "1~3mar" (Mitelman also writes the range with a
      // hyphen) — is a number of markers. Capped like any drawable copy count.
      var marM = /^(\d+)(?:[-~]\d+)?mar\d*$/i.exec(tok);
      if (marM) { ab.kind = "mar"; ab.count = Math.min(parseInt(marM[1], 10), MAX_COPIES); return finish(ab); }
      if (/^mar\d*$/i.test(tok)) { ab.kind = "mar"; return finish(ab); }
      // A bare chromosome number needs a sign to say gained or lost.
      if (/^(\d+|X|Y)$/.test(tok)) {
        warnings.push("“" + raw + "” needs a sign: “+" + tok + "” for a gain (extra copy) or “−" + tok + "” for a loss.");
        ab.note = "unrecognized token";
        return finish(ab);
      }
      warnings.push("Couldn’t read “" + raw + "”. Aberrations look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2).");
      ab.note = "unrecognized token";
      return finish(ab);
    }

    var op = opM[1].toLowerCase();
    var chromGroup = opM[2] || "";
    var bpGroup = opM[3] || "";
    var rest = tok.slice(opM[0].length); // trailing sub-ops (der chains)

    ab.chroms = splitTop(chromGroup, ";").map(function (x) { return x.trim(); }).filter(Boolean);
    // Breakpoints: one group per chromosome (translocation), or one group with
    // multiple bands (del/dup/inv interstitial).
    var bpParts = splitTop(bpGroup, ";");
    ab.breakpoints = bpParts.map(function (p) { return splitBands(p.trim()); });

    switch (op) {
      case "del": ab.kind = "del"; break;
      case "dup": ab.kind = "dup"; break;
      case "inv": ab.kind = "inv"; break;
      case "t": ab.kind = "t"; break;
      case "ins": ab.kind = "ins"; break;
      case "i": ab.kind = "iso"; break;
      case "r": ab.kind = "ring"; break;
      case "add": ab.kind = "add"; break;
      case "dic": ab.kind = "dic"; break;
      case "idic": ab.kind = "dic"; ab.note = "isodicentric"; break;
      // rob (Robertsonian) is the preferred ISCN spelling of a whole-arm fusion of
      // two acrocentrics; it behaves exactly like der(13;14)(q10;q10).
      case "rob": ab.kind = "der"; ab.note = "Robertsonian translocation"; break;
      case "fra": ab.kind = "fra"; break;
      case "trp": ab.kind = "trp"; break;
      // hsr = homogeneously staining region: an amplified block riding on a
      // chromosome. It stays on that chromosome, so the count is unchanged.
      case "hsr": ab.kind = "hsr"; break;
      case "der":
        ab.kind = "der";
        // der(N) may be followed by t(...)/del(...) sub-ops describing its make-up.
        if (rest) {
          ab.note = "der(" + ab.chroms.join(";") + ")" + rest;
          var sub = [];
          var subRe = /([a-zA-Z]+)\(([^)]*)\)(?:\(([^)]*)\))?/g, sm;
          while ((sm = subRe.exec(rest)) !== null) {
            sub.push({
              op: sm[1].toLowerCase(),
              chroms: splitTop(sm[2], ";").map(function (x) { return x.trim(); }),
              breakpoints: splitTop(sm[3] || "", ";").map(function (p) { return splitBands(p.trim()); })
            });
          }
          ab.subOps = sub;
        }
        break;
      default:
        ab.kind = "unknown";
        warnings.push("Don’t recognize “" + op + "” in “" + raw + "”. Known: del, dup, inv, t, i, r, der, add, ins, dic, fra, mar.");
    }
    // Non-der ops should consume the whole token; leftover text (an "or"
    // alternative, an uncertainty marker, a trailing qualifier) is not modelled,
    // so warn instead of dropping it silently.
    if (ab.kind !== "der" && ab.kind !== "unknown" && rest && rest.trim()) {
      warnings.push("Only the first part of “" + raw + "” was read; “" + rest.trim() + "” wasn’t understood (alternatives with “or” and uncertainty markers aren’t supported).");
    }
    return finish(ab);
  }

  // Build the per-chromosome instance list + copy-number complement.
  function buildComplement(clone, warnings) {
    var comp = {};
    // Base ploidy from the modal number: 46 -> 2, 69 -> 3, 92 -> 4. Only accept
    // triploid/tetraploid when the count is close to a clean multiple, so a
    // hyperdiploid cancer karyotype is not mistaken for a polyploid.
    var ploidy = 2;
    if (clone.modalNumber != null) {
      var p = Math.round(clone.modalNumber / 23);
      // Accept triploid through octaploid; a larger p is not a real ploidy but a
      // huge or mistyped count, so stay diploid and let the count-mismatch warning
      // speak instead of allocating p copies of every chromosome.
      if (p >= 3 && p <= 8 && Math.abs(clone.modalNumber - 23 * p) <= 3) ploidy = p;
    }
    clone.ploidy = ploidy;   // exposed so the renderer can spot sex-chromosome aneuploidy
    ALL.forEach(function (c) { comp[c] = 0; });
    AUTOSOMES.forEach(function (c) { comp[c] = ploidy; });
    // Sex chromosomes from the sex field.
    clone.sex.tokens.forEach(function (t) { if (comp[t] !== undefined) comp[t] += 1; });

    var slots = {};
    ALL.forEach(function (c) {
      slots[c] = [];
      for (var k = 0; k < comp[c]; k++) slots[c].push({ chrom: c, kind: "normal", label: c, aberration: null, primary: null });
    });

    // Track unsigned structural ops that replaced a normal homolog, so we can
    // restore the homolog if the stated modal number says it should still be
    // there (e.g. 46,X,i(X)(q10): the i(X) is additional to the single X).
    var replacedChroms = [];

    clone.aberrations.forEach(function (ab) {
      var mult = ab.multiplier || 1;   // copy-number ×N: apply the effect N times
      if (ab.kind === "idem") {
        // no-op here; expanded to the referenced clone's aberrations in parse()
        return;
      } else if (ab.kind === "dmin") {
        // Double minutes are extrachromosomal fragments: shown, but NOT counted in
        // the modal number, so they live in their own slot outside comp.
        slots["dmin"] = slots["dmin"] || [];
        var ndm = ab.count || 1;
        for (var dj = 0; dj < ndm; dj++) slots["dmin"].push({ chrom: "dmin", kind: "dmin", label: "dmin", aberration: ab, primary: "dmin" });
      } else if (ab.kind === "gain") {
        var g = ab.chroms[0];
        if (comp[g] === undefined) { warnings.push("“" + g + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. +21)."); return; }
        comp[g] += mult;
        for (var gj = 0; gj < mult; gj++) slots[g].push({ chrom: g, kind: "gain", label: g, aberration: ab, primary: g });
      } else if (ab.kind === "loss") {
        var l = ab.chroms[0];
        if (comp[l] === undefined) { warnings.push("“" + l + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. -7)."); return; }
        for (var lj = 0; lj < mult; lj++) {
          comp[l] -= 1;
          var idx = slots[l].map(function (x) { return x.kind; }).indexOf("normal");
          if (idx >= 0) slots[l].splice(idx, 1);
        }
      } else if (ab.kind === "mar") {
        // marker: an extra small chromosome of unknown origin; "2mar" adds two, etc.
        if (ab.sign !== "-") {
          slots["mar"] = slots["mar"] || [];
          var nmar = Math.min((ab.count || 1) * mult, MAX_COPIES);
          for (var mj = 0; mj < nmar; mj++) {
            comp["mar"] = (comp["mar"] || 0) + 1;
            slots["mar"].push({ chrom: "mar", kind: "mar", label: "mar", aberration: ab, primary: "mar" });
          }
        }
      } else if (ab.kind === "inc") {
        // Incomplete karyotype: unidentified additional changes exist. Nothing to
        // draw; flag the clone so the count mismatch it implies is not warned about.
        clone.incomplete = true;
      } else if (ab.kind === "t" || ab.kind === "ins" || (ab.kind === "dic" && ab.chroms.length < 2)) {
        // Multi-chromosome structural: convert one normal copy of each involved
        // chromosome into a derivative (count unchanged unless signed). A single-
        // chromosome idic falls here too (it replaces one homolog, count unchanged).
        ab.chroms.forEach(function (c, ci) {
          if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
          if (ab.sign === "+") { for (var sj = 0; sj < mult; sj++) { comp[c] += 1; slots[c].push(mkDer(c, ab)); } return; }
          var idx = firstNormal(slots[c]);
          // convention: normal homolog stays on the left, derivative on the right
          if (idx >= 0) { slots[c].splice(idx, 1); slots[c].push(mkDer(c, ab)); replacedChroms.push(c); }
          else { slots[c].push(mkDer(c, ab)); comp[c] += 1; }
        });
      } else if ((ab.kind === "der" || ab.kind === "dic") && ab.chroms.length > 1) {
        // Whole-arm / Robertsonian der, and a two-chromosome dicentric: the two
        // chromosomes fuse into ONE derivative, so one copy of each is consumed
        // and the count drops by one (e.g. der(13;14)(q10;q10) or
        // dic(13;14)(q13;q22) -> 45).
        if (ab.sign === "+") {
          var dp = ab.chroms[0];
          if (comp[dp] !== undefined) { for (var wj = 0; wj < mult; wj++) { comp[dp] += 1; slots[dp].push(mkDer(dp, ab)); } }
        } else {
          ab.chroms.forEach(function (c) {
            if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
            var ridx = firstNormal(slots[c]);
            if (ridx >= 0) { slots[c].splice(ridx, 1); comp[c] -= 1; }
          });
          var dc = ab.chroms[0];
          if (comp[dc] !== undefined) { slots[dc].push(mkDer(dc, ab)); comp[dc] += 1; }
        }
      } else if (["del", "dup", "inv", "add", "ring", "iso", "der", "fra", "trp", "hsr"].indexOf(ab.kind) >= 0) {
        var c0 = ab.chroms[0];
        if (comp[c0] === undefined) { warnings.push("“" + c0 + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
        if (ab.sign === "+") { for (var pj = 0; pj < mult; pj++) { comp[c0] += 1; slots[c0].push(mkDer(c0, ab)); } return; }
        if (ab.sign === "-") {
          comp[c0] -= 1;
          var ri = firstNormal(slots[c0]); if (ri >= 0) slots[c0].splice(ri, 1);
          return;
        }
        var i2 = firstNormal(slots[c0]);
        if (i2 >= 0) { slots[c0].splice(i2, 1); slots[c0].push(mkDer(c0, ab)); replacedChroms.push(c0); }
        else { slots[c0].push(mkDer(c0, ab)); comp[c0] += 1; }
      }
    });

    // Reconcile toward the stated modal number ONLY in the specific case where a
    // structural op consumed a chromosome's sole copy, so the derivative is
    // additional to a normal homolog (classically 46,X,i(X)(q10)). Never invent
    // extra copies just to chase a wrong modal number (e.g. a typo'd count).
    if (clone.modalNumber != null) {
      var running = 0;
      Object.keys(comp).forEach(function (c) { running += comp[c]; });
      var deficit = clone.modalNumber - running;
      for (var r = 0; r < replacedChroms.length && deficit > 0; r++) {
        var rc = replacedChroms[r];
        var normalsLeft = slots[rc].filter(function (x) { return x.kind === "normal"; }).length;
        if (normalsLeft === 0) {
          slots[rc].unshift({ chrom: rc, kind: "normal", label: rc, aberration: null, primary: null });
          comp[rc] += 1;
          deficit--;
        }
      }
    }

    function mkDer(c, ab) {
      return { chrom: c, kind: ab.kind, label: derLabel(c, ab), aberration: ab, primary: c };
    }
    function derLabel(c, ab) {
      if (ab.kind === "iso") return "i(" + c + ")";
      if (ab.kind === "ring") return "r(" + c + ")";
      if (ab.kind === "del") return "del(" + c + ")";
      if (ab.kind === "dup") return "dup(" + c + ")";
      if (ab.kind === "inv") return "inv(" + c + ")";
      if (ab.kind === "add") return "add(" + c + ")";
      if (ab.kind === "der") return "der(" + c + ")";
      if (ab.kind === "hsr") return "hsr(" + c + ")";
      if (ab.kind === "t" || ab.kind === "dic" || ab.kind === "ins") return "der(" + c + ")";
      return c;
    }
    function firstNormal(arr) { return arr.map(function (x) { return x.kind; }).indexOf("normal"); }

    clone.complement = comp;
    clone.slots = slots;

    // Sanity check: does the drawn count match the modal number? A range modal
    // number (47~49) is satisfied by any count inside the range.
    var actual = 0;
    Object.keys(comp).forEach(function (c) { actual += comp[c]; });
    var inRange = clone.modalHigh != null && actual >= clone.modalNumber && actual <= clone.modalHigh;
    clone.counts = {
      expected: clone.modalNumber,
      expectedHigh: clone.modalHigh != null ? clone.modalHigh : null,
      actual: actual,
      ok: clone.modalNumber == null || clone.modalNumber === actual || inRange
    };
    if (!clone.counts.ok && clone.sex.tokens.length > 0 && !clone.incomplete) {
      var want = clone.modalHigh != null ? (clone.modalNumber + "–" + clone.modalHigh) : String(clone.modalNumber);
      warnings.push("The number at the start says " + want + ", but this karyotype describes " + actual + " chromosomes.");
    }
  }

  function parseSex(field, warnings) {
    var tokens = [], bad = [];
    if (!field) { return { tokens: tokens, label: "", note: "no sex chromosomes stated" }; }
    for (var i = 0; i < field.length; i++) {
      var ch = field[i].toUpperCase();
      if (ch === "X" || ch === "Y") tokens.push(ch);
      else bad.push(field[i]);
    }
    if (tokens.length === 0) {
      warnings.push("The 2nd field should be the sex chromosomes (XX, XY, X, …), “" + field + "” has no X or Y. Did you skip the sex chromosomes?");
    } else if (bad.length) {
      warnings.push("Ignored “" + bad.join("") + "” in the sex chromosomes “" + field + "”, only X and Y belong there.");
    }
    var label = tokens.join("");
    var SEX_NOTE = {
      "XX": "two X (usual female karyotype)", "XY": "one X, one Y (usual male karyotype)",
      "X": "a single X (monosomy X)", "XXY": "two X + one Y",
      "XYY": "one X + two Y", "XXX": "three X",
      "XXYY": "two X + two Y", "XXXX": "four X", "XXXY": "three X + one Y"
    };
    var note = SEX_NOTE[label] || (tokens.length + " sex chromosome" + (tokens.length === 1 ? "" : "s"));
    return { tokens: tokens, label: label, note: note };
  }

  function parseClone(cloneStr, warnings) {
    var clone = {
      raw: cloneStr.trim(), cellCount: null, composite: false,
      modalNumber: null, modalHigh: null, modalGiven: "", sex: { tokens: [], label: "", note: "" },
      aberrations: []
    };
    var s = clone.raw;

    // trailing [n] cell count or [cpN] composite
    var cnt = /\[(cp)?(\d+)\]\s*$/i.exec(s);
    if (cnt) {
      clone.cellCount = parseInt(cnt[2], 10);
      clone.composite = !!cnt[1];
      s = s.slice(0, cnt.index).trim();
    }

    var fields = splitTop(s, ",").map(function (x) { return x.trim(); }).filter(function (x) { return x.length; });
    if (!fields.length) {
      warnings.push("Empty karyotype.");
      // Return the full clone shape anyway: render/teach rely on complement, slots,
      // and counts always existing. Omitting them here crashed computeAffected
      // (clone.slots[c]) and teach before the invalid-state message could show.
      clone.complement = {};
      clone.slots = {};
      clone.counts = { expected: null, expectedHigh: null, actual: 0, ok: false };
      return clone;
    }

    // modal number — may be a range like 47~49 (a cancer clone whose count varies)
    clone.modalGiven = fields[0];
    var mn = /^(\d+)(?:\s*[~\-–]\s*(\d+))?/.exec(fields[0]);
    if (mn) {
      clone.modalNumber = parseInt(mn[1], 10);
      if (mn[2]) clone.modalHigh = parseInt(mn[2], 10);
    } else warnings.push("A karyotype starts with the chromosome count (a number like 46). “" + fields[0] + "” isn’t a number.");

    // sex field (second) — UNLESS the second field is a clonal-evolution marker
    // (idem/sl/sdl). The standard subclone form omits the repeated sex field, e.g.
    // 47,idem,+8: "idem" stands in for the whole stemline, sex included, so the
    // sex is inherited during expansion rather than stated here.
    var firstAb = 2;
    if (fields.length > 1 && /^(idem|sl|sdl)$/i.test(fields[1])) {
      firstAb = 1;
    } else if (fields.length > 1) {
      clone.sex = parseSex(fields[1], warnings);
    }

    // remaining = aberrations (including a leading idem/sl/sdl marker)
    for (var i = firstAb; i < fields.length; i++) {
      clone.aberrations.push(parseAberration(fields[i], warnings));
    }

    // A clone that references another (idem/sl/sdl) is completed in parse() after
    // every clone is known; defer its complement until the reference is resolved.
    clone.pendingIdem = clone.aberrations.some(function (a) { return a.kind === "idem"; });
    if (!clone.pendingIdem) buildComplement(clone, warnings);
    return clone;
  }

  // Resolve idem/sl/sdl: splice the referenced clone's aberrations in after the
  // marker, then build this clone's complement. Clones are processed in order, so
  // a sideline (sdl) sees the already-expanded clone before it.
  function expandIdem(clones, ci, warnings) {
    var cl = clones[ci];
    var out = [];
    cl.aberrations.forEach(function (a) {
      out.push(a);
      if (a.kind === "idem") {
        var refIdx = a.ref === "sdl" ? ci - 1 : 0;
        var ref = clones[refIdx];
        if (!ref || refIdx === ci) {
          // idem/sl/sdl means "the same changes as an EARLIER clone". With no earlier
          // clone to copy (a first-clone idem resolves to itself), expanding would
          // splice this clone's own aberrations back in and apply them twice. Skip
          // the copy and flag the missing stemline instead of silently doubling.
          warnings.push("“" + a.ref + "” means “the same changes as the previous clone”, but there is no earlier clone here. Write the full stemline before the “/” subclone, e.g. 46,XX,+8/47,idem,+9.");
        } else {
          ref.aberrations.forEach(function (ra) { if (ra.kind !== "idem") out.push(ra); });
        }
      }
    });
    cl.aberrations = out;
    // The sex is constitutional and identical across clones, so inherit it from the
    // stemline when this subclone did not repeat it (the standard 47,idem,+8 form).
    if (cl.sex.tokens.length === 0 && clones[0] && clones[0].sex.tokens.length) {
      var st = clones[0].sex;
      cl.sex = { tokens: st.tokens.slice(), label: st.label, note: st.note };
    }
    buildComplement(cl, warnings);
  }

  // Spot common typos in the raw text and, where possible, build a corrected
  // "did you mean" string.
  function diagnose(raw, result, warnings) {
    var suggestion = raw;
    var opens = (raw.match(/\(/g) || []).length, closes = (raw.match(/\)/g) || []).length;
    if (opens !== closes) {
      warnings.push("Unbalanced parentheses, " + opens + " “(” but " + closes + " “)”. Make sure every “(” has a matching “)”.");
    }
    if (/^\d+[XY]{1,4}(,|\[|$)/i.test(raw)) {
      warnings.push("Add a comma after the chromosome count, the count comes first, then the sex chromosomes, e.g. 46,XY.");
      suggestion = suggestion.replace(/^(\d+)([XYxy]{1,4})/, function (m, a, b) { return a + "," + b.toUpperCase(); });
    }
    var depth = 0, inner = false, fixed = "";
    for (var i = 0; i < suggestion.length; i++) {
      var ch = suggestion[i];
      if (ch === "(") depth++; else if (ch === ")") depth--;
      if (ch === "," && depth > 0) { inner = true; fixed += ";"; } else fixed += ch;
    }
    if (inner) {
      warnings.push("Inside parentheses, separate values with a semicolon “;”, not a comma, e.g. t(9;22)(q34;q11.2).");
      suggestion = fixed;
    }
    if (suggestion !== raw) result.suggestion = suggestion;
  }

  function parse(input) {
    var raw = (input || "").trim();
    var warnings = [];
    var result = { raw: raw, ok: false, warnings: warnings, isMosaic: false, clones: [], suggestion: null, countFix: null };
    if (!raw) { warnings.push("Type a karyotype to begin, e.g. 46,XY, 47,XX,+21, or 46,XY,t(9;22)(q34;q11.2)."); return result; }
    diagnose(raw, result, warnings);

    var s = raw;
    // strip a leading mos/chi qualifier
    var q = /^(mos|chi)\s+/i.exec(s);
    if (q) { result.isMosaic = true; s = s.slice(q[0].length); }

    // ISCN designations carry no internal spaces, but humans and copy-paste add
    // them ("r(13) (p11q34) dn", "47, XX, +21"). The one meaningful space — after a
    // mos/chi prefix — is already consumed above, so treat the rest as insignificant.
    s = s.replace(/\s+/g, "");
    // The canonical, whitespace-normalized designation — for display and the URL.
    result.normalized = (q ? q[1].toLowerCase() + " " : "") + s;

    var cloneStrs = splitTop(s, "/").map(function (x) { return x.trim(); }).filter(Boolean);
    if (cloneStrs.length > 1) result.isMosaic = true;

    cloneStrs.forEach(function (cs) { result.clones.push(parseClone(cs, warnings)); });
    // Resolve clonal-evolution references now that all clones are parsed.
    result.clones.forEach(function (cl, ci) { if (cl.pendingIdem) expandIdem(result.clones, ci, warnings); });
    result.ok = result.clones.length > 0 && result.clones.every(function (c) { return c.modalNumber != null; });

    // If a single clone's stated count is off, offer the corrected count as a fix.
    if (!result.suggestion && result.clones.length === 1) {
      var cl0 = result.clones[0];
      if (cl0.modalNumber != null && cl0.counts && !cl0.counts.ok && cl0.counts.actual != null) {
        result.countFix = raw.replace(/\d+/, String(cl0.counts.actual));
      }
    }
    return result;
  }

  window.ISCN = {
    parse: parse,
    splitBands: splitBands,
    KIND_LABEL: KIND_LABEL,
    QUAL: QUAL,
    AUTOSOMES: AUTOSOMES,
    ALL: ALL
  };
})();
