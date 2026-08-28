'use strict';
// A karyogram is drawn only for input that IS valid ISCN. Drawing the nearest
// plausible thing is not teaching: it lets a wrong designation look answered, and it
// destroys the app's use as a check, which is what someone writing an exam question
// needs from it. If it draws, the notation was accepted.
//
// The risk this file exists for is the other direction. Refusing valid ISCN is far
// worse than tolerating invalid ISCN, so every karyotype the app itself ships has to
// keep drawing, and so does everything ISCN legitimately permits with a tally that
// cannot be pinned.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), context));
const ISCN = win.ISCN;
const Karyo = win.Karyo;

// Mirrors the gate in index.html: parser-side reasons only. The band check
// (invalidBands) lives in the page and is covered by its own tests.
const refused = (k) => {
  const m = ISCN.parse(k);
  return !m.clones.length
    || m.clones.every((c) => c.modalNumber == null)
    || !!m.suggestion
    || m.clones.some((c) => c.unreadable || c.countWrong);
};

test('the page gate and this file check the same things', () => {
  // Two separate assertions on purpose. Checking only that the flags are READ passes
  // even if the gate stops USING them, since the reads sit on their own lines above.
  const reads = html.match(/ {4}var unreadable = [\s\S]*?\n {4}var invalid/)[0];
  ['c.unreadable', 'c.countWrong'].forEach((n) =>
    assert.ok(reads.includes(n), `page should read ${n} off the clone`));

  const gate = html.match(/ {4}var invalid = [\s\S]*?;\n {4}beacon/)[0];
  ['unreadable', 'countWrong', 'model.suggestion', 'bad.length', 'modalNumber == null']
    .forEach((n) => assert.ok(gate.includes(n), `the invalid gate should consult ${n}`));
});

// ---- refused: not valid ISCN ------------------------------------------------
test('a made-up operation is refused', () => {
  // Drew a full, normal-looking karyogram: the count added up, the band was real, and
  // nothing else objected.
  assert.equal(refused('46,XY,zzz(9)(q34)'), true);
});

test('a chromosome with no sign is refused', () => {
  assert.equal(refused('46,XY,rob(14;21)(q10;q10),21'), true);
});

test('text an operation could not consume is refused', () => {
  assert.equal(refused('46,XY,inv(9)(p11q13)zzz'), true);
  assert.equal(refused('46,XY,t(9;22)(q34;q11.2)ort(1;2)(p10;q10)'), true);
});

test('a breakpoint that is not a breakpoint is refused', () => {
  assert.equal(refused('47,XY,del(5)(zzqewdf2315.2)'), true);
});

// The count of cells is part of the designation, so a bracket that holds something
// else is not valid ISCN and the same call as [0]. The changes may be perfectly good,
// which is why the message says the brackets can come off.
test('brackets that hold something other than a cell count are refused', () => {
  ['46,XY,t(9;22)(q34;q11.2)[-1]', '47,XX,+21[2.5]', '47,XX,+21[abc]', '47,XX,+21[20',
   '47,XX,+21[cp-1]'].forEach((k) => assert.equal(refused(k), true, k));
});

// ISCN 4.2.1 h: within one chromosome the breakpoints run together. Written with a
// semicolon they parse as two groups, and a deletion takes its bands from the first
// group alone, so del(15)(q11.2;q13) drew a terminal loss from 15q11.2 and dropped the
// second breakpoint without a word.
test('breakpoints on one chromosome separated as though on two are refused', () => {
  ['46,XX,del(15)(q11.2;q13)', '46,XX,inv(2)(p23;p13)', '46,XY,r(18)(p11.2;q23)',
   '46,XX,del(15)(q11.2,q13)'].forEach((k) => assert.equal(refused(k), true, k));
  // And the correct spellings still draw.
  ['46,XX,del(15)(q11.2q13)', '46,XX,inv(2)(p23p13)', '46,XY,r(18)(p11.2q23)',
   '46,XY,t(9;22)(q34;q11.2)'].forEach((k) => assert.equal(refused(k), false, k));
});

