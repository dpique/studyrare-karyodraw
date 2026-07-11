// Static generator for KaryoDraw SEO landing pages.
//
// Reads the single source of truth (content/karyotypes.js) and, reusing the very
// same render modules the browser uses (loaded in a vm shim, exactly like the test
// suite), emits for each curated karyotype a self-contained static page at
//   karyotype/<slug>/index.html
// It also injects the homepage "Common karyotypes, explained" list (between the
// KD:PAGES markers in index.html) and writes sitemap.xml. Every page's CSS and
// karyogram come straight from index.html + the render code, so nothing drifts.
//
//   node scripts/build-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SITE = 'https://karyodraw.com';
const require = createRequire(import.meta.url);

// ---- load the render modules into a shared shim (same approach as test/*) -----
const win = {};
const ctx = vm.createContext({ window: win });
for (const f of ['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
}
const { ISCN, Karyo, Teach } = win;
const { CONTENT } = require(path.join(ROOT, 'content/karyotypes.js'));

// ---- shared bits pulled out of index.html so they never drift -----------------
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appCss = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
const pickLine = (re) => (indexHtml.match(re) || [])[0] || '';
const favicon = pickLine(/<link rel="icon"[^>]*>/);
const fontPreconnect = (indexHtml.match(/<link rel="preconnect"[^>]*>/g) || []).join('\n');
const fontStylesheet = pickLine(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/);

// ---- helpers ------------------------------------------------------------------
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const attr = (s) => esc(s).replace(/"/g, '&quot;');
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
const bySlug = Object.fromEntries(CONTENT.map((e) => [e.slug, e]));

function renderKaryogram(k) {
  const model = ISCN.parse(k);
  const clone = model.clones[0];
  const affected = Karyo.computeAffected(model.clones);
  const affKeys = Object.keys(affected);
  const hasMar = model.clones.some((c) => (c.slots.mar || []).length);
  const only = (affKeys.length || hasMar) ? affKeys : null;
  const container = {};
  Karyo.render(container, clone, { theme: 'simple', level: 1, affected, only });
  return { html: container.innerHTML, clone, affectedOnly: !!only };
}

function pageTitle(e) { return `${e.name} karyotype (${e.k}) explained | KaryoDraw`; }
function pageDesc(e) {
  const base = stripTags(e.intro).replace(/\s+/g, ' ').trim();
  return (base + ' See it drawn as a banded karyogram with every ISCN symbol decoded.').slice(0, 300);
}

function jsonLd(e) {
  const url = `${SITE}/karyotype/${e.slug}/`;
  const graph = [
    {
      '@type': 'MedicalWebPage',
      '@id': url,
      url,
      name: pageTitle(e),
      headline: `${e.name} — ${e.k}`,
      description: pageDesc(e),
      inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'KaryoDraw', url: SITE + '/' },
      about: { '@type': 'MedicalEntity', name: e.name, alternateName: e.aka || [] },
      author: { '@type': 'Person', name: 'Daniel Pique', url: 'https://orcid.org/0000-0003-0074-3974' },
      publisher: { '@type': 'Organization', name: 'StudyRare', url: 'https://studyrare.com/' }
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'KaryoDraw', item: SITE + '/' },
        { '@type': 'ListItem', position: 2, name: 'Karyotypes', item: SITE + '/karyotype/' },
        { '@type': 'ListItem', position: 3, name: e.name, item: url }
      ]
    }
  ];
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

function decodeList(clone) {
  const rows = Teach.decode(clone) || [];
  return '<dl class="lp-decode">' + rows.map((r) =>
    `<dt><code>${esc(r.code)}</code></dt><dd>${esc(r.text)}</dd>`).join('') + '</dl>';
}

function syndromeNotes(clone) {
  const syn = Teach.syndromes(clone) || [];
  if (!syn.length) return '';
  return '<section class="lp-sec"><h2>Clinical notes</h2>' + syn.map((s) =>
    `<div class="lp-syn"><h3>${esc(s.name)}</h3><p>${esc(s.note)}</p></div>`).join('') + '</section>';
}

function relatedLinks(e) {
  const items = (e.related || []).map((slug) => bySlug[slug]).filter(Boolean);
  if (!items.length) return '';
  return '<section class="lp-sec lp-related"><h2>Related karyotypes</h2><ul>' + items.map((r) =>
    `<li><a href="/karyotype/${r.slug}/"><code>${esc(r.k)}</code> <span>${esc(r.name)}</span></a></li>`).join('') + '</ul></section>';
}

