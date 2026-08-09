# Contributing to KaryoDraw

Thank you for your interest. KaryoDraw is a small, dependency-free browser tool
with four parts: the nomenclature parser (`iscn-parser.js`), the SVG karyogram
renderer (`karyo-render.js`), the teaching layer (`teach.js`), and the UI
(`index.html`). A small Cloudflare Worker (`worker.js`) serves the site and a few
`/api/*` endpoints; you do not need it to work on the tool itself.

## Report a problem

The easiest way, and the one that needs no account, is the **Send feedback**
button in the footer of the site. It opens a short form and automatically attaches
the karyotype you were viewing and a link to your exact view, so you only have to
describe what looked wrong.

If you prefer, open an issue at
<https://github.com/dpique/studyrare-karyodraw/issues>. The fastest way to report
a rendering or parsing problem is to include the karyotype you typed and a
shareable link: the "Copy link to this view" button reproduces the exact state
(karyotype, style, band level, and view). Say what you expected and what you saw.

## Ask a question or seek support

Use the **Send feedback** form on the site, or GitHub Issues with the "question"
label if you have a GitHub account.

## Run it locally

The interactive tool needs no build step — serve the folder with any static
server and open `index.html`:

```bash
./start.sh          # or: python3 -m http.server 8770
```

(The SEO landing pages under `karyotype/`, the hub, `about/`,
`how-to-read-a-karyotype/`, and `sitemap.xml` are generated from
`content/karyotypes.js` by `npm run build` and are not committed; CI rebuilds
them before every deploy. Run the build once if you want those pages locally.)

Run the test suite (Node's built-in runner; it regenerates the landing pages
first, since some tests read them):

```bash
npm test
```

Every pull request runs this same suite in GitHub Actions, and the deploy
workflow will not ship a commit that fails it.

## Submit a change

1. Fork and create a branch.
2. For any parser change, add or update a test in `test/parser.test.js` first,
   so the behavior is pinned.
3. Keep the code dependency-free and match the surrounding style.
4. Do not hand-edit generated or synced files: chromosome band data comes from
   `_build_inputs/` (see the README), and the brand colors are synced from the
   `studyrare-brand` kit.
5. Open a pull request describing the change and how you verified it.

## Code of conduct

By participating you agree to abide by the [Code of Conduct](CODE_OF_CONDUCT.md).
