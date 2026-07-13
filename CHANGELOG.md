# Changelog

Notable changes to KaryoDraw. The site is continuously deployed (every change to
`main` goes live), so entries are grouped by date rather than by version.

## 2026-07-13 (segregation: meiosis I framing + somatic caveat)

- **Say when the multivalent forms and separates.** The segregation panel now states
  that the chromosomes pair into the quadrivalent/trivalent as the homologs line up in
  **prophase I** (labelled on the pairing diagram as the pachytene configuration), and
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
