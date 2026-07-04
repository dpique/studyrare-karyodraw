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
karyotype written in ISCN (the International System for Human Cytogenomic
Nomenclature) into an annotated, correctly banded karyogram *and* a
plain-language explanation of every symbol it contains. A learner types a
designation such as `46,XY,t(9;22)(q34;q11.2)` and immediately sees the
derivative chromosomes drawn against their normal homologs
(\autoref{fig:interface}), together with a
token-by-token decoding of the nomenclature, the biology of the relevant Giemsa
bands, and curated board-relevant clinical notes. The application runs entirely
in the browser — no installation, account, or server round-trip — and every view
has a shareable deep-link URL and can be exported as an image or a one-page
printable summary.

![KaryoDraw rendering the reciprocal translocation `46,XY,t(9;22)(q34;q11.2)` (the Philadelphia chromosome) in "highlight" mode. Chromosomes involved in the rearrangement are colored by identity — der(9) carries the amber chromosome-22 segment and der(22) the periwinkle chromosome-9 segment, centromere-aligned against their normal homologs — while the panel at right decodes each token of the ISCN designation into plain language.\label{fig:interface}](fig1-interface.png)

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
ISCN designations. KaryoDraw is, to our knowledge, the only tool that combines
ISCN parsing, client-side karyogram rendering, and an explicit educational
explanation layer in a single zero-install, shareable web page.

# Functionality

**Parsing.** KaryoDraw parses ISCN designations including numerical gains and
losses (`+21`, `-X`), terminal and interstitial deletions, duplications and
triplications, paracentric and pericentric inversions, reciprocal *and* n-way
(e.g. three-way) translocations, isochromosomes, ring chromosomes, derivative
chromosomes with nested sub-operations, additions of unknown origin, marker
chromosomes, dicentrics, and mosaic/composite karyotypes with multiple clones.
The parser is deliberately forgiving: unrecognized input yields targeted warnings
and "did you mean" corrections rather than a hard failure, so a learner always
gets something drawn plus feedback on what was not understood.

**Rendering.** Chromosomes are drawn as SVG ideograms from UCSC hg38
`cytoBandIdeo` data (862 bands across 24 chromosomes). Two views serve different
learning goals: a *highlight* mode that greys out uninvolved chromosomes and
colors the involved ones by identity — with translocation and derivative segments
colored by their chromosome of origin, so a rearrangement is immediately legible
— and a *realistic* mode that renders true Giemsa banding on every chromosome so
the learner can practice spotting the abnormality. Band resolution is switchable
(~400, ~550, ~850 bands). Homologs and derivatives within a chromosome group are
aligned on their centromere, so a p-arm deletion visibly shortens the top and a
q-arm deletion the bottom — matching how a karyogram is compared in practice.

**Explanation.** A teaching layer decodes each token of the designation into
plain English, explains band-name structure and the biology of each Giemsa stain
class, surfaces curated board-relevant clinical associations (for example trisomy
21, cri-du-chat, and the Philadelphia chromosome), and offers text-to-speech
pronunciation of the karyotype. n-way translocations are described with their
explicit ISCN cycle (e.g. 2→7→5→2), which is otherwise a common source of
confusion.

**Sharing and export.** The full application state — karyotype, render mode, and
band level — is encoded in a human-readable URL, so any view can be shared as a
link that reproduces it exactly; the karyogram can be copied or downloaded as a
PNG (rasterized client-side) and printed as a one-page summary.

# Implementation and availability

KaryoDraw is implemented in dependency-free vanilla JavaScript — a nomenclature
parser, an SVG karyogram renderer, and a teaching module — with no build step,
and is served as static assets. It is deployed at <https://karyodraw.com> and the
source is available at <https://github.com/dpique/studyrare-karyodraw> under the
MIT license. Chromosome band data are
derived from the UCSC Genome Browser `cytoBandIdeo` table (hg38). The nomenclature
parser is validated by a dependency-free test suite (Node's built-in runner)
covering canonical designations from aneuploidy through three-way translocations
and mosaicism.

# Acknowledgements

<!-- optional -->

# References
