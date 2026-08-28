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
| `clone.badCells` — the brackets hold no cell count | `parseClone` | `46,XY,t(9;22)(q34;q11.2)[-1]` |

### What a refusal takes off the screen

The gate does not only stop the karyogram. Everything that describes the current drawing
carries `data-drawing` in the markup, and `showDrawingCards(false)` sweeps the lot: the
export/print action row, the legend, the decode, the band map, the clinical card and the
meiotic segregation panel. `data-drawing="conditional"` marks the two the gate may only
ever HIDE, because their own renderers decide when they appear (clinical notes are not
shown for every karyotype, segregation only for a balanced constitutional carrier).

It was a list of three ids in the gate, and the segregation panel was never added to it.
A refused karyotype therefore sat under "Fix the karyotype above and the drawing appears
here" with the PREVIOUS karyotype's quadrivalent, its pairing diagram and its four
segregation outcomes still drawn below, captioned as though they were about the text in
the box. It is the exact failure the gate exists to prevent, one panel to the side of
where anyone was looking.

An attribute in the markup instead of a list in the gate, because the attribute is written
where the panel is written. `test/layout.test.js` requires every `*-card` in the tool
column to carry it, so the next panel cannot be forgotten, and `npm run stress` reports any
case where something with `data-drawing` is still on screen after a refusal (see "The
stress sheet").

### `clone.unreadable`

Any of: a breakpoint group that yielded no band (`del(5)(zzqewdf2315.2)`); a token that
never became an aberration (`zzz(9)(q34)`, or a signless `,21`); text an operation could
not consume (`inv(9)(p11q13)zzz`); a sex field the app had to edit to use (`XZY`, `QQ`);
a clone that states **no** sex field at all (`clone.sexMissing`: `69.XX`, `46`); square
brackets holding something that is not a cell count (`clone.badCells`: `[-1]`, `[2.5]`,
`[abc]`, an unclosed `[20`).

### The cell count

ISCN 4.4.1 d: "Absolute cell numbers are given in square brackets ([ ])", and in a
karyotype designation that is the only thing the brackets hold, so the field is
diagnosable on sight. `clone.badCells` is the same call as `clone.zeroCells` for the same
field, and the message says the brackets can come off, since the count is optional outside
neoplasia (4.4.1 c).

Before it, `[-1]` was never recognized as the cell count at all: the count pattern wants
digits, so the brackets stayed stuck to the last change and the reader was told `“[-1]” in
“t(9;22)(q34;q11.2)[-1]” is not one KaryoDraw can place` — the wrong field, and a rule
about commas they had not broken. On `+21[-1]` the missing-comma repair then split inside
the brackets and offered `+21[,-1]`, a string with no reading at all. That repair now
steps over the bracketed tail of a field.

Only for a clone that opens with a chromosome count, so the other bracket forms keep their
own messages: `[GRCh38]` is the genome build (Chapter 8) and `[100/200]` is nuclei scored
(Chapter 7). Neither is a cell count, and neither belongs to a karyotype designation.

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

### The `k` parameter is not a form field

`?k=` carries a karyotype, and `+` there is an ISCN symbol. The generic query decode turns
`+` into a space, so `karyodraw.com/?k=47,XX,+21` typed by hand arrived as `47,XX, 21` and
was answered with "“21” needs a sign", about a sign the reader had written.
`getKaryotypeParam()` in `index.html` decodes it as a plus, and puts back the one space
ISCN writes (after `mos`/`chi`, 4.4.1 m) in case the link was form-encoded. Links the app
makes encode the plus as `%2B` and the space as `%20`, so they are unaffected either way.

### `result.normalized` is the whitespace pass and nothing else

The page puts `result.normalized` in the input box, the drawing and the share URL, so it
must never contain a cleanup the app is about to complain about. It used to be taken after
all of them, and pasting `46,XY,der(13;14)(q10;q10), “+14”` out of a document produced a
state with no way out of it: the box was silently rewritten to the clean karyotype, the
message still named quotation marks that were no longer on screen, the repair differed
from the box by one invisible space, and the drawing was refused because a repair was on
offer. Three of those four were the same mistake, which is fixing something quietly and
then objecting to it loudly.

Whitespace is fixed silently because it is the one thing this app does not object to.
Everything else stays in the box until the reader accepts the repair.

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

**A repair has to be a karyotype the reader could have typed.** It is offered for one
click, so whatever is wrong with it lands in the input box as their karyotype. It is
whitespace-normalized for that reason (ISCN 4.4.1 a), keeping the two spaces ISCN does
write: after a `mos`/`chi` prefix (4.4.1 m) and around `or` (4.4.1 i). Offered as typed,
it carried whatever whitespace was in the input, including a space left behind where a
stray character was removed.

The normalization runs only once a repair is warranted for some other reason. Applied
before that test, every spaced karyotype would become a "did you mean", and a repair on
offer refuses the drawing, so `47, XX, +21` would stop drawing over its spaces.

**A message has to be readable.** Every message quotes what it is about with curly quotes,
which works until the thing quoted IS a curly quote: `These are not characters ISCN uses:
““”, “””` names two characters the reader cannot see. `STRAY_NAME` in `iscn-parser.js`
names those in words instead ("a curly opening quotation mark"), and anything not in it is
still shown quoted.


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

## The question mark

ISCN 4.2.1 k: the mark "is placed either before the uncertain item, or it may replace a
chromosome, region, band or subband designation". Those mean different things to a drawing.

| placement | example | what happens |
| --- | --- | --- |
| before the item | `+?8`, `?del(1)(p36.1)`, `der(1)?t(1;3)(p22;q13)` | everything needed is there, so it draws, and the decode says the identification is not certain |
| replacing a designation | `del(5)(q?)`, `der(?)`, `dic(17;?)` | the report declined to say, so there is nothing to draw. The message says that, and that the notation is correct |

**The one that was silently wrong.** `splitBands` wants digits after `p` or `q`, so `q2?3`
came back as `q2` and `q22.?1` as `q22`. The app was drawing a precise cut at a band the
report had explicitly declined to pin down, which is the exact failure this parser exists
to prevent, and it looked like success. Those now refuse. Going from "drew a lie" to
"refused honestly" reads as a lost feature in the conformance count and is the opposite.

Gibberish where a band goes is still gibberish: `del(5)(zzz)` gets the breakpoint message,
not the uncertainty one.

## No contractions

House style, and not a nicety here: this copy is read by students preparing for a board
exam, beside a standard that does not use them either. `test/message-voice.test.js` fails
on a contraction in any warning and on the page strings the warning corpus cannot reach.
Possessives are not contractions and are left alone. Line comments are stripped before the
page check, because several of them quote the copy they replaced and a rule that forbids
naming the old wording makes the reason for a change unwriteable.

## "Cannot be drawn" is not "is wrong"

Three things can be true of an input, and the app has to say which:

| | example | what it says |
| --- | --- | --- |
| not ISCN | `zzz(9)(q34)` | not an ISCN abbreviation, with the ones that are |
| correct ISCN, no drawing for it | `ider(22)(q10)t(9;22)(q34;q11.2)` | correct ISCN, what it is, the section, and that KaryoDraw does not draw it yet |
| correct ISCN, drawn | `t(9;22)(q34;q11.2)` | nothing |

The middle row was being reported as the top one. `rec`, `ider`, `tas`, `trc`, `fis` and
`qdp` are all in ISCN's symbol list, and the app said each was "not an ISCN abbreviation",
which asserts something false about the standard in the one place a student came to check
themselves against it. `NOT_DRAWN` in `iscn-parser.js` carries the term, what it is, and
its section, so the message can point at the book.

A term can move out of the middle row: `rec` did, and only halfway (see **Recombinant
chromosomes** below). When that happens the message has to get *more* specific rather than
disappear, because "KaryoDraw does not draw rec" stops being true while "KaryoDraw does not
draw this rec" still is. The same applies to any future partial support.

Three more of the same kind, each a case where the app's own model was wrong and the
message blamed the reader:

- **A repeated gain.** `+X` five times is how ISCN writes five extra copies (6.3.7 f). The
  "written once with a multiplier" rule was accusing a printed example of a mistake. That
  rule is about a *structural* change repeated instead of written `x2`, so gains and losses
  are exempt.
- **A composite karyotype.** In `48,XX,+7,+9,+11,+13[cp5]` the changes are the union across
  five cells and no one cell carried all of them (6.3.5), so the modal number and the tally
  describe different things. The count is not checked, the same exemption `inc` has.
- **The ploidy baseline.** A stated `<2n>`/`<3n>` is now believed rather than inferred from
  the count, and haploid is allowed, so near-haploid ALL (`26,X,+4,+6,+21`) and near-triploid
  clones count up against the right baseline. Read as diploid, `26,X,+4,+6,+21` produced
  "you wrote 26 but the changes add up to 48", which is the app stating its own wrong
  arithmetic as the reader's error.

The general rule: **before a message calls something wrong, check that the app is right.**
Every one of these was the app's model failing and the message blaming the input.

## Checking against ISCN itself

`test/iscn-2024-examples.js` holds 395 karyotype-format examples printed in ISCN 2024
(Cytogenet Genome Res 2024;164(suppl 1):1-224), and `test/iscn-conformance.test.js` runs
every one through the page's gate. 326 are accepted. The rest are marked
`supported: false` with the ISCN section naming the feature they need, so an unmodelled
feature is recorded rather than mistaken for bad input.

**Why it exists.** The draw gate was built from memory and shipped a rule that was
backwards. It told students `del(5)(p15.3p15.2)` was wrong and offered the reverse, when
Table 3 and 5.5.2 b say breakpoint designations run **pter to qter**: travelling that way,
p-arm band numbers descend and q-arm numbers ascend, so on the short arm the distal band
comes first and the original was right. 4.2.1 j.iii settles it in words on
`dup(1)(p34~32p22)`: "the distal breakpoint is in 1p34 ... and the proximal breakpoint is
in band 1p22." No test could have caught it, because every test had been written from the
same memory.

Three more rules went the same way and are pinned by citation in the conformance test:

| written from memory | what ISCN says |
| --- | --- |
| `<3n>` must agree with the count | 6.3.7 f: the level is the baseline the changes are expressed against. `81<3n>` is correct "even though the count is in the near-tetraploid range". The check is gone |
| `ins` takes exactly three breaks | 5.5.9 a says three, but 5.5.9.3 writes reciprocal insertional events with four: `ins(5;6)(q13q23;q15q23)`. At least three |
| a `t` always states its breakpoints | 4.2.1 f: they are given the first time and need not be repeated. `46,XX,t(9;22)(q34;q11.2)[10]/47,XX,t(9;22),+der(22)[10]` is correct |

**The rule this leaves.** Before adding a check, find the section. The standard is a
searchable PDF; a plausible memory of it is not evidence, and this app's whole claim is
that if it draws, the notation was accepted.

## The sex field and acquired sex-chromosome loss

ISCN 5.3.1.2 ix states the principle: "an acquired abnormality is presented in relation to
the constitutional karyotype". So the sex field is the baseline the changes are applied
to, **except** that a stated loss of a sex chromosome has already happened to a field the
clone wrote for itself.

| input | field | why |
| --- | --- | --- |
| `45,X,-X`, `45,X,-Y`, `45,Y,-X` | what was seen | the loss is already in the field; counting it again gives 44 |
| `44,Xc,-X`, `46,XXYc,-X` | constitutional (`c`) | the change applies on top of it |
| `47,XX,+X`, `48,XY,+X,+Y` | baseline | a gain is always additive |
| `45,idem,-X` | inherited from the stemline | not this clone's own observation, so the loss applies |

`45,X,-Y` is acquired loss of the Y, one of the commonest karyotypes in myeloid disease,
and it was being called a count error. All ten examples in 5.3.1.2 are pinned in
`test/iscn-conformance.test.js`.

**`c` on the sex complement** (4.2.1 e; 5.3.1.2 viii: "the letter c ... refers to the whole
sex complement") is parsed and remembered rather than treated as a stray letter, because it
changes the arithmetic and not just the label. `47,XXX?c` is 5.3.1.2 x, where it is unclear
whether the complement is constitutional or acquired.

**Tolerated:** `46,XY,-Y` states a loss the field does not show, and is accepted at 46
rather than computed as 45 and flagged. ISCN writes that `45,X,-Y`. Tolerating odd notation
is the cheaper mistake; refusing `45,X,-Y` is the expensive one.

## Characters that are not ISCN

ISCN's symbol list (Chapter 3) is closed. For a karyotype it comes to letters, digits, and
`, ; : ( ) [ ] < > / + - ~ ? .` and the multiplication sign. Anything else arrived from
somewhere: a stray keystroke, a bullet or footnote mark pasted out of a question paper, a
character mangled by a PDF.

There is no ISCN rule to teach about them beyond that they are not karyotype notation, so
the app names the character, removes it, and offers what is left. Stripped in two places,
like the trailing period: the repair string, and the text actually parsed. Otherwise the
field the stray landed in still reports itself as unreadable and one stray character
produces two messages, the second about a rule the reader never broke.
`der(13;14)(q10;q10) %14` was being reported as an unsupported `or` alternative, which
sent a student reading about an ISCN feature she had never used.

The cleaned string does not have to be correct, only further along. The fix machinery
re-parses it and says whatever is wrong next.

## Breakpoints on one chromosome

ISCN 4.2.1 h: "If the rearrangement involves a single chromosome the breakpoints are not
separated by a semicolon (;), e.g., inv(2)(p23q11.2), del(4)(p15.3p16.1), r(18)(p11.2q23)".
The semicolon separates *different* chromosomes (4.2.1 g), so one inside a
single-chromosome rearrangement announces a chromosome that is not there.

`del(15)(q11.2;q13)` is why this is a check and not a tolerated spelling. The two sides
parse as separate breakpoint groups, a deletion takes its bands from the first group
alone, and the drawing came out as a terminal loss from 15q11.2 with the second
breakpoint dropped. It drew, said nothing, and the decode described a larger deletion
than the one that was typed. `dup`, `r`, `trp` and a within-chromosome `ins` had the same
hole; `inv` was told instead that an inversion needs two bands, which is a rule the
reader had not broken.

A comma between the bands is the same mistake and gets the same repair. `joinSameChrom`
runs **before** the comma-inside-parentheses rule, which would otherwise answer
`del(15)(q11.2,q13)` with the semicolon form and teach the opposite of 4.2.1 h.

Scoped to a token that is an operation followed by two adjacent groups, so a derivative
chain (`der(9)del(9)(p11)t(9;22)(q34;q11.2)`) is never touched: its sub-operations carry
their own chromosomes. The chromosome group is skipped when it holds a separator of any
kind, so `t(9,22)(q34;q11.2)`, which names two chromosomes with a typo, is left for the
comma rule.

Applied in `parse()` as well as in `diagnose()`, like the trailing period: the repair
alone leaves the operation to be parsed from the text as typed, and one mistake would
produce two messages.

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
| `dic` | one breakpoint per chromosome, ISCN 5.5.4 a: "two breakpoints are specified" |
| `idic` | one band, ISCN 5.5.4 b: "a single breakpoint on sister chromatids" |

What made this worth a rule rather than four checks is that the drawing was invented
silently. The explanations are where it showed: `inv(9)(p11)` came out as "the segment
between 9p11 is flipped end-for-end (paracentric)", which invents both a second endpoint
and a classification, and `dup(1)` as "the segment  is present twice".

`dic` and `idic` joined the table on 2026-08-28, from a live report. `46,XX,idic(15)` had
been drawing a whole, untouched, single-centromere chromosome 15 under the caption
`der(15)`, with nothing on the page to say the breakpoint was missing: a NORMAL chromosome
standing in for a two-centromere one, which is the worst shape this gate exists to stop.
`dic(9;20)` was worse again, because the second chromosome left the figure entirely.

A `?` now suppresses the arity message, alongside a bad band. ISCN 4.2.1 k writes `?`
exactly where a chromosome or a breakpoint was not determined, and 5.5.4 f v prints
`47,XY,+dic(17;?)(q22;?)` verbatim, so the group the `?` stands in is empty on purpose.
The `?` explains itself a line above; "so it needs two breakpoints" underneath asked the
reader to supply what the laboratory could not. `t(9;?)(q34;?)` had been doing this since
the rule shipped; adding `dic` is what surfaced it.

`r(13)`, `i(X)`, `add(19)`, `der(X)` and `rob(13;14)` are deliberately NOT in the table.
Each reads sensibly with the breakpoints left off, real reports write them that way, and
refusing valid ISCN is the worse failure. Adding one of them needs a better reason than
symmetry, and `test/parser.test.js` pins each of them as drawable so the table cannot grow
by accident.

## Recombinant chromosomes

`rec` is the only operation whose written form states half of what it is. ISCN 5.4.3.2 c:
"In a recombinant chromosome (rec) there is a duplication and deletion of material. In the
ISCN description the duplication (dup) is explicitly stated, and the deletion is inferred."
So a decode that echoes the notation faithfully tells the reader the half that is *not*
driving the phenotype. `classifyRec` derives the deleted segment and the decode names both,
with the sentence saying outright which one the string left out.

The shape comes from ISCN's own detailed form rather than from reasoning about meiosis:

| written | detailed form (5.5.15 d i) | drawn as |
| --- | --- | --- |
| `rec(6)dup(6p)inv(6)(p22.2q25.2)` | `rec(6)(pter→q25.2::p22.2→pter)` | `6pter→6q25.2`, then `6p22.2→6pter` reversed |

`dup(Nq)` is the reflection: the q-distal segment leads as the extra copy, and the backbone
runs from the p breakpoint out to qter. Which arm is duplicated is the *only* difference
between the two strings, so it is the only thing the two geometries may differ in;
`test/rec.test.js` pins both against ISCN's stated meaning, and the two stress cards exist
so a sheet reader can see they are different chromosomes.

**Only the pericentric form is drawn, and that is biology rather than a shortcut.** A
crossover inside a *paracentric* inversion loop gives an acentric fragment and a dicentric
(Thompson & Thompson, 9th ed, Fig 5.12A), not a duplication-and-deletion chromosome, so
there is nothing of this shape to draw. Guessing one would be the expensive mistake here:
the invented figure would look exactly like the pericentric one that is real. The refusal
teaches the meiosis instead. Insertion-derived `rec` (5.5.15 d ii, iii) is a different
geometry again and is still undrawn, with a message that says which half is missing.

A recombinant is **monocentric**. `buildRecombinant` asserts `hasCen` on exactly one piece
rather than inferring it from coordinates, for the reason in the derivative-centromere
tests: a breakpoint inside a centromere band resolves to that band's midpoint and carries
real `acen` material onto the far side of the join.

**`dmat` / `dpat` / `dinh` are not longer spellings of `mat` / `pat`.** ISCN 4.2.1 g: they
say only *part* of a parental rearrangement was inherited, so the parent's balanced
chromosome and the child's unbalanced one are different chromosomes. That distinction is
the difference between a healthy carrier and an affected child, and it is why every `rec`
ISCN prints carries one. Leaving them out of `QUAL` refused every `rec` in the standard.
Note the alternation in `stripQualifier` is longest-first: `dmat` ends in `mat`.

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

## The segregation figures

Two figure systems live in the app. `pachytene.js` draws the real shape from hg38
coordinates: a reciprocal carrier's quadrivalent as a cross with arms sized from the
actual breakpoints, a Robertsonian as a folded trivalent. `segregation.js` carries an
older schematic system, used when `Pachytene.available()` is false, which happens only if
the ideogram lacks one of the chromosomes.

**A silent fallback is how the old figures came back.** `p10` and `q10` are ISCN's
centromere designations rather than bands, so they are not in the band table, so
`segmentOf` returned null and every whole-arm translocation fell back to the schematic
without a word. It was three carriers, and it read as a regression rather than a fallback,
which is exactly what a silent fallback earns. A whole-arm break now resolves to the
centromere: the two segments are the two arms, the named arm is the piece beyond the break
and therefore the piece exchanged, the other arm keeps the centromere. That rule is also
what makes `t(A;B)(p10;q10)` a different figure from `t(A;B)(q10;q10)`.

`test/pachytene.test.js` pins that every carrier the app accepts draws to scale, so
nothing can quietly drop back to the schematic again, and the whole-arm cases are in the
loop that checks no spindle fiber crosses the plane it is sorted by.

## Known holes

Nothing currently known **in the gate**, and a measured list of unmodelled ISCN features
in `test/iscn-2024-examples.js`. The largest, in order: `?` for uncertain identification
(4.2.1 k), `sl`/`sdl` sideline references (6.3.4), a count read against a ploidy
level other than diploid (6.3.7), and the operations `rec`, `ider`, `tas`, `trc`, `fis`
and `qdp`. Acquired sex-chromosome loss and `c` on the sex complement are now handled;
see the section above. Every entry that was on this list is closed, and
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

Reproduce the whole set with `npm run stress`, which runs a 168-karyotype corpus through
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

**It is also the only place a leftover can be seen.** The corpus is typed into one page in
sequence, exactly as a person uses the app, so a panel left standing from the previous
karyotype shows up here and nowhere else: a unit test parses one page's markup, and a
cold page load of a refused karyotype is clean because nothing has drawn yet. Every case
where nothing drew but a `data-drawing` element was still visible is counted as a mismatch
and named on the console.

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
