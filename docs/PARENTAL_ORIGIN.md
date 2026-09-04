# Spec: parental origin (the segregation panel, run backwards)

Status: **built** (2026-07-26). The forward half shipped in #96, this in #100.
`Segregation.origin(clone)` / `Segregation.renderOrigin(model)`; tests in
`test/segregation.test.js`. Kept as the record of why it works this way, and of what was
deliberately left out. Three things came out differently from the plan below; each is
marked **AS BUILT**.

## The problem

The segregation panel only fires for a **balanced carrier**. `Segregation.eligible()`
requires a single aberration that is either a reciprocal `t` or a Robertsonian
`der`/`rob`, so it models one direction: carrier → gametes → conceptus.

That is backwards from how the material is actually encountered. In clinic and on the
boards you are handed the **abnormal result** and reason toward the parents. Since #96
made every conceptus karyotype clickable, the dead end is now easy to walk into: click
the trisomy 14 product of a `rob(13;14)` carrier and the segregation card disappears,
because the product is not a carrier. The panel that just told you where the karyotype
comes from will not tell you the same thing when you arrive from the other side.

Concretely, all of these currently return `eligible: false` and get nothing:

```
46,XY,der(13;14)(q10;q10),+14        translocation trisomy 14
46,XX,der(14;21)(q10;q10),+21        translocation Down syndrome
46,XX,der(5)t(2;5)(q21;q31)          adjacent-1 product
47,XX,+der(2)t(2;5)(q21;q31)         3:1 tertiary trisomy
```

## The design

**The reverse view is the forward view, matched.** Do not write a second enumeration.
Generate the small set of candidate parental carriers, run the existing
`compute()` on each, and keep the ones whose zygote list contains the typed karyotype.

That buys three things. The nomenclature surface stays exactly the one already
validated against ISCN 2024 Table 5. Correctness becomes a round-trip property:
`forward(origin(k))` must contain `k`. And the panel body can reuse `render()`
wholesale.

**What the user sees.** For an unbalanced input, show the forward panel *of the
inferred carrier*, with the typed karyotype marked "you are here", under a short
header stating the inference and the alternative:

```
Where this came from
  This karyotype is the adjacent-segregation product of a balanced
  Robertsonian carrier.
     Mother   45,XX,der(14;21)(q10;q10)      ← clickable, same data-k contract
     Father   45,XY,der(14;21)(q10;q10)
  Either parent could carry it. It can also be de novo, arising in a
  gamete or shortly after fertilization, with both parents having normal
  karyotypes. The two are distinguished by karyotyping both parents.

  [the carrier's full segregation panel, with 46,XX,der(14;21)(q10;q10),+21
   marked as the outcome you typed]
```

Presenting the carrier as two sexed karyotypes rather than one is deliberate: it
teaches that either parent can be the carrier, and each chip is a real loadable
karyotype instead of an `XX or XY` construction that is not valid ISCN.

## Scope

**In, v1.** A single non-mosaic clone, not acquired, whose aberrations include a
derivative built from two chromosomes (`der(A;B)` whole-arm, or `der(A)t(A;B)`), or a
free-standing `t` alongside an imbalance, and which is unbalanced.

**AS BUILT:** that is *not* quite the whole set the forward model emits, so the round
trip is total over the derivative-bearing products only. Interchange 3:1 gametes give
bare aneuploidies (`45,XX,-2`, `45,XX,-5`) with no derivative left in them, and those
fall into the excluded class below for the same reason: nondisjunction produces them
too, so naming a carrier would overclaim. The test asserts the round trip over
derivative-bearing products and states the count it covered.

**Out, v1**, each for a reason:

- **Balanced input.** Already served by the forward panel; `origin()` returns null.
- **A bare aneuploidy with no derivative** (`47,XX,+21`, `45,XX,-21`). The inference is
  not determinate: nondisjunction and a carrier parent both produce it, and for `-21`
  the carrier route is vanishingly rare. Showing a carrier candidate here would
  overclaim. See open question 1.
- **Mosaics.** The existing single-clone restriction stands.
- **Acquired/somatic karyotypes.** Parental origin is meaningless for a tumor clone.
  Reuse the existing `isAcquired()` gate, which already guards the forward panel.
