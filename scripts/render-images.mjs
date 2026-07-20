// Rasterize each curated karyotype's karyogram to a per-page PNG, so the landing
// pages are eligible for Google Images ("karyotype of down syndrome", "karyotype
// image of ...") and carry a correct, condition-specific social card. The figure
// is rendered from the SAME shared renderer the build uses (lib/render.mjs), then
// screenshot with the installed Chrome so the raster is pixel-faithful to the CSS
// layout — no separate SVG rasterizer to drift.
//
// This is a LOCAL, on-demand step (needs a browser); it is NOT run in CI. Re-run it
// whenever content/karyotypes.js changes a karyotype or a render module changes:
//   npm run images            # all pages
//   npm run images -- <slug>  # one page (e.g. down-syndrome)
//
// Output: karyotype/<slug>/karyogram.png  (committed to the repo, served as-is).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import puppeteer from 'puppeteer-core';
import { renderKaryogram, ROOT } from './lib/render.mjs';

const require = createRequire(import.meta.url);
const { CONTENT } = require(path.join(ROOT, 'content/karyotypes.js'));

// Reuse the homepage stylesheet + font links so the karyogram looks identical to
// what ships on the page (same band colors, label fonts, spacing).
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appCss = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
const fontLinks = [
  ...(indexHtml.match(/<link rel="preconnect"[^>]*>/g) || []),
  ...(indexHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/g) || []),
].join('\n');

const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// The karyogram's intrinsic CSS size is modest (a few chromosomes on the
// affected-only pages). Render at 3x so the stored PNG is high-resolution for image
// search even though the page displays it at its natural size.
const SCALE = 3;
const CARD_SCALE = 2; // 1200x630 card rendered at 2x -> 2400x1260 crisp social image
const SHOT_PAD_X = 16, SHOT_PAD_Y = 14; // #shot padding, subtracted to get the karyogram's natural size
const CARD_FIG_W = 500, CARD_FIG_H = 460; // target box for the karyogram on the social card
const MANIFEST = path.join(ROOT, 'content', 'karyogram-images.json');

