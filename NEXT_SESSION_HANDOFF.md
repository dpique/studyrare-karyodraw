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

The domain core is in good shape and is not the work. What follows is a standing
assessment of the delivery pipeline, written 2026-08-08 after an audit Dan asked for.
**These are candidates with reasoning, not a queue.** Pick what fits the session, argue
with any of it, and reorder freely. Each entry says why it matters and what is genuinely
uncertain about it, because the uncertainty is usually the interesting part.

### 1. The test suite is a habit, not a gate

`.github/workflows/` holds `deploy.yml` and `sync-brand.yml`. Neither runs `npm test`. All
425 tests pass only because whoever is at the keyboard chooses to run them, and a push
that skipped them would deploy identically. This got worse on 2026-08-08: disconnecting
Workers Builds removed the only check that appeared on pull requests, so PRs now show
none at all.

A workflow running `npm test` on `pull_request` and on `push` to main is roughly fifteen
lines and turns the suite from documentation into an actual gate. Highest leverage item
here by a wide margin, and the cheapest.

Open question worth deciding rather than assuming: whether it also runs `npm run build`
and fails on drift, which would have caught the generated-page staleness that item 2
removes entirely. If item 2 happens first, this question dissolves.

### 2. Build output is committed, and every diff pays for it

Each generated landing page is 51KB, of which 43KB is the app stylesheet inlined
verbatim, across 35 pages: about 1.7MB, a quarter of the repo, all derivable. The cost is
visible in the log. The two-line tour fix (#147) landed as 38 files changed; the footer
change (#148) as 44. It also produced a real bug class, the stale-committed-page race that
#154 closed.

`deploy.yml` already regenerates everything before deploying, so the committed copies are
redundant. Gitignoring them is now unblocked, since the second deploy path that had no
build step is gone.

Two things to work out first. Five test files read the generated pages, so this needs a
`pretest` hook or an equivalent, which is a small decision with taste in it. And the PNG
karyograms are a different case that should stay committed, because rendering them needs a
browser and CI never runs `render-images.mjs`.

### 3. The interface is tested by grepping its own source

About 83 assertions regex over raw `index.html`. That tests the shape of markup rather
than whether anything works, and it fails both ways: brittle against formatting, silent
when behavior breaks. `test/tour-launcher.test.js` is the honest example. It asserts that
`KD_PAGE_COUNT` does not appear in the file, which is a proxy for the thing that matters,
that clicking the button opens the tour.

`puppeteer-core` is already a dependency and `scripts/render-images.mjs` proves headless
Chrome works here, so a small browser-driven layer is within reach. Worth keeping the
regex style where the artifact really is text: meta tags and structured data in
`test/seo.test.js` are correctly tested that way.

Judgement call for whoever takes it: converting all 83 is probably not worth it. The tour
launcher is, because that bug reached production past this exact style of test.

### 4. The interface has no `VALIDATION.md`

`docs/VALIDATION.md` works because it records reasoning, not just rules, and it covers the
parser, the gate, and their messages. Nothing plays that role for the interface. The
preferences below were all decided on 2026-08-08 and currently survive only as changelog
narrative, test comments, and Claude's private memory, which is invisible to everyone
else. They are recorded here so they do not decay before someone decides where they
belong. Whether that is a new `docs/INTERFACE.md`, a section appended to `VALIDATION.md`,
or something else is genuinely open.

- **Feedback affordances stay prominent.** The "Not right?" flag leads the karyogram
  toolbar in amber. An earlier pass moved it below the figure, quiet and bottom-right, and
  that was reversed: a reader deciding whether a drawing is trustworthy should meet the
  way to say so before the ways to export it. Feedback volume is how wrong renders get
  caught, and this site teaches, so a wrong figure is the worst failure mode.
- **One button shape per row; color carries meaning.** The same toolbar used to mix
  bordered buttons with borderless text links, which read as two unfinished designs. Group
  actions by purpose using position, distinguish them by color, never by shape.
- **A tooltip earns its place by saying what the label cannot.** The copy-link tooltip
  restated its own button and then promised the link "updates as you edit", which was read
  as a claim that an already-pasted link keeps tracking edits. It does not.
- **A figure states what the notation states.** A mosaic draws every cell line side by
  side at one scale, each under its own notation and cell count. Any `model.clones[0]` is
  the bug shape here.
- **Show the rendered result before shipping visual changes.** The flag placement above
  was shipped, seen, and reverted. One preview screenshot would have made it one round.

### 5. Background, lower urgency

`index.html` is 2155 lines holding CSS, markup, and about 1400 lines of JS. This is the
root cause of item 3: none of that JS can be imported, which is why tests grep it and why
`test/examples.test.js` lifts a block out of the file and evaluates it without a `window`.
The extraction pattern is already proven, since `iscn-parser.js`, `karyo-render.js`, and
`teach.js` are the well-tested parts precisely because they are separate. This is a real
refactor, not an afternoon, and it should wait until items 1 through 3 are done.

`scripts/stress-corpus.mjs` still has no mosaic entries, which is why the #148 figure bug
survived to production. A few (`mos`, `chi`, three clones, a mosaic whose clones disagree
about a structural change) are the cheapest guard against the next figure that draws one
cell line and looks entirely fine. Otherwise the corpus grows from real reports: a
karyotype a student sends in, or notation nobody has typed. Largest unmodelled families
are `ish`/`nuc ish` and `arr`; unsupported ISCN 2024 examples sit in
`test/iscn-2024-examples.js`.

Also consider whether this file belongs in the repo at all. It exists to prime a session
rather than to serve the product, it was publicly served until #153, and the case for
moving it into Claude's memory directory is decent.

### Open asks for Dan, not code

- **Search Console API access.** Query and impression data has to be pasted in by hand
  today. Enabling the API once, via OAuth client or a service account added to the
  `sc-domain:karyodraw.com` property, would let a session pull `/karyotype/*` performance
  directly and choose what to write next from data rather than guesswork.
- **Confirm the single deploy path held.** #154 produced exactly one Cloudflare deployment
  where every previous merge produced two. That is one data point; the next merge should
  show the same shape before treating it as settled.

## Resume prompt
> Read `NEXT_SESSION_HANDOFF.md` and `docs/VALIDATION.md` in
> `/Users/dpique/Desktop/projects/active/studyrare/karyodraw`, then run the Verify-first
> commands before acting on anything in them. Follow the rules at the end of
> `docs/VALIDATION.md`: refusing valid ISCN is worse than tolerating invalid ISCN, a
> written-form fault keeps its drawing, read the ISCN 2024 PDF before encoding a rule, and
> show every new guard failing when its fix is reverted. Worktree + squash PR, then confirm
> the deploy with three consecutive fetches of the changed file.
