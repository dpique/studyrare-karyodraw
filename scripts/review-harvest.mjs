// Build the review manifest: which karyotypes deserve an agent's eyes this run.
//
// The full sweep (every unique karyotype ever drawn) costs millions of tokens of
// vision analysis, and most of it would be spent re-reading trisomies. This script
// spends the budget where the yield is: everything a visitor flagged, the
// production parse FAILURES (a refusal message is teaching copy, and a refusal of
// valid ISCN is the worst error this app can make), and the top of the drawn list
// ranked by structural complexity, because every figure bug found in 2026-08 lived
// in derivative chains, whole-arm bodies, and multi-join compositions, never in a
// plain +21.
//
// Inputs are wrangler D1 JSON exports (read-only SELECTs; see docs/VALIDATION.md
// "Reviewing the live corpus" for the exact queries):
//   node scripts/review-harvest.mjs feedback.json failures.json drawn.json
// Output: review/manifest.json, one entry per selected karyotype with its source
// tier, production frequency, complexity score, and any visitor messages.
import fs from 'node:fs';
import path from 'node:path';
import { ISCN } from './lib/render.mjs';

const [feedbackPath, failuresPath, drawnPath] = process.argv.slice(2);
if (!drawnPath) {
  console.error('usage: node scripts/review-harvest.mjs <feedback.json> <failures.json> <drawn.json>');
  process.exit(1);
}
const rows = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))[0].results;

// Weighted structural complexity. The weights are not calibrated science; they
// order the queue so that chains, derivatives, and mosaics come before simple
// gains, which is the only property the selection needs.
const OP_WEIGHT = { der: 3, rec: 3, ins: 2.5, dic: 2, idic: 2, rob: 1.5, t: 1.5, trp: 2, r: 1.5, inv: 1, del: 1, dup: 1, i: 1, add: 1, hsr: 1, fra: 1 };
function complexity(k) {
  let model;
  try { model = ISCN.parse(k); } catch { return { score: 0, ok: false }; }
  if (!model.clones || !model.clones.length) return { score: 0, ok: false };
  let score = 0;
  const chroms = new Set();
  for (const clone of model.clones) {
    for (const ab of clone.aberrations || []) {
      score += OP_WEIGHT[ab.op] || 1;
      (ab.chroms || []).forEach((c) => chroms.add(String(c)));
      for (const s of ab.subOps || []) {
        score += (OP_WEIGHT[s.op] || 1) * 0.8;
        (s.chroms || []).forEach((c) => chroms.add(String(c)));
        score += (s.breakpoints || []).reduce((n, g) => n + (g || []).length, 0) * 0.2;
      }
      score += (ab.breakpoints || []).reduce((n, g) => n + (g || []).length, 0) * 0.2;
    }
  }
  score += Math.max(0, model.clones.length - 1) * 1.5;   // mosaics: every clone is a figure
  score += chroms.size * 0.3;
  const refused = !model.clones.length || model.clones.every((c) => c.modalNumber == null) ||
    !!model.suggestion || model.clones.some((c) => c.unreadable || c.countWrong);
  return { score: Math.round(score * 10) / 10, ok: !refused };
}

const norm = (k) => String(k || '').replace(/\s+/g, ' ').trim();
const manifest = [];
const seen = new Set();
function add(entry) {
  const key = norm(entry.k);
  if (!key || seen.has(key)) return;
  seen.add(key);
  manifest.push({ ...entry, k: key });
}

// Tier 1: flagged. Carry the visitor's words so the analyst answers the actual
// complaint rather than re-deriving one.
if (feedbackPath) {
  const byK = new Map();
  for (const r of rows(feedbackPath)) {
    const k = norm(r.karyotype);
    if (!k) continue;
    if (!byK.has(k)) byK.set(k, []);
    if (r.message) byK.get(k).push((r.category ? r.category + ': ' : '') + r.message);
  }
  for (const [k, msgs] of byK) {
    const c = complexity(k);
    add({ k, source: 'flagged', complexity: c.score, draws: c.ok, messages: msgs });
  }
}

// Tier 2: production parse failures, by frequency. Text-only review: the artifact
// is the refusal message, and the question is whether the refusal is RIGHT (valid
// ISCN refused is the worse direction of error) and whether it teaches.
const FAILURES_TOP = Number(process.env.REVIEW_FAILURES || 20);
if (failuresPath) {
  for (const r of rows(failuresPath).slice(0, FAILURES_TOP)) {
    const k = norm(r.karyotype);
    const c = complexity(k);
    add({ k, source: 'failure', freq: r.n, complexity: c.score, draws: c.ok });
  }
}

// Tier 3: drawn karyotypes by complexity. Frequency breaks ties so a complex
// karyotype many people actually see outranks an equally complex one-off.
const COMPLEX_TOP = Number(process.env.REVIEW_COMPLEX || 20);
const drawn = rows(drawnPath)
  .map((r) => ({ k: norm(r.karyotype), freq: r.n, ...complexity(norm(r.karyotype)) }))
  .filter((r) => r.ok)
  .sort((a, b) => (b.score - a.score) || (b.freq - a.freq));
for (const r of drawn.slice(0, COMPLEX_TOP)) {
  add({ k: r.k, source: 'complex', freq: r.freq, complexity: r.score, draws: true });
}

fs.mkdirSync('review', { recursive: true });
fs.writeFileSync(path.join('review', 'manifest.json'), JSON.stringify(manifest, null, 2));
const tally = manifest.reduce((m, e) => { m[e.source] = (m[e.source] || 0) + 1; return m; }, {});
console.log(`review/manifest.json: ${manifest.length} entries`, JSON.stringify(tally));
