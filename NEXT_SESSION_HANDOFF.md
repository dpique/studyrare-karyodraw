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

324 tests pass (`npm test`). Verified live with a headless browser after each merge.

## In flight
Nothing. Working tree clean, no open PRs, no worktrees, `main` at the last merge.

## Land mines
- **The CDN serves mixed versions for 1-3 minutes after a merge.** A single post-deploy
  check can pass against a stale asset. Hit twice this session. Fetch the changed file
  3x and require all 3 to contain the change before believing it.
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

## Next: the known holes
`docs/VALIDATION.md` lists 14 inputs that are not correct ISCN and still draw. Nothing is
a regression and none has been attempted. Reproduce the whole set with:

```
node -e '
const fs=require("fs"),vm=require("vm");const win={};const ctx=vm.createContext({window:win});
["ideogram-data.js","iscn-parser.js","karyo-render.js"].forEach(f=>vm.runInContext(fs.readFileSync(f,"utf8"),ctx));
const {ISCN,Karyo}=win;
const drew=k=>{const m=ISCN.parse(k);
 if(!m.clones.length||m.clones.every(c=>c.modalNumber==null)||m.suggestion) return false;
 return !m.clones.some(c=>c.unreadable||c.countWrong||c.unaccounted);};
["46,XY,inv(9)(p11)","46,XY,t(9;22)(q34)","46,XY,t(2;7;5)(q21;p13)","46,XY,del(5)(p15.3p15.2)",
 "46,XY,t(9;9)(q34;q11)","45,XY,rob(1;2)(q10;q10)","46,XY,+0","46,XY,del(5)(p15.2),del(5)(p15.2)",
 "47,idem,+8","46<3n>,XY","46c,XY","46,XY,t(9;22)(q34;q11.2)[0]","46,YX"]
 .forEach(k=>console.log((drew(k)?"DRAWS   ":"blocked ")+k));'
```

The strongest group is the arity ones (`inv` with one breakpoint, `t` with a breakpoint
group per chromosome missing): each operation knows how many breakpoints it needs, so one
check in `parseAberration` covers them all, and the drawing is currently invented.

## Resume prompt
> Read `NEXT_SESSION_HANDOFF.md` and `docs/VALIDATION.md` in
> `/Users/dpique/Desktop/projects/active/studyrare/karyodraw`, then run the Verify-first
> commands before acting on anything in them. We are closing the remaining holes where
> KaryoDraw draws a karyogram for input that is not correct ISCN. Start with the
> breakpoint-arity group (`inv(9)(p11)`, `t(9;22)(q34)`, `t(2;7;5)(q21;p13)`): each
> operation knows how many breakpoints it requires, so it should be one check rather than
> several. Follow the rules at the end of `docs/VALIDATION.md`, especially that refusing
> valid ISCN is far worse than tolerating invalid ISCN, and that every new guard must be
> verified to fail when its fix is reverted. Ship as a worktree + squash PR per the usual
> workflow and confirm the deploy with three consecutive fetches.
