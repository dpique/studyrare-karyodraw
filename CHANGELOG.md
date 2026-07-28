# Changelog

Notable changes to KaryoDraw. The site is continuously deployed (every change to
`main` goes live), so entries are grouped by date rather than by version.

## 2026-07-27 (the homepage footer reaches the bottom of the page)

- **The homepage footer sat on a band of empty page.** Its markup was nested inside `<main>`, and
  `main { padding: 18px 0 60px }` painted that 60px of bottom padding below the footer rather than
  above it. Together with the footer's own 48px of bottom padding, 108px of nothing followed the
  last line of the page.

  A page-level footer is not main content, so it now follows `</main>` as a sibling, and `main`
  carries no bottom padding: the space above the footer is the footer's `margin-top`, the space
  below it is its `padding-bottom`, and nothing else renders underneath. The gap above the footer
  rule is unchanged at 34px; the gap below the text goes from 108px to 48px. Landing pages set
  their own bottom padding on `.lp-wrap`, which ends inside `main`, so they are untouched.

  Moving the footer out of `main` broke one thing that had been working by accident: the print
  stylesheet hid the footer only because it hides `main`. The print rule now names `footer`, and a
  test holds it there.

## 2026-07-27 (a missing comma between two signed changes; validation is documented)

- **`-2-21` was reported as "not a change KaryoDraw recognizes".** That names the symptom, not the
  mistake: it is `-2` and `-21` with the comma left out. It now says "Changes are separated by
  commas, so `-2-21` is two of them: `-2,-21`" and offers the repaired karyotype.

  The general "a sign after a digit means a missing comma" rule was rejected earlier for good
  reason: it would turn the modal range `45-48` into `45,-48`, a repair that reads as valid so
  nothing downstream would catch it. The safe subset is to apply it **per field**, and only to a
  token that **already begins with a sign**. Neither dangerous case can be reached: a modal range is
  field 0 and is never examined, and a marker count (`1~3mar`, `1-3mar`) does not begin with a sign.
  Tests pin both.

- **"couldn't read this as a karyotype yet" loses the "yet".** It implied the app was still working
  on it. Nothing changes until the input does. Same for the aria label and the empty state.

- **`docs/VALIDATION.md`**: what the app will and will not draw, why the round-trip check is worded
  the way it is and what it cannot see, the one case that warns without refusing and the evidence
  behind its narrow scope, a list of 14 known holes, and the rules for adding a check.

- **`NEXT_SESSION_HANDOFF.md`**: state, land mines (the CDN serves mixed versions for a few minutes
  after a merge; a guard can pass without the code it guards), and a reproduction script for the
  known holes.

## 2026-07-27 (a sex field the app had to edit is refused, not drawn)

- **`43,XZY,rob(14;21)(q10;q10),-21,-20` dropped the Z, said so, and drew anyway (bug).** The
  message even admitted it: "…is left out of the drawing". That is the class of behaviour that was
  supposed to be gone. It now refuses and offers `43,XY,rob(14;21)(q10;q10),-21,-20` in one click.

- **`46,QQ,+21` was worse: it drew a karyogram with no sex chromosomes at all.** Also refused now.
  No fix is offered, because "QQ" leaves nothing to keep and inventing one would be a guess.

- **The round-trip guard could not have caught either, and that limit is now pinned by a test.** It
  compares each field **as written**, which is exactly what lets `<2n>`, `47-49` and `+8×2` survive
  it. The cost is that a character dropped *inside* a field is invisible to it: `XZY` round-trips
  intact while the Z is discarded within it. A test asserts `unaccounted` is false for that input,
  so the limitation fails loudly if anyone later assumes the round-trip covers everything.

- **Both messages reworded to teach.** "Only X and Y belong in the sex chromosomes, so 'Z' … is left
  out of the drawing" becomes "The sex chromosomes are written with X and Y only, so 'Z' in 'XZY' is
  not one of them", and the no-X-or-Y message now names the forms: "written with X and Y: XX, XY, X,
  XXY".

## 2026-07-27 (gains and losses out of chromosome order are flagged)

- **`43,XY,rob(14;21)(q10;q10),-21,-20` drew silently.** The count is right (43) and the drawing is
  right, but 21 is listed before 20. It now says "Whole-chromosome gains and losses are listed in
  chromosome order, so `-20` comes before `-21`" and offers
  `43,XY,rob(14;21)(q10;q10),-20,-21` in one click. Only the two losses move; the `rob` keeps the
  position it was written in.

- **Scoped hard, and this is the interesting part.** ISCN's listing order also covers structural
  abnormalities, and the first version of this check applied it to them. It then flagged
  `46,XX,+der(5)t(2;5)(q21;q31),-2` as out of order, which is what this app's **own** segregation
  model emits for a 3:1 product, and that model was checked against ISCN 2024 Table 5.
  `segregation.js` had also already reached the opposite conclusion in writing, where its comparison
  key says "ISCN fixes neither [spelling nor order]".

  Rather than resolve that from memory, the check was narrowed to the piece that is not in dispute:
  `+N` and `-N` against each other. Everything else is left alone. A test pins the app's own
  segregation output against the check, so the two halves cannot take opposite positions again.

- **This one warns, it does not refuse.** Every other check added today blocks the drawing, and this
  deliberately does not: listing order changes how a karyotype is written and never what is drawn,
  and confidence in the exact ISCN rule is lower here than for the count and readability rules. A
  wrong call should cost a suggestion, not a refusal.

## 2026-07-27 (the view options are ordered by use; the tour moves to the nav)

- **Show, then Bands, then Style.** Ordered by how often a viewer reaches for each one, which turns
  out to be the same order as the question each answers: which chromosomes, then how much detail,
  then how they are coloured. Two independent principles agreeing on the same order is the reason to
  trust it. Style is close to a one-time preference, so it goes last.

- **The guided tour moves out of the typing path and into the nav.** It was the only full pill in
  the input stack, sitting between the examples and the controls on a row of its own, and most
  people arrive to type rather than to be toured. It is now a nav item beside Guide, which is what
  it is: a destination. That removes a whole row from the header.

  It also **works from every landing page now**, which it never did. The link is `/?tour=1`, and the
  homepage opens the tour after the first draw so it appears over a karyogram rather than an empty
  page. The URL is rewritten without `tour=1` on that first draw, so a refresh or a shared link does
  not silently restart it. The nav is single-sourced in `scripts/build-pages.mjs`, so all 32 landing
  pages, the hub and the two static pages picked it up from one edit.

- **Left as is:** the hint line under the controls still describes the Style toggle while sitting at
  the left, now under Show. The bolded word matches the active button's label, so the connection is
  made by the word rather than the position, and it reads fine.

## 2026-07-27 (a round-trip check, so dropped input stops being found one case at a time)

- **`47~49,XY,+8,,` drew a full karyogram and said nothing at all (bug).** Two commas. The field
  list is filtered for length, so the blanks vanished before anything could object.

- **The parser now reassembles each clone from everything it kept and compares it with what it was
  handed.** Anything that does not come back was dropped without being understood, and the drawing
  that follows would be of a karyotype nobody typed. This is the general net rather than one more
  special case: it catches the class, not that one member of it.

  The comparison is on the fields **as written** (`modalGiven`, `sexGiven`, `ab.raw`, `cellGiven`)
  rather than on re-serialised values, which is what lets case, range spelling (`47-49` and
  `47~49`), `<2n>`, `×2` and `x2`, qualifiers and cell counts survive it untouched. **61 varied
  valid karyotypes round-trip exactly**, which is what makes a mismatch worth refusing on. A
  subclone written `idem`/`sl`/`sdl` is exempt, since its list is deliberately expanded from the
  stemline and can never round-trip.

- **The empty field is repaired, not only refused.** `47~49,XY,+8,,` offers `47~49,XY,+8` and says
  "Each change is its own item between commas, so an empty item is not one. Remove the extra comma."
  A bare refusal on a stray comma would be a poor trade. Commas inside parentheses are untouched;
  they have their own message.

- **The corpus is itself under test.** A guard validated on five inputs is not a guard, so a
  meta-assertion fails the build if the valid list drops below 40 karyotypes or stops exercising at
  least 14 aberration kinds. Also verified: `45<2n>,…` used to be the one valid karyotype that did
  not round-trip, because the ploidy annotation was parsed and discarded; keeping the modal field as
  written fixed that too.

## 2026-07-27 (a karyogram is drawn only for valid ISCN)

- **If it draws, the notation was accepted.** Drawing the nearest plausible reading of a wrong
  designation is not teaching: it lets a mistake look answered, and it destroys the app's use as a
  check, which is what someone writing an exam question needs from it. Three things still drew
  despite not being valid ISCN, and now do not:

  - `46,XY,zzz(9)(q34)` drew a full, normal-looking karyogram. The made-up operation parsed as
    "unknown", the count happened to add up, the band was real, and nothing objected.
  - `46,XY,rob(14;21)(q10;q10),21` (no sign) and `46,XY,inv(9)(p11q13)zzz` (trailing text an
    operation could not consume) drew the same way.
  - A count the app is willing to call wrong, such as `46,XY,rob(14;21)(q10;q10),-21`, drew the
    44-chromosome karyotype it was not asked for.

- **The line is "valid ISCN", not "the app has a complaint".** Two flags, both set by the parser:
  `clone.unreadable` for a part that could not be read, and `clone.countWrong`, set at exactly the
  point the count warning is pushed. `countWrong` is deliberately not `!counts.ok`, because valid
  ISCN can have a tally that cannot be pinned. All of these still draw: `48,XY,+8,inc` and
  `46,XY,inc`, modal ranges `47~49,XY,+8`, mosaics, composites `[cp10]`, and `45<2n>,XY,…`. So does
  the legal-but-unusual `46,XX,t(13;15)(q10;q10)`, with its note offering the `rob()` reading.
  "Unusual" is not "invalid".

