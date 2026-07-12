-- Adds the "Doesn't look right?" flagging fields to the feedback table.
-- Run ONCE against a database created before these columns existed (the worker.js
-- insert falls back to the legacy columns until this has run, so no feedback is
-- lost in the meantime):
--
--   npx wrangler d1 execute karyodraw-usage --remote --file=migrations/001_feedback_category_token.sql
--
-- NOT idempotent: SQLite has no "ADD COLUMN IF NOT EXISTS", so re-running errors
-- on a duplicate column. schema.sql already defines category/token, so a DB
-- freshly created from it must NOT run this. Check first with:
--   npx wrangler d1 execute karyodraw-usage --remote --command="PRAGMA table_info(feedback);"
--
-- category: what kind of problem was reported (banding / explanation / parse / other)
-- token:    unguessable id returned to the client so a one-click flag can later be
--           enriched with optional detail (see feedbackResponse in worker.js).
ALTER TABLE feedback ADD COLUMN category TEXT;
ALTER TABLE feedback ADD COLUMN token TEXT;
