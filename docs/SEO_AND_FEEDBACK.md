# SEO landing pages + feedback flagging

Two systems added to KaryoDraw.

## 1. SEO landing pages

**Single source of truth:** `content/karyotypes.js`. It holds the curated karyotypes (40 as of 2026-08-09)
(slug, notation, name, aliases, concept, intro, related links) and, for those that
are also tour steps, the tour caption. Both the in-page guided tour
(`window.KDContent.tour()`) and the page generator read from it, so they never drift.

**Generator:** `scripts/build-pages.mjs` (`npm run build`). Reusing the same render
modules the browser uses (loaded in a `vm` shim, like the tests), it:

- writes a static page per karyotype at `karyotype/<slug>/index.html`: unique title,
  meta description, canonical, Open Graph, `MedicalWebPage` + `BreadcrumbList` JSON-LD,
  an `<h1>`, the server-rendered karyogram, the decoded ISCN breakdown, clinical notes,
  and related-page links;
- writes a hub page at `karyotype/index.html`;
- injects the homepage "Common karyotypes, explained" list between the `KD:PAGES`
  markers in `index.html`: the guided-tour curriculum only (entries with `tour: true`),
  closed by a "See all N karyotypes" link to the hub whose count is computed, so the
  homepage stays curated while the hub carries every page;
- writes `sitemap.xml` (home + hub + all pages);
- writes `content/k-index.mjs`, the normalized-notation to slug map used by the Worker.

The generator runs automatically in CI before every deploy (`.github/workflows/deploy.yml`),
so `content/karyotypes.js` is always what ships. Its output is **not committed**:
everything it writes is gitignored except the homepage list injected into
`index.html`. The PNG karyograms (`scripts/render-images.mjs`) are the one
committed exception, because rendering them needs a browser and CI does not run one.

**To add or edit a page:** edit `content/karyotypes.js` and commit that alone; the
pages, hub, sitemap, and `k-index.mjs` regenerate in CI (and locally via
`npm run build`, which `npm test` also runs first). If the karyotype is new, run
`npm run images` and commit the two PNGs it writes for the slug.
Validate notations first with the parser if unsure (all must parse with no warnings).

**Routing (worker.js):**

- `/karyotype/<slug>/` is a static asset, but it reaches `worker.js` first. `assets.run_worker_first`
  in `wrangler.jsonc` routes HTML through the Worker and leaves PNGs, scripts, icons, and
  the sitemap on the free asset path. Without it Cloudflare answers any asset-matching
  path from the asset layer and never invokes the Worker, which is how the www redirect
  below shipped in #186 and did nothing until #187. `test/seo.test.js` walks every URL in
  `sitemap.xml` against those patterns, so a new page shape that would bypass the Worker
  fails the build.
- `www.karyodraw.com` and plain `http://` 301 to `https://karyodraw.com`, path and query
  preserved, scoped to the production hostname so local dev is untouched.
- `/k/<notation>` 301-redirects to the canonical `/karyotype/<slug>/` when a curated
  page exists, else 302s to the interactive tool `/?k=<notation>`. `/k/` alone → hub.
- Homepage `?k=<notation>` views set their `<link rel=canonical>` to the matching
  landing page (client-side), so tool views consolidate onto one canonical URL.

**Checking the deployed site: `npm run seo-check`** (`scripts/check-seo-signals.mjs`;
local and on-demand, not in CI, takes an optional origin argument). It fetches the live
homepage and reports the four sources Google reads for a site name, the title length, the
canonical, and the `www`/`http` redirects, exiting non-zero when any of them disagree.

Run it after any deploy that touches the head of `index.html`, and before concluding that
a search-appearance problem is Google's fault. Both such bugs so far were invisible to
`test/seo.test.js`, which reads the repo rather than the deployed site, and both were one
command to see:

- `www` and `http` each answered 200 for days because the Worker was never invoked for
  static-asset paths (#187).
- The `WebSite` node was live and correct while the brand had been stripped from
  `<title>`, so two of Google's four sources said nothing and the result kept printing
  the bare domain (#188).

**Site name.** Google's four sources are the `WebSite` node, `og:site_name`, `<title>`,
and the headings, and its guidance asks that they agree
(<https://developers.google.com/search/docs/appearance/site-names>). Declaring the node is
necessary and not sufficient. Keep the brand spelled identically in all of them, leave
`alternateName` off unless there is a genuine second name for the site (Google falls back
to it when it declines the preferred one, so a description parked there is worse in the
result than the domain), and expect weeks rather than days for a change to appear, since
site names are computed per domain rather than per page.

## 2. "Not right?" feedback flagging

A one-click flag on the karyogram (`#flagbtn`), leading the toolbar on the left in amber:
feedback is a first-class action here, so it sits where the eye lands, not below the
figure. The first click logs a row immediately (the click itself is the signal), then the
dialog invites optional category + detail that enriches that same row by an unguessable
`token`.

"Send feedback" in the footer is the same button on every page, emitted by
`siteFooter()` in `scripts/build-pages.mjs`. The generated pages inline the app's
feedback dialog (lifted verbatim from `index.html` at build time, so the markup cannot
drift) plus a small script that posts to `/api/feedback` with the page's karyotype and
URL, so feedback opens IN PLACE with no navigation. History of this affordance: it
first linked the GitHub issue tracker (wrong audience; students and counselors do not
file issues), then deep-linked the app with `?feedback=1` (still a navigation), and now
opens where the reader already is. The `?feedback=1` deep link remains in the app for
external links. The footer's GitHub "Open source" link is gone by owner decision
(2026-08-10); the About page offers two channels in prose: the in-place dialog (a
`[data-fb-open]` link whose href is only the no-JS fallback) and
`feedback@karyodraw.com`.

NOTE on the email address: it needs Cloudflare Email Routing on the karyodraw.com zone
(dashboard: Email, Email Routing, enable, destination daniel@studyrare.com, custom
address feedback@). As of 2026-08-10 the zone had NO MX records, so mail bounces until
that is enabled; the on-site form is unaffected.

`test/layout.test.js` pins the footer, dialog, script, and the About-page channels;
`test/feedback-inplace-browser.test.js` opens and submits the dialog on built pages in
a real browser; `test/feedback-deeplink-browser.test.js` covers the app deep link. All
dialog rows land in the D1 `feedback` table. No per-event pings; the existing daily
email digest (13:00 UTC, via Resend) is the follow-up channel, and it shows the
category.

`worker.js` `/api/feedback` accepts three shapes: quick flag (returns `{id, token}`),
enrich (`{id, token, ...}`), and general feedback. It keeps a legacy-column fallback
on insert as a safety net, so feedback is never lost even mid-migration.

## Usage analytics + rate limiting

- `/api/collect` writes an anonymous, cookieless usage row (no IP, no identifier) to
  the D1 `usage` table; `/api/top` returns the ranked "Most-studied" list (edge-cached
  a day). See the privacy note atop `worker.js`.
- Both write endpoints are per-IP rate limited via the Workers Rate Limiting binding
  (`RL_COLLECT` 120/min, `RL_FEEDBACK` 20/min; see `wrangler.jsonc` + `overLimit` in
  `worker.js`), so a scripted flood cannot inflate writes or spam the digest.

---

## Owner action items

**Done (recorded here for provenance):**

- **D1 schema + migrations applied.** The `usage` and `feedback` tables exist in prod;
  the feedback `category`/`token` columns are present (migration `001` was not needed,
  they were already there), and the partial index from `002_feedback_undigested_index.sql`
  is applied. `schema.sql` is the current full definition.
- **Feedback digest is live.** `RESEND_API_KEY`, `FEEDBACK_EMAIL_TO`, and
  `FEEDBACK_EMAIL_FROM` are set as Worker secrets; the daily 13:00 UTC digest emails new
  feedback (batched, oldest-first). `FEEDBACK_WEBHOOK` is intentionally left unset (no
  per-event pings).
- **IndexNow** is wired. The key file `7b3f1e9c4a2d6058e1f0b9c3d5a7e2f4.txt` is served at
  the site root and CI pings IndexNow after each deploy. Nothing to do.

- **Google Search Console is verified and reporting.** The `sc-domain:karyodraw.com`
  property returns per-query performance data. As of the week of 2026-07-26 the guide page
  alone drew impressions for its target queries ("how do you read a karyotype", "karyotype
  notation", "interpreting karyotypes"), which is what settled the question of whether the
  generated landing pages earn their keep. They do; keep them.

**Optional, still open:**

- **Search Console API access.** Still no credential in-session, but no longer a blocker:
  Claude for Chrome drives the signed-in web UI and exports the CSV (see the baseline
  section below). The API would only save the two-minute round trip. Nothing in this repo
  depends on it.

## Search performance baseline

**How to refresh.** There is no API credential in-session. Ask Claude for Chrome to open
Search Console → Performance → Search results, set Search type to Web with no other
filters, pick the date range, **toggle on all four metric tiles** (the export silently
drops columns for any tile left off), then Export → Download CSV. It lands in `~/Downloads`
as `karyodraw.com-Performance-on-Search-<date>.zip`, one CSV per dimension.

**First export, 2026-08-18.** Data begins ~2026-07-10, so this is roughly six weeks.

| | value |
|---|---|
| Clicks | 19 |
| Impressions | 1,110 |
| Average position | 37.5 |
| Site-wide CTR | 1.71% |
| Impressions attributable to named queries | 381 (34%) |
| Homepage | 80 impressions, 12 clicks, 15% CTR, position 21.4 |
| `/how-to-read-a-karyotype/` | 214 impressions, position 33.6 (largest pool on the site) |
| `/karyotype/triple-x-syndrome/` | 163 impressions, position 62.2 |
| `/karyotype/marker-chromosome/` | 111 impressions, 2 clicks, position 15.7 (best-ranking page) |
| Biggest single query | `47xxx`, 71 impressions, position 67.9 |

**What it says.** The problem is ranking depth, not metadata. A 1.71% CTR at an average
position of 37.5 is several times what that position normally returns, and the
best-ranking page converts above its expected rate too. Nothing on this site is losing
clicks it had earned. It is not earning the placement in the first place, which is what
external citation and page count move, not titles.

**Most of the demand is from people who do not need a drawing, and the people who do are
where the site ranks worst.** Splitting the 381 named impressions by what the query is
actually about:

| | queries | impressions | share | best position |
|---|---|---|---|---|
| Numerical: trisomies, sex-chromosome counts, `47xxx`, `xx mar` | 60 | 193 | 51% | 7.8 |
| Structural: translocations, inversions, Robertsonians, derivatives, rings, isochromosomes | 31 | 65 | 17% | **23** |
| Notation, how-to, competitor brands | 53 | 123 | 32% | 13.3 |

Half the impressions are somebody asking what a count means. A person who finds `+mar` or
`47,XXX` on a report wants a sentence, not a karyogram, and no title will change that. The
people who genuinely need this tool are the structural third: you cannot see what a
`t(9;22)` or a `rob(13;14)` or an `inv(16)` actually did to the chromosomes without drawing
the derivatives, which is the whole point of the product. And **not one structural query
ranks better than position 23**, so the site is close to invisible to exactly the audience
it was built for, while ranking respectably for searches that will never convert into use.

Corroborating this from `Pages.csv`: the interactive `?k=` views that rank best are all
structural. `45,XX,rob(13;14)(q10;q10)` sits at position 1, `45,XY,rob(14;21)(q10;q10)` at
6, `46,XY,inv(9)(p11q13)` at 6.8, `46,X,i(X)(q10)` at 11. For structural notation the drawn
view is the thing that wins, and Google already agrees.

**So the priority is depth on rearrangements, not breadth on syndromes.** Adding another
trisomy page chases the 51% that does not want the product. Adding and deepening
translocation, inversion, Robertsonian, insertion, and derivative pages chases the 17% that
does, in the one area where there is no incumbent worth the name.

**The trap, so nobody re-walks it.** Two thirds of impressions belong to queries Google
will not name, and the named ones are individually tiny. On 2026-08-18 a session read
"`xx mar`, 26 impressions at position 7.8, zero clicks" as a title problem worth fixing.
It is not: expected clicks at that position and volume is 0.7, so seeing zero happens
about half the time with a perfectly good title. Same error in the other direction on the
guide page, where five phrasings of "how to read a karyotype" were read as five separate
intents worth splitting into separate pages, which would have manufactured the exact
cannibalization the `www` 301 had just cleaned up. Before acting on any single query,
multiply impressions by a plausible CTR for the position and check the result is bigger
than one. Wait for volume, or find the answer somewhere other than this report.
