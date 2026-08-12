'use strict';
// The operational safety net is repo state, so it is pinned like everything
// else: a backup workflow that quietly disappears, stops encrypting, or drifts
// off the real database name is exactly the failure these tests exist to catch.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('the weekly D1 backup exports, encrypts, and retains', () => {
  const y = read('.github/workflows/backup.yml');
  assert.match(y, /cron: '0 5 \* \* 1'/, 'weekly, Mondays 05:00 UTC');
  assert.match(y, /d1 export karyodraw-usage --remote/, 'exports the real database by name');
  // The repo is public and public-repo artifacts are downloadable by any GitHub
  // user; feedback rows carry reply emails, so an unencrypted dump is a leak.
  assert.match(y, /openssl enc -aes-256-cbc -pbkdf2/, 'the dump is encrypted before upload');
  assert.match(y, /retention-days: 90/, 'a rolling window of restore points');
  assert.match(y, /exit 1/, 'a missing secret fails loudly rather than skipping');
});

test('the daily smoke asserts content on all three surfaces', () => {
  const y = read('.github/workflows/smoke.yml');
  assert.match(y, /karyodraw\.com\/' \| grep -q 'Karyotype diagram maker'/, 'the app, by its h1');
  assert.match(y, /karyotype\/down-syndrome\/' \| grep -q 'Down syndrome'/, 'a generated page, by its content');
  assert.match(y, /api\/top' \| grep -q '"items"'/, 'the Worker API, by its shape');
});

test('the worker sends the weekly usage digest on Mondays', () => {
  const w = read('worker.js');
  assert.match(w, /getUTCDay\(\) === 1\) ctx\.waitUntil\(sendUsageDigest/, 'Monday trigger on the existing cron');
  assert.match(w, /parsed=0 AND karyotype IS NOT NULL/, 'the failing-inputs query: what does not draw is the backlog');
  assert.match(w, /if \(!env\.RESEND_API_KEY \|\| !env\.FEEDBACK_EMAIL_TO\) return;[\s\S]*?since/, 'inert until Resend is configured, like the feedback digest');
});