test('a count the app is willing to call wrong is refused', () => {
  ['46,XY,rob(14;21)(q10;q10),-21', '40,XY,rob(14;21)(q10;q10),-21', '45,XX,t(13;15)(q10;q10)',
   '47,XY,rob(14;21)(q10;q10),+21'].forEach((k) => assert.equal(refused(k), true, k));
});

// ---- drawn: valid ISCN, including the parts that cannot be tallied ----------
// A karyotype states the chromosome count and then the sex chromosomes. Anything but a
// comma between the two swallowed the sex field whole: the count regex read "69" out of
// "69.XX" and stopped at the period, so the whole designation was one field, no sex
// field was ever built, and the app drew 69 chromosomes with both sex slots labelled
// "missing". Nothing objected, because every existing check was looking elsewhere. The
// sex-field check needs a stated field to compare against, the count check is skipped
// when there are no sex chromosomes to count, and the round-trip keeps the count field
// verbatim so it cannot see a character dropped inside it.
test('a separator other than a comma before the sex chromosomes is refused', () => {
  ['69.XX', '46.XY', '46;XY', '46 XY', '46XY', '46:XY', '69.XXX', 'mos 46.XX/47,XX']
    .forEach((k) => assert.equal(refused(k), true, k));
});

test('the comma repair is offered, and it is the karyotype that was meant', () => {
  [['69.XX', '69,XX'], ['46.XY', '46,XY'], ['46;XY', '46,XY'], ['46 XY', '46,XY'],
   ['46XY', '46,XY'], ['69.XXX', '69,XXX'], ['46.XX,+21', '46,XX,+21'],
   ['mos 46.XX/47,XX', 'mos 46,XX/47,XX']].forEach(([bad, want]) => {
    assert.equal(ISCN.parse(bad).suggestion, want, bad);
  });
  // The repair has to name the rule, not report on the parser.
  const w = ISCN.parse('69.XX').warnings.join(' ');
  assert.match(w, /comma/i, `the message should name the comma rule: ${w}`);
});

test('a karyotype with no sex chromosomes stated at all is refused', () => {
  // No repair is possible here, so this leans on the gate rather than a suggestion.
  ['46', '69', '46.', '69.QQ', '47~49'].forEach((k) => assert.equal(refused(k), true, k));
});

test('a subclone that inherits its sex field still draws', () => {
  // idem/sl/sdl stand in for the whole stemline, sex included, so the second clone
  // legitimately states no sex field of its own. This is the case the check above
  // must not catch.
  ['47,XX,+8[cp10]/48,idem,+9', '47,XX,+8/48,sl,+9', '47,XY,+8/46,XY']
    .forEach((k) => assert.equal(refused(k), false, k));
});

test('valid ISCN whose tally cannot be pinned still draws', () => {
  // Refusing any of these would be a worse bug than the one this change fixes.
  [
    '48,XY,+8,inc',                   // inc: further unidentified changes, tally short by design
    '46,XY,inc',
    '47~49,XY,+8',                    // a modal range
    '46~48,XX,+21',
    'mos 45,X[12]/46,XX[18]',         // mosaic, one count per clone
    '45,X[12]/46,XX[18]',
    '47,XY,+8[cp10]',                 // composite
    '46,XX,t(9;22)(q34;q11.2)[cp10]',
    '45<2n>,XY,der(14;21)(q10;q10)',  // explicit ploidy annotation
  ].forEach((k) => assert.equal(refused(k), false, k));
});

test('legal but unusual still draws', () => {
  // 46,XX,t(13;15)(q10;q10) is legal ISCN and gets a note offering the rob() reading.
  // "Unusual" is not "invalid", and refusing it would be a different, worse rule.
  assert.equal(refused('46,XX,t(13;15)(q10;q10)'), false);
  assert.equal(refused('46,XY,t(1;3)(p10;q10)'), false);
});

