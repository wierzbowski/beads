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
- A curated map in `src/gallery.ts`, bundled at build time (ADR-0004): `{ "<gallery name>": "<payload>" }`, where the payload is the part of a pattern link after `#p=`.
- The gallery name is the key, not the name inside the payload; size and preview are decoded from the payload.
- Gallery order is file order; new patterns go at the top.
- A corrected pattern replaces its old payload.
- Entries are added by hand or with the Creator's **Dodaj do galerii** (local dev only, ADR-0005). Hand edits are not checked for the Same Pattern under another name.

### Layout
- Search field at the top: filters by gallery name, case- and diacritic-insensitive substring (`zolw` finds `Żółw`), updated as you type.
- Order picker beside it: **Kolejność galerii** (default) or **Alfabetycznie** (Polish alphabetical order, numbers by value, so `wzór_2` comes before `wzór_10`). Search and order are kept when coming Back to the Gallery.
- Grid of tiles: 2 columns on a phone, as many as fit on wider screens.
- Each tile:
  - Preview drawn live from the decoded pattern, scaled to fit a fixed-height box and centred, so tall and wide patterns line up.
  - Gallery name.
  - Size, e.g. `17 × 67`.
  - Progress saved on this device, if any: `done / total` with a thin bar, or **Ukończony** when finished. Nothing for patterns never started.
- Tapping a tile opens `#p=<payload>` as a normal navigation, so Back returns to the Gallery. Saved progress still wins over the link's (ADR-0002).
- Footer: a small, unobtrusive **Kreator** link.

### Edge cases
- Empty list: **Brak wzorów w galerii.**
- No search matches: **Nie znaleziono wzorów.**
- A payload that fails to decode is skipped silently (the unit test should catch it first).

## Creator

- Reached at `#kreator`. The header has a **Galeria** link back to the Gallery.

### Input
- Two buttons side by side, **Wzór z pikseli** (Pixel Import) and **Import z obrazka** (Image Import), and below them a field for a pasted Pattern Link to edit an existing pattern.
- All three lead into the same editor (Colour Reduction, Editing, Output below).
- Any number of colours is accepted; Colour Reduction brings it to at most 32 (see below).
- A result that fits only sideways (e.g. 67 × 17) is loaded so it can be rotated. Sharing stays disabled until the pattern is at most 50 wide and 500 tall.
- Palette is ordered from the most used colour.
- Row 1 is the bottom row of the image (of the crop, for Image Import).

### Pixel Import
- A PNG file. Each pixel becomes one bead, using exact colours. One image row is one pattern row.
- Rejected with a Polish message:
  - any transparent (non-opaque) pixel
  - an image that doesn't fit 50 × 500 in either orientation

### Image Import
- Any image the browser can decode (PNG, JPEG, WebP, HEIC where supported), of any size. Transparent pixels are blended onto white.
- Images over 4000 px on the longer side are downscaled internally on load. Scale, crop and nudge values are still shown and entered in the original image's pixels.
- The 50 × 500 limit applies to the resulting pattern only, as for Pixel Import.

#### Skala section
Shown above the editor, only for Image Import.
- **Photo view**: the source image with the crop rectangle and the block grid drawn over it. Own pan and zoom, as in the pattern viewer.
  - Dragging a crop corner or edge handle resizes the crop; dragging inside the crop moves it (with the grid); dragging outside pans; pinch or mouse wheel zooms.
  - Two fingers or the right mouse button always pan. While the crop covers the whole image, dragging inside it pans too, since the crop cannot move.
  - Handles keep a constant on-screen size at any zoom.
  - Nudge buttons move the crop by ±1 px for fine alignment.
  - By default the crop covers the whole image.
- **Scale**: two sliders, X and Y, each with a number field for an exact value.
  - Fractional, step 0.05, from 1 up to the crop's side (one bead across). The sliders are logarithmic, so small scales stay precise on a large photo.
  - Locked together by default with a 🔗 toggle: moving either moves both. Unlocking keeps the current values. Re-locking sets Y to X.
  - Default: the smallest locked scale at which the result fits 50 × 500 in some orientation.
- Result size shown live, e.g. `11 × 67 koralików`, in red while over the limits even rotated. The editor is then hidden until the scale is raised, which also keeps tiny scales on a large photo from building a huge pattern.
- On a phone the section is stacked: photo view (about half the screen height), sliders and result size, nudge buttons; the pattern preview follows in the editor. On desktop the photo view and the pattern preview sit side by side.

