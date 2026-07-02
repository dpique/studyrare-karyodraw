# Lineage & conventions — CyDAS

KaryoDraw is a modern re-imagining of the karyogram drawing in **CyDAS**
(the Cytogenetic Data Analysis System, `cydas.org`; ISCNAnalyser), which is
copyrighted but free under the GPL. CyDAS is now effectively defunct/offline;
this file records the conventions we borrowed from its documentation so the
provenance and design choices are captured in the repo (not just in someone's
head).

## What CyDAS's `Karyogram` class does (and how we map to it)

From the CyDAS `Class Karyogram` docs, `getKaryogramAsMap(Resolution, Scale,
DrawSequence, Colored, BackGroundColor, AlteredChromosomesOnly)` draws all the
normal and altered chromosomes of a karyotype. The parameters line up with our
controls almost one-to-one:

| CyDAS parameter | KaryoDraw equivalent |
|---|---|
| `Resolution` (`eResolutionLevel`) | **Bands** toggle — Low ~400 / Std ~550 / High ~850 |
| `Colored` (bool) | **Style** toggle — *Highlight* vs *Realistic* |
| `DrawSequence` — comma list of chromosome numbers; `"BR"` = line break; `"?"` = unknown-centromere chromosome | our **fixed Denver-group rows** (we hard-code the row breaks rather than take a draw string); `?`/marker chromosomes trail the sex row |
| `AlteredChromosomesOnly` (bool) | **not yet built** — a "show only the affected chromosomes" view. Worth adding. |
| `optimizeISCN()` — "Corrects the chromosome count field and the sex chromosomes field" | our **count reconciliation + "Did you mean \<corrected count\>?"** fix |

### Notes worth keeping

- **Explicit line breaks.** CyDAS controls rows with a `BR` token in the draw
  sequence (its default sequence even placed X mid-row and broke after 11). This
  validates using *fixed* rows instead of letting the browser wrap by width —
  which was a bug we fixed. We use the standard Denver rows (1–3 / 4–5 / 6–12 /
  13–15 / 16–18 / 19–20 / 21–22) with sex chromosomes on their own row.
- **`optimizeISCN()`** is the same idea as our count fix: an ISCN string can
  state a modal number and sex field that don't match the listed chromosomes;
  the count/sex can be *recomputed* from the actual chromosome set. We offer the
  recomputed count as a "Did you mean …?" suggestion rather than silently editing.
- **Replacing vs adding chromosomes.** CyDAS's `calculateChromosomes()` marks a
  derivative's `ReplacingStatus`: a structural aberration either *adds* a
  chromosome or *replaces* one (or more, for multicentric derivatives) normal
  homolog(s). This is exactly the distinction our parser makes when it converts a
  normal homolog into a derivative vs. adds an extra copy — and the subtlety
  behind the `i(X)(q10)` "the isochromosome is additional to the single X" case.
- **`?` = unknown centromeric origin** — marker chromosomes / material of unknown
  origin. We render these as `mar` at the end of the sex row.

## Where we deliberately differ

- Modern StudyRare-branded palette; heterochromatin drawn as hatch textures
  (centromere vs variable/stalk use different hatch directions).
- A teaching layer CyDAS didn't have: plain-English decode, band-name
  pronunciation, hover explanations, clinical notes, and audio (Web Speech).
- Deletions are drawn as the *shortened* chromosome; inversions physically flip
  the banding.

## Reference

CyDAS ISCNAnalyser — `Class Karyogram` documentation (cydas.org, archived).
Original online demo: `OnlineAnalysis/WebExample4.aspx`.