- **Two live bugs on valid input fell out of drawing that line.** `48,XY,+8,inc` was offered "Did
  you mean 47,XY,+8,inc?" and would have carried "you wrote 48; the changes listed add up to 47"
  into an exported PNG. Its tally is short by design. Every count claim now reads `countWrong`: the
  warning, the one-click fix, the pill, the image note, and the plain-language summary.

- **A new test file guards the direction that matters more.** Refusing valid ISCN is far worse than
  tolerating invalid ISCN, so `test/draw-gate.test.js` walks every karyotype the app itself ships,
  the guided tour and all the landing pages out of `content/karyotypes.js` plus the example chips,
  and asserts each still draws and still renders without throwing. It also pins that the page's gate
  really uses both flags rather than merely reading them.

## 2026-07-27 (gibberish in a breakpoint is refused, not drawn)

- **`47,XY,del(5)(zzqewdf2315.2)` drew a karyogram (bug).** It also offered "Did you mean
  `46,XY,del(5)(zzqewdf2315.2)`?", the same gibberish with the count changed, and explained itself
  as "a terminal DELETION of chromosome 5: everything distal to 5? (out to the tip) is lost". It now
  refuses to draw and says: "'zzqewdf2315.2' in 'del(5)(zzqewdf2315.2)' is not a breakpoint. A
  breakpoint is an arm letter then a band number, like 5p15.2 or 5q31."

  Cause: `splitBands` found nothing band-like and returned an empty list, which left
  `del(5)(zzqewdf2315.2)` **identical to `del(5)`** with no breakpoint written at all. The band
  check in `index.html` could not catch it either, because by the time it looks there is no band
  left to look at. The raw text is now kept when a group yields no band, which is what makes the
  case visible at all. An empty group is still legal: `del(5)`, `r(13)` and `+mar` are untouched.

- **A well-formed band that does not exist is still a different case.** `del(5)(p99)` parses as a
  band, so it reaches the existing check that knows how far 5p actually runs and can name the
  nearest real band. That message is better than "not a breakpoint" and is unchanged.

- **The count message no longer presumes which side is wrong.** "That number is the total count for
  the cell, so it has to match the changes listed after it" pointed the reader at the number. For
  `45,XX,t(13;15)(q10;q10)` the number is arguably right and the operation is what should change,
  which the app itself says in the very next line when it offers `rob()`. It now reads: "That first
  number is the cell's total chromosome count, so either it or the changes needs fixing."

## 2026-07-27 (the count message stops claiming more authority than it has)

- **"but this karyotype describes 46 chromosomes" is gone.** It stated the app's own arithmetic as a
  property of the karyotype. The figure is nothing more than the sum of the copies this app worked
  out, so if that working is wrong the sentence is wrong with exactly the same confidence, and it
  had been wrong three times this week. It now reads: **"The number at the start says 47, but the
  changes listed after it add up to 46 chromosomes. That first number is the cell's total, so the
  two have to agree."** Saying whose sum it is invites the reader to check it, which is both the
  honest claim and the more useful one. The note carried into the PNG and the print sheet was
  reworded to match.

- **It deliberately does not point at the drawing**, tempting as that was, since the figure IS the
  number of copies drawn and the two can never disagree. A bad band such as `47,XY,del(5)(zz15.2)`
  raises this warning and is also refused a karyogram, so "count them below" would sometimes point
  at nothing. A test pins that.

- **A test rejects oracle voice in any message**, alongside the existing parser-voice guard: no
  warning may say "this karyotype describes", "this notation describes", or "the karyotype
  is/has/contains". Five test assertions that pinned the old prose were retargeted to assert the two
  numbers and their order instead, so rewording the copy no longer churns them; `message-voice.test.js`
  owns the wording.

## 2026-07-27 (every count claim now reads one flag)

- **`46,XY,rob(14;21)(q10;q10),21` still offered "Did you mean 45,XY,rob(14;21)(q10;q10),21?".** The
  previous change suppressed the count *warning* for an incompletely read designation but not the
  one-click count *fix*, so the app quietly proposed keeping the signless `21` and changing the
  number that was right. Caught on the deployed build while verifying the fix that preceded it.

- **One flag, `clone.uncounted`, and everything that makes a claim about the count reads it.** The
  warning, the one-click fix, the "written N · drawn M" pill, the note carried into the PNG and
  print sheet, and the plain-language summary all gate on the same thing: was any part of the
  designation left uninterpreted. A tally built from a partial reading is a byproduct of that
  reading, not a statement about the karyotype, and nothing should present it as one. A test asserts
  the flag's value directly so the five consumers cannot drift into disagreeing about the same
  karyotype.

- **Legitimate count fixes are untouched.** `46,XY,rob(14;21)(q10;q10),-21` and
  `40,XY,rob(14;21)(q10;q10),-21` still offer 44, and `45,XX,t(13;15)(q10;q10)` still offers the
  `rob()` spelling.

## 2026-07-27 (an emptied chromosome slot, a signless token, and the drawn count)

- **`44,XY,rob(14;21)(q10;q10),-21` drew no chromosome 21 at all (bug).** That karyotype leaves no
  free 21: one fused into the derivative, one lost. The affected view drops empty slots, on the
  reasoning that an empty slot has nothing to isolate, so the whole point of the karyotype was
  invisible. An empty slot is now kept whenever the karyotype **states** a loss for that chromosome,
  because then the gap is the finding. Chromosome 21 shows its gap in both views.

- **"nullisomy" was wrong every time it appeared, and is gone.** The full karyogram labelled an
  empty slot "nullisomy". A slot only empties two ways and neither is nullisomy: with a stated loss
  the gaps say it (after `rob(14;21)` plus `-21`, 21q is still present on the derivative, so that is
  a monosomy for 21q and not an absence of it), and otherwise every copy was consumed by a
  derivative, as in `43,XY,rob(13;14)(q10;q10),rob(13;14)(q10;q10)`, where both 13q and both 14q are
  present on the two fusions and nothing is missing at all. A probe over the reachable inputs found
  no case where an autosome slot empties with nothing accounting for it, so the label had no correct
  use left. It now reads "none free", which is what is true of the slot.

- **`46,XY,rob(14;21)(q10;q10),21` argued about the count instead of the missing sign.** The
  signless `21` never became an aberration, so it contributed nothing to the tally, the tally came
  out 45, and the app announced "the number at the start says 46, but this karyotype describes 45
  chromosomes" underneath the message that actually diagnoses it. Read as `+21` the stated 46 is
  exactly right. The count warning already stays quiet when a token went unread; that guard now also
  covers a token that never became an aberration at all, which is the same failure by a different
  route.

- **The pill names both numbers: "written 46 · drawn 44".** The drawing is built from the changes
  listed and never from the number at the front, so `46,XY,rob(14;21)(q10;q10),-21` and
  `40,XY,rob(14;21)(q10;q10),-21` produce the same karyogram of 44 chromosomes. "Count doesn't add
  up" did not explain why three different inputs give one picture, and left the drawing captioned
  with a number it does not contain.

  Still drawn rather than refused, deliberately. For `45,XX,t(13;15)(q10;q10)` the picture is the
  whole lesson, and refusing on any count mismatch would delete it. The rule stays: draw what the
  changes describe, and never let the written number sit on the picture unchallenged.

## 2026-07-27 (the warning box teaches the rule instead of reporting on the parser)

- **"was not read" is gone, along with the rest of the parser-voice copy.** The message that
  prompted this read: *"'+21' in 'rob(14;21)(q10;q10)+21' was not read. Each aberration is a separate
  item, so it needs a comma before it: …"*. Read by whom, and so what? The reader here is a learner
  who mistyped a karyotype, and the useful content is the ISCN rule they missed. It now reads
  **"Changes are separated by commas, so '+21' needs one before it: 'rob(14;21)(q10;q10),+21'."**
  Rule first, then the fix, and nothing about the app's internal handling of the text.

  Four more rewritten the same way: *"Only the first part … was read; … wasn't understood"* →
  "KaryoDraw draws one karyotype at a time, so … cannot be included"; *"Couldn't read …"* → "… is not
  a change KaryoDraw recognizes. Changes look like +21, del(5)(p15.2), or t(9;22)(q34;q11.2)";
  *"Don't recognize 'zzz' …"* → "'zzz' … is not an ISCN abbreviation. The ones KaryoDraw draws: …";
  *"Ignored 'Q' in the sex chromosomes"* → "Only X and Y belong in the sex chromosomes, so 'Q' … is
  left out of the drawing".

- **The count warning now names the rule, not just the discrepancy.** Caught by the new test rather
  than by eye: "The number at the start says 45, but this karyotype describes 46 chromosomes" states
  a fact and teaches nothing. A reader who does not already know that the leading number is the
  cell's total count cannot act on it, and that is exactly who is reading. It now adds: "That number
  is the total count for the cell, so it has to match the changes listed after it."

- **A test keeps parser voice out, because it creeps back one message at a time.** 24 deliberately
  broken inputs are parsed, every warning collected, and each checked against a list of phrasings
  that report on the app rather than teach ("was not read", "couldn't read", "failed to parse",
  "unable to", "invalid input", "ignored", "don't recognize", "error"), plus a looser check that
  every message names a rule, a correct form, or an example. It also fails the build on an em dash
  in any message. Verified to fail when a single old message is restored.

## 2026-07-27 (a wrong "count doesn't add up" on a missing comma after rob)

- **`46,XY,rob(14;21)(q10;q10)+21` claimed the count was wrong when it was right (bug).** With the
  comma before `+21` left out, the app offered the correct fix,
  `46,XY,rob(14;21)(q10;q10),+21`, and then listed as the one thing to check: "The number at the
  start says 46, but this karyotype describes 45 chromosomes." That contradicted its own suggestion,
  whose count is 46. The writer's 46 was right: this is translocation Down syndrome. The `+21` had
  been swallowed into the `rob` token, so the app's tally was short by one, not the karyotype.

  The count warning already guards against precisely this, and the reason is written next to it:
  when part of the designation went unread, the stated number is probably right and our tally is the
  thing that is short, and "says 46 but describes 45" reads as a claim about the karyotype that
  sends people hunting an imbalance that is not there. The guard did not fire because **`rob()`
  never recorded its leftover.** `rob()` sets kind `der` (it behaves exactly like
  `der(13;14)(q10;q10)`) but never runs `der()`'s sub-op parsing, so a `kind`-based exemption
  excused it from both leftover reporters and the `+21` was dropped in silence. Keying the exemption
  on the op as written fixes it.

