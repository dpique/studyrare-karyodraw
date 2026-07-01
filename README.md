# KaryoScope

A modern, **teaching-first** karyogram tool. Type an ISCN karyotype
(`46,XY`, `47,XX,+21`, `46,XY,t(9;22)(q34;q11.2)`, …) and KaryoScope:

1. **draws** the banded chromosome ideograms — arranged as a real karyogram,
   with derivative chromosomes reshaped for structural rearrangements, and
2. **explains** it — a plain-English, token-by-token decode of the karyotype, a
   hover-to-learn band map, an "anatomy of a chromosome" reference, and curated
   clinical notes for board-relevant findings.

Built as a spiritual successor to the old CyDAS *WebExample4* static-image
generator — but with a clean palette and an actual teaching layer.

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

The parser is deliberately forgiving: anything it can't fully interpret produces
a *warning* (not a crash) and still draws what it can. It also cross-checks the
stated modal number against the aberrations and flags mismatches.

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

- **StudyRare brand** — colours, type (Schibsted Grotesk / Nunito Sans / IBM Plex
  Mono) and the dot-motif follow `../brand/tokens.json` (v3). Amber is the single
  CTA accent; periwinkle is structural (never a button); navy is ink; sage =
  success. Affected chromosomes lead periwinkle → amber, echoing the "signal in
  the noise" motif.
- **Two styles** (toggle): *Simple* draws every chromosome in a quiet neutral grey
  and colours **only the chromosomes involved in a rearrangement** (keyed by
  chromosome identity; translocation/derivative pieces are coloured by their
  origin chromosome, so the event pops). *Detailed* is realistic Giemsa banding.
- **Band resolution** (toggle): High ~850 / Std ~550 / Low ~400. Lower levels
  merge sub-bands into their parent band (span-weighted stain) — fewer, wider,
  easier-to-read bands. Breakpoints still resolve against full-resolution data.
- **Heterochromatin is hatched**, following the ISCN ideogram convention: the
  **centromere**, **variable regions** (e.g. 1qh/9qh/16qh, Yq), and **acrocentric
  stalks** render as a diagonal-hatch *texture* rather than a solid band — so they
  can't be mistaken for breakpoint markers.
- **Breakpoints** (del/inv/etc.) render as solid lines with inward carets; a
  **translocation fusion junction** is a dashed line. Three visually distinct
  cues (hatched centromere ≠ caret breakpoint ≠ dashed junction).

## Known simplifications (v1)

- Inversions **physically reverse** the inverted segment's banding (drawn as
  three pieces, the middle one flipped), with breakpoint carets; for a pericentric
  inversion the centromere moves with the flipped segment. Deletions/duplications
  highlight the affected segment on the full ideogram so the breakpoint stays visible.
- Complex `der()` chains beyond a single embedded `t(...)` fall back to drawing
  the base chromosome plus the plain-English decode.
- Band-name → position uses hg38 cytoband resolution (~850-band-ish); lower-res
  breakpoints (e.g. `q34`) resolve to the span of their sub-bands.

KaryoScope is an **educational** visualizer for cytogenetic nomenclature — not a
diagnostic tool.
