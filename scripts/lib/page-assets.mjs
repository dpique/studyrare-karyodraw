// The homepage's own presentation, reused by every script that rasterizes or reports on
// a karyogram, so a figure looks identical to what ships on the page: same band colors,
// same label fonts, same spacing. One copy, because three scripts scraped the same two
// regexes out of index.html and a change to the markup had to be chased through all of
// them. Imported by render-images.mjs, render-paper-figures.mjs and stress-report.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

export const appCss = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];

export const fontLinks = [
  ...(indexHtml.match(/<link rel="preconnect"[^>]*>/g) || []),
  ...(indexHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/g) || []),
].join('\n');

// Every figure the render scripts commit is drawn with webfonts pulled from Google over
// the network, and a hiccup there does not throw: the page simply renders in the
// fallback and the PNG is committed looking subtly wrong, with nothing said.
//
// document.fonts.ready is not enough and neither is document.fonts.check(). Measured
// 2026-08-28, rendering the same markup with and without the stylesheet: check()
// answered TRUE both times, because a fallback family satisfies the query, while the
// PNG bytes differed. The honest signal is the FontFace SET, which the stylesheet
// populates when it parses and which is EMPTY when it never arrived (5 faces versus 0
// in that measurement). Registration, not load status: a face is only marked "loaded"
// once something actually paints with it, so a family this particular figure does not
// happen to use would look missing.
//
// This is also the likeliest explanation for two committed figures that changed with no
// code behind them earlier the same day.
export const FONT_FAMILIES = [...fontLinks.matchAll(/family=([^:&"]+)/g)]
  .map((m) => decodeURIComponent(m[1].replace(/\+/g, ' ')));

// The guard has to be able to fail. FONT_FAMILIES is scraped out of index.html, so a
// markup change there could leave it empty, and an empty expectation checks nothing
// while still looking like a check. Assert the scrape found something first.
if (!FONT_FAMILIES.length) {
  throw new Error('no webfont families found in index.html; the font guard in settleFonts '
    + 'would pass vacuously, so the scrape needs updating before any figure is rendered');
}

// Wait for the page's fonts, then refuse to screenshot anything drawn in a fallback face.
export async function settleFonts(page) {
  await page.evaluate(() => (document.fonts ? document.fonts.ready : null));
  const missing = await page.evaluate((families) => families.filter((f) =>
    ![...document.fonts].some((face) => face.family === f)), FONT_FAMILIES);
  if (missing.length) {
    throw new Error(`webfonts did not load (${missing.join(', ')}), so this figure would be `
      + 'committed in a fallback face. Check the network and re-run; nothing was written.');
  }
}
