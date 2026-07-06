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

  function parseAberration(tok, warnings) {
    var raw = tok;
    var ab = { raw: raw, kind: "unknown", sign: null, chroms: [], breakpoints: [], note: "" };

    // Leading sign (applies to numerical and to +der/+mar/-etc.)
    var signM = /^([+\-−–])/.exec(tok);
    if (signM) { ab.sign = (signM[1] === "+") ? "+" : "-"; tok = tok.slice(1); }

    // Pure numerical: +21, -X, +der(...) handled below.
    if (ab.sign && /^(\d+|X|Y)$/.test(tok)) {
      ab.kind = ab.sign === "+" ? "gain" : "loss";
      ab.chroms = [tok];
      return ab;
    }

    // op(chroms)(breakpoints) , op(chroms), with 1 or 2 paren groups.
    var opM = /^([a-zA-Z]+)\(([^)]*)\)(?:\(([^)]*)\))?/.exec(tok);
    if (!opM) {
      // things like "mar", "mar1", "?", "inc"
      if (/^mar\d*$/i.test(tok)) { ab.kind = "mar"; return ab; }
      warnings.push("Couldn’t read “" + raw + "”. Aberrations look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2).");
      ab.note = "unrecognized token";
      return ab;
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
      case "fra": ab.kind = "fra"; break;
      case "trp": ab.kind = "trp"; break;
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
    return ab;
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
      if (p >= 3 && Math.abs(clone.modalNumber - 23 * p) <= 3) ploidy = p;
    }
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
      if (ab.kind === "gain") {
        var g = ab.chroms[0];
        if (comp[g] === undefined) { warnings.push("“" + g + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. +21)."); return; }
        comp[g] += 1;
        slots[g].push({ chrom: g, kind: "gain", label: g, aberration: ab, primary: g });
      } else if (ab.kind === "loss") {
        var l = ab.chroms[0];
        if (comp[l] === undefined) { warnings.push("“" + l + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. -7)."); return; }
        comp[l] -= 1;
        // remove one normal instance if present, else record as under-count
        var idx = slots[l].map(function (x) { return x.kind; }).indexOf("normal");
        if (idx >= 0) slots[l].splice(idx, 1);
      } else if (ab.kind === "mar") {
        // marker: an extra small chromosome of unknown origin
        if (ab.sign !== "-") {
          comp["mar"] = (comp["mar"] || 0) + 1;
          slots["mar"] = slots["mar"] || [];
          slots["mar"].push({ chrom: "mar", kind: "mar", label: "mar", aberration: ab, primary: "mar" });
        }
      } else if (ab.kind === "t" || ab.kind === "dic" || ab.kind === "ins") {
        // Multi-chromosome structural: convert one normal copy of each involved
        // chromosome into a derivative (count unchanged unless signed).
        ab.chroms.forEach(function (c, ci) {
          if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
          if (ab.sign === "+") { comp[c] += 1; slots[c].push(mkDer(c, ab)); return; }
          var idx = firstNormal(slots[c]);
          // convention: normal homolog stays on the left, derivative on the right
          if (idx >= 0) { slots[c].splice(idx, 1); slots[c].push(mkDer(c, ab)); replacedChroms.push(c); }
          else { slots[c].push(mkDer(c, ab)); comp[c] += 1; }
        });
      } else if (ab.kind === "der" && ab.chroms.length > 1) {
        // Whole-arm / Robertsonian der: one derivative replaces one copy of each
        // involved chromosome (e.g. der(13;14)(q10;q10) -> 45).
        if (ab.sign === "+") {
          var dp = ab.chroms[0];
          if (comp[dp] !== undefined) { comp[dp] += 1; slots[dp].push(mkDer(dp, ab)); }
        } else {
          ab.chroms.forEach(function (c) {
            if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
            var ridx = firstNormal(slots[c]);
            if (ridx >= 0) { slots[c].splice(ridx, 1); comp[c] -= 1; }
          });
          var dc = ab.chroms[0];
          if (comp[dc] !== undefined) { slots[dc].push(mkDer(dc, ab)); comp[dc] += 1; }
        }
      } else if (["del", "dup", "inv", "add", "ring", "iso", "der", "fra", "trp"].indexOf(ab.kind) >= 0) {
        var c0 = ab.chroms[0];
        if (comp[c0] === undefined) { warnings.push("“" + c0 + "” isn’t a human chromosome, use 1–22, X, or Y."); return; }
        if (ab.sign === "+") { comp[c0] += 1; slots[c0].push(mkDer(c0, ab)); return; }
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
      if (ab.kind === "t" || ab.kind === "dic") return "der(" + c + ")";
      return c;
    }
    function firstNormal(arr) { return arr.map(function (x) { return x.kind; }).indexOf("normal"); }

    clone.complement = comp;
    clone.slots = slots;

    // Sanity check: does the drawn count match the modal number?
    var actual = 0;
    Object.keys(comp).forEach(function (c) { actual += comp[c]; });
    clone.counts = {
      expected: clone.modalNumber,
      actual: actual,
      ok: clone.modalNumber == null || clone.modalNumber === actual
    };
    if (clone.modalNumber != null && clone.modalNumber !== actual && clone.sex.tokens.length > 0) {
      warnings.push("The number at the start says " + clone.modalNumber + ", but this karyotype describes " + actual + " chromosomes.");
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
      modalNumber: null, modalGiven: "", sex: { tokens: [], label: "", note: "" },
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
    if (!fields.length) { warnings.push("Empty karyotype."); return clone; }

    // modal number
    clone.modalGiven = fields[0];
    var mn = /^(\d+)/.exec(fields[0]);
    if (mn) clone.modalNumber = parseInt(mn[1], 10);
    else warnings.push("A karyotype starts with the chromosome count (a number like 46). “" + fields[0] + "” isn’t a number.");

    // sex field (second)
    if (fields.length > 1) clone.sex = parseSex(fields[1], warnings);

    // remaining = aberrations
    for (var i = 2; i < fields.length; i++) {
      clone.aberrations.push(parseAberration(fields[i], warnings));
    }

    buildComplement(clone, warnings);
    return clone;
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

    var cloneStrs = splitTop(s, "/").map(function (x) { return x.trim(); }).filter(Boolean);
    if (cloneStrs.length > 1) result.isMosaic = true;

    cloneStrs.forEach(function (cs) { result.clones.push(parseClone(cs, warnings)); });
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
    AUTOSOMES: AUTOSOMES,
    ALL: ALL
  };
})();