const LANDING_CSS = `
  .lp-top { padding: 16px 24px; border-bottom: 1px solid var(--line); background: linear-gradient(180deg,#fff,#f7f8fb); }
  .lp-top a.home { display: inline-flex; align-items: baseline; gap: 9px; text-decoration: none; }
  .lp-top .dotmark { align-self: center; }
  .lp-top .wordmark { font-family: var(--font-display); font-weight: 800; font-size: 20px; letter-spacing: -.02em; color: var(--navy); }
  .lp-top .tagline { color: var(--muted); font-size: 13px; }
  .lp-wrap { max-width: 820px; margin: 0 auto; padding: 0 24px 64px; }
  .lp-crumb { font-size: 12.5px; color: var(--muted); margin: 18px 0 6px; }
  .lp-crumb a { color: var(--peri-700); text-decoration: none; } .lp-crumb a:hover { text-decoration: underline; }
  article h1 { font-family: var(--font-display); font-weight: 800; letter-spacing: -.02em; color: var(--navy); font-size: 30px; margin: 4px 0 6px; }
  .lp-kt { font: 600 18px var(--font-mono); color: var(--peri-700); margin: 0 0 4px; }
  .lp-aka { font-size: 13px; color: var(--muted); margin: 0 0 14px; }
  .lp-intro { font-size: 16px; line-height: 1.6; color: var(--ink-2); margin: 0 0 18px; }
  .lp-cta { margin: 0 0 20px; }
  .lp-cta .btn { display: inline-block; text-decoration: none; }
  .lp-fig { margin: 0 0 8px; border: 1px solid var(--line); border-radius: 14px; background: var(--panel); box-shadow: var(--shadow); padding: 12px; overflow-x: auto; }
  .lp-fig .karyogram { transform: none !important; }
  .lp-figcap { font-size: 12.5px; color: var(--muted); margin: 4px 0 22px; }
  .lp-sec { margin: 24px 0; }
  .lp-sec h2 { font-family: var(--font-display); font-weight: 700; font-size: 18px; color: var(--navy); margin: 0 0 10px; }
  .lp-decode { display: grid; grid-template-columns: auto 1fr; gap: 6px 12px; margin: 0; }
  .lp-decode dt { margin: 0; } .lp-decode dd { margin: 0; color: var(--ink-2); }
  .lp-decode code { font: 700 13px var(--font-mono); color: var(--ink); background: #f0f2f7; padding: 2px 7px; border-radius: 6px; white-space: nowrap; }
  .lp-syn { border-left: 3px solid var(--peri-300); padding: 2px 0 2px 12px; margin: 0 0 12px; }
  .lp-syn h3 { font-size: 14px; margin: 0 0 3px; color: var(--navy); }
  .lp-syn p { margin: 0; color: var(--ink-2); font-size: 14.5px; line-height: 1.55; }
  .lp-related ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 8px; }
  .lp-related a { display: flex; align-items: baseline; gap: 9px; text-decoration: none; padding: 9px 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
  .lp-related a:hover { border-color: var(--peri-300); background: var(--peri-50); }
  .lp-related code { font: 600 13px var(--font-mono); color: var(--peri-700); }
  .lp-related span { color: var(--ink-2); font-size: 14px; }
  .lp-foot { margin-top: 34px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--muted); }
  .lp-foot a { color: var(--peri-700); }
  .lp-top-inner { max-width: 1100px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 12px 20px; flex-wrap: wrap; }
  .lp-nav { display: flex; gap: 2px; flex-wrap: wrap; }
  .lp-nav a { text-decoration: none; color: var(--ink-2); font: 600 13.5px var(--font-sans); padding: 6px 11px; border-radius: 8px; }
  .lp-nav a:hover { background: var(--peri-50); color: var(--peri-700); }
  .lp-nav a[aria-current="page"] { color: var(--peri-700); background: var(--peri-50); }
  /* prose for the guide + about pages */
  .lp-prose h2 { font-family: var(--font-display); font-weight: 700; font-size: 20px; color: var(--navy); margin: 26px 0 8px; }
  .lp-prose h3 { font-family: var(--font-display); font-weight: 700; font-size: 15.5px; color: var(--navy); margin: 16px 0 4px; }
  .lp-prose p { font-size: 15.5px; line-height: 1.65; color: var(--ink-2); margin: 0 0 12px; }
  .lp-prose code { font: 600 13px var(--font-mono); color: var(--peri-700); background: #f0f2f7; padding: 1px 6px; border-radius: 5px; }
  .lp-prose a { color: var(--peri-700); }
  .lp-prose ul { margin: 0 0 12px; padding-left: 20px; color: var(--ink-2); }
  .lp-prose li { margin: 4px 0; line-height: 1.55; }
  .lp-ops { display: grid; grid-template-columns: auto 1fr; gap: 8px 14px; margin: 8px 0 14px; }
  .lp-ops dt { margin: 0; } .lp-ops dt code { font-size: 13.5px; }
  .lp-ops dd { margin: 0; color: var(--ink-2); font-size: 14.5px; line-height: 1.5; }
`;

