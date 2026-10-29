# Beads — Specification

Vocabulary follows [GLOSSARY.md](../GLOSSARY.md). Architectural decisions are in [docs/adr/](./adr/).

## Platform

- Static site served from GitHub Pages at `https://wierzbowski.github.io/beads/`, deployed from this repo by a GitHub Action.
- Vite + TypeScript, no UI framework, `pnpm`. Vite `base` is `/beads/`.
- Target device: Android phone (Chrome and WhatsApp's in-app browser). The Creator must also work on desktop.
- UI language: Polish only. Light theme only, neutral light-grey background.
- Plain website, not a PWA. No server, no accounts.

## Routes

All routing uses the URL hash, so GitHub Pages only ever serves `index.html`.

- `#p=<payload>`: Crafting View for that pattern.
- `#kreator`: Creator.
- No hash, or any other hash: Gallery (the home page).

## Pattern Link

- Form: `https://wierzbowski.github.io/beads/#p=<payload>`.
- Payload: a format version byte, followed by a body compressed with `deflate-raw` (`CompressionStream`), all encoded as base64url. The version byte stays uncompressed so a future version may change compression too. Body fields in order:
  1. width, height
  2. palette: count, then per bead colour: RGB + label (UTF-8)
  3. pattern name (UTF-8)
  4. progress (number of done rows)
  5. reading direction (left→right / right→left)
  6. bead grid: palette indices, bit-packed at `ceil(log2(paletteSize))` bits per bead, row by row
- The exact byte layout is documented in `src/core/codec.ts`.
- Decoders must accept every format version ever released (ADR-0003).
- An invalid or corrupted payload shows a clear Polish error instead of a broken view, with a link to the Creator (`#kreator`).

## Same Pattern and saved state

- Fingerprint: hash of width, height, palette RGB values and the bead grid. Name, labels, progress and direction are excluded.
- Progress and reading direction are saved in `localStorage` under the fingerprint.
- On open: if `localStorage` has state for this fingerprint, it wins; otherwise the link's progress and direction are used (ADR-0002).
- Every change to progress or direction updates both `localStorage` and the address bar (`history.replaceState`), so the current URL always reflects the latest state.

## Gallery

### Source
- A hand-maintained list of pattern links in `src/gallery.ts`, bundled at build time (ADR-0004).
- An entry is only the link; name, size and preview are decoded from it.
- Shown in file order; new patterns go at the top.
- Duplicates are not detected. A corrected pattern replaces its old line.

### Layout
- Search field at the top: filters by pattern name, case- and diacritic-insensitive substring (`zolw` finds `Żółw`), updated as you type.
- Grid of tiles: 2 columns on a phone, as many as fit on wider screens.
- Each tile:
  - Preview drawn live from the decoded pattern, scaled to fit a fixed-height box and centred, so tall and wide patterns line up.
  - Pattern name.
  - Size, e.g. `17 × 67`.
  - Progress saved on this device, if any: `done / total` with a thin bar, or **Ukończony** when finished. Nothing for patterns never started.
- Tapping a tile opens its pattern link as a normal navigation, so Back returns to the Gallery. Saved progress still wins over the link's (ADR-0002).
- Footer: a small, unobtrusive **Kreator** link.

### Edge cases
- Empty list: **Brak wzorów w galerii.**
- No search matches: **Nie znaleziono wzorów.**
- A link that fails to decode is skipped silently (the unit test should catch it first).

## Creator

- Reached at `#kreator`. The header has a **Galeria** link back to the Gallery.

### Input
- A PNG file, or a pasted Pattern Link to edit an existing pattern.
- Each pixel becomes one bead, using exact colours. One image row is one pattern row. Row 1 is the bottom image row.
- Rejected with a Polish message:
  - any transparent (non-opaque) pixel
  - an image that doesn't fit 50 × 500 in either orientation
- Any number of colours is accepted; Colour Reduction brings it to at most 32 (see below).
- An image that fits only sideways (e.g. 67 × 17) is loaded so it can be rotated. Sharing stays disabled until the pattern is at most 50 wide and 500 tall.
- Palette is ordered from the most used colour.

### Colour Reduction
- Colour similarity is measured perceptually (CIELAB distance), not in raw RGB.
- On image import, near-identical shades (indistinguishable by eye) are merged automatically.
- **Liczba kolorów** slider: from 2 (or 1 for a single-colour image) up to the colours left after that cleanup, capped at 32. It defaults to the maximum.
- Each step merges the pair of colours with the lowest cost, where cost grows with colour distance and with the number of beads that would change. Rare stray colours (e.g. anti-aliasing) go before large, deliberate ones.
- The more-used colour of a merged pair survives, so every bead colour is an exact colour from the source image (no averaging).
- The slider always recalculates from the full set of image colours, keeping any rotation/flip. Labels stay attached to colours that survive (matched by exact colour). Manual merges are replaced.
- A pattern loaded from a link skips the automatic cleanup, so it opens unchanged. The slider can still reduce it.

### Editing
- Preview of the pattern drawn as beads.
- Palette list: swatch, bead count, editable label. Labels are pre-filled with an automatic Polish colour name (nearest common colour).
- Merge: fold a bead colour into another one. Its beads take the target colour, and it leaves the palette.
- Rotate 90° and flip horizontal/vertical.
- Pattern name field.

### Output
- **Udostępnij**: `navigator.share` with the pattern name and link (opens the Android share sheet, e.g. WhatsApp). Falls back to copying.
- **Kopiuj link**: copies to the clipboard.
- **Otwórz podgląd**: opens the Crafting View for this pattern.
- Links generated by the Creator have progress 0 and left→right direction.

## Crafting View

### Layout
- Header: pattern name.
- Pattern viewer fills the top part of the screen.
- A fixed bottom panel holds the progress bar, the row hint and the controls, within thumb reach.

### Pattern viewer
- Aligned loom grid (no offset). Beads are rounded rectangles, slightly taller than wide (Delica-like). White and very light beads get a thin outline.
- Own pinch-zoom and drag-to-pan (mouse wheel zooms on desktop). Native page zoom does not zoom the controls.
- Initially fills the screen width, with beads capped at a comfortable size on wide screens.
- Done rows are dimmed, and the current row is outlined. Row numbers run along the side.
- Auto-scrolls to keep the current row in view after it changes.
- A small arrow on the current row shows the reading direction.
- Tapping a row asks for confirmation, then sets progress so that row becomes the current row.

### Progress bar
- Shows `done / total` rows and a percentage with one decimal, e.g. `12 / 67 · 17,9%` (Polish decimal comma).

### Row hint
- `Rząd N / total (liczba kolumn: W)` for the current row, where W is the pattern width.
- Ordered runs as chips: swatch + count + label, in the reading direction.
- Below it, a smaller greyed preview of the next row's hint (if any).

### Controls
- **Następny rządek**: marks the current row done.
  - A second tap within 600 ms is ignored.
  - Each accepted tap vibrates briefly (`navigator.vibrate`, if available).
- **Cofnij**: moves progress back one row. Disabled at 0.
- **⋯ menu**:
  - **Galeria**: opens the Gallery.
  - **Kierunek czytania**: toggles left→right / right→left for this pattern.
  - **Podsumowanie kolorów**: per bead colour, beads needed in total and beads remaining.
  - **Resetuj postęp**: sets progress to 0 after confirmation.

### Completion
- When the last row is marked done, show a celebration/summary. Cofnij still works afterwards.

### Screen
- Keep the screen awake with the Wake Lock API while the Crafting View is visible. Re-acquire the lock after the page becomes visible again. Fail silently if unsupported.

## Testing

Vitest unit tests for the logic:
- encode/decode round-trip, including version handling and invalid input
- fingerprint stability: unaffected by labels, name, progress and direction; changed by any grid or colour change
- run computation and row hint ordering for both reading directions
- merge, rotate and flip
- colour reduction: near-duplicate cleanup, rare colours merged first, exact surviving colours, slider bounds, label carry-over
- PNG validation: transparency and size limits
- progress rules: done, undo, jump, reset, bounds, and `localStorage` vs link precedence
- every Gallery link decodes successfully
- Gallery search: case- and diacritic-insensitive name matching

UI is verified by hand on an Android phone.
