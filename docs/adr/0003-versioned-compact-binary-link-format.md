# Versioned compact binary link format

Pattern links encode a binary payload — format version, width, height, palette (RGB + label), name, progress, reading direction, and bit-packed palette indices per bead — compressed with `deflate-raw` and encoded as base64url in the hash (`#p=…`). A typical 17 × 67 pattern with a handful of colours comes out at a few hundred characters.

## Considered Options

- **Base64 of JSON**: simpler to debug, but several times longer for the same pattern, which matters in chat messages.

## Consequences

- Links already shared can never be changed, so every decoder must keep reading all past format versions; the leading version byte makes that possible.
