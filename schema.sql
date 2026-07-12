-- KaryoDraw usage analytics (D1). One row per anonymous event.
-- No IP address, no cookie, no account, no identifier. See worker.js.
CREATE TABLE IF NOT EXISTS usage (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,   -- epoch ms, set server-side
  type      TEXT    NOT NULL,   -- 'draw' | 'pageview'
  karyotype TEXT,               -- capped to 512 chars; null for pageview
  parsed    INTEGER,            -- 1 = drew, 0 = parse failed; null for pageview
  style     TEXT,               -- 'simple' | 'detailed'
  bands     TEXT,               -- '0' | '1' | '99'
  show_mode TEXT,               -- 'all' | 'affected'
  country   TEXT,               -- coarse geo from Cloudflare (request.cf.country)
  referer   TEXT,               -- referring host only, client-supplied
  len       INTEGER             -- full karyotype length before the 512-char cap
);
CREATE INDEX IF NOT EXISTS idx_usage_ts   ON usage(ts);
CREATE INDEX IF NOT EXISTS idx_usage_type ON usage(type);

-- Feedback submitted via the on-site "Send feedback" form (worker.js
-- POST /api/feedback). Voluntary support channel; kept private, never shown.
CREATE TABLE IF NOT EXISTS feedback (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,   -- epoch ms, set server-side
  message   TEXT    NOT NULL,   -- what the person reported (capped 4000); '' for a bare flag
  email     TEXT,               -- optional, for a reply (capped 200)
  karyotype TEXT,               -- the karyotype they were viewing (capped 512)
  url       TEXT,               -- shareable link to that exact view (capped 500)
  ua        TEXT,               -- deprecated: user-agent no longer stored (privacy); null on new rows
  country   TEXT,               -- coarse geo from Cloudflare
  digested  INTEGER,            -- 1 once included in a daily email digest; else null
  category  TEXT,               -- 'banding' | 'explanation' | 'parse' | 'other' | null
  token     TEXT                -- opaque id: lets a quick "Doesn't look right?" flag be enriched with detail
);
CREATE INDEX IF NOT EXISTS idx_feedback_ts ON feedback(ts);
-- The daily digest reads WHERE digested IS NULL; a partial index keeps that scan
-- off the full table as feedback grows (rows are never deleted).
CREATE INDEX IF NOT EXISTS idx_feedback_undigested ON feedback(ts) WHERE digested IS NULL;
