# Changelog

Notable changes to KaryoDraw. The site is continuously deployed (every change to
`main` goes live), so entries are grouped by date rather than by version.

## 2026-09-05 (the dosage table is titled for what it measures)

- **"Net imbalance" became "Segment dosage."** The panel reports every segment's
  copy number whether the rearrangement is balanced or not, so "imbalance" was
  wrong for a balanced translocation, whose rows all read balanced and whose body
  already says there is none. The new title describes the table itself.

## 2026-09-05 (the parental-origin card drops its click hint)

- **The amber parental-origin card no longer says "Click a parent to draw it;
  this outcome will be marked in the meiosis."** The carrier karyotypes are
  self-evidently clickable chips, so the instruction was noise. The card is now
  just the headline and the chips (plus the suffix or UPD line where one applies).

## 2026-09-05 (the 3:1 outcomes pair up, and clicking a pair redraws its plane)

- **The reciprocal 3:1 mode now folds four ways, one clickable pair per plane.**
  Its eight outcomes used to sit in one flat list under a single fixed figure.
  They now group into four boxed pairs, one per chromosome that can travel alone
  (der(A) alone, der(B) alone, A alone, B alone); each pair holds its two
  complements, the 47-chromosome trisomy and its 45-chromosome monosomy. Clicking
  a pair redraws the to-scale cross to that plane, moving the lone chromosome, its
  pole, and the dashed division line to the matching corner, and swaps the caption
  sentence with it. This is the #256 Robertsonian pair mechanism generalised from
  two planes to four. Requested by Dan.
- **The cross figure gained the other three 3:1 planes.** `pachytene.js` drew only
  the der(A)-alone plane; it now brackets any of the four arms with the L-plane and
  pulls that chromosome to its own pole, the other three to the opposite one, with
  the fibres pulled in tight so the figure stays legible.
- **Tracing a 3:1 product preselects its plane.** Clicking a 3:1 conceptus (or a
  parental-origin chip that traced from one) lands on the carrier page with that
  outcome's plane already drawn and the outcome marked. The Emanuel +der(22), for
  instance, opens the der(11)-alone plane that produces it.

## 2026-09-04 (the carrier card states it plainly)

- **On the carrier page the return card now reads "This is a carrier parent /
  They could give rise to [product]"** (was "A possible carrier parent / could
  give rise to ..."). The drawn karyotype is unambiguously a balanced carrier,
  so it is stated as fact; the de novo hedge stays on the child page where it
  belongs. The pointer trims to "See the meiotic segregation below."

## 2026-09-04 (the return hint directs the eye)

- **The carrier page's return card read "See it marked in the meiotic
  segregation below"** (was "That outcome is marked in ..."), since superseded
  by the plainer card above.

## 2026-09-04 (one hover, one popover, one side; and the preview wears the page's colors)

- **A chip's hover opens the drawn preview and nothing else.** The native title
  tooltip ("Draw ...") that raced the preview is gone (owner call: two hovers,
  and the click's meaning is obvious). The popover now always opens below the
  chip, centered, flipping above only at the viewport bottom; it used to pick
  left or right by available room, so it jumped sides between the tool column
  and the panel.
- **The preview inherits the page's colors.** A hovered karyotype that shares
  chromosomes with the drawing beneath shows them in the page's colors, even
  when it involves only a subset: 45,XX,-21 hovered on a der(14;21) page now
  shows 21 in the page's amber rather than the first color it would earn on
  its own page, and the popover never borrows a color the page uses for a
  different chromosome. With the naming-order rule below, parent and offspring
  now agree on colors everywhere, whatever is hovered.
- **The origin card sheds its last extra line, and the trace runs forward.**
  The bare card is headline, chips, hint: the de novo sentence is gone ("may"
  carries it; owner call), the plain mood reads "could give rise to" instead of
  "traced from", and its go-back instruction was cut.

## 2026-09-04 (one chromosome, one color, and the trace speaks genetics)

- **A chromosome now wears the same highlight color in every figure of a
  family.** Colors were assigned by order of appearance in the notation, so
  der(22)t(11;22) handed chromosome 22 the first color while the parent
  t(11;22) handed it to 11, and the child page, its hover preview, and the
  carrier page it links to wore opposite colors (owner report). Assignment now
  follows ISCN rearrangement naming order (sex chromosomes first, then
  ascending), making the color a function of the chromosome set alone.
- **The return card speaks genetics, not navigation.** "This carrier can
  produce the karyotype you came from" became "A possible carrier parent,
  traced from ..." with the karyotype as the chip, and the marked outcome in
  the panel reads "the karyotype you traced".

## 2026-09-04 (the origin card slims down, and the meiosis moves home)

- **The parental-origin card is now chips-first and mechanism-free** (owner call:
  the first version was too wordy). Headline, the carrier karyotypes as clickable
  chips (one when mat/pat/dmat/dpat names the parent), one caveat line. Segregation
  mode names left the card entirely, and the carrier chips get the same hover
  preview as the panel's conceptus chips.
- **The parent's meiosis is no longer embedded under the child.** Those figures
  describe chromosomes the child's karyotype does not contain (an Emanuel child has
  no der(11), yet the quadrivalent drew one), so they now live only on the carrier
  page, where they are true of the karyotype drawn above them. Clicking a carrier
  chip draws that parent and threads the child along as from= in the URL; the
  parent's own panel marks the matching gamete "the karyotype you came from",
  preselects its division pair where that applies, and the card, in a plain mood,
  offers the way back. The thread survives view toggles, dies on any plain jump,
  rides shared links and Back, and a from= that matches nothing is scrubbed rather
  than rendered.

## 2026-09-04 (the unbalanced karyotype flags its possible carrier parent)

- **A parental-origin alert joins the tool column.** Whenever an unbalanced
  karyotype traces back to a balanced-carrier parent (an unbalanced reciprocal
  product, a 3:1 tertiary trisomy, a Robertsonian trisomy), an amber card at
  the top of the column says so where the eye lands and links down to the full
  "Where this came from" panel. Alert and panel render from the same origin
  model, so they cannot disagree. Requested by Dan.
- **Inheritance suffixes now reach the origin view.** ISCN 2024 Table 5 writes
  every segregant with dmat, and the textbook Emanuel karyotype ends in mat;
  both previously matched nothing because the comparison key kept the suffix.
  Matching now sees through mat, pat, inh, dmat, dpat, and dinh, and the copy
  branches on what the suffix states (4.2.1 g): a named parent gets one carrier
  chip instead of the either/or pair, inh drops the de novo alternative, and dn
  stands the whole inference down since it documents normal parents (4.2.1 h).
- **A homologous Robertsonian fusion no longer borrows the trivalent.** For
  45,XX,der(21;21)(q10;q10) the segregation panel showed alternate segregation
  offering a chromosomally normal child, which is false: that carrier keeps no
  free chromosome 21, so the fusion is a univalent and every conception is
  trisomic or monosomic (Gardner, 5th ed). The carrier now gets a univalent
  panel of its two gametes, the product 46,XX,+21,der(21;21)(q10;q10) traces
  back to it with the de novo isochromosome differential named, and the fusion
  glyph paints both long arms in one chromosome-of-origin color.

## 2026-08-30 (adjacent outcomes pair up, and clicking a pair redraws its plane)

- **The Robertsonian adjacent card groups its four outcomes into two boxed
  pairs, one per division plane.** One 2:1 division reads out twice, so the
  trisomy and the monosomy of the same chromosome are complements from the same
  plane; the box now says so. The pair holding the typed karyotype leads and is
  preselected; clicking the other pair redraws the division above it (hidden
  radios and CSS, no script), swaps the caption sentence with it, and hands the
  pole tints to the pair the figure actually shows. Requested by Dan.
- **The adjacent caption no longer contradicts the figure.** It said "the
  fusion goes with 13" while the to-scale trivalent drew the fusion travelling
  with 14: the sentence had been written for the schematic fallback, which
  folded the other way. Caption, scene, and highlighted pair now share one
  selection and cannot disagree; the two figure systems also name their folds
  identically (the suffix is the homologue that travels alone), and the scene
  labels say that in words.
- **The closing note ends at what the figure teaches**: real risks depend on
  the specific chromosomes and segment sizes. The ascertainment-and-counselor
  clause is gone (owner call).

## 2026-08-30 (the ruler defaults to off)

- **The Scale toggle now defaults to Off** (owner call, same day it shipped).
  Turning it on rides in shared links as scale=on; the plain URL means no
  ruler, on screen and in exported images alike.

## 2026-08-30 (the ruler gets a switch and sits on the baseline; the legend moves up)

- **A Scale toggle joins Show, Bands, and Style**: On or Off. Off removes the
  ruler from the screen and from copied and downloaded images alike, and rides
  in shared links as scale=off; the default keeps URLs clean, so every link
  already shared keeps its meaning.
- **The ruler's 50 Mb tick sits on the chromosome baseline.** It used to hang
  level with the lettering under the figure; the bar measures the chromosomes,
  so it now ends exactly on the deepest chromosome's bottom edge (pinned in a
  browser test to within a pixel and a half at any responsive width).
- **The band and stain legend moved above the net imbalance table**, which is
  now its own card below the legend (owner order).

## 2026-08-30 (balanced rearrangements join the table, a ruler joins the figure)

- **Balanced rearrangements get their rows back.** The runs now also split at
  the karyotype's typed breakpoints, so a balanced inversion or insertion
  partitions into named, sized, all-balanced rows and its segment of interest
  keeps a size (undoing the previous entry's deliberate loss). When nothing
  deviates, the title reads "Net imbalance: none" and the gene checkbox hides,
  so the table measures without claiming. t(9;22)(q34;q11.2) now states the two
  exchanged pieces at about 5.4 and 29 Mb.
- **A gain's rider hunt crosses slots.** Beside 46,XY,der(13;14)(q10;q10),+14
  the +14 row said "two copies in this cell line" and stopped: the der lives in
  slot 13 (lowest number first) and the scan only looked in slot 14, denying
  the third copy of 14q the derivative carries. It now scans every slot for
  instances whose aberration or sub-ops involve the chromosome, so the row ends
  "with more 14 material on der(13;14)", and the same held for ISCN's own
  46,XX,der(13;21)(q10;q10),+21 (5.5.18.3 c ii). Reported by Dan.
- **The karyogram carries a scale bar**, Dan's pick from the preview: a 50 Mb
  vertical ruler with 10 Mb ticks, lower right, drawn at the renderer's own
  px-per-bp inside the karyogram so the responsive fit scales bar and
  chromosomes together and the two cannot disagree. Exported PNGs carry it too.

## 2026-08-30 (the net imbalance becomes a table, and the sizes move into it)

- **A NET IMBALANCE table sits under the detailed form** whenever a karyotype
  gains or loses material. Each row is a maximal run of constant copy number,
  computed from the very segment lists the figure is drawn from
  (Karyo.computeDosage), with the typed band names at its edges: for
  45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12) it reads 8pter→8q10
  nullisomy, 8q10→8q22 balanced, 8q22→8q24.1 monosomy, 8q24.1→8qter nullisomy,
  9q12→9qter trisomy, each with its approximate size. Balanced runs of an
  involved chromosome stay as muted context rows; a fully balanced karyotype
  shows no table at all. Sex chromosomes carry a sex-aware baseline (one X is
  balanced in a male cell; i(X) reads one Xp and three Xq, the imbalance ISCN
  itself states at 5.5.11 ii). Marker and dmin material is excluded rather than
  guessed, and the table says so.
- **A "cancer genes" checkbox annotates gained and lost rows** with well-known
  cytogenetics genes that sit inside them (nullisomy 8q24.1→8qter includes MYC;
  trisomy 9q12→9qter includes ABL1). The curated list lives in teach.js with
  HGNC band assignments; positions resolve through the app's own band map, so a
  typo fails a test instead of mapping silently to nowhere. A teaching aid, not
  a clinical annotation, and off by default.
- **The "(about N Mb)" parentheticals left the decode prose.** They interrupted
  the sentences; sizes now live in the table's own column, computed from the
  same band-midpoint positions. One deliberate loss, worth knowing: a balanced
  span (an inversion's segment, an insertion's moved piece) no longer carries a
  size anywhere, because the table only exists when something is imbalanced.

## 2026-08-30 (the glossary settles on the prose, and the detailed form closes its gap)

- **The glossary hover now lives on the prose terms only.** The symbol chips and
  the figure captions carried it for a day and lost it on sight (owner call): a
  dotted underline under a long ISCN token or under the red caption read as
  clutter, and every concept a chip stands for is named, glossed, one word away
  in the sentence beside it.
- **The ISCN detailed form closes its gap.** The label column is now sized by its
  longest label (a grid, not a hand-tuned 76px minimum), so der(8;8) sits ten
  pixels from its string while multi-row forms keep their aligned column.
- **The detailed form's punctuation teaches itself.** Hovering a lone ":" says it
  marks a break without reunion (the broken end a terminal deletion leaves, as in
  the printed del(4)(:p15.2→qter)); hovering "::" says break and reunion
  (ISCN 4.4.4).
- **The der glossary entry lost its numbered placeholder.** "so der(9) has
  chromosome 9's centromere" read as a statement about the karyotype on screen
  whenever that karyotype really involved a 9; the rule is now stated without
  borrowing a chromosome number.

## 2026-08-30 (the URL writes the plus it reads)

- **Shared URLs keep the ISCN plus literal.** ?k=46,XY,der(13;14)(q10;q10),+14
  now reads as the karyotype it is instead of showing %2B14. The reader half has
  been true since the k parameter stopped form-decoding + as a space; the writer
  (the URL bar, Copy link, and the generated landing-page links) now matches. A
  real space still encodes as %20, so the mos/chi prefix cannot collide, and
  every %2B link already in the wild decodes to the same plus and keeps working.

## 2026-08-29 (differential batch 2: idic against dic against i, and rec against der)

- **The isodicentric row settles its two near misses.** idic asserts ONE
  chromosome of origin, a single break on sister chromatids reunited into the
  mirror (ISCN 5.5.4 b); dic(15;15) would mean the two homologues each broke and
  fused, standing in place of both (5.5.4 a); and i would have to mirror about
  the centromere itself at p10 or q10 with one centromere, while an idic breaks
  out on the arm and carries two. The homologous dicentric row states the
  converse, and the idic glossary entry carries the origin rule.
- **The heterologous dicentric notes the der spelling.** ISCN 5.5.4 f allows der
  in place of dic, never both together, which is why reports sometimes write
  der(13;15) for a chromosome the lab calls dicentric.
- **The Robertsonian row pre-answers "then why not dic".** The q10 spelling
  presumes fusion at the centromeres; a fusion proven dicentric is written dic
  with the breakpoints out in the short arms, dic(13;21)(p11.2;p11.2) style
  (5.5.18.3 d).
- **The recombinant row states why rec and not der.** rec is inferred from the
  parental karyotype the notation itself names, and is never used for acquired
  changes (5.4.3.2 b); without the documented parental inversion the same
  chromosome would be described as der.

## 2026-08-29 (why der(8;8) and not i(8)(q10): the decode settles the differential)

- **Homologous fusions teach the near-miss they are not.** A student asked why
  45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12) writes two 8s instead of
  i(8)(q10). The decode now answers, sourced from ISCN 5.5.11: an isochromosome
  asserts a mirror image, arms identical and genetically homozygous (5.5.11 b);
  der is the spelling whenever that identity is not proven (5.5.11 d) and for
  every complex case (5.5.11 e). With sub-abnormalities on the arms the row states
  that the arms visibly differ, so a single mirrored arm cannot describe them; it
  deliberately does not claim der proves two parental homologues, because a true
  isochromosome that later diverged on one arm is also written der. The
  isochromosome row and the i glossary entry carry the converse, and the
  homologous Robertsonian (der(21;21)) offers the i(21)(q10) alternative the
  standard itself footnotes.
- **The homologous fusion reads "one from each homologue".** The Robertsonian
  sentence used to say "chromosomes 21 and 21" and cite the lowest-number-first
  rule, which is meaningless when both partners are the same chromosome.
- **Adjacent claims made honest.** der(8;8)(p10;q10) fuses one short arm and one
  long arm, and the decode said "the two short arms"; it now names one of each.
  The isochromosome dosage is read off the clone instead of the canned "3 copies
  of one arm and 1 of the other", which was false beside ISCN's own
  45,XX,-21,i(21)(q10) (two and none); and the -21 row there no longer claims "no
  copy of 21 remains" beside an i(21) carrying two long arms. The homologous
  whole-arm fusion also states its cost now (both 8q arms on one derivative, no
  8p at all), matching what the heterologous case already said.

## 2026-08-29 (the glossary reaches the figure and the prose, and t() at 45 hears the rule)

- **The fused-count t() note is now an amber correction.** `45,XX,t(14;21)(q10;q10)`
  still draws the Robertsonian fusion its count asserts, but the box no longer
  files the spelling under neutral "Worth knowing": it says plainly that ISCN does
  not write this fusion with t() (5.5.18.3 b names der as the preferred spelling,
  rob for constitutional cases), with the der() respelling still one click away.
  Owner call, revising the same day's neutral framing.
- **The glossary now covers all three places a symbol appears.** The figure caption
  under a drawn derivative (der(14;21) below the chromosome) hovers to the same
  definition as the decode chip, and the English names inside the decode prose
  ("derivative chromosome", "Robertsonian translocation", "dicentric", and the
  rest) hover too, each resolving to the symbol it names. One pass, longest phrase
  first, so "Robertsonian translocation" is rob and never re-glosses as a plain
  translocation.
- **The hover affordance is now visible.** The 1px gray dotted border under a
  glossed chip read as nothing; chips, glossed prose, and captions now share a
  2px dotted periwinkle underline held clear of the glyphs.
- **The ISCN detailed form is readable and sits on the card gutter.** Its pieces
  now wear ink derived from the figure colors (same hue, darkened to WCAG AA
  contrast for 12px text) instead of the raw shape palette, whose light periwinkle
  and amber were hard to read, and the block aligns with everything else in the
  card instead of hugging the left border.

## 2026-08-29 (hover a symbol, learn the concept)

- **The decode panel's symbol chips carry a glossary.** The row text explains this
  karyotype's change; hovering the chip answers the prior question, what a
  derivative chromosome (or rec, rob, idic, isochromosome, ring, marker, dmin, and
  the rest) actually IS, in two or three sentences, without leaving the page. A
  dotted underline advertises the hover; rows with nothing to define (the count,
  the sex field, plain gains and losses) stay plain. Requested by Dan for exactly
  the der and rec cases.

## 2026-08-29 (the failure tail learns to teach)

A message-quality audit rendered all 381 unique production failures through the page,
deduped the refusals into 204 message templates, and had agents judge every template
against the teaching rubric. About half passed clean; this batch fixes what did not.

- **Homologous t(N;N) with breakpoints draws.** The refusal said a translocation
  needs two different chromosomes; ISCN prints homologous exchanges
  (der(1)t(1;1)(p31;q32), +21,der(21;21)(q10;q10), t(2;7;7)), and the rule was
  turning away t(3;3)(q21.3;q26.2), the canonical MECOM rearrangement of AML. The
  decode says homologous; the meiosis panels stay absent on purpose. The fused-count
  and bandless-acrocentric spellings flow into the Robertsonian teaching, and
  rob(22) alone is taught the two-partner form with rob(22;22)(q10;q10) offered.

- **Four count bugs.** A t() plus a del() on the same chromosome inflated the tally
  by one (the replaced-homolog restore now applies only when it reconciles the
  stated count exactly); a +der(?) was dropped from the tally and the correct count
  then blamed; an unreconciled high count fell back to diploid arithmetic (96,xxxxxx
  was told to halve itself; it now lands on the nearest base, 94); and a sign inside
  parentheses split as a new change, feeding a repair that re-parsed into itself
  plus one semicolon, forever. -4(pter-p15.1) is now taught as the deletion it
  means, del(4)(p15.1), chip included.

- **Repairs stopped destroying the correct part.** A colon between chromosomes
  (t(4:18)) is repaired to the semicolon BEFORE the same-chromosome join could glue
  the valid breakpoints; a change glued to the sex field (47,XX+mar, 47,XY+21) gets
  its comma back instead of amputation; ";;" is taught instead of silently accepted;
  and once a separator lesson names the mistake, the bullets computed from the
  unrepaired token ("9,22 is not a human chromosome") no longer pile on.

- **Recognized notation is recognized.** ish, nucish, arr, ogm, and seq designations
  (and raw coordinate spans) get one respectful message naming the platform and the
  banded equivalent, instead of ten bullets scolding underscores that are valid
  there. pstk+ heteromorphisms and numbered sidelines (sdl1) are named as correct
  ISCN the app does not draw. SRY+ is taught its ish placement instead of being
  "repaired" to 46,XXY, a different diagnosis.

- **A dozen missed repairs now ride chips.** The nearest-band advice is clickable;
  iso/isdic teach their one-letter symbols; the Emanuel karyotype one "+" or one
  semicolon away gets both readings offered; XO is taught 45,X; a list label (b.45)
  is stripped; mos glued to the count gets its space; a multiplier after the cell
  count is dropped; a bare op name (46,XY,t) gets its own lesson with its full form;
  bandless del at a one-short count is taught -7; a semicolon between clones is
  taught the slash; invisible characters are named in words.

- **The audit is now a script.** scripts/review-messages.mjs renders a failures
  export through the page, dedupes the box copy into templates, and emits agent
  slices; the agent rubric is written into docs/VALIDATION.md, so the next run
  starts from the doc.

## 2026-08-29 (what the second pass saw: four gaps beside the fixes)

The closure re-review of the production evidence bundles confirmed all fourteen pilot
findings fixed (22 of 26 changed bundles clean) and surfaced four gaps adjacent to the
fixes, closed here.

- **The comma-spliced derivative is taught, not silently tripled.**
  `46,X,der(X),t(X;5)(...)` meant one change, `der(X)t(X;5)(...)`; read as two it drew
  a balanced t plus a separate der(X), three abnormal bodies with no normal X, zero
  warnings, and the band advice handed the string back. Refused now, with the joined
  spelling on a chip. The signed Emanuel pattern `+der(22),t(11;22)` keeps drawing its
  three bodies: the sign is what makes that reading correct.

- **The bare whole-arm derivative decodes its second chromosome.** The whole-arm
  decode fired only with trailing sub-ops, so `der(1;7)(q10;p10)` alone read as "has
  chromosome 1's centromere" beside a figure painting chromosome 7 material. It now
  states the composition and the cost (partially monosomic for 1p and 7q).

- **A lone X beside an abnormal Y is not monosomy X.** The sex-field hedge fired only
  when the rearranged element was an X; beside idic(Y) or r(Y) the gloss still said
  "a single X (monosomy X)" under a figure drawing the Y derivative. The hedge now
  covers Y-derived rearrangements.

- **The review capture's model.json is built from the karyotype the page draws.**
  For a snapped sub-band typo the exported segments defaulted the emptied band to the
  centromere while the figure sat at the ancestor band. The snap decision moved into
  `Karyo.bandSnap`, shared by the page and the capture, which records `snappedTo`.

- **The capture stamp hashes content, not mtimes.** A merge or fresh checkout touched
  every file's mtime, so all 55 bundles re-captured three runs in a row and the
  printed tally could not scope the agent re-review; a snapshot-and-diff had to be
  improvised. The stamp now hashes the app files themselves (parser included, which
  the old stamp missed entirely), so "unchanged" means unchanged and the tally is the
  list of bundles worth re-reading.

## 2026-08-29 (the input already said what it meant: closing the review pilot ledger)

The last five items from the 2026-08 production-review pilot. The three policy calls
share one principle, now recorded in docs/VALIDATION.md: when the input itself states
its reading, draw that reading and say so.

- **`45,XX,t(14;21)(q10;q10)` draws the Robertsonian the count asserts.** A t() keeps
  both products (46); the stated 45 says one fused chromosome, and for the acrocentric
  q10;q10 exchange the surviving product is not in doubt. Six visitors typed exactly
  this and were refused with the respelling one click away; the parser now rereads the
  t() as the der() fusion, draws it, and the note hands over the preferred
  `der(14;21)(q10;q10)` (ISCN 5.5.18.3 b). The p10 spellings keep the refusal, since
  there either product could be the survivor. A consequence that fell out for free:
  `46,XX,t(14;21)(q10;q10),+21` now draws translocation Down syndrome directly, so the
  comma repair for the no-comma form no longer needs its second composed step.

- **A bare rearrangement draws on the assumed complement it was offering to add.**
  `t(2;5)(q21;q31)` alone (six visitors) drew nothing and asked for a click on
  `46,XX,...`. It now draws on the assumed normal complement, XY when the
  rearrangement names a Y, with the assumption stated in a note and the written-out
  karyotype one click away. Only when the completed karyotype would draw with nothing
  else to say; any other message keeps the click-through, so the assumption can never
  sit on top of a real problem.

- **A sub-band typo below a real band draws at the band it names.** `del(5)(q15.3)`
  points below the map's subdivision of 5q15, so the page now draws at `5q15` and the
  message teaches the correction repair-shaped, written-out karyotype included. The
  walk is ancestors only (`9p24.4` lands on `9p24`, never sideways on `p24.3`), and a
  miss with no real ancestor (`12q32`) still refuses: there the position would be this
  app's guess. The review capture records unresolved bands beside `model.json` so the
  one-band difference between figure and input reads as the policy, not a bug.

- **`der(22;11)(q13;p13)` no longer draws one of its two readings in silence.** The
  two-chromosome der form is whole-arm notation and takes p10/q10 only (ISCN
  5.5.18.2 a). With other bands it has no reading, and the silent figure was the
  monocentric one, `der(22)t(11;22)(p13;q13)`, while a writer who meant both
  centromeres wanted `dic(11;22)(p13;q13)`, a different chromosome. Refused, teaching
  both spellings, each offered at the count that parses (they differ by one).

- **The listing-order warning stops at the clone boundary.** `.../46,sl,+1[cp3]` after
  a stemline carrying `-7` warned "+1 comes before -7", accusing correct notation: the
  -7 is written in the stemline, and the subclone wrote only +1. The check now skips
  aberrations spliced in by `idem`/`sl`/`sdl` and still orders what the subclone
  itself wrote.

## 2026-08-28 (the legend keys every mark, and the colors stay tellable)

- **Ten distinct hues for ten involved chromosomes.** The involved palette recycled
  near-identical periwinkles and reds, so on a nine-join derivative the color stopped
  identifying pieces the legend promised it would. The first four entries are stable
  (common figures and the committed landing PNGs keep their look); past that the
  palette is teal, purple, magenta, brown, distinct at a glance to twelve.

- **The ring clasp is keyed, and the marker is not called uninvolved.** The seam and
  arrowheads where a ring closed were drawn on every ring and explained nowhere; the
  legend now keys them. When the only gray on screen is the +mar, the row reads
  "origin unknown (the marker)" instead of "not involved in the abnormality", which
  described the one element it does not apply to.

- **An explicit -Y labels its ghost.** The notation names the lost chromosome, so the
  gap is not a guess: 45,X,-Y drew its gap unlabeled, and a written XX beside a -Y
  drew no trace of the loss at all. An unstated gap (plain 45,X) stays unlabeled, by
  design. The centromere waist is also cut deeper, after a visitor found it too
  subtle to spot under the heterochromatin hatch on the inv(9) figure.

## 2026-08-28 (repairs that survive being pasted)

- **A composed repair, where composing keeps the number you typed.** The comma fix
  for `46,XX,t(14;21)(q10;q10)+21` left a 46 that sums to 47, and the click-through
  then bumped the count, silently endorsing the t() spelling over the rob() the
  stated 46 was evidence for. The suggestion is now re-vetted by parse, and when its
  follow-up fix keeps the stated count (the rob respelling) it composes into one
  offer: `46,XX,rob(14;21)(q10;q10),+21`, the classic translocation Down carrier.
  Follow-ups that rewrite the count remain a second click, one mistake at a time.

- **Messages that used to point at nothing now hand the fix back.** The isodicentric
  example names the chromosome you typed instead of a hardcoded idic(15); a trailing
  `x` is taught the multiplier (`t(9;22)(q34;q11.2)x2`) instead of "not one KaryoDraw
  can place"; a bare varying count (`47-49,XY`) is taught the tilde with the varying
  changes listed; a wrong band's advice now ends with the whole karyotype rewritten
  onto the nearest real bands, paste-ready, when the substitution is unambiguous and
  verified to draw; and the drawable-operations list finally admits to rob, idic,
  trp, and hsr.

- **Constitutional counseling stays out of acquired clones.** "The usual origin is a
  parent who carries the balanced t" no longer appears inside sl/idem or composite
  clones, where a derivative is clonal evolution, not inheritance.

## 2026-08-28 (the words count what the figure draws)

- **Copy-number glosses state the drawn count, not a diploid slogan.** The gain and
  loss parentheticals were canned per token: "three copies = trisomy 1" beside a
  triploid figure drawing five, "one copy = monosomy Y" for a male whose only Y is
  gone, "trisomy X" for an XY cell gaining a second X. The gloss now reads the count
  off the clone's own slots, names trisomy and tetrasomy only when that is what the
  figure draws on a diploid autosome, points at derivatives carrying more material of
  the chromosome, and says plainly when no copy remains.

- **Ploidy is inferred when the arithmetic demands it, and always explained.** A
  heavily rearranged clone can sit far from a bare multiple of 23 while reconciling
  only against a higher baseline: a production 76~77 composite drew on a diploid
  scaffold roughly 25 chromosomes short of its own count. Candidate baselines are now
  tried directly, and the count row explains the baseline whenever it is not the
  diploid 46, stated (<2n>, <3n>) or inferred.

- **Dosage claims are withheld when they cannot be whole.** The lone-derivative note
  claimed "present in three copies" for material that also rides another derivative
  in the same clone; the whole-arm derivative decode now states what the fusion costs
  (the lost arms, and the partial monosomy when one normal homolog of each partner
  remains); a Y in the affected set brings the X beside it so an involved view never
  draws a lone Y as a cell's whole sex box; and one cell is "1 cell".

## 2026-08-28 (four silent drops, found by the agent review of production traffic)

- **A bare `+der(N)` resolves against the translocation listed in its clone.**
  ISCN 4.2.1 f: once a rearrangement is listed, der(N) alone means the derivative
  of that rearrangement. `46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10]`
  is printed in the standard, and a visitor typed the Emanuel karyotype
  `47,XX,+der(22),t(11;22)(q23.3;q11.2)`. Both drew an INTACT chromosome 22 under
  a der caption with nothing said; both now draw the small derivative. Resolution
  is same-clone and both directions; a bare der with no matching t is untouched.

- **An undetermined breakpoint inside a der sub-op refuses instead of vanishing.**
  `ins(2;7)(p?21;q21.3q22.1)` came through with an empty recipient group, so the
  whole insertion was dropped in silence while the decode still described the
  chromosome 7 transfer. A `?` group now routes to the uncertainty refusal
  (correct ISCN, nothing honest to draw); any other group yielding no band is
  unreadable, the same call as a top-level breakpoint.

- **Mitelman-style `del(p21)` inside a der reads as the primary chromosome.**
  `der(9)del(p21)t(9;22)` put the band where the chromosome goes and the deletion
  was dropped in silence. A chromosome is never p-something, so the reading is
  mechanical: it draws as del(9)(p21) with the spelling taught.

- **A multiplier on an unsigned structural abnormality makes that many copies.**
  Signed ops honored ×N; unsigned ops applied once, so `add(4)(q31.3)x2` drew one
  add beside a normal 4. Both homologs now carry it, and `t(9;22)(q34;q11.2)x2`
  converts both pairs.

## 2026-08-28 (rules stated, sections shelved, and the fix handed back whole)

- **User-facing copy no longer cites ISCN section numbers.** A learner reading a
  warning is not holding the book, so "(ISCN 5.5.3 c)" was clutter where the stated
  rule already teaches. Every warning, decode sentence, note, and the detailed-form
  title now state the rule without the citation; the sections live on in code
  comments and tests, where the next maintainer needs them, and a corpus-wide
  message-voice test keeps citations from creeping back in.

- **The misnamed-chain refusal hands back the corrected karyotype.** When a der(N)
  chain cuts its own arm twice and the joins nevertheless walk as one path, the two
  chromosomes named in a single join each are the centromere carriers of the
  der(A;B) reading, so the message now offers the user's own token re-headed,
  verbatim and paste-ready, verified against the same walk the der(A;B) gate and
  the renderer use before it is offered. When the joins do not form one path, no
  candidate is invented and the rule stands alone.

