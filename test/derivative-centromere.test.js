'use strict';
// A derivative must show exactly the centromeres the notation gives it. At the
// ~400-band level (level 0), sub-bands merge into whole bands and the merged
// stain is acen if ANY sub-band is acen. That rule is honest for a whole
// chromosome, but when a junction clips a merged band, the kept remainder used
// to inherit the union's stain: der(9) of t(9;22)(q34;q11.2) started its
// grafted 22 material with a band drawn as a centromere (crosshatch, tooltip
// "Centromere"), making the Philadelphia partner look dicentric at low band
// resolution only. The notation states one centromere per derivative; the
// figure must state the same at every band level.
const { test } = require('node:test');
const assert = require('node:assert/strict');

async function lib() {
  return import('../scripts/lib/render.mjs');
}

function draw(Karyo, clone, clones, level) {
  const affected = Karyo.computeAffected(clones);
  const keys = Object.keys(affected);
  const container = {};
  Karyo.render(container, clone, {
    theme: 'highlight', level, affected, only: keys.length ? keys : null,
  });
  return container.innerHTML;
}

// Split the rendered markup into per-chromosome-instance blocks.
function instances(html) {
  return html.split('<div class="kchrom').slice(1);
}

// Band stains in document order for one instance, with their source chromosome.
function bands(block) {
  return [...block.matchAll(/<rect class="band"[^>]*data-chrom="([^"]+)"[^>]*data-stain="([^"]+)"/g)]
    .map((m) => ({ chrom: m[1], stain: m[2] }));
}

// Number of contiguous acen runs = number of centromeres the figure asserts.
function acenRuns(block) {
  let runs = 0, inRun = false;
  for (const b of bands(block)) {
    if (b.stain === 'acen') { if (!inRun) runs++; inRun = true; }
    else inRun = false;
  }
  return runs;
}

test('t(9;22) derivatives carry exactly one centromere at every band level', async () => {
  const { ISCN, Karyo } = await lib();
  const model = ISCN.parse('46,XY,t(9;22)(q34;q11.2)');
  for (const level of [0, 1, 99]) {
    const blocks = instances(draw(Karyo, model.clones[0], model.clones, level));
    assert.equal(blocks.length, 4, 'normal 9, der(9), normal 22, der(22)');
    const [n9, der9, n22, der22] = blocks;
    assert.equal(acenRuns(der9), 1, `der(9) has one centromere at level ${level}`);
    assert.equal(acenRuns(der22), 1, `der(22) has one centromere at level ${level}`);
    // The graft carries no centromere: 22 material on der(9) starts distal of
    // 22q11.1, and 9 material on der(22) starts distal of 9's centromere.
    assert.ok(!bands(der9).some((b) => b.chrom === '22' && b.stain === 'acen'),
      `no 22 centromere on der(9) at level ${level}`);
    assert.ok(!bands(der22).some((b) => b.chrom === '9' && b.stain === 'acen'),
      `no 9 centromere on der(22) at level ${level}`);
    assert.equal(acenRuns(n9), 1);
    assert.equal(acenRuns(n22), 1);
  }
});

test('centromere count per drawn chromosome is invariant across band levels', async () => {
  const { ISCN, Karyo } = await lib();
  const { CORPUS } = await import('../scripts/stress-corpus.mjs');
  for (const entry of CORPUS) {
    if (entry.expect !== 'draw') continue;
    let model;
    try { model = ISCN.parse(entry.k); } catch { continue; }
    if (!model.clones || !model.clones.length) continue;
    for (const clone of model.clones) {
      const counts = [0, 1, 99].map((level) => {
        try { return instances(draw(Karyo, clone, model.clones, level)).map(acenRuns); }
        catch { return null; }
      });
      if (counts.some((c) => c === null)) continue;
      const full = counts[2];
      for (const [levelIdx, levelName] of [[0, '~400-band'], [1, '~550-band']]) {
        counts[levelIdx].forEach((runs, i) => {
          if (full[i] <= 1) {
            // One centromere (or none) at full resolution must stay exactly that
            // at every display level: a second run is a phantom, a false claim.
            assert.equal(runs, full[i],
              `${entry.k}: instance ${i} shows ${runs} centromere runs at ${levelName}, ${full[i]} at full resolution`);
          } else {
            // A genuinely dicentric shape (dic, idic) may see its two real
            // centromeres merge into one crosshatch block at a coarse level when
            // the gap between them sits inside merged acen bands - a resolution
            // artifact of a true statement. It must never GAIN centromeres.
            assert.ok(runs >= 1 && runs <= full[i],
              `${entry.k}: instance ${i} shows ${runs} centromere runs at ${levelName}, expected 1..${full[i]}`);
          }
        });
      }
    }
  }
});

// Pick the instance block whose caption names this derivative.
function blockFor(html, caption) {
  return instances(html).find((b) => b.includes(caption));
}

// The clippedStain fix above handled a MERGED band inheriting acen at coarse
// levels. A breakpoint landing INSIDE the centromere band is the same false claim
// by a different route, and it survives at full resolution: Xq11.1 spans
// 61.0-63.8 Mb and a break "at Xq11.1" resolves to its midpoint, so the graft on
// der(19) really does carry 1.4 Mb of acen-stained X material. That material is
// pericentromeric heterochromatin riding across the junction, not a centromere.
// The notation says der(19), not dic(X;19): one centromere, chromosome 19's.
// Before this, the figure drew two crosshatch blocks and the tooltip on the
// grafted one read "Centromere".
test('a breakpoint inside the centromere does not graft a second centromere', async () => {
  const { ISCN, Karyo } = await lib();
  const model = ISCN.parse('46,XY,der(19)t(X;19)(q11.1;p13.3)');
  for (const level of [0, 1, 99]) {
    const html = draw(Karyo, model.clones[0], model.clones, level);
    const der19 = blockFor(html, 'der(19)');
    assert.ok(der19, `found der(19) at level ${level}`);
    assert.equal(acenRuns(der19), 1, `der(19) shows one centromere at level ${level}`);
    assert.ok(!bands(der19).some((b) => b.chrom === 'X' && b.stain === 'acen'),
      `no X centromere grafted onto der(19) at level ${level}`);
  }
});

