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
    // "Centromeric band", not "Centromere": p11.1 and q11.1 are the two acen
    // bands that make up the drawn centromere region, while ISCN reserves the
    // designation 10 (p10, q10) for the centromere itself, and the whole-arm
    // notes here already teach that convention. Dan hovered 22q11.1 on the
    // Philadelphia figure and asked whether "Centromere" was true (2026-09-09);
    // it was true in spirit and loose in letter.
    acen: { name: "Centromeric band", bio: "One of the two bands (p11.1 and q11.1) that together form the drawn centromere: α-satellite heterochromatin where the kinetochore assembles and spindle fibers attach at cell division. The centromere itself is designated 10, the p10 and q10 of whole-arm rearrangements." },
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
  // The "(about N Mb)" parentheticals left the decode prose on 2026-08-30
  // (Dan: the sizes interrupted the sentences); segment sizes now live in the
  // net-imbalance table's own column (index.html renderImbalance over
  // Karyo.computeDosage). aboutSize stays: the band map panel still speaks it.

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
      "kept here is " + kept + ", joined to a second copy of itself. The two " +
      "copies meet at the breakpoint as mirror images rather than one behind the other, so each brings its own centromere. ";
    // The two near-miss spellings, settled the way the der(N;N)/i(N) rows do.
    // ISCN 5.5.4 b: an idic is a single break on SISTER CHROMATIDS, reunited,
    // standing in place of at most one homologue; 5.5.4 a: dic names two
    // contributing chromosomes and replaces both. 5.5.11 a/c: i is the
    // monocentric mirror, breaking at the centromere band itself (p10/q10),
    // while an idic breaks out on the arm so both centromeres ride along.
    var idicWhy = " Why idic and not dic(" + c + ";" + c + ")? idic asserts ONE chromosome of origin: a single break, " +
      "sister chromatids reunited into the mirror. dic(" + c + ";" + c + ") would mean the two homologues each broke " +
      "and fused into it, standing in place of both. And why not i(" + c + ")? An isochromosome mirrors about the " +
      "centromere itself (breakpoint p10 or q10) and carries one centromere; this mirror breaks out on the arm, " +
      "so both centromeres ride along, one usually inactivated.";
    return head + body + (ab && ab.sign === "+"
      ? "It is supernumerary, sitting on top of an intact pair, so nothing is lost: " + kept +
        " simply arrives in two further copies, and " + lost + " is not on it."
      : "It replaces one copy of chromosome " + c + ", trading everything past the break, " + lost + ", for a second copy of " + kept + ".") + idicWhy;
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
    // The near-miss, settled either way (differential style, 2026-08-29). For
    // homologues the mirror is the confusable: ISCN 5.5.4 a names dic as TWO
    // chromosomes replaced, b names idic as a single sister-chromatid reunion
    // replacing one homologue. For different chromosomes the confusable is the
    // der spelling reports sometimes use: 5.5.4 f allows der in place of dic,
    // never the two together.
    var dicWhy = homologs
      ? ". Why dic(" + chroms[0] + ";" + chroms[0] + ") and not idic(" + chroms[0] + ")? dic asserts TWO chromosomes of origin, the two homologues, and it stands in place of both; an isodicentric would be one chromosome mirrored at a single break on its sister chromatids, standing in place of just one. When the evidence shows that mirror, ISCN writes idic"
      : ". ISCN also allows the same chromosome to be written der in place of dic, never both together";
    // Silent when either break sits at a centromere: both halves are centric there, so
    // there is no distal piece to name. Those are whole-arm fusions, described as such.
    if (bands.some(function (b) { return !b || atCentromere(b); })) return head + dicWhy;
    var keep = function (i) { return centricSeg(chroms[i], bands[i]); };
    var loss = function (i) { return distalSeg(chroms[i], bands[i]); };
    var keeps = sameBand ? keep(0) : listJoin(chroms.map(function (cc, i) { return keep(i); }));
    var losses = sameBand ? loss(0) : listJoin(chroms.map(function (cc, i) { return loss(i); }));
    return head + ". Each keeps the centromere side of its break, " + keeps +
      ", and the two broken ends are joined to each other. Everything past the breaks, " + losses + ", is lost" + dicWhy;
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
      // The rider hunt crosses slots: der(13;21) lives in slot 13 (lowest
      // number first) and still carries 21q, so scanning only chromosome c's
      // own slot said "two copies" beside +21 and denied the third 21q (ISCN
      // 5.5.18.3 c ii; found by Dan on the +14 twin, 2026-08-30). An instance
      // carries c when c is its home, one of its aberration's chromosomes, or
      // a chromosome a sub-op brought in.
      var riders = [];
      Object.keys(clone.slots).forEach(function (sk) {
        (clone.slots[sk] || []).forEach(function (inst) {
          if (["normal", "gain", "missing"].indexOf(inst.kind) >= 0) return;
          var carries = [String(inst.chrom)];
          var abx = inst.aberration;
          if (abx) {
            (abx.chroms || []).forEach(function (x) { carries.push(String(x)); });
            (abx.subOps || []).forEach(function (s) {
              (s.chroms || []).forEach(function (x) { carries.push(String(x)); });
            });
          }
          if (carries.indexOf(String(c)) >= 0) riders.push(inst.label);
        });
      });
      var basePloidy = clone.ploidy || 2;
      var SOMY = { 3: "trisomy", 4: "tetrasomy", 5: "pentasomy" };
      var isSex = c === "X" || c === "Y";
      var paren;
      // "No copy remains" must not deny a derivative sitting beside the loss:
      // 45,XX,-21,i(21)(q10) (ISCN 5.5.11 vi) keeps its 21 material on the i.
      if (whole === 0) paren = riders.length
        ? "no intact " + c + " remains; this cell line's " + c + " material is on " + listJoin(riders)
        : "no copy of " + c + " remains in this cell line";
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
      var ivb = bp[0] || [];
      return { text: "an INVERSION in chromosome " + c + ": the segment between " + bandsPhrase(c, ivb) + " is flipped end-for-end (" + (peri ? "pericentric, it spans the centromere" : "paracentric, within one arm") + ")", tag: "inv" };
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
      var isoQ = /^q/.test(arm) ? "q" : "p", isoP = /^q/.test(arm) ? "p" : "q";
      // The copy-number claim reads the clone's own slots. The canned "3 copies
      // of one arm and 1 of the other" was false beside ISCN 5.5.11 vi
      // (45,XX,-21,i(21)(q10): two and none) and beside any non-diploid clone.
      var isoSlots = clone && clone.slots ? clone.slots[String(c)] : null;
      var isoTally = "";
      if (isoSlots) {
        var isoN = isoSlots.filter(function (i) { return i.kind === "normal"; }).length;
        var isoI = isoSlots.filter(function (i) { return i.kind === "iso"; }).length;
        var isoHi = isoN + 2 * isoI;
        isoTally = "; this cell line ends up with " + numberWord(isoHi) + (isoHi === 1 ? " copy" : " copies") + " of " + c + isoQ +
          " and " + (isoN ? numberWord(isoN) + (isoN === 1 ? " copy" : " copies") : "none") + " of " + c + isoP;
      }
      // The near-miss differential, the converse of the der(N;N) row (ISCN
      // 5.5.11 b/d): i asserts the mirror; der is the spelling without proof.
      return { text: "an ISOCHROMOSOME i(" + c + "): a mirror-image chromosome made of two " + whicharm + " arms, so the " + lostarm + " arm is lost" + isoTally +
        ". Written i because both arms are copies of the SAME arm, a true mirror and genetically homozygous; when that identity is not proven, ISCN writes der(" +
        c + ";" + c + ")(" + arm + ";" + arm + ") instead", tag: "iso" };
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
        // Homologues can fuse p-to-q as well as like-to-like; "the two short
        // arms" was a lie beside der(8;8)(p10;q10), which fuses one of each.
        var waMixed = waSame && waArm(0) !== waArm(1);
        var waBody = waSame
          ? (waMixed
            ? "the " + waArm(0) + " arm of one chromosome " + ab.chroms[0] + " and the " + waArm(1) + " arm of its homologue are fused at the centromere into one derivative chromosome"
            : "the two " + waArm(0) + " arms of chromosome " + ab.chroms[0] + ", one from each homologue, are fused at the centromere into one derivative chromosome")
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
              " and " + endShort(guest, guestBand) + " is attached there.");
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
        if (waSame && !waMixed && clone && clone.slots && (clone.ploidy || 2) === 2) {
          // The homologous fusion's cost went unstated while the heterologous
          // one below named its partial monosomies. When no normal homologue
          // remains, the fused arm is all this cell has of the chromosome.
          var waKeptArm = waArm(0) === "long" ? "q" : "p";
          var waLostArm = waArm(0) === "long" ? "p" : "q";
          // "gain" counts as a homologue here and below: a +N in the same
          // clone is drawn as a normal-shaped chromosome, and a count blind
          // to it misstates what remains (Dan, 2026-09-10).
          var waNn = (clone.slots[String(ab.chroms[0])] || []).filter(function (i) { return i.kind === "normal" || i.kind === "gain"; }).length;
          if (waNn === 0) {
            waLost = " With no normal " + ab.chroms[0] + " remaining, both " + ab.chroms[0] + waKeptArm +
              " arms sit on this one derivative and no copy of " + ab.chroms[0] + waLostArm + " remains.";
          }
        }
        // The near-miss a student reaches for here is the isochromosome, so the
        // row settles the differential (ISCN 5.5.11): i asserts a mirror image,
        // arms identical and genetically homozygous (5.5.11 b); der is the
        // spelling when that identity is not proven (5.5.11 d), and complex
        // cases are written der regardless (5.5.11 e). Deliberately NOT claimed:
        // that der proves two parental homologues. A true iso that later
        // diverged on one arm is also written der, so the honest statement is
        // that i became unavailable once the arms demonstrably differ.
        var waWhy = "";
        if (waSame && !waMixed) {
          var waIso = "i(" + ab.chroms[0] + ")(" + (waArm(0) === "long" ? "q10" : "p10") + ")";
          var waDerName = "der(" + ab.chroms[0] + ";" + ab.chroms[0] + ")";
          waWhy = (ab.subOps || []).length
            ? " Why " + waDerName + " and not " + waIso + "? An isochromosome is a mirror image, two copies of the same arm out of one centromere misdivision, so its arms are identical by definition. These two arms visibly differ, each carrying its own change, so a single mirrored arm cannot describe them; ISCN reserves i for arms proven identical and writes der for every other case."
            : " Why not " + waIso + "? i would assert a mirror image, both arms copies of the same arm and genetically homozygous; " + waDerName + " makes no such claim. ISCN reserves i for arms proven identical and writes der when that is not proven.";
        }
        if (!waSame) {
          var waArmNot = function (ix) { return waArm(ix) === "long" ? "p" : "q"; };
          var waArmKept = function (ix) { return waArm(ix) === "long" ? "q" : "p"; };
          var waLostNames = String(ab.chroms[0]) + waArmNot(0) + " and " + String(ab.chroms[1]) + waArmNot(1);
          waLost = " The " + waLostNames + " arms are not part of this derivative.";
          if (clone && clone.slots && (clone.ploidy || 2) === 2) {
            // Counting only kind "normal" made this sentence blind to a +N in
            // the same clone: 46,XX,+1,der(1;7)(q10;p10) was decoded as
            // partially monosomic for 1p while the extra 1 held 1p at two
            // copies (Dan, 2026-09-10). A gain instance is a normal-shaped
            // homologue, so it counts; and the monosomy claim itself is now
            // checked against Karyo.computeDosage, which reads the very
            // segment lists the figure is drawn from, so this sentence
            // cannot disagree with the karyogram or the Involved-segments
            // table.
            var waHomolog = function (ix) {
              return (clone.slots[String(ab.chroms[ix])] || []).filter(function (i) {
                return i.kind === "normal" || i.kind === "gain";
              }).length;
            };
            var waN0 = waHomolog(0), waN1 = waHomolog(1);
            var waDose = null;
            if (window.Karyo && window.Karyo.computeDosage &&
                /^\d+$/.test(String(ab.chroms[0])) && /^\d+$/.test(String(ab.chroms[1]))) {
              try { waDose = window.Karyo.computeDosage(clone); } catch (e) { waDose = null; }
            }
            // Copy number of one whole arm, or null when the arm is not one
            // constant run (a sub-op inside it would make one number a lie).
            var waArmCopies = function (chrom, arm) {
              if (!waDose) return null;
              var entry = null, i;
              for (i = 0; i < waDose.chroms.length; i++) {
                if (waDose.chroms[i].chrom === String(chrom)) entry = waDose.chroms[i];
              }
              var d = IDEO.data[String(chrom)];
              if (!entry || !d) return null;
              var lo = arm === "p" ? 0 : d.centromere, hi = arm === "p" ? d.centromere : d.length;
              var copies = null;
              for (i = 0; i < entry.runs.length; i++) {
                var r = entry.runs[i];
                if (r.to <= lo || r.from >= hi) continue;
                if (copies === null) copies = r.copies;
                else if (copies !== r.copies) return null;
              }
              return copies;
            };
            var waL0 = waArmCopies(ab.chroms[0], waArmNot(0)), waL1 = waArmCopies(ab.chroms[1], waArmNot(1));
            var waK0 = waArmCopies(ab.chroms[0], waArmKept(0)), waK1 = waArmCopies(ab.chroms[1], waArmKept(1));
            if (waN0 === 1 && waN1 === 1 && (waDose === null || (waL0 === 1 && waL1 === 1))) {
              waLost = " With one normal " + ab.chroms[0] + " and one normal " + ab.chroms[1] +
                " remaining, the cell is partially monosomic for the lost arms (" + waLostNames + ").";
            } else if (waL0 !== null && waL1 !== null && waK0 !== null && waK1 !== null) {
              var waArms = [
                { name: String(ab.chroms[0]) + waArmKept(0), c: waK0 },
                { name: String(ab.chroms[0]) + waArmNot(0), c: waL0 },
                { name: String(ab.chroms[1]) + waArmKept(1), c: waK1 },
                { name: String(ab.chroms[1]) + waArmNot(1), c: waL1 },
              ];
              var waNum = ["no copies", "one copy", "two copies", "three copies", "four copies", "five copies"];
              var waGains = waArms.filter(function (a) { return a.c > 2; });
              var waLosses = waArms.filter(function (a) { return a.c < 2; });
              var waEven = waArms.filter(function (a) { return a.c === 2; });
              if (waGains.length || waLosses.length) {
                var waBits = waGains.concat(waLosses).map(function (a) {
                  return a.name + " has " + (waNum[a.c] || a.c + " copies");
                });
                waLost = " Counted across this clone, " + listJoin(waBits) +
                  (waEven.length ? ", while " + listJoin(waEven.map(function (a) { return a.name; })) +
                    (waEven.length === 1 ? " keeps" : " keep") + " the usual two" : "") + ".";
              } else {
                waLost = " Counted across this clone, every arm involved is back to two copies.";
              }
            }
          }
        }
        return { text: waOpen + (waJoins.length ? " " + waJoins.join(" ") : "") + waExtraText + waLost + waWhy, tag: "der" };
      }
      if (ab.chroms && ab.chroms.length >= 2 &&
        (/robertsonian/i.test(ab.note || "") || (wholeArmBands && acroPair))) {
        var robSame = ab.chroms.length === 2 && String(ab.chroms[0]) === String(ab.chroms[1]);
        var robSpell = /robertsonian/i.test(ab.note || "") ? "" :
          ". ISCN writes this either way, der(" + ab.chroms.join(";") + ")(q10;q10) or rob(" +
          ab.chroms.join(";") + ")(q10;q10), and prefers the der spelling";
        // The homologous fusion reads "one from each homologue" (never
        // "chromosomes 21 and 21", and the lowest-number-first rule is
        // meaningless there), and it settles the i(21)(q10) differential the
        // same way the whole-arm branch above does (ISCN 5.5.11 b/d).
        if (robSame) {
          return { text: "a ROBERTSONIAN translocation: the two long arms of chromosome " + ab.chroms[0] +
            ", one from each homologue, are fused at the centromere into one derivative chromosome, and the two short arms are lost. " +
            "Whole-arm fusions like this are usually dicentric, with one centromere inactivated" + robSpell +
            ". If the two long arms were proven copies of ONE arm, a mirror image and genetically homozygous, the same chromosome would be written i(" +
            ab.chroms[0] + ")(q10); ISCN keeps the der spelling when that is not proven", tag: "der" };
        }
        // 5.5.18.3 d: the q10 spelling presumes fusion at the centromeres; a
        // fusion PROVEN dicentric is written dic instead, with the breakpoints
        // out in the short arms. Pre-answers "then why is it not written dic".
        // Two-partner fusions only: a longer chrom list cannot take the
        // two-breakpoint dic example this sentence writes out.
        var robDic = ab.chroms.length === 2
          ? " When a fusion is PROVEN dicentric it is written dic, with the breakpoints out in the short arms: dic(" +
            ab.chroms.join(";") + ")(p11.2;p11.2)."
          : "";
        return { text: "a ROBERTSONIAN translocation: the long arms of chromosomes " +
          listJoin(ab.chroms) + " are fused at the centromere into one derivative chromosome, and the two short arms are lost. " +
          "They are written lowest-number-first by convention, not by which centromere is kept; whole-arm fusions like this are usually dicentric, with one centromere inactivated." +
          robDic + (robSpell ? robSpell.replace(/^\. /, " ") : ""), tag: "der" };
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
        return { text: base + ". This is chromosome " + c + throughShort(c, bpDer) + " with " + endShort(partner, bpPar) + " attached." + extraText, tag: "der" };
      }
      return { text: base + "." + extraText, tag: "der" };
    }
    if (k === "ins") {
      var ic = ab.chroms;
      if (ic.length >= 2) {
        return { text: "an INSERTION: the segment between " + bandsPhrase(ic[1], bp[1] || []) + " of chromosome " + ic[1] +
          " is moved into chromosome " + ic[0] + " at " + ic[0] + ((bp[0] || [])[0] || "?") + insOrientPhrase(ic[1], bp[1] || []) +
          ". Chromosome " + ic[0] + " grows by that piece; chromosome " + ic[1] + " loses it.", tag: "add" };
      }
      var ig = bp[0] || [];
      return { text: "an INSERTION within chromosome " + c + ": the segment between " + bandsPhrase(c, ig.slice(1)) +
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
    if (k === "trp") { var tb = bp[0] || []; return { text: "a TRIPLICATION in chromosome " + c + ": the segment " + bandsPhrase(c, tb) + " is present three times", tag: "dup" }; }
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
        "It carries " + distalSeg(c, ab.recDupBand) + " twice and is missing " + distalSeg(c, ab.recDelBand) +
        ", so it is unbalanced: a duplication of the segment beyond one breakpoint and a deletion of the segment beyond the other. " +
        "The notation states only the duplication, dup(" + c + ab.recDupArm +
        "); the deletion is inferred from the inversion rather than written. " +
        "The recombinant IS inherited from the carrier parent, yet no body cell of that parent contains it: " +
        "it first exists in the egg or sperm the crossover made, so ISCN marks it as derived from the parental " +
        "rearrangement rather than simply inherited. The parent, carrying the balanced inversion, is " +
        "typically unaffected. " +
        // The near-miss (5.4.3.2 b): rec is inferred from the parental
        // karyotype and never used for acquired abnormalities; the same
        // chromosome without its documented parent is a der.
        "Written rec, not der, because the notation itself names the parental rearrangement it recombined from; " +
        "ISCN reserves rec for exactly that and never uses it for acquired changes, so without the documented " +
        "parental inversion the same chromosome would be described as der", tag: "rec" };
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
      distalSeg(partner, bpPar) + " is present in three copies (partial trisomy) and " + distalSeg(c, bpDer) + " in one (partial monosomy)." + origin;
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
      } else if (clone.ploidy === 1) {
        // The window is stated, not gestured at ("a count near 23" left the
        // reader guessing where the reading starts), and one copy is singular.
        txt += "; a count of 20-34 reads against the haploid baseline of 23, one copy of each chromosome";
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

  // Trisomy read as q-arm dosage, not just as an instance count: translocation
  // Down, 46,XX,der(14;21)(q10;q10),+21, has only two free 21s in the
  // complement, but three copies of 21q, and the card missed it until a guard
  // test caught the gap (2026-09-09). Every dosage run touching the q arm must
  // sit at three or more copies, so a partial duplication does not become a
  // whole syndrome; the p arm is left out because an acrocentric derivative
  // sheds it. The complement shortcut stays as the fast path.
  function trisomy(clone, chrom) {
    if (clone.ploidy !== 2) return false;
    if (clone.complement[chrom] >= 3) return true;
    try {
      var dsc = window.IDEOGRAM && window.IDEOGRAM.data && window.IDEOGRAM.data[chrom];
      if (!dsc || !dsc.bands) return false;
      var qStart = null;
      for (var b = 0; b < dsc.bands.length; b++) {
        if (String(dsc.bands[b][0]).charAt(0) === "q") { qStart = dsc.bands[b][1]; break; }
      }
      if (qStart == null) return false;
      var entry = null;
      (window.Karyo.computeDosage(clone).chroms || []).forEach(function (x) { if (x.chrom === chrom) entry = x; });
      if (!entry || !entry.runs) return false;
      var qRuns = 0;
      for (var i = 0; i < entry.runs.length; i++) {
        var r = entry.runs[i];
        if (r.to <= qStart) continue;
        qRuns++;
        if (r.copies < 3) return false;
      }
      return qRuns > 0;
    } catch (e) { return false; }
  }

  // Which fragile site this is, since fra carries no disease information of its own.
  function hasFra(clone, band) {
    return (clone.aberrations || []).some(function (ab) {
      return ab.kind === "fra" && (ab.chroms || [])[0] + ((ab.breakpoints[0] || [])[0] || "") === band;
    });
  }

  // ---- how a rearrangement is matched to a recurrent lesion ---------------
  //
  // Two bands "meet" when one is a prefix of the other, in EITHER direction. That
  // single rule does two jobs. An ancestor matches a descendant, so the bare p13 a
  // reader types lands on the p13.1 the lesion is defined at, and two siblings
  // never match, so p13.2 does not. Keying a lesion on the ancestor instead
  // collapses the second half: the first cut of the chromosome 16 entry was pinned
  // at "p13", every sub-band under it matched, and t(16;16)(p13.2;q22) came back a
  // leukemia. MYH11 is at 16p13.11 and p13.2 is somewhere else.
  function bandsMeet(a, b) {
    a = String(a || ""); b = String(b || "");
    return !!a && !!b && (a.indexOf(b) === 0 || b.indexOf(a) === 0);
  }

  // A rearrangement reduced to the two ends it joins: [chromA, bandA, chromB,
  // bandB]. An inversion names one chromosome and two bands; a translocation names
  // two chromosomes and one band each; a translocation between two homologs is a
  // translocation whose two chromosomes have the same number, and needs no special
  // case here. A whole-arm derivative names two chromosomes and the centromeric
  // bands p10 or q10 only (ISCN 5.5.18.2 a), and is a join of two arms: read it,
  // or der(1;7)(q10;p10) has no way into the table. Anything else is not a
  // two-ended join and returns null.
  //
  // kind on a top-level aberration, op on a sub-operation: the parser names the
  // same field differently in the two places, and reading only kind meant
  // der(9)t(9;22)(q34;q11.2) carried the Philadelphia join and was not recognised
  // as carrying it.
  function joinEnds(ab) {
    var ch = (ab.chroms || []).map(String);
    var k = ab.kind || ab.op;
    if (k === "inv" && ch.length === 1) {
      var g = (ab.breakpoints || [])[0] || [];
      return (g.length >= 2 && g[0] && g[1]) ? [ch[0], g[0], ch[0], g[1]] : null;
    }
    if (k === "t" && ch.length === 2) {
      var a = ((ab.breakpoints || [])[0] || [])[0], b = ((ab.breakpoints || [])[1] || [])[0];
      return (a && b) ? [ch[0], a, ch[1], b] : null;
    }
    // Whole-arm der only: both breakpoints must be the centromeric p10/q10
    // spellings, so a der(9)t(9;22) still reaches its join through the sub-op
    // walk, and a Robertsonian (which the parser normalises to der) simply finds
    // no record claiming an acrocentric q10;q10 pair.
    if (k === "der" && ch.length === 2) {
      var wa = ((ab.breakpoints || [])[0] || [])[0], wb = ((ab.breakpoints || [])[1] || [])[0];
      if (/^[pq]10$/.test(wa || "") && /^[pq]10$/.test(wb || "")) return [ch[0], wa, ch[1], wb];
    }
    return null;
  }

  // Does this clone carry the lesion f? Every accepted breakpoint pair is tried
  // both ways round, because which chromosome a reader writes first is theirs to
  // choose and t(9;22) and t(22;9) are the same event. Sub-operations are walked
  // too, so der(9)t(9;22)(q34;q11.2) is found inside its derivative.
  function hasFusion(clone, f) {
    function ends(v) {
      for (var i = 0; i < f.bands.length; i++) {
        var pr = f.bands[i];
        if (String(f.chroms[0]) === v[0] && String(f.chroms[1]) === v[2] &&
            bandsMeet(v[1], pr[0]) && bandsMeet(v[3], pr[1])) return true;
        if (String(f.chroms[0]) === v[2] && String(f.chroms[1]) === v[0] &&
            bandsMeet(v[3], pr[0]) && bandsMeet(v[1], pr[1])) return true;
      }
      return false;
    }
    var found = false;
    function walk(ab) {
      if (found || !ab) return;
      var v = joinEnds(ab);
      if (v && ends(v)) { found = true; return; }
      (ab.subOps || []).forEach(walk);
    }
    (clone.aberrations || []).forEach(walk);
    return found;
  }

  // The lead sentence of a fusion note, built from the record so that every entry
  // states its mechanism the same way. The three kinds are not decoration: they
  // are the distinction a cytogeneticist draws when asked what a rearrangement
  // does. A fusion makes a chimeric protein. A juxtaposition makes no new protein
  // and instead drags an intact oncogene under someone else's enhancer, which is
  // why the immunoglobulin partners behave differently from BCR::ABL1. An enhancer
  // rearrangement moves regulatory DNA and leaves both genes intact.
  function fusionLead(f) {
    if (!f.genes || !f.genes.length) return "";
    // One <i> around the whole pair, not one per symbol: that is how every note in
    // this file already writes a fusion, and teach.test.js pins the contiguous
    // BCR::ABL1 form against the legacy hyphen. The enhancer case takes separate
    // tags because its two genes are not a fusion pair.
    if (f.kind === "enhancer") {
      return "<i>" + f.genes[0] + "</i> enhancer repositioned to <i>" + f.genes[1] + "</i>. ";
    }
    var pair = "<i>" + f.genes.join("::") + "</i>";
    if (f.kind === "juxtaposition") return pair + ", a juxtaposition rather than a fusion protein. ";
    return pair + ". ";
  }

  // ---- recurrent rearrangements ------------------------------------------
  //
  // What a cancer cytogeneticist asks of a rearrangement, in the order they ask
  // it: is this one of the recurrent ones, what does it join, what disease does
  // that make, and does it change what happens to the patient. Each record
  // answers all four. The note is written karyotype-first, in complete
  // sentences: its first sentence says what the FINDING means, disease and risk
  // included, at a strength calibrated to the truth. WHO defines many
  // hematologic entities by these lesions, so "this means X" is often right,
  // but banding is a hypothesis that FISH or molecular work confirms, and the
  // shared-lesion entries (t(11;14), ETV6::NTRK3, TFE3) say "one of" rather
  // than overclaiming (Dan, 2026-09-09, asking whether cytogenetics really has
  // this many pathognomonic findings; it does not, and the leads say so).
  //
  // bands is a LIST of accepted breakpoint pairs, not one pair, because band
  // assignments have been revised and a reader may reasonably type any of the
  // published spellings. t(15;17) has been written (q22;q12), (q22;q21) and
  // (q24.1;q21.2) over the years and all three mean the promyelocytic leukemia.
  // Refusing the spelling in someone's older report would be a worse failure than
  // the ancestor-band looseness this list exists to avoid, so both are handled:
  // every accepted pair is written out, and each is matched precisely.
  //
  // These are teaching notes for cytogenetics, not a clinical annotation, and no
  // entry is a substitute for the molecular confirmation its own note describes.
  var FUSIONS = [
    // --- myeloid ---
    { chroms: ["9", "22"], bands: [["q34", "q11.2"], ["q34.1", "q11.2"]],
      kind: "fusion", genes: ["BCR", "ABL1"],
      name: "t(9;22), Philadelphia chromosome",
      note: "In a marrow karyotype this translocation is chronic myeloid leukemia until proven otherwise, and the same fusion defines Philadelphia-positive ALL and a rare AML, so the blood picture around it decides the disease. It is the rearrangement that made targeted therapy a category: imatinib and the tyrosine-kinase inhibitors after it bind the constitutively active ABL1 kinase, and a disease that once meant transplant is now managed on tablets. In ALL it is a poor-risk marker that adds a TKI to chemotherapy. The 190 kDa product typical of ALL and the 210 kDa product typical of CML come from different breakpoints within <i>BCR</i>, which banding cannot separate, so PCR still has a job." },
    { chroms: ["8", "21"], bands: [["q22", "q22"], ["q22", "q22.1"]],
      kind: "fusion", genes: ["RUNX1", "RUNX1T1"],
      name: "t(8;21), core-binding-factor AML",
      note: "WHO defines an AML by this translocation, whatever the blast count, and it sits in the favorable-risk group. It is one of the two core-binding-factor leukemias: <i>RUNX1</i> is the alpha subunit of that transcription factor and <i>CBFB</i> the beta, which is why this lesion and inv(16) share one risk category and one treatment path, high-dose cytarabine consolidation. Auer rods and a maturing myeloid picture are the classic morphology. A co-occurring <i>KIT</i> mutation worsens the outlook, so it is worth asking the molecular panel." },
    { chroms: ["16", "16"], bands: [["p13.1", "q22"], ["p13.1", "q22.1"]],
      kind: "fusion", genes: ["CBFB", "MYH11"],
      name: "inv(16) / t(16;16), core-binding-factor AML",
      note: "Two rearrangements, one disease: inv(16)(p13.1q22) and t(16;16)(p13.1;q22) both bring <i>CBFB</i> and <i>MYH11</i> together, and WHO classifies either as the same favorable-risk AML, classically with abnormal marrow eosinophils. The inversion is far the commoner of the two. It is the other half of the core-binding-factor pair with t(8;21), sharing the cytarabine consolidation, and a <i>KIT</i> mutation again worsens it. Both breakpoints sit close to the centromere and the inversion is genuinely easy to miss on banding, so it is confirmed by FISH or RT-PCR rather than excluded by karyotype." },
    { chroms: ["15", "17"], bands: [["q24", "q21"], ["q24.1", "q21.2"], ["q22", "q12"], ["q22", "q21"]],
      kind: "fusion", genes: ["PML", "RARA"],
      name: "t(15;17), acute promyelocytic leukemia",
      note: "This karyotype is a medical emergency before it is a diagnosis: it means acute promyelocytic leukemia, which kills by disseminated intravascular coagulation in days, so all-trans retinoic acid is started on morphological suspicion rather than held for confirmation. With ATRA and arsenic trioxide the disease is now among the most curable acute leukemias. Differentiation syndrome is the treatment complication to expect." },
    { chroms: ["3", "3"], bands: [["q21.3", "q26.2"]],
      kind: "enhancer", genes: ["GATA2", "MECOM"],
      name: "inv(3) / t(3;3), MECOM rearrangement",
      note: "Two rearrangements, one disease, as on chromosome 16: inv(3)(q21.3q26.2) and t(3;3)(q21.3;q26.2) both mean an adverse-risk AML or MDS. Each moves a distal <i>GATA2</i> enhancer onto <i>MECOM</i> at 3q26.2, driving <i>EVI1</i> while leaving the donor <i>GATA2</i> allele without its enhancer, so one event activates an oncogene and halves a transcription factor, and no fusion protein is made. Monosomy 7 is a frequent companion. The clinical clue is a platelet count that is normal or raised, with dysplastic megakaryocytes, which is unlike most AML at presentation." },
    { chroms: ["6", "9"], bands: [["p23", "q34"], ["p22.3", "q34.1"]],
      kind: "fusion", genes: ["DEK", "NUP214"],
      name: "t(6;9), AML with DEK::NUP214",
      note: "This translocation means an adverse-risk AML of younger patients, often with marrow basophilia and multilineage dysplasia in the background. <i>FLT3</i>-ITD accompanies it in most cases, so expect it on the molecular panel. Transplant in first remission is the usual intent." },
    { chroms: ["9", "11"], bands: [["p22", "q23"], ["p21.3", "q23.3"]],
      kind: "fusion", genes: ["KMT2A", "MLLT3"],
      name: "t(9;11), KMT2A-rearranged AML",
      note: "In a marrow karyotype an 11q23 break means a <i>KMT2A</i> (formerly <i>MLL</i>) rearrangement, and this partner, the commonest in AML, carries the least bad outlook of them; the partner rather than the break sets the risk, and <i>KMT2A</i> takes more than eighty of them. The leukemia is typically monocytic, with gum infiltration and extramedullary disease. A cryptic insertion can hide the rearrangement from banding, so a break-apart FISH probe is the reliable test." },
    { chroms: ["4", "11"], bands: [["q21", "q23"], ["q21.3", "q23.3"]],
      kind: "fusion", genes: ["KMT2A", "AFF1"],
      name: "t(4;11), KMT2A-rearranged ALL",
      note: "This translocation is the dominant lesion of infant ALL and marks an adverse-risk B-lymphoblastic leukemia at any age. The classic picture is a very high white count at presentation, CNS involvement, and a pro-B immunophenotype that is often CD10-negative with myeloid antigen expression." },
    { chroms: ["11", "19"], bands: [["q23", "p13.3"], ["q23.3", "p13.3"]],
      kind: "fusion", genes: ["KMT2A", "MLLT1"],
      name: "t(11;19), KMT2A-rearranged leukemia",
      note: "This is another <i>KMT2A</i> rearrangement, seen in infant ALL and in monocytic AML, and a reminder that the gene matters more than the partner chromosome when reading 11q23: a break there deserves a break-apart probe whatever it appears joined to." },
    { chroms: ["1", "22"], bands: [["p13", "q13"], ["p13.3", "q13.1"]],
      kind: "fusion", genes: ["RBM15", "MRTFA"],
      name: "t(1;22), infant acute megakaryoblastic leukemia",
      note: "This translocation means the acute megakaryoblastic leukemia of infants without Down syndrome, and it is specific enough to be diagnostic. Marrow fibrosis often makes the aspirate dry, so the karyotype may have to come from blood or a trephine imprint. It is distinct from the transient abnormal myelopoiesis and the megakaryoblastic leukemia of Down syndrome, which are <i>GATA1</i>-driven." },
    { chroms: ["8", "16"], bands: [["p11.2", "p13.3"], ["p11.21", "p13.3"]],
      kind: "fusion", genes: ["KAT6A", "CREBBP"],
      name: "t(8;16), AML with KAT6A::CREBBP",
      note: "This translocation means an AML with monocytic differentiation whose classic morphological clue is erythrophagocytosis by the blasts, often with coagulopathy at presentation. It occurs both de novo and as a therapy-related leukemia after topoisomerase II inhibitors." },
    { chroms: ["16", "21"], bands: [["p11.2", "q22"], ["p11.2", "q22.2"]],
      kind: "fusion", genes: ["FUS", "ERG"],
      name: "t(16;21), AML with FUS::ERG",
      note: "This translocation means a rare and consistently adverse-risk AML. It is not to be confused with t(16;21)(q24;q22), <i>RUNX1</i>::<i>CBFA2T3</i>, a different fusion of the same two chromosomes at different bands, which is why the breakpoints and not the chromosome pair decide the call." },
    { chroms: ["5", "12"], bands: [["q33", "p13"], ["q32", "p13.2"], ["q31", "p13"]],
      kind: "fusion", genes: ["ETV6", "PDGFRB"],
      name: "t(5;12), myeloid neoplasm with PDGFRB rearrangement",
      note: "In a patient with eosinophilia this translocation means a myeloid or lymphoid neoplasm with <i>PDGFRB</i> rearrangement, worth recognising out of proportion to its rarity because the disease responds durably to imatinib at doses below those used in CML. Eosinophilia with a 5q31-33 break is the trigger to look. A normal karyotype does not exclude the family: <i>FIP1L1</i>::<i>PDGFRA</i>, the commonest member, comes from an interstitial deletion within 4q12 far below the resolution of banding, so it never shows as a translocation at all." },
    { chroms: ["8", "13"], bands: [["p11", "q12"], ["p11.2", "q12.1"], ["p11.23", "q12.11"]],
      kind: "fusion", genes: ["ZMYM2", "FGFR1"],
      name: "t(8;13), myeloid/lymphoid neoplasm with FGFR1 rearrangement",
      note: "This translocation means the <i>FGFR1</i> member of the eosinophilia family, the one that does NOT respond to imatinib, which is why the family is worth splitting: <i>PDGFRA</i> and <i>PDGFRB</i> disease does, <i>FGFR1</i> disease does not, and pemigatinib is the targeted option here. The classic presentation pairs an eosinophilic myeloproliferative neoplasm with a T-lymphoblastic lymphoma arising from the same clone. It transforms early, so treatment is planned toward transplant." },
    { chroms: ["8", "9"], bands: [["p22", "p24"], ["p22", "p24.1"]],
      kind: "fusion", genes: ["PCM1", "JAK2"],
      name: "t(8;9), myeloid/lymphoid neoplasm with PCM1::JAK2",
      note: "This translocation means the <i>JAK2</i> member of the eosinophilia family, beside the <i>PDGFRA</i>, <i>PDGFRB</i> and <i>FGFR1</i> groups. The described picture is eosinophilia with erythroid hyperplasia and marrow lymphoid aggregates. Ruxolitinib gives responses that do not last the way imatinib responses do in <i>PDGFR</i> disease, so transplant stays in the plan. The same <i>JAK2</i> is far better known for its V617F point mutation in polycythemia vera; one gene can drive disease as a point mutation or as a fusion." },
    // --- lymphoid ---
    { chroms: ["12", "21"], bands: [["p13", "q22"], ["p13.2", "q22.1"]],
      kind: "fusion", genes: ["ETV6", "RUNX1"],
      name: "t(12;21), childhood B-ALL",
      note: "This finding means the most common recurrent rearrangement of childhood B-lymphoblastic leukemia and places it in the favorable-risk group that helped set the cure rate. On banding it is almost never actually seen: the exchanged segments are so alike in size and pattern that the rearrangement is cryptic and is found by FISH or RT-PCR, which makes it the standing argument for not trusting a normal karyotype." },
    { chroms: ["1", "19"], bands: [["q23", "p13.3"], ["q23.3", "p13.3"]],
      kind: "fusion", genes: ["TCF3", "PBX1"],
      name: "t(1;19), B-ALL with TCF3::PBX1",
      note: "This translocation means a pre-B lymphoblastic leukemia with cytoplasmic mu. It is often present as the unbalanced der(19)t(1;19) rather than the reciprocal exchange, which is worth expecting when reading the karyotype. Historically poor-risk, it is now largely offset by intensified therapy, with a residual tendency to CNS relapse." },
    { chroms: ["17", "19"], bands: [["q22", "p13.3"], ["q21.3", "p13.3"]],
      kind: "fusion", genes: ["TCF3", "HLF"],
      name: "t(17;19), B-ALL with TCF3::HLF",
      note: "This translocation means a very-high-risk B-lymphoblastic leukemia, rare and among the worst outcomes in pediatric ALL, classically with hypercalcaemia and coagulopathy at presentation. It shares a partner gene with t(1;19) and almost nothing else." },
    { chroms: ["8", "14"], bands: [["q24", "q32"], ["q24.2", "q32"], ["q24.1", "q32"]],
      kind: "juxtaposition", genes: ["IGH", "MYC"],
      name: "t(8;14), Burkitt lymphoma",
      note: "In the right clinical picture this translocation means Burkitt lymphoma or leukemia: <i>MYC</i> moves under the immunoglobulin heavy-chain enhancer and is overexpressed intact, and the light-chain variants t(2;8) and t(8;22) do the same with kappa and lambda. Expect starry-sky morphology, a proliferation fraction approaching one hundred per cent, and a real risk of tumour lysis the moment treatment starts. A <i>MYC</i> rearrangement alongside <i>BCL2</i> or <i>BCL6</i> is a high-grade lymphoma of a different category, not Burkitt." },
    { chroms: ["14", "18"], bands: [["q32", "q21"], ["q32", "q21.3"]],
      kind: "juxtaposition", genes: ["IGH", "BCL2"],
      name: "t(14;18), follicular lymphoma",
      note: "This translocation is the hallmark of follicular lymphoma and also appears in a subset of diffuse large B-cell lymphoma. It is the founding example of an anti-apoptotic oncogene: <i>BCL2</i> under the <i>IGH</i> enhancer stops the cell dying rather than making it divide. It is present in most follicular lymphoma yet detectable at low levels in healthy people, so it is necessary but not sufficient for the diagnosis. One ambiguity is worth knowing: <i>MALT1</i> sits in the same 18q21 region as <i>BCL2</i>, so a MALT lymphoma with a <i>MALT1</i> rearrangement can carry an identically written t(14;18)(q32;q21), and the histology decides which disease the karyotype belongs to." },
    { chroms: ["11", "14"], bands: [["q13", "q32"], ["q13.3", "q32"]],
      kind: "juxtaposition", genes: ["IGH", "CCND1"],
      name: "t(11;14), mantle cell lymphoma",
      note: "This translocation is effectively defining for mantle cell lymphoma, where cyclin D1 immunohistochemistry is the everyday surrogate; the same finding in a plasma cell context means a standard-risk myeloma instead, so the tissue decides the disease. The mechanism is cyclin D1 under the <i>IGH</i> enhancer, driving the cell cycle. In myeloma it also predicts response to venetoclax." },
    { chroms: ["3", "14"], bands: [["q27", "q32"], ["q27.3", "q32"]],
      kind: "juxtaposition", genes: ["IGH", "BCL6"],
      name: "t(3;14), BCL6 rearrangement",
      note: "This translocation means a <i>BCL6</i>-rearranged B-cell lymphoma, most often diffuse large B-cell lymphoma. <i>BCL6</i> takes many partners besides <i>IGH</i>, so a 3q27 break matters whatever it is joined to. Its significance is mostly in company: beside a <i>MYC</i> rearrangement it defines a high-grade B-cell lymphoma treated more intensively than DLBCL." },
    { chroms: ["11", "18"], bands: [["q22", "q21"], ["q22.2", "q21.3"]],
      kind: "fusion", genes: ["BIRC3", "MALT1"],
      name: "t(11;18), MALT lymphoma",
      note: "This translocation means extranodal marginal zone (MALT) lymphoma, and it changes management the day it is reported: gastric MALT lymphoma carrying it does not respond to <i>Helicobacter pylori</i> eradication, the first-line treatment for the ones without it, so the patient moves to radiotherapy or systemic treatment instead of antibiotics. Three rarer MALT translocations reach the same NF-kB pathway: t(1;14) with <i>BCL10</i>, t(14;18) with <i>MALT1</i>, and t(3;14) with <i>FOXP1</i>." },
    { chroms: ["4", "14"], bands: [["p16.3", "q32"]],
      kind: "juxtaposition", genes: ["IGH", "NSD2"],
      name: "t(4;14), plasma cell myeloma",
      note: "In a plasma cell context this finding means a high-risk myeloma in every current staging system, and it pushes treatment toward proteasome-inhibitor-based regimens. On banding it is cryptic, so it is a FISH call on selected plasma cells rather than a karyotype one. Older reports write the partner as <i>WHSC1</i> or <i>MMSET</i>, both former names of <i>NSD2</i>." },
    { chroms: ["2", "5"], bands: [["p23", "q35"], ["p23.2", "q35.1"]],
      kind: "fusion", genes: ["NPM1", "ALK"],
      name: "t(2;5), ALK-positive anaplastic large cell lymphoma",
      note: "This translocation means ALK-positive anaplastic large cell lymphoma, a disease of younger patients with a markedly better outcome than the ALK-negative counterpart, which is why ALK status rather than morphology drives the prognosis. Relapsed disease is targetable with ALK inhibitors. The same <i>ALK</i>, fused to <i>EML4</i> by inv(2), is the basis of crizotinib in lung adenocarcinoma." },
    // --- sarcoma ---
    { chroms: ["11", "22"], bands: [["q24", "q12"], ["q24.3", "q12.2"]],
      kind: "fusion", genes: ["EWSR1", "FLI1"],
      name: "t(11;22), Ewing sarcoma",
      note: "In a small round blue cell tumour this translocation means Ewing sarcoma, where it accounts for about eighty-five per cent of cases; t(21;22), <i>EWSR1</i>::<i>ERG</i>, covers most of the rest. The fusion is what separates Ewing from lymphoblastic lymphoma and rhabdomyosarcoma, since membranous CD99 does not. An <i>EWSR1</i> break-apart probe lights up across several unrelated sarcomas, so the partner matters." },
    { chroms: ["X", "18"], bands: [["p11.2", "q11.2"], ["p11.23", "q11.2"], ["p11.22", "q11.2"]],
      kind: "fusion", genes: ["SS18", "SSX1"],
      name: "t(X;18), synovial sarcoma",
      note: "This translocation means synovial sarcoma: it is present in essentially every case, monophasic and biphasic alike, which is why the diagnosis is molecular rather than morphological, the tumour having no synovial origin and several imitators. The partner is <i>SSX1</i>, <i>SSX2</i> or rarely <i>SSX4</i>." },
    { chroms: ["2", "13"], bands: [["q35", "q14"], ["q36.1", "q14.1"]],
      kind: "fusion", genes: ["PAX3", "FOXO1"],
      name: "t(2;13), alveolar rhabdomyosarcoma",
      note: "This translocation means fusion-positive alveolar rhabdomyosarcoma, and fusion status now outranks alveolar-versus-embryonal histology in risk stratification: a fusion-negative alveolar tumour behaves like an embryonal one. The variant t(1;13), <i>PAX7</i>::<i>FOXO1</i>, carries a better outlook than <i>PAX3</i>." },
    { chroms: ["12", "16"], bands: [["q13", "p11.2"], ["q13.3", "p11.2"]],
      kind: "fusion", genes: ["FUS", "DDIT3"],
      name: "t(12;16), myxoid liposarcoma",
      note: "This translocation means myxoid liposarcoma and separates it from the other myxoid sarcomas it resembles under the microscope. The disease metastasises to unusual soft-tissue and bone sites rather than to lung, so staging follows the diagnosis." },
    { chroms: ["7", "16"], bands: [["q33", "p11"], ["q33", "p11.2"], ["q34", "p11"]],
      kind: "fusion", genes: ["FUS", "CREB3L2"],
      name: "t(7;16), low-grade fibromyxoid sarcoma",
      note: "This translocation means low-grade fibromyxoid sarcoma, the second <i>FUS</i> sarcoma in the table beside myxoid liposarcoma: the same gene broken at the same band, a different partner, an entirely different tumour. The lesion looks bland enough to pass for benign fibrous tissue, then metastasises years or decades later, which is why making the diagnosis at the start matters. MUC4 immunohistochemistry is the everyday surrogate, and a rare variant fuses <i>FUS</i> to <i>CREB3L1</i>." },

    // --- a second lesion at a chromosome pair already claimed above ----------
    //
    // These records are the reason the table matches breakpoints rather than
    // chromosome pairs. Each shares its pair with an entry elsewhere in the table
    // and is a different disease: a second inv(16), a second t(9;22), a second
    // rearrangement of RARA, and a second t(16;21). The pattern repeats in the
    // sections below with a second t(11;22), a second t(5;14) and a second
    // t(6;11). A matcher that read only the pair would have answered confidently
    // and wrongly for every one of them.
    { chroms: ["16", "16"], bands: [["p13.3", "q24.3"]],
      kind: "fusion", genes: ["CBFA2T3", "GLIS2"],
      name: "inv(16)(p13.3q24.3), pediatric acute megakaryoblastic leukemia",
      note: "This inversion means a pediatric acute megakaryoblastic leukemia of adverse risk, and it is NOT the core-binding-factor inv(16): different breakpoints, different genes, opposite prognosis. It is cryptic on banding and is found by RNA sequencing or FISH, most often in children under five without Down syndrome. The contrast with inv(16)(p13.1q22) is the reason a rearrangement is read at its breakpoints and not at its chromosome number." },
    { chroms: ["9", "22"], bands: [["q22", "q12"], ["q22.33", "q12.2"], ["q31", "q12"]],
      kind: "fusion", genes: ["EWSR1", "NR4A3"],
      name: "t(9;22)(q22;q12), extraskeletal myxoid chondrosarcoma",
      note: "This is a t(9;22) that is not the Philadelphia chromosome: the same two chromosomes at different arms, and it means extraskeletal myxoid chondrosarcoma, a soft-tissue sarcoma of adults that is indolent over years but keeps recurring and metastasises late. Despite the name it is not cartilaginous." },
    { chroms: ["11", "17"], bands: [["q23", "q21"], ["q23.2", "q21.2"]],
      kind: "fusion", genes: ["ZBTB16", "RARA"],
      name: "t(11;17), ATRA-resistant variant APL",
      note: "This translocation means a variant acute promyelocytic leukemia that does NOT respond to all-trans retinoic acid, so recognising it changes treatment in the opposite direction from t(15;17). Any APL-looking marrow without t(15;17) needs its <i>RARA</i> partner identified before ATRA is relied on." },
    { chroms: ["16", "21"], bands: [["q24", "q22"], ["q24.3", "q22.1"]],
      kind: "fusion", genes: ["RUNX1", "CBFA2T3"],
      name: "t(16;21)(q24;q22), AML with RUNX1::CBFA2T3",
      note: "This translocation means an AML that is often therapy-related, following chemotherapy or radiation, and it does poorly. It is the other t(16;21): the same two chromosomes as <i>FUS</i>::<i>ERG</i> at different arms, so the pair cannot be told apart without the breakpoints. <i>CBFA2T3</i> is the closest relative of <i>RUNX1T1</i>, which makes this a structural cousin of t(8;21) with none of its favorable behaviour." },
    // --- further myeloid ---
    { chroms: ["6", "11"], bands: [["q27", "q23"], ["q27", "q23.3"]],
      kind: "fusion", genes: ["KMT2A", "AFDN"],
      name: "t(6;11), KMT2A-rearranged AML",
      note: "This translocation means an adverse-risk AML and one of the worst of the <i>KMT2A</i> partners, in contrast to t(9;11), which is why the partner and not the 11q23 break decides the risk." },
    { chroms: ["10", "11"], bands: [["p12", "q23"], ["p12.31", "q23.3"]],
      kind: "fusion", genes: ["KMT2A", "MLLT10"],
      name: "t(10;11), KMT2A-rearranged leukemia",
      note: "This finding means a <i>KMT2A</i>-rearranged leukemia, AML more often than T-ALL. It frequently arises by a cryptic insertion rather than a visible exchange, so the karyotype can read normal at 11q23 while a break-apart probe is positive." },
    { chroms: ["3", "5"], bands: [["q25", "q35"], ["q25.32", "q35.1"]],
      kind: "fusion", genes: ["NPM1", "MLF1"],
      name: "t(3;5), AML with NPM1::MLF1",
      note: "This translocation means an AML or MDS, often with multilineage dysplasia and in younger patients. It rearranges the same <i>NPM1</i> that is far better known for its insertion mutations in normal-karyotype AML; the dysplastic marrow is the point of difference from that mutation-driven disease." },
    { chroms: ["3", "21"], bands: [["q26", "q22"], ["q26.2", "q22.1"]],
      kind: "fusion", genes: ["RUNX1", "MECOM"],
      name: "t(3;21), therapy-related MDS/AML with RUNX1::MECOM",
      note: "This translocation means a therapy-related MDS or AML after alkylating agents or topoisomerase II inhibitors, and it also appears in CML in blast transformation; either way the risk is adverse. It is the third <i>MECOM</i> lesion after inv(3) and t(3;3), and the second leukemia built on <i>RUNX1</i>: fused to <i>MECOM</i>, the gene lands at the opposite end of the risk table from t(8;21), the same partner-decides-everything lesson as <i>KMT2A</i>." },
    { chroms: ["5", "11"], bands: [["q35", "p15.5"], ["q35.3", "p15.4"], ["q35", "p15"]],
      kind: "fusion", genes: ["NUP98", "NSD1"],
      name: "t(5;11), pediatric AML with NUP98::NSD1",
      note: "This finding means an adverse-risk AML of children and young adults, and the karyotype is usually reported normal: both breakpoints sit in pale subtelomeric bands and the exchanged pieces look alike, so the fusion is found by RT-PCR, FISH or RNA sequencing. It usually travels with <i>FLT3</i>-ITD, and the combination does distinctly badly. The same <i>NSD1</i>, deleted or mutated in the germline, causes Sotos syndrome; broken somatically it drives leukemia." },
    { chroms: ["1", "7"], bands: [["q10", "p10"]],
      kind: "dosage", genes: [],
      name: "der(1;7)(q10;p10), MDS/AML with a whole-arm derivative",
      note: "This whole-arm derivative means an MDS or AML that is often therapy-related, with intermediate to adverse risk. It is an exchange rather than a fusion: the derivative joins the long arm of 1 to the short arm of 7 at the centromere, no gene is broken, and the disease comes from dosage, a gained 1q and a lost 7q, usually written 46,XX,+1,der(1;7)(q10;p10). Risk schemes count it with the 7q-loss group, though reported outcomes are less uniformly bad than monosomy 7. The q10 and p10 breakpoints are the centromeric bands, the same convention as a Robertsonian translocation." },
    // --- further lymphoid ---
    { chroms: ["2", "8"], bands: [["p12", "q24"], ["p11.2", "q24"], ["p11.2", "q24.2"]],
      kind: "juxtaposition", genes: ["IGK", "MYC"],
      name: "t(2;8), Burkitt lymphoma, kappa variant",
      note: "This translocation means Burkitt lymphoma by the kappa light-chain route: <i>MYC</i> stays on chromosome 8 and the immunoglobulin kappa locus moves to it, the reverse direction of travel from t(8;14) with the same result." },
    { chroms: ["8", "22"], bands: [["q24", "q11.2"], ["q24.2", "q11.22"]],
      kind: "juxtaposition", genes: ["IGL", "MYC"],
      name: "t(8;22), Burkitt lymphoma, lambda variant",
      note: "This translocation means Burkitt lymphoma by the lambda light-chain route, the third way to the same overexpressed <i>MYC</i>. It is worth keeping in mind at 22q11 beside the Philadelphia breakpoint, which sits at the same band in a different disease." },
    { chroms: ["14", "16"], bands: [["q32", "q23"], ["q32", "q23.2"]],
      kind: "juxtaposition", genes: ["IGH", "MAF"],
      name: "t(14;16), plasma cell myeloma",
      note: "In a plasma cell context this finding means a high-risk myeloma, associated with more extramedullary disease and plasma cell leukemia presentations. Like t(4;14) it is cryptic on banding, so it is a FISH call on selected plasma cells." },
    { chroms: ["5", "14"], bands: [["q31", "q32"], ["q31.1", "q32"]],
      kind: "juxtaposition", genes: ["IGH", "IL3"],
      name: "t(5;14), B-ALL with eosinophilia",
      note: "This translocation means B-lymphoblastic leukemia with eosinophilia, and the blood count can announce it before the marrow: the eosinophilia is reactive, driven by interleukin-3 placed under the <i>IGH</i> enhancer, and can be marked enough that the blast count is low and the leukemia is missed." },
    { chroms: ["5", "14"], bands: [["q35", "q32"], ["q35.1", "q32.2"]],
      kind: "juxtaposition", genes: ["TLX3", "BCL11B"],
      name: "t(5;14)(q35;q32), T-lymphoblastic leukemia with TLX3",
      note: "This finding means a T-lymphoblastic leukemia, mostly of children, in which <i>TLX3</i> is switched on beside <i>BCL11B</i> regulatory sequence. It is the second t(5;14) in the table and nothing like the first: different bands, different genes, different lineage. Both breaks are subtelomeric, so the exchange is cryptic on banding and turns up by FISH or RNA in around a fifth of childhood T-ALL. A warning against reflexes as well: 14q32 here is <i>BCL11B</i>, not the immunoglobulin heavy chain." },
    { chroms: ["10", "14"], bands: [["q24", "q11"], ["q24.31", "q11.2"]],
      kind: "juxtaposition", genes: ["TRD", "TLX1"],
      name: "t(10;14), T-lymphoblastic leukemia",
      note: "This translocation means a T-lymphoblastic leukemia in which <i>TLX1</i> (also called <i>HOX11</i>) is driven by a T-cell receptor locus, one of the better-outcome subgroups of T-ALL. It is also a reminder of the map: a 14q11 break is the T-cell receptor alpha and delta locus, while a 14q32 break is the immunoglobulin heavy chain." },
    { chroms: ["14", "14"], bands: [["q11", "q32"], ["q11.2", "q32.13"]],
      kind: "juxtaposition", genes: ["TRA", "TCL1A"],
      name: "inv(14) / t(14;14), T-prolymphocytic leukemia",
      note: "Two different rearrangements with one consequence, and either is near-defining for T-prolymphocytic leukemia: inv(14)(q11q32) folds a segment within a single chromosome 14, t(14;14)(q11;q32) is an exchange between the two homologous 14s, and both put <i>TCL1A</i> beside the T-cell receptor alpha enhancer and switch it on in T cells, where it should be off. <i>ATM</i> loss at 11q22.3 is the usual companion. The same inversion appears in the clonal T-cell expansions of ataxia-telangiectasia years before any leukemia." },
    // --- further sarcoma ---
    { chroms: ["21", "22"], bands: [["q22", "q12"], ["q22.2", "q12.2"]],
      kind: "fusion", genes: ["EWSR1", "ERG"],
      name: "t(21;22), Ewing sarcoma variant",
      note: "This translocation means Ewing sarcoma by its commonest variant route, covering most of the cases t(11;22) does not. The disease and the treatment are the same, which is why an <i>EWSR1</i> break-apart probe is the usual test rather than a fusion-specific one." },
    { chroms: ["12", "22"], bands: [["q13", "q12"], ["q13.12", "q12.2"]],
      kind: "fusion", genes: ["EWSR1", "ATF1"],
      name: "t(12;22), clear cell sarcoma",
      note: "This translocation means clear cell sarcoma of soft tissue, a tumour histologically and immunohistochemically close to melanoma, S100 and HMB45 included, so the translocation is what separates them: melanoma has no <i>EWSR1</i> rearrangement, and the distinction changes treatment entirely." },
    { chroms: ["11", "22"], bands: [["p13", "q12"], ["p13", "q12.2"]],
      kind: "fusion", genes: ["EWSR1", "WT1"],
      name: "t(11;22)(p13;q12), desmoplastic small round cell tumour",
      note: "On a karyotype this translocation means one disease: it is found in essentially every desmoplastic small round cell tumour and in nothing else, so the finding itself makes the diagnosis. The reading to guard against is Ewing sarcoma, which also joins chromosomes 11 and 22; the arm of 11 decides it, q24 and <i>FLI1</i> for Ewing, p13 and <i>WT1</i> here. The disease it announces affects adolescent and young adult males, spreads widely across the abdomen and pelvis, and carries a poor outlook. The same <i>WT1</i>, mutated in the germline, causes WAGR and Denys-Drash syndromes." },
    { chroms: ["4", "19"], bands: [["q35", "q13"], ["q35.2", "q13.2"]],
      kind: "fusion", genes: ["CIC", "DUX4"],
      name: "t(4;19), CIC-rearranged sarcoma",
      note: "This translocation means CIC-rearranged sarcoma, the largest group of the round cell sarcomas that look like Ewing and are not: <i>EWSR1</i> break-apart FISH is negative, the course is more aggressive, and the response to Ewing-type chemotherapy is worse, which is why WHO now separates them. A variant t(10;19) reaches the same result through a <i>DUX4</i>-like gene. <i>DUX4</i> itself sits in the D4Z4 repeat at 4q35, the same repeat whose contraction causes facioscapulohumeral muscular dystrophy, one locus with two unrelated diseases." },
    { chroms: ["7", "17"], bands: [["p15", "q21"], ["p15.2", "q11.2"]],
      kind: "fusion", genes: ["JAZF1", "SUZ12"],
      name: "t(7;17), low-grade endometrial stromal sarcoma",
      note: "This translocation means low-grade endometrial stromal sarcoma, a tumour indolent enough to recur a decade later and hormone-responsive enough that endocrine therapy is standard; the fusion joins <i>JAZF1</i> to the Polycomb subunit <i>SUZ12</i>. It is historically written t(7;17)(p15;q21), though <i>SUZ12</i> in fact sits at 17q11.2, and both spellings are read here. The high-grade disease is a different lesion, most often a <i>YWHAE</i> rearrangement, so grade and genetics travel together." },
    { chroms: ["16", "17"], bands: [["q22", "p13"], ["q21", "p13.2"]],
      kind: "juxtaposition", genes: ["CDH11", "USP6"],
      name: "t(16;17), aneurysmal bone cyst",
      note: "This translocation means primary aneurysmal bone cyst, and it settled an argument: the lesion looked reactive and is in fact a true neoplasm, with the <i>CDH11</i> promoter driving an intact <i>USP6</i>. The diagnostic use runs in reverse, since secondary aneurysmal-bone-cyst-like change in other bone tumours lacks any <i>USP6</i> rearrangement. <i>USP6</i> takes many partners; with <i>MYH9</i> it makes nodular fasciitis, which grows alarmingly, regresses on its own, and has been called a transient neoplasm." },
    { chroms: ["1", "13"], bands: [["p36", "q14"], ["p36.13", "q14.11"]],
      kind: "fusion", genes: ["PAX7", "FOXO1"],
      name: "t(1;13), alveolar rhabdomyosarcoma variant",
      note: "This translocation means alveolar rhabdomyosarcoma by the less common and better partner: <i>PAX7</i>::<i>FOXO1</i> carries a distinctly better outlook than <i>PAX3</i>::<i>FOXO1</i>, in younger patients with more often localised disease, which is why the partner belongs in the report." },
    { chroms: ["12", "15"], bands: [["p13", "q25"], ["p13.2", "q25.3"]],
      kind: "fusion", genes: ["ETV6", "NTRK3"],
      name: "t(12;15), ETV6::NTRK3 fusion",
      note: "This one translocation means different diseases by organ: infantile fibrosarcoma in soft tissue, congenital mesoblastic nephroma in the kidney, and secretory carcinoma in breast and salivary gland. It is highly actionable wherever it appears, since <i>NTRK</i> fusions respond to larotrectinib and entrectinib across tumour types, one of the clearest cases of treatment following the fusion rather than the organ." },
    { chroms: ["17", "22"], bands: [["q21", "q13"], ["q21.33", "q13.1"]],
      kind: "fusion", genes: ["COL1A1", "PDGFB"],
      name: "t(17;22), dermatofibrosarcoma protuberans",
      note: "This rearrangement means dermatofibrosarcoma protuberans, though the karyotype usually shows it as a supernumerary ring chromosome built from 17 and 22 material rather than a balanced exchange. The fusion puts <i>PDGFB</i> under a strong collagen promoter, which is why imatinib works in unresectable and metastatic disease." },
    { chroms: ["X", "17"], bands: [["p11.2", "q25"], ["p11.23", "q25.3"]],
      kind: "fusion", genes: ["ASPSCR1", "TFE3"],
      name: "t(X;17), alveolar soft part sarcoma and TFE3 renal cell carcinoma",
      note: "This translocation means one of two diseases carrying one fusion: alveolar soft part sarcoma, where the derivative is usually unbalanced as der(17)t(X;17), and TFE3-rearranged renal cell carcinoma, where the exchange tends to be balanced. The renal disease belongs to children and young adults and is over-represented after childhood chemotherapy; <i>TFE3</i> takes other partners there, most often <i>PRCC</i> in a t(X;1). TFE3 immunohistochemistry marks both." },
    // --- carcinoma ---
    { chroms: ["6", "11"], bands: [["p21", "q12"], ["p21.1", "q13.1"]],
      kind: "juxtaposition", genes: ["MALAT1", "TFEB"],
      name: "t(6;11)(p21;q12), TFEB renal cell carcinoma",
      note: "This translocation means TFEB-rearranged renal cell carcinoma, the other half of the MiT family beside <i>TFE3</i>, and the second t(6;11) in the table, on the opposite arms from the <i>KMT2A</i> leukemia. No new protein is made: the promoter of <i>MALAT1</i>, a long non-coding RNA, drives an intact <i>TFEB</i>. The tumour belongs to children and young adults, often runs indolent, and stains like a melanoma, cathepsin K and melanocytic markers positive." },
    { chroms: ["15", "19"], bands: [["q14", "p13.1"], ["q13", "p13.1"]],
      kind: "fusion", genes: ["BRD4", "NUTM1"],
      name: "t(15;19), NUT carcinoma",
      note: "This translocation means NUT carcinoma, an aggressive midline carcinoma of children and young adults with median survival under a year. Almost no other carcinoma is defined by a single rearrangement: solid tumours usually carry complex genomes, and this one was diagnosable from its karyotype before its gene was known. NUT immunohistochemistry is the practical test, and the <i>BRD4</i> partner made the disease the proving ground for BET inhibitors." },
    { chroms: ["2", "2"], bands: [["p21", "p23"]],
      kind: "fusion", genes: ["EML4", "ALK"],
      name: "inv(2)(p21p23), EML4::ALK lung adenocarcinoma",
      note: "This inversion means ALK-positive non-small cell lung cancer, typically adenocarcinoma in younger patients and never or light smokers, and it is treatable with crizotinib and the ALK inhibitors after it. The rearrangement is a short paracentric inversion within 2p, far too small to see on banding, so it is a FISH, immunohistochemistry or sequencing finding, and the notation is taught rather than observed. The same <i>ALK</i> is the t(2;5) partner in anaplastic large cell lymphoma." },
    { chroms: ["10", "10"], bands: [["q11.2", "q21"], ["q11", "q21"]],
      kind: "fusion", genes: ["CCDC6", "RET"],
      name: "inv(10)(q11.2q21), RET-rearranged papillary thyroid carcinoma",
      note: "This inversion, RET/PTC1 in the older literature, means papillary thyroid carcinoma, and it is the classic lesion of the radiation-associated form, which is why its frequency spiked in children after Chernobyl. The contrast worth keeping: germline <i>RET</i> point mutations cause MEN2 and medullary thyroid carcinoma, while somatic <i>RET</i> fusions cause papillary tumours, one gene and two entirely different diseases. Selective RET inhibitors now target both." },
    { chroms: ["2", "3"], bands: [["q13", "p25"], ["q14.1", "p25.2"]],
      kind: "fusion", genes: ["PAX8", "PPARG"],
      name: "t(2;3)(q13;p25), follicular thyroid carcinoma",
      note: "This translocation means a follicular thyroid neoplasm: it appears in follicular carcinoma and in a subset of follicular adenomas, and it does not separate the two on its own, so invasion on histology still makes that call. It is the mirror of <i>RET</i>, marking follicular rather than papillary disease, and it fuses the thyroid transcription factor <i>PAX8</i> to the nuclear receptor <i>PPARG</i>. Fusion-positive carcinomas tend to be smaller and in younger patients." },
  ];

  // ---- curated clinical / board notes --------------------------------------
  // Each matcher inspects a clone and returns notes when it fits.
  var SYNDROMES = [
    { test: function (c) { return trisomy(c, "21"); }, aneuploidy: true, name: "Trisomy 21, Down syndrome",
      note: "The most common autosomal trisomy compatible with life (~1/700 births). Three copies of chromosome 21. Features: characteristic facies, hypotonia, intellectual disability, ~50% congenital heart disease (AV canal), ↑ risk of AML/ALL and early Alzheimer disease. ~95% free trisomy (nondisjunction, ↑ with maternal age), ~4% Robertsonian translocation, ~1% mosaic." },
    { test: function (c) { return trisomy(c, "18"); }, aneuploidy: true, name: "Trisomy 18, Edwards syndrome",
      note: "Three copies of chromosome 18. Clenched fists with overlapping fingers, rocker-bottom feet, micrognathia, congenital heart disease; most die in the first year." },
    { test: function (c) { return trisomy(c, "13"); }, aneuploidy: true, name: "Trisomy 13, Patau syndrome",
      note: "Three copies of chromosome 13. Holoprosencephaly, cleft lip/palate, polydactyly, cutis aplasia; high early mortality." },
    { test: function (c) { return sexCall(c) === "turner"; }, aneuploidy: true, name: "Turner syndrome (45,X and variants)",
      note: "Loss of all or part of the second sex chromosome. 45,X (monosomy X) is classic; variants include an isochromosome i(Xq), a ring r(X), an idic(Y), and 45,X mosaicism (e.g. 45,X/46,XX). Short stature, ovarian dysgenesis/streak gonads, webbed neck, coarctation/bicuspid aortic valve, lymphedema." },
    { test: function (c) { return sexCall(c) === "klinefelter"; }, aneuploidy: true, name: "Klinefelter syndrome (47,XXY and variants)",
      note: "An extra X in a male (≥1 Y with ≥2 X); 47,XXY is classic, with 48,XXXY and 48,XXYY as higher-grade variants. Tall stature, small firm testes, gynecomastia, infertility, low testosterone. The extra X (or Xs) inactivate as Barr bodies." },
    { test: function (c) { return sexCall(c) === "xyy"; }, aneuploidy: true, name: "47,XYY",
      note: "An extra Y. Usually tall stature; typically normal fertility and intelligence within the normal range. Often incidental." },
    { test: function (c) { return sexCall(c) === "xxx"; }, aneuploidy: true, name: "47,XXX, Triple X",
      note: "An extra X in a female. Often mild/absent phenotype; tall stature, sometimes learning difficulties. Two Barr bodies." },
    // The fragile site carries no disease information of its own: fra(11)(q23) and
    // fra(X)(q27.3) are written the same way and mean very different things, so the
    // card is pinned to the band. Xq27.3 is FRAXA (ISCN 5.5.7 a i-iv), which is the
    // only reason the notation is still taught.
    { test: function (c) { return hasFra(c, "Xq27.3"); }, name: "fra(X)(q27.3), Fragile X syndrome (FRAXA)",
      note: "The gap at Xq27.3 reflects an expanded CGG repeat in <i>FMR1</i>: over about 200 repeats the promoter is methylated and the gene is silenced. Intellectual disability, a long face with large ears, macroorchidism after puberty. Diagnosis is molecular, by CGG repeat analysis (PCR and Southern blot), not by karyotype. Cytogenetic scoring was the original test and gave the syndrome its name, but it misses premutation carriers entirely and is no longer used for diagnosis." },
    { test: function (c) { return hasDel(c, "5", "p"); }, name: "del(5p), Cri-du-chat syndrome",
      note: "Terminal deletion of 5p ('5p−'). High-pitched cat-like cry in infancy, microcephaly, hypotonia, intellectual disability." },
    { test: function (c) { return hasDel(c, "4", "p"); }, name: "del(4p), Wolf–Hirschhorn syndrome",
      note: "Deletion of 4p16.3. 'Greek warrior helmet' facies, growth delay, seizures, intellectual disability." },
    { test: function (c) { return hasDelBand(c, "15", "q11"); }, name: "del(15)(q11q13), Prader–Willi / Angelman",
      note: "The 15q11-q13 imprinted region: a paternal deletion → Prader–Willi (hypotonia, hyperphagia/obesity, hypogonadism); a maternal deletion → Angelman ('happy puppet', ataxia, seizures). Parent-of-origin matters." },
    { test: function (c) { return hasDelBand(c, "22", "q11"); }, name: "del(22)(q11.2), DiGeorge / 22q11.2 deletion",
      note: "The most common microdeletion. CATCH-22: Cardiac (conotruncal) defects, Abnormal facies, Thymic aplasia (T-cell immunodeficiency), Cleft palate, Hypocalcemia." },
    // Constitutional, not acquired, though its subject is cancer: the carrier is
    // a balanced-translocation carrier like any other, so the segregation panel
    // stays available, which is exactly what a counselor drawing this family
    // needs. Matched through hasFusion so the breakpoints are read precisely.
    { test: function (c) { return hasFusion(c, { chroms: ["3", "8"], bands: [["p14.2", "q24.1"], ["p14", "q24"]] }); },
      name: "t(3;8)(p14.2;q24.1), familial renal cell carcinoma",
      note: "The classic constitutional cancer translocation: a balanced t(3;8) carried in every cell, first described in a family whose carriers developed multifocal, bilateral clear cell renal cell carcinoma. The break disrupts <i>FHIT</i> at the FRA3B fragile site, but the cancer mechanism is loss, not fusion: a kidney cell can lose the derivative carrying distal 3p, and with it <i>VHL</i>, leaving the remaining <i>VHL</i> allele one hit from inactivation. Carriers of a constitutional translocation involving 3p warrant renal imaging surveillance." },
    // ---- acquired dosage lesions (marrow and tumour karyotypes) -----------
    { test: function (c) { return hasInterstitialQDel(c, "5"); }, acquired: true,
      name: "del(5q), MDS with isolated del(5q)",
      note: "The one marrow karyotype with its own drug: myelodysplastic syndrome with isolated del(5q) causes anemia with a normal or raised platelet count and hypolobated megakaryocytes, and it responds to lenalidomide. The mechanism is haploinsufficiency, <i>RPS14</i> for the anemia and <i>CSNK1A1</i> for the lenalidomide response, with no second hit needed. A co-occurring <i>TP53</i> mutation predicts lenalidomide failure and transformation, so it is worth looking for at diagnosis. Matched only as an interstitial q-arm deletion, so the constitutional 5q35 deletion of Sotos syndrome never collects this note." },
    { test: function (c) { return hasLoss(c, "7") || hasDelMatching(c, "7", /^q(2|3)/); }, acquired: true,
      name: "monosomy 7 / del(7q), MDS and AML",
      note: "This is the most common adverse numeric lesion of myeloid disease, whether the whole chromosome goes or only 7q. It is classic after alkylating chemotherapy or radiation, five to seven years out, often beside del(5q) and <i>TP53</i> loss. In a child or young adult it prompts a thought about germline predisposition, <i>GATA2</i> deficiency and <i>SAMD9</i>/<i>SAMD9L</i>, in which a marrow can even lose the mutant-bearing chromosome 7 as an adaptation. The unbalanced der(1;7)(q10;p10), which also costs 7q, has its own entry." },
    { test: function (c) { return hasGain(c, "8"); }, acquired: true,
      name: "trisomy 8, acquired (marrow)",
      note: "This is the most common acquired trisomy of myeloid disease, intermediate risk where risk is graded. On its own it is not proof of disease: WHO treats +8, del(20q) and loss of Y as insufficient to define MDS without dysplasia, since each can appear in marrows that never progress. The trap runs the other way too: constitutional trisomy 8 mosaicism, Warkany syndrome, can surface in a marrow karyotype and read as acquired, so an unexpected +8 without hematologic disease is worth a fibroblast check." },
    { test: function (c) { return hasIso(c, "17", "q10"); }, acquired: true,
      name: "i(17)(q10), isochromosome 17q",
      note: "One rearrangement, two doses: two long arms and no short arm, so 17q is gained while 17p, and with it <i>TP53</i>, goes missing in a single stroke. As an isolated marrow finding it defines an aggressive MDS/MPN picture. In CML it is a classic major-route sign of clonal evolution toward blast phase, with +8, an extra Philadelphia chromosome and +19. And it is the most common chromosome abnormality of medulloblastoma, the same lesion in a different organ." },
    { test: function (c) { return hasDelMatching(c, "20", /^q/); }, acquired: true,
      name: "del(20q), clonal marrow finding",
      note: "This is a recurrent deletion of myeloid disease with a reputation milder than its looks: in MDS it sits in the good-risk cytogenetic group, and it is common in polycythemia vera and the other myeloproliferative neoplasms. It also appears as clonal hematopoiesis in marrows with normal counts, which is why WHO does not accept it alone as proof of MDS; the dysplasia, not the deletion, makes that call." },
    { test: function (c) { return hasDelBand(c, "13", "q14"); },
      name: "del(13)(q14), retinoblastoma / CLL",
      note: "One band, two eras of cancer genetics. In the germline this is deletion of <i>RB1</i>: retinoblastoma predisposition, the 13q14 deletion syndrome around it, and the ground on which Knudson built the two-hit hypothesis. Acquired in CLL it is the most common and most favorable FISH finding, aimed not at <i>RB1</i> but at the neighbouring microRNA cluster <i>MIR15A</i>/<i>MIR16-1</i>. The tissue the karyotype came from decides which story it is telling." },
    { test: function (c) { return hasDelBand(c, "11", "q22"); }, acquired: true,
      name: "del(11)(q22), CLL with ATM loss",
      note: "This is the CLL deletion that takes <i>ATM</i>: historically bulky nodes and an earlier need for treatment, a disadvantage largely flattened by modern targeted therapy. The same gene inactivated in the germline is ataxia-telangiectasia, and the same gene is the usual companion loss in T-prolymphocytic leukemia, so 11q22.3 is an address worth knowing. It is distinct from the terminal 11q deletion of Jacobsen syndrome further out at q23-q24." },
    { test: function (c) { return hasGain(c, "12"); }, acquired: true,
      name: "trisomy 12, CLL",
      note: "This is the intermediate-risk member of the CLL panel, and the one with a look: atypical lymphocyte morphology and stronger surface immunoglobulin than typical CLL. <i>NOTCH1</i> mutations concentrate here. As with any lone trisomy in blood, an unexpected +12 without disease deserves a thought about constitutional mosaicism before it is called clonal." },
    { test: function (c) { return hasDelBand(c, "17", "p13"); },
      name: "del(17p), TP53 loss / Miller-Dieker",
      note: "The sub-band carries the whole meaning. Acquired, this is loss of <i>TP53</i> at 17p13.1, the single most treatment-changing deletion in CLL and an adverse marker across MDS, AML and myeloma; the remaining allele is so often point-mutated that deletion and mutation testing travel together. Constitutional, a deletion at 17p13.3 is Miller-Dieker syndrome, lissencephaly from <i>PAFAH1B1</i> loss. Same arm, different sub-band, different world." },
    { test: function (c) { return hasIso(c, "12", "p10"); },
      name: "i(12)(p10), Pallister-Killian / germ cell tumour",
      note: "Two readings, split by context. As a mosaic supernumerary chromosome in a child it is Pallister-Killian syndrome, tetrasomy 12p that is classically absent from blood and found in fibroblasts or by microarray. Acquired, i(12p) is the defining chromosome abnormality of germ cell tumours, useful precisely when a poorly differentiated midline tumour in a young adult refuses to declare its lineage." },
    { test: function (c) { return (c.aberrations || []).some(function (a) { return a.kind === "hsr" && (a.chroms || [])[0] === "2" && (((a.breakpoints || [])[0] || [])[0] || "").indexOf("p24") === 0; }); }, acquired: true,
      name: "hsr(2)(p24), MYCN amplification",
      note: "A homogeneously staining region at 2p24 is <i>MYCN</i> amplification until proven otherwise, the defining adverse marker of neuroblastoma: it moves a child to high-risk therapy whatever the stage looks like. Amplification keeps two shapes, built into a chromosome as an hsr or floating free as double minutes, and both mean the same biology." },
    { test: function (c) { return hasKind(c, "dmin"); }, acquired: true,
      name: "double minutes (dmin), gene amplification",
      note: "These tiny paired chromatin bodies, each a circle of amplified DNA with no centromere, are the other face of gene amplification beside the homogeneously staining region. In a child's tumour the classic content is <i>MYCN</i> and the disease neuroblastoma; in AML it is most often <i>MYC</i>. Having no centromeres they segregate unevenly, so their number varies wildly from cell to cell." },
    { test: function (c) { return hasLoss(c, "Y"); }, acquired: true,
      name: "loss of Y, age-related clonal change",
      note: "Written with an explicit -Y, this is usually the marrow of an older man, and loss of Y is the most common acquired chromosome change in that setting: on its own it is evidence of age rather than disease, and WHO does not accept it alone as MDS. Mosaic loss of Y in blood also tracks with smoking and cardiovascular risk in population studies. The constitutional reading, a conceptus with one X and no Y, is Turner syndrome, which is why both notes can appear together for 45,X,-Y." },
    // ---- whole-clone patterns ---------------------------------------------
    { test: function (c) { var n = chromCount(c); return c.ploidy === 2 && n >= 51 && n <= 65 && gainCount(c) >= 4; }, acquired: true, pattern: true,
      name: "high hyperdiploidy (51-65 chromosomes), childhood B-ALL",
      note: "This is the most common favorable category of childhood B-lymphoblastic leukemia: a clone that gained whole chromosomes in one aberrant division rather than rearranging any. The gains are nonrandom, +X, +4, +6, +10, +14, +17, +18 and +21, and the co-occurrence of +4, +10 and +17 marks the best outlook of all. The individual trisomy cards are suppressed here on purpose: +21 inside a hyperdiploid clone is part of the pattern, not Down syndrome." },
    // Ploidy 1 or 2: near-haploid clones are written on a haploid baseline,
    // e.g. 27,X,+10,+14,+18,+21, and parse at ploidy 1.
    { test: function (c) { var n = chromCount(c); return (c.ploidy === 1 || c.ploidy === 2) && n >= 24 && n <= 39; }, acquired: true, pattern: true,
      name: "hypodiploidy (fewer than 40 chromosomes), B-ALL",
      note: "This is the mirror image of high hyperdiploidy with the opposite outlook: near-haploid (24-30 chromosomes) and low-hypodiploid (31-39) B-ALL are among the worst-risk childhood leukemias. About half of low-hypodiploid cases carry a <i>TP53</i> mutation that proves germline, so this karyotype is a Li-Fraumeni evaluation waiting to happen, one of the clearest places a tumour karyotype changes a family's counseling. The laboratory trap: the clone can double itself and masquerade as hyperdiploidy in the fifties; the giveaway is chromosomes sitting at two and four copies rather than three." },
    // ---- constitutional deletions with a cancer thread --------------------
    { test: function (c) { return hasDelBand(c, "1", "p36"); },
      name: "del(1)(p36), 1p36 deletion syndrome",
      note: "This is the most common terminal deletion syndrome: hypotonia, developmental disability, seizures, straight eyebrows and a deep-set look, often submicroscopic and made by microarray rather than banding. The same region is lost somatically in neuroblastoma, where 1p deletion is an adverse marker that travels with <i>MYCN</i> amplification, one address with a constitutional and an acquired story." },
    { test: function (c) { return hasDelBand(c, "11", "p13"); },
      name: "del(11)(p13), WAGR syndrome",
      note: "This deletion removes <i>WT1</i> and <i>PAX6</i> side by side and spells its own phenotype: Wilms tumour, Aniridia, Genitourinary anomalies and a Range of developmental delay. Aniridia in a newborn is the visible flag, and the deletion is the reason it triggers Wilms tumour surveillance, renal ultrasound every three months through early childhood. The same <i>WT1</i> is the desmoplastic small round cell tumour partner and the Denys-Drash gene." },
    { test: function (c) { return hasTerminalDelAt(c, "11", ["q23", "q24"]); },
      name: "del(11)(q23-q24), Jacobsen syndrome",
      note: "This terminal deletion of distal 11q means Jacobsen syndrome: growth and developmental delay, characteristic facies, and the Paris-Trousseau platelet disorder from <i>FLI1</i> loss, so a bleeding history belongs in the workup. Most cases arise de novo; a parental balanced rearrangement is the heritable minority worth excluding. The same <i>FLI1</i>, translocated rather than deleted, is the Ewing sarcoma partner." }
  ];
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
  // ---- matchers for the dosage lesions and whole-clone patterns -----------
  //
  // The joins in FUSIONS answer "what is fused". These answer the other
  // questions a marrow karyotype gets asked: what is gained or lost, and what
  // the whole clone looks like. Matching stays deliberately narrow, an
  // explicit -7 rather than an inferred one, and a deletion only at the bands
  // the acquired lesion actually uses, so Williams syndrome at 7q11.23 and
  // Sotos syndrome at 5q35 never collect a leukemia note.
  function hasLoss(c, chrom) {
    return (c.aberrations || []).some(function (a) { return a.kind === "loss" && (a.chroms || [])[0] === chrom; });
  }
  // An explicit whole-chromosome gain, read from the notation rather than the
  // complement: a supernumerary i(12)(p10) raises the chromosome 12 count too,
  // but it is tetrasomy 12p, not trisomy 12, and must not collect the CLL note.
  function hasGain(c, chrom) {
    return (c.aberrations || []).some(function (a) { return a.kind === "gain" && (a.chroms || [])[0] === chrom; });
  }
  function hasInterstitialQDel(c, chrom) {
    return (c.aberrations || []).some(function (a) {
      var g = (a.breakpoints || [])[0] || [];
      return a.kind === "del" && (a.chroms || [])[0] === chrom && g.length === 2 &&
        g[0].charAt(0) === "q" && g[1].charAt(0) === "q";
    });
  }
  function hasDelMatching(c, chrom, re) {
    return (c.aberrations || []).some(function (a) {
      return a.kind === "del" && (a.chroms || [])[0] === chrom &&
        ((a.breakpoints || [])[0] || []).some(function (b) { return re.test(b); });
    });
  }
  function hasTerminalDelAt(c, chrom, prefixes) {
    return (c.aberrations || []).some(function (a) {
      var g = (a.breakpoints || [])[0] || [];
      return a.kind === "del" && (a.chroms || [])[0] === chrom && g.length === 1 &&
        prefixes.some(function (p) { return g[0].indexOf(p) === 0; });
    });
  }
  function hasIso(c, chrom, band) {
    return (c.aberrations || []).some(function (a) {
      return a.kind === "iso" && (a.chroms || [])[0] === chrom && (((a.breakpoints || [])[0] || [])[0] || "") === band;
    });
  }
  function hasKind(c, kind) { return (c.aberrations || []).some(function (a) { return a.kind === kind; }); }
  function chromCount(c) { var n = 0, comp = c.complement || {}; for (var k in comp) n += comp[k]; return n; }
  function gainCount(c) { return (c.aberrations || []).filter(function (a) { return a.kind === "gain"; }).length; }
  // Constitutional notes first, then the recurrent rearrangements, which are all
  // acquired. The two lists answer different questions and are kept apart for that
  // reason: SYNDROMES matches a whole-chromosome or whole-arm state, FUSIONS
  // matches a named join at named breakpoints, and mixing them is how t(9;22)
  // ended up beside trisomy 21 in one array with a matcher that ignored bands.
  function syndromes(clone) {
    var out = [];
    // The whole-clone pattern cards swallow the constitutional aneuploidy
    // cards: a 54-chromosome hyperdiploid ALL clone contains +21 twice, and
    // printing "Down syndrome" beside it would be confidently wrong, as would
    // "Turner syndrome" on a near-haploid clone that kept a single X. When a
    // pattern fires, entries marked aneuploidy are read as part of the pattern.
    var pattern = false;
    SYNDROMES.forEach(function (s) { try { if (s.pattern && s.test(clone)) pattern = true; } catch (e) {} });
    // A clone built of derivative-type products is an acquired clone whatever
    // else it contains: dic, add and multiple der()s are how tumour karyotypes
    // are assembled, not how constitutional reports read. In that context the
    // constitutional aneuploidy cards stand down (a +13 beside three
    // derivatives is clonal gain, not Patau syndrome; a visitor typed exactly
    // that, 2026-09-09), and below, the complex-karyotype card needs no other
    // anchor. The threshold is two, so a Robertsonian carrier and a
    // translocation Down, each one der, keep their constitutional reading.
    var ACQUIRED_KINDS = { der: 1, dic: 1, add: 1, hsr: 1, dmin: 1 };
    var acquiredContext = (clone.aberrations || []).filter(function (a) { return ACQUIRED_KINDS[a.kind]; }).length >= 2;
    SYNDROMES.forEach(function (s) {
      try {
        if ((pattern || acquiredContext) && s.aneuploidy) return;
        if (s.test(clone)) out.push({ name: s.name, note: s.note, acquired: !!s.acquired });
      } catch (e) {}
    });
    FUSIONS.forEach(function (f) {
      try {
        if (!hasFusion(clone, f)) return;
        // The card is the gene lead plus the note, nothing between: the note's
        // first sentence names the disease and its risk in prose, replacing the
        // telegram of fragments the old disease field produced ("EWSR1::WT1.
        // Desmoplastic small round cell tumour. The same two..."; Dan,
        // 2026-09-09).
        out.push({ name: f.name, acquired: true, genes: f.genes, kind: f.kind,
          note: fusionLead(f) + f.note });
      } catch (e) {}
    });
    // Complex karyotype is a finding about the whole picture, not any single
    // lesion, so it is judged last. It fires only when the clone already
    // carries a recognised acquired lesion, so a constitutional multi-anomaly
    // report is left alone, and never beside a ploidy pattern, where the high
    // abnormality count IS the pattern rather than complexity on top of it.
    try {
      var abs = clone.aberrations || [];
      if (!pattern && abs.length >= 3 && (acquiredContext || out.some(function (s) { return s.acquired; }))) {
        var lost = {};
        abs.forEach(function (a) { if (a.kind === "loss" && a.chroms[0] !== "X" && a.chroms[0] !== "Y") lost[a.chroms[0]] = 1; });
        var monosomies = Object.keys(lost).length;
        var structural = abs.some(function (a) { return a.kind !== "gain" && a.kind !== "loss"; });
        var mono = monosomies >= 2 || (monosomies >= 1 && structural);
        out.push({ name: "Complex karyotype (three or more abnormalities)", acquired: true,
          note: "This clone carries three or more unrelated abnormalities. In MDS and AML that is its own adverse category whatever the individual lesions are, tightly associated with biallelic <i>TP53</i> loss, and in CLL a complex karyotype carries independent weight in the era of targeted therapy." +
            (mono ? " This clone also meets the definition of a monosomal karyotype, two or more autosomal monosomies or one plus a structural abnormality, which marks the worst tier of AML risk." : "") });
      }
    } catch (e) {}
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
    // No numbered example here: beside a karyotype that really involves that
    // chromosome, "so der(9) has chromosome 9's centromere" read as a statement
    // about the case on screen rather than as a placeholder (Dan, 2026-08-30).
    der: "A DERIVATIVE chromosome (der): a structurally rearranged chromosome, built from one or more chromosomes. ISCN names it for the centromere it keeps: the number inside der(…) says whose centromere survives, whatever else the derivative carries, and the der stands in the place of that chromosome.",
    rec: "A RECOMBINANT chromosome (rec): the rearranged product a crossover creates in the child of a parent who carries an inversion or insertion. The duplicated segment is written out; the deleted one is inferred.",
    rob: "A ROBERTSONIAN translocation (rob): two acrocentric chromosomes (13, 14, 15, 21 or 22) fused at the centromere into one chromosome, with their satellite-bearing short arms lost. A balanced carrier has 45 chromosomes and is healthy; the risk appears in their gametes.",
    t: "A TRANSLOCATION (t): two chromosomes exchange segments. When nothing is lost or gained it is balanced; each product keeps its own centromere and is named for it.",
    dic: "A DICENTRIC chromosome (dic): one chromosome carrying TWO centromeres, formed when two broken chromosomes fuse. One centromere is usually inactivated, which lets it segregate like a normal chromosome.",
    idic: "An ISODICENTRIC chromosome (idic): a mirror-image chromosome with two centromeres, made of two copies of the same material joined end to end. The commonest is idic(15), a supernumerary made of two 15 short-arm-and-proximal-q pieces. It forms from a single break on one chromosome's sister chromatids; a fusion of both homologues is written dic(N;N) instead.",
    i: "An ISOCHROMOSOME (i): a mirror-image chromosome of two identical arms about one centromere, with the other arm lost. i(X)(q10) is two X long arms; the carrier is trisomic for that arm and monosomic for the lost one. ISCN reserves i for arms proven identical (homozygous) and writes der(N;N) when that is not proven or the arms differ.",
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

  // Cancer genes a cytogenetics reader knows by band, for the net-imbalance
  // table's optional gene layer (Dan, 2026-08-30). Data only: gene symbol,
  // chromosome, band, as assigned by HGNC; the POSITION is resolved through the
  // app's own band map (Karyo.resolveBand), so there is exactly one source of
  // coordinates and a typo here fails the resolving test rather than mapping
  // silently to nowhere. Curated and deliberately short: the classics of
  // clinical cytogenetics, not a gene census, and a teaching aid rather than a
  // clinical annotation.
  var CANCER_GENES = [
    { g: "MYCN", c: "2", b: "p24.3" }, { g: "ALK", c: "2", b: "p23.2" },
    // GATA2 earns its place as the OTHER breakpoint of inv(3)/t(3;3): the lesion
    // moves its distal enhancer onto MECOM, so a reader looking at 3q21.3 is
    // looking at the half of the event that is easy to miss.
    { g: "MECOM", c: "3", b: "q26.2" }, { g: "GATA2", c: "3", b: "q21.3" },
    // Every partner named in FUSIONS is on the map, so the "at the breakpoints"
    // line can name both ends of a rearrangement rather than whichever end
    // happened to be listed already. A gene missing here does not break a fusion
    // note; it silently drops half of that note's breakpoint line, which is worse
    // than an obvious failure, so the two lists are checked against each other by
    // test/fusion-table.test.js.
    { g: "DEK", c: "6", b: "p22.3" }, { g: "NUP214", c: "9", b: "q34.13" },
    { g: "MLLT3", c: "9", b: "p21.3" }, { g: "AFF1", c: "4", b: "q21.3" },
    { g: "MLLT1", c: "19", b: "p13.3" }, { g: "RBM15", c: "1", b: "p13.3" },
    { g: "MRTFA", c: "22", b: "q13.1" }, { g: "KAT6A", c: "8", b: "p11.21" },
    { g: "CREBBP", c: "16", b: "p13.3" }, { g: "FUS", c: "16", b: "p11.2" },
    { g: "ERG", c: "21", b: "q22.2" }, { g: "TCF3", c: "19", b: "p13.3" },
    { g: "PBX1", c: "1", b: "q23.3" }, { g: "HLF", c: "17", b: "q22" },
    { g: "BCL2", c: "18", b: "q21.33" }, { g: "BCL6", c: "3", b: "q27.3" },
    { g: "BIRC3", c: "11", b: "q22.2" }, { g: "MALT1", c: "18", b: "q21.32" },
    { g: "NSD2", c: "4", b: "p16.3" }, { g: "EWSR1", c: "22", b: "q12.2" },
    { g: "FLI1", c: "11", b: "q24.3" }, { g: "SS18", c: "18", b: "q11.2" },
    { g: "SSX1", c: "X", b: "p11.23" }, { g: "PAX3", c: "2", b: "q36.1" },
    { g: "FOXO1", c: "13", b: "q14.11" }, { g: "DDIT3", c: "12", b: "q13.3" },
    { g: "CBFA2T3", c: "16", b: "q24.3" }, { g: "GLIS2", c: "16", b: "p13.3" },
    { g: "NR4A3", c: "9", b: "q22.33" }, { g: "ZBTB16", c: "11", b: "q23.2" },
    { g: "AFDN", c: "6", b: "q27" }, { g: "MLLT10", c: "10", b: "p12.31" },
    { g: "MLF1", c: "3", b: "q25.32" }, { g: "IGK", c: "2", b: "p11.2" },
    { g: "IGL", c: "22", b: "q11.22" }, { g: "MAF", c: "16", b: "q23.2" },
    { g: "IL3", c: "5", b: "q31.1" }, { g: "TRD", c: "14", b: "q11.2" },
    { g: "TLX1", c: "10", b: "q24.31" }, { g: "ATF1", c: "12", b: "q13.12" },
    { g: "PAX7", c: "1", b: "p36.13" }, { g: "NTRK3", c: "15", b: "q25.3" },
    { g: "COL1A1", c: "17", b: "q21.33" }, { g: "PDGFB", c: "22", b: "q13.1" },
    { g: "ZMYM2", c: "13", b: "q12.11" }, { g: "PCM1", c: "8", b: "p22" },
    { g: "NUP98", c: "11", b: "p15.4" }, { g: "NSD1", c: "5", b: "q35.3" },
    { g: "TLX3", c: "5", b: "q35.1" }, { g: "BCL11B", c: "14", b: "q32.2" },
    { g: "TRA", c: "14", b: "q11.2" }, { g: "TCL1A", c: "14", b: "q32.13" },
    { g: "ASPSCR1", c: "17", b: "q25.3" }, { g: "TFE3", c: "X", b: "p11.23" },
    { g: "BRD4", c: "19", b: "p13.12" }, { g: "NUTM1", c: "15", b: "q14" },
    { g: "EML4", c: "2", b: "p21" }, { g: "RET", c: "10", b: "q11.21" },
    { g: "CCDC6", c: "10", b: "q21.2" }, { g: "PAX8", c: "2", b: "q14.1" },
    { g: "PPARG", c: "3", b: "p25.2" }, { g: "CREB3L2", c: "7", b: "q33" },
    { g: "CIC", c: "19", b: "q13.2" }, { g: "DUX4", c: "4", b: "q35.2" },
    // HGNC files JAZF1 across 7p15.2-p15.1; the map holds one band, and the
    // proximal edge of the range is where the gene body starts.
    { g: "JAZF1", c: "7", b: "p15.2" }, { g: "SUZ12", c: "17", b: "q11.2" },
    { g: "MALAT1", c: "11", b: "q13.1" }, { g: "TFEB", c: "6", b: "p21.1" },
    { g: "CDH11", c: "16", b: "q21" }, { g: "USP6", c: "17", b: "p13.2" },
    { g: "FGFR3", c: "4", b: "p16.3" },
    { g: "KIT", c: "4", b: "q12" }, { g: "PDGFRA", c: "4", b: "q12" },
    { g: "TET2", c: "4", b: "q24" }, { g: "TERT", c: "5", b: "p15.33" },
    { g: "APC", c: "5", b: "q22.2" }, { g: "PDGFRB", c: "5", b: "q32" },
    { g: "NPM1", c: "5", b: "q35.1" }, { g: "MYB", c: "6", b: "q23.3" },
    { g: "EGFR", c: "7", b: "p11.2" }, { g: "MET", c: "7", b: "q31.2" },
    { g: "BRAF", c: "7", b: "q34" }, { g: "EZH2", c: "7", b: "q36.1" },
    { g: "FGFR1", c: "8", b: "p11.23" }, { g: "RUNX1T1", c: "8", b: "q21.3" },
    { g: "MYC", c: "8", b: "q24.21" }, { g: "JAK2", c: "9", b: "p24.1" },
    { g: "CDKN2A", c: "9", b: "p21.3" }, { g: "ABL1", c: "9", b: "q34.12" },
    { g: "WT1", c: "11", b: "p13" }, { g: "CCND1", c: "11", b: "q13.3" },
    { g: "ATM", c: "11", b: "q22.3" }, { g: "KMT2A", c: "11", b: "q23.3" },
    { g: "ETV6", c: "12", b: "p13.2" }, { g: "KRAS", c: "12", b: "p12.1" },
    { g: "MDM2", c: "12", b: "q15" }, { g: "FLT3", c: "13", b: "q12.2" },
    { g: "RB1", c: "13", b: "q14.2" }, { g: "IGH", c: "14", b: "q32.33" },
    { g: "PML", c: "15", b: "q24.1" }, { g: "MYH11", c: "16", b: "p13.11" },
    { g: "CBFB", c: "16", b: "q22.1" }, { g: "TP53", c: "17", b: "p13.1" },
    { g: "NF1", c: "17", b: "q11.2" }, { g: "ERBB2", c: "17", b: "q12" },
    { g: "RARA", c: "17", b: "q21.2" }, { g: "SMAD4", c: "18", b: "q21.2" },
    { g: "STK11", c: "19", b: "p13.3" }, { g: "RUNX1", c: "21", b: "q22.12" },
    { g: "BCR", c: "22", b: "q11.23" }, { g: "NF2", c: "22", b: "q12.2" }
  ];

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
    CANCER_GENES: CANCER_GENES,
    FUSIONS: FUSIONS,
    SYNDROMES: SYNDROMES,
    ARM_INFO: ARM_INFO
  };
})();
