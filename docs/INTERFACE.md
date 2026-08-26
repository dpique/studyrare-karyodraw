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

The same principle picks the channel, not just the position: a feedback affordance points
at the on-site form, never at an engineering surface, and it opens where the reader
already is. The generated pages once sent "Send feedback" to GitHub issues, which
selected against the site's actual audience; a deep link to the app's dialog replaced
that, and the dialog now ships on every generated page, so no feedback click navigates
anywhere (2026-08-10). GitHub is no longer linked from the site at all, by owner
decision. The About page names the second channel, feedback@karyodraw.com, for readers
who prefer email.

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

## The input follows the URL-bar rule (2026-08-11)

Focusing the karyotype box while it holds exactly what is drawn selects the whole value;
focusing it mid-edit never does. One keystroke starts the next karyotype in the first
case; tweaking one breakpoint stays cheap in the second, and a second click drops the
selection either way. "What is drawn" is tracked, not inferred: every successful draw
records the box's value, so the rule covers the demo, the example chips, tour steps, deep
links, and anything the reader drew themselves. The first version applied only to the
auto-loaded demo, which made the box behave differently on a deep link than on a bare
visit for no reason a reader could see. `test/demo-input-select-browser.test.js` exercises
the rule in a real browser, because the post-focus mouseup that would collapse the
selection is invisible to a grep.

## A control with nothing to control is hidden (2026-08-11)

The Show (All / Affected) option appears only when the drawn karyotype has something to
isolate. For 46,XX the Affected view has nothing to draw; the earlier behavior kept the
control live and answered the click with an empty state telling the reader to switch back,
a dead end dressed as an option. The choice itself is preserved rather than reset: a held
"Affected" survives a normal tour step, falls back to the full karyogram while gated, and
applies again on the next abnormal karyotype. The folded view-options row skips the hidden
control's label for the same reason.

## The tour opens on screen (2026-08-11)

Starting the tour scrolls its card to the top of the screen, from either door: the
launcher button or the `?tour=1` deep link from the guide. The scroll lives in `startTour`
itself because it once sat on the button handler alone, and the deep link, the only path
the landing pages have, started the tour wherever the page happened to be. Step
navigation re-pins the card only when it has drifted out of view, so Next never lurches a
page that is already showing it.

## A span mark is a box for gain, hooks for a flip (2026-08-26, revised same day)

In Highlight mode the marks ride the white margin OUTSIDE the body, so no band loses
width to its own marker, and each device carries exactly one meaning, told apart by
shape rather than color: an amber BOX means a duplicated span, and always-teal
quarter-turn HOOKS at the top-right and bottom-left of a span mean it is drawn
end-for-end. A plain inversion is hooks alone, because it is balanced and a box would
claim a gain; the recombinant graft is box plus hooks, "an extra copy, and it is
flipped", which is exactly what dup(2p) from an inversion carrier means; a direct
duplication is a box alone. The first shipped version (#199) also framed inversions,
in teal; Dan cut the frame the same day so that a box appears exactly when something
is extra, and one device never has two meanings. Hook lead-ins run collinear with the
span-edge line, so the line appears to swing around its corner. Reversal comes from
the segment model's reversed flag, never re-derived from notation. The losing
alternatives from the preview rounds: translucent washes blend with the tint, an
inset frame narrows the bars, circulating repeat-arrows collapse at size and gesture
at duplication, and a mid-span glyph reads as marking the band it sits beside. Teal
is the segregation figures' #1f9e8f, reused because the old inversion blue was the
same hex as the first affected-palette hue and vanished on its own chromosome.
Realistic mode stays bare (#196) and every mark is pointer-transparent (#197).

**The legend describes the figure it sits under.** A legend row appears exactly when
its mark is in the drawn karyogram, read off the DOM after render, so the two cannot
disagree: a plain t(9;22) teaches only the dashed fusion seam it actually shows, and
never a dup box, hooks or carets it does not. `test/highlight-marks.test.js` pins the
marks; `test/legend-describes-the-figure-browser.test.js` pins the legend rule in a
real browser.
