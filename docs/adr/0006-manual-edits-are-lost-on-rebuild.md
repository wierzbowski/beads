# Manual edits are lost when the pattern is rebuilt

Merges, colour adjustments and painted beads are applied to the pattern as it is, not recorded as rules on top of the source. Changing the colour count, scale or crop rebuilds the pattern from the source and discards them; the Creator asks first when there is something to lose, at the start of the drag, since those controls now update live. Manual edits are meant as the last step, fixing small errors in a pattern whose shape and colours are settled.

## Considered Options

- **Keep edits where possible**: re-attach colour adjustments to their source colour if it survives Colour Reduction, and re-apply painted beads by position. Rejected because the mapping breaks down exactly when it matters: surviving colours change with the count, positions change with scale and crop, and a painted bead may land on a different colour than the one it fixed.

## Consequences

- Undo history only holds manual edits, so a rebuild clears it too.
- Rotating and flipping keep manual edits (they transform the pattern as it is) but clear the undo history.
