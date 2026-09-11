-- Visitor counting without identifiers (2026-09-11). `visitor` is a one-way code
-- of address + browser + a random per-day salt kept in `salts` and deleted after
-- two days; distinct codes per day count visitors, and nothing links days. `ip`
-- is written when the worker's STORE_RAW_IP var is "1" (wrangler.jsonc sets it).
-- Apply BEFORE deploying the worker that writes these columns:
--
--   npx wrangler d1 execute karyodraw-usage --remote --file=migrations/003_visitor_code.sql
--
-- ALTER TABLE ADD COLUMN is not idempotent in SQLite: run once.
ALTER TABLE usage ADD COLUMN visitor TEXT;
ALTER TABLE usage ADD COLUMN ip TEXT;
CREATE INDEX IF NOT EXISTS idx_usage_visitor ON usage(ts, visitor);
CREATE TABLE IF NOT EXISTS salts (day TEXT PRIMARY KEY, salt TEXT NOT NULL);
