// Rasterize the figures for paper/paper.md.
//
// The JOSS paper makes a long list of claims about what the parser accepts and how
// the renderer draws it, and it used to carry one screenshot: a reciprocal
// translocation. A reader had to take the rest on trust, including the two claims
// that are hardest to picture from prose (a ring drawn as an actual annulus, and the
// meiotic segregation panel) and the one that separates this tool from an ideogram
// library (that the input is ISCN text, not coordinates).
//
// Three figures, three different jobs:
//   fig1  the application itself, so a reader sees the input box and the decode panel
//   fig2  a gallery of rearrangement CLASSES, so the claimed coverage is visible
//   fig3  the segregation panel, the capability no comparable tool has
//
// Figures 1 and 3 are driven through the REAL page over a local server, the same way
// scripts/stress-report.mjs works, so what the paper shows is what the app does
// rather than what a reimplementation would do. Figure 2 composes karyograms from the
// shared renderer (lib/render.mjs), which is also what builds the landing pages.
//
// LOCAL, on-demand; NOT run in CI (it needs a browser). Re-run after any render or
// interface change that the paper's figures depend on:
//   npm run paper-figures
//
// Output: paper/fig1-interface.png, paper/fig2-gallery.png, paper/fig3-segregation.png
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { renderKaryogram, ROOT } from './lib/render.mjs';

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, 'paper');
const SCALE = 2;

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appCss = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
const fontLinks = [
  ...(indexHtml.match(/<link rel="preconnect"[^>]*>/g) || []),
  ...(indexHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/g) || []),
].join('\n');

// The gallery. One entry per rearrangement CLASS rather than per condition, because
// the point being evidenced is the breadth of the notation the parser accepts. Each
// caption carries the ISCN string, since the string IS the input: a reader comparing
// this with an ideogram library needs to see that nothing but text was supplied.
//
// Chosen so no two panels are the same drawing problem:
//   Robertsonian   whole-arm fusion, and the count drops to 45
//   ring           drawn as an annulus, which prose cannot convey
//   isochromosome  mirror-image arms, three copies of one arm and one of the other
//   three-way      a cycle, 2 to 7 to 5 to 2, not a pair swap
//   mosaic         two cell lines side by side, each with its own count
//   recombinant    unbalanced, and the deletion is inferred rather than written
const GALLERY = [
  { k: '45,XY,rob(14;21)(q10;q10)', label: 'Robertsonian translocation (balanced carrier, 45 chromosomes)' },
  { k: '46,XX,r(13)(p11q34)', label: 'Ring chromosome, drawn as a ring' },
  { k: '46,X,i(X)(q10)', label: 'Isochromosome Xq' },
  { k: '46,XY,t(2;7;5)(q21;p13;q31)', label: 'Three-way translocation (cycle 2 to 7 to 5 to 2)' },
  { k: 'mos 45,X[12]/46,XX[18]', label: 'Mosaic, both cell lines with their cell counts' },
  { k: '46,XX,rec(2)dup(2p)inv(2)(p21q31)dmat', label: 'Recombinant of a pericentric inversion carrier: 2p duplicated, 2q deleted' },
];

const FIG1_K = '46,XY,t(9;22)(q34;q11.2)';
// A t(11;22) carrier: the commonest recurrent constitutional reciprocal translocation
// in humans, and the one whose 3:1 segregation gives Emanuel syndrome, so the panel
// has something worth reading rather than a generic quadrivalent.
const FIG3_K = '46,XY,t(11;22)(q23;q11.2)';

