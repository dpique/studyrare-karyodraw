'use strict';
// The recurrent-rearrangement table.
//
// Dan, 2026-09-08, after the first two entries went in one at a time: "but like
// the fusions specifically... not just thhis one... i guess we need a new database
// or whatever... Think about what the user would want to know or see for looking
// at an inversion / translocation whatever and if they were a cancer
// cytogeneticist."
//
// So: one structured table rather than prose matchers bolted to the constitutional
// syndrome list, and every record answers the same four questions in the same
// order. What it joins, what disease that makes, whether it is a fusion protein or
// a juxtaposition or an enhancer being moved, and what changes for the patient.
//
// The old acquired entries lived in SYNDROMES beside trisomy 21 and matched on
// chromosome pair alone through hasT, which could not tell t(16;21)(p11.2;q22)
// from t(16;21)(q24;q22). They are now records here, matched on breakpoints.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const win = {};
const context = vm.createContext({ window: win });
['ideogram-data.js', 'iscn-parser.js', 'karyo-render.js', 'teach.js'].forEach((f) =>
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), context));
const ISCN = win.ISCN;
const Karyo = win.Karyo;
const Teach = win.Teach;

const hits = (k) => Teach.syndromes(ISCN.parse(k).clones[0]).filter((s) => s.genes);
// Plain substring, not a RegExp: every lesion name contains parentheses and
// semicolons, so "t(8;21)" compiled as a pattern is "t" plus a capture group and
// matches nothing. Copied into the test realm so assertions do not trip over the
// vm realm's array prototype.
const names = (k) => [...hits(k).map((s) => s.name)];
const one = (k) => {
  const h = hits(k);
  assert.equal(h.length, 1, k + ' should match exactly one lesion, got ' + JSON.stringify(h.map((x) => x.name)));
  return h[0];
};

test('the classics are recognised, each exactly once', () => {
  const cases = [
    ['46,XY,t(9;22)(q34;q11.2)', 'Philadelphia'],
    ['46,XY,t(8;21)(q22;q22)', 't(8;21)'],
    ['46,XY,inv(16)(p13.1q22)', 'inv(16)'],
    ['46,XX,t(16;16)(p13.1;q22)', 'inv(16)'],
    ['46,XY,t(15;17)(q24;q21)', 't(15;17)'],
    ['46,XY,inv(3)(q21.3q26.2)', 'inv(3)'],
    ['46,XX,t(8;14)(q24;q32)', 'Burkitt'],
    ['46,XX,t(14;18)(q32;q21)', 'follicular'],
    ['46,XX,t(11;14)(q13;q32)', 'mantle'],
    ['46,XY,t(12;21)(p13;q22)', 'childhood B-ALL'],
    ['46,XY,t(4;11)(q21;q23)', 't(4;11)'],
    ['46,XY,t(6;9)(p23;q34)', 't(6;9)'],
    ['46,XX,t(11;18)(q22;q21)', 'MALT'],
    ['46,XY,t(11;22)(q24;q12)', 'Ewing'],
    ['46,XY,t(X;18)(p11.2;q11.2)', 'synovial'],
    ['46,XX,t(2;13)(q35;q14)', 'rhabdomyosarcoma'],
    ['46,XY,t(2;5)(p23;q35)', 'anaplastic'],
    ['46,XY,t(8;13)(p11;q12)', 'FGFR1'],
    ['46,XX,t(8;9)(p22;p24)', 'PCM1::JAK2'],
    ['46,XY,t(3;21)(q26;q22)', 'RUNX1::MECOM'],
    ['46,XY,t(5;11)(q35;p15.5)', 'NUP98::NSD1'],
    ['46,XX,t(5;14)(q35;q32)', 'TLX3'],
    ['46,XY,inv(14)(q11q32)', 'T-prolymphocytic'],
    ['46,XX,t(11;22)(p13;q12)', 'desmoplastic'],
    ['46,XX,t(X;17)(p11.2;q25)', 'alveolar soft part'],
    ['46,XY,t(15;19)(q14;p13.1)', 'NUT'],
    ['46,XY,inv(2)(p21p23)', 'EML4::ALK'],
    ['46,XX,inv(10)(q11.2q21)', 'papillary thyroid'],
    ['46,XX,t(2;3)(q13;p25)', 'follicular thyroid'],
    ['46,XX,t(7;16)(q33;p11)', 'fibromyxoid'],
    ['46,XY,t(4;19)(q35;q13)', 'CIC-rearranged'],
    ['46,XX,t(7;17)(p15;q21)', 'endometrial stromal'],
    ['46,XX,t(6;11)(p21;q12)', 'TFEB'],
    ['46,XY,t(16;17)(q22;p13)', 'aneurysmal bone cyst'],
  ];
  for (const [k, frag] of cases) {
    assert.ok(one(k).name.indexOf(frag) >= 0, k + ' should name ' + frag + ', got ' + one(k).name);
  }
});