// Shared header with the site nav. `active` highlights the current section.
function siteHeader(active) {
  const link = (href, label, key) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`;
  return `<header class="lp-top"><div class="lp-top-inner">
  <a class="home" href="/" aria-label="KaryoDraw home">
    <svg class="dotmark" width="26" height="26" viewBox="0 0 32 32" aria-hidden="true"><g><rect x="6" y="3" width="8" height="26" rx="4" fill="#8b97ee"/><rect x="6" y="20" width="8" height="2.6" fill="#5e72e4"/><rect x="6" y="3" width="8" height="26" rx="4" fill="none" stroke="#4a5ac8" stroke-width="1.1"/><rect x="18" y="3" width="8" height="26" rx="4" fill="#8b97ee"/><rect x="18" y="22" width="8" height="7" fill="#ec9b27"/><rect x="18" y="3" width="8" height="26" rx="4" fill="none" stroke="#4a5ac8" stroke-width="1.1"/></g></svg>
    <span class="wordmark">KaryoDraw</span>
  </a>
  <nav class="lp-nav" aria-label="Primary">${link('/karyotype/', 'Karyotypes', 'karyotypes')}${link('/how-to-read-a-karyotype/', 'Guide', 'guide')}${link('/about/', 'About', 'about')}</nav>
</div></header>`;
}

const SITE_FOOT = `<div class="lp-foot"><p><a href="/">KaryoDraw</a> is a free ISCN 2024 karyotype visualizer, a <a href="https://studyrare.com" target="_blank" rel="noopener">StudyRare</a> tool. It is an educational visualizer of cytogenetic nomenclature, not a diagnostic tool.</p></div>`;

// One page skeleton for every generated page (landing, hub, about, guide).
function pageShell({ title, description, canonicalPath, ogType = 'website', ogTitle, jsonLd, extraCss = '', active = '', crumb = '', articleClass = '', body }) {
  const url = SITE + canonicalPath;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${fontPreconnect}
${fontStylesheet}
<title>${esc(title)}</title>
<link rel="canonical" href="${url}" />
<meta name="description" content="${attr(description)}" />
<meta name="author" content="Daniel Pique, StudyRare" />
<meta name="robots" content="index, follow" />
<meta name="theme-color" content="#5e72e4" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="KaryoDraw" />
<meta property="og:title" content="${attr(ogTitle || title)}" />
<meta property="og:description" content="${attr(description)}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/preview.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${attr(ogTitle || title)}" />
<meta name="twitter:description" content="${attr(description)}" />
<meta name="twitter:image" content="${SITE}/preview.png" />
${favicon}
${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>\n` : ''}<style>${appCss}${LANDING_CSS}${extraCss}</style>
</head>
<body>
${siteHeader(active)}
<main class="lp-wrap">
${crumb ? `  <nav class="lp-crumb" aria-label="Breadcrumb">${crumb}</nav>\n` : ''}  <article${articleClass ? ` class="${articleClass}"` : ''}>
${body}
  </article>