function galleryDoc() {
  const cells = GALLERY.map(({ k, label }) => {
    const { html } = renderKaryogram(k);
    return `<figure class="cell">
      <div class="fig">${html}</div>
      <figcaption><code>${k.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code><span>${label}</span></figcaption>
    </figure>`;
  }).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${fontLinks}
<style>${appCss}
  *, *::before, *::after { transition: none !important; animation: none !important; }
  html, body { margin: 0; background: #fff; }
  #sheet { display: grid; grid-template-columns: repeat(3, 340px); gap: 26px 18px;
    padding: 22px; background: #fff; font-family: var(--font-sans); }
  .cell { margin: 0; display: flex; flex-direction: column; }
  /* Fixed figure box so the six panels share a baseline and the captions line up;
     the karyograms differ a lot in natural height (a ring is small, a mosaic wide). */
  .fig { height: 300px; display: flex; align-items: flex-end; justify-content: center; }
  .fig .karyogram { transform: none !important; }
  figcaption { margin-top: 10px; text-align: center; }
  figcaption code { display: block; font-family: var(--font-mono, 'IBM Plex Mono', monospace);
    font-size: 12.5px; color: #4a5ac8; word-break: break-word; }
  figcaption span { display: block; margin-top: 4px; font-size: 12px; color: #475569; line-height: 1.35; }
</style></head><body><div id="sheet">${cells}</div></body></html>`;
}

// Scale each karyogram to fill its fixed box without overflowing it. Measured in the
// browser because the six natural sizes are not knowable up front, and applied with
// `zoom` (not transform) so the flex box reflows around the scaled figure.
async function fitGallery(page) {
  await page.evaluate(() => {
    document.querySelectorAll('#sheet .fig').forEach((box) => {
      const fig = box.firstElementChild;
      if (!fig) return;
      const r = fig.getBoundingClientRect();
      if (!r.width || !r.height) return;
      // Quantised, so the figure is reproducible. getBoundingClientRect returns
      // sub-pixel widths that vary in their last decimals between runs, and feeding
      // those straight into zoom moved about 160 pixels of antialiasing every render:
      // invisible, but enough to make fig2 a fresh binary in every commit that
      // happened to run this script. Three decimals is far finer than the eye or the
      // page needs and coarse enough to absorb the jitter.
      const f = Math.min((box.clientWidth - 8) / r.width, (box.clientHeight - 8) / r.height, 2.4);
      fig.style.zoom = Math.floor(f * 1000) / 1000;
    });
  });
}

function serve() {
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    let f = decodeURIComponent(req.url.split('?')[0]);
    if (f === '/') f = '/index.html';
    const p = path.join(ROOT, f);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
    res.end(fs.readFileSync(p));
  });
  return new Promise((r) => server.listen(0, () => r({ server, base: `http://127.0.0.1:${server.address().port}` })));
}

// Type into the real page and press Draw, exactly as a student would, so the figure
// goes through the same draw gate and the same message code the app ships.
async function draw(page, base, k) {
  await page.goto(base + '/index.html', { waitUntil: 'networkidle0' });
  await page.evaluate((val) => {
    document.getElementById('kinput').value = val;
    document.getElementById('draw').click();
  }, k);
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  await new Promise((r) => setTimeout(r, 500));
  const warn = await page.evaluate(() => (document.getElementById('warnings') || {}).innerText || '');
  if (warn.trim()) throw new Error(`"${k}" warned, so it must not go in the paper:\n${warn.trim()}`);
}

async function main() {
  const { server, base } = await serve();
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();

    // A paper figure has to be reproducible: re-running this script on unchanged code
    // must produce the same bytes, or every unrelated commit carries figure churn and a
    // real change is impossible to spot in the diff. fig1 was not, and the cause was not
    // load timing (measured 2026-08-28 by diffing two runs: the pixels that moved were
    // the example-chip row, nothing else). index.html deals those chips from a shuffled
    // deck, Math.random() in dealExamples, so a fresh browser context picks a different
    // three every time. Correct for the app, fatal for a figure.
    //
    // Seeding the page's Math.random is the fix rather than reaching into the deck's
    // sessionStorage: the deck format is internal to index.html and delicate (see the
    // note in test/examples.test.js), while this couples to nothing and makes the whole
    // page deterministic instead of only the chips. Any fixed seed will do; this one has
    // no meaning beyond being fixed.
    await page.evaluateOnNewDocument(() => {
      let s = 0x2f6e2b1;
      Math.random = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    });

    // fig1: the application, from the input box down through the karyogram and decode.
    await page.setViewport({ width: 1380, height: 1500, deviceScaleFactor: SCALE });
    await draw(page, base, FIG1_K);
    // Only the involved chromosomes, so the rearrangement is legible at figure size.
    //
    // Thrown rather than guarded with `if (b)`. The button was renamed from "Affected"
    // to "Involved" in #211 and this lookup was not, so for every build since then it
    // found nothing and clicked nothing, in silence. The figure happened to stay right
    // because the app already defaults to the involved view when something is involved,
    // which is exactly the kind of luck that hides a broken step until the default
    // changes. A figure step that does not do its job must stop the build.
    const shown = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Involved');
      if (!b) return null;
      b.click();
      return b.getAttribute('aria-pressed') === 'true' || b.classList.contains('on') ? 'involved' : 'clicked';
    });
    if (!shown) throw new Error('the Show "Involved" button was not found: it was renamed once already (#211), so this figure would silently fall back to whatever view the app defaults to');
    await new Promise((r) => setTimeout(r, 400));
    // End the crop on the band legend's bottom edge rather than a round number, so
    // the figure closes on a finished card instead of slicing one in half.
    const fig1H = await page.evaluate(() => {
      const el = document.getElementById('legend-card');
      return el ? Math.ceil(el.getBoundingClientRect().bottom + 14) : 1120;
    });
    await page.screenshot({ path: path.join(OUT, 'fig1-interface.png'), clip: { x: 0, y: 0, width: 1380, height: fig1H } });
    console.log(`  fig1-interface.png   the application on ${FIG1_K} (1380x${fig1H} css px)`);

    // fig2: the gallery, composed offline from the shared renderer.
    await page.setViewport({ width: 1120, height: 1200, deviceScaleFactor: SCALE });
    await page.setContent(galleryDoc(), { waitUntil: 'load' });
    await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    await fitGallery(page);
    await new Promise((r) => setTimeout(r, 200));
    await (await page.$('#sheet')).screenshot({ path: path.join(OUT, 'fig2-gallery.png') });
    console.log('  fig2-gallery.png     ' + GALLERY.length + ' rearrangement classes');

    // fig3: the segregation panel for a balanced reciprocal carrier.
    //
    // The whole panel is a page in its own right (six segregation modes, every gamete
    // and conceptus), which at figure width would be an unreadable 7000px ribbon. The
    // figure is clipped to the part that carries the idea: the pachytene pairing
    // diagram, the colour key, and the first row of modes, which is alternate (the one
    // that gives balanced gametes) beside adjacent-1. The caption says the rest is
    // there rather than pretending this is all of it.
    await page.setViewport({ width: 1240, height: 2000, deviceScaleFactor: SCALE });
    await draw(page, base, FIG3_K);
    const clip = await page.evaluate(() => {
      const card = document.getElementById('segregation-card');
      if (!card || card.offsetParent === null) return null;
      const modes = document.querySelectorAll('.seg-modes > *');
      if (modes.length < 2) return null;
      const top = card.getBoundingClientRect();
      // Rows are laid out by the grid, so "the first row" is however many cards share
      // the smallest top offset. Take the lowest bottom edge among them.
      const firstTop = Math.round(modes[0].getBoundingClientRect().top);
      let bottom = 0;
      modes.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (Math.round(r.top) === firstTop) bottom = Math.max(bottom, r.bottom);
      });
      return { x: top.x, y: top.y, width: top.width, height: bottom - top.y + 12 };
    });
    if (!clip) throw new Error(`the segregation panel did not appear for ${FIG3_K}`);
    await page.screenshot({ path: path.join(OUT, 'fig3-segregation.png'), clip });
    console.log(`  fig3-segregation.png the segregation panel for ${FIG3_K} (${Math.round(clip.width)}x${Math.round(clip.height)} css px)`);
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => { console.error(err.message || err); process.exit(1); });
