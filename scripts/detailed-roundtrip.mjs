// Sweep every karyotype the app draws through its own copied line and back.
//
// Anything the app emits as notation must round-trip through its own parser.
// test/detailed-karyotype.test.js pins that against the pairs ISCN 2024 prints both
// ways; this is the wider net, run by hand after any change to detailedForm,
// detailedKaryotype or shortFromDetailed: every supported example in
// test/iscn-2024-examples.js is serialised with Karyo.detailedKaryotype, pasted back
// through ISCN.parse, and sorted into
//   same     read back as the karyotype it came from
//   twin     read back as a normalised twin: a back-reference expanded, a tilde or
//            dash range dropped, "//" written "/", an "or" alternative dropped
//   refused  the reader could not work back to a short form (the der() gap, and
//            any derivative carrying a "?" or an hsr)
//   plain    nothing structural to serialise, so the line IS the short form
// The two sweeps of 2026-09-14 found #347 (a t(9;9) refused) and #348 (add, hsr and
// del(5)(q13q13) copied as an untouched chromosome); after them: 328 supported,
// 170 same, 36 twin, 33 refused, 89 plain. A "refused" line that names a whole
// chromosome (pter→qter) under an abnormal label is the #348 bug class again.
//
//   npm run roundtrip                 # counts, then the refused and twin lists
//   npm run roundtrip -- --quiet      # counts only
//   npm run roundtrip -- --filter hsr # only karyotypes containing the text
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const FILTER = argOf('--filter');
const QUIET = argv.includes('--quiet');

const win = {};
const context = vm.createContext({ window: win });
for (const f of ['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js']) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
}
const ISCN = win.ISCN;
const Karyo = win.Karyo;
const EXAMPLES = require(path.join(ROOT, 'test', 'iscn-2024-examples.js'));

const norm = (s) => String(s || '').replace(/\s+/g, '');
const draws = (m) => !!(m && m.ok && m.clones.length && m.clones.every((c) => !c.unreadable) && !m.suggestion);
const readBack = (m) => (/“([^”]*)”\.$/.exec((m.warnings || []).find((w) => /DETAILED/.test(w)) || '') || [])[1];

const rows = EXAMPLES.filter((r) => r.supported && (!FILTER || r.k.includes(FILTER)));
const same = [], twin = [], refused = [], plain = [], notDrawn = [];
for (const { k } of rows) {
  const model = ISCN.parse(k);
  if (!draws(model)) { notDrawn.push(k); continue; }
  let line = '';
  try { line = Karyo.detailedKaryotype(model); } catch (e) { line = ''; }
  if (!/→|::/.test(line)) { plain.push(k); continue; }
  const back = ISCN.parse(line);
  if (!draws(back)) { refused.push({ k, line, why: (back.warnings[0] || '').slice(-110) }); continue; }
  const as = readBack(back);
  if (as && norm(as) !== norm(k)) twin.push({ k, line, as }); else same.push(k);
}

const pad = (n) => String(n).padStart(4);
console.log(`supported ${pad(rows.length)}   same ${pad(same.length)}   twin ${pad(twin.length)}   refused ${pad(refused.length)}   plain ${pad(plain.length)}` +
  (notDrawn.length ? `   not drawn ${pad(notDrawn.length)}` : ''));
if (QUIET) process.exit(0);
if (refused.length) {
  console.log('\nREFUSED (the copied line does not paste back):');
  for (const r of refused) console.log(`  ${r.k}\n      ${r.line}\n      ${r.why}`);
}
if (twin.length) {
  console.log('\nTWIN (pastes back as a normalised twin):');
  for (const t of twin) console.log(`  ${t.k}\n      ${t.line}\n      read as ${t.as}`);
}
if (notDrawn.length) {
  console.log('\nNOT DRAWN (marked supported, but the app refuses the short form):');
  for (const k of notDrawn) console.log(`  ${k}`);
}
