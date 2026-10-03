# `<tab-set>`

A framework-free web component that shows one panel at a time. It knows nothing about the app: it is driven only by its children.

```html
<tab-set default-tab="working" aria-label="Page sections">
  <div data-tab="working" data-label="Working">…</div>
  <div data-tab="data" data-label="Data">…</div>
</tab-set>
<script type="module" src="./tab-set/tab-set.ts"></script>
```

## Attributes and properties

| Name | Meaning |
|---|---|
| `default-tab` | id of the tab shown when the URL names none (default: the first) |
| `aria-label` | accessible name of the tab list |
| `active` (property) | id of the tab on display |

## Behaviour

- **Panels are hidden, never removed or re-created.** Anything running inside a panel (a fetch, an animation, form inputs, scroll position inside a child) keeps its state while another tab is shown.
- **The active tab lives in the URL hash** (`#working`, `#data`). Selecting a different tab adds one history step, so Back and Forward move between tabs; selecting the active tab adds none; an unknown hash shows the default tab and rewrites the URL without adding a step. A page opened at `#data` shows that tab straight away.
- **ARIA tabs pattern**: `tablist`, `tab`, `tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, a roving tabindex, Left/Right (wrapping), Home and End.
- Tab buttons carry `data-testid="tab-<id>"`.

## Events (bubble)

`tab-hide` (just before a panel is hidden) and `tab-show` (just after another is shown), both with `detail: { id }`. Panels use them to save and restore things a browser forgets while an element is hidden, such as scroll offsets. They are not sent for the tab shown on first load; read `active` instead.

## Styling

Light DOM. Colours come from `--ts-bg`, `--ts-border`, `--ts-text`, `--ts-muted`, `--ts-accent`, defaulting to the page's `--bg`, `--border`, `--text`, `--muted`, `--accent`.
