/* KaryoDraw, ISCN karyotype parser.
 *
 * Copyright (C) 2026 StudyRare. KaryoDraw is free software: you may
 * redistribute it and/or modify it under the terms of the GNU Affero General
 * Public License, version 3 or later; see LICENSE. If you run a modified
 * version as a network service you must offer its source to your users (AGPL
 * section 13). Commercial licensing: see LICENSING.md.
 *
 * window.ISCN.parse(str) turns an ISCN karyotype designation into a structured,
 * render-ready model. It is deliberately forgiving: unrecognized tokens produce
 * a warning rather than a hard failure, so a student always gets *something*
 * drawn plus feedback on what was not understood.
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

  // What is left of a breakpoint group once its bands are taken out. splitBands wants
  // an arm letter before the digits, so "q11.1~11.2" and "q11.1-11.2" keep q11.1 and
  // leave "11.2" behind. Separators are not leftovers; anything alphanumeric is.
  function bandResidue(text, bands) {
    var rest = text;
    bands.forEach(function (b) { rest = rest.replace(b, ""); });
    rest = rest.replace(/[~\-\s;:]/g, "");
    return /[0-9a-z]/i.test(rest) ? rest : "";
  }
  // Groups that yielded SOME band but still had text left over. Collected from the
  // aberration's own breakpoints and from any der() sub-op, since both call splitBands.
  // A tilde range is correct ISCN and is NOT flagged: 4.2.1 permits both the repeated
  // arm letter (17p13.3~p13.1) and the shorthand, and ISCN 2024 prints the shorthand in
  // a breakpoint itself, der(18)t(18;19)(q21;p11~12). Only a separator ISCN does not use
  // gets a message, because warning on correct notation is how the box loses authority.
  function collectPartial(into, groupTexts, bandGroups) {
    groupTexts.forEach(function (p, i) {
      var text = String(p || "").trim(), bands = bandGroups[i] || [];
      if (!text || text.indexOf("?") >= 0 || text.indexOf("~") >= 0 || !bands.length) return;
      if (bandResidue(text, bands)) into.push({ text: text, kept: bands[0] });
    });
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
  //
  // ISCN 4.2.1 g gives four more than the plain mat/pat/dn. inh is "inherited, but
  // which parent is not established or disclosed". The d- forms say that only PART
  // of a parental rearrangement was inherited: one derivative out of a balanced
  // translocation, or the recombinant out of a parental inversion. So the child's
  // chromosome is NOT the parent's chromosome. Every rec example in the standard
  // carries one of them, so leaving them out refused every rec ISCN prints.
  var QUAL = {
    c: "constitutional", mat: "maternal in origin", pat: "paternal in origin", dn: "de novo",
    inh: "inherited, parent of origin not stated",
    dmat: "part of a maternal rearrangement", dpat: "part of a paternal rearrangement",
    dinh: "part of an inherited rearrangement, parent of origin not stated"
  };
  function stripQualifier(tok) {
    // Only after a closing paren, a digit, or a sex letter, so an op name like
    // "inc" or a band is never mistaken for a qualifier.
    //
    // Longest first: dmat ends in "mat", so an alternation that offered "mat"
    // earlier would match it, strip three characters, and leave a stray "d" on
    // the end of the token for the leftover reporter to complain about.
    var m = /([)\dXY])(dmat|dpat|dinh|inh|mat|pat|dn|c)$/.exec(tok);
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

  // Chromosomes with a satellited short arm carrying only rDNA repeats. A q10;q10
  // fusion between two of these is a Robertsonian translocation, which is spelled
  // rob()/der() rather than t() because it replaces both chromosomes with one.
  var ACROCENTRIC = { "13": 1, "14": 1, "15": 1, "21": 1, "22": 1 };

  // ISCN 4.2.1 h: "If the rearrangement involves a single chromosome the breakpoints
  // are not separated by a semicolon (;), e.g., inv(2)(p23q11.2), del(4)(p15.3p16.1),
  // r(18)(p11.2q23)". The semicolon is what separates DIFFERENT chromosomes (4.2.1 g),
  // so one inside a single-chromosome rearrangement announces a second chromosome that
  // is not there.
  //
  // del(15)(q11.2;q13) is why this has to be caught rather than tolerated. The parser
  // reads the two sides as separate breakpoint GROUPS, a deletion takes its bands from
  // the first group alone, and the drawing came out as a terminal deletion from 15q11.2
  // with the second breakpoint silently dropped. It drew, it said nothing, and the
  // decode described a larger deletion than the one that was typed.
  //
  // A comma between the bands is repaired the same way, and this has to run BEFORE the
  // comma-inside-parentheses rule, which would otherwise turn del(15)(q11.2,q13) into
  // the semicolon form and teach the exact opposite of 4.2.1 h.
  //
  // Scoped to a token that is an operation followed by two adjacent groups, so a
  // derivative chain (der(9)del(9)(p11)t(9;22)(q34;q11.2)) is never touched: its
  // sub-operations carry their own chromosomes and their semicolons are correct. The
  // chromosome group is skipped when it holds a separator of any kind, so t(9,22),
  // which names two chromosomes with a typo, is left for the comma rule to repair.
  var TWO_GROUPS = /^(\s*)([+\-−–]?)([A-Za-z]+)\(([^()]*)\)\(([^()]*)\)(.*)$/;
  function joinSameChrom(text) {
    var hits = [];
    var out = String(text).split("/").map(function (cl) {
      var lead = (/^(?:mos|chi)\s+/i.exec(cl) || [""])[0];
      var fields = splitTop(cl.slice(lead.length), ",");
      for (var i = 0; i < fields.length; i++) {
        var m = TWO_GROUPS.exec(fields[i]);
        if (!m || /[;,]/.test(m[4]) || !/[;,]/.test(m[5])) continue;
        var fixed = m[1] + m[2] + m[3] + "(" + m[4] + ")(" +
          m[5].replace(/\s*[;,]\s*/g, "") + ")" + m[6];
        hits.push([fields[i].trim(), fixed.trim()]);
        fields[i] = fixed;
      }
      return lead + fields.join(",");
    }).join("/");
    return { text: out, hits: hits };
  }

  // Text an operation did not consume. Most often it is the next aberration with
  // its comma missing (the sign case, which is fully diagnosable); otherwise it is
  // something outside the model, such as an "or" alternative.
  //
  // Both messages lead with the ISCN rule, not with what the parser did. A reader
  // here is a learner who mistyped a karyotype: "was not read" describes the app's
  // internal state, teaches nothing, and leaves them to work out the rule themselves.
  // The rule is the whole point. See the message-voice test.
  function leftoverWarning(raw, leftover) {
    // The message has to fit the leftover it is about. This used to end with a
    // catch-all naming two ISCN features, "or" alternatives and uncertainty markers,
    // whatever the leftover actually was: a bare "14" was answered with a paragraph
    // about notation the reader had never used and no mention of the comma or the sign
    // it was missing. Each branch below is a leftover that can be diagnosed, and the
    // last one says only what is true.
    if (/^[+\-−–](\d+|X|Y)$/.test(leftover)) {
      return "Changes are separated by commas, so “" + leftover + "” needs one before it: “" +
        raw.replace(leftover, "," + leftover) + "”.";
    }
    // A chromosome with neither a comma nor a sign. Both are missing, and naming one
    // of them sends the reader round again for the other.
    if (/^(\d+|X|Y)$/.test(leftover)) {
      return "A change says whether a chromosome was gained or lost, and changes are separated by commas, " +
        "so “" + leftover + "” is “,+" + leftover + "” for an extra copy or “,-" + leftover + "” for a missing one.";
    }
    // Only when the reader really did write one. Anchored at the start rather than on
    // a word boundary: ISCN writes " or " with spaces (4.4.1) and the parser strips
    // them, so "del(5)(q13q33) or del(5)(q14q34)" reaches here as "ordel(5)(q14q34)".
    // No ISCN abbreviation begins with "or", so this cannot catch a real operation.
    if (/^or(?=[a-z(])/i.test(leftover)) {
      return "ISCN writes two possible readings of the same result with “or”, and KaryoDraw draws one " +
        "karyotype at a time, so “" + leftover.replace(/^or/i, "") + "” has to be entered on its own to see it.";
    }
    return "A karyotype is a list of changes separated by commas, and “" + leftover + "” in “" + raw +
      "” is not one KaryoDraw can place. Changes look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2).";
  }

  // How many breakpoints an operation takes before it describes anything.
  //
  // An operation knows its own arity: an inversion needs the two ends of the segment
  // it turns over, a translocation needs one breakpoint on every chromosome it
  // involves. Given fewer, the renderer had nothing to draw from and drew anyway,
  // filling the gap from whatever the code happened to do with an absent band. The
  // damage shows plainest in the explanations it produced: inv(9)(p11) came out as
  // "the segment between 9p11 is flipped end-for-end (paracentric)", which invents a
  // second endpoint AND a classification; dup(1) as "the segment  is present twice".
  //
  // NUM is spelled out because "takes 2" reads like a count of something the reader
  // wrote rather than a rule about the notation.
  //
  // Only operations whose ISCN form always carries breakpoints are listed here.
  // r(13), i(X), add(19), der(X) and rob(13;14) are deliberately absent: each reads
  // sensibly with the breakpoints left off, real reports write them that way, and
  // refusing valid ISCN is a worse failure than tolerating invalid ISCN
  // (docs/VALIDATION.md). This table is for the cases where the drawing is a guess.
  var NUM = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"];
  var ARITY = {
    del: { bands: [1, 2], msg: "A deletion says where the chromosome broke, so it needs a band: one for a terminal loss, del(5)(p15.2), or the two that bound the missing piece, del(5)(q13q33)." },
    dup: { bands: [1, 2], msg: "A duplication says which segment is doubled, so it needs the bands that bound it: dup(1)(q22q25)." },
    inv: { bands: [2, 2], msg: "An inversion turns a segment end for end, so it needs the two bands that bound that segment: inv(9)(p13q21). One band cannot say where the segment starts and where it stops." },
    trp: { bands: [1, 2], msg: "A triplication says which segment is present three times, so it needs the bands that bound it: trp(1)(q22q25)." },
    t: { perChrom: true, what: "A translocation", eg: "t(9;22)(q34;q11.2)" },
    // ISCN 5.5.9 a: "Insertions are three-break rearrangements". Between chromosomes
    // that is ins(5;2)(p14;q22q32), within one ins(2)(q13p23p13); either way the piece
    // that moved needs the two bands that bound it, plus the site it landed at.
    //
    // At LEAST three, not exactly three: 5.5.9.3 describes reciprocal insertional
    // events where each chromosome both donates and receives, written with four, e.g.
    // ins(5;6)(q13q23;q15q23). Requiring exactly three refused that verbatim example.
    ins: { perChrom: true, minTotal: 3, what: "An insertion", eg: "ins(5;2)(p14;q22q32)",
      totalMsg: "An insertion moves a piece of chromosome, so it needs the two bands that bound the piece and the band it landed at. Between two chromosomes that is ins(5;2)(p14;q22q32); within one, ins(2)(q13p23p13)." },
    // ISCN 5.5.4 a: for a dicentric "two breakpoints are specified", one on each
    // chromosome. 5.5.4 b: an isodicentric "involve[s] a single breakpoint on sister
    // chromatids and a subsequent reunion". Every dic and idic printed in ISCN 2024
    // carries them, and without them there is no break to fuse or mirror about.
    //
    // This one earns its place because the fallback was the worst kind of wrong.
    // 46,XX,idic(15) drew an untouched chromosome 15 — one centromere, full length,
    // captioned der(15) — so the figure asserted a normal chromosome for notation
    // that names a two-centromere one, silently, with nothing on the page to say so
    // (reported from the live site, 2026-08-28). dic(9;20) was worse again: the
    // second chromosome vanished from the drawing entirely.
    dic: { perChrom: true, what: "A dicentric chromosome", eg: "dic(13;15)(q22;q24)" },
    idic: { bands: [1, 1], msg: "An isodicentric chromosome is broken at one point and rejoined to a mirror image of itself, so it needs the band where it broke: idic(15)(q11.2)." }
  };

  // Are these two breakpoints written in the wrong order along the chromosome?
  //
  // ISCN 2024 Table 3 and 5.5.2 b: breakpoint band designations run **from pter to
  // qter**. That is NOT the same as "from the centromere outward", which is what this
  // function first said and which is backwards on the short arm. Band numbers increase
  // away from the centromere on both arms, so travelling pter to qter means p-arm
  // numbers DESCEND and then q-arm numbers ASCEND:
  //
  //     pter  p15.3 ... p11  cen  q11 ... q33  qter
  //
  // So del(5)(p15.3p15.2) is correct and del(5)(p15.2p15.3) is not, while on the long
  // arm del(5)(q13q33) is correct. ISCN 4.2.1 j.iii settles it with an example that
  // names the parts: dup(1)(p34~32p22), "the distal breakpoint is in 1p34 ... and the
  // proximal breakpoint is in band 1p22". Distal first, on the p arm.
  //
  // Signing the position by arm turns both arms into one ascending axis.
  function bandKey(b) {
    var m = /^([pq])(\d+)(?:\.(\d+))?$/.exec(String(b || ""));
    if (!m) return null;
    var pos = parseFloat(m[2] + (m[3] ? "." + m[3] : ""));
    // Sub-bands compare as decimals, so q11.23 sorts inside q11.2 and before q11.3,
    // which comparing 23 against 3 as integers would get backwards.
    return { arm: m[1], axis: m[1] === "p" ? -pos : pos };
  }
  function bandOrderReversed(chrom, a, b) {
    // An uncertain band (q?, q?2, q21~24) has no single position on that axis, and
    // ISCN writes plenty of them (5.5.2 b.v, 4.2.1 j). Say nothing rather than guess.
    if (/[?~]/.test(String(a)) || /[?~]/.test(String(b))) return false;
    var ka = bandKey(a), kb = bandKey(b);
    if (!ka || !kb) return false;
    return kb.axis < ka.axis;
  }

  // Returns the sentence to show, or "" when the operation has what it needs.
  function arityProblem(op, ab) {
    var rule = ARITY[op];
    if (!rule) return "";
    var groups = (ab.breakpoints || []).filter(function (g) { return g.length; });
    // An operation with a fixed total (ins) is answered by that total whatever the
    // shape of the mistake: "involves two chromosomes so it needs two breakpoints"
    // is true of the groups and wrong about the operation, which needs three.
    if (rule.minTotal) {
      if (!groups.length) return rule.totalMsg;
      var tot = groups.reduce(function (s, g) { return s + g.length; }, 0);
      return (tot >= rule.minTotal && groups.length === (ab.chroms.length || 1)) ? "" : rule.totalMsg;
    }
    if (rule.perChrom) {
      var n = ab.chroms.length;
      if (!n || groups.length === n) return "";
      // The example is fixed rather than built from the reader's own chromosomes:
      // completing t(2;7;5)(q21;p13) means choosing a band on chromosome 5, and an
      // invented band in a teaching message is the thing this whole check exists to
      // stop. State the rule with a real two-way, then apply the count to their input.
      // Singular when the reader named one chromosome. dic(15) reaches this branch
      // (a dicentric of one chromosome is written dic(15;15)(q12;q12) or idic(15)(q12),
      // ISCN 5.5.4 f ix), and "involves one chromosomes, so it needs one breakpoints"
      // is teaching copy that cannot be read as careful.
      var word = NUM[n] || n;
      return rule.what + " names one breakpoint on each chromosome it involves, like " +
        rule.eg + ". “" + op + "(" + ab.chroms.join(";") + ")” involves " + word +
        (n === 1 ? " chromosome, so it needs " : " chromosomes, so it needs ") + word +
        (n === 1 ? " breakpoint." : " breakpoints.");
    }
    var bands = groups.length ? groups[0].length : 0;
    if (bands >= rule.bands[0] && bands <= rule.bands[1]) return "";
    return rule.msg;
  }

  // ISCN abbreviations this app does not model. Each is in the symbol list in Chapter
  // 3 and is perfectly correct to write; the app simply has no drawing for it. Kept
  // apart from the drawn operations so the message can say which of the two it is,
  // because "KaryoDraw does not draw this" and "this is not ISCN" are different
  // sentences and only one of them is true here.
  var NOT_DRAWN = {
    ider: { what: "an isoderivative chromosome", sec: "ISCN 5.5.3" },
    tas: { what: "a telomeric association", sec: "ISCN 5.5.17" },
    trc: { what: "a tricentric chromosome", sec: "ISCN 5.5.19" },
    fis: { what: "a fission at the centromere", sec: "ISCN 5.5.6" },
    qdp: { what: "a quadruplication", sec: "ISCN 5.5.14" },
    psu: { what: "a pseudo-dicentric or pseudo-isodicentric", sec: "ISCN 5.5.4" },
    neo: { what: "a neocentromere", sec: "ISCN 5.5.13" },
    ish: { what: "in situ hybridization", sec: "ISCN Chapter 7" },
    arr: { what: "a microarray result", sec: "ISCN Chapter 8" },
    seq: { what: "a sequencing result", sec: "ISCN Chapter 11" },
    ogm: { what: "an optical genome mapping result", sec: "ISCN Chapter 9" }
  };

  // A chain of op(...) groups run together with no commas between them. Two ISCN
  // constructs are written that way and mean the same thing by it, "here is what
  // this chromosome is made of": der(N) (5.5.2) and rec(N) (5.4.3.2 d, "The
  // aberrations following the abbreviation rec are not separated by a comma").
  // One reader for both, so a fix to how a sub-op is read reaches both.
  function readSubOps(ab, rest, warnings, raw) {
    var sub = [], cursor = 0, unread = "";
    // The leading "?" of 4.2.1 k can sit on a sub-op too: der(1)?t(1;3)(p22;q13)
    // is a derivative 1 whose translocation is the uncertain part. Consumed here
    // rather than left in `unread`, where it was being reported as text the app
    // could not place.
    var subRe = /(\??)([a-zA-Z]+)\(([^)]*)\)(?:\(([^)]*)\))?/g, sm;
    while ((sm = subRe.exec(rest)) !== null) {
      unread += rest.slice(cursor, sm.index);
      cursor = sm.index + sm[0].length;
      if (sm[1]) ab.uncertain = true;
      var subGroups = splitTop(sm[4] || "", ";");
      var subBands = subGroups.map(function (p) { return splitBands(p.trim()); });
      // A sub-op goes through the same splitBands, so it drops a range the same
      // way: der(19)t(X;19)(q11.1-11.2;p13.3) was the report that found this.
      collectPartial(ab.partialBands, subGroups, subBands);
      sub.push({
        op: sm[2].toLowerCase(),
        chroms: splitTop(sm[3], ";").map(function (x) { return x.trim(); }),
        breakpoints: subBands
      });
    }
    unread += rest.slice(cursor);
    ab.subOps = sub;
    // Only op(...) groups are sub-ops. Anything else here was dropped, and a
    // dropped "+14" is worse than a rejection: the drawing looks authoritative
    // and is missing a chromosome. Say so rather than absorbing it.
    if (unread.trim()) { ab.unread = unread.trim(); warnings.push(leftoverWarning(raw, ab.unread)); }
    return sub;
  }

  // Decide whether the renderer has a shape for every sub-operation a der()
  // carries, and refuse the whole drawing when it does not. Found by a visitor's
  // one-click flag: der(15)ins(15)(p11;q23q26) parsed clean and drew an
  // untouched chromosome 15 labeled der(15), because the renderer applied only
  // del/dup/inv/t sub-ops and dropped everything else in silence. A figure that
  // looks authoritative and is false is the worst output this app can produce,
  // so a der whose make-up cannot be drawn draws nothing and says why instead.
  function classifyDerSubOps(ab, warnings) {
    var subs = ab.subOps || [];
    if (!subs.length) return;
    function undrawn(msg) { ab.kind = "unknown"; ab.notDrawn = "der"; warnings.push(msg); }
    var DRAWABLE = { del: 1, dup: 1, inv: 1, t: 1, ins: 1, add: 1, hsr: 1 };
    for (var i = 0; i < subs.length; i++) {
      if (subs[i].op === "r") {
        return undrawn("“" + (ab.note || "der(" + ab.chroms.join(";") + ")") + "” is correct ISCN: a monocentric " +
          "ring is written as a derivative, with the chromosome that provides the centromere first (ISCN 5.5.16 b). " +
          "KaryoDraw does not yet have a drawing for a ring built from named segments, so it draws nothing rather " +
          "than a wrong figure.");
      }
      if (!DRAWABLE[subs[i].op]) {
        return undrawn("“" + (ab.note || "der(" + ab.chroms.join(";") + ")") + "” is correct ISCN: a derivative " +
          "chromosome may be built by more than one rearrangement (ISCN 5.5.2). KaryoDraw does not yet have a " +
          "drawing for a derivative carrying “" + subs[i].op + "”, so it draws nothing rather than a wrong figure.");
      }
    }
    var insOps = subs.filter(function (s) { return s.op === "ins"; });
    if (!insOps.length) return;
    // A same-chromosome ins sub-op with two groups gets the same repair and the
    // same lesson as the standalone form (4.2.1 h): breakpoints on one
    // chromosome are written one after the other.
    insOps.forEach(function (s) {
      if (s.chroms.length === 1 && s.breakpoints.length === 2) {
        var joined = s.breakpoints[0].concat(s.breakpoints[1]);
        warnings.push("An insertion within one chromosome is written as one run, the insertion site first and then " +
          "the segment’s own breakpoints (ISCN 5.5.9.1), so “ins(" +
          s.chroms[0] + ")(" + s.breakpoints.map(function (g) { return g.join(""); }).join(";") + ")” is “ins(" +
          s.chroms[0] + ")(" + joined.join("") + ")”.");
        s.breakpoints = [joined];
      }
    });
    var primary = String(ab.chroms[0]);
    var ins0 = insOps[0];
    var insBands = ins0.breakpoints.reduce(function (a, g) { return a.concat(g); }, []);
    if (ins0.chroms.some(function (x) { return /\?/.test(x); }) || insBands.some(function (b) { return /\?/.test(String(b)); })) {
      return undrawn("“ins(" + ins0.chroms.join(";") + ")…” is correct ISCN: the ? is a placeholder for a chromosome " +
        "or breakpoint that was not determined (ISCN 4.2.1 k). With the inserted material undetermined there is " +
        "nothing to draw, so the karyotype stays undrawn.");
    }
    if (insOps.length > 1 || subs.some(function (s) { return s.op === "t"; })) {
      return undrawn("“" + (ab.note || "der") + "” is correct ISCN: a derivative chromosome may be built by more " +
        "than one rearrangement (ISCN 5.5.2). KaryoDraw does not yet have a drawing for a derivative that combines " +
        "an insertion with a translocation or a second insertion, so it draws nothing rather than a wrong figure.");
    }
    if (ins0.chroms.map(String).indexOf(primary) < 0) {
      return undrawn("“der(" + primary + ")” names the chromosome whose centromere the derivative keeps, so its " +
        "insertion needs to involve chromosome " + primary + ", like der(5)ins(5;2)(q31;p23p13). KaryoDraw has no " +
        "drawing for this combination.");
    }
  }

  // Work out which recombinant chromosome was written, and whether this app has a
  // shape for it. rec(N) names the chromosome whose CENTROMERE the recombinant
  // carries (ISCN 5.5.15 d); after it come the stated duplication and the parental
  // rearrangement the crossover happened in. The deletion is never written down:
  // 5.4.3.2 c says the duplication is explicit and the deletion is inferred, so it
  // is derived here (recDelArm) rather than read.
  //
  // Only the PERICENTRIC inversion form is drawn, and that is a fact about meiosis
  // rather than a shortcut. A crossover inside a PARACENTRIC inversion loop does not
  // make a duplication-and-deletion chromosome at all; it makes an acentric fragment
  // and a dicentric (Thompson & Thompson, 9th ed, Fig 5.12A), so there is no
  // chromosome of this shape to draw and inventing one would teach the wrong figure.
  // Insertion-derived rec (5.5.15 d ii, iii) is real and is a different shape again.
  function classifyRec(ab, warnings, raw) {
    var c = ab.chroms[0], subs = ab.subOps || [];
    var stated = subs.filter(function (s) { return s.op === "dup" || s.op === "del"; })[0];
    var origin = subs.filter(function (s) { return s.op === "inv" || s.op === "ins"; })[0];
    function undrawn(msg) { ab.kind = "unknown"; ab.notDrawn = "rec"; warnings.push(msg); }

    if (origin && origin.op === "ins") {
      return undrawn("“rec” is correct ISCN, a recombinant chromosome (ISCN 5.5.15). KaryoDraw draws the " +
        "ones a parental inversion produces, like rec(2)dup(2p)inv(2)(p21q31)dmat. The ones a parental " +
        "insertion produces are not drawn yet, and nothing is wrong with what you typed.");
    }
    var ibands = (origin && origin.op === "inv" && origin.chroms[0] === c) ? (origin.breakpoints[0] || []) : [];
    var pBand = ibands.filter(function (b) { return b.charAt(0) === "p"; })[0];
    var qBand = ibands.filter(function (b) { return b.charAt(0) === "q"; })[0];
    if (ibands.length >= 2 && !(pBand && qBand)) {
      return undrawn("A recombinant chromosome needs a pericentric inversion, one with a breakpoint in " +
        "each arm, like inv(" + c + ")(p21q31). Both breakpoints in “inv(" + c + ")(" + ibands.join("") +
        ")” are in the same arm, which makes it paracentric, and a crossover inside a paracentric " +
        "inversion loop gives an acentric fragment and a dicentric chromosome instead of a duplication " +
        "and a deletion.");
    }
    // dup(2p) names an ARM, not breakpoints: which of the two segments flanking the
    // inversion the recombinant carries twice. The other one is the deleted one.
    var arm = null;
    if (stated && stated.op === "dup") {
      var am = /^(\d+|X|Y)([pq])$/.exec(String(stated.chroms[0] || ""));
      if (am && am[1] === c) arm = am[2];
    }
    if (!arm || !pBand || !qBand) {
      return undrawn("“rec” is correct ISCN, a recombinant chromosome (ISCN 5.5.15). It is written as the " +
        "chromosome whose centromere it carries, then the duplicated arm, then the parental inversion it " +
        "came from, with no commas between them (ISCN 5.4.3.2 d), like rec(2)dup(2p)inv(2)(p21q31)dmat.");
    }
    ab.recDupArm = arm;
    ab.recDelArm = (arm === "p") ? "q" : "p";
    ab.recInvBands = [pBand, qBand];
    // The two segments the reader needs named, and only one of them is written down.
    ab.recDupBand = (arm === "p") ? pBand : qBand;
    ab.recDelBand = (arm === "p") ? qBand : pBand;
  }

  function parseAberration(tok, warnings, statedFully) {
    statedFully = statedFully || {};
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

    // ISCN 4.2.1 k: a question mark marks the identification as uncertain, and it is
    // "placed either before the uncertain item, or it may replace a chromosome, region,
    // band or subband designation". The two placements mean different things to a
    // drawing, and this is the first: +?8 and ?del(1)(p36.1) say what was seen and add
    // that the caller is not certain of it. Everything needed to draw is there, so it
    // draws, and the decode carries the doubt. The replacing form is handled further
    // down, where there is genuinely nothing to draw.
    //
    // After the sign, because ISCN writes it -?21 and +?8.
    if (tok.charAt(0) === "?") { ab.uncertain = true; tok = tok.slice(1); }

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
      // A supernumerary ring, +r. Same thing as +mar — an extra chromosome whose
      // origin banding cannot identify — except that its shape is known, so it is
      // drawn as a ring and labelled r. The chromosome it came from is not stated,
      // which is exactly why it is not r(13): that names its chromosome.
      //
      // Written +r, or +r1/+r2 when a report distinguishes two rings, or with a
      // count (2r), matching how markers are written. Reached only from this branch,
      // where the token has no parenthesis, so r(13) never lands here.
      var ringM = /^(\d+)(?:[-~]\d+)?r\d*$/i.exec(tok);
      if (ringM) { ab.kind = "mar"; ab.ringMarker = true; ab.count = Math.min(parseInt(ringM[1], 10), MAX_COPIES); return finish(ab); }
      if (/^r\d*$/i.test(tok)) { ab.kind = "mar"; ab.ringMarker = true; return finish(ab); }
      // A bare chromosome number needs a sign to say gained or lost.
      if (/^(\d+|X|Y)$/.test(tok)) {
        warnings.push("“" + raw + "” needs a sign: “+" + tok + "” for a gain (extra copy) or “−" + tok + "” for a loss.");
        ab.note = "unrecognized token";
        return finish(ab);
      }
      warnings.push("“" + raw + "” is not a change KaryoDraw recognizes. Changes look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2).");
      ab.note = "unrecognized token";
      return finish(ab);
    }

    var op = opM[1].toLowerCase();
    var chromGroup = opM[2] || "";
    var bpGroup = opM[3] || "";
    var rest = tok.slice(opM[0].length); // trailing sub-ops (der chains)

    ab.chroms = splitTop(chromGroup, ";").map(function (x) { return x.trim(); }).filter(Boolean);
    // The same mark standing in for a whole chromosome: der(?), t(?;5), dic(17;?).
    // The partner was not identified, which is a statement about the sample and not a
    // mistake in the notation.
    ab.uncertainChroms = ab.chroms.filter(function (c) { return c.indexOf("?") >= 0; });
    // Breakpoints: one group per chromosome (translocation), or one group with
    // multiple bands (del/dup/inv interstitial).
    var bpParts = splitTop(bpGroup, ";");
    ab.breakpoints = bpParts.map(function (p) { return splitBands(p.trim()); });
    // Breakpoint text that yields no band at all is not a breakpoint, and dropping it
    // makes it indistinguishable from having written none: del(5)(zzqewdf2315.2) and
    // del(5) both left breakpoints as [[]], so the gibberish drew a chromosome 5 with
    // no cut point and the app explained it as "everything distal to 5? is lost".
    // index.html's band check could not catch it either, since by then there was no
    // band left to check. Keep the raw text so it can be reported and can block the
    // drawing. An empty group (del(5), r(13)) is legal and is not flagged.
    // A group carrying a question mark is the second placement in 4.2.1 k: the band,
    // region or subband was not determined. Distinct from gibberish, and distinct from
    // an empty group, because the notation is correct and is deliberately withholding
    // the position. splitBands drops the "?" (its pattern wants digits after p or q),
    // so q2?3 came back as q2 and q22.?1 as q22: the app was drawing a precise cut at
    // a band the report had explicitly declined to pin down, which is the one thing
    // this parser exists not to do.
    ab.uncertainBands = bpParts.map(function (p) { return p.trim(); })
      .filter(function (p) { return p.indexOf("?") >= 0; });
    ab.badBands = bpParts.map(function (p) { return p.trim(); })
      .filter(function (p, i) { return p && p.indexOf("?") < 0 && !ab.breakpoints[i].length; });
    // A group that yields SOME bands can still leave text behind. splitBands wants an
    // arm letter before the digits, so "q11.1~11.2" and "q11.1-11.2" keep q11.1 and drop
    // the rest; badBands only catches a group that yields NOTHING, so this went through
    // silently and the figure drew a single precise cut the writer had not asked for.
    // ISCN 4.2.1 writes a range with a tilde and repeats the arm letter (1p34~p35), and
    // that spelling already parses to both bands, so the fix is to name it.
    ab.partialBands = [];
    collectPartial(ab.partialBands, bpParts, ab.breakpoints);

    switch (op) {
      case "del": ab.kind = "del"; break;
      case "dup": ab.kind = "dup"; break;
      case "inv": ab.kind = "inv"; break;
      case "t":
        ab.kind = "t";
        // Both breakpoints at a centromere designation: the exchanged pieces are
        // entire arms. teach.js explains the p10/q10 letters here, because at the
        // centromere they name which centromere HALF each derivative carries and
        // not which arms join, so all four spellings draw the same two chromosomes.
        ab.wholeArm = ab.chroms.length === 2 &&
          ab.breakpoints.length === 2 &&
          ab.breakpoints.every(function (g) { return g.length === 1 && /^[pq]10$/.test(g[0]); });
        // Flagged for parse(), which offers the rob() spelling whether or not the
        // stated count agrees with the t (see the two branches there).
        ab.wholeArmAcro = ab.wholeArm && ab.chroms.every(function (c) { return ACROCENTRIC[c]; });
        break;
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
        if (rest) { ab.note = "der(" + ab.chroms.join(";") + ")" + rest; readSubOps(ab, rest, warnings, raw); classifyDerSubOps(ab, warnings); }
        break;
      // rec(N) is a recombinant chromosome: what an inversion carrier passes on
      // when a crossover falls inside the inversion loop. Its make-up is written
      // as a chain with no commas (ISCN 5.4.3.2 d), exactly like der's, so it is
      // read by the same function; classifyRec then decides whether this app has
      // a shape for it.
      case "rec":
        ab.kind = "rec";
        if (rest) readSubOps(ab, rest, warnings, raw);
        classifyRec(ab, warnings, raw);
        break;
      default:
        ab.kind = "unknown";
        // "Not drawn here" and "not ISCN" are different things, and saying the first
        // as the second is the worst error this app can make. rec, ider, tas, trc,
        // fis and qdp are all in ISCN's own symbol list (Chapter 3); telling a student
        // they are "not an ISCN abbreviation" asserts something false about the
        // standard, in the one place they came to check themselves against it.
        //
        // Section numbers are carried so the reader can go and look, which is the
        // whole of what the app can usefully offer for notation it cannot draw.
        if (NOT_DRAWN[op]) {
          ab.notDrawn = op;
          warnings.push("“" + op + "” is correct ISCN, " + NOT_DRAWN[op].what +
            " (" + NOT_DRAWN[op].sec + "), and KaryoDraw does not draw it yet. " +
            "The rest of the karyotype is fine; nothing is wrong with what you typed.");
        } else {
          warnings.push("“" + op + "” in “" + raw + "” is not an ISCN abbreviation. The ones KaryoDraw draws: del, dup, inv, t, i, r, der, rec, add, ins, dic, fra, mar.");
        }
    }
    // Every op except der() and rec() should consume its whole token; leftover text
    // (an "or" alternative, an uncertainty marker, a trailing qualifier) is not
    // modeled, so warn instead of dropping it silently. Those two are exempt because
    // they parse their own sub-op chain above and report their own leftover there.
    //
    // Keyed on the op as WRITTEN, not on ab.kind. rob() sets kind "der" (it behaves
    // exactly like der(13;14)(q10;q10)) but never runs der's sub-op parsing, so a
    // kind test exempted it from both reporters and its leftover vanished:
    // rob(14;21)(q10;q10)+21 dropped the +21 with nothing said. That silence then
    // defeated the unread guard on the count warning below, so the app announced
    // "the number at the start says 46, but this karyotype describes 45 chromosomes"
    // directly above a "did you mean" whose own count is 46. der(13;14)(q10;q10)+14,
    // the same karyotype spelled the other way, always reported it correctly.
    if (op !== "der" && op !== "rec" && ab.kind !== "unknown" && rest && rest.trim()) {
      ab.unread = rest.trim();
      warnings.push(leftoverWarning(raw, ab.unread));
    }
    // Said once per aberration, not once per group: der(?)t(?;5)(?;q13) carries three
    // marks and they are all the same fact.
    if ((ab.uncertainChroms || []).length) {
      warnings.push("The question mark in “" + raw + "” records that the chromosome was not identified, " +
        "which is what ISCN uses it for. KaryoDraw draws the chromosomes it can name, so there is nothing " +
        "here for it to draw. The notation is correct.");
    } else if ((ab.uncertainBands || []).length) {
      warnings.push("The question mark in “" + ab.uncertainBands[0] + "” records that the breakpoint was not " +
        "determined, which is what ISCN uses it for. KaryoDraw cuts a chromosome where it is told to, so " +
        "there is nothing here for it to draw. The notation is correct.");
    }
    (ab.partialBands || []).forEach(function (p) {
      warnings.push("A range of breakpoints is written with a tilde, like q11.1~q11.2 or p11~12. " +
        "Written “" + p.text + "”, the drawing takes one breakpoint, at " + p.kept + ".");
    });
    ab.badBands.forEach(function (b) {
      warnings.push("“" + b + "” in “" + raw + "” is not a breakpoint. A breakpoint is an arm letter " +
        "then a band number, like " + (ab.chroms[0] || "5") + "p15.2 or " + (ab.chroms[0] || "5") + "q31.");
    });
    // Only when the breakpoints that ARE there could be read. del(5)(zzqewdf2315.2)
    // has both problems, and "a deletion needs a band" on top of "zzqewdf2315.2 is not
    // a breakpoint" names the same mistake twice and answers the second question the
    // reader has, not the first.
    // A rearrangement carries its breakpoints the first time it is listed and may omit
    // them afterwards (ISCN 4.2.1 f), so the arity rule has to know what has already
    // been spelled out: 46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10] is
    // correct, and the bare t(9;22) in it is a back-reference, not a translocation
    // missing its breakpoints. Keyed on the operation and its chromosomes, which is
    // what the reader matches it up by.
    //
    // A "?" is the third way the arity message names a mistake nobody made. ISCN
    // 4.2.1 k writes it exactly where a chromosome or a breakpoint was not
    // determined, so t(9;?)(q34;?) and dic(17;?)(q22;?) are CORRECT as printed
    // (the latter is ISCN 5.5.4 f v), and the group the "?" stands in is empty on
    // purpose. Both already say so a line above; adding "so it needs two
    // breakpoints" underneath told the reader to supply the one thing the
    // laboratory could not determine. Same rule as badBands, one row down.
    var opKey = op + "(" + ab.chroms.join(";") + ")";
    if (!ab.badBands.length && !(ab.uncertainChroms || []).length && !(ab.uncertainBands || []).length) {
      var stated = ab.breakpoints.some(function (g) { return g.length; });
      if (stated) statedFully[opKey] = true;
      if (!(!stated && statedFully[opKey])) {
        var arity = arityProblem(op, ab);
        if (arity) { ab.arity = arity; warnings.push(arity); }
      }
    }

    // A translocation between a chromosome and itself. t() describes an exchange
    // between two DIFFERENT chromosomes; a rearrangement inside one chromosome is an
    // inversion, a deletion or a duplication, depending on what happened to the
    // segment. Nothing in ISCN writes an exchange between the two homologs of one
    // pair as t(9;9), and the drawing this produced was two derivatives of 9 that no
    // notation asked for.
    if (op === "t" && ab.chroms.length === 2 && ab.chroms[0] === ab.chroms[1]) {
      ab.arity = ab.arity || "same chromosome twice";
      warnings.push("A translocation is an exchange between two different chromosomes, so “t(" +
        ab.chroms[0] + ";" + ab.chroms[1] + ")” names one chromosome where it needs two. " +
        "A rearrangement within a single chromosome is written inv(" + ab.chroms[0] +
        ")(p13q21) if a segment turned end for end, or del/dup if a segment was lost or doubled.");
    }

    // rob() is the whole-arm fusion of two ACROCENTRIC chromosomes: 13, 14, 15, 21
    // and 22, the five whose short arms carry only ribosomal repeats and satellite
    // DNA, which is why losing them costs nothing and the carrier is balanced. Fuse
    // two metacentrics and you lose two real short arms, which is a different event
    // with a different consequence, so it is not a Robertsonian and must not be
    // drawn as one. Written der() instead, which the message offers.
    if (op === "rob" && ab.chroms.length === 2 &&
        !ab.chroms.every(function (c) { return ACROCENTRIC[c]; })) {
      var nonAcro = ab.chroms.filter(function (c) { return !ACROCENTRIC[c]; });
      ab.arity = ab.arity || "rob between non-acrocentrics";
      warnings.push("A Robertsonian translocation fuses two acrocentric chromosomes, which are 13, 14, 15, 21 and 22. " +
        (nonAcro.length > 1 ? "Chromosomes " + nonAcro.join(" and ") + " are not" : "Chromosome " + nonAcro[0] + " is not") +
        " acrocentric, so a whole-arm exchange involving it loses short-arm material and is written der(" +
        ab.chroms.join(";") + ")(" + (ab.breakpoints.length === 2 ? ab.breakpoints.map(function (g) { return g[0] || "q10"; }).join(";") : "q10;q10") + ").");
    }

    // Interstitial breakpoints written from the telomere inward. ISCN orders the two
    // bands of an interstitial segment from the centromere outward, so del(5)(p15.3p15.2)
    // is del(5)(p15.2p15.3). This one changes how the karyotype is written and NOT
    // what is drawn, since the same segment is bounded either way, so it takes a
    // warning and a repair rather than a refusal, like listing order.
    //
    // del and inv only. dup is deliberately excluded: there the order is meaningful,
    // distinguishing a direct duplication from an inverted one, and the renderer
    // reads it (see the two dup order tests).
    if ((op === "del" || op === "inv") && !ab.badBands.length && !ab.arity) {
      var g0 = ab.breakpoints[0] || [];
      if (g0.length === 2 && bandOrderReversed(ab.chroms[0], g0[0], g0[1])) {
        ab.reversedBands = [g0[0], g0[1]];
        warnings.push("Breakpoints are written in the order they occur along the chromosome, from the tip of " +
          "the short arm to the tip of the long arm, so “" + op + "(" + ab.chroms[0] + ")(" +
          g0[0] + g0[1] + ")” is “" + op + "(" + ab.chroms[0] + ")(" + g0[1] + g0[0] + ")”.");
      }
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
    // A stated ploidy level is not a guess: 58<2n> and 81<3n> say outright which
    // baseline the gains and losses are expressed against (ISCN 6.3.7 e-f), and it is
    // exactly the near-triploid clones where inferring it from the count goes wrong.
    // Believe the notation over the arithmetic.
    // Case-insensitive to match the count-field validation: 58<2N> is accepted
    // there, so the ploidy it states must be believed here too.
    var stated = /<(\d+)n>/i.exec(clone.modalGiven || "");
    if (stated && +stated[1] >= 1 && +stated[1] <= 8) {
      ploidy = +stated[1];
    } else if (clone.modalNumber != null) {
      var p = Math.round(clone.modalNumber / 23);
      // Haploid through octaploid. Haploid is here because near-haploid ALL is real
      // (26,X,+4,+6,+21 is ISCN's own example) and reading it as diploid made the app
      // announce that the changes came to 48 against a stated 26. A larger p is not a
      // real ploidy but a huge or mistyped count, so stay diploid and let the count
      // warning speak rather than allocating p copies of everything.
      if (p >= 1 && p <= 8 && Math.abs(clone.modalNumber - 23 * p) <= 3) ploidy = p;
    }
    clone.ploidy = ploidy;   // exposed so the renderer can spot sex-chromosome aneuploidy
    ALL.forEach(function (c) { comp[c] = 0; });
    AUTOSOMES.forEach(function (c) { comp[c] = ploidy; });
    // Sex chromosomes from the sex field.
    clone.sex.tokens.forEach(function (t) { if (comp[t] !== undefined) comp[t] += 1; });
    // When ISCN omitted the field (5.5.18.1.1 iv, v), the sex chromosomes are the ones
    // named in the rearrangements, one copy each. Without this they stayed at zero and
    // the translocation had no chromosome to attach to.
    if (clone.sexOmitted) {
      (clone.sexFromAbs || []).forEach(function (t) { if (comp[t] !== undefined) comp[t] += 1; });
    }

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
        if (comp[g] === undefined) { warnings.push("“" + g + "” is not a human chromosome. They are numbered 1 to 22, plus X and Y, like +21."); clone.badChrom = true; return; }
        comp[g] += mult;
        for (var gj = 0; gj < mult; gj++) slots[g].push({ chrom: g, kind: "gain", label: g, aberration: ab, primary: g });
      } else if (ab.kind === "loss") {
        var l = ab.chroms[0];
        if (comp[l] === undefined) { warnings.push("“" + l + "” is not a human chromosome. They are numbered 1 to 22, plus X and Y, like -7."); clone.badChrom = true; return; }
        // A stated loss of a SEX chromosome has already happened to the sex field.
        //
        // ISCN 5.3.1.2 ix: "an acquired abnormality is presented in relation to the
        // constitutional karyotype". When the field carries c it IS the constitutional
        // complement, so the change applies on top of it and 46,XXYc,-X comes to 46.
        // Without the c the field is what was actually seen, which already reflects the
        // loss: 45,X,-X (ii), 45,X,-Y (iv) and 45,Y,-X (v) all state 45, and subtracting
        // again lands on 44. A GAIN is additive either way, 47,XX,+X (vi) and
        // 48,XY,+X,+Y (vii), which is why this is scoped to losses.
        //
        // 45,X,-Y is loss of the Y in myeloid disease, among the commonest karyotypes
        // there is, and it was being called a count error.
        //
        // The tolerated case: 46,XY,-Y states a loss the field does not show, and this
        // now accepts it at 46 rather than computing 45 and complaining. ISCN would
        // write that 45,X,-Y. Tolerating notation is the cheaper mistake here; refusing
        // 45,X,-Y is the expensive one.
        // Only when this clone STATED a sex field of its own. A subclone written
        // 45,idem,-X inherits the stemline's field (XX), which is the baseline and not
        // an observation of this clone, so there the loss does apply and 45 is right.
        var sexLossInField = (l === "X" || l === "Y") && !!clone.sexGiven &&
          !(clone.sex && clone.sex.constitutional);
        for (var lj = 0; lj < mult; lj++) {
          if (!sexLossInField) comp[l] -= 1;
          var idx = slots[l].map(function (x) { return x.kind; }).indexOf("normal");
          if (idx >= 0 && !sexLossInField) slots[l].splice(idx, 1);
        }
      } else if (ab.kind === "mar") {
        // marker: an extra small chromosome of unknown origin; "2mar" adds two, etc.
        if (ab.sign !== "-") {
          slots["mar"] = slots["mar"] || [];
          var nmar = Math.min((ab.count || 1) * mult, MAX_COPIES);
          for (var mj = 0; mj < nmar; mj++) {
            comp["mar"] = (comp["mar"] || 0) + 1;
            // A ring marker occupies the same slot as any other marker (an extra
            // chromosome of unknown origin) and differs only in what is known about
            // its shape, which the label and the drawing carry.
            slots["mar"].push({ chrom: "mar", kind: "mar", label: ab.ringMarker ? "r" : "mar",
              ring: !!ab.ringMarker, aberration: ab, primary: "mar" });
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
          if (comp[c] === undefined) { if (String(c).indexOf("?") < 0) { warnings.push("“" + c + "” is not a human chromosome. They are numbered 1 to 22, plus X and Y."); clone.badChrom = true; } return; }
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
            if (comp[c] === undefined) { if (String(c).indexOf("?") < 0) { warnings.push("“" + c + "” is not a human chromosome. They are numbered 1 to 22, plus X and Y."); clone.badChrom = true; } return; }
            var ridx = firstNormal(slots[c]);
            if (ridx >= 0) { slots[c].splice(ridx, 1); comp[c] -= 1; }
          });
          var dc = ab.chroms[0];
          if (comp[dc] !== undefined) { slots[dc].push(mkDer(dc, ab)); comp[dc] += 1; }
        }
      } else if (["del", "dup", "inv", "add", "ring", "iso", "der", "fra", "trp", "hsr", "rec"].indexOf(ab.kind) >= 0) {
        var c0 = ab.chroms[0];
        if (comp[c0] === undefined) { if (String(c0).indexOf("?") < 0) { warnings.push("“" + c0 + "” is not a human chromosome. They are numbered 1 to 22, plus X and Y."); clone.badChrom = true; } return; }
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
      if (ab.kind === "rec") return "rec(" + c + ")";
      if (ab.kind === "fra") return "fra(" + c + ")";
      if (ab.kind === "t" || ab.kind === "dic" || ab.kind === "ins") return "der(" + c + ")";
      return c;
    }
    function firstNormal(arr) { return arr.map(function (x) { return x.kind; }).indexOf("normal"); }

    clone.complement = comp;
    clone.slots = slots;

    // Whole-chromosome gains and losses are listed in ascending chromosome order:
    // 43,XY,rob(14;21)(q10;q10),-21,-20 lists 21 before 20, and drew silently.
    //
    // Scoped hard, on purpose. ISCN's full listing order also covers structural
    // abnormalities, and this app has already taken the opposite position once:
    // segregation.js says "ISCN fixes neither [spelling nor order]" where it builds an
    // order-insensitive comparison key, and the segregation model, which was checked
    // against ISCN 2024 Table 5, emits 46,XX,+der(5)t(2;5)(q21;q31),-2 with 5 before
    // 2. A broader rule flagged that as an error. Since a false accusation here is
    // worse than a missed one, only +N / -N against each other is checked, which is
    // the piece that is not in dispute. Everything else is left alone.
    var numeric = clone.aberrations.filter(function (ab) {
      return (ab.kind === "gain" || ab.kind === "loss") &&
        ab.chroms.length === 1 && /^\d+$/.test(ab.chroms[0]);
    });
    clone.outOfOrder = null;
    for (var oi = 1; oi < numeric.length; oi++) {
      if (parseInt(numeric[oi - 1].chroms[0], 10) > parseInt(numeric[oi].chroms[0], 10)) {
        clone.outOfOrder = { before: numeric[oi].raw, after: numeric[oi - 1].raw };
        break;
      }
    }
    // The same karyotype with only those gains and losses sorted into place; anything
    // else keeps exactly the position it was written in.
    if (clone.outOfOrder) {
      var sorted = numeric.slice().sort(function (a, b) {
        return parseInt(a.chroms[0], 10) - parseInt(b.chroms[0], 10);
      });
      var ni = 0;
      clone.orderedRaws = clone.aberrations.map(function (ab) {
        return numeric.indexOf(ab) >= 0 ? sorted[ni++].raw : ab.raw;
      });
    }

    // Reassemble the clone from everything the parser kept, and compare it with what
    // it was handed. Anything that does not come back was dropped without being
    // understood, and the drawing that follows would be of a karyotype nobody typed.
    //
    // This exists because the alternative is finding these one at a time: 47~49,XY,+8,,
    // has two commas, produced no warning of any kind, and drew a full karyogram. A
    // general net catches the class instead of that one member of it. Fields are
    // compared as WRITTEN (modalGiven, sexGiven, ab.raw), so case, range spelling,
    // "<2n>", multiplier style and qualifiers all survive; 40 varied valid karyotypes
    // round-trip exactly, which is what makes a mismatch worth acting on.
    var rebuilt = [];
    if (clone.modalGiven) rebuilt.push(clone.modalGiven);
    if (clone.sexGiven) rebuilt.push(clone.sexGiven);
    clone.aberrations.forEach(function (ab) { rebuilt.push(ab.raw); });
    var rejoined = rebuilt.join(",");
    if (clone.cellGiven) rejoined += clone.cellGiven;
    // A subclone written with idem/sl/sdl is exempt: "the same changes as the previous
    // clone" is expanded into this clone's list on purpose, so it legitimately carries
    // more than its own text and can never round-trip.
    var inherits = clone.aberrations.some(function (ab) { return ab.kind === "idem"; });
    clone.unaccounted = !inherits && rejoined !== clone.raw;

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
    // Do not argue about the count when part of the designation was not interpreted:
    // the stated number is probably right and our tally is the thing that is short.
    // "Says 46 but describes 45" reads as a claim about the karyotype, and sends
    // people looking for an imbalance that is not there.
    //
    // Two ways a token goes uncounted. It can be leftover text hanging off an
    // aberration that WAS read (ab.unread), or it can be a whole token that failed to
    // become one at all (kind "unknown"). 46,XY,rob(14;21)(q10;q10),21 is the second:
    // the signless 21 contributes nothing to the tally, so the count came out 45 and
    // the app announced a discrepancy underneath the message that actually diagnoses
    // it ("21 needs a sign"). Fix the sign and the count is fine, so saying it was
    // wrong is both unhelpful and, for the +21 reading, untrue.
    // Recorded on the clone, not just used here: parse() has to make the same call
    // about the one-click count fix. Suppressing the warning while still offering
    // "did you mean 45,XY,rob(14;21)(q10;q10),21" would be worse than saying nothing,
    // since that fix keeps the signless 21 and changes the number that was right.
    clone.uncounted = clone.aberrations.some(function (ab) { return ab.unread || ab.kind === "unknown"; });
    // The identical change written twice. ISCN has a notation for a change present on
    // both homologs, and it is not repetition: del(5)(p15.2)x2. Listed twice, the app
    // applied it to one homolog and then to the other, which is what x2 means, so the
    // drawing was right and the notation was not. That is the "how it is written"
    // case, so it warns and offers the multiplier rather than refusing.
    //
    // Compared on the text as written (minus the multiplier, which is the whole
    // point), so del(5)(p15.2) and del(5)(p15.2)x2 together are not called a repeat.
    var seenAb = {};
    clone.aberrations.forEach(function (ab) {
      if (!ab.raw || ab.kind === "unknown" || ab.multiplier > 1) return;
      // Gains and losses are exempt. Listing +21 twice is how ISCN writes two extra
      // copies, and 6.3.7 f prints a triploid clone carrying +X five times and +14
      // three times. The rule is about a STRUCTURAL change repeated instead of
      // written with a multiplier, del(5)(p15.2)x2, which is a different thing.
      if (ab.kind === "gain" || ab.kind === "loss") return;
      var key = String(ab.raw).toLowerCase();
      if (seenAb[key]) { if (!clone.repeatedAb) clone.repeatedAb = ab.raw; return; }
      seenAb[key] = 1;
    });
    if (clone.repeatedAb) {
      warnings.push("A change affecting both copies of a chromosome is written once with a multiplier, " +
        "so “" + clone.repeatedAb + "” twice is “" + clone.repeatedAb + "x2”.");
    }
    // Part of the designation could not be read at all. Distinct from `uncounted`,
    // which is only about whether the tally can be trusted: an unreadable BREAKPOINT
    // leaves the tally fine (a del does not change the count) but leaves the drawing
    // a guess, so it blocks the karyogram and the one-click count fix.
    // Part of the designation could not be read. Any of the three blocks the drawing:
    // a breakpoint group that yielded no band, a token that never became an
    // aberration (a made-up operation, or a chromosome with no sign), and text an
    // operation could not consume. Distinct from `uncounted`, which is only about
    // whether the tally can be trusted.
    // badCount ORs in first: this assignment used to overwrite the count-field
    // junk flag set at parse time, which let 47<2n draw with its warning showing.
    clone.unreadable = clone.badCount === true || clone.aberrations.some(function (ab) {
      // ab.arity: the operation was given fewer breakpoints than it takes, so the
      // drawing would have to invent the rest. Same consequence as a breakpoint that
      // could not be read, and for the same reason.
      // ab.uncertainChroms / ab.uncertainBands: the notation is correct and says the
      // designation was not determined (ISCN 4.2.1 k). Nothing to draw, for the
      // opposite reason to the others here: not that the app could not read it, but
      // that the report declined to say. A LEADING "?" (ab.uncertain) is different and
      // still draws, because everything needed is there.
      return (ab.badBands || []).length > 0 || ab.kind === "unknown" || ab.unread || ab.arity ||
        (ab.uncertainChroms || []).length > 0 || (ab.uncertainBands || []).length > 0;
    // A sex field the app had to edit to use. 43,XZY,… dropped the Z and drew, and
    // 46,QQ,+21 drew a karyogram with no sex chromosomes at all.
    }) || (clone.sex && ((clone.sex.dropped || []).length > 0 ||
      (clone.sexGiven && !clone.sex.tokens.length)))
    // No sex field stated at all: 69.XX, and 46 on its own. The check above cannot
    // see this one, since it compares against a field that was never there.
    || !!clone.sexMissing
    // A chromosome that does not exist (+0, +99), a subclone whose stemline is not
    // there (47,idem,+8 as the only clone), and a clone counted in no cells ([0]).
    // Each already had its message and each still drew, which is the combination this
    // gate exists to stop: a picture that looks like an answer sitting under a
    // sentence saying it is not.
    // badCells is the same call as zeroCells for the same field: [-1] and [2.5] are
    // not counts of cells, so the designation is not valid ISCN. The changes may well
    // be right, and the message says the brackets can come off.
    || !!clone.badChrom || !!clone.danglingIdem || !!clone.zeroCells || !!clone.badCells;
    if (clone.outOfOrder) {
      warnings.push("Whole-chromosome gains and losses are listed in chromosome order, so “" +
        clone.outOfOrder.before + "” comes before “" + clone.outOfOrder.after + "”.");
    }
    // countWrong is the app asserting the count is wrong, and it is set at exactly the
    // point the warning is pushed so the two can never disagree. It is NOT the same as
    // !counts.ok: 48,XY,+8,inc says there are further unidentified changes, so its
    // tally is legitimately short and the app has no business calling that an error.
    //
    // A COMPOSITE karyotype (cp) is the same case for a different reason: the changes
    // listed are the union of what was seen across several cells and no single cell
    // carried all of them, so the modal number and the tally are describing different
    // things (ISCN 6.3.5). 48,XX,+7,+9,+11,+13[cp5] is ISCN's own example, and the app
    // was announcing that it came to 50. A range (45~48,XX,+8[cp10]) hid this, because
    // the range happened to cover the difference.
    clone.countWrong = false;
    if (!clone.counts.ok && clone.sex.tokens.length > 0 && !clone.incomplete &&
        !clone.composite && !clone.uncounted) {
      clone.countWrong = true;
      var want = clone.modalHigh != null ? (clone.modalNumber + "–" + clone.modalHigh) : String(clone.modalNumber);
      // Two things this has to get right.
      //
      // Attribution. "This karyotype describes 46 chromosomes" states our arithmetic
      // as a property of the karyotype, which is more authority than we have earned:
      // `actual` is just the sum of the copies this app worked out, and if that
      // working is wrong the sentence is wrong with the same confidence. Saying the
      // listed changes "add up to" 46 says whose sum it is and invites the reader to
      // check it, which is the honest claim and the more useful one.
      //
      // No reference to the drawing, tempting as it is (actual IS the number of
      // copies drawn, so they can never disagree). A bad band such as
      // 47,XY,del(5)(zz15.2) raises this warning AND stops the karyogram being drawn
      // at all, so pointing at a picture would sometimes point at nothing.
      //
      // And it names the rule, since a learner who does not already know the leading
      // number is the cell's total cannot act on "these two disagree".
      // Name the thing that actually disagrees with the number. "the changes listed
      // after it" is wrong for 50,XXXXXXX, which lists no changes at all: there the
      // number disagrees with the sex chromosomes.
      var disagrees = clone.aberrations.length
        ? "the changes listed after it"
        : (22 * clone.ploidy) + " autosomes and the " + clone.sex.tokens.length +
          " sex chromosomes listed after it";
      warnings.push("The number at the start says " + want + ", but " + disagrees + " add up to " +
        actual + " chromosomes. That first number is the cell's total chromosome count, so either it or the " +
        (clone.aberrations.length ? "changes" : "sex chromosomes") + " needs fixing.");
    }
  }

  function parseSex(field, warnings) {
    var tokens = [], bad = [];
    if (!field) { return { tokens: tokens, label: "", note: "no sex chromosomes stated" }; }
    // ISCN 4.2.1 e and 5.3.1.2 viii: "c" after the sex complement marks the WHOLE
    // complement as the constitutional one, in a report whose subject is a neoplasm.
    // 48,XXYc,+X is an acquired gain of an X in someone with Klinefelter syndrome, so
    // XXY is what that person started with. A trailing "?" is 5.3.1.2 x, where it is
    // unclear whether the complement is constitutional or acquired (47,XXX?c).
    //
    // It changes the arithmetic, not just the label: with c the field is the baseline
    // the changes are applied to, and without it a stated sex-chromosome LOSS has
    // already happened to the field. See buildComplement.
    var constitutional = false;
    var cm = /\??c$/.exec(field);
    if (cm && /[XY]/.test(field.slice(0, cm.index))) {
      constitutional = true;
      field = field.slice(0, cm.index);
    }
    for (var i = 0; i < field.length; i++) {
      var ch = field[i].toUpperCase();
      if (ch === "X" || ch === "Y") tokens.push(ch);
      else bad.push(field[i]);
    }
    if (tokens.length === 0) {
      warnings.push("The 2nd field is the sex chromosomes, written with X and Y: XX, XY, X, XXY. “" +
        field + "” has neither, so the sex chromosomes may have been skipped.");
    } else if (bad.length) {
      warnings.push("The sex chromosomes are written with X and Y only, so “" + bad.join("") + "” in “" + field + "” is not one of them.");
    }
    var label = tokens.join("");
    var SEX_NOTE = {
      "XX": "two X (usual female karyotype)", "XY": "one X, one Y (usual male karyotype)",
      "X": "a single X (monosomy X)", "XXY": "two X + one Y",
      "XYY": "one X + two Y", "XXX": "three X",
      "XXYY": "two X + two Y", "XXXX": "four X", "XXXY": "three X + one Y"
    };
    var note = SEX_NOTE[label] || (tokens.length + " sex chromosome" + (tokens.length === 1 ? "" : "s"));
    // Recorded so the drawing can be refused. This is the one dropped-input case the
    // round-trip cannot see: it compares each field AS WRITTEN, so "XZY" round-trips
    // intact while the Z is quietly discarded INSIDE the field.
    return { tokens: tokens, label: label, note: note, dropped: bad, constitutional: constitutional };
  }

  function parseClone(cloneStr, warnings, statedFully) {
    statedFully = statedFully || {};
    var clone = {
      raw: cloneStr.trim(), cellCount: null, composite: false, cellGiven: "",
      modalNumber: null, modalHigh: null, modalGiven: "", sexGiven: "",
      sex: { tokens: [], label: "", note: "" },
      aberrations: []
    };
    var s = clone.raw;

    // trailing [n] cell count or [cpN] composite
    var cnt = /\[(cp)?(\d+)\]\s*$/i.exec(s);
    if (cnt) {
      clone.cellCount = parseInt(cnt[2], 10);
      clone.composite = !!cnt[1];
      clone.cellGiven = cnt[0];   // as written, for the round-trip
      s = s.slice(0, cnt.index).trim();
      // [0] says the clone was found in no cells, which is to say it was not found.
      // The number in brackets is how many metaphases carried this karyotype, so a
      // clone with none of them is not an observation and there is nothing to draw.
      if (clone.cellCount === 0) {
        clone.zeroCells = true;
        warnings.push("The number in brackets is how many cells were counted with this karyotype, so “[0]” " +
          "says it was seen in none of them. A clone that was observed is written with the count of cells " +
          "that carried it, like [20]; leave the brackets off if the count is not being reported.");
      }
    } else {
      // Brackets at the end that are not a cell count. ISCN 4.4.1 d: "Absolute cell
      // numbers are given in square brackets ([ ])", and in a karyotype designation
      // that is the only thing they hold, so the field is diagnosable on sight.
      //
      // Without this, "[-1]" was never recognized as the cell count at all: it stayed
      // stuck to the last change and came back as “[-1]” in “t(9;22)(q34;q11.2)[-1]”
      // is not one KaryoDraw can place, which names the wrong field and teaches a rule
      // about commas to someone whose commas were right. Worse, on "+21[-1]" the
      // missing-comma repair split inside the brackets and offered “+21[,-1]”.
      //
      // Only for a clone that opens with a chromosome count, so an arr or ish
      // description keeps its own message: [GRCh38] is the genome build (Chapter 8)
      // and [100/200] is nuclei scored (Chapter 7), neither of which is a cell count
      // and neither of which belongs to a karyotype designation.
      var badCnt = /^\d/.test(s) ? /\[([^\[\]]*)(\]?)\s*$/.exec(s) : null;
      if (badCnt) {
        clone.badCells = true;
        clone.cellGiven = badCnt[0];   // as written, so the round-trip still balances
        s = s.slice(0, badCnt.index).trim();
        if (badCnt[2] !== "]" && /^(cp)?\d+$/i.test(badCnt[1])) {
          warnings.push("The number of cells is written inside square brackets, so “[" + badCnt[1] +
            "” needs its closing bracket: “[" + badCnt[1] + "]”.");
        } else if (/^cp/i.test(badCnt[1])) {
          warnings.push("A composite karyotype gives the number of cells the changes were collected " +
            "from, so “cp” is followed by a whole number of them, like [cp10]. “" + badCnt[0] +
            "” is not a count of cells.");
        } else {
          warnings.push("The number in brackets is how many cells were counted with this karyotype, " +
            "so it is a whole number of them, like [20], or [cp10] for a composite. “" + badCnt[0] +
            "” is not a count of cells; leave the brackets off if the count is not being reported.");
        }
      }
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
    clone.modalGiven = fields[0];   // as written, so "45<2n>" and "47-49" survive intact
    // No check that a <2n>/<3n> ploidy note agrees with the count in front of it.
    // One was added here and was wrong: the angle brackets state the ploidy level the
    // gains and losses are expressed AGAINST, not a claim about the count. ISCN 6.3.7 f
    // gives 81<3n> ("even though the count is in the near-tetraploid range") and
    // 58<2n> ("in the hypotriploid range ... reported relative to a diploid chromosome
    // number") as correct, and says outright that exceptions are made when biologically
    // significant. There is no arithmetic here to check.
    // ISCN 4.2.1 e: "c" marks a change as constitutional in a report whose subject is a
    // neoplasm, and it goes immediately after the abnormality it describes (48,XX,+8,+21c)
    // or, when it concerns the sex chromosomes, after the whole sex complement
    // (46,XXYc,-X). Never on the count. A warning rather than a refusal: the count reads
    // the same either way, so the drawing is right and only the placement is not.
    if (/^\d+(?:\s*[~\-–]\s*\d+)?c$/i.test(fields[0])) {
      clone.countQualifier = fields[0];
      warnings.push("“c” marks a change as constitutional rather than acquired, so it goes on the change " +
        "it describes, as in 48,XX,+8,+21c, or on the sex complement, as in 46,XXYc. The count itself is " +
        "written “" + fields[0].replace(/c$/i, "") + "”.");
    }
    var mn = /^(\d+)(?:\s*[~\-–]\s*(\d+))?/.exec(fields[0]);
    if (mn) {
      clone.modalNumber = parseInt(mn[1], 10);
      if (mn[2]) clone.modalHigh = parseInt(mn[2], 10);
      // The count field is exactly a number, a range, the constitutional "c"
      // (warned above), or a <Nn> ploidy marker. Anything else used to ride
      // along unread: this regex took the leading digits and nothing ever
      // looked at the rest of the field, so 47<2n (an unclosed ploidy marker)
      // and 47<>2<.>n both drew without a word.
      var restOfCount = fields[0].slice(mn[0].length).trim();
      if (restOfCount && !/^c$/i.test(restOfCount) && !/^<\d+n>$/i.test(restOfCount)) {
        var pd = /^<(\d+)n?>?$/i.exec(restOfCount);
        warnings.push("“" + restOfCount + "” after the count is not something KaryoDraw can read. A count is a " +
          "number (46), a range (47~49), or a number with a ploidy marker (47<2n>)." +
          (pd ? " Did you mean “" + mn[0].trim() + "<" + pd[1] + "n>”?" : ""));
        clone.badCount = true;   // ORed into clone.unreadable later; a direct set here is overwritten
      }
    } else warnings.push("A karyotype starts with the chromosome count (a number like 46). “" + fields[0] + "” is not a number.");

    // sex field (second) — UNLESS the second field is a clonal-evolution marker
    // (idem/sl/sdl). The standard subclone form omits the repeated sex field, e.g.
    // 47,idem,+8: "idem" stands in for the whole stemline, sex included, so the
    // sex is inherited during expansion rather than stated here.
    var firstAb = 2;
    if (fields.length > 1 && /^(idem|sl|sdl)$/i.test(fields[1])) {
      firstAb = 1;
    } else if (fields.length > 1 && fields[1].indexOf("(") >= 0) {
      // ISCN drops the sex field entirely when the sex chromosomes are themselves in
      // the rearrangement: 46,t(X;Y)(q22;q11.23) and
      // 46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31) are both printed that way
      // (5.5.18.1.1 iv and v). A sex field never contains a parenthesis, so the
      // bracket is the tell. Read as a sex field, parseSex harvested the X and Y out
      // of the operation and discarded the rest a character at a time, so the whole
      // translocation vanished and a normal 46,XY was drawn in its place. Whether the
      // omission is legitimate is settled below, once the aberrations are parsed.
      firstAb = 1;
      clone.sexOmitted = true;
    } else if (fields.length > 1) {
      clone.sexGiven = fields[1];   // as written; parseSex normalises case and order
      clone.sex = parseSex(fields[1], warnings);
    } else {
      // No second field at all. ISCN states the sex chromosomes right after the count,
      // and there is nothing to infer them from: "46" is as consistent with XX as with
      // XY. Drawing it picked neither and left both slots labelled "missing", which
      // reads as a finding about the karyotype rather than a gap in the designation.
      // Recorded rather than warned about here, because the draw gate has to refuse it
      // either way while the message depends on what else was said: diagnose() can
      // repair a mistyped separator, and when it has, naming the rule a second time
      // reads as a second, separate problem. parse() pushes the message.
      clone.sexMissing = true;
    }

    // remaining = aberrations (including a leading idem/sl/sdl marker)
    for (var i = firstAb; i < fields.length; i++) {
      clone.aberrations.push(parseAberration(fields[i], warnings, statedFully));
    }

    // The omission is only legitimate when a sex chromosome really is in one of the
    // rearrangements. A leading operation naming none of them is not ISCN's shorthand,
    // it is a karyotype with no sex field at all, and 46 is as consistent with XX as
    // with XY, so it goes back to the existing missing-sex gate.
    if (clone.sexOmitted) {
      var sexSeen = {};
      clone.aberrations.forEach(function (ab) {
        (ab.chroms || []).forEach(function (c) { if (c === "X" || c === "Y") sexSeen[c] = 1; });
        (ab.subOps || []).forEach(function (s) {
          (s.chroms || []).forEach(function (c) { if (c === "X" || c === "Y") sexSeen[c] = 1; });
        });
      });
      clone.sexFromAbs = Object.keys(sexSeen).sort();
      if (!clone.sexFromAbs.length) {
        clone.sexOmitted = false;
        clone.sexMissing = true;
      } else {
        clone.sex = { tokens: [], label: "", dropped: [], omitted: true,
          note: "not written here, because the sex chromosomes are named in the rearrangement instead" };
      }
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
          cl.danglingIdem = true;
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

  // A stray character, said in a way the reader can act on.
  //
  // Every message in this app quotes what it is talking about with curly quotes, which
  // works until the thing being quoted IS a curly quote: pasting a karyotype out of a
  // document produced “These are not characters ISCN uses: ““”, “””.”, where the two
  // characters to remove are invisible inside the quotes reporting them. Anything that
  // cannot survive being quoted is named in words instead.
  var STRAY_NAME = {
    "\u201C": "a curly opening quotation mark", "\u201D": "a curly closing quotation mark",
    "\u2018": "a curly opening apostrophe", "\u2019": "a curly closing apostrophe",
    "\"": "a straight quotation mark", "'": "a straight apostrophe", "`": "a backtick",
    "\u00AB": "a left angle quotation mark", "\u00BB": "a right angle quotation mark"
  };
  function strayName(c) { return STRAY_NAME[c] || "“" + c + "”"; }
  function sentenceCase(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // Spot common typos in the raw text and, where possible, build a corrected
  // "did you mean" string.
  function diagnose(raw, result, warnings) {
    var suggestion = raw;

    // Sentence punctuation at the very end, from prose or a copy-paste. Stripped first so
    // every rule below sees clean text, and because the damage it does is out of all
    // proportion to the character: the cell-count pattern is anchored to the end of the
    // field, so "+21[cp10]." never matched it, and the whole change was reported as an
    // unrecognized token. That named the change rather than the period.
    //
    // Safe at the END of the whole designation only. A sub-band ends in a digit after its
    // period (q24.1), a cell count in "]", a qualifier in a letter; nothing legal ends in
    // one of these marks, and a period INSIDE the text is left untouched.
    // A character that is not part of ISCN at all.
    //
    // ISCN's symbol list (2024, Chapter 3) is closed, and for a karyotype it comes to
    // letters, digits, and , ; : ( ) [ ] < > / + - ~ ? . and the multiplication sign.
    // Anything else arrived from somewhere: a stray keystroke, a bullet or footnote
    // mark pasted out of a question paper, a character mangled by a PDF. There is no
    // ISCN rule to teach about them beyond that they are not karyotype notation, and
    // the useful thing is nearly always the same, so do it: take them out and offer
    // what is left.
    //
    // First, before every other repair, because a stray character breaks whichever
    // field it lands in and the message that field would otherwise produce describes a
    // problem the reader did not make. "der(13;14)(q10;q10) %14" was reported as an
    // unsupported alternative interpretation, which sent a student looking up an ISCN
    // feature she had never used over a character she had not meant to type.
    //
    // The cleaned string is not required to be correct, only to be further along: the
    // fix machinery re-parses it and will say whatever is wrong next (see "A repair
    // does not have to draw; it has to go somewhere" in docs/VALIDATION.md).
    var STRAY = /[^A-Za-z0-9,;:()\[\]<>\/+\-–−~?.×\s]/g;
    var strays = suggestion.match(STRAY);
    if (strays) {
      var uniq = strays.filter(function (c, i) { return strays.indexOf(c) === i; });
      suggestion = suggestion.replace(STRAY, "");
      warnings.push((uniq.length === 1
        ? sentenceCase(strayName(uniq[0])) + " is not a character ISCN uses."
        : "These are not characters ISCN uses: " + uniq.map(strayName).join(", ") + ".") +
        " A karyotype is written with letters, numbers, and the marks , ; ( ) [ ] + - ? ~ and the decimal point.");
    }

    var tailMark = /([.;:]+)$/.exec(suggestion);
    if (tailMark) {
      suggestion = suggestion.slice(0, -tailMark[1].length).trim();
      warnings.push("A karyotype ends with the last change or its cell count, so the “" +
        tailMark[1] + "” at the end does not belong to it.");
    }

    var opens = (raw.match(/\(/g) || []).length, closes = (raw.match(/\)/g) || []).length;
    if (opens !== closes) {
      warnings.push("Unbalanced parentheses, " + opens + " “(” but " + closes + " “)”. Make sure every “(” has a matching “)”.");
    }
    // The comma between the chromosome count and the sex chromosomes, written as
    // anything else or left out. "69.XX" is the whole reason this is one rule rather
    // than the narrower "no separator at all" it replaces: the count pattern read 69
    // and stopped at the period, so the designation stayed a single field, no sex field
    // was ever built, and the app drew 69 chromosomes with both sex slots empty. Every
    // other check was looking elsewhere. The sex-field check compares against a stated
    // field and there was none; the count check is skipped when there are no sex
    // chromosomes to count; and the round-trip keeps the count field as written, so a
    // character dropped INSIDE it is exactly what it cannot see.
    //
    // Safe because the separator alternatives cannot appear there in valid ISCN: the
    // count itself may only carry digits, a range dash or tilde, and a <2n> ploidy note,
    // all of which are consumed before the separator is examined. A comma never matches,
    // so no correctly written karyotype is touched, and the sex letters must not be
    // followed by another letter, so "46XYZ" is left for the sex-field check to refuse.
    var sexSeps = [];
    suggestion = suggestion.split("/").map(function (cl) {
      var lead = (/^(?:mos|chi)\s+/i.exec(cl) || [""])[0];
      var rest = cl.slice(lead.length);
      var m = /^(\d+(?:\s*[~\-–]\s*\d+)?(?:<\d+n>)?)([.;:]|\s+)?([XYxy]{1,4})(?![A-Za-z])/.exec(rest);
      if (!m) return cl;
      sexSeps.push([m[1] + (m[2] || "") + m[3], m[1] + "," + m[3].toUpperCase()]);
      return lead + m[1] + "," + m[3].toUpperCase() + rest.slice(m[0].length);
    }).join("/");
    sexSeps.forEach(function (pair) {
      warnings.push("The chromosome count and the sex chromosomes are separated by a comma, so “" +
        pair[0] + "” is “" + pair[1] + "”.");
    });

    // The sex chromosomes out of order: 46,YX. ISCN lists every X before every Y, so
    // the canonical form is the same letters sorted, and there is only ever one
    // reading of them. A repair rather than a refusal on its own, for the same reason
    // as the missing comma: the reader knows what they meant and needs the rule.
    //
    // Anchored between the count and either a comma or the end of the clone, so it
    // can only ever see the sex field. Reordering, never editing: the letters that
    // come out are the letters that went in, which is what keeps this safe next to
    // the sex-field check that refuses anything it would have had to change.
    var sexOrder = [];
    suggestion = suggestion.split("/").map(function (cl) {
      var lead = (/^(?:mos|chi)\s+/i.exec(cl) || [""])[0];
      var rest = cl.slice(lead.length);
      var m = /^(\d+(?:\s*[~\-–]\s*\d+)?(?:<\d+n>)?,)([XY]{2,4})(,|\[|$)/.exec(rest);
      if (!m) return cl;
      var sorted = m[2].split("").sort().join("");   // X sorts before Y
      if (sorted === m[2]) return cl;
      sexOrder.push([m[2], sorted]);
      return lead + m[1] + sorted + rest.slice(m[0].length - m[3].length);
    }).join("/");
    sexOrder.forEach(function (pair) {
      warnings.push("The sex chromosomes are written with every X before every Y, so “" +
        pair[0] + "” is “" + pair[1] + "”.");
    });
    // A sign is only ever the first character of an aberration (+21, -X, +der(1)),
    // so a sign sitting right after a closing parenthesis means the comma between
    // two aberrations was left out: der(13;14)(q10;q10)+14. Anchoring on the ")"
    // is what makes this safe. A general "sign after a digit" rule would also hit
    // the modal-number range in 45-48,XY and the marker count in 1~3mar, turning
    // "45-48" into "45,-48" (45 chromosomes, minus a chromosome 48) — a repair
    // that reads as valid, so nothing downstream would catch it. No legal
    // designation puts a sign directly after ")", which leaves no such ambiguity.
    // No warning pushed here: the aberration that owns the fragment reports it by
    // name (leftoverWarning), which is more use than a second general note.
    suggestion = suggestion.replace(/\)\s*([+\-−–])/g, "),$1");

    // A SECOND sign inside a token that already begins with one: "-2-21" is two
    // changes with the comma between them left out, and it used to be reported as
    // "“-2-21” is not a change KaryoDraw recognizes", which names the symptom and not
    // the mistake.
    //
    // This is the safe subset of the "sign after a digit" rule rejected above, and
    // what makes it safe is that it is applied per FIELD and never to the first two.
    // The modal-number range (45-48) is field 0 and is never examined; a marker count
    // (1~3mar, 1-3mar) does not begin with a sign, so it is never examined either.
    // Both of the cases that made the general rule unsafe are therefore unreachable.
    var splitSigns = [];
    suggestion = suggestion.split("/").map(function (cl) {
      var lead = (/^(?:mos|chi)\s+/i.exec(cl) || [""])[0];
      var fields = splitTop(cl.slice(lead.length), ",");
      for (var fi = 2; fi < fields.length; fi++) {
        if (!/^[+\-−–]/.test(fields[fi])) continue;
        // The cell count rides on the last field and is not a change, so a sign inside
        // its brackets is not a missing comma. "+21[-1]" was repaired to "+21[,-1]",
        // a string with no reading at all, on top of a message about commas that were
        // never the problem. The count keeps its own diagnosis in parseClone.
        var cells = /\[[^\[\]]*\]?\s*$/.exec(fields[fi]);
        var body = cells ? fields[fi].slice(0, cells.index) : fields[fi];
        var fixed = body.replace(/(.)([+\-−–])/g, "$1,$2") + (cells ? cells[0] : "");
        if (fixed !== fields[fi]) { splitSigns.push([fields[fi], fixed]); fields[fi] = fixed; }
      }
      return lead + fields.join(",");
    }).join("/");
    splitSigns.forEach(function (pair) {
      warnings.push("Changes are separated by commas, so “" + pair[0] + "” is two of them: “" +
        pair[1] + "”.");
    });

    // Breakpoints on one chromosome, separated as though they were on two. Ahead of the
    // comma-inside-parentheses rule below, which would answer del(15)(q11.2,q13) with
    // the semicolon form and teach the opposite of ISCN 4.2.1 h.
    var joined = joinSameChrom(suggestion);
    suggestion = joined.text;
    joined.hits.forEach(function (pair) {
      // An insertion has its own spelling rule, so the generic two-breakpoint
      // lesson would teach the wrong thing about the order: 5.5.9.1 says the
      // insertion site comes first, then the segment's breakpoints, all in one
      // run. Everything else gets the general rule (4.2.1 h).
      if (/^[+\-−–]?ins\(/i.test(pair[0])) {
        warnings.push("An insertion within one chromosome is written as one run, the insertion site first and then " +
          "the segment’s own breakpoints (ISCN 5.5.9.1), so “" + pair[0] + "” is “" + pair[1] + "”.");
      } else {
        warnings.push("Breakpoints on the same chromosome are written one after the other, so “" +
          pair[0] + "” is “" + pair[1] + "”. The semicolon separates different chromosomes, " +
          "as in t(9;22)(q34;q11.2).");
      }
    });

    // An empty field between commas. 47~49,XY,+8,, drew a full karyogram and said
    // nothing at all: the field list is filtered for length, so the blanks vanished
    // before anything could object. Repaired rather than only refused, so the viewer
    // gets the karyotype they meant in one click. Commas inside parentheses are not
    // touched, since splitTop only reaches depth 0.
    var collapsed = suggestion.replace(/,{2,}/g, ",").replace(/^,+/, "").replace(/,+$/, "");
    if (collapsed !== suggestion) {
      warnings.push("Each change is its own item between commas, so an empty item is not one. Remove the extra comma.");
      suggestion = collapsed;
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
    if (suggestion !== raw) {
      // A repair is the karyotype the reader is being asked to accept, so it has to be
      // one they could have typed. ISCN 4.4.1 a: there are no spaces in a designation.
      // Offered as typed, it kept whatever whitespace was in the input, and the strip
      // above can leave a space behind where a stray character was: “46,XY,der(13;14)
      // (q10;q10), “+14”” came back as a suggestion with a space in the middle of it.
      //
      // Whitespace only, and only once a repair is warranted for some other reason.
      // Normalizing before that test would turn "47, XX, +21" into a repair, and spaces
      // are deliberately not an error here (see docs/VALIDATION.md).
      //
      // Two spaces are real ISCN and are kept: the one after a mos/chi prefix (4.4.1 m)
      // and the ones around "or" (4.4.1 i).
      var sLead = (/^(?:mos|chi)\s+/i.exec(suggestion) || [""])[0];
      suggestion = sLead + suggestion.slice(sLead.length)
        .replace(/\s+or\s+/gi, "\u0001")
        .replace(/\s+/g, "")
        .replace(/\u0001/g, " or ");
      result.suggestion = suggestion;
    }
  }

  // depth: 0 for a real call. Vetting a candidate re-parses it at depth 1, where the
  // candidate's own fixes are still listed (the vet asks whether it has any) but are no
  // longer vetted themselves, which is what stops the recursion at one level.
  function parse(input, depth) {
    depth = depth || 0;
    var raw = (input || "").trim();
    var warnings = [];
    var result = { raw: raw, ok: false, warnings: warnings, isMosaic: false, clones: [], suggestion: null, countFix: null, orderFix: null, sexFix: null, sexCountFix: null, fixes: [], note: null };
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
    // The canonical designation, for the input box, the drawing and the share URL. It is
    // the whitespace normalization and NOTHING ELSE, on purpose.
    //
    // It used to be taken after the two strips below, so a pasted “46,XY,der(13;14)
    // (q10;q10), “+14”” was silently rewritten in the box to the clean karyotype while
    // the warning still named the quotation marks and the repair still offered a string
    // that differed from the box by one space. The reader was told to remove characters
    // that were no longer on screen, and offered a fix that looked identical to what they
    // already had, on a karyotype the app then refused to draw. Whitespace is the one
    // thing this app fixes silently, because it is the one thing it does not object to.
    result.normalized = (q ? q[1].toLowerCase() + " " : "") + s;
    // Trailing sentence punctuation, dropped here as well as in diagnose(). diagnose only
    // builds the repair string; parsing has to see the clean text too, or the aberration
    // that the period is stuck to still reports itself as unrecognized and the reader gets
    // two messages for one stray character. Dropping it before parseClone also keeps the
    // round-trip honest, since clone.raw is then the text actually interpreted.
    s = s.replace(/[.;:]+$/, "");
    // Characters that are not ISCN at all, dropped here as well as in diagnose(), for
    // exactly the reason the trailing period is: otherwise the field the stray landed in
    // still reports itself as unreadable and one stray character produces two messages,
    // the second of them about a rule the reader never broke. "%14" was being reported as
    // an unsupported "or" alternative.
    s = s.replace(/[^A-Za-z0-9,;:()\[\]<>\/+\-–−~?.×]/g, "");
    // A separator between two breakpoints on ONE chromosome, dropped here as well as in
    // diagnose(), for the reason the trailing period is: the repair alone leaves the
    // operation to be parsed from the text as typed, where inv(2)(p23;p13) reads as two
    // groups of one band each and is told an inversion needs two bands. That is a second
    // message about a rule the reader did not break, under the one that names the
    // mistake. The drawing is refused either way, since a repair is on offer.
    s = joinSameChrom(s).text;

    var cloneStrs = splitTop(s, "/").map(function (x) { return x.trim(); }).filter(Boolean);
    if (cloneStrs.length > 1) result.isMosaic = true;

    // ISCN 4.2.1 f: a rearrangement carries its breakpoints the FIRST time it is listed,
    // and need not repeat them (46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10]).
    // The registry of what has already been spelled out in full travels across clones,
    // in order, so a later bare t(9;22) is recognized as a back-reference and not as a
    // translocation missing its breakpoints.
    var statedFully = {};
    cloneStrs.forEach(function (cs) { result.clones.push(parseClone(cs, warnings, statedFully)); });
    // Resolve clonal-evolution references now that all clones are parsed.
    result.clones.forEach(function (cl, ci) { if (cl.pendingIdem) expandIdem(result.clones, ci, warnings); });
    result.ok = result.clones.length > 0 && result.clones.every(function (c) { return c.modalNumber != null; });

    // If a single clone's stated count is off, offer the corrected count as a fix.
    if (!result.suggestion && result.clones.length === 1) {
      var cl0 = result.clones[0];
      // countWrong, the same flag the warning sets, so a fix is only ever offered for a
      // count this app is actually willing to call wrong. Gating on !counts.ok instead
      // offered "did you mean 47,XY,+8,inc?" for 48,XY,+8,inc, which is valid ISCN
      // whose tally is short by design. !unreadable on top, because a fix that leaves
      // an unreadable breakpoint in place is not a fix.
      if (cl0.countWrong && cl0.counts.actual != null && !cl0.unreadable) {
        // A whole-arm acrocentric fusion written as t() keeps both derivative
        // chromosomes, so the count stays 46 while the stated count says 45. The
        // count is not the mistake, the operation is: fix the spelling, since
        // bumping the count to 46 would silently endorse the wrong picture.
        var robAb = null;
        if (cl0.counts.actual === cl0.modalNumber + 1) {
          robAb = cl0.aberrations.filter(function (a) { return a.wholeArmAcro; })[0] || null;
        }
        if (robAb) {
          result.countFix = (result.normalized || raw).replace(robAb.raw, robAb.raw.replace(/^t\(/i, "rob("));
          warnings.push("A whole-arm fusion of two acrocentric chromosomes at q10 is a Robertsonian translocation, written rob(" +
            robAb.chroms.join(";") + ")(q10;q10) or der(" + robAb.chroms.join(";") +
            ")(q10;q10). It replaces both chromosomes with one, which is the count of " + cl0.modalNumber +
            " you wrote. Written as t(…), both derivative chromosomes are kept and the count stays " + cl0.counts.actual + ".");
        } else {
          result.countFix = raw.replace(/\d+/, String(cl0.counts.actual));
        }
      }
    }

    // The karyotype with the junk taken out of the sex field. Only when something is
    // left to keep: "QQ" has no reading to offer, so that one is refused with the
    // message alone.
    if (!result.suggestion && result.clones.length === 1) {
      var sc = result.clones[0];
      if (sc.sexGiven && (sc.sex.dropped || []).length && sc.sex.tokens.length) {
        var sp = [];
        if (sc.modalGiven) sp.push(sc.modalGiven);
        sp.push(sc.sex.tokens.join(""));
        sc.aberrations.forEach(function (ab) { sp.push(ab.raw); });
        result.sexFix = sp.join(",") + (sc.cellGiven || "");
        if (result.isMosaic) result.sexFix = "mos " + result.sexFix;
      }
    }

    // The karyotype with its changes put in chromosome order. Single clone only, like
    // countFix: reassembling a mosaic means rebuilding the "/" chain, and the warning
    // already names the pair that is out of order.
    if (!result.suggestion && !result.countFix && result.clones.length === 1 && result.clones[0].orderedRaws) {
      var oc = result.clones[0];
      var ordered = [];
      if (oc.modalGiven) ordered.push(oc.modalGiven);
      if (oc.sexGiven) ordered.push(oc.sexGiven);
      oc.orderedRaws.forEach(function (r) { ordered.push(r); });
      result.orderFix = ordered.join(",") + (oc.cellGiven || "") ;
      if (result.isMosaic) result.orderFix = "mos " + result.orderFix;
    }

    // The same whole-arm acrocentric t(), but with a count that agrees with itself:
    // 46,XX,t(13;15)(q10;q10). Legal ISCN, and the renderer draws it correctly, so
    // it is NOT a warning — warning on correct input is how a warning box loses its
    // authority. It is still almost never what a learner meant, and the picture it
    // produces (46 chromosomes, both whole-arm products present) is exactly the one
    // that convinces a reader a Robertsonian carrier has 46. So offer the rob()
    // reading as a neutral note beside the drawing, with the count decremented, and
    // let the viewer compare the two pictures. The count-mismatch branch above owns
    // the case where the numbers already contradict the t; the two never both fire.
    if (!result.suggestion && !result.countFix && result.clones.length === 1) {
      var cl1 = result.clones[0];
      var acroAb = cl1.counts && cl1.counts.ok && cl1.modalNumber != null
        ? cl1.aberrations.filter(function (a) { return a.kind === "t" && a.wholeArmAcro; })[0]
        : null;
      if (acroAb) {
        var pair = acroAb.chroms.join(";");
        result.note = {
          text: "A whole-arm exchange between two acrocentric chromosomes is written t(…) only when both products are kept, which is why the count here is " +
            cl1.modalNumber + ". The fusion that actually occurs loses the two short arms and leaves one chromosome: that is a Robertsonian translocation, rob(" +
            pair + ")(q10;q10), and a balanced carrier of it has " + (cl1.modalNumber - 1) + " chromosomes, not " + cl1.modalNumber + ".",
          fixLabel: "Draw it as a Robertsonian instead:",
          fix: (result.normalized || raw)
            .replace(acroAb.raw, "rob(" + pair + ")(q10;q10)")
            .replace(/\d+/, String(cl1.modalNumber - 1))
        };
      }
    }

    // A modal-number range written with a dash: 46-49,XY. Mitelman writes it that way and
    // KaryoDraw accepts it, but the ISCN symbol for a range is a tilde. Not a warning,
    // because the karyotype is correct and draws, and warning on correct input is how a
    // warning box loses its authority.
    //
    // It began as a sentence in the decode row, which was not enough: it left the reader
    // to retype the karyotype, and the chip beside it still showed the dash, so "which one
    // is it" stayed open. Here it comes with the tilde version attached, one click away.
    //
    // Single clone only. Rewriting one clone of a mosaic would leave the two halves spelled
    // differently, which is worse than the dash.
    if (!result.note && !result.suggestion && result.clones.length === 1) {
      var rc = result.clones[0];
      if (rc.modalHigh != null && /[\-–]/.test(rc.modalGiven || "")) {
        var tilde = rc.modalGiven.replace(/[\-–]/, "~");
        result.note = {
          text: "The count is written " + rc.modalGiven + ", which is how Mitelman writes a range and is understood here. ISCN writes a range with a tilde: " + tilde + ".",
          fixLabel: "Write the range with a tilde:",
          fix: (result.normalized || raw).replace(rc.modalGiven, tilde)
        };
      }
    }

    // A fragile site written across a slash: 46,X,fra(X)(q27.3)[5]/46,XX[45]. This is
    // how the old cytogenetic reports scored fragile X, and it is well-formed ISCN
    // (4.5.3 b, e: abnormal line first, normal line last, absolute metaphase counts),
    // so it draws and it must not warn. But a slash means two cell lines derived from
    // the same zygote (4.5.2 a), and that is not what these numbers are. The expansion
    // is in every cell; the SITE only expresses in a fraction of metaphases grown under
    // stress, so the bracketed counts are scoring expression, not clonality. Every one
    // of the five fra examples ISCN prints (2.6.2, 5.5.7 a) is written without a slash.
    if (!result.note && !result.suggestion && result.clones.length > 1) {
      var fraClone = result.clones.filter(function (cl) {
        return (cl.aberrations || []).some(function (a) { return a.kind === "fra"; });
      })[0];
      if (fraClone) {
        result.note = {
          text: "A slash separates two cell lines derived from the same zygote (ISCN 4.5.2), but a fragile site is present in every cell: what varies is whether it is EXPRESSED in a given metaphase, which depends on the culture conditions. So these counts score how often the site was seen, not how many cells carry it. The notation is accepted and drawn as written; the five fragile-site examples ISCN prints are all written without a slash."
        };
      }
    }

    // A derivative chromosome is one rebuilt either by a rearrangement involving
    // two or more chromosomes or by MORE THAN ONE change within a single
    // chromosome (ISCN 5.5.3 a). der(15)ins(15)(p11q23q26) wraps exactly one
    // single-chromosome change, so the wrapper adds nothing and ISCN writes the
    // change plain. Accepted and drawn as typed, because warning on
    // interpretable input is how the warning box loses its authority; the plain
    // spelling is offered beside the drawing instead. Guarded on a clean parse:
    // a note never shares the box with a warning.
    if (!result.note && !result.suggestion && !warnings.length && result.clones.length === 1) {
      var dnCl = result.clones[0];
      var loneDer = (dnCl.aberrations || []).filter(function (a) {
        var subs = a.subOps || [];
        return a.kind === "der" && (a.chroms || []).length === 1 && subs.length === 1 &&
          ["del", "dup", "inv", "ins"].indexOf(subs[0].op) >= 0 &&
          (subs[0].chroms || []).length >= 1 &&
          (subs[0].chroms || []).every(function (x) { return String(x) === String(a.chroms[0]); }) &&
          String(a.raw || "").indexOf("der(" + a.chroms[0] + ")") === 0;
      })[0];
      if (loneDer) {
        var plainAb = String(loneDer.raw).slice(("der(" + loneDer.chroms[0] + ")").length);
        result.note = {
          text: "A derivative chromosome (der) is one rebuilt either by a rearrangement involving two or more " +
            "chromosomes, or by more than one change within a single chromosome (ISCN 5.5.3). This chromosome " +
            loneDer.chroms[0] + " carries a single change, so the der() wrapper adds nothing: ISCN writes it " +
            plainAb + ".",
          fixLabel: "Write it without the wrapper:",
          fix: (result.normalized || raw).replace(loneDer.raw, plainAb)
        };
      }
    }

    // The user may have typed only the rearrangement, dropping the leading count and
    // sex ("t(9;22)(q34;q11.2)" instead of "46,XY,t(9;22)(q34;q11.2)"). If prefixing a
    // normal constitution parses as a real karyotype, offer that as a one-click fix,
    // with the correct count for a gain, loss, or Robertsonian. Sex is guessed from
    // whether a Y is mentioned; the fix is editable if the guess is wrong.
    if (!result.suggestion && result.clones.length === 1 &&
        result.clones[0].modalNumber == null && s && !/^\d/.test(s)) {
      var sexGuess = /y/i.test(s) ? "XY" : "XX";
      var trial = parse("46," + sexGuess + "," + s);
      var tc = trial.clones[0];
      if (tc && tc.modalNumber != null && tc.aberrations.length &&
          tc.aberrations.every(function (a) { return a.kind && a.kind !== "unknown"; })) {
        result.suggestion = trial.countFix || ("46," + sexGuess + "," + s);
        for (var wi = 0; wi < warnings.length; wi++) {
          if (/^A karyotype starts with the chromosome count/.test(warnings[wi])) {
            warnings[wi] = "It looks like you typed only the rearrangement. A karyotype begins with the chromosome count and sex chromosomes, for example 46,XX. The fix below adds them.";
            break;
          }
        }
      }
    }

    // The OTHER reading of a contradicted count. "50,XXXXXXX" says 50 and lists seven X,
    // which with 44 autosomes comes to 51. Changing the number to 51 is one repair;
    // dropping an X to reach the 50 that was written is the other, and nothing in the
    // input says which was meant. Offering only the first presented one guess as the
    // answer.
    //
    // Narrow on purpose, because "adjust the content instead" is ambiguous in general:
    //   - no aberrations, so the discrepancy cannot be blamed on a change instead of the
    //     sex field ("50,XXXXXXX,+21" could be either);
    //   - one repeated sex letter, so there is only one thing to add or drop
    //     ("50,XXXXXXY" could lose an X or the Y, and they are different karyotypes);
    //   - a single stated count, since a range gives no one number to satisfy.
    if (!result.suggestion && result.clones.length === 1) {
      var xc = result.clones[0];
      var oneLetter = xc.sex.tokens.length > 0 && xc.sex.tokens.every(function (t) { return t === xc.sex.tokens[0]; });
      if (xc.countWrong && xc.modalHigh == null && !xc.aberrations.length && oneLetter &&
          !(xc.sex.dropped || []).length) {
        var wantSex = xc.modalNumber - 22 * xc.ploidy;
        if (wantSex >= 1 && wantSex <= 12) {
          var cand = xc.modalGiven + "," + new Array(wantSex + 1).join(xc.sex.tokens[0]) + (xc.cellGiven || "");
          result.sexCountFix = (result.isMosaic ? "mos " : "") + cand;
        }
      }
    }

    // A clone that never stated its sex chromosomes. Pushed here, after every repair is
    // decided, because the message depends on whether one was found: the mistyped
    // separator and the rearrangement-only paths each name this mistake better and more
    // specifically, and a second, more general restatement of the rule reads as a second
    // thing to fix. Pushing it earlier (#122) put it underneath the rearrangement-only
    // message, which is set further down.
    if (!result.suggestion && result.clones.some(function (c) { return c.sexMissing; })) {
      warnings.push("A karyotype starts with the chromosome count, then the sex chromosomes: " +
        "46,XY, 45,X, 69,XXX.");
    }

    // Every repair on offer, in the order the reader should weigh them: the smallest edit
    // first. The named fields above stay the single place each one is decided; this is the
    // list the page renders.
    //
    // Vetted, but on "does this get the reader somewhere" rather than "does this draw".
    // A repair only has to fix the mistake it addresses; the app names one mistake at a
    // time, so landing on a different one is progress, not failure. "69.XX" repairs to
    // "69,XX", which is refused for its count and then offers "68,XX" and "69,XXX" (the
    // triploidy that was probably meant) — two clicks, each naming one thing.
    //
    // What is dropped is a DEAD END: refused with nothing further to click. "46,,"
    // collapsed to "46", which #122 made a refusal with no onward repair, so clicking it
    // bought a second refusal and no information. Its own message already says what to do.
    //
    // The gate's band check lives in the page and is not repeated here. A fix inherits its
    // input's bands, and a bad band already stops every fix above from being offered.
    var candidates = [result.suggestion, result.countFix, result.sexCountFix, result.sexFix, result.orderFix]
      .filter(function (f) { return f && f !== raw; })
      .filter(function (f, i, a) { return a.indexOf(f) === i; });
    result.fixes = depth > 0 ? candidates : candidates.filter(function (f) {
      var t = parse(f, depth + 1);
      var drawable = t.clones.length > 0 &&
        !t.clones.every(function (c) { return c.modalNumber == null; }) &&
        !t.suggestion &&
        !t.clones.some(function (c) { return c.unreadable || c.countWrong || c.unaccounted; });
      return drawable || t.fixes.length > 0;
    });
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