- **Sex-chromosome translocations.** `isReciprocal()` already excludes X and Y; keep it
  excluded rather than half-model X-autosome products.
- **Three-way translocations.** Already out of scope forward, so out of scope backward.

## What this must not do

**No recurrence-risk numbers.** `segregation.js` already draws this line in its module
note, and the reverse view is where the temptation is strongest, because "what is the
chance of it happening again" is the next question a reader has. The numbers swing on
chromosome pair, carrier sex, segment size, and ascertainment: a female `rob(14;21)`
carrier is quoted around 10 to 15% for a liveborn with translocation Down syndrome
against roughly 2 to 5% for a male carrier, and prenatal figures differ from liveborn
again. A wrong number in a teaching tool is worse than no number, because students
quote it. Say *what* can happen and *who to test*; leave *how likely* to a genetic
counselor, and keep the existing note visible in the reverse view too.

**No claim about which parent.** Nothing in a proband's karyotype identifies the
carrier parent. Show both, always.

## API

Mirrors the existing `eligible` / `compute` / `render` triple:

```js
window.Segregation.origin(clone)  -> null | OriginModel
window.Segregation.renderOrigin(originModel) -> HTML string
```

```js
OriginModel = {
  typed: "46,XX,der(14;21)(q10;q10),+21",
  candidates: [{
    carrier: { XX: "45,XX,der(14;21)(q10;q10)", XY: "45,XY,der(14;21)(q10;q10)" },
    mode: "Adjacent",       // the forward mode name that produced `typed`
    sub: "2:1",
    model: <the forward model for this carrier, ready for render()>,
    matchIndex: <index of the matching gamete, for the "you are here" marker>
  }],
  deNovoPossible: true       // always true in v1; kept explicit, not implied
}
```

`origin()` stays DOM-free like the rest of the module. `renderOrigin()` returns a
string; the host wires clicks through the existing `data-k` delegated listener.

## Candidate generation

Small and enumerable, no search:

| Typed shape | Candidate carrier |
| --- | --- |
| `der(A;B)(q10;q10)` + `+A` or `+B` | `45,<sex>,der(A;B)(q10;q10)` |
| `der(A)t(A;B)(bpA;bpB)` alone | `46,<sex>,t(A;B)(bpA;bpB)` |
| `+der(A)t(A;B)(...)` (3:1) | `46,<sex>,t(A;B)(bpA;bpB)` |
| `der(A)t(A;B)(...)` + `-B` (3:1) | `46,<sex>,t(A;B)(bpA;bpB)` |

Build the candidate for both sexes, run `compute()`, and match. If no mode matches,
return null rather than guessing: a near-miss means either the typed karyotype is not a
segregation product or the enumeration has a gap, and both should surface as "nothing
shown" instead of a wrong parent.

## Matching mechanics

Compare **canonical** forms, not raw strings, or the match will be brittle:

- Parse both sides and compare `.normalized` (kills whitespace differences).
- Canonicalize the `rob(` / `der(` spelling to one of them before comparing. A reader
  who types `46,XX,rob(14;21)(q10;q10),+21` must match a candidate whose forward model
  emits the `der(` spelling. This is the most likely source of a silent no-match.
- Aberration order within a clone is not canonical in ISCN as typed
  (`46,XY,+14,der(13;14)(q10;q10)` parses the same as `...der(...),+14`), so compare on
  a sorted key of parsed aberrations rather than the string where practical.

## Tests

Written first, as with #95 and #96. The realm gotcha in `test/segregation.test.js`
applies: normalize through JSON before `deepEqual`.

1. **Round trip, total.** For each carrier in a fixture set (`rob(13;14)`, `rob(14;21)`,
   `t(2;5)(q21;q31)`, `t(11;22)(q23;q11.2)`), take every unbalanced zygote the forward
   model emits, feed it to `origin()`, and assert a candidate comes back whose
   `carrier.XX`/`carrier.XY` forward model contains that exact karyotype, and whose
   `mode` equals the mode that emitted it.
2. **Balanced inputs return null** (the forward panel serves them).
3. **Out-of-scope inputs return null:** `46,XX`, `47,XX,+21`, `45,XX,-21`,
   `46,XY,del(5)(p15.2)`, a mosaic, a three-way translocation.
