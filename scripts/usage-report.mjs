#!/usr/bin/env node
// Usage report from the D1 analytics (the `usage` table in schema.sql): totals,
// then one row per day of draws, draws that parsed, distinct karyotypes,
// pageviews and visitors (distinct one-way daily visitor codes, from
// 2026-09-11 on; a person returning on another day counts again). Written 2026-09-11 when Dan asked for the count and the by-day
// distribution; the two queries here are the ones that answered him.
//
//   npm run usage                      totals and the by-day table
//   npm run usage -- --since 2026-08-26  from a date
//   npm run usage -- --csv review/usage/by-day.csv   also save the table
//   npm run usage -- --edge            add Cloudflare's edge numbers per day
//
// --edge adds three columns from the zone analytics GraphQL API, read with the
// wrangler OAuth token on this machine: unique IP addresses, HTML page views and
// requests, per day. Cloudflare counts every address that reached the zone,
// crawlers included, so its uniques run well above the beacon's pageviews on a
// quiet day; the beacon counts page loads that ran the app's script, minus
// blockers. Human visitors sit somewhere between the two, and no identifier
// exists to pin them down (schema.sql stores none, on purpose). The free plan
// serves daily groups only: no monthly de-duplication, no visits, no bot split.
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
const edge = args.includes('--edge');
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
    COUNT(DISTINCT CASE WHEN type='draw' THEN karyotype END) AS distinct_k, SUM(type='pageview') AS views,
    COUNT(DISTINCT visitor) AS visitors
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

let edgeByDay = null;
if (edge) {
  try {
    edgeByDay = await edgeDaily(since || totals.first_day);
  } catch (e) {
    console.error('edge numbers unavailable: ' + String(e.message || e).trim());
  }
}

console.log(`draws ${totals.draws} (parsed ${totals.drew}), distinct karyotypes ${totals.distinct_karyotypes}, ` +
  `pageviews ${totals.pageviews}, ${totals.first_day} to ${totals.last_day}, ${days.length} days with activity`);
if (edgeByDay) {
  const u = [...edgeByDay.values()].reduce((a, r) => a + r.uniques, 0);
  console.log(`edge: ${u} daily unique addresses summed over ${edgeByDay.size} days (an address seen on two days counts twice)`);
}
console.log('');
console.log('day         draws  drew  distinct  views  visitors' + (edgeByDay ? '  edge_uniques  edge_views  edge_requests' : ''));
const seen = new Set();
const allDays = edgeByDay ? [...new Set(days.map((r) => r.day).concat([...edgeByDay.keys()]))].sort() : days.map((r) => r.day);
const byDay = new Map(days.map((r) => [r.day, r]));
const rows = allDays.map((day) => {
  const r = byDay.get(day) || { day, draws: 0, drew: 0, distinct_k: 0, views: 0, visitors: 0 };
  const e = edgeByDay ? (edgeByDay.get(day) || { uniques: '', pageViews: '', requests: '' }) : null;
  return { ...r, edge: e };
});
for (const r of rows) {
  console.log(`${r.day}  ${String(r.draws).padStart(5)} ${String(r.drew).padStart(5)} ${String(r.distinct_k).padStart(9)} ${String(r.views).padStart(6)} ${String(r.visitors).padStart(9)}` +
    (r.edge ? `  ${String(r.edge.uniques).padStart(12)}  ${String(r.edge.pageViews).padStart(10)}  ${String(r.edge.requests).padStart(13)}` : ''));
}
if (csv) {
  const head = 'day,draws,drew,distinct_karyotypes,pageviews,visitors' + (edgeByDay ? ',edge_uniques,edge_pageviews,edge_requests' : '');
  const lines = [head].concat(rows.map((r) => [r.day, r.draws, r.drew, r.distinct_k, r.views, r.visitors].concat(r.edge ? [r.edge.uniques, r.edge.pageViews, r.edge.requests] : []).join(',')));
  writeFileSync(csv, lines.join('\n') + '\n');
  console.log(`\nwrote ${csv}`);
}

// Cloudflare zone analytics, per day, with the OAuth token wrangler login stored.
async function edgeDaily(fromDay) {
  const { readFileSync, existsSync } = await import('node:fs');
  const { homedir } = await import('node:os');
  const candidates = [
    process.env.WRANGLER_CONFIG_TOML,
    (process.env.XDG_CONFIG_HOME || '') + '/.wrangler/config/default.toml',
    homedir() + '/Library/Preferences/.wrangler/config/default.toml',
    homedir() + '/.config/.wrangler/config/default.toml',
  ].filter(Boolean);
  const cfg = candidates.find((p) => existsSync(p));
  if (!cfg) throw new Error('no wrangler login found (npx wrangler login)');
  const m = /oauth_token\s*=\s*"([^"]+)"/.exec(readFileSync(cfg, 'utf8'));
  if (!m) throw new Error('no OAuth token in ' + cfg + ' (npx wrangler login)');
  const headers = { Authorization: 'Bearer ' + m[1], 'Content-Type': 'application/json' };
  const z = await (await fetch('https://api.cloudflare.com/client/v4/zones?name=karyodraw.com', { headers })).json();
  if (!z.success || !z.result.length) throw new Error('zone lookup failed: ' + JSON.stringify(z.errors || z).slice(0, 200));
  const zone = z.result[0].id;
  const query = `{ viewer { zones(filter:{zoneTag:"${zone}"}) { httpRequests1dGroups(limit:400, orderBy:[date_ASC], filter:{date_geq:"${fromDay}"}) { dimensions { date } uniq { uniques } sum { pageViews requests } } } } }`;
  const g = await (await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers, body: JSON.stringify({ query }) })).json();
  if (g.errors) throw new Error(g.errors.map((e) => e.message).join('; ').slice(0, 300));
  const out = new Map();
  for (const r of g.data.viewer.zones[0].httpRequests1dGroups) {
    out.set(r.dimensions.date, { uniques: r.uniq.uniques, pageViews: r.sum.pageViews, requests: r.sum.requests });
  }
  return out;
}
