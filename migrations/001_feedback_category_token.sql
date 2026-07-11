-- Adds the "Doesn't look right?" flagging fields to the existing feedback table.
-- Run once against the live D1 database (the worker.js insert falls back to the
-- legacy columns until this has run, so no feedback is lost in the meantime):
--
--   npx wrangler d1 execute karyodraw-usage --remote --file=migrations/001_feedback_category_token.sql
--
-- category: what kind of problem was reported (banding / explanation / parse / other)
-- token:    unguessable id returned to the client so a one-click flag can later be
--           enriched with optional detail (see feedbackResponse in worker.js).
ALTER TABLE feedback ADD COLUMN category TEXT;
ALTER TABLE feedback ADD COLUMN token TEXT;