test('a historical spelling of the same lesion still lands', () => {
  // t(15;17) has been published as (q22;q12), (q22;q21) and (q24.1;q21.2). All
  // three are the promyelocytic leukemia, and refusing the spelling in someone's
  // older report would be its own kind of wrong answer.
  for (const k of ['46,XY,t(15;17)(q22;q12)', '46,XY,t(15;17)(q22;q21)',
                   '46,XY,t(15;17)(q24;q21)', '46,XY,t(15;17)(q24.1;q21.2)']) {
    assert.ok(one(k).name.indexOf('t(15;17)') >= 0, k);
  }
});

test('the chromosome pair alone is not enough, which is the point of the rewrite', () => {
  // t(16;21)(p11.2;q22) is FUS::ERG. t(16;21)(q24;q22) is a different fusion of
  // the same two chromosomes, now a record of its own. The old hasT matched on
  // the pair and could not have told them apart.
  assert.ok(one('46,XY,t(16;21)(p11.2;q22)').name.indexOf('FUS::ERG') >= 0);
  assert.ok(one('46,XY,t(16;21)(q24;q22)').name.indexOf('RUNX1::CBFA2T3') >= 0, 'q24;q22 is the other t(16;21)');
  // Same for a Philadelphia-looking t(9;22) at the wrong band.
  assert.equal(names('46,XX,t(9;22)(q34;q13)').length, 0, 'q13 is not the BCR breakpoint');
  assert.equal(names('46,XX,t(8;14)(q11.2;q32)').length, 0, 'q11.2 is not the MYC breakpoint');
});

test('a chromosome pair can carry more than one lesion, and they stay apart', () => {
  // The cases that make breakpoint matching load-bearing rather than tidy.
  // Each shares its chromosome pair with a different entry and is a different
  // disease with a different prognosis. Answering from the pair alone would be
  // confident and wrong every time.
  assert.ok(one('46,XY,inv(16)(p13.1q22)').name.indexOf('core-binding-factor') >= 0);
  assert.ok(one('46,XY,inv(16)(p13.3q24.3)').name.indexOf('megakaryoblastic') >= 0);

  assert.ok(one('46,XY,t(9;22)(q34;q11.2)').name.indexOf('Philadelphia') >= 0);
  assert.ok(one('46,XY,t(9;22)(q22;q12)').name.indexOf('chondrosarcoma') >= 0);

  assert.ok(one('46,XY,t(15;17)(q24;q21)').name.indexOf('acute promyelocytic') >= 0);
  assert.ok(one('46,XY,t(11;17)(q23;q21)').name.indexOf('ATRA-resistant') >= 0);

  // The two arms of chromosome 11 in t(11;22): q24 is Ewing sarcoma, p13 is the
  // desmoplastic small round cell tumour, and nothing but the arm separates them.
  assert.ok(one('46,XX,t(11;22)(q24;q12)').name.indexOf('Ewing') >= 0);
  assert.ok(one('46,XX,t(11;22)(p13;q12)').name.indexOf('desmoplastic') >= 0);

  // Two t(5;14)s: q31 puts IL3 under the IGH enhancer in B-ALL, q35 puts TLX3
  // beside BCL11B in T-ALL.
  assert.ok(one('46,XX,t(5;14)(q31;q32)').name.indexOf('eosinophilia') >= 0);
  assert.ok(one('46,XX,t(5;14)(q35;q32)').name.indexOf('TLX3') >= 0);

  // Two t(6;11)s: q27;q23 is a KMT2A leukemia, p21;q12 is a renal carcinoma in
  // a child, and only the arms separate a marrow disease from a kidney tumour.
  assert.ok(one('46,XY,t(6;11)(q27;q23)').name.indexOf('KMT2A') >= 0);
  assert.ok(one('46,XX,t(6;11)(p21;q12)').name.indexOf('TFEB') >= 0);
});

test('the two spellings of one lesion are not called the same rearrangement', () => {
  // inv(16) and t(16;16) reach one fusion gene by two different structural routes,
  // one intramolecular and one between homologs, and the figures this app draws
  // for them differ: the inversion marks its middle inverted, the translocation
  // marks its tips exchanged. Saying "the same lesion written two ways" was wrong
  // in a way the app's own picture contradicted (Dan, 2026-09-08).
  const note = one('46,XY,inv(16)(p13.1q22)').note;
  assert.match(note, /Two different rearrangements with one result/);
  assert.doesNotMatch(note, /the same lesion written two ways/);
  assert.match(one('46,XY,inv(3)(q21.3q26.2)').note, /Two different rearrangements with one result/);
});

