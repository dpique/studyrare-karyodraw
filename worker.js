/* KaryoDraw Worker.
 *
 * Serves the static site (via the ASSETS binding) and handles two endpoints:
 * POST /api/collect records an anonymous usage event to D1, and GET /api/top
 * returns the most-drawn karyotypes for the on-page "Most-studied" panel.
 *
 * Privacy: no cookies, no account, no IP address, no user-agent, no identifier
 * is stored. We keep only the karyotype drawn (capped), whether it parsed, the
 * view settings, a coarse country from Cloudflare, and the referring host. The
 * write is best-effort and never blocks or fails the user's request.
 */

// Thresholds for the public "Most-studied" list. A karyotype only appears once
// it has been drawn many times (an anonymity floor) AND across several distinct
// days (so one person hammering one string in a single session cannot inflate or
// spam a result onto the board). Both are tunable; raise as traffic grows.
const TOP_MIN_DRAWS = 20;
const TOP_MIN_DAYS = 3;
const TOP_LIMIT = 15;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/collect") {
      if (request.method !== "POST") return new Response("method not allowed", { status: 405 });
      // Read the body here, before returning; it is not reliably readable inside waitUntil.
      let body = null;
      try { body = await request.json(); } catch (_) { body = null; }
      const country = (request.cf && request.cf.country) || null;
      ctx.waitUntil(record(body, country, env));
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/api/top") {
      if (request.method !== "GET") return new Response("method not allowed", { status: 405 });
      return topResponse(request, env, ctx);
    }
    const res = await env.ASSETS.fetch(request);
    // Serve the branded 404 page for unknown page navigations (not missing images
    // or other assets, which should keep their plain 404). Preserves the 404 status.
    if (res.status === 404 && request.method === "GET" &&
        (request.headers.get("accept") || "").includes("text/html")) {
      const page = await env.ASSETS.fetch(new URL("/404.html", request.url));
      if (page.ok) {
        return new Response(page.body, {
          status: 404,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
    }
    return res;
  },
};

function cap(v, n) {
  return typeof v === "string" && v ? v.slice(0, n) : null;
}

// GET /api/top — the ranked "Most-studied" list. Cached at the edge for a day so
// D1 is queried at most about once per day per location. Only ever returns the
// karyotype strings in rank order; no counts, no dates, no geo.
async function topResponse(request, env, ctx) {
  const cache = caches.default;
  const cacheKey = new Request(new URL("/api/top", request.url).toString(), { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  let items = [];
  try {
    items = await topKaryotypes(env);
  } catch (e) {
    console.error("top query failed:", e && e.message);
  }
  const res = new Response(JSON.stringify({ items }), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
  // Cache even an empty result, so an early-days empty board is not re-queried
  // on every request. It expires within a day and refills as usage accrues.
  ctx.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}

async function topKaryotypes(env) {
  // Group case- and space-insensitively so "46,XX" and "46, xx" count together;
  // display an actual typed variant (MIN) rather than the normalized key. Rank by
  // distinct days first so broadly-used examples lead. ts is epoch ms; ts/86400000
  // is the UTC day bucket.
  const rs = await env.DB.prepare(
    "SELECT MIN(karyotype) AS k, COUNT(*) AS n, COUNT(DISTINCT ts/86400000) AS days " +
    "FROM usage WHERE type='draw' AND parsed=1 AND karyotype IS NOT NULL " +
    "GROUP BY LOWER(REPLACE(karyotype, ' ', '')) " +
    "HAVING n >= ? AND days >= ? " +
    "ORDER BY days DESC, n DESC, k ASC LIMIT ?"
  ).bind(TOP_MIN_DRAWS, TOP_MIN_DAYS, TOP_LIMIT).all();
  return (rs.results || []).map((r) => r.k).filter(Boolean);
}

async function record(b, country, env) {
  if (!b) return;
  const type = b.type === "pageview" ? "pageview" : "draw";
  // Keep the karyotype capped for storage, but record the full length so we can
  // see whether the cap is ever hit (SELECT count(*) WHERE len > 512).
  const len = type === "draw" && typeof b.k === "string" ? b.k.length : null;
  try {
    await env.DB.prepare(
      "INSERT INTO usage (ts, type, karyotype, parsed, style, bands, show_mode, country, referer, len) " +
      "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(
      Date.now(),
      type,
      type === "draw" ? cap(b.k, 512) : null,
      type === "draw" ? (b.ok ? 1 : 0) : null,
      cap(b.style, 16),
      cap(b.bands, 8),
      cap(b.show, 16),
      country,
      cap(b.ref, 80),
      len
    ).run();
  } catch (e) {
    console.error("usage insert failed:", e && e.message);
  }
}