test('every karyotype the app itself ships still draws', () => {
  // The guided tour, the landing pages, and the example chips. If the gate ever
  // refuses one of these, the app is refusing its own curriculum.
  const content = fs.readFileSync(path.join(root, 'content', 'karyotypes.js'), 'utf8');
  const curated = [...content.matchAll(/\bk:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]);
  assert.ok(curated.length >= 20, `expected the curated set, found ${curated.length}`);
  curated.forEach((k) => assert.equal(refused(k), false, `curated: ${k}`));

  const examples = vm.runInNewContext((html.match(/var EXAMPLES = (\[[\s\S]*?\n {2}\]);/) || [])[1]);
  examples.forEach((e) => assert.equal(refused(e[0]), false, `chip: ${e[0]}`));
});

test('what draws, renders', () => {
  // A gate that lets something through only to have the renderer throw would be no
  // better than drawing nonsense.
  const content = fs.readFileSync(path.join(root, 'content', 'karyotypes.js'), 'utf8');
  [...content.matchAll(/\bk:\s*(['"])([^'"]+)\1/g)].map((m) => m[2]).forEach((k) => {
    const clone = ISCN.parse(k).clones[0];
    const cont = { innerHTML: '' };
    assert.doesNotThrow(() => Karyo.render(cont, clone, {
      theme: 'simple', level: 1, affected: Karyo.computeAffected([clone]),
    }), k);
    assert.ok(cont.innerHTML.includes('kcell'), `${k} drew cells`);
  });
});

// A count that contradicts the tally has two honest readings: the number is wrong, or
// what follows it is. The app offered only the first, so "50,XXXXXXX" got a single chip
// reading 51,XXXXXXX, presented as the answer, when dropping an X to reach the stated 50
// is exactly as plausible. Where both readings are well defined, both are offered.
test('a count contradicted by the sex chromosomes offers both readings', () => {
  const fixes = (k) => ISCN.parse(k).fixes || [];
  assert.equal(fixes('50,XXXXXXX').join(' | '), '51,XXXXXXX | 50,XXXXXX');
  assert.equal(fixes('70,XXX').join(' | '), '69,XXX | 70,XXXX');
  // Order matters: the count fix is the smaller edit, so it leads.
  assert.equal(fixes('50,XXXXXXX')[0], '51,XXXXXXX');
});

test('the second reading is withheld when it is not well defined', () => {
  const fixes = (k) => ISCN.parse(k).fixes || [];
  // Mixed sex letters: dropping an X and dropping the Y give different karyotypes, and
  // nothing in the input says which was meant.
  assert.equal(fixes('50,XXXXXXY').join(' | '), '51,XXXXXXY');
  // An aberration is present, so the excess is not necessarily in the sex field.
  assert.equal(fixes('50,XXXXXXX,+21').join(' | '), '52,XXXXXXX,+21');
});

test('no offered repair is a dead end', () => {
  // A fix does not have to draw. It has to fix the mistake it addresses, and the app
  // names one mistake at a time, so landing on a different one is progress: "69.XX"
  // repairs to "69,XX", which is refused for its count and then offers "69,XXX", the
  // triploidy that was probably meant. What must never be offered is a repair that is
  // refused with nothing further to click, which is a wasted click and no information.
  const deadEnd = (f) => refused(f) && ISCN.parse(f).fixes.length === 0;
  ['50,XXXXXXX', '70,XXX', '69.XX', '46 XY', '46,,', '46,,XY,,', 't(9;22)(q34;q11.2)',
   '46,XY,rob(14;21)(q10;q10),-2-21', '47~49,XY,+8,,', '50,XXXXXXY'].forEach((k) => {
    ISCN.parse(k).fixes.forEach((f) => assert.equal(deadEnd(f), false, `${k} -> ${f}`));
  });
  // And the feature has to exist: reading `fixes` off a parse that never sets it would
  // let every assertion above pass over an empty list.
  ['50,XXXXXXX', '69.XX', '46 XY', 't(9;22)(q34;q11.2)'].forEach((k) =>
    assert.ok(ISCN.parse(k).fixes.length > 0, `${k} should offer at least one fix`));
  // "46,," is the case the vetting exists for: its repair "46" states no sex
  // chromosomes, so it is refused with nothing onward, and the message carries it alone.
  assert.equal(ISCN.parse('46,,').fixes.length, 0);
});

test('every clicked repair eventually reaches something drawable', () => {
  // Following the chain must terminate on a karyogram rather than loop or stall. Three
  // steps is the depth the app should ever need.
  ['69.XX', '50,XXXXXXX', '70,XXX', '46 XY', '46;XY', 't(9;22)(q34;q11.2)', '+21',
   '46,XY,rob(14;21)(q10;q10),-2-21'].forEach((k) => {
    let cur = k;
    let reached = false;
    for (let step = 0; step < 3 && !reached; step++) {
      if (!refused(cur)) { reached = true; break; }
      const fixes = ISCN.parse(cur).fixes;
      assert.ok(fixes.length, `${k}: stalled at "${cur}" with no repair on offer`);
      cur = fixes[fixes.length - 1];   // the reading that changes the content, when there is one
      if (!refused(cur)) reached = true;
    }
    assert.ok(reached, `${k}: no drawable karyotype within three repairs (stopped at "${cur}")`);
  });
});

test('typing only the rearrangement gives one message, not two', () => {
  // #122 added a "starts with the chromosome count" message that fired here as well as
  // the more specific one this path already had, because the repair is decided after it.
  ['t(9;22)(q34;q11.2)', 'del(5)(p15.2)', '+21'].forEach((k) => {
    const w = ISCN.parse(k).warnings;
    assert.equal(w.length, 1, `${k}: ${JSON.stringify(w)}`);
    assert.match(w[0], /only the rearrangement/, w[0]);
  });
});

test('the count message names what disagrees with the number', () => {
  // "the changes listed after it" is wrong when there are no changes: in 50,XXXXXXX the
  // number disagrees with the sex chromosomes.
  const w = ISCN.parse('50,XXXXXXX').warnings.join(' ');
  assert.match(w, /sex chromosomes/, w);
  assert.ok(!/changes listed after it/.test(w), `should not blame changes that are absent: ${w}`);
  // The aberration case keeps its wording.
  assert.match(ISCN.parse('46,XY,rob(14;21)(q10;q10),-21').warnings.join(' '), /changes listed after it/);
});

// A trailing period from a sentence or a copy-paste. "47-49,XY,+8,+21[cp10]." got
// "“+21[cp10].” is not a change KaryoDraw recognizes", which names the token that failed
// instead of the mistake: the cell-count pattern is anchored to the end of the field, so
// the stray period kept it from matching and swallowed the whole change with it.
test('a trailing period is named and removed, not reported as a bad change', () => {
  const cases = [
    ['47-49,XY,+8,+21[cp10].', '47-49,XY,+8,+21[cp10]'],
    ['46,XY,+21.', '46,XY,+21'],
    ['46,XY.', '46,XY'],
    ['46,XY,t(9;22)(q34;q11.2).', '46,XY,t(9;22)(q34;q11.2)'],
    ['46,XY;', '46,XY'],
    ['46,XY,del(5)(p15.2):', '46,XY,del(5)(p15.2)'],
  ];
  cases.forEach(([bad, want]) => {
    assert.equal(ISCN.parse(bad).suggestion, want, bad);
    const w = ISCN.parse(bad).warnings.join(' ');
    assert.ok(!/is not a change KaryoDraw recognizes/.test(w),
      `should name the trailing punctuation, not blame the change: ${w}`);
  });
});

test('punctuation that is part of the notation is left alone', () => {
  // A sub-band ends in a digit after a period, a cell count in "]", a qualifier in a
  // letter. Only a mark at the very end of the whole designation is stray.
  ['46,XY,del(11)(q24.1)', '46,XY,del(5)(p15.2)', '46,XY,t(9;22)(q34;q11.2)[20]',
   '46,XY,del(22)(q11.2)mat', '47~49,XY,+8', '47-49,XY,+8', '46,XY,+21c']
    .forEach((k) => assert.equal(ISCN.parse(k).suggestion, null, k));
});

// A dash range draws and is correct enough to keep, but the ISCN spelling is a tilde.
// Saying so only in the decode prose left the reader to retype it, and left the question
// "so which one is it" open: the chip still showed the dash. It is now offered as a
// one-click alternative in the neutral note box, the same mechanism that offers rob()
// for a whole-arm acrocentric t().
test('a dash range still draws and is never refused', () => {
  ['46-49,XY', '47-49,XY,+8', '47-49,XY,+8,+21[cp10]', '46-48,XX,+21']
    .forEach((k) => assert.equal(refused(k), false, k));
});

test('a dash range is offered the tilde spelling as a note, not a warning', () => {
  const m = ISCN.parse('46-49,XY');
  assert.equal(m.warnings.length, 0, `should not warn: ${JSON.stringify(m.warnings)}`);
  assert.equal(m.fixes.length, 0, 'should not sit in the "did you mean" box');
  assert.ok(m.note, 'should carry a note');
  assert.equal(m.note.fix, '46~49,XY');
  assert.match(m.note.text, /tilde/, m.note.text);
  assert.ok(m.note.fixLabel, 'the note needs its own label, not the Robertsonian wording');
});

test('a tilde range carries no note, and the note slot is not stolen', () => {
  assert.equal(ISCN.parse('47~49,XY,+8').note, null);
  assert.equal(ISCN.parse('46,XY').note, null);
  // The whole-arm acrocentric note still owns the slot when both could apply.
  const acro = ISCN.parse('46,XX,t(13;15)(q10;q10)');
  assert.ok(acro.note && /Robertsonian/.test(acro.note.text), 'acro note should survive');
});

test('the tilde note keeps the rest of the karyotype intact', () => {
  assert.equal(ISCN.parse('47-49,XY,+8,+21[cp10]').note.fix, '47~49,XY,+8,+21[cp10]');
  assert.equal(ISCN.parse('mos 46-49,XY/46,XX').note, null);   // more than one clone: left alone
});

// ---- the whole-chromosome fallback must be unreachable ----------------------
// buildInstance ends four of its branches (ins, rec, dic, der/t) with
//   if (built) return built;
//   return { segments: [fullSeg(chrom)], ..., note: "complex" };
// and nothing downstream reads `note`. So a builder that returns null does not fail,
// it draws a full, untouched, single-centromere chromosome under an abnormal caption.
// That is the most dangerous thing this app can do: the figure looks answered and is
// silently false, which is the whole reason for the gate in docs/VALIDATION.md.
//
// The house rule from the fra fallback applies here too: never leave a fallback
// without a test that it cannot be reached. Reached is exactly what it was. The
// back-reference form ISCN 4.2.1 f allows, 46,XX,t(9;22)(q34;q11.2)[3]/47,XX,+8,t(9;22)[17],
// omits the breakpoints on the second mention; the parser correctly excused that from
// the arity check and then handed the renderer an aberration with no breakpoints, so
// the second clone of a mosaic drew an intact 9 and an intact 22 captioned der(9) and
// der(22), beside a first clone that drew the Philadelphia correctly. Both on screen
// at once, no warning.
const ISCN_2024 = require('./iscn-2024-examples.js');

// Every non-normal instance the app agrees to draw, across a corpus.
function builtInstances(k) {
  const out = [];
  let model;
  try { model = ISCN.parse(k); } catch { return out; }
  for (const clone of model.clones || []) {
    if (clone.unreadable) continue;
    for (const ch of Object.keys(clone.slots || {})) {
      for (const inst of clone.slots[ch] || []) {
        if (inst.kind === 'normal') continue;
        try { out.push({ inst, built: Karyo.buildInstance(inst) }); } catch { /* covered elsewhere */ }
      }
    }
  }
  return out;
}

test('no karyotype the app draws reaches the whole-chromosome fallback', () => {
  const reached = [];
  for (const e of ISCN_2024) {
    if (!e.supported) continue;
    for (const { inst, built } of builtInstances(e.k)) {
      if (built.note === 'complex') reached.push(`${e.k} [${inst.label}]`);
    }
  }
  assert.deepEqual(reached, [],
    'a builder returned null and the renderer drew a normal chromosome under an abnormal caption');
});

// The same statement over the stress corpus, which carries the app's own cases rather
// than the standard's. Kept separate so a failure names which corpus found it.
test('the stress corpus reaches the fallback nowhere either', async () => {
  const { CORPUS } = await import('../scripts/stress-corpus.mjs');
  const reached = [];
  for (const e of CORPUS) {
    if (e.expect !== 'draw') continue;
    for (const { inst, built } of builtInstances(e.k)) {
      if (built.note === 'complex') reached.push(`${e.k} [${inst.label}]`);
    }
  }
  assert.deepEqual(reached, []);
});

// The fix, stated as the behaviour rather than as the absence of a flag: a clone that
// back-references a rearrangement draws the SAME chromosome as the clone that spelled
// its breakpoints out. ISCN 4.2.1 f says the second mention means the first one, so
// the two figures have to agree.
test('a back-referenced rearrangement draws what the first mention drew', () => {
  const spans = (k) => {
    const model = ISCN.parse(k);
    return model.clones.map((clone) => {
      const out = {};
      Object.keys(clone.slots || {}).forEach((ch) =>
        (clone.slots[ch] || []).forEach((inst) => {
          if (inst.kind === 'normal') return;
          const b = Karyo.buildInstance(inst);
          out[inst.label] = b.segments.map((s) => `${s.chrom}:${s.from}-${s.to}`).join('|');
        }));
      return out;
    });
  };

  const [first, second] = spans('46,XX,t(9;22)(q34;q11.2)[3]/47,XX,+8,t(9;22)[17]');
  assert.equal(second['der(9)'], first['der(9)'], 'the back-referenced der(9) is the same chromosome');
  assert.equal(second['der(22)'], first['der(22)']);
  // Not vacuous: the derivative must actually carry material from both partners, which
  // is precisely what the fallback did not do.
  assert.match(first['der(9)'], /^9:.*\|22:/, 'der(9) is chromosome 9 plus a piece of 22');

  const [c1, c2] = spans('47,XX,t(2;13)(q37;q14),der(14;21)(q10;q10)c,+18,+mar[3]/45,XX,der(14;21)c[17]');
  assert.equal(c2['der(14;21)'], c1['der(14;21)'], 'a whole-arm der back-reference too');
});

// The der(A;B) chain walk had a fixed eight-step guard, so nine joins fell to a
// build that kept one centromere and the wrong piece of chromosome 7 while the
// decode kept promising a dicentric. The length is the notation's to choose
// (ISCN 5.5.3 puts no ceiling on it); a chain that does not hold together is not
// this derivative's description at all, whatever its length.
test('a der(A;B) chain draws at any length, and a broken chain is refused', () => {
  assert.equal(refused('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)t(7;12)(p13;q24.1)'), false);
  assert.equal(refused('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)t(11;12)(q23;q13)'
    + 't(12;14)(q24;q11.2)t(14;16)(q31;q11.2)t(16;18)(q22;q11.2)t(2;18)(q21;q21)'
    + 't(2;4)(q31;q21)t(4;7)(q31;p13)'), false, 'nine joins draw');
  assert.equal(refused('45,XY,der(5;7)t(3;5)(q21;q22)t(3;11)(q29;q13)'), true,
    'a chain that never reaches chromosome 7');
  assert.equal(refused('45,XY,der(5;7)t(3;5)(q21;q22)t(3;7)(q29;p13)t(9;11)(q22;q13)'), true,
    'a join connected to nothing');
});
