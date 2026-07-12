-- Partial index for the daily digest query, which filters WHERE digested IS NULL.
-- Without it, each digest run full-scans the feedback table (rows are never
-- deleted, so the scan grows without bound). Safe to run against the live D1:
--
--   npx wrangler d1 execute karyodraw-usage --remote --file=migrations/002_feedback_undigested_index.sql
--
-- Idempotent (IF NOT EXISTS), so re-running is harmless.
CREATE INDEX IF NOT EXISTS idx_feedback_undigested ON feedback(ts) WHERE digested IS NULL;
