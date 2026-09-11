#!/usr/bin/env node
// Usage report from the D1 analytics (the `usage` table in schema.sql): totals,
// then one row per day of draws, draws that parsed, distinct karyotypes and
// pageviews. Written 2026-09-11 when Dan asked for the count and the by-day
// distribution; the two queries here are the ones that answered him.
//
//   npm run usage                      totals and the by-day table
//   npm run usage -- --since 2026-08-26  from a date
//   npm run usage -- --csv review/usage/by-day.csv   also save the table
//
// Needs a wrangler login that carries the d1 scope: a 7403 "account is not
// valid or is not authorized" error means the login lacks it, and
// `npx wrangler login` (which re-consents with d1:write) is the fix.
//
// What the numbers include: every draw beacon the worker recorded, so Dan's own
// sessions and headless verification loads against the live site count too;
// nothing here filters them out. Keep exports out of the repo (it is public):
// `review/` is gitignored and is the place for a CSV.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const since = opt('--since');
const csv = opt('--csv');
if (since && !/^\d{4}-\d{2}-\d{2}$/.test(since)) { console.error('--since takes YYYY-MM-DD'); process.exit(2); }

function d1(sql) {
  const out = execFileSync('npx', ['wrangler', 'd1', 'execute', 'karyodraw-usage', '--remote', '--json', '--command', sql],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const parsed = JSON.parse(out);
  if (parsed.error) throw new Error(parsed.error.text || JSON.stringify(parsed.error));
  return parsed[0].results;
}

const where = since ? ` AND date(ts/1000,'unixepoch') >= '${since}'` : '';
let totals, days;
try {
  totals = d1(`SELECT COUNT(*) AS draws, SUM(parsed) AS drew, COUNT(DISTINCT karyotype) AS distinct_karyotypes,
    date(MIN(ts)/1000,'unixepoch') AS first_day, date(MAX(ts)/1000,'unixepoch') AS last_day,
    (SELECT COUNT(*) FROM usage WHERE type='pageview'${where}) AS pageviews
    FROM usage WHERE type='draw' AND karyotype IS NOT NULL${where}`)[0];
  days = d1(`SELECT date(ts/1000,'unixepoch') AS day,
    SUM(type='draw' AND karyotype IS NOT NULL) AS draws, SUM(type='draw' AND parsed=1) AS drew,
    COUNT(DISTINCT CASE WHEN type='draw' THEN karyotype END) AS distinct_k, SUM(type='pageview') AS views
    FROM usage WHERE 1=1${where} GROUP BY day ORDER BY day`);
} catch (e) {
  const msg = String(e.stderr || e.message || e);
  if (/7403|not authorized/.test(msg)) {
    console.error('D1 refused the query: the wrangler login lacks the d1 scope. Run `npx wrangler login` and retry.');
  } else {
    console.error(msg.trim());
  }
  process.exit(1);
}

console.log(`draws ${totals.draws} (parsed ${totals.drew}), distinct karyotypes ${totals.distinct_karyotypes}, ` +
  `pageviews ${totals.pageviews}, ${totals.first_day} to ${totals.last_day}, ${days.length} days with activity`);
console.log('');
console.log('day         draws  drew  distinct  views');
for (const r of days) {
  console.log(`${r.day}  ${String(r.draws).padStart(5)} ${String(r.drew).padStart(5)} ${String(r.distinct_k).padStart(9)} ${String(r.views).padStart(6)}`);
}
if (csv) {
  const lines = ['day,draws,drew,distinct_karyotypes,pageviews'].concat(days.map((r) => [r.day, r.draws, r.drew, r.distinct_k, r.views].join(',')));
  writeFileSync(csv, lines.join('\n') + '\n');
  console.log(`\nwrote ${csv}`);
}
