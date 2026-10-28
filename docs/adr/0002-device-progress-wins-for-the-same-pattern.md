# Device-saved progress wins over link progress for the same pattern

Progress and reading direction are saved in the browser's local storage, keyed by a fingerprint of the pattern's dimensions and bead grid (exact colours included; name, labels and progress excluded). On opening a link, saved state for the same pattern takes precedence; the link's progress is used only when the device has none. The address bar is kept in sync, so copying it always captures the latest state for moving to another device.

## Considered Options

- **Link wins**: rejected — tapping the original WhatsApp message would silently reset progress to whatever was in that message.
- **Fingerprint including labels/name**: rejected — fixing a label and resending the link would orphan existing progress.

## Consequences

- Changing any bead (including merging colours) creates a different pattern with fresh progress. This is deliberate: old progress may not match the new grid.
- Explicit Reset is the only way to discard saved progress for a pattern.