- **The missing comma is now named, which it never was after `rob()`.** `der(13;14)(q10;q10)+14`
  always said "'+14' … was not read. Each aberration is a separate item, so it needs a comma before
  it"; the same rearrangement spelled `rob(14;21)(q10;q10)+21` said nothing at all, leaving a "did
  you mean" whose only visible difference from the input is one comma. A test now asserts the two
  spellings warn identically about the same mistake.

- **`45,XY,rob(14;21)(q10;q10)+21` used to produce no warning whatsoever.** The broken parse
  happened to total 45, matching the stated count, so the case where something really was wrong was
  silent while the case where nothing was wrong shouted. It now reports the missing comma.

- **Genuine count mismatches are untouched.** The guard is about unread text, not about counts:
  `45,XX,t(13;15)(q10;q10)` and `47,XY,rob(14;21)(q10;q10),+21` still say so.

## 2026-07-27 (one cell list behind both karyogram views)

- **The full karyogram and the affected-only view each assembled their own cell list, and drifted.**
  The chromosome drawing was already fully shared (`drawInstance` → `cellHtml` → `alignMode`), but
  each view separately decided *which* cells exist and separately handled markers, double minutes
  and the absent-homolog placeholder. That is the code path that produced a real bug: the
  placeholder for a monosomy shipped in the full karyogram and had to be back-ported to the affected
  view afterwards. A single `cellSpecs(clone, only)` now answers "which cells", for both.

- **A second disagreement surfaced and is fixed.** The two views ordered the sex-chromosome gap
  differently: the full karyogram put it directly after X and Y, the affected row put it last, after
  markers. Visible on `45,X,+mar` and `46,X,+mar`. Both now use the full karyogram's order, since the
  gap belongs to the sex pair rather than to the end of the row.

- **Nothing else moved.** Verified by rendering 36 karyotypes across both views and both themes,
  144 snapshots of the emitted HTML, and diffing against the previous build: 140 byte-identical, and
  the 4 that differ are exactly the `+mar` ordering above, same cells, same markup, same length.

- **The two views keep their own vertical alignment, on purpose.** That part is not a consolidation
  candidate and is now asserted as such. The affected row hangs every cell off one shared centromere
  line, which is the classic karyogram look for a focused row; across 24 chromosomes it would put
  chromosome 1's centromere (about 123 Mb down) on the same line as chromosome 21's (about 12 Mb
  down) and leave a chromosome-length of blank space above every small one.

## 2026-07-27 (Back undoes a view toggle; a count that does not add up travels with the image)

- **Back skipped the Style / Bands / Show toggles entirely (bug).** Measured on production: three
  toggle clicks added **zero** history entries, and one Back left the site. Each toggle rewrites the
  URL and the drawing, so each is a state Back should return to; they were simply not in the set
  that #98 fixed (example chips, the "did you mean" button, conceptus karyotypes). Typing stays on
  `replaceState` on purpose, since one entry per keystroke would fill history with half-typed
  karyotypes, but a toggle is a discrete click and there is no such argument for it. Re-clicking the
  button that is already on re-renders nothing and adds no entry, or Back would replay states that
  look identical. `popstate` already restored all three through `applyUrlView`, so nothing else
  needed to change. Verified: three toggles now give three entries, and three Backs walk them in
  reverse with the buttons restored.

- **A karyotype whose count does not add up now says so in the PNG and the print summary.** The
  policy for drawing questionable input is unchanged and deliberate: the app refuses to draw
  anything it cannot read (nothing parsed, no modal number, a syntax repair on offer, a band that
  does not exist), and does draw the one case where the notation is unambiguous and only the
  writer's own count disagrees with it. For `45,XX,t(13;15)(q10;q10)` the picture is the
  explanation, and refusing would leave a learner with an error and no reason.

  What was missing is that the explanation stopped at the screen. On screen there is a red "count
  doesn't add up" pill and a warning box; the exported PNG carried the karyotype as typed, the
  karyogram, and nothing else, and the print sheet the same. Those are the copies that outlive the
  session and land in slides and question banks, in front of people who never typed the input, so a
  caption reading 45 over a drawing of 46 travelled with no way to tell. Both now carry
  "⚠ you wrote 45; this notation describes 46 chromosomes", and the export canvas grows a line
  rather than drawing the karyogram over it. A mosaic names the clone, since `countFix` is
  single-clone only and a mosaic never gets the one-click fix.

- **The plain-language summary no longer asserts the wrong count as fact.** It read "This result
  shows 45 chromosomes" a few inches above a drawing of 46 in the same print sheet. It still reports
  the count as written, and now adds that this is what it is and what the listed changes actually
  add up to.

## 2026-07-27 (the example chips re-deal on page load; the Shuffle button is gone)

- **The Shuffle chip is removed; the three examples are re-dealt on every page load instead.** It
  shipped earlier today and lasted about an hour. It was a control sitting in the row it was meant
  to shorten, competing with the three chips for the same horizontal space and reading, at a glance,
  like a fourth karyotype to click. A page load is already the moment a viewer arrives with fresh
  attention, so dealing there costs no pixels and no explanation.

- **The deck lives in `sessionStorage`, so refreshing walks the whole list.** Picking three at
  random on each load would show the same two or three by chance and bury the rest, which is the
  failure the deck existed to prevent. Indices are dealt from a shuffled deck whose cursor survives
  a reload, so three reloads surface all seven examples. `sessionStorage` rather than
  `localStorage`: the deck should reset for a new visit, and it is per-tab, so two open tabs do not
  fight over one cursor. Any storage failure (Safari private mode throws on write) falls back to an
  in-memory deck that still shuffles correctly and only loses continuity across reloads. A saved
  deck is discarded when the example list changes length, since it stores indices rather than
  karyotypes.

  Tested against a `sessionStorage` stub over 40 trials: every trial deals a full row of three with
  no repeat inside a row, and covers all seven within three reloads. Verified to fail when the deck
  is swapped for independent sampling.

## 2026-07-27 (every Robertsonian was drawn upside down)

