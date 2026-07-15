'use strict';
// To-scale pachytene figure tests (pachytene.js). Like the other modules it is a browser
// IIFE loaded into a window shim via vm. These pin that the cross/trivalent geometry is
// derived from real hg38 breakpoints (so a different t() draws a different figure), that
// every figure is well-formed and in-bounds, and — the property the figure exists to teach —
// that no spindle fiber ever crosses the division plane it is sorted by.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadAll() {
  const win = {};
  const context = vm.createContext({ window: win });
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context);
  load('ideogram-data.js'); load('iscn-parser.js'); load('segregation.js'); load('pachytene.js');
  return win;
}
const win = loadAll();
const P = win.Pachytene, ISCN = win.ISCN, Seg = win.Segregation;
const model = (k) => Seg.compute(ISCN.parse(k).clones[0]);

const RECIP_MODES = ['Alternate', 'Adjacent-1', 'Adjacent-2', '3:1'];
const ROB_MODES = ['Alternate', 'Adjacent'];

// ---- svg parsing helpers ----------------------------------------------------
function allLines(svg) {
  const re = /<line ([^>]*?)\/>/g;
  const out = [];
  let m;
  while ((m = re.exec(svg))) {
    const a = m[1];
    const g = (k) => { const r = a.match(new RegExp(k + '="([^"]+)"')); return r ? r[1] : null; };
    out.push({
      x1: +g('x1'), y1: +g('y1'), x2: +g('x2'), y2: +g('y2'),
      stroke: g('stroke'), width: +g('stroke-width'), dash: g('stroke-dasharray')
    });
  }
  return out;
}
const PLATE = '#aeb6d6', TEAL = '#1f9e8f', ROSE = '#c0568a';
const planeSegs = (svg) => allLines(svg).filter((l) => l.stroke === PLATE);
// Fibres are the full-length pole lines (width 1.4, no dash); aster spokes are width 1.
const fiberSegs = (svg) => allLines(svg).filter((l) => (l.stroke === TEAL || l.stroke === ROSE) && l.width === 1.4 && !l.dash);

// Proper segment intersection: interiors cross (shared endpoints / collinear touches do not count).
function properCross(p, q) {
  const o = (a, b, c) => {
    const v = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    return Math.abs(v) < 1e-6 ? 0 : (v > 0 ? 1 : -1);
  };
  const A = { x: p.x1, y: p.y1 }, B = { x: p.x2, y: p.y2 }, C = { x: q.x1, y: q.y1 }, D = { x: q.x2, y: q.y2 };
  const o1 = o(A, B, C), o2 = o(A, B, D), o3 = o(C, D, A), o4 = o(C, D, B);
  return o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0 && o1 !== o2 && o3 !== o4;
}

function svgBox(svg) {
  const m = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  return { w: +m[1], h: +m[2] };
}

// ---- module + geometry ------------------------------------------------------
test('pachytene module loads with its public surface', () => {
  ['available', 'geometry', 'pairing', 'scene'].forEach((k) => assert.equal(typeof P[k], 'function'));
});

test('cross arm lengths are the real proximal/distal segments in Mb', () => {
  // t(11;22)(q23;q11.2): chr11 break far out on a large q arm -> long north (A-proximal) arm and a
  // short west (A-distal) tip; chr22 is small. Values from hg38 band midpoints.
  const g = P.geometry(model('46,XX,t(11;22)(q23;q11.2)'));
  assert.equal(g.type, 'cross');
  assert.ok(Math.abs(g.N - 116) < 3, 'A-proximal ~116 Mb, got ' + g.N.toFixed(1));
  assert.ok(Math.abs(g.W - 19) < 3, 'A-distal ~19 Mb, got ' + g.W.toFixed(1));
  assert.ok(Math.abs(g.S - 21) < 3, 'B-proximal ~21 Mb, got ' + g.S.toFixed(1));
  assert.ok(Math.abs(g.E - 29) < 3, 'B-distal ~29 Mb, got ' + g.E.toFixed(1));
});

test('a different translocation yields a visibly different cross', () => {
  const a = P.geometry(model('46,XX,t(11;22)(q23;q11.2)'));
  const b = P.geometry(model('46,XY,t(2;5)(q21;q31)'));
  // t(2;5) is near-symmetric with long arms; t(11;22) is lopsided. The shape must not be identical.
  assert.notEqual(a.N.toFixed(0), b.N.toFixed(0));
  assert.ok(b.W > a.W + 50, 't(2;5) west arm much longer than t(11;22)');
});

test('robertsonian geometry is the two long arms', () => {
  const g = P.geometry(model('45,XX,rob(13;14)(q10;q10)'));
  assert.equal(g.type, 'tri');
  assert.ok(Math.abs(g.qA - 97) < 3 && Math.abs(g.qB - 90) < 3, '13q ~97, 14q ~90; got ' + g.qA.toFixed(1) + '/' + g.qB.toFixed(1));
});

