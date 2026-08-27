'use strict';
// One concept, one word. The Show toggle read "Affected" while every other string
// describing the same idea said "involved": the button's OWN tooltip ("Only the
// chromosomes involved in the abnormality"), the Highlight tooltip and caption, both
// legend rows, the About and Guide copy, and the generated condition pages. Eight to
// one, and the odd one out was the button.
//
// The tie-breaker is clinical, not stylistic. "Affected" is a term of art for a PERSON
// with the phenotype, and KaryoDraw already uses it that way one card down: teach.js
// calls a rec carrier's parent "typically unaffected" and says ring cases are "affected
// more severely". The app needs that meaning, so the chromosome sense gave way.
// "Involved" is also how ISCN and lab reports name the chromosomes in a rearrangement.
//
// Internals keep the old name (AFFECTED, computeAffected, .affected-only, SHOW ===
// "affected"): renaming them buys the reader nothing, and the URL token is a contract.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Everything a reader can actually see: element text and title/aria attributes.
// Comments and identifiers are deliberately out of scope.
function visibleStrings(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '');
  const out = [];
  body.replace(/>([^<>]+)</g, (m, t) => { if (t.trim()) out.push(t.trim()); return m; });
  body.replace(/(?:title|aria-label|placeholder)="([^"]+)"/g, (m, t) => { out.push(t); return m; });
  return out;
}

test('the Show toggle is labelled with the word the rest of the app uses', () => {
  assert.match(HTML, /data-show="affected"[^>]*>Involved</,
    'the button reads "Involved"; its internal data-show value is untouched');
  assert.ok(!/>Affected</.test(HTML), 'and no button still reads "Affected"');
});

test('no user-visible string calls a CHROMOSOME affected', () => {
  const offenders = visibleStrings(HTML).filter((s) => /\baffected\b/i.test(s));
  assert.deepEqual(offenders, [],
    `visible copy should say "involved" of chromosomes, found: ${JSON.stringify(offenders)}`);
});

test('the word the app does use is present on the same control', () => {
  // Not merely "Affected is gone" but "involved is what replaced it", so a future
  // edit cannot satisfy this file by deleting the vocabulary altogether.
  assert.match(HTML, /data-show="affected" title="Only the chromosomes involved in the abnormality/,
    'the tooltip and the label now agree');
  assert.match(HTML, /the chromosomes involved in the abnormality are colored/, 'the Highlight caption');
  assert.match(HTML, /gray = a chromosome not involved in the abnormality/, 'the legend gray row');
});

// The URL token is a published contract: "Copy link to this view" has been writing
// show=affected into links that are already shared, bookmarked and pasted into slides.
// The forward map may rename what NEW links say; the reader must keep honouring both
// forever. Same rule the style/bands tokens already follow (simple -> "highlight").
test('the show token renames for new links and still reads the old one', () => {
  assert.match(HTML, /var SHOW_TO_URL = \{ all: "all", affected: "involved" \};/, 'forward map');
  assert.match(HTML, /var URL_TO_SHOW = invertMap\(SHOW_TO_URL\);/,
    'reverse map is derived, not hand-written, so the two cannot drift');
  assert.match(HTML, /"&show=" \+ SHOW_TO_URL\[SHOW\]/, 'new links carry the button word');
  assert.match(HTML, /getParam\("show"\); if \(URL_TO_SHOW\[pShow\]\) SHOW = URL_TO_SHOW\[pShow\]/,
    'the reader goes through the map rather than a hardcoded pair');
});

// invertMap's actual behaviour on this map, rather than trusting the shape above.
test('a legacy show=affected link still resolves to the isolated view', () => {
  function invertMap(fwd, coerce) {
    const out = {};
    Object.keys(fwd).forEach((k) => { const v = coerce ? coerce(k) : k; out[fwd[k]] = v; out[k] = v; });
    return out;
  }
  const URL_TO_SHOW = invertMap({ all: 'all', affected: 'involved' });
  assert.equal(URL_TO_SHOW.affected, 'affected', 'every link already copied keeps working');
  assert.equal(URL_TO_SHOW.involved, 'affected', 'and the new token means the same view');
  assert.equal(URL_TO_SHOW.all, 'all');
  assert.equal(URL_TO_SHOW.nonsense, undefined, 'an unknown token leaves the default alone');
});

// The clinical sense of "affected" is the reason for the split, so it has to survive.
test('teach.js keeps "affected" for the person, which is what it means', () => {
  const teach = fs.readFileSync(path.join(ROOT, 'teach.js'), 'utf8');
  assert.match(teach, /typically unaffected/, 'a balanced carrier is unaffected: about the person');
});
