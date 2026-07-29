// Build the stress-test review sheet.
//
// Every karyotype in scripts/stress-corpus.mjs is typed into the REAL app in a real
// browser — same index.html, same run(), same message code — and everything the student
// would see is captured: the karyogram, the warning box, the decode, the clinical card
// and the segregation panel. The captures are assembled into one self-contained HTML
// file with a Good / Not good control per card.
//
// Driving the page rather than calling the modules directly is the point. The draw gate,
// the band check and half the message wording live inside index.html's run(), so a Node
// reimplementation would review a program nobody uses.
//
//   npm run stress                 # whole corpus
//   npm run stress -- --filter rob # one group, for a quick loop
//   npm run stress -- --out /tmp/x.html
//
// Output defaults to karyotype-stress-test.html at the repo root (gitignored).
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { CORPUS, GROUPS } from './stress-corpus.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH
  || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const argv = process.argv.slice(2);
const argOf = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const FILTER = argOf('--filter');
const OUT = argOf('--out') || path.join(ROOT, 'karyotype-stress-test.html');

// Cases whose whole point is the 46-chromosome layout rather than one abnormality.
// For these the full karyogram is captured as well as the affected-only view.
const FULL_VIEW = new Set(['48,XXYY', '49,XXXXY', '69,XXY', '92,XXYY',
  '50,XY,+8,+9,+19,+21,t(9;22)(q34;q11.2)', '46,XY']);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.txt': 'text/plain', '.xml': 'application/xml' };

// A static server over the worktree. The app must be served over HTTP: the browser
// refuses to load its <script src> modules from file://.
function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    // The page beacons draws to /api/collect. There is no worker here; answer so the
    // request does not sit in the network log.
    if (url.pathname.startsWith('/api/')) { res.writeHead(204).end(); return; }
    let file = path.join(ROOT, decodeURIComponent(url.pathname));
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((res) => server.listen(0, '127.0.0.1', () => res(server)));
}

// Type the karyotype and press Draw: the same path as a student, so the same code runs.
// `run()` is synchronous, but the karyogram is scaled to its container by a debounced
// fit, so give the layout a beat before reading the markup back.
async function capture(page, k) {
  await page.evaluate((val) => {
    const input = document.getElementById('kinput');
    input.value = val;
    document.getElementById('draw').click();
  }, k);
  await new Promise((r) => setTimeout(r, 60));

  const shot = async () => page.evaluate(() => {
    const el = (id) => document.getElementById(id);
    const karyo = el('karyo');
    return {
      drew: !!karyo && !karyo.querySelector('.emptystate'),
      chroms: karyo ? karyo.querySelectorAll('.kchrom').length : 0,
      karyoHTML: karyo ? karyo.innerHTML : '',
      warnHTML: el('warnings') ? el('warnings').innerHTML : '',
      summaryHTML: el('summary') ? el('summary').innerHTML : '',
      decodeHTML: el('decode') ? el('decode').innerHTML : '',
      clinicalHTML: (el('clinical-card') && el('clinical-card').style.display !== 'none')
        ? el('clinical-card').innerHTML : '',
      // Both cards are hidden by style rather than emptied, so read the host only
      // when its card is actually on screen. The segregation panel is deliberately
      // suppressed for mosaics and for recognized acquired (cancer) rearrangements:
      // segregation is a germline event.
      segHTML: (el('segregation-card') && el('segregation-card').style.display !== 'none'
        && el('segregation')) ? el('segregation').innerHTML : '',
    };
  });

  const setShow = (v) => page.evaluate((val) => {
    const b = document.querySelector('#showseg button[data-show="' + val + '"]');
    if (b) b.click();
  }, v);

  await setShow('all');
  const full = await shot();
  let out = full;
  if (full.drew) {
    // The affected-only view is what makes an abnormality legible, and it is a
    // twentieth of the markup. Fall back to the full view when there is nothing to
    // isolate (a normal karyotype, a pure sex-chromosome count), which is also what
    // the app itself does.
    await setShow('affected');
    const aff = await shot();
    if (aff.drew && aff.chroms > 0 && aff.chroms < full.chroms) out = { ...aff, view: 'affected' };
    else out = { ...full, view: 'all' };
    await setShow('all');
  }
  return { ...out, view: out.view || 'all', fullHTML: FULL_VIEW.has(k) ? full.karyoHTML : '' };
}

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Show the string as typed, with spaces made visible. Half the mistakes in this corpus
// ARE a space where a comma belongs, and a proportional-width blank is invisible.
const asTyped = (k) => k === ''
  ? '<span class="ws">(empty)</span>'
  : esc(k).replace(/ /g, '<span class="ws">␣</span>');