- **`rob(14;21)(q10;q10)` drew der(14) as 90 Mb of inverted 14q above 35 Mb of 21q (bug).** The
  derivative's long arm ran backwards next to the normal 14 standing beside it, which is the exact
  comparison the picture exists to support. It also left the derivative floating above its row,
  because its seam centromere sat far from the normal homolog's.

  Cause: `wholeArmSegments` put `chroms[0]` on top, taking the nomenclature order as a drawing
  order. Those are different things. ISCN says how to WRITE `der(14;21)(q10;q10)`, including that
  the partners are listed lowest-number-first, and says nothing at all about the drawing, which
  `teach.js` already tells the reader ("written lowest-number-first by convention, not by which
  centromere is kept"). The renderer was contradicting its own explanation. And because a q arm in
  the top position has to be flipped so qter points up, naming order decided which arm got inverted.

  The rule that does apply is the one every other chromosome in the karyogram already obeys, and the
  one a cytogeneticist uses on a chromosome cut out of a metaphase spread where no name is
  available: orient by morphology, **short arm up**. Ordering the two retained arms by length puts
  the shorter one on top, so the single unavoidable flip is spent on the shorter arm and the long
  arm reads the same way up as its normal homolog. der(14;21) is now 21q over 14q, and the
  derivative's 14q lines up band for band with the normal 14. rob(13;14) becomes 14q over 13q
  (14q is 90 Mb to 13q's 97 Mb).

- **The mixed-letter case is decided by reversal count, not length.** `der(1;3)(p10;q10)` keeps 1p
  (123 Mb) and 3q (107 Mb), and putting the p arm on top is the only arrangement that flips neither
  arm. A pure length rule would hoist 3q above 1p and invert both to do it, which is strictly worse
  to read, so that drawing is unchanged.

- **Segment order can no longer change what a derivative looks like it IS.** The outline colour and
  the seam centromere used to be read off `segments[0]` / the first centric segment, which only
  happened to be the named chromosome because the named chromosome was drawn first. Reordering the
  arms would have made der(14) outlined in chromosome 21's colour. `drawInstance` now passes the
  label chromosome explicitly. For every other kind of derivative the two agree, so nothing else
  moves.

- **One test changed meaning rather than expectation.** The whole-arm alignment test used
  `rob(13;14)` and asserted that centromere-alignment and bottom-alignment give different shifts, to
  prove the centromere path ran. Under the new orientation they coincide exactly, and that is a
  property worth having rather than a gap: the derivative is filed under the chromosome with the
  longer arm, that arm is drawn at the bottom, so the derivative and its normal homolog end on the
  same arm. The test now asserts the coincidence. The del(1)(q42) test still discriminates the two
  alignment paths.

## 2026-07-27 (a whole-arm acrocentric t gets a note and a rob button; fewer example chips)

- **`46,XX,t(13;15)(q10;q10)` now offers the Robertsonian reading beside the drawing.** The help was
  backwards from the risk: when the count contradicts the `t` (`45,XX,t(13;15)(q10;q10)`) the viewer
  got an amber box and a one-click `rob()` fix, but when the karyotype is internally consistent at 46
  the only hint was the tail of a 60-word decode sentence, below the karyogram and the fold. The
  consistent one is the more convincing picture and therefore the more dangerous one: 46 chromosomes
  with both whole-arm products present is exactly the image that persuades a reader a Robertsonian
  carrier has 46. It now gets a periwinkle "Worth knowing" note above the drawing with a button that
  draws `45,XX,rob(13;15)(q10;q10)`, so the two pictures can be compared in one click.

  Deliberately not the amber warning box, and deliberately "draw it as a Robertsonian instead" rather
  than "did you mean": the input is legal ISCN and the renderer draws it correctly, and warning on
  correct input is how a warning box loses its authority. A test pins that the note and the warning
  never both fire. The count in the offered fix is decremented rather than hardcoded to 45, since
  replacing two derivatives with one fused chromosome removes exactly one chromosome whatever else
  the karyotype carries (`47,XX,t(13;15)(q10;q10),+21` offers `46,XX,rob(13;15)(q10;q10),+21`).

- **The decode explains why `(p10;q10)` and `(q10;q10)` draw the same thing.** Reported as a
  suspected bug, and it is correct behaviour: ISCN's derivative formula is `der(A) = A pter→bandA ::
  B bandB→B qter`, and at the centromere `pter→band` is the whole p arm whichever letter is written,
  so all four spellings give der(A) = Ap+Bq. The letters record which half of the split centromere
  each derivative carries, not which arms join. Two identical drawings from two different inputs read
  as the app ignoring the input, so the decode now says this outright and names the arms each
  derivative carries. A test asserts the prose and the renderer's segments agree, so the sentence
  cannot drift from the drawing.

- **The rob note says why 45 chromosomes is not a monosomy.** "It gives a count of 45" left the
  obvious question unanswered. An acrocentric short arm carries ribosomal RNA gene repeats that the
  other acrocentrics carry as well, which is why a balanced carrier is healthy at 45.

- **The DiGeorge example chip is gone.** A 22q11.2 deletion is about 3 Mb, well under the 5-10 Mb a
  ~550-band karyotype resolves, so it is found by FISH or microarray and not by banding. The guide
  page says exactly that, and the chip drew it as a visibly missing band, teaching the opposite of
  the thing worth learning. A test now holds every chip to the app's own parser (no warning, no
  suggested fix, no note) and requires each to highlight something, and keeps submicroscopic
  syndromes off the list.

- **Three example chips at a time, with Shuffle.** Eight chips wrapped to three rows and pushed the
  karyogram below the fold on a laptop, where the last five are scrolled past unread. Shuffle deals
  from a shuffled deck rather than sampling independently, so repeated clicks walk the whole list
  instead of re-rolling the same two or three, and no example becomes unreachable.

## 2026-07-26 (whole-arm reciprocal translocations had their arms swapped)

- **`t(13;15)(q10;q10)` drew der(13) as 15p+13q, which is der(15)'s content (bug).** Every whole-arm
  reciprocal translocation came out with the two derivatives' material exchanged relative to their
  labels. The giveaway is visual: a whole-arm exchange of q arms should leave each derivative
  dominated by its *partner's* colour, and instead each looked like itself.

  Pre-existing, and the app contradicted itself about it: `segregation.js` calls
  `der(13)t(13;15)(q10;q10)` a partial trisomy for 15q and a partial monosomy for 13q, so the drawing
  carried exactly the arm the text said was missing. A test now asserts the renderer and the
  segregation model agree on the same string, so the two halves cannot drift apart again.

  Cause: `p10` and `q10` both resolve to *exactly* the centromere, so `splitAtBreak`'s positional test
  ("is the breakpoint at or above the centromere?") was degenerate and sent both down the p-side path.
  At a centromeric break both pieces are centric, each carrying half the centromere, so position
  cannot settle it. ISCN settles it by formula: `der(A) = A pter→bandA :: B bandB→B qter`, and at the
  centromere `pter→band` is the p arm whichever letter is written. So a whole-arm derivative keeps its
  own p arm and receives the partner's q arm, and the `p10`/`q10` choice records which half of the
  centromere it carries rather than which arms join. That also settles the mixed case,
  `t(1;3)(p10;q10)`, as der(1) = 1p+3q.

  Ordinary breakpoints were never affected, since away from the centromere position and arm letter
  agree. Robertsonian fusions were never affected either: `der`/`rob` go through `wholeArmSegments`,
  where the breakpoint letters genuinely do name the arms kept, and `rob(13;14)` still gives 13q+14q.

## 2026-07-26 (parental origin: the segregation panel, run backwards)

- **Type an unbalanced karyotype and see the carrier parent it could have come from.** The panel only
  ever worked forwards, from a balanced carrier to its possible conceptions, which is backwards from
  clinic and from the boards: there you are handed the abnormal result and reason toward the parents.
  `46,XX,rob(14;21)(q10;q10),+21` used to show nothing at all. It now names the segregation that
  produced it, offers the carrier parent in both sexes as loadable karyotypes, and embeds that
  parent's own segregation panel with the outcome you typed marked.

  It is the forward model run backwards, not a second enumeration: the small candidate set of carriers
  is generated, the existing `compute()` runs on each, and the ones whose conceptus list contains the
  typed karyotype are kept. So the nomenclature surface stays the one already validated against ISCN
  2024 Table 5, and correctness is a round trip that the tests walk over every derivative-bearing
  product of four carriers.

- **No recurrence-risk numbers, and no claim about which parent.** Both carrier sexes are always
  shown, since nothing in a proband's karyotype says which parent carries it. A test fails the build
  on a percentage or a 1-in-N figure anywhere in the panel: the figures swing on chromosome pair,
  carrier sex and ascertainment, and a wrong one in a teaching tool is worse than none. A Robertsonian
  carrier of 14 or 15 does get one line naming the uniparental-disomy risk, because that is a reason
  to karyotype the parents that a segregation diagram cannot show.

- **A bare aneuploidy still shows nothing.** `45,XY,-21` and `47,XX,+21` have no determinate origin:
  nondisjunction and a carrier parent both produce them. Naming a carrier there would overclaim. See
  `docs/PARENTAL_ORIGIN.md`, which now records what was built and what was deliberately left out.

- **A whole-arm acrocentric `t()` at a self-consistent count is explained in the decode panel.**
  `46,XX,t(13;15)(q10;q10)` is legal, and for two non-acrocentrics it is what you would write, so it
  is not a warning: warning on correct input is how a warning box loses its authority. But for two
  acrocentrics it is almost never what was meant, and the drawing (46 chromosomes, both products
  present) is the picture that convinces a reader a Robertsonian carrier has 46. The decode row now
  says the count stays 46 because both whole-arm products are kept, and names
  `rob(13;15)(q10;q10)` at 45. When the count already contradicts the `t`, the warning box and its
  one-click fix are doing that job, so the decode panel stays quiet.

## 2026-07-26 (an absent autosomal homolog is drawn)

- **An autosomal monosomy shows the gap (bug).** `45,X` has always drawn a placeholder for the
  missing sex chromosome, but an autosomal loss drew nothing, so `45,XY,-21` showed a single
  normal-looking 21 and read as "chromosome 21 is fine". Most visible in the segregation panel's new
  preview, where the monosomy outcomes looked unremarkable.

  The placeholder follows the losses the karyotype **states**, never a copy-number deficit. The two
  are indistinguishable by count: a balanced `rob(13;14)` carrier also has a single drawn 14, but
  there 14q rides on the derivative and nothing is missing, so a placeholder would misstate it.
  Tests pin both directions, including the tertiary monosomy `45,XY,der(2)t(2;5)(q21;q31),-5`, which
  marks 5 and not the derivative-carrying 2. Sex chromosomes keep their existing path, so
  `45,X,-Y` still draws exactly one placeholder.

## 2026-07-26 (preview a conceptus karyotype without leaving the panel)

- **Hover or focus a conceptus karyotype to see it drawn.** Six outcomes in the segregation panel
  differ from one another in two or three chromosomes, and comparing them meant clicking away and
  back. The preview shows the affected-only view, so it draws just what changed: for
  `46,XY,der(14;21)(q10;q10),+21` that is chromosomes 14 and 21, not a whole karyogram.

  Opens on keyboard focus as well as hover, so it is not mouse-only; hover itself is gated on
  `(hover: hover)` so it never fires from a touch. `pointer-events: none` keeps it from ever sitting
  between the pointer and the button, Escape dismisses it, and scrolling or resizing hides it rather
  than leaving it pinned to a stale position. Nothing is available only through the preview: clicking
  still draws and decodes the outcome in full.

- **A chromosomally normal outcome gets no preview.** `46,XY` from alternate segregation has nothing
  to isolate, and twenty-four normal chromosomes in a popover would add nothing to the row's own
  "normal" label.

## 2026-07-26 (Back returns to the previous karyotype; balanced/unbalanced examples)

- **Back works (bug).** Every view was written with `history.replaceState`, so the app never added a
  history entry and Back left the site entirely — from the segregation panel that meant landing on an
  empty tab. Discrete jumps (an example chip, a "did you mean" fix, a conceptus karyotype) now push
  their own entry, and a `popstate` handler re-renders from the URL, so Back and Forward walk the
  karyotypes you visited. Typing still replaces, or one keystroke per entry would fill history with
  half-typed karyotypes; verified that typing adds zero entries.

- **One path for every jump.** The chip, fix-button, and conceptus handlers each did their own
  `input.value = ...; run();`. They now share `loadKaryotype()`, so they cannot drift, and the
  demo karyotype is a named constant instead of a string repeated in two places.

- **Balanced and unbalanced translocation examples.** Replaced the free-trisomy Down chip with a
  pair that reads as one family: `45,XY,rob(14;21)(q10;q10)` (balanced carrier) and
  `46,XY,rob(14;21)(q10;q10),+21` (unbalanced: translocation Down). The carrier notation matches
  `content/karyotypes.js`, so its canonical landing page still resolves. Trisomy 21 remains in the
  Common karyotypes catalog and on its own page.

## 2026-07-26 (whole-arm derivatives sit on the row baseline in the full karyogram)

- **A Robertsonian or isochromosome cell no longer breaks its row (bug).** A whole-arm derivative
  reports a centromere y at its fusion seam, which was then aligned against the normal homolog's
  real p/q boundary. Those two are not the same kind of thing: an acrocentric's centromere sits near
  its top, a fusion's between two long arms, so aligning them dropped the normal homolog 82px down
  its cell (56% of the cell height for `rob(14;21)`) and left the derivative floating above the
  baseline its neighbours sit on. Cells like this now bottom-align in the full karyogram.

  The "affected only" view still aligns on the seam, deliberately: there every cell is hung off one
  shared horizontal centromere line, which is the classic karyogram look, and the seam is the best
  centromere proxy such a derivative has. That behavior was already pinned by tests, all of which
  render with `only:` — the full view was simply never checked. `alignMode()` now makes the
  distinction explicit and is shared by the layout and the cross-cell metrics, so the two cannot
  disagree about what a cell looks like.

## 2026-07-26 (the segregation panel's conceptus karyotypes are clickable)

- **Every conceptus karyotype in the segregation panel loads in one click.** The panel already
  enumerated the karyotypes related to what you typed: a `rob(13;14)` carrier lists
  `46,XY,der(13;14)(q10;q10),+14` as its trisomy 14 product, and `rob(14;21)` lists
  `46,XX,der(14;21)(q10;q10),+21` as translocation Down syndrome. Those were dead `<code>` text, so
  reading the panel and then seeing the outcome meant retyping the karyotype by hand (and mistyping
  it, which is how the parser bug above was found). They are buttons now, on the same `data-k`
  contract as the example chips and the "did you mean" fix, so one delegated listener serves all
  three. Clicking scrolls the drawing into view, since the panel sits well below it.

- **The affordance is stated, not just styled.** A link underline alone was invisible at normal
  viewing size, so the controls row above the modes now says so outright.

## 2026-07-26 (a dropped aberration no longer draws silently; Robertsonian and band help)

Reported by a student preparing for the ABGC boards, who typed
`45,XY,der(13;14)(q10;q10) +14` and got the plain Robertsonian carrier back with no warning at all.

- **Never drop a fragment silently (bug).** `der()` accepts trailing sub-ops (`der(9)t(9;22)(q34;q11.2)`),
  and anything in that position that was not a sub-op used to be discarded without a word, so a
  trailing `+14` vanished and the drawing looked authoritative while missing a chromosome. The der
  branch now tracks what its sub-op scan consumed and reports the remainder by name.

- **Repair a missing comma before a sign.** `der(13;14)(q10;q10)+14` and `t(14;21)(q10;q10)+21` now
  offer `…),+14` / `…),+21` as a one-click fix. A sign is only ever the first character of an
  aberration, so a sign directly after `)` is unambiguous; the rule is anchored on the `)` so modal
  ranges (`45-48,XY`) and marker counts (`1~3mar`) are untouched.

- **Say what is actually wrong.** A missing-comma fragment used to be blamed on "alternatives with
  'or' and uncertainty markers", which was never the problem. That note is now reserved for
  fragments it fits.

- **Stop arguing about the count when part of the input went unread.** "Says 46 but describes 45" was
  a consequence of the dropped `+14`, and it sent the reader looking for an imbalance that was not
  there. Suppressed when any aberration has unread text.

- **Offer `rob()` for a whole-arm acrocentric fusion written as `t()`.** `45,XX,t(13;15)(q10;q10)` is
  the classic error: a `t` keeps both derivatives, so the count stays 46. Instead of bumping the
  stated count to 46 (which endorsed the wrong picture), the fix now corrects the operation to
  `rob(13;15)(q10;q10)` and explains the difference.

- **Make an invalid breakpoint fixable without leaving the page.** An unreal band holds back the whole
  drawing, so the message now carries how far the arm actually runs and the closest band that does
  exist: "Xp31 isn't a real band on chromosome X. Xp ends at Xp22.33." New `Karyo.armExtent` and
  `Karyo.nearestBand`.

## 2026-07-26 (remove em dashes from user-facing text and SEO tags)

- **Remove em dashes, per the house style.** Replaced the em dash in the homepage `og:title` and
  `twitter:title`, the per-page JSON-LD `headline` ("Name: 46,XX" not "Name — 46,XX"), and the
  user-facing decode and segregation-outcome text (`teach.js`, `segregation.js`) with colons or
  periods. The homepage meta description was already em-dash-free (fixed earlier); Google was showing
  a stale cached snippet.

## 2026-07-22 (feedback: drop the debug notice; align and tidy the result columns)

- **Remove the "Most-studied karyotypes" card.** It was a third way to pick a karyotype (after the
  named example chips under the input and the named "Common karyotypes" catalog), but showed bare
  ISCN strings with no condition names, so it was the redundant, least useful one. Removed the card,
  its loader, and the `/api/top` fetch; the draw analytics beacon is unchanged.

- **Polish the footer.** Replaced the single dense dot-separated link line with a two-part layout:
  the brand and a one-line descriptor on the left, the links (feedback, source, Ko-fi) grouped on
  the right, with real spacing and consistent styling. Wraps cleanly on mobile.

- **Flatten the sitebar background.** The page had three background tones (sitebar `#ffffff→#f7f8fb`
  gradient, hero white, gray results). The sitebar gradient was a redundant near-white third tone;
  it now uses the panel white, so the page reads as two clean zones.

