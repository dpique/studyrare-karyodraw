# KaryoDraw handoff

## Goal
Close the holes where KaryoDraw draws a karyogram for input that is not correct ISCN, so
"it drew" means "the notation was accepted" and the app is usable as a check.

## Done
PRs #102-#118, all merged and verified live on karyodraw.com. See `CHANGELOG.md` for the
reasoning behind each; `docs/VALIDATION.md` is the standing reference for the draw gate.

- **Renderer:** every Robertsonian was drawn upside down (nomenclature order was being
  used as drawing order); one cell list behind both karyogram views; a stated loss that
  empties a slot now shows its gap, and "nullisomy" is gone (it was wrong every time).
- **Draw gate:** invalid ISCN no longer draws. Blocks unreadable tokens, unreadable
  breakpoints, a contradicted count, silently dropped input, and a sex field the app had
  to edit. `48,XY,+8,inc`, modal ranges, mosaics, composites and `<2n>` still draw.
- **Round-trip check:** the parser reassembles each clone from what it kept and compares
  it with what it was given. Catches dropped fields generally rather than one case at a
  time. 61 valid karyotypes round-trip exactly.
- **Copy:** all messages teach the rule instead of reporting on the parser, and no
  message states the app's arithmetic as fact. Guarded by `test/message-voice.test.js`.
- **UI:** Back undoes a view toggle; view options ordered Show/Bands/Style; the tour
  moved to the nav and now works from every landing page; example chips re-deal per load.
