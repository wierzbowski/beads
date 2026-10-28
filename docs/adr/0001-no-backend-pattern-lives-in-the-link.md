# No backend: the pattern lives entirely in the link

The app is a static site on GitHub Pages with no server, database or accounts. A pattern link carries the whole pattern (grid, palette, labels, name) plus progress and reading direction, so sharing a pattern is just sending a WhatsApp message. Patterns are small (at most 50 × 500 beads, 32 colours), which keeps links short enough for messaging apps.

## Considered Options

- **Server-side storage with short IDs**: shorter links and cross-device sync, but needs hosting, persistence and some form of access control for a two-person hobby tool.
- **Link only, no device storage**: rejected because reopening the original message (or WhatsApp's in-app browser) would lose progress — see ADR-0002.

## Consequences

- Editing a pattern means producing a new link and resending it; the Creator accepts an existing link as input for this reason.
- Data goes in the URL hash so it is never sent to the host and is not subject to server URL length limits.
