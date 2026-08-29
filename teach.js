/* KaryoDraw, teaching layer.
 *
 * Copyright (C) 2026 StudyRare. KaryoDraw is free software: you may
 * redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License, version 3 or later; see LICENSE. If you run a modified
 * version as a network service you must offer its source to your users (AGPL
 * section 13). Commercial licensing: see LICENSING.md.
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
      if (exact) {
        out.position += " It spans " + aboutSize(exact[2] - exact[1]) +
          " (GRCh38 " + (exact[1] / 1e6).toFixed(1) + " to " + (exact[2] / 1e6).toFixed(1) + " Mb).";
      }
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
    stalk: { name: "Acrocentric stalk", bio: "The stalk of an acrocentric short arm (chr 13,14,15,21,22): houses the ribosomal RNA genes (NOR). Losing it is generally harmless." },
    // Centromeric material that rode across a junction because the breakpoint fell inside
    // the centromere band. It is real α-satellite, but it is not this derivative's
    // centromere, so it must not be named one: a chromosome with two centromeres is a
    // dicentric, and ISCN spells that dic(), not der().
    acen_carried: { name: "Pericentromeric heterochromatin", bio: "Centromere-region α-satellite carried across a rearrangement junction, because the breakpoint fell inside the centromere band. This derivative's working centromere is the one from the chromosome it is named for, so this block is not drawn as a centromere. A chromosome that truly keeps two is a dicentric, written dic()." },
    // Not a Giemsa stain: the pseudo-stain the fra gap rect carries so the hover
    // tooltip can say what the constriction is instead of going silent on it.
    fra: { name: "Fragile site (unstained gap)", bio: "An achromatic gap: under replication stress the chromatin at the site decondenses and fails to take up Giemsa, so it is drawn unstained even inside a dark band. The fragment beyond the gap stays attached; this is not a deletion." }
  };
  function stainInfo(s) { return STAIN_INFO[s] || { name: s, bio: "" }; }

  // 13, 14, 15, 21 and 22: the chromosomes whose short arms carry only satellites and
  // ribosomal repeats, which is why a whole-arm fusion between two of them loses nothing
  // that matters (ISCN 5.5.18.3 a).
  var ACRO = { "13": 1, "14": 1, "15": 1, "21": 1, "22": 1 };

  // ---- describe a single aberration in plain English -----------------------
  function bandsPhrase(chrom, bands) {
    return bands.map(function (b) { return chrom + b; }).join(" and ");
  }
  // A segment size in reader units: whole Mb from 10 up, one decimal from 1
  // to 10, kb below. Always prefixed "about", and the "about" is load-bearing:
  // a breakpoint written at a band can sit anywhere within that band, so
  // sizes are measured from band midpoints on GRCh38 (the ideogram's
  // assembly), and the method is stated once on the how-to-read card.
  // Requested by a user: the model always knew every segment's length in bp
  // and the decode never said it.
  function aboutSize(bpLen) {
    if (!(bpLen > 0)) return "";
    if (bpLen >= 1e7) return "about " + Math.round(bpLen / 1e6) + " Mb";
    if (bpLen >= 1e6) return "about " + (Math.round(bpLen / 1e5) / 10) + " Mb";
    return "about " + Math.round(bpLen / 1e3) + " kb";
  }
  function sizeParen(bpLen) { var t = aboutSize(bpLen); return t ? " (" + t + ")" : ""; }
  function midOf(c, b) { var r = window.Karyo && window.Karyo.resolveBand(c, b); return r ? r.mid : null; }
  function sizeBetween(c, b1, b2) {
    var m1 = midOf(c, b1), m2 = midOf(c, b2);
    return m1 != null && m2 != null ? Math.abs(m2 - m1) : 0;
  }
  function sizeDistal(c, b) {
    var m = midOf(c, b), d = IDEO.data[c];
    if (m == null || !d) return 0;
    return /^p/.test(String(b)) ? m : d.length - m;
  }

  // What the band order of an inserted segment encodes (ISCN 5.5.9.1): listed
  // proximal-first the segment keeps its own orientation in its new place;
  // distal-first it sits end-for-end. Read off the band midpoints, the same
  // comparison the renderer uses, so the sentence and the drawing cannot
  // disagree. Silent when a band does not resolve.
  function insOrientPhrase(chrom, segBands) {
    if (!segBands || segBands.length < 2 || !window.Karyo) return "";
    var a = window.Karyo.resolveBand(chrom, segBands[0]), b = window.Karyo.resolveBand(chrom, segBands[1]);
    if (!a || !b || a.mid === b.mid) return "";
    return a.mid > b.mid
      ? ", turned end-for-end (an inverted insertion, said by the band order)"
      : ", where it keeps its own orientation (said by the band order)";
  }
  // Short phrases describing a derivative's make-up (kept part + attached part).
  function throughShort(chrom, band) { return band ? " (out to " + chrom + band + ")" : ""; }
  // The segment from a breakpoint out to the nearer telomere, written the way ISCN
  // writes it in prose (5.5.15 d i: "6p22.2 to 6pter", "6q25.2 to 6qter"). The
  // chromosome number is repeated on the telomere end on purpose: a recombinant names
  // two of these at once and they are both from the same chromosome, so dropping it
  // leaves the reader matching "pter" to whichever number is nearest.
  function distalSeg(chrom, band) {
    return band ? chrom + band + "→" + chrom + (band.charAt(0) === "p" ? "pter" : "qter") : "";
  }
  // The other side of the same break: the piece that runs from the FAR telomere,
  // through the centromere, out to the breakpoint. It is the centric piece, which is
  // what a dicentric keeps, and the direction matches the one ISCN writes in its
  // detailed form: 46,X,idic(Y)(pter→q12::q12→pter) for a break on q, and
  // 46,XX,idic(17)(qter→p11.2::p11.2→qter) for a break on p (5.5.4 f vi and 5.5.11 iv).
  // So a break on the long arm keeps the short arm and starts at pter, and vice versa.
  function centricSeg(chrom, band) {
    if (!band) return "";
    return chrom + (band.charAt(0) === "p" ? "qter" : "pter") + "→" + chrom + band;
  }
  // Size of that piece: the complement of sizeDistal over the whole chromosome.
  function sizeCentric(c, b) {
    var d = IDEO.data[c];
    if (!d) return 0;
    return d.length - sizeDistal(c, b);
  }
  // A breakpoint written AT the centromere (p10, q10, cen) does not divide the
  // chromosome into a centric and an acentric piece (both halves are centric),
  // so "the piece out to the breakpoint" and "everything past the break" have no
  // meaning there. Those cases are whole-arm fusions and are described elsewhere.
  function atCentromere(band) { return /^[pq]10$/.test(String(band || "")) || String(band) === "cen"; }
  function endShort(partner, band) {
    if (!band) return "part of chromosome " + partner;
    return band[0] === "q"
      ? "the end of chromosome " + partner + "’s long arm (" + partner + band + "→qter)"
      : "the end of chromosome " + partner + "’s short arm (pter→" + partner + band + ")";
  }
  // One phrase for an extra del/dup/inv/ins operation inside a der() chain (the
  // t/dic join is described separately, so those return null here). The ins
  // phrase takes the derivative's own chromosome so it can say which side of an
  // interchromosomal insertion this derivative is: the recipient grew, the
  // donor shrank. Before it existed, der(15)ins(15)(p11q23q26) decoded to
  // nothing but the centromere sentence, and a visitor's flag asked what the
  // q23q26 even meant.
  function subOpPhrase(s, derChrom) {
    if (!s || ["del", "dup", "inv", "ins", "add", "hsr"].indexOf(s.op) < 0) return null;
    var sc = (s.chroms || [])[0], g = (s.breakpoints || [])[0] || [], bands = bandsPhrase(sc, g);
    if (s.op === "del") return g.length >= 2 ? "an interstitial deletion between " + bands : "a terminal deletion at " + (bands || ("chromosome " + sc));
    if (s.op === "dup") return "a duplication of the segment between " + bands;
    if (s.op === "inv") return "an inversion between " + bands;
    if (s.op === "add") return "additional material of unknown origin attached at " + sc + (g[0] || "?");
    if (s.op === "hsr") return "an amplified homogeneously staining region (hsr) at " + sc + (g[0] || "?");
    if (s.op === "ins") {
      if ((s.chroms || []).length >= 2) {
        var recip = String(s.chroms[0]), donor = String(s.chroms[1]);
        var segBands = bandsPhrase(donor, s.breakpoints[1] || []);
        var site = recip + (((s.breakpoints[0] || [])[0]) || "?");
        if (String(derChrom) === donor && donor !== recip) {
          return "the loss of its segment between " + segBands + ", inserted into chromosome " + recip + " at " + site;
        }
        return "an inserted segment from chromosome " + donor + " (between " + segBands + ") at " + site +
          insOrientPhrase(donor, s.breakpoints[1] || []);
      }
      var ig = s.breakpoints[0] || [];
      return "an insertion within chromosome " + sc + ": the segment between " + bandsPhrase(sc, ig.slice(1)) +
        " moved to " + sc + (ig[0] || "?") + insOrientPhrase(sc, ig.slice(1));
    }
    return null;
  }
  function describeAberration(ab, clone) {
    var out = describeAberrationBase(ab, clone);
    // Appended once, here, rather than threaded through forty return statements.
    if (out && ab && ab.uncertain) out = { text: out.text + uncertainSuffix(ab), tag: out.tag };
    return out;
  }

  // An isodicentric, in full. The old sentence said the chromosome "breaks at 15q11.2
  // and is duplicated as a mirror image", which leaves the reader's obvious question
  // unanswered: 15q11.2 to WHERE? (Dan, 2026-08-28.) One breakpoint is genuinely the
  // whole story, but only because a convention fills in the rest, and the decode has
  // to say what that convention is:
  //
  //   - WHICH piece is kept. The centric one, always: ISCN's detailed form for
  //     46,X,idic(Y)(q12) is (pter→q12::q12→pter) and for 46,XX,idic(17)(p11.2) it is
  //     (qter→p11.2::p11.2→qter), in 5.5.4 f vi and 5.5.11 iv. A break on the long arm
  //     therefore keeps the short arm, and a break on the short arm keeps the long one.
  //   - IN WHAT ORIENTATION. Mirror images meeting at the breakpoint, not one behind
  //     the other. That is the difference between an isodicentric and a tandem
  //     duplication, and it is the reason there are two centromeres rather than one:
  //     each copy brings its own.
  //   - WHAT IT COSTS. ISCN states the imbalance itself for idic(Y) (5.5.4 f vi: "loss
  //     of the segment Yq12 to Yqter and gain of Ypter to Yq12"), and the arithmetic
  //     splits on the plus sign. Without one the idic REPLACES a homolog (5.5.4 b, "the
  //     chromosome count is unchanged"), so that copy trades its distal material for a
  //     second copy of the centric piece. With one it is supernumerary on top of an
  //     intact pair (5.5.4 f viii, "two chromosomes 13 plus the idic(13)"), so nothing
  //     is lost and the centric piece arrives twice over, the tetrasomy that makes
  //     +idic(15)(q13) the chromosome it is.
  //
  // Copy TOTALS are deliberately not stated. They are right for an autosome and wrong
  // for 46,X,idic(Y)(q12), where there is no second Y to count against, which is
  // presumably why ISCN words its own general statement as gain and loss instead.
  function idicText(c, band, ab) {
    var head = "an ISODICENTRIC chromosome idic(" + c + "): ";
    if (!band || atCentromere(band)) {
      return head + "chromosome " + c + " is joined to a mirror image of itself, so one chromosome carries two centromeres";
    }
    var kept = centricSeg(c, band), lost = distalSeg(c, band);
    // Name the convention, do not just apply it. One breakpoint describes a whole
    // chromosome only because the piece that survives is always the one carrying the
    // centromere, and a reader who does not know that cannot get from "idic(15)(q11.2)"
    // to a segment. ISCN 5.5.3 a states the naming half of it ("the abbreviation always
    // refers to chromosome(s) with the intact centromere"); the reason is cytogenetic
    // rather than notational, and Gardner 5e puts it plainly: "An acentric chromosome is
    // never viable, since it lacks a point of attachment to the spindle fibers."
    var body = "chromosome " + c + " breaks at " + c + band + ". What survives a break is the piece carrying " +
      "the centromere, since a fragment without one cannot hold onto the spindle at cell division, so the piece " +
      "kept here is " + kept + sizeParen(sizeCentric(c, band)) + ", joined to a second copy of itself. The two " +
      "copies meet at the breakpoint as mirror images rather than one behind the other, so each brings its own centromere. ";
    return head + body + (ab && ab.sign === "+"
      ? "It is supernumerary, sitting on top of an intact pair, so nothing is lost: " + kept +
        " simply arrives in two further copies, and " + lost + sizeParen(sizeDistal(c, band)) + " is not on it"
      : "It replaces one copy of chromosome " + c + ", trading everything past the break, " + lost +
        sizeParen(sizeDistal(c, band)) + ", for a second copy of " + kept);
  }

  // A dicentric of two chromosomes. Same gap as the isodicentric above: naming the two
  // breakpoints never said which side of each break survives. It is the centric side of
  // both, joined at the broken ends, and ISCN states the consequence in its own prose
  // for this very example (5.5.4 f ii, 45,XX,dic(13;15)(q22;q24): "The resulting net
  // imbalance of this abnormality is loss of the segments distal to 13q22 and 15q24").
  function dicText(chroms, bp, breaks) {
    var bands = chroms.map(function (cc, i) { return (bp[i] || [])[0]; });
    // dic(15;15) and dic(13;13) name ONE chromosome twice, because the two partners are
    // the two homologues of a pair. ISCN says so where it prints them: 5.5.4 f i,
    // "bands 13q14 and 13q32 on the two homologous chromosomes 13", and f ix, "the
    // chromosome number is given before pter and the breakpoint ... as different
    // chromosome 15 homologues are involved". Reading the list straight out gave
    // "chromosomes 15 and 15 break (at 15q12 and 15q12)", which names a pair as though
    // it were two different chromosomes and then says everything twice.
    var homologs = chroms.length === 2 && String(chroms[0]) === String(chroms[1]);
    var sameBand = homologs && String(bands[0]) === String(bands[1]);
    var head = "a DICENTRIC chromosome: " + (homologs
      ? (sameBand ? "both homologues of chromosome " + chroms[0] + " break at " + breaks[0]
        : "the two homologues of chromosome " + chroms[0] + " break (at " + listJoin(breaks) + ")")
      : "chromosomes " + listJoin(chroms) + " break (at " + listJoin(breaks) + ")") +
      " and fuse into a single chromosome that carries two centromeres";
    // Silent when either break sits at a centromere: both halves are centric there, so
    // there is no distal piece to name. Those are whole-arm fusions, described as such.
    if (bands.some(function (b) { return !b || atCentromere(b); })) return head;
    var keep = function (i) { return centricSeg(chroms[i], bands[i]) + sizeParen(sizeCentric(chroms[i], bands[i])); };
    var loss = function (i) { return distalSeg(chroms[i], bands[i]) + sizeParen(sizeDistal(chroms[i], bands[i])); };
    var keeps = sameBand ? keep(0) : listJoin(chroms.map(function (cc, i) { return keep(i); }));
    var losses = sameBand ? loss(0) : listJoin(chroms.map(function (cc, i) { return loss(i); }));
    return head + ". Each keeps the centromere side of its break, " + keeps +
      ", and the two broken ends are joined to each other. Everything past the breaks, " + losses + ", is lost";
  }

  function describeAberrationBase(ab, clone) {
    var k = ab.kind, c = ab.chroms[0], bp = ab.breakpoints, mult = ab.multiplier || 1;
    if (k === "idem") {
      var refName = ab.ref === "sdl" ? "the sideline (the clone before it)" : "the stemline (the first clone)";
      return { text: "the SAME changes as " + refName + ". This subclone carries all of them, plus whatever is listed next (clonal evolution)", tag: "count" };
    }
    if (k === "hsr") return { text: "a HOMOGENEOUSLY STAINING REGION on chromosome " + c + " at " + c + ((bp[0] || [])[0] || "?") + ": a block of amplified DNA (many extra copies of a gene, e.g. an oncogene) built into the chromosome", tag: "add" };
    if (k === "dmin") return { text: "DOUBLE MINUTES: small extra circles of amplified DNA floating outside the chromosomes (acentric, so not counted in the chromosome number). A hallmark of oncogene amplification", tag: "add" };
    if (k === "gain" || k === "loss") {
      // The parenthetical is a copy-number claim, so it states the count the
      // FIGURE draws, read off the clone's own slots. The canned diploid slogans
      // said "trisomy 1" beside a triploid figure drawing five copies, "monosomy
      // Y" for a male whose only Y is gone, and "trisomy X" for an XY cell
      // gaining a second X. Trisomy and tetrasomy are named only when the drawn
      // count is exactly that on a diploid autosome; a derivative carrying more
      // of the chromosome is pointed at rather than silently folded in.
      var head = k === "gain"
        ? (mult > 1 ? mult + " EXTRA copies of chromosome " + c : "an EXTRA copy of chromosome " + c)
        : (mult > 1 ? "LOSS of " + mult + " copies of chromosome " + c : "LOSS of one chromosome " + c);
      var slotList = clone && clone.slots ? clone.slots[String(c)] : null;
      if (!slotList) return { text: head, tag: k };
      var whole = slotList.filter(function (i) { return i.kind === "normal" || i.kind === "gain"; }).length;
      var riders = slotList.filter(function (i) { return ["normal", "gain", "missing"].indexOf(i.kind) < 0; })
        .map(function (i) { return i.label; });
      var basePloidy = clone.ploidy || 2;
      var SOMY = { 3: "trisomy", 4: "tetrasomy", 5: "pentasomy" };
      var isSex = c === "X" || c === "Y";
      var paren;
      if (whole === 0) paren = "no copy of " + c + " remains in this cell line";
      else if (basePloidy === 2 && !riders.length && !isSex && k === "gain" && SOMY[whole])
        paren = numberWord(whole) + " copies = " + SOMY[whole] + " " + c;
      else if (basePloidy === 2 && !riders.length && !isSex && k === "loss" && whole === 1)
        paren = "one copy = monosomy " + c;
      else {
        paren = numberWord(whole) + (whole === 1 ? " copy" : " copies") + " in this cell line";
        if (basePloidy > 2) paren += ", against a baseline of " + numberWord(basePloidy);
        if (riders.length) paren += ", with more " + c + " material on " + listJoin(riders);
      }
      return { text: head + " (" + paren + ")", tag: k };
    }
    if (k === "del") {
      var b0 = (bp[0] || []);
      if (b0.length >= 2) return { text: "an interstitial DELETION in chromosome " + c + ": the segment between " + bandsPhrase(c, b0) + sizeParen(sizeBetween(c, b0[0], b0[1])) + " is missing", tag: "del" };
      return { text: "a terminal DELETION of chromosome " + c + ": everything distal to " + c + (b0[0] || "?") + " (out to the tip) is lost" + sizeParen(sizeDistal(c, b0[0])), tag: "del" };
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
        ": the segment " + bandsPhrase(c, dbp0) + (dbp0.length >= 2 ? sizeParen(sizeBetween(c, dbp0[0], dbp0[1])) : "") + " is present twice" +
        (invDup ? ", with the extra copy flipped end-for-end" : ""), tag: "dup" };
    }
    if (k === "inv") {
      var arms = (bp[0] || []).map(function (b) { return b[0]; });
      var peri = arms.indexOf("p") >= 0 && arms.indexOf("q") >= 0;
      var ivb = bp[0] || [];
      return { text: "an INVERSION in chromosome " + c + ": the segment between " + bandsPhrase(c, ivb) + (ivb.length >= 2 ? sizeParen(sizeBetween(c, ivb[0], ivb[1])) : "") + " is flipped end-for-end (" + (peri ? "pericentric, it spans the centromere" : "paracentric, within one arm") + ")", tag: "inv" };
    }
    if (k === "t" || k === "dic") {
      var chroms = ab.chroms, n = chroms.length;
      var breaks = chroms.map(function (cc, i) { return cc + ((bp[i] || [])[0] || ""); });
      var ders = chroms.map(function (cc) { return "der(" + cc + ")"; });
      var nWord = DIGIT_WORDS[n] || String(n);
      if (k === "dic") {
        if (n < 2) return { text: idicText(chroms[0], (bp[0] || [])[0], ab), tag: "t" };
        return { text: dicText(chroms, bp, breaks), tag: "t" };
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
      // Each derivative keeps its OWN centric piece and takes on the partner's acentric
      // tip. Saying so is what makes the der() names mean something: ISCN 5.5.3 a, "the
      // abbreviation always refers to chromosome(s) with the intact centromere". It is
      // also the same rule the isodicentric decode states, and naming it in both places
      // is deliberate: the two are easy to read as opposites (a t looks like it moves
      // material away, an idic like it keeps material), when in fact the piece with the
      // centromere survives in both and only the fate of the acentric tip differs.
      // Between the two HOMOLOGS of one pair (t(3;3)(q21.3;q26.2), the MECOM
      // rearrangement): same mechanics, but "chromosomes 3 and 3" reads like a
      // stutter and the der names need saying differently.
      if (chroms.length === 2 && String(chroms[0]) === String(chroms[1])) {
        return { text: "a TRANSLOCATION between the two HOMOLOGOUS chromosomes " + chroms[0] +
          ": one breaks at " + chroms[0] + (bp[0] || [])[0] + " and the other at " + chroms[0] + (bp[1] || [])[0] +
          ", and they swap the pieces beyond those breaks, giving two different derivative chromosomes " + chroms[0] +
          ". The pieces that move are the tips, which carry no centromere; each derivative keeps its own centromere", tag: "t" };
      }
      return { text: "a reciprocal TRANSLOCATION: chromosomes " + listJoin(chroms) + " break (at " + listJoin(breaks) +
        ") and swap the pieces beyond those breaks, giving two derivative chromosomes " + listJoin(ders) +
        ". The pieces that move are the tips, which carry no centromere; each derivative keeps the centromere it " +
        "started with, and that is the chromosome it is named for", tag: "t" };
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
      // Gated on the SHAPE, not on which of the two legal spellings was typed. It used
      // to key on ab.note carrying "Robertsonian", which only rob() sets, so
      // rob(13;14)(q10;q10) got this explanation and der(13;14)(q10;q10), the identical
      // biological event, got the one-line "has chromosome 13's centromere" instead.
      // That is backwards twice over: the same karyotype taught two different amounts,
      // and it was the spelling ISCN PREFERS that got less. 5.5.18.3 b: "Although either
      // rob or der can adequately describe these whole-arm translocations, der is the
      // preferred designation."
      //
      // Acrocentrics only, both of them, and both breaks at a centromere. A whole-arm
      // der between non-acrocentrics (5.5.18.2) loses real short-arm material and is a
      // different event, so it must not collect this sentence.
      var wholeArmBands = (bp || []).length >= 2 && (bp || []).every(function (g) {
        return (g || []).length === 1 && (/^[pq]10$/.test(g[0]) || g[0] === "cen");
      });
      var acroPair = (ab.chroms || []).length === 2 &&
        ab.chroms.every(function (x) { return ACRO[String(x)]; });
      // A whole-arm der(A;B) can carry trailing sub-ops (ISCN 5.5.3 c iv:
      // der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)). The body is the two fused
      // arms; each deletion or join then modifies one arm, and the figure draws
      // exactly that. The texts below this branch each told a different lie beside
      // it: the Robertsonian sentence ignored the sub-ops entirely, and the general
      // der sentence read the first join as if the body were one chromosome "out to"
      // the join's band, the monocentric misreading the renderer no longer draws.
      // Also fires with NO sub-ops when the pair is not the pure q10;q10
      // acrocentric fusion (that one keeps its own Robertsonian sentence
      // below): the second-pass review (2026-08-29) found the bare
      // der(1;7)(q10;p10) falling through to the generic one-liner, which
      // never mentioned the chromosome 7 material the figure paints, the
      // fusion, or the cost.
      var waPureRob = acroPair && (bp || []).every(function (g) {
        return (g[0] || "") === "q10" || g[0] === "cen";
      });
      if (wholeArmBands && (ab.chroms || []).length === 2 && ((ab.subOps || []).length || !waPureRob)) {
        var waArm = function (ix) { return /^p/.test(String(((bp || [])[ix] || [])[0] || "")) ? "short" : "long"; };
        var waSame = String(ab.chroms[0]) === String(ab.chroms[1]);
        var waBody = waSame
          ? "the two " + waArm(0) + " arms of chromosome " + ab.chroms[0] + ", one from each homologue, are fused at the centromere into one derivative chromosome"
          : "the " + waArm(0) + " arm of chromosome " + ab.chroms[0] + " and the " + waArm(1) + " arm of chromosome " + ab.chroms[1] + " are fused at the centromere into one derivative chromosome";
        var waOpen = (acroPair && (ab.subOps || []).length ? "a ROBERTSONIAN translocation with more on it: " : "a WHOLE-ARM translocation derivative: ") + waBody +
          "; fusions like this are usually dicentric, with one centromere inactivated.";
        var waBodySet = {};
        waBodySet[String(ab.chroms[0])] = 1; waBodySet[String(ab.chroms[1])] = 1;
        var waJoins = [], waExtras = [];
        (ab.subOps || []).forEach(function (s) {
          if (s.op === "t" && (s.chroms || []).length === 2) {
            var h = waBodySet[String(s.chroms[0])] ? 0 : 1;
            var host = String(s.chroms[h]), guest = String(s.chroms[1 - h]);
            var hostBand = (s.breakpoints[h] || [])[0] || "?", guestBand = (s.breakpoints[1 - h] || [])[0] || "?";
            waJoins.push((waSame ? "One arm" : "The chromosome " + host + " arm") + " is cut at " + host + hostBand +
              " and " + endShort(guest, guestBand) + sizeParen(sizeDistal(guest, guestBand)) + " is attached there.");
            waBodySet[guest] = 1;
          } else {
            var wp = subOpPhrase(s, ab.chroms[0]);
            if (wp) waExtras.push(wp);
          }
        });
        var waExtraText = waExtras.length
          ? " It also carries " + listJoin(waExtras) + (waSame && waJoins.length ? ", on the other arm." : ".")
          : "";
        // What the fusion costs. The description used to stop at the composition,
        // stating no imbalance at all; the arms the centromere letters do NOT name
        // are gone from this derivative, and when exactly one normal homolog of
        // each partner remains in this clone, that is a partial monosomy worth
        // stating outright.
        var waLost = "";
        if (!waSame) {
          var waArmNot = function (ix) { return waArm(ix) === "long" ? "p" : "q"; };
          var waLostNames = String(ab.chroms[0]) + waArmNot(0) + " and " + String(ab.chroms[1]) + waArmNot(1);
          waLost = " The " + waLostNames + " arms are not part of this derivative.";
          if (clone && clone.slots && (clone.ploidy || 2) === 2) {
            var waN0 = (clone.slots[String(ab.chroms[0])] || []).filter(function (i) { return i.kind === "normal"; }).length;
            var waN1 = (clone.slots[String(ab.chroms[1])] || []).filter(function (i) { return i.kind === "normal"; }).length;
            if (waN0 === 1 && waN1 === 1) {
              waLost = " With one normal " + ab.chroms[0] + " and one normal " + ab.chroms[1] +
                " remaining, the cell is partially monosomic for the lost arms (" + waLostNames + ").";
            }
          }
        }
        return { text: waOpen + (waJoins.length ? " " + waJoins.join(" ") : "") + waExtraText + waLost, tag: "der" };
      }
      if (ab.chroms && ab.chroms.length >= 2 &&
        (/robertsonian/i.test(ab.note || "") || (wholeArmBands && acroPair))) {
        return { text: "a ROBERTSONIAN translocation: the long arms of chromosomes " +
          listJoin(ab.chroms) + " are fused at the centromere into one derivative chromosome, and the two short arms are lost. " +
          "They are written lowest-number-first by convention, not by which centromere is kept; whole-arm fusions like this are usually dicentric, with one centromere inactivated" +
          (/robertsonian/i.test(ab.note || "") ? "" :
            ". ISCN writes this either way, der(" + ab.chroms.join(";") + ")(q10;q10) or rob(" +
            ab.chroms.join(";") + ")(q10;q10), and prefers the der spelling"), tag: "der" };
      }
      var subs = ab.subOps || [];
      // A der() NAMED across two chromosomes and built from joins carries both of their
      // centromeres, which is what the name records (ISCN 5.4.3.1 b) and what the figure
      // now draws since #226. Saying "has chromosome 5's centromere" beside a body with
      // two hatched constrictions and a der(5;7) caption is the prose contradicting the
      // picture, the same way it did for the chain in #224.
      //
      // Scoped to the join-built form on purpose. A whole-arm der(13;21)(q10;q10) also
      // names two chromosomes, but its two centromeres meet AT the fusion point, so the
      // figure draws a single seam constriction there rather than two waists (the
      // renderer's cenIsSeam path) and the honest reading is the Robertsonian note's
      // more careful "usually dicentric, with one centromere inactivated". Note the
      // model flags both whole arms hasCen (#207), so the count in the segment list is
      // not the number of constrictions on screen; that is exactly why this is keyed on
      // the shape of the notation and not on a centromere tally.
      var namedPair = (ab.chroms || []).length > 1 &&
        subs.some(function (s) { return s.op === "t" && (s.chroms || []).length >= 2; });
      var base = namedPair
        ? "an abnormal (“derivative”) chromosome that carries the centromeres of BOTH chromosome " +
          ab.chroms[0] + " and chromosome " + ab.chroms[1] + ", which makes it dicentric"
        : "an abnormal (“derivative”) chromosome that has chromosome " + c + "’s centromere";
      var td = subs.filter(function (s) { return s.op === "t"; })[0];
      // The der can also carry del/dup/inv/ins on its own chromosome (a chain
      // like der(9)del(9)(p12)t(9;22)); the renderer draws them, so name them
      // here too. "also" only when a join sentence precedes.
      var extras = subs.map(function (s) { return subOpPhrase(s, c); }).filter(Boolean);
      var extraText = extras.length ? " It " + (td ? "also " : "") + "carries " + listJoin(extras) + "." : "";
      // A der() can be built from a CHAIN of joins, and the prose used to describe the
      // first and stop. der(1)t(1;3)(p32;q21)t(1;11)(q25;q13) read as "chromosome 1 out
      // to 1p32 with the end of chromosome 3's long arm attached", never mentioning
      // chromosome 11 at all, while the figure drew it (#223). A decode that omits a
      // whole chromosome the picture shows is the two contradicting each other.
      //
      // A chain is described as its joins, band to band, rather than as segment
      // extents. That is exactly what the notation states and it stays true for both
      // shapes a chain takes: a second join on the derivative's own chromosome
      // (t(1;3) then t(1;11)) and a second join on the graft (t(1;3) then t(3;7)),
      // where "the end of chromosome 3's long arm" would be wrong because the 3 piece
      // is bounded at both ends.
      var joins = subs.filter(function (s) { return s.op === "t" && (s.chroms || []).length >= 2; });
      if (joins.length > 1) {
        var pieces = {}, pairs = [];
        joins.forEach(function (j) {
          var a = String(j.chroms[0]), b = String(j.chroms[1]);
          var ba = (j.breakpoints[0] || [])[0] || "?", bb = (j.breakpoints[1] || [])[0] || "?";
          pieces[a] = 1; pieces[b] = 1;
          pairs.push(a + ba + " to " + b + bb);
        });
        pieces[String(c)] = 1;
        var from = Object.keys(pieces).sort(function (x, y) {
          var nx = +x, ny = +y;
          return (isNaN(nx) || isNaN(ny)) ? String(x).localeCompare(String(y)) : nx - ny;
        });
        return { text: base + ". It is built from " + (DIGIT_WORDS[joins.length] || joins.length) +
          " joins, " + listJoin(pairs) + ", so it carries material from chromosomes " +
          listJoin(from) + "." + extraText, tag: "der" };
      }
      if (td && td.chroms.length >= 2) {
        var di = td.chroms.indexOf(c); if (di < 0) di = 0;
        var partner = td.chroms[1 - di];
        var bpDer = (td.breakpoints[di] || [])[0], bpPar = (td.breakpoints[1 - di] || [])[0];
        return { text: base + ". This is chromosome " + c + throughShort(c, bpDer) + " with " + endShort(partner, bpPar) + sizeParen(sizeDistal(partner, bpPar)) + " attached." + extraText, tag: "der" };
      }
      return { text: base + "." + extraText, tag: "der" };
    }
    if (k === "ins") {
      var ic = ab.chroms;
      if (ic.length >= 2) {
        return { text: "an INSERTION: the segment between " + bandsPhrase(ic[1], bp[1] || []) + sizeParen(sizeBetween(ic[1], (bp[1] || [])[0], (bp[1] || [])[1])) + " of chromosome " + ic[1] +
          " is moved into chromosome " + ic[0] + " at " + ic[0] + ((bp[0] || [])[0] || "?") + insOrientPhrase(ic[1], bp[1] || []) +
          ". Chromosome " + ic[0] + " grows by that piece; chromosome " + ic[1] + " loses it.", tag: "add" };
      }
      var ig = bp[0] || [];
      return { text: "an INSERTION within chromosome " + c + ": the segment between " + bandsPhrase(c, ig.slice(1)) + sizeParen(sizeBetween(c, ig[1], ig[2])) +
        " is moved to a new position (at " + c + (ig[0] || "?") + ")" + insOrientPhrase(c, ig.slice(1)) +
        ". Nothing is gained or lost overall.", tag: "add" };
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
    if (k === "trp") { var tb = bp[0] || []; return { text: "a TRIPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, tb) + (tb.length >= 2 ? sizeParen(sizeBetween(c, tb[0], tb[1])) : "") + " is present three times", tag: "dup" }; }
    if (k === "rec") {
      // The one aberration whose written form states half of what it is. ISCN 5.4.3.2 c:
      // "In a recombinant chromosome (rec) there is a duplication and deletion of
      // material. In the ISCN description the duplication (dup) is explicitly stated,
      // and the deletion is inferred." A reader shown only the dup has been shown the
      // half that is not driving the phenotype, so both segments get named here and the
      // sentence says outright which one the notation left out.
      //
      // The other thing worth saying is HOW the child has a chromosome the parent
      // does not: it is inherited, and yet it first exists in the gamete, because
      // the crossover that builds it happens during the parent's meiosis. An earlier
      // wording ("this chromosome is not the parent's chromosome") stated only the
      // second half and read as denying the first; Dan parsed it as contradicting
      // the dmat row below it. Both facts now sit in one sentence. That distinction
      // is the entire reason ISCN spells the qualifier dmat rather than mat (4.2.1 g).
      var recInv = (ab.recInvBands || []).join("");
      return { text: "a RECOMBINANT chromosome rec(" + c + "): what a carrier of the pericentric inversion inv(" +
        c + ")(" + recInv + ") passes on when a crossover falls inside the inversion loop at meiosis I. " +
        "It carries " + distalSeg(c, ab.recDupBand) + sizeParen(sizeDistal(c, ab.recDupBand)) + " twice and is missing " + distalSeg(c, ab.recDelBand) + sizeParen(sizeDistal(c, ab.recDelBand)) +
        ", so it is unbalanced: a duplication of the segment beyond one breakpoint and a deletion of the segment beyond the other. " +
        "The notation states only the duplication, dup(" + c + ab.recDupArm +
        "); the deletion is inferred from the inversion rather than written. " +
        "The recombinant IS inherited from the carrier parent, yet no body cell of that parent contains it: " +
        "it first exists in the egg or sperm the crossover made, so ISCN marks it as derived from the parental " +
        "rearrangement rather than simply inherited. The parent, carrying the balanced inversion, is " +
        "typically unaffected", tag: "rec" };
    }
    if (k === "fra") {
      // A fragile site is a gap, not a break: the chromosome stays one piece and the
      // fragment beyond the gap stays attached, which is what separates fra from del
      // on the page and in the drawing. ISCN 2.6.2 is the normal-variant case and
      // 5.5.7 the disease-associated one; the notation is identical for both, so the
      // decode has to name which one this band is rather than leave the reader to guess.
      var fband = c + ((bp[0] || [])[0] || "?");
      var fbase = "a FRAGILE SITE at " + fband +
        " (fra): a gap that appears at this band when the cells are cultured under stress. " +
        "It is not a deletion, and the piece beyond the gap stays attached";
      if (fband === "Xq27.3") {
        return { text: fbase + ". Xq27.3 is FRAXA, the site that gave fragile X syndrome its name", tag: "fra" };
      }
      return { text: fbase + ". Most fragile sites are harmless normal variants", tag: "fra" };
    }
    return { text: "an aberration (" + (ab.raw || k) + ") that KaryoDraw drew as best it could", tag: "unknown" };
  }

  // Inheritance / origin suffixes on an aberration (c / mat / pat / dn). The parser
  // records these; spell out what each means so a learner sees it in the decode.
  // The short label ("maternal in origin") is the parser's, reused here so the two
  // never drift; teach.js only adds the plain-language explanation after the colon.
  //
  // The d- forms (ISCN 4.2.1 g) are not longer spellings of mat and pat, and reading
  // them as such loses the fact they exist to carry: only PART of the parent's
  // rearrangement was passed on, so the parent's balanced chromosome and the child's
  // unbalanced one are different chromosomes. That is the difference between a healthy
  // carrier and an affected child, and it is the whole reason rec is written dmat.
  var QUALIFIER_EXPLAIN = {
    dn: "a new change, not inherited from either parent",
    mat: "inherited from the mother",
    pat: "inherited from the father",
    c: "present in every cell from birth, not acquired",
    inh: "inherited from a parent, without saying which one",
    dmat: "only this part of a rearrangement the mother carries was passed on, so her chromosome and this one are not the same",
    dpat: "only this part of a rearrangement the father carries was passed on, so his chromosome and this one are not the same",
    dinh: "only this part of a rearrangement a parent carries was passed on, without saying which parent",
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
  // A lone derivative from a reciprocal translocation implies an imbalance the
  // notation never writes down, the der's version of the rec's inferred
  // deletion (5.4.3.2 c). 46,XX,der(8)t(4;8)(p16.1;p23.1) means the reciprocal
  // der(4) is NOT here: with two intact 4s beside it, the attached 4p segment
  // is present three times and the replaced 8p segment once. Dan looked at the
  // figure and asked "where is the swap?", which is exactly the question this
  // note answers. It speaks only in the textbook count situation (two intact
  // partners, this der beside one normal homolog, no reciprocal der in the
  // clone); anywhere else the arithmetic differs and a wrong dosage claim
  // would be worse than silence.
  function loneDerNote(ab, clone) {
    if (!ab || ab.kind !== "der" || ab.wholeArmAcro) return "";
    var tds = (ab.subOps || []).filter(function (s) { return s.op === "t"; });
    // Only for a derivative with ONE join. The arithmetic below counts exactly one
    // gained piece and one lost piece, which is right for a lone reciprocal product and
    // false for a chain: on der(1)t(1;3)(p32;q21)t(1;11)(q25;q13) it announced partial
    // trisomy for 3q21->3qter and partial monosomy for 1p32->1pter while saying nothing
    // about the 1q25->1qter that is also missing or the chromosome 11 that is also
    // there. A confident dosage claim that omits half the imbalance is worse than none.
    if (tds.length !== 1) return "";
    // Same reasoning one level down. The sentence names one gain and one loss and reads
    // as the whole imbalance, so any OTHER sub-op that changes dosage makes it
    // incomplete: der(9)del(9)(p12)t(9;22)(q34;q11.2) announced trisomy 22q11.2->qter
    // and monosomy 9q34->qter while saying nothing about the 9pter->9p12 its own
    // deletion removed. An inversion is balanced and does not disturb the count, so it
    // is the one companion that leaves the arithmetic true.
    var dosage = (ab.subOps || []).filter(function (s) {
      return ["del", "dup", "trp", "add", "hsr", "ins", "dic"].indexOf(s.op) >= 0;
    });
    if (dosage.length) return "";
    var td = tds[0];
    if (!td || !td.chroms || td.chroms.length !== 2) return "";
    var c = String(ab.chroms[0]);
    var di = td.chroms.map(String).indexOf(c); if (di < 0) return "";
    var partner = String(td.chroms[1 - di]);
    if (partner === c) return "";
    var bpDer = (td.breakpoints[di] || [])[0], bpPar = (td.breakpoints[1 - di] || [])[0];
    if (!bpDer || !bpPar || /\?/.test(String(bpDer) + String(bpPar))) return "";
    var hasPartnerDer = (clone.aberrations || []).some(function (a) {
      return a !== ab && a.kind === "der" && String((a.chroms || [])[0]) === partner;
    });
    if (hasPartnerDer) return "";
    // Dosage was computed per derivative in isolation: der(11)t(11;14) announced
    // 14q32->qter "present in three copies" while der(8)t(8;14) in the same clone
    // carries the same distal 14 material, so the figure draws it four times. When
    // the partner rides any OTHER rearranged chromosome the numeric claim is
    // withheld and the reader is pointed at the figure, which carries each piece
    // where it sits.
    var partnerElsewhere = (clone.aberrations || []).some(function (a) {
      if (a === ab) return false;
      var names = (a.chroms || []).map(String);
      (a.subOps || []).forEach(function (s) { names = names.concat((s.chroms || []).map(String)); });
      return names.indexOf(partner) >= 0;
    });
    if (partnerElsewhere) {
      return " Chromosome " + partner + " material rides more than one derivative in this karyotype, so no " +
        "single line's dosage tells the whole story; the figure carries each piece where it sits.";
    }
    var pSlot = (clone.slots || {})[partner] || [], cSlot = (clone.slots || {})[c] || [];
    if (pSlot.length !== 2 || !pSlot.every(function (i) { return i.kind === "normal"; })) return "";
    if (cSlot.length !== 2 || cSlot.filter(function (i) { return i.kind === "normal"; }).length !== 1) return "";
    // Constitutional counseling stays out of acquired clones: a t(9;22) stemline
    // evolving a der(16) is clonal evolution, not inheritance, and "the usual
    // origin is a parent who carries the balanced t" beside it was wrong twice
    // over. Acquired context is read off the clone the way ISCN writes it: an
    // sl/idem lineage or a composite.
    var acquired = clone.composite || (clone.aberrations || []).some(function (a) { return a.kind === "idem"; });
    var origin = (ab.qualifier === "dn" || acquired) ? "" :
      " The usual origin is a parent who carries the balanced t(" + td.chroms.join(";") + "), with only this product passed on.";
    return " Only this derivative is present: the reciprocal der(" + partner + ") with the swapped pieces is not in " +
      "this karyotype, and both chromosome " + partner + "s are intact. So the result is unbalanced: " +
      distalSeg(partner, bpPar) + sizeParen(sizeDistal(partner, bpPar)) + " is present in three copies (partial trisomy) and " + distalSeg(c, bpDer) +
      sizeParen(sizeDistal(c, bpDer)) + " in one (partial monosomy)." + origin;
  }

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
  // Exported, because the print sheet was reading clone.sex.note straight off the
  // parser and so said "a single X (monosomy X)" about a karyotype the screen beside
  // it correctly called a female. The sheet is the copy that travels.
  function sexNote(clone) {
    var xDrawn = (clone.complement && clone.complement.X) || 0;
    var yDrawn = (clone.complement && clone.complement.Y) || 0;
    if (clone.sex.label === "X" && xDrawn >= 2) {
      return "one X, listed alone because the other X is named in the rearrangement below. This is not monosomy X";
    }
    // The same rule with a Y-derived rearrangement (idic(Y), r(Y)): the second
    // sex slot is drawn, so a lone X in the field is not monosomy X here
    // either. The second-pass review caught the hedge firing only for X-derived
    // elements.
    if (clone.sex.label === "X" && yDrawn >= 1) {
      return "one X, listed alone because the Y is named in the rearrangement below. This is not monosomy X";
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
      // The baseline the changes are scored against, when it is not the diploid 46:
      // a stated <3n>, an inferred near-triploid, or a count near a clean multiple.
      // Without this the token list cannot be reconciled with the count or with the
      // homolog counts the figure draws.
      var statedN = /<(\d+)n>/i.exec(clone.modalGiven || "");
      var PLOIDY_WORD = { 1: "haploid", 3: "triploid", 4: "tetraploid" };
      if (statedN && +statedN[1] === 2) {
        txt += "; <2n> says the changes are scored against the normal diploid baseline of 46, even this far from it";
      } else if (statedN) {
        txt += "; <" + statedN[1] + "n> sets a " + (PLOIDY_WORD[+statedN[1]] || statedN[1] + "n") +
          " baseline of " + (+statedN[1] * 23) + " chromosomes (" + numberWord(+statedN[1]) +
          " copies of each), and every gain and loss is scored against that";
      } else if (clone.inferredPloidy) {
        txt += "; a count this size fits a near-" + (PLOIDY_WORD[clone.inferredPloidy] || clone.inferredPloidy + "n") +
          " clone, so the changes are scored against a baseline of " + (clone.inferredPloidy * 23);
      } else if (clone.ploidy && clone.ploidy !== 2) {
        txt += "; a count near " + (clone.ploidy * 23) + " reads as " +
          (PLOIDY_WORD[clone.ploidy] || clone.ploidy + "n") + ", " + numberWord(clone.ploidy) +
          " copies of each chromosome";
      }
      rows.push({ code: code, text: txt, tag: "count" });
    }
    if (clone.sex.label) {
      rows.push({ code: clone.sex.label, text: "sex chromosomes: " + sexNote(clone), tag: "sex" });
    } else if (clone.sex.omitted) {
      // Absence is the notation here, so it needs a row of its own. Without one the
      // reader is left to wonder whether the sex was forgotten or the app lost it.
      rows.push({ code: "(omitted)", tag: "sex",
        text: "sex chromosomes: no field, because both are named in the rearrangement below. " +
          "ISCN writes 46,t(X;Y)(q22;q11.23) rather than repeating the X and Y in front of it" });
    }
    clone.aberrations.forEach(function (ab) {
      var d = describeAberration(ab, clone);
      var q = ab.qualifier && QUALIFIER_PHRASE[ab.qualifier];
      var body = d.text + robNote(ab, clone) + loneDerNote(ab, clone);
      // The der() descriptions already end in a full stop while the t() ones do not, and
      // xciNote opens with one. Drop a trailing stop before joining rather than teaching
      // every branch above about what might follow it.
      var xci = xciNote(ab, clone);
      if (xci) body = body.replace(/\.\s*$/, "") + xci;
      // The qualifier is its own ISCN element (4.2.1 g), a suffix saying where the
      // rearrangement came from rather than part of the rearrangement, so it decodes on
      // its own row like the count and sex fields do. It used to ride in a parenthesis at
      // the end of the aberration's paragraph, which on rec() meant four more lines of
      // prose after ten, and buried the fact that decides the counseling: the child's
      // chromosome is NOT the balanced parent's chromosome. The aberration's own chip
      // sheds the suffix at the same time, so exactly one row claims it.
      rows.push({ code: q ? ab.raw.slice(0, ab.raw.length - ab.qualifier.length) : ab.raw, text: body, tag: d.tag });
      if (q) rows.push({ code: ab.qualifier, text: q, tag: "qual" });
    });
    if (clone.cellCount != null) {
      rows.push({ code: "[" + (clone.composite ? "cp" : "") + clone.cellCount + "]", text: (clone.composite ? "composite of " : "seen in ") + clone.cellCount + " cell" + (clone.cellCount === 1 ? "" : "s") + " counted for this clone", tag: "cells" });
    }
    return rows;
  }

  // ---- how many sex chromosomes are actually there --------------------------
  // The matchers below used to read clone.sex.label, the sex FIELD as written. ISCN
  // 5.5.18.1.1 iii moves a rearranged sex chromosome out of that field and into the
  // aberration list, so the field cannot say how many X a clone carries, and every
  // one of ISCN's own fragile-site examples was read wrong: 46,X,fra(X)(q27.3) is "a
  // female" (5.5.7 a i) and was labelled Turner syndrome, while 45,fra(X)(q27.3) ("an
  // individual with Turner syndrome", a iii) and 47,XY,fra(X)(q27.3) ("Klinefelter
  // syndrome", a iv) matched nothing at all. clone.complement already counts a
  // rearranged X as an X; sexNote() above corrected the same misreading for the
  // decode row and left these untouched. Read the complement here too.

  // Turner syndrome is loss of all or PART of the second sex chromosome, so a
  // 46-count variant turns on whether the second one lost material: i(X)(q10) has no
  // Xp, r(X) lost both tips, idic(Y) lost distal Yq. A fragile site, a balanced
  // reciprocal translocation, or an inversion leaves the dosage whole and is not Turner.
  var LOSSY = { del: 1, ring: 1, iso: 1, dic: 1, add: 1, der: 1, rec: 1 };
  function lossOn(clone, chrom) {
    return (clone.aberrations || []).some(function (ab) {
      return LOSSY[ab.kind] && (ab.chroms || []).indexOf(chrom) >= 0;
    });
  }

  // Diploid only. 69,XXX is euploid for triploidy, not Triple X, and it was being
  // reported as Down, Edwards, Patau and Triple X at once because every matcher
  // counted copies without asking how many a full set is for this clone.
  function sexCall(clone) {
    if (clone.ploidy !== 2) return "";
    var x = clone.complement.X || 0, y = clone.complement.Y || 0;
    if (x >= 2 && y >= 1) return "klinefelter";               // 47,XXY / 48,XXXY / 48,XXYY
    if (x === 1 && y === 2) return "xyy";
    if (x === 3 && y === 0) return "xxx";
    if (x === 1 && y === 0) return "turner";                  // 45,X and 45,fra(X)(q27.3)
    if (x === 2 && y === 0 && lossOn(clone, "X")) return "turner";  // 46,X,i(X)(q10), 46,X,r(X)
    if (x === 1 && y === 1 && lossOn(clone, "Y")) return "turner";  // 46,X,idic(Y)(q11.2)
    return "";
  }

  function trisomy(clone, chrom) { return clone.ploidy === 2 && clone.complement[chrom] >= 3; }

  // Which fragile site this is, since fra carries no disease information of its own.
  function hasFra(clone, band) {
    return (clone.aberrations || []).some(function (ab) {
      return ab.kind === "fra" && (ab.chroms || [])[0] + ((ab.breakpoints[0] || [])[0] || "") === band;
    });
  }

  // ---- curated clinical / board notes --------------------------------------
  // Each matcher inspects a clone and returns notes when it fits.
  var SYNDROMES = [
    { test: function (c) { return trisomy(c, "21"); }, name: "Trisomy 21, Down syndrome",
      note: "The most common autosomal trisomy compatible with life (~1/700 births). Three copies of chromosome 21. Features: characteristic facies, hypotonia, intellectual disability, ~50% congenital heart disease (AV canal), ↑ risk of AML/ALL and early Alzheimer disease. ~95% free trisomy (nondisjunction, ↑ with maternal age), ~4% Robertsonian translocation, ~1% mosaic." },
    { test: function (c) { return trisomy(c, "18"); }, name: "Trisomy 18, Edwards syndrome",
      note: "Three copies of chromosome 18. Clenched fists with overlapping fingers, rocker-bottom feet, micrognathia, congenital heart disease; most die in the first year." },
    { test: function (c) { return trisomy(c, "13"); }, name: "Trisomy 13, Patau syndrome",
      note: "Three copies of chromosome 13. Holoprosencephaly, cleft lip/palate, polydactyly, cutis aplasia; high early mortality." },
    { test: function (c) { return sexCall(c) === "turner"; }, name: "Turner syndrome (45,X and variants)",
      note: "Loss of all or part of the second sex chromosome. 45,X (monosomy X) is classic; variants include an isochromosome i(Xq), a ring r(X), an idic(Y), and 45,X mosaicism (e.g. 45,X/46,XX). Short stature, ovarian dysgenesis/streak gonads, webbed neck, coarctation/bicuspid aortic valve, lymphedema." },
    { test: function (c) { return sexCall(c) === "klinefelter"; }, name: "Klinefelter syndrome (47,XXY and variants)",
      note: "An extra X in a male (≥1 Y with ≥2 X); 47,XXY is classic, with 48,XXXY and 48,XXYY as higher-grade variants. Tall stature, small firm testes, gynecomastia, infertility, low testosterone. The extra X (or Xs) inactivate as Barr bodies." },
    { test: function (c) { return sexCall(c) === "xyy"; }, name: "47,XYY",
      note: "An extra Y. Usually tall stature; typically normal fertility and intelligence within the normal range. Often incidental." },
    { test: function (c) { return sexCall(c) === "xxx"; }, name: "47,XXX, Triple X",
      note: "An extra X in a female. Often mild/absent phenotype; tall stature, sometimes learning difficulties. Two Barr bodies." },
    // The fragile site carries no disease information of its own: fra(11)(q23) and
    // fra(X)(q27.3) are written the same way and mean very different things, so the
    // card is pinned to the band. Xq27.3 is FRAXA (ISCN 5.5.7 a i-iv), which is the
    // only reason the notation is still taught.
    { test: function (c) { return hasFra(c, "Xq27.3"); }, name: "fra(X)(q27.3), Fragile X syndrome (FRAXA)",
      note: "The gap at Xq27.3 reflects an expanded CGG repeat in <i>FMR1</i>: over about 200 repeats the promoter is methylated and the gene is silenced. Intellectual disability, a long face with large ears, macroorchidism after puberty. Diagnosis is molecular, by CGG repeat analysis (PCR and Southern blot), not by karyotype. Cytogenetic scoring was the original test and gave the syndrome its name, but it misses premutation carriers entirely and is no longer used for diagnosis." },
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
    centromere: "The primary constriction that joins the two arms. The kinetochore assembles here and spindle fibers attach during cell division. Its position (metacentric / submetacentric / acrocentric) helps identify a chromosome. It also decides what survives a rearrangement: a fragment with no centromere has nothing to hold onto the spindle and is lost, so a rearranged chromosome is built around the piece that carries one, and is named for it. That is why a single breakpoint is enough to describe an isodicentric, and why the pieces a translocation swaps are the centromere-free tips.",
    telomere: "The very tip of each arm ('ter' = pter / qter). Repetitive TTAGGG caps that protect chromosome ends and shorten with each division.",
    band: "A stretch of chromosome that stains light or dark with Giemsa (G-banding). The reproducible pattern of bands is a chromosome's 'barcode', it is how each one is identified and how breakpoints are pinpointed.",
    sizes: "Segment sizes in the decode are estimates. A breakpoint written at a band can sit anywhere within that band, so sizes are measured from band midpoints on the GRCh38 assembly, the same coordinates every figure is drawn to."
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
      case "rec": return "recombinant chromosome " + c + (ab.recInvBands
        ? ", from a pericentric inversion between " + ab.recInvBands.map(function (b) { return pronounceBand(c, b, false); }).join(" and ")
        : "");
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
    // Speak the cell count when present: the proportions are the point of a mosaic.
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
      // Written for the printable sheet a family reads, so it says what happened
      // rather than what it is called: the parent's chromosome is rearranged but
      // complete, and the copy that was passed on is not.
      case "rec": return "One parent carries a piece of chromosome " + c + " that is flipped around (an inversion). " +
        "That parent has all of their genetic material, just in a different order, which is why they are healthy. " +
        "When the flipped chromosome was copied to make an egg or sperm, the copy came out with one end of chromosome " +
        c + " present twice and the other end missing. This chromosome is that copy (doctors call it a recombinant chromosome).";
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

  // The hover glossary: what each ISCN symbol MEANS, as a concept, one hover
  // away from wherever the symbol appears in the decode. The decode row already
  // explains this karyotype's instance ("chromosomes 9 and 22 break at ...");
  // the glossary answers the prior question, "what IS a derivative chromosome",
  // so a learner never has to leave the page to look a symbol up. Definitions
  // teach the concept and the naming rule, in the same voice as every other
  // string here: no parser talk, and nothing this app cannot stand behind.
  var GLOSSARY = {
    der: "A DERIVATIVE chromosome (der): a structurally rearranged chromosome, built from one or more chromosomes. ISCN names it for the centromere it keeps, so der(9) has chromosome 9's centromere whatever else it carries, and it stands in the place of that chromosome.",
    rec: "A RECOMBINANT chromosome (rec): the rearranged product a crossover creates in the child of a parent who carries an inversion or insertion. The duplicated segment is written out; the deleted one is inferred.",
    rob: "A ROBERTSONIAN translocation (rob): two acrocentric chromosomes (13, 14, 15, 21 or 22) fused at the centromere into one chromosome, with their satellite-bearing short arms lost. A balanced carrier has 45 chromosomes and is healthy; the risk appears in their gametes.",
    t: "A TRANSLOCATION (t): two chromosomes exchange segments. When nothing is lost or gained it is balanced; each product keeps its own centromere and is named for it.",
    dic: "A DICENTRIC chromosome (dic): one chromosome carrying TWO centromeres, formed when two broken chromosomes fuse. One centromere is usually inactivated, which lets it segregate like a normal chromosome.",
    idic: "An ISODICENTRIC chromosome (idic): a mirror-image chromosome with two centromeres, made of two copies of the same material joined end to end. The commonest is idic(15), a supernumerary made of two 15 short-arm-and-proximal-q pieces.",
    i: "An ISOCHROMOSOME (i): a mirror-image chromosome of two identical arms about one centromere, with the other arm lost. i(X)(q10) is two X long arms; the carrier is trisomic for that arm and monosomic for the lost one.",
    r: "A RING chromosome (r): both arms break and the broken ends fuse into a circle, usually losing the distal tips. Rings are mitotically unstable, so ring karyotypes are often mosaic.",
    del: "A DELETION (del): a segment is missing. One breakpoint makes it terminal (everything beyond the band is gone); two make it interstitial (the piece between them is gone and the flanks rejoin).",
    dup: "A DUPLICATION (dup): a segment present twice on the same chromosome. The order of the two breakpoints records whether the extra copy is direct or inverted.",
    inv: "An INVERSION (inv): a segment turned end for end within its chromosome. Pericentric inversions span the centromere; paracentric ones stay on one arm. Balanced in the carrier; the reproductive risk comes from crossovers inside the loop.",
    ins: "An INSERTION (ins): a segment moved into a new position, within its own chromosome or into another. ISCN writes the receiving site first, then the boundaries of the moved segment.",
    add: "ADDITIONAL material of unknown origin (add): extra chromosome material attached at the named band. Banding shows that something is there, not where it came from.",
    hsr: "A HOMOGENEOUSLY STAINING REGION (hsr): an amplified block of DNA riding within a chromosome, staining evenly instead of banding. It is one of the two classic forms of gene amplification, beside double minutes.",
    fra: "A FRAGILE SITE (fra): a gap or constriction that appears at a specific band under culture stress. fra(X)(q27.3) is FRAXA, the fragile X site.",
    trp: "A TRIPLICATION (trp): a segment present three times on the same chromosome.",
    mar: "A MARKER chromosome (mar): an extra chromosome that banding cannot identify. It is counted in the total, and its origin is unknown by definition.",
    dmin: "DOUBLE MINUTES (dmin): small paired fragments of extrachromosomal DNA, the other classic form of gene amplification. They lack centromeres and are not counted in the modal number."
  };
  // The glossary entry for a decode row's code chip, keyed on the symbol the
  // code STARTS with (past any sign). Longest symbols first, so idic is never
  // read as i. Null for rows that are not an operation (counts, sex fields,
  // plain gains and losses), which keeps the hover meaningful where it exists.
  var GLOSS_OPS = ["idic", "dic", "dmin", "der", "rob", "rec", "del", "dup", "inv", "ins", "add", "hsr", "fra", "trp", "mar", "t", "i", "r"];
  function glossFor(code) {
    var s = String(code || "").replace(/^[+\-−–]/, "");
    for (var gi = 0; gi < GLOSS_OPS.length; gi++) {
      var op = GLOSS_OPS[gi];
      var next = s.slice(op.length, op.length + 1);
      if (s.toLowerCase().indexOf(op) === 0 && (next === "(" || (op === "mar" || op === "dmin") && (next === "" || /\d/.test(next)))) {
        return { term: op, text: GLOSSARY[op] };
      }
    }
    return null;
  }

  // The same glossary reached from the PROSE: each entry is [regex source, key],
  // matching the English name a decode sentence uses for the concept the symbol
  // names ("derivative chromosome" hovers like the der chip does). Data only, no
  // markup: the decode text also feeds text-to-speech, the print summary, and
  // the generated landing pages, none of which can carry a hover, so the
  // wrapping happens at the one render site that can (the app's decode panel).
  // Ordered longest-first and consumed as ONE alternation, single pass, so
  // "Robertsonian translocation" can never be re-matched inside as
  // "translocation". Only symbol-backed concepts appear: a term without a
  // GLOSSARY entry would be an underline with nothing behind it.
  var GLOSS_PROSE_TERMS = [
    ["Robertsonian(?: translocations?)?", "rob"],
    ["homogeneously staining regions?", "hsr"],
    ["isodicentric(?: chromosomes?)?", "idic"],
    ["recombinant(?: chromosomes?)?", "rec"],
    ["derivative(?: chromosomes?)?", "der"],
    ["dicentric(?: chromosomes?)?", "dic"],
    ["marker chromosomes?", "mar"],
    ["ring chromosomes?", "r"],
    ["isochromosomes?", "i"],
    ["translocations?", "t"],
    ["triplications?", "trp"],
    ["duplications?", "dup"],
    ["fragile sites?", "fra"],
    ["double minutes", "dmin"],
    ["deletions?", "del"],
    ["inversions?", "inv"],
    ["insertions?", "ins"]
  ];
  // Resolve the matched prose back to its entry: the first pattern that covers
  // the whole match wins, mirroring the order the alternation matched it by.
  function glossForTerm(word) {
    for (var ti = 0; ti < GLOSS_PROSE_TERMS.length; ti++) {
      var p = GLOSS_PROSE_TERMS[ti];
      if (new RegExp("^(?:" + p[0] + ")$", "i").test(word)) {
        return { term: p[1], text: GLOSSARY[p[1]] };
      }
    }
    return null;
  }

  window.Teach = {
    decode: decode,
    sexNote: sexNote,
    plainSummary: plainSummary,
    bandInfo: bandInfo,
    stainInfo: stainInfo,
    describeAberration: describeAberration,
    syndromes: syndromes,
    pronounce: pronounce,
    GLOSSARY: GLOSSARY,
    glossFor: glossFor,
    GLOSS_PROSE_TERMS: GLOSS_PROSE_TERMS,
    glossForTerm: glossForTerm,
    ARM_INFO: ARM_INFO
  };
})();