#### Blocks
- The crop's top-left corner is the grid origin. The pattern is `floor(crop width / X scale)` × `floor(crop height / Y scale)` beads.
- A strip at the right or bottom narrower than a full block is left out, and shown dimmed in the photo view.
- Each bead's colour is the average of the middle 80% of its block on each axis (64% of its area, leaving out a 10% margin on every side), always at least the one pixel nearest the block's centre. Pixels only partly inside that area count in proportion. Averaging is done in linear light, not raw sRGB.
- The resulting colours go through Colour Reduction like any imported image, including the automatic near-identical cleanup. **Liczba kolorów** defaults to the maximum, as for Pixel Import.

#### Live update
- While a scale slider or the crop is being dragged, the grid overlay and the pattern preview update at most once per animation frame. Both keep their pan and zoom.
- Colour Reduction and the palette list recalculate when the drag ends.
- A scale or crop change rebuilds the pattern: the colour count resets to the default, manual edits are lost (ADR-0006), labels carry over only for exact colour matches, and rotation, flips and the pattern name are kept.

### Colour Reduction
- Colour similarity is measured perceptually (CIELAB distance), not in raw RGB.
- On image import, near-identical shades (indistinguishable by eye) are merged automatically.
- **Liczba kolorów** slider: from 2 (or 1 for a single-colour image) up to the colours left after that cleanup, capped at 32. It defaults to the maximum.
- Each step merges the pair of colours with the lowest cost, where cost grows with colour distance and with the number of beads that would change. Rare stray colours (e.g. anti-aliasing) go before large, deliberate ones.
- The more-used colour of a merged pair survives, so every bead colour is one of the colours before reduction (no averaging between them) until it is adjusted by hand.
- While the slider is dragged, the preview, the palette list and the colour count update live, at most once per animation frame. The preview keeps its pan and zoom.
- The slider always recalculates from the full set of image colours, keeping any rotation/flip. Labels stay attached to colours that survive (matched by exact colour). Manual edits are lost (ADR-0006).
- A pattern loaded from a link skips the automatic cleanup, so it opens unchanged. The slider can still reduce it.

### Editing
- Preview of the pattern drawn as beads.
- Palette list: swatch, bead count, editable label. Labels are pre-filled with an automatic Polish colour name (nearest common colour).
- Merge: fold a bead colour into another one. Its beads take the target colour, and it leaves the palette.
- Rotate 90° and flip horizontal/vertical.
- Pattern name field.

#### Selected colour and painting
- Clicking a palette row or its swatch selects that bead colour; the row is highlighted. Clicking the selected row outside its swatch, or pressing Esc, deselects. Clicks in a row's label field or merge picker never change the selection.
- While a colour is selected, tapping (not dragging) a bead in the preview paints it with that colour. Dragging still pans and the wheel still zooms. The preview shows a crosshair cursor. Tapping a bead that already has the selected colour does nothing.
- A colour painted down to zero beads stays in the palette list, dimmed with `× 0`, so the list doesn't jump; it is left out of the link. The Creator shows no colour letters, so this never shows a letter that differs from the Crafting View.
- Palette order is set when the pattern is built (most used first) and does not change during manual edits, even when counts do.
- The selection is cleared by a rebuild, or when the selected colour is merged into another one. It stays when the colour is painted down to zero or adjusted.

#### Colour adjustment
- Clicking the swatch of the already selected colour opens the **adjust dialog**: old and new colour side by side, and sliders **Jasność**, **Odcień** and **Nasycenie**.
- The sliders work in a perceptual colour space (the CIELAB family used by Colour Reduction), so lightness changes don't shift the hue.
- The preview shows the adjusted colour live while the dialog is open.
- **Anuluj** (or Esc) closes without changes; **Przywróć** sets the sliders back to the colour as generated by the last build, undoing all earlier adjustments of it; **Zastosuj** applies. The colour stays selected afterwards.
- The label is kept as it is.
- If the adjusted colour exactly matches another palette colour (including one with zero beads), **Zastosuj** offers to merge into it instead (**Ten kolor jest już w palecie jako „…” — połączyć?**). Confirming is an ordinary merge: the other colour and its label survive. Cancelling returns to the dialog. Colours that are merely close are allowed.

#### Manual edits and undo
- Manual edits are merges, colour adjustments and painted beads. Label and pattern name changes are not: they are not undone by Cofnij and survive a rebuild as before (labels by exact colour).
- **Cofnij** (and Ctrl+Z when no text field is focused) undoes the last manual edit, one at a time. Disabled when there is nothing to undo.
- Rotating or flipping clears the undo history; the edits themselves stay in the pattern.
- A rebuild (colour count, scale or crop) discards manual edits and the undo history (ADR-0006). When there are manual edits, starting to change one of those controls (dragging the **Liczba kolorów** or scale sliders, resizing or moving the crop, a nudge button, a number field) first asks; panning or zooming the photo view does not. The question is **Zmiana usunie ręczne poprawki. Kontynuować?**; Anuluj puts the control back.

