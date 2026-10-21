# Who built this: author and tester on the "How this app was built" page

Design drafted 2026-10-21 in Claude Design, modelled on the author section of the recipe-agent About page
(`components/about/sections.tsx` `AuthorSection` and `lib/about-content.ts` in `jf8peas/recipe-agent`).

Files:

- `who-built-this-desktop.png`, `who-built-this-phone.png`: the new section and footer at 1100 px and 390 px.
- `under-the-hood.html`: a picture of the whole page with the new section in place (open in a browser). It is a design
  picture, not the shipped page; the shipped page is `apps/linear_regression/web/under-the-hood.html` (feature 018).
- `canvas/UnderTheHood.dc.html`: the design canvas source, kept so the design can be edited again.

**This file is the specification; where it and the pictures differ, this file wins.** The pictures use the design
canvas's own markup; the build should use the shipped page's existing classes (`section`, `.part`, `.card`, `.jump a`,
`.about-link`, `.page-foot`) and `theme.css` tokens rather than copying inline styles.

## What changes

Only the "How this app was built" page. The main page is unchanged; there is no "Author" link in its header.

1. **A new last section, "Who built this"**, after Part 5 (Shipping it) and before the footer, `id="people"`.
2. **A seventh jump link**, "Who built this", after "5 · Shipping it", pointing at `#people`.
3. **A footer credit line**, "Built by John Fong · Tested by Alesja Tanabe", above the Cricsheet attribution.

## The section

- Kicker (same style as the "Part 1" … "Part 5" kickers): **Who built this**.
- h2: **John Fong**.
- Bio paragraph:
  > John Fong is an on-the-tools business analyst who builds full-stack data products end to end. This app is a
  > personal project exploring how a LangGraph agent can work through a machine-learning problem the way a person
  > would, and explain what it did in cricket terms.
- Link: **View LinkedIn profile →** to `https://www.linkedin.com/in/john-fong-04b7a120/`.
- Then a card (the page's `--surface` card style) containing:
  - Kicker, muted: **Who's testing it**.
  - h3: **Alesja Tanabe**.
  - Bio, muted:
    > Alesja Tanabe is a Senior QA Engineer in Playtech's Videobet unit with nearly 5 years of experience in gaming
    > software quality. She specializes in black-box testing for physical gaming machines, evaluating platform
    > reliability, edge cases, and overall player experience on Playtech's proprietary gaming platform.
  - Link: **View LinkedIn profile →** to `https://www.linkedin.com/in/alesja-tanabe-3207931b1`.

## The two LinkedIn links

- Pill-shaped, like the jump links: 1 px `--border` outline, fully rounded, `--accent` 14 px semibold text, at least
  44 px tall, `--surface` background on hover, 3 px `--accent` focus outline. They sit on their own line, left aligned,
  and do not stretch to full width.
- `target="_blank"` and `rel="noopener"`. Each link's accessible name starts with its visible text (WCAG 2.5.3, label
  in name), says whose profile it is and that it opens in a new tab: "View LinkedIn profile for John Fong (opens in a
  new tab)" and "View LinkedIn profile for Alesja Tanabe (opens in a new tab)", so the two links are distinguishable
  to a screen reader even though their visible text is the same.

## Content rules

- All text is fixed copy written into the page; nothing is fetched. No new route, no new dependency, no images or
  photos.
- One tester only (Alesja Tanabe). The layout should allow a second tester card to be added later without redesign
  (the recipe app lists two), but only Alesja is shown now.

## Out of scope

The main page and its header; the rest of the "How this app was built" page; live figures; the recipe-agent app.