- **Tour pill in the sans font.** "Take the guided tour" switched from the display font to the sans
  font, matching the STYLE/BANDS/SHOW controls beside it; the display font stays for headings.

- **Multi-column browse list.** "Common karyotypes" is now a responsive multi-column grid instead of
  one long single-column bulleted list, using the full width of the left column.

- **Remove the "Attached to help us debug…" line** from the feedback dialog. The karyotype and the
  link to the current view are still sent with every report (unchanged), so this only drops the
  redundant on-screen notice and its now-dead styles.

- **Align the two result columns.** The left column's first visible card sat 16px lower than the
  right one: the cards were spaced with `.card + .card { margin-top }`, so the visible card that
  follows the collapsed (display:none) guided-tour card still inherited a top margin, while the
  right column's first card did not. The columns now space their cards with flex `gap`, which
  ignores hidden cards, so both columns start at the same height.

- **Fill the left-column gap with the browse list.** For a simple karyotype the left column ran
  short while the right column's "how to read a chromosome" reference stayed tall, leaving a large
  empty space; the "Common karyotypes, explained" list sat full-width below it. On wide screens the
  browse list (and the meiotic-segregation card) now sit in a `col1-extra` grid item placed in the
  left column's second row, with the right column spanning both rows — so the list fills the gap
  instead of leaving a hole. Source order is unchanged (tool cards → decoded → browse), so the
  single-column mobile layout still shows the decoded panel before the browse list.

## 2026-07-19 (polish: print, spelling, tour UX)

- **Fix the doubled wordmark when printing.** The print stylesheet hid `header.top` and `main` but
  not `.sitebar`, so the site-header "KaryoDraw" printed alongside the print sheet's own wordmark.
  Print now hides `.sitebar` too, leaving a single wordmark.

- **American spelling throughout.** "Neighbours" → "Neighbors" (the Adjacent-2 segregation
  explanation, plus a comment), "Colours" → "Colors", "modelled" → "modeled".

- **Guided tour UX.** The tour no longer strands the viewer on a mismatched karyotype: choosing your
  own karyotype (an example chip, or Draw/Enter) now exits the tour so the panel never shows a
  different karyotype than the one on screen. The "Take the guided tour" button toggles (click again
  to close), and the "Exit tour" button is larger.

- **Trim the hero subhead** to just the one-line description (dropped "Free, no install.").

## 2026-07-19 (SEO: rank in Google Images + keyword-align headings)

- **Serve an indexable karyogram image on every karyotype page.** Each landing page rendered its
  karyogram as inline `<svg>` with no alt text, so the pages could not surface in Google Images for
  the highest-intent queries ("karyotype of / image of `<condition>`"). Pages now embed the karyogram
  as an `<img class="lp-karyo-img">` with descriptive alt (`Karyotype of <name> (<iscn>)`) and
  intrinsic `width`/`height`, falling back to the inline SVG when an image is missing.

- **Per-page social cards.** Every page shared one generic `og:image` (`preview.png`), so a shared
  link showed the wrong karyotype. Each page now sets its own `og:image`/`twitter:image` to a branded
  1200×630 `card.png` (with `og:image:width`/`height`).

- **New image tool `npm run images`.** `scripts/render-images.mjs` (headless Chrome via
  `puppeteer-core`, a dev-only dependency) rasterizes each karyogram to `karyogram.png` (3×) and a
  `card.png`, writing `content/karyogram-images.json`. It is a local step, not run in CI; re-run it
  after adding or changing a karyotype. `renderKaryogram` moved to `scripts/lib/render.mjs` so the
  build and the rasterizer share one renderer.

- **Keyword-aligned headings.** The homepage `<h1>` was the brand wordmark ("KaryoDraw", a term
  nobody searches); it is now "Karyotype diagram maker" (brand demoted to a `<span>`), and the
  `<title>` is front-loaded with the keyword. The hub page targets "karyotype examples".

- **Trim the homepage hero.** Brought the `<h1>` down a step (34px → 28px cap) so it reads as a
  confident label rather than a marketing shout on the tool-first page, and cut the redundant
  subhead clause ("A free karyotype generator that runs entirely in your browser") down to
  "Free, no install."

## 2026-07-18 (SEO: keep crawlers off the API)

- **Disallow `/api/` in robots.txt.** Googlebot was crawling the backend endpoints
  (`/api/collect`, `/api/feedback`, `/api/top`). Those are POST-only machine endpoints, so a
  crawler GET returns 405, which Search Console reports as "Blocked due to other 4xx issue." Adding
  `Disallow: /api/` tells crawlers to skip them, since they are endpoints, not pages. The frontend
  still calls them normally.

## 2026-07-16 (SEO: ship real favicon files)

- **Serve real icon files.** Google was not showing a site icon in search results because the
  favicon was a data-URI SVG, which it does not index. The site now ships real files at the root
  (`favicon.ico`, `favicon.svg`, `favicon-96x96.png`, `apple-touch-icon.png`) and links to them
  with a full icon block, so the KaryoDraw icon can appear next to the result.

