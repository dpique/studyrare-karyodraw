// KaryoDraw curated content — the SINGLE SOURCE OF TRUTH for both the in-page
// guided tour and the generated per-karyotype SEO landing pages.
//   - The browser reads window.KDContent.tour() to drive the guided tour.
//   - scripts/build-pages.mjs reads CONTENT (via require) to render static
//     landing pages, the homepage "Common karyotypes" section, and sitemap.xml.
// Fields per entry:
//   slug      URL slug for the landing page (/karyotype/<slug>/)
//   k         ISCN karyotype string (validated to parse cleanly)
//   name      short human name (no notation)
//   aka       search aliases / synonyms
//   concept   one-line category label (shown in the tour and on the page)
//   tour      true to include in the ordered guided tour
//   caption   tour caption (HTML; tour entries only)
//   intro     1-2 sentence page lead (HTML). The rest of each page (decoded
//             symbols, syndrome notes, karyogram) is generated from the render
//             modules, so it never drifts from the tool itself.
//   related   slugs of related pages to cross-link
(function (root) {
  var CONTENT = [
    // ---- guided-tour curriculum (ordered) ----
    { slug: "normal-female-karyotype", k: "46,XX", name: "Normal female karyotype", aka: ["46 XX"],
      concept: "Reading a karyotype", tour: true,
      caption: "Start here: a normal female karyotype. Twenty-two pairs of autosomes are arranged largest to smallest, then the sex chromosomes. On each chromosome the short arm (p) sits on top and the long arm (q) below, divided by the centromere, and the bands are numbered outward from the centromere. Everything is gray because nothing is abnormal.",
      intro: "46,XX is the standard female karyotype: 46 chromosomes made up of 22 pairs of autosomes and two X chromosomes. It is the baseline that every abnormal karyotype is read against.",
      related: ["normal-male-karyotype", "down-syndrome", "turner-syndrome"] },
    { slug: "down-syndrome", k: "47,XX,+21", name: "Down syndrome", aka: ["Trisomy 21", "47 XX +21"],
      concept: "Trisomy", tour: true,
      caption: "The count reads 47 because a third copy of chromosome 21 is present. This is the karyotype of Down syndrome, the most common autosomal trisomy compatible with live birth. A plus sign before a chromosome number means a whole extra copy of it, with no change to its structure.",
      intro: "47,XX,+21 is the karyotype of Down syndrome, caused by a third copy of chromosome 21. It is the most common autosomal trisomy compatible with live birth.",
      related: ["edwards-syndrome", "patau-syndrome", "robertsonian-translocation-14-21"] },
    { slug: "turner-syndrome", k: "45,X", name: "Turner syndrome", aka: ["Monosomy X", "45 X"],
      concept: "Monosomy", tour: true,
      caption: "Only one sex chromosome is present, so the count is 45 and the notation ends at X. This is Turner syndrome: short stature, ovarian insufficiency, and a webbed neck are classic, and loss of the <i>SHOX</i> gene drives much of the growth phenotype. A single X with no second sex chromosome is written simply as X, with no plus or minus.",
      intro: "45,X is the karyotype of Turner syndrome, in which a single X is present and the second sex chromosome is missing. Short stature and ovarian insufficiency are characteristic, and loss of the <i>SHOX</i> gene drives much of the growth phenotype.",
      related: ["mosaic-turner-syndrome", "isochromosome-xq", "klinefelter-syndrome"] },
    { slug: "klinefelter-syndrome", k: "47,XXY", name: "Klinefelter syndrome", aka: ["47 XXY"],
      concept: "Sex chromosome aneuploidy", tour: true,
      caption: "An extra X in a male raises the count to 47. This is Klinefelter syndrome, the most common sex chromosome aneuploidy: tall stature, small firm testes, and infertility are typical. Aneuploidy is not limited to the autosomes, and the sex chromosomes are always listed after the count.",
      intro: "47,XXY is the karyotype of Klinefelter syndrome, an extra X chromosome in a male. It is the most common sex chromosome aneuploidy, and small firm testes with infertility are typical.",
      related: ["triple-x-syndrome", "xyy-syndrome", "turner-syndrome"] },
    { slug: "cri-du-chat-syndrome", k: "46,XY,del(5)(p15.2)", name: "Cri-du-chat syndrome", aka: ["5p deletion", "5p minus"],
      concept: "Deletion", tour: true,
      caption: "A single breakpoint deletion removes the tip of the short arm of chromosome 5, everything distal to 5p15.2. This is cri-du-chat syndrome, named for the high-pitched cry in infancy. In highlight mode the shortened chromosome 5 is colored so you can compare it against its normal homolog.",
      intro: "46,XY,del(5)(p15.2) is the karyotype of cri-du-chat syndrome, a deletion of the tip of the short arm of chromosome 5. The name comes from the high-pitched, cat-like cry in infancy.",
      related: ["wolf-hirschhorn-syndrome", "chromosome-1p36-deletion", "digeorge-22q11-deletion"] },
    { slug: "digeorge-22q11-deletion", k: "46,XX,del(22)(q11.21q11.23)", name: "22q11.2 deletion syndrome", aka: ["DiGeorge syndrome", "velocardiofacial syndrome"],
      concept: "Microdeletion", tour: true,
      caption: "Loss of a small segment at 22q11.2 produces the 22q11.2 deletion syndrome (DiGeorge / velocardiofacial). Conotruncal heart defects, hypocalcemia, immune deficiency, and palatal anomalies follow from loss of genes including <i>TBX1</i>. Deletions this small are usually found by microarray or FISH rather than by banding alone, but the notation is the same.",
      intro: "This karyotype shows the 22q11.2 deletion syndrome (DiGeorge / velocardiofacial syndrome), an interstitial loss on the long arm of chromosome 22 that removes genes including <i>TBX1</i>. It is one of the most common microdeletion syndromes.",
      related: ["prader-willi-angelman-15q", "wolf-hirschhorn-syndrome", "cri-du-chat-syndrome"] },
    { slug: "inversion-9", k: "46,XY,inv(9)(p11q13)", name: "Pericentric inversion 9", aka: ["inv(9)", "inversion 9 variant"],
      concept: "Inversion", tour: true,
      caption: "Two breakpoints on chromosome 9, one on each arm, with the segment between them flipped end for end. Because it spans the centromere it is a pericentric inversion. inv(9)(p11q13) is one of the most common benign variants in the human genome and is generally reported as normal.",
      intro: "46,XY,inv(9)(p11q13) is a pericentric inversion of chromosome 9. It is one of the most common structural variants in the human genome and is generally considered a benign finding.",
      related: ["normal-male-karyotype", "ring-chromosome-13", "isochromosome-xq"] },
    { slug: "isochromosome-xq", k: "46,X,i(X)(q10)", name: "Isochromosome Xq", aka: ["i(Xq)", "isochromosome X"],
      concept: "Isochromosome", tour: true,
      caption: "An isochromosome is a mirror-image chromosome made of two copies of one arm, so the other arm is lost. Here i(X)(q10) is two long arms of the X joined at the centromere, so its short arm is absent. Paired with one normal X, it leaves a single copy of Xp, a recurrent structural cause of Turner syndrome.",
      intro: "46,X,i(X)(q10) pairs one normal X with an isochromosome of the X long arm, so the short arm of the X is present in only one copy. It is a recurrent structural cause of Turner syndrome.",
      related: ["turner-syndrome", "mosaic-turner-syndrome", "ring-chromosome-13"] },
    { slug: "philadelphia-chromosome", k: "46,XY,t(9;22)(q34;q11.2)", name: "Philadelphia chromosome", aka: ["t(9;22)", "BCR-ABL1", "CML"],
      concept: "Reciprocal translocation", tour: true,
      caption: "Two chromosomes break and swap their distal segments. Chromosome 9 breaks at 9q34 and chromosome 22 at 22q11.2, producing two derivative chromosomes. The small der(22) is the Philadelphia chromosome, and the <i>BCR::ABL1</i> fusion it creates defines chronic myeloid leukemia. KaryoDraw draws each derivative next to its normal homolog so you can see exactly what moved.",
      intro: "46,XY,t(9;22)(q34;q11.2) is the Philadelphia chromosome, a reciprocal translocation between chromosomes 9 and 22. The resulting <i>BCR::ABL1</i> fusion gene defines chronic myeloid leukemia.",
      related: ["robertsonian-translocation-13-14", "robertsonian-translocation-14-21", "inversion-9"] },
    { slug: "robertsonian-translocation-13-14", k: "45,XX,rob(13;14)(q10;q10)", name: "Robertsonian translocation 13;14", aka: ["rob(13;14)", "der(13;14)"],
      concept: "Robertsonian translocation", tour: true,
      caption: "Two acrocentric chromosomes fuse at their centromeres and their tiny short arms are lost, so the count drops to 45. rob(13;14) is the most common Robertsonian translocation in humans. Carriers are healthy but face a higher risk of miscarriage and of unbalanced offspring, including translocation trisomy 13; a Robertsonian that instead involves chromosome 21 is a familial cause of Down syndrome.",
      intro: "45,XX,rob(13;14)(q10;q10) is the most common Robertsonian translocation, a centromeric fusion of chromosomes 13 and 14 that lowers the chromosome count to 45. Carriers are healthy but face reproductive risks.",
      related: ["robertsonian-translocation-14-21", "philadelphia-chromosome", "down-syndrome"] },
    { slug: "ring-chromosome-13", k: "46,XY,r(13)(p11q34)", name: "Ring chromosome 13", aka: ["r(13)", "ring 13"],
      concept: "Ring chromosome", tour: true,
      caption: "A chromosome whose two arms break and whose broken ends fuse into a circle, usually losing the material beyond the breakpoints. Here chromosome 13 breaks at 13p11 and 13q34 and closes into a ring. Ring chromosomes are unstable through cell division, so ring syndromes often show mosaicism and variable severity.",
      intro: "46,XY,r(13)(p11q34) is a ring chromosome 13, formed when both arms of chromosome 13 break and the broken ends fuse into a circle. Ring chromosomes are unstable through cell division.",
      related: ["chromosome-1p36-deletion", "isochromosome-xq", "marker-chromosome"] },
    { slug: "mosaic-turner-syndrome", k: "mos 45,X[12]/46,XX[18]", name: "Mosaic Turner syndrome", aka: ["45,X/46,XX", "mosaic 45 X"],
      concept: "Mosaicism", tour: true,
      caption: "Two cell lines in one person. The bracketed numbers are how many cells were counted in each line: twelve 45,X cells and eighteen 46,XX cells. Mosaic Turner syndrome like this often has milder or more variable features than a non-mosaic 45,X, which is why the cell counts are reported.",
      intro: "This karyotype shows mosaic Turner syndrome, with two cell lines: 45,X and 46,XX. The bracketed numbers are the cells counted in each line, and mosaic forms are often milder than a non-mosaic 45,X.",
      related: ["turner-syndrome", "isochromosome-xq", "triploidy"] },
    // ---- additional curated landing pages (not in the tour) ----
    { slug: "normal-male-karyotype", k: "46,XY", name: "Normal male karyotype", aka: ["46 XY"],
      concept: "Reading a karyotype", tour: false,
      intro: "46,XY is the standard male karyotype: 46 chromosomes made up of 22 pairs of autosomes, one X, and one Y. It is the baseline that every abnormal karyotype is read against.",
      related: ["normal-female-karyotype", "klinefelter-syndrome", "xyy-syndrome"] },
    { slug: "edwards-syndrome", k: "47,XY,+18", name: "Edwards syndrome", aka: ["Trisomy 18", "47 XY +18"],
      concept: "Trisomy", tour: false,
      intro: "47,XY,+18 is the karyotype of Edwards syndrome, a trisomy of chromosome 18. It is the second most common autosomal trisomy and carries a severe prognosis.",
      related: ["patau-syndrome", "down-syndrome", "triploidy"] },
    { slug: "patau-syndrome", k: "47,XX,+13", name: "Patau syndrome", aka: ["Trisomy 13", "47 XX +13"],
      concept: "Trisomy", tour: false,
      intro: "47,XX,+13 is the karyotype of Patau syndrome, a trisomy of chromosome 13. Midline defects such as holoprosencephaly, cleft lip and palate, and polydactyly are characteristic.",
      related: ["edwards-syndrome", "down-syndrome", "robertsonian-translocation-13-14"] },
    { slug: "triple-x-syndrome", k: "47,XXX", name: "Triple X syndrome", aka: ["47 XXX", "trisomy X"],
      concept: "Sex chromosome aneuploidy", tour: false,
      intro: "47,XXX, sometimes called triple X syndrome, is an extra X chromosome in a female. Many individuals are only mildly affected or have no obvious features.",
      related: ["klinefelter-syndrome", "xyy-syndrome", "turner-syndrome"] },
    { slug: "xyy-syndrome", k: "47,XYY", name: "XYY syndrome", aka: ["47 XYY", "Jacobs syndrome"],
      concept: "Sex chromosome aneuploidy", tour: false,
      intro: "47,XYY is an extra Y chromosome in a male. Most individuals have a typical phenotype, often with tall stature.",
      related: ["klinefelter-syndrome", "triple-x-syndrome", "normal-male-karyotype"] },
    { slug: "prader-willi-angelman-15q", k: "46,XX,del(15)(q11.2q13)", name: "15q11-q13 deletion", aka: ["Prader-Willi syndrome", "Angelman syndrome"],
      concept: "Microdeletion", tour: false,
      intro: "This karyotype shows a 15q11.2-q13 deletion. Depending on the parent of origin, the same interstitial deletion causes Prader-Willi syndrome (paternal) or Angelman syndrome (maternal), a classic example of genomic imprinting.",
      related: ["digeorge-22q11-deletion", "wolf-hirschhorn-syndrome", "cri-du-chat-syndrome"] },
    { slug: "wolf-hirschhorn-syndrome", k: "46,XX,del(4)(p16.3)", name: "Wolf-Hirschhorn syndrome", aka: ["4p deletion", "4p minus"],
      concept: "Deletion", tour: false,
      intro: "46,XX,del(4)(p16.3) is the karyotype of Wolf-Hirschhorn syndrome, a deletion of the tip of the short arm of chromosome 4. It causes a distinctive facial appearance with severe growth and developmental delay.",
      related: ["cri-du-chat-syndrome", "chromosome-1p36-deletion", "digeorge-22q11-deletion"] },
    { slug: "chromosome-1q-duplication", k: "46,XY,dup(1)(q22q25)", name: "Chromosome 1q duplication", aka: ["partial trisomy 1q", "dup(1q)"],
      concept: "Duplication", tour: false,
      intro: "46,XY,dup(1)(q22q25) shows a duplication on the long arm of chromosome 1, so that segment is present in three copies (a partial trisomy). Duplications add genetic material without losing any.",
      related: ["down-syndrome", "marker-chromosome", "chromosome-1p36-deletion"] },
    { slug: "triploidy", k: "69,XXY", name: "Triploidy", aka: ["69 XXY", "triploid"],
      concept: "Polyploidy", tour: false,
      intro: "69,XXY is triploidy, a complete extra set of chromosomes for a total of 69. Triploidy is usually lethal in early development and is a recognized cause of miscarriage.",
      related: ["down-syndrome", "edwards-syndrome", "mosaic-turner-syndrome"] },
    { slug: "robertsonian-translocation-14-21", k: "45,XY,rob(14;21)(q10;q10)", name: "Robertsonian translocation 14;21", aka: ["rob(14;21)", "translocation Down carrier"],
      concept: "Robertsonian translocation", tour: false,
      intro: "45,XY,rob(14;21)(q10;q10) is a balanced Robertsonian translocation carrier. The person is healthy, but the translocation is a familial cause of translocation Down syndrome in offspring.",
      related: ["robertsonian-translocation-13-14", "down-syndrome", "philadelphia-chromosome"] },
    { slug: "chromosome-1p36-deletion", k: "46,XX,del(1)(p36.3)", name: "1p36 deletion syndrome", aka: ["1p36 minus", "monosomy 1p36"],
      concept: "Deletion", tour: false,
      intro: "46,XX,del(1)(p36.3) is the karyotype of 1p36 deletion syndrome, the most common terminal deletion syndrome in humans. It is a loss of the tip of the short arm of chromosome 1.",
      related: ["cri-du-chat-syndrome", "wolf-hirschhorn-syndrome", "ring-chromosome-13"] },
    { slug: "marker-chromosome", k: "47,XX,+mar", name: "Marker chromosome", aka: ["+mar", "supernumerary marker", "ESAC"],
      concept: "Marker chromosome", tour: false,
      intro: "47,XX,+mar shows a supernumerary marker chromosome, a small extra chromosome whose origin cannot be identified by banding alone. Further testing such as microarray or FISH is used to characterize it.",
      related: ["ring-chromosome-13", "chromosome-1q-duplication", "triploidy"] }
  ];

  var api = {
    CONTENT: CONTENT,
    bySlug: function (slug) { for (var i = 0; i < CONTENT.length; i++) if (CONTENT[i].slug === slug) return CONTENT[i]; return null; },
    byKaryotype: function (k) { var n = String(k).replace(/\s+/g, "").toLowerCase(); for (var i = 0; i < CONTENT.length; i++) if (CONTENT[i].k.replace(/\s+/g, "").toLowerCase() === n) return CONTENT[i]; return null; },
    tour: function () { return CONTENT.filter(function (e) { return e.tour; }); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.KDContent = api;
})(typeof window !== "undefined" ? window : null);
