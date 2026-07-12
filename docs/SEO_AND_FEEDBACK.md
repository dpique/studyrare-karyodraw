# SEO landing pages + feedback flagging

Two systems added to KaryoDraw.

## 1. SEO landing pages

**Single source of truth:** `content/karyotypes.js`. It holds ~32 curated karyotypes
(slug, notation, name, aliases, concept, intro, related links) and, for those that
are also tour steps, the tour caption. Both the in-page guided tour
(`window.KDContent.tour()`) and the page generator read from it, so they never drift.

**Generator:** `scripts/build-pages.mjs` (`npm run build`). Reusing the same render
modules the browser uses (loaded in a `vm` shim, like the tests), it:

- writes a static page per karyotype at `karyotype/<slug>/index.html` — unique title,
  meta description, canonical, Open Graph, `MedicalWebPage` + `BreadcrumbList` JSON-LD,
  an `<h1>`, the server-rendered karyogram, the decoded ISCN breakdown, clinical notes,
  and related-page links;
- writes a hub page at `karyotype/index.html`;
- injects the homepage "Common karyotypes, explained" list between the `KD:PAGES`
  markers in `index.html`;
- writes `sitemap.xml` (home + hub + all pages);
- writes `content/k-index.mjs`, the normalized-notation to slug map used by the Worker.

The generator runs automatically in CI before every deploy (`.github/workflows/deploy.yml`),
so `content/karyotypes.js` is always what ships.

**To add or edit a page:** edit `content/karyotypes.js`, run `npm run build`, commit.
Validate notations first with the parser if unsure (all must parse with no warnings).

**Routing (worker.js):**

- `/karyotype/<slug>/` — served as a static asset.
- `/k/<notation>` — 301-redirects to the canonical `/karyotype/<slug>/` when a curated
  page exists, else 302s to the interactive tool `/?k=<notation>`. `/k/` alone → hub.
- Homepage `?k=<notation>` views set their `<link rel=canonical>` to the matching
  landing page (client-side), so tool views consolidate onto one canonical URL.

## 2. "Doesn't look right?" feedback flagging

A one-click flag on the karyogram (`#flagbtn`). The first click logs a row immediately
(the click itself is the signal), then the dialog invites optional category + detail
that enriches that same row by an unguessable `token`. The footer "Send feedback" opens
the same dialog in general mode. All rows land in the D1 `feedback` table. No per-event
pings — the existing daily email digest (13:00 UTC, via Resend) is the follow-up channel,
and it now shows the category.

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
  the feedback `category`/`token` columns are present (migration `001` was not needed —
  they were already there), and the partial index from `002_feedback_undigested_index.sql`
  is applied. `schema.sql` is the current full definition.
- **Feedback digest is live.** `RESEND_API_KEY`, `FEEDBACK_EMAIL_TO`, and
  `FEEDBACK_EMAIL_FROM` are set as Worker secrets; the daily 13:00 UTC digest emails new
  feedback (batched, oldest-first). `FEEDBACK_WEBHOOK` is intentionally left unset (no
  per-event pings).
- **IndexNow** — wired. The key file `7b3f1e9c4a2d6058e1f0b9c3d5a7e2f4.txt` is served at
  the site root and CI pings IndexNow after each deploy. Nothing to do.

**Optional, still open:**

- **Google Search Console** (speeds up indexing; not required):
  - Add the property `karyodraw.com` at <https://search.google.com/search-console>.
  - Verify with a **DNS TXT record via Cloudflare** (easiest, no code), or uncomment the
    `google-site-verification` meta tag in `index.html` and paste your token.
  - Submit `https://karyodraw.com/sitemap.xml`.
