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
    acen: { name: "Centromere", bio: "The centromere (α-satellite heterochromatin) where the kinetochore assembles and spindle fibers attach at cell division." },
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
    var out = describeAberrationBase(ab);
    // Appended once, here, rather than threaded through forty return statements.
    if (out && ab && ab.uncertain) out = { text: out.text + uncertainSuffix(ab), tag: out.tag };
    return out;
  }

  function describeAberrationBase(ab) {
    var k = ab.kind, c = ab.chroms[0], bp = ab.breakpoints, mult = ab.multiplier || 1;
    if (k === "idem") {
      var refName = ab.ref === "sdl" ? "the sideline (the clone before it)" : "the stemline (the first clone)";
      return { text: "the SAME changes as " + refName + ". This subclone carries all of them, plus whatever is listed next (clonal evolution)", tag: "count" };
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
          cycle + "). The result is " + listJoin(ders) + ". Each keeps its own centromere plus a segment from the chromosome before it.", tag: "t" };
      }
      // Both breaks at a centromere designation. Worth its own sentence, because the
      // p10/q10 letters read as if they name the arms that join, and they do not: at
      // the centromere ISCN's derivative formula (der(A) = A pter→bandA :: B bandB→B
      // qter) makes pter→band the whole p arm whichever letter is written, so every
      // spelling gives der(A) = Ap+Bq. The letters record which half of the split
      // centromere each derivative carries. Say so, or the identical drawings from
      // (p10;q10) and (q10;q10) look like the app ignoring the input.
      if (ab.wholeArm) {
        var a0 = chroms[0], a1 = chroms[1];
        return { text: "a WHOLE-ARM reciprocal TRANSLOCATION: chromosomes " + listJoin(chroms) +
          " break inside their own centromeres (at " + listJoin(breaks) +
          ") and trade entire arms, giving " + listJoin(ders) + ". der(" + a0 + ") is " + a0 + "p carrying " + a1 +
          "q, and der(" + a1 + ") is " + a1 + "p carrying " + a0 + "q. Each derivative keeps its own short arm and receives its partner's long arm. " +
          "p10 and q10 are the two halves of a centromere, so they record which half each derivative ends up with rather than which arms join: " +
          "(p10;q10), (q10;q10) and (p10;p10) all describe the same two chromosomes and are drawn the same way", tag: "t" };
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
        return { text: base + ". This is chromosome " + c + throughShort(c, bpDer) + " with " + endShort(partner, bpPar) + " attached." + extraText, tag: "der" };
      }
      return { text: base + "." + extraText, tag: "der" };
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
    if (k === "mar") {
      var nmar = ab.count || 1;
      // +r is the same finding as +mar with one extra fact: the shape is a ring.
      // The chromosome it came from is still unknown, which is what separates it
      // from r(13); saying so is the point, because the two look alike written down.
      if (ab.ringMarker) {
        return { text: (nmar > 1
          ? nmar + " supernumerary RING chromosomes (r): small extra chromosomes that have"
          : "a supernumerary RING chromosome (r): a small extra chromosome that has") +
          " formed a circle, whose chromosome of origin banding cannot identify. Written r(13) instead once that chromosome is known", tag: "mar" };
      }
      return { text: (nmar > 1
        ? nmar + " MARKER chromosomes (mar): small extra chromosomes"
        : "a MARKER chromosome (mar): a small extra chromosome") +
        " whose origin cannot be identified by banding alone", tag: "mar" };
    }
    if (k === "trp") return { text: "a TRIPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, bp[0] || []) + " is present three times", tag: "dup" };
    return { text: "an aberration (" + (ab.raw || k) + ") that KaryoDraw drew as best it could", tag: "unknown" };
  }

  // Inheritance / origin suffixes on an aberration (c / mat / pat / dn). The parser
  // records these; spell out what each means so a learner sees it in the decode.
  // The short label ("maternal in origin") is the parser's, reused here so the two
  // never drift; teach.js only adds the plain-language explanation after the colon.
  var QUALIFIER_EXPLAIN = {
    dn: "a new change, not inherited from either parent",
    mat: "inherited from the mother",
    pat: "inherited from the father",
    c: "present in every cell from birth, not acquired",
  };
  var QUAL = (window.ISCN && window.ISCN.QUAL) || {};
  var QUALIFIER_PHRASE = {};
  Object.keys(QUALIFIER_EXPLAIN).forEach(function (k) {
    QUALIFIER_PHRASE[k] = (QUAL[k] || k) + ": " + QUALIFIER_EXPLAIN[k];
  });

  // ---- token-by-token decode of a clone ------------------------------------
  // A whole-arm fusion of two acrocentrics written as t() with a count that agrees
  // with itself: legal ISCN, and for two non-acrocentrics it is genuinely what you
  // would write, so it is not a warning. But for two acrocentrics it is almost never
  // what the writer meant, and the drawing (both products present, 46 chromosomes) is
  // exactly the picture that convinces a reader a Robertsonian carrier has 46. So the
  // decode panel says what the notation means and names the alternative. When the
  // count already contradicts the t (45,XX,t(13;15)(q10;q10)) the warning box and its
  // rob() fix are doing this job, so stay quiet rather than say it twice.
  function robNote(ab, clone) {
    if (!ab.wholeArmAcro) return "";
    if (!clone.counts || !clone.counts.ok || clone.modalNumber == null) return "";
    var pair = ab.chroms.join(";");
    return ". Both whole-arm products are kept here, so the count stays " + clone.modalNumber +
      ". The acrocentric fusion that loses the short arms is a Robertsonian translocation, written rob(" +
      pair + ")(q10;q10), and it gives a count of " + (clone.modalNumber - 1) +
      ". That is the form seen in practice, and dropping those short arms costs nothing: an acrocentric short arm carries " +
      "ribosomal RNA gene repeats that the other acrocentrics carry as well, so a balanced Robertsonian carrier is healthy at " +
      (clone.modalNumber - 1) + " chromosomes";
  }

  // Expected X-inactivation for a rearrangement involving the X. This is NOT read off
  // the notation: ISCN carries inactivation status only as a FISH probe in ish
  // nomenclature (2024 example xxiii, 46,X,r(X)(p22.3q22).ish r(X)(...XIST+,DXZ4-)),
  // never in the karyotype string. So every sentence below opens with "Expected", and
  // none of them claim the input said this.
  //
  // One rule covers every case (Gardner & Sutherland, 5th ed, p. 221): after selection
  // the surviving pattern is the one leaving the least functional imbalance, and the
  // choice exists only where the abnormal chromosome keeps an X-inactivation center.
  // Balanced and unbalanced therefore skew in OPPOSITE directions, which is the part
  // that is easy to get backwards, and the reason the balanced carrier can present with
  // an X-linked recessive disease: her intact X is the silenced one, so a gene broken at
  // the X breakpoint has no working copy left.
  // The center sits in Xq13 (Gardner p. 214), so which side of a break keeps it is
  // decided by the breakpoint, and that is what decides whether a piece CAN be silenced
  // at all. Gardner figure 6-8 caption: "the der(autosome) has the XIC; here, the X
  // breakpoint must be in proximal Xq, above the XIC ... In the third column, in which
  // the der(X) has the XIC, X exchanges can occur either in Xp or in Xq distal to the
  // XIC." Band numbers count outward from the centromere, so a plain numeric compare
  // against 13 orders them correctly (q11.2 < q13 < q21). Done on the string rather than
  // through Karyo.resolveBand so the note does not need the renderer loaded.
  var XIC_BAND = 13;
  function xicSide(xBreak) {
    if (!xBreak) return "unknown";
    if (/^p/.test(xBreak)) return "der-x";          // all of Xq, q13 included, stays with the der(X)
    var m = /^q(\d+(?:\.\d+)?)$/.exec(xBreak);
    if (!m) return "unknown";
    var n = parseFloat(m[1]);
    if (n >= XIC_BAND && n < XIC_BAND + 1) return "within";   // the break is inside q13 itself
    return n < XIC_BAND ? "der-autosome" : "der-x";
  }
  // The first breakpoint of a single-chromosome operation (iso, ring, del).
  function bpOf(ab) {
    return ((ab.breakpoints || [])[0] || [])[0] || null;
  }
  // The X breakpoint of a t(), or of the t() inside a der() chain.
  function xBreakOf(ab, subT) {
    var src = subT || ab, cs = src.chroms || [], i = cs.indexOf("X");
    if (i < 0) return null;
    return ((src.breakpoints || [])[i] || [])[0] || null;
  }

  function xciNote(ab, clone) {
    var own = ab.chroms || [];
    var subT = (ab.subOps || []).filter(function (s) { return s.op === "t"; })[0];
    var involved = own.concat(subT ? (subT.chroms || []) : []);
    if (involved.indexOf("X") < 0) return "";
    // Checked before the single-X test below, because 46,X,t(X;Y) draws only one X and
    // would otherwise fall into "no choice to make" when the real answer is "unpredictable".
    if (involved.indexOf("Y") >= 0) {
      return ". Expected X inactivation after an X;Y translocation is variable and is not reliably predicted from the karyotype";
    }
    var k = ab.kind;
    var side = xicSide(xBreakOf(ab, subT));
    // Checked ahead of the single-X test too. What happens to a piece of X sitting on an
    // autosome does not depend on the X count, and the parser files a der(22)t(X;22)
    // under chromosome 22, so complement.X reads 1 and the single-X branch would
    // otherwise swallow the more informative fact.
    if (k === "der" && own[0] !== "X") {
      if (side === "der-autosome") {
        return ". The X break is proximal to Xq13, so this derivative carries the X-inactivation center along with the X segment. " +
          "The segment can therefore be silenced, and silencing is expected to spread from it into the attached autosomal material, " +
          "which can leave that autosomal segment functionally monosomic";
      }
      if (side === "der-x") {
        return ". The X break is distal to Xq13, so this derivative has no X-inactivation center of its own and is beyond the reach of the one left on the X. " +
          "The X segment cannot be silenced, and functional disomy for it is the expected result";
      }
      return ". Whether this X segment can be silenced depends on which side of Xq13 the X broke, since the X-inactivation center sits there and cannot act on a segment separated from it";
    }
    // No second X means no choice: a male carrier, or 45,X. Say that rather than assert a
    // skew, which would be the wrong claim rather than a missing one.
    if (((clone.complement && clone.complement.X) || 0) < 2) {
      return ". X inactivation does not apply to this rearrangement: there is only one X, so there is no second X to silence";
    }
    if (k === "t") {
      if (side === "within") {
        return ". The X broke inside Xq13, which is where the X-inactivation center sits, so which derivative carries the center, and therefore which chromosome can be silenced, is not decided by the notation alone";
      }
      // The conclusion holds whichever derivative carries the center: only the normal X
      // can be silenced without cost, because both X pieces are needed to add up to one
      // working X. But name the right derivative in the mechanism, since the center rides
      // with the der(autosome) when the break is proximal to Xq13.
      var carrier = side === "der-autosome" ? "the derivative autosome, which carries the center because the X broke proximal to Xq13,"
                                            : "the der(X), which carries the center,";
      return ". Expected X inactivation is skewed: the normal X is silenced, and both derivatives stay active. " +
        "Silencing " + carrier + " would spread inactivation into the attached autosomal segment and leave it functionally monosomic, so those cells are selected against. " +
        "Because the intact X is the silenced one, a gene disrupted at the X breakpoint is unmasked, and a balanced female carrier can still manifest an X-linked recessive disorder";
    }
    // A der(X) keeps the inactivation center, so it is the one that can be silenced.
    if (k === "der") {
      return ". Expected X inactivation is skewed toward the derivative: the der(X) is silenced and the normal X stays active, " +
        "the pattern that leaves the least functional imbalance. That choice exists only while the der(X) keeps its X-inactivation center";
    }
    // An isochromosome of Xp carries no Xq at all, so it cannot hold the Xq13 center and
    // cannot be silenced. Gardner p. 967 on i(Xp): it "would probably always be lethal
    // because there would be a functional Xp trisomy". i(Xq) doubles the arm the center
    // is on and behaves like the other structural abnormals.
    if (k === "iso" && /^p/.test((bpOf(ab) || "q10"))) {
      return ". An isochromosome of Xp carries no Xq, so it has no X-inactivation center and cannot be silenced. " +
        "Functional disomy for Xp is the expected result, which is why this form is far more severe than i(X)(q10)";
    }
    if (k === "iso" || k === "ring" || k === "del") {
      return ". Expected X inactivation is skewed: the structurally abnormal X is silenced and the normal X stays active, " +
        "the pattern that leaves the least functional imbalance. That depends on the abnormal X keeping its X-inactivation center at Xq13" +
        (k === "ring" ? ", and a ring too small to retain one cannot be silenced at all, which is why those cases are affected more severely" : "");
    }
    return "";
  }

  // The sex field carries only the sex chromosomes that are NOT rearranged: ISCN 2024
  // section 5.5.18.1.1 example iii states "the correct designation is 46,X,t(X;13) and
  // not 46,XX,t(X;13)", and the same for 46,Y,t(X;13) in a male. parseSex builds its note
  // from the field alone, before any aberration is known, so a lone X there was read as
  // monosomy X even when a second X is drawn inside the rearrangement. Corrected here
  // rather than in the parser, because only the assembled clone knows what was drawn.
  function sexNote(clone) {
    var xDrawn = (clone.complement && clone.complement.X) || 0;
    if (clone.sex.label === "X" && xDrawn >= 2) {
      return "one X, listed alone because the other X is named in the rearrangement below. This is not monosomy X";
    }
    if (clone.sex.label === "Y" && xDrawn >= 1) {
      return "one Y, listed alone because the X is named in the rearrangement below";
    }
    return clone.sex.note;
  }

  function decode(clone) {
    var rows = [];
    if (clone.modalNumber != null) {
      var range = clone.modalHigh != null;
      // Echo the count field as it was written. Rebuilding it as N~M meant typing 47-49
      // and being shown 47~49, which reads as the app having quietly edited the input, and
      // leaves the reader unsure which mark is the right one. It also dropped a <2n>
      // ploidy note off the chip entirely.
      var code = clone.modalGiven || (range ? (clone.modalNumber + "~" + clone.modalHigh) : String(clone.modalNumber));
      // The tilde advice is NOT repeated here. It began as a sentence in this row, which
      // left the reader to retype the karyotype and did not settle the question it raised:
      // the chip beside it still showed the dash. It lives in the note box instead, where
      // it comes with the tilde version as a one-click alternative.
      var txt = range
        ? "chromosome count varies from " + clone.modalNumber + " to " + clone.modalHigh +
          " across the cells counted (normal is 46)"
        : "total chromosome count" + (clone.modalNumber === 46 ? " (the normal human number)" : " (normal is 46)");
      rows.push({ code: code, text: txt, tag: "count" });
    }
    if (clone.sex.label) {
      rows.push({ code: clone.sex.label, text: "sex chromosomes: " + sexNote(clone), tag: "sex" });
    }
    clone.aberrations.forEach(function (ab) {
      var d = describeAberration(ab);
      var q = ab.qualifier && QUALIFIER_PHRASE[ab.qualifier];
      var body = d.text + (q ? " (" + ab.qualifier + " = " + q + ")" : "") + robNote(ab, clone);
      // The der() descriptions already end in a full stop while the t() ones do not, and
      // xciNote opens with one. Drop a trailing stop before joining rather than teaching
      // every branch above about what might follow it.
      var xci = xciNote(ab, clone);
      if (xci) body = body.replace(/\.\s*$/, "") + xci;
      rows.push({ code: ab.raw, text: body, tag: d.tag });
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
    { test: function (c) { return c.sex.label === "X"; }, name: "Turner syndrome (45,X and variants)",
      note: "Loss of all or part of the second sex chromosome. 45,X (monosomy X) is classic; variants include an isochromosome i(Xq), a ring r(X), an idic(Y), and 45,X mosaicism (e.g. 45,X/46,XX). Short stature, ovarian dysgenesis/streak gonads, webbed neck, coarctation/bicuspid aortic valve, lymphedema." },
    { test: function (c) { return c.sex.label === "XXY" || c.sex.label === "XXXY"; }, name: "Klinefelter syndrome (47,XXY and variants)",
      note: "An extra X in a male (≥1 Y with ≥2 X); 47,XXY is classic, with 48,XXXY and 48,XXYY as higher-grade variants. Tall stature, small firm testes, gynecomastia, infertility, low testosterone. The extra X (or Xs) inactivate as Barr bodies." },
    { test: function (c) { return c.sex.label === "XYY"; }, name: "47,XYY",
      note: "An extra Y. Usually tall stature; typically normal fertility and intelligence within the normal range. Often incidental." },
    { test: function (c) { return c.sex.label === "XXX"; }, name: "47,XXX, Triple X",
      note: "An extra X in a female. Often mild/absent phenotype; tall stature, sometimes learning difficulties. Two Barr bodies." },
    { test: function (c) { return hasT(c, "9", "22"); }, acquired: true, name: "t(9;22), Philadelphia chromosome",
      note: "The reciprocal t(9;22)(q34;q11.2) fuses <i>BCR</i> (22) with <i>ABL1</i> (9), creating <i>BCR::ABL1</i>, the hallmark of chronic myeloid leukemia (also some ALL). Target of imatinib and other tyrosine-kinase inhibitors." },
    { test: function (c) { return hasT(c, "15", "17"); }, acquired: true, name: "t(15;17), Acute promyelocytic leukemia",
      note: "t(15;17)(q24;q21) fuses <i>PML::RARA</i>. APL (formerly FAB AML-M3); responsive to all-trans retinoic acid (ATRA) and arsenic. A medical emergency due to DIC." },
    { test: function (c) { return hasT(c, "8", "14"); }, acquired: true, name: "t(8;14), Burkitt lymphoma",
      note: "t(8;14)(q24;q32) places <i>MYC</i> next to the <i>IGH</i> enhancer → <i>MYC</i> overexpression. Classic 'starry-sky' Burkitt lymphoma." },
    { test: function (c) { return hasT(c, "8", "21"); }, acquired: true, name: "t(8;21), AML",
      note: "t(8;21)(q22;q22) <i>RUNX1::RUNX1T1</i>; a core-binding-factor AML with generally favorable prognosis." },
    { test: function (c) { return hasT(c, "14", "18"); }, acquired: true, name: "t(14;18), Follicular lymphoma",
      note: "t(14;18)(q32;q21) juxtaposes <i>BCL2</i> with <i>IGH</i> → anti-apoptotic <i>BCL2</i> overexpression." },
    { test: function (c) { return hasT(c, "11", "14"); }, acquired: true, name: "t(11;14), Mantle cell lymphoma",
      note: "t(11;14)(q13;q32) juxtaposes <i>CCND1</i> (cyclin D1) with the <i>IGH</i> enhancer → cyclin D1 overexpression driving the cell cycle. Defines mantle cell lymphoma." },
    { test: function (c) { return hasT(c, "12", "21"); }, acquired: true, name: "t(12;21), Childhood B-ALL",
      note: "t(12;21)(p13;q22) fuses <i>ETV6::RUNX1</i> (TEL-AML1), the most common recurrent translocation in childhood B-cell ALL; generally favorable prognosis and often cryptic on banding (needs FISH)." },
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
    SYNDROMES.forEach(function (s) { try { if (s.test(clone)) out.push({ name: s.name, note: s.note, acquired: !!s.acquired }); } catch (e) {} });
    return out;
  }

  var ARM_INFO = {
    p: "The SHORT arm. 'p' is for petit (French for small). Always drawn on TOP. Bands are numbered starting from the centromere (p1…) outward to the telomere.",
    q: "The LONG arm. 'q' simply follows 'p' in the alphabet. Always drawn on the BOTTOM. Bands numbered from the centromere (q1…) out to the telomere.",
    centromere: "The primary constriction that joins the two arms. The kinetochore assembles here and spindle fibers attach during cell division. Its position (metacentric / submetacentric / acrocentric) helps identify a chromosome.",
    telomere: "The very tip of each arm ('ter' = pter / qter). Repetitive TTAGGG caps that protect chromosome ends and shorten with each division.",
    band: "A stretch of chromosome that stains light or dark with Giemsa (G-banding). The reproducible pattern of bands is a chromosome's 'barcode', it is how each one is identified and how breakpoints are pinpointed."
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
    var out = parts.filter(Boolean).join(". ");
    // Speak the cell count when present — the proportions are the point of a mosaic.
    if (clone.cellCount != null) {
      out += (out ? ", " : "") + (clone.composite ? "composite of " : "in ") +
        clone.cellCount + " cell" + (clone.cellCount === 1 ? "" : "s");
    }
    return out;
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
    // The count is reported as written, but when it disagrees with the changes listed
    // the wrong number must not be asserted as fact. This paragraph sits inches from a
    // drawing of the OTHER number, so silently repeating "45 chromosomes" beside a
    // 46-chromosome karyogram is the contradiction, not the fix for it.
    var mism = clone.countWrong && clone.counts && clone.counts.actual != null && clone.modalNumber != null;
    out.push("This result shows " + (clone.modalNumber != null ? clone.modalNumber : "an unusual number of") +
      " chromosomes" + (s ? ", with " + s : "") + "." +
      (mism ? " That is the count as written; the changes listed below add up to " + clone.counts.actual +
        " chromosomes, which is what the diagram shows." : ""));
    if (!clone.aberrations.length) {
      out.push("No changes were seen in the chromosomes with this test.");
    } else {
      out.push(clone.aberrations.length === 1 ? "One change was found:" : "The following changes were found:");
      clone.aberrations.forEach(function (ab) { out.push(plainAb(ab)); });
    }
    return out;
  }

  // ISCN 4.2.1 k, the placement that still draws: a question mark BEFORE the change
  // says the caller is not certain of the identification, while everything needed to
  // draw it is there. The drawing would otherwise present a doubt-free picture of
  // something the report hedged, so the decode carries the hedge.
  function uncertainSuffix(ab) {
    return (ab && ab.uncertain)
      ? ". The question mark says this identification is not certain"
      : "";
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
