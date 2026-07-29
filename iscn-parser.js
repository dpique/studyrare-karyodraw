/* KaryoDraw, ISCN karyotype parser.
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

  // Chromosomes with a satellited short arm carrying only rDNA repeats. A q10;q10
  // fusion between two of these is a Robertsonian translocation, which is spelled
  // rob()/der() rather than t() because it replaces both chromosomes with one.
  var ACROCENTRIC = { "13": 1, "14": 1, "15": 1, "21": 1, "22": 1 };

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
      totalMsg: "An insertion moves a piece of chromosome, so it needs the two bands that bound the piece and the band it landed at. Between two chromosomes that is ins(5;2)(p14;q22q32); within one, ins(2)(q13p23p13)." }
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
      return rule.what + " names one breakpoint on each chromosome it involves, like " +
        rule.eg + ". “" + op + "(" + ab.chroms.join(";") + ")” involves " + (NUM[n] || n) +
        " chromosomes, so it needs " + (NUM[n] || n) + " breakpoints.";
    }
    var bands = groups.length ? groups[0].length : 0;
    if (bands >= rule.bands[0] && bands <= rule.bands[1]) return "";
    return rule.msg;
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
    ab.badBands = bpParts.map(function (p) { return p.trim(); })
      .filter(function (p, i) { return p && !ab.breakpoints[i].length; });

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
        if (rest) {
          ab.note = "der(" + ab.chroms.join(";") + ")" + rest;
          var sub = [], cursor = 0, unread = "";
          var subRe = /([a-zA-Z]+)\(([^)]*)\)(?:\(([^)]*)\))?/g, sm;
          while ((sm = subRe.exec(rest)) !== null) {
            unread += rest.slice(cursor, sm.index);
            cursor = sm.index + sm[0].length;
            sub.push({
              op: sm[1].toLowerCase(),
              chroms: splitTop(sm[2], ";").map(function (x) { return x.trim(); }),
              breakpoints: splitTop(sm[3] || "", ";").map(function (p) { return splitBands(p.trim()); })
            });
          }
          unread += rest.slice(cursor);
          ab.subOps = sub;
          // Only op(...) groups are sub-ops. Anything else here was dropped, and a
          // dropped "+14" is worse than a rejection: the drawing looks authoritative
          // and is missing a chromosome. Say so rather than absorbing it.
          if (unread.trim()) { ab.unread = unread.trim(); warnings.push(leftoverWarning(raw, ab.unread)); }
        }
        break;
      default:
        ab.kind = "unknown";
        warnings.push("“" + op + "” in “" + raw + "” is not an ISCN abbreviation. The ones KaryoDraw draws: del, dup, inv, t, i, r, der, add, ins, dic, fra, mar.");
    }
    // Every op except der() should consume its whole token; leftover text (an "or"
    // alternative, an uncertainty marker, a trailing qualifier) is not modeled, so
    // warn instead of dropping it silently. der() is exempt because it parses its own
    // sub-op chain above and reports its own leftover there.
    //
    // Keyed on the op as WRITTEN, not on ab.kind. rob() sets kind "der" (it behaves
    // exactly like der(13;14)(q10;q10)) but never runs der's sub-op parsing, so a
    // kind test exempted it from both reporters and its leftover vanished:
    // rob(14;21)(q10;q10)+21 dropped the +21 with nothing said. That silence then
    // defeated the unread guard on the count warning below, so the app announced
    // "the number at the start says 46, but this karyotype describes 45 chromosomes"
    // directly above a "did you mean" whose own count is 46. der(13;14)(q10;q10)+14,
    // the same karyotype spelled the other way, always reported it correctly.
    if (op !== "der" && ab.kind !== "unknown" && rest && rest.trim()) {
      ab.unread = rest.trim();
      warnings.push(leftoverWarning(raw, ab.unread));
    }
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
    var opKey = op + "(" + ab.chroms.join(";") + ")";
    if (!ab.badBands.length) {
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
        if (comp[g] === undefined) { warnings.push("“" + g + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. +21)."); clone.badChrom = true; return; }
        comp[g] += mult;
        for (var gj = 0; gj < mult; gj++) slots[g].push({ chrom: g, kind: "gain", label: g, aberration: ab, primary: g });
      } else if (ab.kind === "loss") {
        var l = ab.chroms[0];
        if (comp[l] === undefined) { warnings.push("“" + l + "” isn’t a human chromosome, use 1–22, X, or Y (e.g. -7)."); clone.badChrom = true; return; }
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
          if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); clone.badChrom = true; return; }
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
            if (comp[c] === undefined) { warnings.push("“" + c + "” isn’t a human chromosome, use 1–22, X, or Y."); clone.badChrom = true; return; }
            var ridx = firstNormal(slots[c]);
            if (ridx >= 0) { slots[c].splice(ridx, 1); comp[c] -= 1; }
          });
          var dc = ab.chroms[0];
          if (comp[dc] !== undefined) { slots[dc].push(mkDer(dc, ab)); comp[dc] += 1; }
        }
      } else if (["del", "dup", "inv", "add", "ring", "iso", "der", "fra", "trp", "hsr"].indexOf(ab.kind) >= 0) {
        var c0 = ab.chroms[0];
        if (comp[c0] === undefined) { warnings.push("“" + c0 + "” isn’t a human chromosome, use 1–22, X, or Y."); clone.badChrom = true; return; }
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
    clone.unreadable = clone.aberrations.some(function (ab) {
      // ab.arity: the operation was given fewer breakpoints than it takes, so the
      // drawing would have to invent the rest. Same consequence as a breakpoint that
      // could not be read, and for the same reason.
      return (ab.badBands || []).length > 0 || ab.kind === "unknown" || ab.unread || ab.arity;
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
    || !!clone.badChrom || !!clone.danglingIdem || !!clone.zeroCells;
    if (clone.outOfOrder) {
      warnings.push("Whole-chromosome gains and losses are listed in chromosome order, so “" +
        clone.outOfOrder.before + "” comes before “" + clone.outOfOrder.after + "”.");
    }
    // countWrong is the app asserting the count is wrong, and it is set at exactly the
    // point the warning is pushed so the two can never disagree. It is NOT the same as
    // !counts.ok: 48,XY,+8,inc says there are further unidentified changes, so its
    // tally is legitimately short and the app has no business calling that an error.
    clone.countWrong = false;
    if (!clone.counts.ok && clone.sex.tokens.length > 0 && !clone.incomplete && !clone.uncounted) {
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
    } else warnings.push("A karyotype starts with the chromosome count (a number like 46). “" + fields[0] + "” isn’t a number.");

    // sex field (second) — UNLESS the second field is a clonal-evolution marker
    // (idem/sl/sdl). The standard subclone form omits the repeated sex field, e.g.
    // 47,idem,+8: "idem" stands in for the whole stemline, sex included, so the
    // sex is inherited during expansion rather than stated here.
    var firstAb = 2;
    if (fields.length > 1 && /^(idem|sl|sdl)$/i.test(fields[1])) {
      firstAb = 1;
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
        ? "“" + uniq[0] + "” is not a character ISCN uses."
        : "These are not characters ISCN uses: " + uniq.map(function (c) { return "“" + c + "”"; }).join(", ") + ".") +
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
        var fixed = fields[fi].replace(/(.)([+\-−–])/g, "$1,$2");
        if (fixed !== fields[fi]) { splitSigns.push(fields[fi]); fields[fi] = fixed; }
      }
      return lead + fields.join(",");
    }).join("/");
    splitSigns.forEach(function (tok) {
      warnings.push("Changes are separated by commas, so “" + tok + "” is two of them: “" +
        tok.replace(/(.)([+\-−–])/g, "$1,$2") + "”.");
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
    if (suggestion !== raw) result.suggestion = suggestion;
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
    // The canonical, whitespace-normalized designation — for display and the URL.
    result.normalized = (q ? q[1].toLowerCase() + " " : "") + s;

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
