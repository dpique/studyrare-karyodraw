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