4. **Acquired karyotypes return null** even when structurally eligible.
5. **`rob` spelling in the input matches a `der` candidate.**
6. **Aberration order does not defeat the match**
   (`46,XY,+14,der(13;14)(q10;q10)`).
7. **Every carrier string emitted re-parses** with no warnings, no suggestion, and a
   consistent count. Same invariant the forward tests already assert for zygotes.
8. **No percentage characters and no digit-followed-by-`%`** anywhere in
   `renderOrigin()` output. A cheap guard that keeps the risk-number line from being
   crossed later by accident.

## UI placement

**AS BUILT: one card, not two.** The plan called for a separate card above the
segregation card, on the grounds that the segregation card's lead asserts the drawn
karyotype is a balanced carrier pairing at meiosis, which is false for an unbalanced
proband. Both panels in fact render into the same `#segregation` host, because that host
already carries the wiring the embedded panel needs: the conceptus buttons, their
previews, and the animation toggle's `#seg-anim` sibling selectors. A second card would
have had to duplicate all of it.

The objection is answered by ordering instead. The reverse panel leads with its own
"Where this came from" heading and states the inference, then a line hands over
explicitly ("Below is that carrier parent's meiosis, with the outcome you typed
marked"), and only then does the embedded panel's "constitutional balanced carrier"
lead appear — by which point it is true, about the parent.

## Open questions

1. **Bare aneuploidy.** Should `47,XX,+21` say anything? **Still open, still deferred.**
   A qualitative line ("free trisomy 21, typically nondisjunction; parental karyotypes
   are typically normal; this is not a translocation") has teaching value and is the
   contrast case for translocation Down syndrome. It also widens scope well beyond
   translocations, and it would have to stay a contrast line, never a carrier candidate.
   `45,XY,-21` and `47,XX,+21` currently show no panel at all.
2. **De novo proportions.** **Resolved: omitted.** Quoted figures for translocation Down
   syndrome vary by series and by ascertainment, and the no-numbers rule applies most
   exactly here. "Told apart by karyotyping both parents" carries the weight, and a test
   fails the build on a percentage or a 1-in-N figure anywhere in the panel.
3. **UPD.** **Resolved: named, no figure.** A Robertsonian carrier of 14 or 15 gets one
   line naming uniparental disomy and the syndromes (Temple and Kagami-Ogata for 14,
   Prader-Willi and Angelman for 15), because it is a real reason to test the parents
   that a segregation diagram cannot show. A reciprocal carrier gets no such line.

## As built, round 2 (2026-09-04)

Three additions, each closing a way the view failed to fire or overspoke:

- **Inheritance qualifiers match and steer.** The comparison key (`canonKey`) strips
  mat/pat/dn/inh/dmat/dpat/dinh before comparing, because ISCN 2024 Table 5 writes
  every segregant with dmat and the textbook Emanuel karyotype ends in mat; keeping
  the suffix made the standard's own spellings match nothing. The suffix is then read
  back per candidate: mat/dmat name the mother (one carrier chip, no either/or),
  pat/dpat the father, inh/dinh keep both chips but drop the de novo alternative, and
  dn drops the candidate entirely, since it documents normal parents (4.2.1 h). For
  plain mat/pat the panel keeps the d- distinction visible: the balanced-carrier
  reading is stated as the usual one, with dmat named as the form that documents it.
- **The alert card.** `renderOriginAlert(org)` produces a compact strip for the
  `#origin-alert-card` at the top of the tool column (see INTERFACE.md); same model
  as the panel, so no second enumeration and no chance of disagreement.
- **The homologous fusion is its own model.** `der(21;21)` products used to trace to
  a trivalent whose alternate mode offered a chromosomally normal child; false, per
  Gardner (5th ed): the carrier keeps no free homologue, so the fusion is a univalent
  and every conception is trisomic or monosomic. `computeHomologous` models the two
  gametes (the trisomic zygote spelled `46,XX,+21,der(21;21)(q10;q10)`, ISCN 2024's
  printed order), `renderHomologous` draws it as text with no scene, and the origin
  head names the de novo isochromosome differential, which is the more common origin.