// The general form of the same rule, over the whole stress corpus: the figure may
// only draw as many centromeres as the MODEL says the instance has. buildInstance
// is the authority (segments flagged hasCen), so the drawing cannot out-claim it.
test('no drawn instance shows more centromeres than its model carries', async () => {
  const { ISCN, Karyo } = await lib();
  const { CORPUS } = await import('../scripts/stress-corpus.mjs');
  for (const entry of CORPUS) {
    if (entry.expect !== 'draw') continue;
    let model;
    try { model = ISCN.parse(entry.k); } catch { continue; }
    if (!model.clones || !model.clones.length) continue;
    for (const clone of model.clones) {
      let html;
      try { html = draw(Karyo, clone, model.clones, 99); } catch { continue; }
      const blocks = instances(html);
      // Model-side count, in the same order the renderer emits instances.
      const modelCounts = [];
      Object.keys(clone.slots || {}).forEach((ch) => {
        (clone.slots[ch] || []).forEach((inst) => {
          try { modelCounts.push(Karyo.buildInstance(inst).segments.filter((s) => s.hasCen).length); }
          catch { modelCounts.push(null); }
        });
      });
      if (modelCounts.length !== blocks.length) continue;   // ordering differs; covered by the level-invariance test
      blocks.forEach((b, i) => {
        if (modelCounts[i] == null || modelCounts[i] === 0) return;
        assert.ok(acenRuns(b) <= modelCounts[i],
          `${entry.k}: instance ${i} draws ${acenRuns(b)} centromeres, model carries ${modelCounts[i]}`);
      });
    }
  }
});

// The seam constriction of a whole-arm body sits where the two centromere-bearing
// arms MEET. cenIsSeam took the FIRST segment boundary, right for the two-segment
// Robertsonian it was written for and wrong the day a graft rode above the arms:
// der(13;14)(q10;q10)t(9;14)(q22;q24) draws [9 graft][14q][13q], and the waist sat
// on the chromosome 9 junction, a centromere the model does not claim there, while
// the real seam got a plain fusion line.
test('a grafted whole-arm der pinches at the arm seam, not at the graft junction', async () => {
  const { ISCN, Karyo } = await lib();
  const model = ISCN.parse('45,XX,der(13;14)(q10;q10)t(9;14)(q22;q24)');
  const html = draw(Karyo, model.clones[0], model.clones, 99);
  const der = instances(html).find((b) => b.includes('der(13;14)'));
  assert.ok(der, 'the derivative renders');
  // The seam-centromere marker is the "2.5 2" dashed midline (with its hatch band).
  // The body is [9 graft, 44 Mb][14q, 56][13q, 96], so the arm seam sits at about
  // half height and the graft junction at about a fifth; before the fix the marker
  // sat at the graft junction.
  const cenLines = [...der.matchAll(/<line[^>]*y1="([\d.]+)"[^>]*stroke-dasharray="2\.5 2"/g)]
    .map((m) => Number(m[1]));
  assert.equal(cenLines.length, 1, 'one seam centromere marker');
  const height = Number((der.match(/<svg[^>]*height="([\d.]+)"/) || [])[1]);
  assert.ok(cenLines[0] > height * 0.4,
    `the constriction sits at the 14;13 arm seam near half height (y=${cenLines[0]} of ${height})`);
});

// The involved view hides unaffected groups, and for a mosaic whose only sex
// change was -Y that drew an XY clone showing a lone Y in its sex box, no X
// anywhere. A Y in the affected set now brings the X beside it.
test('a Y in the affected set brings the X beside it', async () => {
  const { ISCN, Karyo } = await lib();
  const withY = Karyo.computeAffected(ISCN.parse('45,X,-Y').clones);
  assert.ok(withY['X'], 'X joins the affected set beside the lost Y');
  const noSex = Karyo.computeAffected(ISCN.parse('46,XY,t(9;22)(q34;q11.2)').clones);
  assert.ok(!noSex['X'] && !noSex['Y'], 'an autosomal karyotype still hides both sex chromosomes');
});

test('affected colors follow the chromosome set, not the notation path', async () => {
  const { Karyo, ISCN } = await lib();
  // der(22)t(11;22) and its parent t(11;22) must wear the same colors: the
  // child page, its hover preview of the parent, and the carrier page its
  // parental-origin chip loads are read side by side, and the legend promises
  // that pieces take the color of the chromosome they came from (Dan,
  // 2026-09-04: "the colours are opposite here"). Sex chromosomes keep first
  // place, the order ISCN names them in a rearrangement.
  const aff = (k) => Karyo.computeAffected(ISCN.parse(k).clones);
  const child = aff('47,XY,+der(22)t(11;22)(q23;q11.2)');
  const parent = aff('46,XX,t(11;22)(q23;q11.2)');
  assert.equal(child['11'], parent['11'], 'chromosome 11 keeps its color across the pair');
  assert.equal(child['22'], parent['22'], 'chromosome 22 keeps its color across the pair');
  assert.notEqual(child['11'], child['22']);
  const x = aff('46,XX,der(3)t(X;3)(q13;q21)');
  assert.equal(x['X'], Karyo.AFFECTED_PALETTE[0], 'the sex chromosome leads, as in t(X;3) naming');
});