test('available() is false and render falls back to the schematic when the ideogram is absent', () => {
  const bare = {};
  const ctx = vm.createContext({ window: bare });
  const load = (f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx);
  load('ideogram-data.js'); load('iscn-parser.js'); load('segregation.js');
  delete bare.IDEOGRAM;                    // strip the band data before loading pachytene
  load('pachytene.js');
  const m = bare.Segregation.compute(bare.ISCN.parse('46,XX,t(2;5)(q21;q31)').clones[0]);
  assert.equal(bare.Pachytene.available(m), false);
  const html = bare.Segregation.render(m);
  assert.match(html, /class="seg-scene-svg"/);            // still renders (schematic fallback)
  assert.doesNotMatch(html, /quadrivalent cross/);        // but not the to-scale cross
});

// ---- every figure is well-formed and in-bounds ------------------------------
function figures(k) {
  const m = model(k);
  const modes = m.type === 'robertsonian' ? ROB_MODES : RECIP_MODES;
  const out = { pairing: P.pairing(m) };
  modes.forEach((n) => { out[n] = P.scene(m, n); });
  return out;
}
for (const k of ['46,XX,t(11;22)(q23;q11.2)', '46,XY,t(2;5)(q21;q31)', '46,XX,t(4;8)(p13;q22)', '45,XX,rob(13;14)(q10;q10)']) {
  test('figures for ' + k + ' are valid SVG, in-bounds, no NaN', () => {
    const figs = figures(k);
    for (const [name, svg] of Object.entries(figs)) {
      assert.match(svg, /^<svg class="seg-scene-svg"/, name + ' is an svg');
      assert.doesNotMatch(svg, /NaN|undefined/, name + ' has no NaN/undefined');
      const box = svgBox(svg);
      const coords = [...svg.matchAll(/(?:x|y|x1|y1|x2|y2|cx|cy)="(-?[\d.]+)"/g)].map((mm) => +mm[1]);
      coords.forEach((c) => assert.ok(c >= -30 && c <= Math.max(box.w, box.h) + 30, name + ' coord in-bounds: ' + c));
    }
  });
}

// ---- the invariant: every centromere bead sits on its proximal shaft --------
// A centromere whose true offset is smaller than the synapsis gap plus the distal bar used to
// float off the vertical proximal arm (worst for a break near the centromere: t(4;8) chr4 at
// p13 lands in the gap; t(11;22) chr22 lands on the distal bar). Once the animation pulls the
// chromosomes apart that bead visibly leaves its track. The cross center sits midway between the
// horizontal distal bars (at center +/- O), so derive O and the center from them, then assert
// every bead clears the gap and the distal bar (offset >= O + BAR/2) onto the vertical shaft.
function centromereBeads(svg) {
  // cenDot draws a white r=3.5 bead then a colored r=2.6 core; the white bead marks the point.
  return [...svg.matchAll(/<circle cx="([\d.-]+)" cy="([\d.-]+)" r="3\.5"/g)].map((m) => ({ x: +m[1], y: +m[2] }));
}
const chromBars = (svg) => allLines(svg).filter((l) => l.width === 8);   // BAR width (8)
for (const k of ['46,XX,t(11;22)(q23;q11.2)', '46,XX,t(11;22)(q23;q11)', '46,XY,t(2;5)(q21;q31)', '46,XX,t(4;8)(p13;q22)']) {
  test('every centromere bead sits on its proximal shaft for ' + k, () => {
    const m = model(k);
    RECIP_MODES.forEach((mode) => {
      const svg = P.scene(m, mode);
      const beads = centromereBeads(svg);
      assert.equal(beads.length, 4, mode + ': four centromere beads');
      const hy = chromBars(svg).filter((b) => Math.abs(b.y1 - b.y2) < 0.5).map((b) => b.y1);  // distal bars
      const cy = (Math.min(...hy) + Math.max(...hy)) / 2, O = (Math.max(...hy) - Math.min(...hy)) / 2;
      const minClear = O + 8 / 2 + 3.5 - 0.5;   // clear the gap (O), the distal bar (BAR/2), and the bead radius (3.5)
      beads.forEach((b) => assert.ok(Math.abs(b.y - cy) >= minClear,
        k + ' ' + mode + ': a centromere bead is only ' + Math.abs(b.y - cy).toFixed(1) +
        'px from center (need >= ' + minClear.toFixed(1) + '), floating off its shaft'));
    });
  });
}

