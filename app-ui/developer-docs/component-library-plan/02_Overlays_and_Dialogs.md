# Phase 2 — Overlays & Dialogs

> **Status:** ✅ Implemented — dialog, `AlertDialog` + `useConfirm`, popover, dropdown-menu,
> hover-card, and the ⌘K command palette are built, wired, and shown in `/:lang/design`. Gate green.

> **Goal.** Ship the overlay layer: **modal dialogs**, **confirmation / destructive-action windows**,
> **popovers**, **dropdown menus**, slide-over **sheets**, tooltips, hover cards, and a **⌘K command
> palette**. All Radix-based, Wayfinder-skinned, focus-trapped, keyboard + RTL correct.

Prereq: `00_Overview`. Dependencies: `@radix-ui/react-alert-dialog`, `@radix-ui/react-popover`,
`@radix-ui/react-dropdown-menu`, `@radix-ui/react-hover-card`, `cmdk`.

---

## Components

### 1. Dialog (modal) — upgrade `components/ui/dialog.tsx`
- Exists. Keep Radix Dialog. Ensure: overlay `bg-foreground/25 backdrop-blur-[2px]`, content
  `bg-background border-border rounded-[3px]` + `--shadow-raised`, `DialogHeader/Title/Description/Footer`,
  close button, `max-h-[90vh]` scroll. Sizes: sm / md / lg / xl via a `size` prop.
- Focus trap + restore, `Esc` to close, scroll-lock — all from Radix; do not regress.

### 2. Confirmation window — `components/ui/alert-dialog.tsx` + `hooks/use-confirm.tsx`
- Add Radix **AlertDialog** (role=alertdialog, no dismiss-on-overlay for destructive intent).
- **`useConfirm()`** imperative helper: `const confirm = useConfirm(); if (await confirm({title, body, confirmLabel, tone:'danger'})) {…}` — returns a promise, renders a single app-level `<ConfirmDialogHost/>`.
  - Tones: `default` (navy confirm) / `danger` (red confirm, e.g. "Decline", "Delete", "Decommission").
  - Confirm button uses `Button` variant `default` or `destructive`; Cancel = `secondary`.
  - Used for: decline booking, cancel entitlement, mark recovered, decommission vehicle, discard form.
- **a11y:** initial focus on the least-destructive action; `Esc`/Cancel; describedby the body.

### 3. Popover — `components/ui/popover.tsx`
- Radix Popover. Token surface (`bg-popover text-popover-foreground border-border` + shadow, 3px).
  Used for filter panels, quick info, mini-forms, date pickers (Phase 3). `align`/`side` props; RTL flips.

### 4. Dropdown menu — `components/ui/dropdown-menu.tsx`
- Radix DropdownMenu: items, checkbox-items, radio-items, sub-menus, separators, labels, shortcuts.
  Powers the **avatar menu** (profile / theme / language / sign out), row actions in tables, "more" menus.
  Token skin; `data-[highlighted]` = `bg-muted`; destructive item = `text-destructive`.

### 5. Sheet (slide-over) — keep `components/ui/sheet.tsx`
- Exists (mobile nav uses it). Add sizes + `side` (start/end/top/bottom) and a header/footer helper for
  detail/edit slide-overs (e.g. vehicle inspector, notification panel).

### 6. Tooltip — keep `components/ui/tooltip.tsx`
- Exists. Keep. Ensure delay + `dir`-aware side; used across the rail (compact) and icon buttons.

### 7. Hover card — `components/ui/hover-card.tsx`
- Radix HoverCard for non-critical, hover-only context (e.g. driver/vehicle mini-profile). Not keyboard-critical.

### 8. Command palette — `components/ui/command.tsx` + `⌘K`
- `cmdk` + Dialog. Global quick-nav/search (deferred header feature). Groups (Navigate, Actions),
  keyboard-first, fuzzy search, token-skinned. Wire `⌘/Ctrl-K` to open. Optional this phase; scaffold at least.

---

## Design / token mapping

| Element | Tokens |
|---|---|
| Overlay scrim | `bg-foreground/25` (+ optional `backdrop-blur-[2px]`) |
| Content surface | `bg-background`/`bg-popover`, `border-border`, `rounded-[3px]`, `--shadow-raised` |
| Highlighted item | `bg-muted` (`--surface-2`) / `text-foreground` |
| Destructive confirm | `Button variant="destructive"` (`--danger`) |
| z-index | dialog/sheet `z-50`, popover/menu `z-[70]`, tooltip `z-[80]` (match existing) |

---

## Tasks

- [ ] Add deps; create `ui/alert-dialog.tsx`, `ui/popover.tsx`, `ui/dropdown-menu.tsx`, `ui/hover-card.tsx`, `ui/command.tsx`.
- [ ] `hooks/use-confirm.tsx` + `<ConfirmDialogHost/>` mounted in `AppProviders`.
- [ ] Upgrade `dialog.tsx` (size prop) and `sheet.tsx` (sides + header/footer helpers).
- [ ] Replace the header avatar placeholder with a real **DropdownMenu** (profile / theme / language / sign out).
- [ ] Showcase entries for each (both themes, RTL); verify focus trap, `Esc`, restore-focus.
- [ ] Tests: `useConfirm` resolves true/false; dialog traps focus; menu keyboard nav; popover open/close.

## Exit checklist

- [ ] `await confirm({tone:'danger'})` opens an accessible alertdialog and resolves correctly; focus returns to trigger.
- [ ] Popover / dropdown / sheet / hover-card all token-skinned, keyboard + RTL correct, both themes.
- [ ] ⌘K palette opens and navigates (or scaffolded with a tracked follow-up).
- [ ] Gate green.
