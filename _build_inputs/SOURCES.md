# Data sources & regeneration

## Chromosome band data → `../ideogram-data.js`

- **Source:** UCSC Genome Browser, human build **hg38**, table `cytoBandIdeo`.
  <https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBandIdeo.txt.gz>
- Columns (TSV): `chrom  chromStart  chromEnd  name(band)  gieStain`
- 24 chromosomes (1–22, X, Y), 862 bands. Positions are in base pairs.
- `gieStain` values map to the Giemsa band classes used by the renderer:
  `gneg, gpos25, gpos50, gpos75, gpos100, gvar, stalk, acen`.

### Rebuild

```bash
cd _build_inputs
curl -sSL "https://hgdownload.soe.ucsc.edu/goldenPath/hg38/database/cytoBandIdeo.txt.gz" -o cytoBandIdeo.hg38.txt.gz
gunzip -kf cytoBandIdeo.hg38.txt.gz
python3 build_ideogram.py        # writes ../ideogram-data.js
```

To switch builds, change the URL (e.g. `hg19`) and re-run. The band-name → base-pair
resolution in `karyo-render.js` works against whatever build is loaded.

## Everything else

`iscn-parser.js`, `karyo-render.js`, `teach.js`, `index.html` are hand-written and
have no generated inputs. The clinical/syndrome notes in `teach.js` are curated for
teaching (ABGC / ABMGG board level) and are intentionally concise.