test('which chromosome is written first does not matter', () => {
  // t(9;22) and t(22;9) are the same event, and ISCN order is the writer's choice.
  assert.ok(one('46,XY,t(22;9)(q11.2;q34)').name.indexOf('Philadelphia') >= 0);
});

test('a join carried inside a derivative is still found', () => {
  // der(9)t(9;22)(q34;q11.2) carries the Philadelphia join in a sub-operation.
  // Sub-ops name the operation in .op where a top-level aberration uses .kind, and
  // reading only .kind missed every one of these.
  assert.ok(one('46,XX,der(9)t(9;22)(q34;q11.2)').name.indexOf('Philadelphia') >= 0);
});

test('an inversion and a homologous translocation of one lesion agree', () => {
  // The two spellings must produce the identical record, not two near-copies.
  const a = one('46,XY,inv(16)(p13.1q22)');
  const b = one('46,XX,t(16;16)(p13.1;q22)');
  assert.equal(a.name, b.name);
  assert.equal(a.note, b.note);
  const c = one('46,XY,inv(3)(q21.3q26.2)');
  const d = one('46,XY,t(3;3)(q21.3;q26.2)');
  assert.equal(c.note, d.note);
});

test('every record states a mechanism, and the lead sentence reflects it', () => {
  const KINDS = { fusion: 1, juxtaposition: 1, enhancer: 1, dosage: 1 };
  Teach.FUSIONS.forEach((f) => {
    assert.ok(KINDS[f.kind], f.name + ' has a known kind, got ' + f.kind);
    if (f.kind === 'dosage') assert.equal(f.genes.length, 0, f.name + ' is a dosage lesion and names no fusion pair');
    else assert.ok(f.genes && f.genes.length === 2, f.name + ' names two genes');
    assert.ok(f.disease && f.disease.length, f.name + ' names a disease');
    assert.ok(f.note && f.note.length, f.name + ' has a note');
    assert.ok(f.bands && f.bands.length, f.name + ' has at least one breakpoint pair');
    f.bands.forEach((pr) => assert.equal(pr.length, 2, f.name + ' band pairs have two ends'));
  });
  // A juxtaposition says so, because it is the distinction that explains why the
  // immunoglobulin partners behave unlike BCR::ABL1.
  assert.match(one('46,XX,t(8;14)(q24;q32)').note, /juxtaposition rather than a fusion protein/);
  assert.match(one('46,XY,t(9;22)(q34;q11.2)').note, /^<i>BCR::ABL1<\/i>\./);
  assert.match(one('46,XY,inv(3)(q21.3q26.2)').note, /enhancer repositioned to <i>MECOM<\/i>/);
});

test('every breakpoint of every record resolves on the band map', () => {
  // A band that does not resolve cannot be matched, so the record would be dead
  // weight that no karyotype ever reaches.
  Teach.FUSIONS.forEach((f) => {
    f.bands.forEach((pr) => {
      assert.ok(Karyo.resolveBand(f.chroms[0], pr[0]), f.name + ': ' + f.chroms[0] + pr[0]);
      assert.ok(Karyo.resolveBand(f.chroms[1], pr[1]), f.name + ': ' + f.chroms[1] + pr[1]);
    });
  });
});

test('every gene named in the table is on the gene map, at a real band', () => {
  // The breakpoint line names genes from CANCER_GENES. A partner missing there
  // does not fail loudly: it silently drops half of that lesion's breakpoint line.
  const byName = {};
  Teach.CANCER_GENES.forEach((g) => { byName[g.g] = g; });
  Teach.FUSIONS.forEach((f) => {
    f.genes.forEach((g) => {
      assert.ok(byName[g], g + ' (from ' + f.name + ') is in CANCER_GENES');
      assert.ok(Karyo.resolveBand(byName[g].c, byName[g].b),
        g + ' resolves to a real band, ' + byName[g].c + byName[g].b);
    });
  });
});

test('each gene sits on one of the chromosomes its lesion joins', () => {
  // Catches a transposed record: a partner filed under the wrong chromosome would
  // still resolve to a band and would still render, just on the wrong arm.
  Teach.FUSIONS.forEach((f) => {
    const byName = {};
    Teach.CANCER_GENES.forEach((g) => { byName[g.g] = g; });
    f.genes.forEach((g) => {
      assert.ok(f.chroms.indexOf(byName[g].c) >= 0,
        g + ' is on chromosome ' + byName[g].c + ', but ' + f.name + ' joins ' + f.chroms.join(' and '));
    });
  });
});

test('no two records claim the same karyotype', () => {
  // Two matching records would print two contradictory notes for one figure.
  const seen = {};
  Teach.FUSIONS.forEach((f) => {
    f.bands.forEach((pr) => {
      const key = [f.chroms[0] + pr[0], f.chroms[1] + pr[1]].sort().join('|');
      assert.ok(!seen[key], 'two records claim ' + key + ': ' + seen[key] + ' and ' + f.name);
      seen[key] = f.name;
    });
  });
});

