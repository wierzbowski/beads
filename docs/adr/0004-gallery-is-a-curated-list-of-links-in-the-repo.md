# The gallery is a curated list of pattern links kept in the repo

The gallery lists patterns that are hard-coded in a source file and deployed with the site. Adding or replacing a pattern means editing that file and committing. Each entry maps a gallery name to a link payload (the part after `#p=`); size and preview are decoded from the payload. The gallery name is the key rather than the name inside the payload, so the file reads as a list of names and a pattern can be renamed in the gallery without regenerating its link. This keeps ADR-0001 intact (still no backend) while making the list identical on every device and immune to cleared browser data.

## Considered Options

- **Automatic per-device history in `localStorage`**: no effort to maintain, but tied to one browser, lost when storage is cleared, and possibly split between Chrome and WhatsApp's in-app browser.
- **A backend or GitHub API with a token** (Gist, Supabase, …): editable from the app, but reverses ADR-0001 for a two-person tool.
- **A runtime-fetched JSON file**: easier to edit by hand, but adds loading and error states for no real gain, since the site is redeployed anyway.

## Consequences

- The gallery is public: anyone who opens the site or reads the repo sees every listed pattern.
- A unit test decodes every gallery payload, so a truncated paste fails the tests instead of reaching the gallery.
- Gallery names are unique, being keys. Duplicate patterns under different names are not detected; a corrected pattern replaces its old payload by hand.
- The gallery name and the name shown in the Crafting View (from the payload) can differ.
