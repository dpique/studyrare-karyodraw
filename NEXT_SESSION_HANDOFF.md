# KaryoDraw handoff

## Goal
If it draws, the notation was accepted; if it refuses, the whole page says so and the
message teaches the ISCN rule. Standing reference: `docs/VALIDATION.md`.

## Done
PRs #136-#146, merged, deployed and verified live. `CHANGELOG.md` has the reasoning per
change: the cell count in `[ ]`; breakpoints on one chromosome (4.2.1 h); a repair that is
a karyotype you could have typed; `+` in `?k=`; the mobile first screen (first chromosome
888px -> 643px at 390x844); the tour out of the nav; the banding-resolution note on
submicroscopic deletions; and the two that mattered most, a refusal now clearing every
panel and whole-arm `(p10;q10)` figures drawing to scale instead of silently falling back
to the old schematic system. 412 tests pass; `npm run stress` flags nothing across 140.

## In flight
Nothing. Clean tree, no open PRs, no worktrees, no stale branches, level with `origin/main`.

## Land mines
- **Silent fallbacks are how old work "comes back".** `Pachytene.available()` false swaps
  in a second, older figure system. `test/pachytene.test.js` now asserts every accepted
  carrier draws to scale. Never add a fallback without a test that it cannot be reached.
- **The gate sweeps `[data-drawing]`.** A new panel without the attribute survives a
  refusal showing the previous karyotype. `test/layout.test.js` requires it of every card.
- **`result.normalized` is the whitespace pass only.** It goes into the input box, so
  anything else it strips becomes a fault the app complains about invisibly.
- **`test/examples.test.js` lifts the deck out of `index.html`** and runs it with no
  `window`: nothing touching `window` may sit between `var DECK_KEY` and `paintExamples`.
- **`gh pr merge --delete-branch` errors** because main is checked out in the primary
  worktree. The merge still succeeded; delete the branch by hand once `origin/main` moves.

## Verify first
```
cd /Users/dpique/Desktop/projects/active/studyrare/karyodraw
git fetch -q origin && git status -sb && git log --oneline -3 && git worktree list
npm test 2>&1 | tail -5
curl -s "https://karyodraw.com/pachytene.js?cb=$RANDOM" | grep -c wholeArm   # expect 1+
```

## Next
No known holes in the gate. Work comes from adding to `scripts/stress-corpus.mjs`: a
karyotype a student reports, or notation nobody has typed. Largest unmodelled families are
`ish`/`nuc ish` and `arr`; unsupported ISCN 2024 examples sit in `test/iscn-2024-examples.js`.

## Resume prompt
> Read `NEXT_SESSION_HANDOFF.md` and `docs/VALIDATION.md` in
> `/Users/dpique/Desktop/projects/active/studyrare/karyodraw`, then run the Verify-first
> commands before acting on anything in them. Follow the rules at the end of
> `docs/VALIDATION.md`: refusing valid ISCN is worse than tolerating invalid ISCN, a
> written-form fault keeps its drawing, read the ISCN 2024 PDF before encoding a rule, and
> show every new guard failing when its fix is reverted. Worktree + squash PR, then confirm
> the deploy with three consecutive fetches of the changed file.
