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

- `/karyotype/<slug>/` is served as a static asset.
- `/k/<notation>` 301-redirects to the canonical `/karyotype/<slug>/` when a curated
  page exists, else 302s to the interactive tool `/?k=<notation>`. `/k/` alone → hub.
- Homepage `?k=<notation>` views set their `<link rel=canonical>` to the matching
  landing page (client-side), so tool views consolidate onto one canonical URL.

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

- **Search Console API access.** The data above has to be read out of the web UI and
  pasted in by hand, because a session has no credential for the property. Enabling the
  Search Console API once (OAuth client or a service account added to the property) would
  let a session pull `/karyotype/*` impressions directly and pick what to write next from
  data. This is a one-time setup by the owner; nothing in this repo depends on it.
