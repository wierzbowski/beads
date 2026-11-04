# The Creator writes Gallery entries, in local dev only

Hand-editing `src/gallery.ts` after every new pattern was tedious, so the Creator gets a **Dodaj do galerii** button that adds or replaces the entry itself. It only exists under `pnpm dev`: a Vite dev-server plugin edits the file on disk, and the production build has neither the button nor the endpoint. The gallery stays a curated file in the repo (ADR-0004) and the deployed site stays backend-free (ADR-0001). Committing and pushing remain manual, since that is the moment the change is reviewed and published.

## Considered Options

- **GitHub API from the deployed site with a personal access token**: works from the phone, but puts a write token in a browser and reverses ADR-0004 for a two-person tool.
- **Button that opens GitHub's web editor or a prefilled issue**: no new moving parts, but still a manual edit.
- **Plugin that also commits and pushes**: saves one more step, but commits with no chance to review and has to deal with branches, unrelated changes and push failures.

## Consequences

- Adding to the gallery needs the repo checked out and the dev server running; it cannot be done from the phone.
- The plugin edits the file as text (inserting one line at the top, or swapping one payload string in place) so comments, order and formatting survive and diffs stay small.
- The plugin checks Gallery Names and Same Patterns against the file on disk, not the page's bundled copy, because the page is deliberately not reloaded after the write (it would lose the Creator's state).
- ADR-0004 said the Same Pattern under different names is not detected. When adding from the Creator it now is, though only as a warning; hand edits are still unchecked.
