# Changelog

Notable changes to KaryoDraw. The site is continuously deployed (every change to
`main` goes live), so entries are grouped by date rather than by version.

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