function cardHTML(e, cap, i) {
  const actual = cap.drew ? 'draw' : 'refuse';
  const mismatch = actual !== e.expect;
  const pic = cap.drew
    ? `<div class="pane"><div class="pane-h">The drawing <span class="viewtag">${cap.view === 'affected' ? 'affected chromosomes only' : 'full karyogram'}</span></div>
         <div class="picwrap">${cap.karyoHTML}</div>
         ${cap.fullHTML && cap.view === 'affected' ? `<div class="pane-h">Full karyogram</div><div class="picwrap">${cap.fullHTML}</div>` : ''}
       </div>`
    : '<div class="pane none"><div class="pane-h">The drawing</div><p class="norender">No karyogram. The app declined to draw this.</p></div>';

  const panes = [
    cap.warnHTML.trim() ? `<div class="pane"><div class="pane-h">Helper text the student sees</div><div class="warnwrap">${cap.warnHTML}</div></div>` : '',
    pic,
    cap.summaryHTML.trim() ? `<div class="pane"><div class="pane-h">Heading</div><div class="summary">${cap.summaryHTML}</div></div>` : '',
    (cap.decodeHTML.trim() && cap.decodeHTML.trim() !== '<div class="muted">…</div>')
      ? `<div class="pane"><div class="pane-h">Explanation</div><div class="body">${cap.decodeHTML}</div></div>` : '',
    cap.clinicalHTML.trim() ? `<div class="pane"><div class="pane-h">Clinical card</div><div class="card">${cap.clinicalHTML}</div></div>` : '',
    // The segregation panel is the tallest thing on the page by a wide margin — a
    // translocation card is several screens of it. Collapsed, so the sheet stays
    // scannable and the panel is still one click away on the cards that have one.
    cap.segHTML.trim()
      ? `<details class="pane segdet"><summary><span class="pane-h">Meiotic segregation panel</span></summary><div class="body">${cap.segHTML}</div></details>`
      : '',
  ].filter(Boolean).join('');

  return `<article class="case" id="case-${i}" data-k="${esc(e.k)}" data-group="${e.group}"
    data-mismatch="${mismatch ? '1' : '0'}" data-expect="${e.expect}" data-actual="${actual}">
  <header class="case-h">
    <div class="case-id">${i + 1}</div>
    <div class="case-title">
      <code class="kt">${asTyped(e.k)}</code>
      <div class="chips">
        <span class="chip expect-${e.expect}">should ${e.expect === 'draw' ? 'draw' : 'be refused'}</span>
        <span class="chip actual-${actual}">${actual === 'draw' ? 'drew' : 'refused'}</span>
        ${mismatch ? '<span class="chip bad">does not match</span>' : ''}
      </div>
    </div>
    <div class="verdict" role="group" aria-label="Review">
      <button class="v v-ok" data-v="ok" title="This output is good">Good</button>
      <button class="v v-no" data-v="no" title="Something here is wrong">Not good</button>
    </div>
  </header>
  <div class="case-why"><p>${esc(e.why)}</p><p class="watch"><b>Look at:</b> ${esc(e.watch)}</p></div>
  <div class="panes">${panes}</div>
  <label class="notes-l">Notes<textarea class="notes" rows="2" placeholder="What is wrong, in your words. Only filled-in notes are exported."></textarea></label>
</article>`;
}

