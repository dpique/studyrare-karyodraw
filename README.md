# KaryoScope

A modern, **teaching-first** karyogram tool. Type an ISCN karyotype
(`46,XY`, `47,XX,+21`, `46,XY,t(9;22)(q34;q11.2)`, …) and KaryoScope:

1. **draws** the banded chromosome ideograms — arranged as a real karyogram,
   with derivative chromosomes reshaped for structural rearrangements, and
2. **explains** it — a plain-English, token-by-token decode of the karyotype, a
   hover-to-learn band map, an "anatomy of a chromosome" reference, curated
   clinical notes for board-relevant findings, a 🔊 **"hear it pronounced"**
   button (free, offline, via the browser's Web Speech API), and a **printable
   1-page summary** (plain-language explanation + clinical details, affected-only
   picture) for a genetic counselor.

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
*served*.) Everything runs in the browser; there is no backend. Stop the server
with `lsof -ti tcp:8770 | xargs kill`.

**Hosted** — it's fully static, so push this repo and enable **GitHub Pages**
(or drop the files on any static host / embed into the studyrare Next.js site).

**Share / deep-link** — the current karyotype is stored in the URL, e.g.
`index.html?k=47,XX,%2B21`, so any view is a shareable/bookmarkable link. (This
also powers the screenshot tests.)

## What it understands (ISCN)

- **Normal & sex constitutions:** `46,XX`, `46,XY`, `45,X`, `47,XXY`, `47,XYY`, `47,XXX`, …
- **Aneuploidy:** gains/losses — `+21`, `+18`, `+13`, `-7`, …
- **Structural:** `del`, `dup`, `inv`, `t` (reciprocal translocation → both
  derivatives drawn), `i` (isochromosome), `r` (ring), `der`, `add`, `dic`,
  `ins`, `fra`, `mar`, `trp`.
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
- `start.sh` — local server launcher.
- `_build_inputs/` — band-data source + build script (see `_build_inputs/SOURCES.md`).

## Regenerate the band data

```bash
cd _build_inputs
curl -sSL "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBandIdeo.txt.gz" -o cytoBandIdeo.hg38.txt.gz
gunzip -kf cytoBandIdeo.hg38.txt.gz
python3 build_ideogram.py       # writes ../ideogram-data.js
```

## Rendering conventions

- **StudyRare brand** — colors, type (Schibsted Grotesk / Nunito Sans / IBM Plex
  Mono) and the dot-motif follow `../brand/tokens.json` (v3). Amber is the single
  CTA accent; periwinkle is structural (never a button); navy is ink; sage =
  success. Affected chromosomes lead periwinkle → amber, echoing the "signal in
  the noise" motif.
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

KaryoScope is an **educational** visualizer for cytogenetic nomenclature — not a
diagnostic tool.
