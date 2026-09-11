'use strict';
// No ISCN section numbers in anything a reader sees. "(ISCN 4.4.4)", "the rule
// (5.5.18.3 b)" and "(ISCN 4.2.1 g)" used to sit in tooltips, notes and refusals;
// Dan, 2026-09-11: "scrub specific mentions of these ultra specific ISCN
// references from the app wherever they may be... it is unnecessary detail."
// Comments keep their citations (that is where the next reader checks the
// claim); strings do not. Comments are stripped before scanning so a citation in
// a comment never trips this, and a section number inside a string always does.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILES = ['index.html', 'teach.js', 'iscn-parser.js', 'segregation.js', 'pachytene.js',
  'karyo-render.js', 'content/about.html', 'content/guide.html', 'content/karyotypes.js',
  'scripts/build-pages.mjs', '404.html'];

function stripComments(src) {
  src = src.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
  src = src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return src.split('\n').map((line) => {
    let inS = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inS) { if (c === '\\') { i++; continue; } if (c === inS) inS = null; }
      else if (c === '"' || c === "'" || c === '`') inS = c;
      else if (c === '/' && line[i + 1] === '/') return line.slice(0, i);
    }
    return line;
  }).join('\n');
}

// A section reference: "ISCN 4.4.4", "Table 3", "Chapter 7", or any bare
// three-level number such as 5.5.18.3, optionally followed by a clause letter.
// Band names (p11.23, q34.1), pixel sizes, megabases and versions are not.
const REF = /(ISCN\s*(?:20\d\d)?\s*)?(Table|Chapter|Section)?\s*\b(\d\.\d+(?:\.\d+)*)(\s*(?:[a-z]|[ivx]+)\b)?/g;

function references(src) {
  const out = [];
  stripComments(src).split('\n').forEach((line, i) => {
    let m;
    REF.lastIndex = 0;
    while ((m = REF.exec(line))) {
      const before = line.slice(Math.max(0, m.index - 3), m.index);
      const after = line.slice(m.index + m[0].length, m.index + m[0].length + 4);
      if (/[pqXY]\s*$/.test(before)) continue;
      if (/^\s*(px|em|rem|%|ms|Mb|kb)/.test(after)) continue;
      if (/[\d.]$/.test(before)) continue;
      if (!m[1] && !m[2] && !/\d\.\d+\.\d+/.test(m[3])) continue;
      out.push(`${i + 1}: …${line.slice(Math.max(0, m.index - 50), m.index + m[0].length + 20).trim()}…`);
    }
  });
  return out;
}

test('no reader-facing string cites an ISCN section number', () => {
  const found = [];
  for (const f of FILES) {
    const p = path.join(__dirname, '..', f);
    if (!fs.existsSync(p)) continue;
    references(fs.readFileSync(p, 'utf8')).forEach((r) => found.push(`${f}:${r}`));
  }
  assert.deepEqual(found, [], 'section references in strings:\n  ' + found.join('\n  '));
});

test('the scanner itself sees a reference when there is one', () => {
  assert.equal(references('var t = "joined here (ISCN 4.4.4)";').length, 1);
  assert.equal(references('var t = "the rule (5.5.18.3 b) names";').length, 1);
  assert.equal(references('// ISCN 5.5.18.3 b: cited in a comment, allowed\nvar t = "q11.23 and 12.5 Mb and 1.7px";').length, 0);
});
