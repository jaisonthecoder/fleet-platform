# Accessibility

Target: **WCAG 2.1 AA**. This records what the codebase already does, so new
work matches it.

---

## 1. Focus

One treatment, defined once in `base.css`, and **never removed**:

```css
:focus-visible {
  outline: 2px solid var(--noa-color-focus);
  outline-offset: 2px;
}
```

The focus colour is **navy, not brand red** — a red ring on a red button reads
as no ring. It is deliberately equal to shadcn's `--ring` so primitives agree.

Never write `outline: none`. Keyboard and screen-reader users are a meaningful
share of a B2B portal audience.

### Focus management in components

- `FilterDrawer` returns focus to its trigger on close, via an explicit
  `returnFocus` callback and `onCloseAutoFocus` preventing the default.
- `DataGrid` holds a ref to the filter trigger for the same reason.
- Radix supplies focus trapping for dialogs, sheets, menus and selects.
- The staff shell moves focus to `<main>` on navigation (asserted in
  `Workspace.test.tsx`).

---

## 2. Labels

- **`Input` and `Select` require a `label` prop by type.** A placeholder is not
  a label. `labelHidden` applies `.noa-visually-hidden` — the label still exists
  for assistive tech.
- Field ids are generated with `useId()`; you cannot pass one, so a label can
  never point at the wrong control.
- `Button` with `iconOnly` **requires the caller to pass `aria-label`**.
- Every icon button in `Pagination` and `ListingToolbar` carries an
  `aria-label`.
- Decorative SVGs are `aria-hidden="true"` throughout.

---

## 3. Announcements

| Pattern | Where |
|---|---|
| `role="alert"` on field errors | `Input`, `Select` |
| `aria-live="polite"` on the result range | `Pagination` |
| Polite result-count announcement, **suppressed on first render** | `DataGrid` |
| `role="status"` on loading and success panels | `DataGrid`, product pages |
| `aria-busy` while fetching | `DataGrid`, `Button`, `StatCounter` (non-clickable variant) |
| `role="status"` on the impersonation strip | `Header` |

Suppressing the first announcement matters: otherwise a live region talks over
page load every time.

---

## 4. Semantics

- `aria-invalid` plus `aria-describedby` linking a field to its hint or error.
- `aria-sort` on the active column only, in `DataTable`.
- `aria-pressed` on the grid/cards toggle.
- `aria-expanded` + `aria-controls` on `InfoRibbon`'s trigger; the panel is
  `role="note"` and is **unmounted while closed**, so hidden help is never
  announced.
- `aria-current="page"` on the active navigation item.
- `<time dateTime>` in `DateValue` and `NewsCard`.
- `SectionHeading` separates `as` (document outline) from `size` (appearance) so
  a heading level is never chosen for its looks.
- `NewsCard` switches its root element — `<a>`, `<button>` or `<article>` — so
  middle-click and keyboard behave correctly for each case.

### Horizontally scrolling tables

`DataTable`'s scroll container is `role="region"` + `aria-label={caption}` +
`tabIndex={0}`, so a keyboard user can actually reach and scroll it. The
`<caption>` is visually hidden.

---

## 5. Colour

- **Colour is never the only signal.** Status carries a word as well as a tint;
  see the `data-status` pattern in `08-styling.md` §4.
- `--text-muted` (`#a7a7a6`) is **decorative only** — it does not meet AA for
  body text. Do not use it for anything a user must read.
- Status colours use the extension tokens; brand red is reserved for actions and
  errors.

---

## 6. Motion

`base.css` honours `prefers-reduced-motion: reduce` globally, collapsing
animation and transition durations and disabling smooth scrolling. The brand
forbids bounce and scale animations anyway.

---

## 7. Touch targets

`--noa-touch-target` is `44px` and is what `Button size="lg"` uses. Use it for
anything primarily operated on a phone.

The customer shell's `Header` **hides its `nav` slot below 768px** — a mobile
menu button belongs in `actions`, or it disappears exactly where it is needed.

---

## 8. Testing

`e2e/foundation.spec.ts` runs `@axe-core/playwright` against the workspace, and
screenshots at desktop (1440×1000) and mobile (390×844) including a Spanish
rendering.

**Gap:** axe runs against the **UI-kit routes only**. No product screen —
dashboard, Team, Customers, Staff, login — is covered by an automated
accessibility check.

---

## 9. Checklist for a new screen

- [ ] Every input has a real `label`
- [ ] Icon-only buttons have `aria-label`
- [ ] Loading, empty and error states exist and are announced
- [ ] Status is readable without colour
- [ ] Focus is visible, and returns sensibly after a dialog closes
- [ ] Headings form a sensible outline, independent of visual size
- [ ] Reachable and operable by keyboard alone
- [ ] Muted grey is not carrying information
