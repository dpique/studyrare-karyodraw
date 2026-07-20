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
export function renderKaryogram(k) {
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
