'use strict';
// The operational safety net is repo state, so it is pinned like everything
// else: a backup workflow that quietly disappears, stops encrypting, or drifts
// off the real database name is exactly the failure these tests exist to catch.
//
// These tests parse the workflow files; they used to grep them. The greps all
// passed on 2026-08-12 while every single push produced a zero-second failed
// run with no logs and no jobs. A `run:` line carried an unquoted
// `-H "x-karyodraw-smoke: $SMOKE_BYPASS"`, and a plain YAML scalar cannot
// contain a colon followed by a space, so GitHub could not read the file at
// all. The smoke never ran, and the daily failure email said nothing about
// why. A test that reads the text sees a workflow. Only a parser sees the file
// GitHub sees.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const WORKFLOWS = path.join(__dirname, '..', '.github', 'workflows');
const workflowFiles = fs.readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const parse = (f) => yaml.load(fs.readFileSync(path.join(WORKFLOWS, f), 'utf8'));
// A YAML 1.1 reader folds the `on:` key to boolean true; js-yaml 4 keeps it a
// string. Accept either, so this pins the workflow rather than the parser.
const triggers = (doc) => doc.on ?? doc[true];
const steps = (doc, job) => doc.jobs[job].steps;
const commands = (doc, job) => steps(doc, job).map((s) => s.run || '').join('\n');

test('every workflow file parses as YAML', () => {
  assert.ok(workflowFiles.length >= 5, 'the workflow directory is populated');
  for (const file of workflowFiles) {
    // GitHub reports an unparseable workflow as a zero-second failed run with
    // no jobs and no logs, on every push, whatever the file's own triggers say.
    assert.doesNotThrow(() => parse(file), `${file} must parse`);
  }
});

test('the weekly D1 backup exports, encrypts, and retains', () => {
  const doc = parse('backup.yml');
  assert.equal(triggers(doc).schedule[0].cron, '0 5 * * 1', 'weekly, Mondays 05:00 UTC');
  const run = commands(doc, 'backup');
  assert.match(run, /d1 export karyodraw-usage --remote/, 'exports the real database by name');
  // The repo is public and public-repo artifacts are downloadable by any GitHub
  // user; feedback rows carry reply emails, so an unencrypted dump is a leak.
  assert.match(run, /openssl enc -aes-256-cbc -pbkdf2/, 'the dump is encrypted before upload');
  assert.match(run, /exit 1/, 'a missing secret fails loudly rather than skipping');
  const upload = steps(doc, 'backup').find((s) => (s.uses || '').startsWith('actions/upload-artifact'));
  assert.equal(upload.with['retention-days'], 90, 'a rolling window of restore points');
  assert.equal(upload.with['if-no-files-found'], 'error', 'an empty backup is a failed backup');
});

test('the daily smoke asserts content on all three surfaces', () => {
  const doc = parse('smoke.yml');
  assert.equal(triggers(doc).schedule[0].cron, '30 13 * * *', 'daily, after the feedback digest');
  const checks = steps(doc, 'smoke').filter((s) => (s.run || '').includes('curl') && !s.if);
  assert.equal(checks.length, 3, 'three surfaces, each its own named step');
  const run = checks.map((s) => s.run).join('\n');
  assert.match(run, /karyodraw\.com\/'\s*\|\s*grep -q 'Karyotype diagram maker'/, 'the app, by its h1');
  assert.match(run, /karyotype\/down-syndrome\/'\s*\|\s*grep -q 'Down syndrome'/, 'a generated page, by its content');
  assert.match(run, /api\/top'\s*\|\s*grep -q '"items"'/, 'the Worker API, by its shape');
  // The checks carried a bypass header for two days, for a WAF skip rule that
  // could never have applied to what was actually challenging them (Bot Fight
  // Mode does not run on the Ruleset Engine). Turning that off at the zone was
  // the fix. A header and a secret that do nothing are worse than nothing:
  // they read as a working mitigation to the next person.
  assert.doesNotMatch(run, /x-karyodraw-smoke|SMOKE_BYPASS/, 'no vestigial bypass header');
});

test('a failing smoke says what blocked it', () => {
  const doc = parse('smoke.yml');
  // A bare "curl exited 22" in a failure email cannot distinguish the site
  // being down from Cloudflare turning the runner away, and those two want
  // opposite responses from whoever reads it.
  const diagnostic = steps(doc, 'smoke').find((s) => s.if === 'failure()');
  assert.ok(diagnostic, 'a failure() step reports the edge response');
  assert.match(diagnostic.run, /cf-mitigated|cf-ray/i, 'it surfaces the Cloudflare headers that name the mitigation');
});

test('the worker sends the weekly usage digest on Mondays', () => {
  const w = read('worker.js');
  assert.match(w, /getUTCDay\(\) === 1\) ctx\.waitUntil\(sendUsageDigest/, 'Monday trigger on the existing cron');
  assert.match(w, /parsed=0 AND karyotype IS NOT NULL/, 'the failing-inputs query: what does not draw is the backlog');
  assert.match(w, /if \(!env\.RESEND_API_KEY \|\| !env\.FEEDBACK_EMAIL_TO\) return;[\s\S]*?since/, 'inert until Resend is configured, like the feedback digest');
});