- **Inject the full icon block on every landing page.** `scripts/build-pages.mjs` copied only the
  single `<link rel="icon">` line into generated pages. It now carries the whole block, both the
  icon links and the `apple-touch-icon` link, so all 32 karyotype pages, the hub, and the two
  static pages get the real icons.

- **Fix the standalone 404 and the deploy filter.** The `404.html` page is not generated by the
  build, so its data-URI icon was replaced by hand. The four icon files were also added to the
  deploy workflow paths filter so a change to them triggers a deploy.

## 2026-07-15 (segregation: add 4:0 and complete the 3:1 outcomes)

- **Enumerate every 3:1 gamete.** The 3:1 mode listed only the tertiary outcomes (an extra or
  missing derivative). It now also lists the interchange outcomes, where the extra or missing
  chromosome is a whole normal chromosome, so all four ways to split three-to-one appear: two
  interchange trisomies (conceptus `47,+2` / `47,+5` on the translocation background) and their two
  complementary monosomies (`45,-2` / `45,-5`). Each interchange product reads out as a whole
  chromosome trisomy or monosomy, so its viability follows that chromosome (lethal unless it is 13,
  18, or 21). The caption now names tertiary versus interchange instead of attributing the extra
  outcomes only to crossing-over.

- **Add 4:0 segregation.** A fifth mode covers the rarest split, where all four chromosomes travel
  to one pole and none to the other. It draws a to-scale cross with every chromosome pulled to a
  single pole (badge 4) and an empty pole (badge 0), then the two gametes: one disomic for the
  whole quadrivalent (conceptus 48, trisomy for both chromosomes) and one nullisomic (conceptus 44,
  monosomy for both). Both are lost very early. The schematic fallback and the pole-color keying of
  the disomic gamete match the to-scale figure.

- **Tests.** The segregation and pachytene suites now pin the eight 3:1 gametes, the two 4:0
  conceptions, the interchange whole-chromosome imbalance, and the 4:0 cross (four fibers to one
  pole, zero to the other, no fiber crossing the plane). Every emitted karyotype still re-parses
  with no warnings.

## 2026-07-15 (segregation: tune the pull distance and stagger the motion)

- **Say "constitutional" out loud.** The panel is already suppressed for recognized acquired
  (cancer) rearrangements, but the framing now states the assumption plainly: the lead calls the
  carrier constitutional and adds that meiotic segregation applies to a germline carrier, not to
  an acquired, somatic rearrangement. ISCN cannot distinguish the two, so the honest move is to
  name the assumption.

- **Set the pull distance and stagger the chromosomes.** Each chromosome now slides 0.30 of the
  way from its centromere to the pole (tuned by eye), straight along its fiber. Pure fraction, no
  cap: the pole sits inside the frame, so a fraction under one never overflows. To keep the four
  from moving as a single blob without letting them drift apart, they share one animation duration
  (so they begin the pull together and reach the pole together, every cycle, with no drift) but
  each follows a slightly different easing curve, so at mid-motion they sit at roughly 46, 48, 52,
  and 54 percent of their travel. The difference is deliberately subtle. Endpoints stay in sync;
  only the path between them varies.

## 2026-07-15 (segregation: slide each chromosome along its spindle fiber)

- **Fix a chromosome drifting off its fiber when pulled.** The "animate the pull to the poles"
  animation moves each chromosome by a capped vector. The cap was applied to the x and y parts
  separately, which bent the slide off the spindle fiber for a steep diagonal pull, so a
  chromosome (for example der(22) heading to the upper-right pole) visibly left its track. The
  cap now scales the whole vector, so every chromosome slides straight along its own fiber toward
  its pole. A new test asserts each pull vector stays parallel to a fiber.

## 2026-07-15 (segregation: keep the centromere on its arm during the animation)

- **Fix a centromere floating off its chromosome.** In the to-scale cross, a centromere whose
  breakpoint sits very close to it (a small offset) was drawn inside the synapsis gap or on the
  distal bar, off the vertical proximal arm. At rest this was easy to miss, but the "animate the
  pull to the poles" animation slid the chromosome away and left the bead floating. The bead now
  seats on the proximal shaft, clear of the gap and the distal bar. Worst cases were a
  centromere-adjacent break such as `t(11;22)(q23;q11)` (chromosome 22) and `t(4;8)(p13;q22)`
  (chromosome 4); a new test asserts every centromere bead sits on its shaft.

## 2026-07-14 (segregation: alternate poles on a diagonal)

- **Tilt the alternate spindle.** In the to-scale cross, alternate segregation now places its
  two poles on the same diagonal as 3:1 (upper-right and lower-left) instead of straight top and
  bottom, so the spindle fibers cross clearly through the center and the two diagonal cards line
  up. The two balanced pairs sit at opposite corners, so the diagonal reads truer to the caption.
  Only the pole positions changed; the segregation is the same.

## 2026-07-13 (segregation: draw the quadrivalent to the real breakpoints)

- **The figure now shows the actual shape of the rearrangement.** The segregation panel
  used to draw every reciprocal translocation as the same schematic square. A new module,
  `pachytene.js`, draws the true pachytene **cross** instead, with each of the four arms
  sized from the real hg38 band positions (`ideogram-data.js`) of the loaded karyotype, so
  a `t(11;22)(q23;q11.2)` comes out lopsided (chromosome 11 large, chromosome 22 small) and
  a `t(2;5)(q21;q31)` comes out nearly symmetric. A Robertsonian fusion has no cross, so it
  is drawn as the **trivalent** folded ninety degrees at its centromere, the fusion long
  arms lying beside the two normal acrocentrics.
- **One division plane, moved to a new position, names each mode.** Every mode draws the
  same shape with the plane where it cuts: alternate crosses its fibers with no straight
  plane, adjacent-1 cuts vertically, adjacent-2 horizontally, and 3:1 brackets the lone
  chromosome with a right-angled plane. A spindle fiber never crosses the plane it is
  sorted by; `test/pachytene.test.js` asserts this as a geometric invariant, along with the
  arm lengths, the pole counts, and that a different translocation makes a different cross.
- **Kept as a second system.** The schematic figures remain in `segregation.js` and are
  used as a fallback when the ideogram lacks a chromosome; nothing was deleted. The gamete
  cards, conceptus karyotypes, viability calls, captions, and the animation toggle are
  unchanged. The four cross units are still individual groups, so the pull animation slides
  each chromosome whole toward its pole.
- Reworded the 3:1 caption so it no longer says "the plate cuts three chromosomes"; it now
  reads that the quadrivalent splits three-to-one instead of two-and-two.

## 2026-07-13 (segregation: draw the ring and the plane it divides along)

- **Show why the modes are named alternate and adjacent.** The segregation panel used
  to list each mode with a small stack of chromosome glyphs and text. It now draws, for
  every mode, the ring of chromosomes and the anaphase-I division that produces it, so
  the naming is visible rather than asserted. The four bodies sit at the corners of a
  square that mirrors the pachytene ring; **alternate** takes the two **opposite**
  corners (its spindle fibers cross), while **adjacent-1** (a vertical division plane)
  and **adjacent-2** (a horizontal plane) each take two **neighbors**. **3:1** sends
  three chromosomes to one pole and one to the other. Each scene marks the two spindle
  poles, counts the chromosomes each receives (2:2, 3:1, 2:1), and draws the dashed
  division plane; a short caption states the reason for the name.
- **Two encodings, kept apart.** Chromosome color still means chromosome of origin, and
  the centromere dot now takes the color of the chromosome the centromere belongs to,
  so a chromosome and its own derivative (homologous centromeres) share a dot color and
  can be tracked. A separate teal/rose accent marks which pole a chromosome travels to;
  each gamete card carries the accent of the pole it leaves from, for the clean 2:2 and
  2:1 divisions. A reading key explains both.
- **Watch them separate.** An "Animate the pull to the poles" toggle slides each
  chromosome along its spindle fiber toward its pole and back, so anaphase I is
  something you watch rather than infer. It is CSS only and honours
  `prefers-reduced-motion`.
- The enumerated gametes, conceptus karyotypes, and viability calls are unchanged (still
  ISCN 2024, Table 5); only the drawing changed. `test/segregation.test.js` gained
  coverage for the scenes, the naming captions, the reading key, and the pole keying.

## 2026-07-13 (segregation: meiosis I framing + somatic caveat)

- **Say when the multivalent forms and separates.** The segregation panel now states
  that the chromosomes pair into the quadrivalent/trivalent as the homologs line up in
  **prophase I** (labeled on the pairing diagram as the pachytene configuration), and
  that the alternate / adjacent / 3:1 patterns are how it separates at **anaphase I**
  (meiosis I). Adjacent-2 is named as a meiosis I nondisjunction of the homologous
  centromeres.
- **Do not show segregation for an acquired (cancer) translocation.** Meiotic
  segregation is a germline event, so drawing it for a somatic tumour translocation is
  a category error. The panel is now suppressed when the drawn translocation is a
  recognized acquired change (the Philadelphia chromosome, and the t(8;21) / t(15;17) /
  t(8;14) / t(14;18) / t(11;14) / t(12;21) leukemia and lymphoma translocations); the
  clinical notes cover that context instead. `teach.js` flags those notes `acquired`,
  and mantle cell t(11;14) and childhood B-ALL t(12;21) gained clinical notes in the
  process. The constitutional carrier keeps the panel, now with no disclaimer text.

## 2026-07-12 (meiotic segregation of translocation carriers)