## 2026-08-28 (the notation wears the figure's colors)

- **Each piece of the detailed form takes the color its piece wears in the figure.**
  The block under the karyogram states the band composition (ISCN 5.4.2.2); its
  segments are now inked with the same per-chromosome palette the figure and legend
  use, with the "::" junctions and unjoined ":" ends receding to gray, so the
  notation points back at the picture it describes. Highlight style only, because
  that is when the figure itself is colored; Realistic keeps plain ink. Picked from
  a four-variant preview (colored ink over tinted chips and colored underlines).

- **A long ISCN token scrolls inside its decode chip, scrollbar in its own lane.**
  The chip in the decoded panel already scrolled sideways for a token too long to
  fit, but the native scrollbar rode ON the 13px text, which read as a rendering
  glitch rather than a control. The bar is now slim and sits in its own lane below
  the text.

## 2026-08-28 (one junction per arm on the derivative's own chromosome)

- **A der(N) whose own arm is cut twice is refused, with the der(A;B) form taught.**
  `der(3)t(3;5)(q21;q22)t(3;11)(q29;q13)...` passed the chain-connectivity gate
  (chromosome 3 is reachable) and then drew only the first join: after t(3;5) cuts
  chromosome 3 at q21, the join at 3q29 names material this der(3) no longer
  carries, so the renderer silently dropped it and the four joins after it, while
  the decode beside the figure described all five. Each of the derivative's own
  arms takes exactly one junction; a second join on the same arm now refuses with
  that rule, naming both conflicting joins, and points at the der(A;B) naming the
  run-on chain actually needs.

## 2026-08-28 (the whole-arm body carries its own grafts)

- **A whole-arm der(A;B) with trailing sub-ops now draws its actual composition.**
  ISCN 5.5.3 c iv, `der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)`, is the two long
  arms of chromosome 8 fused at the centromeres, one truncated at q22, chromosome 9
  material on the other at q24.1. The whole-arm path demanded no sub-ops, so this
  fell to the single-join builder and drew an intact 8p with one centromere; worse,
  `der(13;14)(q10;q10)t(9;14)(q22;q24)` came out as a der(9) figure with chromosome
  13 nowhere on it. The body now comes from the whole-arm geometry and each sub-op
  modifies one arm, applied in notation order to the first piece whose span holds
  its band. The detailed form emits the standard's exact strings, both pinned from
  print, and the corpus entry for c iv is now `generated: true`.

- **The seam constriction sits where the arms meet.** The whole-arm seam was drawn
  at the FIRST segment boundary, right for a bare two-segment Robertsonian and wrong
  once a graft rides above the arms: the waist sat on the chromosome 9 junction, a
  centromere the model does not claim there. It now sits at the boundary where the
  two centromere-bearing arms meet.

- **The reading direction of a whole-arm derivative follows the standard.** ISCN
  5.4.2.2 e reads a derivative from the first-named chromosome's material, so
  `der(13;14)(q10;q10)` now serialises as `13qter→13q10::14q10→14qter` even when the
  drawing puts 14q on top (orientation on screen stays a morphology decision, short
  arm up). Same body, read the way the standard prints it.

- **Sub-ops that name what the derivative does not carry are refused, with the rule
  stated.** A join touching neither named chromosome nor anything grafted on, a
  breakpoint on the arm the q10/p10 letters do not keep, and a der(N) chain join
  connected to nothing each used to vanish or mis-draw in silence. The decode also
  now describes the fused body and each arm change instead of the Robertsonian text
  (which ignored the sub-ops) or the one-chromosome text (which misread the body).

## 2026-08-28 (a headless chain is told what its head would be)

- **A run-together t() chain with no der() in front now teaches the two readings.**
  Typing the complex-karyotype chain without its `der(A;B)` head got the generic
  leftover message, "Changes look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2)",
  which names neither of the things the reader plausibly meant. The shape is
  diagnosable: operations run together with no commas are how ISCN 5.5.3 writes the
  make-up of ONE derivative, so the message now says to put `der()` in front naming
  the centromere carrier(s) for one derivative (a count of 45), or commas between the
  groups for independent translocations (count 46), with the comma form printed
  paste-ready. It still refuses to draw, since the two readings are different figures
  and guessing is not teaching. Same two-readings pattern as the rob/t count message.

## 2026-08-28 (the chain is as long as the notation writes it)

- **A der(A;B) built from translocations now draws at any chain length.** ISCN 5.5.3
  puts no ceiling on how many rearrangements build one derivative, but the chain walk
  stopped after a fixed eight steps, and past that the build fell to the
  single-centromere path: a nine-join `der(5;7)` drew ONE centromere and the acentric
  piece of chromosome 7 under a caption that names a dicentric, while the decode beside
  it kept saying "dicentric ... built from nine joins". The walk is now bounded by the
  join count itself.

- **A chain that does not hold together is refused, with the rule stated.** Joins that
  never reach the second named chromosome used to draw a monocentric figure under a
  dicentric caption; a join connected to nothing simply vanished from the figure; and a
  `t()` sub-op missing a breakpoint was dropped the same way, all warning-free. Each
  now refuses and explains itself: the translocations of a `der(A;B)` have to form one
  unbroken chain from A to B, and every join must have a place on it.

- **A bare `t()` sub-op now inherits the breakpoints of its first full mention.**
  ISCN 4.2.1 f lets a later mention omit its breakpoints, and the first full statement
  can itself sit inside a `der()`: `47,XY,der(9)t(9;22)(q34;q11.2),+22,ider(22)(q10)t(9;22)`
  is printed in the standard. The #218 copy reached top-level operations only, so
  `der(22)t(9;22)` in a later clone drew an intact chromosome 22 under a derivative
  caption. The ledger now records and serves sub-ops too, which also flips two more
  ISCN 2024 corpus examples to drawn (328 of 395).

## 2026-08-28 (the last legend row that was always on)

- **"(translocation pieces take the color of the chromosome they came from)" now appears
  only when a piece did.** It explains why a der(9) is drawn part blue and part orange,
  which is worth saying on a translocation and says nothing at all on a `del(5)` or an
  `idic(15)`, where every piece on screen came from the chromosome it is filed under.
  It was the last row still printed unconditionally, after #213 gated the marks and #219
  the stains, so the legend now describes the figure without exception.

  Keyed on the band rects rather than on the notation. "Carries foreign material" is
  exactly what the reader is looking at, so a Robertsonian and an insertion qualify and
  an inversion and a duplication do not, with no list of operations to keep in step as
  new ones are drawn.

## 2026-08-28 (the figure states what it drew, in ISCN's own notation)

- **The detailed form now appears under the karyogram.** The short system names the
  breakpoints; ISCN's detailed system (5.4.2.2) names the band composition of the
  chromosome that came out, so it is the unambiguous statement of what the picture above
  it claims. `t(9;22)(q34;q11.2)` carries `der(9) 9pter→9q34::22q11.2→22qter` and
  `der(22) 22pter→22q11.2::9q34→9qter`; `idic(15)(q11.2)` carries
  `pter→q11.2::q11.2→pter`. It is generated by `Karyo.detailedForm` from the very
  segment list the figure is drawn from, so the notation and the picture cannot drift
  apart, and the label on each line is the same caption the chromosome wears.

  Placement picked from a three-option preview: under the figure rather than in the
  decoded panel or the card header. It sits with the thing it describes, and it can drop
  away without leaving a hole.

- **Per chromosome, and silent where it cannot be said.** Serialisability is per
  chromosome, not per karyotype: an `hsr` is modelled as an overlay and has no band
  composition to state yet. One karyotype-wide string would have to either omit those in
  silence or claim a completeness it does not have, so each chromosome speaks for
  itself and the block hides entirely when there is nothing to say, as on a normal
  karyotype or a lone marker.

## 2026-08-28 (the same fusion is explained the same, whichever way it is spelled)

- **`rob(13;14)(q10;q10)` was explained and `der(13;14)(q10;q10)` was not, though they
  are the same event.** The Robertsonian sentence, which says the long arms fuse at the
  centromere, the short arms are lost, the lowest-number-first order records nothing
  about which centromere is kept, and the result is usually dicentric with one
  centromere inactivated, was gated on the parser setting a note that only `rob()` sets.
  Write the identical karyotype the other legal way and the decode collapsed to "an
  abnormal (derivative) chromosome that has chromosome 13's centromere."

  Backwards twice over. The same karyotype taught two different amounts depending on a
  spelling choice, and it was the spelling ISCN PREFERS that got less: 5.5.18.3 b,
  "Although either rob or der can adequately describe these whole-arm translocations,
  der is the preferred designation." The note is keyed on the SHAPE now, two acrocentrics
  with both breaks at a centromere, so both spellings get it. Written as `der`, the
  reader is also told the two spellings are equivalent and which one ISCN prefers;
  written as `rob`, they are not told to use what they already used.

  Scoped to the acrocentrics on purpose. A whole-arm `der(1;3)(p10;q10)` is the 5.5.18.2
  case, where real short-arm material is at stake, so it must not collect a sentence
  saying the short arms are lost and nothing is missed.

- **A correction to yesterday's entry, in place.** The #227 bullet claimed a whole-arm
  `der(13;21)(q10;q10)` kept "the Robertsonian note's more careful" wording. It did not:
  that was precisely the gap above, and the sentence overstated what shipped. Fixed both
  the claim and the behaviour it described.

## 2026-08-28 (the decode agrees with the figure about how many centromeres there are)

- **The prose said one centromere beside a picture of two.** #226 taught the renderer
  that a `der()` named across two chromosomes and built from joins is dicentric, and it
  now draws two constrictions under a `der(5;7)` caption. The decode still opened "an
  abnormal (derivative) chromosome that has chromosome 5's centromere", singular, which
  is the words contradicting the picture beside them. Exactly the shape of #224: a
  renderer fix leaving the decode behind, and worth noting that both were found by
  looking at the change rather than by a test.

  It now reads "carries the centromeres of BOTH chromosome 5 and chromosome 7, which
  makes it dicentric", which is what the name records (ISCN 5.4.3.1 b: "der refers to
  the chromosome(s) that has an intact centromere").

