# KaryoDraw handoff

## Goal
If it draws, the notation was accepted; if it refuses, the whole page says so and the
message teaches the ISCN rule. Standing reference: `docs/VALIDATION.md`.

## Done
PRs #136-#151, merged, deployed and verified live. `CHANGELOG.md` has the reasoning per
change. Through #146: the cell count in `[ ]`; breakpoints on one chromosome (4.2.1 h); a
repair that is a karyotype you could have typed; `+` in `?k=`; the mobile first screen
(first chromosome 888px -> 643px at 390x844); the tour out of the nav; the
banding-resolution note on submicroscopic deletions; a refusal now clearing every panel;
and whole-arm `(p10;q10)` figures drawing to scale instead of silently falling back to the
old schematic system.

2026-08-08, #147-#151, all site chrome and one real render bug:
- **#148, the mosaic figure.** The condition page drew `mos 45,X[12]/46,XX[18]` as plain
  monosomy X, because the shared renderer took `clones[0]` and stopped. Every cell line now
  draws, side by side at one scale, in the page figure, the app's Show = affected view, and
  the print sheet. Verified for 2 and 3 clones and for `chi`.
- **#147, the guided tour.** A stale `KD_PAGE_COUNT` reference threw on every page load,
  killing the tour button, the `?tour=1` deep link, and the pageview beacon downstream of it.
- **#148/#149/#150/#151, chrome.** One footer everywhere (was a bespoke prose footer on
  generated pages), one sitebar mark (`BRAND_MARK`, injected via `KD:BRAND`), one button
  style in the karyogram toolbar with the amber flag leading it, and a copy-link tooltip
  that states the settings ride along instead of promising a link that keeps updating.

424 tests pass; `npm run stress` flags nothing across 166.

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
- **`model.clones[0]` silently misreads every mosaic.** It is the shape of the #148 bug:
  the code runs, draws, and states something false about a karyotype with more than one
  cell line. Three paths now walk all clones (`scripts/lib/render.mjs` `renderKaryogram`,
  `renderPrintSheet` and `decodeList`); `test/mosaic-figure.test.js` pins them. Treat any
  new `clones[0]` as a bug until proven single-clone by construction.
- **One deploy path, and it must stay one.** Until 2026-08-08 the Cloudflare Workers
  Builds Git integration was connected alongside `.github/workflows/deploy.yml`, with no
  build command and watch paths `*`. It deployed every push, skipped
  `scripts/build-pages.mjs`, and shipped whatever generated files were committed, racing
  the Actions deploy by about a second. A `content/karyotypes.js` edit committed without
  a rebuild would have gone live stale with every check green. It is disconnected. Two
  consequences to expect: PRs now show no checks at all (there is no Actions test job, so
  run `npm test` locally, which the ship workflow does), and docs-only pushes no longer
  deploy, which costs nothing now that every internal file is in `.assetsignore`.
- **A new CHANGELOG section can swallow the one below it.** Both an agent and a human
  (me) did this on 2026-08-08, replacing the previous PR's `##` heading and absorbing its
  bullets. After editing the changelog, run `grep -n '^## ' CHANGELOG.md | head -5` and
  confirm the section you did NOT touch is still there.

## Verify first
```
cd /Users/dpique/Desktop/projects/active/studyrare/karyodraw
git fetch -q origin && git status -sb && git log --oneline -3 && git worktree list
npm test 2>&1 | tail -5
curl -s "https://karyodraw.com/pachytene.js?cb=$RANDOM" | grep -c wholeArm   # expect 1+
curl -s "https://karyodraw.com/karyotype/mosaic-turner-syndrome/?cb=$RANDOM" \
  | grep -c "46,XX\[18\]"                                                    # expect 1+
```

## Next
No known holes in the gate. Work comes from adding to `scripts/stress-corpus.mjs`: a
karyotype a student reports, or notation nobody has typed. Largest unmodelled families are
`ish`/`nuc ish` and `arr`; unsupported ISCN 2024 examples sit in `test/iscn-2024-examples.js`.

The corpus has no mosaic entries, which is why #148 survived to production. Adding a few
(`mos`, `chi`, three clones, a mosaic whose clones disagree about a structural change) is
the cheapest guard against the next figure that draws one cell line and looks fine.

One open ask for Dan, not code: there is no Search Console access from the CLI, so query
and impression data has to be pasted in by hand. Enabling the Search Console API once
would let a session pull `/karyotype/*` performance directly and decide what to write next
from data instead of guesswork.

## Resume prompt
> Read `NEXT_SESSION_HANDOFF.md` and `docs/VALIDATION.md` in
> `/Users/dpique/Desktop/projects/active/studyrare/karyodraw`, then run the Verify-first
> commands before acting on anything in them. Follow the rules at the end of
> `docs/VALIDATION.md`: refusing valid ISCN is worse than tolerating invalid ISCN, a
> written-form fault keeps its drawing, read the ISCN 2024 PDF before encoding a rule, and
> show every new guard failing when its fix is reverted. Worktree + squash PR, then confirm
> the deploy with three consecutive fetches of the changed file.