- **Draw the meiotic segregation of a balanced translocation carrier.** When you
  draw a balanced reciprocal or Robertsonian translocation, a new "Meiotic
  segregation" panel shows how the chromosomes separate at meiosis and what each
  gamete produces. A reciprocal carrier is drawn as a four-body **quadrivalent**
  with its alternate, adjacent-1, adjacent-2, and 3:1 modes; a Robertsonian carrier
  as a three-body **trivalent** with its 2:1 modes. Each mode lists its gametes and
  the resulting conception in ISCN, the partial or whole-chromosome imbalance in
  plain language, and whether it is balanced, unbalanced, or a recognized liveborn
  outcome (for example the translocation form of Down syndrome from a rob(14;21)
  carrier, or Emanuel syndrome from the 3:1 der(22) of a t(11;22) carrier). The
  enumerated segregants follow ISCN 2024, Table 5, and every conception the model
  writes re-parses cleanly. The panel states that it assumes a constitutional
  (inherited) carrier, since an acquired translocation in a tumour is somatic and is
  not transmitted. The chromosomes are colored by origin, the same convention the
  karyogram uses. New module `segregation.js`, covered by `test/segregation.test.js`.

## 2026-07-12 (affected view shows the missing sex chromosome)

- **The "Affected" view now shows the missing sex chromosome, like the full view.**
  For a monosomy (45,X, including a 45,X clone in a mosaic), the isolated view drew
  only the lone X while the full karyogram showed the "missing" placeholder. The
  two views now agree — the affected view shows the absent homolog too, aligned
  with the X.

## 2026-07-12 (tour view, spoken mosaics, missing-chromosome placeholder)

- **The guided tour keeps your view settings.** Style / Bands / Show no longer
  reset between tour steps, so switching to the Affected view (or any toggle)
  carries across the examples instead of snapping back to the default each step.
- **"Hear it" announces a mosaic and its cell counts.** A mosaic now reads
  "Mosaic. 45, X, in 12 cells. Next clone. 46, X X, in 18 cells" instead of
  dropping both the mosaic designation and the proportions.
- **The absent sex chromosome is no longer labeled "?".** For 45,X the placeholder
  still shows "missing," but without the "?" — the karyogram shows the karyotype,
  it does not speculate about whether an X or a Y was lost.

## 2026-07-12 (normalize whitespace in the drawn karyotype)

- **Trim stray spaces once drawn.** A karyotype typed or pasted with spaces (for
  example `46,XY,r(13)(p11q34) dn`) is now shown in its canonical, space-free form
  after Draw, so the extra space no longer lingers in the input box, the drawn
  heading, or the shareable link. The one meaningful space, after a `mos`/`chi`
  prefix, is kept.

## 2026-07-12 (support link)

- **Add a Ko-fi support link.** A quiet "♥ Support on Ko-fi" link in the footer
  site-wide, and a short "KaryoDraw is free and always will be; if it helped you,
  buy us a coffee" line on the About page. This is the only support ask — no
  banners or modals.

## 2026-07-12 (explain qualifiers + marker count in the decode)

- **Spell out the inheritance qualifiers.** `c` (constitutional), `mat` (maternal
  in origin), `pat` (paternal in origin), and `dn` (de novo) were parsed and shown
  in the code column but never explained. The decode now spells each out, e.g.
  `46,XX,del(7)(q22)mat` reads "…is lost (mat = maternal in origin: inherited from
  the mother)," and `…dn` now says "de novo: a new change, not inherited."
- **Decode a numbered marker with its count.** `+2mar` now reads "2 marker
  chromosomes," not "a marker chromosome." A single `+mar` is unchanged.

## 2026-07-12 (Turner label for variants)

- **Do not label a 46-count Turner variant "45,X."** A single-X complement with a
  structural variant — `46,X,i(X)(q10)`, `46,X,idic(Y)`, `46,X,r(X)` — was labeled
  "45,X, Turner syndrome" with a note claiming monosomy X and no second sex
  chromosome, which is wrong for those variants. The clinical note now reads
  "Turner syndrome (45,X and variants)" and describes the spectrum (monosomy X,
  isochromosome, ring, idic(Y), mosaicism). Mirrors the earlier Klinefelter fix.

## 2026-07-12 (declutter the homepage)

- **Move the FAQ to the guide; drop the duplicate About block.** The homepage
  bottom carried an "About KaryoDraw" section that duplicated the `/about/` page and
  a separate FAQ. The About block is gone (the `/about/` page is canonical), and the
  FAQ now lives on the "How to read a karyotype" guide, where those questions belong.
  Its FAQPage structured data is now generated statically from the guide's own
  content (more reliable for search than the previous JavaScript-built version). The
  homepage keeps the "Common karyotypes" links and is otherwise just the tool.

## 2026-07-12 (tolerate stray spaces)

- **Ignore spaces inside a designation.** ISCN is written without internal spaces,
  but copy-paste and typing add them. `46,XY,r(13)(p11q34) dn`, `46,XY,r(13) (p11q34)`,
  and `47, XX, +21` now parse identically to their no-space forms, so a de-novo
  (`dn`) or other inheritance qualifier written after a space is recognized instead
  of reported as "not understood." The one meaningful space, after a `mos`/`chi`
  prefix, is preserved.

## 2026-07-12 (sex-chromosome aneuploidy in the affected view)

- **Isolate the sex chromosomes for a numerical sex-chromosome abnormality.** A
  karyotype like `48,XXXX` (tetrasomy X), `45,X` (Turner), or `47,XXY`
  (Klinefelter) carries its abnormality in the sex field rather than as an
  aberration, so the "Affected" view wrongly said "nothing abnormal to isolate."
  It now flags the sex chromosomes, so the affected view isolates them and
  Highlight colors them. A euploid polyploid (e.g. `69,XXX`, `92,XXXX`) is
  correctly left unflagged, since its sex count matches its ploidy.

## 2026-07-11 (mobile layout)

- **Fix the phone layout.** The karyogram used to stretch the whole page wider than
  a phone screen, which clipped the karyogram itself (chromosomes ran off the right
  edge) and dragged the nav, example chips, and hint text off-screen with it. The
  content column now shrinks to the screen and the karyogram scales to fit, so the
  full karyotype is visible on a phone with no sideways scrolling. The Style / Bands
  / Show controls keep each label attached to its toggle when the row wraps, and
  long example chips wrap instead of clipping. The karyogram also refits on rotation
  and resize. Desktop is unchanged.

## 2026-07-11 (broader ISCN: numbered markers + inc)

- **Numbered and ranged marker chromosomes.** `+2mar` now draws two markers (and
  `+1~3mar`, including the hyphen form Mitelman uses, is accepted) instead of
  reading as an unknown token. `+mar` and labeled `+mar1` are unchanged.
- **The `inc` "incomplete karyotype" flag.** `...,inc` is recognized: it draws the
  stated changes and, because the karyotype is explicitly incomplete, the drawn
  count is not expected to match the modal number, so that mismatch is no longer
  warned about. Validated against 83,881 real karyotypes from the Mitelman
  database: zero crashes, and the share that parses with no warnings rose from
  ~70% to ~75%.

## 2026-07-11 (rate limiting)

- **Rate-limit the public write endpoints.** `/api/collect` and `/api/feedback`
  now enforce a per-IP cap via the Workers Rate Limiting binding, so a scripted
  flood can no longer inflate D1 writes, poison the "Most-studied" board, or spam
  the feedback inbox. `/api/collect` is generous (120/min) so a classroom behind
  one NAT IP is never blocked and silently drops over-limit beacons; `/api/feedback`
  is tight (20/min) and returns 429. The check no-ops if the binding is missing and
  never throws, so it cannot take an endpoint down.

## 2026-07-11 (audit follow-ups: a11y, backend, content)

- **Accessibility.** The karyogram no longer nests two `role="img"` layers (screen
  readers announced it twice or dropped the label); the container is now a labeled
  group described by the decode panel. Added a visible label on the karyotype
  input and a `prefers-reduced-motion` block that strips transitions and
  animations for users who need it.
- **Feedback digest drains in batches.** A backlog (or a spam burst) can no longer
  leave genuine feedback undigested for days: the daily email now sends in batches
  of 200 until the queue is clear, bounded per run. Added a partial index on
  unsent feedback so the query stays off the full table as it grows.
- **Privacy.** Stopped storing the user-agent on feedback submissions (it was
  written but never shown), and aligned the privacy comments with what is actually
  stored.
- **Clinical notes.** Gene symbols are now italicized and gene fusions use the
  current ISCN double-colon form (BCR::ABL1, PML::RARA, RUNX1::RUNX1T1) across the
  clinical card, the print sheet, and the landing pages. The Klinefelter label no
  longer reads "47,XXY" for a 48,XXXY karyotype.

## 2026-07-11 (crash hardening)

- **Never let a typed karyotype freeze the browser.** Three inputs could crash or
  hang the tab instead of drawing a warning: an unbounded copy multiplier
  (`+21×100000000`), an absurd modal number read as a huge ploidy (`46000000,XY`),
  and a large `dmin` count. Each allocated one object per copy. Copy counts are now
  capped at 50 (with a warning) and ploidy is capped at octaploid, so these render
  instantly with a clear message.
- **Empty or comma-only input no longer throws.** A field-less clone (for example
  `,`) now returns the full model shape, so the invalid-state message shows instead
  of a `TypeError` from the downstream renderer.
- **A first-clone `idem` with no stemline no longer doubles its own aberrations.**
  `47,XX,idem,+8` used to resolve `idem` to itself and apply `+8` twice; it now
  flags the missing stemline and counts the change once.
- **Copy-link fallback is non-blocking.** When the async clipboard API is
  unavailable (older browsers, non-secure contexts, or a permission rejection), the
  link now copies via a hidden field or shows a "press Cmd/Ctrl+C" hint, instead of
  a blocking `prompt()` dialog.

## 2026-07-11 (evening)

- **Draw a real centromere on whole-arm and mirror derivatives.** A Robertsonian
  `der` and an isochromosome meet their arms at the seam; that seam now renders an
  actual centromere constriction (a hatched band + the p/q line), so you can see
  where the centromere is instead of reading an unlabeled fusion line.
