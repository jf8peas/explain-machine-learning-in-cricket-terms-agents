# UI Contract: header links and the Under the hood page

Test ids are the contract between the page and the Playwright tests. Existing ids are unchanged.

## Main page header (`/`)

| Element | Contract |
|---|---|
| `nav[aria-label="About this app"]` `data-testid="about-nav"` | Beside `data-testid="breadcrumb"`, above the tab bar, visible on every tab |
| `a[data-testid="link-under-the-hood"]` | text "Under the hood"; `href="/under-the-hood.html"`; no `target` |
| `a[data-testid="link-feedback"]` | text "Feedback"; `href="https://github.com/jf8peas/explain-machine-learning-in-cricket-terms-agents/issues"`; `target="_blank"`; `rel` contains `noopener`; accessible name "Feedback (opens the GitHub issues page in a new tab)" |
| icons | inline `svg[aria-hidden="true"]`; each link at least 44 px tall |

## Under the hood page (`/under-the-hood.html`)

| Element | Contract |
|---|---|
| `h1` | "How this app was built" |
| `a[data-testid="back-top"]`, `a[data-testid="back-footer"]` | text "Back to the app"; `href="/"` |
| `a[data-testid="link-feedback"]` (top bar) and `a[data-testid="link-feedback-footer"]` | same target and `rel` as the header link; the top bar link has the same accessible name; the footer link shows "Questions or ideas? Leave feedback" and its accessible name is that text plus "(opens the GitHub issues page in a new tab)" so the visible words are part of the name |
| `nav[data-testid="jump-links"]` | six anchors to the section ids below |
| sections | ids `question`, `big-picture`, `data`, `play`, `agent`, `what-you-see`, `shipping`; footer `footer` |
| `[data-figure="<key>"]` | every live figure; text is the formatted value or "not available right now" |
| `button[data-testid="toggle-all"]` | "Expand all" or "Collapse all" |
| `button[data-testid="stage-header-<n>"]`, `n` in 1, 2, 3, 4, 5-6, 7, 8 | `aria-expanded` "true"/"false"; `aria-controls` the id of `[data-testid="stage-panel-<n>"]` (`hidden` when closed); at least 44 px tall |
| `[data-figure-group="<name>"]` | wraps a sentence that holds two or more `[data-figure]` spans; if any of them is absent the whole group's text becomes "These figures are not available right now." |

No script is needed to read any text; scripts only fill `[data-figure]` and run the panels.
