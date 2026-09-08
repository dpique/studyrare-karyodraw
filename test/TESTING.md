# Running the tests

`npm test` builds the generated landing pages (the `pretest` hook, because five
test files read them and generated output is not committed) and then runs every
file under `test/`.

## The two flags on the test script

```
node --test --test-concurrency=2 --test-timeout=120000 test/*.test.js
```

Both were added on 2026-09-08 after two failures in one day, and both address a
failure mode rather than a preference. Neither is a style choice to be tidied away.

### `--test-concurrency=2`

Fourteen of the test files drive a real browser, and each one launches its own
Chrome. The runner schedules files in parallel up to the core count, so on a
four-core GitHub runner that meant up to four headless Chromes rendering SVG
karyograms while competing with node for the same four cores. Pages then took
longer to reach the state a test was waiting for than the thirty seconds
`waitForSelector` allows by default, and the test failed for lack of a CPU rather
than for anything about the code.

It cost about six seconds locally (17s to 23s on a ten-core machine) and buys back
the class of failure where a green branch reports red.

Observed twice on 2026-09-08: `band-snap-browser.test.js` on PR #269, and two
subtests of `origin-alert-browser.test.js` on PR #272. Both passed locally in about
two seconds and passed on re-run with no change to the code.

### `--test-timeout=120000`

There was no global timeout, so a browser test that wedged did not fail; it hung.
On PR #269 that stalled the whole job for ten minutes until it was cancelled by
hand, and the runner then had to terminate orphaned Chrome processes. A hang is now
a failure after two minutes, which is roughly sixty times the slowest legitimate
test.

## What is still worth doing

Each of the fourteen browser files carries its own copy of the Chrome-path lookup,
the static file server and the launch options. That duplication is why neither
timeouts nor launch options can be adjusted in one place, and it is the reason the
two fixes above are process-level flags rather than something more precise. Folding
them into one helper under `test/helpers/` is the obvious cleanup and has not been
done.

## Running a single file

The flags are on the npm script, not in a config file, so a direct invocation does
not inherit them:

```
node --test test/imbalance-browser.test.js
```

That is usually what you want when iterating. Add `--test-timeout=120000` if you are
chasing a hang rather than a failure.

## Browser tests skip without Chrome

Each browser file looks for Chrome at a short list of paths and skips itself when it
finds none, so the suite still runs on a machine without it. `CHROME_PATH` overrides
the search. A skipped browser test reports as passing, so a run that finds no Chrome
is quieter than it looks: check for `skipped` in the summary before trusting a green
suite to have exercised the browser paths.