// ---- the invariant: the pull slides each chromosome ALONG its fiber ----------
// The animation moves each unit by its --tx/--ty vector. That vector must stay parallel to the
// unit's spindle fiber, or the chromosome drifts off its track when pulled (worst for a steep
// diagonal pull like der(22) to the upper-right pole, which is where capping tx and ty
// independently bends the slide). Assert every pull vector is parallel to some fiber.
function pullVectors(svg) {
  return [...svg.matchAll(/class="seg-chrom" style="--tx:(-?[\d.]+)px;--ty:(-?[\d.]+)px"/g)]
    .map((m) => ({ x: +m[1], y: +m[2] })).filter((v) => Math.hypot(v.x, v.y) > 0.01);
}
for (const k of ['46,XX,t(11;22)(q23;q11.2)', '46,XX,t(11;22)(q23;q11)', '46,XY,t(2;5)(q21;q31)', '46,XX,t(4;8)(p13;q22)']) {
  test('the pull slides each chromosome along its fiber for ' + k, () => {
    const m = model(k);
    RECIP_MODES.forEach((mode) => {
      const svg = P.scene(m, mode);
      const pulls = pullVectors(svg), fibers = fiberSegs(svg).map((f) => ({ x: f.x2 - f.x1, y: f.y2 - f.y1 }));
      assert.equal(pulls.length, 4, mode + ': four pulled units');
      pulls.forEach((p) => {
        const aligned = fibers.some((d) => {
          const cross = p.x * d.y - p.y * d.x, dot = p.x * d.x + p.y * d.y;
          const sinTheta = Math.abs(cross) / (Math.hypot(p.x, p.y) * Math.hypot(d.x, d.y));
          return sinTheta < 0.05 && dot > 0;   // within ~3 degrees of a fiber, pointing toward the pole
        });
        assert.ok(aligned, k + ' ' + mode + ': pull ' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ' is not along any fiber');
      });
    });
  });
}

// ---- the invariant: no spindle fiber crosses a division plane ---------------
for (const k of ['46,XX,t(11;22)(q23;q11.2)', '46,XY,t(2;5)(q21;q31)', '46,XX,t(4;8)(p13;q22)']) {
  test('no fiber crosses a plane for reciprocal ' + k, () => {
    const m = model(k);
    RECIP_MODES.forEach((mode) => {
      const svg = P.scene(m, mode);
      const planes = planeSegs(svg), fibers = fiberSegs(svg);
      // Alternate has diagonal partners, so it draws no straight plane; the others each draw one.
      if (mode === 'Alternate') assert.equal(planes.length, 0, 'alternate has no straight plane');
      else assert.ok(planes.length >= 1, mode + ' draws a plane');
      fibers.forEach((f) => planes.forEach((pl) => {
        assert.ok(!properCross(f, pl), mode + ': a fiber crosses its division plane');
      }));
    });
  });
}
test('no fiber crosses a plane for the robertsonian trivalent', () => {
  const m = model('45,XX,rob(13;14)(q10;q10)');
  ROB_MODES.forEach((mode) => {
    const svg = P.scene(m, mode);
    const planes = planeSegs(svg), fibers = fiberSegs(svg);
    assert.ok(planes.length >= 1, mode + ' draws a plane');
    fibers.forEach((f) => planes.forEach((pl) => {
      assert.ok(!properCross(f, pl), mode + ': a fiber crosses its division plane');
    }));
  });
});

// ---- pole counts read off the fibers ----------------------------------------
test('each mode sends the right number of chromosomes to each pole', () => {
  const m = model('46,XY,t(2;5)(q21;q31)');
  const count = (svg) => ({ teal: fiberSegs(svg).filter((f) => f.stroke === TEAL).length, rose: fiberSegs(svg).filter((f) => f.stroke === ROSE).length });
  assert.deepEqual(count(P.scene(m, 'Alternate')), { teal: 2, rose: 2 });
  assert.deepEqual(count(P.scene(m, 'Adjacent-1')), { teal: 2, rose: 2 });
  assert.deepEqual(count(P.scene(m, 'Adjacent-2')), { teal: 2, rose: 2 });
  assert.deepEqual(count(P.scene(m, '3:1')), { teal: 3, rose: 1 });   // three to one pole, one to the other
});

// ---- the anaphase-pull animation still drives these figures -----------------
test('each segregation unit is an animatable group carrying a pull vector', () => {
  const svg = P.scene(model('46,XY,t(2;5)(q21;q31)'), 'Alternate');
  const units = svg.match(/class="seg-chrom"[^>]*--tx:/g) || [];
  assert.equal(units.length, 4, 'four cross units, each with a --tx/--ty pull');
  const tri = P.scene(model('45,XX,rob(13;14)(q10;q10)'), 'Alternate');
  assert.equal((tri.match(/class="seg-chrom"[^>]*--tx:/g) || []).length, 3, 'three trivalent units');
});

// ---- integration with segregation.js ----------------------------------------
test('with pachytene loaded, the segregation panel uses the to-scale figures', () => {
  const html = Seg.render(model('46,XY,t(2;5)(q21;q31)'));
  assert.match(html, /quadrivalent cross/);   // Pachytene aria-labels
  assert.match(html, /draws the cross and the plane/);
  // still five scene svgs (1 pairing + 4 modes) and the animation toggle
  assert.equal((html.match(/class="seg-scene-svg"/g) || []).length, 5);
  assert.match(html, /id="seg-anim"/);
});
test('the robertsonian panel uses the folded trivalent figure and label', () => {
  const html = Seg.render(model('45,XX,rob(13;14)(q10;q10)'));
  assert.match(html, /trivalent/);
  assert.match(html, /rob\(13;14\)/);   // the fusion label spelled in the figure
});
test('the 3:1 caption no longer says the plate cuts chromosomes', () => {
  const html = Seg.render(model('46,XY,t(2;5)(q21;q31)'));
  assert.doesNotMatch(html, /plate cuts three/);
  assert.match(html, /three-to-one instead of two-and-two/);
});
