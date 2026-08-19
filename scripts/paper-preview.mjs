// Build a local reading copy of the JOSS paper: paper/paper-preview.pdf
//
//   npm run paper-preview
//
// This is NOT the submitted artifact. The real JOSS PDF is built by the
// openjournals/inara Docker image, which applies the journal template (banner,
// logo, DOI and review metadata, the ORCID marks, the two-column-ish layout). What
// this produces is the same text, figures, cross-references and bibliography in a
// plain article layout, which is what you want when checking whether a caption fits,
// a figure reads at print size, or a reference resolves.
//
// To build the real one once Docker is installed:
//   docker run --rm --volume "$PWD/paper":/data --user $(id -u):$(id -g) \
//     --env JOURNAL=joss openjournals/inara
//
// Why a script rather than a pandoc one-liner: paper.md's front matter is in JOSS's
// schema (`authors:` with orcid and affiliation indices), which pandoc's default
// template does not understand, so a plain `pandoc paper.md` renders a paper with no
// byline. Rather than duplicate the author list into a build flag, or bend the front
// matter into pandoc's shape and break the real inara build, the byline is derived
// from the same front matter at build time. paper.md stays canonical for JOSS.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = path.join(ROOT, 'paper');
const SRC = path.join(DIR, 'paper.md');
const OUT = path.join(DIR, 'paper-preview.pdf');

for (const [bin, hint] of [['pandoc', 'brew install pandoc'], ['tectonic', 'brew install tectonic']]) {
  try {
    execFileSync(bin, ['--version'], { stdio: 'ignore' });
  } catch {
    console.error(`${bin} is not installed. ${hint}`);
    process.exit(1);
  }
}

const raw = fs.readFileSync(SRC, 'utf8');
const fm = /^---\n([\s\S]*?)\n---\n/.exec(raw);
if (!fm) { console.error('paper.md has no YAML front matter.'); process.exit(1); }
const meta = yaml.load(fm[1]);

// "Name (Affiliation)" per author, so the preview shows the byline the submitted PDF
// will carry. Affiliation indices are 1-based in the JOSS schema and may be a list.
const affil = new Map((meta.affiliations || []).map((a) => [a.index, a.name]));
const byline = (meta.authors || []).map((a) => {
  const idx = Array.isArray(a.affiliation) ? a.affiliation : [a.affiliation];
  const where = idx.map((i) => affil.get(i)).filter(Boolean).join('; ');
  return where ? `${a.name} (${where})` : a.name;
});

const args = [
  SRC, '-o', OUT,
  '--pdf-engine=tectonic',
  '--citeproc', '--bibliography', path.join(DIR, 'paper.bib'),
  '--resource-path', DIR,
  '-V', 'geometry:margin=1in',
  '-V', 'linkcolor=blue',
  '-V', 'urlcolor=blue',
];
byline.forEach((b) => args.push('-M', `author=${b}`));

execFileSync('pandoc', args, { cwd: DIR, stdio: ['ignore', 'inherit', 'inherit'] });
const kb = Math.round(fs.statSync(OUT).size / 1024);
console.log(`  ${path.relative(ROOT, OUT)}  ${kb} KB`);
console.log('  Preview only. The submitted PDF comes from openjournals/inara; see the header of this script.');