- **A whole-arm `der(13;21)(q10;q10)` deliberately keeps the singular reading.** It also
  names two chromosomes, but its centromeres meet AT the fusion point, so the figure
  draws one seam constriction rather than two waists, and the join-built wording would
  be wrong. (Corrected the next day: this bullet originally said such a karyotype gets
  "the Robertsonian note's more careful 'usually dicentric, with one centromere
  inactivated'". It did not, and that gap is fixed in the entry above.)
  The test is keyed on the shape of the notation and not on a centromere tally, because
  the model flags both whole arms `hasCen` (#207) while the drawing shows one: the two
  numbers legitimately differ there, and a rule reading the wrong one would be right by
  accident.

## 2026-08-28 (a derivative named across two chromosomes is the dicentric it says it is)

- **`der(5;7)` was drawn as a monocentric `der(5)`.** ISCN 5.4.3.1 b: "der refers to the
  chromosome(s) that has an intact centromere", so naming two means the derivative
  carries two, and 5.5.3 c ii describes this very karyotype as "a dicentric derivative
  chromosome with centromeres of chromosomes 5 and 7. An acentric chromosome 3 segment
  (3q21→3q29) is inserted between the long arm of chromosome 5 and the short arm of
  chromosome 7." It was reaching the single-join builder, which keeps one centromere and
  grafts an acentric tip, so the figure had the wrong number of centromeres, the wrong
  pieces, and a caption naming half of it.

  The joins form a path, not a star: each `t` names two chromosomes and a band on each,
  so the sub-ops chain the named chromosomes together and the derivative is that path
  walked from the first named chromosome to the last. A chromosome in the MIDDLE is
  bounded by both of its breaks; one at an END keeps its centric side when the der is
  named for it, and its acentric side otherwise, which is how a trailing fragment like
  3q21→3qter arrives. Both orderings ISCN prints come out right: 5 to 3 to 7 with the
  chromosome 3 piece sandwiched, and 5 to 7 to 3 with it trailing.

- **A sub-op on the derivative's SECOND named chromosome was dropped in silence.** Both
  the segment it applied to and the coordinates it resolved against were hard-wired to
  the primary, which is the same thing for a der naming one chromosome and wrong for a
  `der(5;7)`. ISCN 5.5.3 c iii is that derivative plus `del(7)(q32)`, written with the
  truncated end as an open break, `7p13→7q32:`; the deletion never reached the
  chromosome 7 arm. Unchanged for a der naming one chromosome, where the two are the
  same chromosome anyway.

- **And the caption follows.** `der(5;7)` was captioned `der(5)`: the rule from earlier
  today excluded a der carrying sub-ops, a guard aimed at `der(9)t(9;22)`, which names
  ONE chromosome and was already excluded by the count. All the guard did was name half
  of a dicentric derivative.

- **The ledger moves to 59 of 110**, and it failed on cue again when the fix landed.
  One structural hazard closed on the way: the new path already walks every join, so the
  chain walk added earlier today must not run over it a second time. It had been
  harmless only because a repeat application lands exactly on a segment boundary and is
  refused, which is luck rather than a guarantee.

## 2026-08-28 (the detailed system is read, not called gibberish)

- **Typing ISCN's detailed system got you told that ISCN's own notation is not ISCN.**
  `47,XX,+idic(15)(pter→q13::q13→pter)` came back with "“→” is not a character ISCN
  uses", the arrow stripped, and `47,XX,+idic(15)(pterq13::q13pter)` offered as the
  repair. It is a character ISCN uses: 5.4.2.2 c says "a single colon (:) is used to
  indicate a chromosome break and a double colon (::) to indicate break and reunion. To
  avoid an unwieldy description, an arrow (→ or –>), meaning from ... to, is employed",
  and both marks are in the symbol list. Telling a reader that correct notation is not
  notation, in the one place they came to check themselves against the standard, is the
  worst thing this app can do (docs/VALIDATION.md).

- **It is now read and drawn.** The two systems describe the same chromosome, and where
  the short form is recoverable the karyotype simply appears: the bands meeting at each
  "::" ARE the breakpoints, and a lone ":" is a break with nothing rejoined. All four
  shapes the standard prints come back correctly, including the grouping rule, since the
  chromosome numbers ride on the bands only when more than one chromosome is involved
  (5.4.2.2 b) and have to come back off: `dic(13;15)(13pter→13q22::15q24→15pter)` reads
  as `dic(13;15)(q22;q24)`. Both arrow spellings the standard gives are accepted, and so
  is a plain ASCII `->`, which is what a keyboard produces. The string is re-parsed as an
  ordinary short-system karyotype rather than rewritten in place, so no other rule in the
  parser has to learn about arrows.

- **A `der()` in the detailed system is explained rather than guessed at.** Its short
  form has to name the operation that built it, and `9pter→9q34::22q11.2→22qter` does not
  determine that, so the app says what the notation is, that it is correct, and that it
  reads the short system. It does not invent `der(9)t(9;22)(q34;q11.2)`.

- **It arrives as a note, not an alarm.** The message sits in the neutral box beside a
  finished drawing of exactly what was typed, for the same reason the repair notes do:
  an amber "Let us sort this out" over a correct figure contradicts itself.

- **And the round trip closes.** The app reads the detailed system, converts, draws, and
  its own serialiser prints back the string that was typed. A test pins that, which is
  the strongest available statement that the reader and the writer agree.

## 2026-08-28 (the decode catches up with the chain, and stops claiming a dosage it cannot see)

- **The prose described the first join and stopped, while the figure drew them all.**
  #223 taught the renderer to keep every join in a `der()` chain; the decode did not
  follow, so `der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)` read as "chromosome 1 out to 1p32
  with the end of chromosome 3's long arm attached" and never mentioned chromosome 11,
  which was right there in the picture in its own colour. A decode that omits a whole
  chromosome the figure shows is the two contradicting each other. A chain is now
  described as its joins, band to band, and names every chromosome it carries: "built
  from two joins, 1p32 to 3q21 and 1q25 to 11q13, so it carries material from
  chromosomes 1, 3, and 11". Band to band rather than by segment extent because that is
  what the notation states and it stays true when the second join lands on the GRAFT
  (`t(1;3)` then `t(3;7)`), where naming "the end of chromosome 3's long arm" would be
  wrong: that piece is bounded at both ends.

- **The lone-derivative note was stating a dosage it had not accounted for.** It names
  one gain and one loss and reads as the whole imbalance, so it is only sayable when
  that is true. On a chain it was flatly wrong, announcing partial trisomy for
  3q21→3qter and partial monosomy for 1p32→1pter while ignoring both the 1q25→1qter
  also missing and the chromosome 11 also present. One level down, the same held for a
  `der()` carrying its own deletion: `der(9)del(9)(p12)t(9;22)(q34;q11.2)` counted the
  translocation's gain and loss and said nothing about the 9pter→9p12 its own deletion
  removed. The note now withholds the arithmetic whenever anything else on the
  derivative changes dosage, and still gives it where it is true, including alongside an
  inversion, which is balanced and leaves the count intact. The deletion is still
  described; only the claim to have summed the imbalance is dropped.

## 2026-08-28 (a derivative built from a chain keeps every join)

- **A `der()` chain dropped every join after the first, so the chromosome was drawn
  missing whole grafted pieces.** `translocationSegments` consumes one `t` sub-op and
  only one, and nothing downstream applied the rest, so
  `46,XX,der(1)t(1;3)(p32;q21)t(1;11)(q25;q13)` came out as `3qter→3q21::1p32→1qter`
  with chromosome 11 nowhere on it, against ISCN 5.5.3 c's
  `3qter→3q21::1p32→1q25::11q13→11qter`. Silent, like the rest of this family: the
  figure looked finished. Five of the standard's own printed examples were affected.

  A chain is now walked outward rather than reasoned about. Each further join names a
  chromosome already on the derivative, cuts that piece at the named band, and hangs the
  partner off the cut, with the partner's broken end facing the junction, which is the
  same rule the first join follows. Which side of the cut survives is decided by
  geometry rather than by arm letters: a graft keeps the side still facing its existing
  junction, and the derivative's own arm keeps the side carrying the centromere. That
  covers both shapes a chain takes, a second join on the derivative's own chromosome
  (`t(1;3)` then `t(1;11)`) and a second join on the graft (`t(1;3)` then `t(3;7)`), and
  it composes with an inversion sitting in the middle of the chain.

  The surviving side has to be read off the DRAWN orientation, not the coordinate order.
  A reversed graft has its low coordinate at the bottom, so taking the attachment from
  the segment index alone kept the half that had been handed away and produced
  `3qter→3q28::7q11.2→7qter::1p32→1qter`, a chromosome carrying the piece it gave up.

- **The ISCN ledger moves from 52 to 56 of 110 karyotypes generated**, and it earned its
  keep on the way: the test that asserts recorded gaps are still gaps failed the moment
  the fix landed, which is exactly its job. Closing a gap has to be a deliberate edit to
  the ledger, never a silent drift. No curated figure changes; the one chained
  derivative on a landing page, Emanuel syndrome, has a single join.

## 2026-08-28 (the app can state what it drew in ISCN's own notation)

- **`Karyo.detailedForm` renders a built chromosome in ISCN's detailed system**
  (5.4.2.2), from the same segment list the figure is drawn from. `46,XX,idic(15)(q11.2)`
  serialises to `pter→q11.2::q11.2→pter`; the Philadelphia's derivatives to
  `9pter→9q34::22q11.2→22qter` and `22pter→22q11.2::9q34→9qter`. Sharing the data with
  the renderer is the whole point: the notation and the picture cannot drift apart,
  because they are the same thing said twice.

- **Which makes the standard a test oracle.** ISCN prints both forms for a hundred-odd
  karyotypes, so `test/iscn-2024-detailed.js` holds 110 extracted pairs, each verified to
  appear verbatim in the published text. 52 of them are fully generated today and
  asserted to match exactly; the rest carry a stated reason, in the tradition of
  `test/iscn-2024-examples.js`, and a second test asserts the gaps are still gaps so that
  closing one has to be deliberate rather than silent. The largest clusters: `hsr`
  modelled as an overlay rather than a segment (7), `der()` chains keeping only their
  first `t` sub-op (5), and `der(A;B)` with sub-ops modelled under the wrong name (5).

- **An isodicentric with a short-arm breakpoint was fused at the wrong end.** The two
  copies meet at the breakpoint, which is the join an isodicentric is defined by, and for
  a break on q the geometry produced that correctly. For a break on p the same code
  joined the two long-arm telomeres instead and pushed the breakpoints out to the tips,
  so `idic(17)(p11.2)` was a mirror image about the wrong point. ISCN prints it as
  `(qter→p11.2::p11.2→qter)`, which is what caught it. No curated figure changes:
  `idic(Y)(q11.2)`, the only isodicentric on a landing page, breaks on q.

- **A triplication had no caption.** `derLabel` had no `trp` case, so it fell through to
  the bare chromosome number and `trp(1)(q21q32)` drew a chromosome labelled `1` with
  nothing to say it was abnormal. Same family as the `idic` caption fixed earlier today.

- **Two formatting rules the detailed form needs, both from ISCN.** Contiguous
  same-sense pieces of one chromosome are a single stretch, since the model splits at
  every operation boundary for the drawing's sake while the notation breaks only where
  the chromosome broke: `dup(1)(q22q25)` is `(pter→q25::q22→qter)`. And the chromosome
  number is repeated on every band whenever the aberration names more than one
  chromosome, not merely when more than one number appears among the segments, so
  `dic(13;13)(q14;q32)` is `(13pter→13q14::13q32→13pter)` (5.5.4 f i).

## 2026-08-28 (a figure rendered in the wrong font now fails the build)

- **Both render scripts pull webfonts from Google over the network, and a hiccup there
  was silent.** The page simply rendered in the fallback face and the PNG was committed
  looking subtly wrong, with nothing said. Every committed karyogram and paper figure
  was exposed to it.

  The obvious guard does not work, which is why this one is written the way it is.
  Measured by rendering the same markup with and without the stylesheet:
  `document.fonts.check()` answered **true both times**, because a fallback family
  satisfies the query, while the PNG bytes differed. `document.fonts.ready` resolves
  just as happily. The honest signal is the FontFace SET, which the stylesheet populates
  when it parses and which is empty when it never arrived: five registered faces against
  zero. Registration rather than load status, since a face is only marked loaded once
  something paints with it, so a family a particular figure does not happen to use would
  look missing.

  The check is also asserted to be capable of failing: the expected families are scraped
  out of `index.html`, so a markup change there could leave the list empty and the guard
  would pass vacuously while still looking like a check. An empty scrape now throws on
  its own. Verified end to end by pointing the stylesheet at an unreachable host, which
  stops the run with the three families named.

- **The guard has one copy, in `scripts/lib/page-assets.mjs`.** Three scripts each
  scraped the same stylesheet and font links out of `index.html` with their own pair of
  regexes, so a change to that markup had to be chased through all of them. The scrape,
  the expected family list and `settleFonts` now live in one module that
  `render-images.mjs`, `render-paper-figures.mjs` and `stress-report.mjs` import. The
  stress report takes the styling only, since it writes a review page rather than a
  committed figure.

- **Known residual, stated rather than implied.** With fonts loading correctly, one
  figure (`t-11-22-carrier`) still re-renders with about nine pixels differing at a
  maximum channel delta of one: sub-visual antialiasing, a third source separate from
  the two closed earlier today (the shuffled example deck in fig1, the sub-pixel zoom in
  fig2). It is not fixed here. It costs an occasional spurious binary diff and nothing
  else.

## 2026-08-28 (a grafted arm is no longer drawn end-for-end)

- **A derivative whose own break is on the short arm drew its grafted piece upside
  down.** `translocationSegments` built both pieces unreversed and chose only their
  ORDER from which arm the derivative broke on. That is correct for a q;q translocation
  and wrong for every other shape, because the graft's broken end has to face the
  junction, and which end of the segment that is depends on the DONOR's arm as well.
  `der(1)` of `t(1;3)(p22;q13.1)` ran the chromosome 3 piece from 3q13.1 down to 3qter,
  joining 3qter to 1p22 when the break was at 3q13.1. The Philadelphia is q;q, so the
  one figure that gets checked most was right and the others were not, and every
  translocation test in the suite used q;q breakpoints, so nothing caught it.

  ISCN prints the answer for that exact karyotype, `der(1)(3qter→3q13.1::1p22→1qter)`,
  and 5.4.2.2 b makes the printed order a statement about the chromosome rather than
  about notation: the bands are listed "in the order in which they occur in the
  rearranged chromosome". The new tests are ISCN's own detailed forms for
  `der(1)t(1;3)(p22;q13.1)` and `der(X)t(X;8)(p22.3;q24.1)`, plus the q;q pair as a
  regression guard, plus the fourth combination (a donor that broke on p) derived from
  the same rule since no printed example covers it.

  One curated page was affected: `t(12;21)(p13;q22)`, the ETV6-RUNX1 translocation of
  childhood ALL, whose two derivatives were both drawn with the graft inverted. Its
  figures are regenerated here, as is the paper gallery, which carries a three-way
  translocation with a break on 7p.

- **`paper/fig1-interface.png` was stale.** It is a screenshot of the running app taken
  down to the bottom edge of the band legend, so it contains the legend, and the legend
  changed in #219 without the figure being rebuilt. The committed figure still showed
  the old unconditional gray row with its white swatch. Regenerated.

## 2026-08-28 (the stain rows follow the same rule as the mark rows)

- **The Involved view no longer explains gray when nothing on screen is gray.** #213
  gated every MARK row on what the figure draws and left the three stain rows
  unconditional, so the rule held for half the legend and leaked on the other half. In
  the Involved view of a plain `t(9;22)(q34;q11.2)` the figure draws chromosome 9 and
  chromosome 22, both coloured, and the legend still carried "gray = a chromosome not
  involved in the abnormality". The row now appears exactly when an uninvolved
  chromosome is drawn, read off the DOM after render like every mark row. It is checked
  against the involved set rather than against pixels, which is what makes the marker
  case come out right: a `mar` is drawn gray and is never one of the involved
  chromosomes, so `47,XY,t(9;22)(q34;q11.2),+mar` keeps the row that the plain
  translocation loses.

- **The same gate on the other two stain rows**, which leaked in the opposite
  direction: `46,XX,del(5)(p15.2)` was taught "variable region / stalk" although
  chromosome 5 carries no gvar or stalk band anywhere. Pericentromeric material carried
  across a junction (the `acen_carried` stain from #181) counts toward that row rather
  than the centromere row, since the variable-region texture is the one it wears.

- **The gray swatch is gray.** It was `#ffffff`, under the word "gray". It is now
  `BASELINE.gpos50`, the mid tone of the ramp an uninvolved chromosome is actually drawn
  in, and a test asserts the computed background matches that value rather than merely
  being dark.

## 2026-08-28 (a back-referenced rearrangement is drawn, not faked)

- **The second cell line of a mosaic was drawing normal chromosomes under derivative
  captions.** ISCN 4.2.1 f lets a rearrangement carry its breakpoints on the first
  mention and omit them afterwards, and the parser already recognised that: the bare
  `t(9;22)` in `46,XX,t(9;22)(q34;q11.2)[3]/47,XX,+8,t(9;22)[17]` was correctly excused
  from the breakpoint check. But it still reached the renderer with no breakpoints, so
  the geometry builder returned null and `buildInstance` fell through to its
  whole-chromosome fallback. The result, on a verbatim ISCN 2024 example: the first
  clone drew the Philadelphia correctly and the second drew an intact chromosome 9 and
  an intact chromosome 22 at their full normal lengths, captioned `der(9)` and
  `der(22)`, side by side on one screen with no warning. Nine of the standard's own
  supported examples reached it. The back-reference now copies the breakpoints forward,
  because "the same rearrangement as above" is what the notation means.

- **That fallback is now pinned as unreachable.** Four branches of `buildInstance`
  (`ins`, `rec`, `dic`, `der`/`t`) end by returning the untouched chromosome with
  `note: "complex"`, and nothing downstream reads `note`, so a builder that returns
  null does not fail: it draws a normal chromosome under an abnormal caption, which is
  the exact failure the draw gate exists to prevent. Two tests now walk the ISCN 2024
  corpus and the stress corpus and assert nothing the app agrees to draw reaches it, so
  the next builder with a gap fails in CI rather than shipping a false figure.

- **`npm run paper-figures` is reproducible.** Re-running it on unchanged code produced
  a different `fig1-interface.png` every time, so any commit that touched it carried
  figure churn and a real change could not be spotted in the diff. Two independent
  causes, both found by diffing two runs pixel by pixel rather than by guessing. fig1:
  the example-chip row is dealt from a shuffled deck, so a fresh browser context showed
  three different karyotypes each run; the figure script now seeds the page's
  `Math.random`. fig2: `fitGallery` fed raw sub-pixel `getBoundingClientRect` widths into
  `zoom`, moving about 160 pixels of antialiasing per render; the zoom factor is now
  quantised to three decimals. All three figures are byte-identical across runs.

- **A dead step in the fig1 script now fails loudly.** It looked for the Show button
  labelled "Affected" to isolate the involved chromosomes, but that button was renamed
  to "Involved" in #211 and the lookup was not, so for every build since then it found
  nothing and clicked nothing behind an `if (b)` guard. The figure stayed correct only
  because the app already defaults to that view, which is the kind of luck that hides a
  broken step until the default changes. It throws now.

## 2026-08-28 (the centromere rule is stated, not assumed)

- **The decodes now name the convention they were quietly applying.** A single
  breakpoint describes a whole isodicentric only because the piece that survives a break
  is the one carrying the centromere, and a reader who does not already know that cannot
  get from `idic(15)(q11.2)` to a segment. The idic decode says it outright, with the
  reason: a fragment without a centromere cannot hold onto the spindle at cell division,
  so it is lost. ISCN 5.5.3 a states the naming half ("the abbreviation always refers to
  chromosome(s) with the intact centromere"); the reason is cytogenetic rather than
  notational, and Gardner 5e puts it plainly ("An acentric chromosome is never viable,
  since it lacks a point of attachment to the spindle fibers").

- **The translocation decode states the same rule, because it is the same rule.** An
  isodicentric and a translocation invite being read as opposites, one keeping material
  and the other moving it away, and that reading is wrong: each derivative of a `t` keeps
  its OWN centric piece and receives the partner's centromere-free tip, which is exactly
  why ISCN names them `der(9)` and `der(22)`. What differs between the two is only the
  fate of the acentric tip, swapped in a translocation and dropped in an isodicentric.
  A test pins the two decodes to the same claim so a future edit cannot reword one into
  contradicting the other.

- **The centromere entry on the how-to-read card carries the rule in full**, since it is
  cross-cutting: it is why one breakpoint is enough for an isodicentric and why the
  pieces a translocation swaps are the tips. The per-aberration decodes state it
  compactly; that card is where it is spelled out.

## 2026-08-28 (the isodicentric decode says which piece, and which way round)

- **"15q11.2 to where?"** The isodicentric decode named the breakpoint and then said
  the chromosome "is duplicated as a mirror image", which never answered the reader's
  next question: duplicated from where to where, in what orientation, and at what cost.
  One breakpoint really is the whole story, but only because a convention fills in the
  rest, so the decode now states the convention instead of assuming it. For
  `46,XX,idic(15)(q11.2)`: chromosome 15 breaks at 15q11.2, and the centromere side of
  that break, 15pter to 15q11.2 (about 23 Mb), is joined to a second copy of itself; the
  two copies meet at the breakpoint as mirror images rather than one behind the other, so
  each brings its own centromere; and it replaces one copy of chromosome 15, trading
  15q11.2 to 15qter (about 79 Mb) for that second copy.

  Which side is kept comes from ISCN's own detailed forms, and it is not always the short
  arm: `46,X,idic(Y)(pter->q12::q12->pter)` for a break on the long arm, but
  `46,XX,idic(17)(qter->p11.2::p11.2->qter)` for one on the short arm (5.5.4 f vi and
  5.5.11 iv). A break on q keeps the p side and a break on p keeps the q side, because the
  piece that survives is the one carrying the centromere.

- **The plus sign decides whether an isodicentric costs anything.** Without it the idic
  replaces a homologue and the count is unchanged (5.5.4 b). With it the idic is
  supernumerary on top of an intact pair (5.5.4 f viii, "two chromosomes 13 plus the
  idic(13)"), so nothing is lost and the retained piece simply arrives twice more. That
  second case is the tetrasomy that makes `+idic(15)(q13)` the chromosome it is, and the
  decode had been describing both the same way. Copy TOTALS are still not stated: "three
  copies" is right for an autosome and wrong for `46,X,idic(Y)(q12)`, where there is no
  second Y to count against, which is presumably why ISCN words its own statement for that
  example as gain and loss.

- **A dicentric of two chromosomes names what each keeps and what is lost**, the same gap
  on the two-chromosome form. ISCN states the consequence for its own example (5.5.4 f ii,
  `45,XX,dic(13;15)(q22;q24)`: "loss of the segments distal to 13q22 and 15q24"). A
  breakpoint written at a centromere (`q10`, `p10`, `cen`) gets no such sentence, because
  both halves are centric there and nothing is distal to the break.

- **`dic(15;15)` is no longer described as "chromosomes 15 and 15".** The two partners are
  the two homologues of one pair, which is what ISCN calls them (5.5.4 f i, "the two
  homologous chromosomes 13"), and reading the list straight out also said the identical
  segment twice.

## 2026-08-28 (a fused chromosome is captioned with what it is)

- **`idic(15)` is captioned `idic(15)`, not `der(15)`.** The label under a drawn
  abnormal chromosome came out as `der(<lowest chromosome number>)` for every
  one-body derivative, which threw away both the symbol and the partner: an
  isodicentric read `der(15)`, a `dic(13;15)` read `der(13)`, a `rob(13;14)` read
  `der(13)`. ISCN's own prose is the model for how to name the object — "the karyotype
  contains one normal chromosome 13, one normal chromosome 15, and the dic(13;15)"
  (5.5.4 f ii), "two chromosomes 13 plus the idic(13)" (5.5.4 f viii), "one normal
  chromosome 21, and the der(13;21)" (5.5.18.3 b i) — and two rules come out of those
  sentences: the symbol is the one the writer used, and it names every chromosome the
  symbol names. `idic` in particular may not be flattened to `dic` or `der`, because
  ISCN 5.5.4 f ix keeps the two apart on mechanism: `dic(15;15)` for recombination
  between homologues, `idic` only where fusion between sister chromatids is proven.

  A translocation is the case that was already right and stays right. `t()` makes TWO
  chromosomes, each derived from one, so they remain `der(9)` and `der(22)` (5.5.3,
  "the der(9)t(9;22)"), as do the two products of an `ins()` and any `der()` whose join
  lives in a sub-op. The multi-chromosome spelling is only for the symbols that fuse
  into one body.

  The caption had no test, so the whole family could be renamed with the suite green.
  It has one now, across all four groups.

## 2026-08-28 (the centromere is a shape, and a dicentric says so)

- **Every centromere now pinches the chromosome into a waist.** It was a hatched block
  and a dashed line on a body of constant width, which reads as one more band on a stack
  of bands, and counting them is the only way to tell a dicentric from a normal
  chromosome. A real chromosome is narrower at its primary constriction, so the body is:
  the clip and the outline both follow the pinched path, the bands end at the waist, and
  a chromosome carrying two centromeres is obvious at a glance. Two readers arrived at
  this from opposite ends on the same day, one asking why `idic(15)` showed a single
  centromere and one asking for a thinner centromere region, and it is one request. The
  waist keeps its TRUE position and gives up height when it runs out of room, so an
  acrocentric's centromere near the tip and the two centromeres of an `idic(15)(q11.2)`
  about nine units apart each still get their own; the dashed midline marks the same y
  and would contradict a waist moved off it. The band map beside the figure pinches to
  match. `inv(9)(p11q13)` gains something it could not show before: the inverted
  chromosome's constriction sits lower than its normal homolog's, which is what a
  pericentric inversion does to the centromere.

- **`idic(15)` with no breakpoint is refused instead of drawn as a normal 15.** ISCN
  5.5.4 b: an isodicentric "involve[s] a single breakpoint on sister chromatids"; 5.5.4 a
  for `dic`: "two breakpoints are specified", one per chromosome. Without them the
  renderer had no break to mirror or fuse about and fell back to the whole untouched
  chromosome, so `46,XX,idic(15)` drew a full, single-centromere chromosome 15 under the
  caption `der(15)` and said nothing about it: a normal chromosome standing in for a
  two-centromere one. `dic(9;20)` was worse, dropping chromosome 20 from the figure
  altogether. Both now say which breakpoint the notation takes and name the ISCN form.

- **A `?` breakpoint is no longer also told it is missing.** ISCN 4.2.1 k writes `?`
  exactly where something was not determined, and 5.5.4 f v prints
  `47,XY,+dic(17;?)(q22;?)` verbatim. The app explained the `?` and then, underneath,
  demanded the breakpoint the `?` stands in for. `t(9;?)(q34;?)` had done this since the
  arity rule shipped; adding `dic` to the table is what surfaced it. The same message
  also said "involves one chromosomes, so it needs one breakpoints".

## 2026-08-27 (the legend labels stop describing themselves)

- **No legend row spells out its own shape any more.** The rows read "duplicated
  segment", "moved segment (nothing gained or lost)", "inversion", "breakpoint" and
  "where two chromosomes fused", where they used to open with "box:", "hooks: inverted,
  drawn end-for-end", "carets:" and "dashed line:". Naming the shape was the swatch's
  job before the swatch could do it: with every mark drawn as the same colored block,
  the label had to say what to look for. Now that each row draws its mark, spelling the
  mark out says the same thing twice. The picture names the mark, the words name what
  it means.

## 2026-08-27 (one word for the chromosomes in the rearrangement)

- **The Show toggle reads "Involved", which is the word the rest of the app was already
  using.** The button said "Affected" while its own tooltip, the Highlight caption, both
  legend rows, the About and Guide copy, and every condition page said "involved", so one
  idea reached the reader under two names on a single screen. "Affected" also has a job it
  cannot share: in genetics it describes a person who has the phenotype, which is exactly
  how KaryoDraw uses it elsewhere when it calls a recombinant carrier's parent typically
  unaffected. Chromosomes taking part in a rearrangement are involved, which is how ISCN
  and laboratory reports put it. Links copied before today keep working: a shared link
  carrying `show=affected` still opens the isolated view, and new links say
  `show=involved`.

## 2026-08-27 (the legend draws its marks)

- **The legend shows each mark's shape, not only its color.** Three rows name a shape,
  "box: duplicated segment", "hooks: inverted, drawn end-for-end" and "carets: a
  breakpoint", and each arrived as the same filled block, so the words carried the
  meaning and color was the only thing a reader could match against the figure. The
  block also disagreed with its own label, since the duplication box is drawn as an
  open frame. Every mark row now draws its mark: the box as that open frame, the hooks
  as opposed quarter-turn arrows, the carets as a rule with two inward heads, and the
  fusion seam as a dashed rule across the body. The geometry comes from the renderer,
  down to the direction the hooks turn, so a mark in the legend and the same mark on a
  chromosome are one picture. Rows where the color is the whole meaning, gray for an
  uninvolved chromosome and the per-chromosome keys, keep the filled block.

## 2026-08-27 (the segments state their size)

- **Every segment the decode names now carries a size estimate.** Requested by Luis
  Valiño Castrillón on LinkedIn, and the data was already in the model: the ideogram is
  UCSC hg38 with band boundaries in base pairs, so every drawn segment's length was an
  arithmetic fact the renderer computed and never said. Deletions, duplications,
  triplications, inversions, insertions, the recombinant's duplicated and deleted
  halves, the derivative's attached piece, and the lone derivative's trisomic and
  monosomic segments all state "about N Mb" (or kb); the band map states each band's
  own span with its GRCh38 coordinates. The "about" is load-bearing: a breakpoint
  written at a band can sit anywhere within that band, so sizes are measured from band
  midpoints, and the method is stated once on the how-to-read card. Tests assert each
  stated number falls within the bounds the band edges allow, not exact strings.

## 2026-08-27 (the wrapper earns its letters, and the band order speaks)

- **der() wrapping a single one-chromosome change is offered the plain spelling.** ISCN
  5.5.3 defines a derivative as rebuilt either by a rearrangement involving two or more
  chromosomes or by more than one change within a single chromosome, so
  der(15)ins(15)(p11q23q26) wraps a wrapper around nothing: ISCN writes
  ins(15)(p11q23q26). The app accepted the wrapped form without a word. It still draws
  as typed, and a Worth-knowing note beside the drawing now cites the rule and offers
  the plain form as a one-click redraw, never as a warning. Same treatment for a lone
  del, dup, or inv in the wrapper; true derivatives (two chromosomes, or two changes)
  and inputs that already carry a spelling note are left alone.
- **The decode names the orientation the band order encodes.** ins(15)(p11q23q26)
  now says the moved segment keeps its own orientation, and ins(2)(p13q31q21) that it
  sits end-for-end (ISCN 5.5.9.1), read off the same band comparison the renderer uses,
  so the sentence and the hooks in the figure cannot disagree. Both came from auditing
  an outside answer about this exact karyotype against what the app teaches.

## 2026-08-27 (the isochromosome owns its centromere)

- **Hovering an isochromosome's seam-flanking centromere band now answers "Centromere",
  the same as the normal homolog.** On i(18)(q10) the two 18q11.1 bands answered
  "Pericentromeric heterochromatin", with body text about material carried across a
  derivative junction. That was the #181 downgrade overshooting: it exists so a der
  graft's acen material cannot read as a second centromere, but an isochromosome's
  seam-flanking acen IS its working centromere's own material, sitting at the drawn
  waist. A Robertsonian, with the same seam geometry, already answered "Centromere"
  there, because its whole-arm segments carry hasCen; the iso now follows the same
  convention. The single seam waist is unchanged at every band level, and the true
  der-graft case keeps its downgrade, both pinned by test.

## 2026-08-27 (the insertion shows its move, and a repaired spelling stops sounding like an alarm)

- **A drawn insertion now wears marks.** An intrachromosomal insertion drew with no mark
  at all, both pieces being the same chromosome, so not even a fusion seam betrayed the
  move; Dan looked at the visitor's der(15)ins page and said there was no mention of an
  insertion in the figure. The moved span now wears a slate box, the neutral member of
  the box family (amber = an extra copy, slate = moved here, nothing gained or lost),
  the teal hooks arrive automatically when the insertion is inverted, because the hooks
  read the segment model, and red carets sit at the excision point the segment left,
  down in the arm it came from. The legend gains its conditional row.
- **The spelling repair teaches the insertion's own rule.** The generic "breakpoints on
  the same chromosome are written one after the other" did not explain why the insertion
  site leads, and Dan flagged it as probably wrong. Checked against ISCN 2024: the
  repair was right and the citation was lazy. It now says an insertion within one
  chromosome is written as one run, the insertion site first and then the segment's own
  breakpoints (ISCN 5.5.9.1), in the standalone form and the der-carried one alike.
- **A repaired spelling that drew presents as a note, not an alarm.** "Let us sort this
  out" over a finished, correct drawing contradicts itself the same way the old
  cannot-draw heading did. When every message is a so-X-is-Y repair and no alternative
  reading is on offer, the box takes the neutral note styling under "One spelling note,
  already applied".

## 2026-08-27 (the lone derivative names its imbalance)

- **A single der from a reciprocal translocation now states what it implies.** Dan looked
  at 46,XX,der(8)t(4;8)(p16.1;p23.1) and asked where the swap was. The figure was right,
  two intact 4s and one der(8), and the page never said why: a lone derivative means the
  reciprocal der(4) is NOT in this karyotype, so the attached 4p16.1→4pter segment is
  present in three copies and the replaced 8p23.1→8pter segment in one. The decode now
  says exactly that, names the absent partner, and teaches the usual origin (a parent
  carrying the balanced translocation), dropping the parental sentence when the change
  is marked de novo. The note speaks only in the textbook count situation and never on
  a balanced der pair; anywhere the arithmetic differs it stays silent, because a wrong
  dosage claim is worse than none. This is the der's version of the rec's inferred
  deletion (ISCN 5.4.3.2 c): the half the notation leaves out is the half that matters.

## 2026-08-27 (the derivative draws its insertion, and nothing it carries is dropped in silence)

- **der(N) carrying ins(...) now draws the insertion.** A visitor's one-click flag, sent
  with no message, carried the URL that exposed it: 46,XY,der(15)ins(15)(p11;q23q26)
  parsed with zero warnings and drew an untouched full-length chromosome 15 labeled
  der(15), because the derivative sub-op path applied only del/dup/inv/t and dropped
  everything else silently. The intrachromosomal move, the recipient side, and the donor
  side (ISCN prints 46,XY,der(3)ins(16;3)(p12;p21p13)dmat) all draw now, composing with
  del/dup/inv on the same derivative, and the decode names the moved segment and its
  destination instead of stopping at the centromere sentence. The same-chromosome
  semicolon form gets the same repair and lesson as the standalone ins.
- **add and hsr sub-ops draw as overlays instead of vanishing.** der(5)add(5)(p15.3)add(5)(q23)
  and the der+hsr forms are printed in ISCN 2024 and drew as untouched chromosomes.
- **What still cannot be drawn now refuses and says why**: ring-built derivatives
  (der(1)r(1;3)..., ISCN 5.5.16 b), an insertion combined with a translocation on one
  derivative, and insertions of undetermined (?) material. Eleven conformance-ledger
  entries were marked supported while silently drawing nothing; they are re-flagged
  honestly, and the paper and VALIDATION.md tallies drop from 337 to 326 accordingly.
  Losing eleven from the number is the cost of the number being true.

## 2026-08-27 (the caption and the legend describe the figure, part two)

- **The landing-page caption now states what its own figure shows.** Every single-clone
  affected figure was captioned "showing the involved chromosomes with their normal
  homolog", which is false on the marker page, where the figure is one small capsule
  with no homolog to draw and no chromosome banding can assign it to, and quietly wrong
  for pure count changes. The suffix now comes from the model: a structural change
  keeps the homolog comparison, a whole-chromosome gain says all copies of the gained
  chromosome, a marker says only the marker itself, and a bare count change says the
  chromosomes whose count changed. test/seo.test.js reads the generated pages, which
  pretest rebuilds, so template and output cannot drift apart.
- **The fused-junction legend swatch now looks like the mark it names.** It rendered as
  thick vertical stripes filling the chip; it is now a thin dashed midline on a white
  chip, the same line the figure draws. The stray box-drawing bar before "involved:"
  is gone.

## 2026-08-26 (the terms follow the tool onto the network)

- **KaryoDraw is now AGPL-3.0-or-later, and its teaching material is additionally
  offered under CC BY-SA 4.0.** MIT let anyone take the parser, the renderer, and the
  curated explanations, close the source, and sell the result, asking only that a
  copyright line survive in a file nobody opens. The Affero clause follows the work
  onto the network instead: a modified KaryoDraw served to users has to ship its
  source under the same terms. The content grant runs the other way, so an educator
  can lift a decode paragraph into a slide under CC BY-SA without inheriting a
  software license. Neither license restricts commercial use; both require
  reciprocity, and StudyRare grants separate commercial licenses for anyone who
  wants neither. Relicensing is not retroactive: every commit through `e707ddb`
  stays MIT. Scope, the band-data note, and the contact address are in
  `LICENSING.md`; contributors are now asked for a relicensing grant in
  `CONTRIBUTING.md`, which is what keeps the commercial option alive.

## 2026-08-26 (a box for gain, hooks for a flip, and a legend that tells the truth)

- **The inversion mark is now the hooks alone; the box means duplication and nothing
  else.** Shipping #199 put a teal frame around inversions and an amber one around
  duplications, one shape with two meanings split by color. Dan cut the inversion
  frame the same day: a box now appears exactly when something is extra, hooks mean
  drawn end-for-end, and the two devices compose on the recombinant (amber box, teal
  hooks) while differing by shape, which no colorblindness can erase.
- **The legend lists exactly the marks the drawn figure contains.** It was static: a
  plain t(9;22) was taught a dup frame, inversion hooks and red carets, none on
  screen, while the dashed fusion seam it actually shows had no entry. Rows are now
  read off the rendered karyogram, the seam has its entry, the caret swatch takes the
  color actually drawn, and the Realistic add row follows the same rule. Pinned in a
  real browser by test/legend-describes-the-figure-browser.test.js.

## 2026-08-26 (the span wears its meaning on the margin)

- **Highlight mode now marks duplicated and inverted spans with an outset frame, and
  flipped spans with quarter-turn hooks.** Until now the only span-level mark was a pair
  of carets at the breakpoints; nothing said which piece was the extra copy or that a
  stretch runs backwards. The frame wraps the span from outside the body, so every band
  keeps its full width; amber means duplicated, teal means inverted, and the legend
  teaches both in this mode instead of in Realistic, where nothing has drawn them since
  the marks left that theme. Opposed quarter-turn hooks at the frame's diagonal corners,
  always teal, mark any span drawn end-for-end, read straight off the segment model. The
  channels compose on the recombinant: an amber frame with teal hooks says "an extra
  copy, and it is flipped", the two facts a rec(2)dup(2p) reader needs. The inversion
  color moved from #5e72e4, which was the same hex as the first affected-palette hue and
  vanished on its own chromosome, to the app's existing segregation teal. Designed with
  Dan over five rendered preview rounds; docs/INTERFACE.md records the grammar and the
  losing alternatives.

## 2026-08-26 (the decode stops denying the inheritance it names)

- **The recombinant paragraph now affirms the inheritance the dmat row states.** It used
  to end "The carrier parent is balanced and healthy; this chromosome is not the
  parent's chromosome", which a careful reader parses as contradicting "inherited from
  the mother" two lines below it. Dan read exactly that and asked which was right. Both
  clauses were true and the sentence was still wrong, because the mechanism connecting
  them was missing. It now says the recombinant IS inherited from the carrier parent,
  yet no body cell of that parent contains it, because it first exists in the egg or
  sperm the crossover made, which is the distinction ISCN 4.2.1 g builds the d- suffix
  to carry. "Healthy" also became "typically unaffected"; a balanced karyotype licenses
  the weaker claim, not the stronger one.

## 2026-08-26 (the marks let the pointer through)

- **Hovering a decorated region now names the band beneath it.** The tooltip reads the
  band rect under the pointer, so anything drawn on top of the bands without
  `pointer-events="none"` was a silent stripe: the centromere hatch and its dashed
  midline muted the tooltip over every centromere, and Highlight mode's break carets
  and fusion seam muted it at the exact breakpoints a reader most wants to inspect.
  Dan hit the class first on the rec(2) duplication wash, which the previous entry
  removed; these were the survivors. The rule, pinned by test across shapes and both
  styles: a mark overlaying true content lets the pointer through, and a mark that
  replaces content must answer for itself, the way the fragile-site gap already does.
  Known remaining gap, deliberate: `add` and `hsr` regions stay opaque and silent,
  because the bands under them are not really there and naming them would be false;
  giving those regions their own answer is a follow-up.

## 2026-08-26 (the Realistic style keeps its promise)

- **Realistic mode no longer highlights the abnormality it tells you to spot.** The
  style's own caption reads "true-to-life Giemsa banding on every chromosome, nothing
  highlighted. Try to spot the abnormality yourself", and since the toggle was renamed
  (2026-07-01) the renderer had broken that promise on the same screen: a duplication
  carried an amber wash, an inversion a blue one, every breakpoint a pair of red carets,
  and a derivative a dashed seam at the fusion. Dan caught it on
  `46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat`, whose grafted p-distal copy drew as a solid
  amber block with red carets pointing at the junction. The rule now enforced by test:
  in Realistic mode an overlay draws only if it IS material rather than commentary
  about material. The unknown-material hatch of `add`, the homogeneously staining block
  of `hsr` and the unstained gap of `fra` stay, because a real slide shows those too;
  washes, carets and seams belong to Highlight mode, whose whole job is marking. The
  never-emitted `del` wash branch is deleted rather than gated. Highlight mode is
  unchanged.

## 2026-08-26 (the app opens on the chromosomes you asked about)

- **A karyotype with an abnormality now opens isolated, not as all 46.** Typing
  `46,XY,t(9;22)(q34;q11.2)` used to draw the full karyogram, where the two derivatives
  are a few pixels wide in a field of 46 and the comparison that teaches them, each
  derivative against its own normal homolog, is scattered across four rows. It now opens
  on chromosome 9 with its der(9) and chromosome 22 with its der(22), side by side and
  large. `All` is one click away and unchanged. This also settles a split the product
  had with itself: the generated condition pages, the printable summary, and the launch
  figures all render affected-only through the shared renderer, and the app was the only
  surface that did not. A normal karyotype has nothing to isolate, so `46,XX` still draws
  in full and the toggle hides itself.

## 2026-08-26 (the inheritance suffix gets its own line)

- **`dmat`, `mat`, `pat`, `dn` and `c` now decode on a row of their own.** They used to
  ride in a parenthesis at the end of the aberration's paragraph. On a recombinant
  chromosome that meant four more lines of prose after ten, so the panel read as one
  block of text and the fact that decides the counseling, that the child's chromosome is
  not the balanced parent's chromosome, was the easiest thing in it to miss. ISCN 4.2.1 g
  treats these as a suffix saying where the rearrangement came from rather than part of
  the rearrangement, so the decode now gives each one a row and a code chip, the way the
  count and sex fields have always had one. The aberration's own chip sheds the suffix at
  the same time: `rec(2)dup(2p)inv(2)(p21q31)dmat` is now a `rec(2)dup(2p)inv(2)(p21q31)`
  row followed by a `dmat` row, so exactly one row claims it. The chip is slate rather
  than a lesion color, because origin is not a finding.

## 2026-08-26 (the export stops telling you when it was drawn)

- **Exported and copied figures no longer carry a date.** The watermark under the
  karyogram read `karyodraw.com · 2026-08-26`; it now reads `karyodraw.com`. The date
  was there to tie a figure found in a slide deck years later back to the date-grouped
  entries in this file, which serves the repo rather than the person exporting. These
  figures go into lecture decks and question banks that get reused for years, and a
  visible date makes a still-correct karyogram look stale the moment the year turns.
  The export now reads no clock at all. Provenance is still recoverable: the karyotype
  travels in the filename, and the site always runs the latest deploy.

## 2026-08-24 (the waist answers the pointer)

- **Hovering the fragile-site gap now says what it is.** The karyogram tooltip keys on
  `.band` rects, and the unstained gap rect sat on top of the q27.3 band with neither
  the class nor the data attributes, so pointing at the one feature this chromosome is
  about made the tooltip go silent. The gap rect now presents itself as a hoverable
  band with a `fra` pseudo-stain (the `acen_carried` precedent), so the tooltip reads
  "Xq27.3 Fragile site (unstained gap)", the amber box outlines the gap, and the detail
  plate scrubs to the band. The hairlines pass the pointer through so they cannot
  shadow it.
- **Why the constriction stays white, recorded once.** Xq27.3 is a gpos100 band, the
  darkest stain on the chromosome, and the fragile site is an achromatic gap inside it:
  the chromatin decondenses under replication stress and fails to take up Giemsa.
  Paper-white against the dark band is the observation itself; painting the gap to
  match the band would claim stained chromatin where the whole point is that there is
  none. `Teach.stainInfo("fra")` now carries this explanation.

## 2026-08-24 (a fragile site now looks like one)

- **The body constricts into a waist at a fragile site.** `fra` drew a flat unstained
  gap crossed by two hairlines, near-invisible at karyogram scale: the affected X of
  `46,X,fra(X)(q27.3)` read as a normal X unless you knew where to squint. The clip
  path and the outline now both follow a pinched capsule, so the bands end at the
  constriction the way they do under the microscope (Gardner 5e calls the appearance
  an "apparent rupture", with the distal material still attached, which is exactly
  what a waist claims and a break mark would not). The gap and its hairlines still
  sit inside the waist, now clipped to the pinched body so they cannot overhang it.
  Waist centers are clamped clear of the end caps, and multiple sites on one
  chromosome each get their own pinch.
- **The red sub-label finally names the operation.** `derLabel` had a case for every
  abnormality kind except `fra`, so while a deletion is captioned `del(5)` and a
  duplication `dup(1)`, a fragile-site chromosome fell through to a bare `X`. It now
  reads `fra(X)`.

## 2026-08-24 (the clinical card counts chromosomes instead of reading the sex field)

- **A rearranged X is still an X, so stop calling those karyotypes Turner syndrome.**
  The sex-chromosome matchers behind the clinical card read `clone.sex.label`, the sex
  field exactly as written. ISCN 5.5.18.1.1 iii moves a rearranged sex chromosome out of
  that field and into the aberration list, so the field cannot say how many X a clone
  carries, and the card was wrong in both directions. `46,X,fra(X)(q27.3)`, which ISCN
  5.5.7 a i glosses as "a female", was labelled Turner syndrome; so was
  `46,X,t(X;4)(p21;p16)`, a balanced carrier with two whole X. Meanwhile
  `45,fra(X)(q27.3)` ("an individual with Turner syndrome", 5.5.7 a iii) and
  `47,XY,fra(X)(q27.3)` ("Klinefelter syndrome", a iv) matched nothing at all, and
  `48,XXYY` matched nothing although the Klinefelter note names it as a variant. The
  matchers now read `clone.complement`, which already counts a rearranged X as an X, the
  same correction `sexNote` had made for the decode row and nothing else. Turner turns on
  whether the second sex chromosome lost material, which is what makes `46,X,i(X)(q10)`
  and `46,X,r(X)` variants and leaves a fragile site or a balanced translocation out.
- **A euploid polyploid is not aneuploid for anything.** `69,XXX` was reported as Down
  syndrome, Edwards, Patau *and* Triple X at once, and `92,XXXX` as the first three,
  because every matcher counted copies without asking how many a full set is for that
  clone. All of them now require a diploid clone. Three published pages carried this:
  `/karyotype/triploidy/` (four wrong syndromes), `/karyotype/tetraploidy/` (three), and
  `/karyotype/x-autosome-translocation-manifesting-carrier/` (Turner syndrome on a
  balanced carrier). `/karyotype/xxyy-syndrome/` gains the Klinefelter note it describes.
- **The print sheet said "monosomy X" about a female.** It built its sex line from
  `clone.sex.note`, the parser's field-only reading, while the screen beside it used the
  corrected one. For `46,X,fra(X)(q27.3)` the exported sheet and the decode row said
  opposite things. `Teach.sexNote` is exported now and both read it.
- **Fragile sites are drawn and explained.** `fra` parsed and passed the draw gate from
  the start, but there was no branch for it in either the renderer or the decode: the
  chromosome was drawn identical to a normal one, and the decode row for the only
  abnormality in the karyotype was the generic "an aberration that KaryoDraw drew as best
  it could". It now draws as an unstained gap at the band, deliberately not as a
  breakpoint, because the point of a fragile site is that the fragment beyond the gap is
  still attached. The decode says so, names the band, and separates the normal-variant
  case (ISCN 2.6.2) from the disease-associated one (5.5.7). `fra(X)(q27.3)` gets a
  clinical note: the gap reflects a CGG expansion in <i>FMR1</i>, and the diagnosis is
  molecular, not cytogenetic.
- **A fragile site written across a slash gets a note, not a warning.**
  `46,X,fra(X)(q27.3)[5]/46,XX[45]` is well-formed ISCN (4.5.3 b, e) and is how the old
  reports scored fragile X, so it draws as written. But a slash means two cell lines from
  one zygote (4.5.2 a), and the expansion is in every cell: what varies is whether the
  site is *expressed* in a given metaphase. The note says the counts score expression
  rather than clonality, and that all five fragile-site examples ISCN prints are written
  without a slash.
- **`45,fra(X)(q27.3)` joins the conformance corpus**, which had ISCN 5.5.7 a i, ii, iv
  and v and had dropped iii. The corpus is 395 examples, 337 drawn. `docs/VALIDATION.md`
  still said 302 accepted, a number the project had outgrown by 35, and there was no test
  on it; there is one now, matching the one that already pins the paper's copy.

## 2026-08-24 (every word in the title now matches something people type)

- **"Online", "free" and "tool" come out of the homepage title.** Checked against the
  Search Console export rather than argued about: across 144 reported queries, "karyotype"
  appears in 53 of them for 98 impressions, "karyogram" in 3 for 7, "draw" in 2, "ISCN" in
  1, and "online", "free" and "tool" in **none**. Those three were filling space. The
  earlier round of this title had kept all three and then dropped "free" to buy room for
  the brand suffix, which was the wrong one to drop of the three, and the answer was that
  none of them had earned the space. The title is now
  `Draw Any ISCN Karyotype as a Banded Karyogram | KaryoDraw`, 57 characters, where every
  word either matches a real query or is the brand. "Banded" says what the drawing is, in
  the same words the subhead uses.

## 2026-08-24 (the site name needed the title to agree with it)

- **The brand goes back in the title.** The `WebSite` node added on 2026-08-18 was
  supposed to make the result read "KaryoDraw" instead of "karyodraw.com". Six days on it
  still read the domain, while already showing the new title, which is what proves the
  markup had been crawled and passed over rather than missed. Google's site-name guidance
  names four sources and asks that they agree: the `WebSite` node, `og:site_name`, the
  `<title>`, and the headings. The same change that added the node had stripped
  "| KaryoDraw" from the title on the theory that the node made it redundant, so two of
  the four were saying nothing. "Free" comes out to pay for the suffix, which keeps the
  title at 58 characters, under where Google truncated its 67-character predecessor.
  Whether Google takes the hint is still Google's call; what changed is that it is no
  longer being given a reason to decline.

- **`alternateName` is gone.** It read "KaryoDraw ISCN karyotype visualizer", which is a
  description in the name field. Google falls back to `alternateName` when it declines the
  preferred name, so that string would have been worse in the result than the domain it
  was meant to replace.

- **`npm run seo-check` checks the deployed site, not the repo.** Both search-appearance
  bugs so far were invisible to `test/seo.test.js`, which reads files, and both were one
  command to see: `www` and `http` answering 200 for days, and a correct `WebSite` node
  sitting beside a title that had gone quiet. The script fetches the live homepage and
  reports the four site-name sources, the title length, the canonical, and the redirects,
  exiting non-zero when they disagree. It found both of today's defects on the first run.

## 2026-08-18 (four spellings of every page, and a heading no one was searching for)

- **One origin.** `www.karyodraw.com` and plain `http://` each answered 200, so Google
  indexed and ranked four spellings of every page independently. The first Search Console
  export shows the split doing real damage:
  `https://www.karyodraw.com/karyotype/isochromosome-xq/` sat at position 17 while its
  apex twin drew no impressions at all, and seven of the forty reported URLs were `www`
  or `http` variants of pages that also appear under the apex. The canonical tags were
  always correct, which is why this was survivable rather than fatal, but a canonical is
  a hint and a 301 is not. The Worker now redirects both to `https://karyodraw.com`,
  scoped to the production hostname so local dev is untouched.

- **And the redirect above did nothing until the routing was fixed.** It shipped with
  `assets.run_worker_first` unset, which is the default, and under that default Cloudflare
  answers any request matching a static asset from the asset layer without invoking
  `worker.js` at all. Every URL in `sitemap.xml` is a static asset. So the 301 ran on
  `/api/*` and on 404s, which is precisely the set of URLs nobody searches for, while
  `https://www.karyodraw.com/karyotype/isochromosome-xq/` went on returning 200. The three
  tests written to cover it called `worker.fetch` directly and passed the whole time. HTML
  now routes through the Worker and binaries stay on the free asset path, and two new
  tests walk every URL in the sitemap against the routing patterns, so what gets asserted
  is that the handler is reachable and not only that it is correct.

- **The homepage heading is the verb people type.** `<h1>` was "Karyotype diagram maker",
  chosen without data when the brand wordmark was demoted out of the heading. Across the
  144 queries Search Console reports for the site, "maker", "generator", and "diagram
  maker" drew zero impressions between them. The only tool-intent queries the site
  surfaces for at all are "karyotype drawing" (position 15) and "how to draw a karyotype"
  (position 22), so the heading is now "Draw a karyotype" and the title leads with the
  same verb. The title also drops from 67 characters to 51, which is under where Google
  truncated it in the live result.

- **The result carries the site name instead of the domain.** Every generated sub-page
  referenced `isPartOf: WebSite` but no page ever declared that `WebSite`, and Google
  reads it from the homepage only. So the SERP printed "karyodraw.com". The homepage now
  declares it, spelled to match `og:site_name` and the sub-page title suffix.

- **ISCN leaves the opening sentence.** It appeared twice within the first screen, in the
  subhead and on the field label directly beneath it. The label is where someone about to
  type needs the acronym; the subhead is where an unfamiliar reader meets it at the third
  word and stops. It stays in the title, the description, and the label.

## 2026-08-13 (the paper shows the rearrangements it claims, and stops quoting numbers it has outgrown)

- **One figure, for a page of claims.** The JOSS paper described ring chromosomes
  drawn as annuli, mosaics drawn as every cell line, n-way translocation cycles and a
  meiotic segregation panel, and illustrated all of it with a single screenshot of a
  reciprocal translocation. Two figures were added: a gallery of six rearrangement
  classes (Robertsonian, ring, isochromosome, three-way translocation, mosaic, and the
  new recombinant), each captioned with the ISCN string that is its only input, and
  the segregation panel for a `t(11;22)` carrier showing the to-scale pachytene cross
  beside alternate and adjacent-1 with their gametes and conceptuses.

- **The figures are generated now.** `npm run paper-figures` renders all three by
  driving the real page in a browser, the same way the stress sheet does, and refuses
  any karyotype that raises a warning. The old figure was a hand-captured screenshot
  of an interface 101 commits out of date, showing a chip row, a control layout and a
  header the app no longer has.

- **Numbers the paper had outgrown.** It claimed 40 curated examples against 41, "over
  450" tests against 492, and listed as a limitation something the renderer had since
  learned: a derivative carrying several embedded rearrangements does apply its
  deletions, duplications and inversions in turn, and only an embedded insertion is
  still left at the join. The ISCN 2024 conformance corpus is now quoted precisely
  (336 of 394 drawn), and `test/paper.test.js` pins every count to the array it
  describes, so the paper and the software cannot drift apart again in silence.

## 2026-08-13 (the recombinant chromosome an inversion carrier passes on, and the half ISCN does not write)

- **`rec` draws.** A pericentric inversion carrier is healthy and gets counselled
  precisely because of what a crossover inside the inversion loop can produce, and that
  chromosome is written `rec`. It was refused, politely, as notation with no drawing.
  The shape is taken from ISCN's own detailed form rather than reasoned out: 5.5.15 d i
  gives `46,XX,rec(6)dup(6p)inv(6)(p22.2q25.2)dmat` as
  `rec(6)(pter→q25.2::p22.2→pter)dmat`, which is one piece running 6pter through the
  centromere to 6q25.2 and a second running 6p22.2 back out to 6pter. So the p-distal
  segment is present twice with the extra copy end-for-end, and everything past the q
  breakpoint is gone. `dup(Nq)` is the reflection. Both are drawn from one function,
  because the duplicated arm is the only thing the two strings differ in.

- **The decode names the deletion, which the notation never states.** ISCN 5.4.3.2 c:
  "the duplication (dup) is explicitly stated, and the deletion is inferred". A decode
  that echoed the string faithfully would therefore hand a reader the half that is not
  driving the phenotype. Both segments are named, and the sentence says which one was
  left out and why, alongside the fact that the balanced parent and the unbalanced child
  do not have the same chromosome.

- **A `rec` off a paracentric inversion is refused, and the refusal is the teaching.** A
  crossover inside a paracentric loop gives an acentric fragment and a dicentric
  (Thompson & Thompson, 9th ed, Fig 5.12A), not a duplication and a deletion. Drawing a
  guessed shape would have been the expensive mistake here, because the invented figure
  would look exactly like the pericentric one that is real. Insertion-derived `rec`
  (5.5.15 d ii, iii) is a different geometry and stays undrawn, with a message that says
  which half of `rec` is missing rather than implying the notation is at fault.

- **`inh`, `dmat`, `dpat` and `dinh` parse (ISCN 4.2.1 g).** These are not longer
  spellings of `mat` and `pat`: they record that only *part* of a parental rearrangement
  was inherited, so the parent's balanced chromosome and the child's are different
  chromosomes. Every `rec` printed in ISCN carries one, so their absence had been
  refusing every `rec` in the standard, and it also cost two `der(…)ins(…)dmat` examples.
  Five more of ISCN 2024's printed examples now draw, taking the corpus from 331 of 394
  to 336.

- **One reader for `der` and `rec` sub-ops.** Both write their make-up as a chain of
  `op(...)` groups with no commas between them (5.4.3.2 d says so for `rec` outright), so
  the sub-op parsing `der` already had is now shared rather than copied.

## 2026-08-12 (the decode row stops squeezing its own explanation into a ribbon)

- **A long ISCN token starved the sentence beside it.** `.decode-row` was a
  `grid-template-columns: auto 1fr` with a `white-space: nowrap` code chip, so
  `der(X)t(X;5)(q22.1;q31)dn` took whatever width it wanted and left the explanation
  a few words wide, running far down the panel past a tall block of empty space
  beside the chip. The longer X-inactivation sentences made it obvious rather than
  causing it. The row is a wrapping flex now, with a `15rem` flex-basis on the text:
  it stays on the chip's line while it fits and drops to its own full-width line when
  it does not, so a row is either tidy or full width and never a ribbon. At the same
  panel width the decode went from 888px tall to 411px.

- **The landing pages had the same shape, and it bit on phones.** `.lp-decode` is one
  grid for every row, so the code column is as wide as the longest token anywhere on
  the page and every other row pays for it. Under 620px the list now stacks, token
  above sentence. The generated page went from 733px to 498px at 390px wide, with no
  horizontal overflow.

## 2026-08-12 (a karyotype that omits the sex field keeps its translocation)

- **`46,t(X;Y)(q22;q11.23)` drew a normal 46,XY.** ISCN drops the sex field entirely
  when the sex chromosomes are themselves in the rearrangement, and prints both forms
  in 5.5.18.1.1: `46,t(X;Y)(q22;q11.23)` (iv) and
  `46,t(X;18)(p11.2;q11.2),t(Y;1)(q11.23;p31)` (v). The parser took the second field
  as the sex field unconditionally, so `parseSex` harvested the X and the Y out of the
  operation, discarded `t`, `(`, `;`, `)` and every digit one character at a time, and
  the translocation never reached the aberration list. Example v was worse than iv:
  the first translocation was eaten and the second survived, so the figure looked
  complete while silently missing half the karyotype.

  A sex field never contains a parenthesis, so the bracket is the tell. The field is
  now treated as omitted, the operations parse as aberrations, and the sex complement
  comes from the sex chromosomes named in them, one copy each. Whether the omission is
  legitimate is settled after parsing: a leading operation naming no sex chromosome
  (`46,t(9;22)(q34;q11.2)`) is not the ISCN shorthand but a karyotype missing its sex
  field, and goes back to the existing gate. A mistyped field (`46,XQ,+21`) still
  reads as a sex field.

  The decode gains a row for it, because absence is the notation here and a blank
  would read as the app having lost something.

## 2026-08-12 (a derivative stops growing a second centromere, and a dropped band range speaks up)

- **`der(19)t(X;19)(q11.1;p13.3)` drew two centromeres.** Xq11.1 spans 61.0 to 63.8 Mb
  and a break "at Xq11.1" resolves to the band midpoint, so the graft really does
  carry 1.4 Mb of acen-stained X material. The band painter hatched it as a
  centromere and the tooltip called it one, making a monocentric derivative read as
  dicentric. The waist was already gated on the segment's `hasCen`; the band paint
  was not, so the two disagreed. Acen material on an acentric segment now renders as
  heterochromatin under a new `acen_carried` stain, described as "Pericentromeric
  heterochromatin" with a note that a chromosome which truly keeps two centromeres
  is a dicentric and is written `dic()`. This is the same false claim the
  `clippedStain` fix caught for merged bands at ~400 bands, arriving by a different
  route and surviving at full resolution, which is why the existing level-invariance
  test did not see it. A new corpus-wide test now asserts the general rule: no drawn
  instance may show more centromeres than its model carries.

- **A breakpoint range that loses a band now says so.** `splitBands` wants an arm
  letter before the digits, so `(q11.1-11.2;p13.3)` kept `q11.1` and dropped the rest
  with nothing said, and the figure showed a single precise cut nobody asked for. The
  `badBands` check only caught a group that yielded no band at all. Both the
  aberration's own breakpoints and any `der()` sub-op are now checked, since both call
  `splitBands` and the report that found this was a sub-op. The message names the ISCN
  form. Tilde ranges are correct notation and stay silent: 4.2.1 allows the repeated
  arm letter, and ISCN 2024 prints the shorthand in a breakpoint itself,
  `der(18)t(18;19)(q21;p11~12)`. Warning on those would be warning on correct input.

## 2026-08-12 (the decode says which X goes silent, and stops calling a carrier monosomy X)

- **A rearrangement involving the X now says which X is expected to be inactive.**
  The decode panel was silent on the single most asked question about these
  karyotypes. It now answers it from one rule rather than a lookup table (Gardner
  & Sutherland, 5th ed, p. 221): after selection the surviving pattern is the one
  leaving the least functional imbalance, and the choice exists only where the
  abnormal chromosome keeps an X-inactivation center. Balanced and unbalanced
  therefore skew in **opposite** directions, which is the part that is easy to get
  backwards:
  - balanced `t(X;autosome)`: the **normal X** is silenced, both derivatives stay
    active, and because the intact X is the silenced one a gene disrupted at the X
    breakpoint is unmasked, so a balanced female carrier can still manifest an
    X-linked recessive disorder. That is how *DMD* and *OTC* were mapped.
  - unbalanced `der(X)`: the **der(X)** is silenced and the normal X stays active.
  - `i(X)`, `r(X)`, `del(X)`: the structurally abnormal X is silenced, with the
    caveat that a ring too small to retain a center cannot be silenced at all.
  - X material on a **der(autosome)**: it has no center of its own and is beyond
    the reach of the one on the X, so it cannot be silenced, giving functional
    disomy. Saying "the derivative is silenced" here would be exactly backwards.
  - one X only, or an X;Y translocation: reported as not applicable and as
    variable, respectively, rather than guessed at.

- **The answer is breakpoint-dependent, and the first cut of this did not model
  that.** The center sits in Xq13, so which side of a break keeps it decides what
  can be silenced at all (Gardner figure 6-8: "the der(autosome) has the XIC; here,
  the X breakpoint must be in proximal Xq, above the XIC ... In the third column, in
  which the der(X) has the XIC, X exchanges can occur either in Xp or in Xq distal
  to the XIC"). The note now compares the X breakpoint against Xq13 and branches:
  - X material on a der(autosome) with the break **distal** to Xq13 has no center
    and cannot be silenced, giving functional disomy. With the break **proximal**
    to Xq13 the center travels with the segment, so it can be silenced and
    silencing spreads into the attached autosome instead. The earlier text asserted
    the first case unconditionally, which was wrong for every proximal-Xq break.
  - `i(X)(p10)` carries no Xq, so no center and no way to silence it. Gardner: an
    Xp isochromosome "would probably always be lethal because there would be a
    functional Xp trisomy". It was previously lumped in with `i(X)(q10)`.
  - a break inside Xq13 itself is reported as undecidable from the notation rather
    than guessed.

- **New page: a balanced X-autosome translocation whose carrier is affected.**
  `/karyotype/x-autosome-translocation-manifesting-carrier/`, `46,X,t(X;4)(p21;p16)`.
  Balanced, yet affected, because the normal X is the silenced one and the
  dystrophin gene broken at Xp21 has no working copy behind it. The page exists to
  make the counterintuitive case concrete: "balanced" does not mean unaffected.

  Every sentence opens with "Expected", because none of this is in the notation:
  ISCN carries inactivation status only as a FISH probe in `ish` nomenclature
  (2024 example xxiii), never in the karyotype string. It rides the existing
  `robNote` hook, so it reaches the app, every generated landing page, and
  read-aloud with no new UI.

- **`46,X,t(X;13)` was being called monosomy X.** The sex-field note is built by
  `parseSex` from the field alone, before any aberration is known, so a lone `X`
  read as "a single X (monosomy X)" even when a second X is drawn inside the
  rearrangement. ISCN 2024 section 5.5.18.1.1 example iii is explicit that this is
  the correct spelling: "the correct designation is 46,X,t(X;13) and not
  46,XX,t(X;13)", and the same for `46,Y,t(X;13)` in a male. The note now says the
  other X is named in the rearrangement below and that this is not monosomy X.
  `45,X` still reads as monosomy X. Found because the new inactivation sentence
  contradicted it two lines down in the same panel.

## 2026-08-12 (both textbooks in the guide were a edition behind)

- **Thompson & Thompson is on its 9th edition, and almost nothing about the
  citation survived.** The guide cited "Nussbaum RL, McInnes RR, Willard HF.
  Thompson & Thompson Genetics in Medicine. 8th ed. Elsevier; 2016." The 9th
  edition changes the title to *Genetics and **Genomics** in Medicine* and
  replaces all three authors: it is Cohn RD, Scherer SW, Hamosh A, Elsevier, 2024
  (ISBN 978-0-323-54762-8). Verified from the copy on disk at
  `~/Desktop/colorado/books/core_resources_abgc/`, whose title page and copyright
  page carry all of it, rather than from the edition number alone.

- **Gardner and Sutherland went to a 6th edition too, with the authors
  reordered.** Now Amor DJ, Gardner RJM, Oxford University Press, 2025 (published
  2025-11-18, ISBN 9780197747728), where the guide had the 5th edition of 2018
  with Gardner first. This one is from the publisher and retailer listings, not
  from the book: only the 5th edition is on disk.

## 2026-08-12 (the guide defines a karyotype once, and calls the schematic what ISCN calls it)

- **The guide defined "karyotype" three times and the three did not agree.** The
  intro and section 1 both made a karyotype the *description* of the chromosomes
  ("a compact description of the number and structure", "a karyotype records how
  many chromosomes are present"), while the FAQ made it the chromosome
  constitution itself, with the notation as how it is written. The FAQ was the
  correct one, so the intro and section 1 now follow it. Section 1 keeps its
  heading and its job: the concrete anatomy of the normal 46-chromosome
  complement and the 46,XX / 46,XY baseline. The FAQ keeps the crisp definition
  and the neighboring terms. The overlap between them is deliberate, because
  `build-pages.mjs` derives the `FAQPage` JSON-LD from the authored FAQ and those
  answers have to stand alone when an answer engine lifts one out of the page.

- **The three terms now follow ISCN 2024, Chapter 2, footnote 1 (p. 5).** That
  footnote exists because "the terms karyogram, karyotype, and idiogram have often
  been used indiscriminately", and it fixes each one: karyogram for a systematized
  array of the chromosomes "prepared either by drawing, digitized imaging, or by
  photography", karyotype for the chromosomal complement of an individual, tissue,
  or cell line, and idiogram for the diagrammatic representation of a karyotype.
  Two consequences. First, the spelling is **idiogram**; ISCN never writes
  "ideogram" outside a 1981 citation in its bibliography, and the *e* spelling
  reached us from genomics software, where it is common (UCSC's `cytoBandIdeo`,
  and this repo's own `ideogram-data.js`). The FAQ now says "an idiogram (spelled
  ideogram in much genomics software)" so the correct term does not read as a typo.
  Second, a karyogram is not by definition a photograph, so section 2 says "whether
  photographed, digitized, or drawn" rather than calling it a photograph. The FAQ
  carries an HTML comment citing the footnote, so the next reader can check the
  claim instead of trusting it. Code identifiers are untouched.

## 2026-08-12 (the smoke gets in, and the header that never could have helped is gone)

- **Bot Fight Mode was what turned the runners away, and it is now off.** The
  zone's event log named it: 19 Managed Challenge events between 2026-08-11 and
  2026-08-12, service "Bot fight mode", across several GitHub runner addresses on
  Microsoft's ASN, against a user-agent that says in plain text what it is. Bot
  Fight Mode is a free-plan feature evaluated off the Ruleset Engine, so no WAF
  skip rule and no allowlist can except it; switching it off at the zone was the
  only available fix, and it costs little on a public static site with no login.
  The smoke's three checks pass from GitHub now, and the weekly D1 backup uploads
  a real encrypted artifact now that the deploy token carries D1 Edit.

- **The bypass header and its secret are removed.** They were added on the theory
  that a WAF skip rule would let the runners through. That theory was wrong, so
  they were never doing anything, and a header plus a repo secret that do nothing
  read to the next person as a working mitigation. `test/ops.test.js` now asserts
  their absence, and the workflow comment records what actually happened, so the
  next 403 gets diagnosed from the `cf-mitigated` header rather than re-derived.

## 2026-08-12 (the smoke workflow parses, and the tests read it the way GitHub does)

- **`smoke.yml` was unreadable YAML, and nothing said so.** The bypass header added
  earlier the same day went in as `run: curl ... -H "x-karyodraw-smoke: $SMOKE_BYPASS"`
  on one line. A plain YAML scalar cannot contain a colon followed by a space, so
  GitHub could not parse the file: every push produced a zero-second failed run with
  no jobs and no logs, whatever the workflow's own triggers said, and those runs were
  what the daily failure emails were reporting. The three `run:` strings are block
  scalars now, which cannot break this way again.

- **The ops tests parse the workflow files instead of grepping them.** All three
  assertions passed for the entire time the file was unreadable, which is the whole
  argument: a grep sees the text, only a parser sees the file GitHub sees.
  `test/ops.test.js` now loads each workflow through `js-yaml` (a new devDependency),
  asserts that every file in `.github/workflows` parses, and pins the schedule,
  steps, and artifact retention off the parsed document.

- **A failed smoke now says what turned it away.** `curl` reported only "exited 22",
  which cannot distinguish the site being down from Cloudflare refusing the runner,
  and those two want opposite responses from whoever opens the email. A `failure()`
  step prints the edge status line and the `cf-ray` / `cf-mitigated` headers. It
  earned its place immediately: the first real run returned `cf-mitigated: challenge`,
  which identifies the block as a Cloudflare challenge to the runner IP rather than
  a WAF rule, and narrows the fix to the zone's Security page.

## 2026-08-12 (the count field stops swallowing junk, and Back leaves the tour)

- **Junk after the chromosome count is refused, not silently drawn.** `47<2n>` is
  valid ISCN (the ploidy marker; the parser reads it deliberately and, per ISCN
  6.3.7 f, checks no arithmetic against it) and keeps parsing cleanly. But the count
  regex took the leading digits and nothing ever read the rest of the field, so the
  unclosed `47<2n`, the mistyped `47<>2<.>n`, and even `47banana` all drew without a
  word. The remainder of the count field is now validated (number, range, `c`, or
  `<Nn>`); anything else refuses the drawing with a warning that names the junk, and
  an unclosed ploidy marker gets a did-you-mean for its closed form. The ploidy
  reader also accepts `<2N>` uppercase, matching the validation. Found by typing a
  CyDAS-style clone in by hand; the CyDAS lineage itself is documented in
  `docs/CYDAS.md`. One subtlety cost a first attempt: the aberration-level
  `unreadable` computation later overwrites the flag, so the count check sets its
  own `badCount`, ORed in. `test/parser.test.js` pins the valid marker, all three
  junk shapes, and the suggestion.

- **Pressing Back during the tour leaves the tour.** The restored history entry
  predates the tour, and the card used to stay open, captioning a step over a
  drawing it no longer describes. Every other draw path already called
  `leaveTourIfActive`; the popstate handler now does too.
  `test/tour-launcher-browser.test.js` reproduces the strand in a real browser
  (chip, tour, Back) and fails without the fix.

## 2026-08-12 (the paper catches up with the app)

- **The JOSE manuscript describes the app as it is, not as it was on July 4.** The
  draft predated the app's most distinctive teaching feature, so the Functionality
  section gains a meiotic-segregation subsection: the quadrivalent and trivalent
  models with their segregation modes per ISCN 2024 Table 5, the to-scale pachytene
  figures sized from real hg38 band positions, and the parental-origin direction
  (candidate carriers re-run forward, kept on a round-trip match). The explanation
  section now mentions the guided tour and the worked-example library, the summary
  mentions the segregation panel and the date-stamped exports, and the validation
  sentence states the current suite (450+ tests, CI-gated, conformance set, browser
  tests, stress corpus). Submission itself is an owner action and has not happened.

## 2026-08-12 (a safety net: weekly backups, a daily smoke, and a usage digest)

- **The database is backed up weekly.** D1 holds the only state production has (usage
  events and feedback); everything else regenerates from this repo. A Monday Actions
  cron (`backup.yml`) exports it with wrangler, encrypts the dump (this repo is public
  and public-repo artifacts are downloadable by any GitHub user, and feedback rows
  carry reply emails), and stores it as a 90-day artifact, a rolling window of about
  13 restore points. A missing secret fails the run loudly; a backup that silently
  skips is the failure the workflow exists to prevent. Restore commands are in the
  workflow header.

- **A daily smoke watches the live site.** Three curls (`smoke.yml`): the homepage by
  its h1, a landing page by its content, the Worker API by its shape, each asserting
  content rather than a bare 200 so a blank page cannot pass. A failure triggers
  GitHub's failed-workflow email. Deliberately minimal, by owner decision: no external
  monitoring service, no state.

- **The analytics are no longer write-only.** A weekly usage digest (Mondays, on the
  same cron and Resend setup as the feedback digest) reports draws, parse rate,
  pageviews, countries, cap hits, the top drawn karyotypes, and the top failing
  inputs. The failing inputs are the point: what students type that does not draw is
  the parser backlog and the FAQ pipeline, measured instead of guessed.
  `test/ops.test.js` pins all three pieces.

## 2026-08-12 (the export watermark carries the date)

- **Exported images now say when they were drawn.** The watermark on "Copy image" and
  the PNG download reads `karyodraw.com · YYYY-MM-DD`. The exported figure is the copy
  that outlives deploys, in slides and question banks in front of people who never
  typed the input; the date lets any figure be matched to this date-grouped changelog,
  so "was this drawn before or after the fix" has an answer. The site always runs the
  latest deploy, so the export date is the renderer's state date, and no version
  counter is introduced (a deliberate decision: versions disambiguate installs, and a
  continuously deployed site has exactly one live version). `test/export.test.js` pins
  the stamp.

## 2026-08-11 (interface polish: the homepage list, the tour, the Show control, the input)

- **The homepage "Common karyotypes, explained" list is now the tour curriculum, not
  every page.** Since the visual hub exists, listing all pages twice bought nothing; the
  homepage now shows the curated, ordered set the tour teaches (curation stays in
  `content/karyotypes.js` via the `tour` flag) and closes with a "See all N karyotypes,
  with pictures" link to the hub whose count is computed, never typed. Adding a landing
  page grows the hub and the count, not the homepage. `test/seo.test.js` pins the list to
  the curriculum and the computed count.

- **The guide's first mention of ISCN links to the FAQ item that defines it.** In-page
  rather than to the publisher, so line one of the guide does not eject the reader; the
  Karger citation stays in Sources. The anchor sits on the FAQ item div, not the h3,
  because the FAQPage schema derivation matches the bare h3 tag and an attribute there
  would silently drop the question from the JSON-LD, which is now said in a comment at
  the anchor.

- **Starting the tour scrolls its card to the top of the screen, from either door.** The
  scroll sat on the launcher button alone, so the `?tour=1` deep link from the guide, the
  only path the landing pages have, started the tour wherever the page happened to be.
  It now lives in `startTour`. Step navigation re-pins the card only when it has drifted
  out of view, so Next never lurches a page already showing it. Pinned statically in
  `test/tour-launcher.test.js` and exercised live in the browser test, which waits for
  the deep-linked card to reach the top of the viewport.

- **The Show (All / Affected) control hides when there is nothing to isolate.** For a
  normal karyotype the Affected view had nothing to draw, and the control answered with
  an empty state telling the reader to switch back: a dead end dressed as an option. The
  held choice is preserved rather than reset, so "Affected" survives a normal tour step,
  falls back to the full karyogram while gated, and applies again on the next abnormal
  karyotype; the folded view-options row skips the hidden control's label. Rationale
  recorded in `docs/INTERFACE.md`.

- **Select-on-focus generalizes from the untouched demo to anything drawn.** The
  URL-bar rule, stated fully: focusing the box while it holds exactly what is drawn
  (demo, example chip, tour step, deep link, or the reader's own karyotype after Draw)
  selects it all; mid-edit focus never selects. Yesterday's version covered only the
  demo, so the box behaved differently on a deep link than on a bare visit.
  `test/demo-input-select-browser.test.js` now walks the full arc in a real browser:
  drawn demo selects, mid-edit does not, a drawn 46,XX selects again and hides the Show
  control, and a drawn deep link selects.

## 2026-08-11 (the footer drops its disclaimer)

- **"educational, not diagnostic" leaves the footer brand line, by owner decision.**
  The claim itself is not gone; it stays where a reader looking for it goes: the About
  page, the guide's sources section, and the guide FAQ item that answers the question
  directly. What leaves is the tag repeated in the chrome of every page. Both footer
  sources change together, the homepage markup and the builder in `build-pages.mjs`,
  and `test/layout.test.js` pins the phrase out of the homepage and the generated
  pages; the pins fail with either source reverted.

## 2026-08-11 (the FAQ stops echoing the page, and the demo costs one keystroke)

- **The guide FAQ is rebuilt around what people actually search.** Google Trends
  co-search data for "karyotype" (US, 12 months) settled a redundancy review: three of
  the six items duplicated body sections and match no distinct query, so "How do I read
  a karyotype?" (the page's own H1 as a question), "What does t(9;22) mean?", and the
  Robertsonian comparison are gone; the body sections and landing pages already own that
  content. "What is a karyotype?" stays, since its cluster is the largest of all
  (interest 100, with "karyotype meaning" rising 30%), rewritten to add the karyotype vs
  karyogram vs ideogram distinction the page never made. The fastest-rising cluster is
  the lab test itself ("karyotype analysis" +80%, "karyotype testing" +40%, "karyotype
  blood test" +20%), on which the guide had nothing: a new item walks sample to culture
  to metaphase arrest to G-banding, with turnaround and the roughly 5 to 10 megabase
  resolution floor. ISCN 2024 and the free/diagnostic items stay, the former rewritten
  to say who maintains the standard rather than re-listing operators the body defines.
  The FAQPage JSON-LD regenerates from the authored items, so the schema followed with
  no build change. `test/seo.test.js` pins the four questions, the two additions, and
  the schema agreement.

- **Focusing the untouched demo karyotype selects it all.** The input pre-fills
  46,XY,t(9;22)(q34;q11.2) so the page never opens blank, but typing your own karyotype
  cost a manual select-and-delete. Focus now selects the whole demo (the URL-bar
  pattern): one keystroke replaces it, a second click drops the selection for someone
  who wants to edit the demo instead, and a deep-linked `?k=` karyotype is never
  auto-selected. A mouseup guard keeps the browsers that fire mouseup after focus from
  collapsing the selection, which is why `test/demo-input-select-browser.test.js`
  exercises the behavior in a real browser rather than by grepping the source.

## 2026-08-10 (feedback opens in place, and GitHub leaves the chrome)

- **Every generated page now carries the feedback dialog itself.** The dialog markup is
  lifted verbatim from `index.html` at build time (one copy, cannot drift) and a small
  inlined script posts to `/api/feedback` with the page's karyotype and URL, so "Send
  feedback" opens where the reader already is: no navigation, which the deep-link
  approach from earlier today still had. The footer is now the same button on every
  page.

- **GitHub is no longer linked from the site.** The footer's "Open source" link is gone
  and the About page's read-the-code-on-GitHub sentence with it, by owner decision. The
  About page instead offers the two channels a reader would actually use: "Submit
  feedback here" opens the in-place dialog (its href is only a no-JS fallback to
  `/?feedback=1`), and feedback@karyodraw.com for people who prefer email. The address
  requires Cloudflare Email Routing on the zone, which had no MX records at this
  writing; until that is enabled in the dashboard, mail to it bounces while the on-site
  form works regardless.

- Pins: `test/layout.test.js` asserts the dialog, script, karyotype payload, GitHub-free
  footers, and both About-page channels; `test/feedback-inplace-browser.test.js` opens
  and submits the dialog on the built About and Down syndrome pages in a real browser,
  asserting the URL never changes and the posted JSON carries the context. Five
  assertions fail with the builder change reverted.

## 2026-08-10 (the amber CTA gets its navy text back)

- **The CTA buttons on the generated pages were periwinkle text on amber.** The button
  is an anchor there, so the pages' generic link color won the cascade over the app
  stylesheet's `.btn` rule: two midtones, unreadable. The pages now re-assert the brand
  CTA pairing, amber background with deep navy text, on the anchor in every state
  including visited and hover. `test/layout.test.js` pins the rule on the guide and a
  landing page; the pin fails with the fix reverted.

## 2026-08-10 (feedback from the landing pages reaches the feedback form)

- **"Send feedback" on the generated pages now opens the app's feedback dialog instead
  of linking GitHub issues.** The readers of those pages are students and counselors,
  not people who file issues, so the old channel selected against exactly the feedback
  the site most needs. Each landing page's footer link now carries `?feedback=1` plus
  the page's own karyotype, and the app opens the same dialog the footer button opens,
  by clicking that button, so the deep link and the button cannot drift apart. The
  message lands in D1 and reaches the maintainer in the existing daily digest; no email
  address is exposed and no email client is needed. GitHub keeps exactly one quiet
  mention, the "Open source" footer link. `test/layout.test.js` pins the generated
  markup (including that a landing page sends its notation along) and
  `test/feedback-deeplink-browser.test.js` drives the deep link in a real browser; all
  three browser assertions fail with the app wiring reverted.

## 2026-08-09 (eight new karyotypes, a visual hub, and a cleaner guide)

- **Eight curated pages fill the missing categories.** Translocation Down syndrome
  (der(14;21) with an extra 21) completes the story the rob(14;21) carrier page starts;
  Emanuel syndrome (+der(22)) pairs with its new balanced t(11;22) carrier page, the most
  common recurrent constitutional translocation; isodicentric Y is the most common
  structural abnormality of the Y; Pallister-Killian syndrome adds the classic
  tissue-limited mosaic; monosomy 7 is the first autosomal monosomy on the site;
  tetraploidy rounds out ploidy next to triploidy; and a direct insertion shows the ins
  operator. Three new hub sections carry them: Unbalanced derivative, Dicentric
  chromosome, and Insertion. Every notation was verified to parse and draw before the
  entry was written, and the Pallister-Killian mosaic joins the stress corpus (169).

- **The hub page shows the figures.** Each card now stacks the notation over the name in
  muted gray and carries a small lazy-loaded copy of the page's focused karyogram. The
  old side-by-side text wrapped differently on every card; the new anatomy is uniform,
  and the index finally shows the thing the product does. The thumbnails are the
  committed per-page renders, 7 to 37KB each, deferred by loading="lazy".

- **The guide's structural-changes table says one thing per row.** The deletion row read
  as a doubled list ("cri-du-chat, del(5)(p15.2), Wolf-Hirschhorn, del(4)(p16.3)"); it
  now names each deletion once, in prose. The inv(9) example, which is pericentric, sat
  attached to the paracentric clause and now sits with the pericentric one. der, dic,
  and ins graduated from a footnote row to real entries linking the new pages, and the
  guide's number-change, balanced-versus-unbalanced, mosaicism, and cancer sections link
  the new examples where they teach those exact points.

## 2026-08-09 (the toolbar groups swap sides)

- **The export actions now lead the karyogram toolbar on the left; the "Not right?" flag
  anchors the right edge, alone.** An owner decision reversing the left/right order set on
  2026-08-08. What did not change, and stays deliberate: the flag lives in the top action
  row, keeps the only amber identity on the panel, and sits isolated from the export
  cluster across the spacer, because feedback volume is how wrong renders get caught. The
  placement that remains reverted is the old under-figure flag row, which was too quiet to
  invite a report. `test/site-chrome.test.js` pins the new order and
  `docs/INTERFACE.md` records the decision with its date.

## 2026-08-09 (a clipped band no longer inherits a centromere it does not contain)

- **At the ~400-band level, der(9) of t(9;22)(q34;q11.2) drew a second centromere.**
  Found by a user hovering the graft: the first band of the 22 material on der(9) was
  crosshatched and its tooltip said "22q11 Centromere", which makes the derivative look
  dicentric. The notation states one centromere per derivative; the figure said two, but
  only at low band resolution, which is why the ~550-band landing pages, carousel, and
  stress corpus never caught it. The same phantom appeared on der(9) of
  t(11;22)(q23;q11.2), the Emanuel carrier translocation.

  The cause was the display-level band union, not the derivative arithmetic. Merging
  sub-bands to whole bands stamps the union `acen` when ANY sub-band is a centromere
  band, which is honest for an intact chromosome; but when a junction clipped a merged
  band, the kept remainder inherited the union's stain even when it contained none of
  the actual centromere. `getBands` now carries the full-resolution sub-bands through
  the merge, and `clippedStain` re-derives a clipped band's stain from only the
  sub-bands inside the kept interval.

  `test/derivative-centromere.test.js` pins both directions: the t(9;22) derivatives
  carry exactly one centromere each at levels 0, 1, and 99 with no acen band sourced
  from the partner chromosome, and a corpus-wide sweep asserts that a chromosome with
  one centromere at full resolution shows exactly one at every display level. A
  genuinely dicentric shape may see its two real centromeres merge into one crosshatch
  block at a coarse level (idic(Y)(q11.2) does), which is a resolution artifact of a
  true statement and is allowed; gaining a centromere is not. Both tests fail with the
  fix reverted.

## 2026-08-08 (mosaic stress coverage, a browser test for the tour, and the interface decisions on record)

- **The stress corpus covers the mosaic shapes that were missing.** A figure path that
  read only `clones[0]` of a mosaic reached production because nothing exercised the
  multi-clone cases end to end. The mosaic group gains the `chi` prefix form
  (`chi 46,XX/46,XY`) and a mosaic whose clones disagree about a structural change
  (`mos 46,XX,del(5)(p15.2)[10]/46,XX[20]`), where a `clones[0]`-only renderer would show
  pure cri du chat and hide the normal majority line. Two-clone, three-clone, and bare
  chimera forms were already in the corpus; the stale corpus count in
  `docs/VALIDATION.md` (138) now reads 168.

- **The tour launcher is tested in a real browser.** A stale `KD_PAGE_COUNT` reference
  once threw at load time and killed the tour button after its label was set, so the
  button looked wired and did nothing. The existing `test/tour-launcher.test.js` greps
  `index.html` for that identifier, which pins the one regression that has happened.
  `test/tour-launcher-browser.test.js` closes the general case: it serves the repo over
  HTTP, loads the page in headless Chrome, asserts no JS error on load, clicks the
  launcher and asserts the tour card opens on step 1, and loads `?tour=1` and asserts
  the deep link opens it. The guard was proven by reintroducing the reference: all three
  assertions fail. The test skips when no Chrome executable can be resolved
  (`CHROME_PATH`, then the usual install paths, including `/usr/bin/google-chrome` on
  GitHub's runners), so CI always runs it.

- **The interface decisions are on record in `docs/INTERFACE.md`.** Five rules that were
  living only in code comments and review memory, each with its reasoning: feedback
  leads the karyogram toolbar in amber, one button shape per row with color for meaning,
  a tooltip says what the label cannot and promises nothing false, a mosaic figure draws
  every cell line at one scale, and visual changes ship with a preview screenshot.
  Written down so a later change argues against the reason instead of reversing it
  unknowingly. Referenced from the docs list in `README.md`.

## 2026-08-08 (the suite becomes a gate, and the build output leaves the repo)

- **Tests now gate every pull request and every deploy.** Before this, no workflow ran
  `npm test`: all 426 tests passed only when someone chose to run them locally, and a push
  that skipped them deployed identically. Disconnecting Workers Builds had also removed
  the only check that appeared on pull requests. Now `.github/workflows/test.yml` runs the
  suite on every PR, and the deploy job in `deploy.yml` requires a passing suite on the
  same commit before `wrangler deploy` starts. A `concurrency` group serializes deploys so
  two merges in quick succession cannot race each other to Cloudflare.

- **Generated output is no longer committed.** The 32 landing pages, the hub, `about/`,
  `how-to-read-a-karyotype/`, `sitemap.xml`, and `content/k-index.mjs` (about 1.8 MB, a
  quarter of the repository, all derivable from `content/karyotypes.js`) are untracked and
  gitignored. They were the reason a two-line fix could land as a 38-file diff, and they
  enabled the stale-committed-page class of bug that required the single-deploy-path fix.
  The deploy workflow already rebuilt them before every deploy; now a `pretest` hook also
  rebuilds them before `npm test`, since several tests read the generated pages. The PNG
  karyograms stay committed: rendering them needs a browser and CI does not run one.

- **`npm run stress` now fails on a regression.** The runner printed mismatches, leftover
  panels, and duplicate SVG ids but always exited 0, so nothing scripted could act on it.
  It now sets a non-zero exit code when any of the three appear.

## 2026-08-08 (the handoff leaves the repo)

- **`NEXT_SESSION_HANDOFF.md` is gone from the repository.** It existed to prime a coding
  session rather than to serve the product or its readers, and this repository is public,
  so it put internal working notes and absolute paths under the author's home directory on
  GitHub. #153 stopped the live site serving it, which was the unintended half; this
  removes it from the repository altogether. The content now lives in the maintainer's
  local session memory, the filename is gitignored so it cannot be re-added by accident,
  and its `.assetsignore` entry stays as a second guard. `test/seo.test.js` asserts both.

  Note for anyone reading the history rather than the tree: the file remains visible in
  past commits and in the diffs of earlier pull requests, which GitHub serves independently
  of the branch. Rewriting history would not remove those, and nothing in the file was ever
  a credential, so the history is left intact rather than rewritten for no gain.

## 2026-08-08 (the disconnect held, proven from the check runs)

- **The single deploy path is confirmed, without needing Cloudflare's own ledger.** Workers
  Builds posts a GitHub check run on every build it performs, so its presence per merge is
  a reliable proxy for whether it fired. It appears on six of six merges from #148 to #153
  and on zero of two afterwards. #152 remains the clearest picture of the fault that
  started this: Workers Builds ran while the path-filtered Actions workflow correctly did
  not, which is precisely the deploy nobody asked for. Since the disconnect, #154 shows
  the `deploy` run alone and #155, being documentation only, shows nothing at all, which
  is the designed behavior.

- **The reason the check runs were used instead of Cloudflare's deployment list is now on
  the record.** `wrangler` is installed and authenticated, but `api.cloudflare.com` is
  unreachable from the agent shell even with sandboxing disabled, so
  `wrangler deployments list` cannot be run from a session. The handoff notes this next to
  the settled question so the next reader does not repeat the attempt, and names the
  check-run evidence as the practical substitute.

## 2026-08-08 (a standing assessment, and where interface decisions live)

- **The handoff now carries a reasoned assessment of the delivery pipeline rather than a
  to-do list.** An audit found the split worth naming: the domain core is strong, with
  roughly 290 behavioral tests against ISCN 2024 and no runtime dependencies, while the
  pipeline around it is not. Nothing runs the test suite in CI, so 425 tests pass on trust
  alone; 1.7MB of derivable build output is committed, which is why a two-line fix lands
  as a 38-file diff; and about 83 assertions test the interface by grepping the source of
  `index.html` rather than by exercising it. Each is recorded with its reasoning and its
  open questions, deliberately as candidates rather than as a queue.

- **Interface preferences had no home, and now have one.** `docs/VALIDATION.md` records
  the reasoning behind parser and message decisions and works well for it. Nothing played
  that role for the interface, so decisions about affordance prominence, control styling,
  tooltip voice, and figure honesty survived only as changelog narrative and test
  comments. They are written down in the handoff until someone decides whether they
  belong in a new document or appended to the existing one.

## 2026-08-08 (one deploy path, not two)

- **Two systems were deploying this site, and one of them shipped stale pages.** Besides
  `.github/workflows/deploy.yml`, the Cloudflare Workers Builds Git integration was
  connected with "Build command: None" and watch paths `*`, so it deployed every push to
  main, ignored the path filter, skipped `scripts/build-pages.mjs`, and published whatever
  generated files happened to be committed. The two raced about a second apart on every
  merge and the later one won. Nothing broke, because the generated pages are always
  committed, but a `content/karyotypes.js` edit committed without a rebuild would have gone
  live stale with both checks green. It was found by asking why a documentation-only PR
  reached production when the path-filtered workflow had correctly not run.

  The integration is disconnected. The Actions workflow, which regenerates the pages and
  pings IndexNow, is now the only path, and `wrangler.jsonc` records why it must not be
  reconnected without a build command. Two expected consequences: pull requests no longer
  show any checks, since that integration provided the only one, and documentation-only
  pushes no longer deploy, which costs nothing now that every internal file is excluded
  from the served tree.

## 2026-08-08 (the handoff was a public page)

- **`NEXT_SESSION_HANDOFF.md` was served at `karyodraw.com/NEXT_SESSION_HANDOFF.md`.** The
  site publishes the repo tree as static assets minus `.assetsignore`, and that file was
  missing from the list while every comparable one (README, CHANGELOG, `docs/`,
  CONTRIBUTING, `schema.sql`, `test/`) was already on it, so this was an oversight rather
  than a decision. It returned HTTP 200 with internal working notes and absolute paths
  under the author's home directory. It is excluded now, and `test/seo.test.js` asserts
  that the internal files stay off the served tree.

## 2026-08-08 (the docs describe the site as it is now)

Documentation only. Two files, no served file touched.

- **The handoff still stopped at PR #146 and 412 tests.** `NEXT_SESSION_HANDOFF.md` now
  covers #136-#151 and 424 passing tests, and summarizes the five changes of #147-#151:
  the mosaic figure that drew one cell line, the stale `KD_PAGE_COUNT` reference that
  killed the tour button, and the shared footer, brand mark, toolbar button style and
  copy-link tooltip. Two land mines earned today are recorded with it: any
  `model.clones[0]` silently misreads a mosaic, which is the exact shape of the #148 bug,
  and a new CHANGELOG section can swallow the heading below it, which happened twice on
  2026-08-08.

- **`docs/SEO_AND_FEEDBACK.md` quoted a feedback button that no longer exists.** The
  section is named for the label the page actually shows, "Not right?", and it now records
  that footer "Send feedback" has two forms since #148: a button that opens the dialog on
  `index.html`, and a link to the GitHub issue tracker on the 35 generated pages, which
  carry no dialog markup. Em dashes are gone, per house style. Google Search Console moved
  out of "still open": the property is verified and reporting, and the one remaining ask of
  the owner is Search Console API access, so a session can read `/karyotype/*` performance
  instead of having it pasted in by hand.

## 2026-08-08 (a tooltip that says what the label cannot)

- **"Copy link to this view" promised a link that keeps updating.** The tooltip read
  "Copy a link that reproduces this exact view. It updates as you edit.": the first
  sentence restated the button label, and the second was read as a promise that a link
  already copied and pasted somewhere would keep tracking later edits. It does not. The
  app rewrites the address bar in place as you edit, and the button copies that address
  at the moment of the click, so what you hand out is a snapshot. The tooltip now carries
  only the fact the label cannot: "The link includes your Show, Bands, and Style
  settings." `test/tooltip-voice.test.js` keeps the updating claim out and keeps every
  action in the row annotated.

## 2026-08-08 (feedback up front, and one button style)

- **The "Not right?" flag is back on top, leading the toolbar.** The previous pass parked
  it under the figure, where it was too quiet to invite a report; feedback is a
  first-class action on this site, so a reader deciding whether a drawing is trustworthy
  now sees the way to say so before the ways to export it. Left group: the flag, amber.
  Right group: the four export actions. And one button style for the whole row: it used
  to mix bordered buttons with borderless text links, two half-finished designs in one
  line, so every action now shares the same bordered shape and only the flag's color
  differs.

## 2026-08-08 (one mark, and actions grouped by purpose)

- **The logo differed between the app and the generated pages.** index.html carried the
  banded dotmark (band stripes and the amber tip clipped inside the rounded capsules,
  matching favicon.svg) while `siteHeader()` in build-pages.mjs still emitted an older
  flat version whose amber block painted over the rounded corner. The mark now lives in
  one string (`BRAND_MARK`) and is injected into index.html between `KD:BRAND` markers,
  exactly how the nav and footer already stay in sync, and `test/site-chrome.test.js`
  asserts the app and every generated page render the identical SVG.

- **The karyogram toolbar now groups by purpose.** Copy image, PNG, copy link, and print
  all take the karyogram somewhere else, yet sat split across both ends of the row with
  "Not right?" dressed as one of them in the middle. The four export actions now sit
  together, right-aligned above the figure; the "Not right?" flag sits alone under the
  figure, bottom right, where doubt about a drawing actually arrives, after looking at it.

## 2026-08-08 (a mosaic is its cell lines, and one footer for the whole site)

- **The mosaic Turner condition page drew `mos 45,X[12]/46,XX[18]` as plain monosomy X.**
  The landing-page figure rendered `clones[0]` only, so the majority 46,XX line (18 of the
  30 counted cells) never appeared, under a caption claiming the involved chromosome was
  shown "with its normal homolog". On the one page whose teaching point is that the second
  cell line is what makes it mosaic, the picture showed non-mosaic 45,X. The shared
  renderer now draws every cell line, side by side under its own notation and cell count,
  and the caption states what the figure shows. The printable summary had the same
  `clones[0]` figure, plain-language text and decode, and now walks every clone. The
  page's "What the notation means" section decodes every clone too, so the `[18]` it
  promises to explain is explained. `test/mosaic-figure.test.js` pins all of it.

- **The app's isolated view stacks mosaic clones no more.** With Show = affected, the cell
  lines of a mosaic now sit in one row at one scale, dashed rule between them, instead of
  one above the other with the second below the fold. Two populations at two scales, or in
  two screenfuls, is not the comparison the karyotype states. The full "All" view keeps
  stacked clones: two complete karyograms cannot share a row.

- **Every generated page now carries the same footer as the homepage.** The condition
  pages, hub, guide, and About ended in a bespoke one-paragraph prose footer, so crossing
  from the app to a landing page read as two different sites (the About page had no footer
  at all). One builder now emits the brand-and-links bar everywhere; on generated pages,
  which carry no dialog script, "Send feedback" links to the GitHub issue tracker. The
  not-diagnostic disclaimer moved into the brand line, stated on every page.

## 2026-08-08 (the tour button looked wired, and was not)

- **Clicking "Take the guided tour (11 steps)" did nothing, on every page load.** The
  launcher wiring set the button label, then hit a stale duplicate of the example-count
  line referencing `KD_PAGE_COUNT`, an identifier defined nowhere. The `ReferenceError`
  aborted the script before the click handler attached, and took everything after it down
  too: the `?tour=1` deep link and the pageview beacon. The label was what made the button
  look alive; the count in it came from the block that died two lines later. The stale
  lines are gone, and `test/tour-launcher.test.js` pins that the wiring references no
  undefined identifier and sets the example count exactly once.

## 2026-08-03 (whole-arm translocations, drawn to scale)

- **`46,XX,t(14;21)(q10;q10)` drew its meiotic segregation in the old schematic style, and
  nothing said so.** `p10` and `q10` are ISCN's centromere designations rather than bands,
  so they are not in the hg38 band table; `segmentOf` returned null, `Pachytene.available()`
  went false, and the panel fell back to the schematic figure system in `segregation.js`.
  Three of the 33 carriers in the stress corpus were still drawn that way, all of them
  `(q10;q10)`, which is why it read as a regression rather than as a fallback.

  A whole-arm break now resolves to the centromere. The two segments are the two arms: the
  named arm is the piece beyond the break, so it is the piece exchanged, and the other arm
  keeps the centromere. That rule is also what makes `t(A;B)(p10;q10)` a different figure
  from `t(A;B)(q10;q10)`, and both now draw correctly.

  For two acrocentrics the cross comes out flat, which is honest: 14p is 17 Mb against 89 Mb
  of 14q. For two metacentrics, `t(1;3)(p10;q10)`, it is a full cross, and that case is why
  suppressing whole-arm panels would have been wrong: there is nothing Robertsonian about it.

  `test/pachytene.test.js` now pins that **every** carrier the app accepts draws to scale,
  so nothing can quietly drop back to the schematic again, and the whole-arm cases joined
  the loop that checks no spindle fiber crosses the plane it is sorted by.

## 2026-08-01 (a refusal takes the whole page with it)

- **A refused karyotype left the previous karyotype's meiotic segregation panel on
  screen.** Type `46,XX,t(14;21)(q10;q10)`, which draws, then change the count to 45,
  which does not: the karyogram is replaced by "Fix the karyotype above and the drawing
  appears here", and below it the quadrivalent, the pairing diagram and all four
  segregation outcomes stay exactly where they were, reading as though they described the
  karyotype in the box. They described the previous one.

  The gate hid the cards by name, in a list of three ids inside `run()`, and the
  segregation panel was never added to that list. It is the failure the gate exists to
  prevent, one panel to the side of where anyone was looking.

  Every element that describes the current drawing now carries `data-drawing` in the
  markup, and the gate sweeps by attribute. That covers the export and print row as well,
  which was hidden by hand next to the list. `data-drawing="conditional"` marks the
  clinical and segregation panels, which the gate may only hide, since their own renderers
  decide when they appear.

  **Two guards, because a list that has to be maintained is what failed.**
  `test/layout.test.js` requires every `*-card` in the tool column to carry the attribute,
  so the next panel cannot be left out. `npm run stress` counts any case where nothing drew
  and something with `data-drawing` was still on screen, and names it on the console. That
  one matters most: the corpus is typed into a single page in sequence, the way a person
  uses the app, so it is the only place a leftover panel is visible at all. Verified by
  reintroducing the bug behind one line and watching the sheet report
  `segregation-card after 46,XY,rob(13;14)(q10;q10)`.

## 2026-07-29 (a plus in a link is a plus)

- **`karyodraw.com/?k=47,XX,+21`, typed by hand or pasted out of a message, lost its
  sign.** The query decode turned `+` into a space, which is the form-encoding convention
  and the wrong one for a field where `+` is an ISCN symbol. The karyotype arrived as
  `47,XX, 21` and the app answered `“21” needs a sign`, about a sign the reader had
  written.

  The `k` parameter now decodes `+` as a plus. Every link the app makes encodes the plus
  as `%2B` and a space as `%20`, so nothing it hands out changes; the one space ISCN
  writes, after a `mos`/`chi` prefix, is put back, so a form-encoded
  `?k=mos+45,X[12]/46,XX[18]` still works. The view parameters keep the generic decode.

## 2026-07-29 (a repair you could have typed, and a message you can read)

Pasting `46,XY,der(13;14)(q10;q10), “+14”` out of a document, which is how a karyotype
usually arrives, produced three faults at once and no way out of them.

- **The repair had a space in the middle of it.** It was offered as typed, so it carried
  whatever whitespace was in the input, plus the space left behind where the stray
  character had been removed. A repair is a karyotype the reader is being asked to accept
  in one click, so it has to be one they could have typed: ISCN 4.4.1 a, no spaces. The
  two spaces ISCN does write are kept, after a `mos`/`chi` prefix and around `or`.

  The normalization runs only once a repair is warranted for something else. Before that
  test, `47, XX, +21` would become a "did you mean" and stop drawing over its spaces.

- **The message named two characters it could not show.** Every message quotes what it is
  about with curly quotes, which works until the thing quoted is a curly quote:
  `These are not characters ISCN uses: ““”, “””`. Those are now named in words: "a curly
  opening quotation mark, a curly closing quotation mark". Anything that survives being
  quoted is still shown that way.

- **The input box was silently rewritten to the clean karyotype**, because
  `result.normalized` was taken after every cleanup rather than after the whitespace pass
  alone. The reader was told to remove characters that were no longer on screen, offered a
  repair that looked identical to what they already had, and refused a drawing of a box
  that by then held a perfectly good karyotype. The box now keeps what was pasted until
  the repair is accepted; whitespace is still fixed silently, because it is the one thing
  the app does not object to.

## 2026-07-29 (the first screen, and what is on it when nothing draws)

- **On a phone the karyogram started below the fold.** At 390x844 the input, three
  example chips, the prompt line and three rows of segmented buttons filled the whole
  first screen: someone arriving from a search saw a form and no drawing. The first
  chromosome now starts at 627px instead of 888px, so the top of the karyogram is on
  screen when the page loads. Three changes, measured in a real browser at 390x844 and
  1280x900, with the desktop layout unchanged:

  - **The view options fold away under 700px**, behind one row that carries the current
    setting (`All · ~550 bands · Highlight`) so the state is still legible while folded.
    Collapsed by script rather than by CSS alone, so a page whose script failed shows the
    options rather than hiding them behind a control that cannot open them.
  - **Two example chips instead of three under 560px.** Each wraps to two lines at that
    width, so the third row cost about 35px for an example nobody asked for. The deck
    still deals the whole list across reloads, two at a time.
  - **The brand and nav share one row on a phone**, and the "New to the notation?" prompt
    is dropped there, since the two links after it say what they are.

- **The chips are re-dealt on every load, and there was no way back to one.** The line
  under them now ends with "See all 32 examples", pointing at the hub. The count comes
  from `content/karyotypes.js`, the same source the pages are generated from.

- **A refused karyotype sat beside a decode card showing "…", a band map of a chromosome
  from the last karyotype that DID draw, and a legend for a drawing that was not there.**
  All three are put away while nothing is drawn, and the grid drops to one column rather
  than holding a third of the page open for them. The warning box carries the whole
  message, which is the point of it.

- **The About page repeated itself in the footer.** The site footer is a one-line version
  of what the app is, that it is not diagnostic, who makes it, and the Ko-fi line, which
  is exactly what the four sections above it say at length. It is gone from that page and
  unchanged everywhere else, where it is the only place those things are said.

## 2026-07-29 (the tour starts where it runs)

- **"Tour" and "Guide" sat side by side in the nav promising the same thing.** Nothing
  said that one is an eleven-step walk through the running app and the other is an
  article, and with "Karyotypes" beside them three of the four nav items were places to
  learn with no order between them.

  The tour is a mode of the homepage, not a page, and the homepage is the only place it
  can run. It now starts from a line beside the input, under the example chips and above
  the view options, which is where someone who does not know the notation is sitting:

  > New to the notation? **Take the guided tour (11 steps)**

  A text link rather than a button, so it does not compete with "Draw and explain". The
  step count is filled in from the curriculum in `content/karyotypes.js` rather than typed
  into the markup, so adding a step cannot leave the number behind. The launcher hides
  while the tour is open, since the tour card carries its own Exit.

  Putting it in the nav had bought one real thing, which was reachability from every
  landing page. That is kept: the Guide, which is the teaching destination that stayed in
  the nav, now opens with the tour link. The `/?tour=1` deep link is unchanged.

  `test/layout.test.js` pins the nav to Karyotypes, Guide, About on the homepage and on
  four generated pages, and pins where the launcher sits.

## 2026-07-29 (what banding sees)

- **Two landing pages showed a deletion a karyotype would usually not show.** KaryoDraw
  draws every deletion at the same crispness whatever its size, so the pages for 1p36
  deletion syndrome and Wolf-Hirschhorn syndrome presented a clean banded picture of a
  change that is mostly submicroscopic. Someone reading the page to learn what the test
  looks like would take away that a karyotype is how these are found.

  Both now carry a note directly under the drawing, from a new optional `resolution`
  field in `content/karyotypes.js`:

  > **What banding sees:** Most 1p36 deletions are too small to see with banding, so the
  > diagnosis is usually made by microarray or FISH rather than by a karyotype. The
  > drawing above shows where the missing segment lies, not what would be visible down a
  > microscope.

  Periwinkle, not the amber of the app's warning box, for the reason `index.html` gives
  where it draws that line: the karyotype on the page is correct and is drawn correctly,
  so the note must not read as an error.

  Scoped to the entries where it is true. `del(5)(p15.2)` (cri-du-chat), `del(11)(q24.1)`
  (Jacobsen) and `del(5)(q13q33)` are visible on a standard karyotype and say nothing
  extra; `test/seo.test.js` pins both halves of that.

## 2026-07-29 (breakpoints on one chromosome run together)

- **`46,XX,del(15)(q11.2;q13)` drew a different deletion from the one that was typed, and
  said nothing.** The two sides of the semicolon parse as separate breakpoint groups, a
  deletion takes its bands from the first group alone, so the picture was a terminal loss
  from 15q11.2 and the second breakpoint was dropped. The decode agreed with the picture
  and not with the input: "the part around 15q11.2".

  ISCN 4.2.1 h: "If the rearrangement involves a single chromosome the breakpoints are not
  separated by a semicolon (;), e.g., inv(2)(p23q11.2), del(4)(p15.3p16.1), r(18)(p11.2q23)".
  The semicolon is what separates different chromosomes (4.2.1 g). The message now says
  so and offers the repair:

  > Breakpoints on the same chromosome are written one after the other, so
  > "del(15)(q11.2;q13)" is "del(15)(q11.2q13)". The semicolon separates different
  > chromosomes, as in t(9;22)(q34;q11.2).

  `dup`, `r`, `trp` and a within-chromosome `ins` had the same hole. `inv(2)(p23;p13)` was
  told instead that an inversion needs two bands, which is a rule the reader had not
  broken.

- **A comma there was repaired into the semicolon form**, which teaches the opposite of
  4.2.1 h. `del(15)(q11.2,q13)` now gets the same repair as the semicolon: the bands run
  together. The single-chromosome rule runs before the comma-inside-parentheses rule, and
  is skipped when the chromosome group itself holds a separator, so `t(9,22)(q34;q11.2)`
  is still repaired to `t(9;22)(q34;q11.2)`.

- **One mistake, one message.** The join is applied in `parse()` as well as in
  `diagnose()`, for the reason the trailing period is: otherwise the operation is parsed
  from the text as typed and reports a second problem underneath the one that names the
  mistake.

## 2026-07-29 (KaryoDraw is free to use)

- **"and always will be" was a promise about the future the About page has no way to keep.**
  It now says what is true today.

- **Six landing-page karyograms carried a stale `height` attribute.** PR #135 regenerated
  the PNGs and wrote the pages in the same commit, but the pages went out with the
  pre-baseline height: the image is 687x801, so at a displayed width of 229 the height is
  267 and not 253. A wrong height attribute is a layout shift on load, which is the one
  thing the attribute exists to prevent.

## 2026-07-29 (the brackets hold a count of cells)

- **`46,XY,t(9;22)(q34;q11.2)[-1]` was answered with a rule about commas.** The message
  read `“[-1]” in “t(9;22)(q34;q11.2)[-1]” is not one KaryoDraw can place. Changes look
  like +21, del(5)(p15.2), or t(9;22)(q34;q11.2)`, which names the translocation, the one
  part of that designation that was correct, and teaches the reader to look for a missing
  comma they had not missed.

  The cause: the cell-count pattern wants digits between the brackets, so `[-1]` never
  registered as the cell count at all. It stayed attached to the last change and came out
  as leftover text, where the general "not a change" message picked it up.

  Square brackets at the end of a karyotype now get read as the cell count whatever is
  inside them, and the message is about that field: **the number in brackets is how many
  cells were counted with this karyotype, so it is a whole number of them, like [20], or
  [cp10] for a composite.** `[2.5]`, `[abc]` and `[]` get the same message; `[cp-1]` gets
  the composite form of it; and an unclosed `[20` is told to close the bracket. Like `[0]`,
  none of them draws.

- **`47,XX,+21[-1]` was also offered `+21[,-1]` as the karyotype it meant.** The
  missing-comma repair splits a field on a sign that follows another character, and the
  minus inside the brackets looked like one. It now steps over the bracketed tail, so the
  count keeps its own diagnosis and no repair is offered that cannot be read.

  ISCN 4.4.1 d, "Absolute cell numbers are given in square brackets ([ ])". Aimed only at
  a clone that opens with a chromosome count, so the other bracket forms keep their own
  messages: `[GRCh38]` is the genome build (Chapter 8) and `[100/200]` is nuclei scored
  (Chapter 7). All 531 karyotypes in the stress corpus and the ISCN 2024 example set
  produce byte-identical warnings to before.

## 2026-07-29 (the affected view sits on a baseline)

- **Switching Show from All to Affected moved every chromosome.** The affected view hung
  each cell off one shared horizontal centromere line while the full 24-chromosome view
  simply bottom-aligned them, so toggling between the two rearranged the picture for a
  reason the reader has no way to infer, and a shorter chromosome read as floating above
  its neighbours rather than as aligned with them.

  Cells now share a baseline in both views. On `46,X,der(X)t(X;5)(p22.1;p15.2)` the X pair
  sat 72px above the chromosome 5 pair; it is 0 now.

  A shared centromere line is the classic karyogram convention, and ISCN's own plates draw
  it, but it needs a row of neighbours to be read against. With two or three cells on
  screen there is nothing to read it against and it only looks like drift.

  **Within** a cell nothing changes: a derivative is still aligned to its homolog on the
  centromere, which is where that comparison is actually being made. The three existing
  tests cover that axis and a new one covers the other, on `t(1;21)` where the longest and
  nearly-shortest chromosomes make the two schemes disagree by a wide margin.

## 2026-07-29 (the question mark, and no contractions)

- **A question mark inside a band was being dropped, and the drawing invented the
  precision.** `splitBands` wants digits after `p` or `q`, so `del(1)(q2?3)` came back as
  `q2` and `t(5;6)(q31.1;q22.?1)` as `q22`. The app drew a precise cut at a band the report
  had explicitly declined to pin down. It looked like success, which is why it lasted.

- **ISCN 4.2.1 k is now read properly, in both of its placements.** The mark "is placed
  either before the uncertain item, or it may replace a chromosome, region, band or subband
  designation", and those mean different things to a drawing:

  `+?8`, `-?21`, `?del(1)(p36.1)` and `der(1)?t(1;3)(p22;q13)` have everything needed to
  draw and the doubt is about the identification, so they draw, and the decode says the
  identification is not certain. A drawing with no hedge in the text would present a
  doubt-free picture of a hedged report.

  `del(5)(q?)`, `der(?)`, `dic(17;?)` replace the designation, so the lab is saying it was
  not determined and there is nothing to draw. Each now says exactly that, plus that the
  notation is correct. They used to be told `"q?" is not a breakpoint` and `"?" is not a
  human chromosome`, which blames the reader for a hedge the lab made deliberately.

  Gibberish where a band goes is still gibberish: `del(5)(zzz)` keeps its own message.

- **No contractions in anything a student reads.** "It's chromosome X" in the decode,
  "isn't a human chromosome", "These aren't real bands", "count doesn't add up", "Let's
  sort this out:" and the "Doesn't look right?" button are all rewritten.
  `test/message-voice.test.js` now fails on a contraction in any warning, and on the page
  strings the warning corpus cannot reach. Possessives are left alone.

## 2026-07-29 ("KaryoDraw does not draw this" is not "this is wrong")

- **The app was telling students that valid ISCN is not ISCN.** `rec`, `ider`, `tas`,
  `trc`, `fis` and `qdp` are all in ISCN's symbol list (Chapter 3), and each was answered
  with "«rec» in «rec(2)dup(2p)inv(2)(p21q31)» is not an ISCN abbreviation". That asserts
  something false about the standard, in the one place someone came to check themselves
  against it, and it is the worst error this app can make.

  Each now says it is correct ISCN, what it is, and which section to look it up in, plus
  that KaryoDraw has no drawing for it yet. An operation that really is not ISCN,
  `zzz(9)(q34)`, still gets told so; a test pins that the two cannot collapse into one
  message.

- **Three more messages blamed the reader for the app's own model being wrong.**
  - `+X` five times is how ISCN writes five extra copies, and 6.3.7 f prints exactly that.
    The "written once with a multiplier" rule was accusing a printed example of a mistake.
    Gains and losses are now exempt; the rule is about a structural change repeated
    instead of written `x2`.
  - In a composite karyotype the changes are the union across several cells and no one
    cell carried all of them (6.3.5), so `48,XX,+7,+9,+11,+13[cp5]` cannot be held to its
    own count. It was being told the changes came to 50. Same exemption `inc` has.
  - A stated ploidy level is believed rather than inferred from the count, and haploid is
    allowed. Near-haploid ALL, `26,X,+4,+6,+21`, was answered with "you wrote 26 but the
    changes add up to 48", which is the app stating its own wrong arithmetic as the
    reader's error. It draws.

- **330 of the 394 ISCN 2024 examples pass**, up from 326, and the ones that remain now
  read as coverage gaps rather than as accusations. The stress sheet has a section for
  them, with `zzz(9)(q34)` beside them as the control.

## 2026-07-29 (45,X,-Y is not a count error)

- **Acquired loss of a sex chromosome was being counted twice.** `45,X,-Y` is loss of the
  Y, one of the commonest karyotypes in myeloid disease and in age-related clonal
  haematopoiesis, and the app said the changes came to 44 against a stated 45 and refused
  to draw it. So did `45,X,-X` and `45,Y,-X`.

  ISCN 5.3.1.2 ix gives the principle: "an acquired abnormality is presented in relation to
  the constitutional karyotype". The sex field is the baseline the changes apply to, except
  that a stated loss has already happened to a field the clone wrote for itself. All ten
  examples in that section now come out at the number they print:

  | | field is | so the loss |
  | --- | --- | --- |
  | `45,X,-X`, `45,X,-Y`, `45,Y,-X` | what was seen | is already in it |
  | `44,Xc,-X`, `46,XXYc,-X` | constitutional, marked `c` | applies on top |
  | `45,idem,-X` | inherited from the stemline | applies, because it is not this clone's own |

  A gain is additive in every case, which is why the rule is scoped to losses:
  `47,XX,+X` and `48,XY,+X,+Y` were always right.

- **`c` on the sex complement is read rather than refused.** ISCN 4.2.1 e, and 5.3.1.2
  viii: "the letter c for the constitutional anomaly refers to the whole sex complement".
  `48,XXYc,+X` is an acquired gain of an X in someone with Klinefelter syndrome. The `c`
  was being reported as a stray letter in the sex field, which refused ten of the
  standard's own examples. It is now parsed and remembered, because it decides whether a
  loss applies on top of the field or is already in it. `47,XXX?c` (5.3.1.2 x, where it is
  unclear which the complement is) is accepted too.

  A letter that is genuinely not a sex chromosome, `46,XZY` or `46,QQ`, is still refused.

- **326 of the 394 ISCN 2024 examples now pass**, up from 302. What remains is listed with
  its section in `test/iscn-2024-examples.js`; the largest is `?` for uncertain
  identification (4.2.1 k, 16 examples).

## 2026-07-29 (the message fits the mistake)

- **A leftover is now told what is missing from it.** The catch-all named two ISCN
  features, "or" alternatives and uncertainty markers, whatever the leftover actually
  was. A student who typed a stray character before "14" was answered with a paragraph
  about notation she had never used, and no mention of the comma or the sign she was
  missing. Four branches now, each saying only what is true of the text in front of it:

  | leftover | message |
  | --- | --- |
  | `+14` | changes are separated by commas, so it needs one before it |
  | `14` | a change says whether the chromosome was gained or lost, AND changes are separated by commas, so this is `,+14` or `,-14`. Both, because naming one sends the reader round again for the other |
  | `ordel(5)(q14q34)` | ISCN writes two readings of one result with "or", and only one can be drawn at a time, so enter the alternative on its own |
  | `zzz` | not a change the app can place, with the shape of one shown. No diagnosis it does not have |

  The "or" branch is anchored at the start of the leftover rather than on a word
  boundary: ISCN writes " or " with spaces around it (4.4.1) and the parser strips
  them, so the alternative arrives as `ordel(...)`. No ISCN abbreviation begins with
  "or", so this cannot catch a real operation.

  Together with the stray-character rule below, `46,XY,der(13;14)(q10;q10) %14` now
  produces exactly two messages, each about something the reader typed: the `%` is not
  an ISCN character and is dropped, and the `14` that is left needs a comma and a sign.

## 2026-07-29 (checked against ISCN 2024, which corrected four rules and one of mine was live)

The gate in the entry below was written from memory. The standard was on disk. Reading it
turned up a rule that had shipped backwards, three more that were too strict, and it is now
the test suite's job to notice: `test/iscn-2024-examples.js` holds 394 karyotype-format
examples printed in ISCN 2024, and `test/iscn-conformance.test.js` runs every one through
the page's gate.

- **`del(5)(p15.3p15.2)` is correct, and for one day the app said it was not.** Breakpoint
  designations run **pter to qter** (Table 3; 5.5.2 b), so travelling that way p-arm band
  numbers descend and q-arm numbers ascend: on the short arm the distal band is written
  first. The check had been written as "from the centromere outward", which is right on the
  long arm and backwards on the short one, and it offered the reverse of a correct
  karyotype. 4.2.1 j.iii settles it in words on `dup(1)(p34~32p22)`: "the distal breakpoint
  is in 1p34 ... and the proximal breakpoint is in band 1p22."

- **Three more rules were too strict.** `<3n>` states the ploidy level the changes are
  expressed against, not a claim about the count, and 6.3.7 f prints `81<3n>` as correct
  "even though the count is in the near-tetraploid range"; that check is gone entirely.
  An insertion takes at least three breaks, not exactly three, because 5.5.9.3 writes
  reciprocal insertional events with four. And a rearrangement states its breakpoints the
  first time only (4.2.1 f), so the bare `t(9;22)` in
  `46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10]` is a back-reference and not a
  translocation missing its breakpoints.

- **A character that is not ISCN is now named and removed.** ISCN's symbol list (Chapter 3)
  is closed, so "not an ISCN character" is a fact rather than a judgment. Typing
  `der(13;14)(q10;q10) %14` produced "Alternatives written with or, and uncertainty
  markers, are not supported", which sent a student reading about an ISCN feature she had
  never used, over a character she had not meant to type. It now says `%` is not a
  character ISCN uses, lists the marks that are, and offers the karyotype without it.

  Stripped from the parsed text as well as from the repair, for the reason the trailing
  period is: otherwise the field the stray landed in still reports itself as unreadable and
  one stray character produces two messages.

- **302 of the 394 examples are accepted.** The rest are recorded with the ISCN section
  naming the feature they need, so an unmodelled feature reads as a coverage gap instead of
  as bad input. The biggest is `?` for uncertain identification (4.2.1 k). The one that
  will bite soonest is `45,X,-Y`, acquired loss of the Y and one of the commonest karyotypes
  in myeloid disease: the sex field already states what remains (5.3.1.2), the app counts
  the loss a second time, and calls the result a count error. It is not fixed here, because
  the interaction with `c` on the sex complement needs the same careful reading the rest of
  this entry got.

## 2026-07-29 (every known hole closed, and a label that was cut in half)

The stress sheet from the previous entry was built to find these. This closes all of them,
plus every entry that was already on the known-holes list in `docs/VALIDATION.md`. All 138
karyotypes in the corpus now do what the notation says they should.

- **A supernumerary ring, `+r`, was refused, and it is valid ISCN.** It is the counterpart
  of `+mar`, which the app has always supported: an extra chromosome banding cannot
  identify, differing only in that its shape is known. It drew nothing and said "+r is not
  a change KaryoDraw recognizes". Refusing valid ISCN is the worse direction of error for
  this app, so this outranked everything else here.

  `+r` now takes the marker slot and draws as a ring labelled `r`, with `+r1` and `+2r`
  handled like `+mar1` and `+2mar`. The decode says what separates it from `r(13)`: that
  one names the chromosome the ring came from, and `+r` is what is written when nobody
  knows yet.

- **An operation given fewer breakpoints than it takes now says which ones it needs.** One
  rule replaced the largest group of known holes, because the arity is a property of the
  operation: an inversion needs the two ends of the segment it turns over, a translocation
  needs one breakpoint on every chromosome it names, an insertion needs three however it is
  written. Given fewer, the renderer drew anyway and filled the gap from whatever the code
  did with an absent band.

  The explanations are where the damage showed. `inv(9)(p11)` was decoded as "the segment
  between 9p11 is flipped end-for-end (paracentric)", which invents a second endpoint and
  then classifies the inversion using it. `dup(1)` came out as "the segment  is present
  twice". `t(9;22)(q34)` reported chromosome 22 breaking "at 22".

  This also closes `46,XX,del(5)` and `46,XX,t(9;22)`, which state no breakpoint at all and
  were never on the known-holes list. They are the shape an exam question written from
  memory takes, so they are likelier to be typed than any of the malformed ones that were.

  `r(13)`, `i(X)`, `add(19)`, `der(X)` and `rob(13;14)` are deliberately left drawable. Each
  reads sensibly without breakpoints and real reports write them that way; a test pins each
  one so the table cannot grow by accident.

- **The rest of the gate.** `t(9;9)` is an exchange between a chromosome and itself, and the
  message points at `inv`/`del`/`dup` for a rearrangement within one chromosome.
  `rob(1;2)` names which chromosomes are acrocentric (13, 14, 15, 21, 22) and why the short
  arms are what makes the fusion balanced, then offers `der(1;2)`. `+0` and `+99` already
  said there is no such chromosome and drew anyway; so did `47,idem,+8` with no stemline to
  copy. `46<3n>,XY` says triploid and then gives the diploid number. `[0]` is a clone found
  in no cells, which is to say not found.

- **Written-form faults keep their drawing.** Reversed interstitial breakpoints
  (`del(5)(p15.3p15.2)`), the same change listed twice instead of `x2`, and `c` on the count
  field all describe exactly what gets drawn, so each is told the rule and shown the
  corrected spelling rather than refused. `dup` is excluded from the breakpoint-order rule
  on purpose: there the order distinguishes a direct duplication from an inverted one and
  the renderer reads it, and a test pins that `dup(1)(q25q22)` raises nothing.

  `46,YX` is a repair, like the missing comma: the sex chromosomes are reordered, never
  edited, so the letters that come out are the letters that went in.

- **`rob(13;14)` was drawn as `b(13;14)`.** Every label in the pachytene figures is anchored
  to the outer end of a chromosome and grows outward into the margin, and the margins were
  constants. A short label fit and a long one was cut off by the frame: 34px of room for a
  47px label, on every whole-arm translocation, which is most of what that figure teaches.
  The reciprocal cross had the same fault on both sides.

  Margins are now sized from the labels they have to hold. The same fault, separately, was
  clipping 2.6px off each end of `der(13;14)` in the small gamete glyphs, where the box is
  fixed by the drawing; there the type shrinks to fit instead. Both share one width
  estimate, `Karyo.textWidth`, checked once against Chrome's `getBBox` so the two cannot
  drift apart.

## 2026-07-28 (a stress sheet for the whole app, built from what students type)

- **`npm run stress` types 138 karyotypes into the real page and writes a review sheet.**
  The test suite checks what the app computes. Nothing checked what a student *reads*: whether
  the message teaches the rule, whether the drawing is the right drawing, whether the clinical
  card says the useful thing. `scripts/stress-report.mjs` drives `index.html` in a headless
  browser, captures the karyogram, the warning box, the decode, the clinical card and the
  segregation panel for each karyotype in `scripts/stress-corpus.mjs`, and assembles them into
  one self-contained `karyotype-stress-test.html` with a Good / Not good control per card and a
  Markdown export of everything marked not good.

  It drives the page rather than the modules because the draw gate, the band check and much of
  the wording live inside `run()`. A Node reimplementation would review a program nobody uses.

  The corpus is the point, not the harness. Half of it is board practice questions and the
  mistakes students make transcribing them, starting with the sixteen strings from one student's
  July 2026 email — every answer choice as printed, each repair she tried, and the karyotype each
  question was reaching for. The other half is the notation the app claims to support: mosaics,
  composites, `inc`, modal ranges, `idem` subclones, isodicentrics, rings, markers, insertions,
  three-way translocations, cancer clones. Each case carries what it is, what a reviewer should
  look at, and whether valid ISCN should draw or be refused — a claim about the notation, not
  about the phenotype.

- **Three findings from the first run**, none of them regressions, none fixed here:
  - `47,XX,+r` — a supernumerary ring, valid ISCN and the counterpart of `+mar`, which the app
    does support — is refused as an unrecognized change. Refusing valid ISCN is the worse
    direction of error, so this outranks everything on the known-holes list.
  - `46,XX,del(5)` and `46,XX,t(9;22)` draw. Neither states a breakpoint, so every band in the
    drawing is invented. They belong to the documented arity group (`inv(9)(p11)`,
    `t(9;22)(q34)`), and they are the shape an exam question written from memory takes, so they
    are likelier to be typed than any malformed-breakpoint case already on the list.
  - In the pachytene diagram, the left-hand chromosome label is anchored at `x=34` with
    `text-anchor="end"` inside a viewBox starting at 0, so any label wider than 34 units is cut
    off at the left. `13` fits; `rob(13;14)` renders as `b(13;14)`. Every whole-arm translocation
    shows it.

  `docs/VALIDATION.md` carries the first two in its known-holes table and describes the sheet.

## 2026-07-28 (the tilde spelling, one click away)

- **"Is it the tilde or the dash?" now has an answer you can click.** ISCN writes a range of modal
  numbers with a tilde, `47~49`. A dash is how Mitelman writes it, and KaryoDraw accepts it. Saying
  so in the decode row was not enough: it left the reader to retype the karyotype, and the chip
  beside the sentence still read `46-49`, so the question it raised stayed open.

  `46-49,XY` now draws and carries a neutral note: "The count is written 46-49, which is how Mitelman
  writes a range and is understood here. ISCN writes a range with a tilde: 46~49." — with
  `46~49,XY` attached as a one-click alternative. The sentence is gone from the decode, so the fact
  is stated once, in the place that can act on it.

  Not a warning. The karyotype is correct and draws, and warning on correct input is how a warning
  box loses its authority. This is the same neutral mechanism that offers `rob()` for a whole-arm
  acrocentric `t()`, which now supplies its own label instead of the page hardcoding the Robertsonian
  wording. One note shows at a time, and the acrocentric branch keeps the slot when both could apply.

  A single clone only: rewriting one clone of `mos 46-49,XY/46,XX` would leave the two halves spelled
  differently, which is worse than the dash.

  A differential run over 58 inputs found no change to the gate, the repairs, or any warning. Notes
  appear on the four dash ranges and nowhere else.

## 2026-07-28 (a stray period at the end; the range separator you typed)

- **A trailing period blamed the change it was stuck to.** `47-49,XY,+8,+21[cp10].` said
  "`+21[cp10].` is not a change KaryoDraw recognizes", which names the token that failed rather than
  the mistake. The cell-count pattern is anchored to the end of the field, so the stray period kept
  it from matching and swallowed the whole change with it. It now says the karyotype ends with the
  last change or its cell count, so the period at the end does not belong, and offers the karyotype
  without it. Same for a trailing semicolon or colon.

  Stripped in two places on purpose: the repair string, and the text that is actually parsed. Only
  the repair would have left the aberration still reporting itself as unrecognized, so one stray
  character would have produced two messages.

  Punctuation inside the notation is untouched: a sub-band ends in a digit after its period
  (`del(11)(q24.1)`), a cell count in `]`, a qualifier in a letter. Nothing legal ends in one of
  these marks.

- **The decoded count now shows the separator you typed.** ISCN writes a range of modal numbers with
  a tilde, `47~49`. A dash is the Mitelman spelling and KaryoDraw accepts it, but the decode panel
  rebuilt the chip as `47~49` regardless, so typing `47-49` showed a character you had not typed and
  left it unclear which mark was the right one. The chip echoes the field as written, and when the
  range was written with a dash the explanation adds that ISCN writes it with a tilde. Said in the
  decode rather than as a warning, because the karyotype is correct and draws.

  Echoing the field also restored something that was being dropped: `45<2n>,XY,…` showed a bare `45`
  in the chip, losing the ploidy annotation.

## 2026-07-28 (a contradicted count has two readings, and both are offered)

- **"Did you mean" showed one repair where there were two.** `50,XXXXXXX` states 50 and lists seven
  X, which with 44 autosomes comes to 51. Changing the number to 51 is one reading; dropping an X to
  reach the 50 that was written is the other. Nothing in the input says which was meant, so offering
  only the first presented a guess as the answer. It now reads "Did you mean 51,XXXXXXX or
  50,XXXXXX?" and either chip draws.

  `result.fixes` is the general mechanism: an ordered, deduplicated, vetted list, smallest edit
  first. Each repair is still decided in exactly one place; the list is derived from them.

  The second reading is deliberately narrow, because "adjust the content instead" is ambiguous in
  general. It needs no aberrations (in `50,XXXXXXX,+21` the excess could be the `+21`), one repeated
  sex letter (`50,XXXXXXY` could lose an X or the Y, and those are different karyotypes), and a
  single stated count.

- **A repair no longer has to draw, but it does have to go somewhere.** The app names one mistake at
  a time, so a repair that fixes its own mistake and lands on a different one is progress: `69.XX`
  offers `69,XX`, which is refused for its count and in turn offers `69,XXX`, the triploidy that was
  probably meant. What is dropped is a dead end. `46,,` collapsed to `46`, which since yesterday
  states no sex chromosomes, so clicking it bought a second refusal and no information; that
  karyotype now carries its message alone. A test follows every chain and requires it to reach a
  karyogram within three steps.

- **The count message named the wrong culprit when there were no changes to blame.** "The number at
  the start says 50, but the changes listed after it add up to 51" was describing changes that
  `50,XXXXXXX` does not have. It now says "44 autosomes and the 7 sex chromosomes listed after it",
  and closes on the sex chromosomes rather than the changes.

- **Fixed a duplicate message introduced the same day.** Typing only a rearrangement
  (`t(9;22)(q34;q11.2)`) drew both "It looks like you typed only the rearrangement" and the new
  "A karyotype starts with the chromosome count" line, because the second was pushed before the
  repair for the first had been decided. The message now waits until every repair is settled.

  A differential run of the old and new parser over 93 inputs found three changes in total, all
  intended: the two second readings added, and the `46,,` dead end removed. No input changed whether
  it draws.

## 2026-07-28 (a karyotype has to say what the sex chromosomes are)

- **`69.XX` drew 69 chromosomes with both sex slots labelled "missing", and said nothing.** A period
  instead of a comma made the whole designation one field: the count pattern read `69` and stopped
  at the period, so nothing ever looked at the `XX`. The same held for `46.XY`, `46;XY`, `46 XY`,
  and `46` on its own.

  Every existing check was looking somewhere else. The sex-field check added for `43,XZY` compares
  against a field that was stated, and there was none. The count check is skipped when there are no
  sex chromosomes to count. The round-trip check compares fields as written, and the count field
  came back verbatim, so the loss was inside a field rather than a field going missing, which is the
  one thing that check cannot see.

  Two changes. `diagnose()` now treats the comma between the count and the sex chromosomes as
  required, whether it was written as something else or left out, and offers the repair:
  "The chromosome count and the sex chromosomes are separated by a comma, so `69.XX` is `69,XX`."
  That replaces the narrower rule that only caught `46XY`. And a clone that states no sex field at
  all is refused outright, because nothing can be inferred: `46` is as consistent with XX as with
  XY, and drawing it picked neither. The message names the rule instead of a repair, since there is
  no repair to offer.

  Only one of the two messages ever shows. When the separator repair has already named the mistake,
  restating the rule reads as a second, separate problem.

  Verified against every karyotype the app ships, the example chips, and the 61-karyotype round-trip
  corpus: a differential run over 66 inputs found no change to anything that was already correct.
  Note what the known-holes survey missed here. Every entry on that list is a well-formed field list
  with a bad aberration in it, because that is what it was built to probe. This mistake was one level
  up, in the punctuation between fields. `docs/VALIDATION.md` records the lesson.

## 2026-07-28 (every page prints something)

- **Printing a karyotype page, the guide, the About page, or the hub produced a blank sheet.** The
  app page prints a purpose-built one-page summary, so its print stylesheet hides `main`. That
  stylesheet is inlined verbatim into all 36 generated pages, which have no such summary to take
  main's place, so `Cmd-P` on any of them gave an empty page.

  Generated pages now print their own article: the heading, the karyotype, the drawing, the decoded
  notation and the clinical note, ending in the disclaimer. Dropped from the printout are the parts
  that mean nothing on paper: the site header, the breadcrumb, the button into the visualizer, and
  the list of links to related pages. Headings will not orphan at the foot of a page, and a figure,
  a decode list, or a clinical note will not split across two. A karyotype page is one sheet; the
  guide is five.

  The app page is untouched and still prints its summary. `test/layout.test.js` holds both halves:
  generated pages re-show their main in print, and the homepage does not.

## 2026-07-27 (the homepage footer reaches the bottom of the page)

- **The homepage footer sat on a band of empty page.** Its markup was nested inside `<main>`, and
  `main { padding: 18px 0 60px }` painted that 60px of bottom padding below the footer rather than
  above it. Together with the footer's own 48px of bottom padding, 108px of nothing followed the
  last line of the page.

  A page-level footer is not main content, so it now follows `</main>` as a sibling, and `main`
  carries no bottom padding: the space above the footer is the footer's `margin-top`, the space
  below it is its `padding-bottom`, and nothing else renders underneath. The gap above the footer
  rule is unchanged at 34px; the gap below the text goes from 108px to 48px. Landing pages set
  their own bottom padding on `.lp-wrap`, which ends inside `main`, so they are untouched.

  Moving the footer out of `main` broke one thing that had been working by accident: the print
  stylesheet hid the footer only because it hides `main`. The print rule now names `footer`, and a
  test holds it there.

## 2026-07-27 (a missing comma between two signed changes; validation is documented)

- **`-2-21` was reported as "not a change KaryoDraw recognizes".** That names the symptom, not the
  mistake: it is `-2` and `-21` with the comma left out. It now says "Changes are separated by
  commas, so `-2-21` is two of them: `-2,-21`" and offers the repaired karyotype.

  The general "a sign after a digit means a missing comma" rule was rejected earlier for good
  reason: it would turn the modal range `45-48` into `45,-48`, a repair that reads as valid so
  nothing downstream would catch it. The safe subset is to apply it **per field**, and only to a
  token that **already begins with a sign**. Neither dangerous case can be reached: a modal range is
  field 0 and is never examined, and a marker count (`1~3mar`, `1-3mar`) does not begin with a sign.
  Tests pin both.

- **"couldn't read this as a karyotype yet" loses the "yet".** It implied the app was still working
  on it. Nothing changes until the input does. Same for the aria label and the empty state.

- **`docs/VALIDATION.md`**: what the app will and will not draw, why the round-trip check is worded
  the way it is and what it cannot see, the one case that warns without refusing and the evidence
  behind its narrow scope, a list of 14 known holes, and the rules for adding a check.

- **`NEXT_SESSION_HANDOFF.md`**: state, land mines (the CDN serves mixed versions for a few minutes
  after a merge; a guard can pass without the code it guards), and a reproduction script for the
  known holes.

## 2026-07-27 (a sex field the app had to edit is refused, not drawn)

- **`43,XZY,rob(14;21)(q10;q10),-21,-20` dropped the Z, said so, and drew anyway (bug).** The
  message even admitted it: "…is left out of the drawing". That is the class of behaviour that was
  supposed to be gone. It now refuses and offers `43,XY,rob(14;21)(q10;q10),-21,-20` in one click.

- **`46,QQ,+21` was worse: it drew a karyogram with no sex chromosomes at all.** Also refused now.
  No fix is offered, because "QQ" leaves nothing to keep and inventing one would be a guess.

- **The round-trip guard could not have caught either, and that limit is now pinned by a test.** It
  compares each field **as written**, which is exactly what lets `<2n>`, `47-49` and `+8×2` survive
  it. The cost is that a character dropped *inside* a field is invisible to it: `XZY` round-trips
  intact while the Z is discarded within it. A test asserts `unaccounted` is false for that input,
  so the limitation fails loudly if anyone later assumes the round-trip covers everything.

- **Both messages reworded to teach.** "Only X and Y belong in the sex chromosomes, so 'Z' … is left
  out of the drawing" becomes "The sex chromosomes are written with X and Y only, so 'Z' in 'XZY' is
  not one of them", and the no-X-or-Y message now names the forms: "written with X and Y: XX, XY, X,
  XXY".

## 2026-07-27 (gains and losses out of chromosome order are flagged)

- **`43,XY,rob(14;21)(q10;q10),-21,-20` drew silently.** The count is right (43) and the drawing is
  right, but 21 is listed before 20. It now says "Whole-chromosome gains and losses are listed in
  chromosome order, so `-20` comes before `-21`" and offers
  `43,XY,rob(14;21)(q10;q10),-20,-21` in one click. Only the two losses move; the `rob` keeps the
  position it was written in.

- **Scoped hard, and this is the interesting part.** ISCN's listing order also covers structural
  abnormalities, and the first version of this check applied it to them. It then flagged
  `46,XX,+der(5)t(2;5)(q21;q31),-2` as out of order, which is what this app's **own** segregation
  model emits for a 3:1 product, and that model was checked against ISCN 2024 Table 5.
  `segregation.js` had also already reached the opposite conclusion in writing, where its comparison
  key says "ISCN fixes neither [spelling nor order]".

  Rather than resolve that from memory, the check was narrowed to the piece that is not in dispute:
  `+N` and `-N` against each other. Everything else is left alone. A test pins the app's own
  segregation output against the check, so the two halves cannot take opposite positions again.

- **This one warns, it does not refuse.** Every other check added today blocks the drawing, and this
  deliberately does not: listing order changes how a karyotype is written and never what is drawn,
  and confidence in the exact ISCN rule is lower here than for the count and readability rules. A
  wrong call should cost a suggestion, not a refusal.

## 2026-07-27 (the view options are ordered by use; the tour moves to the nav)

- **Show, then Bands, then Style.** Ordered by how often a viewer reaches for each one, which turns
  out to be the same order as the question each answers: which chromosomes, then how much detail,
  then how they are coloured. Two independent principles agreeing on the same order is the reason to
  trust it. Style is close to a one-time preference, so it goes last.

- **The guided tour moves out of the typing path and into the nav.** It was the only full pill in
  the input stack, sitting between the examples and the controls on a row of its own, and most
  people arrive to type rather than to be toured. It is now a nav item beside Guide, which is what
  it is: a destination. That removes a whole row from the header.

  It also **works from every landing page now**, which it never did. The link is `/?tour=1`, and the
  homepage opens the tour after the first draw so it appears over a karyogram rather than an empty
  page. The URL is rewritten without `tour=1` on that first draw, so a refresh or a shared link does
  not silently restart it. The nav is single-sourced in `scripts/build-pages.mjs`, so all 32 landing
  pages, the hub and the two static pages picked it up from one edit.

- **Left as is:** the hint line under the controls still describes the Style toggle while sitting at
  the left, now under Show. The bolded word matches the active button's label, so the connection is
  made by the word rather than the position, and it reads fine.

## 2026-07-27 (a round-trip check, so dropped input stops being found one case at a time)

- **`47~49,XY,+8,,` drew a full karyogram and said nothing at all (bug).** Two commas. The field
  list is filtered for length, so the blanks vanished before anything could object.

- **The parser now reassembles each clone from everything it kept and compares it with what it was
  handed.** Anything that does not come back was dropped without being understood, and the drawing
  that follows would be of a karyotype nobody typed. This is the general net rather than one more
  special case: it catches the class, not that one member of it.

  The comparison is on the fields **as written** (`modalGiven`, `sexGiven`, `ab.raw`, `cellGiven`)
  rather than on re-serialised values, which is what lets case, range spelling (`47-49` and
  `47~49`), `<2n>`, `×2` and `x2`, qualifiers and cell counts survive it untouched. **61 varied
  valid karyotypes round-trip exactly**, which is what makes a mismatch worth refusing on. A
  subclone written `idem`/`sl`/`sdl` is exempt, since its list is deliberately expanded from the
  stemline and can never round-trip.

- **The empty field is repaired, not only refused.** `47~49,XY,+8,,` offers `47~49,XY,+8` and says
  "Each change is its own item between commas, so an empty item is not one. Remove the extra comma."
  A bare refusal on a stray comma would be a poor trade. Commas inside parentheses are untouched;
  they have their own message.

- **The corpus is itself under test.** A guard validated on five inputs is not a guard, so a
  meta-assertion fails the build if the valid list drops below 40 karyotypes or stops exercising at
  least 14 aberration kinds. Also verified: `45<2n>,…` used to be the one valid karyotype that did
  not round-trip, because the ploidy annotation was parsed and discarded; keeping the modal field as
  written fixed that too.

## 2026-07-27 (a karyogram is drawn only for valid ISCN)

- **If it draws, the notation was accepted.** Drawing the nearest plausible reading of a wrong
  designation is not teaching: it lets a mistake look answered, and it destroys the app's use as a
  check, which is what someone writing an exam question needs from it. Three things still drew
  despite not being valid ISCN, and now do not:

  - `46,XY,zzz(9)(q34)` drew a full, normal-looking karyogram. The made-up operation parsed as
    "unknown", the count happened to add up, the band was real, and nothing objected.
  - `46,XY,rob(14;21)(q10;q10),21` (no sign) and `46,XY,inv(9)(p11q13)zzz` (trailing text an
    operation could not consume) drew the same way.
  - A count the app is willing to call wrong, such as `46,XY,rob(14;21)(q10;q10),-21`, drew the
    44-chromosome karyotype it was not asked for.

- **The line is "valid ISCN", not "the app has a complaint".** Two flags, both set by the parser:
  `clone.unreadable` for a part that could not be read, and `clone.countWrong`, set at exactly the
  point the count warning is pushed. `countWrong` is deliberately not `!counts.ok`, because valid
  ISCN can have a tally that cannot be pinned. All of these still draw: `48,XY,+8,inc` and
  `46,XY,inc`, modal ranges `47~49,XY,+8`, mosaics, composites `[cp10]`, and `45<2n>,XY,…`. So does
  the legal-but-unusual `46,XX,t(13;15)(q10;q10)`, with its note offering the `rob()` reading.
  "Unusual" is not "invalid".

- **Two live bugs on valid input fell out of drawing that line.** `48,XY,+8,inc` was offered "Did
  you mean 47,XY,+8,inc?" and would have carried "you wrote 48; the changes listed add up to 47"
  into an exported PNG. Its tally is short by design. Every count claim now reads `countWrong`: the
  warning, the one-click fix, the pill, the image note, and the plain-language summary.

- **A new test file guards the direction that matters more.** Refusing valid ISCN is far worse than
  tolerating invalid ISCN, so `test/draw-gate.test.js` walks every karyotype the app itself ships,
  the guided tour and all the landing pages out of `content/karyotypes.js` plus the example chips,
  and asserts each still draws and still renders without throwing. It also pins that the page's gate
  really uses both flags rather than merely reading them.

## 2026-07-27 (gibberish in a breakpoint is refused, not drawn)

- **`47,XY,del(5)(zzqewdf2315.2)` drew a karyogram (bug).** It also offered "Did you mean
  `46,XY,del(5)(zzqewdf2315.2)`?", the same gibberish with the count changed, and explained itself
  as "a terminal DELETION of chromosome 5: everything distal to 5? (out to the tip) is lost". It now
  refuses to draw and says: "'zzqewdf2315.2' in 'del(5)(zzqewdf2315.2)' is not a breakpoint. A
  breakpoint is an arm letter then a band number, like 5p15.2 or 5q31."

  Cause: `splitBands` found nothing band-like and returned an empty list, which left
  `del(5)(zzqewdf2315.2)` **identical to `del(5)`** with no breakpoint written at all. The band
  check in `index.html` could not catch it either, because by the time it looks there is no band
  left to look at. The raw text is now kept when a group yields no band, which is what makes the
  case visible at all. An empty group is still legal: `del(5)`, `r(13)` and `+mar` are untouched.

- **A well-formed band that does not exist is still a different case.** `del(5)(p99)` parses as a
  band, so it reaches the existing check that knows how far 5p actually runs and can name the
  nearest real band. That message is better than "not a breakpoint" and is unchanged.

- **The count message no longer presumes which side is wrong.** "That number is the total count for
  the cell, so it has to match the changes listed after it" pointed the reader at the number. For
  `45,XX,t(13;15)(q10;q10)` the number is arguably right and the operation is what should change,
  which the app itself says in the very next line when it offers `rob()`. It now reads: "That first
  number is the cell's total chromosome count, so either it or the changes needs fixing."

## 2026-07-27 (the count message stops claiming more authority than it has)

- **"but this karyotype describes 46 chromosomes" is gone.** It stated the app's own arithmetic as a
  property of the karyotype. The figure is nothing more than the sum of the copies this app worked
  out, so if that working is wrong the sentence is wrong with exactly the same confidence, and it
  had been wrong three times this week. It now reads: **"The number at the start says 47, but the
  changes listed after it add up to 46 chromosomes. That first number is the cell's total, so the
  two have to agree."** Saying whose sum it is invites the reader to check it, which is both the
  honest claim and the more useful one. The note carried into the PNG and the print sheet was
  reworded to match.

- **It deliberately does not point at the drawing**, tempting as that was, since the figure IS the
  number of copies drawn and the two can never disagree. A bad band such as `47,XY,del(5)(zz15.2)`
  raises this warning and is also refused a karyogram, so "count them below" would sometimes point
  at nothing. A test pins that.

- **A test rejects oracle voice in any message**, alongside the existing parser-voice guard: no
  warning may say "this karyotype describes", "this notation describes", or "the karyotype
  is/has/contains". Five test assertions that pinned the old prose were retargeted to assert the two
  numbers and their order instead, so rewording the copy no longer churns them; `message-voice.test.js`
  owns the wording.

## 2026-07-27 (every count claim now reads one flag)

- **`46,XY,rob(14;21)(q10;q10),21` still offered "Did you mean 45,XY,rob(14;21)(q10;q10),21?".** The
  previous change suppressed the count *warning* for an incompletely read designation but not the
  one-click count *fix*, so the app quietly proposed keeping the signless `21` and changing the
  number that was right. Caught on the deployed build while verifying the fix that preceded it.

- **One flag, `clone.uncounted`, and everything that makes a claim about the count reads it.** The
  warning, the one-click fix, the "written N · drawn M" pill, the note carried into the PNG and
  print sheet, and the plain-language summary all gate on the same thing: was any part of the
  designation left uninterpreted. A tally built from a partial reading is a byproduct of that
  reading, not a statement about the karyotype, and nothing should present it as one. A test asserts
  the flag's value directly so the five consumers cannot drift into disagreeing about the same
  karyotype.

- **Legitimate count fixes are untouched.** `46,XY,rob(14;21)(q10;q10),-21` and
  `40,XY,rob(14;21)(q10;q10),-21` still offer 44, and `45,XX,t(13;15)(q10;q10)` still offers the
  `rob()` spelling.

## 2026-07-27 (an emptied chromosome slot, a signless token, and the drawn count)

- **`44,XY,rob(14;21)(q10;q10),-21` drew no chromosome 21 at all (bug).** That karyotype leaves no
  free 21: one fused into the derivative, one lost. The affected view drops empty slots, on the
  reasoning that an empty slot has nothing to isolate, so the whole point of the karyotype was
  invisible. An empty slot is now kept whenever the karyotype **states** a loss for that chromosome,
  because then the gap is the finding. Chromosome 21 shows its gap in both views.

- **"nullisomy" was wrong every time it appeared, and is gone.** The full karyogram labelled an
  empty slot "nullisomy". A slot only empties two ways and neither is nullisomy: with a stated loss
  the gaps say it (after `rob(14;21)` plus `-21`, 21q is still present on the derivative, so that is
  a monosomy for 21q and not an absence of it), and otherwise every copy was consumed by a
  derivative, as in `43,XY,rob(13;14)(q10;q10),rob(13;14)(q10;q10)`, where both 13q and both 14q are
  present on the two fusions and nothing is missing at all. A probe over the reachable inputs found
  no case where an autosome slot empties with nothing accounting for it, so the label had no correct
  use left. It now reads "none free", which is what is true of the slot.

- **`46,XY,rob(14;21)(q10;q10),21` argued about the count instead of the missing sign.** The
  signless `21` never became an aberration, so it contributed nothing to the tally, the tally came
  out 45, and the app announced "the number at the start says 46, but this karyotype describes 45
  chromosomes" underneath the message that actually diagnoses it. Read as `+21` the stated 46 is
  exactly right. The count warning already stays quiet when a token went unread; that guard now also
  covers a token that never became an aberration at all, which is the same failure by a different
  route.

- **The pill names both numbers: "written 46 · drawn 44".** The drawing is built from the changes
  listed and never from the number at the front, so `46,XY,rob(14;21)(q10;q10),-21` and
  `40,XY,rob(14;21)(q10;q10),-21` produce the same karyogram of 44 chromosomes. "Count doesn't add
  up" did not explain why three different inputs give one picture, and left the drawing captioned
  with a number it does not contain.

  Still drawn rather than refused, deliberately. For `45,XX,t(13;15)(q10;q10)` the picture is the
  whole lesson, and refusing on any count mismatch would delete it. The rule stays: draw what the
  changes describe, and never let the written number sit on the picture unchallenged.

## 2026-07-27 (the warning box teaches the rule instead of reporting on the parser)

- **"was not read" is gone, along with the rest of the parser-voice copy.** The message that
  prompted this read: *"'+21' in 'rob(14;21)(q10;q10)+21' was not read. Each aberration is a separate
  item, so it needs a comma before it: …"*. Read by whom, and so what? The reader here is a learner
  who mistyped a karyotype, and the useful content is the ISCN rule they missed. It now reads
  **"Changes are separated by commas, so '+21' needs one before it: 'rob(14;21)(q10;q10),+21'."**
  Rule first, then the fix, and nothing about the app's internal handling of the text.

  Four more rewritten the same way: *"Only the first part … was read; … wasn't understood"* →
  "KaryoDraw draws one karyotype at a time, so … cannot be included"; *"Couldn't read …"* → "… is not
  a change KaryoDraw recognizes. Changes look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2)";
  *"Don't recognize 'zzz' …"* → "'zzz' … is not an ISCN abbreviation. The ones KaryoDraw draws: …";
  *"Ignored 'Q' in the sex chromosomes"* → "Only X and Y belong in the sex chromosomes, so 'Q' … is
  left out of the drawing".

- **The count warning now names the rule, not just the discrepancy.** Caught by the new test rather
  than by eye: "The number at the start says 45, but this karyotype describes 46 chromosomes" states
  a fact and teaches nothing. A reader who does not already know that the leading number is the
  cell's total count cannot act on it, and that is exactly who is reading. It now adds: "That number
  is the total count for the cell, so it has to match the changes listed after it."

- **A test keeps parser voice out, because it creeps back one message at a time.** 24 deliberately
  broken inputs are parsed, every warning collected, and each checked against a list of phrasings
  that report on the app rather than teach ("was not read", "couldn't read", "failed to parse",
  "unable to", "invalid input", "ignored", "don't recognize", "error"), plus a looser check that
  every message names a rule, a correct form, or an example. It also fails the build on an em dash
  in any message. Verified to fail when a single old message is restored.

## 2026-07-27 (a wrong "count doesn't add up" on a missing comma after rob)

- **`46,XY,rob(14;21)(q10;q10)+21` claimed the count was wrong when it was right (bug).** With the
  comma before `+21` left out, the app offered the correct fix,
  `46,XY,rob(14;21)(q10;q10),+21`, and then listed as the one thing to check: "The number at the
  start says 46, but this karyotype describes 45 chromosomes." That contradicted its own suggestion,
  whose count is 46. The writer's 46 was right: this is translocation Down syndrome. The `+21` had
  been swallowed into the `rob` token, so the app's tally was short by one, not the karyotype.

  The count warning already guards against precisely this, and the reason is written next to it:
  when part of the designation went unread, the stated number is probably right and our tally is the
  thing that is short, and "says 46 but describes 45" reads as a claim about the karyotype that
  sends people hunting an imbalance that is not there. The guard did not fire because **`rob()`
  never recorded its leftover.** `rob()` sets kind `der` (it behaves exactly like
  `der(13;14)(q10;q10)`) but never runs `der()`'s sub-op parsing, so a `kind`-based exemption
  excused it from both leftover reporters and the `+21` was dropped in silence. Keying the exemption
  on the op as written fixes it.

- **The missing comma is now named, which it never was after `rob()`.** `der(13;14)(q10;q10)+14`
  always said "'+14' … was not read. Each aberration is a separate item, so it needs a comma before
  it"; the same rearrangement spelled `rob(14;21)(q10;q10)+21` said nothing at all, leaving a "did
  you mean" whose only visible difference from the input is one comma. A test now asserts the two
  spellings warn identically about the same mistake.

- **`45,XY,rob(14;21)(q10;q10)+21` used to produce no warning whatsoever.** The broken parse
  happened to total 45, matching the stated count, so the case where something really was wrong was
  silent while the case where nothing was wrong shouted. It now reports the missing comma.

- **Genuine count mismatches are untouched.** The guard is about unread text, not about counts:
  `45,XX,t(13;15)(q10;q10)` and `47,XY,rob(14;21)(q10;q10),+21` still say so.

## 2026-07-27 (one cell list behind both karyogram views)

- **The full karyogram and the affected-only view each assembled their own cell list, and drifted.**
  The chromosome drawing was already fully shared (`drawInstance` → `cellHtml` → `alignMode`), but
  each view separately decided *which* cells exist and separately handled markers, double minutes
  and the absent-homolog placeholder. That is the code path that produced a real bug: the
  placeholder for a monosomy shipped in the full karyogram and had to be back-ported to the affected
  view afterwards. A single `cellSpecs(clone, only)` now answers "which cells", for both.

- **A second disagreement surfaced and is fixed.** The two views ordered the sex-chromosome gap
  differently: the full karyogram put it directly after X and Y, the affected row put it last, after
  markers. Visible on `45,X,+mar` and `46,X,+mar`. Both now use the full karyogram's order, since the
  gap belongs to the sex pair rather than to the end of the row.

- **Nothing else moved.** Verified by rendering 36 karyotypes across both views and both themes,
  144 snapshots of the emitted HTML, and diffing against the previous build: 140 byte-identical, and
  the 4 that differ are exactly the `+mar` ordering above, same cells, same markup, same length.

- **The two views keep their own vertical alignment, on purpose.** That part is not a consolidation
  candidate and is now asserted as such. The affected row hangs every cell off one shared centromere
  line, which is the classic karyogram look for a focused row; across 24 chromosomes it would put
  chromosome 1's centromere (about 123 Mb down) on the same line as chromosome 21's (about 12 Mb
  down) and leave a chromosome-length of blank space above every small one.

## 2026-07-27 (Back undoes a view toggle; a count that does not add up travels with the image)

- **Back skipped the Style / Bands / Show toggles entirely (bug).** Measured on production: three
  toggle clicks added **zero** history entries, and one Back left the site. Each toggle rewrites the
  URL and the drawing, so each is a state Back should return to; they were simply not in the set
  that #98 fixed (example chips, the "did you mean" button, conceptus karyotypes). Typing stays on
  `replaceState` on purpose, since one entry per keystroke would fill history with half-typed
  karyotypes, but a toggle is a discrete click and there is no such argument for it. Re-clicking the
  button that is already on re-renders nothing and adds no entry, or Back would replay states that
  look identical. `popstate` already restored all three through `applyUrlView`, so nothing else
  needed to change. Verified: three toggles now give three entries, and three Backs walk them in
  reverse with the buttons restored.

- **A karyotype whose count does not add up now says so in the PNG and the print summary.** The
  policy for drawing questionable input is unchanged and deliberate: the app refuses to draw
  anything it cannot read (nothing parsed, no modal number, a syntax repair on offer, a band that
  does not exist), and does draw the one case where the notation is unambiguous and only the
  writer's own count disagrees with it. For `45,XX,t(13;15)(q10;q10)` the picture is the
  explanation, and refusing would leave a learner with an error and no reason.

  What was missing is that the explanation stopped at the screen. On screen there is a red "count
  doesn't add up" pill and a warning box; the exported PNG carried the karyotype as typed, the
  karyogram, and nothing else, and the print sheet the same. Those are the copies that outlive the
  session and land in slides and question banks, in front of people who never typed the input, so a
  caption reading 45 over a drawing of 46 travelled with no way to tell. Both now carry
  "⚠ you wrote 45; this notation describes 46 chromosomes", and the export canvas grows a line
  rather than drawing the karyogram over it. A mosaic names the clone, since `countFix` is
  single-clone only and a mosaic never gets the one-click fix.

- **The plain-language summary no longer asserts the wrong count as fact.** It read "This result
  shows 45 chromosomes" a few inches above a drawing of 46 in the same print sheet. It still reports
  the count as written, and now adds that this is what it is and what the listed changes actually
  add up to.

## 2026-07-27 (the example chips re-deal on page load; the Shuffle button is gone)

- **The Shuffle chip is removed; the three examples are re-dealt on every page load instead.** It
  shipped earlier today and lasted about an hour. It was a control sitting in the row it was meant
  to shorten, competing with the three chips for the same horizontal space and reading, at a glance,
  like a fourth karyotype to click. A page load is already the moment a viewer arrives with fresh
  attention, so dealing there costs no pixels and no explanation.

- **The deck lives in `sessionStorage`, so refreshing walks the whole list.** Picking three at
  random on each load would show the same two or three by chance and bury the rest, which is the
  failure the deck existed to prevent. Indices are dealt from a shuffled deck whose cursor survives
  a reload, so three reloads surface all seven examples. `sessionStorage` rather than
  `localStorage`: the deck should reset for a new visit, and it is per-tab, so two open tabs do not
  fight over one cursor. Any storage failure (Safari private mode throws on write) falls back to an
  in-memory deck that still shuffles correctly and only loses continuity across reloads. A saved
  deck is discarded when the example list changes length, since it stores indices rather than
  karyotypes.

  Tested against a `sessionStorage` stub over 40 trials: every trial deals a full row of three with
  no repeat inside a row, and covers all seven within three reloads. Verified to fail when the deck
  is swapped for independent sampling.

## 2026-07-27 (every Robertsonian was drawn upside down)

- **`rob(14;21)(q10;q10)` drew der(14) as 90 Mb of inverted 14q above 35 Mb of 21q (bug).** The
  derivative's long arm ran backwards next to the normal 14 standing beside it, which is the exact
  comparison the picture exists to support. It also left the derivative floating above its row,
  because its seam centromere sat far from the normal homolog's.

  Cause: `wholeArmSegments` put `chroms[0]` on top, taking the nomenclature order as a drawing
  order. Those are different things. ISCN says how to WRITE `der(14;21)(q10;q10)`, including that
  the partners are listed lowest-number-first, and says nothing at all about the drawing, which
  `teach.js` already tells the reader ("written lowest-number-first by convention, not by which
  centromere is kept"). The renderer was contradicting its own explanation. And because a q arm in
  the top position has to be flipped so qter points up, naming order decided which arm got inverted.

  The rule that does apply is the one every other chromosome in the karyogram already obeys, and the
  one a cytogeneticist uses on a chromosome cut out of a metaphase spread where no name is
  available: orient by morphology, **short arm up**. Ordering the two retained arms by length puts
  the shorter one on top, so the single unavoidable flip is spent on the shorter arm and the long
  arm reads the same way up as its normal homolog. der(14;21) is now 21q over 14q, and the
  derivative's 14q lines up band for band with the normal 14. rob(13;14) becomes 14q over 13q
  (14q is 90 Mb to 13q's 97 Mb).

- **The mixed-letter case is decided by reversal count, not length.** `der(1;3)(p10;q10)` keeps 1p
  (123 Mb) and 3q (107 Mb), and putting the p arm on top is the only arrangement that flips neither
  arm. A pure length rule would hoist 3q above 1p and invert both to do it, which is strictly worse
  to read, so that drawing is unchanged.

- **Segment order can no longer change what a derivative looks like it IS.** The outline colour and
  the seam centromere used to be read off `segments[0]` / the first centric segment, which only
  happened to be the named chromosome because the named chromosome was drawn first. Reordering the
  arms would have made der(14) outlined in chromosome 21's colour. `drawInstance` now passes the
  label chromosome explicitly. For every other kind of derivative the two agree, so nothing else
  moves.

- **One test changed meaning rather than expectation.** The whole-arm alignment test used
  `rob(13;14)` and asserted that centromere-alignment and bottom-alignment give different shifts, to
  prove the centromere path ran. Under the new orientation they coincide exactly, and that is a
  property worth having rather than a gap: the derivative is filed under the chromosome with the
  longer arm, that arm is drawn at the bottom, so the derivative and its normal homolog end on the
  same arm. The test now asserts the coincidence. The del(1)(q42) test still discriminates the two
  alignment paths.

## 2026-07-27 (a whole-arm acrocentric t gets a note and a rob button; fewer example chips)

- **`46,XX,t(13;15)(q10;q10)` now offers the Robertsonian reading beside the drawing.** The help was
  backwards from the risk: when the count contradicts the `t` (`45,XX,t(13;15)(q10;q10)`) the viewer
  got an amber box and a one-click `rob()` fix, but when the karyotype is internally consistent at 46
  the only hint was the tail of a 60-word decode sentence, below the karyogram and the fold. The
  consistent one is the more convincing picture and therefore the more dangerous one: 46 chromosomes
  with both whole-arm products present is exactly the image that persuades a reader a Robertsonian
  carrier has 46. It now gets a periwinkle "Worth knowing" note above the drawing with a button that
  draws `45,XX,rob(13;15)(q10;q10)`, so the two pictures can be compared in one click.

  Deliberately not the amber warning box, and deliberately "draw it as a Robertsonian instead" rather
  than "did you mean": the input is legal ISCN and the renderer draws it correctly, and warning on
  correct input is how a warning box loses its authority. A test pins that the note and the warning
  never both fire. The count in the offered fix is decremented rather than hardcoded to 45, since
  replacing two derivatives with one fused chromosome removes exactly one chromosome whatever else
  the karyotype carries (`47,XX,t(13;15)(q10;q10),+21` offers `46,XX,rob(13;15)(q10;q10),+21`).

- **The decode explains why `(p10;q10)` and `(q10;q10)` draw the same thing.** Reported as a
  suspected bug, and it is correct behaviour: ISCN's derivative formula is `der(A) = A pter→bandA ::
  B bandB→B qter`, and at the centromere `pter→band` is the whole p arm whichever letter is written,
  so all four spellings give der(A) = Ap+Bq. The letters record which half of the split centromere
  each derivative carries, not which arms join. Two identical drawings from two different inputs read
  as the app ignoring the input, so the decode now says this outright and names the arms each
  derivative carries. A test asserts the prose and the renderer's segments agree, so the sentence
  cannot drift from the drawing.

- **The rob note says why 45 chromosomes is not a monosomy.** "It gives a count of 45" left the
  obvious question unanswered. An acrocentric short arm carries ribosomal RNA gene repeats that the
  other acrocentrics carry as well, which is why a balanced carrier is healthy at 45.

- **The DiGeorge example chip is gone.** A 22q11.2 deletion is about 3 Mb, well under the 5-10 Mb a
  ~550-band karyotype resolves, so it is found by FISH or microarray and not by banding. The guide
  page says exactly that, and the chip drew it as a visibly missing band, teaching the opposite of
  the thing worth learning. A test now holds every chip to the app's own parser (no warning, no
  suggested fix, no note) and requires each to highlight something, and keeps submicroscopic
  syndromes off the list.

- **Three example chips at a time, with Shuffle.** Eight chips wrapped to three rows and pushed the
  karyogram below the fold on a laptop, where the last five are scrolled past unread. Shuffle deals
  from a shuffled deck rather than sampling independently, so repeated clicks walk the whole list
  instead of re-rolling the same two or three, and no example becomes unreachable.

## 2026-07-26 (whole-arm reciprocal translocations had their arms swapped)

- **`t(13;15)(q10;q10)` drew der(13) as 15p+13q, which is der(15)'s content (bug).** Every whole-arm
  reciprocal translocation came out with the two derivatives' material exchanged relative to their
  labels. The giveaway is visual: a whole-arm exchange of q arms should leave each derivative
  dominated by its *partner's* colour, and instead each looked like itself.

  Pre-existing, and the app contradicted itself about it: `segregation.js` calls
  `der(13)t(13;15)(q10;q10)` a partial trisomy for 15q and a partial monosomy for 13q, so the drawing
  carried exactly the arm the text said was missing. A test now asserts the renderer and the
  segregation model agree on the same string, so the two halves cannot drift apart again.

  Cause: `p10` and `q10` both resolve to *exactly* the centromere, so `splitAtBreak`'s positional test
  ("is the breakpoint at or above the centromere?") was degenerate and sent both down the p-side path.
  At a centromeric break both pieces are centric, each carrying half the centromere, so position
  cannot settle it. ISCN settles it by formula: `der(A) = A pter→bandA :: B bandB→B qter`, and at the
  centromere `pter→band` is the p arm whichever letter is written. So a whole-arm derivative keeps its
  own p arm and receives the partner's q arm, and the `p10`/`q10` choice records which half of the
  centromere it carries rather than which arms join. That also settles the mixed case,
  `t(1;3)(p10;q10)`, as der(1) = 1p+3q.

  Ordinary breakpoints were never affected, since away from the centromere position and arm letter
  agree. Robertsonian fusions were never affected either: `der`/`rob` go through `wholeArmSegments`,
  where the breakpoint letters genuinely do name the arms kept, and `rob(13;14)` still gives 13q+14q.

## 2026-07-26 (parental origin: the segregation panel, run backwards)

- **Type an unbalanced karyotype and see the carrier parent it could have come from.** The panel only
  ever worked forwards, from a balanced carrier to its possible conceptions, which is backwards from
  clinic and from the boards: there you are handed the abnormal result and reason toward the parents.
  `46,XX,rob(14;21)(q10;q10),+21` used to show nothing at all. It now names the segregation that
  produced it, offers the carrier parent in both sexes as loadable karyotypes, and embeds that
  parent's own segregation panel with the outcome you typed marked.

  It is the forward model run backwards, not a second enumeration: the small candidate set of carriers
  is generated, the existing `compute()` runs on each, and the ones whose conceptus list contains the
  typed karyotype are kept. So the nomenclature surface stays the one already validated against ISCN
  2024 Table 5, and correctness is a round trip that the tests walk over every derivative-bearing
  product of four carriers.

- **No recurrence-risk numbers, and no claim about which parent.** Both carrier sexes are always
  shown, since nothing in a proband's karyotype says which parent carries it. A test fails the build
  on a percentage or a 1-in-N figure anywhere in the panel: the figures swing on chromosome pair,
  carrier sex and ascertainment, and a wrong one in a teaching tool is worse than none. A Robertsonian
  carrier of 14 or 15 does get one line naming the uniparental-disomy risk, because that is a reason
  to karyotype the parents that a segregation diagram cannot show.

- **A bare aneuploidy still shows nothing.** `45,XY,-21` and `47,XX,+21` have no determinate origin:
  nondisjunction and a carrier parent both produce them. Naming a carrier there would overclaim. See
  `docs/PARENTAL_ORIGIN.md`, which now records what was built and what was deliberately left out.

- **A whole-arm acrocentric `t()` at a self-consistent count is explained in the decode panel.**
  `46,XX,t(13;15)(q10;q10)` is legal, and for two non-acrocentrics it is what you would write, so it
  is not a warning: warning on correct input is how a warning box loses its authority. But for two
  acrocentrics it is almost never what was meant, and the drawing (46 chromosomes, both products
  present) is the picture that convinces a reader a Robertsonian carrier has 46. The decode row now
  says the count stays 46 because both whole-arm products are kept, and names
  `rob(13;15)(q10;q10)` at 45. When the count already contradicts the `t`, the warning box and its
  one-click fix are doing that job, so the decode panel stays quiet.

## 2026-07-26 (an absent autosomal homolog is drawn)

- **An autosomal monosomy shows the gap (bug).** `45,X` has always drawn a placeholder for the
  missing sex chromosome, but an autosomal loss drew nothing, so `45,XY,-21` showed a single
  normal-looking 21 and read as "chromosome 21 is fine". Most visible in the segregation panel's new
  preview, where the monosomy outcomes looked unremarkable.

  The placeholder follows the losses the karyotype **states**, never a copy-number deficit. The two
  are indistinguishable by count: a balanced `rob(13;14)` carrier also has a single drawn 14, but
  there 14q rides on the derivative and nothing is missing, so a placeholder would misstate it.
  Tests pin both directions, including the tertiary monosomy `45,XY,der(2)t(2;5)(q21;q31),-5`, which
  marks 5 and not the derivative-carrying 2. Sex chromosomes keep their existing path, so
  `45,X,-Y` still draws exactly one placeholder.

## 2026-07-26 (preview a conceptus karyotype without leaving the panel)

- **Hover or focus a conceptus karyotype to see it drawn.** Six outcomes in the segregation panel
  differ from one another in two or three chromosomes, and comparing them meant clicking away and
  back. The preview shows the affected-only view, so it draws just what changed: for
  `46,XY,der(14;21)(q10;q10),+21` that is chromosomes 14 and 21, not a whole karyogram.

  Opens on keyboard focus as well as hover, so it is not mouse-only; hover itself is gated on
  `(hover: hover)` so it never fires from a touch. `pointer-events: none` keeps it from ever sitting
  between the pointer and the button, Escape dismisses it, and scrolling or resizing hides it rather
  than leaving it pinned to a stale position. Nothing is available only through the preview: clicking
  still draws and decodes the outcome in full.

- **A chromosomally normal outcome gets no preview.** `46,XY` from alternate segregation has nothing
  to isolate, and twenty-four normal chromosomes in a popover would add nothing to the row's own
  "normal" label.

## 2026-07-26 (Back returns to the previous karyotype; balanced/unbalanced examples)

- **Back works (bug).** Every view was written with `history.replaceState`, so the app never added a
  history entry and Back left the site entirely — from the segregation panel that meant landing on an
  empty tab. Discrete jumps (an example chip, a "did you mean" fix, a conceptus karyotype) now push
  their own entry, and a `popstate` handler re-renders from the URL, so Back and Forward walk the
  karyotypes you visited. Typing still replaces, or one keystroke per entry would fill history with
  half-typed karyotypes; verified that typing adds zero entries.

- **One path for every jump.** The chip, fix-button, and conceptus handlers each did their own
  `input.value = ...; run();`. They now share `loadKaryotype()`, so they cannot drift, and the
  demo karyotype is a named constant instead of a string repeated in two places.

- **Balanced and unbalanced translocation examples.** Replaced the free-trisomy Down chip with a
  pair that reads as one family: `45,XY,rob(14;21)(q10;q10)` (balanced carrier) and
  `46,XY,rob(14;21)(q10;q10),+21` (unbalanced: translocation Down). The carrier notation matches
  `content/karyotypes.js`, so its canonical landing page still resolves. Trisomy 21 remains in the
  Common karyotypes catalog and on its own page.

## 2026-07-26 (whole-arm derivatives sit on the row baseline in the full karyogram)

- **A Robertsonian or isochromosome cell no longer breaks its row (bug).** A whole-arm derivative
  reports a centromere y at its fusion seam, which was then aligned against the normal homolog's
  real p/q boundary. Those two are not the same kind of thing: an acrocentric's centromere sits near
  its top, a fusion's between two long arms, so aligning them dropped the normal homolog 82px down
  its cell (56% of the cell height for `rob(14;21)`) and left the derivative floating above the
  baseline its neighbours sit on. Cells like this now bottom-align in the full karyogram.

  The "affected only" view still aligns on the seam, deliberately: there every cell is hung off one
  shared horizontal centromere line, which is the classic karyogram look, and the seam is the best
  centromere proxy such a derivative has. That behavior was already pinned by tests, all of which
  render with `only:` — the full view was simply never checked. `alignMode()` now makes the
  distinction explicit and is shared by the layout and the cross-cell metrics, so the two cannot
  disagree about what a cell looks like.

## 2026-07-26 (the segregation panel's conceptus karyotypes are clickable)

- **Every conceptus karyotype in the segregation panel loads in one click.** The panel already
  enumerated the karyotypes related to what you typed: a `rob(13;14)` carrier lists
  `46,XY,der(13;14)(q10;q10),+14` as its trisomy 14 product, and `rob(14;21)` lists
  `46,XX,der(14;21)(q10;q10),+21` as translocation Down syndrome. Those were dead `<code>` text, so
  reading the panel and then seeing the outcome meant retyping the karyotype by hand (and mistyping
  it, which is how the parser bug above was found). They are buttons now, on the same `data-k`
  contract as the example chips and the "did you mean" fix, so one delegated listener serves all
  three. Clicking scrolls the drawing into view, since the panel sits well below it.

- **The affordance is stated, not just styled.** A link underline alone was invisible at normal
  viewing size, so the controls row above the modes now says so outright.

## 2026-07-26 (a dropped aberration no longer draws silently; Robertsonian and band help)

Reported by a student preparing for the ABGC boards, who typed
`45,XY,der(13;14)(q10;q10) +14` and got the plain Robertsonian carrier back with no warning at all.

- **Never drop a fragment silently (bug).** `der()` accepts trailing sub-ops (`der(9)t(9;22)(q34;q11.2)`),
  and anything in that position that was not a sub-op used to be discarded without a word, so a
  trailing `+14` vanished and the drawing looked authoritative while missing a chromosome. The der
  branch now tracks what its sub-op scan consumed and reports the remainder by name.

- **Repair a missing comma before a sign.** `der(13;14)(q10;q10)+14` and `t(14;21)(q10;q10)+21` now
  offer `…),+14` / `…),+21` as a one-click fix. A sign is only ever the first character of an
  aberration, so a sign directly after `)` is unambiguous; the rule is anchored on the `)` so modal
  ranges (`45-48,XY`) and marker counts (`1~3mar`) are untouched.

- **Say what is actually wrong.** A missing-comma fragment used to be blamed on "alternatives with
  'or' and uncertainty markers", which was never the problem. That note is now reserved for
  fragments it fits.

- **Stop arguing about the count when part of the input went unread.** "Says 46 but describes 45" was
  a consequence of the dropped `+14`, and it sent the reader looking for an imbalance that was not
  there. Suppressed when any aberration has unread text.

- **Offer `rob()` for a whole-arm acrocentric fusion written as `t()`.** `45,XX,t(13;15)(q10;q10)` is
  the classic error: a `t` keeps both derivatives, so the count stays 46. Instead of bumping the
  stated count to 46 (which endorsed the wrong picture), the fix now corrects the operation to
  `rob(13;15)(q10;q10)` and explains the difference.

- **Make an invalid breakpoint fixable without leaving the page.** An unreal band holds back the whole
  drawing, so the message now carries how far the arm actually runs and the closest band that does
  exist: "Xp31 isn't a real band on chromosome X. Xp ends at Xp22.33." New `Karyo.armExtent` and
  `Karyo.nearestBand`.

## 2026-07-26 (remove em dashes from user-facing text and SEO tags)

- **Remove em dashes, per the house style.** Replaced the em dash in the homepage `og:title` and
  `twitter:title`, the per-page JSON-LD `headline` ("Name: 46,XX" not "Name — 46,XX"), and the
  user-facing decode and segregation-outcome text (`teach.js`, `segregation.js`) with colons or
  periods. The homepage meta description was already em-dash-free (fixed earlier); Google was showing
  a stale cached snippet.

## 2026-07-22 (feedback: drop the debug notice; align and tidy the result columns)

- **Remove the "Most-studied karyotypes" card.** It was a third way to pick a karyotype (after the
  named example chips under the input and the named "Common karyotypes" catalog), but showed bare
  ISCN strings with no condition names, so it was the redundant, least useful one. Removed the card,
  its loader, and the `/api/top` fetch; the draw analytics beacon is unchanged.

- **Polish the footer.** Replaced the single dense dot-separated link line with a two-part layout:
  the brand and a one-line descriptor on the left, the links (feedback, source, Ko-fi) grouped on
  the right, with real spacing and consistent styling. Wraps cleanly on mobile.

- **Flatten the sitebar background.** The page had three background tones (sitebar `#ffffff→#f7f8fb`
  gradient, hero white, gray results). The sitebar gradient was a redundant near-white third tone;
  it now uses the panel white, so the page reads as two clean zones.

- **Tour pill in the sans font.** "Take the guided tour" switched from the display font to the sans
  font, matching the STYLE/BANDS/SHOW controls beside it; the display font stays for headings.

- **Multi-column browse list.** "Common karyotypes" is now a responsive multi-column grid instead of
  one long single-column bulleted list, using the full width of the left column.

- **Remove the "Attached to help us debug…" line** from the feedback dialog. The karyotype and the
  link to the current view are still sent with every report (unchanged), so this only drops the
  redundant on-screen notice and its now-dead styles.

- **Align the two result columns.** The left column's first visible card sat 16px lower than the
  right one: the cards were spaced with `.card + .card { margin-top }`, so the visible card that
  follows the collapsed (display:none) guided-tour card still inherited a top margin, while the
  right column's first card did not. The columns now space their cards with flex `gap`, which
  ignores hidden cards, so both columns start at the same height.

- **Fill the left-column gap with the browse list.** For a simple karyotype the left column ran
  short while the right column's "how to read a chromosome" reference stayed tall, leaving a large
  empty space; the "Common karyotypes, explained" list sat full-width below it. On wide screens the
  browse list (and the meiotic-segregation card) now sit in a `col1-extra` grid item placed in the
  left column's second row, with the right column spanning both rows — so the list fills the gap
  instead of leaving a hole. Source order is unchanged (tool cards → decoded → browse), so the
  single-column mobile layout still shows the decoded panel before the browse list.

## 2026-07-19 (polish: print, spelling, tour UX)

- **Fix the doubled wordmark when printing.** The print stylesheet hid `header.top` and `main` but
  not `.sitebar`, so the site-header "KaryoDraw" printed alongside the print sheet's own wordmark.
  Print now hides `.sitebar` too, leaving a single wordmark.

- **American spelling throughout.** "Neighbours" → "Neighbors" (the Adjacent-2 segregation
  explanation, plus a comment), "Colours" → "Colors", "modelled" → "modeled".

- **Guided tour UX.** The tour no longer strands the viewer on a mismatched karyotype: choosing your
  own karyotype (an example chip, or Draw/Enter) now exits the tour so the panel never shows a
  different karyotype than the one on screen. The "Take the guided tour" button toggles (click again
  to close), and the "Exit tour" button is larger.

- **Trim the hero subhead** to just the one-line description (dropped "Free, no install.").

## 2026-07-19 (SEO: rank in Google Images + keyword-align headings)

- **Serve an indexable karyogram image on every karyotype page.** Each landing page rendered its
  karyogram as inline `<svg>` with no alt text, so the pages could not surface in Google Images for
  the highest-intent queries ("karyotype of / image of `<condition>`"). Pages now embed the karyogram
  as an `<img class="lp-karyo-img">` with descriptive alt (`Karyotype of <name> (<iscn>)`) and
  intrinsic `width`/`height`, falling back to the inline SVG when an image is missing.

- **Per-page social cards.** Every page shared one generic `og:image` (`preview.png`), so a shared
  link showed the wrong karyotype. Each page now sets its own `og:image`/`twitter:image` to a branded
  1200×630 `card.png` (with `og:image:width`/`height`).

- **New image tool `npm run images`.** `scripts/render-images.mjs` (headless Chrome via
  `puppeteer-core`, a dev-only dependency) rasterizes each karyogram to `karyogram.png` (3×) and a
  `card.png`, writing `content/karyogram-images.json`. It is a local step, not run in CI; re-run it
  after adding or changing a karyotype. `renderKaryogram` moved to `scripts/lib/render.mjs` so the
  build and the rasterizer share one renderer.

- **Keyword-aligned headings.** The homepage `<h1>` was the brand wordmark ("KaryoDraw", a term
  nobody searches); it is now "Karyotype diagram maker" (brand demoted to a `<span>`), and the
  `<title>` is front-loaded with the keyword. The hub page targets "karyotype examples".

- **Trim the homepage hero.** Brought the `<h1>` down a step (34px → 28px cap) so it reads as a
  confident label rather than a marketing shout on the tool-first page, and cut the redundant
  subhead clause ("A free karyotype generator that runs entirely in your browser") down to
  "Free, no install."

## 2026-07-18 (SEO: keep crawlers off the API)

- **Disallow `/api/` in robots.txt.** Googlebot was crawling the backend endpoints
  (`/api/collect`, `/api/feedback`, `/api/top`). Those are POST-only machine endpoints, so a
  crawler GET returns 405, which Search Console reports as "Blocked due to other 4xx issue." Adding
  `Disallow: /api/` tells crawlers to skip them, since they are endpoints, not pages. The frontend
  still calls them normally.

## 2026-07-16 (SEO: ship real favicon files)

- **Serve real icon files.** Google was not showing a site icon in search results because the
  favicon was a data-URI SVG, which it does not index. The site now ships real files at the root
  (`favicon.ico`, `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`) and links to them
  with a full icon block, so the KaryoDraw icon can appear next to the result.

- **Inject the full icon block on every landing page.** `scripts/build-pages.mjs` copied only the
  single `<link rel="icon">` line into generated pages. It now carries the whole block, both the
  icon links and the `apple-touch-icon` link, so all 32 karyotype pages, the hub, and the two
  static pages get the real icons.

- **Fix the standalone 404 and the deploy filter.** The `404.html` page is not generated by the
  build, so its data-URI icon was replaced by hand. The four icon files were also added to the
  deploy workflow paths filter so a change to them triggers a deploy.

## 2026-07-15 (segregation: add 4:0 and complete the 3:1 outcomes)

- **Enumerate every 3:1 gamete.** The 3:1 mode listed only the tertiary outcomes (an extra or
  missing derivative). It now also lists the interchange outcomes, where the extra or missing
  chromosome is a whole normal chromosome, so all four ways to split three-to-one appear: two
  interchange trisomies (conceptus `47,+2` / `47,+5` on the translocation background) and their two
  complementary monosomies (`45,-2` / `45,-5`). Each interchange product reads out as a whole
  chromosome trisomy or monosomy, so its viability follows that chromosome (lethal unless it is 13,
  18, or 21). The caption now names tertiary versus interchange instead of attributing the extra
  outcomes only to crossing-over.

- **Add 4:0 segregation.** A fifth mode covers the rarest split, where all four chromosomes travel
  to one pole and none to the other. It draws a to-scale cross with every chromosome pulled to a
  single pole (badge 4) and an empty pole (badge 0), then the two gametes: one disomic for the
  whole quadrivalent (conceptus 48, trisomy for both chromosomes) and one nullisomic (conceptus 44,
  monosomy for both). Both are lost very early. The schematic fallback and the pole-color keying of
  the disomic gamete match the to-scale figure.

- **Tests.** The segregation and pachytene suites now pin the eight 3:1 gametes, the two 4:0
  conceptions, the interchange whole-chromosome imbalance, and the 4:0 cross (four fibers to one
  pole, zero to the other, no fiber crossing the plane). Every emitted karyotype still re-parses
  with no warnings.

## 2026-07-15 (segregation: tune the pull distance and stagger the motion)

- **Say "constitutional" out loud.** The panel is already suppressed for recognized acquired
  (cancer) rearrangements, but the framing now states the assumption plainly: the lead calls the
  carrier constitutional and adds that meiotic segregation applies to a germline carrier, not to
  an acquired, somatic rearrangement. ISCN cannot distinguish the two, so the honest move is to
  name the assumption.

- **Set the pull distance and stagger the chromosomes.** Each chromosome now slides 0.30 of the
  way from its centromere to the pole (tuned by eye), straight along its fiber. Pure fraction, no
  cap: the pole sits inside the frame, so a fraction under one never overflows. To keep the four
  from moving as a single blob without letting them drift apart, they share one animation duration
  (so they begin the pull together and reach the pole together, every cycle, with no drift) but
  each follows a slightly different easing curve, so at mid-motion they sit at roughly 46, 48, 52,
  and 54 percent of their travel. The difference is deliberately subtle. Endpoints stay in sync;
  only the path between them varies.

## 2026-07-15 (segregation: slide each chromosome along its spindle fiber)

- **Fix a chromosome drifting off its fiber when pulled.** The "animate the pull to the poles"
  animation moves each chromosome by a capped vector. The cap was applied to the x and y parts
  separately, which bent the slide off the spindle fiber for a steep diagonal pull, so a
  chromosome (for example der(22) heading to the upper-right pole) visibly left its track. The
  cap now scales the whole vector, so every chromosome slides straight along its own fiber toward
  its pole. A new test asserts each pull vector stays parallel to a fiber.

## 2026-07-15 (segregation: keep the centromere on its arm during the animation)

- **Fix a centromere floating off its chromosome.** In the to-scale cross, a centromere whose
  breakpoint sits very close to it (a small offset) was drawn inside the synapsis gap or on the
  distal bar, off the vertical proximal arm. At rest this was easy to miss, but the "animate the
  pull to the poles" animation slid the chromosome away and left the bead floating. The bead now
  seats on the proximal shaft, clear of the gap and the distal bar. Worst cases were a
  centromere-adjacent break such as `t(11;22)(q23;q11)` (chromosome 22) and `t(4;8)(p13;q22)`
  (chromosome 4); a new test asserts every centromere bead sits on its shaft.

## 2026-07-14 (segregation: alternate poles on a diagonal)

- **Tilt the alternate spindle.** In the to-scale cross, alternate segregation now places its
  two poles on the same diagonal as 3:1 (upper-right and lower-left) instead of straight top and
  bottom, so the spindle fibers cross clearly through the center and the two diagonal cards line
  up. The two balanced pairs sit at opposite corners, so the diagonal reads truer to the caption.
  Only the pole positions changed; the segregation is the same.

## 2026-07-13 (segregation: draw the quadrivalent to the real breakpoints)

- **The figure now shows the actual shape of the rearrangement.** The segregation panel
  used to draw every reciprocal translocation as the same schematic square. A new module,
  `pachytene.js`, draws the true pachytene **cross** instead, with each of the four arms
  sized from the real hg38 band positions (`ideogram-data.js`) of the loaded karyotype, so
  a `t(11;22)(q23;q11.2)` comes out lopsided (chromosome 11 large, chromosome 22 small) and
  a `t(2;5)(q21;q31)` comes out nearly symmetric. A Robertsonian fusion has no cross, so it
  is drawn as the **trivalent** folded ninety degrees at its centromere, the fusion long
  arms lying beside the two normal acrocentrics.
- **One division plane, moved to a new position, names each mode.** Every mode draws the
  same shape with the plane where it cuts: alternate crosses its fibers with no straight
  plane, adjacent-1 cuts vertically, adjacent-2 horizontally, and 3:1 brackets the lone
  chromosome with a right-angled plane. A spindle fiber never crosses the plane it is
  sorted by; `test/pachytene.test.js` asserts this as a geometric invariant, along with the
  arm lengths, the pole counts, and that a different translocation makes a different cross.
- **Kept as a second system.** The schematic figures remain in `segregation.js` and are
  used as a fallback when the ideogram lacks a chromosome; nothing was deleted. The gamete
  cards, conceptus karyotypes, viability calls, captions, and the animation toggle are
  unchanged. The four cross units are still individual groups, so the pull animation slides
  each chromosome whole toward its pole.
- Reworded the 3:1 caption so it no longer says "the plate cuts three chromosomes"; it now
  reads that the quadrivalent splits three-to-one instead of two-and-two.

## 2026-07-13 (segregation: draw the ring and the plane it divides along)

- **Show why the modes are named alternate and adjacent.** The segregation panel used
  to list each mode with a small stack of chromosome glyphs and text. It now draws, for
  every mode, the ring of chromosomes and the anaphase-I division that produces it, so
  the naming is visible rather than asserted. The four bodies sit at the corners of a
  square that mirrors the pachytene ring; **alternate** takes the two **opposite**
  corners (its spindle fibers cross), while **adjacent-1** (a vertical division plane)
  and **adjacent-2** (a horizontal plane) each take two **neighbors**. **3:1** sends
  three chromosomes to one pole and one to the other. Each scene marks the two spindle
  poles, counts the chromosomes each receives (2:2, 3:1, 2:1), and draws the dashed
  division plane; a short caption states the reason for the name.
- **Two encodings, kept apart.** Chromosome color still means chromosome of origin, and
  the centromere dot now takes the color of the chromosome the centromere belongs to,
  so a chromosome and its own derivative (homologous centromeres) share a dot color and
  can be tracked. A separate teal/rose accent marks which pole a chromosome travels to;
  each gamete card carries the accent of the pole it leaves from, for the clean 2:2 and
  2:1 divisions. A reading key explains both.
- **Watch them separate.** An "Animate the pull to the poles" toggle slides each
  chromosome along its spindle fiber toward its pole and back, so anaphase I is
  something you watch rather than infer. It is CSS only and honours
  `prefers-reduced-motion`.
- The enumerated gametes, conceptus karyotypes, and viability calls are unchanged (still
  ISCN 2024, Table 5); only the drawing changed. `test/segregation.test.js` gained
  coverage for the scenes, the naming captions, the reading key, and the pole keying.

## 2026-07-13 (segregation: meiosis I framing + somatic caveat)

- **Say when the multivalent forms and separates.** The segregation panel now states
  that the chromosomes pair into the quadrivalent/trivalent as the homologs line up in
  **prophase I** (labeled on the pairing diagram as the pachytene configuration), and
  that the alternate / adjacent / 3:1 patterns are how it separates at **anaphase I**
  (meiosis I). Adjacent-2 is named as a meiosis I nondisjunction of the homologous
  centromeres.
- **Do not show segregation for an acquired (cancer) translocation.** Meiotic
  segregation is a germline event, so drawing it for a somatic tumour translocation is
  a category error. The panel is now suppressed when the drawn translocation is a
  recognized acquired change (the Philadelphia chromosome, and the t(8;21) / t(15;17) /
  t(8;14) / t(14;18) / t(11;14) / t(12;21) leukemia and lymphoma translocations); the
  clinical notes cover that context instead. `teach.js` flags those notes `acquired`,
  and mantle cell t(11;14) and childhood B-ALL t(12;21) gained clinical notes in the
  process. The constitutional carrier keeps the panel, now with no disclaimer text.

## 2026-07-12 (meiotic segregation of translocation carriers)

- **Draw the meiotic segregation of a balanced translocation carrier.** When you
  draw a balanced reciprocal or Robertsonian translocation, a new "Meiotic
  segregation" panel shows how the chromosomes separate at meiosis and what each
  gamete produces. A reciprocal carrier is drawn as a four-body **quadrivalent**
  with its alternate, adjacent-1, adjacent-2, and 3:1 modes; a Robertsonian carrier
  as a three-body **trivalent** with its 2:1 modes. Each mode lists its gametes and
  the resulting conception in ISCN, the partial or whole-chromosome imbalance in
  plain language, and whether it is balanced, unbalanced, or a recognized liveborn
  outcome (for example the translocation form of Down syndrome from a rob(14;21)
  carrier, or Emanuel syndrome from the 3:1 der(22) of a t(11;22) carrier). The
  enumerated segregants follow ISCN 2024, Table 5, and every conception the model
  writes re-parses cleanly. The panel states that it assumes a constitutional
  (inherited) carrier, since an acquired translocation in a tumour is somatic and is
  not transmitted. The chromosomes are colored by origin, the same convention the
  karyogram uses. New module `segregation.js`, covered by `test/segregation.test.js`.

## 2026-07-12 (affected view shows the missing sex chromosome)

- **The "Affected" view now shows the missing sex chromosome, like the full view.**
  For a monosomy (45,X, including a 45,X clone in a mosaic), the isolated view drew
  only the lone X while the full karyogram showed the "missing" placeholder. The
  two views now agree — the affected view shows the absent homolog too, aligned
  with the X.

## 2026-07-12 (tour view, spoken mosaics, missing-chromosome placeholder)

- **The guided tour keeps your view settings.** Style / Bands / Show no longer
  reset between tour steps, so switching to the Affected view (or any toggle)
  carries across the examples instead of snapping back to the default each step.
- **"Hear it" announces a mosaic and its cell counts.** A mosaic now reads
  "Mosaic. 45, X, in 12 cells. Next clone. 46, X X, in 18 cells" instead of
  dropping both the mosaic designation and the proportions.
- **The absent sex chromosome is no longer labeled "?".** For 45,X the placeholder
  still shows "missing," but without the "?" — the karyogram shows the karyotype,
  it does not speculate about whether an X or a Y was lost.

## 2026-07-12 (normalize whitespace in the drawn karyotype)

- **Trim stray spaces once drawn.** A karyotype typed or pasted with spaces (for
  example `46,XY,r(13)(p11q34) dn`) is now shown in its canonical, space-free form
  after Draw, so the extra space no longer lingers in the input box, the drawn
  heading, or the shareable link. The one meaningful space, after a `mos`/`chi`
  prefix, is kept.

## 2026-07-12 (support link)

- **Add a Ko-fi support link.** A quiet "♥ Support on Ko-fi" link in the footer
  site-wide, and a short "KaryoDraw is free and always will be; if it helped you,
  buy us a coffee" line on the About page. This is the only support ask — no
  banners or modals.

## 2026-07-12 (explain qualifiers + marker count in the decode)

- **Spell out the inheritance qualifiers.** `c` (constitutional), `mat` (maternal
  in origin), `pat` (paternal in origin), and `dn` (de novo) were parsed and shown
  in the code column but never explained. The decode now spells each out, e.g.
  `46,XX,del(7)(q22)mat` reads "…is lost (mat = maternal in origin: inherited from
  the mother)," and `…dn` now says "de novo: a new change, not inherited."
- **Decode a numbered marker with its count.** `+2mar` now reads "2 marker
  chromosomes," not "a marker chromosome." A single `+mar` is unchanged.

## 2026-07-12 (Turner label for variants)

- **Do not label a 46-count Turner variant "45,X."** A single-X complement with a
  structural variant — `46,X,i(X)(q10)`, `46,X,idic(Y)`, `46,X,r(X)` — was labeled
  "45,X, Turner syndrome" with a note claiming monosomy X and no second sex
  chromosome, which is wrong for those variants. The clinical note now reads
  "Turner syndrome (45,X and variants)" and describes the spectrum (monosomy X,
  isochromosome, ring, idic(Y), mosaicism). Mirrors the earlier Klinefelter fix.

## 2026-07-12 (declutter the homepage)

- **Move the FAQ to the guide; drop the duplicate About block.** The homepage
  bottom carried an "About KaryoDraw" section that duplicated the `/about/` page and
  a separate FAQ. The About block is gone (the `/about/` page is canonical), and the
  FAQ now lives on the "How to read a karyotype" guide, where those questions belong.
  Its FAQPage structured data is now generated statically from the guide's own
  content (more reliable for search than the previous JavaScript-built version). The
  homepage keeps the "Common karyotypes" links and is otherwise just the tool.

## 2026-07-12 (tolerate stray spaces)

- **Ignore spaces inside a designation.** ISCN is written without internal spaces,
  but copy-paste and typing add them. `46,XY,r(13)(p11q34) dn`, `46,XY,r(13) (p11q34)`,
  and `47, XX, +21` now parse identically to their no-space forms, so a de-novo
  (`dn`) or other inheritance qualifier written after a space is recognized instead
  of reported as "not understood." The one meaningful space, after a `mos`/`chi`
  prefix, is preserved.

## 2026-07-12 (sex-chromosome aneuploidy in the affected view)

- **Isolate the sex chromosomes for a numerical sex-chromosome abnormality.** A
  karyotype like `48,XXXX` (tetrasomy X), `45,X` (Turner), or `47,XXY`
  (Klinefelter) carries its abnormality in the sex field rather than as an
  aberration, so the "Affected" view wrongly said "nothing abnormal to isolate."
  It now flags the sex chromosomes, so the affected view isolates them and
  Highlight colors them. A euploid polyploid (e.g. `69,XXX`, `92,XXXX`) is
  correctly left unflagged, since its sex count matches its ploidy.

## 2026-07-11 (mobile layout)

- **Fix the phone layout.** The karyogram used to stretch the whole page wider than
  a phone screen, which clipped the karyogram itself (chromosomes ran off the right
  edge) and dragged the nav, example chips, and hint text off-screen with it. The
  content column now shrinks to the screen and the karyogram scales to fit, so the
  full karyotype is visible on a phone with no sideways scrolling. The Style / Bands
  / Show controls keep each label attached to its toggle when the row wraps, and
  long example chips wrap instead of clipping. The karyogram also refits on rotation
  and resize. Desktop is unchanged.

## 2026-07-11 (broader ISCN: numbered markers + inc)

- **Numbered and ranged marker chromosomes.** `+2mar` now draws two markers (and
  `+1~3mar`, including the hyphen form Mitelman uses, is accepted) instead of
  reading as an unknown token. `+mar` and labeled `+mar1` are unchanged.
- **The `inc` "incomplete karyotype" flag.** `...,inc` is recognized: it draws the
  stated changes and, because the karyotype is explicitly incomplete, the drawn
  count is not expected to match the modal number, so that mismatch is no longer
  warned about. Validated against 83,881 real karyotypes from the Mitelman
  database: zero crashes, and the share that parses with no warnings rose from
  ~70% to ~75%.

## 2026-07-11 (rate limiting)

- **Rate-limit the public write endpoints.** `/api/collect` and `/api/feedback`
  now enforce a per-IP cap via the Workers Rate Limiting binding, so a scripted
  flood can no longer inflate D1 writes, poison the "Most-studied" board, or spam
  the feedback inbox. `/api/collect` is generous (120/min) so a classroom behind
  one NAT IP is never blocked and silently drops over-limit beacons; `/api/feedback`
  is tight (20/min) and returns 429. The check no-ops if the binding is missing and
  never throws, so it cannot take an endpoint down.

## 2026-07-11 (audit follow-ups: a11y, backend, content)

- **Accessibility.** The karyogram no longer nests two `role="img"` layers (screen
  readers announced it twice or dropped the label); the container is now a labeled
  group described by the decode panel. Added a visible label on the karyotype
  input and a `prefers-reduced-motion` block that strips transitions and
  animations for users who need it.
- **Feedback digest drains in batches.** A backlog (or a spam burst) can no longer
  leave genuine feedback undigested for days: the daily email now sends in batches
  of 200 until the queue is clear, bounded per run. Added a partial index on
  unsent feedback so the query stays off the full table as it grows.
- **Privacy.** Stopped storing the user-agent on feedback submissions (it was
  written but never shown), and aligned the privacy comments with what is actually
  stored.
- **Clinical notes.** Gene symbols are now italicized and gene fusions use the
  current ISCN double-colon form (BCR::ABL1, PML::RARA, RUNX1::RUNX1T1) across the
  clinical card, the print sheet, and the landing pages. The Klinefelter label no
  longer reads "47,XXY" for a 48,XXXY karyotype.

## 2026-07-11 (crash hardening)

- **Never let a typed karyotype freeze the browser.** Three inputs could crash or
  hang the tab instead of drawing a warning: an unbounded copy multiplier
  (`+21×100000000`), an absurd modal number read as a huge ploidy (`46000000,XY`),
  and a large `dmin` count. Each allocated one object per copy. Copy counts are now
  capped at 50 (with a warning) and ploidy is capped at octaploid, so these render
  instantly with a clear message.
- **Empty or comma-only input no longer throws.** A field-less clone (for example
  `,`) now returns the full model shape, so the invalid-state message shows instead
  of a `TypeError` from the downstream renderer.
- **A first-clone `idem` with no stemline no longer doubles its own aberrations.**
  `47,XX,idem,+8` used to resolve `idem` to itself and apply `+8` twice; it now
  flags the missing stemline and counts the change once.
- **Copy-link fallback is non-blocking.** When the async clipboard API is
  unavailable (older browsers, non-secure contexts, or a permission rejection), the
  link now copies via a hidden field or shows a "press Cmd/Ctrl+C" hint, instead of
  a blocking `prompt()` dialog.

## 2026-07-11 (evening)

- **Draw a real centromere on whole-arm and mirror derivatives.** A Robertsonian
  `der` and an isochromosome meet their arms at the seam; that seam now renders an
  actual centromere constriction (a hatched band + the p/q line), so you can see
  where the centromere is instead of reading an unlabeled fusion line.
- **Line every affected chromosome's centromere up on one horizontal line.** In
  the "affected only" view, each chromosome is offset so all centromeres (and a
  Robertsonian's fusion seam) sit on a shared line, with the labels on a common
  baseline below — the classic karyogram look, where the acrocentrics hang from
  the line and the metacentric Robertsonian sits centered on it. The full
  karyogram view is unchanged (it still bottom-aligns so the number row lines up).

## 2026-07-11 (latest)

- **Centromere-align isochromosomes and whole-arm derivatives on their fusion
  seam.** These derivatives meet their two arms at the seam between their
  segments, where the centromere(s) sit, but the renderer reported no centromere
  y for them — so their cells bottom-aligned instead of centromere-aligning. The
  renderer now reports that seam as the centromere y, so an `i(X)(q10)` lines up
  its centromere with the normal X's centromere (p+q next to q+q), and a
  Robertsonian `der` lines up on its fusion seam — the same centromere-alignment
  every other cell uses. This supersedes the earlier bottom-align fallback for
  these specific cases; cells that still have no centromere on any copy keep the
  fallback.

## 2026-07-11 (later)

- **Accept the standard `idem` subclone form that omits the repeated sex field.**
  `46,XY,t(9;22)(q34;q11.2)[15]/47,idem,+8[5]` is the usual way to write clonal
  evolution — `idem` sits in the sex-field position and stands in for the whole
  stemline, sex included. The parser used to demand an X/Y there ("idem has no X
  or Y") and drop the inheritance, leaving the subclone miscounted. It now reads
  `idem` / `sl` / `sdl` in that position and inherits the stemline's sex.
- **Coach a bare chromosome number toward a sign.** A lone `8` in the aberration
  field now suggests "+8 for a gain or −8 for a loss" instead of the generic
  "couldn't read" message.

## 2026-07-11

- **Fix chromosome alignment inside a cell when a copy has no centromere line.**
  A homolog is normally centromere-aligned against its derivative. A whole-arm /
  Robertsonian derivative (and an isochromosome) has its centromere at a segment
  edge, so no centromere y is reported; the cell used to silently fall back to
  top-alignment, floating the short normal homolog high while its neighbor sat on
  the row baseline. It now bottom-aligns those cells to the same baseline the row
  uses (`align-items: flex-end`), so the normal homolog, the derivative, and the
  neighboring chromosomes all line up. Deletions/duplications (both copies have a
  centromere) still centromere-align as before.

## 2026-07-10 (later)

Complete the ISCN karyotype system — the last shorthand that was previously out
of scope now parses, draws, and decodes:

- **Clonal evolution `idem` / `sl` / `sdl`.** A subclone written with `idem`
  (or `sl`) now inherits every aberration of the stemline (the first clone), and
  `sdl` inherits the preceding sideline. `46,XX,t(8;21)(q22;q22)/47,XX,idem,+8`
  draws and counts correctly (47) instead of silently dropping the shared
  `t(8;21)` from the second clone.
- **Range modal numbers.** `47~49,XY,+8,+21` accepts any count inside the range
  without flagging a mismatch; the decode explains the range.
- **Copy-number multiplier `×N` / `xN`.** `+8×2` adds two copies; the decode reads
  "2 extra copies of chromosome 8".
- **Amplification `hsr` and `dmin`.** A homogeneously staining region draws as a
  vivid amplified block on the chromosome; double minutes draw as small
  extrachromosomal fragments and, being acentric, are not counted in the modal
  number.
- **Geometry audit.** Re-checked isochromosomes, whole-arm and reciprocal
  translocations, rings, dicentrics, and inversions against the expected arms; all
  land correctly (the whole-arm fix from earlier covered the one real error).

## 2026-07-10

- **Fix the whole-arm / Robertsonian derivative geometry.** A whole-arm fusion
  (`rob(13;14)(q10;q10)`, `der(13;14)(q10;q10)`, `dic(…)(q10;q10)`) was routed
  through the reciprocal-translocation path, which grafted the donor's *short*
  arm onto the derivative (`der(13)` came out as 14p + 13q). It now joins the two
  arms named by the breakpoints — the two long arms, 13q + 14q, with both short
  arms lost, as a Robertsonian actually looks.

## 2026-07-09

- **Recognize `rob`, the preferred ISCN spelling of a Robertsonian
  translocation.** `45,XX,rob(13;14)(q10;q10)` and `46,XX,rob(14;21)(q10;q10),+21`
  (translocation Down syndrome) now draw the whole-arm fusion and count correctly,
  exactly like the equivalent `der(13;14)(q10;q10)`.
- **Accept constitutional and inheritance qualifiers** (`c`, `mat`, `pat`, `dn`).
  They are stripped and remembered instead of breaking the aberration they trail,
  so `47,XY,+21c` stays a trisomy and `del(22)(q11.2)mat` still draws the deletion.
- **Draw insertions faithfully.** An `ins` used to render as an untouched normal
  chromosome; now an interchromosomal `ins(5;2)(p14;q22q32)` lengthens the
  recipient with the donor segment spliced in and shortens the donor, and an
  intrachromosomal `ins(2)(p13q21q31)` shows the length-preserving internal move.
- **Draw dicentrics and isodicentrics correctly.** A two-chromosome
  `dic(13;14)(q13;q22)` now fuses into a single body with two centromeres and
  counts 45 (was drawn as a reciprocal translocation and miscounted); an
  `idic(X)(q13)` renders as a mirror image about its breakpoint.
- **Apply the extra operations in a `der()` chain.** `der(9)del(9)(p12)t(9;22)`
  now shows the `del(9)(p12)` trim as well as the translocation, instead of
  silently dropping the deletion.
- **Decode the whole `der()` chain in plain English.** The token-by-token
  explanation now names the extra `del`/`dup`/`inv` on a derivative, not just the
  translocation, so the words match the drawing (for example, `der(9)del(9)(p12)
  t(9;22)` reads "…with the end of chromosome 22's long arm attached. It also
  carries a terminal deletion at 9p12.").

## 2026-07-07

- Draw duplications faithfully: a `dup` now lengthens the chromosome and splices
  the duplicated segment in tandem, instead of only shading it on a normal-length
  chromosome. The breakpoint order sets the orientation, so a direct duplication
  (`dup(1)(q22q25)`) shows the copy in the same orientation and an inverted one
  (`dup(1)(q25q22)`) mirrors it end-for-end. A triplication (`trp`) adds two
  copies. The decode now names an inverted duplication as such.

## 2026-07-06

- Consolidate the page footer into the About section: fold the ISCN citation,
  band-data source, and StudyRare attribution ("developed and maintained by
  StudyRare") into About in plain language, link ISCN to its DOI there, and trim
  the footer to a single line.
- Email a daily digest of new feedback via a scheduled cron (Resend). It is
  inert until the sending settings are configured, and marks feedback as sent
  only after the email is accepted, so nothing is dropped on a failure.
- **Parser:** recognize Robertsonian and whole-arm derivatives, isodicentrics,
  insertions, and triploid or tetraploid ploidy when reconciling the chromosome
  count against the modal number.
- **Parser:** warn when an `or` alternative or other trailing text is not
  understood, instead of silently dropping it.
- Speak the breakpoints for ring and duplication karyotypes.
- Paper: expanded use cases and a new Scope and limitations section.
- **Accessibility:** make the example karyotypes keyboard-operable buttons, add a
  visible focus outline to every control, label the karyogram and band map for
  screen readers, group the view controls with `aria-pressed` state, and announce
  drawing and parse results through polite live regions.
- Add a "Report a problem" link on the site, plus GitHub issue and pull-request
  templates that ask for the karyotype and a shareable link.
- Serve a branded 404 page for unknown page addresses.
- Fit polyploid karyotypes (for example `92,XXXX`) inside the card instead of
  letting the wide karyogram spill over the sidebar.
- Add an on-site "Send feedback" form so anyone, with no account, can report a
  problem or an unexpected drawing. It attaches the current karyotype and a link
  to the exact view automatically, and posts to a new `/api/feedback` endpoint
  that stores the message privately (and can ping a chat webhook if configured).
- Add a "Most-studied karyotypes" panel: an aggregate, anonymous list of the
  most-drawn karyotypes, shown as clickable chips. A karyotype appears only after
  many draws across several distinct days, so single-session repeats cannot
  inflate or spam the list; the panel shows rank order only, with no counts, and
  is served from a daily-cached read endpoint. The auto-loaded demo no longer
  counts toward usage.

## 2026-07-05

- Draw ring chromosomes as an actual ring: the retained material wraps into an
  annulus sized by circumference, with the centromere and the fusion point marked.
- Reject a designation whose breakpoint band does not exist on its chromosome
  (for example `r(12)(p13q32)`) with an explanation, instead of drawing a
  misleading fallback.
- Add cookieless, no-PII usage analytics (Cloudflare Worker plus D1).
- Auto-deploy to Cloudflare on push to `main`; auto-sync brand colors from the
  canonical `studyrare-brand` kit.
- SEO: meta description, Open Graph and Twitter cards, structured data,
  `robots.txt`, `sitemap.xml`, and an on-page About section.
- Cite ISCN 2024; link the GitHub repository and StudyRare; open links in a new tab.
- Align same-length rearrangements (inversions) flush at both ends, and mirror the
  hatch direction inside inverted segments.
- Remove the redundant "+1" gain badge and the duplicate copy-link button.

## 2026-07-04

- Open-source the tool under the MIT license.
- Add the JOSE application-note draft and a dependency-free ISCN parser test suite.

## 2026-07-03

- Model n-way (three-way and larger) translocations in the render, decode, and
  outline.
- Shareable deep-link URLs, image copy and download, and a one-page printable
  summary.
- Rename KaryoScope to KaryoDraw; host on Cloudflare.

## 2026-07-01 to 2026-07-02

- Initial teaching-first karyogram tool: highlight and realistic views, a
  band-resolution control (~400, ~550, ~850), hatched heterochromatin, distinct
  breakpoint markers, audio pronunciation, coaching error messages, the StudyRare
  brand kit, and the Affected or All view toggle.
