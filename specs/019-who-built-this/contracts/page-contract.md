# Page contract additions: Who Built This

Additions to the feature 018 contract for `/under-the-hood.html`. Nothing is removed or renamed.

| Element | Contract |
|---|---|
| `nav[data-testid=jump-links]` | Seven links; the seventh is "Who built this", `href="#people"`; all carry `.pill-link` |
| `section#people[aria-labelledby=h-people]` | Last `section` in `main`, immediately before `footer#footer`; holds `p.part` "Who built this", `h2#h-people` "John Fong", bio `p`, author link, `div.testers` |
| `div.testers > .card` | One per tester (one now); holds the muted kicker "Who's testing it", `h3` "Alesja Tanabe", muted bio, link |
| `a.pill-link[data-testid=link-linkedin-author]` | Visible text "View LinkedIn profile →"; name "View LinkedIn profile for John Fong (opens in a new tab)"; `target=_blank`; `rel` has `noopener` |
| `a.pill-link[data-testid=link-linkedin-tester]` | Same; name "View LinkedIn profile for Alesja Tanabe (opens in a new tab)" |
| `footer#footer` | First paragraph "Built by John Fong · Tested by Alesja Tanabe", then the Cricsheet attribution |
| Tab order | ... stage controls, author link, tester link, "Back to the app", "Questions or ideas? Leave feedback" |