- **Line every affected chromosome's centromere up on one horizontal line.** In
  the "affected only" view, each chromosome is offset so all centromeres (and a
  Robertsonian's fusion seam) sit on a shared line, with the labels on a common
  baseline below — the classic karyogram look, where the acrocentrics hang from
  the line and the metacentric Robertsonian sits centered on it. The full
  karyogram view is unchanged (it still bottom-aligns so the number row lines up).

## 2026-07-11 (latest)

- **Centromere-align isochromosomes and whole-arm derivatives on their fusion
  seam.** These derivatives meet their two arms at the seam between their
  segments, where the centromere(s) sit, but the renderer reported no centromere
  y for them — so their cells bottom-aligned instead of centromere-aligning. The
  renderer now reports that seam as the centromere y, so an `i(X)(q10)` lines up
  its centromere with the normal X's centromere (p+q next to q+q), and a
  Robertsonian `der` lines up on its fusion seam — the same centromere-alignment
  every other cell uses. This supersedes the earlier bottom-align fallback for
  these specific cases; cells that still have no centromere on any copy keep the
  fallback.

## 2026-07-11 (later)

- **Accept the standard `idem` subclone form that omits the repeated sex field.**
  `46,XY,t(9;22)(q34;q11.2)[15]/47,idem,+8[5]` is the usual way to write clonal
  evolution — `idem` sits in the sex-field position and stands in for the whole
  stemline, sex included. The parser used to demand an X/Y there ("idem has no X
  or Y") and drop the inheritance, leaving the subclone miscounted. It now reads
  `idem` / `sl` / `sdl` in that position and inherits the stemline's sex.
- **Coach a bare chromosome number toward a sign.** A lone `8` in the aberration
  field now suggests "+8 for a gain or −8 for a loss" instead of the generic
  "couldn't read" message.

## 2026-07-11

- **Fix chromosome alignment inside a cell when a copy has no centromere line.**
  A homolog is normally centromere-aligned against its derivative. A whole-arm /
  Robertsonian derivative (and an isochromosome) has its centromere at a segment
  edge, so no centromere y is reported; the cell used to silently fall back to
  top-alignment, floating the short normal homolog high while its neighbor sat on
  the row baseline. It now bottom-aligns those cells to the same baseline the row
  uses (`align-items: flex-end`), so the normal homolog, the derivative, and the
  neighboring chromosomes all line up. Deletions/duplications (both copies have a
  centromere) still centromere-align as before.

## 2026-07-10 (later)

Complete the ISCN karyotype system — the last shorthand that was previously out
of scope now parses, draws, and decodes:

- **Clonal evolution `idem` / `sl` / `sdl`.** A subclone written with `idem`
  (or `sl`) now inherits every aberration of the stemline (the first clone), and
  `sdl` inherits the preceding sideline. `46,XX,t(8;21)(q22;q22)/47,XX,idem,+8`
  draws and counts correctly (47) instead of silently dropping the shared
  `t(8;21)` from the second clone.
- **Range modal numbers.** `47~49,XY,+8,+21` accepts any count inside the range
  without flagging a mismatch; the decode explains the range.
- **Copy-number multiplier `×N` / `xN`.** `+8×2` adds two copies; the decode reads
  "2 extra copies of chromosome 8".
- **Amplification `hsr` and `dmin`.** A homogeneously staining region draws as a
  vivid amplified block on the chromosome; double minutes draw as small
  extrachromosomal fragments and, being acentric, are not counted in the modal
  number.
- **Geometry audit.** Re-checked isochromosomes, whole-arm and reciprocal
  translocations, rings, dicentrics, and inversions against the expected arms; all
  land correctly (the whole-arm fix from earlier covered the one real error).

## 2026-07-10

- **Fix the whole-arm / Robertsonian derivative geometry.** A whole-arm fusion
  (`rob(13;14)(q10;q10)`, `der(13;14)(q10;q10)`, `dic(…)(q10;q10)`) was routed
  through the reciprocal-translocation path, which grafted the donor's *short*
  arm onto the derivative (`der(13)` came out as 14p + 13q). It now joins the two
  arms named by the breakpoints — the two long arms, 13q + 14q, with both short
  arms lost, as a Robertsonian actually looks.

## 2026-07-09

- **Recognize `rob`, the preferred ISCN spelling of a Robertsonian
  translocation.** `45,XX,rob(13;14)(q10;q10)` and `46,XX,rob(14;21)(q10;q10),+21`
  (translocation Down syndrome) now draw the whole-arm fusion and count correctly,
  exactly like the equivalent `der(13;14)(q10;q10)`.
- **Accept constitutional and inheritance qualifiers** (`c`, `mat`, `pat`, `dn`).
  They are stripped and remembered instead of breaking the aberration they trail,
  so `47,XY,+21c` stays a trisomy and `del(22)(q11.2)mat` still draws the deletion.
- **Draw insertions faithfully.** An `ins` used to render as an untouched normal
  chromosome; now an interchromosomal `ins(5;2)(p14;q22q32)` lengthens the
  recipient with the donor segment spliced in and shortens the donor, and an
  intrachromosomal `ins(2)(p13q21q31)` shows the length-preserving internal move.
- **Draw dicentrics and isodicentrics correctly.** A two-chromosome
  `dic(13;14)(q13;q22)` now fuses into a single body with two centromeres and
  counts 45 (was drawn as a reciprocal translocation and miscounted); an
  `idic(X)(q13)` renders as a mirror image about its breakpoint.
- **Apply the extra operations in a `der()` chain.** `der(9)del(9)(p12)t(9;22)`
  now shows the `del(9)(p12)` trim as well as the translocation, instead of
  silently dropping the deletion.
- **Decode the whole `der()` chain in plain English.** The token-by-token
  explanation now names the extra `del`/`dup`/`inv` on a derivative, not just the
  translocation, so the words match the drawing (for example, `der(9)del(9)(p12)
  t(9;22)` reads "…with the end of chromosome 22's long arm attached. It also
  carries a terminal deletion at 9p12.").

## 2026-07-07

- Draw duplications faithfully: a `dup` now lengthens the chromosome and splices
  the duplicated segment in tandem, instead of only shading it on a normal-length
  chromosome. The breakpoint order sets the orientation, so a direct duplication
  (`dup(1)(q22q25)`) shows the copy in the same orientation and an inverted one
  (`dup(1)(q25q22)`) mirrors it end-for-end. A triplication (`trp`) adds two
  copies. The decode now names an inverted duplication as such.

## 2026-07-06

- Consolidate the page footer into the About section: fold the ISCN citation,
  band-data source, and StudyRare attribution ("developed and maintained by
  StudyRare") into About in plain language, link ISCN to its DOI there, and trim
  the footer to a single line.
- Email a daily digest of new feedback via a scheduled cron (Resend). It is
  inert until the sending settings are configured, and marks feedback as sent
  only after the email is accepted, so nothing is dropped on a failure.
- **Parser:** recognize Robertsonian and whole-arm derivatives, isodicentrics,
  insertions, and triploid or tetraploid ploidy when reconciling the chromosome
  count against the modal number.
- **Parser:** warn when an `or` alternative or other trailing text is not
  understood, instead of silently dropping it.
- Speak the breakpoints for ring and duplication karyotypes.
- Paper: expanded use cases and a new Scope and limitations section.
- **Accessibility:** make the example karyotypes keyboard-operable buttons, add a
  visible focus outline to every control, label the karyogram and band map for
  screen readers, group the view controls with `aria-pressed` state, and announce
  drawing and parse results through polite live regions.
- Add a "Report a problem" link on the site, plus GitHub issue and pull-request
  templates that ask for the karyotype and a shareable link.
- Serve a branded 404 page for unknown page addresses.
- Fit polyploid karyotypes (for example `92,XXXX`) inside the card instead of
  letting the wide karyogram spill over the sidebar.
- Add an on-site "Send feedback" form so anyone, with no account, can report a
  problem or an unexpected drawing. It attaches the current karyotype and a link
  to the exact view automatically, and posts to a new `/api/feedback` endpoint
  that stores the message privately (and can ping a chat webhook if configured).
- Add a "Most-studied karyotypes" panel: an aggregate, anonymous list of the
  most-drawn karyotypes, shown as clickable chips. A karyotype appears only after
  many draws across several distinct days, so single-session repeats cannot
  inflate or spam the list; the panel shows rank order only, with no counts, and
  is served from a daily-cached read endpoint. The auto-loaded demo no longer
  counts toward usage.

## 2026-07-05

- Draw ring chromosomes as an actual ring: the retained material wraps into an
  annulus sized by circumference, with the centromere and the fusion point marked.
- Reject a designation whose breakpoint band does not exist on its chromosome
  (for example `r(12)(p13q32)`) with an explanation, instead of drawing a
  misleading fallback.
- Add cookieless, no-PII usage analytics (Cloudflare Worker plus D1).
- Auto-deploy to Cloudflare on push to `main`; auto-sync brand colors from the
  canonical `studyrare-brand` kit.
- SEO: meta description, Open Graph and Twitter cards, structured data,
  `robots.txt`, `sitemap.xml`, and an on-page About section.
- Cite ISCN 2024; link the GitHub repository and StudyRare; open links in a new tab.
- Align same-length rearrangements (inversions) flush at both ends, and mirror the
  hatch direction inside inverted segments.
- Remove the redundant "+1" gain badge and the duplicate copy-link button.

## 2026-07-04

- Open-source the tool under the MIT license.
- Add the JOSE application-note draft and a dependency-free ISCN parser test suite.

## 2026-07-03

- Model n-way (three-way and larger) translocations in the render, decode, and
  outline.
- Shareable deep-link URLs, image copy and download, and a one-page printable
  summary.
- Rename KaryoScope to KaryoDraw; host on Cloudflare.

## 2026-07-01 to 2026-07-02

- Initial teaching-first karyogram tool: highlight and realistic views, a
  band-resolution control (~400, ~550, ~850), hatched heterochromatin, distinct
  breakpoint markers, audio pronunciation, coaching error messages, the StudyRare
  brand kit, and the Affected or All view toggle.
