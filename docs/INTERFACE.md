# Interface decisions

**Each decision here was made once, for a reason. This file holds the reason,** so a later
change is argued against it instead of quietly reversing it. The register is the same as
[`VALIDATION.md`](VALIDATION.md): what the rule is, and what went wrong or would go wrong
without it.

## Feedback stays prominent in the toolbar

The "Not right?" flag lives in the karyogram action row and is the one control drawn in
amber. As of 2026-08-09 it anchors the right edge of the row, alone, with the four export
actions grouped on the left (an owner decision swapping the two groups; the flag led on
the left before that). What is load-bearing and does not move: the flag stays in this top
row, keeps the strongest color on the panel, and sits isolated from the export cluster so
it reads as its own kind of action.

The pricing behind that: a wrong figure is the worst failure mode on a site that teaches.
An export button that is hard to find costs a click. A wrong karyogram, exported, teaches a
student the wrong thing with this site's name under it. Feedback volume is how wrong
renders get caught, so the affordance that produces feedback keeps the top row and the
strongest color. The placement that stays reverted: an earlier pass parked the flag under
the figure, quiet and bottom-right, and it was too quiet to invite a report.

## One button shape per row

Buttons in a row share one shape. Actions are grouped by purpose using position, and
distinguished by color, never by shape. The flag button is the worked example: the same
`.pbtn` shape as its neighbors, amber where they are neutral, seated apart from the export
group across the spacer. Position says which group an action belongs to; color says what
kind of action it is; a second shape would say nothing either does not already say, and
shape variation reads as a hierarchy that does not exist.

## What a tooltip is for

A tooltip earns its place by saying what the label cannot. "Copy link to this view" carries
"The link includes your Show, Bands, and Style settings", which the label has no room for
and the reader cannot guess.

The constraint that matters: a tooltip must not promise behavior that does not happen. A
copied link is a snapshot of the current view; it does not keep tracking edits made after
it is pasted, and no tooltip may imply that it does. A tooltip is read once, at the moment
of trust, and a promise broken there is a bug report the reader never files because they
never learn the promise was false.

## A figure states what the notation states

A mosaic draws every cell line side by side at one scale, each under its own notation and
cell count. This is the drawing-level twin of the parser contract in
[`VALIDATION.md`](VALIDATION.md): if it draws, it draws what was written.

The failure this rule comes from: a figure path rendered only `clones[0]`, which drew
`mos 45,X[12]/46,XX[18]` as plain monosomy X. The majority 46,XX line, 18 of the 30 counted
cells, never appeared, on the one page whose teaching point is mosaic versus non-mosaic.
The general rule extracted from it: any code path reading only `clones[0]` of a multi-clone
model is a bug until proven single-clone by construction. `test/mosaic-figure.test.js` pins
the landing-page figure, and the mosaic group in `scripts/stress-corpus.mjs` covers the
live page, including a mosaic whose clones disagree about a structural change.

## Show the rendered result before shipping visual changes

A visual change ships with a screenshot of the rendered result, reviewed before merge. The
code diff for a figure change describes the change; only the render shows it. One preview
screenshot turns two review rounds into one: without it, the first round is spent
generating the picture the diff should have carried, and the review starts on the second.
