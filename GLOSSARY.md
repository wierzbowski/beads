# Beads

A tool that turns an image into a bead loom pattern and guides the crafter through weaving it row by row, from the bottom up.

## Pattern

**Pattern**:
A rectangular grid of beads to be woven on a loom, together with its palette, name and label set.
_Avoid_: Design, project, chart

**Source Image**:
The image a pattern is created from, either a ready pixel pattern or a photo.
_Avoid_: Picture, input file

**Pixel Import** (*Wzór z pikseli*):
Creating a pattern from a source image in which each pixel already is one bead, keeping its exact colours.
_Avoid_: PNG import, exact import

**Image Import** (*Import z obrazka*):
Creating a pattern from a larger source image, such as a photo, by dividing a crop of it into blocks, each becoming one bead.
_Avoid_: Photo import, scaling, resize

**Crop** (*Kadr*):
The rectangular part of the source image used by an image import; its top-left corner is where the blocks start.
_Avoid_: Selection, region, offset

**Scale** (*Skala*):
The width and height of a block in source image pixels, written 1:N; horizontal and vertical scale may differ.
_Avoid_: Zoom, ratio, resolution

**Block**:
One rectangle of the crop, the size given by the scale, that becomes a single bead; its colour comes from the middle of the block, leaving out its edges.
_Avoid_: Cell, tile, chunk

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

**Colour Letter** (*Litera*):
A short code for a bead colour taken from its position in the palette, in spreadsheet-column style: A, B, … Z, then AA, AB, … The crafter writes it on the box holding those beads.
_Avoid_: Code, ID, index

**Merge**:
Folding one bead colour into another so every bead of the first becomes the second.
_Avoid_: Replace, quantise

**Selected Colour** (*Wybrany kolor*):
The bead colour chosen in the Creator's palette list, used for painting beads and opened for colour adjustment.
_Avoid_: Active colour, brush, current colour

**Paint**:
Setting a single bead to the selected colour, to fix small errors by hand.
_Avoid_: Draw, fill, edit pixel

**Colour Adjustment**:
Changing a bead colour itself, lighter or darker, in hue or in saturation; every bead of that colour changes with it.
_Avoid_: Recolour, tint, colour correction

**Manual Edit** (*Ręczna poprawka*):
A change made by hand on top of the generated pattern: a merge, a colour adjustment or a painted bead. Manual edits can be undone one at a time and are lost when the pattern is rebuilt.
_Avoid_: Tweak, override, fix

**Rebuild**:
Generating the pattern again from what it was created from (the source image, or the loaded pattern link) after the colour count, scale or crop changes, which discards manual edits.
_Avoid_: Regenerate, refresh

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
A maximal sequence of adjacent beads of the same colour within a row, expressed as a count and a bead colour (e.g. "3 × A (red)").
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

**Gallery**:
The published, hand-picked list of named patterns, shown as previews that can be searched and sorted by name. It is the app's home page.
_Avoid_: Library, collection, history, favourites

**Gallery Name**:
The unique name a pattern is listed under in the gallery, made of the letters a–z, digits and underscores and starting with a letter; it can differ from the pattern's own name.
_Avoid_: Slug, ID
