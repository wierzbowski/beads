# Beads

A tool that turns a small pixel image into a bead loom pattern and guides the crafter through weaving it row by row, from the bottom up.

## Pattern

**Pattern**:
A rectangular grid of beads to be woven on a loom, together with its palette, name and label set.
_Avoid_: Design, project, chart

**Source Image**:
The small pixel image a pattern is created from; one pixel becomes one bead.
_Avoid_: Picture, input file

**Bead**:
A single cell of the pattern grid, coloured with one palette colour.
_Avoid_: Pixel, cell, stitch

**Palette**:
The ordered set of distinct bead colours a pattern uses.
_Avoid_: Colour map, swatches

**Bead Colour**:
One entry in the palette: an exact colour plus its label.
_Avoid_: Colour index, shade

**Label**:
The human name shown for a bead colour, such as a plain colour word or a Miyuki catalogue code.
_Avoid_: Colour name, tag

**Merge**:
Folding one bead colour into another so every bead of the first becomes the second.
_Avoid_: Replace, quantise

**Colour Reduction**:
Lowering the number of bead colours by repeatedly merging the most similar ones, preferring merges that change the fewest beads; the more-used colour survives each merge.
_Avoid_: Quantisation, simplification, posterisation

**Same Pattern**:
Two patterns are the same when their dimensions and bead grids (including exact colours) are identical; name and labels do not matter.
_Avoid_: Identical pattern, duplicate

## Weaving

**Row**:
One horizontal line of beads, woven as a unit on the loom. Row 1 is the bottom row of the pattern.
_Avoid_: Line, layer

**Current Row**:
The lowest row not yet marked done; the one the crafter is weaving now.
_Avoid_: Active line, next line

**Done Row**:
A row the crafter has marked as finished.
_Avoid_: Completed line

**Run**:
A maximal sequence of adjacent beads of the same colour within a row, expressed as a count and a bead colour (e.g. "3 × red").
_Avoid_: Group, segment, block

**Row Hint**:
The ordered list of runs for a row, read in the reading direction.
_Avoid_: Instructions, recipe

**Reading Direction**:
The order in which the crafter threads beads in a row — left to right or right to left. It changes the order of the row hint, never the pattern itself.
_Avoid_: Orientation, flip

**Progress**:
The number of done rows in a pattern; done rows are always rows 1 through progress.
_Avoid_: Position, step

**Colour Totals**:
For each bead colour, how many beads the whole pattern needs and how many remain in rows not yet done.
_Avoid_: Bead count, shopping list

## Roles and views

**Creator**:
The view where a pattern is made from a source image (or an existing pattern link) and shared.
_Avoid_: Editor, admin

**Crafting View**:
The view the crafter uses while weaving: pattern overview, current row, row hint and progress.
_Avoid_: Player, viewer, tracker

**Pattern Link**:
A shareable address that fully contains a pattern and, optionally, its progress and reading direction.
_Avoid_: URL, share code
