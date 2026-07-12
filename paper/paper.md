---
title: 'KaryoDraw: a zero-install browser tool that draws and explains ISCN karyotypes for genetics education'
tags:
  - genetics
  - cytogenetics
  - karyotype
  - ISCN
  - medical education
  - genetic counseling
  - JavaScript
authors:
  - name: "Daniel Pique, MD, PhD"
    orcid: 0000-0003-0074-3974
    affiliation: 1
affiliations:
  - name: "StudyRare, Cincinnati, OH, USA"
    index: 1
date: "4 July 2026"
bibliography: paper.bib
---

# Summary

KaryoDraw (<https://karyodraw.com>) is a free, browser-based tool that turns a
karyotype written in ISCN 2024 (the current International System for Human
Cytogenomic Nomenclature) into an annotated, correctly banded karyogram *and* a
plain-language explanation of every symbol it contains. A learner types a
designation such as `46,XY,t(9;22)(q34;q11.2)` and immediately sees the
derivative chromosomes drawn against their normal homologs
(\autoref{fig:interface}), together with a
token-by-token decoding of the nomenclature, the biology of the relevant Giemsa
bands, and curated board-relevant clinical notes. The application runs
client-side, with no installation and no account. It stores no personal data:
an anonymous, cookieless beacon records the karyotype drawn and the features
used, with no IP address or identifier, to guide development. Every view has a
shareable deep-link URL and can be exported as an image or a one-page printable
summary.

![KaryoDraw rendering the reciprocal translocation `46,XY,t(9;22)(q34;q11.2)` (the Philadelphia chromosome) in "highlight" mode. Chromosomes involved in the rearrangement are colored by identity: der(9) carries the amber chromosome-22 segment and der(22) the periwinkle chromosome-9 segment, centromere-aligned against their normal homologs, while the panel at right decodes each token of the ISCN designation into plain language.\label{fig:interface}](fig1-interface.png)

# Statement of need

Interpreting ISCN nomenclature is a recognized hurdle in genetics and
genetic-counseling training, and chromosome concepts are well documented as
difficult for students to internalize and transfer to downstream reasoning
[@newman2012]. Candidates for the American Board of Genetic Counseling (ABGC) and
the American Board of Medical Genetics and Genomics (ABMGG) must fluently read
designations for deletions, duplications, inversions, translocations,
isochromosomes, ring and derivative chromosomes, and mosaicism. The notation is
compact and unforgiving, and the step novices find hardest is exactly the mapping
from a string of symbols to a picture of the affected chromosomes.

Existing software does not close this gap. Tools that parse ISCN are built for
analysis rather than teaching: CyDAS renders karyograms from ISCN but is a
server-side application from 2005, no longer actively maintained, and not
designed for learners [@cydas]; CytoGPS parses ISCN in the browser but converts
each karyotype into a binary Loss–Gain–Fusion model for large-scale data mining,
not visualization or explanation [@cytogps]. Conversely, modern client-side
chromosome-rendering libraries such as ideogram.js [@ideogram] and R packages
such as karyoploteR and chromoMap draw ideograms from genomic coordinates and
feature tables but do not accept ISCN karyotype nomenclature at all. Cytogenetics
teaching tools that do target learners generally focus on the manual task of
*arranging* chromosomes into a karyotype rather than on decoding and visualizing
ISCN designations. A browser-based, visualization-first approach also underlies
the author's earlier tool Aneuvis, which explores numerical chromosomal variation
across single cells [@aneuvis], though it addresses copy-number analysis rather
than nomenclature interpretation. KaryoDraw is, to our knowledge, the only tool
that combines
ISCN parsing, client-side karyogram rendering, and an explicit educational
explanation layer in a single zero-install, shareable web page.

# Functionality

**Parsing.** KaryoDraw parses ISCN designations including numerical gains and
losses (`+21`, `-X`), terminal and interstitial deletions, duplications and
triplications, paracentric and pericentric inversions, reciprocal and n-way (for
example three-way) translocations, isochromosomes, ring chromosomes, derivative
chromosomes with nested sub-operations, whole-arm and Robertsonian derivatives
(`der(13;14)`), dicentrics and isodicentrics, insertions, additions of unknown
origin, marker chromosomes, and mosaic or composite karyotypes with multiple
clones. It also reads the copy-number multiplication sign (`×n`), the
clonal-evolution shorthand (`idem`, `sl`, `sdl`) that inherits a stemline or
sideline's aberrations, double minutes (`dmin`), and homogeneously staining
regions (`hsr`). The drawn chromosome count is reconciled against the stated modal number,
including the fusion arithmetic of Robertsonian derivatives and triploid or
tetraploid ploidy, and a mismatch is flagged. The parser is forgiving but not
permissive: unrecognized input yields targeted warnings and "did you mean"
corrections rather than a hard failure, and a breakpoint band that does not exist
on its chromosome is rejected with an explanation rather than drawn, so a learner
always gets either a faithful drawing or specific feedback on what was missed.

**Rendering.** Chromosomes are drawn as SVG ideograms from UCSC hg38
`cytoBandIdeo` data (862 bands across 24 chromosomes). Two views serve different
learning goals: a *highlight* mode that greys out uninvolved chromosomes and
colors the involved ones by identity, with translocation and derivative segments
colored by their chromosome of origin so a rearrangement is immediately legible,
and a *realistic* mode that renders true Giemsa banding on every chromosome so
the learner can practice spotting the abnormality. Band resolution is switchable
(~400, ~550, ~850 bands). Homologs and derivatives within a chromosome group are
centromere-aligned when their lengths differ, so a p-arm deletion visibly
shortens the top and a q-arm deletion the bottom, while same-length
rearrangements such as inversions are aligned flush at both ends. A ring
chromosome is drawn as an actual ring, its retained material wrapped into an
annulus with the centromere and the fusion point marked, which conveys the loss
of the distal tips more directly than a linear depiction.

**Explanation.** A teaching layer decodes each token of the designation into
plain English, explains band-name structure and the biology of each Giemsa stain
class, surfaces curated board-relevant clinical associations (for example trisomy
21, cri-du-chat, and the Philadelphia chromosome), and offers text-to-speech
pronunciation of the karyotype. n-way translocations are described with their
explicit ISCN cycle (e.g. 2→7→5→2), which is otherwise a common source of
confusion.

**Sharing and export.** The full application state (karyotype, render mode, and
band level) is encoded in a human-readable URL, so any view can be shared as a
link that reproduces it exactly; the karyogram can be copied or downloaded as a
PNG (rasterized client-side) and printed as a one-page summary.

# Scope and limitations

KaryoDraw covers the constitutional and neoplastic *karyotype*, that is, the
chromosome-band level of ISCN 2024. The microarray (`arr`), sequence-based, and
region-specific-assay chapters of ISCN describe sub-microscopic changes that a
banded karyogram cannot depict by construction, and they are out of scope. This
is an inherent limit of the karyotype representation, not a missing feature: it is
the same reason those separate nomenclatures exist.

Within karyotype nomenclature, a few operators are deliberately not resolved and
are surfaced transparently rather than mishandled silently: the alternative and
uncertainty markers (`or`, `?`) are not evaluated, so the tool draws the first
interpretation and states that it has done so. A derivative chromosome carrying
more than a single embedded rearrangement falls back to the base chromosome plus
the written decode. The polyploidy heuristic infers ploidy from the modal number
and is ambiguous for counts that fall between a hyperdiploid and a hypotriploid
complement, an ambiguity the notation itself does not resolve without clinical
context.

KaryoDraw is an educational visualizer of nomenclature, not a diagnostic tool, and
it does not validate a designation against a patient sample. The curated clinical
notes are illustrative teaching content, not a comprehensive reference.

# Implementation and availability

KaryoDraw is implemented in dependency-free vanilla JavaScript (a nomenclature
parser, an SVG karyogram renderer, and a teaching module) that requires no bundler
or transpiler. It is served as static assets by a small Cloudflare Worker, which
also handles an anonymous usage beacon and a feedback channel. It is deployed at
<https://karyodraw.com> and the source is available at
<https://github.com/dpique/studyrare-karyodraw> under the MIT license. Chromosome band data are
derived from the UCSC Genome Browser `cytoBandIdeo` table (hg38). The nomenclature
parser is validated by a dependency-free test suite (Node's built-in runner)
covering designations from aneuploidy through three-way translocations and
mosaicism, along with Robertsonian derivatives, isodicentrics, polyploidy, and
the count-reconciliation and invalid-band edge cases.

# Acknowledgements

<!-- optional -->

# References
