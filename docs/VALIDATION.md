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

## Normalization before the parse

`parse()` cleans the designation before `parseClone` sees it, and `diagnose()` reports the
same cleanups as repairs on the raw text. The two have to stay in step: a cleanup applied
only in `diagnose()` leaves the parser tripping over the character anyway, so one mistake
produces two messages.

| cleaned | why | example |
| --- | --- | --- |
| whitespace | ISCN carries no internal spaces, humans and copy-paste add them | `47, XX, +21` |
| trailing `.` `;` `:` | sentence punctuation from prose. The cell-count pattern is anchored to the end of its field, so `+21[cp10].` never matched it and the whole change was reported as unrecognized, naming the change instead of the period | `47-49,XY,+8,+21[cp10].` |

Only at the very END of the designation. A sub-band ends in a digit after its period
(`del(11)(q24.1)`), a cell count in `]`, a qualifier in a letter, so nothing legal ends in
one of these marks and a period inside the text is never touched.

## What the decode echoes

Each decode chip shows the field **as written**, not a rebuilt canonical form. The count
chip used to be reassembled as `N~M`, so `47-49` displayed as `47~49`: a character the
reader had not typed, which reads as the app having quietly edited the input, and it also
dropped the `<2n>` ploidy note off `45<2n>,XY,…` entirely.

Where the written form is accepted but not canonical, the chip still shows what was written
and the canonical form is offered in the **note box** (`result.note`), with a one-click
alternative. A dash range is the Mitelman spelling, ISCN uses a tilde, so `46-49,XY` draws
and carries a note offering `46~49,XY`.

That is not a warning: warning on correct input is how a warning box loses its authority. It
was first tried as a sentence in the decode row, which was not enough — it left the reader to
retype the karyotype, and the chip beside it still read `46-49`, so "which one is it" stayed
open. State it once, in the place that can act on it.

`result.note` carries its own `fixLabel`. It used to be hardcoded in the page to the
Robertsonian wording, which was the only note there was, and it holds one note at a time:
whichever branch runs first keeps the slot, and later branches check `!result.note`.

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

## Breakpoint arity

An operation knows how many breakpoints it takes, and that one rule closed the largest
group on the old known-holes list. `ARITY` in `iscn-parser.js` holds the table; the check
runs after the switch, only when the breakpoints that ARE there could be read, so
`del(5)(zzqewdf2315.2)` is told its band is not a band and not also told a deletion needs
one.

| operation | takes |
| --- | --- |
| `del`, `dup`, `trp` | one group, one band (terminal) or two (interstitial) |
| `inv` | one group, two bands: the ends of the segment that turns over |
| `t` | one breakpoint per chromosome named, so three for a three-way |
| `ins` | three breakpoints however written: the site, and the two bounding the piece |

What made this worth a rule rather than four checks is that the drawing was invented
silently. The explanations are where it showed: `inv(9)(p11)` came out as "the segment
between 9p11 is flipped end-for-end (paracentric)", which invents both a second endpoint
and a classification, and `dup(1)` as "the segment  is present twice".

`r(13)`, `i(X)`, `add(19)`, `der(X)` and `rob(13;14)` are deliberately NOT in the table.
Each reads sensibly with the breakpoints left off, real reports write them that way, and
refusing valid ISCN is the worse failure. Adding one of them needs a better reason than
symmetry, and `test/parser.test.js` pins each of them as drawable so the table cannot grow
by accident.

## Warns, and still draws

A fault in how a karyotype is *written* that changes nothing about what is drawn keeps its
drawing and gets the rule plus the corrected spelling. Refusing here would withhold a
correct picture over a spelling.

| input | what is said |
| --- | --- |
| `43,XY,rob(14;21)(q10;q10),-21,-20` | gains and losses are listed in chromosome order |
| `46,XY,del(5)(p15.3p15.2)` | interstitial bands are written centromere-outward |
| `46,XY,del(5)(p15.2),del(5)(p15.2)` | a change on both homologs is written `x2` |
| `46c,XY` | `c` goes on the change it describes, not on the count |
| `46-49,XY` | ISCN spells a range with a tilde (a note, not a warning) |

**`dup` is excluded from the breakpoint-order rule.** There the order is meaningful: it
distinguishes a direct duplication from an inverted one, and the renderer reads it. Two
tests pin that, and a third pins that `dup(1)(q25q22)` raises no warning, so a later
tidy-up cannot fold `dup` in with `del` and `inv`.

`46,xy,del(5)(p15.2)` is still accepted silently. Lowercase is a shift-key slip, not an
error of understanding, and there is nothing to teach.

## Known holes

Nothing currently known. Every entry that was on this list is closed, and
`test/parser.test.js` holds one case per rule with the correct spellings alongside, which
is the half that matters: each rule is pinned by what it must NOT refuse as well as by what
it must.

The ones that were here, and where each went: the arity group (`inv(9)(p11)`,
`t(9;22)(q34)`, `t(2;7;5)(q21;p13)`, and the two the survey never had, `del(5)` and
`t(9;22)`) to the table above; `del(5)(p15.3p15.2)`, the doubled change and `46c,XY` to
"Warns, and still draws"; `t(9;9)`, `rob(1;2)`, `+0`, `47,idem,+8`, `46<3n>,XY` and `[0]`
to the gate; `46,YX` to a repair, like the missing comma.

**`47,XX,+r` was the one failure in the other direction**, and the one that mattered most:
a supernumerary ring is valid ISCN and the counterpart of `+mar`, and it was refused as an
unrecognized change. It now parses as a marker carrying a ring shape, so it draws as a ring
labelled `r` in the marker slot, and the decode says what separates it from `r(13)` (which
names its chromosome; `+r` does not).

Reproduce the whole set with `npm run stress`, which runs a 138-karyotype corpus through
the real page and flags every case where the app drew something it should have refused or
refused something it should have drawn. It currently flags none.

Note what the old list was not. Every entry on it was a well-formed field list with a bad
*aberration* in it, because that is what the survey was built to probe. `69.XX` was not on
it and drew for months: the mistake was in the *separator between fields*, one level up
from anything being surveyed. `del(5)` and `t(9;22)` were missed the same way, by a survey
that only varied what was inside the parentheses. Vary the punctuation and the field
structure too, not only the operations.

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

## The stress sheet

`npm run stress` types every karyotype in `scripts/stress-corpus.mjs` into the real page in
a headless browser and writes `karyotype-stress-test.html`: one card per karyotype holding
the drawing, the warning box, the decode, the clinical card and the segregation panel as a
student sees them, with a Good / Not good control and a Markdown export of the "not good"
list. It is for the review a test suite cannot do — whether the *wording* teaches, whether
the *picture* is right — so its corpus is written around what students actually type,
including the exact strings from board practice questions.

It drives the page rather than the modules on purpose: the draw gate, the band check and
much of the message wording live inside `index.html`'s `run()`, so a Node reimplementation
would review a program nobody uses. The two checks it makes on its own are the `expect`
field per case and, at write time, that no two karyograms share an SVG `clipPath` id.

Add a case whenever a student sends in a karyotype that behaved oddly. The corpus is the
record of what has been looked at.
