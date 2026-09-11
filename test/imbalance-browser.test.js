'use strict';
// The net-imbalance panel in a real browser: the table appears exactly when a
// run deviates from its baseline, the cancer-gene checkbox adds italic gene
// symbols to gained and lost rows only, and the draw gate sweeps the panel
// away with everything else when a karyotype is refused.
const { test } = require('node:test');
const assert = require('node:assert/strict');

const { findChrome, launchBrowser, serveSite } = require('../scripts/lib/browser.js');
const CHROME = findChrome();

test('the net-imbalance table appears, toggles genes, and obeys the gate', async (t) => {
  if (!CHROME) { t.skip('no Chrome executable found; set CHROME_PATH'); return; }
  const server = await serveSite();
  const port = server.address().port;
  const browser = await launchBrowser();
  const open = async (page, k) => {
    await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent(k)}&style=highlight&show=involved`,
      { waitUntil: 'load' });
    await page.waitForSelector('#kinput');
  };
  try {
    const page = await browser.newPage();

    await t.test('the card is titled by what it lists, not by an outcome it may not have', async () => {
      // "Involved segments", not "Net imbalance": the table lists every segment of
      // the involved chromosomes with its dosage, balanced or not, so "imbalance"
      // was wrong for a balanced translocation (Dan, 2026-09-05).
      await open(page, '46,XY,t(10;15)(q23.33;p10)');
      await page.waitForSelector('#imbalance table');
      const title = await page.evaluate(() =>
        document.querySelector('#imbalance-card h2').textContent.trim());
      assert.equal(title, 'Involved segments');
      assert.doesNotMatch(title, /imbalance/i, 'the title no longer asserts an imbalance');
    });

    await t.test('the worked example shows its partition, sizes included', async () => {
      await open(page, '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
      await page.waitForSelector('#imbalance table');
      const rows = await page.evaluate(() =>
        [...document.querySelectorAll('#imbalance tbody tr')].map((r) =>
          [...r.cells].map((c) => c.textContent.trim()).join(' | ')));
      assert.equal(rows.length, 6, 'four runs of 8 and two of 9: ' + JSON.stringify(rows));
      assert.match(rows[0], /8pter→8q10 \| 0 \| nullisomy \| ~\d+ Mb/);
      assert.match(rows[2], /8q22→8q24\.1 \| 1 \| monosomy/);
      assert.match(rows[5], /9q12→9qter \| 3 \| trisomy/);
    });

    await t.test('the gene checkbox adds italic symbols to imbalanced rows only', async () => {
      assert.equal(await page.evaluate(() => document.querySelectorAll('#imbalance i').length), 0,
        'off by default');
      await page.click('#imbgenes');
      await page.waitForSelector('#imbalance td.call i');
      const withGenes = await page.evaluate(() => ({
        myc: [...document.querySelectorAll('#imbalance td.call')].some((c) => /includes.*MYC/.test(c.textContent)),
        balancedRowHasGene: [...document.querySelectorAll('#imbalance tr.even td.call')].some((c) => /includes/.test(c.textContent)),
        italic: !!document.querySelector('#imbalance td.call i'),
      }));
      assert.ok(withGenes.myc, 'the nullisomic distal 8q names MYC');
      assert.ok(withGenes.italic, 'gene symbols are italicized');
      assert.ok(!withGenes.balancedRowHasGene, 'balanced context rows stay unannotated');
    });

    await t.test('a balanced rearrangement lists its segments and says which ones moved', async () => {
      // Dan, 2026-08-30: balanced rearrangements join the table so their segments
      // keep a size somewhere after the prose lost its parentheticals. The old
      // "None:" summary line is gone (Dan, 2026-09-05): the table's own "balanced"
      // calls say it, and the line only existed to answer the former title.
      //
      // Two expectations changed on 2026-09-08 and the change is the point of them.
      // This test used to assert every call cell read exactly "balanced" and that
      // there was NO gene checkbox, "with nothing to mark". Both encoded the same
      // limitation: on a balanced rearrangement the copies column reads two on every
      // row, and the table had nothing else to say. It now says which segments were
      // exchanged, and the gene layer opens on the breakpoints, which for t(9;22)
      // are where BCR and ABL1 sit. Balanced still means balanced: what is asserted
      // now is that no row is a gain or a loss.
      await open(page, '46,XY,t(9;22)(q34;q11.2)');
      await page.waitForSelector('#imbalance table');
      const st = await page.evaluate(() => ({
        noneLine: !!document.querySelector('#imbalance .imb-none'),
        bodyText: document.getElementById('imbalance').textContent,
        rows: document.querySelectorAll('#imbalance tbody tr').length,
        calls: [...document.querySelectorAll('#imbalance td.call')].map((c) => c.textContent),
        deviant: document.querySelectorAll('#imbalance tr.gain, #imbalance tr.loss').length,
        checkbox: !!document.querySelector('#imbgenes'),
        legendFirst: !!(document.getElementById('legend-card').compareDocumentPosition(
          document.getElementById('imbalance-card')) & Node.DOCUMENT_POSITION_FOLLOWING),
      }));
      assert.ok(!st.noneLine, 'no "None:" summary line');
      assert.doesNotMatch(st.bodyText, /keeps its expected copies/, 'and the old phrase is gone');
      // 2026-09-08, reading the t(16;16) table: on a fully balanced chromosome a
      // segment that neither moved nor flipped says only that nothing happened to
      // it, so it no longer earns a row. The panel is titled Involved segments,
      // and these are the involved ones.
      assert.equal(st.rows, 2, 'only the pieces that crossed over are listed');
      assert.equal(st.deviant, 0, 'nothing is gained or lost');
      assert.ok(st.calls.every((c) => c.indexOf('balanced') === 0), 'every row reads balanced first');
      assert.ok(st.calls.every((c) => c.indexOf('exchanged') >= 0),
        'and every listed row is one that moved');
      assert.ok(st.checkbox, 'the gene checkbox opens, since genes sit at the breakpoints');
      assert.ok(st.legendFirst, 'the legend card sits above the imbalance card (owner order)');
    });

    await t.test('the gene layer names what sits at the breakpoints of a balanced exchange', async () => {
      // The whole point of opening the layer here: a balanced translocation has no
      // gained or lost segment by definition, so the genes that matter are the ones
      // the breaks run through. t(9;22) is the case everyone checks.
      await open(page, '46,XY,t(9;22)(q34;q11.2)');
      await page.waitForSelector('#imbgenes');
      await page.click('#imbgenes');
      await page.waitForFunction(() => /At the breakpoints/.test(
        document.getElementById('imbalance').textContent));
      const txt = await page.evaluate(() => document.getElementById('imbalance').textContent);
      assert.match(txt, /9q34/);
      assert.match(txt, /ABL1/);
      assert.match(txt, /22q11\.2/);
      assert.match(txt, /BCR/);
      const italic = await page.evaluate(() =>
        [...document.querySelectorAll('#imbalance .imb-note i')].map((n) => n.textContent));
      assert.ok(italic.includes('ABL1') && italic.includes('BCR'), 'gene symbols are italicised');
    });

    await t.test('an inversion says inverted, on the span between its breakpoints', async () => {
      // The mirror of the translocation case, and the reason the marker is not just
      // "moved": the same two breakpoints mean opposite things here.
      await open(page, '46,XY,inv(16)(p13.1q22)');
      await page.waitForSelector('#imbalance table');
      const calls = await page.evaluate(() =>
        [...document.querySelectorAll('#imbalance td.call')].map((c) => c.textContent));
      assert.equal(calls.length, 1, 'the flanks that sat still are not listed: ' + JSON.stringify(calls));
      assert.equal(calls.filter((c) => c.indexOf('inverted') >= 0).length, 1,
        'the inverted span is the involved segment');
      assert.equal(calls.filter((c) => c.indexOf('exchanged') >= 0).length, 0,
        'an inversion exchanges nothing');
    });

    await t.test('beside a gain or loss the balanced flanks stay, as context', async () => {
      // The 2026-08-30 decision holds where it was made: on an IMBALANCED
      // chromosome the balanced rows show where the imbalance starts and stops.
      // Only the fully balanced case sheds its stationary rows.
      await open(page, '46,XX,del(5)(q13q33)');
      await page.waitForSelector('#imbalance table');
      const st = await page.evaluate(() => ({
        rows: [...document.querySelectorAll('#imbalance tbody tr')].map((r) =>
          [...r.cells].map((c) => c.textContent.trim()).join(' | ')),
      }));
      assert.equal(st.rows.length, 3, 'lost run plus both flanks: ' + JSON.stringify(st.rows));
      assert.match(st.rows[0], /5pter→5q13 \| 2 \| balanced/);
      assert.match(st.rows[1], /5q13→5q33 \| 1 \| monosomy/);
      assert.match(st.rows[2], /5q33→5qter \| 2 \| balanced/);
    });

    await t.test('the homolog translocation drops its stationary middle', async () => {
      // The row Dan flagged: 16p13.1→16q22, two copies, balanced, ~57 Mb, a
      // segment that sat still while the tips traded places.
      await open(page, '46,XX,t(16;16)(p13.1;q22)');
      await page.waitForSelector('#imbalance table');
      const segs = await page.evaluate(() =>
        [...document.querySelectorAll('#imbalance td.imbseg')].map((c) => c.textContent.trim()));
      assert.equal(segs.length, 2, JSON.stringify(segs));
      assert.ok(segs.indexOf('16p13.1→16q22') < 0, 'the stationary middle is gone');
    });

    await t.test('each row wears its chromosome\'s legend swatch, muted with its row', async () => {
      // The dot is the legend's involved-chromosome key at table scale (Dan,
      // 2026-09-09, coordinating the page's color systems): the detailed form
      // already inks its runs per chromosome, and the rows now key themselves
      // the same way, without inked text that would override the muted
      // context styling the 2026-08-30 hierarchy depends on.
      await open(page, '46,XY,del(5)(p15.2),inv(2)(p13q24)');
      await page.waitForSelector('#imbalance table');
      const st = await page.evaluate(() => {
        const legendHue = (label) => {
          const item = [...document.querySelectorAll('#legend .item')].find((el) => el.textContent.trim() === label);
          return item && item.firstElementChild ? item.firstElementChild.style.background : null;
        };
        return {
          chr2: legendHue('chr 2'),
          chr5: legendHue('chr 5'),
          rows: [...document.querySelectorAll('#imbalance tbody tr')].map((r) => ({
            seg: r.querySelector('td.imbseg').textContent.trim(),
            dot: r.querySelector('.imb-dot') ? r.querySelector('.imb-dot').style.background : null,
            opacity: r.querySelector('.imb-dot') ? getComputedStyle(r.querySelector('.imb-dot')).opacity : null,
          })),
        };
      });
      assert.ok(st.chr2 && st.chr5 && st.chr2 !== st.chr5, 'two involved chromosomes, two hues');
      assert.ok(st.rows.length >= 3 && st.rows.every((r) => r.dot), 'every row carries a dot: ' + JSON.stringify(st.rows));
      st.rows.forEach((r) => assert.equal(r.dot, r.seg.charAt(0) === '2' ? st.chr2 : st.chr5,
        `${r.seg} keys to its own chromosome`));
      const lost = st.rows.find((r) => r.seg === '5pter→5p15.2');
      const context = st.rows.find((r) => r.seg === '5p15.2→5qter');
      assert.equal(lost.opacity, '1', 'the finding row keeps its key at full strength');
      assert.ok(parseFloat(context.opacity) < 1, 'the muted context row mutes its dot too');
    });

    await t.test('the Realistic theme keys no dots, like the rest of its bare slide', async () => {
      await page.goto(`http://127.0.0.1:${port}/index.html?k=${encodeURIComponent('46,XY,del(5)(p15.2),inv(2)(p13q24)')}&style=realistic&show=involved`,
        { waitUntil: 'load' });
      await page.waitForSelector('#imbalance table');
      assert.equal(await page.evaluate(() => document.querySelectorAll('#imbalance .imb-dot').length), 0);
    });

    await t.test('a normal karyotype shows no table at all', async () => {
      await open(page, '46,XX');
      await page.waitForFunction(() => document.querySelector('#karyo svg'));
      const st = await page.evaluate(() => ({
        html: document.getElementById('imbalance').innerHTML,
        card: getComputedStyle(document.getElementById('imbalance-card')).display,
      }));
      assert.equal(st.html, '', 'nothing structural, nothing measured');
      assert.equal(st.card, 'none', 'the whole card is gone, not an empty shell');
    });

    await t.test('a refusal sweeps the panel with the rest of the drawing', async () => {
      await open(page, '45,XX,der(8;8)(q10;q10)del(8)(q22)t(8;9)(q24.1;q12)');
      await page.waitForSelector('#imbalance table');
      await page.click('#kinput');
      await page.keyboard.down('Meta'); await page.keyboard.press('a'); await page.keyboard.up('Meta');
      await page.keyboard.type('46,XX,xyzzy(8)');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() =>
        getComputedStyle(document.getElementById('imbalance-card')).display === 'none');
    });
  } finally {
    await browser.close();
    server.close();
  }
});
