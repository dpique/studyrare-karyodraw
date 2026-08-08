// Shared karyogram renderer. Loads the browser render modules (ideogram-data.js,
// iscn-parser.js, karyo-render.js, teach.js) into a vm shim, exactly like the test
// suite and the page build, so there is a single source of truth for how a
// karyotype string becomes karyogram markup. Imported by both build-pages.mjs (to
// inline the figure into each landing page) and render-images.mjs (to rasterize the
// same figure into a per-page PNG for image search and social cards).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const win = {};
const ctx = vm.createContext({ window: win });
for (const f of ['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx);
}

export const { ISCN, Karyo, Teach } = win;
export { ROOT };

// Produce the karyogram markup for a karyotype string. Mirrors the on-screen
// "highlight" style at the standard (~550) band level; when the karyotype has
// affected chromosomes (or a marker), only those are drawn with their homolog.
//
// A mosaic renders EVERY cell line, side by side in one row, each under its own
// notation and cell count. Rendering clones[0] alone drew mos 45,X[12]/46,XX[18]
// as plain monosomy X: the majority 46,XX line never appeared, on the one page
// whose teaching point is that the second line is what makes it mosaic. The row
// markup (.clones-row / .clone-block / .clone-head) is the same the app uses for
// its side-by-side affected view, so index.html's stylesheet covers both.
export function renderKaryogram(k) {
  const model = ISCN.parse(k);
  const affected = Karyo.computeAffected(model.clones);
  const affKeys = Object.keys(affected);
  const hasMar = model.clones.some((c) => (c.slots.mar || []).length);
  const only = (affKeys.length || hasMar) ? affKeys : null;
  const draw = (clone) => {
    const container = {};
    Karyo.render(container, clone, { theme: 'simple', level: 1, affected, only });
    return container.innerHTML;
  };
  if (model.clones.length === 1) {
    return { html: draw(model.clones[0]), clone: model.clones[0], clones: model.clones, affectedOnly: !!only };
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const total = model.clones.reduce((sum, c) => sum + (c.cellCount || 0), 0);
  const blocks = model.clones.map((clone) => {
    const pct = (clone.cellCount != null && total) ? ` (${Math.round(clone.cellCount / total * 100)}%)` : '';
    const cells = clone.cellCount != null ? `<span class="cc">${clone.cellCount} cells${pct}</span>` : '';
    return `<div class="clone-block"><div class="clone-head"><span class="cn">${esc(clone.raw)}</span>${cells}</div>` +
      `<div class="kwrap">${draw(clone)}</div></div>`;
  }).join('');
  return { html: `<div class="clones-row">${blocks}</div>`, clone: model.clones[0], clones: model.clones, affectedOnly: !!only };
}
