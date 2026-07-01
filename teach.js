/* KaryoScope — teaching layer.
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

  // Parse a band name like "q22.13" into readable pieces.
  function bandInfo(chrom, band) {
    var m = /^([pq])(\d)(\d)?(?:\.(\d+))?/.exec(band || "");
    var arm = m ? m[1] : (band && band[0]);
    var out = { chrom: chrom, band: band, arm: arm, armName: ordinalArm(arm), read: "", parts: [], stain: null, position: "" };
    if (m) {
      var region = m[2], bnd = m[3], sub = m[4];
      out.parts.push({ label: "arm", value: arm, note: ordinalArm(arm) + " — counted outward from the centromere" });
      out.parts.push({ label: "region", value: region, note: "region " + region + ", counting away from the centromere" });
      if (bnd) out.parts.push({ label: "band", value: bnd, note: "band " + bnd + " within that region" });
      if (sub) out.parts.push({ label: "sub-band", value: sub, note: "finer sub-division seen at higher resolution" });
      var spoken = arm + "-" + region + (bnd || "") + (sub ? "-point-" + sub.split("").join("-") : "");
      out.read = "Read “" + chrom + spoken.replace(/-/g, " ").replace("point", "point") + "”. " +
        "Band names are read digit-by-digit (e.g. q22.13 is “q two-two point one-three”, NOT “twenty-two”).";
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
    gpos25: { name: "G-positive (light)", bio: "Lightly staining dark band — moderate gene density." },
    gpos50: { name: "G-positive (medium)", bio: "Medium-dark band: AT-rich, gene-poorer, later-replicating." },
    gpos75: { name: "G-positive (dark)", bio: "Dark band: AT-rich, gene-poor, late-replicating heterochromatin-like." },
    gpos100: { name: "G-positive (darkest)", bio: "Darkest band: very AT-rich, gene-poor, latest-replicating." },
    acen: { name: "Centromere", bio: "The centromere (α-satellite heterochromatin) where the kinetochore assembles and spindle fibres attach at cell division." },
    gvar: { name: "Variable region", bio: "Polymorphic heterochromatin whose size varies normally between people (e.g. 1q, 9q, 16q, Yq) — usually not pathogenic." },
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
  function describeAberration(ab) {
    var k = ab.kind, c = ab.chroms[0], bp = ab.breakpoints;
    if (k === "gain") return { text: "an EXTRA copy of chromosome " + c + " (three copies = trisomy " + c + ")", tag: "gain" };
    if (k === "loss") return { text: "LOSS of one chromosome " + c + " (one copy = monosomy " + c + ")", tag: "loss" };
    if (k === "del") {
      var b0 = (bp[0] || []);
      if (b0.length >= 2) return { text: "an interstitial DELETION in chromosome " + c + ": the segment between " + bandsPhrase(c, b0) + " is missing", tag: "del" };
      return { text: "a terminal DELETION of chromosome " + c + ": everything distal to " + c + (b0[0] || "?") + " (out to the tip) is lost", tag: "del" };
    }
    if (k === "dup") return { text: "a DUPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, bp[0] || []) + " is present twice", tag: "dup" };
    if (k === "inv") {
      var arms = (bp[0] || []).map(function (b) { return b[0]; });
      var peri = arms.indexOf("p") >= 0 && arms.indexOf("q") >= 0;
      return { text: "an INVERSION in chromosome " + c + ": the segment between " + bandsPhrase(c, bp[0] || []) + " is flipped end-for-end (" + (peri ? "pericentric — it spans the centromere" : "paracentric — within one arm") + ")", tag: "inv" };
    }
    if (k === "t" || k === "dic") {
      var a = ab.chroms[0], b = ab.chroms[1];
      var ba = (bp[0] || [])[0], bb = (bp[1] || [])[0];
      return { text: "a " + (k === "dic" ? "DICENTRIC translocation" : "reciprocal TRANSLOCATION") + ": chromosomes " + a + " and " + b +
        " break (at " + a + ba + " and " + b + bb + ") and swap the pieces beyond those breaks, giving two derivative chromosomes der(" + a + ") and der(" + b + ")", tag: "t" };
    }
    if (k === "iso") {
      var arm = (bp[0] || [])[0] || "q10";
      var whicharm = /^q/.test(arm) ? "long (q)" : "short (p)";
      var lostarm = /^q/.test(arm) ? "short (p)" : "long (q)";
      return { text: "an ISOCHROMOSOME i(" + c + "): a mirror-image chromosome made of two " + whicharm + " arms — the " + lostarm + " arm is lost, so you get 3 copies of one arm and 1 of the other", tag: "iso" };
    }
    if (k === "ring") return { text: "a RING chromosome r(" + c + "): the chromosome's arms break and the broken ends fuse into a circle (usually loses the distal tips)", tag: "ring" };
    if (k === "der") {
      var base = "an abnormal (“derivative”) chromosome that has chromosome " + c + "’s centromere";
      var td = (ab.subOps || []).filter(function (s) { return s.op === "t"; })[0];
      if (td && td.chroms.length >= 2) {
        var di = td.chroms.indexOf(c); if (di < 0) di = 0;
        var partner = td.chroms[1 - di];
        var bpDer = (td.breakpoints[di] || [])[0], bpPar = (td.breakpoints[1 - di] || [])[0];
        return { text: base + ". It’s chromosome " + c + throughShort(c, bpDer) + " with " + endShort(partner, bpPar) + " attached.", tag: "der" };
      }
      return { text: base + (ab.note ? " (" + ab.note + ")" : "") + ".", tag: "der" };
    }
    if (k === "add") return { text: "ADDITIONAL material of unknown origin attached to chromosome " + c + " at " + c + ((bp[0] || [])[0] || "?"), tag: "add" };
    if (k === "mar") return { text: "a MARKER chromosome (mar): a small extra chromosome whose origin can't be identified by banding alone", tag: "mar" };
    if (k === "trp") return { text: "a TRIPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, bp[0] || []) + " is present three times", tag: "dup" };
    return { text: "an aberration (" + (ab.raw || k) + ") that KaryoScope drew as best it could", tag: "unknown" };
  }

  // ---- token-by-token decode of a clone ------------------------------------
  function decode(clone) {
    var rows = [];
    if (clone.modalNumber != null) {
      rows.push({ code: String(clone.modalNumber), text: "total chromosome count" + (clone.modalNumber === 46 ? " (the normal human number)" : " (normal is 46)"), tag: "count" });
    }
    if (clone.sex.label) {
      rows.push({ code: clone.sex.label, text: "sex chromosomes — " + clone.sex.note, tag: "sex" });
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
    { test: function (c) { return c.complement["21"] >= 3; }, name: "Trisomy 21 — Down syndrome",
      note: "The most common autosomal trisomy compatible with life (~1/700 births). Three copies of chromosome 21. Features: characteristic facies, hypotonia, intellectual disability, ~50% congenital heart disease (AV canal), ↑ risk of AML/ALL and early Alzheimer disease. ~95% free trisomy (nondisjunction, ↑ with maternal age), ~4% Robertsonian translocation, ~1% mosaic." },
    { test: function (c) { return c.complement["18"] >= 3; }, name: "Trisomy 18 — Edwards syndrome",
      note: "Three copies of chromosome 18. Clenched fists with overlapping fingers, rocker-bottom feet, micrognathia, congenital heart disease; most die in the first year." },
    { test: function (c) { return c.complement["13"] >= 3; }, name: "Trisomy 13 — Patau syndrome",
      note: "Three copies of chromosome 13. Holoprosencephaly, cleft lip/palate, polydactyly, cutis aplasia; high early mortality." },
    { test: function (c) { return c.sex.label === "X"; }, name: "45,X — Turner syndrome",
      note: "A single X, no second sex chromosome (monosomy X). Short stature, ovarian dysgenesis/streak gonads, webbed neck, coarctation/bicuspid aortic valve, lymphedema. Often mosaic (45,X/46,XX) or with an i(Xq)." },
    { test: function (c) { return c.sex.label === "XXY" || c.sex.label === "XXXY"; }, name: "47,XXY — Klinefelter syndrome",
      note: "An extra X in a male (≥1 Y with ≥2 X). Tall stature, small firm testes, gynecomastia, infertility, low testosterone. One X is inactivated as a Barr body." },
    { test: function (c) { return c.sex.label === "XYY"; }, name: "47,XYY",
      note: "An extra Y. Usually tall stature; typically normal fertility and intelligence within the normal range. Often incidental." },
    { test: function (c) { return c.sex.label === "XXX"; }, name: "47,XXX — Triple X",
      note: "An extra X in a female. Often mild/absent phenotype; tall stature, sometimes learning difficulties. Two Barr bodies." },
    { test: function (c) { return hasT(c, "9", "22"); }, name: "t(9;22) — Philadelphia chromosome",
      note: "The reciprocal t(9;22)(q34;q11.2) fuses BCR (22) with ABL1 (9), creating BCR-ABL1 — the hallmark of chronic myeloid leukemia (also some ALL). Target of imatinib and other tyrosine-kinase inhibitors." },
    { test: function (c) { return hasT(c, "15", "17"); }, name: "t(15;17) — Acute promyelocytic leukemia",
      note: "t(15;17)(q24;q21) fuses PML-RARA. APL (AML-M3); responsive to all-trans retinoic acid (ATRA) and arsenic. A medical emergency due to DIC." },
    { test: function (c) { return hasT(c, "8", "14"); }, name: "t(8;14) — Burkitt lymphoma",
      note: "t(8;14)(q24;q32) places MYC next to the IGH enhancer → MYC overexpression. Classic 'starry-sky' Burkitt lymphoma." },
    { test: function (c) { return hasT(c, "8", "21"); }, name: "t(8;21) — AML",
      note: "t(8;21)(q22;q22) RUNX1-RUNX1T1; a core-binding-factor AML with generally favorable prognosis." },
    { test: function (c) { return hasT(c, "14", "18"); }, name: "t(14;18) — Follicular lymphoma",
      note: "t(14;18)(q32;q21) juxtaposes BCL2 with IGH → anti-apoptotic BCL2 overexpression." },
    { test: function (c) { return hasDel(c, "5", "p"); }, name: "del(5p) — Cri-du-chat syndrome",
      note: "Terminal deletion of 5p ('5p−'). High-pitched cat-like cry in infancy, microcephaly, hypotonia, intellectual disability." },
    { test: function (c) { return hasDel(c, "4", "p"); }, name: "del(4p) — Wolf–Hirschhorn syndrome",
      note: "Deletion of 4p16.3. 'Greek warrior helmet' facies, growth delay, seizures, intellectual disability." },
    { test: function (c) { return hasDelBand(c, "15", "q11"); }, name: "del(15)(q11q13) — Prader–Willi / Angelman",
      note: "The 15q11-q13 imprinted region: a paternal deletion → Prader–Willi (hypotonia, hyperphagia/obesity, hypogonadism); a maternal deletion → Angelman ('happy puppet', ataxia, seizures). Parent-of-origin matters." },
    { test: function (c) { return hasDelBand(c, "22", "q11"); }, name: "del(22)(q11.2) — DiGeorge / 22q11.2 deletion",
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
    band: "A stretch of chromosome that stains light or dark with Giemsa (G-banding). The reproducible pattern of bands is a chromosome's 'barcode' — it's how each one is identified and how breakpoints are pinpointed."
  };

  window.Teach = {
    decode: decode,
    bandInfo: bandInfo,
    stainInfo: stainInfo,
    describeAberration: describeAberration,
    syndromes: syndromes,
    ARM_INFO: ARM_INFO
  };
})();
