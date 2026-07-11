// Ping IndexNow so Bing, Yandex, and other participating search engines crawl
// new or changed KaryoDraw URLs quickly. Google does not use IndexNow; for Google,
// discovery is handled by sitemap.xml + Search Console. Reads the URL set from
// sitemap.xml. Run in CI after deploy (see .github/workflows/deploy.yml), or:
//   node scripts/indexnow.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = 'karyodraw.com';
const KEY = '7b3f1e9c4a2d6058e1f0b9c3d5a7e2f4'; // matches /<KEY>.txt served at the site root

const sitemap = fs.readFileSync(path.join(ROOT, 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) { console.error('No URLs found in sitemap.xml'); process.exit(0); }

const body = { host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList };
try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log(`IndexNow: HTTP ${res.status} for ${urlList.length} urls`);
  if (!res.ok) console.error((await res.text().catch(() => '')).slice(0, 300));
} catch (e) {
  console.error('IndexNow ping failed (non-fatal):', e && e.message);
}
