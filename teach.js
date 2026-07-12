/* KaryoDraw, teaching layer.
 *
 * All the "explain it to a newbie" content:
 *   Teach.decode(clone)          -> token-by-token plain-English breakdown
 *   Teach.bandInfo(chrom, band)  -> how to read a band name + what its stain means
 *   Teach.stainInfo(stain)       -> Giemsa band biology
 *   Teach.syndromes(clone)       -> curated clinical/board-relevant notes
 *   Teach.armInfo()              -> anatomy-of-a-chromosome reference copy
 *
 * Content is written at the level of a genetic-counseling / medical-genetics
 * board candidate. It is educational context, not diagnostic advice.
 */
(function () {
  "use strict";
  var IDEO = window.IDEOGRAM;

  function ordinalArm(a) { return a === "p" ? "short arm (p)" : a === "q" ? "long arm (q)" : a; }
  var DIGIT_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  function digitWords(s) { return String(s).split("").map(function (d) { return DIGIT_WORDS[+d] != null ? DIGIT_WORDS[+d] : d; }).join(" "); }
  // The WRONG "run it together" reading of a band number, e.g. "15" -> "fifteen", "22" -> "twenty-two".
  var TEEN_WORDS = ["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  var TENS_WORDS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  function numberWord(s) {
    var n = +s;
    if (isNaN(n)) return String(s);
    if (n < 10) return DIGIT_WORDS[n];
    if (n < 20) return TEEN_WORDS[n - 10];
    if (n < 100) return TENS_WORDS[Math.floor(n / 10)] + (n % 10 ? "-" + DIGIT_WORDS[n % 10] : "");
    return String(s);
  }
  // Join a list into readable English: "a", "a and b", "a, b, and c".
  function listJoin(arr) {
    arr = arr.filter(function (x) { return x != null && x !== ""; });
    if (arr.length <= 1) return arr.join("");
    if (arr.length === 2) return arr[0] + " and " + arr[1];
    return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
  }

  // Parse a band name like "q22.13" into readable pieces.
  function bandInfo(chrom, band) {
    var m = /^([pq])(\d)(\d)?(?:\.(\d+))?/.exec(band || "");
    var arm = m ? m[1] : (band && band[0]);
    var out = { chrom: chrom, band: band, arm: arm, armName: ordinalArm(arm), read: "", parts: [], stain: null, position: "" };
    if (m) {
      var region = m[2], bnd = m[3], sub = m[4];
      out.parts.push({ label: "arm", value: arm, note: ordinalArm(arm) + ", counted outward from the centromere" });
      out.parts.push({ label: "region", value: region, note: "region " + region + ", counting away from the centromere" });
      if (bnd) out.parts.push({ label: "band", value: bnd, note: "band " + bnd + " within that region" });
      if (sub) out.parts.push({ label: "sub-band", value: sub, note: "finer sub-division seen at higher resolution" });
      var regBand = region + (bnd || "");
      var spokenBand = digitWords(regBand) + (sub ? " point " + digitWords(sub) : "");
      out.read = "Read the band one digit at a time. " + chrom + band + " is spoken “" + chrom + " " + arm + " " + spokenBand + "”.";
      // Only warn against "running the digits together" when there are two digits to run together.
      if (regBand.length > 1) {
        out.read += " Say the digits separately (“" + digitWords(regBand) + "”); never run them together (it is NOT “" + numberWord(regBand) + "”).";
      }
    }
    // resolve stain + position from the ideogram
    var r = window.Karyo.resolveBand(chrom, band);
    var d = IDEO.data[chrom];
    if (r && d) {
      // find the specific band's stain
      var exact = d.bands.filter(function (b) { return b[0] === band; })[0];
      out.stain = exact ? exact[3] : null;
      var cen = d.centromere;
      var frac, where;
      if (r.arm === "p") { frac = 1 - r.mid / cen; }
      else { frac = (r.mid - cen) / (d.length - cen); }
      if (frac < 0.34) where = "close to the centromere";
      else if (frac < 0.67) where = "in the middle of the arm";
      else where = "out toward the telomere (tip)";
      out.position = "This band sits " + where + " on the " + out.armName + " of chromosome " + chrom + ".";
    }
    return out;
  }

  var STAIN_INFO = {
    gneg: { name: "G-negative (pale)", bio: "Pale Giemsa band: gene-rich, GC-rich, early-replicating, more transcriptionally active euchromatin." },
    gpos25: { name: "G-positive (light)", bio: "Lightly staining dark band, moderate gene density." },
    gpos50: { name: "G-positive (medium)", bio: "Medium-dark band: AT-rich, gene-poorer, later-replicating." },
    gpos75: { name: "G-positive (dark)", bio: "Dark band: AT-rich, gene-poor, late-replicating heterochromatin-like." },
    gpos100: { name: "G-positive (darkest)", bio: "Darkest band: very AT-rich, gene-poor, latest-replicating." },
    acen: { name: "Centromere", bio: "The centromere (α-satellite heterochromatin) where the kinetochore assembles and spindle fibres attach at cell division." },
    gvar: { name: "Variable region", bio: "Polymorphic heterochromatin whose size varies normally between people (e.g. 1q, 9q, 16q, Yq), usually not pathogenic." },
    stalk: { name: "Acrocentric stalk", bio: "The stalk of an acrocentric short arm (chr 13,14,15,21,22): houses the ribosomal RNA genes (NOR). Losing it is generally harmless." }
  };
  function stainInfo(s) { return STAIN_INFO[s] || { name: s, bio: "" }; }

  // ---- describe a single aberration in plain English -----------------------
  function bandsPhrase(chrom, bands) {
    return bands.map(function (b) { return chrom + b; }).join(" and ");
  }
  // Short phrases describing a derivative's make-up (kept part + attached part).
  function throughShort(chrom, band) { return band ? " (out to " + chrom + band + ")" : ""; }
  function endShort(partner, band) {
    if (!band) return "part of chromosome " + partner;
    return band[0] === "q"
      ? "the end of chromosome " + partner + "’s long arm (" + partner + band + "→qter)"
      : "the end of chromosome " + partner + "’s short arm (pter→" + partner + band + ")";
  }
  // One phrase for an extra del/dup/inv operation inside a der() chain (the t/dic
  // join is described separately, so those return null here).
  function subOpPhrase(s) {
    if (!s || ["del", "dup", "inv"].indexOf(s.op) < 0) return null;
    var sc = (s.chroms || [])[0], g = (s.breakpoints || [])[0] || [], bands = bandsPhrase(sc, g);
    if (s.op === "del") return g.length >= 2 ? "an interstitial deletion between " + bands : "a terminal deletion at " + (bands || ("chromosome " + sc));
    if (s.op === "dup") return "a duplication of the segment between " + bands;
    if (s.op === "inv") return "an inversion between " + bands;
    return null;
  }
  function describeAberration(ab) {
    var k = ab.kind, c = ab.chroms[0], bp = ab.breakpoints, mult = ab.multiplier || 1;
    if (k === "idem") {
      var refName = ab.ref === "sdl" ? "the sideline (the clone before it)" : "the stemline (the first clone)";
      return { text: "the SAME changes as " + refName + " — this subclone carries all of them, plus whatever is listed next (clonal evolution)", tag: "count" };
    }
    if (k === "hsr") return { text: "a HOMOGENEOUSLY STAINING REGION on chromosome " + c + " at " + c + ((bp[0] || [])[0] || "?") + ": a block of amplified DNA (many extra copies of a gene, e.g. an oncogene) built into the chromosome", tag: "add" };
    if (k === "dmin") return { text: "DOUBLE MINUTES: small extra circles of amplified DNA floating outside the chromosomes (acentric, so not counted in the chromosome number). A hallmark of oncogene amplification", tag: "add" };
    if (k === "gain") return mult > 1
      ? { text: mult + " EXTRA copies of chromosome " + c + " (so " + (2 + mult) + " copies in all)", tag: "gain" }
      : { text: "an EXTRA copy of chromosome " + c + " (three copies = trisomy " + c + ")", tag: "gain" };
    if (k === "loss") return mult > 1
      ? { text: "LOSS of " + mult + " copies of chromosome " + c, tag: "loss" }
      : { text: "LOSS of one chromosome " + c + " (one copy = monosomy " + c + ")", tag: "loss" };
    if (k === "del") {
      var b0 = (bp[0] || []);
      if (b0.length >= 2) return { text: "an interstitial DELETION in chromosome " + c + ": the segment between " + bandsPhrase(c, b0) + " is missing", tag: "del" };
      return { text: "a terminal DELETION of chromosome " + c + ": everything distal to " + c + (b0[0] || "?") + " (out to the tip) is lost", tag: "del" };
    }
    if (k === "dup") {
      // ISCN encodes orientation by the order of the breakpoints, and the rule
      // differs by arm, so compare positions (resolveBand.mid), not band numbers:
      // the distal breakpoint written first means the extra copy is inverted.
      var dbp0 = bp[0] || [], invDup = false;
      if (dbp0.length >= 2 && window.Karyo && window.Karyo.resolveBand) {
        var rd0 = window.Karyo.resolveBand(c, dbp0[0]), rd1 = window.Karyo.resolveBand(c, dbp0[1]);
        if (rd0 && rd1) invDup = rd0.mid > rd1.mid;
      }
      return { text: (invDup ? "an INVERTED DUPLICATION" : "a DUPLICATION") + " in chromosome " + c +
        ": the segment " + bandsPhrase(c, dbp0) + " is present twice" +
        (invDup ? ", with the extra copy flipped end-for-end" : ""), tag: "dup" };
    }
    if (k === "inv") {
      var arms = (bp[0] || []).map(function (b) { return b[0]; });
      var peri = arms.indexOf("p") >= 0 && arms.indexOf("q") >= 0;
      return { text: "an INVERSION in chromosome " + c + ": the segment between " + bandsPhrase(c, bp[0] || []) + " is flipped end-for-end (" + (peri ? "pericentric, it spans the centromere" : "paracentric, within one arm") + ")", tag: "inv" };
    }
    if (k === "t" || k === "dic") {
      var chroms = ab.chroms, n = chroms.length;
      var breaks = chroms.map(function (cc, i) { return cc + ((bp[i] || [])[0] || ""); });
      var ders = chroms.map(function (cc) { return "der(" + cc + ")"; });
      var nWord = DIGIT_WORDS[n] || String(n);
      if (k === "dic") {
        if (n < 2) {
          return { text: "an ISODICENTRIC chromosome idic(" + chroms[0] + "): chromosome " + chroms[0] + " breaks at " +
            (breaks[0] || chroms[0]) + " and is duplicated as a mirror image, giving one chromosome with two centromeres and two copies of the retained arm", tag: "t" };
        }
        return { text: "a DICENTRIC chromosome: chromosomes " + listJoin(chroms) + " break (at " + listJoin(breaks) +
          ") and fuse into a single chromosome that carries two centromeres", tag: "t" };
      }
      if (n >= 3) {
        var cycle = chroms.join("→") + "→" + chroms[0];   // e.g. 2→7→5→2
        return { text: "a " + (n === 3 ? "three-way" : nWord + "-way") + " TRANSLOCATION: chromosomes " + listJoin(chroms) +
          " each break (at " + listJoin(breaks) + ") and hand the piece beyond the break to the next chromosome in the list, wrapping around at the end (" +
          cycle + "). The result is " + listJoin(ders) + " — each keeps its own centromere plus a segment from the chromosome before it.", tag: "t" };
      }
      return { text: "a reciprocal TRANSLOCATION: chromosomes " + listJoin(chroms) + " break (at " + listJoin(breaks) +
        ") and swap the pieces beyond those breaks, giving two derivative chromosomes " + listJoin(ders), tag: "t" };
    }
    if (k === "iso") {
      var arm = (bp[0] || [])[0] || "q10";
      var whicharm = /^q/.test(arm) ? "long (q)" : "short (p)";
      var lostarm = /^q/.test(arm) ? "short (p)" : "long (q)";
      return { text: "an ISOCHROMOSOME i(" + c + "): a mirror-image chromosome made of two " + whicharm + " arms, so the " + lostarm + " arm is lost; you end up with 3 copies of one arm and 1 of the other", tag: "iso" };
    }
    if (k === "ring") return { text: "a RING chromosome r(" + c + "): the chromosome's arms break and the broken ends fuse into a circle (usually loses the distal tips)", tag: "ring" };
    if (k === "der") {
      // Robertsonian / whole-arm fusion, e.g. rob(13;14)(q10;q10): two acrocentrics
      // join at the centromere. The chromosomes are listed lowest-number-first by
      // convention, so the notation does NOT tell us whose centromere is retained;
      // these fusions are usually dicentric with one centromere inactivated. Do not
      // claim a single chromosome's centromere here (that rule is only for der(N)).
      if (/robertsonian/i.test(ab.note || "") && ab.chroms && ab.chroms.length >= 2) {
        return { text: "a ROBERTSONIAN translocation: the long arms of chromosomes " +
          listJoin(ab.chroms) + " are fused at the centromere into one derivative chromosome, and the two short arms are lost. " +
          "They are written lowest-number-first by convention, not by which centromere is kept; whole-arm fusions like this are usually dicentric, with one centromere inactivated", tag: "der" };
      }
      var base = "an abnormal (“derivative”) chromosome that has chromosome " + c + "’s centromere";
      var subs = ab.subOps || [];
      var td = subs.filter(function (s) { return s.op === "t"; })[0];
      // The der can also carry del/dup/inv on its own chromosome (a chain like
      // der(9)del(9)(p12)t(9;22)); the renderer draws them, so name them here too.
      var extras = subs.map(subOpPhrase).filter(Boolean);
      var extraText = extras.length ? " It also carries " + listJoin(extras) + "." : "";
      if (td && td.chroms.length >= 2) {
        var di = td.chroms.indexOf(c); if (di < 0) di = 0;
        var partner = td.chroms[1 - di];
        var bpDer = (td.breakpoints[di] || [])[0], bpPar = (td.breakpoints[1 - di] || [])[0];
        return { text: base + ". It’s chromosome " + c + throughShort(c, bpDer) + " with " + endShort(partner, bpPar) + " attached." + extraText, tag: "der" };
      }
      return { text: base + (ab.note ? " (" + ab.note + ")" : "") + "." + extraText, tag: "der" };
    }
    if (k === "ins") {
      var ic = ab.chroms;
      if (ic.length >= 2) {
        return { text: "an INSERTION: the segment between " + bandsPhrase(ic[1], bp[1] || []) + " of chromosome " + ic[1] +
          " is moved into chromosome " + ic[0] + " at " + ic[0] + ((bp[0] || [])[0] || "?") +
          ". Chromosome " + ic[0] + " grows by that piece; chromosome " + ic[1] + " loses it.", tag: "add" };
      }
      var ig = bp[0] || [];
      return { text: "an INSERTION within chromosome " + c + ": the segment between " + bandsPhrase(c, ig.slice(1)) +
        " is moved to a new position (at " + c + (ig[0] || "?") + "). Nothing is gained or lost overall.", tag: "add" };
    }
    if (k === "add") return { text: "ADDITIONAL material of unknown origin attached to chromosome " + c + " at " + c + ((bp[0] || [])[0] || "?"), tag: "add" };
    if (k === "mar") return { text: "a MARKER chromosome (mar): a small extra chromosome whose origin can't be identified by banding alone", tag: "mar" };
    if (k === "trp") return { text: "a TRIPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, bp[0] || []) + " is present three times", tag: "dup" };
    return { text: "an aberration (" + (ab.raw || k) + ") that KaryoDraw drew as best it could", tag: "unknown" };
  }

  // ---- token-by-token decode of a clone ------------------------------------
  function decode(clone) {
    var rows = [];
    if (clone.modalNumber != null) {
      var range = clone.modalHigh != null;
      var code = range ? (clone.modalNumber + "~" + clone.modalHigh) : String(clone.modalNumber);
      var txt = range
        ? "chromosome count varies from " + clone.modalNumber + " to " + clone.modalHigh + " across the cells counted (normal is 46)"
        : "total chromosome count" + (clone.modalNumber === 46 ? " (the normal human number)" : " (normal is 46)");
      rows.push({ code: code, text: txt, tag: "count" });
    }
    if (clone.sex.label) {
      rows.push({ code: clone.sex.label, text: "sex chromosomes: " + clone.sex.note, tag: "sex" });
    }
    clone.aberrations.forEach(function (ab) {
      var d = describeAberration(ab);
      rows.push({ code: ab.raw, text: d.text, tag: d.tag });
    });
    if (clone.cellCount != null) {
      rows.push({ code: "[" + (clone.composite ? "cp" : "") + clone.cellCount + "]", text: (clone.composite ? "composite of " : "seen in ") + clone.cellCount + " cells counted for this clone", tag: "cells" });
    }
    return rows;
  }

  // ---- curated clinical / board notes --------------------------------------
  // Each matcher inspects a clone and returns notes when it fits.
  var SYNDROMES = [
    { test: function (c) { return c.complement["21"] >= 3; }, name: "Trisomy 21, Down syndrome",
      note: "The most common autosomal trisomy compatible with life (~1/700 births). Three copies of chromosome 21. Features: characteristic facies, hypotonia, intellectual disability, ~50% congenital heart disease (AV canal), ↑ risk of AML/ALL and early Alzheimer disease. ~95% free trisomy (nondisjunction, ↑ with maternal age), ~4% Robertsonian translocation, ~1% mosaic." },
    { test: function (c) { return c.complement["18"] >= 3; }, name: "Trisomy 18, Edwards syndrome",
      note: "Three copies of chromosome 18. Clenched fists with overlapping fingers, rocker-bottom feet, micrognathia, congenital heart disease; most die in the first year." },
    { test: function (c) { return c.complement["13"] >= 3; }, name: "Trisomy 13, Patau syndrome",
      note: "Three copies of chromosome 13. Holoprosencephaly, cleft lip/palate, polydactyly, cutis aplasia; high early mortality." },
    { test: function (c) { return c.sex.label === "X"; }, name: "45,X, Turner syndrome",
      note: "A single X, no second sex chromosome (monosomy X). Short stature, ovarian dysgenesis/streak gonads, webbed neck, coarctation/bicuspid aortic valve, lymphedema. Often mosaic (45,X/46,XX) or with an i(Xq)." },
    { test: function (c) { return c.sex.label === "XXY" || c.sex.label === "XXXY"; }, name: "Klinefelter syndrome (47,XXY and variants)",
      note: "An extra X in a male (≥1 Y with ≥2 X); 47,XXY is classic, with 48,XXXY and 48,XXYY as higher-grade variants. Tall stature, small firm testes, gynecomastia, infertility, low testosterone. The extra X (or Xs) inactivate as Barr bodies." },
    { test: function (c) { return c.sex.label === "XYY"; }, name: "47,XYY",
      note: "An extra Y. Usually tall stature; typically normal fertility and intelligence within the normal range. Often incidental." },
    { test: function (c) { return c.sex.label === "XXX"; }, name: "47,XXX, Triple X",
      note: "An extra X in a female. Often mild/absent phenotype; tall stature, sometimes learning difficulties. Two Barr bodies." },
    { test: function (c) { return hasT(c, "9", "22"); }, name: "t(9;22), Philadelphia chromosome",
      note: "The reciprocal t(9;22)(q34;q11.2) fuses <i>BCR</i> (22) with <i>ABL1</i> (9), creating <i>BCR::ABL1</i>, the hallmark of chronic myeloid leukemia (also some ALL). Target of imatinib and other tyrosine-kinase inhibitors." },
    { test: function (c) { return hasT(c, "15", "17"); }, name: "t(15;17), Acute promyelocytic leukemia",
      note: "t(15;17)(q24;q21) fuses <i>PML::RARA</i>. APL (formerly FAB AML-M3); responsive to all-trans retinoic acid (ATRA) and arsenic. A medical emergency due to DIC." },
    { test: function (c) { return hasT(c, "8", "14"); }, name: "t(8;14), Burkitt lymphoma",
      note: "t(8;14)(q24;q32) places <i>MYC</i> next to the <i>IGH</i> enhancer → <i>MYC</i> overexpression. Classic 'starry-sky' Burkitt lymphoma." },
    { test: function (c) { return hasT(c, "8", "21"); }, name: "t(8;21), AML",
      note: "t(8;21)(q22;q22) <i>RUNX1::RUNX1T1</i>; a core-binding-factor AML with generally favorable prognosis." },
    { test: function (c) { return hasT(c, "14", "18"); }, name: "t(14;18), Follicular lymphoma",
      note: "t(14;18)(q32;q21) juxtaposes <i>BCL2</i> with <i>IGH</i> → anti-apoptotic <i>BCL2</i> overexpression." },
    { test: function (c) { return hasDel(c, "5", "p"); }, name: "del(5p), Cri-du-chat syndrome",
      note: "Terminal deletion of 5p ('5p−'). High-pitched cat-like cry in infancy, microcephaly, hypotonia, intellectual disability." },
    { test: function (c) { return hasDel(c, "4", "p"); }, name: "del(4p), Wolf–Hirschhorn syndrome",
      note: "Deletion of 4p16.3. 'Greek warrior helmet' facies, growth delay, seizures, intellectual disability." },
    { test: function (c) { return hasDelBand(c, "15", "q11"); }, name: "del(15)(q11q13), Prader–Willi / Angelman",
      note: "The 15q11-q13 imprinted region: a paternal deletion → Prader–Willi (hypotonia, hyperphagia/obesity, hypogonadism); a maternal deletion → Angelman ('happy puppet', ataxia, seizures). Parent-of-origin matters." },
    { test: function (c) { return hasDelBand(c, "22", "q11"); }, name: "del(22)(q11.2), DiGeorge / 22q11.2 deletion",
      note: "The most common microdeletion. CATCH-22: Cardiac (conotruncal) defects, Abnormal facies, Thymic aplasia (T-cell immunodeficiency), Cleft palate, Hypocalcemia." }
  ];
  function hasT(c, a, b) {
    return c.aberrations.some(function (ab) {
      return (ab.kind === "t" || ab.kind === "dic" || ab.kind === "der") &&
        (ab.chroms.indexOf(a) >= 0 && ab.chroms.indexOf(b) >= 0 ||
          (ab.subOps || []).some(function (s) { return s.op === "t" && s.chroms.indexOf(a) >= 0 && s.chroms.indexOf(b) >= 0; }));
    });
  }
  function hasDel(c, chrom, arm) {
    return c.aberrations.some(function (ab) {
      return ab.kind === "del" && ab.chroms[0] === chrom && (ab.breakpoints[0] || []).some(function (b) { return b[0] === arm; });
    });
  }
  function hasDelBand(c, chrom, bandPrefix) {
    return c.aberrations.some(function (ab) {
      return ab.kind === "del" && ab.chroms[0] === chrom && (ab.breakpoints[0] || []).some(function (b) { return b.indexOf(bandPrefix) === 0; });
    });
  }
  function syndromes(clone) {
    var out = [];
    SYNDROMES.forEach(function (s) { try { if (s.test(clone)) out.push({ name: s.name, note: s.note }); } catch (e) {} });
    return out;
  }

  var ARM_INFO = {
    p: "The SHORT arm. 'p' is for petit (French for small). Always drawn on TOP. Bands are numbered starting from the centromere (p1…) outward to the telomere.",
    q: "The LONG arm. 'q' simply follows 'p' in the alphabet. Always drawn on the BOTTOM. Bands numbered from the centromere (q1…) out to the telomere.",
    centromere: "The primary constriction that joins the two arms. The kinetochore assembles here and spindle fibres attach during cell division. Its position (metacentric / submetacentric / acrocentric) helps identify a chromosome.",
    telomere: "The very tip of each arm ('ter' = pter / qter). Repetitive TTAGGG caps that protect chromosome ends and shorten with each division.",
    band: "A stretch of chromosome that stains light or dark with Giemsa (G-banding). The reproducible pattern of bands is a chromosome's 'barcode', it's how each one is identified and how breakpoints are pinpointed."
  };

  // ---- spoken pronunciation (fed to the browser's free Web Speech API) -----
  function pronounceBand(chrom, band, withChrom) {
    var m = /^([pq])(\d+)(?:\.(\d+))?/.exec(band || "");
    var body = m ? (m[1] + " " + digitWords(m[2]) + (m[3] ? " point " + digitWords(m[3]) : "")) : (band || "");
    return (withChrom ? chrom + " " : "") + body;
  }
  function pronounceAb(ab) {
    var c = ab.chroms[0], bp = ab.breakpoints || [];
    function bands(i, withChrom) { return (bp[i] || []).map(function (b) { return pronounceBand(ab.chroms[i] || c, b, withChrom); }).join(" and "); }
    switch (ab.kind) {
      case "gain": return "gain of chromosome " + c;
      case "loss": return "loss of chromosome " + c;
      case "del": return "deletion of chromosome " + c + ((bp[0] || []).length ? " at " + bands(0, false) : "");
      case "dup": return "duplication on chromosome " + c + ((bp[0] || []).length ? " of " + bands(0, false) : "");
      case "inv": return "inversion of chromosome " + c + ((bp[0] || []).length ? " between " + bands(0, false) : "");
      case "t": case "dic": return "translocation between chromosomes " + ab.chroms.join(" and ") +
        (bp.length ? ", breakpoints " + ab.chroms.map(function (cc, i) { return pronounceBand(cc, (bp[i] || [])[0], true); }).join(" and ") : "");
      case "iso": return "isochromosome " + c;
      case "ring": return "ring chromosome " + c + ((bp[0] || []).length ? ", breaks at " + bands(0, false) : "");
      case "der": return "derivative chromosome " + c;
      case "ins": return "insertion" + (ab.chroms.length >= 2 ? " of chromosome " + ab.chroms[1] + " into chromosome " + ab.chroms[0] : " within chromosome " + c);
      case "add": return "additional material on chromosome " + c;
      case "mar": return "a marker chromosome";
      case "trp": return "triplication on chromosome " + c;
      case "hsr": return "homogeneously staining region on chromosome " + c;
      case "dmin": return "double minutes";
      case "idem": return ab.ref === "sdl" ? "same as the sideline" : "idem, same as the stemline";
      default: return ab.raw || "";
    }
  }
  function pronounce(clone) {
    var parts = [];
    if (clone.modalNumber != null) parts.push(String(clone.modalNumber));
    if (clone.sex.tokens.length) parts.push(clone.sex.tokens.join(" "));
    clone.aberrations.forEach(function (ab) { parts.push(pronounceAb(ab)); });
    return parts.filter(Boolean).join(". ");
  }

  // ---- plain-language summary (for the printable patient sheet) ------------
  var SEX_PLAIN = {
    "XX": "two X chromosomes (a typical female pattern)",
    "XY": "one X and one Y chromosome (a typical male pattern)",
    "X": "a single X chromosome",
    "XXY": "two X and one Y chromosome",
    "XYY": "one X and two Y chromosomes",
    "XXX": "three X chromosomes",
    "XXYY": "two X and two Y chromosomes"
  };
  function plainAb(ab) {
    var c = ab.chroms[0], b0 = (ab.breakpoints || [])[0] || [];
    switch (ab.kind) {
      case "gain": return "There is an extra copy of chromosome " + c + " (three copies instead of the usual two). This is called trisomy " + c + ".";
      case "loss": return "There is a missing copy of chromosome " + c + " (one copy instead of the usual two).";
      case "del": return "A piece of chromosome " + c + " is missing" + (b0.length ? " (the part around " + c + b0.join(" to ") + ")" : "") + ".";
      case "dup": return "A small region of chromosome " + c + " is present twice (a duplication), so there is a little extra genetic material there.";
      case "inv": return "A piece of chromosome " + c + " is flipped around in the opposite direction (an inversion). Usually no genetic material is gained or lost.";
      case "t": case "dic": return "Chromosomes " + listJoin(ab.chroms) + " have exchanged pieces with each other (a translocation). Often no genetic material is gained or lost overall, but the swap can still matter.";
      case "iso": return "Chromosome " + c + " formed as a mirror image of one of its arms (an isochromosome), so there is extra of one part and less of another.";
      case "ring": return "The ends of chromosome " + c + " joined together into a ring shape (a ring chromosome).";
      case "der": return "Chromosome " + c + " is rearranged (doctors call it a 'derivative' chromosome).";
      case "ins": return ab.chroms.length >= 2
        ? "A piece of chromosome " + ab.chroms[1] + " has been moved into chromosome " + c + " (an insertion)."
        : "A piece of chromosome " + c + " has moved to a different place on the same chromosome (an insertion). Usually no genetic material is gained or lost.";
      case "add": return "Extra chromosome material of uncertain origin is attached to chromosome " + c + ".";
      case "mar": return "There is a small extra chromosome whose origin has not been identified (a 'marker' chromosome).";
      case "trp": return "A region of chromosome " + c + " is present three times (a triplication).";
      case "hsr": return "Chromosome " + c + " carries a block of amplified DNA (many extra copies of a gene, called a homogeneously staining region).";
      case "dmin": return "There are small extra circles of amplified DNA outside the chromosomes (called double minutes).";
      case "idem": return "This cell line has all the same changes as the main clone, plus the change(s) listed next.";
      default: return "There is a change involving chromosome " + (c || "material") + ".";
    }
  }
  function plainSummary(clone) {
    var out = [];
    out.push("Chromosomes are the packages of DNA inside your cells. A typical result has 46 chromosomes, arranged in 23 pairs, including the two that determine sex.");
    var s = SEX_PLAIN[clone.sex.label] || (clone.sex.label ? clone.sex.label + " sex chromosomes" : "");
    out.push("This result shows " + (clone.modalNumber != null ? clone.modalNumber : "an unusual number of") + " chromosomes" + (s ? ", with " + s : "") + ".");
    if (!clone.aberrations.length) {
      out.push("No changes were seen in the chromosomes with this test.");
    } else {
      out.push(clone.aberrations.length === 1 ? "One change was found:" : "The following changes were found:");
      clone.aberrations.forEach(function (ab) { out.push(plainAb(ab)); });
    }
    return out;
  }

  window.Teach = {
    decode: decode,
    plainSummary: plainSummary,
    bandInfo: bandInfo,
    stainInfo: stainInfo,
    describeAberration: describeAberration,
    syndromes: syndromes,
    pronounce: pronounce,
    ARM_INFO: ARM_INFO
  };
})();