function reportHTML(rows, appCss, fontLinks) {
  const byGroup = new Map(GROUPS.map(([id, title]) => [id, { title, items: [] }]));
  rows.forEach((r, i) => {
    if (!byGroup.has(r.e.group)) byGroup.set(r.e.group, { title: r.e.group, items: [] });
    byGroup.get(r.e.group).items.push(cardHTML(r.e, r.cap, i));
  });
  const sections = [...byGroup.values()].filter((g) => g.items.length)
    .map((g) => `<section class="grp"><h2>${esc(g.title)}</h2>${g.items.join('')}</section>`).join('');

  const total = rows.length;
  const drew = rows.filter((r) => r.cap.drew).length;
  const mismatches = rows
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (r.cap.drew ? 'draw' : 'refuse') !== r.e.expect);
  const mismatch = mismatches.length;

  // The cases where the app did the opposite of what the notation calls for, listed up
  // front. This is the shortest path from opening the file to the work.
  const mismatchList = mismatch ? `<div class="misms">
    <h2>Start here: ${mismatch} karyotype${mismatch === 1 ? '' : 's'} where the app did the opposite of what the notation calls for</h2>
    <ol>${mismatches.map(({ r, i }) => `<li><a href="#case-${i}"><code>${esc(r.e.k) || '(empty input)'}</code></a>
      <span>${r.e.expect === 'draw' ? 'valid ISCN, but refused' : 'not valid ISCN, but drew'}</span></li>`).join('')}</ol>
  </div>` : '';

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>KaryoDraw stress test — ${total} karyotypes</title>
${fontLinks}
<style>${appCss}</style>
<style>
  :root { --ok: #15803d; --no: #b91c1c; --line: #e5e7eb; }
  html, body { background: #f7f8fb; }
  body { font-family: var(--font-sans, system-ui, sans-serif); color: #0f172a; margin: 0;
    padding: 0 0 120px; -webkit-font-smoothing: antialiased; }
  .wrap { max-width: 1080px; margin: 0 auto; padding: 0 20px; }
  .top { background: #fff; border-bottom: 1px solid var(--line); padding: 34px 0 26px; }
  .top h1 { font-family: var(--font-display, inherit); font-weight: 800; font-size: 30px;
    letter-spacing: -.02em; margin: 0 0 8px; }
  .top p { margin: 0 0 6px; color: #475569; max-width: 74ch; line-height: 1.55; }
  .stats { display: flex; gap: 22px; flex-wrap: wrap; margin-top: 18px; }
  .stat { background: #f1f5f9; border-radius: 10px; padding: 10px 16px; }
  .stat b { display: block; font-size: 21px; font-family: var(--font-display, inherit); }
  .stat span { font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .06em; }
  .stat.warn { background: #fef2f2; } .stat.warn b { color: var(--no); }

  .bar { position: sticky; top: 0; z-index: 30; background: rgba(255,255,255,.96);
    backdrop-filter: blur(8px); border-bottom: 1px solid var(--line); padding: 10px 0; }
  .bar .wrap { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
  .bar button, .bar .exp { font: inherit; font-size: 13px; padding: 7px 13px; border-radius: 999px;
    border: 1px solid var(--line); background: #fff; cursor: pointer; color: #334155; }
  .bar button.on { background: #0f172a; color: #fff; border-color: #0f172a; }
  .bar .prog { margin-left: auto; font-size: 13px; color: #475569; font-variant-numeric: tabular-nums; }
  #q { font: inherit; font-size: 13px; padding: 7px 12px; border-radius: 999px;
    border: 1px solid var(--line); min-width: 190px; }

  .misms { background: #fff; border: 1px solid #fecaca; border-left: 4px solid var(--no);
    border-radius: 12px; padding: 18px 22px; margin-top: 28px; }
  .misms h2 { font-family: var(--font-display, inherit); font-size: 16px; margin: 0 0 12px;
    color: var(--no); line-height: 1.4; }
  .misms ol { margin: 0; padding-left: 22px; }
  .misms li { margin-bottom: 6px; font-size: 14px; }
  .misms code { font-family: var(--font-mono, monospace); font-size: 13px; }
  .misms a { color: #0f172a; }
  .misms span { color: #64748b; font-size: 13px; margin-left: 6px; }

  .grp { margin-top: 40px; }
  .grp > h2 { font-family: var(--font-display, inherit); font-size: 15px; font-weight: 700;
    text-transform: uppercase; letter-spacing: .1em; color: #64748b; margin: 0 0 14px;
    padding-bottom: 8px; border-bottom: 1px solid var(--line); }

  .case { background: #fff; border: 1px solid var(--line); border-radius: 14px;
    padding: 18px 20px; margin-bottom: 16px; scroll-margin-top: 70px; }
  .case[data-verdict="ok"] { border-color: #bbf7d0; background: #f6fefa; }
  .case[data-verdict="no"] { border-color: #fecaca; background: #fffafa; }
  .case.hidden { display: none; }
  .case-h { display: flex; gap: 14px; align-items: flex-start; }
  .case-id { font-variant-numeric: tabular-nums; color: #94a3b8; font-size: 13px;
    font-weight: 700; padding-top: 4px; min-width: 26px; }
  .case-title { flex: 1; min-width: 0; }
  .kt { font-family: var(--font-mono, 'IBM Plex Mono', monospace); font-size: 16px;
    color: #1e293b; word-break: break-word; display: block; }
  .ws { color: #f43f5e; background: #ffe4e6; border-radius: 3px; padding: 0 1px; }
  .chips { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 7px; }
  .chip { font-size: 11px; padding: 3px 9px; border-radius: 999px; background: #f1f5f9;
    color: #475569; letter-spacing: .01em; }
  .chip.expect-draw, .chip.actual-draw { background: #ecfdf5; color: #047857; }
  .chip.expect-refuse, .chip.actual-refuse { background: #fff7ed; color: #9a3412; }
  .chip.bad { background: var(--no); color: #fff; font-weight: 600; }
  .verdict { display: flex; gap: 6px; }
  .v { font: inherit; font-size: 13px; padding: 7px 14px; border-radius: 8px; cursor: pointer;
    border: 1px solid var(--line); background: #fff; color: #475569; }
  .v-ok[aria-pressed="true"] { background: var(--ok); border-color: var(--ok); color: #fff; }
  .v-no[aria-pressed="true"] { background: var(--no); border-color: var(--no); color: #fff; }
  .case-why { margin: 12px 0 0 40px; color: #334155; font-size: 14px; line-height: 1.6; max-width: 80ch; }
  .case-why p { margin: 0 0 5px; }
  .case-why .watch { color: #475569; }
  .panes { margin: 14px 0 0 40px; display: grid; gap: 14px; }
  .pane { border: 1px solid #eef2f7; border-radius: 10px; padding: 12px 14px; background: #fcfdff;
    overflow-x: auto; }
  .pane.none { background: #fafafa; }
  .segdet > summary { cursor: pointer; list-style: none; }
  .segdet > summary::-webkit-details-marker { display: none; }
  .segdet > summary .pane-h { margin: 0; }
  .segdet > summary::before { content: '▸ '; color: #94a3b8; }
  .segdet[open] > summary::before { content: '▾ '; }
  .segdet[open] > summary { margin-bottom: 10px; }
  .pane-h { font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #94a3b8;
    font-weight: 700; margin-bottom: 9px; }
  .viewtag { text-transform: none; letter-spacing: 0; font-weight: 400; color: #94a3b8; }
  .norender { margin: 0; color: #64748b; font-style: italic; font-size: 14px; }
  /* The app scales each karyogram to its card and then pins the wrapper to the
     scaled height, as an inline style, so the unscaled layout box does not overflow.
     Those inline numbers travel with the captured markup and are meaningless here.
     Undo all three and let the figure lay out at its natural size. */
  .picwrap { overflow-x: auto; padding: 4px 0 8px; }
  .picwrap .karyogram { transform: none !important; margin: 0 !important; }
  .picwrap .kwrap, .picwrap .clone-block {
    height: auto !important; width: auto !important; overflow: visible !important; }
  .warnwrap .warnbox, .warnwrap .notebox { margin: 0 0 8px; }
  .notes-l { display: block; margin: 12px 0 0 40px; font-size: 11px; text-transform: uppercase;
    letter-spacing: .08em; color: #94a3b8; font-weight: 700; }
  .notes { display: block; width: 100%; margin-top: 5px; font: inherit; font-size: 14px;
    padding: 9px 11px; border: 1px solid var(--line); border-radius: 8px; resize: vertical;
    box-sizing: border-box; background: #fff; }
  .out { position: fixed; left: 0; right: 0; bottom: 0; background: #0f172a; color: #e2e8f0;
    padding: 14px 0; z-index: 40; }
  .out .wrap { display: flex; gap: 12px; align-items: center; }
  .out button { font: inherit; font-size: 13px; padding: 9px 16px; border-radius: 8px;
    border: 0; background: #334155; color: #fff; cursor: pointer; }
  .out button.pri { background: #f8fafc; color: #0f172a; font-weight: 600; }
  .out span { font-size: 13px; color: #94a3b8; margin-left: auto; }
  @media (max-width: 760px) {
    .case-why, .panes, .notes-l { margin-left: 0; }
    .case-h { flex-wrap: wrap; }
  }
</style>
</head><body>
<div class="top"><div class="wrap">
  <h1>KaryoDraw stress test</h1>
  <p>Every karyotype below was typed into the app and the page was read back: the drawing,
  the helper text, the explanation, the clinical card and the segregation panel, exactly as a
  student sees them. Mark anything that is wrong, unclear, or teaches the wrong thing.
  <b>The "Not good" marks are the output</b> — leave the rest alone if it is easier.</p>
  <p>"Should draw" and "should be refused" are claims about the <em>notation</em>, not the
  phenotype. A karyotype can be perfect ISCN and a devastating diagnosis.</p>
  <div class="stats">
    <div class="stat"><b>${total}</b><span>karyotypes</span></div>
    <div class="stat"><b>${drew}</b><span>drew</span></div>
    <div class="stat"><b>${total - drew}</b><span>refused</span></div>
    <div class="stat${mismatch ? ' warn' : ''}"><b>${mismatch}</b><span>not what was expected</span></div>
  </div>
</div></div>

<div class="bar"><div class="wrap">
  <button data-f="all" class="on">All</button>
  <button data-f="mismatch">Unexpected result (${mismatch})</button>
  <button data-f="todo">Not yet reviewed</button>
  <button data-f="no">Marked not good</button>
  <input id="q" type="search" placeholder="Search karyotypes…" aria-label="Search">
  <span class="prog" id="prog"></span>
</div></div>

<div class="wrap">${mismatchList}${sections}</div>

<div class="out"><div class="wrap">
  <button class="pri" id="copy">Copy the "not good" list</button>
  <button id="dl">Download it as Markdown</button>
  <button id="clear">Clear my marks</button>
  <span id="outnote">Marks are saved in this browser as you go.</span>
</div></div>

<script>
(function () {
  var KEY = 'karyodraw-stress-v1';
  var state = {};
  try { state = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { state = {}; }
  var cases = [].slice.call(document.querySelectorAll('.case'));
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };

  function paint(c) {
    var s = state[c.dataset.k] || {};
    c.setAttribute('data-verdict', s.v || '');
    c.querySelectorAll('.v').forEach(function (b) {
      b.setAttribute('aria-pressed', s.v === b.dataset.v ? 'true' : 'false');
    });
    c.querySelector('.notes').value = s.note || '';
  }
  function progress() {
    var done = cases.filter(function (c) { return (state[c.dataset.k] || {}).v; }).length;
    var no = cases.filter(function (c) { return (state[c.dataset.k] || {}).v === 'no'; }).length;
    document.getElementById('prog').textContent =
      done + ' of ' + cases.length + ' reviewed · ' + no + ' marked not good';
  }
  cases.forEach(paint); progress();

  document.addEventListener('click', function (ev) {
    var b = ev.target.closest && ev.target.closest('.v');
    if (!b) return;
    var c = b.closest('.case'), k = c.dataset.k, s = state[k] || (state[k] = {});
    s.v = (s.v === b.dataset.v) ? '' : b.dataset.v;   // clicking the active one clears it
    save(); paint(c); progress(); filter();
  });
  document.addEventListener('input', function (ev) {
    if (!ev.target.classList.contains('notes')) return;
    var c = ev.target.closest('.case'), k = c.dataset.k;
    (state[k] || (state[k] = {})).note = ev.target.value;
    save();
  });

  var mode = 'all';
  function filter() {
    var q = (document.getElementById('q').value || '').toLowerCase();
    cases.forEach(function (c) {
      var s = state[c.dataset.k] || {};
      var pass = mode === 'all' ? true
        : mode === 'mismatch' ? c.dataset.mismatch === '1'
        : mode === 'todo' ? !s.v
        : s.v === 'no';
      if (q && c.dataset.k.toLowerCase().indexOf(q) < 0) pass = false;
      c.classList.toggle('hidden', !pass);
    });
    document.querySelectorAll('.grp').forEach(function (g) {
      var any = [].slice.call(g.querySelectorAll('.case')).some(function (c) { return !c.classList.contains('hidden'); });
      g.style.display = any ? '' : 'none';
    });
  }
  document.querySelectorAll('.bar button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.bar button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); mode = b.dataset.f; filter();
    });
  });
  document.getElementById('q').addEventListener('input', filter);

  function report() {
    var lines = ['# KaryoDraw stress test — cases marked not good', ''];
    var n = 0;
    cases.forEach(function (c) {
      var s = state[c.dataset.k] || {};
      if (s.v !== 'no') return;
      n++;
      lines.push('## ' + c.dataset.k.replace(/ /g, ' ') + (c.dataset.k ? '' : '(empty input)'));
      lines.push('- expected: ' + c.dataset.expect + ' · app: ' + c.dataset.actual +
        (c.dataset.mismatch === '1' ? ' · **mismatch**' : ''));
      lines.push('- ' + c.querySelector('.case-why p').textContent.trim());
      if (s.note) lines.push('- **note:** ' + s.note.trim());
      lines.push('');
    });
    lines.splice(1, 0, n + ' of ' + cases.length + ' karyotypes marked.', '');
    return lines.join('\\n');
  }
  document.getElementById('copy').addEventListener('click', function () {
    var t = report();
    navigator.clipboard.writeText(t).then(function () {
      document.getElementById('outnote').textContent = 'Copied.';
    }, function () {
      document.getElementById('outnote').textContent = 'Could not copy; use Download instead.';
    });
  });
  document.getElementById('dl').addEventListener('click', function () {
    var b = new Blob([report()], { type: 'text/markdown' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = 'karyodraw-stress-notes.md'; a.click();
  });
  document.getElementById('clear').addEventListener('click', function () {
    if (!confirm('Clear every Good / Not good mark and note?')) return;
    state = {}; save(); cases.forEach(paint); progress(); filter();
  });
})();
</script>
</body></html>`;
}

async function main() {
  const items = FILTER ? CORPUS.filter((e) => e.group === FILTER) : CORPUS;
  if (!items.length) { console.error(`No cases for --filter ${FILTER}`); process.exit(1); }

  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const appCss = indexHtml.match(/<style>([\s\S]*?)<\/style>/)[1];
  const fontLinks = [
    ...(indexHtml.match(/<link rel="preconnect"[^>]*>/g) || []),
    ...(indexHtml.match(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>/g) || []),
  ].join('\n');

  const server = await serve();
  const port = server.address().port;
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
  });
  const rows = [];
  try {
    const page = await browser.newPage();
    // A page load fetches its own <script src> on a separate cache path and can run a
    // stale module while everything else looks current. Never review a cached build.
    await page.setCacheEnabled(false);
    await page.setViewport({ width: 1280, height: 1400, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle0' });

    for (let i = 0; i < items.length; i++) {
      const e = items[i];
      const before = errors.length;
      const cap = await capture(page, e.k);
      if (errors.length > before) {
        console.log(`  ! JS error on "${e.k}": ${errors[errors.length - 1].split('\n')[0]}`);
      }
      rows.push({ e, cap });
      const actual = cap.drew ? 'draw' : 'refuse';
      const mark = actual === e.expect ? ' ' : '!';
      process.stdout.write(`${mark} ${String(i + 1).padStart(3)}/${items.length}  ${actual.padEnd(6)}  ${e.k || '(empty)'}\n`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  const html = reportHTML(rows, appCss, fontLinks);

  // Every karyogram carries clipPath and pattern ids referenced by url(#id). They are
  // unique per render within one browser session, which is why the whole corpus is
  // captured from a single page. If that ever changes, the first matching id in the
  // document wins and cards silently borrow each other's clipping.
  const ids = html.match(/ id="(c\d+[a-z0-9]*|ring\d+[a-z0-9]*)"/g) || [];
  const dupes = ids.length - new Set(ids).size;
  if (dupes) console.log(`\n  ! ${dupes} duplicate SVG ids in the report — karyograms may clip wrongly.`);

  fs.writeFileSync(OUT, html);
  const mism = rows.filter((r) => (r.cap.drew ? 'draw' : 'refuse') !== r.e.expect);
  console.log(`\n${rows.length} karyotypes · ${rows.filter((r) => r.cap.drew).length} drew · ${mism.length} not what was expected`);
  if (mism.length) {
    console.log('\nUnexpected:');
    mism.forEach((r) => console.log(`  ${r.e.expect === 'draw' ? 'refused but is valid ISCN ' : 'drew but is not valid ISCN'}  ${r.e.k || '(empty)'}`));
  }
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}  (${(fs.statSync(OUT).size / 1048576).toFixed(1)} MB)`);
}

main().catch((err) => { console.error(err); process.exit(1); });
