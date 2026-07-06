# Contributing to KaryoDraw

Thank you for your interest. KaryoDraw is a small, dependency-free static site
with four parts: the nomenclature parser (`iscn-parser.js`), the SVG karyogram
renderer (`karyo-render.js`), the teaching layer (`teach.js`), and the UI
(`index.html`).

## Report a problem

Open an issue at
<https://github.com/dpique/studyrare-karyodraw/issues>. The fastest way to report
a rendering or parsing problem is to include the karyotype you typed and a
shareable link: the "Copy link to this view" button reproduces the exact state
(karyotype, style, band level, and view). Say what you expected and what you saw.

## Ask a question or seek support

Use GitHub Issues with the "question" label. There is no account or mailing list;
the repository is the single point of contact.

## Run it locally

There is no build step. Serve the folder with any static server and open
`index.html`:

```bash
./start.sh          # or: python3 -m http.server 8770
```

Run the parser test suite (Node's built-in runner, no dependencies):

```bash
npm test
```

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