test('the constitutional notes are untouched by the migration', () => {
  const conNames = (k) => [...Teach.syndromes(ISCN.parse(k).clones[0]).map((s) => s.name)];
  assert.ok(conNames('47,XX,+21').some((n) => /Down syndrome/.test(n)));
  assert.ok(conNames('45,X').some((n) => /Turner/.test(n)));
  assert.ok(conNames('46,XY,del(5)(p15.2)').some((n) => /Cri-du-chat/.test(n)));
  assert.ok(conNames('46,Y,fra(X)(q27.3)').some((n) => /Fragile X/.test(n)));
});

test('a whole-arm derivative is read at the centromere, and only there', () => {
  // der(1;7)(q10;p10) joins 1q to 7p with no gene at the seam; the disease is
  // dosage, and the usual written form carries the compensating +1. joinEnds
  // reads the p10/q10 spellings only, so a der(9)t(9;22) still arrives through
  // its sub-operations and nothing else leaks in.
  const d = one('46,XX,+1,der(1;7)(q10;p10)');
  assert.ok(d.name.indexOf('der(1;7)') >= 0);
  assert.match(d.note, /gained 1q and a lost 7q/);
  assert.ok(one('45,XY,der(1;7)(q10;p10)').name.indexOf('der(1;7)') >= 0, 'the bare derivative still lands');
  // A Robertsonian parses to der with q10;q10 and must not borrow the note.
  assert.equal(hits('45,XX,rob(13;14)(q10;q10)').length, 0, 'rob is not a recurrent cancer lesion');
  assert.equal(hits('45,XY,der(13;14)(q10;q10)').length, 0, 'nor is its der spelling');
});

test('the common benign inversions stay unnamed', () => {
  // inv(2)(p11.2q13), inv(9)(p12q13) and inv(10)(p11.2q21.2) are population
  // heteromorphisms a reader will absolutely type. Their breakpoints differ from
  // EML4::ALK and RET/PTC1, and calling a normal variant a cancer would be the
  // worst answer this table could give.
  for (const k of ['46,XX,inv(2)(p11.2q13)', '46,XY,inv(9)(p12q13)', '46,XX,inv(10)(p11.2q21.2)']) {
    assert.equal(hits(k).length, 0, k + ' is a benign variant, not a lesion');
  }
});

test('the inversion and homolog-translocation spellings of T-PLL agree', () => {
  const a = one('46,XY,inv(14)(q11q32)');
  const b = one('46,XX,t(14;14)(q11;q32)');
  assert.equal(a.name, b.name);
  assert.equal(a.note, b.note);
});

test('the ASPS join is found inside its usual unbalanced derivative', () => {
  // Alveolar soft part sarcoma usually carries der(17)t(X;17), not the balanced
  // exchange, so the sub-operation walk is what finds it in practice.
  assert.ok(one('46,XX,der(17)t(X;17)(p11.2;q25)').name.indexOf('alveolar soft part') >= 0);
});

test('the constitutional t(3;8) is a syndrome note, not an acquired lesion', () => {
  const all = Teach.syndromes(ISCN.parse('46,XX,t(3;8)(p14.2;q24.1)').clones[0]);
  const rcc = [...all.filter((s) => /familial renal/.test(s.name))];
  assert.equal(rcc.length, 1, 'the familial RCC translocation is recognised');
  assert.ok(!rcc[0].acquired, 'it is constitutional, so the segregation panel must stay available');
  assert.equal(hits('46,XX,t(3;8)(p14.2;q24.1)').length, 0, 'it is not in the acquired table');
});

test('the deliberate ambiguities are written into the notes', () => {
  // t(14;18)(q32;q21) cannot distinguish BCL2 from MALT1 at the resolution people
  // actually write, so the follicular record carries the ambiguity rather than a
  // colliding MALT record existing. FIP1L1::PDGFRA has no karyotype at all; it is
  // named where a reader hunting the eosinophilia family will look.
  assert.match(one('46,XX,t(14;18)(q32;q21)').note, /MALT1/);
  assert.match(one('46,XY,t(5;12)(q33;p13)').note, /FIP1L1/);
});

test('house style holds across every note in the table', () => {
  // These are shipped prose. Dan's rule is every artifact, and a table this size
  // is exactly where a stray contraction survives review.
  Teach.FUSIONS.forEach((f) => {
    const text = f.disease + ' ' + f.note;
    assert.equal(text.indexOf('—'), -1, f.name + ' has an em dash');
    assert.doesNotMatch(text, /\b(it|that|there|is|does|do|was|are|we|they|you|what)'(s|t|re|ve|ll|d)\b/i,
      f.name + ' has a contraction');
  });
});