### Output
- **Udostępnij**: `navigator.share` with the pattern name and link (opens the Android share sheet, e.g. WhatsApp). Falls back to copying.
- **Kopiuj link**: copies to the clipboard.
- **Otwórz podgląd**: opens the Crafting View for this pattern.
- Links generated by the Creator have progress 0 and left→right direction.

#### Dodaj do galerii
Only under `pnpm dev` (ADR-0005); absent from the production build. Disabled until there is a link, like the other buttons.
- Clicking it shows a gallery name field in the share card, prefilled from the pattern name.
- The field converts as you type: lowercase, Polish letters replaced by their base letter (`ą` → `a`, `ł` → `l`, `ż` → `z`, …), spaces and hyphens → `_`, any other character dropped. The result must match `a–z`, `0–9` and `_`, starting with a letter; confirm stays disabled until it does.
- On confirm, a dev-server plugin reads `src/gallery.ts` from disk and:
  - **New name**: inserts `name: 'payload',` as one line right after the `= {` line, so it is first in gallery order.
  - **Name taken, different payload**: the button becomes **Zastąp**; confirming swaps only that entry's payload string, keeping its position and layout (whether the payload is on the name's line or the next one).
  - **Name taken, identical payload string**: writes nothing and says **`name` jest już w galerii**.
  - **Same Pattern under other names** (compared by fingerprint): warns **Ten wzór jest już w galerii jako `name`**, listing every such name, but still allows adding.
- The rest of the file is left byte-for-byte unchanged.
- The page is not reloaded after the write, so the Creator keeps its state. The Gallery shows the entry on the next page load.
- Success shows a short message that `gallery.ts` has been updated. Nothing is committed or pushed.
- Any failure (dev server unreachable, file missing or not in the expected shape, write error) shows the error in the share card and leaves the file unchanged.

## Crafting View

### Layout
- Header: a **‹ Galeria** link in the top-left corner, then the pattern name (from the link).
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

### Colour letters
- Each bead colour gets a letter from its palette position, in spreadsheet-column style: A–Z, then AA, AB, … (with at most 32 colours, the last is AF).
- Palette order is stored in the link, so a pattern's letters never change while weaving it. Merging colours in the Creator can shift the letters of later colours.
- Letters are not stored in the link; they always follow from the palette order.

### Progress bar
- Shows `done / total` rows and a percentage with one decimal, e.g. `12 / 67 · 17,9%` (Polish decimal comma).

### Row hint
- `Rząd N / total (liczba kolumn: W)` for the current row, where W is the pattern width.
- Ordered runs as chips: swatch + count + colour letter + label in brackets, in the reading direction, e.g. `3× A (jasnoróżowy)`.
- Below it, a smaller greyed preview of the next row's hint (if any).

### Controls
- **Następny rządek**: marks the current row done.
  - A second tap within 600 ms is ignored.
  - Each accepted tap vibrates briefly (`navigator.vibrate`, if available).
- **Cofnij**: moves progress back one row. Disabled at 0.
- **⋯ menu**:
  - **Kierunek czytania**: toggles left→right / right→left for this pattern.
  - **Podsumowanie kolorów**: per bead colour (swatch, colour letter, label), beads needed in total and beads remaining.
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
- colour letters: A–Z, then AA onwards
- merge, rotate and flip
- painting a bead, colour adjustment (lightness keeps hue, exact-match detection), unused colours left out of the link, undo
- colour reduction: near-duplicate cleanup, rare colours merged first, exact surviving colours, slider bounds, label carry-over
- PNG validation: transparency and size limits
- Image Import blocks: whole and fractional scales (X and Y), dropped partial blocks, middle 80% sample area, minimum one-pixel sample, linear-light averaging, transparency blended onto white
- Image Import scale rules: default scale, slider bounds, lock and re-lock
- progress rules: done, undo, jump, reset, bounds, and `localStorage` vs link precedence
- every Gallery payload decodes successfully
- Dodaj do galerii file edits: name conversion and rules, one- and two-line entries, insert, replace, taken and unchanged names, line endings
- Gallery search: case- and diacritic-insensitive name matching
- Gallery alphabetical order: Polish letters in place, numbers by value

UI is verified by hand on an Android phone.
