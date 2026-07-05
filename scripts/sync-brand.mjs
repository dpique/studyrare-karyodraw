#!/usr/bin/env node
/* Sync KaryoDraw's CSS color variables from StudyRare's canonical brand kit.
 *
 * Source of truth: https://github.com/dpique/studyrare-brand  (tokens.json).
 * KaryoDraw is a zero-build single-file static site, so the values must be
 * inlined into index.html rather than imported at runtime. This script pulls
 * the canonical palette and rewrites ONLY the block between the
 * "brand-colors" markers in index.html — nothing else is touched.
 *
 * Usage:
 *   node scripts/sync-brand.mjs            # fetch canonical tokens, rewrite index.html
 *   node scripts/sync-brand.mjs --check    # exit 1 if index.html has drifted (no write)
 *   node scripts/sync-brand.mjs --source <url-or-path>
 *
 * The GitHub Action .github/workflows/sync-brand.yml runs this on a schedule
 * and opens a PR when the palette changes, so nobody has to remember to run it.
 */
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const DEFAULT_SOURCE =
  "https://raw.githubusercontent.com/dpique/studyrare-brand/main/tokens.json";
const HERE = dirname(fileURLToPath(import.meta.url));
const INDEX = resolve(HERE, "..", "index.html");

// Each CSS var -> where its value lives in tokens.json colors.
// [family, step] reads colors[family][step]; ["semantic", key] reads colors.semantic[key].
const MAP = {
  "--bg": ["navy", "50"], "--panel": ["semantic", "surface"],
  "--ink": ["navy", "900"], "--ink-2": ["navy", "700"], "--muted": ["navy", "500"],
  "--line": ["navy", "100"], "--navy": ["navy", "900"],
  "--periwinkle": ["periwinkle", "500"], "--peri-50": ["periwinkle", "50"],
  "--peri-300": ["periwinkle", "300"], "--peri-700": ["periwinkle", "700"],
  "--amber": ["amber", "500"], "--amber-50": ["amber", "50"],
  "--amber-600": ["amber", "600"], "--amber-800": ["amber", "800"],
  "--accent": ["amber", "500"], "--accent-ink": ["navy", "900"],
  "--sage": ["sage", "500"], "--sage-50": ["sage", "50"], "--sage-700": ["sage", "700"],
  "--error": ["error", "500"], "--error-50": ["error", "50"], "--error-700": ["error", "700"],
};
// Grouping controls how the vars are laid out (one line per group), for readable diffs.
const GROUPS = [
  ["--bg", "--panel", "--ink", "--ink-2", "--muted", "--line", "--navy"],
  ["--periwinkle", "--peri-50", "--peri-300", "--peri-700"],
  ["--amber", "--amber-50", "--amber-600", "--amber-800", "--accent", "--accent-ink"],
  ["--sage", "--sage-50", "--sage-700", "--error", "--error-50", "--error-700"],
];

const START = "/* >>> brand-colors: auto-synced from github.com/dpique/studyrare-brand tokens.json — do NOT hand-edit; run `node scripts/sync-brand.mjs` >>> */";
const END = "/* <<< brand-colors <<< */";
const BLOCK_RE = /\/\* >>> brand-colors:[\s\S]*?<<< brand-colors <<< \*\//;

function colorFor(tokens, cssVar) {
  const [family, step] = MAP[cssVar];
  const node = tokens.colors[family];
  if (!node) throw new Error(`tokens.json has no colors.${family} (needed by ${cssVar})`);
  const val = node[step];
  if (typeof val !== "string") throw new Error(`tokens.json missing colors.${family}.${step} (needed by ${cssVar})`);
  return val.toLowerCase();
}

async function loadTokens(source) {
  if (/^https?:\/\//.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`fetch ${source} -> HTTP ${res.status}`);
    return res.json();
  }
  return JSON.parse(await readFile(source, "utf8"));
}

const args = process.argv.slice(2);
const check = args.includes("--check");
const srcFlag = args.indexOf("--source");
const source = srcFlag !== -1 ? args[srcFlag + 1] : DEFAULT_SOURCE;

const tokens = await loadTokens(source);
if ((tokens.brand || "").toLowerCase() !== "studyrare") {
  throw new Error(`unexpected tokens.json (brand=${tokens.brand}); refusing to sync`);
}

const html = await readFile(INDEX, "utf8");
const m = html.match(BLOCK_RE);
if (!m) throw new Error(`brand-colors markers not found in ${INDEX}`);

// Rebuild the block, preserving the leading indentation of the START marker.
const indentMatch = html.match(/([ \t]*)\/\* >>> brand-colors:/);
const indent = indentMatch ? indentMatch[1] : "    ";
const rows = [START, ...GROUPS.map((g) => g.map((v) => `${v}: ${colorFor(tokens, v)};`).join(" ")), END];
const newBlock = rows.join("\n" + indent);
const updated = html.replace(BLOCK_RE, newBlock);

if (updated === html) {
  console.log(`brand colors already in sync (source: ${source}, tokens v${tokens.version})`);
  process.exit(0);
}
if (check) {
  console.error(`DRIFT: index.html brand colors differ from ${source} (tokens v${tokens.version}). Run: node scripts/sync-brand.mjs`);
  process.exit(1);
}
await writeFile(INDEX, updated);
console.log(`updated index.html brand colors from ${source} (tokens v${tokens.version})`);
