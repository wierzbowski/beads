# Shared patterns carry a miniature as an attached image, not a link preview

Messaging apps build link previews by fetching the URL on their own servers and reading `og:image`, but the pattern lives in the hash (ADR-0001), which never reaches the host, and GitHub Pages serves the same `index.html` for every link. So **Udostępnij** attaches a Share Image of the pattern as a file to the system share, with the link in the message text; WhatsApp sends it as a photo with the link as its caption. The site itself has one fixed `og:image`, so links shared without the image still show a generic card.

## Considered Options

- **A static page per gallery entry, generated at build time**, each with its own `og:image`: a real preview card, but only for gallery patterns, not for fresh Creator patterns or links carrying progress.
- **A serverless function rendering `og:image` from the payload**: per-pattern cards for every link, but it reverses ADR-0001, moves pattern data from the hash to the query string where the host sees it, and makes long links for large patterns.

## Consequences

- The miniature depends on the browser sharing files; where it cannot, Udostępnij shares the link alone as before, without telling the user.
- The link must be part of the share text, not the `url` field, since apps often drop `url` when files are attached.
- Kopiuj link, and links forwarded on from WhatsApp, only ever show the generic card.