function docFor(k) {
  const { html } = renderKaryogram(k);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${fontLinks}
<style>${appCss}
  *, *::before, *::after { transition: none !important; animation: none !important; }
  html, body { margin: 0; background: #ffffff; }
  #shot { display: inline-block; padding: 14px 16px; background: #ffffff; }
  #shot .karyogram { transform: none !important; }
</style></head><body><div id="shot">${html}</div></body></html>`;
}

// A fixed 1200x630 social card (og:image / twitter:image): condition name and ISCN
// code on the left, the karyogram scaled to fit on the right, on a plain white card
// with a periwinkle rule and the KaryoDraw wordmark. The karyogram is scaled to fit
// in-browser (see fitKaryogram) so any figure size frames cleanly.
function cardFor(e) {
  const { html } = renderKaryogram(e.k);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
${fontLinks}
<style>${appCss}
  *, *::before, *::after { transition: none !important; animation: none !important; }
  html, body { margin: 0; background: #ffffff; }
  #card { position: relative; width: 1200px; height: 630px; box-sizing: border-box;
    background: #ffffff; border-top: 10px solid var(--periwinkle);
    display: grid; grid-template-columns: 1fr 1fr; align-items: center; gap: 40px;
    padding: 60px 72px 96px; font-family: var(--font-sans); }
  #card .cardtext { min-width: 0; }
  #card .cardname { font-family: var(--font-display); font-weight: 800; color: var(--navy);
    font-size: 50px; line-height: 1.04; letter-spacing: -.02em; margin: 0 0 20px; }
  #card .cardkt { font-family: var(--font-mono, 'IBM Plex Mono', monospace); font-size: 24px;
    color: var(--peri-700, #4a5ac8); background: var(--peri-50, #eef1fd);
    display: inline-block; padding: 8px 14px; border-radius: 10px;
    max-width: 100%; box-sizing: border-box; word-break: break-word; }
  #card .cardfig { display: flex; align-items: center; justify-content: center; height: 100%; }
  #card .cardfig .fitwrap { display: flex; align-items: center; justify-content: center; }
  #card .cardfig .karyogram { transform: none !important; transform-origin: center; }
  #card .brand { position: absolute; left: 72px; bottom: 40px; display: flex; align-items: center;
    gap: 10px; font-family: var(--font-display); font-weight: 800; color: var(--navy); font-size: 24px; }
  #card .brand .dot { width: 16px; height: 16px; border-radius: 5px; background: var(--periwinkle); }
</style></head><body>
  <div id="card">
    <div class="cardtext">
      <p class="cardname">${e.name}</p>
      <span class="cardkt">${e.k}</span>
    </div>
    <div class="cardfig"><div class="fitwrap">${html}</div></div>
    <div class="brand"><span class="dot"></span>KaryoDraw</div>
  </div>
</body></html>`;
}

// Apply a fixed scale to the karyogram wrapper, centered. The scale goes on the
// .fitwrap wrapper (not .karyogram, which is pinned to transform:none to cancel the
// app's default interactive transform). In-browser measurement of the karyogram is
// unreliable for multi-row layouts, so the caller precomputes the factor in Node
// from the figure pass's known natural size.
async function applyScale(page, factor) {
  await page.evaluate((f) => {
    const wrap = document.querySelector('.cardfig .fitwrap');
    if (!wrap) return;
    // Use zoom (not transform): it reflows layout so the flex-centered figure
    // paints at the scaled size in the element screenshot.
    wrap.style.zoom = f;
  }, factor);
}

async function main() {
  const only = process.argv[2];
  const items = only ? CONTENT.filter((e) => e.slug === only) : CONTENT;
  if (!items.length) {
    console.error(only ? `No karyotype with slug "${only}".` : 'No content.');
    process.exit(1);
  }
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  try {
    const page = await browser.newPage();
    // Preserve a manifest for slugs we are not re-rendering this run, so a
    // single-slug run does not drop the others' dimensions.
    const manifest = only && fs.existsSync(MANIFEST)
      ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
    const settleFonts = () => page.evaluate(() => (document.fonts ? document.fonts.ready : null));
    let n = 0;
    for (const e of items) {
      const dir = path.join(ROOT, 'karyotype', e.slug);
      fs.mkdirSync(dir, { recursive: true });

      // (1) natural-size karyogram figure -> karyogram.png (the in-body image)
      await page.setViewport({ width: 2200, height: 1600, deviceScaleFactor: SCALE });
      await page.setContent(docFor(e.k), { waitUntil: 'load' });
      await settleFonts();
      const box = await (await page.$('#shot')).boundingBox();
      await (await page.$('#shot')).screenshot({ path: path.join(dir, 'karyogram.png') });
      const w = Math.round(box.width), h = Math.round(box.height);

      // (2) fixed 1200x630 branded social card -> card.png (og:image / twitter:image).
      // Scale the karyogram to fit the card's figure box, derived from the natural
      // size above (#shot box minus its 16x14 padding), capped so tiny figures do
      // not balloon. Computed here, not measured in the browser (unreliable for
      // multi-row karyograms).
      const natW = w - 2 * SHOT_PAD_X, natH = h - 2 * SHOT_PAD_Y;
      const f = Math.min(CARD_FIG_W / natW, CARD_FIG_H / natH, 3.2);
      await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: CARD_SCALE });
      await page.setContent(cardFor(e), { waitUntil: 'load' });
      await settleFonts();
      await applyScale(page, f);
      await (await page.$('#card')).screenshot({ path: path.join(dir, 'card.png') });

      manifest[e.slug] = {
        w, h, pw: w * SCALE, ph: h * SCALE,
        cw: 1200 * CARD_SCALE, ch: 630 * CARD_SCALE,
      };
      n++;
      console.log(`  ${e.slug}  karyogram ${w * SCALE}x${h * SCALE}px, card ${1200 * CARD_SCALE}x${630 * CARD_SCALE}px`);
    }
    const sorted = Object.fromEntries(Object.keys(manifest).sort().map((k) => [k, manifest[k]]));
    fs.writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n');
    console.log(`Rendered ${n} karyogram PNG${n === 1 ? '' : 's'} at ${SCALE}x; wrote ${path.relative(ROOT, MANIFEST)}.`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
