'use strict';
// The one Chrome finder and the one static site server, for every browser test
// and every rendering script. Before this file, near-identical copies lived in
// 23 test files and 4 scripts and had drifted three ways: tests probed six
// executable paths, two review scripts probed four, and three rendering
// scripts knew only the macOS path, so a Linux box with google-chrome-stable
// passed the suite while `npm run images` failed. One copy, one behavior.
//
// CommonJS on purpose: the tests are CJS (`require`) and the .mjs scripts can
// `import { findChrome } from './lib/browser.js'` through Node's CJS interop.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

// Repo root: this file lives at scripts/lib/.
const SITE_ROOT = path.join(__dirname, '..', '..');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser', '/usr/bin/chromium',
];

// The first Chrome-shaped executable that exists, or null. CHROME_PATH wins.
function findChrome() {
  return CHROME_CANDIDATES.filter(Boolean).find((p) => fs.existsSync(p)) || null;
}

// puppeteer.launch with the executable found above and the flags every caller
// used. Throws with a plain sentence when no Chrome exists, so scripts fail
// loudly; tests check findChrome() first and skip instead.
function launchBrowser(extra) {
  const puppeteer = require('puppeteer-core');
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error('No Chrome executable found. Install Google Chrome or set CHROME_PATH.');
  }
  return puppeteer.launch(Object.assign(
    { executablePath, headless: 'new', args: ['--no-sandbox'] }, extra));
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

// Serve the repo as the site, the way the browser tests always have: path
// traversal refused, directories fall to their index.html, /api/* answered
// with an empty 204 so the beacon and feedback calls never hang a test.
// opts.api, when given, sees every /api/* request first: (req, res, url),
// return true when handled (feedback tests answer with real JSON this way).
// Resolves to a listening server on an ephemeral 127.0.0.1 port.
function serveSite(opts) {
  const root = (opts && opts.root) || SITE_ROOT;
  const api = opts && opts.api;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname.startsWith('/api/')) {
      if (api && api(req, res, url)) return;
      res.writeHead(204).end();
      return;
    }
    let file = path.join(root, decodeURIComponent(url.pathname));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

module.exports = { SITE_ROOT, MIME, findChrome, launchBrowser, serveSite };
