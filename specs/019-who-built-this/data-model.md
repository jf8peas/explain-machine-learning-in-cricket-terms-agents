# Data Model: Who Built This

No data is read, stored or served. The credits are fixed text in the page. The only entity is a **person credit** (name, role, bio, profile address) with two instances, written directly in `under-the-hood.html`:

| Role | Name | Profile address |
|---|---|---|
| Author | John Fong | `https://www.linkedin.com/in/john-fong-04b7a120/` |
| Tester | Alesja Tanabe | `https://www.linkedin.com/in/alesja-tanabe-3207931b1` |

Bios are exactly as in `design/README.md`. A second tester is added by repeating the tester `.card` inside `.testers`.
