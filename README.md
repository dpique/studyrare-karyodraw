# KaryoDraw

A modern, **teaching-first** karyogram tool, following **ISCN 2024** (the current
International System for Human Cytogenomic Nomenclature). Type an ISCN karyotype
(`46,XY`, `47,XX,+21`, `46,XY,t(9;22)(q34;q11.2)`, …) and KaryoDraw:

1. **draws** the banded chromosome ideograms — arranged as a real karyogram,
   with derivative chromosomes reshaped for structural rearrangements, and
2. **explains** it — a plain-English, token-by-token decode of the karyotype, a
   hover-to-learn band map, an "anatomy of a chromosome" reference, curated
   clinical notes for board-relevant findings, a 🔊 **"hear it pronounced"**
   button (free, offline, via the browser's Web Speech API), and a **printable
   1-page summary** (plain-language explanation + clinical details, affected-only
   picture) for a genetic counselor.

For a balanced translocation carrier it also draws the **meiotic segregation**: the
quadrivalent (reciprocal) or trivalent (Robertsonian) and every alternate / adjacent /
3:1 outcome, each with the resulting conception, its imbalance, and whether it is
balanced — the ISCN 2024 Table 5 picture, generated for any carrier you type.

Built as a spiritual successor to the old CyDAS *WebExample4* static-image
generator — but with a clean palette and an actual teaching layer. See
[`docs/CYDAS.md`](docs/CYDAS.md) for the lineage and which CyDAS conventions we
follow (fixed rows, count-fix, replace-vs-add).

## Run it

**Locally** — serve over HTTP and open the served URL:

```
./start.sh
```

This starts a tiny local web server and opens the app. (Don't open `index.html`
as a `file://` URL — browsers block the `<script src>` module files. It must be
*served*.) The interactive tool runs entirely in the browser. Stop the server
with `lsof -ti tcp:8770 | xargs kill`.

**Hosted** — served at **[karyodraw.com](https://karyodraw.com)** by a small
Cloudflare Worker (`worker.js`). The Worker serves the otherwise-static site and a
few tiny API endpoints — anonymous usage analytics, the "Most-studied" list,
feedback flagging, and per-IP rate limiting — backed by a D1 database. See
[`docs/SEO_AND_FEEDBACK.md`](docs/SEO_AND_FEEDBACK.md) for the backend details.
Pushing a served file to `main` auto-deploys via
`.github/workflows/deploy.yml` (needs the `CLOUDFLARE_API_TOKEN` repo secret).
Deploys go through CI only — do not run `wrangler deploy` by hand.

**Share / deep-link** — the current karyotype is stored in the URL, e.g.
`index.html?k=47,XX,%2B21`, so any view is a shareable/bookmarkable link. (This
also powers the screenshot tests.)

## Tests

The ISCN parser is covered by a small, dependency-free test suite (Node's built-in
runner — nothing to install):

```
npm test        # or:  node --test test/*.test.js
```

It asserts that canonical designations — normal constitutions, aneuploidy,
reciprocal and three-way translocations, terminal deletions, isochromosomes,
inversions, and mosaics — parse into the expected model.

## What it understands (ISCN)

KaryoDraw follows **ISCN 2024**, the current *International System for Human
Cytogenomic Nomenclature* (Cytogenet Genome Res 2024;164 suppl 1,
[DOI 10.1159/000538512](https://doi.org/10.1159/000538512)). The abbreviations
and band syntax it reads are those defined there; band coordinates come from the
current hg38 genome build. **Scope:** the constitutional and neoplastic
*karyotype* (chromosome-level) system. The microarray (`arr`), sequence-based,
and region-specific-assay chapters of ISCN are out of scope by design.

- **Normal & sex constitutions:** `46,XX`, `46,XY`, `45,X`, `47,XXY`, `47,XYY`, `47,XXX`, …
- **Aneuploidy:** gains/losses — `+21`, `+18`, `+13`, `-7`, …
- **Structural:** `del`, `dup`, `inv`, `t` (reciprocal **and n-way** translocations
  → all derivatives drawn), `i` (isochromosome), `r` (ring), `der` (including
  `del`/`dup`/`inv` sub-operations in the chain), `add`, `dic` (fused two-body
  dicentric) and `idic` (mirror-image isodicentric), `ins` (inter- and
  intrachromosomal, recipient grown and donor shortened), `rob` (Robertsonian,
  same as the whole-arm `der`), `fra`, `mar`, `trp`.
- **Amplification:** `hsr` (homogeneously staining region, drawn as an amplified
  block on the chromosome) and `dmin` (double minutes, drawn as small
  extrachromosomal fragments and — being acentric — not counted).
- **Copy number & qualifiers:** the `×N` multiplier (`+8×2` = two extra copies),
  and the constitutional / inheritance suffixes `c`, `mat`, `pat`, `dn` (recognized
  and remembered, they do not break the aberration they trail).
- **Cancer shorthand:** range modal numbers (`47~49`, satisfied by any count in
  range) and clonal-evolution references `idem` / `sl` (same as the stemline) and
  `sdl` (same as the sideline), expanded to the referenced clone's aberrations.
- **Mosaicism / composite:** `mos 45,X[12]/46,XX[18]`, `[cp20]`, multiple clones
  with cell counts and percentages.

The parser is deliberately forgiving and tries to *coach*: for common typos it
offers a clickable **"Did you mean …?"** fix (missing comma after the count,
comma-instead-of-semicolon inside parentheses), points to the specific problem
(unbalanced parentheses, a non-existent chromosome, a missing sex field) instead
of dumping raw errors, and cross-checks the modal number against the aberrations.
Structurally-broken input shows a friendly empty state; a valid-but-miscounted
karyotype still draws, with the mismatch flagged.

## Files

- `index.html` — the whole UI (HTML/CSS/JS inline) that wires the modules below.
- `ideogram-data.js` — chromosome band data (**generated**; see `_build_inputs/`).
- `iscn-parser.js` — ISCN string → structured, render-ready model.
- `karyo-render.js` — SVG ideograms + derivative-chromosome geometry.
- `teach.js` — plain-English decode, band nomenclature, Giemsa stain biology,
  curated syndrome/clinical notes.
- `segregation.js` — meiotic segregation of a balanced translocation carrier: the
  quadrivalent/trivalent model, the gametes and conceptions per segregation mode
  (ISCN 2024, Table 5), and the schematic SVG. Pure logic; covered by `test/`.
- `worker.js` — the Cloudflare Worker: serves the site and the `/api/*` endpoints
  (analytics, most-studied, feedback, rate limiting); `schema.sql` + `migrations/`
  define the D1 tables.
- `content/karyotypes.js` — the single source of truth for the curated karyotypes
  and the guided tour; `scripts/build-pages.mjs` generates the SEO landing pages
  and sitemap from it (`npm run build`, run in CI before every deploy).
- `start.sh` — local server launcher.
- `_build_inputs/` — band-data source + build script (see `_build_inputs/SOURCES.md`).
- `docs/` — backend/SEO notes (`SEO_AND_FEEDBACK.md`) and the CyDAS lineage
  (`CYDAS.md`).

## Regenerate the band data

```bash
cd _build_inputs
curl -sSL "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBandIdeo.txt.gz" -o cytoBandIdeo.hg38.txt.gz
gunzip -kf cytoBandIdeo.hg38.txt.gz
python3 build_ideogram.py       # writes ../ideogram-data.js
```

## Rendering conventions

- **Palette & type** — Schibsted Grotesk / Nunito Sans / IBM Plex Mono; amber is
  the single call-to-action accent, periwinkle is structural, navy is ink. Affected
  chromosomes lead periwinkle → amber, the "signal in the noise" idea. The color
  variables between the `brand-colors` markers in the `:root` block of `index.html`
  are **generated** by `scripts/sync-brand.mjs` — do not edit them by hand.
- **Karyogram layout**: fixed **Denver-group rows** (1–3 / 4–5 / 6–12 / 13–15 /
  16–18 / 19–20 / 21–22), one per line (not width-wrapped); sex chromosomes get
  their own row at the end. Within a pair, the **normal homolog is on the left,
  the abnormal/derivative on the right**.
- **Two styles** (toggle): *Highlight* draws every chromosome in quiet neutral gray
  and colors **only the chromosomes involved in the abnormality** (keyed by
  chromosome identity; translocation/derivative pieces take their origin
  chromosome's color, so the event pops). *Realistic* is true-to-life Giemsa
  banding on every chromosome, with nothing highlighted (spot the change yourself).
- **Show** (toggle): *All* draws the full karyogram; *Affected* isolates just the
  chromosomes involved in the abnormality (each with its normal homolog) into one
  focused row — CyDAS's `AlteredChromosomesOnly`. For `t(9;22)` that's 9, der(9),
  22, der(22) instead of all 46.
- **Band resolution** (toggle): High ~850 / Std ~550 / Low ~400. Lower levels
  merge sub-bands into their parent band (span-weighted stain) — fewer, wider,
  easier-to-read bands. Breakpoints still resolve against full-resolution data.
- **Heterochromatin is hatched**, following the ISCN ideogram convention: the
  **centromere**, **variable regions** (e.g. 1qh/9qh/16qh, Yq), and **acrocentric
  stalks** render as a diagonal-hatch *texture* rather than a solid band — so they
  can't be mistaken for breakpoint markers. The centromere uses a tight forward
  hatch (///); variable regions and stalks use a sparser, opposite hatch (\\\) so
  the two are never confused.
- **Hover** any band for a crisp amber outline box + a tooltip and a live band decode.
- **Breakpoints** (del/inv/etc.) render as solid lines with inward carets; a
  **translocation fusion junction** is a dashed line. Three visually distinct
  cues (hatched centromere ≠ caret breakpoint ≠ dashed junction).

## Known simplifications (v1)

- Inversions **physically reverse** the inverted segment's banding (drawn as
  three pieces, the middle one flipped), with breakpoint carets; for a pericentric
  inversion the centromere moves with the flipped segment.
- Deletions draw the **shortened** chromosome (retained material only), with a red
  mark at the break — so a `del` looks shorter than its normal homolog, exactly as
  it would on a karyogram (terminal deletions keep the centromere side;
  interstitial deletions remove the middle and re-join). Duplications currently
  highlight the affected segment on the full ideogram.
- Complex `der()` chains beyond a single embedded `t(...)` fall back to drawing
  the base chromosome plus the plain-English decode.
- Band-name → position uses hg38 cytoband resolution (~850-band-ish); lower-res
  breakpoints (e.g. `q34`) resolve to the span of their sub-bands.

KaryoDraw is an **educational** visualizer for cytogenetic nomenclature — not a
diagnostic tool.
