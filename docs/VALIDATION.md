# What KaryoDraw will and will not draw

**The contract: if it draws, the notation was accepted.**

Drawing the nearest plausible reading of a wrong designation is not teaching. It lets a
mistake look answered, and it destroys the app's use as a check, which is what someone
writing an exam question needs from it. So a karyogram appears only for input that is
valid ISCN.

The one deliberate exception is listing order (see below), which changes how a karyotype
is written and never what is drawn.

## The gate

`index.html`, in `run()`. A karyogram is refused when any of these is true:

| condition | set by | example |
| --- | --- | --- |
| nothing parsed, or no modal number | `parse()` | `hello` |
| `model.suggestion` — a string repair is on offer | `diagnose()` | `46,XY,t(9,22)(q34;q11.2)` |
| a band that does not exist on that chromosome | `invalidBands()` in the page | `46,XY,del(5)(p99)` |
| `clone.unreadable` — part could not be read | `parseClone` | see below |
| `clone.countWrong` — the count is contradicted | `buildComplement` | `46,XY,rob(14;21)(q10;q10),-21` |
| `clone.unaccounted` — input was silently dropped | round-trip, below | `47~49,XY,+8,,` |
| `clone.sexMissing` — no sex field stated | `parseClone` | `69.XX`, `46` |

### `clone.unreadable`

Any of: a breakpoint group that yielded no band (`del(5)(zzqewdf2315.2)`); a token that
never became an aberration (`zzz(9)(q34)`, or a signless `,21`); text an operation could
not consume (`inv(9)(p11q13)zzz`); a sex field the app had to edit to use (`XZY`, `QQ`);
a clone that states **no** sex field at all (`clone.sexMissing`: `69.XX`, `46`).

`sexMissing` is a separate flag from the edited-sex-field check above, because that one
compares against a field that was stated and there was none. `69.XX` is one comma-separated
field: the count pattern read `69` and stopped at the period, so nothing ever looked at
`XX`. The count check is also no help, since it is skipped when there are no sex
chromosomes to count, and the round-trip keeps the count field verbatim (see its limit
below). Before the flag, `69.XX` drew 69 chromosomes with both sex slots labelled
"missing" and said nothing. ISCN always states the count then the sex complement, and
there is nothing to infer the sex from: `46` is as consistent with XX as with XY.

`diagnose()` repairs the separator when it can (`69.XX` → `69,XX`, also `;`, `:`, a space,
or nothing at all), and `parse()` only pushes the "starts with the count, then the sex
chromosomes" message when no such repair was offered, so one mistake yields one message.

### `clone.countWrong` is not `!counts.ok`

It is set at exactly the point the count warning is pushed, so the two can never
disagree. Valid ISCN can have a tally that cannot be pinned, and all of it still draws:
`48,XY,+8,inc`, modal ranges `47~49,XY,+8`, mosaics, composites `[cp10]`, `45<2n>,XY,…`.

Everything that makes a claim about the count reads this one flag: the warning, the
one-click fix, the `written N · drawn M` pill, the note carried into the PNG and print
sheet, and `Teach.plainSummary`.

## The round-trip check

`buildComplement` reassembles each clone from everything the parser kept
(`modalGiven`, `sexGiven`, `ab.raw`, `cellGiven`) and compares it with `clone.raw`.
Anything that does not come back was dropped without being understood.

Comparing the fields **as written** is what lets case, range spelling (`47-49` and
`47~49`), `<2n>`, `×2` and `x2`, `−21`, qualifiers and cell counts through with no false
positives. 61 varied valid karyotypes round-trip exactly; `test/round-trip.test.js` holds
that corpus and fails the build if it shrinks below 40 karyotypes or 14 aberration kinds.

**Its limit, which is pinned by a test:** it catches dropped *fields*, not dropped
*characters within* a field. `43,XZY,…` round-trips intact while the Z is discarded
inside it, which is why the sex field is checked separately. Do not assume this guard
covers everything.

Subclones written `idem`/`sl`/`sdl` are exempt: their aberration list is deliberately
expanded from the stemline and can never round-trip.

## Warns but still draws

**Listing order.** `43,XY,rob(14;21)(q10;q10),-21,-20` warns and offers the reordered
karyotype, but draws. Two reasons: order changes how the karyotype is written and never
what is drawn, and confidence in the exact ISCN rule is lower here than for the rest.

The check is scoped to `+N` against `-N` only. A broader version that ordered structural
abnormalities too flagged `46,XX,+der(5)t(2;5)(q21;q31),-2` — which is what this app's
own segregation model emits for a 3:1 product, checked against ISCN 2024 Table 5 — and
`segregation.js` had already concluded in writing that "ISCN fixes neither [spelling nor
order]". `test/segregation.test.js` pins the model's output against the check so the two
halves of the app cannot take opposite positions again.