</main>
</body>
</html>
`;
}

function karyoNote(e) {
  const { affectedOnly } = renderKaryogram(e.k);
  return affectedOnly ? ', showing the involved chromosomes with their normal homolog' : '';
}

function pageHtml(e) {
  const { html: karyo } = renderKaryogram(e.k);
  const toolLink = `/?k=${encodeURIComponent(e.k)}&style=highlight&bands=550&show=all`;
  const desc = pageDesc(e);
  const aka = (e.aka && e.aka.length) ? `<p class="lp-aka">Also known as: ${esc(e.aka.join(', '))}</p>` : '';
  const model = ISCN.parse(e.k);
  const body = `    <h1>${esc(e.name)}</h1>
    <p class="lp-kt">${esc(e.k)}</p>
    ${aka}
    <p class="lp-intro">${e.intro}</p>
    <p class="lp-cta"><a class="btn" href="${attr(toolLink)}">Open in the interactive visualizer &rarr;</a></p>
    <figure class="lp-fig">${karyo}</figure>
    <figcaption class="lp-figcap">${esc(e.name)} (${esc(e.k)}) drawn by KaryoDraw${karyoNote(e)}.</figcaption>
    <section class="lp-sec"><h2>What the notation means</h2>${decodeList(model.clones[0])}</section>
    ${syndromeNotes(model.clones[0])}
    ${relatedLinks(e)}
    ${SITE_FOOT}`;
  return pageShell({
    title: pageTitle(e),
    ogTitle: `${e.name} karyotype (${e.k})`,
    description: desc,
    canonicalPath: `/karyotype/${e.slug}/`,
    ogType: 'article',
    jsonLd: jsonLd(e),
    active: 'karyotypes',
    crumb: `<a href="/">KaryoDraw</a> &rsaquo; <a href="/karyotype/">Karyotypes</a> &rsaquo; ${esc(e.name)}`,
    body,
  });
}

function hubHtml() {
  const groups = [];
  const seen = {};
  for (const e of CONTENT) { if (!seen[e.concept]) { seen[e.concept] = []; groups.push(e.concept); } seen[e.concept].push(e); }
  const sections = groups.map((g) =>
    `<section class="lp-sec"><h2>${esc(g)}</h2><ul class="lp-related-inline">` +
    seen[g].map((e) => `<li><a href="/karyotype/${e.slug}/"><code>${esc(e.k)}</code> <span>${esc(e.name)}</span></a></li>`).join('') +
    '</ul></section>').join('\n    ');
  const desc = 'Every common ISCN 2024 karyotype, drawn and explained: trisomies, monosomies, deletions, translocations, inversions, isochromosomes, ring chromosomes, mosaicism, and more.';
  const extraCss = `
  .lp-related-inline { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 8px; }
  .lp-related-inline a { display: flex; align-items: baseline; gap: 8px; text-decoration: none; padding: 8px 11px; border: 1px solid var(--line); border-radius: 10px; background: var(--panel); }
  .lp-related-inline a:hover { border-color: var(--peri-300); background: var(--peri-50); }
  .lp-related-inline code { font: 600 12.5px var(--font-mono); color: var(--peri-700); white-space: nowrap; }
  .lp-related-inline span { color: var(--ink-2); font-size: 13.5px; }`;
  const body = `    <h1>Karyotypes, explained</h1>
    <p class="lp-intro">${esc(desc)} Every example is drawn by KaryoDraw and decoded symbol by symbol. New to the notation? Start with the <a href="/how-to-read-a-karyotype/">guide on how to read a karyotype</a>, or type any karyotype into the <a href="/">interactive visualizer</a>.</p>
    ${sections}
    ${SITE_FOOT}`;
  return pageShell({
    title: 'Karyotypes explained: common ISCN examples drawn and decoded | KaryoDraw',
    ogTitle: 'Karyotypes explained | KaryoDraw',
    description: desc,
    canonicalPath: '/karyotype/',
    jsonLd: JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Karyotypes explained', description: desc,
      url: SITE + '/karyotype/', isPartOf: { '@type': 'WebSite', name: 'KaryoDraw', url: SITE + '/' } }),
    active: 'karyotypes',
    crumb: `<a href="/">KaryoDraw</a> &rsaquo; Karyotypes`,
    extraCss,
    body,
  });
}

// About + guide: bespoke content authored in content/*.html, wrapped in the shell.
const STATIC_PAGES = [
  { slug: 'about', active: 'about', file: 'content/about.html',
    title: 'About KaryoDraw | a free ISCN karyotype visualizer',
    description: 'KaryoDraw is a free, browser-based tool that draws any ISCN 2024 karyotype and explains every symbol in plain language, built for the genetics community by StudyRare.',
    ldType: 'AboutPage', crumb: '<a href="/">KaryoDraw</a> &rsaquo; About' },
  { slug: 'how-to-read-a-karyotype', active: 'guide', file: 'content/guide.html',
    title: 'How to read a karyotype: ISCN notation explained | KaryoDraw',
    description: 'A plain-language guide to reading a karyotype in ISCN 2024 notation: the chromosome count, arms and bands, and every symbol for numerical and structural changes, with a worked example for each.',
    ldType: 'Article', crumb: '<a href="/">KaryoDraw</a> &rsaquo; Guide' },
];

function staticPageHtml(p) {
  const inner = fs.readFileSync(path.join(ROOT, p.file), 'utf8').trim();
  const url = `${SITE}/${p.slug}/`;
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@type': p.ldType,
    name: p.title, headline: p.title, description: p.description, url, inLanguage: 'en',
    isPartOf: { '@type': 'WebSite', name: 'KaryoDraw', url: SITE + '/' },
    author: { '@type': 'Person', name: 'Daniel Pique', url: 'https://orcid.org/0000-0003-0074-3974' },
    publisher: { '@type': 'Organization', name: 'StudyRare', url: 'https://studyrare.com/' } });
  return pageShell({
    title: p.title, description: p.description, canonicalPath: `/${p.slug}/`, ogType: p.ldType === 'Article' ? 'article' : 'website',
    jsonLd, active: p.active, crumb: p.crumb, articleClass: 'lp-prose', body: `${inner}\n    ${SITE_FOOT}`,
  });
}

// ---- write landing pages ------------------------------------------------------
let written = 0;
for (const e of CONTENT) {
  const dir = path.join(ROOT, 'karyotype', e.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), pageHtml(e));
  written++;
}
fs.mkdirSync(path.join(ROOT, 'karyotype'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'karyotype', 'index.html'), hubHtml());

// ---- static pages: about + guide ----------------------------------------------
for (const p of STATIC_PAGES) {
  const dir = path.join(ROOT, p.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), staticPageHtml(p));
}

// ---- notation -> slug map for the Worker's /k/<notation> redirects ------------
const norm = (s) => String(s).replace(/\s+/g, '').toLowerCase();
const kmap = {};
for (const e of CONTENT) kmap[norm(e.k)] = e.slug;
fs.writeFileSync(path.join(ROOT, 'content', 'k-index.mjs'),
  '// Generated by scripts/build-pages.mjs — normalized ISCN notation -> landing-page slug.\n' +
  '// Used by worker.js to 301-redirect /k/<notation> to its canonical /karyotype/<slug>/.\n' +
  'export const K_TO_SLUG = ' + JSON.stringify(kmap, null, 2) + ';\n');

// ---- inject homepage "Common karyotypes, explained" list ----------------------
const listHtml = '\n          <ul class="kdp-list">\n' + CONTENT.map((e) =>
  `            <li><a href="/karyotype/${e.slug}/"><code>${esc(e.k)}</code> <b>${esc(e.name)}</b></a></li>`
).join('\n') + '\n          </ul>\n          ';
const injected = indexHtml.replace(
  /(<!-- KD:PAGES:START -->)[\s\S]*?(<!-- KD:PAGES:END -->)/,
  `$1\n          <!-- Generated by scripts/build-pages.mjs from content/karyotypes.js — do not hand-edit. -->${listHtml}$2`
);
if (injected === indexHtml && !/KD:PAGES:START/.test(indexHtml)) {
  console.error('WARN: KD:PAGES markers not found in index.html; homepage list not injected.');
} else {
  fs.writeFileSync(path.join(ROOT, 'index.html'), injected);
}

// ---- sitemap.xml --------------------------------------------------------------
const lastmod = process.env.BUILD_DATE || '2026-07-11';
const urls = [
  { loc: SITE + '/', priority: '1.0', changefreq: 'monthly' },
  { loc: SITE + '/how-to-read-a-karyotype/', priority: '0.9', changefreq: 'monthly' },
  { loc: SITE + '/karyotype/', priority: '0.9', changefreq: 'monthly' },
  { loc: SITE + '/about/', priority: '0.6', changefreq: 'yearly' },
  ...CONTENT.map((e) => ({ loc: `${SITE}/karyotype/${e.slug}/`, priority: '0.8', changefreq: 'monthly' }))
];
const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`).join('\n') +
  '\n</urlset>\n';
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), sitemap);

console.log(`Built ${written} landing pages + hub + ${STATIC_PAGES.length} static pages (about, guide), injected homepage list, wrote sitemap.xml (${urls.length} urls).`);
