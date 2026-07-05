/* KaryoDraw Worker.
 *
 * Serves the static site (via the ASSETS binding) and handles one endpoint,
 * POST /api/collect, which records an anonymous usage event to D1.
 *
 * Privacy: no cookies, no account, no IP address, no user-agent, no identifier
 * is stored. We keep only the karyotype drawn (capped), whether it parsed, the
 * view settings, a coarse country from Cloudflare, and the referring host. The
 * write is best-effort and never blocks or fails the user's request.
 */
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
    return env.ASSETS.fetch(request);
  },
};

function cap(v, n) {
  return typeof v === "string" && v ? v.slice(0, n) : null;
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
