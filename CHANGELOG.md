# Changelog

Notable changes to KaryoDraw. The site is continuously deployed (every change to
`main` goes live), so entries are grouped by date rather than by version.

## 2026-07-06

- **Parser:** recognize Robertsonian and whole-arm derivatives, isodicentrics,
  insertions, and triploid or tetraploid ploidy when reconciling the chromosome
  count against the modal number.
- **Parser:** warn when an `or` alternative or other trailing text is not
  understood, instead of silently dropping it.
- Speak the breakpoints for ring and duplication karyotypes.
- Paper: expanded use cases and a new Scope and limitations section.

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