## Offering a repair

`result.fixes` is the ordered list of repairs the page renders as "Did you mean X or Y?".
It is derived, never assigned to: each repair is still decided in exactly one place
(`suggestion`, `countFix`, `sexCountFix`, `sexFix`, `orderFix`) and `fixes` collects them
smallest-edit-first, drops empties and duplicates, and vets what is left.

**More than one reading.** A contradicted count has two honest repairs: change the number,
or change what follows it. `50,XXXXXXX` says 50 and lists seven X, which with 44 autosomes
comes to 51, so `51,XXXXXXX` and `50,XXXXXX` are equally plausible and nothing in the input
says which was meant. Offering only the first presented a guess as the answer.

`sexCountFix` is the second reading, and it is deliberately narrow, because "adjust the
content instead" is ambiguous in general. It requires **no aberrations** (in
`50,XXXXXXX,+21` the excess could be the `+21`), **one repeated sex letter**
(`50,XXXXXXY` could lose an X or the Y, and those are different karyotypes), and a **single
stated count** (a range gives no one number to satisfy).

**A repair does not have to draw; it has to go somewhere.** The app names one mistake at a
time, so a repair that fixes its own mistake and lands on a different one is progress:
`69.XX` → `69,XX` (refused for its count) → `69,XXX`, the triploidy that was probably
meant. What is dropped is a **dead end**, a repair that is refused with nothing further to
click: `46,,` collapses to `46`, which states no sex chromosomes, so clicking it buys a
second refusal and no information. `test/draw-gate.test.js` pins both halves, including
that following the chain reaches a karyogram within three steps.

Vetting re-parses each candidate one level deep (`parse(input, depth)`); the candidate's own
fixes are listed but not vetted, which is what terminates the recursion.

## Known holes

Input that is not correct ISCN and still draws. None is a regression; none has been
worked on. Roughly ordered by how badly the drawing misleads.

| input | what is wrong |
| --- | --- |
| `46,XY,inv(9)(p11)` | `inv` needs two breakpoints; drawn as if it had them |
| `46,XY,t(9;22)(q34)` | one breakpoint group for two chromosomes |
| `46,XY,t(2;7;5)(q21;p13)` | three chromosomes, two breakpoint groups |
| `46,XY,del(5)(p15.3p15.2)` | interstitial breakpoints in reverse order |
| `46,XY,t(9;9)(q34;q11)` | the same chromosome on both sides of a `t` |
| `45,XY,rob(1;2)(q10;q10)` | `rob` between non-acrocentrics; should be `der`/`t` |
| `46,XY,+0` | there is no chromosome 0 |
| `46,XY,del(5)(p15.2),del(5)(p15.2)` | the identical change listed twice |
| `47,idem,+8` | `idem` with no earlier clone (it warns, then draws anyway) |
| `46<3n>,XY` | ploidy annotation contradicts the count |
| `46c,XY` | a qualifier on the count field |
| `46,XY,t(9;22)(q34;q11.2)[0]` | a cell count of zero |
| `46,YX` | sex chromosomes out of order |
| `46,xy,del(5)(p15.2)` | lowercase; accepted deliberately, may not be wanted in a checker |

Reproduce with the survey in `NEXT_SESSION_HANDOFF.md`.

Note what this list is not. Every entry above is a well-formed field list with a bad
*aberration* in it, because that is what the survey was built to probe. `69.XX` was not on
it and drew for months: the mistake was in the *separator between fields*, one level up
from anything being surveyed. When adding to the survey, vary the punctuation and the
field structure too, not only the operations.

## Adding a check

1. Decide whether it blocks the drawing or only warns. Block when the input is not valid
   ISCN. Warn when it is a matter of how it is written, or when confidence in the rule is
   short of certain.
2. Set a flag on the clone in the parser, and read it in the page's gate. Never let the
   page work the rule out for itself, or the two drift.
3. **Refusing valid ISCN is far worse than tolerating invalid ISCN.** Add the case to the
   corpus in `test/draw-gate.test.js`, which walks every karyotype the app ships.
4. Write the message so it teaches the rule. `test/message-voice.test.js` fails the build
   on parser voice ("was not read", "couldn't read", "ignored"), on stating the app's own
   arithmetic as fact ("this karyotype describes"), and on any message that reports a
   problem without naming a rule, a correct form, or an example.
5. Verify the new test fails when the fix is reverted. Several guards in this repo passed
   without the code that was supposed to make them pass.