- **Layout (#119):** the homepage footer was inside `<main>`, so `main`'s 60px bottom
  padding painted below it. The footer is now a sibling of `main`, `main` has no bottom
  padding, and `test/layout.test.js` holds the three invariants.
- **Print (#121):** all 36 generated pages printed a blank sheet, because they inherit the
  app page's print rule that hides `main` and have no `#printsheet` to replace it. They now
  print their own article; the app page is unchanged.
- **Draw gate (#122):** `69.XX` drew 69 chromosomes with both sex slots "missing" and said
  nothing. Any separator but a comma before the sex field made the designation one field, so
  the sex chromosomes were never read. The comma is now required and repaired, and a clone
  stating no sex field at all is refused (`clone.sexMissing`). See `docs/VALIDATION.md`,
  including the note on why the known-holes survey could not have found this.

367 tests pass (`npm test`). Verified live with a headless browser after each merge.

- **Stress sheet:** `npm run stress` types the 138 karyotypes in `scripts/stress-corpus.mjs`
  into the real page and writes `karyotype-stress-test.html` — drawing, warning box, decode,
  clinical card and segregation panel per case, with a Good / Not good control and a Markdown
  export. Built for the review a test suite cannot do: whether the wording teaches and whether
  the picture is right. See `docs/VALIDATION.md`, "The stress sheet".

## In flight
Nothing. Working tree clean, no open PRs, no worktrees, `main` at the last merge.

## Verified against ISCN 2024
`test/iscn-conformance.test.js` runs 394 karyotype-format examples printed in ISCN 2024
through the page's gate; 302 are accepted and the rest are recorded in
`test/iscn-2024-examples.js` with the ISCN section naming the feature they need. The PDF
is at `/Users/dpique/Desktop/colorado/books/core_resources_abgc/2024_ISCN.pdf`; extract it
with `pdftotext -layout` and search it. **Find the section before adding a check.** Writing
the gate from memory shipped `del(5)(p15.3p15.2)` being told to reverse itself, which is
the opposite of Table 3 and 5.5.2 b.

## Next: the ISCN features the app does not model
From `test/iscn-2024-examples.js`, largest first. Flip `supported: true` as each lands; the
conformance test reports any that start passing so the flag cannot drift.

1. **`45,X,-Y` is called a count error.** ISCN 5.3.1.2: for an acquired sex-chromosome
   loss the sex field states what REMAINS, so the app counting the loss again lands one
   short. 16 examples. Note the twist that makes it fiddly: with `c` the field is the
   constitutional complement and the change does apply on top (`44,Xc,-X`), and gains are
   always additive (`47,XX,+X`). Loss of Y is among the commonest cancer karyotypes there
   is, so this is the top item.
2. **`?` for uncertain identification** (4.2.1 k), 17 examples: `+?8`, `?del(1)(p36.1)`,
   `del(5)(q?)`, `del(1)(q?2)`. A legal ISCN character everywhere a designation can go.
3. **`c` on the sex complement** (4.2.1 e), 10 examples: `46,XXYc,-X`. Interacts with 1.
4. **`sl`/`sdl` sidelines** (6.3.4) and counts read against a non-diploid ploidy (6.3.7).
5. **Operations not modelled:** `rec`, `ider`, `tas`, `trc`, `fis`, `qdp`.

## Closed
Every entry that was on the known-holes list in `docs/VALIDATION.md`, plus the three the
stress sheet found and the label bug found while building it. All 138 karyotypes in the
corpus now do what the notation says they should; `npm run stress` flags none.

- **Breakpoint arity** is one rule in `ARITY`/`arityProblem` (`iscn-parser.js`) covering
  `inv(9)(p11)`, `t(9;22)(q34)`, `t(2;7;5)(q21;p13)`, `ins` with two breakpoints, and the
  two that state none at all (`del(5)`, `t(9;22)`). `r(13)`, `i(X)`, `add(19)`, `der(X)`
  and `rob(13;14)` are deliberately outside it and pinned as drawable.
- **Refused:** `t(9;9)`, `rob(1;2)`, `+0`/`+99`, `47,idem,+8`, `46<3n>,XY`, `[0]`.
- **Warned, still drawn:** reversed interstitial breakpoints, a change listed twice
  instead of `x2`, `c` on the count field. `dup` is excluded from the order rule because
  there the order is meaningful.
- **Repaired:** `46,YX` offers `46,XY`, reordering and never editing the letters.
- **`+r`** parses as a marker carrying a ring shape: it draws as a ring labelled `r` and
  the decode says what separates it from `r(13)`.
- **Pachytene margins** are sized from their labels (`rob(13;14)` was drawn `b(13;14)`),
  and the gamete glyph shrinks its type to its fixed box. Both use `Karyo.textWidth`.

## Land mines
- **The CDN serves mixed versions for 1-3 minutes after a merge.** A single post-deploy
  check can pass against a stale asset. Fetch the changed file 3x and require all 3 to
  contain the change before believing it. **Three agreeing curls are still not enough for
  the browser check:** a page load fetches its own `<script src>` on a separate cache path
  and can run the old file while every cache-busted curl returns the new one. It looks
  exactly like a half-working fix, one input behaving and a sibling input not. Always set
  `page.setCacheEnabled(false)` in the verification browser.
- **`assert.deepEqual` fails across the vm realm** the tests load the modules into.
  Compare `.length` or `.join()`, not arrays.
- **A guard can pass without the code it guards.** Two tests here did: one checked flags
  were *read* rather than *used*, one asserted an unreachable state. Always revert the
  fix and confirm the new test fails.
- **`splitTop` only reaches paren depth 0**, which is what makes the comma repairs safe.
- **`clone.countWrong` is not `!counts.ok`.** `48,XY,+8,inc` has a short tally by design.
- **The round-trip compares fields as written**, so it cannot see a character dropped
  *inside* a field. That is why the sex field needs its own check.
- **The print rule hides elements by name.** `@media print` lists `header.top, main,
  footer, #tooltip, .sitebar`. Anything moved out of `main` leaves the print sheet unless
  it is added to that list; the footer did exactly that. Check `emulateMediaType('print')`
  after any change to the page skeleton.
- **`index.html` is partly generated.** `scripts/build-pages.mjs` rewrites the KD:PAGES,
  KD:NAV and KD:FOOT blocks with its own indentation, and copies the whole `<style>` into
  every landing page. Run `npm run build` after touching either, and run it twice to
  confirm the output is stable.

## Verify first
```
cd /Users/dpique/Desktop/projects/active/studyrare/karyodraw
git status --porcelain && git log --oneline -3 && git worktree list
npm test 2>&1 | tail -5
curl -s "https://karyodraw.com/iscn-parser.js?cb=$RANDOM" | grep -c "unaccounted"
```

## Next
Nothing outstanding on the draw gate. The corpus in `scripts/stress-corpus.mjs` is the
record of what has been looked at, so the next work comes from adding to it: a karyotype a
student reports, or a class of notation nobody has typed yet. `ish`/`nuc ish` (FISH
nomenclature) and `arr` (microarray) are the largest unmodelled families, and both appear
on real reports beside the karyotypes this app already draws.

Note that the survey this file used to carry has been superseded by `npm run stress`, which
covers everything it did and 130 more. It missed `69.XX`, `del(5)` and `t(9;22)` all for
the same reason: it only varied what was inside the parentheses.

## Resume prompt
> Read `NEXT_SESSION_HANDOFF.md` and `docs/VALIDATION.md` in
> `/Users/dpique/Desktop/projects/active/studyrare/karyodraw`, then run the Verify-first
> commands before acting on anything in them. The draw gate has no known holes left: every
> entry that was on that list is closed and `npm run stress` flags nothing across its
> 138-karyotype corpus. Work now comes from adding to that corpus. Follow the rules at the
> end of `docs/VALIDATION.md`, especially that refusing valid ISCN is far worse than
> tolerating invalid ISCN, that a written-form fault keeps its drawing, and that every new
> guard must be verified to fail when its fix is reverted. Ship as a worktree + squash PR
> per the usual workflow and confirm the deploy with three consecutive fetches.
